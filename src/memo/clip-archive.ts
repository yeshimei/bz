/**
 * 剪藏 AI 匹配归档（自 ai-agent 拆分：写入=memo 数据故归 memo；触发=剪藏落盘）
 * 移植旧 ai-agent/index.ts handleClip/matchClipByAI/archiveItem 全部逻辑与文案：
 *   剪藏落盘 → URL 精确匹配直接归档（非 AI，静默执行）；
 *   不中 → AI 判断 + 弹窗批准（设置 enableAIClipMatch 关闭时跳过 AI 步骤，URL 精确仍生效）。
 * 权限模型：非 AI 操作静默直改；仅 AI 匹配弹窗批准。
 * 触发经域事件总线语义通道 'clipping:file-created'（obsidian-adapter 语义路，
 * 仅命中剪藏域目录时派发，载荷 { path }）；写入走同域 DataManager（memo.json 直用）。
 */
import type { App } from 'obsidian';
import { createAI, type AIService } from '../core/ai';
import { notify } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { DataManager } from './data';
import { showClipConfirmDialog } from './clip-archive-dialog';

// ---------- 路径 / 设置（ai-agent/index.ts 私有副本） ----------

const AI_MODEL = 'deepseek-v4-flash'; // 默认模型（设置 aiAgentModel 可配）

/** AI 剪藏匹配模型（设置可配，默认 deepseek-v4-flash） */
function getAIModel(): string {
  const s = tryGetSettings() as any;
  return (s && s.aiAgentModel) || AI_MODEL;
}

/** 监听文件夹列表（设置 aiAgentWatchedFolders 可配，逗号分隔；默认 卡片盒,归档/网页剪藏） */
function getWatchedFolders(): string[] {
  const s = tryGetSettings() as any;
  const raw = (s && s.aiAgentWatchedFolders) || '卡片盒,归档/网页剪藏';
  return raw.split(',').map((x: string) => x.trim()).filter(Boolean);
}

/** 备忘录数据文件路径（照抄旧 ai-agent/index.ts：ADR-0009 storagePath 优先，旧 todoFilePath 兼容兜底） */
function getMemoPath(): string {
  const s = tryGetSettings() as any;
  const folder = ((s && (s.storagePath || s.todoFilePath)) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return folder + '/memo.json';
}

/** AI 剪藏匹配开关（设置可配，默认开启） */
function isAIClipMatchEnabled(): boolean {
  const s = tryGetSettings() as any;
  return s ? s.enableAIClipMatch !== false : true;
}

/** 监听目录范围检查：路径等于目录本身或位于其下 */
function inFolders(path: string, folders: string[]): boolean {
  return folders.some((f) => path.startsWith(f + '/') || path === f);
}

// ---------- JSON 读写（读候选走旧 loadJSON 私有副本，写归档走同域 DataManager） ----------

async function loadJSON(app: App, filePath: string): Promise<any[]> {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) return [];
  try {
    return JSON.parse(await app.vault.read(file as any));
  } catch {
    return [];
  }
}

// ---------- 队列（ai-agent/index.ts 逐行等价移植） ----------

let initialized = false;
/** 已注册订阅的退订函数集合（unload 统一调用：总线退订幂等无双清） */
let _refs: (() => void)[] = [];
/** 卸载标志：置位后积压任务首行短路 */
let _cancelled = false;

/** 任务队列：串行执行（防与引用同步并发读写 memo.json）；失败通知（去重防刷屏）。
 *  任务执行前检查 _cancelled，卸载后积压任务首行短路。 */
let queue: Promise<any> = Promise.resolve();
function enqueue(task: () => Promise<any> | void) {
  queue = queue
    .then(() => {
      if (_cancelled) return;
      return task();
    })
    .catch((e) => {
      console.error('[memo-clip-archive]', e);
      notify('备忘录同步失败，数据可能不一致', { type: 'error', dedupeKey: 'memo-file-sync' });
    });
}

// ---------- 剪藏归档（仅备忘录数据源） ----------

let _ai: AIService | null = null;
/** AI 服务懒创建：URL 精确匹配不耗 AI，首次走到 AI 判断才 createAI()（unload 置空重建） */
function getAI(): AIService {
  if (!_ai) _ai = createAI();
  return _ai;
}

/** 归档：更新条目 + 标记完成（成功通知；失败 ❌）。
 *  P1-25：显式回传 url——DataManager.updateItem 在传 title 未传 url 时会自动从标题提取
 *  URL，剪藏标题通常不含链接，会把条目原网址抹成 null。 */
async function archiveItem(item: any, file: any) {
  try {
    await DataManager.updateItem(item.id, { title: file.basename, linkedNote: file.path, url: item.url ?? null } as any);
    await DataManager.completeItem(item.id);
    notify('已归档到备忘录', { type: 'success' });
  } catch (e) {
    console.error('[memo-clip-archive] 归档失败', e);
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
    console.error('[memo-clip-archive] AI 匹配失败', e);
    notify('AI 匹配失败，已跳过该剪藏', { type: 'warning', dedupeKey: 'memo-clip-match' });
    return null;
  }
}

/** 剪藏入口：URL 精确匹配直接归档；不中 → AI 判断 + 弹窗批准 */
async function handleClip(app: App, file: any) {
  const cache = app.metadataCache.getFileCache(file);
  const url = (cache as any)?.frontmatter?.url;
  if (!url) return;

  const items = await loadJSON(app, getMemoPath());
  const candidates = items.filter((i) => i.scene === '剪藏' && i.url && !i.linkedNote);
  if (candidates.length === 0) return;

  // ① URL 精确匹配 → 直接归档（非 AI，静默执行）
  const exact = candidates.find((i) => i.url === url);
  if (exact) {
    await archiveItem(exact!, file);
    return;
  }

  // ② AI 匹配 → 弹窗批准（设置 enableAIClipMatch 关闭时跳过）
  if (!isAIClipMatchEnabled()) return;
  await new Promise((resolve) => setTimeout(resolve, 800));
  const result = await matchClipByAI(
    getAI(),
    {
      title: file.basename,
      url,
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

function createClipArchiveAgent(app: App): void {
  _refs.push(onDomainEvent<{ path: string }>('clipping:file-created', (evt) => {
    // 语义通道只保证落在剪藏目录（articleDirectory 分类命中），但用户可能已把该目录移出
    // aiAgentWatchedFolders 监听范围——保留旧 watchedFolders 门，范围外不触发匹配归档。
    if (!inFolders(evt.path, getWatchedFolders())) return;
    // 伪载荷只有 path：取真 TFile 后读 metadataCache frontmatter url（文件已被删则静默跳过）
    const file = app.vault.getAbstractFileByPath(evt.path);
    if (!file) return;
    enqueue(() => handleClip(app, file));
  }));
}

/** 幂等初始化（memo 域总入口 ensureMemoFileSync 调用） */
export function ensureClipArchive(app: App): void {
  if (initialized) return;
  initialized = true;
  _cancelled = false; // 重新启用后恢复任务受理
  createClipArchiveAgent(app);
}

/** 卸载清理：置位 _cancelled 使积压任务首行短路，退订全部监听（总线退订幂等，
 *  重复卸载无双清风险）后重置模块状态；懒创建的 AI 服务一并置空。 */
export function unloadClipArchive(): void {
  _cancelled = true;
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
