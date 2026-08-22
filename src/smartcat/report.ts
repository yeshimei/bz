/**
 * 每周懂你报告（2026-08-23「懂你」增强：⑦ 用户拍板）
 * 每周一次：LLM 汇总本周观察/心情/学到的你 → 写回记忆流（source weekly-report）+ 气泡给人看。
 * 纯函数（可测）：周窗口过滤/来源与情绪分布统计/文本拼装；
 * AI 路径：generateWeeklyReport 用 callChatJson 输出「懂你报告」。
 */
import type { MemoryStreamEntry, PadDimensions } from './types';
import { callChatJson, isAIConfigured } from './api';
import { sourceLabel } from './memory';

/** 周窗口边界（ISO 周一 00:00 起 7 天；返回 [startMs, endMs]） */
export function weekWindow(now = Date.now()): [number, number] {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - day);
  const start = d.getTime();
  return [start, start + 7 * 24 * 60 * 60 * 1000 - 1];
}

/** 周统计（纯函数）：本周观察条数/来源分布/情绪分布/洞察数/高重要记忆 */
export interface WeeklyReportData {
  window: [number, number];
  total: number;
  observationCount: number;
  insightCount: number;
  sourceDist: Record<string, number>;
  emotionDist: Record<string, number>;
  topMemories: MemoryStreamEntry[];
  padAvg: { pleasure: number; arousal: number; dominance: number };
}

/** 统计本周记忆（纯函数；padAvg 由调用方传当前 PAD，周内无采样则近似） */
export function buildWeeklyReportData(stream: MemoryStreamEntry[], pad: PadDimensions, now = Date.now()): WeeklyReportData {
  const [start, end] = weekWindow(now);
  const week = stream.filter((m) => {
    const t = m.created ? new Date(m.created).getTime() : NaN;
    return Number.isFinite(t) && t >= start && t <= end;
  });
  const sourceDist: Record<string, number> = {};
  const emotionDist: Record<string, number> = {};
  let observationCount = 0;
  let insightCount = 0;
  for (const m of week) {
    if (m.type === 'observation') {
      observationCount++;
      // 来源/情绪分布仅统计观察（洞察/报告是系统产物，不算用户痕迹）
      const src = sourceLabel(m.source) || '其他';
      sourceDist[src] = (sourceDist[src] || 0) + 1;
      if (m.emotion) emotionDist[m.emotion] = (emotionDist[m.emotion] || 0) + 1;
    } else {
      insightCount++;
    }
  }
  const topMemories = [...week]
    .filter((m) => m.type === 'observation')
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, 5);
  return {
    window: [start, end],
    total: week.length,
    observationCount,
    insightCount,
    sourceDist,
    emotionDist,
    topMemories,
    padAvg: { pleasure: pad.pleasure, arousal: pad.arousal, dominance: pad.dominance },
  };
}

/** 周报告基础文本（纯函数；LLM 未配置/失败时兜底展示统计） */
export function formatWeeklyReport(d: WeeklyReportData): string {
  const [start] = d.window;
  const d0 = new Date(start);
  const dateTitle = `${d0.getFullYear()} 年 ${d0.getMonth() + 1} 月 ${d0.getDate()} 日`;
  const lines: string[] = [];
  lines.push(`这是 ${dateTitle} 开始的一周，小橘观察到 ${d.total} 条记忆（观察 ${d.observationCount} 条 / 洞察 ${d.insightCount} 条）。`);
  if (d.total === 0) {
    lines.push('这一周小橘还没读到太多你的内容——多写写日记/闪念，我就能更懂你啦。');
    return lines.join('\n');
  }
  const srcTop = Object.entries(d.sourceDist).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (srcTop.length) lines.push(`你最常在「${srcTop.map(([k, v]) => `${k}（${v} 条）`).join('、')}」留下痕迹。`);
  const emoTop = Object.entries(d.emotionDist).sort((a, b) => b[1] - a[1]);
  if (emoTop.length) lines.push(`这周的情绪最多是：${emoTop.slice(0, 3).map(([k, v]) => `${k} ${v} 次`).join('、')}。`);
  if (d.topMemories.length) {
    lines.push('本周最重要的几件事（按重要度）：');
    d.topMemories.forEach((m, i) => lines.push(`${i + 1}. ${m.description.substring(0, 60)}`));
  }
  lines.push(`当前小橘的心情（PAD）：愉悦 ${Math.round(d.padAvg.pleasure)} / 唤醒 ${Math.round(d.padAvg.arousal)} / 支配 ${Math.round(d.padAvg.dominance)}。`);
  return lines.join('\n');
}

/** 周报告 JSON 通道（AI 配置时：LLM 生成个性化懂你报告；未配置/失败 → formatWeeklyReport 兜底） */
export async function generateWeeklyReport(d: WeeklyReportData): Promise<string> {
  try {
    if (await isAIConfigured()) {
      const r = await callChatJson([
        {
          role: 'system',
          content:
            '你是小橘，一只陪伴猫咪。本周给用户写一份「懂你报告」（100-200 字）：' +
            '1) 这周你观察到用户的生活/工作/情绪；2) 你觉得用户是什么样的人（结合记忆证据）；' +
            '3) 一句温柔的陪伴寄语。语气像老朋友，有猫味。只返回 JSON：{"report":"报告全文"}',
        },
        { role: 'user', content: formatWeeklyReport(d) },
      ], 500);
      const text = typeof r?.report === 'string' && r.report.trim() ? r.report.trim() : '';
      if (text) return text;
    }
  } catch (e) { /* 降级统计文本 */ }
  return formatWeeklyReport(d);
}