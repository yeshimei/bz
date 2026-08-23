/**
 * 关系史沉淀「一起的日子」（ticket 094，方向八；ADR-0041）：
 * - 事件级即写：观察入流时按正性白名单即写 editingData.dossierEvents
 *   （eventId = 记忆条目 id 天然唯一 → 幂等去重；环形 ≤200 保最新）。
 *   089 里程碑通道 REJECTED 的替代数据源（票面「范围适配」节）：从记忆流派生，信任数值完全不动。
 * - 批重建按事件表重放：deriveTimeline 纯函数，不反查记忆流（流会增长/裁剪，事件表才是稳定源）。
 * - 周键调度独立：叙事摘要挂 editingData.dossierScanKey（isoWeekKey 同款周键格式），
 *   独立退避，不共享 MemorySystem.reflectBackoffUntil / weeklyReport 状态。
 * - 默认纯本地派生零 LLM：时间线文案模板拼接；叙事润色可选 LLM 且失败静默
 *   （H4 边界继承：USER_CONTENT_BOUNDARY + 输入异常裁剪）。
 * - 低活跃兜底：时间线恒含陪伴天数（观察去重日计数）+ 正性事件计数，不依赖反思/digest 产出。
 * - 只留正性：白名单外来源（删除/更新/负面低谷）一律不入事件表不入时间线（v4 砍负面展示裁决）。
 */
import type { SmartCatData, MemoryStreamEntry } from './types';
import { isoWeekKey } from './rhythm';
import { weekWindow } from './report';
import { callChatJson, isAIConfigured } from './api';
import { USER_CONTENT_BOUNDARY } from './memory';

// ---------------- 事件表 ----------------

/** dossier 正性事件类型（来源白名单 → 类型映射，票面「范围适配」节）：
 *  book=读完书 / letter=信首落 / poem=现代诗首落 / movie=影视打分 / diary=日记首落 */
export type DossierEventType = 'book' | 'letter' | 'poem' | 'movie' | 'diary';

/** dossier 事件（editingData.dossierEvents 元素；eventId = 记忆条目 id，幂等键） */
export interface DossierEvent {
  eventId: string;
  type: DossierEventType;
  /** ISO 时间（= 记忆条目 created） */
  at: string;
  /** 可选标题（书名/信篇名/诗篇名/片名；日记无标题省略） */
  title?: string;
}

/** 环形上限（保最新 200 条） */
export const DOSSIER_EVENTS_CAP = 200;

const DOSSIER_TYPES: readonly DossierEventType[] = ['book', 'letter', 'poem', 'movie', 'diary'];

/**
 * 白名单判别（纯函数）：记忆条目 → dossier 正性事件；非白名单返回 null。
 * 只读匹配各 source 模块用户拍板的固定句式（note-source/diary-source/movie-source，
 * 措辞不得自改），删除/更新等非正性句式天然不命中——只留正性。
 */
export function dossierEventFromMemory(m: MemoryStreamEntry): DossierEvent | null {
  if (!m || m.type !== 'observation' || !m.id || typeof m.description !== 'string') return null;
  const desc = m.description.trim();
  const at = typeof m.created === 'string' && m.created ? m.created : '';
  if (!at) return null;
  const mk = (type: DossierEventType, title?: string): DossierEvent =>
    title ? { eventId: m.id, type, at, title } : { eventId: m.id, type, at };
  switch (m.source) {
    case 'domain:library': {
      // 书库读完书（加入/开始/移出/进度句式不命中）
      const t = desc.match(/^你读完了《(.+?)》$/);
      return t ? mk('book', t[1]) : null;
    }
    case 'letter': {
      // 信首落：「你在 <date> 写了一封信「NAME」：<全文>」（删除句式不命中）
      const t = desc.match(/^你在 .+?写了一封信「(.+?)」：/);
      return t ? mk('letter', t[1]) : null;
    }
    case 'poem': {
      // 现代诗首落：「你在 <date> 写了一首现代诗「NAME」：<全文>」（删除/diff 句式不命中）
      const t = desc.match(/^你在 .+?写了一首现代诗「(.+?)」：/);
      return t ? mk('poem', t[1]) : null;
    }
    case 'movie': {
      // 影视打分：首次评分 / 改分（看完未打分、影评、状态流转、删除句式不命中）
      const r1 = desc.match(/^你给《(.+?)》评了 \d+ 分$/);
      if (r1) return mk('movie', r1[1]);
      const r2 = desc.match(/^你把《(.+?)》的评分从 \d+ 改为 \d+$/);
      return r2 ? mk('movie', r2[1]) : null;
    }
    case 'diary': {
      // 日记首落：「你在 <YYYY-MM-DD HH:mm> 写了一篇日记（分类：…）：<正文>」（更新/删除句式不命中）
      const t = desc.match(/^你在 \d{4}-\d{2}-\d{2} \d{2}:\d{2} 写了一篇日记/);
      return t ? mk('diary') : null;
    }
    default:
      return null;
  }
}

/**
 * 即写事件（幂等 + 环形截断）：白名单命中且 eventId 未见过才写入；返回是否写入（调用方负责落盘）。
 * editingData 可为 null/旧结构 → 展开兜底；既有字段全保留（兼容冻结：smartcat.json 只加可选字段）。
 */
export function appendDossierEvent(data: SmartCatData, m: MemoryStreamEntry): boolean {
  const evt = dossierEventFromMemory(m);
  if (!evt) return false;
  const ed = data.editingData && typeof data.editingData === 'object' ? data.editingData : {};
  const list = getDossierEvents(data);
  if (list.some((e) => e.eventId === evt.eventId)) return false; // eventId 幂等去重
  let next = [...list, evt];
  if (next.length > DOSSIER_EVENTS_CAP) next = next.slice(next.length - DOSSIER_EVENTS_CAP); // 环形截断保最新
  data.editingData = { ...ed, dossierEvents: next };
  return true;
}

/** 读事件表（防御归一：非法元素过滤；旧数据无该字段 → 空表容忍） */
export function getDossierEvents(data: SmartCatData): DossierEvent[] {
  const raw = data?.editingData?.dossierEvents;
  if (!Array.isArray(raw)) return [];
  return raw.filter((e: any): e is DossierEvent =>
    e && typeof e === 'object'
    && typeof e.eventId === 'string' && !!e.eventId
    && typeof e.at === 'string' && !!e.at
    && DOSSIER_TYPES.includes(e.type)
  );
}

// ---------------- 时间线重建（纯函数，事件表重放） ----------------

/** 时间线行（kind summary=兜底统计行恒在；week=ISO 周聚合行） */
export interface DossierTimelineRow {
  kind: 'summary' | 'week';
  /** week 行 = ISO 周键；summary 行 = '' */
  key: string;
  /** week 行展示标题（周一~周日日期范围）；summary 行留空（文案在 lines[0]） */
  title: string;
  lines: string[];
}

const TYPE_ORDER: readonly DossierEventType[] = ['book', 'diary', 'letter', 'poem', 'movie'];

/** 本地日键 YYYY-MM-DD（陪伴天数/情绪变化日共用口径） */
function dayKeyOf(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 观察去重日计数（陪伴天数；低活跃兜底口径，只看观察、不依赖反思/digest 产出） */
export function countCompanionDays(stream: MemoryStreamEntry[]): number {
  const days = new Set<string>();
  for (const m of Array.isArray(stream) ? stream : []) {
    if (!m || m.type !== 'observation') continue;
    const t = m.created ? Date.parse(m.created) : NaN;
    if (Number.isFinite(t)) days.add(dayKeyOf(t));
  }
  return days.size;
}

/** 周一 00:00 本地毫秒（周窗口起点；对齐 report.weekWindow 口径） */
function weekStartMs(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // 周一=0
  return d.getTime();
}

/** 周范围标题「M 月 D 日 ~ M 月 D 日」 */
function weekRangeText(startMs: number): string {
  const fmt = (d: Date) => `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  return `${fmt(new Date(startMs))} ~ ${fmt(new Date(startMs + 6 * 86400000))}`;
}

/** 单周聚合短语（模板拼接，零 LLM；类型按固定顺序、「、」连接） */
function weekLine(events: DossierEvent[]): string {
  const byType = new Map<DossierEventType, DossierEvent[]>();
  for (const e of events) {
    const arr = byType.get(e.type);
    if (arr) arr.push(e);
    else byType.set(e.type, [e]);
  }
  const phrases: string[] = [];
  for (const type of TYPE_ORDER) {
    const evs = byType.get(type);
    if (!evs || !evs.length) continue;
    switch (type) {
      case 'book': {
        const titles = [...new Set(evs.map((e) => e.title || ''))].filter(Boolean);
        phrases.push(
          titles.length > 3
            ? `读完了《${titles.slice(0, 3).join('》《')}》等 ${titles.length} 本`
            : `读完了${titles.map((t) => `《${t}》`).join('')}`,
        );
        break;
      }
      case 'diary':
        phrases.push(`写了 ${evs.length} 篇日记`);
        break;
      case 'letter':
        phrases.push(evs.length === 1 ? '写了 1 封信' : `写了 ${evs.length} 封信`);
        break;
      case 'poem':
        phrases.push(evs.length === 1 ? '写了 1 首现代诗' : `写了 ${evs.length} 首现代诗`);
        break;
      case 'movie': {
        const titles = [...new Set(evs.map((e) => e.title || ''))].filter(Boolean);
        phrases.push(
          titles.length && titles.length <= 2
            ? `给${titles.map((t) => `《${t}》`).join('')}打了分`
            : `给 ${Math.max(1, titles.length)} 部电影打了分`,
        );
        break;
      }
    }
  }
  return phrases.join('、');
}

/**
 * 时间线重建（纯函数，批重建按事件表重放——票面设计第 2/5 条）：
 * 首行恒为兜底统计行（陪伴天数 + 正性事件计数，空事件表也有内容）；
 * 之后按 ISO 周聚合、最新在前。不反查记忆流。
 */
export function deriveTimeline(events: DossierEvent[], opts: { companionDays?: number } = {}): DossierTimelineRow[] {
  const rows: DossierTimelineRow[] = [];
  const companionDays = Math.max(0, Math.floor(opts.companionDays ?? 0));
  rows.push({
    kind: 'summary',
    key: '',
    title: '',
    lines: [`已陪伴 ${companionDays} 天 · 收录 ${events.length} 件温暖小事`],
  });
  const byWeek = new Map<string, { start: number; events: DossierEvent[] }>();
  for (const e of Array.isArray(events) ? events : []) {
    const t = e?.at ? Date.parse(e.at) : NaN;
    if (!Number.isFinite(t)) continue; // 无效时间防御
    const wk = isoWeekKey(new Date(t));
    const bucket = byWeek.get(wk);
    if (bucket) {
      bucket.events.push(e);
      if (t < bucket.start) bucket.start = t;
    } else {
      byWeek.set(wk, { start: t, events: [e] });
    }
  }
  const weeks = [...byWeek.values()].map((b) => ({ ...b, start: weekStartMs(b.start) }));
  weeks.sort((a, b) => b.start - a.start); // 最新在前
  for (const w of weeks) {
    rows.push({ kind: 'week', key: isoWeekKey(new Date(w.start)), title: weekRangeText(w.start), lines: [weekLine(w.events)] });
  }
  return rows;
}

// ---------------- 关键时刻（情绪标签变化日 + 当日备忘；零新增持久化） ----------------

/** 情绪标签变化日（关键时刻） */
export interface EmotionShiftDay {
  dayKey: string;
  /** 该日多数情绪标签（变化后） */
  emotion: string;
}

/** 按日多数情绪标签（仅观察带情绪标注；并列取当日最先达到该计数的标签，确定性） */
export function majorityEmotionByDay(stream: MemoryStreamEntry[]): EmotionShiftDay[] {
  const counts = new Map<string, Map<string, number>>();
  const order = new Map<string, string[]>(); // dayKey → 标签首次出现顺序（并列确定性用）
  for (const m of Array.isArray(stream) ? stream : []) {
    if (!m || m.type !== 'observation' || !m.emotion) continue;
    const t = m.created ? Date.parse(m.created) : NaN;
    if (!Number.isFinite(t)) continue;
    const dk = dayKeyOf(t);
    if (!counts.has(dk)) {
      counts.set(dk, new Map());
      order.set(dk, []);
    }
    const cm = counts.get(dk)!;
    if (!cm.has(m.emotion)) order.get(dk)!.push(m.emotion);
    cm.set(m.emotion, (cm.get(m.emotion) || 0) + 1);
  }
  const out: EmotionShiftDay[] = [];
  for (const dk of [...counts.keys()].sort()) {
    const cm = counts.get(dk)!;
    let best = '';
    let bestN = -1;
    for (const emo of order.get(dk)!) {
      const n = cm.get(emo)!;
      if (n > bestN) {
        best = emo;
        bestN = n;
      }
    }
    if (best) out.push({ dayKey: dk, emotion: best });
  }
  return out;
}

/**
 * 情绪标签变化日检测（票面设计第 6 条）：当日入流观察 emotion 多数标签
 * 与前一「有标注日」的多数标签不同 → 该日为关键时刻（升序返回）。跳过的无标注日不断链。
 */
export function detectEmotionShiftDays(stream: MemoryStreamEntry[]): EmotionShiftDay[] {
  const perDay = majorityEmotionByDay(stream);
  const shifts: EmotionShiftDay[] = [];
  let prev = '';
  for (const d of perDay) {
    if (prev && d.emotion !== prev) shifts.push(d);
    prev = d.emotion;
  }
  return shifts;
}

// ---------------- 每周叙事摘要（可选 LLM 润色；独立周键退避） ----------------

/**
 * 叙事扫描决策（纯函数）：本周未生成过（scanKey ≠ 当前周键）且本周窗口内有正性事件 → 尝试生成。
 * 判据只依赖 editingData.dossierScanKey 与事件表——与 MemorySystem.reflectBackoffUntil /
 * weeklyReport / proactiveCare 状态完全独立（票面设计第 3 条「周键调度独立」）。
 */
export function shouldScanDossierNarrative(scanKey: string, weekKey: string, events: DossierEvent[], now = Date.now()): boolean {
  if (scanKey === weekKey) return false;
  const [start] = weekWindow(now);
  return (Array.isArray(events) ? events : []).some((e) => {
    const t = e?.at ? Date.parse(e.at) : NaN;
    return Number.isFinite(t) && t >= start;
  });
}

/** 推进叙事周键（纯数据操作：只动 editingData.dossierScanKey，其他字段原样保留——独立性可测） */
export function advanceDossierScanKey(data: SmartCatData, weekKey: string): void {
  data.editingData = { ...(data.editingData || {}), dossierScanKey: weekKey };
}

/** 叙事输入文本（本地模板拼接近 8 周；超长裁剪 1200 字——H4 异常裁剪继承） */
export function buildNarrativeInput(events: DossierEvent[], now = Date.now()): string {
  const rows = deriveTimeline(Array.isArray(events) ? events : []).filter((r) => r.kind === 'week').slice(0, 8);
  const body = rows.map((r) => `${r.title}：${r.lines.join(' ')}`).join('\n');
  return body.length > 1200 ? body.slice(0, 1200) : body;
}

/**
 * 叙事润色（可选 LLM；AI 未配置/失败/空回包一律返回空串——静默降级，调用方不推进周键）。
 * H4 边界继承：system 拼 USER_CONTENT_BOUNDARY，用户事件文本只作数据引用。
 */
export async function generateDossierNarrative(input: string): Promise<string> {
  try {
    if (!(await isAIConfigured())) return '';
    const r = await callChatJson([
      {
        role: 'system',
        content:
          '你是小橘，一只长期陪伴主人的猫咪。根据下面按周聚合的「一起的日子」事件清单，' +
          '写一段 60-120 字的温柔关系史小结：像老朋友回忆这些共同经历，有猫味，不要堆砌清单。' +
          '只返回 JSON：{"narrative":"小结全文"}。\n\n' +
          USER_CONTENT_BOUNDARY,
      },
      { role: 'user', content: input },
    ], 400);
    const text = typeof r?.narrative === 'string' && r.narrative.trim() ? r.narrative.trim() : '';
    return text;
  } catch (e) {
    return ''; // 失败静默
  }
}

// ---------------- 叙事收集（dashboard 用） ----------------

/** 叙事摘要行（记忆流 source=dossier 的洞察，新→旧） */
export interface DossierNarrativeRow {
  time: number;
  text: string;
}

/** 收集叙事摘要（dashboard「一起的日子」区块数据源纯函数；去【一起的日子】前缀、过滤非法） */
export function buildDossierNarratives(stream: MemoryStreamEntry[]): DossierNarrativeRow[] {
  return (Array.isArray(stream) ? stream : [])
    .filter((m) => m.type === 'insight' && m.source === 'dossier')
    .map((m) => ({
      time: m.created ? Date.parse(m.created) : NaN,
      text: (typeof m.description === 'string' ? m.description : '').replace(/^【一起的日子】/, ''),
    }))
    .filter((r) => Number.isFinite(r.time) && r.text)
    .sort((a, b) => b.time - a.time);
}