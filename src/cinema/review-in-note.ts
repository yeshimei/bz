/**
 * 影院（cinema）域：影评正文标记 `<BZ-MOVIE>...</BZ-MOVIE>`（2026-11-21 QQ 群 Panda 反馈）。
 *
 * 用户拍板：影评已可在笔记正文用标记编辑、正常走 markdown 语法；设置开关
 * `cinemaReviewInNote` 打开 = 批量把属性影评迁入正文 + 双向同步，关闭 = 批量清除正文标记
 * （属性始终留备份）。标记区固定在 frontmatter 之后、海报之前（笔记顶部）。
 *
 * 纯文本函数（read/set/has）与 vault 读写同文件；写盘一律 `vault.process` 原子读改写，
 * 前后登记自写（noteSelfWrite）防止后台刷新把新值盖回写前缓存（issue 555 同款守卫）。
 */
import type { App, TFile } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { M, noteSelfWrite } from './state';

/** 标记边界（用户给的方案）：影评内容整体夹在中间，正文里原样渲染 markdown。 */
export const REVIEW_BEGIN = '<BZ-MOVIE>';
export const REVIEW_END = '</BZ-MOVIE>';

interface BlockSpan {
  start: number;
  end: number;
  bodyStart: number;
  bodyEnd: number;
}

/** 定位标记块：边界必须独占一行；缺结束边界 / 半截标记视为无块，绝不误读正文。 */
function findBlock(content: string): BlockSpan | null {
  const i = content.indexOf(REVIEW_BEGIN);
  if (i < 0) return null;
  const before = i === 0 ? '' : content[i - 1];
  if (before !== '' && before !== '\n' && before !== '\r') return null;
  const j = content.indexOf(REVIEW_END, i + REVIEW_BEGIN.length);
  if (j < 0) return null;
  const after = content[j + REVIEW_END.length];
  if (after !== undefined && after !== '\n' && after !== '\r') return null;
  const nl = content.indexOf('\n', i + REVIEW_BEGIN.length);
  if (nl < 0 || nl > j) return null;
  return { start: i, end: j + REVIEW_END.length, bodyStart: nl + 1, bodyEnd: j };
}

/** 读正文里的影评；无块返回 null。 */
export function readReviewFromContent(content: string): string | null {
  const b = findBlock(content);
  if (!b) return null;
  const raw = content.slice(b.bodyStart, b.bodyEnd).replace(/\r\n/g, '\n').trim();
  return raw || null;
}

/** 有无标记块（批量统计用，不读内容）。 */
export function hasReviewBlock(content: string): boolean {
  return findBlock(content) !== null;
}

/** frontmatter 结束位置：标记插在它之后、正文（含海报）之前；无 frontmatter 插在最开头。 */
function bodyStartOf(content: string): number {
  const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content);
  return fm ? fm[0].length : 0;
}

/**
 * 写正文标记：review 非空则插入/替换（幂等——已有块只换内容，不重复插）；
 * review 为 null/空则只删块，其余正文一字不动。
 */
export function setReviewInContent(content: string, review: string | null): string {
  const b = findBlock(content);
  if (review === null || review.trim() === '') {
    return b ? content.slice(0, b.start) + content.slice(b.end) : content;
  }
  // 先摘旧块再在 frontmatter 后最前重插——豆瓣回填海报会把 embed 插到 frontmatter 之后，
  // 若原地替换，标记就被挤到海报下面；用户拍板标记必须在海报上面（笔记顶部）
  const without = b ? content.slice(0, b.start) + content.slice(b.end) : content;
  const text = `${REVIEW_BEGIN}\n${review.replace(/\r\n/g, '\n')}\n${REVIEW_END}`;
  const at = bodyStartOf(without);
  return without.slice(0, at) + `${text}\n\n` + without.slice(at);
}

/** 开关当前值（缺省关；设置访问器未注入时同样关）。 */
export function isReviewInNoteEnabled(): boolean {
  return tryGetSettings()?.cinemaReviewInNote === true;
}

/** 影视目录下的 md 笔记（目录未配置时不误扫整个库）。 */
function cinemaNotes(app: App): TFile[] {
  const prefix = M.folderPath ? `${M.folderPath}/` : null;
  if (!prefix) return [];
  return app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix));
}

export interface ReviewBatchResult {
  done: number;
  failed: number;
  skipped: number;
}

/** 统计：属性有影评但正文没标记（开开关要搬多少）/ 正文已有标记（关开关要清多少）。 */
export async function countReviewNotes(app: App): Promise<{ candidates: number; withBlock: number }> {
  let candidates = 0;
  let withBlock = 0;
  for (const file of cinemaNotes(app)) {
    const content = await app.vault.cachedRead(file);
    if (hasReviewBlock(content)) {
      withBlock++;
      continue;
    }
    const fm = app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    const review = fm?.['影评'];
    if (typeof review === 'string' && review.trim()) candidates++;
  }
  return { candidates, withBlock };
}

/** 批量迁入：属性影评 → 正文标记。无影评的不插空块（增强 1）；已有块只换内容（增强 5）。 */
export async function migrateReviewsIntoNotes(app: App): Promise<ReviewBatchResult> {
  const res: ReviewBatchResult = { done: 0, failed: 0, skipped: 0 };
  for (const file of cinemaNotes(app)) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    const review = fm?.['影评'];
    if (typeof review !== 'string' || !review.trim()) {
      res.skipped++;
      continue;
    }
    try {
      noteSelfWrite(file.path);
      await app.vault.process(file, (content) => setReviewInContent(content, review));
      noteSelfWrite(file.path);
      res.done++;
    } catch (e) {
      console.warn('bz 影院：影评迁入笔记失败', file.path, e);
      res.failed++;
    }
  }
  return res;
}

/** 批量清除：正文标记删除，内容先并回属性（关掉后只在属性保留影评，正文改过的内容不丢）。 */
export async function clearReviewsFromNotes(app: App): Promise<ReviewBatchResult> {
  const res: ReviewBatchResult = { done: 0, failed: 0, skipped: 0 };
  for (const file of cinemaNotes(app)) {
    const content = await app.vault.cachedRead(file);
    const review = readReviewFromContent(content);
    if (!hasReviewBlock(content)) {
      res.skipped++;
      continue;
    }
    try {
      noteSelfWrite(file.path);
      if (review) {
        await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
          fm['影评'] = review;
        });
      }
      await app.vault.process(file, (c) => setReviewInContent(c, null));
      noteSelfWrite(file.path);
      res.done++;
    } catch (e) {
      console.warn('bz 影院：正文影评清除失败', file.path, e);
      res.failed++;
    }
  }
  return res;
}

/** 界面改影评 → 正文标记同步（开关开时由 persistItem 调用）。 */
export async function syncReviewToNote(app: App, file: TFile, review: string | null): Promise<void> {
  if (!isReviewInNoteEnabled()) return;
  noteSelfWrite(file.path);
  await app.vault.process(file, (content) => setReviewInContent(content, review));
  noteSelfWrite(file.path);
}

/** 笔记正文改影评 → 属性同步（开关开时由 vault:md-indexed 调用）。 */
export async function syncReviewFromNote(app: App, file: TFile): Promise<void> {
  if (!isReviewInNoteEnabled()) return;
  const content = await app.vault.cachedRead(file);
  const review = readReviewFromContent(content);
  const fm = app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
  const current = typeof fm?.['影评'] === 'string' ? fm['影评'] as string : '';
  if ((review ?? '') === current) return;
  noteSelfWrite(file.path);
  await app.fileManager.processFrontMatter(file, (f: Record<string, unknown>) => {
    if (review) f['影评'] = review;
    else delete f['影评'];
  });
  noteSelfWrite(file.path);
}
