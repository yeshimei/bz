/**
 * 挂载树·AI 语义建议链路（issue 318 / ADR-0138 / ADR-0139 §3）
 *
 * 链路：主卡正文分句 → 第二大脑块级向量召回 → core AI 裁判（一句话理由 + 关联分）→ 过滤 → 落域内单文件缓存。
 * - AI **不写 related、不改正文**：只有渲染层的「固定」动作才写 `[[wikilink]]`（本模块只出候选与留档）；
 * - 缓存：`CONFIG/STORAGE/mount-suggest.json`（storageFile + jsonFileStore + enqueueFileTask 写事务），
 *   按主卡路径分片，`bodyHash`（core/utils hash31）逐卡失效——改哪张卡只重跑那张；坏文件按既有降级语义；
 * - 否决：点过「取消」的「锚点 → 目标」永久不再推（生成阶段先过滤）；「固定」也留档并过滤（不重复推）；
 * - 降级：移动端 / 无可用向量索引 / 无可用 AI 通道 → 不跑建议、**不自动建索引**，返回空候选与非 fresh 状态；
 *   裁判回答不可用（空串 / 认不出一条）→ `no-answer`，同样**不落缓存**（瞬时故障不污染以后的白板）。
 *
 * 2026-09-14 实机排障（用户报「打开白板没有任何 AI 建议」）：三处叠加，全是「答案拿到手却被丢掉」——
 * ① 模型按 prompt 里的标签形状作答（`"anchor":"a1","target":"t2"`），旧解析只认整数，逐条丢弃；
 * ② 带思考的模型（DeepSeek-V4.1-Flash）实测把 2048 / 8192 的预算全烧在 reasoning 上
 *    （finish_reason=length、content 空串）→ **不关思考**（保持默认档），把 `max_tokens` 提到 128K
 *    让思考跑完再出答案（`reasoning_effort: max` 试过，单卡 120s 太慢，用户否掉）；
 * ③ `response_format: json_object`（旧代码走 `createAI().json()`）与「输出数组」的 prompt 相互打架，
 *    实测模型会吐 `{"type": "json_object"}` 空壳、或把数组包进外层对象
 *    （`{"type":"json_object","content":"[…]"}`）→ 改用 prompt 纯文本通道，解析仍先脱壳再取数组。
 * 三处叠加后「空结果」还会被当成 fresh 落缓存（bodyHash 有效 ⇒ 以后每次都是「已缓存建议」零候选），
 * 故本轮把无回答单列为 `no-answer` 不落缓存，并加 `SUGGEST_CACHE_VERSION` 让旧口径的缓存片自动失效。
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
  SuggestRun,
  SuggestStatus,
} from './mount-types';

/** 建议生成上下文：主卡所在域的两个目录（目标形态判定用，其余一律经 ctx.app 走 vault） */
export interface SuggestCtx {
  app: any;
  cardboxDir: string;
  litDir: string;
}

/* ---------------- 常量（调参口径：宁缺勿滥） ---------------- */

/**
 * 弱关联阈值（ADR-0138「弱关联不显示、存疑不链」）：裁判给出的关联分低于该值一律丢弃、不落缓存。
 * 0.7 = 「明确实质关联」档；跑真实库后可再调，调它就是放宽/收紧「宁缺勿滥」这条线。
 */
export const SUGGEST_MIN_SCORE = 0.7;
/** 锚点最短字数（过短片段没有独立语义，送检索只会放大噪声） */
export const SUGGEST_MIN_ANCHOR_CHARS = 6;
/** 单次生成最多送检的锚点数（成本闸：每个锚点一次向量检索；长文只取正文前 N 句） */
export const SUGGEST_MAX_ANCHORS = 12;
/** 每个锚点的向量召回条数 */
export const SUGGEST_TOPK = 8;
/** 每个锚点最多送审的候选目标数 / 送审候选总数上限（裁判 prompt 体积闸） */
export const SUGGEST_PER_ANCHOR_CANDIDATES = 3;
export const SUGGEST_MAX_CANDIDATES = 24;
/**
 * 裁判调用参数（2026-09-14 用户拍板）：**思考不关**（默认档，不额外加压——`reasoning_effort: max` 实测单卡 120s，太久），
 * 但预算给满：DeepSeek-V4.1 官方口径——上下文 1M、max_tokens 上限 384K（393216），思考模式默认输出预算 64K。
 * 这里给 128K：裁判答案本身只有 ~3K token，余量全留给思考。（旧值 2048 实测被 reasoning 吃光：
 * finish_reason=length、content 空串 ⇒ 白板零建议。）
 */
export const SUGGEST_JUDGE_MAX_TOKENS = 131072;
/** 一句话理由长度上限（超长截断，防 UI 溢出） */
const REASON_MAX_CHARS = 80;
/** 建议缓存文件名（域内单文件，ADR-0139 §3） */
export const SUGGEST_CACHE_FILE = 'mount-suggest.json';
/**
 * 缓存格式版本：解析/取数口径变更即 +1，旧片（无 `ver` 或版本不符）一律按失效处理——
 * 免去「用户手动清缓存」，也让 2026-09-14 那批「正确答案被解析丢掉」的零候选片自动重跑。
 */
export const SUGGEST_CACHE_VERSION = 2;
/** 锚点文本最短长度之外还需含文字/数字（纯符号、纯标点、表格分隔线一律不是锚点） */
const HAS_MEANING_RE = /[\p{L}\p{N}]/u;
/** 正文双链（含嵌入；解析口径最小化——只用于「目标已是双链」过滤，完整解析归 mount-data 314） */
const WIKILINK_RE = /!?\[\[([^\[\]]+)\]\]/g;

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
  const noHead = afterBlock.includes('#') ? afterBlock.slice(afterBlock.lastIndexOf('#') + 1) : afterBlock;
  return noHead || afterAlias || inner;
}

/** 锚点文本清洗：剥嵌入、双链转显示文本、去行内代码/强调标记、折叠空白 */
function cleanAnchorText(raw: string): string {
  return raw
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
 * 「锚点 → 目标」的稳定键（**跨编辑稳定**：只认规范化 anchor.text + 归一目标路径，不吃 from/to 偏移——
 * 正文改几个字导致偏移全变，键不变，否决与去重才立得住）。
 */
export function suggestKey(s: Pick<MountSuggestion, 'anchor' | 'target'>): string {
  return normalizeAnchorText(s.anchor?.text) + '\u0000' + normalizeTargetPath(s.target);
}

/* ---------------- 过滤 ---------------- */

/** 目标是否已存在于本卡用户双链中（正文写裸名 `[[某卡]]`，候选是库内全路径——裸名按基名比） */
function matchesExisting(target: string, existing: string[]): boolean {
  const t = normalizeTargetPath(target);
  if (!t) return false;
  const tBase = t.includes('/') ? t.slice(t.lastIndexOf('/') + 1) : t;
  for (const raw of existing) {
    const e = normalizeTargetPath(raw);
    if (!e) continue;
    if (e === t || e === tBase) return true;
  }
  return false;
}

/**
 * 过滤：否决表（永不再推）、已固定、弱关联（低于 minScore）、已存在的双链目标；同键去重。
 * `minScore` 缺省 SUGGEST_MIN_SCORE；`existing` 为本卡已有双链目标原文（可含全路径或裸名）。
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
    if (existing.length > 0 && matchesExisting(s.target, existing)) continue;
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

/* ---------------- 生成 ---------------- */

/** 正文剥离 frontmatter（建议只看正文；frontmatter 改动不让建议过期） */
function stripFrontmatter(content: string): string {
  return String(content ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '');
}

/** 锚点文本 → 送检候选的稳定目标形态：卡片盒内 = card（可继续长树）/ 文献盒内 = para（命中块）/ 其余 = note */
function kindOfTarget(path: string, ctx: SuggestCtx): MountKind {
  if (isUnderFolder(ctx?.cardboxDir || '', path)) return 'card';
  if (isUnderFolder(ctx?.litDir || '', path)) return 'para';
  return 'note';
}

/** 展示名（缓存/幽灵节点无 app 时的兜底：文件名去扩展名） */
function displayName(path: string): string {
  const base = String(path || '').split('/').pop() || String(path || '');
  return stripMdExt(base);
}

/** 已存在的双链目标（正文 wikilink/嵌入；`|别名` 与 `#小节` 剥掉） */
function collectExistingTargets(body: string): string[] {
  const text = String(body ?? '');
  const out: string[] = [];
  WIKILINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(text)) !== null) {
    const target = m[1].split('|')[0].split('#')[0].trim();
    if (target) out.push(target);
  }
  return out;
}

/** 送审候选（一条 = 一个「锚点 × 目标」配对） */
interface JudgeCandidate {
  anchorIdx: number;
  /** 该锚点下的局部编号（0 起；prompt 里按 1 起排） */
  localIdx: number;
  path: string;
  kind: MountKind;
  snippet: string;
}

/** 裁判指令前缀（固定不变，命中供应商前缀缓存——同 link-agent 口径） */
const JUDGE_PROMPT_PREFIX = [
  '你是卡片盒挂载树的建议裁判。给定一张主卡正文里的若干锚点（词/句），以及每个锚点经向量召回得到的候选目标，',
  '逐一判断「锚点」与「候选目标」是否存在实质知识关联（共同主题、直接引用、同一事件或人物、强互补上下文）。',
  '标准：只推实质关联，弱关联（仅任务级/提及级）不推，存疑不推；宁缺勿滥。',
  '输出要求：严格 JSON 数组 [{"anchor":<锚点编号>,"target":<候选编号>,"score":<0到1的关联分>,"reason":"一句话理由"}]，按关联强度降序；',
  `分数低于 ${SUGGEST_MIN_SCORE} 的一律不要输出；无关联输出 []；不要输出 JSON 以外的任何文字。`,
].join('');

/** 组裁判 prompt：锚点一次列出，候选按锚点分组编号（a1 下 t1/t2…） */
function buildJudgePrompt(anchors: AnchorRef[], candidates: JudgeCandidate[]): string {
  const lines: string[] = [JUDGE_PROMPT_PREFIX, '', '## 锚点与候选'];
  for (let i = 0; i < anchors.length; i++) {
    lines.push(`### a${i + 1}：${anchors[i].text}`);
    const group = candidates.filter((c) => c.anchorIdx === i);
    if (group.length === 0) {
      lines.push('-（无候选）');
      continue;
    }
    for (const c of group) {
      const snippet = c.snippet ? '｜' + c.snippet.replace(/\s+/g, ' ') : '';
      lines.push(`- t${c.localIdx + 1}：${displayName(c.path)}（${c.path}）${snippet}`);
    }
  }
  return lines.join('\n');
}

interface JudgePick {
  anchor: number;
  target: number;
  score: number;
  reason: string;
}

/** 裁判回答的解析结果：`found` 区分「模型确实说了没有关联（`[]`）」与「回答根本没法用」 */
export interface JudgeParse {
  /** 从回答里挖出了 JSON 数组（`[]` 也算挖到） */
  found: boolean;
  /** 数组条数（0 = 空数组） */
  count: number;
  /** 结构可用的条目（编号认得出、分数是数） */
  picks: JudgePick[];
}

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
  for (const key of ['suggestions', 'picks', 'result', 'items', 'data', 'list', 'content']) {
    const hit = digArray(obj[key], depth + 1);
    if (hit) return hit;
  }
  for (const v of Object.values(obj)) {
    const hit = digArray(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * 裁判输出解析（剥代码围栏 + 脱壳取数组 + 标签编号取整；认不出的条目逐条丢弃，不抛错打断白板）。
 * `found=false` ⇒ 回答里根本没有数组（空串 / 散文 / 截断），调用方按 `no-answer` 降级且不落缓存。
 */
export function parseJudgePicks(raw: string): JudgeParse {
  const text = String(raw ?? '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  if (!text) return { found: false, count: 0, picks: [] };
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
  const arr = digArray(value);
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
      reason: String(it.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, REASON_MAX_CHARS),
    });
  }
  return { found: true, count: arr.length, picks: out };
}

/**
 * 生成建议：缓存命中（bodyHash 相等、版本相符且非 force）→ 直接返回 cached；
 * 未命中 → 分句 → 向量召回 → LLM 裁判 → 过滤（否决/已固定/弱关联/已存在双链）→ 落缓存。
 * 降级（都不跑建议、不自动建索引、**不落缓存**）：移动端 / 无可用向量索引 → no-index；无可用 AI 通道 → no-ai；
 * 裁判回答不可用（空回答或整批认不出）→ no-answer（下次重开重试，不冒充「已缓存建议」）。
 * 设置开关关闭且非 force → 'off'（渲染层据此显示「自动建议已关闭」，不要冒充「已缓存」）；显式 force 照跑。
 * 检索失败同样按降级返回且不落缓存（瞬时故障不污染以后的白板）。
 */
export async function generateSuggestions(
  cardPath: string,
  ctx: SuggestCtx,
  opts?: { force?: boolean }
): Promise<SuggestRun> {
  const empty = (status: SuggestStatus): SuggestRun => ({ status, suggestions: [] });

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

  // ⑥ 分句 → 向量召回（块级）× 过滤：否决/已固定/已是双链/失效目标/自身，一律不送审
  const anchors = splitAnchors(body).slice(0, SUGGEST_MAX_ANCHORS);
  if (anchors.length === 0) {
    const generatedAt = Date.now();
    await persistCardCache(cardPath, bodyHash, generatedAt, []);
    return { status: 'fresh', suggestions: [], generatedAt };
  }
  const dismissedSet = new Set(dismissed);
  const fixedSet = new Set(collectFixedKeys(entry));
  const candidates: JudgeCandidate[] = [];
  const seenPair = new Set<string>();
  let searchFailed = false;
  outer: for (let i = 0; i < anchors.length; i++) {
    let hits: { path: string; chunk: string; score: number }[] = [];
    try {
      hits = (await searchApi.search(anchors[i].text, SUGGEST_TOPK)) || [];
    } catch (e) {
      console.warn('[mount-suggest] 向量检索失败，按降级处理', e);
      searchFailed = true;
      break;
    }
    let local = 0;
    for (const hit of hits) {
      if (!hit || !hit.path || hit.path === cardPath) continue;
      const pairKey = suggestKey({ anchor: anchors[i], target: hit.path });
      if (dismissedSet.has(pairKey) || fixedSet.has(pairKey)) continue;
      if (matchesExisting(hit.path, existing)) continue;
      if (seenPair.has(pairKey)) continue;
      if (!ctx.app.vault.getAbstractFileByPath(hit.path)) continue; // 失效目标（改名/删除残留）
      seenPair.add(pairKey);
      candidates.push({
        anchorIdx: i,
        localIdx: local,
        path: hit.path,
        kind: kindOfTarget(hit.path, ctx),
        snippet: String(hit.chunk || '').slice(0, 200),
      });
      local++;
      if (local >= SUGGEST_PER_ANCHOR_CANDIDATES) break;
      if (candidates.length >= SUGGEST_MAX_CANDIDATES) break outer;
    }
  }
  if (searchFailed) return empty('no-index');
  if (candidates.length === 0) {
    const generatedAt = Date.now();
    await persistCardCache(cardPath, bodyHash, generatedAt, []);
    return { status: 'fresh', suggestions: [], generatedAt };
  }

  // ⑦ LLM 裁判（core/ai 统一通道）：一句话理由 + 关联分。
  //   走 **prompt 纯文本通道**，绝不用 json()：`response_format: json_object` 与「输出数组」的 prompt
  //   相互打架，实测模型会吐 `{"type": "json_object"}` 空壳（零建议）——建链 agent 的裁判同款口径。
  //   思考不关（默认档），预算给足 128K 让思考跑完再出答案。
  let raw = '';
  try {
    raw = await createAI().prompt(buildJudgePrompt(anchors, candidates), undefined, {
      modelOptions: { max_tokens: SUGGEST_JUDGE_MAX_TOKENS },
    });
  } catch (e) {
    console.warn('[mount-suggest] AI 裁判失败', e);
    return empty('no-ai');
  }
  const parsed = parseJudgePicks(raw);
  if (!parsed.found || (parsed.count > 0 && parsed.picks.length === 0)) {
    // 空回答（思考吃光预算 / 截断）或整批认不出（形状对不上）——都不是「没有关联」，别冒充，也别落缓存
    console.warn(
      `[mount-suggest] 裁判回答不可用（${raw ? `${raw.length} 字` : '空'}，数组 ${parsed.count} 条）：${String(raw).slice(0, 120)}`
    );
    return empty('no-answer');
  }
  const judged: MountSuggestion[] = [];
  for (const pick of parsed.picks) {
    if (pick.score < SUGGEST_MIN_SCORE) continue; // 弱关联不显示、存疑不链（ADR-0138）
    const a = anchors[pick.anchor - 1];
    const c = candidates.find((it) => it.anchorIdx === pick.anchor - 1 && it.localIdx === pick.target - 1);
    if (!a || !c) continue;
    judged.push({ anchor: { ...a }, target: c.path, kind: c.kind, reason: pick.reason, score: pick.score, state: 'pending' });
  }
  const suggestions = filterSuggestions(judged, { dismissed, existing, minScore: SUGGEST_MIN_SCORE });

  // ⑧ 落缓存（旧片的处置留档保留）并返回
  const generatedAt = Date.now();
  await persistCardCache(cardPath, bodyHash, generatedAt, suggestions);
  return { status: 'fresh', suggestions, generatedAt };
}

/* ---------------- 渲染层用：把建议并进挂载树 ---------------- */

/**
 * 把建议并进挂载树：未在树中的目标补**幽灵节点**（`suggested: true`，source `ai`）+ 从根扯出的**虚线边**。
 * 不改原树（返回新对象/新数组）；已在树中的目标不重复画（实体节点已表达该目标）；同一目标多条建议只画一个。
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
    if (!key || key === rootPath || known.has(key) || seen.has(key)) continue;
    seen.add(key);
    const id = 'ai:' + s.target;
    ghostNodes.push({
      id,
      path: s.target,
      title: displayName(s.target),
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
