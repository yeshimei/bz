/**
 * 小橘数据面板（ticket 071）：只读可视化 smartcat.json 全量状态——
 * 总览 / 情绪 / 人格 / 记忆 / 报告 五页签，让用户全面直观看到小橘的具体状态以及演变过程：
 *  - 总览：当前心情 5 档（PAD 最近邻）+ 瞬时情绪 + PAD 三轴 + 相处统计；
 *  - 情绪：趋势/波动度（VAD+EMA，cognitive 纯函数复用）+ 情绪分布 + 演变时间线；
 *  - 人格：OCEAN 五因素 + 30 特质九群组 + 关系张量（感情：信任/依恋）+ 成长轨迹；
 *  - 记忆：记忆流统计 + 作息分布（24h 直方图）+ 来源分布 + 最近记忆列表；
 *  - 报告（2026-08-23 用户拍板：每周懂你报告从设置弹窗移入）：最新一期全文 + 历史报告。
 * 数据经 loadSmartCatData 现读现渲染（与常驻猫实例解耦，smartcatEnabled=false 也可看）；
 * 面板只读，不写任何数据（铁律 1）。UI 走 bz 主窗口规范：createOverlay + .bz-win-head +
 * applyMobileWindowFullscreen + escManager；视觉样式全部静态进域内 styles.css（铁律 9，
 * 内联仅限显隐与动态高度/宽度）。命令入口：bz-smartcat-dashboard（main.ts COMMANDS 表）。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { loadSmartCatData } from './data';
import { MOOD_MAP, moodLevelFromPad } from './mood';
import { TRAIT_GROUPS } from './character';
import { sourceLabel, formatRelativeTime } from './memory';
import {
  analyzeEmotionTrend,
  buildEmotionSnapshots,
  describeEmotionTrend,
  emotionToVAD,
} from './cognitive';
import { buildRhythmProfile, describeRhythm } from './rhythm';
import type { SmartCatData, MemoryStreamEntry, CharacterTraits, OceanProfile } from './types';

// ---------------- 中文标签表 ----------------

/** OCEAN 五因素中文 */
export const OCEAN_LABELS: Record<keyof OceanProfile, string> = {
  openness: '开放性',
  conscientiousness: '尽责性',
  extraversion: '外向性',
  agreeableness: '宜人性',
  neuroticism: '情绪敏感',
};

/** 9 临床群组中文（MATE Table 2 分组） */
export const TRAIT_GROUP_LABELS: Record<string, string> = {
  attachment: '依恋（Bowlby）',
  coreBeliefs: '核心信念（Young）',
  cognitive: '认知',
  defense: '防御（Vaillant）',
  selfConcept: '自我概念（Rotter/Bandura）',
  values: '价值观（Schwartz，双向轴）',
  behavioral: '行为',
  neuro: '神经递质（Cloninger）',
  existential: '存在感（Yalom，仅反思成长）',
};

/** 30 特质中文（键名与 CharacterTraits 一一对应，冲突项带群组前缀） */
export const TRAIT_LABELS: Record<keyof CharacterTraits, string> = {
  anxiety: '焦虑', avoidance: '回避', separation_tol: '分离耐受',
  self_worth: '自我价值', world_safety: '世界安全', others_trust: '信任他人',
  reflectiveness: '反思力', analytical: '分析力', creativity: '创造力',
  humor: '幽默', intellectual: '理智化', def_avoidance: '防御回避', support: '支持寻求',
  locus_control: '掌控点', self_esteem: '自尊', self_efficacy: '自我效能',
  enhancement: '自我增益', transcendence: '超越', change: '求变', conservation: '守成',
  warmth: '温暖', directness: '直接', beh_depth: '行为深度', conflict: '冲突倾向', optimism: '乐观',
  serotonin: '血清素', dopamine: '多巴胺', oxytocin: '催产素', cortisol: '皮质醇',
  exist_depth: '存在深度', familiarity: '熟悉感', concern: '关怀',
};

/** 记忆流词法情绪中文（detectEmotion 词表 8 类；LLM 打分可能给出表外词，回显原值） */
export const EMOTION_LABELS: Record<string, string> = {
  happy: '开心', sad: '难过', curious: '好奇', sleepy: '困倦',
  playful: '玩心', focused: '专注', calm: '平静', upset: '烦躁',
};

/** 成长轨迹来源中文（PersonalityGrowth.growthHistory.source 三路驱动） */
const GROWTH_SOURCE_LABELS: Record<string, string> = {
  interaction: '互动微移',
  weekly: '周深更新',
  reflection: '反思成长',
};

/** 情绪中文标签（未知词回显原值） */
export function emotionLabel(emotion: string): string {
  return EMOTION_LABELS[emotion] || emotion;
}

// ---------------- 纯函数（统计/序列构建，可测） ----------------

/** 面板总览统计（从单 json 各段聚合；字段缺失逐项兜底，旧数据直读） */
export interface DashboardStats {
  streamCount: number;
  observationCount: number;
  insightCount: number;
  reflectionCount: number;
  digestCount: number;
  interactionCount: number;
  sessionCount: number;
  trust: number;
  attachment: number;
  emotionalTone: number;
}

export function computeDashboardStats(data: SmartCatData): DashboardStats {
  const stream = (data.memory && Array.isArray(data.memory.stream)) ? data.memory.stream : [];
  let observationCount = 0;
  let insightCount = 0;
  for (const m of stream) {
    if (m.type === 'insight') insightCount++;
    else observationCount++;
  }
  const g = data.personalityGrowth || ({} as SmartCatData['personalityGrowth']);
  return {
    streamCount: stream.length,
    observationCount,
    insightCount,
    reflectionCount: (data.memory?.reflection?.count as number) || 0,
    digestCount: (data.memory?.reflection?.digestCount as number) || 0,
    interactionCount: g.behaviorStats?.interactionCount || 0,
    sessionCount: g.behaviorStats?.sessionCount || 0,
    trust: g.relationship?.trust ?? 0.5,
    attachment: g.relationship?.attachment ?? 0.5,
    emotionalTone: g.behaviorStats?.emotionalTone || 0,
  };
}

/** 情绪演变时间线点（带情绪标注的记忆 → VAD 价价价 + 时间，新→旧，截前 limit 条） */
export interface EmotionTimelinePoint {
  emotion: string;
  valence: number;
  time: number;
  description: string;
}

export function buildEmotionTimeline(stream: MemoryStreamEntry[], limit = 20): EmotionTimelinePoint[] {
  const points = stream
    .filter((m) => !!m.emotion)
    .map((m) => {
      const t = m.created ? new Date(m.created).getTime() : NaN;
      return {
        emotion: m.emotion as string,
        valence: emotionToVAD(m.emotion as string).valence,
        time: Number.isFinite(t) ? t : 0,
        description: m.description || '',
      };
    })
    .filter((p) => p.time > 0);
  points.sort((a, b) => b.time - a.time);
  return points.slice(0, Math.max(1, limit));
}

/** 情绪分布（仅观察计数——洞察是系统产物不算用户情绪痕迹，口径对齐 report.buildWeeklyReportData） */
export function buildEmotionDistribution(stream: MemoryStreamEntry[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const m of stream) {
    if (m.type === 'observation' && m.emotion) dist[m.emotion] = (dist[m.emotion] || 0) + 1;
  }
  return dist;
}

/** 观察来源分布（sourceLabel 中文归并；无来源计「其他」） */
export function buildSourceDistribution(stream: MemoryStreamEntry[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const m of stream) {
    if (m.type !== 'observation') continue;
    const label = sourceLabel(m.source) || '其他';
    dist[label] = (dist[label] || 0) + 1;
  }
  return dist;
}

/** 分布 → 排序行数组（降序） */
export function distributionRows(dist: Record<string, number>): { label: string; count: number }[] {
  return Object.entries(dist)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** 成长轨迹行（growthHistory 归一：时间倒序截前 limit 条；来源中文化 + 详情摘要） */
export interface GrowthTrailRow {
  time: number;
  source: string;
  sourceText: string;
  detail: string;
}

export function buildGrowthTrail(history: any[], limit = 10): GrowthTrailRow[] {
  const rows = (Array.isArray(history) ? history : [])
    .map((h) => ({
      time: typeof h?.timestamp === 'number' ? h.timestamp : NaN,
      source: typeof h?.source === 'string' ? h.source : 'unknown',
      detail: h?.interactionType
        ? String(h.interactionType)
        : Array.isArray(h?.insights)
          ? `${h.insights.length} 条洞察`
          : '',
    }))
    .filter((r) => Number.isFinite(r.time));
  rows.sort((a, b) => b.time - a.time);
  return rows.slice(0, Math.max(1, limit)).map((r) => ({
    time: r.time,
    source: r.source,
    sourceText: GROWTH_SOURCE_LABELS[r.source] || r.source,
    detail: r.detail,
  }));
}

/** 每周懂你报告行（记忆流 source=weekly-report 的洞察，新→旧；文本去【本周懂你报告】前缀） */
export interface WeeklyReportRow {
  time: number;
  text: string;
}

/** 收集每周懂你报告（2026-08-23：从设置弹窗移入数据面板「报告」页签的数据源纯函数） */
export function buildWeeklyReports(stream: MemoryStreamEntry[]): WeeklyReportRow[] {
  return (Array.isArray(stream) ? stream : [])
    .filter((m) => m.type === 'insight' && m.source === 'weekly-report')
    .map((m) => {
      const t = m.created ? new Date(m.created).getTime() : NaN;
      const raw = typeof m.description === 'string' ? m.description : '';
      return { time: Number.isFinite(t) ? t : 0, text: raw.replace(/^【本周懂你报告】/, '') };
    })
    .filter((r) => r.time > 0 && r.text)
    .sort((a, b) => b.time - a.time);
}
// ---------------- DOM 构建辅助 ----------------

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** 截断文本（面板单行展示用） */
export function truncateText(s: string, n: number): string {
  const t = typeof s === 'string' ? s : '';
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/** 数值条行（label + 动态宽度条 + 数值；宽度为动态计算内联，允许） */
function barRow(label: string, value01: number, tone?: 'warm'): HTMLElement {
  const v = Math.round(Math.min(1, Math.max(0, value01)) * 100);
  const row = el('div', 'bz-sc-dash-row');
  row.appendChild(el('span', 'bz-sc-dash-row-name', label));
  const bar = el('div', 'bz-sc-dash-row-bar');
  const fill = el('div', tone === 'warm' ? 'bz-sc-dash-row-fill bz-sc-dash-fill-warm' : 'bz-sc-dash-row-fill');
  fill.style.width = `${v}%`;
  bar.appendChild(fill);
  row.appendChild(bar);
  row.appendChild(el('span', 'bz-sc-dash-row-val', String(v)));
  return row;
}

/** 卡片（标题 + 可选内容容器） */
function card(title: string): { root: HTMLElement; body: HTMLElement } {
  const root = el('div', 'bz-sc-dash-card');
  if (title) root.appendChild(el('div', 'bz-sc-dash-card-title', title));
  const body = el('div', 'bz-sc-dash-card-body');
  root.appendChild(body);
  return { root, body };
}

/** 统计块 */
function statBlock(num: string | number, label: string): HTMLElement {
  const s = el('div', 'bz-sc-dash-stat');
  s.appendChild(el('div', 'bz-sc-dash-stat-num', String(num)));
  s.appendChild(el('div', 'bz-sc-dash-stat-label', label));
  return s;
}

function emptyHint(text: string): HTMLElement {
  return el('div', 'bz-sc-dash-empty', text);
}

// ---------------- 四页签渲染 ----------------

const PANE_KEYS = ['overview', 'emotion', 'personality', 'memory', 'report'] as const;
type PaneKey = (typeof PANE_KEYS)[number];
const TAB_LABELS: Record<PaneKey, string> = {
  overview: '总览',
  emotion: '情绪',
  personality: '人格',
  memory: '记忆',
  report: '报告',
};

function renderOverview(pane: HTMLElement, data: SmartCatData): void {
  pane.innerHTML = '';
  const pad = data.mood?.pad || { pleasure: 50, arousal: 50, dominance: 50 };
  const level = moodLevelFromPad(pad);
  const moodMeta = MOOD_MAP[level] || MOOD_MAP.neutral;

  // 英雄区：当前心情档位 + 瞬时情绪
  const hero = el('div', 'bz-sc-dash-card bz-sc-dash-hero');
  const emoji = el('span', 'bz-sc-dash-hero-emoji', moodMeta.emoji);
  const main = el('div', 'bz-sc-dash-hero-main');
  main.appendChild(el('div', 'bz-sc-dash-hero-state', moodMeta.state));
  const lastUpdate = data.mood?.lastUpdate || 0;
  main.appendChild(el(
    'div',
    'bz-sc-dash-hero-sub',
    lastUpdate ? `心情更新于 ${formatRelativeTime(new Date(lastUpdate).toISOString())}` : '心情尚未更新',
  ));
  const emo = data.mood?.currentEmotion;
  main.appendChild(el('span', 'bz-sc-dash-chip', emo ? `瞬时情绪：${emotionLabel(emo)}` : '暂无瞬时情绪'));
  hero.appendChild(emoji);
  hero.appendChild(main);
  pane.appendChild(hero);

  // PAD 三轴
  const padCard = card('心情潮汐（PAD 三维）');
  padCard.body.appendChild(barRow('愉悦', pad.pleasure / 100));
  padCard.body.appendChild(barRow('唤醒', pad.arousal / 100));
  padCard.body.appendChild(barRow('支配', pad.dominance / 100));
  pane.appendChild(padCard.root);

  // 情绪趋势一句话
  const trend = analyzeEmotionTrend(buildEmotionSnapshots(data.memory?.stream || []));
  const trendCard = card('近期情绪观察');
  trendCard.body.appendChild(el('div', 'bz-sc-dash-trend-text', describeEmotionTrend(trend)));
  pane.appendChild(trendCard.root);

  // 相处统计
  const st = computeDashboardStats(data);
  const stats = el('div', 'bz-sc-dash-stats');
  stats.appendChild(statBlock(st.streamCount, '记忆'));
  stats.appendChild(statBlock(st.insightCount, '洞察'));
  stats.appendChild(statBlock(st.reflectionCount, '反思次数'));
  stats.appendChild(statBlock(Math.round(st.trust * 100) + '%', '信任'));
  stats.appendChild(statBlock(Math.round(st.attachment * 100) + '%', '依恋'));
  stats.appendChild(statBlock(st.interactionCount, '互动次数'));
  const statCard = card('相处数据');
  statCard.body.appendChild(stats);
  pane.appendChild(statCard.root);
}

function renderEmotion(pane: HTMLElement, data: SmartCatData): void {
  pane.innerHTML = '';
  const stream = data.memory?.stream || [];

  // 趋势/波动度
  const trend = analyzeEmotionTrend(buildEmotionSnapshots(stream));
  const trendCard = card(`情绪趋势（${trend.count} 条情绪记录）`);
  trendCard.body.appendChild(el('div', 'bz-sc-dash-trend-text', describeEmotionTrend(trend)));
  trendCard.body.appendChild(el(
    'div',
    'bz-sc-dash-trend-meta',
    `波动度 ${trend.volatility.toFixed(2)}（≥0.5 视为高波动）`,
  ));
  pane.appendChild(trendCard.root);

  // 情绪分布
  const distRows = distributionRows(buildEmotionDistribution(stream)).slice(0, 8);
  const distCard = card('情绪分布');
  if (distRows.length) {
    const max = distRows[0].count;
    for (const r of distRows) {
      const row = barRow(emotionLabel(r.label), max > 0 ? r.count / max : 0);
      (row.querySelector('.bz-sc-dash-row-name') as HTMLElement).classList.add('bz-sc-dash-row-name--sm');
      row.appendChild(el('span', 'bz-sc-dash-row-count', `${r.count} 次`));
      distCard.body.appendChild(row);
    }
  } else {
    distCard.body.appendChild(emptyHint('还没有带情绪标注的记忆——和小橘聊天、写日记都会有情绪记录。'));
  }
  pane.appendChild(distCard.root);

  // 演变时间线（新→旧）
  const tl = buildEmotionTimeline(stream, 20);
  const tlCard = card('情绪演变时间线');
  if (tl.length) {
    const wrap = el('div', 'bz-sc-dash-timeline');
    for (const p of tl) {
      const item = el('div', `bz-sc-dash-tl-item ${p.valence > 0.1 ? 'pos' : p.valence < -0.1 ? 'neg' : 'neu'}`);
      item.appendChild(el('span', 'bz-sc-dash-tl-time', formatRelativeTime(new Date(p.time).toISOString())));
      item.appendChild(el('span', 'bz-sc-dash-tl-emo', emotionLabel(p.emotion)));
      item.appendChild(el('span', 'bz-sc-dash-tl-desc', truncateText(p.description, 60)));
      wrap.appendChild(item);
    }
    tlCard.body.appendChild(wrap);
  } else {
    tlCard.body.appendChild(emptyHint('暂无情绪演变数据。'));
  }
  pane.appendChild(tlCard.root);
}

function renderPersonality(pane: HTMLElement, data: SmartCatData): void {
  pane.innerHTML = '';
  const g = data.personalityGrowth;

  // 感情（关系张量）
  const rel = g?.relationship || { trust: 0.5, attachment: 0.5 };
  const relCard = card('感情（关系张量）');
  relCard.body.appendChild(barRow('信任', rel.trust, 'warm'));
  relCard.body.appendChild(barRow('依恋', rel.attachment, 'warm'));
  const tone = g?.behaviorStats?.emotionalTone || 0;
  relCard.body.appendChild(barRow('情绪基调', (tone + 1) / 2, 'warm'));
  relCard.body.appendChild(el(
    'div',
    'bz-sc-dash-hint',
    `情绪基调 ${tone >= 0 ? '+' : ''}${tone.toFixed(2)}（-1 冷淡 ~ +1 温暖）；信任/依恋随相处缓慢生长。`,
  ));
  pane.appendChild(relCard.root);

  // OCEAN 出生种子
  const ocean = g?.ocean;
  const oceanCard = card('人格底色（OCEAN 出生种子，落盘后固定）');
  if (ocean) {
    for (const [k, label] of Object.entries(OCEAN_LABELS)) {
      oceanCard.body.appendChild(barRow(label, (ocean as any)[k] ?? 0.5));
    }
  } else {
    oceanCard.body.appendChild(emptyHint('尚无 OCEAN 数据。'));
  }
  pane.appendChild(oceanCard.root);

  // 30 特质九群组
  const traits = g?.traits;
  const traitCard = card('特质成长（30 特质 · 随相处与反思演化）');
  if (traits) {
    for (const [group, keys] of Object.entries(TRAIT_GROUPS)) {
      traitCard.body.appendChild(el('div', 'bz-sc-dash-group-title', TRAIT_GROUP_LABELS[group] || group));
      for (const key of keys as readonly (keyof CharacterTraits)[]) {
        traitCard.body.appendChild(barRow(TRAIT_LABELS[key] || key, (traits as any)[key] ?? 0));
      }
    }
  } else {
    traitCard.body.appendChild(emptyHint('尚无特质数据。'));
  }
  pane.appendChild(traitCard.root);

  // 成长轨迹
  const trail = buildGrowthTrail(g?.growthHistory || [], 10);
  const trailCard = card('成长轨迹（最近驱动事件）');
  if (trail.length) {
    for (const r of trail) {
      const row = el('div', 'bz-sc-dash-trail-row');
      row.appendChild(el('span', 'bz-sc-dash-tl-time', formatRelativeTime(new Date(r.time).toISOString())));
      row.appendChild(el('span', 'bz-sc-dash-badge bz-sc-dash-badge-growth', r.sourceText));
      if (r.detail) row.appendChild(el('span', 'bz-sc-dash-tl-desc', truncateText(r.detail, 24)));
      trailCard.body.appendChild(row);
    }
  } else {
    trailCard.body.appendChild(emptyHint('还没有成长记录——互动、反思与周深更新都会留痕。'));
  }
  pane.appendChild(trailCard.root);
}

function renderMemory(pane: HTMLElement, data: SmartCatData): void {
  pane.innerHTML = '';
  const stream = data.memory?.stream || [];
  const refl = data.memory?.reflection || ({} as SmartCatData['memory']['reflection']);

  // 统计
  const st = computeDashboardStats(data);
  const stats = el('div', 'bz-sc-dash-stats');
  stats.appendChild(statBlock(st.streamCount, '记忆总数'));
  stats.appendChild(statBlock(st.observationCount, '观察'));
  stats.appendChild(statBlock(st.insightCount, '洞察'));
  stats.appendChild(statBlock(st.digestCount || 0, '日小结次数'));
  const statCard = card('记忆流');
  statCard.body.appendChild(stats);
  const lastReflect = typeof refl.lastReflectAt === 'number' && refl.lastReflectAt > 0
    ? formatRelativeTime(new Date(refl.lastReflectAt).toISOString())
    : '从未';
  const lastDigest = typeof refl.lastDigestAt === 'number' && refl.lastDigestAt > 0
    ? formatRelativeTime(new Date(refl.lastDigestAt).toISOString())
    : '从未';
  statCard.body.appendChild(el(
    'div',
    'bz-sc-dash-hint',
    `上次反思：${lastReflect}（共 ${st.reflectionCount} 次）· 上次日小结：${lastDigest}。`,
  ));
  pane.appendChild(statCard.root);

  // 作息分布（24h 直方图；柱高为动态计算内联）
  const rhythm = buildRhythmProfile(stream, 30);
  const rhythmCard = card('作息分布（近 30 天活跃小时）');
  if (rhythm.total > 0) {
    const chart = el('div', 'bz-sc-dash-rhythm');
    const peakVal = Math.max(...rhythm.buckets, 1);
    rhythm.buckets.forEach((c, h) => {
      const colWrap = el('div', 'bz-sc-dash-rhythm-slot');
      const col = el('div', `bz-sc-dash-rhythm-col${rhythm.activeHours.includes(h) ? ' active' : ''}`);
      col.style.height = c > 0 ? `${Math.max(6, Math.round((c / peakVal) * 100))}%` : '2px';
      col.title = `${h} 点：${c} 条`;
      colWrap.appendChild(col);
      chart.appendChild(colWrap);
    });
    rhythmCard.body.appendChild(chart);
    const hours = el('div', 'bz-sc-dash-rhythm-hours');
    for (let h = 0; h < 24; h += 3) hours.appendChild(el('span', '', `${h}`));
    rhythmCard.body.appendChild(hours);
    rhythmCard.body.appendChild(el(
      'div',
      'bz-sc-dash-hint',
      `活跃时段：${describeRhythm(rhythm)}；峰值 ${rhythm.peakHour} 点。`,
    ));
  } else {
    rhythmCard.body.appendChild(emptyHint('还没有足够记忆刻画作息。'));
  }
  pane.appendChild(rhythmCard.root);

  // 来源分布
  const srcRows = distributionRows(buildSourceDistribution(stream)).slice(0, 6);
  const srcCard = card('记忆来源分布');
  if (srcRows.length) {
    const max = srcRows[0].count;
    for (const r of srcRows) {
      const row = barRow(r.label, max > 0 ? r.count / max : 0);
      (row.querySelector('.bz-sc-dash-row-name') as HTMLElement).classList.add('bz-sc-dash-row-name--sm');
      row.appendChild(el('span', 'bz-sc-dash-row-count', `${r.count} 条`));
      srcCard.body.appendChild(row);
    }
  } else {
    srcCard.body.appendChild(emptyHint('暂无观察来源。'));
  }
  pane.appendChild(srcCard.root);

  // 最近记忆列表（新→旧，截前 30 条）
  const listCard = card('最近记忆');
  if (stream.length) {
    const list = el('div', 'bz-sc-dash-list');
    const recent = [...stream].reverse().slice(0, 30);
    for (const m of recent) {
      const item = el('div', 'bz-sc-dash-memory');
      const meta = el('div', 'bz-sc-dash-memory-meta');
      meta.appendChild(el(
        'span',
        `bz-sc-dash-badge ${m.type === 'insight' ? 'insight' : 'observation'}`,
        m.type === 'insight' ? '洞察' : '观察',
      ));
      const src = sourceLabel(m.source);
      if (src) meta.appendChild(el('span', '', src));
      if (m.created) meta.appendChild(el('span', '', formatRelativeTime(m.created)));
      meta.appendChild(el('span', '', `重要度 ${Math.round((m.importance ?? 0) * 100)}`));
      item.appendChild(meta);
      item.appendChild(el('div', 'bz-sc-dash-memory-text', truncateText(m.description, 80)));
      list.appendChild(item);
    }
    listCard.body.appendChild(list);
  } else {
    listCard.body.appendChild(emptyHint('还没有记忆——和小橘聊聊天、写写日记吧。'));
  }
  pane.appendChild(listCard.root);
}

/** 报告页签（2026-08-23：每周懂你报告从设置弹窗移入——最新一期全文 + 历史报告） */
function renderReport(pane: HTMLElement, data: SmartCatData): void {
  pane.innerHTML = '';
  const reports = buildWeeklyReports(data.memory?.stream || []);

  // 最新一期全文
  const latestCard = card('本周懂你报告');
  if (reports.length) {
    const body = el('div', 'bz-sc-dash-report-text', reports[0].text);
    latestCard.body.appendChild(body);
    latestCard.body.appendChild(el(
      'div',
      'bz-sc-dash-hint',
      `生成于 ${formatRelativeTime(new Date(reports[0].time).toISOString())}；小橘每周二（本周有观察后）自动总结你的这一周。`,
    ));
  } else {
    latestCard.body.appendChild(emptyHint('本周报告还没生成。小橘会在每周二（本周有观察后）自动总结你的这一周，多写写日记/闪念让我更懂你。'));
  }
  pane.appendChild(latestCard.root);

  // 历史报告
  const histCard = card('历史报告');
  if (reports.length > 1) {
    const wrap = el('div', 'bz-sc-dash-list');
    for (const r of reports.slice(1)) {
      const item = el('div', 'bz-sc-dash-memory');
      item.appendChild(el('div', 'bz-sc-dash-memory-meta', formatRelativeTime(new Date(r.time).toISOString())));
      item.appendChild(el('div', 'bz-sc-dash-memory-text', truncateText(r.text, 120)));
      wrap.appendChild(item);
    }
    histCard.body.appendChild(wrap);
  } else {
    histCard.body.appendChild(emptyHint(reports.length ? '还没有更早的报告。' : '还没有历史报告。'));
  }
  pane.appendChild(histCard.root);
}
// ---------------- 面板开关（bz 主窗口规范） ----------------

interface DashboardState {
  app: App;
  mask: HTMLElement;
  popup: HTMLElement;
  panes: Record<PaneKey, HTMLElement>;
  tabs: Record<PaneKey, HTMLElement>;
  activeTab: PaneKey;
  escHandle: { unregister: () => void };
}

let dashState: DashboardState | null = null;

/** 切页签（display 显隐 + active 类，功能性内联仅此） */
function activateTab(key: PaneKey): void {
  if (!dashState) return;
  dashState.activeTab = key;
  for (const k of PANE_KEYS) {
    dashState.tabs[k].classList.toggle('active', k === key);
    dashState.panes[k].style.display = k === key ? 'block' : 'none';
  }
}

/** 重渲染全部页签（打开/刷新共用；数据现读现渲染） */
function renderPanes(data: SmartCatData): void {
  if (!dashState) return;
  renderOverview(dashState.panes.overview, data);
  renderEmotion(dashState.panes.emotion, data);
  renderPersonality(dashState.panes.personality, data);
  renderMemory(dashState.panes.memory, data);
  renderReport(dashState.panes.report, data);
}

/**
 * 打开小橘数据面板（命令 bz-smartcat-dashboard 回调）。
 * 幂等：重复调用先关旧再开新（数据重读）。只读——不写 smartcat.json。
 */
export async function openSmartcatDashboard(app: App): Promise<void> {
  closeSmartcatDashboard();
  let data: SmartCatData;
  try {
    data = await loadSmartCatData(app);
  } catch (e) {
    notice('小橘数据读取失败', 'error');
    return;
  }

  const { mask, popup } = createOverlay({
    maskId: 'smartcat-dashboard-mask',
    popupId: 'smartcat-dashboard-panel',
    zIndex: 9996,
    onMaskClick: () => closeSmartcatDashboard(),
    width: '94%',
    maxWidth: 720,
  });
  popup.style.maxHeight = '82vh';
  popup.style.flexDirection = 'column';

  // 头行（按钮秩序：功能 🔄 → ❌ 关闭；样式由 .bz-win-head 统一规范承接）
  const header = document.createElement('div');
  header.className = 'bz-win-head';
  const title = el('h3', '', '小橘数据面板');
  const btns = el('div', '');
  const refreshBtn = el('button', '', '🔄');
  refreshBtn.id = 'smartcat-dash-refresh';
  refreshBtn.title = '刷新数据';
  const closeBtn = el('button', 'bz-win-close', '❌');
  closeBtn.id = 'smartcat-dash-close';
  closeBtn.title = '关闭';
  btns.appendChild(refreshBtn);
  btns.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(btns);
  popup.appendChild(header);

  // 页签栏
  const tabBar = el('div', 'bz-sc-dash-tabs');
  const tabs = {} as Record<PaneKey, HTMLElement>;
  const panes = {} as Record<PaneKey, HTMLElement>;
  const body = el('div', 'bz-sc-dash-body');
  for (const key of PANE_KEYS) {
    const tab = el('button', 'bz-sc-dash-tab', TAB_LABELS[key]);
    tab.dataset.tab = key;
    tab.addEventListener('click', () => activateTab(key));
    tabBar.appendChild(tab);
    tabs[key] = tab;
    const pane = el('div', 'bz-sc-dash-pane');
    pane.dataset.pane = key;
    panes[key] = pane;
    body.appendChild(pane);
  }
  popup.appendChild(tabBar);
  popup.appendChild(body);

  document.body.appendChild(mask);
  document.body.appendChild(popup);

  dashState = { app, mask, popup, panes, tabs, activeTab: 'overview', escHandle: null as any };
  renderPanes(data);
  activateTab('overview');

  // 移动端默认全屏（ticket 68 规范三件事之二：打开路径必经处应用；
  //  2026-08-23 合并一套：跟随聊天/设置面板共用的 smartcatMobileDefaultFullscreen 开关）
  applyMobileWindowFullscreen(popup, tryGetSettings().smartcatMobileDefaultFullscreen === true);

  mask.style.display = 'block';
  popup.style.display = 'flex';

  // 刷新：重读 smartcat.json 并重渲染（保持当前页签）
  refreshBtn.addEventListener('click', async () => {
    if (!dashState) return;
    try {
      const fresh = await loadSmartCatData(dashState.app);
      renderPanes(fresh);
      notice('小橘数据已刷新', 'success');
    } catch (e) {
      notice('小橘数据读取失败', 'error');
    }
  });
  closeBtn.addEventListener('click', () => closeSmartcatDashboard());

  const escHandle = escManager.register('smartcat-dashboard', {
    isVisible: () => !!dashState && dashState.popup.isConnected,
    close: () => closeSmartcatDashboard(),
  });
  dashState.escHandle = escHandle;
}

/** 关闭面板并解除 ESC（unloadSmartCat 全量清理时调用） */
export function closeSmartcatDashboard(): void {
  if (!dashState) return;
  dashState.mask.remove();
  dashState.popup.remove();
  try {
    dashState.escHandle?.unregister();
  } catch (e) { /* 句柄可能已失效 */ }
  dashState = null;
}