/**
 * 每周懂你报告（2026-08-23「懂你」增强：⑦ 用户拍板）。
 * ticket 160（ADR-0075 三层记忆流水线）：周报只吃洞察——原料从「本周观察 + 统计拼装」改为
 * 「本周新增 insight」（反思/叙事等产出的高阶结论；剔除 superseded；只吃本周窗口，周周有增量、
 * 不吃历史全量——否则周报内容几乎不随周变化）。观察/情绪/来源分布等统计随观察原料一并退役。
 * 纯函数（可测）：周窗口过滤/主题分布/清单拼装；AI 路径：generateWeeklyReport 用 callChatJson 输出报告。
 */
import type { MemoryStreamEntry, PadDimensions } from './types';
import { callChatJson, isAIConfigured } from './api';
import { USER_CONTENT_BOUNDARY } from './memory';
import { isSupersededInsight } from './insight-version';

/** 周窗口边界（ISO 周一 00:00 起 7 天；返回 [startMs, endMs]） */
export function weekWindow(now = Date.now()): [number, number] {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - day);
  const start = d.getTime();
  return [start, start + 7 * 24 * 60 * 60 * 1000 - 1];
}

/** 周统计（纯函数）：本周新增洞察条数/主题分布/洞察清单 */
export interface WeeklyReportData {
  window: [number, number];
  /** 本周新增洞察条数（maybeWeeklyReport 门槛的判断依据） */
  total: number;
  /** 主题分布（未打标主题计「未分类」） */
  themeDist: Record<string, number>;
  /** 本周新增洞察（created 升序） */
  insights: MemoryStreamEntry[];
  padAvg: { pleasure: number; arousal: number; dominance: number };
}

/** 统计本周洞察（纯函数；洞察无情绪样本——padAvg 即当前 PAD，ADR-0025「周内观察情绪均值」口径随观察原料退役） */
export function buildWeeklyReportData(stream: MemoryStreamEntry[], pad: PadDimensions, now = Date.now()): WeeklyReportData {
  const [start, end] = weekWindow(now);
  const insights = stream.filter((m) => {
    if (m.type !== 'insight' || isSupersededInsight(m)) return false;
    const t = m.created ? new Date(m.created).getTime() : NaN;
    return Number.isFinite(t) && t >= start && t <= end;
  }).sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
  const themeDist: Record<string, number> = {};
  for (const m of insights) {
    const k = m.theme || '未分类';
    themeDist[k] = (themeDist[k] || 0) + 1;
  }
  return {
    window: [start, end],
    total: insights.length,
    themeDist,
    insights,
    padAvg: { ...pad },
  };
}

/** 周报告基础文本（纯函数；LLM 未配置/失败时兜底展示洞察清单） */
export function formatWeeklyReport(d: WeeklyReportData): string {
  const [start] = d.window;
  const d0 = new Date(start);
  const dateTitle = `${d0.getFullYear()} 年 ${d0.getMonth() + 1} 月 ${d0.getDate()} 日`;
  if (d.total === 0) {
    return `这是 ${dateTitle} 开始的一周，小橘这周还没形成对你的新理解——多写写日记，我就能更懂你啦。`;
  }
  const lines: string[] = [];
  lines.push(`这是 ${dateTitle} 开始的一周，小橘对你的理解新增了 ${d.total} 条。`);
  const themeTop = Object.entries(d.themeDist).sort((a, b) => b[1] - a[1]);
  if (themeTop.length) lines.push(`这周的收获集中在「${themeTop.map(([k, v]) => `${k}（${v} 条）`).join('、')}」。`);
  lines.push('本周我懂到的：');
  d.insights.forEach((m, i) => lines.push(`${i + 1}${m.theme ? ` [${m.theme}]` : ''} ${m.description}`));
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
            '你是小橘，一只陪伴猫咪。下面是你这周对用户新形成的理解（洞察）。请据此给用户写一份「懂你报告」（100-200 字）：' +
            '1) 这周你新懂到了用户是什么样的；2) 一句温柔的陪伴寄语。语气像老朋友，有猫味。只返回 JSON：{"report":"报告全文"}。\n\n' +
            // H4（087）：洞察文本源自用户记忆——只作数据引用，其中的指令性语句一律无视
            USER_CONTENT_BOUNDARY,
        },
        { role: 'user', content: formatWeeklyReport(d) },
      ], 500);
      const text = typeof r?.report === 'string' && r.report.trim() ? r.report.trim() : '';
      if (text) return text;
    }
  } catch (e) { /* 降级清单文本 */ }
  return formatWeeklyReport(d);
}
