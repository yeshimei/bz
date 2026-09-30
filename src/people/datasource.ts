/**
 * 脸谱数据源层（issue 446 / 449；聊天仓 v2 = issue 466 / ADR-0197；467 入保库）：
 * 消费微信全模态预处理管线（skill wechat-media-preprocess）的按联系人数据根目录——
 * `<数据根>/<联系人>/chat.json`（消息流 [{ct,type,who,msg,sid,dur,wav,img?}]，语音已回填
 * `[语音 N秒·情感] 文本`、图片可带 img:"月/文件" 字段、表情开始回填 `[表情·名]`）。
 * `voice.json` / `image_desc.json` 为**兼容兜底**（正常情况 chat.json 已回填，单文件即可；
 * 旧数据目录缺回填时仍按 wav / img 关联补齐）。
 *
 * 485 两轮口径：sync 轮只产 `<联系人>/stats.json`（SQL 聚合统计，readStatsJson 读它），
 * chat.json 挪到 `bz-face export --contact` 按需导出——扫描优先读 stats.json（缺文件回落
 * chat.json 兼容存量），「导入所选」对缺 chat.json 的勾选者先起 export 再走归一合并。
 *
 * 449 语义分流：47 表情按命名分流、49 分享/文件/引用逐条进时间线（带截断上限）、
 * 50 通话换轻标签；无转写语音 / 无描述图片 / 关开关的媒体**不进时间线只计数**。
 * 群聊（多位非我发送者）非我消息加 `[成员名] ` 前缀，单聊不变。
 *
 * 两段增量：
 * - 原始→聊天仓（本层）：4.x 原始码消息归一成「全量原始字段 + 派生消费文本」的仓条目——
 *   原始字段 type/who/sid/dur/wav/img 全保留；text = 合成后的消费文本（`[图片] 描述` /
 *   `[语音 N秒·情感] 转写` / `[表情·名]`…），**空串 = 不进时间线**（展示与素材组装只读
 *   「text 非空」这一行过滤，存储完整可重算——466 / ADR-0197，取代 449「不进时间线就丢出
 *   消息流」）。按替代键（sid / ct+msg 哈希）**upsert** 合并：同键新文本覆盖、原始字段按新值
 *   更新（取代旧 append-only，修「源 28 条表情带名 / 仓 52 条」永远对不上的事故）。
 *   467 起归一结果由调用方写进**保库记录**（safe-store.ts，SafeNote.kind='people'）——
 *   明文 people-preview.json 落盘通道退役（类型保留供迁移读旧文件）。
 *   顺带产出互动画像汇总 insights（insights.ts，供提炼 prompt 的「互动统计」素材段）。
 * - 聊天仓→脸谱：由 ui 层接既有 digest / planIncremental 增量管线（441 机制不动），本层不管。
 *
 * 纯函数（normalizeChatJson / mergeStore 等）与 IO（fs 读数据目录）分离：
 * 核心判定全部可单测，fs 仅桌面端可得（window.require，knowledge 同款）。
 */
import { tryGetSettings } from '../core/settings-provider';
import { collectMediaStats, parseMediaTag, emptyMediaStats, formatRecordingDuration, type MediaStats } from './media';
import { normalizeKind } from './parse';
import { computeInsights, emptyInsightSignals, type InsightsSummary } from './insights';
import type { UnifiedMessage } from './types';
import type { AvatarInput } from './safe-store';

// ---------------- 类型 ----------------

/** 预处理线一条原始消息（chat.json 元素；4.x 原始码） */
export interface RawChatMsg {
  /** 秒级时间戳 */
  ct: number;
  /** 4.x 原始码：1 文本 / 3 图片 / 34 语音 / 43 视频 / 47 表情 / 49 appmsg / 50 通话 / 10000 系统 */
  type: number;
  /** 发送者（预处理线还原：「我」或成员名） */
  who?: string;
  msg?: string;
  /** 消息 id（server_id；16~19 位整数，JSON.parse 后尾数有损——只作替代键，同环境幂等） */
  sid?: number;
  /** 语音 / 视频时长（秒） */
  dur?: number;
  /** 语音 wav 文件名（voice.json 关联键） */
  wav?: string;
  /** 图片定位（image_ct_map 回写：`<月>/<文件名>`，与 image_desc.file 同格式；缺省 = 未回写） */
  img?: string;
}

/** voice.json 条目（语音转写表；wav 文件名关联。兼容兜底：正常情况 chat.json 已回填转写） */
export interface VoiceItem {
  wav?: string;
  /** 消息 id（468 prep 起随表写入；旧表缺省按 wav 关联） */
  sid?: number;
  dur?: number;
  text?: string;
  emotion?: string;
  /** LLM 校对已落（ADR-0222）：插件写回的 additive 标记，工具重跑重写整表即失效重校 */
  proofread?: boolean;
}

/** image_map.json 条目（468：图片↔消息关联旁路表；file 与 image_desc.file 同格式 `<月>/<文件名>`，ct 秒级，sid 可缺） */
export interface ImageMapItem {
  file?: string;
  ct?: number;
  sid?: number;
}

/**
 * media_fail.json 条目（issue 521 / ADR-0225）：prep 段 3 产出的**不可消费清单**。
 * `missing` = 消息引用了图片但磁盘上没有可消费的解码产物（源图没导出 / `.bin` 没解出来，
 * 此时 file 是 chat 原始引用形态、可能无扩展名）；`broken` = 有产物但段 2 打不开。
 * ct / sid 与 image_map 同口径，插件按 sid 优先、ct 兜底匹配回仓内消息。
 */
export interface MediaFailItem {
  file?: string;
  reason?: string;
  ct?: number;
  sid?: number;
}

/** image_desc.json 条目（图片描述表；file 与 chat.json 的 img 字段同格式 `<月>/<文件名>`，ct 秒级。兼容兜底：正常情况 chat.json 的 img 已回写并按本表精确关联） */
export interface ImageDescItem {
  file?: string;
  ct?: number;
  desc?: string;
}

/** 图片描述来源（peopleImageDescMode）：file=读 image_desc.json（兼容兜底 / 预生成文件）；off=只计数不留标签。449 摘除 'ai'（假开关退役，旧存档值回落 'file'） */
export type ImageDescMode = 'file' | 'off';

/** 归一化开关（people 预览组设置快照） */
export interface NormalizeOptions {
  /** 消费语音转写（false = 语音消息丢弃，只计数） */
  previewVoice: boolean;
  /** 图片描述来源：file=读 image_desc.json（chat.json 缺描述时的兼容兜底）；off=无描述图片只计数不进时间线 */
  imageDescMode: ImageDescMode;
  /** [视频 N秒] 标签进时间线（false = 视频消息丢弃，只计数） */
  previewVideo: boolean;
  /** type=10000 系统消息保留（撤回 / 打招呼锚点） */
  keepSystem: boolean;
}

/**
 * 一条聊天仓消息（466 / ADR-0197）：全量原始字段 + 派生消费文本；key = 增量替代键。
 * 原始字段有则存（undefined 不落盘），展示与素材组装只读 `text !== ''` 的条目。
 */
export interface StoreMsg {
  key: string;
  /** 毫秒时间戳 */
  ts: number;
  isSender: boolean;
  /** 4.x 原始码：1 文本 / 3 图片 / 34 语音 / 43 视频 / 47 表情 / 49 appmsg / 50 通话 / 10000 系统；9001 = 补充素材·录音轮次（509 自定号，避开微信原始码） */
  type: number;
  /** 发送者（预处理线还原：「我」或成员名） */
  who?: string;
  /** 消息 id（server_id；16~19 位整数，JSON.parse 后尾数有损——只作替代键，同环境幂等） */
  sid?: number;
  /** 语音 / 视频时长（秒） */
  dur?: number;
  /** 语音 wav 文件名（voice.json 关联键） */
  wav?: string;
  /** 图片定位（工具产 `月/文件名`，与 image_desc.file 同格式；缺省 = 未关联） */
  img?: string;
  /** 派生消费文本（`[图片] 描述` / `[语音 N秒·情感] 转写` / `[表情·名]`…）；**'' = 不进时间线** */
  text: string;
  /**
   * 图片「终态跳过」标注——三种取值，共同语义：**永不重跑、不算欠账**（不排除则每轮补画都重扫
   * 全库，ADR-0223 决策 6），text 留空不进时间线。
   *   - `'sensitive'`：描述服务商判敏感拒绝（ADR-0224），启发式判定 → 详情页可解除并重试；
   *   - `'broken'` / `'missing'`：源图打不开 / 源图没导出（ADR-0225），**磁盘事实** →
   *     不给解除入口，撤销由 `media_fail.json` 的权威性承担（重导后表里没有即自动清）。
   * 空 = 未标注。**工具侧永不直接写此字段**——只能经由旁路表，插件是唯一写者（ADR-0197）。
   */
  descSkip?: DescSkip;
}

/** 终态跳过的三种取值 */
export type DescSkip = 'sensitive' | 'broken' | 'missing';

/** 敏感标注的取值（ADR-0224） */
export const SENSITIVE_SKIP = 'sensitive';
/** 源图打不开（派生出不了档，ADR-0225） */
export const BROKEN_SKIP = 'broken';
/** 源图没导出（磁盘上只有微信缩略图，ADR-0225） */
export const MISSING_SKIP = 'missing';

/** 该图是否已是终态跳过（三种取值都算：不算欠账、不切批、不再调用；等价已完成，差别只在 text 留空） */
export function isDescSkipped(m: { descSkip?: string } | undefined | null): boolean {
  return descSkipOf(m) !== undefined;
}

/** 终态取值归一（未知取值当「未标注」——工具将来加新值时旧插件按普通欠账处理，不会误判） */
export function descSkipOf(m: { descSkip?: string } | undefined | null): DescSkip | undefined {
  const v = m?.descSkip;
  return v === SENSITIVE_SKIP || v === BROKEN_SKIP || v === MISSING_SKIP ? v : undefined;
}

/** 聊天仓统计（落盘口径；只统计时间线（text 非空）条目，媒体数 = 合成后文本按 445 parseMediaTag 的素材计数） */
export interface StoreStats {
  msgCount: number;
  voiceCount: number;
  voiceTotalSec: number;
  imageCount: number;
  /** 录音轮次条数与总时长（509；旧存档缺省读作 0） */
  recordingCount?: number;
  recordingTotalSec?: number;
}

/** 一位联系人的聊天仓 */
export interface StoreContact {
  /** 全量原始消息流（含 text='' 条目），ts 升序 */
  msgs: StoreMsg[];
  /** 已收最大 sid（展示参考；增量判定以 msgs 的 key 集合为准） */
  watermarkSid: number;
  stats: StoreStats;
  /**
   * chat.json 全量形态计数（440 中文形态键；每次导入按原始消息全量重算覆盖，幂等）。
   * 仓条目已是文本形态、无法从仓内反推（系统消息原文无标签），故随仓落盘供生成管线复用。
   */
  kindCounts?: Record<string, number>;
  /** 互动画像汇总（449；normalize 全量重算覆盖。旧数据无此字段照常读） */
  insights?: InsightsSummary;
  /** 头像文件路径（**字段退役**，467：头像本体走保库记录附件——明文「文件夹名=人名」目录
   *  CONFIG/FACES 已停止使用；迁移时本字段被剥除，新导入不再写。类型保留供迁移读旧文件） */
  avatar?: string;
  /** 最近一次导入时间 ISO */
  updatedAt: string;
}

/** people-preview.json 根结构（**明文文件已退役**，467 / ADR-0194——类型保留供存量迁移读旧文件） */
export interface MessageStoreData {
  version: 2;
  contacts: Record<string, StoreContact>;
}

export interface NormalizeResult {
  /** 全量原始消息流（含 text='' 条目——不进时间线的也在，466） */
  msgs: StoreMsg[];
  /** 全形态计数（与既有 parse 层 kindCounts 同口径） */
  kindCounts: Record<string, number>;
  stats: StoreStats;
  /** 互动画像汇总（449；过滤后时间线现算 + 语义信号计数） */
  insights: InsightsSummary;
  /** 原始消息里的最大有效 sid */
  maxSid: number;
  /** 原始条数 − 入仓条数（非对象 / 无效时间等无法入仓的；导入记录 skippedCount 口径） */
  skippedCount: number;
}

// ---------------- 替代键 ----------------

/** FNV-1a 32 位哈希（sid 缺失时的 ct+msg 替代键原料） */
function hash32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * 增量替代键：有效 sid（≠0/NaN）→ `s<sid>:<ct>`（sid 超 2^53 尾数有损，同环境幂等；
 * 拼 ct 把「同秒内 sid 截断重合」的碰撞概率再压一档）；sid 缺失/为 0 → ct+msg 哈希。
 */
export function msgKey(raw: RawChatMsg): string {
  const sid = typeof raw.sid === 'number' && Number.isFinite(raw.sid) && raw.sid !== 0 ? raw.sid : 0;
  if (sid) return `s${sid}:${raw.ct ?? 0}`;
  return `h${hash32(`${raw.ct ?? 0}|${String(raw.msg ?? '')}`)}`;
}

// ---------------- 归一化（原始 → 预览） ----------------

/** 「我」的 who 字面（预处理线约定：real_sender_id 还原，自己显「我」） */
const SELF_WHO = '我';

/** 发送者判定：who === '我'（其余一律按对方） */
export function isSelfWho(who: string | undefined): boolean {
  return String(who ?? '').trim() === SELF_WHO;
}

/** 图片描述最近邻兜底阈值（秒）：与预处理线上下文管线同款 ±12h（image_ct_map 匹配先例） */
const IMG_DESC_NEAREST_SEC = 12 * 3600;

/**
 * 图片消息 → 描述文本（纯查找，返回 '' = 未命中）：
 * 1) img 字段有值 → descByFile 按 file 精确匹配（image_ct_map 回写后的权威路径；同图多次出现复用同描述）；
 * 2) img 缺失 → 同月 ct 最近邻（±12h 内、未被消费过；一张描述只配一条消息，防批量错位）；
 * 3) 都失手 → ''（回退空标签，不解析成素材）。
 */
function matchImageDesc(
  raw: RawChatMsg,
  descByFile: Map<string, ImageDescItem>,
  descByMonth: Map<string, ImageDescItem[]>,
  descUsed: Set<string>
): string {
  const img = String(raw.img ?? '').trim();
  if (img) {
    const exact = descByFile.get(img);
    return exact ? String(exact.desc ?? '').trim() : '';
  }
  const ct = Number(raw.ct);
  if (!Number.isFinite(ct)) return '';
  const list = descByMonth.get(monthOf(ct));
  if (!list?.length) return '';
  let best: ImageDescItem | null = null;
  let bestDiff = Infinity;
  for (const it of list) {
    const ict = Number(it.ct);
    if (!Number.isFinite(ict)) continue;
    const diff = Math.abs(ict - ct);
    if (diff < bestDiff) { bestDiff = diff; best = it; }
  }
  if (!best || bestDiff > IMG_DESC_NEAREST_SEC) return '';
  const file = String(best.file ?? '').trim();
  const usedKey = file || `ct:${Number(best.ct)}`;
  if (descUsed.has(usedKey)) return '';
  descUsed.add(usedKey);
  return String(best.desc ?? '').trim();
}

/**
 * 群聊判定：去掉「我」之后还有多个不同发送者 = 群聊（单聊只有 对方 + 我）。
 * 空会话不算群聊。
 */
export function isGroupChat(raws: RawChatMsg[]): boolean {
  const others = new Set<string>();
  for (const r of raws) {
    if (!r || typeof r !== 'object') continue;
    const who = String(r.who ?? '').trim();
    if (!who || isSelfWho(who)) continue;
    others.add(who);
    if (others.size > 1) return true;
  }
  return false;
}

/** 秒 → `YYYY-MM`（image_desc.file 的「月/」前缀同构） */
function monthOf(sec: number): string {
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** voice.json 的英文情感标签 → 中文（预处理线标准化；未知标签原样保留） */
const EMOTION_ZH: Record<string, string> = {
  NEUTRAL: '平静',
  HAPPY: '开心',
  ANGRY: '生气',
  SAD: '难过',
};

function emotionZh(emotion: string): string {
  const e = emotion.trim();
  return EMOTION_ZH[e.toUpperCase()] ?? e;
}

/** 语音标签合成：`[语音 14秒·平静] 转写文本`（无转写回退 `[语音 14秒]` / `[语音]`） */
function buildVoiceText(raw: RawChatMsg, voice: VoiceItem | undefined): string {
  const dur = Number.isFinite(raw.dur) && (raw.dur as number) > 0 ? Math.round(raw.dur as number) : 0;
  const emo = emotionZh(String(voice?.emotion ?? ''));
  const text = String(voice?.text ?? '').trim();
  const head = dur ? `[语音 ${dur}秒${emo ? `·${emo}` : ''}]` : '[语音]';
  return text ? `${head} ${text}` : head;
}

// ---------------- 449 语义分流小件（47 表情 / 49 appmsg / 50 通话） ----------------

/** 命名表情：`[表情·名]`（预处理线回填；名可含任意非 `]` 字符） */
const EMOJI_NAMED_RE = /^\[表情·[^\]]+\]/;

/** 分享 / 小程序截断上限（字符数；超限补 `…` 保持总数不超上限） */
const SHARE_MAX_CHARS = 80;

/** 引用头截断上限：`[引用「…」]` 引号内原文超 60 字截断补 `…」` */
const QUOTE_HEAD_MAX_CHARS = 60;

/** 未接通原因（按序匹配；「对方已取消」须先于「已取消」） */
const CALL_MISSED_REASONS = [
  '对方已拒绝',
  '未应答',
  '对方无应答',
  '对方已取消',
  '已取消',
  '对方忙线中',
  '忙线未接听',
] as const;

/** 文本超限截断：≤ max 原样；否则取前 max-1 字补 `…`（总长不超 max） */
function truncateChars(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * 引用消息截断：保留 `[引用「…」] 回复` 结构——引用头（到首个 `」`）引号内原文超 60 字
 * 则截断补 `…」`，回复部分原样保留。不匹配引用结构时原样返回。
 */
function truncateQuoteHead(text: string): string {
  const m = /^(\[引用「)([\s\S]*?)(」[\s\S]*)$/.exec(text);
  if (!m) return text;
  const quote = m[2];
  if (quote.length <= QUOTE_HEAD_MAX_CHARS) return text;
  return `${m[1]}${quote.slice(0, QUOTE_HEAD_MAX_CHARS)}…」${m[3].slice(1)}`;
}

/** 通话时长秒数解析：`H:M:S` / `M:S` / `N分M秒` / `N秒`；解析不出返回 null */
function parseCallDurationSec(text: string): number | null {
  const colon = /\[通话(?:中断)?(?:时长)?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*\]/.exec(text);
  if (colon) {
    const [a, b, c] = [Number(colon[1]), Number(colon[2]), Number(colon[3] ?? 0)];
    return colon[3] !== undefined ? a * 3600 + b * 60 + c : a * 60 + b;
  }
  const zh = /\[通话(?:中断)?(?:时长)?\s+(?:(\d+)\s*分)?(?:(\d+)\s*秒)?\s*\]/.exec(text);
  if (zh && (zh[1] || zh[2])) return Number(zh[1] ?? 0) * 60 + Number(zh[2] ?? 0);
  return null;
}

/** 秒 → 通话轻标签时长段：≥1 时 `H时M分`；≥1 分 `M分N秒`；其余 `N秒` */
function formatCallDur(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}时${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

/** 未接通判定：msg 含原因原文即命中（返回原因；不命中返回 null） */
function missedCallReason(text: string): string | null {
  for (const r of CALL_MISSED_REASONS) {
    if (text.includes(r)) return r;
  }
  return null;
}

/**
 * chat.json → 聊天仓消息流（纯函数，449 语义分流 + 466 全量入仓）。每条有效原始消息都入仓
 * （原始字段保留），派生消费文本按规则合成，**不合成的条目 text 存空串（= 不进时间线）**：
 * - 1 文本：msg 原样（空文本 text 空）；
 * - 34 语音：previewVoice 开 → msg 已回填转写则原样，无转写正文查 voice.json（wav 关联）回填，
 *   仍无 → text 空；关 → text 空（两态都只计数）；
 * - 3 图片：imageDescMode='file' → 按 img 字段精确对上 image_desc（img 缺失走同月 ct 最近邻 ±12h
 *   兜底，一张描述只配一条消息）→ `[图片] 描述`；未命中 / 'off' → text 空；
 * - 43 视频：previewVideo 开且有时长 → `[视频 N秒]`；无时长或关 → text 空（空标签无信息）；
 * - 47 表情：`[表情·名]` 进时间线计 emojiNamedCount；纯 `[表情]` / 未命名 text 空；
 * - 49：`[分享]`/`[小程序]` 截断 ≤80 字进（shareCount）；`[文件]` 原样进；
 *   `[引用「…」]` 引用头超 60 字截断补 `…」`，回复保留；其余形态原样进；
 * - 50 通话：`[通话时长 H:M:S]` → `[通话 H时M分]`（不足 1 时 M分N秒 / 不足 1 分 N秒）、
 *   `[通话中断 …]` 同款换算、未接通类 → `[未接通·原因原文]`；未知形态原样进；
 * - 10000 系统：keepSystem 开 → 原样；关 → text 空；msg 含「撤回」按 who 归属计 recant（不受开关影响）；
 * - 其余未知码：全量入仓、text 空（唯一权威存储；只计数不进时间线）。
 * 群聊（多位非我发送者）非我消息 text 前加 `[成员名] ` 前缀（系统消息除外，原文自带归属；text 空
 * 不加前缀），单聊不变。非对象 / 无效时间的条目无法入仓，只计 kindCounts 与 skippedCount。
 * 结果按 ts 升序。insights 随过滤后时间线现算。
 */
export function normalizeChatJson(
  raws: unknown[],
  opts: NormalizeOptions,
  extras?: { voice?: VoiceItem[]; imageDesc?: ImageDescItem[] }
): NormalizeResult {
  const voiceByWav = new Map<string, VoiceItem>();
  for (const v of extras?.voice ?? []) {
    if (!v || typeof v !== 'object') continue;
    const wav = String(v.wav ?? '').trim();
    if (!wav) continue;
    voiceByWav.set(wav, v); // 全路径键（`<名>/voice/…`，chat.json 同格式）
    const base = wav.includes('/') ? wav.slice(wav.lastIndexOf('/') + 1) : wav;
    if (base) voiceByWav.set(base, v); // 尾段文件名键（防御 chat.json 只存文件名的变体）
  }
  // 图片描述索引：file 精确键（img 回写后的主路径）+ 月内 ct 升序表（img 缺失时最近邻兜底）
  const descByFile = new Map<string, ImageDescItem>();
  const descByMonth = new Map<string, ImageDescItem[]>();
  for (const it of extras?.imageDesc ?? []) {
    if (!it || typeof it !== 'object') continue;
    const desc = String(it.desc ?? '').trim();
    if (!desc) continue;
    const file = String(it.file ?? '').trim();
    if (file) descByFile.set(file, it);
    const month = file.includes('/') ? file.slice(0, file.indexOf('/')) : monthOf(Number(it.ct));
    if (!month) continue;
    let list = descByMonth.get(month);
    if (!list) { list = []; descByMonth.set(month, list); }
    list.push(it);
  }
  for (const list of descByMonth.values()) list.sort((a, b) => (Number(a.ct) || 0) - (Number(b.ct) || 0));
  const descUsed = new Set<string>(); // 最近邻消费防串：一张描述只配一条图片消息

  const group = isGroupChat(raws as RawChatMsg[]);
  const signals = emptyInsightSignals();
  const bumpEmotion = (emo: string | undefined): void => {
    const k = String(emo ?? '').trim();
    if (k) signals.voiceEmotion[k] = (signals.voiceEmotion[k] ?? 0) + 1;
  };

  const kindCounts: Record<string, number> = {};
  const msgs: StoreMsg[] = [];
  let maxSid = 0;
  let rawTotal = 0;
  for (const item of raws) {
    rawTotal++;
    if (!item || typeof item !== 'object') { kindCounts['其他'] = (kindCounts['其他'] ?? 0) + 1; continue; }
    const raw = item as RawChatMsg;
    const typeNum = String(raw.type ?? '');
    const text = String(raw.msg ?? '').trim();
    bump(kindCounts, normalizeKind(undefined, typeNum, text));
    const sid = typeof raw.sid === 'number' && Number.isFinite(raw.sid) && raw.sid !== 0 ? raw.sid : 0;
    if (sid && sid > maxSid) maxSid = sid;
    const ts = Number.isFinite(raw.ct) ? Math.round((raw.ct as number) * 1000) : NaN;
    if (!Number.isFinite(ts) || !Number.isFinite(raw.ct)) continue; // 无效时间：无法入仓只计数

    // 派生消费文本（'' = 不进时间线；条目仍全量入仓——466 / ADR-0197）
    let out = '';
    switch (raw.type) {
      case 1:
        out = text;
        break;
      case 34: {
        if (opts.previewVoice) {
          // msg 已回填转写（有正文）原样；无正文查 voice.json（wav / sid 兜底）回填；仍无 → text 空
          const tagged = text ? parseMediaTag(text) : null;
          if (tagged) {
            out = text;
            bumpEmotion(tagged.emotion);
          } else {
            const v = voiceByWav.get(String(raw.wav ?? '').trim());
            const merged = buildVoiceText(raw, v);
            const parsed = parseMediaTag(merged);
            if (parsed) {
              out = merged;
              bumpEmotion(parsed.emotion);
            }
          }
        }
        break;
      }
      case 3: {
        if (opts.imageDescMode === 'file') { // off / 旧存档 ai 回落后的兜底路径：text 空
          const hit = matchImageDesc(raw, descByFile, descByMonth, descUsed);
          if (hit) out = `[图片] ${hit}`;
        }
        break;
      }
      case 43: {
        if (opts.previewVideo) {
          const dur = Number.isFinite(raw.dur) && (raw.dur as number) > 0 ? Math.round(raw.dur as number) : 0;
          if (dur) out = `[视频 ${dur}秒]`; // 空标签 `[视频]` 无信息，不进时间线
        }
        break;
      }
      case 47: {
        signals.emojiCount++;
        if (EMOJI_NAMED_RE.test(text)) {
          out = text;
          signals.emojiNamedCount++;
        }
        break;
      }
      case 49: {
        if (text.startsWith('[分享]') || text.startsWith('[小程序]')) {
          signals.shareCount++;
          out = truncateChars(text, SHARE_MAX_CHARS);
        } else if (text.startsWith('[引用「')) {
          out = truncateQuoteHead(text);
        } else {
          out = text; // [文件] / 其余 49 形态原样进（文件名短；不丢）
        }
        break;
      }
      case 50: {
        signals.callCount++;
        const missed = missedCallReason(text);
        if (missed) {
          signals.callMissedCount++;
          out = `[未接通·${missed}]`;
          break;
        }
        const sec = parseCallDurationSec(text);
        if (sec === null) { out = text; break; } // 未知形态原样进（不丢）
        signals.callTotalSec += sec;
        out = `[${text.startsWith('[通话中断') ? '通话中断' : '通话'} ${formatCallDur(sec)}]`;
        break;
      }
      case 10000: {
        if (text.includes('撤回')) {
          if (isSelfWho(raw.who)) signals.recantByMe++;
          else signals.recantByOther++;
        }
        if (opts.keepSystem) out = text;
        break;
      }
      default:
        break; // 未知码：全量入仓、text 空（只计数不进时间线）
    }
    // 群聊：非我消息加成员名前缀（who 缺省不加）；单聊不变。
    // 系统消息（撤回等）原文自带 "名字" 归属，加前缀会双重归属，跳过；text 空不加前缀。
    if (out) {
      const who = String(raw.who ?? '').trim();
      if (group && who && !isSelfWho(who) && raw.type !== 10000) out = `[${who}] ${out}`;
      out = out.replace(/\r\n?/g, '\n');
    }
    msgs.push({
      key: msgKey(raw),
      ts,
      isSender: isSelfWho(raw.who),
      type: typeof raw.type === 'number' && Number.isFinite(raw.type) ? raw.type : 0,
      ...(raw.who !== undefined && { who: raw.who }),
      ...(sid !== 0 && { sid }),
      ...(typeof raw.dur === 'number' && Number.isFinite(raw.dur) && raw.dur > 0 && { dur: raw.dur }),
      ...(typeof raw.wav === 'string' && raw.wav && { wav: raw.wav }),
      ...(typeof raw.img === 'string' && raw.img && { img: raw.img }),
      text: out,
    });
  }
  msgs.sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
  const stats = storeStatsOf(msgs);
  const insights = computeInsights(msgs.filter((m) => m.text !== ''), signals);
  return { msgs, kindCounts, stats, insights, maxSid, skippedCount: Math.max(0, rawTotal - msgs.length) };
}

function bump(counts: Record<string, number>, kind: string): void {
  counts[kind] = (counts[kind] ?? 0) + 1;
}

/** 聊天仓消息流 → 仓统计（**只统计时间线**：text 非空的条目；媒体计数复用 445 collectMediaStats——口径单源，与改前一致） */
export function storeStatsOf(msgs: StoreMsg[]): StoreStats {
  const unified: UnifiedMessage[] = msgs
    .filter((m) => m.text !== '')
    .map((m) => ({ ts: m.ts, isSender: m.isSender, text: m.text }));
  const media = collectMediaStats(unified);
  return {
    msgCount: unified.length,
    voiceCount: media.voiceCount,
    voiceTotalSec: media.voiceTotalSec,
    imageCount: media.imageCount,
    recordingCount: media.recordingCount,
    recordingTotalSec: media.recordingTotalSec,
  };
}

// ---------------- 聊天仓合并（upsert） ----------------

/**
 * 聊天仓合并（466 upsert，取代旧 append-only）：同键新条目**整体覆盖**（派生文本升级 + 原始字段
 * 按新值更新——修「源里表情带名变了、仓里永远停在旧文本」修不回来的事故）；新键追加；仓里已有
 * 而本次没出现的条目保留（部分导出 / 留痕导入等来源不互删）。结果按 ts 升序。
 * stats 全量重算（时间线口径）；kindCounts / watermarkSid 合并取大；insights 随本次导入覆盖。
 * 返回 added = 新键条数、updated = 被覆盖条数（供导入反馈）。
 */
export function mergeStore(
  existing: StoreContact | undefined,
  incoming: NormalizeResult,
  nowIso: string
): { contact: StoreContact; added: number; updated: number } {
  const prev = new Map((existing?.msgs ?? []).map((m) => [m.key, m]));
  let added = 0;
  let updated = 0;
  for (const m of incoming.msgs) {
    if (prev.has(m.key)) updated++;
    else added++;
    prev.set(m.key, m);
  }
  const msgs = [...prev.values()].sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
  const contact: StoreContact = {
    msgs,
    watermarkSid: Math.max(existing?.watermarkSid ?? 0, incoming.maxSid),
    stats: storeStatsOf(msgs),
    // 全量形态计数 / 互动画像每次导入重算或合并覆盖（normalize 按原始消息全量跑，幂等；不随增量累加）
    kindCounts: { ...(existing?.kindCounts ?? {}), ...incoming.kindCounts },
    insights: incoming.insights,
    updatedAt: nowIso,
  };
  return { contact, added, updated };
}

/** 聊天仓 → 提炼管线消息（UnifiedMessage；**只取时间线**：`text !== ''` 这一行过滤——展示与素材组装的唯一入口） */
export function storeToUnified(msgs: StoreMsg[]): UnifiedMessage[] {
  return msgs
    .filter((m) => m.text !== '')
    .map((m) => ({ ts: m.ts, isSender: m.isSender, text: m.text }));
}

/**
 * 素材台账（issue 530：开工单要当一张「这一趟会动什么」的账单，不是孤立的三个数字）。
 * 口径逐项：
 * - `images` / `voices` = 待描述 / 待转写（与 {@link pendingMediaCounts} 完全同源，见那里的注释）；
 * - `described` = 已描述图（type 3 且 text 非空——描述已并入正文，不再进欠账）；
 * - `mediaFail` = 源图损坏 / 缺失（标了 broken / missing 终态的图：只记账、不再重试，ADR-0224 / 0225）；
 * - `total` = 仓内消息总条数（含还没描述 / 转写的媒体，给「仓内共 N 条」用）。
 * 敏感标注（sensitive）单独一档：既不算欠账、也不算损缺失（标注即终态）。
 */
export function mediaLedgerCounts(msgs: StoreMsg[]): { images: number; described: number; voices: number; mediaFail: number; total: number } {
  let images = 0;
  let described = 0;
  let voices = 0;
  let mediaFail = 0;
  for (const m of msgs) {
    if (m.type === 3) {
      const skip = descSkipOf(m);
      if (skip === BROKEN_SKIP || skip === MISSING_SKIP) mediaFail++;
      else if (!skip) {
        if (m.text !== '') described++;
        else images++;
      }
      continue;
    }
    if (m.type === 34 && m.text === '') voices++;
  }
  return { images, described, voices, mediaFail, total: msgs.length };
}

/** 待办媒体计数（issue 514：开工单只报本次真实工作量）：
 *  描述 / 转写完成后文字升级进 text，**text 空 = 还没做**（与补充素材页的未描述判定同源）。
 *  images = 未描述图片（type 3）、voices = 未转写语音（type 34）。
 *  **敏感标注的图不算欠账**（ADR-0224）：标注即终态，再计就是每次补画都重扫全库（ADR-0223 决策 6）。
 *  实现在 {@link mediaLedgerCounts}（单源：台账与待办不能各算各的）。 */
export function pendingMediaCounts(msgs: StoreMsg[]): { images: number; voices: number } {
  const l = mediaLedgerCounts(msgs);
  return { images: l.images, voices: l.voices };
}

// ---------------- prep 旁路表 → 聊天仓靶向升级（issue 469 / ADR-0197 决策 4） ----------------

/** 转写失败条目（468：工具把失败也写进 voice.json——text=`<转写失败:…>`、emotion=ERR） */
function isFailedVoice(v: VoiceItem): boolean {
  const t = String(v.text ?? '').trim();
  return String(v.emotion ?? '').trim().toUpperCase() === 'ERR' || t.startsWith('<转写失败');
}

/** 语音标签合成（仓侧升级形态；与 normalizeChatJson 的 buildVoiceText 同构，情感同表翻中文） */
function storeVoiceText(m: StoreMsg, v: VoiceItem): string {
  const durRaw = Number.isFinite(m.dur) && (m.dur as number) > 0 ? Math.round(m.dur as number) : Number(v.dur) || 0;
  const dur = durRaw > 0 ? Math.round(durRaw) : 0;
  const emo = emotionZh(String(v.emotion ?? ''));
  const text = String(v.text ?? '').trim();
  const head = dur ? `[语音 ${dur}秒${emo ? `·${emo}` : ''}]` : '[语音]';
  return text ? `${head} ${text}` : head;
}

/**
 * voice.json → 仓内语音条目的 text 靶向升级（469 / ADR-0197：合并进聊天仓的动作由插件执行）。
 * 仓内 type=34 按 wav（全路径 / 尾段文件名双键）→ sid 兜底匹配（sid 缺失时用 wav 内嵌 id 经
 * Number 量化兜底——issue 515，chat.json 导入的语音条只有受损 sid 没有 wav），text 升级为
 * `[语音 N秒·情感] 转写`（同键同值 = 幂等不重计；升级后时间线自然多出该条）。
 * previewVoice 关 = 不动 text（消费开关语义与 normalizeChatJson 一致）；转写失败条目跳过
 * （该条保持原态，重跑 prep 即补齐）。返回升级条数。
 */
export function applyVoiceToMsgs(msgs: StoreMsg[], voice: VoiceItem[], opts: { previewVoice: boolean }): number {
  if (!opts.previewVoice) return 0;
  const byWav = new Map<string, VoiceItem>();
  const bySid = new Map<number, VoiceItem>();
  for (const v of voice) {
    if (!v || isFailedVoice(v) || !String(v.text ?? '').trim()) continue;
    const wav = String(v.wav ?? '').trim();
    if (wav) {
      byWav.set(wav, v);
      const base = wav.includes('/') ? wav.slice(wav.lastIndexOf('/') + 1) : wav;
      if (base) byWav.set(base, v);
      // issue 515：voice.json 没有 sid 字段，但 wav 文件名尾段嵌着精确 server_id
      // （…_6291687660255047997.wav）。保库 sid 是同值经 JSON.parse 的精度受损版（尾位归零）——
      // 文件名 id 走一遍 Number() 得到同样的量化值，两边就能相等匹配。
      const m = /_(\d{10,})\.\w+$/.exec(base);
      if (m) {
        const q = Number(m[1]);
        if (Number.isFinite(q) && q !== 0 && !bySid.has(q)) bySid.set(q, v);
      }
    }
    const sid = typeof v.sid === 'number' && Number.isFinite(v.sid) && v.sid !== 0 ? v.sid : 0;
    if (sid) bySid.set(sid, v);
  }
  let n = 0;
  for (const m of msgs) {
    if (m.type !== 34) continue;
    let v: VoiceItem | undefined;
    const wav = String(m.wav ?? '').trim();
    if (wav) {
      v = byWav.get(wav); // 全路径键
      if (!v) {
        const base = wav.includes('/') ? wav.slice(wav.lastIndexOf('/') + 1) : wav; // 尾段名退化（chat.json 与 voice.json 路径深度不一致的防御）
        if (base) v = byWav.get(base);
      }
    }
    if (!v && m.sid) v = bySid.get(m.sid);
    if (!v) continue;
    const next = storeVoiceText(m, v);
    if (next && next !== m.text) {
      m.text = next;
      n++;
    }
  }
  return n;
}

/**
 * image_map.json → 仓内图片条目的 img 字段靶向关联（469；ADR-0197：工具只产旁路表不回写
 * chat.json，img 进仓由插件在合并时叠上）。sid 精确匹配（可覆盖已有 img——原始字段按新值
 * 更新，upsert 语义）；无 sid 的条目走 ct+type=3 秒级兜底（**只补缺**——img 已有的不再猜，
 * 防同秒误配）。返回新关联条数。
 */
export function applyImageMapToMsgs(msgs: StoreMsg[], map: ImageMapItem[]): number {
  const bySid = new Map<number, ImageMapItem>();
  const byCt = new Map<number, ImageMapItem>();
  for (const it of map) {
    if (!it || !String(it.file ?? '').trim()) continue;
    const sid = typeof it.sid === 'number' && Number.isFinite(it.sid) && it.sid !== 0 ? it.sid : 0;
    if (sid) bySid.set(sid, it);
    else if (Number.isFinite(it.ct)) byCt.set(Math.round(it.ct as number), it);
  }
  let n = 0;
  for (const m of msgs) {
    let it: ImageMapItem | undefined;
    if (m.sid) it = bySid.get(m.sid);
    if (!it && m.type === 3 && !m.img) it = byCt.get(Math.round(m.ts / 1000));
    const file = it ? String(it.file ?? '').trim() : '';
    if (file && file !== m.img) {
      m.img = file;
      n++;
    }
  }
  return n;
}

/**
 * media_fail.json → 仓内图片条目的**终态标注**（issue 521 / ADR-0225）：把「源图损坏 / 源图缺失」
 * 标成 `descSkip='broken'|'missing'`，从此不算欠账、不进描述段——不标就是每轮补画都全库重扫，
 * 卡在「点开始生成 → 全部跳过」永不收敛（与 ADR-0224 敏感标注同一个落点）。
 *
 * 四条口径：
 *   - 匹配源与 applyImageMapToMsgs 同款：sid 优先 → img 精确 → ct 秒级兜底（**只补缺**）；
 *   - **只标 text 为空的**：已有描述的图绝不抹（那是已完成态）；
 *   - 已标敏感的图不碰（AI 判定优先，撤销只走详情页显式动作，ADR-0224）；
 *   - **表即权威（自愈）**：本轮表里没有、却还标着 broken/missing 的图**清掉标注**——用户重导
 *     媒体 / 源图修好后，下一轮 prep 自动把它放回可描述队列；空表 = 权威的「全部可消费」。
 *     表**缺失**时调用方压根不调本函数（无权威不动标注，见 readPrepSidecars）。
 *
 * 返回本次标注变动条数（新标 + 清除）。
 */
export function applyMediaFailToMsgs(msgs: StoreMsg[], items: MediaFailItem[]): number {
  const bySid = new Map<number, MediaFailItem>();
  const byFile = new Map<string, MediaFailItem>();
  const byCt = new Map<number, MediaFailItem>();
  for (const it of items) {
    const reason = canonReason(it?.reason);
    if (!reason) continue; // 未知 reason 一律忽略（工具将来加新取值时，旧插件不误标）
    const entry: MediaFailItem = { ...it, reason };
    const file = String(it.file ?? '').trim();
    if (file) byFile.set(file, entry);
    const sid = typeof it.sid === 'number' && Number.isFinite(it.sid) && it.sid !== 0 ? it.sid : 0;
    if (sid) bySid.set(sid, entry);
    else if (Number.isFinite(it.ct)) byCt.set(Math.round(it.ct as number), entry);
  }
  let n = 0;
  for (const m of msgs) {
    if (m.type !== 3) continue;
    const img = String(m.img ?? '').trim();
    let it: MediaFailItem | undefined;
    if (m.sid) it = bySid.get(m.sid);
    if (!it && img) it = byFile.get(img);
    if (!it && !img) it = byCt.get(Math.round(m.ts / 1000)); // 无 img 的老场景按秒级 ct 兜底（同 applyImageMapToMsgs）
    if (it?.reason) {
      // 已有描述的、已标敏感的都不碰（前者是已完成态，后者是 AI 判定优先，ADR-0224）
      if (m.text === '' && !isDescSkipped(m)) {
        m.descSkip = it.reason as DescSkip;
        n++;
      }
    } else if (m.descSkip === BROKEN_SKIP || m.descSkip === MISSING_SKIP) {
      delete m.descSkip; // 表即权威：本轮已能消费 → 撤回终态，回到可描述队列（自愈）
      n++;
    }
  }
  return n;
}

/** reason 归一化（只认 broken / missing，其它一律 null） */
function canonReason(v: unknown): DescSkip | null {
  const s = String(v ?? '').trim();
  return s === BROKEN_SKIP ? BROKEN_SKIP : s === MISSING_SKIP ? MISSING_SKIP : null;
}

/**
 * 图片描述 → 仓内图片条目的派生 text 靶向升级（470 / ADR-0197 决策 4：描述是插件侧 AI 产物，
 * 合并进聊天仓的动作由插件执行）。按 img 精确匹配（`月/文件名`，与 image_desc.file 同格式），
 * img 没对上的条目走同月 ct 最近邻（±12h、只补缺）兜底——与 normalizeChatJson 的
 * matchImageDesc 同一匹配口径。**只升级 text 为空的条目**（描述已并仓的不重写；跳过语义 =
 * 该条保持空文本不进时间线），文本形态 `[图片] 描述`，空描述跳过。幂等：同键同值不重复计数。
 * 返回升级条数。
 */
export function applyImageDescToMsgs(msgs: StoreMsg[], descs: ImageDescItem[]): number {
  const byFile = new Map<string, ImageDescItem>();
  const byMonth = new Map<string, ImageDescItem[]>();
  // items 里**明示了 file 但没有描述**的图（ADR-0224）：它们的「空」是「本轮确实没拿到」，
  // 不是「调用方没提这张」——不能被下面的最近邻兜底借走邻居的描述，否则一张失败 / 被拒的图
  // 会顶着别人的描述进时间线。最近邻只服务「旁路表只给 ct 不给 file」的老场景。
  const explicitBlank = new Set<string>();
  for (const it of descs) {
    if (!it || typeof it !== 'object') continue;
    const file = String(it.file ?? '').trim();
    if (!String(it.desc ?? '').trim()) {
      if (file) explicitBlank.add(file);
      continue;
    }
    if (file) byFile.set(file, it);
    const month = file.includes('/') ? file.slice(0, file.indexOf('/')) : monthOf(Number(it.ct));
    if (!month) continue;
    let list = byMonth.get(month);
    if (!list) { list = []; byMonth.set(month, list); }
    list.push(it);
  }
  for (const list of byMonth.values()) list.sort((a, b) => (Number(a.ct) || 0) - (Number(b.ct) || 0));
  const used = new Set<string>(); // 最近邻消费防串：一张描述只配一条消息
  let n = 0;
  for (const m of msgs) {
    // 已标注敏感的图跳过：标注是终态，不该被后来的旁路表兜底（readContactBundle 的 extras 通道）
    // 悄悄覆盖成有描述——撤销只走详情页的显式动作（ADR-0224）
    if (m.type !== 3 || m.text !== '' || isDescSkipped(m)) continue;
    const img = String(m.img ?? '').trim();
    const ctSec = Math.round(m.ts / 1000);
    let desc = '';
    const exact = img ? byFile.get(img) : undefined;
    if (exact) {
      desc = String(exact.desc ?? '').trim();
    } else if (img && explicitBlank.has(img)) {
      // 明示无描述：留空待补，不借邻居（ADR-0224）
    } else {
      const list = byMonth.get(monthOf(ctSec));
      if (list?.length) {
        let best: ImageDescItem | null = null;
        let bestDiff = Infinity;
        for (const it of list) {
          const ict = Number(it.ct);
          if (!Number.isFinite(ict)) continue;
          const diff = Math.abs(ict - ctSec);
          if (diff < bestDiff) { bestDiff = diff; best = it; }
        }
        if (best && bestDiff <= IMG_DESC_NEAREST_SEC) {
          const key = String(best.file ?? '').trim() || `ct:${Number(best.ct)}`;
          if (!used.has(key)) {
            used.add(key);
            desc = String(best.desc ?? '').trim();
          }
        }
      }
    }
    if (desc && m.text !== `[图片] ${desc}`) {
      m.text = `[图片] ${desc}`;
      n++;
    }
  }
  return n;
}

/**
 * 敏感标注写入（ADR-0224 决策 3）：把被判敏感拒绝的图片消息标上 `descSkip = 'sensitive'`，
 * 返回标注条数。三条口径：
 *   - 按 `img` **精确匹配**（不用 applyImageDescToMsgs 的最近邻兜底）——标注是不可重跑的终态，
 *     宁可少标也不能标错人；
 *   - 已有描述（text 非空）的一律不碰，绝不把一条已经画好的时间线抹成空；
 *   - 已标注过的跳过（幂等，重复标注不重复计数）。
 */
export function applySensitiveSkipsToMsgs(msgs: StoreMsg[], files: string[]): number {
  const want = new Set<string>();
  for (const f of files) {
    const v = String(f ?? '').trim();
    if (v) want.add(v);
  }
  if (!want.size) return 0;
  let n = 0;
  for (const m of msgs) {
    if (m.type !== 3 || m.text !== '') continue;
    if (isDescSkipped(m)) continue;
    const img = String(m.img ?? '').trim();
    if (!img || !want.has(img)) continue;
    m.descSkip = SENSITIVE_SKIP;
    n++;
  }
  return n;
}

// 447 退役：shouldGenerate 自动生成触发判定随自动链路一并移除——
// 画脸谱一律由数据源弹窗「画脸谱」手动触发（无门槛，选了就画）。

// ---------------- 补充素材·录音轮次 → 聊天仓（issue 509 / ADR-0212、0213） ----------------

/** 录音分离管线 sidecar 的一条话轮（rec_slide_hmm.py 产 .turns.json 的 turns[] 元素） */
export interface RecordingTurn {
  /** 轮内起止偏移（秒，相对录音开头） */
  start: number;
  end: number;
  /** 分离归属：「我」/ 联系人名 /「其他」（**旁音**——不属于本对话两人的第三人语音，
   *  留账不进仓，ADR-0216）/「?」（两质心分不开）；质心降级（me-only / blind）时为 说话人0/1 */
  speaker: string;
  /** SenseVoice 情感标签（中文；缺省文本不带情感段） */
  emotion?: string;
  /** 逐轮转写文本（空轮不进仓） */
  text: string;
  /** 轮级平均 |llr|（诊断值，不进仓） */
  meanAbsLlr?: number;
}

/** 单条录音的轮次并仓入参 */
export interface RecordingTurnsInput {
  /** 录音原文件名（recordings/ 下的键；key 前缀 `rec:<file>:` 由此而来） */
  file: string;
  /** 录音起点毫秒 ts（文件名解析优先 → mtime 回落，页内可改后的值） */
  ts: number;
  turns: RecordingTurn[];
}

/** 录音轮次文本：`[录音 3分02秒·平静] 转写`（与 `[语音 N秒·情感]` 同构；无情感不带段） */
export function buildRecordingText(t: { durSec: number; emotion?: string; text: string }): string {
  const head = `[录音 ${formatRecordingDuration(t.durSec)}${String(t.emotion ?? '').trim() ? `·${String(t.emotion).trim()}` : ''}]`;
  const body = String(t.text ?? '').trim();
  return body ? `${head} ${body}` : head;
}

/** 旁音轮的 speaker 字面值（bz-face rec 产出，ADR-0216）——不属于本对话两人的第三人语音，**留账不进仓** */
export const SIDE_SPEECH_SPEAKER = '其他';

/** 录音段落：连续同一说话人的轮次合并成一条聊天仓消息（ADR-0220，进仓单位） */
export interface RecordingSegment {
  /** 段首轮 start（秒，相对录音开头） */
  start: number;
  /** 段末轮 end（秒） */
  end: number;
  /** 说话人（段内一致） */
  speaker: string;
  /** 段内各轮情感**全一致**才带；不一致省略（不拿众数冒充） */
  emotion?: string;
  /** 段内各轮文本按序直连（无分隔符，与单轮同构） */
  text: string;
}

/**
 * 轮次 → 段落（ADR-0220）：**只按说话人连续性**断段（无时间间隔阈值——用户明示）。
 * - 旁音轮（`其他`）不进仓，且被识别为不同说话人 → **天然断开**前后同人的段落；
 * - `?` 不确定轮口径不动（照旧进仓落对方侧），它同样是"另一个人" → 同样断段；
 * - **空转写轮**（静音 / 转写失败）不输出，且**不断开**（同一说话人，只是没转出文本）。
 */
export function segmentRecordingTurns(turns: RecordingTurn[]): RecordingSegment[] {
  const segs: RecordingSegment[] = [];
  let cur: RecordingSegment | null = null;
  for (const t of turns ?? []) {
    const speaker = String(t?.speaker ?? '').trim();
    if (!speaker || speaker === SIDE_SPEECH_SPEAKER) {
      cur = null; // 旁音（或归属缺失）：不进仓，且断开前后段落
      continue;
    }
    const body = String(t?.text ?? '').trim();
    if (!body) continue; // 空转写轮：不输出也不断段
    const start = Number.isFinite(t?.start) ? Math.max(0, Number(t.start)) : 0;
    const end = Number.isFinite(t?.end) ? Math.max(start, Number(t.end)) : start;
    const emotion = String(t?.emotion ?? '').trim() || undefined;
    if (cur && cur.speaker === speaker) {
      cur.end = Math.max(cur.end, end);
      cur.text += body;
      if (cur.emotion !== emotion) cur.emotion = undefined; // 有一轮不同 / 缺 → 整段省略情感
    } else {
      cur = { start, end, speaker, ...(emotion ? { emotion } : {}), text: body };
      segs.push(cur);
    }
  }
  return segs;
}

/**
 * 逐轮 → 所在段序 + 段首标记（ADR-0220 §7；`turns.md` 与「查看轮次」共用的**段界单源**）。
 * 判据与 `segmentRecordingTurns` 逐字一致（改一处必须改两处——单测锁住两者同构）：
 * 旁音轮 / 空转写轮**不属于任何段**（seg = 0）；空转写轮**不断段**（透明穿过去），
 * 旁音轮与说话人变化都**开新段**。`head = true` 只出现在段首轮上。
 */
export function recordingTurnSegments(turns: RecordingTurn[]): Array<{ seg: number; head: boolean }> {
  const out: Array<{ seg: number; head: boolean }> = [];
  let curSpeaker = '';
  let seg = 0;
  for (const t of turns ?? []) {
    const speaker = String(t?.speaker ?? '').trim();
    if (!speaker || speaker === SIDE_SPEECH_SPEAKER) {
      curSpeaker = ''; // 旁音 / 归属缺失：断段，自己不成段
      out.push({ seg: 0, head: false });
      continue;
    }
    if (!String(t?.text ?? '').trim()) {
      out.push({ seg: 0, head: false }); // 空转写轮：不成段、也不断段（curSpeaker 不动）
      continue;
    }
    if (curSpeaker !== speaker) {
      seg += 1;
      curSpeaker = speaker;
      out.push({ seg, head: true });
    } else {
      out.push({ seg, head: false });
    }
  }
  return out;
}

/**
 * 录音轮次 → 聊天仓消息（509；ADR-0212/0213 合并由插件执行，插件是聊天仓唯一写入者；
 * **进仓单位 = 录音段落**，ADR-0220）。
 * 每**段**（连续同一说话人的轮次合并）一条 type=9001 消息：key = `rec:<file>:s<段序>`，
 * ts = 录音起点 + 段首轮偏移，isSender 按「我」归属（其余一律对方侧），
 * text = `[录音 N分NN秒·情感] 段文本`（旁音轮与空转写轮不进仓）。
 * 同录音重跑幂等：先按 `rec:<file>:` 前缀清旧再追加（重跑后分段可能变）。
 * 返回新消息流（ts 升序）、追加 added 条与清掉的 removed 条（kindCounts 取净增量 added − removed）。
 */
export function applyRecordingTurnsToMsgs(msgs: StoreMsg[], rec: RecordingTurnsInput): { msgs: StoreMsg[]; added: number; removed: number } {
  const file = String(rec?.file ?? '').trim();
  if (!file) return { msgs: [...msgs], added: 0, removed: 0 };
  const base = Number.isFinite(rec.ts) ? Math.round(rec.ts) : 0;
  const prefix = `rec:${file}:`;
  const out = msgs.filter((m) => !m.key.startsWith(prefix));
  const removed = msgs.length - out.length;
  let added = 0;
  segmentRecordingTurns(rec.turns ?? []).forEach((seg, i) => {
    const durSec = Math.max(1, Math.round(seg.end - seg.start)); // 段跨度（末轮 end − 首轮 start）
    out.push({
      key: `${prefix}s${i}`,
      ts: base + Math.round(seg.start * 1000),
      isSender: seg.speaker === '我',
      type: 9001,
      dur: durSec,
      text: buildRecordingText({ durSec, emotion: seg.emotion, text: seg.text }),
    });
    added++;
  });
  out.sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
  return { msgs: out, added, removed };
}

// ---------------- 设置读取（预览组快照） ----------------

/** 读 people 预览组设置（非法值回落默认；data 层唯一读设置点，编排层传 opts 给纯函数）。
 *  'ai' 为 449 前的假开关遗留值，回落 'file'（描述兜底照常生效）。 */
export function normalizeOptionsFromSettings(): NormalizeOptions {
  const s = (tryGetSettings() ?? {}) as Record<string, unknown>;
  const mode = String(s.peopleImageDescMode ?? 'file');
  return {
    previewVoice: s.peoplePreviewVoice !== false,
    imageDescMode: mode === 'off' ? 'off' : 'file',
    previewVideo: s.peoplePreviewVideo !== false,
    keepSystem: s.peopleKeepSystem !== false,
  };
}

// ---------------- IO：数据目录（vault 外，仅桌面端） ----------------

function getFs(): any {
  const w = window as any;
  if (!w || !w.require) return null;
  try { return w.require('fs'); } catch { return null; }
}

/**
 * sync 轮统计（issue 485；工具侧 bz_sync.py contact_stats 同字段）：
 * SQL 聚合口径（消息 / 语音 / 图片为原始条数，语音时长秒，最新消息时间与最大 sid，
 * 是否群聊由工具按「去我之外多个发送者」判定）。扫描优先读它——sync 不再产出 chat.json。
 */
export interface DataSourceStats {
  /** 消息条数（近似 export_flow 的 label 命中面：类型白名单 + 非空系统消息） */
  msgs: number;
  /** 语音条数（原始口径，不随插件预览开关变） */
  voices: number;
  /** 图片条数 */
  images: number;
  /** 语音总时长（秒） */
  voiceSec: number;
  /** 最新消息时间（秒级 ct；0 = 无） */
  lastCt: number;
  /** 已见最大 sid（532 起不再作「有无新消息」判定源——server_id 与时间无序，判据改走 lastCt） */
  maxSid: number;
  /** 群聊（工具侧判定：去我之外多个发送者） */
  group: boolean;
  /** 本轮统计落盘时间（工具写入；仅排查用） */
  syncedAt?: string;
}

/**
 * 目录名 → 界面显示名（issue 501）：sync 落目录时给重名联系人加的唯一键后缀
 * `名字 (wxid_…)` / `名字 (m754831096)` / `名字 (xxx@weclaw)` 只用于**目录唯一**，
 * 不该进用户视野——面板、数据源列表、同步进度一律显示纯名（重名就并排同名）。
 * 只剥「括号里长得像联系人 id」的那种后缀：真名叫「小明 (同学)」不受影响。
 * 目录名本身仍是聊天仓键 / PersonEntry.id，不因显示名而变。
 */
export function plainNameOf(dirName: string): string {
  const m = /^(.*?)\s*[(（]([^()（）]*)[)）]\s*$/.exec(dirName);
  if (!m) return dirName;
  const inner = m[2].trim();
  const looksLikeId = /^wxid_/i.test(inner) || inner.includes('@') || /^m\d{5,}$/.test(inner);
  if (!looksLikeId) return dirName;
  return m[1].trim() || dirName;
}

/** 数据目录里含 chat.json 或 stats.json 的联系人目录名（按名字序；目录不存在返回空）。
 *  485：sync 轮只产 stats.json，chat.json 是 export 轮按需产物——两者任一即视为联系人目录。 */
export function listContactDirs(dataDir: string): string[] {
  const fs = getFs();
  if (!fs || !dataDir) return [];
  try {
    return fs
      .readdirSync(dataDir, { withFileTypes: true })
      .filter((d: any) => d.isDirectory())
      .map((d: any) => String(d.name))
      .filter((name: string) => {
        try {
          return fs.existsSync(`${dataDir}/${name}/chat.json`) || fs.existsSync(`${dataDir}/${name}/stats.json`);
        } catch { return false; }
      })
      .sort((a: string, b: string) => a.localeCompare(b, 'zh'));
  } catch {
    return [];
  }
}

/** 联系人目录下是否有全量消息文件（chat.json）——「导入所选」免重复导出的判定源（485） */
export function hasChatJson(dataDir: string, name: string): boolean {
  const fs = getFs();
  if (!fs || !dataDir || !name) return false;
  try {
    return fs.existsSync(`${dataDir}/${name}/chat.json`);
  } catch {
    return false;
  }
}

/**
 * 读一位联系人的 sync 轮统计（stats.json；485）。字段齐全且类型正确才认——
 * 读失败 / 形状不对返回 null（调用方回落读 chat.json 兼容存量）。
 */
export function readStatsJson(dataDir: string, name: string): DataSourceStats | null {
  const fs = getFs();
  if (!fs || !dataDir || !name) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(fs.readFileSync(`${dataDir}/${name}/stats.json`, 'utf8')).replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const num = (v: unknown): number => (Number.isFinite(v) ? (v as number) : 0);
  if (!Number.isFinite(o.msgs)) return null; // 主字段缺失 = 不是本工具产的 stats.json
  return {
    msgs: num(o.msgs),
    voices: num(o.voices),
    images: num(o.images),
    voiceSec: num(o.voiceSec),
    lastCt: num(o.lastCt),
    maxSid: num(o.maxSid),
    group: o.group === true,
    ...(typeof o.syncedAt === 'string' && o.syncedAt ? { syncedAt: o.syncedAt } : {}),
  };
}

/**
 * stats.json 是否比聊天仓有更新的源数据（issue 532：「有更新」角标与导入要不要重导
 * chat.json 的共同判定源）。判据 = lastCt（源里最新一条消息的秒级 ct）对比仓内最后一条
 * **聊天**消息的 ts。不能用 maxSid 对 watermarkSid：server_id 与时间无序（实测 2026-03
 * 的消息 sid 大过 2026-09 的全部新消息，且按期分库后各库各有各的大 sid），旧判据永远
 * 命不中「有更新」，同步完导入也就永远 0 新增。排除 type=9001（录音轮次段——ts 取自
 * 录音文件起点，可以比任何聊天消息都晚，不排会把新聊天遮住）。stats 没消息（lastCt=0）
 * 恒 false：源里没有东西，无谓重导。
 */
export function statsHasNewerData(stats: DataSourceStats, store: StoreContact | undefined): boolean {
  if (!(stats.lastCt > 0)) return false;
  const msgs = store?.msgs;
  let last = 0;
  if (msgs) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].type !== 9001) {
        last = msgs[i].ts;
        break;
      }
    }
  }
  return stats.lastCt * 1000 > last;
}

/** 读一个联系人的数据束（chat.json 必读；voice.json / image_desc.json 为兼容兜底——
 *  正常情况 chat.json 已回填转写与 img 关联，单文件即可，缺回填的旧数据目录才靠这两张表补齐）；
 *  读失败 / 不是数组返回 null */
export function readContactBundle(
  dataDir: string,
  name: string
): { raws: RawChatMsg[]; voice: VoiceItem[]; imageDesc: ImageDescItem[]; avatar: string | null } | null {
  const fs = getFs();
  if (!fs) return null;
  const readJson = (path: string): unknown[] | null => {
    try {
      const parsed = JSON.parse(String(fs.readFileSync(path, 'utf8')).replace(/^\uFEFF/, ''));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  const raws = readJson(`${dataDir}/${name}/chat.json`);
  if (!raws) return null;
  return {
    raws: raws as RawChatMsg[],
    voice: (readJson(`${dataDir}/${name}/voice.json`) as VoiceItem[]) ?? [],
    imageDesc: (readJson(`${dataDir}/${name}/image_desc.json`) as ImageDescItem[]) ?? [],
    avatar: avatarFileOf(fs, `${dataDir}/${name}`),
  };
}

/** 头像文件扩展名探测序（数据目录 avatar.<ext> 同序） */
const AVA_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/** 联系人目录里的头像文件（avatar.<扩展名>，按序探测；绝对路径，缺省 null） */
function avatarFileOf(fs: any, dir: string): string | null {
  for (const ext of AVA_EXTS) {
    const p = `${dir}/avatar.${ext}`;
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* 探测失败按无头像 */ }
  }
  return null;
}

/** 只读一位联系人的头像路径（stats 路径扫描用——不读 chat.json 也能出头像预览；485） */
export function readContactAvatarPath(dataDir: string, name: string): string | null {
  const fs = getFs();
  if (!fs || !dataDir || !name) return null;
  return avatarFileOf(fs, `${dataDir}/${name}`);
}

// ---------------- IO：头像字节（467：保库记录附件的源读取；不再复制进库内明文目录） ----------------

/**
 * 库外头像文件 → base64（数据源导入写保库记录附件、扫描行预览共用）。
 * 仅接受 avatar.<已知扩展名>；文件缺失 / 类型不符 / 读不动返回 null。纯 fs 读取，不写库。
 */
export function readAvatarInput(absolutePath: string | null | undefined): AvatarInput | null {
  const fs = getFs();
  const p = String(absolutePath ?? '').trim();
  if (!fs || !p) return null;
  let srcExt = '';
  try {
    if (!fs.existsSync(p)) return null;
    srcExt = String(p.split('.').pop() ?? '').toLowerCase();
  } catch {
    return null;
  }
  if (!AVA_EXTS.includes(srcExt)) return null;
  try {
    const buf = fs.readFileSync(p) as Uint8Array;
    if (!buf || !buf.length) return null;
    return { base64: bytesToBase64Of(buf), ext: srcExt };
  } catch {
    return null;
  }
}

/** Uint8Array → base64（分块；与 encrypt/data.bytesToBase64 同实现——不引域外运行时依赖） */
function bytesToBase64Of(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(bin);
}

// ---------------- 旧明文通道（已退役，类型与空结构仅供迁移 / 测试引用） ----------------
// people-preview.json 明文落盘（MessageStore / getStoreFilePath）与库内媒体文件夹
// （peopleMediaDir / importAvatarToVault）随 467 / ADR-0194 一并退役：聊天仓与头像
// 现在都活在保库记录里（safe-store.ts）。

/** 聊天仓统计 → 445 徽章口径（零素材返回 null 不渲染） */
export function storeMediaBadge(stats: StoreStats | undefined): MediaStats | null {
  if (!stats) return null;
  const acc = emptyMediaStats();
  acc.voiceCount = stats.voiceCount ?? 0;
  acc.voiceTotalSec = stats.voiceTotalSec ?? 0;
  acc.imageCount = stats.imageCount ?? 0;
  return acc.voiceCount || acc.imageCount ? acc : null;
}
