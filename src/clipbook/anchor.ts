/**
 * clipbook（issue 329 / ADR-0144）：划词锚定与正文变换。
 *
 * 两类职责：
 * 1. 纯函数（node 可测）：applyBodyTransforms（渲染层替换与保存物化共用的同一变换管线：
 *    先图片外链换 `![[local]]`、再按 marks 的 find 串替换为 `[[笔记 basename|find]]` 别名双链）、
 *    findMarkdownSnippet（选区 DOM 文本回查源 body 的 markdown 片段，复制 Markdown 用）、
 *    applyClipContentTransforms（对整篇 md 拆 frontmatter 后只变换正文，已保存条目直写用）；
 * 2. 侧写便捷读写：marks / savedImages / pendingSource 三段的追加与清理，
 *    一律走 data.ts 的 updateClipbookData 读改写事务（与其它写方串行，不互吞）。
 *
 * 硬约束（ADR-0144）：news.json 永不被写——未保存条目的替换只落在渲染层内存 +
 * clipbook.json 侧写；保存为剪藏那一刻才物化进 md（save.ts writeClipNote 链路）。
 */
import type { ClipbookData, ClipMark, ClipSavedImage } from './data';
import { readClipbookData, updateClipbookData } from './data';
import { articleKeyOf } from './constants';

export type { ClipMark, ClipSavedImage };

/** 变换明细：body = 变换稿；marks/images = 实际命中应用的条目（未命中不进） */
export interface BodyTransformResult {
  body: string;
  marks: ClipMark[];
  images: ClipSavedImage[];
}

/** 正则元字符转义（find 串与图片 src 都是字面量匹配） */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** notePath → basename（去目录、去 .md）：别名双链的显示名 */
export function noteBasename(notePath: string): string {
  const base = String(notePath || '').split('/').pop() || '';
  return base.replace(/\.md$/i, '') || String(notePath || '');
}

/** 内部双链别名文本清洗：`]]` 会把 wikilink 提前闭合（破语法），插空格降级（issue 329 评审） */
export function linkAliasText(s: string): string {
  return String(s || '').replace(/\]\]/g, '] ]');
}

/** 别名双链：`[[笔记 basename|原文字]]`（显示不变、原生 wikilink，无块 id——ADR-0144 决策 2） */
export function aliasLink(notePath: string, find: string): string {
  return `[[${noteBasename(notePath)}|${find}]]`;
}

/**
 * 正文变换（渲染层替换与保存物化共用这一个函数）：
 * - 先换图：`![alt](src)` 按 src 精确匹配 → `![[local]]`（同 src 多处全部替换）；
 * - 再换词：marks 的 find 串首次出现 → `[[笔记 basename|find]]`（同串多处只替换第一处，接受）。
 * 纯函数：不改入参，返回新 body 与应用明细。
 */
export function applyBodyTransforms(body: string, marks: ClipMark[], imageSwaps: ClipSavedImage[]): BodyTransformResult {
  let out = String(body || '');
  const usedImages: ClipSavedImage[] = [];
  const usedMarks: ClipMark[] = [];
  for (const sw of Array.isArray(imageSwaps) ? imageSwaps : []) {
    if (!sw || !sw.src || !sw.local) continue;
    const re = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRe(sw.src)}\\)`);
    if (!re.test(out)) continue;
    out = out.replace(re, `![[${sw.local}]]`);
    usedImages.push({ src: sw.src, local: sw.local });
  }
  for (const mk of Array.isArray(marks) ? marks : []) {
    if (!mk || !mk.find || !mk.notePath) continue;
    const idx = out.indexOf(mk.find);
    if (idx === -1) continue;
    out = out.slice(0, idx) + aliasLink(mk.notePath, mk.find) + out.slice(idx + mk.find.length);
    usedMarks.push({ find: mk.find, notePath: mk.notePath, kind: mk.kind === 'passage' ? 'passage' : 'term' });
  }
  return { body: out, marks: usedMarks, images: usedImages };
}

/**
 * 整篇剪藏 md 的变换（已保存条目直写路径）：拆 frontmatter 外壳后只变换正文，
 * frontmatter（url/author/summary 等）里的同串不误伤；无 frontmatter 则全文变换。
 */
export function applyClipContentTransforms(content: string, marks: ClipMark[], imageSwaps: ClipSavedImage[]): string {
  const src = String(content || '');
  const m = src.match(/^(\s*---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?)([\s\S]*)$/);
  if (!m) return applyBodyTransforms(src, marks, imageSwaps).body;
  return m[1] + applyBodyTransforms(m[2], marks, imageSwaps).body;
}

/** 命中区间扩到整行（复制 Markdown 保语法：选中文本所在完整行/行块） */
function lineAround(src: string, start: number, end: number): string {
  const ls = src.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  let le = src.indexOf('\n', end);
  if (le === -1) le = src.length;
  return src.slice(ls, le).trim();
}

/**
 * 选区 DOM 文本回查源 body 的 markdown 片段（复制 Markdown 用，与 applyBodyTransforms
 * 同源的定位 helper）：优先字面 indexOf，未命中再做空白归一匹配（DOM textContent 的
 * 换行/连续空白与源文常不一致）。命中返回覆盖该区间的完整行块（保留 markdown 语法），
 * 未命中返回 null（调用方回退纯文本）。
 */
export function findMarkdownSnippet(body: string, text: string): string | null {
  const src = String(body || '');
  const t = String(text || '').trim();
  if (!src || !t) return null;
  const direct = src.indexOf(t);
  if (direct !== -1) return lineAround(src, direct, direct + t.length);
  // 空白归一：源文折叠连续空白成单空格（记录归一字符 ↔ 原串下标映射）
  let normStr = '';
  const normIdx: number[] = [];
  let prevSpace = true;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      normStr += ' ';
      normIdx.push(i);
      prevSpace = true;
    } else {
      normStr += ch;
      normIdx.push(i);
      prevSpace = false;
    }
  }
  const q = t.replace(/\s+/g, ' ').trim();
  const n = normStr.indexOf(q);
  if (n === -1) return null;
  const start = normIdx[n];
  const end = normIdx[Math.min(n + q.length - 1, normIdx.length - 1)] + 1;
  return lineAround(src, start, end);
}

// ==================== 侧写便捷读写（marks / savedImages / pendingSource） ====================

/** 条目侧写追踪三段（读） */
export interface ArticleTracking {
  marks: ClipMark[];
  images: ClipSavedImage[];
  pendingSource: string[];
}

/** 读某条目的追踪三段（无记录 → 空三段；不入队、只读现值） */
export async function readArticleTracking(articleKey: string): Promise<ArticleTracking> {
  const data = await readClipbookData();
  return {
    marks: (data.marks as Record<string, ClipMark[]>)[articleKey] || [],
    images: (data.savedImages as Record<string, ClipSavedImage[]>)[articleKey] || [],
    pendingSource: (data.pendingSource as Record<string, string[]>)[articleKey] || [],
  };
}

/** 追加一条划词标记（term/passage 通用；返回新侧写供内存面同步） */
export async function addArticleMark(articleKey: string, mark: ClipMark): Promise<ClipbookData> {
  return updateClipbookData((cur) => {
    const marks = { ...cur.marks };
    const list = (marks[articleKey] || []).slice();
    // 同 key 同 find 同目标 → 不重复记（双击同一动作防抖）
    if (list.some((m) => m.find === mark.find && m.notePath === mark.notePath)) return cur;
    list.push({ find: mark.find, notePath: mark.notePath, kind: mark.kind === 'passage' ? 'passage' : 'term' });
    marks[articleKey] = list;
    return { ...cur, marks };
  });
}

/** 追加一条已保存图片映射（src → local；同 src 覆盖旧映射，防同名图多次保存堆记录） */
export async function addArticleImageSwap(articleKey: string, swap: ClipSavedImage): Promise<ClipbookData> {
  return updateClipbookData((cur) => {
    const savedImages = { ...cur.savedImages };
    const list = (savedImages[articleKey] || []).filter((im) => im.src !== swap.src);
    list.push({ src: swap.src, local: swap.local });
    savedImages[articleKey] = list;
    return { ...cur, savedImages };
  });
}

/** 追加一条待升级 source 的文献笔记路径（term/passage/plate 通用） */
export async function addPendingSourceNote(articleKey: string, notePath: string): Promise<ClipbookData> {
  return updateClipbookData((cur) => {
    const pendingSource = { ...cur.pendingSource };
    const list = (pendingSource[articleKey] || []).slice();
    if (!list.includes(notePath)) list.push(notePath);
    pendingSource[articleKey] = list;
    return { ...cur, pendingSource };
  });
}

/**
 * 清某条目的全部追踪（保存物化收尾）：返回清理前的三段——物化方据此对 pendingSource
 * 逐个回写内部双链、对 marks/images 确认已进 md。无记录空转（mutator 原样返回，不空写）。
 */
export async function clearArticleTracking(articleKey: string): Promise<ArticleTracking> {
  let before: ArticleTracking = { marks: [], images: [], pendingSource: [] };
  await updateClipbookData((cur) => {
    before = {
      marks: (cur.marks as Record<string, ClipMark[]>)[articleKey] || [],
      images: (cur.savedImages as Record<string, ClipSavedImage[]>)[articleKey] || [],
      pendingSource: (cur.pendingSource as Record<string, string[]>)[articleKey] || [],
    };
    if (!before.marks.length && !before.images.length && !before.pendingSource.length) return cur;
    const marks = { ...cur.marks };
    const savedImages = { ...cur.savedImages };
    const pendingSource = { ...cur.pendingSource };
    delete marks[articleKey];
    delete savedImages[articleKey];
    delete pendingSource[articleKey];
    return { ...cur, marks, savedImages, pendingSource };
  });
  return before;
}
