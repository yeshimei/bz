/**
 * 今日回顾 R3：一键生成总结写进日记（设计稿 .scratch/design-recap-reliability.md R3 节）。
 *
 * 职责分两半，均不碰 UI：
 *  1. generateRecapContent——把 buildRecap 的当天聚合（摘要数字+时间轴条目文本）喂既有 AI 通道
 *     （core/ai createAI，模型/密钥走用户设置），产出一段口语化中文总结（150~300 字，第二人称）；
 *     未配置 AI / 调用失败 / 返回空内容（思考型模型 reasoning 吃光 max_tokens 的既有坑，
 *     对策：createAI 默认 8192 tokens 头寸 + 空内容即降级）→ 纯数字模板总结，不写盘，
 *     由调用方（ui 层）弹通知给「写入日记/复制」动作。
 *  2. writeRecapEntry——把总结作为一条带「今日回顾」标记的日记条目写进当天日记。
 *     全程走 diary 既有写入 API（refreshFile/addEntry/deleteEntry，函数级动态 import，
 *     不改 src/diary 任何文件——旧域冻结区）；替换语义 = 先插新条目再删旧条目
 *     （失败顺序的安全性：插入失败旧内容原样保留；删除失败最多暂时叠条，下次生成自愈，
 *      任意一步失败文件都是 diary writeFile 全量重写的合法形态，不会写坏用户日记）。
 *
 * 条目标识（重要）：日记标签靠 emoji 往返（parser emojiToTagMap），「今日回顾」不在标签配置里，
 * 写盘后 emoji 回落 📖、重解析变回「日记」标签——故用正文首行标记「【今日回顾】」做稳定标识，
 * 写入标签用常规 ['日记']，往返无损。
 */
import type { App, TFile } from 'obsidian';
import { createAI, getAIProvider } from '../core/ai';
import { parseFile } from '../diary/parser';
import type { DiaryEntry } from '../diary/types';
import { fmtHM, localDayStr, settingDir } from './aggregate';
import type { RecapData, RecapSummary, RecapDomain } from './aggregate';

/** 写入条目的正文首行标记（识别「今日回顾」条目的唯一稳定依据，见文件头注释） */
export const RECAP_MARKER = '【今日回顾】';


/* ---------- 纯函数：数字段 / 模板 / 提示词 / 条目正文 ---------- */

/** 关键数字段（读取失败的域不计入——数字不可信宁可不写） */
export function numbersSegments(summary: RecapSummary, failed: RecapDomain[]): string[] {
  const segs: string[] = [];
  if (!failed.includes('diary')) segs.push(`日记 ${summary.diary} 条`);
  if (!failed.includes('cinema')) segs.push(`影视 ${summary.movies} 部`);
  if (!failed.includes('bookshelf')) segs.push(`读完 ${summary.books} 本`);
  if (!failed.includes('todo')) segs.push(`完成 ${summary.todoDone} 个待办`);
  if (!failed.includes('pomodoro')) segs.push(`番茄 ${summary.pomodoros} 个 ${summary.pomodoroMinutes} 分钟`);
  return segs;
}

/** 末尾一行关键数字（如「今日数字：日记 2 条 · 影视 1 部…」；全失败返回空串） */
export function numbersLine(summary: RecapSummary, failed: RecapDomain[]): string {
  const segs = numbersSegments(summary, failed);
  return segs.length ? `今日数字：${segs.join(' · ')}` : '';
}

/** 降级模板总结（设计稿口径：「今天：日记 N 条、影视 N 部、读完 N 本、完成 N 个待办、番茄 N 个 M 分钟」） */
export function templateSummary(summary: RecapSummary, failed: RecapDomain[]): string {
  const segs = numbersSegments(summary, failed);
  return segs.length ? `今天：${segs.join('、')}` : '今天：暂时没有可用的记录';
}

/** AI 输入摘要：数字 + 时间轴痕迹文本（一行一条，域口径与面板时间轴一致） */
export function buildRecapDigest(data: RecapData): string {
  const lines: string[] = [];
  const nums = numbersSegments(data.summary, data.failed);
  if (nums.length) lines.push(`【今日数字】${nums.join('、')}`);
  if (data.items.length) {
    lines.push('【今日痕迹】');
    for (const it of data.items) lines.push(`- ${it.timeLabel} ${it.text}`);
  }
  return lines.join('\n');
}

/** 生成总结的提示词（口语化、第二人称、150~300 字、只输出正文） */
export function buildSummaryPrompt(digest: string): string {
  return [
    '你是用户的私人日记助手「包仔」。根据下面这位用户今天的生活记录，写一段今日总结，直接说给用户本人听：',
    '- 口语化，像朋友聊天一样自然，温暖不油腻',
    '- 全程用第二人称「你」',
    '- 150~300 字：可以点名今天看过的影视、读过的书、完成的待办、专注的时段，结尾给一句轻松的观察或祝愿',
    '- 只输出总结正文：不要标题、不要列表、不要「以下是总结」之类的说明',
    '',
    digest,
  ].join('\n');
}

/** AI 返回消毒：日记条目正文里行首 `# … HH:mm` 形会在重解析时被误切成新条目，
 *  命中该形态的行把半角 # 换成全角＃（总结是纯文本，不影响阅读） */
export function sanitizeSummaryText(text: string): string {
  return text
    .split('\n')
    .map((line) => (/^#{1,6}\s+\S+\s+\d{2}:\d{2}/.test(line) ? line.replace(/^#+/, (h) => '＃'.repeat(h.length)) : line))
    .join('\n')
    .trim();
}

/** 组装写入条目的完整正文：标记行 + 正文（+ AI 模式的末尾关键数字行） */
export function buildEntryContent(
  body: string,
  summary: RecapSummary,
  failed: RecapDomain[],
  opts: { withNumbers: boolean }
): string {
  const parts = [RECAP_MARKER, body.trim()];
  if (opts.withNumbers) {
    const nums = numbersLine(summary, failed);
    if (nums) parts.push('', nums);
  }
  return parts.join('\n');
}

/** 是否「今日回顾」条目（正文首行标记；trim 容忍写盘/解析的空白差异） */
export function isRecapEntry(e: DiaryEntry): boolean {
  return typeof e.content === 'string' && e.content.trimStart().startsWith(RECAP_MARKER);
}

/** 去掉标记行后的可读文本（复制动作用） */
export function entryTextWithoutMarker(content: string): string {
  const lines = content.split('\n');
  if (lines.length && lines[0].trim() === RECAP_MARKER) return lines.slice(1).join('\n').trim();
  return content.trim();
}

/* ---------- AI 生成（不写盘） ---------- */

export interface RecapGenerateResult {
  /** false = 数据全不可用，连模板也没有（degradeReason 给人话原因） */
  ok: boolean;
  /** ai = AI 生成（应自动写入）；template = 降级模板（应弹通知给「写入日记/复制」，不自动写） */
  mode: 'ai' | 'template';
  /** 完整条目正文（writeRecapEntry 直接可用） */
  content: string;
  /** 未走 AI 的人话原因（ai 模式为 null） */
  degradeReason: string | null;
}

/** AI 配置解析（未配置给人话原因；配置正常返回 null） */
async function aiUnavailableReason(): Promise<string | null> {
  try {
    await getAIProvider();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 * 生成今日总结内容（不写盘）：AI 成功 → mode 'ai'；未配置/失败/空内容 → mode 'template'。
 * 抛错仅发生在「五域全失败」等无米之炊场景（ok=false）。
 */
export async function generateRecapContent(data: RecapData): Promise<RecapGenerateResult> {
  const summary = data.summary;
  const failed = data.failed;

  // 全域读取失败：数字与痕迹都不可信，不生成也不写
  if (failed.length >= 5) {
    return { ok: false, mode: 'template', content: '', degradeReason: '今天的数据暂时读不到，请稍后再试' };
  }

  const template = () =>
    templateSummary(summary, failed);

  // AI 未配置 → 直接模板（理由带引导，供通知展示）
  const unavailable = await aiUnavailableReason();
  if (unavailable) {
    return { ok: true, mode: 'template', content: buildEntryContent(template(), summary, failed, { withNumbers: false }), degradeReason: `未配置 AI 服务（${unavailable}），已生成数字模板总结` };
  }

  try {
    const ai = createAI();
    const raw = await ai.chat(buildSummaryPrompt(buildRecapDigest(data)));
    const text = sanitizeSummaryText(String(raw || ''));
    if (!text) {
      // 思考型模型 reasoning 吃光 max_tokens 时 content 为空串（项目既有坑）→ 降级模板
      return { ok: true, mode: 'template', content: buildEntryContent(template(), summary, failed, { withNumbers: false }), degradeReason: 'AI 返回了空内容，已生成数字模板总结' };
    }
    return { ok: true, mode: 'ai', content: buildEntryContent(text, summary, failed, { withNumbers: true }), degradeReason: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[recap] AI 总结生成失败，降级数字模板:', e);
    return { ok: true, mode: 'template', content: buildEntryContent(template(), summary, failed, { withNumbers: false }), degradeReason: `AI 调用失败（${msg}），已生成数字模板总结` };
  }
}

/* ---------- 日记写入 / 替换（全程 diary 既有 API，函数级动态 import） ---------- */

export type RecapWriteOutcome = 'written' | 'replaced';

/** 当天日记文件路径（diaryDirectory 设置口径，与 diary/store DIARY_DIRECTORY 同源设置键） */
export function recapDiaryFilePath(now: number): string {
  return `${settingDir(['diaryDirectory'], '我的/日记')}/${localDayStr(now)}.md`;
}

/**
 * 把总结写进当天日记（一条「今日回顾」条目；同日已有 → 替换不叠条）。
 * 安全顺序：先插新条目（失败=旧内容原样保留）→ 再删旧条目（失败=暂时叠条，下次生成自愈）。
 * 写前用 parseFile 的未解析行口径预检（同 diary writeFile 守卫）：磁盘有无法解析的行时拒写并给人话指引，
 * 避免触发 diary 拒写守卫后内存与磁盘口径分叉。
 *
 * @returns 'replaced' = 替换了已有条目；'written' = 新写入
 */
export async function writeRecapEntry(app: App, content: string, now: number = Date.now()): Promise<RecapWriteOutcome> {
  const dateStr = localDayStr(now);
  const filePath = recapDiaryFilePath(now);

  // 写前预检：磁盘存在无法解析的行 → 拒处理（同 diary 写守卫口径，避免丢行/口径分叉）
  const file = app.vault.getAbstractFileByPath(filePath) as TFile | null;
  if (file) {
    let unparsed = 0;
    try {
      parseFile(await app.vault.read(file), dateStr, (n) => (unparsed = n));
    } catch {
      /* 读失败不拦截：写路径自身有失败兜底 */
    }
    if (unparsed > 0) {
      throw new Error(
        `「${dateStr}」有 ${unparsed} 行内容无法解析，本次没有写入。请先在日记本设置中运行「检测日记解析」修复后再试。`
      );
    }
  }

  // 函数级动态 import（依赖方向 ADR-0002：recap ← diary 延迟解析；不改 diary 任何文件）
  const store = await import('../diary/store');
  const diaryState = await import('../diary/state');

  // 当天文件同步进内存 map（日记本从未打开过也能安全全量重写；不刷新会把磁盘旧内容覆盖丢）
  if (file) await store.refreshFile(filePath);

  const entries = diaryState.diaryDataMap?.get(dateStr) ?? [];
  const olds = entries.filter(isRecapEntry);
  const timeStr = fmtHM(now);

  // 先插新（diary addEntry：map 插入 + writeFile 全量重写 + 列表轻刷新）
  await store.addEntry(dateStr, timeStr, ['日记'], content);

  // 再删旧（失败不致命：文件合法，最多暂时叠条；下次生成会再清）
  for (const old of olds) {
    if (!old.id) continue;
    try {
      await store.deleteEntry(old.id);
    } catch (e) {
      console.warn('[recap] 清理旧「今日回顾」条目失败（下次生成会重试清理）:', e);
    }
  }
  return olds.length ? 'replaced' : 'written';
}

/** 今天是否已写过「今日回顾」条目（头行按钮「生成今日总结/重新生成」的判定依据；只读） */
export async function hasRecapEntry(app: App, now: number = Date.now()): Promise<boolean> {
  try {
    const filePath = recapDiaryFilePath(now);
    const file = app.vault.getAbstractFileByPath(filePath) as TFile | null;
    if (!file) return false;
    const parsed = parseFile(await app.vault.read(file), localDayStr(now));
    return parsed.some(isRecapEntry);
  } catch {
    return false;
  }
}
