/**
 * 挂载树·AI 语义建议链路（issue 318 一次性裁判 → **issue 321 三段式**，ADR-0138 / ADR-0139 §3 / ADR-0140）
 *
 * 链路（ADR-0140 决策 1，每卡 3 次调用，结果落缓存）：
 *   轮 1 查询官：编号片段 → `{seg, sentence, keywords, why}`（完整短句 + 关键词**双查询**，
 *     关键词堆在 bge-m3 查询侧失配，召回质量差）；
 *   本地召回：范围闸（**只排除归档/网页剪藏**）+ 自指剔除 + 同笔记去重留最高分块 + 双查询并集
 *     按「命中次数 → 最高分」排序（保底多样性：每片段最优笔记必进池），总量 10；
 *   轮 2 采纳官：片段 × 候选 → `{seg, path, score, reason}`，同一目标最多 2 条；
 *   轮 3 定位官：**现读被采纳笔记全文** → `{unit: whole|heading|paragraph, heading, quote, anchor, reason}`，
 *     允许 skip 否决。
 *
 * 两条硬约束（真机实测的教训）：
 *   ① 锚点必须是**主卡正文原文**（逐字；模型给的 anchor 本地三级回定位，找不到就退回片段锚点）；
 *   ② 目标单元必须带**可回定位的证据**（标题原文或原文摘录）：标题不存在 → 降级整篇；
 *      摘录三级定位（精确 → 去空白/markdown → 段落兜底）仍失败 → 降级整篇。绝不写瞎链接。
 *
 * 形态落链接（ADR-0138 六类形态的落地）：整篇 `[[路径]]`；标题 `[[路径#标题]]`（落前校验存在）；
 * 段落 `[[路径#^块id]]`——**固定时**向目标笔记补写确定性块 id（`bz-`+hash8，幂等，走 per-file 串行写队列）。
 * 这是插件第一次写非主卡文件（用户 2026-09-15 拍板允许；Obsidian 段落双链的唯一正路）。
 *
 * 其它既有口径（318 留下，继续生效）：
 * - AI **不写 related、不改正文**：只有渲染层的「固定」动作才写 `[[wikilink]]`（本模块只出候选与留档）；
 * - 缓存：`CONFIG/STORAGE/mount-suggest.json`（storageFile + jsonFileStore + enqueueFileTask 写事务），
 *   按主卡路径分片，`bodyHash`（core/utils hash31）逐卡失效——改哪张卡只重跑那张；
 * - 否决：点过「取消」的「锚点 → 目标」永久不再推（生成阶段先过滤）；「固定」也留档并过滤（不重复推）；
 * - 降级：移动端 / 无可用向量索引 / 无可用 AI 通道 → 不跑建议、**不自动建索引**；
 *   回答不可用（空串 / 认不出一条）→ `no-answer`，**不落缓存**（瞬时故障不污染以后的白板）。
 *
 * 2026-09-14 实机排障（用户报「打开白板没有任何 AI 建议」）：三处叠加，全是「答案拿到手却被丢掉」——
 * ① 模型按 prompt 里的标签形状作答（`"anchor":"a1","target":"t2"`），旧解析只认整数，逐条丢弃；
 * ② 带思考的模型把 2048 / 8192 的预算全烧在 reasoning 上（finish_reason=length、content 空串）
 *    → 预算必须给满；③ `response_format: json_object` 与「输出数组」的 prompt 相互打架，
 *    实测模型会吐 `{"type": "json_object"}` 空壳 → 一律走 **prompt 纯文本通道**。
 *
 * 2026-09-15 思考档实测（ADR-0140 决策 4）：默认档 143s / `low` 7s / 关 5.3s，采纳结果几乎一样；
 * **关闭档会退回 `a1/t2` 标签式作答**（容错解析因此保留），故取 `reasoning_effort:'low'` + 预算 131072。
 *
 * 依赖：core（ai / storage / mobile / settings-provider / utils）+ 第二大脑只读检索桥
 * （`secondbrain/readonly` 的叶子模块；**勿**值导入 `secondbrain/index`——会把整条 UI 栈拖进构建闭包）；
 * 契约类型只认 `./mount-types`（module 之间不 import 实现）。
 */
import { createAI, getAIProvider } from '../core/ai';
import { isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { hash31, isUnderFolder, stripMdExt } from '../core/utils';
import { exportVectorSearch } from '../secondbrain/readonly';
import type {
  AnchorRef,
  MountEdge,
  MountKind,
  MountNode,
  MountSuggestion,
  MountTree,
  SuggestCardCache,
  SuggestCacheFile,
  SuggestProgress,
  SuggestRun,
  SuggestStage,
  SuggestStatus,
  SuggestUnit,
} from './mount-types';

/** 建议生成上下文：主卡所在域的三个目录（目标形态判定用，其余一律经 ctx.app 走 vault） */
export interface SuggestCtx {
  app: any;
  cardboxDir: string;
  litDir: string;
  /** 主题盒（缺省 `主题盒`）：范围闸**不**用它做白名单（ADR-0140：只排除归档/剪藏），只参与形态判定 */
  topicDir?: string;
}

/** 生成选项：`force` 跳过缓存重跑；`onProgress` 驱动白板进度条与阶段文字 */
export interface SuggestOptions {
  force?: boolean;
  onProgress?: (p: SuggestProgress) => void;
}

/* ---------------- 常量（调参口径：宁缺勿滥） ---------------- */

/**
 * 弱关联阈值（ADR-0138「弱关联不显示、存疑不链」）：裁判给出的关联分低于该值一律丢弃、不落缓存。
 * 0.7 = 「明确实质关联」档；跑真实库后可再调，调它就是放宽/收紧「宁缺勿滥」这条线。
 */
export const SUGGEST_MIN_SCORE = 0.7;
/** 锚点最短字数（过短片段没有独立语义，送检索只会放大噪声） */
export const SUGGEST_MIN_ANCHOR_CHARS = 6;
/** 单次生成最多送检的锚点数（成本闸：每个锚点两次向量检索；长文只取正文前 N 句） */
export const SUGGEST_MAX_ANCHORS = 12;
/** 每个查询的向量召回条数（双查询并集后去重） */
export const SUGGEST_TOPK = 8;
/**
 * 召回池总量（ADR-0140：10）。实测全库召回 top5 有 4 条是剪藏噪声，故先走范围闸再定池；
 * 只留卡片盒+文献盒会丢主题盒真邻居，所以闸是**排除式**不是白名单。
 */
export const SUGGEST_POOL_SIZE = 10;
/** 轮 2 采纳官：同一目标笔记最多采纳条数 */
export const SUGGEST_MAX_PER_TARGET = 2;
/** 轮 3 定位官：最多现读几篇被采纳笔记（单篇 8000 字封顶，prompt 体积闸） */
export const SUGGEST_MAX_LOCATE_NOTES = 6;
/** 轮 3 单篇正文封顶字数（长文不受索引截断影响，但 prompt 不能无限长） */
export const SUGGEST_LOCATE_TEXT_CAP = 8000;
/**
 * 调用参数（2026-09-15 用户拍板，ADR-0140 决策 4）：预算给满 131072（GLM 上限即此值），
 * 思考档取 `low`（默认档 143s / low 7s，采纳结果几乎一样；**关掉会退回 a1/t2 标签式作答**）。
 */
export const SUGGEST_JUDGE_MAX_TOKENS = 131072;
export const SUGGEST_REASONING_EFFORT = 'low';
/** 一句话理由长度上限（超长截断，防 UI 溢出） */
const REASON_MAX_CHARS = 80;
/** 建议缓存文件名（域内单文件，ADR-0139 §3） */
export const SUGGEST_CACHE_FILE = 'mount-suggest.json';
/**
 * 缓存格式版本：解析/取数口径变更即 +1，旧片（无 `ver` 或版本不符）一律按失效处理——
 * 免去「用户手动清缓存」。v3 = 321 三段式：片里带 unit/heading/quote/subpath。
 */
export const SUGGEST_CACHE_VERSION = 3;
/** 锚点文本最短长度之外还需含文字/数字（纯符号、纯标点、表格分隔线一律不是锚点） */
const HAS_MEANING_RE = /[\p{L}\p{N}]/u;
/** 正文双链（含嵌入；解析口径最小化——只用于「目标已是双链」过滤，完整解析归 mount-data 314） */
const WIKILINK_RE = /!?\[\[([^\[\]]+)\]\]/g;
/**
 * 召回范围闸：只排除**归档与网页剪藏**（ADR-0140 决策 1）。
 * 实测：全库召回 top5 有 4 条剪藏噪声；只留卡片盒+文献盒又会丢主题盒真邻居 → 排除式而非白名单。
 */
export const SUGGEST_EXCLUDE_DIRS = ['归档', '网页剪藏'];
/** 块 id 前缀（段落双链锚定用；确定性哈希 → 幂等） */
export const BLOCK_ID_PREFIX = 'bz-';
/** 词级锚点阈值（≤12 字 → 别名替换 `[[目标|原词]]`，不做句中追加） */
export const WORD_ANCHOR_MAX_CHARS = 12;

/* ---------------- 通用小工具 ---------------- */

/** 8 位 36 进制短哈希（块 id / 建议 id 的去重型后缀，确定性） */
function hash8(s: string): string {
  const h = hash31(String(s ?? '')) >>> 0;
  return h.toString(36).padStart(7, '0').slice(0, 8);
}

/** 单元键归一：折叠空白、去 markdown 标记、小写（标题/摘录的比对与短键） */
function normLite(s: string): string {
  return String(s ?? '')
    .replace(/[*_`~#]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

/** 建议 id 用的路径（保留大小写与 `.md`，只统一斜杠——id 会进 DOM 属性，不做激进归一） */
function idPath(path: string): string {
  return String(path ?? '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

/** 单元短键（subpath/quote → 8 位哈希；空 → ''） */
function subKeyOf(s: Pick<MountSuggestion, 'subpath' | 'quote'>): string {
  const sub = String(s?.subpath ?? '').trim();
  if (sub) return hash8(normLite(sub));
  const q = String(s?.quote ?? '').trim();
  return q ? hash8(normLite(q)) : '';
}

/* ---------------- 分句与稳定键 ---------------- */

/** ASCII 句读（. ! ? ;）只在后随空白/结尾时算断句——避免小数、版本号、缩写被切开 */
function nextIsBoundary(text: string, i: number): boolean {
  if (i >= text.length) return true;
  return /\s/.test(text[i]);
}

/** markdown 行首标记（标题井号 / 列表符 / 有序序号 / 引用符 / callout 标记 `[!quote]`）——不算锚点内容 */
const LEADING_MARK_RE = /^(?:#{1,6}\s*|\[![^\]]*\]\s*|[-*+>]\s+|\d{1,3}[.)]\s+)+/;
/** `[[目标|别名#小节^块]]` → 可读显示文本（别名 > 小节 > 目标名） */
function wikiDisplay(inner: string): string {
  const afterAlias = inner.includes('|') ? inner.slice(inner.lastIndexOf('|') + 1) : inner;
  const afterBlock = afterAlias.includes('^') ? afterAlias.slice(0, afterAlias.indexOf('^')) : afterAlias;
  const noHead = afterBlock.includes('#') ? afterBlock.slice(0, afterBlock.lastIndexOf('#') + 1) : afterBlock;
  return noHead || afterAlias || inner;
}

/**
 * 剥掉**未闭合**的 `[[…`（句读切在双链别名里的实测噪声：`[[书库/社会心理学#^26kpix|`
 * → 取最后一个 `|` 之后的显示文本；没有 `|` 就整段丢掉）。闭合的双链留给下面的替换处理。
 */
function stripUnclosedWiki(raw: string): string {
  let text = String(raw ?? '');
  for (let guard = 0; guard < 8; guard++) {
    const open = text.lastIndexOf('[[');
    if (open < 0) break;
    if (text.indexOf(']]', open) > open) break; // 已闭合
    const inner = text.slice(open + 2);
    const afterAlias = inner.includes('|') ? inner.slice(inner.lastIndexOf('|') + 1) : '';
    text = text.slice(0, open) + afterAlias;
  }
  return text;
}

/** 锚点文本清洗：剥未闭合/闭合双链、去行内代码与强调标记、折叠空白 */
function cleanAnchorText(raw: string): string {
  return stripUnclosedWiki(raw)
    .replace(/!\[\[[^\[\]]*\]\]/g, ' ')
    .replace(/\[\[([^\[\]]+)\]\]/g, (_m, inner: string) => wikiDisplay(inner))
    .replace(/`+/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 切片 → 候选锚点（空串 / 纯符号 / 过短片段跳过；from/to 保留原文偏移供渲染层定位） */
function pushAnchor(out: AnchorRef[], text: string, from: number, to: number): void {
  let s = from;
  let e = to;
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  const lead = text.slice(s, e).match(LEADING_MARK_RE);
  if (lead) s += lead[0].length;
  if (s >= e) return;
  const cleaned = cleanAnchorText(text.slice(s, e));
  if (!cleaned) return;
  if ([...cleaned].length < SUGGEST_MIN_ANCHOR_CHARS) return;
  if (!HAS_MEANING_RE.test(cleaned)) return;
  out.push({ from: s, to: e, text: cleaned });
}

/**
 * 分句/分词切分：中英标点断句（。！？；… 与 .!?; 及换行），产出候选锚点。
 * 跳过空串、纯符号、过短片段；不在这里限流（限流由 generateSuggestions 的 SUGGEST_MAX_ANCHORS 负责）。
 */
export function splitAnchors(body: string): AnchorRef[] {
  const text = String(body ?? '');
  const out: AnchorRef[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    const ch = i === text.length ? '' : text[i];
    let boundary = i === text.length;
    if (!boundary) {
      if (ch === '\n' || ch === '。' || ch === '！' || ch === '？' || ch === '；' || ch === '…') boundary = true;
      else if (ch === '!') boundary = text[i - 1] !== '[' && text[i + 1] !== '['; // callout `[!quote]` 与嵌入 `![[…]]` 里的 `!` 不是句读
      else if (ch === '.' || ch === '?' || ch === ';') boundary = nextIsBoundary(text, i + 1);
    }
    if (!boundary) continue;
    pushAnchor(out, text, start, i);
    start = i + 1;
  }
  return out;
}

/** 锚点文本归一：折叠空白、去首尾引号/书名号、大小写折叠（跨编辑稳定键的一半） */
function normalizeAnchorText(text: string): string {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“”‘’《》〈〉「」『』]+/, '')
    .replace(/[\s"'“”‘’《》〈〉「」『』]+$/, '')
    .trim()
    .toLowerCase();
}

/** 目标路径归一：反斜杠转正斜杠、去 `./` 前缀、去 `.md`、小写 */
function normalizeTargetPath(path: string): string {
  return String(path ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\.md$/i, '')
    .trim()
    .toLowerCase();
}

/**
 * 「锚点 → 目标（+单元）」的稳定键（**跨编辑稳定**：只认规范化 anchor.text + 归一目标路径 + 单元，
 * 不吃 from/to 偏移——正文改几个字导致偏移全变，键不变，否决与去重才立得住）。
 * 321 起加单元后缀：同一笔记的「整篇」与「某一段」是两条不同建议，不该互相顶掉。
 */
export function suggestKey(
  s: Pick<MountSuggestion, 'anchor' | 'target'> & Partial<Pick<MountSuggestion, 'subpath' | 'quote' | 'unit'>>
): string {
  const sub = subKeyOf(s as Pick<MountSuggestion, 'subpath' | 'quote'>);
  return normalizeAnchorText(s.anchor?.text) + '\u0000' + normalizeTargetPath(s.target) + (sub ? '#' + sub : '');
}

/**
 * 幽灵节点 id（canvas 与 mergeSuggestions **共用这一个**，别各处自拼）。
 * 口径：`ai:<路径>` + 单元短键（`#<hash8>`）。整篇建议无单元 → 就是 `ai:<路径>`（与 318 同形，旧缓存片无害）；
 * 同一笔记的两个段落建议靠单元短键分开，不再互相顶掉。
 */
export function suggestionId(
  s: Pick<MountSuggestion, 'target'> & Partial<Pick<MountSuggestion, 'subpath' | 'quote' | 'anchor' | 'unit'>>
): string {
  const sub = subKeyOf(s as Pick<MountSuggestion, 'subpath' | 'quote'>);
  return `ai:${idPath(s?.target)}${sub ? '#' + sub : ''}`;
}

/* ---------------- 过滤 ---------------- */

/** 一条已存在的双链目标：`路径` / `路径#小节` / `路径#^块id` */
export interface ExistingLink {
  path: string;
  subpath: string | null;
}

/** 解析已存在双链目标原文（裸名 / 全路径 / 带 `#子路径` 都认） */
export function parseExistingLink(raw: string): ExistingLink {
  const s = String(raw ?? '').trim();
  const hash = s.indexOf('#');
  if (hash < 0) return { path: s, subpath: null };
  return { path: s.slice(0, hash), subpath: s.slice(hash + 1).trim() || null };
}

/**
 * 该目标（+单元）是否已在正文里是双链：
 * - 已链**整篇** → 该笔记的一切单元都不再推（整篇已表达这个关系）；
 * - 已链**同一单元** → 只挡这一条；已有 `[[x#A]]` 不该杀掉 `x#B` 的建议（321）。
 */
export function matchesExisting(target: string, subpath: string | null, existing: string[]): boolean {
  const t = normalizeTargetPath(target);
  if (!t) return false;
  const tBase = t.includes('/') ? t.slice(t.lastIndexOf('/') + 1) : t;
  const sub = String(subpath ?? '').trim().toLowerCase();
  for (const raw of existing || []) {
    const e = parseExistingLink(raw);
    const ep = normalizeTargetPath(e.path);
    if (!ep) continue;
    if (ep !== t && ep !== tBase) continue;
    if (!e.subpath) return true;
    if (sub && e.subpath.toLowerCase() === sub) return true;
  }
  return false;
}

/**
 * 过滤：否决表（永不再推）、已固定、弱关联（低于 minScore）、已存在的双链目标；同键去重。
 * `minScore` 缺省 SUGGEST_MIN_SCORE；`existing` 为本卡已有双链目标原文（可含全路径或裸名，可带 `#子路径`）。
 */
export function filterSuggestions(
  list: MountSuggestion[],
  opts: { dismissed: string[]; existing?: string[]; minScore?: number }
): MountSuggestion[] {
  const dismissed = new Set((opts?.dismissed || []).map((k) => String(k).trim().toLowerCase()));
  const existing = opts?.existing || [];
  const minScore = Number.isFinite(opts?.minScore) ? Number(opts?.minScore) : SUGGEST_MIN_SCORE;
  const seen = new Set<string>();
  const out: MountSuggestion[] = [];
  for (const s of list || []) {
    if (!s || !s.target) continue;
    if (s.state === 'dismissed' || s.state === 'fixed') continue;
    if (!(Number(s.score) >= minScore)) continue;
    const key = suggestKey(s);
    if (dismissed.has(key) || seen.has(key)) continue;
    if (existing.length > 0 && matchesExisting(s.target, s.subpath ?? null, existing)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/* ---------------- 缓存（CONFIG/STORAGE/mount-suggest.json，按主卡分片） ---------------- */

/** 缓存 store（惰性；jsonFileStore 坏文件留档 + 重建默认值的既有降级语义原样生效） */
function cacheStore() {
  return jsonFileStore<SuggestCacheFile>(storageFile(SUGGEST_CACHE_FILE), { defaultValue: () => ({ cards: {} }) });
}

/** 读建议缓存（形状兜底：非对象 / 缺 cards 一律按空表；不写盘） */
export async function readSuggestCache(): Promise<SuggestCacheFile> {
  const data = (await cacheStore().read()) as unknown as { cards?: unknown } | null;
  const cards =
    data && typeof data === 'object' && data.cards && typeof data.cards === 'object' && !Array.isArray(data.cards)
      ? (data.cards as Record<string, SuggestCardCache>)
      : {};
  return { cards };
}

/** 读-改-写事务整体入 per-path 串行队列（D1 原语 1）——并发生成/处置不互相覆盖 */
function mutateSuggestCache<T>(fn: (file: SuggestCacheFile) => T | Promise<T>): Promise<T> {
  const path = storageFile(SUGGEST_CACHE_FILE);
  return enqueueFileTask(path, async () => {
    const file = await readSuggestCache();
    const result = await fn(file);
    await cacheStore().write(file);
    return result;
  });
}

/**
 * 清空建议缓存（设置页「清空建议缓存」按钮）：**只清候选与生成时间**——各片 `bodyHash` 置空
 * （下次生成必然重算）、`generatedAt` 归零、`state==='pending'` 的候选移除；
 * `fixed` / `dismissed` 留档**长期保留**（ADR-0139 §3：取消过的「锚点 → 目标」永久不再推），
 * 且它们随片一起保住否决表；无任何留档的片整片删除。
 */
export async function clearSuggestCache(): Promise<void> {
  await mutateSuggestCache((file) => {
    for (const [path, entry] of Object.entries(file.cards || {})) {
      const kept = (entry?.suggestions || []).filter((s) => s && s.state !== 'pending');
      if (kept.length === 0) delete file.cards[path];
      else file.cards[path] = { bodyHash: '', generatedAt: 0, suggestions: kept, ver: SUGGEST_CACHE_VERSION };
    }
  });
}

/**
 * 缓存是否对该卡有效：版本相符（`SUGGEST_CACHE_VERSION`）**且** `bodyHash` 相等
 * （空 hash = 永远无效，供无生成记录的留档片使用）。
 */
export function cacheValid(entry: SuggestCardCache | undefined, bodyHash: string): boolean {
  return (
    !!entry &&
    entry.ver === SUGGEST_CACHE_VERSION &&
    !!bodyHash &&
    typeof entry.bodyHash === 'string' &&
    entry.bodyHash === bodyHash
  );
}

/** 全库否决键集合（跨卡生效：同一「锚点 → 目标」被取消过就永不再推——ADR-0139 §3） */
function collectDismissedKeys(file: SuggestCacheFile): string[] {
  const out: string[] = [];
  for (const entry of Object.values(file.cards || {})) {
    for (const s of entry?.suggestions || []) {
      if (s?.state === 'dismissed') out.push(suggestKey(s));
    }
  }
  return out;
}

/** 本卡已固定键集合（已转为双链的候选不再重推） */
function collectFixedKeys(entry: SuggestCardCache | undefined): string[] {
  return (entry?.suggestions || []).filter((s) => s?.state === 'fixed').map(suggestKey);
}

/** 落缓存：旧片的处置记录（fixed/dismissed）长期保留，新建议只占 pending 槽位 */
function persistCardCache(cardPath: string, bodyHash: string, generatedAt: number, suggestions: MountSuggestion[]): Promise<void> {
  return mutateSuggestCache((file) => {
    const prev = file.cards[cardPath];
    const kept = (prev?.suggestions || []).filter((s) => s && s.state !== 'pending');
    const keptKeys = new Set(kept.map(suggestKey));
    const fresh = suggestions.filter((s) => !keptKeys.has(suggestKey(s)));
    file.cards[cardPath] = { bodyHash, generatedAt, suggestions: [...kept, ...fresh], ver: SUGGEST_CACHE_VERSION };
  }).then(() => undefined);
}

/**
 * 处置：固定 / 取消（都留档；取消进否决表）。
 * 只动缓存，不碰卡片正文——「固定」写 `[[wikilink]]` 是渲染层的动作（ADR-0138 §2）。
 */
export async function markSuggestion(
  cardPath: string,
  s: MountSuggestion,
  state: 'fixed' | 'dismissed',
  ctx: SuggestCtx
): Promise<void> {
  void ctx; // 签名保留 ctx：渲染层同一套调用形状；处置本身不需要 app
  if (!cardPath || !s || !s.target) return;
  const key = suggestKey(s);
  const now = Date.now();
  await mutateSuggestCache((file) => {
    const prev = file.cards[cardPath];
    // 无片（清过缓存 / 从未生成）：新建**无效片**（bodyHash 空）——留档与否决优先，缓存命中等下次生成重建
    const entry: SuggestCardCache =
      prev && typeof prev === 'object' && Array.isArray(prev.suggestions)
        ? prev
        : { bodyHash: '', generatedAt: now, suggestions: [], ver: SUGGEST_CACHE_VERSION };
    const idx = entry.suggestions.findIndex((it) => suggestKey(it) === key);
    const marked: MountSuggestion = { ...(idx >= 0 ? entry.suggestions[idx] : s), state };
    if (idx >= 0) entry.suggestions[idx] = marked;
    else entry.suggestions.push(marked);
    file.cards[cardPath] = entry;
  });
}

/* ---------------- 正文读取与目标形态 ---------------- */

/** 正文剥离 frontmatter（建议只看正文；frontmatter 改动不让建议过期） */
export function stripFrontmatter(content: string): string {
  return String(content ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '');
}

/** 读笔记全文（读不到返回 null，调用方按「目标失效」处理） */
async function readNoteText(app: any, path: string): Promise<string | null> {
  try {
    const file = app?.vault?.getAbstractFileByPath?.(path);
    if (!file) return null;
    return String((await app.vault.read(file)) ?? '');
  } catch {
    return null;
  }
}

/** 目标在召回范围闸内？只排除归档 / 网页剪藏（ADR-0140：排除式，不是白名单） */
export function inRecallScope(path: string): boolean {
  const p = idPath(path);
  if (!p) return false;
  for (const dir of SUGGEST_EXCLUDE_DIRS) {
    const d = idPath(dir);
    if (!d) continue;
    if (p === d || p.startsWith(d + '/')) return false;
  }
  return true;
}

/**
 * 目标形态（ADR-0137 §3 六类形态落到建议上）：
 * 单元优先（标题 → head / 段落 → para），整篇按所在盒（卡片盒 → card，文献盒/主题盒/其它 → note）。
 * 旧口径把文献盒一律判 `para`（318 时代候选是块命中），321 起整篇就是整篇。
 */
function kindOfTarget(path: string, ctx: SuggestCtx, unit: SuggestUnit): MountKind {
  if (unit === 'heading') return 'head';
  if (unit === 'paragraph') return 'para';
  if (isUnderFolder(ctx?.cardboxDir || '', path)) return 'card';
  return 'note';
}

/** 展示名（缓存/幽灵节点无 app 时的兜底：文件名去扩展名） */
function displayName(path: string): string {
  const base = String(path || '').split('/').pop() || String(path || '');
  return stripMdExt(base);
}

/** 已存在的双链目标（正文 wikilink/嵌入；保留 `#子路径`，321 起按 (path, subpath) 粒度判重） */
export function collectExistingTargets(body: string): string[] {
  const text = String(body ?? '');
  const out: string[] = [];
  WIKILINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(text)) !== null) {
    const target = m[1].split('|')[0].trim();
    if (target) out.push(target);
  }
  return out;
}

/* ---------------- 三级回定位（ADR-0140 硬约束 ②） ---------------- */

/** 回定位命中级别：1 精确 / 2 去空白与 markdown 标记 / 3 段落兜底 */
export type LocateLevel = 1 | 2 | 3;

/** markdown 标记与省略号（模型给的摘录常带 `**`、表格被规范化成空格、省略号缩写） */

/** 归一：去 markdown 标记、折叠空白、去省略号（比对用；与原文 offsets 通过 map 对齐） */
function flattenForMatch(text: string): { flat: string; map: number[] } {
  const flat: string[] = [];
  const map: number[] = [];
  let i = 0;
  const src = String(text ?? '');
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '*' || ch === '_' || ch === '`' || ch === '~' || ch === '>' || ch === '|') {
      i++;
      continue;
    }
    if (ch === '…' || (ch === '.' && src.slice(i, i + 3) === '...')) {
      i += ch === '…' ? 1 : 3;
      continue;
    }
    flat.push(ch.toLowerCase());
    map.push(i);
    i++;
  }
  return { flat: flat.join(''), map };
}

/** 关键词（中文取二元组、西文取整词，≥2 字）——段落兜底打分用 */
function keywordsOf(s: string): string[] {
  const text = String(s ?? '');
  const words = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => m[0].toLowerCase());
  const out: string[] = [];
  for (const w of words) {
    if (/[\p{Script=Han}]/u.test(w)) {
      if (w.length <= 2) out.push(w);
      else for (let i = 0; i + 2 <= w.length; i++) out.push(w.slice(i, i + 2));
    } else if (w.length >= 2) out.push(w);
  }
  return out.slice(0, 24);
}

/**
 * 三级回定位（ADR-0140 硬约束 ②）：精确 → 去空白/markdown → 段落兜底（关键词命中该段取原文）。
 * 模型给的摘录**不是逐字**是常态：去 `**` 加粗、表格行被规范化成空格分隔、省略号缩写、甚至整句改写。
 * 仍失败返回 null（调用方按 ADR 降级：标题不存在 → 整篇；摘录找不到 → 整篇）。
 */
export function locateInText(
  text: string,
  needle: string,
  from = 0
): { at: number; len: number; level: LocateLevel } | null {
  const src = String(text ?? '');
  const want = String(needle ?? '').trim();
  if (!src || !want) return null;
  const start = Math.max(0, Math.min(Number(from) || 0, src.length));
  // ① 精确
  const exact = src.indexOf(want, start);
  if (exact >= 0) return { at: exact, len: want.length, level: 1 };
  // ②③ 在 `start` 之后的子串里做（ offsets 再补回去）
  const tail = src.slice(start);
  // ② 去空白 / markdown 标记
  const { flat, map } = flattenForMatch(tail);
  const flatWant = flattenForMatch(want).flat;
  if (flatWant) {
    const hit = flat.indexOf(flatWant);
    if (hit >= 0 && map[hit] !== undefined) {
      const at = start + map[hit];
      const endIdx = hit + flatWant.length - 1;
      const end = map[endIdx] !== undefined ? start + map[endIdx] + 1 : src.length;
      return { at, len: Math.max(1, end - at), level: 2 };
    }
  }
  // ③ 段落兜底：关键词命中最多的一段，整段取原文
  const kws = keywordsOf(want);
  if (kws.length === 0) return null;
  const need = Math.max(1, Math.ceil(kws.length / 2));
  let best: { at: number; len: number; score: number } | null = null;
  const blockRe = /[^\n][\s\S]*?(?=\n\s*\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(tail)) !== null) {
    const raw = m[0];
    if (!raw.trim()) continue;
    const flatBlock = flattenForMatch(raw).flat;
    let score = 0;
    for (const k of kws) if (flatBlock.includes(k)) score++;
    if (score < need) continue;
    const lead = raw.length - raw.trimStart().length;
    const at = start + m.index + lead;
    const len = raw.trimEnd().length - lead;
    if (!best || score > best.score) best = { at, len, score };
  }
  if (!best) return null;
  return { at: best.at, len: best.len, level: 3 };
}

/** 把 [at, at+len) 扩到所在块（空行分隔的整段——块 id 要挂在块尾） */
function expandBlock(text: string, at: number, len: number): { at: number; len: number } {
  const src = String(text ?? '');
  let s = Math.max(0, Math.min(Number(at) || 0, src.length));
  let e = Math.max(s, Math.min(src.length, s + Math.max(0, Number(len) || 0)));
  // 向前扩到上一个空行之后
  const lb = src.slice(0, s).search(/\n[ \t]*\n[^\n]*$/);
  s = lb >= 0 ? lb + 1 : 0;
  // 向后扩到下一个空行之前
  const nb = src.slice(e).search(/\n[ \t]*\n/);
  e = nb >= 0 ? e + nb : src.length;
  while (s < e && /\s/.test(src[s])) s++;
  while (e > s && /\s/.test(src[e - 1])) e--;
  return { at: s, len: Math.max(0, e - s) };
}

/** 在正文里找标题行的**原文**（逐字）；找不到返回 null（落 `[[路径#标题]]` 前必须校验） */
export function findHeadingText(content: string, heading: string): string | null {
  const want = String(heading ?? '').trim();
  if (!want) return null;
  const wantKey = normLite(want);
  for (const line of String(content ?? '').split(/\r?\n/)) {
    const m = /^(#{1,6})[ \t]+(.*)$/.exec(line);
    if (!m) continue;
    const text = m[2].trim();
    if (!text) continue;
    if (text === want || normLite(text) === wantKey) return text;
  }
  return null;
}

/** 切出某个标题下的小节（含标题行，到下一个同级或更高级标题为止） */
function sliceHeadingSection(content: string, headingText: string): string {
  const src = String(content ?? '');
  const lines = src.split(/\r?\n/);
  let start = -1;
  let level = 6;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})[ \t]+(.*)$/.exec(lines[i]);
    if (!m) continue;
    if (m[2].trim() !== headingText) continue;
    start = i;
    level = m[1].length;
    break;
  }
  if (start < 0) return src.trim();
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#{1,6})[ \t]+/.exec(lines[i]);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim();
}

/* ---------------- 单元内容（幽灵节点正文 / 落链接依据） ---------------- */

/**
 * 纯函数：从目标笔记全文里切出建议单元的原文。
 * 整篇 = 完整正文（白板与现有节点口径一致，**不另做预览上限**——ADR-0140 §9）；
 * 标题 = 该小节（标题不存在 → 降级整篇）；段落 = 摘录所在块（找不到 → 降级整篇）。
 */
export function sliceUnitText(
  content: string,
  s: Pick<MountSuggestion, 'unit'> & Partial<Pick<MountSuggestion, 'heading' | 'quote'>>
): string {
  const text = stripFrontmatter(content).trim();
  if (!text) return '';
  const unit: SuggestUnit = s?.unit === 'heading' || s?.unit === 'paragraph' ? s.unit : 'whole';
  if (unit === 'heading') {
    const real = findHeadingText(text, String(s?.heading ?? ''));
    if (!real) return text; // 证据失效 → 降级整篇（绝不写瞎链接）
    return sliceHeadingSection(text, real);
  }
  if (unit === 'paragraph') {
    const hit = String(s?.quote ?? '').trim() ? locateInText(text, String(s.quote)) : null;
    if (!hit) return text;
    const block = expandBlock(text, hit.at, hit.len);
    return text.slice(block.at, block.at + block.len).trim();
  }
  return text;
}

/**
 * 幽灵节点正文：**现读**目标文件，理由 + 单元原文（ADR-0140：长文不受索引截断影响）。
 * 读不到（目标已删）→ 只给理由。渲染层沿用 ADR-0122 追加语义（容器先清空）。
 */
export async function suggestionUnitMarkdown(
  app: any,
  s: Pick<MountSuggestion, 'target' | 'reason'> &
    Partial<Pick<MountSuggestion, 'unit' | 'heading' | 'quote'>>
): Promise<string> {
  const reason = String(s?.reason ?? '').trim() || 'AI 建议：这张卡与主卡有实质关联。';
  const head = `> ${reason}`;
  const content = await readNoteText(app, s?.target);
  if (content === null) return head;
  const unit = sliceUnitText(content, s as Pick<MountSuggestion, 'unit'>);
  return unit ? `${head}\n\n${unit}` : head;
}

/**
 * 段落形态的确定性块 id（`bz-` + hash8(路径 + 段落文本)）：
 * 同一段落每次算出来都一样 → 幂等，重复固定不会写出第二个 id。
 */
export function blockIdFor(path: string, blockText: string): string {
  return BLOCK_ID_PREFIX + hash8(`${idPath(path)}\n${String(blockText ?? '').trim()}`);
}

/**
 * 确保目标笔记里该段落带块 id（**固定时**才写；插件首次写非主卡文件，用户 2026-09-15 拍板允许）。
 * 幂等：段落末尾已有 `^bz-xxxxxxxx` 就直接复用；写走 per-path 串行队列（D1 原语 1）。
 * 找不到段落（摘录证据失效）→ `{ ok: false }`，调用方按整篇降级。
 */
export async function ensureSuggestionBlockId(
  app: any,
  targetPath: string,
  quote: string
): Promise<{ blockId: string; ok: boolean }> {
  const path = idPath(targetPath);
  if (!path || !String(quote ?? '').trim()) return { blockId: '', ok: false };
  try {
    return await enqueueFileTask(path, async () => {
      const file = app?.vault?.getAbstractFileByPath?.(path);
      if (!file) return { blockId: '', ok: false };
      const text = String((await app.vault.read(file)) ?? '');
      const hit = locateInText(text, quote);
      if (!hit) return { blockId: '', ok: false };
      const block = expandBlock(text, hit.at, hit.len);
      const blockText = text.slice(block.at, block.at + block.len);
      const existing = /\^([A-Za-z0-9-]+)\s*$/.exec(blockText);
      if (existing && existing[1].startsWith(BLOCK_ID_PREFIX)) return { blockId: existing[1], ok: true };
      const blockId = blockIdFor(path, blockText.replace(/\^([A-Za-z0-9-]+)\s*$/, '').trim());
      const trimmed = blockText.replace(/\s+$/, '');
      const next = text.slice(0, block.at) + `${trimmed} ^${blockId}` + text.slice(block.at + block.len);
      if (next !== text) await app.vault.modify(file, next);
      return { blockId, ok: true };
    });
  } catch (e) {
    console.warn('[mount-suggest] 补写块 id 失败', e);
    return { blockId: '', ok: false };
  }
}

/**
 * 三形态落链接文本（ADR-0140 决策 3）：
 * 整篇 `[[路径]]` / 标题 `[[路径#标题]]`（subpath 为空即降级整篇）/ 段落 `[[路径#^块id]]`（无块 id 降级整篇）。
 */
export function suggestionLink(
  s: Pick<MountSuggestion, 'target' | 'unit'> & Partial<Pick<MountSuggestion, 'subpath'>>
): string {
  const core = idPath(s?.target).replace(/\.md$/i, '');
  if (!core) return '';
  const sub = String(s?.subpath ?? '').trim();
  if (s?.unit === 'paragraph') return sub ? `[[${core}#^${sub.replace(/^\^/, '')}]]` : `[[${core}]]`;
  if (s?.unit === 'heading') return sub ? `[[${core}#${sub}]]` : `[[${core}]]`;
  return `[[${core}]]`;
}

/**
 * 词级 / 表格行锚点 → **别名替换** `[[目标|原词]]`（ADR-0140 决策 3）：
 * 词级锚点（≤12 字）或表格行锚点在句中追加会读不通，直接把原词替换成带别名的双链。
 * 非词级锚点返回 null（走既有句中追加路径）。
 */
export function isWordAnchor(anchor: AnchorRef | null | undefined, rowLike = false): boolean {
  const text = String(anchor?.text ?? '').trim();
  if (!text) return false;
  if (rowLike) return true;
  return [...text].length <= WORD_ANCHOR_MAX_CHARS && !/[。！？；\n]/.test(text);
}

/**
 * 别名替换：把正文中 `anchor` 那段原文**原地**换成 `[[目标|原词]]`。
 * 找不到锚点（文本对不上）返回 null（调用方退回追加路径）。
 */
export function replaceAnchorWithAlias(
  body: string,
  anchor: AnchorRef | null | undefined,
  target: string,
  subpath?: string
): string | null {
  const src = String(body ?? '');
  const text = String(anchor?.text ?? '').trim();
  const core = idPath(target).replace(/\.md$/i, '');
  if (!src || !text || !core) return null;
  const link = subpath ? `[[${core}#${subpath}|${text}]]` : `[[${core}|${text}]]`;
  if (src.includes(`[[${core}`)) return src; // 已是双链 → 幂等
  const hit = locateInText(src, text);
  if (!hit) return null;
  return src.slice(0, hit.at) + link + src.slice(hit.at + hit.len);
}

/* ---------------- 三段式 prompt ---------------- */

/** 查询官指令前缀（固定不变，命中供应商前缀缓存——同 link-agent 口径） */
const QUERY_PROMPT_PREFIX = [
  '你是卡片盒挂载树的检索查询官。给定一张主卡正文里带编号的若干片段，为**每个片段**生成两条检索查询：',
  '1) sentence：把该片段改写成一句 20–40 字的完整短句（保留原意与关键术语，用于语义向量召回——',
  '   关键词堆在向量查询侧会失配，召回质量差）；',
  '2) keywords：该片段的 3–6 个检索关键词（空格分隔，不要写句子）。',
  '输出要求：严格 JSON 数组 [{"seg":<片段编号>,"sentence":"…","keywords":"…","why":"一句话说明该片段在讲什么"}]，',
  '按片段编号升序；不要输出 JSON 以外的任何文字。',
].join('');

/** 组查询官 prompt */
function buildQueryPrompt(anchors: AnchorRef[]): string {
  const lines: string[] = [QUERY_PROMPT_PREFIX, '', '## 主卡正文片段'];
  anchors.forEach((a, i) => lines.push(`### s${i + 1}：${a.text}`));
  return lines.join('\n');
}

/** 采纳官指令前缀 */
const ADOPT_PROMPT_PREFIX = [
  '你是卡片盒挂载树的采纳官。给定主卡正文里带编号的片段，以及每个片段经检索召回的候选笔记',
  '（名称 / 路径 / 命中次数 / 最高分 / 命中块摘要），判断「片段」与「候选笔记」是否存在实质知识关联',
  '（共同主题、直接引用、同一事件或人物、强互补上下文）。',
  '标准：只推实质关联，弱关联（仅任务级/提及级）不推，存疑不推；宁缺勿滥。',
  '重要：下一轮还有定位官会**现读候选全文**复核，并且**可以否决**你选的配对——只要整体相关就选，',
  '不要为了自洽硬凑，也不要因为看不到全文就放弃。',
  `同一目标笔记最多选 ${SUGGEST_MAX_PER_TARGET} 条；关联分低于 ${SUGGEST_MIN_SCORE} 的一律不输出。`,
  '输出要求：严格 JSON 数组 [{"seg":<片段编号>,"path":"<候选路径原文>","score":<0到1>,"reason":"一句话理由"}]，',
  '按关联强度降序；确实没有关联就输出 []；不要输出 JSON 以外的任何文字。',
].join('');

/** 组采纳官 prompt：片段一次列出，候选池共享（带命中数/最高分/块摘要） */
function buildAdoptPrompt(segs: AnchorRef[], pool: PoolEntry[]): string {
  const lines: string[] = [ADOPT_PROMPT_PREFIX, '', '## 主卡正文片段'];
  segs.forEach((a, i) => lines.push(`### s${i + 1}：${a.text}`));
  lines.push('', '## 候选笔记（检索召回池）');
  pool.forEach((c, i) => {
    const snippet = c.snippet ? '｜' + c.snippet.replace(/\s+/g, ' ') : '';
    lines.push(
      `- c${i + 1}：${displayName(c.path)}（${c.path}）命中 ${c.hitCount} 次 · 最高分 ${c.maxScore.toFixed(3)}｜片段 ${c.segs
        .map((s) => 's' + (s + 1))
        .join('/')}${snippet}`
    );
  });
  return lines.join('\n');
}

/** 定位官指令前缀 */
const LOCATE_PROMPT_PREFIX = [
  '你是卡片盒挂载树的定位官。上一轮采纳官已选出若干「主卡片段 → 目标笔记」配对，现在**现读目标笔记全文**，',
  '为每条配对决定挂载粒度与锚定位置：',
  '- unit="whole"：整篇都相关（理由里说清为什么整篇相关）；',
  '- unit="heading"：只有某个标题下的小节相关 → heading 填**该小节标题的原文**（逐字，不得改写）；',
  '- unit="paragraph"：只有某一段相关 → quote 填**该段原文摘录**（逐字，20–80 字，不得改写、不得加省略号、',
  '  不要把表格行改写成空格分隔）；',
  '- skip=true：其实不相关，否决这条（宁可少推，也不要泛泛的链接）。',
  'anchor 填**主卡正文里的锚点原文**（逐字摘录自该片段，不要改写、不要加引号、不要加省略号）。',
  '输出要求：严格 JSON 数组 [{"n":<配对编号>,"unit":"whole|heading|paragraph","heading":"…","quote":"…",',
  '"anchor":"…","reason":"一句话理由","skip":false}]，按配对编号升序；全部否决输出 []；',
  '不要输出 JSON 以外的任何文字。',
].join('');

/** 目标笔记的提纲（标题原样 + 段落编号，供定位官指认小节与段落） */
export function outlineForLocate(content: string): string {
  const body = stripFrontmatter(content);
  const out: string[] = [];
  let p = 0;
  for (const line of body.split(/\r?\n/)) {
    if (/^#{1,6}[ \t]+/.test(line)) {
      out.push(line);
      continue;
    }
    if (!line.trim()) continue;
    p++;
    out.push(`（${p}）${line}`);
  }
  const text = out.join('\n');
  return text.length > SUGGEST_LOCATE_TEXT_CAP ? text.slice(0, SUGGEST_LOCATE_TEXT_CAP) + '\n…（后文略）' : text;
}

/** 组定位官 prompt：每条配对一段，附目标笔记提纲 */
function buildLocatePrompt(items: { anchor: AnchorRef; path: string; content: string }[]): string {
  const lines: string[] = [LOCATE_PROMPT_PREFIX, ''];
  items.forEach((it, i) => {
    lines.push(`## n${i + 1} · ${it.path}`);
    lines.push(`主卡锚点原文：${it.anchor.text}`);
    lines.push('', '### 目标笔记全文', outlineForLocate(it.content), '');
  });
  return lines.join('\n');
}

/* ---------------- 容错解析（318 三件套 + 321 三段解析器） ---------------- */

/** 编号取数：`1` / `"1"` / `"a1"` / `"t2"` / `"#3"` 一律取其中的整数（模型常照 prompt 的 a1/t2 标签作答） */
function pickIndex(v: unknown): number {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  const m = String(v ?? '').trim().match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
}

/**
 * 从任意形状里挖出数组：裸数组 / 外层对象的数组字段（含 `content` 里再套一段 JSON 字符串的
 * `response_format` 包壳：`{"type":"json_object","content":"[{…}]"}`）。挖不到返回 null。
 */
function digArray(value: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (depth > 3) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s.startsWith('[') && !s.startsWith('{')) return null;
    try {
      return digArray(JSON.parse(s), depth + 1);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  for (const key of ['suggestions', 'picks', 'result', 'items', 'data', 'list', 'queries', 'content']) {
    const hit = digArray(obj[key], depth + 1);
    if (hit) return hit;
  }
  for (const v of Object.values(obj)) {
    const hit = digArray(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** 剥代码围栏 + 脱壳取数组；认不出返回 null */
function takeArray(raw: string): unknown[] | null {
  const text = String(raw ?? '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  if (!text) return null;
  let value: unknown = null;
  try {
    value = JSON.parse(text);
  } catch {
    const m = text.match(/\[[\s\S]*\]/); // 前后夹解释文字 → 抠出第一个数组再试
    if (m) {
      try {
        value = JSON.parse(m[0]);
      } catch {
        value = null;
      }
    }
  }
  return digArray(value);
}

/** 字符串字段取值（去空白、截长度） */
function str(v: unknown, cap = 0): string {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return cap > 0 ? s.slice(0, cap) : s;
}

/** 布尔字段取值（`true` / `"true"` / `"yes"` / `1` 都算真） */
function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return /^(true|yes|y|是|1)$/i.test(String(v ?? '').trim());
}

/** 轮 1 查询官产物 */
export interface QueryItem {
  seg: number;
  sentence: string;
  keywords: string;
  why: string;
}
export interface ParseResult<T> {
  /** 从回答里挖出了 JSON 数组（`[]` 也算挖到） */
  found: boolean;
  /** 数组条数（0 = 空数组） */
  count: number;
  items: T[];
}

/**
 * 轮 1 解析（标签编号 / 围栏 / 包壳 / 夹叙文字全兜住；认不出的条目逐条丢弃）。
 * `found=false` ⇒ 回答里根本没有数组（空串 / 散文 / 截断）→ 调用方走机械分句兜底。
 */
export function parseQueryList(raw: string): ParseResult<QueryItem> {
  const arr = takeArray(raw);
  if (!arr) return { found: false, count: 0, items: [] };
  const out: QueryItem[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const seg = pickIndex(it.seg ?? it.segment ?? it.n ?? it.anchor);
    const sentence = str(it.sentence ?? it.query ?? it.q);
    const keywords = str(it.keywords ?? it.keyword ?? it.terms ?? it.kw);
    if (!Number.isInteger(seg) || (!sentence && !keywords)) continue;
    out.push({ seg, sentence: sentence || keywords, keywords: keywords || sentence, why: str(it.why, REASON_MAX_CHARS) });
  }
  return { found: true, count: arr.length, items: out };
}

/** 轮 2 采纳官产物 */
export interface AdoptPick {
  seg: number;
  path: string;
  score: number;
  reason: string;
}

/**
 * 轮 2 解析。目标用**路径原文**（不是索引）——模型照抄路径比数编号稳。
 * 路径认不出（空 / 非字符串）的条目丢弃；`found=true & count=0` = 模型明说「没有关联」。
 */
export function parseAdoptPicks(raw: string): ParseResult<AdoptPick> {
  const arr = takeArray(raw);
  if (!arr) return { found: false, count: 0, items: [] };
  const out: AdoptPick[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const seg = pickIndex(it.seg ?? it.segment ?? it.n ?? it.anchor);
    const path = str(it.path ?? it.target ?? it.note ?? it.file);
    const score = Number(it.score ?? it.s ?? it.confidence);
    if (!Number.isInteger(seg) || !path || !Number.isFinite(score)) continue;
    out.push({ seg, path, score: Math.max(0, Math.min(1, score)), reason: str(it.reason, REASON_MAX_CHARS) });
  }
  return { found: true, count: arr.length, items: out };
}

/** 轮 3 定位官产物 */
export interface LocatePick {
  n: number;
  skip: boolean;
  unit: SuggestUnit;
  heading: string;
  quote: string;
  anchor: string;
  reason: string;
}

/** 单元字段归一（模型会写中文 / head / para / block / quote / skip / none） */
function normalizeUnit(v: unknown): SuggestUnit | 'skip' | '' {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  if (/^(whole|all|note|整篇|全文|整篇笔记)$/.test(s)) return 'whole';
  if (/^(heading|head|headline|section|h[1-6]?|标题|小节)$/.test(s)) return 'heading';
  if (/^(paragraph|para|block|quote|passage|段落|段)$/.test(s)) return 'paragraph';
  if (/^(skip|none|null|否决|不相关)$/.test(s)) return 'skip';
  return '';
}

/**
 * 轮 3 解析。`skip` 原样透传（模型为自洽硬选的解药）；unit 认不出按 whole。
 * `found=true & count=0` = 全部否决（`[]`）。
 */
export function parseLocatePicks(raw: string): ParseResult<LocatePick> {
  const arr = takeArray(raw);
  if (!arr) return { found: false, count: 0, items: [] };
  const out: LocatePick[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const n = pickIndex(it.n ?? it.seg ?? it.index ?? it.i ?? it.pair);
    if (!Number.isInteger(n)) continue;
    const rawUnit = normalizeUnit(it.unit ?? it.type ?? it.level);
    const skip = bool(it.skip ?? it.reject ?? it.veto) || rawUnit === 'skip';
    const unit: SuggestUnit = rawUnit === '' || rawUnit === 'skip' ? 'whole' : rawUnit;
    out.push({
      n,
      skip,
      unit,
      heading: str(it.heading ?? it.title ?? it.section),
      quote: str(it.quote ?? it.excerpt ?? it.text),
      anchor: str(it.anchor),
      reason: str(it.reason, REASON_MAX_CHARS),
    });
  }
  return { found: true, count: arr.length, items: out };
}

/**
 * 裁判输出解析（318 一次性裁判的遗留解析器，**保留**：模型在 low 档下仍可能照旧标签作答，
 * 且 `parseJudgePicks` 已被 318 单测与线上缓存片语义覆盖）。
 */
export interface JudgePick {
  anchor: number;
  target: number;
  score: number;
  reason: string;
}
export interface JudgeParse {
  found: boolean;
  count: number;
  picks: JudgePick[];
}
export function parseJudgePicks(raw: string): JudgeParse {
  const arr = takeArray(raw);
  if (!arr) return { found: false, count: 0, picks: [] };
  const out: JudgePick[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const it = item as { anchor?: unknown; target?: unknown; score?: unknown; reason?: unknown };
    const anchor = pickIndex(it.anchor);
    const target = pickIndex(it.target);
    const score = Number(it.score);
    if (!Number.isInteger(anchor) || !Number.isInteger(target) || !Number.isFinite(score)) continue;
    out.push({
      anchor,
      target,
      score: Math.max(0, Math.min(1, score)),
      reason: str(it.reason, REASON_MAX_CHARS),
    });
  }
  return { found: true, count: arr.length, picks: out };
}

/* ---------------- 召回聚合（纯函数，可单测） ---------------- */

/** 一次检索命中（按片段编号与查询串记账） */
export interface RecallHit {
  seg: number;
  query: string;
  path: string;
  score: number;
  chunk: string;
}

/** 召回池条目（同一笔记合并；双查询并集） */
export interface PoolEntry {
  path: string;
  /** 命中次数（片段 × 查询的去重计数） */
  hitCount: number;
  maxScore: number;
  /** 最高分那次的块摘要 */
  snippet: string;
  /** 命中的片段编号（升序去重） */
  segs: number[];
}

/**
 * 召回聚合：范围闸（只排除归档/剪藏）+ 自指剔除 + 同笔记合并（留最高分块）+
 * 排序「命中次数 → 最高分」+ **多样性保底**（每片段最优笔记必进池），总量 `limit`。
 *
 * 排序**不能只看命中次数**（实测把真正相关的「巴纳姆效应」挤出了候选池），
 * 故每片段先保底送一条最优，再按 (hitCount, maxScore) 补齐。
 */
export function aggregatePool(
  hits: RecallHit[],
  opts?: { selfPath?: string; limit?: number }
): PoolEntry[] {
  const limit = Number.isFinite(opts?.limit) ? Math.max(1, Number(opts?.limit)) : SUGGEST_POOL_SIZE;
  const selfKey = normalizeTargetPath(opts?.selfPath || '');
  const byPath = new Map<string, PoolEntry>();
  const seenQuery = new Map<string, Set<string>>();
  for (const h of hits || []) {
    const p = String(h?.path ?? '').trim();
    if (!p) continue;
    const key = normalizeTargetPath(p);
    if (!key || key === selfKey) continue;
    if (!inRecallScope(p)) continue;
    let entry = byPath.get(key);
    if (!entry) {
      entry = { path: p, hitCount: 0, maxScore: 0, snippet: '', segs: [] };
      byPath.set(key, entry);
      seenQuery.set(key, new Set());
    }
    const qk = `${h?.seg ?? -1}\u0000${String(h?.query ?? '')}`;
    const qs = seenQuery.get(key)!;
    if (!qs.has(qk)) {
      qs.add(qk);
      entry.hitCount++;
    }
    const score = Number(h?.score);
    if (Number.isFinite(score) && score > entry.maxScore) {
      entry.maxScore = score;
      entry.snippet = String(h?.chunk ?? '').slice(0, 200);
    }
    if (Number.isInteger(h?.seg) && !entry.segs.includes(h.seg)) entry.segs.push(h.seg);
  }
  const all = [...byPath.values()];
  for (const e of all) e.segs.sort((a, b) => a - b);
  const ranked = all.slice().sort((a, b) => b.hitCount - a.hitCount || b.maxScore - a.maxScore);

  // 多样性保底：每个片段的最优笔记先各进一条（**仍是 ranked 顺序** = 命中次数 → 最高分，
  // 保底只解决「挤不进池」，不改变排序口径）
  const out: PoolEntry[] = [];
  const taken = new Set<string>();
  const segBest = new Map<number, PoolEntry>();
  for (const e of ranked) {
    for (const seg of e.segs) {
      const cur = segBest.get(seg);
      if (!cur || e.maxScore > cur.maxScore) segBest.set(seg, e);
    }
  }
  for (const e of ranked) {
    if (!e.segs.some((seg) => segBest.get(seg) === e)) continue;
    const key = normalizeTargetPath(e.path);
    if (taken.has(key)) continue;
    taken.add(key);
    out.push(e);
    if (out.length >= limit) return out;
  }
  for (const e of ranked) {
    const key = normalizeTargetPath(e.path);
    if (taken.has(key)) continue;
    taken.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/* ---------------- 进度（ADR-0140 决策 5） ---------------- */

/** 阶段文案（白板进度条下的动态文字） */
const STAGE_LABEL: Record<SuggestStage, string> = {
  query: '查询官：为正文片段生成检索查询',
  recall: '检索：召回候选笔记',
  adopt: '采纳官：判断片段与候选的关联',
  locate: '定位官：现读全文定粒度',
  save: '落缓存',
};

/** 阶段 → 进度条百分比（bar 宽度按阶段推进，不逐 token 刷屏） */
const STAGE_PERCENT: Record<SuggestStage, number> = {
  query: 15,
  recall: 40,
  adopt: 65,
  locate: 90,
  save: 100,
};

/** 进度文案（阶段 + `（x/y）`） */
export function suggestProgressLabel(p: SuggestProgress): string {
  const base = STAGE_LABEL[p?.stage] ?? '';
  const total = Number(p?.total);
  const done = Number(p?.done);
  const tail = Number.isFinite(total) && total > 0 && Number.isFinite(done) ? `（${done}/${total}）` : '';
  return base + tail;
}

/** 阶段进度百分比（渲染层直接拿去设 bar 宽度） */
export function suggestProgressPercent(p: SuggestProgress): number {
  const base = STAGE_PERCENT[p?.stage] ?? 0;
  const total = Number(p?.total);
  const done = Number(p?.done);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(done)) return base;
  const prev = p.stage === 'recall' ? STAGE_PERCENT.query : p.stage === 'locate' ? STAGE_PERCENT.adopt : base;
  return Math.round(prev + (base - prev) * Math.min(1, Math.max(0, done / total)));
}

/* ---------------- 生成 ---------------- */

/** 统一 AI 调用（prompt 纯文本通道 + 满预算 + low 思考档；三处调用同一口径） */
function aiPrompt(text: string): Promise<string> {
  return createAI().prompt(text, undefined, {
    modelOptions: { max_tokens: SUGGEST_JUDGE_MAX_TOKENS, reasoning_effort: SUGGEST_REASONING_EFFORT },
  });
}

/**
 * 生成建议：缓存命中（bodyHash 相等、版本相符且非 force）→ 直接返回 cached；
 * 未命中 → 三段式（查询官 → 召回 → 采纳官 → 定位官）→ 过滤 → 落缓存。
 *
 * 降级（都不跑建议、不自动建索引、**不落缓存**）：移动端 / 无可用向量索引 → no-index；
 * 无可用 AI 通道 → no-ai；采纳官回答不可用 → no-answer（下次重开重试，不冒充「已缓存建议」）。
 * 设置开关关闭且非 force → 'off'；显式 force 照跑。检索失败同样按降级返回且不落缓存。
 *
 * 降级梯子（ADR-0140）：轮 1 不可用 → 机械分句当查询（兜底，不硬失败）；
 * 轮 3 不可用 → 轮 2 结果按整篇落缓存（仍落）；`[]`（真的没有关联）照旧落缓存为空。
 */
export async function generateSuggestions(
  cardPath: string,
  ctx: SuggestCtx,
  opts?: SuggestOptions
): Promise<SuggestRun> {
  const empty = (status: SuggestStatus): SuggestRun => ({ status, suggestions: [] });
  const tell = (stage: SuggestStage, done?: number, total?: number): void => {
    const p: SuggestProgress = { stage, label: '', done, total };
    p.label = suggestProgressLabel(p);
    try {
      opts?.onProgress?.(p);
    } catch {
      /* 进度回调不影响链路 */
    }
  };

  // ① 降级门：移动端 / 无可用向量索引（未建 / 已降级）——白板只画双链 + 顶栏提示，不自动建索引
  if (isMobileEnv()) return empty('no-index');
  const searchApi = exportVectorSearch();
  if (!searchApi || !searchApi.isIndexReady()) return empty('no-index');

  // ② 设置开关（knowledgeMountAutoSuggest，默认开）：关闭时渲染层不该调用；被调用时只有显式重跑（force）才继续
  const auto = (tryGetSettings() as { knowledgeMountAutoSuggest?: boolean } | null)?.knowledgeMountAutoSuggest !== false;
  if (!auto && !opts?.force) return empty('off');

  // ③ 无可用 AI 通道 → no-ai（先于读卡与缓存：通道不可用不再端出旧建议）
  try {
    await getAIProvider();
  } catch {
    return empty('no-ai');
  }

  // ④ 读主卡正文（读不到按空处理，返回空结果但不写缓存）
  const file = ctx?.app?.vault?.getAbstractFileByPath?.(cardPath);
  let content = '';
  if (file) {
    try {
      content = await ctx.app.vault.read(file);
    } catch (e) {
      console.warn('[mount-suggest] 主卡读取失败', e);
    }
  }
  const body = stripFrontmatter(content);
  if (!body.trim()) return empty('fresh');

  // ⑤ 缓存命中：bodyHash 相等即秒返回（逐卡失效：改哪张卡只重跑那张）
  const bodyHash = String(hash31(body));
  const cacheFile = await readSuggestCache();
  const entry = cacheFile.cards[cardPath];
  const dismissed = collectDismissedKeys(cacheFile);
  const existing = collectExistingTargets(body);
  if (!opts?.force && cacheValid(entry, bodyHash)) {
    return {
      status: 'cached',
      suggestions: filterSuggestions(entry!.suggestions, { dismissed, existing, minScore: SUGGEST_MIN_SCORE }),
      generatedAt: entry!.generatedAt,
    };
  }

  // ⑥ 分句（片段 = 轮 1 的输入，也是锚点的唯一来源）
  const anchors = splitAnchors(body).slice(0, SUGGEST_MAX_ANCHORS);
  if (anchors.length === 0) {
    const generatedAt = Date.now();
    await persistCardCache(cardPath, bodyHash, generatedAt, []);
    return { status: 'fresh', suggestions: [], generatedAt };
  }
  const dismissedSet = new Set(dismissed);
  const fixedSet = new Set(collectFixedKeys(entry));

  // ⑦ 轮 1 查询官（不可用 → 机械分句当查询，兜底不硬失败）
  tell('query', 0, anchors.length);
  const queries: string[][] = anchors.map((a) => [a.text]);
  try {
    const raw = await aiPrompt(buildQueryPrompt(anchors));
    const parsed = parseQueryList(raw);
    if (parsed.found) {
      for (const it of parsed.items) {
        const i = it.seg - 1;
        if (i < 0 || i >= anchors.length) continue;
        const pair = [it.sentence, it.keywords].filter((s) => String(s ?? '').trim());
        if (pair.length) queries[i] = pair;
      }
    } else {
      console.warn('[mount-suggest] 查询官回答不可用，退回机械分句当查询');
    }
  } catch (e) {
    console.warn('[mount-suggest] 查询官失败，退回机械分句当查询', e);
  }
  tell('query', anchors.length, anchors.length);

  // ⑧ 本地召回（双查询并集 → 聚合 → 过滤失效目标）
  const recallTotal = queries.reduce((n, q) => n + q.length, 0);
  let recallDone = 0;
  const hits: RecallHit[] = [];
  let searchFailed = false;
  for (let i = 0; i < queries.length; i++) {
    for (const q of queries[i]) {
      try {
        const got = (await searchApi.search(q, SUGGEST_TOPK)) || [];
        for (const h of got) {
          if (!h || !h.path) continue;
          hits.push({ seg: i, query: q, path: h.path, score: Number(h.score) || 0, chunk: String(h.chunk || '') });
        }
      } catch (e) {
        console.warn('[mount-suggest] 向量检索失败，按降级处理', e);
        searchFailed = true;
        break;
      }
      recallDone++;
      tell('recall', recallDone, recallTotal);
    }
    if (searchFailed) break;
  }
  if (searchFailed) return empty('no-index');

  const pool = aggregatePool(hits, { selfPath: cardPath, limit: SUGGEST_POOL_SIZE }).filter((c) => {
    if (!ctx.app.vault.getAbstractFileByPath(c.path)) return false; // 失效目标（改名/删除残留）
    return !matchesExisting(c.path, null, existing); // 已链整篇的不送审
  });
  if (pool.length === 0) {
    const generatedAt = Date.now();
    await persistCardCache(cardPath, bodyHash, generatedAt, []);
    return { status: 'fresh', suggestions: [], generatedAt };
  }

  // ⑨ 轮 2 采纳官（片段 × 候选池 → 配对）
  tell('adopt');
  let rawAdopt = '';
  try {
    rawAdopt = await aiPrompt(buildAdoptPrompt(anchors, pool));
  } catch (e) {
    console.warn('[mount-suggest] 采纳官失败', e);
    return empty('no-ai');
  }
  const adoptedParsed = parseAdoptPicks(rawAdopt);
  if (!adoptedParsed.found || (adoptedParsed.count > 0 && adoptedParsed.items.length === 0)) {
    // 空回答（思考吃光预算 / 截断）或整批认不出（形状对不上）——都不是「没有关联」，别冒充，也别落缓存
    console.warn(
      `[mount-suggest] 采纳官回答不可用（${rawAdopt ? `${rawAdopt.length} 字` : '空'}，数组 ${adoptedParsed.count} 条）：${String(
        rawAdopt
      ).slice(0, 120)}`
    );
    return empty('no-answer');
  }
  const pathToEntry = new Map<string, PoolEntry>();
  for (const c of pool) {
    pathToEntry.set(normalizeTargetPath(c.path), c);
    const base = normalizeTargetPath(c.path).split('/').pop() || '';
    if (base && !pathToEntry.has(base)) pathToEntry.set(base, c);
  }
  interface Adopted {
    anchor: AnchorRef;
    entry: PoolEntry;
    score: number;
    reason: string;
  }
  const adopted: Adopted[] = [];
  const perTarget = new Map<string, number>();
  for (const pick of adoptedParsed.items) {
    if (pick.score < SUGGEST_MIN_SCORE) continue; // 弱关联不显示、存疑不链（ADR-0138）
    const a = anchors[pick.seg - 1];
    const c = pathToEntry.get(normalizeTargetPath(pick.path)) ?? pathToEntry.get(normalizeTargetPath(pick.path).split('/').pop() || '');
    if (!a || !c) continue;
    const tKey = normalizeTargetPath(c.path);
    if ((perTarget.get(tKey) ?? 0) >= SUGGEST_MAX_PER_TARGET) continue;
    if (dismissedSet.has(suggestKey({ anchor: a, target: c.path }))) continue;
    if (fixedSet.has(suggestKey({ anchor: a, target: c.path }))) continue;
    perTarget.set(tKey, (perTarget.get(tKey) ?? 0) + 1);
    adopted.push({ anchor: a, entry: c, score: pick.score, reason: pick.reason });
  }
  if (adoptedParsed.count === 0 || adopted.length === 0) {
    // 模型明说「没有关联」（[]）或全被本地挡掉 → 空结果照旧落缓存（不是瞬时故障）
    const generatedAt = Date.now();
    await persistCardCache(cardPath, bodyHash, generatedAt, []);
    return { status: 'fresh', suggestions: [], generatedAt };
  }

  // ⑩ 轮 3 定位官（现读全文定粒度；不可用 → 采纳结果按整篇兜底，仍落缓存）
  const locateList = adopted.slice(0, SUGGEST_MAX_LOCATE_NOTES);
  tell('locate', 0, locateList.length);
  const texts: (string | null)[] = [];
  for (const ad of locateList) texts.push(await readNoteText(ctx.app, ad.entry.path));
  let located: LocatePick[] | null = null;
  try {
    const rawLocate = await aiPrompt(
      buildLocatePrompt(
        locateList.map((ad, i) => ({ anchor: ad.anchor, path: ad.entry.path, content: texts[i] ?? '' }))
      )
    );
    const parsed = parseLocatePicks(rawLocate);
    // 只有「认得出至少一条」才采信：`[]` / 空回答 / 整批认不出都按**定位官不可用**处理
    // → 采纳结果按整篇兜底（仍落缓存）。真要否决，模型得给出带 `skip` 的条目。
    if (parsed.found && parsed.items.length > 0) located = parsed.items;
    else console.warn('[mount-suggest] 定位官回答不可用，采纳结果按整篇兜底');
  } catch (e) {
    console.warn('[mount-suggest] 定位官失败，采纳结果按整篇兜底', e);
  }

  const suggestions: MountSuggestion[] = [];
  locateList.forEach((ad, i) => {
    const pick = located ? located.find((p) => p.n === i + 1) : undefined;
    if (located && !pick) return; // 定位官给了数组但没这条 → 视为否决
    if (pick?.skip) return; // skip 原样透传成「不生成该条」
    suggestions.push(buildSuggestion(ctx, ad, pick ?? null, texts[i]));
  });
  tell('locate', locateList.length, locateList.length);
  // 超出定位官预算的采纳结果（>6 篇）按整篇兜底，不白丢
  for (let i = SUGGEST_MAX_LOCATE_NOTES; i < adopted.length; i++) {
    suggestions.push(buildSuggestion(ctx, adopted[i], null, null));
  }

  const filtered = filterSuggestions(suggestions, { dismissed, existing, minScore: SUGGEST_MIN_SCORE });

  // ⑪ 落缓存（旧片的处置留档保留）并返回
  tell('save');
  const generatedAt = Date.now();
  await persistCardCache(cardPath, bodyHash, generatedAt, filtered);
  return { status: 'fresh', suggestions: filtered, generatedAt };
}

/**
 * 一条采纳结果 → 建议（本地复核两条硬约束）。
 * ① 锚点用**主卡正文原文**：模型给的 anchor 能三级回定位到就用它（更窄更准），否则退回片段锚点；
 * ② 目标单元带可回定位证据：heading 校验标题真实存在（不存在 → 整篇）；quote 三级回定位失败 → 整篇。
 */
function buildSuggestion(
  ctx: SuggestCtx,
  ad: { anchor: AnchorRef; entry: PoolEntry; score: number; reason: string },
  pick: LocatePick | null,
  targetText: string | null
): MountSuggestion {
  let anchor: AnchorRef = { ...ad.anchor };
  const modelAnchor = String(pick?.anchor ?? '').trim();
  if (modelAnchor && modelAnchor !== ad.anchor.text) {
    const hit = locateInText(ad.anchor.text, modelAnchor);
    if (hit) anchor = { from: ad.anchor.from + hit.at, to: ad.anchor.from + hit.at + hit.len, text: ad.anchor.text.slice(hit.at, hit.at + hit.len) };
  }
  const reason = String(pick?.reason ?? ad.reason ?? '').trim() || '相关主题';
  let unit: SuggestUnit = pick?.unit ?? 'whole';
  let heading = String(pick?.heading ?? '').trim();
  let quote = String(pick?.quote ?? '').trim();
  let subpath = '';

  if (unit === 'heading') {
    const real = targetText ? findHeadingText(targetText, heading) : null;
    if (!real) {
      unit = 'whole'; // 标题不存在 → 绝不写 `[[路径#]]` 坏链接
      heading = '';
    } else {
      heading = real;
      subpath = real;
    }
  } else if (unit === 'paragraph') {
    const hit = targetText && quote ? locateInText(targetText, quote) : null;
    if (!hit) {
      unit = 'whole'; // 摘录找不到 → 降级整篇
      quote = '';
    }
    // 段落的 subpath（块 id）**固定时**才补写，缓存片里留空（quote 是回定位证据）
  }
  if (unit === 'whole') {
    heading = '';
    quote = '';
  }
  return {
    anchor,
    target: ad.entry.path,
    kind: kindOfTarget(ad.entry.path, ctx, unit),
    reason,
    score: ad.score,
    state: 'pending',
    unit,
    heading,
    quote,
    subpath,
  };
}

/**
 * 目标形态（供渲染层/外部按 ctx 复用；`kindOfTarget` 的公开版）。
 * 单元优先：heading → head / paragraph → para；整篇：卡片盒 → card，其余 → note。
 */
export function suggestKindOf(path: string, ctx: SuggestCtx, unit?: SuggestUnit): MountKind {
  return kindOfTarget(path, ctx, unit === 'heading' || unit === 'paragraph' ? unit : 'whole');
}

/* ---------------- 渲染层用：把建议并进挂载树 ---------------- */

/**
 * 把建议并进挂载树：未在树中的目标补**幽灵节点**（`suggested: true`，source `ai`）+ 从根扯出的**虚线边**。
 * 不改原树（返回新对象/新数组）；已在树中的目标不重复画（实体节点已表达该目标）；
 * 同一目标**同一单元**只画一个（`suggestionId` 口径）——同一笔记的两个段落建议不再互相顶掉。
 */
export function mergeSuggestions(tree: MountTree, run: SuggestRun): MountTree {
  const nodes = Array.isArray(tree?.nodes) ? tree.nodes : [];
  const edges = Array.isArray(tree?.edges) ? tree.edges : [];
  const rootNode = nodes.find((n) => n.id === tree?.root);
  const rootDepth = rootNode ? rootNode.depth : 0;
  const rootPath = rootNode ? normalizeTargetPath(rootNode.path) : '';
  const known = new Set(nodes.map((n) => normalizeTargetPath(n.path)));
  const ghostNodes: MountNode[] = [];
  const ghostEdges: MountEdge[] = [];
  const seen = new Set<string>();
  for (const s of run?.suggestions || []) {
    if (!s || !s.target) continue;
    const key = normalizeTargetPath(s.target);
    if (!key || key === rootPath || known.has(key)) continue;
    const id = suggestionId(s);
    if (seen.has(id)) continue;
    seen.add(id);
    const title =
      s.unit === 'heading' && s.heading
        ? s.heading
        : s.unit === 'paragraph' && s.quote
          ? s.quote.slice(0, 24)
          : displayName(s.target);
    ghostNodes.push({
      id,
      path: s.target,
      title,
      kind: s.kind,
      source: 'ai',
      depth: rootDepth + 1,
      anchor: s.anchor ?? null,
      missing: false,
      suggested: true,
      attached: false,
      body: null,
      parent: tree.root,
    });
    ghostEdges.push({ from: tree.root, to: id, suggested: true });
  }
  return { ...tree, nodes: [...nodes, ...ghostNodes], edges: [...edges, ...ghostEdges] };
}
