/**
 * 脸谱数据源层（issue 446 / 449）：消费微信全模态预处理管线（skill wechat-media-preprocess）的
 * 按联系人数据文件夹——`<数据根>/<联系人>/chat.json`（消息流 [{ct,type,who,msg,sid,dur,wav,img?}]，
 * 语音已回填 `[语音 N秒·情感] 文本`、图片可带 img:"月/文件" 字段、表情开始回填 `[表情·名]`）。
 * `voice.json` / `image_desc.json` 为**兼容兜底**（正常情况 chat.json 已回填，单文件即可；
 * 旧数据目录缺回填时仍按 wav / img 关联补齐）。
 *
 * 449 语义分流（不再丢弃）：47 表情按命名分流、49 分享/文件/引用逐条进时间线（带截断上限）、
 * 50 通话换轻标签；无转写语音 / 无描述图片 / 关开关的媒体**不进时间线只计数**。
 * 群聊（多位非我发送者）非我消息加 `[成员名] ` 前缀，单聊不变。
 *
 * 两段增量：
 * - 原始→预览（本层）：4.x 原始码消息归一成「type:1 文本形态」预览条目（与 445 导出契约一致，
 *   媒体按设置开关合成标签文本），按替代键（sid / ct+msg 哈希）只补新消息，落
 *   CONFIG/STORAGE/people-preview.json（vault 内、纯文本——语音转写与图片描述以文本进预览，
 *   原始媒体不入库不复制）。预览桶结构 { version, contacts: { <名>: { msgs, watermarkSid, stats, insights } } }。
 *   顺带产出互动画像汇总 insights（insights.ts，供提炼 prompt 的「互动统计」素材段）。
 * - 预览→脸谱：由 ui 层接既有 digest / planIncremental 增量管线（441 机制不动），本层不管。
 *
 * 纯函数（normalizeChatJson / mergePreview 等）与 IO（fs 读数据目录、PreviewStore）分离：
 * 核心判定全部可单测，fs 仅桌面端可得（window.require，knowledge 同款）。
 */
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import { collectMediaStats, parseMediaTag, emptyMediaStats, type MediaStats } from './media';
import { normalizeKind } from './parse';
import { computeInsights, emptyInsightSignals, type InsightsSummary } from './insights';
import type { UnifiedMessage } from './types';

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
  dur?: number;
  text?: string;
  emotion?: string;
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

/** 一条预览消息（type:1 文本形态；key = 增量替代键） */
export interface PreviewMsg {
  key: string;
  /** 毫秒时间戳 */
  ts: number;
  isSender: boolean;
  text: string;
}

/** 预览桶统计（落盘口径；媒体数 = 合成后文本按 445 parseMediaTag 的素材计数） */
export interface PreviewStats {
  msgCount: number;
  voiceCount: number;
  voiceTotalSec: number;
  imageCount: number;
}

/** 一位联系人的预览桶 */
export interface PreviewContact {
  msgs: PreviewMsg[];
  /** 已收最大 sid（展示参考；增量判定以 msgs 的 key 集合为准） */
  watermarkSid: number;
  stats: PreviewStats;
  /**
   * chat.json 全量形态计数（440 中文形态键；每次导入按原始消息全量重算覆盖，幂等）。
   * 预览条目已是文本形态、无法从桶内反推（系统消息原文无标签），故随桶落盘供生成管线复用。
   */
  kindCounts?: Record<string, number>;
  /** 互动画像汇总（449；normalize 全量重算覆盖。旧桶无此字段照常读） */
  insights?: InsightsSummary;
  /** 最近一次导入时间 ISO */
  updatedAt: string;
}

/** people-preview.json 根结构 */
export interface PreviewData {
  version: 1;
  contacts: Record<string, PreviewContact>;
}

export function emptyPreviewData(): PreviewData {
  return { version: 1, contacts: {} };
}

export function emptyPreviewStats(): PreviewStats {
  return { msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 };
}

export interface NormalizeResult {
  msgs: PreviewMsg[];
  /** 全形态计数（含被开关过滤掉的消息；与既有 parse 层 kindCounts 同口径） */
  kindCounts: Record<string, number>;
  stats: PreviewStats;
  /** 互动画像汇总（449；过滤后时间线现算 + 语义信号计数） */
  insights: InsightsSummary;
  /** 原始消息里的最大有效 sid */
  maxSid: number;
  /** 原始条数 − 进预览条数（非文本 / 无效时间 / 预览开关关闭丢弃等；导入记录 skippedCount 口径） */
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
 * chat.json → 预览消息流（纯函数，issue 449 语义分流）。媒体按开关合成 type:1 文本形态：
 * - 1 文本：原样（msg 以媒体标签开头的按 445 parseMediaTag 走媒体素材统计）；
 * - 34 语音：previewVoice 开 → msg 已回填转写则原样，无转写正文查 voice.json（wav 关联）回填，
 *   仍无 → 不进时间线只计数（449 起删掉 `[语音]` 空标签行）；关 → 只计数；
 * - 3 图片：imageDescMode='file' → 按 img 字段精确对上 image_desc（img 缺失走同月 ct 最近邻 ±12h
 *   兜底，一张描述只配一条消息）→ `[图片] 描述`；未命中 / 'off' → 不进时间线只计数（删掉空标签）；
 * - 43 视频：previewVideo 开且有时长 → `[视频 N秒]`；无时长或关 → 只计数（空标签不进时间线）；
 * - 47 表情：`[表情·名]` 原样进时间线计 emojiNamedCount；纯 `[表情]` 只计数；
 * - 49：`[分享]`/`[小程序]` 截断 ≤80 字进（shareCount）；`[文件]` 原样进；
 *   `[引用「…」]` 引用头超 60 字截断补 `…」`，回复保留；其余形态原样进（不丢）；
 * - 50 通话：`[通话时长 H:M:S]` → `[通话 H时M分]`（不足 1 时 M分N秒 / 不足 1 分 N秒）、
 *   `[通话中断 …]` 同款换算、未接通类 → `[未接通·原因原文]`；未知形态原样进；
 * - 10000 系统：keepSystem 开 → 原样保留；关 → 只计数；msg 含「撤回」按 who 归属计 recant（不受开关影响）；
 * - 其余未知码：丢弃只计数。
 * 群聊（多位非我发送者）非我消息 text 前加 `[成员名] ` 前缀（系统消息除外，原文自带归属），单聊不变。
 * 空文本 / 非对象元素同样只计数。结果按 ts 升序。insights 随过滤后时间线现算。
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
  const msgs: PreviewMsg[] = [];
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
    if (!Number.isFinite(ts) || !Number.isFinite(raw.ct)) continue; // 无效时间：只计数

    let out: string | null = null;
    switch (raw.type) {
      case 1:
        out = text || null; // 纯空文本不进
        break;
      case 34: {
        if (!opts.previewVoice) continue;
        // msg 已回填转写（有正文）原样；无正文查 voice.json（wav / sid 兜底）回填；仍无 → 只计数
        const tagged = text ? parseMediaTag(text) : null;
        if (tagged) {
          out = text;
          bumpEmotion(tagged.emotion);
          break;
        }
        const v = voiceByWav.get(String(raw.wav ?? '').trim());
        const merged = buildVoiceText(raw, v);
        const parsed = parseMediaTag(merged);
        if (!parsed) continue; // 无转写正文：不进时间线只计数（449 删空标签行）
        out = merged;
        bumpEmotion(parsed.emotion);
        break;
      }
      case 3: {
        if (opts.imageDescMode !== 'file') continue; // off / 旧存档 ai 回落后的兜底路径：只计数
        const hit = matchImageDesc(raw, descByFile, descByMonth, descUsed);
        out = hit ? `[图片] ${hit}` : null; // 未命中：不进时间线只计数（449 删空标签行）
        break;
      }
      case 43: {
        if (!opts.previewVideo) continue;
        const dur = Number.isFinite(raw.dur) && (raw.dur as number) > 0 ? Math.round(raw.dur as number) : 0;
        if (!dur) continue; // 空标签 `[视频]` 无信息，不进时间线只计数（与 [图片]/[语音] 同口径）
        out = `[视频 ${dur}秒]`;
        break;
      }
      case 47: {
        signals.emojiCount++;
        if (!EMOJI_NAMED_RE.test(text)) continue; // 纯 [表情] / 未命名：只计数
        out = text;
        signals.emojiNamedCount++;
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
        if (sec === null) { out = text || null; break; } // 未知形态原样进（不丢）
        signals.callTotalSec += sec;
        out = `[${text.startsWith('[通话中断') ? '通话中断' : '通话'} ${formatCallDur(sec)}]`;
        break;
      }
      case 10000: {
        if (text.includes('撤回')) {
          if (isSelfWho(raw.who)) signals.recantByMe++;
          else signals.recantByOther++;
        }
        if (!opts.keepSystem) continue;
        out = text || null;
        break;
      }
      default:
        continue; // 未知码：丢弃只计数
    }
    if (!out) continue;
    // 群聊：非我消息加成员名前缀（who 缺省不加）；单聊不变。
    // 系统消息（撤回等）原文自带 "名字" 归属，加前缀会双重归属，跳过
    const who = String(raw.who ?? '').trim();
    if (group && who && !isSelfWho(who) && raw.type !== 10000) out = `[${who}] ${out}`;
    msgs.push({ key: msgKey(raw), ts, isSender: isSelfWho(raw.who), text: out.replace(/\r\n?/g, '\n') });
  }
  msgs.sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
  const stats = previewStatsOf(msgs);
  const insights = computeInsights(msgs, signals);
  return { msgs, kindCounts, stats, insights, maxSid, skippedCount: Math.max(0, rawTotal - msgs.length) };
}

function bump(counts: Record<string, number>, kind: string): void {
  counts[kind] = (counts[kind] ?? 0) + 1;
}

/** 预览消息流 → 桶统计（媒体计数复用 445 collectMediaStats——口径单源） */
export function previewStatsOf(msgs: PreviewMsg[]): PreviewStats {
  const unified: UnifiedMessage[] = msgs.map((m) => ({ ts: m.ts, isSender: m.isSender, text: m.text }));
  const media = collectMediaStats(unified);
  return { msgCount: msgs.length, voiceCount: media.voiceCount, voiceTotalSec: media.voiceTotalSec, imageCount: media.imageCount };
}

// ---------------- 预览桶增量合并 ----------------

/**
 * 增量合并（重导同一人不产生重复条目）：按 key 过滤已收条目只补新消息，ts 升序合并；
 * stats / watermarkSid 全量重算（媒体计数与 445 落盘口径一致）。
 * 返回新增条数（供触发判定与反馈文案）。
 */
export function mergePreview(
  existing: PreviewContact | undefined,
  incoming: NormalizeResult,
  nowIso: string
): { contact: PreviewContact; added: number } {
  const seen = new Set((existing?.msgs ?? []).map((m) => m.key));
  const fresh = incoming.msgs.filter((m) => !seen.has(m.key));
  const msgs = [...(existing?.msgs ?? []), ...fresh].sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
  const contact: PreviewContact = {
    msgs,
    watermarkSid: Math.max(existing?.watermarkSid ?? 0, incoming.maxSid),
    stats: previewStatsOf(msgs),
    // 全量形态计数 / 互动画像每次导入重算覆盖（normalize 按原始消息全量跑，幂等；不随增量累加）
    kindCounts: { ...(existing?.kindCounts ?? {}), ...incoming.kindCounts },
    insights: incoming.insights,
    updatedAt: nowIso,
  };
  return { contact, added: fresh.length };
}

/** 预览桶 → 提炼管线消息（UnifiedMessage；文本即 type:1 形态） */
export function previewToUnified(msgs: PreviewMsg[]): UnifiedMessage[] {
  return msgs.map((m) => ({ ts: m.ts, isSender: m.isSender, text: m.text }));
}

// 447 退役：shouldGenerate 自动生成触发判定随自动链路一并移除——
// 画脸谱一律由数据源弹窗「画脸谱」手动触发（无门槛，选了就画）。

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

/** 数据目录里含 chat.json 的联系人目录名（按名字序；目录不存在返回空） */
export function listContactDirs(dataDir: string): string[] {
  const fs = getFs();
  if (!fs || !dataDir) return [];
  try {
    return fs
      .readdirSync(dataDir, { withFileTypes: true })
      .filter((d: any) => d.isDirectory())
      .map((d: any) => String(d.name))
      .filter((name: string) => {
        try { return fs.existsSync(`${dataDir}/${name}/chat.json`); } catch { return false; }
      })
      .sort((a: string, b: string) => a.localeCompare(b, 'zh'));
  } catch {
    return [];
  }
}

/** 读一个联系人的数据束（chat.json 必读；voice.json / image_desc.json 为兼容兜底——
 *  正常情况 chat.json 已回填转写与 img 关联，单文件即可，缺回填的旧数据目录才靠这两张表补齐）；
 *  读失败 / 不是数组返回 null */
export function readContactBundle(
  dataDir: string,
  name: string
): { raws: RawChatMsg[]; voice: VoiceItem[]; imageDesc: ImageDescItem[] } | null {
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
  };
}

// ---------------- IO：people-preview.json（vault 内） ----------------

/** 预览桶文件路径（storagePath 设置键可覆盖基目录，缺省 CONFIG/STORAGE） */
export function getPreviewFilePath(): string {
  const s = tryGetSettings() as { storagePath?: string } | null;
  return storageFile('people-preview.json', (s && s.storagePath) || 'CONFIG/STORAGE');
}

/** 预览桶读写（jsonFileStore + 串行写队列，PeopleStore 同款防并发覆盖） */
export class PreviewStore {
  private readonly app: unknown;
  private readonly filePath: string;

  constructor(app: unknown) {
    this.app = app;
    this.filePath = getPreviewFilePath();
  }

  private open() {
    return jsonFileStore<PreviewData>(this.filePath, { defaultValue: emptyPreviewData, app: this.app });
  }

  async read(): Promise<PreviewData> {
    return enqueueFileTask(this.filePath, async () => this.open().read());
  }

  /** 合并写回一位联系人（读→改→写整体入队） */
  async upsertContact(name: string, contact: PreviewContact): Promise<void> {
    await enqueueFileTask(this.filePath, async () => {
      const store = this.open();
      const data = await store.read();
      data.contacts[name] = contact;
      await store.write(data);
    });
  }

  /** 清空全部预览（保留文件框架；不动 people.json 的 PersonEntry） */
  async clear(): Promise<void> {
    await enqueueFileTask(this.filePath, async () => {
      const store = this.open();
      await store.write(emptyPreviewData());
    });
  }
}

/** 预览桶媒体统计 → 445 徽章口径（零素材返回 null 不渲染） */
export function previewMediaBadge(stats: PreviewStats | undefined): MediaStats | null {
  if (!stats) return null;
  const acc = emptyMediaStats();
  acc.voiceCount = stats.voiceCount ?? 0;
  acc.voiceTotalSec = stats.voiceTotalSec ?? 0;
  acc.imageCount = stats.imageCount ?? 0;
  return acc.voiceCount || acc.imageCount ? acc : null;
}
