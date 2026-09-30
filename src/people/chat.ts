/**
 * 会话流展示层（issue 529）：聊天仓消息 → 聊天页 / 录音「查看轮次」共用的展示行。
 *
 * 纯逻辑（无 DOM、无 obsidian、只 type-only 依赖 datasource）——render 侧只认 `ChatLine`
 * 形状，ui 侧只认这里的转换规则；「什么算一条消息」「标签怎么剥」「什么时候插时间分隔条」
 * 三件事都在这一个文件里单源，两个上屏面（详情页「查看聊天」/ 补充素材录音页「查看轮次」）
 * 不许各写一份。
 */
import type { StoreMsg } from './datasource';

/**
 * 一条会话流展示行（render.ChatLine 的数据侧原料）。
 * `tag` 是已从正文里剥出来的媒体标签（`[图片]` / `[语音 12秒·平静]` / `[表情·名]`…），
 * `text` 是标签之后的正文（图片描述 / 语音转写 / 回复内容；可能为空）。
 */
export interface ChatLineData {
  key: string;
  /** 毫秒时间戳（时间分隔条与排序都用它） */
  ts: number;
  /** 我方（右侧绿气泡） */
  me: boolean;
  /** 发送者：「我」或成员名（群聊里上屏同名标签） */
  who: string;
  /** 媒体标签（含方括号；空 = 纯文本消息） */
  tag: string;
  /** 气泡正文 */
  text: string;
}

/**
 * 已知标签词（与 parse.ts 的 kindFromLabel / media.parseMediaTag 同一词汇表）。
 * 只认这些前缀才当标签剥——普通文本里以 `[` 开头的句子（「[他说的] 那句」）不该被吃掉。
 */
const TAG_WORDS = ['引用', '分享', '链接', '文件', '撤回', '通话', '表情', '小程序', '视频', '录音', '语音', '图片'];

/** 标签词 → lucide 图标（气泡里标签前面那枚小图标；未知词不给图标） */
const TAG_ICONS: Record<string, string> = {
  图片: 'image',
  语音: 'mic',
  录音: 'mic',
  视频: 'video',
  表情: 'smile',
  通话: 'phone',
  文件: 'file-text',
  引用: 'quote',
  分享: 'link',
  链接: 'link',
  小程序: 'link',
  撤回: 'rotate-ccw',
};

/**
 * 标签与正文分开：`[图片] 一只猫` → `{ tag: '[图片]', body: '一只猫' }`。
 * 引号里的原文可能自带 `]`（`[引用「他说[嗯]」] 回复`）——方括号内容按**首个 `]` 收口**
 * （词表前缀保证不会误吃普通文本），超 80 字不收（那是正文不是标签）。
 */
export function splitChatTag(text: string): { tag: string; body: string } {
  const s = String(text ?? '');
  if (!s.startsWith('[')) return { tag: '', body: s };
  const m = /^\[([^\]\n]{0,80})\]\s?/.exec(s);
  if (!m) return { tag: '', body: s };
  const inner = m[1];
  if (!TAG_WORDS.some((w) => inner === w || inner.startsWith(w))) return { tag: '', body: s };
  return { tag: `[${inner}]`, body: s.slice(m[0].length) };
}

/** 标签 → lucide 图标名（空串 = 不给图标） */
export function chatTagIcon(tag: string): string {
  const inner = /^\[([^\]\n]{0,80})\]/.exec(tag)?.[1] ?? '';
  for (const w of TAG_WORDS) {
    if (inner === w || inner.startsWith(w)) return TAG_ICONS[w] ?? '';
  }
  return '';
}

/**
 * 聊天仓 → 展示行：**只取时间线上的条目**（`text !== ''` —— 与 storeToUnified 同一行过滤，
 * 空 text 的是没入时间线的待办媒体 / 终态跳过图）。顺序沿用仓里的 ts 升序。
 * `who` 缺省时按 isSender 判（`我` / 空）。
 */
export function chatLinesOf(msgs: StoreMsg[] | undefined): ChatLineData[] {
  const out: ChatLineData[] = [];
  for (const m of msgs ?? []) {
    if (!m || m.text === '') continue;
    const ts = Number(m.ts);
    if (!Number.isFinite(ts)) continue;
    const { tag, body } = splitChatTag(m.text);
    out.push({
      key: String(m.key ?? `${ts}`),
      ts,
      me: m.isSender === true,
      who: String(m.who ?? '').trim() || (m.isSender === true ? '我' : ''),
      tag,
      text: body,
    });
  }
  return out;
}

/** 时间分隔条的最小间隔（微信同款：挨着说的话不重复报时刻） */
export const CHAT_SEP_GAP_MS = 5 * 60 * 1000;

const p2 = (n: number): string => String(n).padStart(2, '0');

/**
 * 时间分隔条文案：与上一条**间隔超过 5 分钟**（或它是第一条）才出，否则空串（不出条）。
 * 形态照微信：今天 `HH:mm` / 昨天 `昨天 HH:mm` / 今年 `M月D日 HH:mm` / 更早 `YYYY年M月D日 HH:mm`。
 * `now` 由调用方给（可测；渲染层不算时间）。
 */
export function chatSepOf(ts: number, prevTs: number | null, now: number): string {
  if (prevTs !== null && ts - prevTs < CHAT_SEP_GAP_MS) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const hm = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const today = new Date(now);
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const at0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (at0 === day0) return hm;
  if (at0 === day0 - 86400000) return `昨天 ${hm}`;
  if (d.getFullYear() === today.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

/**
 * 会话是不是群聊（除「我」之外有多个发送者）——单聊气泡上不写名字，群聊才写。
 * 判据与 datasource.isGroupChat 同义（那边判原始消息，这边判展示行）。
 */
export function isGroupChatLines(lines: ChatLineData[]): boolean {
  const others = new Set<string>();
  for (const l of lines) {
    if (l.me) continue;
    const who = l.who.trim();
    if (!who) continue;
    others.add(who);
    if (others.size > 1) return true;
  }
  return false;
}
