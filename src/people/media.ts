/**
 * 媒体素材解析（issue 445）：消费预处理线产出的媒体标签化文本——
 * 语音 `[语音 12s·平静] 转写文本`、图片 `[图片] 描述文本`、录音 `[录音 3分02秒·平静] 轮次转写`（509）。
 *
 * 标签约定（与预处理线对齐）：
 * - 时长（`12s`）与情感标签（SenseVoice 产出：平静 / 开心 / 生气 / 难过等）都可有可无；
 * - 旧格式空标签 `[语音]` / `[图片]`（] 后无内容）不解析出素材，保持现状原样当文本；
 * - 标签必须在消息开头——正文里提到「[图片]」的普通文本不算素材；
 * - 发送者由导入结构的 is_sender 表达，与标签无关，本层不关心。
 *
 * 纯函数、零 DOM：解析结果只在本轮导入的内存里流转；落盘只有聚合数字
 * （ContactStats 媒体字段），不含素材原文——与 ADR-0191 §2 隐私口径一致。
 */
import type { UnifiedMessage } from './types';

/** 一条媒体素材（从消息文本解析；纯文本 / 旧空标签返回 null 无素材） */
export interface MediaMaterial {
  kind: 'voice' | 'image' | 'recording';
  /** 语音/录音转写文本 / 图片画面描述（多段保留换行；不含标签本身） */
  text: string;
  /** 语音/录音时长（秒；标签里没写就没有） */
  durationSec?: number;
  /** 语音/录音情感标签（如 平静 / 开心） */
  emotion?: string;
}

/** 媒体素材聚合（只数解析出素材的消息；落盘口径） */
export interface MediaStats {
  /** 语音素材条数 */
  voiceCount: number;
  /** 语音总时长（秒；标签没写时长的条目不计入） */
  voiceTotalSec: number;
  /** 图片素材张数 */
  imageCount: number;
  /** 录音轮次条数（509） */
  recordingCount?: number;
  /** 录音总时长（秒；标签没写时长的条目不计入） */
  recordingTotalSec?: number;
}

/** 录音时长标签解析（509）：「3分02秒」/「2分」/「45秒」→ 秒；不认识返回 undefined */
export function parseRecordingDurationSec(t: string): number | undefined {
  const s = String(t ?? '').trim();
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)分(\d{1,2}(?:\.\d+)?)秒$/.exec(s))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = /^(\d+)分$/.exec(s))) return Number(m[1]) * 60;
  if ((m = /^(\d+(?:\.\d+)?)秒$/.exec(s))) return Number(m[1]);
  return undefined;
}

/** 录音时长标签文案（509）：182 → 「3分02秒」、45 → 「45秒」（整秒，与 [语音 N秒] 同构） */
export function formatRecordingDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  if (s < 60) return `${s}秒`;
  return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒`;
}

/**
 * 解析一条消息文本的媒体标签。返回 null = 不是媒体素材（纯文本 / 标签在正文中 / 旧空标签 / 空描述）。
 */
export function parseMediaTag(msg: string): MediaMaterial | null {
  // 群聊行带成员名前缀（datasource 合成 `[成员名] [图片] …`）：容忍一层非媒体标签的方括号前缀，
  // 群聊语音/图片照常解析出素材（徽章统计 / mediaNote / 批内媒体计数同源受益）。
  // 前缀内容以已知标签名开头即不剥离（防 [引用「xx」] 这类真标签被当成员名吃掉），长度 ≤16（成员名口径）。
  let s = String(msg ?? '').trim();
  const stripped = s.replace(/^\[(?!(?:语音|图片|录音|视频|通话|文件|分享|引用|表情|链接|撤回|小程序))[^[\]]{1,16}\]\s*/, '');
  if (stripped !== s && /^\[(语音|图片|录音)\s*([^\]]*)\]/.test(stripped)) s = stripped;
  // 成员名**恰好就是标签词本身**的窄口补丁（点名「图片」/「语音」/「录音」的群成员）：
  // 上面的负向预查会拒剥这种前缀，于是成员名被当成媒体标签——`[图片] [语音 12秒] 转写` 被判成
  // 图片、`[录音] [图片] 描述` 被判成录音，统计（voice/image/recording 三项）跟着串类。
  // 只在「首层方括号内容 === 标签词」且「其后紧跟一条**带正文的**真实媒体标签」时才剥：
  // `[图片] 描述`（没有第二层标签）、`[语音] 内容`（真语音条）、`[引用「xx」] …`（真标签）都不受影响。
  // 残留口径（改不动，属格式固有歧义）：成员名叫「图片」且发纯文本时，`[图片] 你好` 与
  // 「一张描述为『你好』的图片」在合成文本里无法区分——要根治得改群聊前缀格式（牵动存量数据），不值得。
  const named = /^\[(?:语音|图片|录音|视频|通话|文件|分享|引用|表情|链接|撤回|小程序)\]\s*(\[[^\]]*\][\s\S]*)$/.exec(s);
  if (named && /^\[(语音|图片|录音)\s*[^\]]*\]\s*\S/.test(named[1])) s = named[1];
  const m = /^\[(语音|图片|录音)\s*([^\]]*)\]\s*([\s\S]+)$/.exec(s);
  if (!m) return null;
  const body = m[3].trim();
  if (!body) return null; // 旧空标签 / 空描述：没有素材，保持现状
  const kind = m[1] === '语音' ? ('voice' as const) : m[1] === '录音' ? ('recording' as const) : ('image' as const);
  const out: MediaMaterial = { kind, text: body };
  if (kind === 'voice' || kind === 'recording') {
    let durationSec: number | undefined;
    const emos: string[] = [];
    for (const part of m[2].split('·')) {
      const t = part.trim();
      if (!t) continue;
      const dm = /^(\d+(?:\.\d+)?)(?:s|秒)$/i.exec(t); // 语音口径：12s / 3.5秒
      const dur = dm ? Number(dm[1]) : kind === 'recording' ? parseRecordingDurationSec(t) : undefined; // 录音口径：3分02秒 / 2分 / 45秒
      if (dur !== undefined) {
        if (durationSec === undefined) durationSec = dur;
      } else {
        emos.push(t);
      }
    }
    if (durationSec !== undefined) out.durationSec = durationSec;
    const emotion = emos.join('·').trim();
    if (emotion) out.emotion = emotion;
  }
  return out;
}

export function emptyMediaStats(): MediaStats {
  return { voiceCount: 0, voiceTotalSec: 0, imageCount: 0, recordingCount: 0, recordingTotalSec: 0 };
}

/** 消息流 → 媒体聚合（旧空标签不算条数；时长只累计写了的） */
export function collectMediaStats(messages: UnifiedMessage[]): MediaStats {
  const out = emptyMediaStats();
  for (const m of messages) {
    const mat = parseMediaTag(m?.text ?? '');
    if (!mat) continue;
    if (mat.kind === 'voice') {
      out.voiceCount++;
      if (mat.durationSec !== undefined && Number.isFinite(mat.durationSec)) out.voiceTotalSec += mat.durationSec;
    } else if (mat.kind === 'recording') {
      out.recordingCount = (out.recordingCount ?? 0) + 1;
      if (mat.durationSec !== undefined && Number.isFinite(mat.durationSec)) out.recordingTotalSec = (out.recordingTotalSec ?? 0) + mat.durationSec;
    } else {
      out.imageCount++;
    }
  }
  return out;
}

/** 时长自适应：45 秒 / 4 分 / 2 时（与 formatReplySec 同款口径） */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  if (s < 60) return `${s} 秒`;
  if (s < 3600) return `${Math.round(s / 60)} 分`;
  return `${Math.round(s / 3600)} 时`;
}

/** 徽章 / 概述用的计数文案：`语音 26 条 · 4 分 · 录音 2 段 · 图片 14 张`（零项不出现；全零返回空串） */
export function formatMediaCount(s: MediaStats): string {
  const parts: string[] = [];
  if (s.voiceCount > 0) {
    parts.push(`语音 ${s.voiceCount} 条`);
    if (s.voiceTotalSec > 0) parts.push(formatDuration(s.voiceTotalSec));
  }
  if ((s.recordingCount ?? 0) > 0) {
    parts.push(`录音 ${s.recordingCount} 段`);
    if ((s.recordingTotalSec ?? 0) > 0) parts.push(formatDuration(s.recordingTotalSec ?? 0));
  }
  if (s.imageCount > 0) parts.push(`图片 ${s.imageCount} 张`);
  return parts.join(' · ');
}

/**
 * 提示词素材清单说明：媒体计数 + 情感标记含义（有语音时说明，供「情绪逻辑」层参考）。
 * 无媒体素材返回空串（提示词不加废话）。
 */
export function buildMediaNote(s: MediaStats): string {
  const count = formatMediaCount(s);
  if (!count) return '';
  const hasVoice = s.voiceCount > 0 || (s.recordingCount ?? 0) > 0;
  const emo = hasVoice ? '；语音/录音行内「·」后的标记是语音情感识别结果（如平静、开心），可作情绪判断的参考' : '';
  return `聊天里还有${count}的媒体素材——语音与录音已转写成文字并入对话（引用原话时只写转写文本，不带标签），图片以画面描述入列${emo}。`;
}
