/**
 * 媒体素材解析（issue 445）：消费预处理线产出的媒体标签化文本——
 * 语音 `[语音 12s·平静] 转写文本`、图片 `[图片] 描述文本`。
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
  kind: 'voice' | 'image';
  /** 语音转写文本 / 图片画面描述（多段保留换行；不含标签本身） */
  text: string;
  /** 语音时长（秒；标签里没写就没有） */
  durationSec?: number;
  /** 语音情感标签（如 平静 / 开心） */
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
}

/**
 * 解析一条消息文本的媒体标签。返回 null = 不是媒体素材（纯文本 / 标签在正文中 / 旧空标签 / 空描述）。
 */
export function parseMediaTag(msg: string): MediaMaterial | null {
  // 群聊行带成员名前缀（datasource 合成 `[成员名] [图片] …`）：容忍一层非媒体标签的方括号前缀，
  // 群聊语音/图片照常解析出素材（徽章统计 / mediaNote / 批内媒体计数同源受益）。
  // 前缀内容以已知标签名开头即不剥离（防 [引用「xx」] 这类真标签被当成员名吃掉），长度 ≤16（成员名口径）。
  let s = String(msg ?? '').trim();
  const stripped = s.replace(/^\[(?!(?:语音|图片|视频|通话|文件|分享|引用|表情|链接|撤回|小程序))[^[\]]{1,16}\]\s*/, '');
  if (stripped !== s && /^\[(语音|图片)\s*([^\]]*)\]/.test(stripped)) s = stripped;
  const m = /^\[(语音|图片)\s*([^\]]*)\]\s*([\s\S]+)$/.exec(s);
  if (!m) return null;
  const body = m[3].trim();
  if (!body) return null; // 旧空标签 / 空描述：没有素材，保持现状
  const kind = m[1] === '语音' ? ('voice' as const) : ('image' as const);
  const out: MediaMaterial = { kind, text: body };
  if (kind === 'voice') {
    let durationSec: number | undefined;
    const emos: string[] = [];
    for (const part of m[2].split('·')) {
      const t = part.trim();
      if (!t) continue;
      const dm = /^(\d+(?:\.\d+)?)(?:s|秒)$/i.exec(t);
      if (dm) {
        if (durationSec === undefined) durationSec = Number(dm[1]);
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
  return { voiceCount: 0, voiceTotalSec: 0, imageCount: 0 };
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

/** 徽章 / 概述用的计数文案：`语音 26 条 · 4 分 · 图片 14 张`（零项不出现；全零返回空串） */
export function formatMediaCount(s: MediaStats): string {
  const parts: string[] = [];
  if (s.voiceCount > 0) {
    parts.push(`语音 ${s.voiceCount} 条`);
    if (s.voiceTotalSec > 0) parts.push(formatDuration(s.voiceTotalSec));
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
  const emo = s.voiceCount > 0 ? '；语音行内「·」后的标记是语音情感识别结果（如平静、开心），可作情绪判断的参考' : '';
  return `聊天里还有${count}的媒体素材——语音已转写成文字并入对话（引用原话时只写转写文本，不带标签），图片以画面描述入列${emo}。`;
}
