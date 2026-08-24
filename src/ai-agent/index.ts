/**
 * AI Agent（ticket 19）——笔记 ⇄ 备忘录/收藏本 自动同步 + AI 剪藏匹配
 * AIAgent.js 逐字移植：
 *   rename → 同步引用路径/标题（bz + favorites）
 *   delete → 清空关联（bz + favorites）
 *   create/open → 同名条目自动关联（仅 favorites）
 *   create(剪藏) → URL 精确匹配直接归档；不中 → AI 判断弹窗批准（仅 bz）
 * 权限模型：非 AI 操作静默直改；仅 AI 剪藏匹配弹窗批准。
 * 依赖：bz 域（DataManager，src/memo/data.ts）、core AI（createAI）。
 */
import type { App } from 'obsidian';
import { createAI, type AIService } from '../core/ai';
import { notice, notify } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { DataManager } from '../memo/data';
import { ensureBz } from '../memo';
import { getStoragePath } from '../favorites/config';
import {
  syncRename,
  syncDelete,
  syncAutoLink,
  loadJSON,
  saveJSON,
  CLIP_FOLDER,
  inFolders,
} from './sync';
import { showClipConfirmDialog } from './dialog';

/** 备忘录数据文件路径（ADR-0009：storagePath 优先，旧 todoFilePath 兼容兜底） */
function getMemoPath(): string {
  const s = tryGetSettings() as any;
  const folder = ((s && (s.storagePath || s.todoFilePath)) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return folder + '/memo.json';
}

/** 收藏本数据文件路径（ADR-0009：storagePath 优先，旧字段兼容兜底） */
function getFavoritesPath(): string {
  const s = tryGetSettings() as any;
  return getStoragePath(s && (s.storagePath || s.favoritesStoragePath));
}
const AI_MODEL = 'deepseek-v4-flash'; // 默认模型（设置 aiAgentModel 可配）

/** AI 剪藏匹配模型（设置可配，默认 deepseek-v4-flash） */
function getAIModel(): string {
  const s = tryGetSettings() as any;
  return (s && s.aiAgentModel) || AI_MODEL;
}

/** 监听文件夹列表（设置可配，逗号分隔；默认 卡片盒,归档/网页剪藏） */
function getWatchedFolders(): string[] {
  const s = tryGetSettings() as any;
  const raw = (s && s.aiAgentWatchedFolders) || '卡片盒,归档/网页剪藏';
  return raw.split(',').map((x: string) => x.trim()).filter(Boolean);
}

/** 剪藏目录（与剪藏本 articleDirectory 一致，回退 CLIP_FOLDER） */
function getClipFolder(): string {
  const s = tryGetSettings() as any;
  return (s && s.articleDirectory) || CLIP_FOLDER;
}

/** AI 剪藏匹配开关（设置可配，默认开启） */
function isAIClipMatchEnabled(): boolean {
  const s = tryGetSettings() as any;
  return s ? s.enableAIClipMatch !== false : true;
}

let initialized = false;
let _ai: AIService | null = null;
/** 已注册订阅的退订函数集合（unload 统一调用：总线退订幂等无双清，workspace ref 包装成退订闭包防泄漏） */
let _refs: (() => void)[] = [];
/** 卸载标志（P2 队列加固）：置位后积压任务首行短路、去抖窗口内事件直接丢弃 */
let _cancelled = false;
/** 待清理的去抖器（unload 时清定时器） */
let _flushers: { cancel(): void }[] = [];

/** 任务队列：串行执行（防并发读写同一 JSON）；失败通知（去重防刷屏）。
 *  P2：任务执行前检查 _cancelled，卸载后积压任务首行短路。 */
let queue: Promise<any> = Promise.resolve();
function enqueue(task: () => Promise<any> | void) {
  queue = queue
    .then(() => {
      if (_cancelled) return;
      return task();
    })
    .catch((e) => {
      console.error('[ai-agent]', e);
      notify('备忘录同步失败，数据可能不一致', { type: 'error', dedupeKey: 'ai-agent-sync' });
    });
}

/** ai-agent 事件去抖延迟：复用既有 DEBOUNCE_DELAY 设置（字符串毫秒，缺省 300） */
function debounceDelay(): number {
  const s: any = tryGetSettings();
  return Number(s && s.DEBOUNCE_DELAY) || 300;
}

/** P2 同类事件合并去抖：DEBOUNCE_DELAY 窗口内同型事件收集成批，静默期后作为单个
 *  队列任务按序回放——既削队列峰值，又保留 rename 链（A→B→C）等顺序语义。 */
function createBatchFlusher<T>(run: (batch: T[]) => Promise<void>): ((ev: T) => void) & { cancel(): void } {
  let pending: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (_cancelled) {
      pending = [];
      return;
    }
    const batch = pending;
    pending = [];
    enqueue(() => run(batch));
  };
  const push = (ev: T): void => {
    if (_cancelled) return;
    pending.push(ev);
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceDelay());
  };
  return Object.assign(push, {
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pending = [];
    },
  });
}

// ---------- 剪藏归档（仅备忘录数据源） ----------

/** 归档：更新条目 + 标记完成（成功通知；失败 ❌）。
 *  P1-25：显式回传 url——DataManager.updateItem 在传 title 未传 url 时会自动从标题提取
 *  URL，剪藏标题通常不含链接，会把条目原网址抹成 null。 */
async function archiveItem(item: any, file: any) {
  try {
    await DataManager.updateItem(item.id, { title: file.basename, linkedNote: file.path, url: item.url ?? null } as any);
    await DataManager.completeItem(item.id);
    notify('已归档到备忘录', { type: 'success' });
  } catch (e) {
    console.error('[ai-agent] 归档失败', e);
    notify('归档失败：' + ((e && (e as any).message) || e), { type: 'error' });
  }
}

/** AI 判断：新剪藏笔记是否与某候选条目指向同一篇文章 */
async function matchClipByAI(
  ai: AIService,
  noteMeta: { title: string; url: string; frontmatter: any },
  candidates: any[]
): Promise<{ match: boolean; itemId: string | null } | null> {
  const candidatesDesc = candidates
    .map((item, idx) => `[${idx}] id: ${item.id}, 内容: ${item.title}, 优先级: ${item.priority}`)
    .join('\n');

  const prompt = `你是一个链接匹配助手。给你一篇新剪藏笔记的信息和一组备忘录条目，请判断新笔记是否与其中某一条目指向同一篇网页文章（URL 已排除完全相同的情况，可能是同一文章的不同链接）。

新笔记信息：
- 标题：${noteMeta.title}
- 链接：${noteMeta.url}
- 文档属性（frontmatter）：
${JSON.stringify(noteMeta.frontmatter, null, 2)}

备忘录条目列表：
${candidatesDesc}

请返回 JSON 格式结果：
- "match": true 或 false，表示是否有匹配
- "itemId": 如果匹配，填写匹配条目的 id（字符串）；如果不匹配，填 null

只返回 JSON，不要有其他文字。`;

  try {
    // 模型走设置（aiAgentModel），response_format 显式要求 JSON
    const result = await ai.prompt(prompt, getAIModel(), {
      modelOptions: {
        max_tokens: 200,
        response_format: { type: 'json_object' },
      },
    });
    const parsed = JSON.parse(result);
    return { match: parsed.match === true, itemId: parsed.itemId || null };
  } catch (e) {
    console.error('[ai-agent] AI 匹配失败', e);
    notify('AI 匹配失败，已跳过该剪藏', { type: 'warning', dedupeKey: 'ai-agent-match' });
    return null;
  }
}

/** 剪藏入口：URL 精确匹配直接归档；不中 → AI 判断 + 弹窗批准 */
async function handleClip(app: App, ai: AIService, file: any) {
  const cache = app.metadataCache.getFileCache(file);
  const link = (cache as any)?.frontmatter?.link;
  if (!link) return;

  const items = await loadJSON(app, getMemoPath());
  const candidates = items.filter((i) => i.scene === '剪藏' && i.url && !i.linkedNote);
  if (candidates.length === 0) return;

  // ① URL 精确匹配 → 直接归档（非 AI，静默执行）
  const exact = candidates.find((i) => i.url === link);
  if (exact) {
    await archiveItem(exact!, file);
    return;
  }

  // ② AI 匹配 → 弹窗批准（设置 enableAIClipMatch 关闭时跳过）
  if (!isAIClipMatchEnabled()) return;
  await new Promise((resolve) => setTimeout(resolve, 800));
  const result = await matchClipByAI(
    ai,
    {
      title: file.basename,
      url: link,
      frontmatter: (cache as any).frontmatter,
    },
    candidates
  );
  if (!result || !result.match || !result.itemId) return;

  const item = items.find((i) => i.id === result.itemId);
  if (!item) return;

  showClipConfirmDialog({
    itemTitle: item.title,
    itemId: item.id,
    noteName: file.basename,
    onConfirm: () => archiveItem(item, file),
  });
}

// ---------- 事件编排 ----------

function createNoteSyncAgent(app: App, ai: AIService | null): void {
  // 对两个数据源执行同步函数，有变化才写回
  async function syncSources(fn: (items: any[], ...args: any[]) => boolean, ...args: any[]) {
    for (const path of [getMemoPath(), getFavoritesPath()]) {
      const items = await loadJSON(app, path);
      if (fn(items, ...args)) await saveJSON(app, path, items);
    }
  }

  const isMd = (file: any) => file && file.extension === 'md' && inFolders(file.path, getWatchedFolders());

  /** 收藏本：同名未关联条目自动关联（create / file-open 共用） */
  const autoLinkFavorites = async (file: any) => {
    const items = await loadJSON(app, getFavoritesPath());
    if (syncAutoLink(items, file.basename, file.path)) {
      await saveJSON(app, getFavoritesPath(), items);
    }
  };

  // P2：rename/create/file-open 同类事件按 DEBOUNCE_DELAY 合并去抖；delete 保持即时。
  // rename/create/delete 三条 vault 事件改经域事件总线通用兜底通道订阅（obsidian-adapter 恒发、
  // 仅 md，载荷见 src/core/obsidian-adapter.ts）；isMd 的 watchedFolders 目录过滤保持在闭包内。

  /** 总线载荷 → 现有闭包期望的伪 TFile 形状（{path, basename, extension:'md'}，rename 另附 oldPath） */
  const pseudoFile = (path: string): any => ({
    path,
    basename: (path.split('/').pop() || '').replace(/\.md$/, ''),
    extension: 'md',
  });

  const flushRenames = createBatchFlusher<any>(async (batch) => {
    for (const ev of batch) {
      await syncSources(syncRename, ev);
    }
  });
  _flushers.push(flushRenames);
  _refs.push(onDomainEvent<{ oldPath: string; newPath: string }>('vault:md-renamed', (evt) => {
    const file = pseudoFile(evt.newPath);
    file.oldPath = evt.oldPath;
    if (!isMd(file)) return;
    const oldTitle = (evt.oldPath ?? '').split('/').pop()!.replace(/\.md$/, '');
    flushRenames({
      oldPath: evt.oldPath,
      newPath: file.path,
      oldTitle,
      newTitle: file.basename,
    });
  }));

  _refs.push(onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => {
    const file = pseudoFile(evt.path);
    if (!isMd(file)) return;
    enqueue(() => syncSources(syncDelete, file.path));
  }));

  const flushCreates = createBatchFlusher<any>(async (batch) => {
    for (const file of batch) {
      // 剪藏目录 → 匹配归档（URL 精确 / AI + 弹窗）
      if (file.path.startsWith(getClipFolder() + '/') && ai) {
        await handleClip(app, ai, file);
      }
      // 同名条目自动关联（仅收藏本）
      await autoLinkFavorites(file);
    }
  });
  _flushers.push(flushCreates);
  _refs.push(onDomainEvent<{ path: string }>('vault:md-created', (evt) => {
    const file = pseudoFile(evt.path);
    if (!isMd(file)) return;
    flushCreates(file);
  }));

  const flushOpens = createBatchFlusher<any>(async (batch) => {
    const seen = new Set<string>();
    for (const file of batch) {
      if (seen.has(file.path)) continue; // 同文件连开只关联一次
      seen.add(file.path);
      await autoLinkFavorites(file);
    }
  });
  _flushers.push(flushOpens);
  // workspace.on('file-open') 保持原生订阅：域总线首期只收编 vault 事件，workspace 事件后续再迁
  const openRef = app.workspace.on('file-open', (file: any) => {
    if (!isMd(file)) return;
    flushOpens(file);
  });
  _refs.push(() => {
    try {
      (app.workspace as any).offref?.(openRef);
    } catch (e) { /* 忽略 */ }
  });
}

/** 幂等初始化（main.ts 按设置 aiAgentEnabled 开关注册） */
export async function ensureAIAgent(app: App): Promise<void> {
  if (initialized) return;
  initialized = true;
  _cancelled = false; // P2：重新启用后恢复任务受理
  // 依赖备忘录实例（AIAgent 与备忘录共享 memo.json，原 window.__memo 语义）
  await ensureBz(app);
  _ai = createAI();
  createNoteSyncAgent(app, _ai);
}

/** 卸载清理（main.ts onunload 调用）：移除监听 + 重置模块状态。
 *  P2：置位 _cancelled 使积压任务首行短路，并丢弃去抖窗口内未回放的事件。 */
export function unloadAIAgent(): void {
  _cancelled = true;
  for (const f of _flushers) {
    try {
      f.cancel();
    } catch (e) { /* 忽略 */ }
  }
  _flushers = [];
  // 清理监听：总线退订函数与 workspace ref 退订闭包统一调用（总线退订幂等，重复卸载无双清风险）
  for (const off of _refs) {
    try {
      off();
    } catch (e) { /* 忽略 */ }
  }
  _refs = [];
  initialized = false;
  _ai = null;
  queue = Promise.resolve();
}
