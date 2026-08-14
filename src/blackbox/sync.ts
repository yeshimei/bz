/**
 * 黑匣子增量提炼链路（ticket 59）：vault modify/create 监听（防抖 30 分钟）+
 * 打开黑匣子即时提炼 + 首次启用历史全量（分批 50 串行 + 进度通知）。
 * AI 依赖注入（测试传 mock；生产默认 createAI()）。
 */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { getBlackBoxAI } from './ai';
import { BlackBoxDataManager } from './data';
import { isDiaryStreamFile, parseDiaryFile, scanAllDiaryEntries } from './diary-scan';
import { applyExtraction, buildExtractPrompt, parseExtractJson } from './extract';
import { cursorEntryIndex } from './types';
import type { BlackBoxData, DiarySourceEntry } from './types';

/** 防抖时长：30 分钟（用户决策 Q5） */
export const EXTRACT_DEBOUNCE_MS = 30 * 60 * 1000;
/** 首次全量分批大小 */
export const FULL_BATCH_SIZE = 50;
/** 单次 AI 提炼条目上限（提示词长度控制） */
export const MAX_ENTRIES_PER_CALL = 50;

let registered = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inflight = false;
let _ai: any = null;
let _app: any = null;

/** 是否有提炼在途（测试断言用） */
export function getExtractionInFlight(): boolean {
  return inflight;
}

/** 注册常驻监听（幂等；unload 清理） */
export function ensureBlackBoxExtraction(app: any, ai?: any): void {
  if (registered) return;
  registered = true;
  _ai = ai || null;
  _app = app;
  const onFile = (file: any) => {
    if (!file || !isDiaryStreamFile(file.path || file)) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void processPendingEntries(app, _ai || undefined);
    }, EXTRACT_DEBOUNCE_MS);
  };
  app.vault.on('modify', onFile);
  app.vault.on('create', onFile);
  (app as any).__blackBoxExtractionOff = () => {
    app.vault.offref({ event: 'modify', cb: onFile });
    app.vault.offref({ event: 'create', cb: onFile });
  };
}

/** unload 清理（监听 + 防抖计时器） */
export function unloadBlackBoxExtraction(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (_app && (_app as any).__blackBoxExtractionOff) {
    (_app as any).__blackBoxExtractionOff();
    delete (_app as any).__blackBoxExtractionOff;
  }
  registered = false;
  _ai = null;
  _app = null;
}

/**
 * 启动时自动提炼（用户反馈「重启后没反应」修复）：
 * - 无 cursor 且日记非空 → 首次全量提炼（通知「正在提炼历史日记…」）
 * - 有 cursor 但存在待处理条目 → 增量提炼
 * - AI 未配置（无 deepseek/opencode-go key）→ warning 提示去设置（避免静默失败）
 */
export async function autoStartBlackBoxExtraction(app: any, ai?: any): Promise<void> {
  try {
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    const all = await scanAllDiaryEntries(app);
    if (all.length === 0) return; // 无日记，无事可做
    // AI 配置检查（与 core/getAIProvider 逻辑一致：默认 opencode-go；deepseek 需设置 aiProvider='deepseek'）
    const { tryGetSettings } = await import('../core/settings-provider');
    const s = tryGetSettings() as any;
    const provider = (s && s.aiProvider) || 'opencode-go';
    const hasAI = provider === 'deepseek' ? !!(s && s.deepseekApiKey) : !!(s && s.opencodeGoApiKey);
    if (!hasAI) {
      notice(`黑匣子需要配置 AI（设置 → AI 配置）：当前服务商 ${provider === 'deepseek' ? 'DeepSeek' : 'OpenCode Go'} 未填 API Key`, 'warning', 8000);
      return;
    }
    if (!data.cursor) {
      await runFullExtraction(app, ai);
    } else {
      await processPendingEntries(app, ai);
    }
  } catch {
    // 启动阶段静默（不阻塞插件加载）
  }
}

/** 是否有待处理条目（打开黑匣子时判断；cursor 为空 = 首次全量） */
export async function hasPendingEntries(app: any): Promise<boolean> {
  const dm = new BlackBoxDataManager();
  const data = await dm.load();
  if (!data.cursor) return true; // 首次：全量
  const all = await scanAllDiaryEntries(app);
  return collectNewEntries(all, data).length > 0;
}

/**
 * 收集新条目：cursor 为 null → 全量；否则 = cursor 文件内 slice(entryIndex) + 更新日期的文件。
 * all 按日期降序（scanAllDiaryEntries 产出）；cursor 失效（文件被删）→ 全量回退。
 */
export function collectNewEntries(all: DiarySourceEntry[], data: BlackBoxData): DiarySourceEntry[] {
  if (!data.cursor) return all.slice();
  const cf = data.cursor.file;
  const ci = data.cursor.entryIndex;
  const fileEntries = all.filter((e) => e.filename === cf);
  if (fileEntries.length === 0) return all.slice(); // cursor 文件被删 → 全量回退
  // 该文件 parse 顺序 = 时间升序
  const fileAsc = fileEntries.slice().sort((a, b) => a.time.localeCompare(b.time));
  const newInFile = fileAsc.slice(ci);
  const cfDate = cf.replace(/\.md$/, '');
  const newer = all.filter((e) => e.date > cfDate);
  return [...newer, ...newInFile];
}

/** 提炼完成后推进 cursor（到批次中日期最新条目的文件 + 该文件条目总数；无处理不推进） */
function advanceCursor(data: BlackBoxData, processed: DiarySourceEntry[], all: DiarySourceEntry[]): void {
  if (processed.length === 0) return;
  // 取日期+时间最新的条目（processed 来自 date desc 排序，首条即最新；显式 reduce 保证）
  const newest = processed.reduce((a, b) => (a.date + a.time > b.date + b.time ? a : b));
  const count = all.filter((e) => e.filename === newest.filename).length;
  data.cursor = { file: newest.filename, entryIndex: count };
}

/** 单批提炼结果 */
type BatchResult = 'ok' | 'ai-fail' | 'parse-fail';

/** 单批提炼（AI 调用 + 应用；返回结果分类——失败可见，不静默） */
async function extractBatch(app: any, ai: any, entries: DiarySourceEntry[], data: BlackBoxData): Promise<BatchResult> {
  const prompt = buildExtractPrompt(entries);
  if (!prompt) return 'parse-fail';
  try {
    const text = await ai.json(prompt);
    const result = parseExtractJson(text);
    if (!result) {
      console.warn('[黑匣子] AI 提炼返回无法解析:', (text || '').slice(0, 200));
      return 'parse-fail';
    }
    applyExtraction(data, result, entries);
    return 'ok';
  } catch (err: any) {
    console.warn('[黑匣子] AI 提炼调用失败:', err && err.message ? err.message : err);
    return 'ai-fail'; // AI 失败：跳过下次重试
  }
}

/** 增量提炼（打开黑匣子时调用；处理全部待处理条目，分 MAX_ENTRIES_PER_CALL 批） */
export async function processPendingEntries(app: any, ai?: any): Promise<boolean> {
  if (inflight) return false;
  inflight = true;
  try {
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    const profilesBefore = data.profiles.length;
    const eventsBefore = data.events.length;
    const emotionsBefore = (data.entryEmotions || []).length;
    const all = await scanAllDiaryEntries(app);
    const pending = collectNewEntries(all, data);
    if (pending.length === 0) return false;
    const service = ai || _ai || getBlackBoxAI();
    let okCount = 0, failCount = 0;
    let processedAll: DiarySourceEntry[] = [];
    for (let i = 0; i < pending.length; i += MAX_ENTRIES_PER_CALL) {
      const batch = pending.slice(i, i + MAX_ENTRIES_PER_CALL);
      const r = await extractBatch(app, service, batch, data);
      if (r === 'ok') {
        okCount++;
        processedAll = processedAll.concat(batch);
      } else {
        failCount++;
      }
    }
    if (okCount > 0) {
      advanceCursor(data, processedAll, all);
      await dm.save(data);
      const p = data.profiles.length - profilesBefore;
      const e = data.events.length - eventsBefore;
      const emo = (data.entryEmotions || []).length - emotionsBefore;
      notice(`提炼完成：处理 ${pending.length} 条日记，新增人物 ${p}、事件 ${e}、情绪 ${emo} 条${failCount > 0 ? `（${failCount} 批失败将重试）` : ''}`, 'success');
      return true;
    }
    notice('提炼失败：AI 调用未成功，请检查 AI 配置与控制台日志', 'warning');
    return false;
  } finally {
    inflight = false;
  }
}

/** 首次全量提炼（cursor 为空时；分批 FULL_BATCH_SIZE 串行 + 进度通知 + 完成汇总；全失败不推进 cursor） */
export async function runFullExtraction(app: any, ai?: any): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    const profilesBefore = data.profiles.length;
    const eventsBefore = data.events.length;
    const emotionsBefore = (data.entryEmotions || []).length;
    const all = await scanAllDiaryEntries(app);
    if (all.length === 0) return;
    const service = ai || _ai || getBlackBoxAI();
    const total = all.length;
    const batches = Math.ceil(total / FULL_BATCH_SIZE);
    let done = 0;
    let okCount = 0, failCount = 0;
    for (let b = 0; b < batches; b++) {
      const batch = all.slice(b * FULL_BATCH_SIZE, (b + 1) * FULL_BATCH_SIZE);
      notice(`正在提炼历史日记… ${Math.min(done + batch.length, total)}/${total}`, 'info');
      const r = await extractBatch(app, service, batch, data);
      if (r === 'ok') okCount++;
      else failCount++;
      done += batch.length;
    }
    if (okCount === 0) {
      // 全部失败：不推进 cursor（下次启动重试），明确提示
      notice('提炼失败：AI 调用未成功，请检查 AI 配置（设置 → AI）与控制台日志', 'warning', 8000);
      return;
    }
    // 全量完成：cursor 指向最新文件（成功批次已覆盖其条目）
    const newest = all[0];
    const count = all.filter((e) => e.filename === newest.filename).length;
    data.cursor = { file: newest.filename, entryIndex: count };
    await dm.save(data);
    const p = data.profiles.length - profilesBefore;
    const e = data.events.length - eventsBefore;
    const emo = (data.entryEmotions || []).length - emotionsBefore;
    notice(`提炼完成：${total} 条日记 → 新增人物 ${p}、事件 ${e}、情绪 ${emo} 条${failCount > 0 ? `（${failCount} 批失败，下次启动重试）` : ''}`, 'success', 8000);
  } finally {
    inflight = false;
  }
}