/**
 * 小橘数据面板（ticket 071）：只读可视化 smartcat.json 全量状态——
 * 总览 / 情绪 / 人格 / 记忆 / 报告 五页签，让用户全面直观看到小橘的具体状态以及演变过程：
 *  - 总览：当前心情 5 档（PAD 最近邻）+ 瞬时情绪 + PAD 三轴 + 相处统计；
 *  - 情绪：趋势/波动度（VAD+EMA，cognitive 纯函数复用）+ 情绪分布 + 演变时间线；
 *  - 人格：OCEAN 五因素 + 30 特质九群组 + 关系张量（感情：信任/依恋）+ 成长轨迹；
 *  - 记忆：记忆流统计 + 作息分布（24h 直方图）+ 来源分布 + 最近记忆列表；
 *  - 报告（2026-08-23 用户拍板：每周懂你报告从设置弹窗移入）：最新一期全文 + 历史报告。
 * 数据经 loadSmartCatData 现读现渲染（与常驻猫实例解耦，smartcatEnabled=false 也可看）；
 * 面板只读，唯二例外（092 方向二 v4 裁决：人工修正信号保留）——洞察行的「固定/废弃」按钮，
 * 经常驻实例通道原位修正 + 统一 dataSaver 落盘（pinned / supersededBy='manual'；P1-29）；其余一律不写。UI 走 bz 主窗口规范：
 * createOverlay + .bz-win-head + applyMobileWindowFullscreen + escManager；视觉样式全部静态进域内
 * styles.css（铁律 9，内联仅限显隐与动态高度/宽度）。命令入口：bz-smartcat-dashboard（main.ts COMMANDS 表）。
 * 097 升级（纯展示层+口径统一，不改任何数据写入逻辑）：A1 成长轨迹归因徽标/LLM 引用原文；
 * A2 安静陪伴 chip；A3 情绪页标注覆盖率小字；B1 感情卡依恋切 lazyAttachment 读侧视图与总览口径对齐；
 * B2 洞察行 theme chip + 已被推翻/已固定视觉态；C1 删除手动 🔄 刷新按钮，改 vault modify 命中
 * smartcat.json/memo.json 后防抖 3s 的静默自动刷新（保持页签、失败保旧画面、绝不 toast；
 * 本模块无 Component 宿主，监听以 vault.on 返回 EventRef 注册、close 时 offref 全量清理，
 * 与 registerEvent 清理语义等价）。
 */
import type { App } from 'obsidian';
import { MarkdownRenderer, Component } from 'obsidian';
import { notice } from '../core/notice';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { loadSmartCatData, getSmartcatFilePath } from './data';
import { readMemorySidecarFile, readBehaviorSidecarFile } from './memory';

/** 面板现读（ADR-0069）：smartcat.json 已不含双流——合并 memory/behavior sidecar 后再渲染，
 *  与常驻实例解耦的「现读」语义保持，只是数据源扩为三文件 */
async function loadDashboardData(app: App): Promise<SmartCatData> {
  const data = await loadSmartCatData(app);
  try {
    const [memSide, behSide] = await Promise.all([readMemorySidecarFile(app), readBehaviorSidecarFile(app)]);
    if (memSide && Array.isArray(memSide.entries)) data.memory.memoryStream = memSide.entries;
    if (behSide && Array.isArray(behSide.items)) data.memory.behaviorStream = behSide.items;
  } catch { /* sidecar 读取失败回退主文件（恒空双流），面板不崩 */ }
  return data;
}
import { MOOD_MAP, moodLevelFromPad } from './mood';
import { TRAIT_GROUPS } from './character';
import { sourceLabel, formatRelativeTime, emotionDensityStats } from './memory';
import { noteMemoryDiaryDate } from './note-memory';
// ticket 163：来源分布按「记忆目录」的追查目录分行（标签随设置走）
import { normalizeMemoryDirectories } from './config';
import { parseFile } from '../diary/parser';
import { buildInsightShortIndex, isSupersededInsight, MANUAL_SUPERSEDED_BY, sanitizeInsightTheme } from './insight-version';
import { lazyAttachment, buildAbsenceCard } from './absence'; // ticket 093：读侧依恋视图 + 缺席状态卡
import { readQuietMode } from './quiet-gate'; // ticket 095：安静陪伴期状态（097 A2 chip 只读消费）
import {
  analyzeEmotionTrend,
  buildEmotionSnapshots,
  describeEmotionTrend,
  emotionToVAD,
} from './cognitive';
import { buildRhythmProfile, describeRhythm } from './rhythm';
import {
  getDossierEvents,
  deriveTimeline,
  countCompanionDays,
  detectEmotionShiftDays,
  buildDossierNarratives,
} from './dossier';
import type { SmartCatData, MemoryStreamEntry, CharacterTraits, OceanProfile, BehaviorItem } from './types';
import { buildBehaviorWording, behaviorActionWord } from './behavior-wording';

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
const EMOTION_LABELS: Record<string, string> = {
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
  const stream = (data.memory && Array.isArray(data.memory.memoryStream)) ? data.memory.memoryStream : [];
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
    // ticket 093（方向七裁决）：依恋展示走读侧惰性视图——分离衰减只影响读取视图，
    // 不写盘不漂移；旧数据无 lastPresenceAt → 原样返回存储基线（缺省容忍）
    attachment: lazyAttachment(g.relationship?.attachment ?? 0.5, data.editingData?.lastPresenceAt, Date.now()),
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

/** 情绪分布（仅观察计数——洞察是系统产物不算用户情绪痕迹；ticket 160 起周报只吃洞察，此口径仅面板统计使用） */
export function buildEmotionDistribution(stream: MemoryStreamEntry[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const m of stream) {
    if (m.type === 'observation' && m.emotion) dist[m.emotion] = (dist[m.emotion] || 0) + 1;
  }
  return dist;
}

/**
 * 追查目录标签（ticket 163）：source=note 的引用型条目按「记忆目录」的追踪目录分行——
 * ref 路径（或 description 中的路径段）匹配已配置记忆目录（前缀语义，首个命中），
 * 命中 → 返回该配置目录；未命中/未传目录 → null（调用方回退「记忆目录」旧标签）。
 * 纯函数（可测）：与 note-memory.resolveOwnerDir 同语义，仅服务展示层标签。
 */
export function resolveTrackedDirLabel(m: MemoryStreamEntry, dirs?: string[]): string | null {
  if (!m || m.source !== 'note') return null;
  const list = Array.isArray(dirs) && dirs.length ? dirs : null;
  if (!list) return null;
  const path = (m.ref && typeof m.ref.path === 'string' ? m.ref.path : '')
    || (typeof m.description === 'string' ? m.description.split('#')[0] : '');
  if (!path) return null;
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const p = norm(path);
  for (const dir of list) {
    const d = norm(dir);
    if (d === '' || p === d || p.startsWith(d + '/')) return dir;
  }
  return null;
}

/**
 * 记忆来源分布（ticket 163 口径升级）：
 *  - 洞察（type=insight，系统产物）按「洞察」单列一行计入；
 *  - source=note 的引用条目按追查目录分行（dirs 传记忆目录配置）；未传/未命中回退「记忆目录」；
 *  - 其余观察按 sourceLabel 中文归并（行为小结 source=digest → 「行为小结」行保留）；无来源计「其他」。
 */
export function buildSourceDistribution(stream: MemoryStreamEntry[], dirs?: string[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const m of stream) {
    if (m.type === 'insight') {
      dist['洞察'] = (dist['洞察'] || 0) + 1;
      continue;
    }
    if (m.type !== 'observation') continue;
    const dirLabel = resolveTrackedDirLabel(m, dirs);
    const label = dirLabel ?? (sourceLabel(m.source) || '其他');
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

/** 标注覆盖率小字样本阈值（097 A3）：观察样本不足此数只报条数不显百分比（小样本不宣称比例） */
const EMOTION_COVERAGE_MIN_SAMPLES = 5;

/**
 * 情绪页标注覆盖率文案（097 A3 纯函数）：复用 096 emotionDensityStats 口径，纯读展示零交互——
 * 观察样本 ≥5 条 → 「情绪标注覆盖 X%（非 calm 占比 Y%）」；<5 条只显示各计数不显百分比。
 */
export function describeEmotionCoverage(stream: MemoryStreamEntry[]): string {
  const s = emotionDensityStats(stream);
  if (s.observations < EMOTION_COVERAGE_MIN_SAMPLES) {
    return `情绪标注：样本 ${s.observations} 条，已标注 ${s.annotated} 条（非 calm ${s.nonCalm} 条）`;
  }
  return `情绪标注覆盖 ${Math.round(s.coverage * 100)}%（非 calm 占比 ${Math.round(s.nonCalmShare * 100)}%）`;
}

/**
 * 成长轨迹行（growthHistory 归一：时间倒序截前 limit 条；来源中文化 + 详情摘要）。
 * 097 A1 扩展：mode/quote 出自 091 归因条目 attribution{mode,quote?}——
 * mode 仅接受 'llm'|'lexical' 枚举（旧数据缺 attribution / 非法值 → undefined，行内不显归因徽标）；
 * quote 仅 mode=llm 且非空字符串才有值（词法推断一律不带解释文案——不产伪解释）。
 */
export interface GrowthTrailRow {
  time: number;
  source: string;
  sourceText: string;
  detail: string;
  /** 归因模式（缺 attribution 的旧数据 → undefined 不显示徽标） */
  mode?: 'llm' | 'lexical';
  /** LLM 引用原文片段（仅 llm 且非空；渲染截 ~30 字） */
  quote?: string;
}

export function buildGrowthTrail(history: any[], limit = 10): GrowthTrailRow[] {
  const rows = (Array.isArray(history) ? history : [])
    .map((h) => {
      const attr = h?.attribution;
      const mode: 'llm' | 'lexical' | undefined =
        attr?.mode === 'llm' || attr?.mode === 'lexical' ? attr.mode : undefined;
      return {
        time: typeof h?.timestamp === 'number' ? h.timestamp : NaN,
        source: typeof h?.source === 'string' ? h.source : 'unknown',
        detail: h?.interactionType
          ? String(h.interactionType)
          : Array.isArray(h?.insights)
            ? `${h.insights.length} 条洞察`
            : '',
        mode,
        quote: mode === 'llm' && typeof attr?.quote === 'string' && attr.quote ? attr.quote : undefined,
      };
    })
    .filter((r) => Number.isFinite(r.time));
  rows.sort((a, b) => b.time - a.time);
  return rows.slice(0, Math.max(1, limit)).map((r) => ({
    time: r.time,
    source: r.source,
    sourceText: GROWTH_SOURCE_LABELS[r.source] || r.source,
    detail: r.detail,
    mode: r.mode,
    quote: r.quote,
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

/** 分布卡（情绪/来源两卡共用骨架）：rows 为降序计数行（调用方截前 N），行 = 小字名称条 + 计数；空表给提示 */
function distributionCard(
  title: string,
  rows: { label: string; count: number }[],
  opts: { unit: string; labelOf?: (label: string) => string; emptyText: string },
): { root: HTMLElement; body: HTMLElement } {
  const c = card(title);
  if (rows.length) {
    const max = rows[0].count;
    for (const r of rows) {
      const row = barRow(opts.labelOf ? opts.labelOf(r.label) : r.label, max > 0 ? r.count / max : 0);
      (row.querySelector('.bz-sc-dash-row-name') as HTMLElement).classList.add('bz-sc-dash-row-name--sm');
      row.appendChild(el('span', 'bz-sc-dash-row-count', `${r.count} ${opts.unit}`));
      c.body.appendChild(row);
    }
  } else {
    c.body.appendChild(emptyHint(opts.emptyText));
  }
  return c;
}

// ---------------- 页签渲染（P3 新增行为） ----------------

const PANE_KEYS_ALL = ['overview', 'emotion', 'personality', 'memory', 'report', 'behavior'] as const;
type PaneKey = (typeof PANE_KEYS_ALL)[number];
const TAB_LABELS: Record<PaneKey, string> = {
  overview: '总览',
  emotion: '情绪',
  personality: '人格',
  memory: '记忆',
  report: '报告',
  behavior: '行为',
};

/** 根据设置决定可见页签（showBehaviorLog=false 时隐藏行为页签） */
function getVisiblePaneKeys(): PaneKey[] {
  const s = tryGetSettings() as any;
  const keys: PaneKey[] = ['overview', 'emotion', 'personality', 'memory', 'report'];
  if (s?.showBehaviorLog !== false) keys.push('behavior');
  return keys;
}

/** memo.json 路径（跟随共享 storagePath；loadMemoTitlesByDay 与 C1 自动刷新监听共用） */
function memoDataPath(): string {
  const s = tryGetSettings() as any;
  const dir = ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/memo.json`;
}

/** memo.json 当日备忘标题表（「一起的日子」关键时刻用；dayKey → titles；读失败静默空表——零新增持久化） */
async function loadMemoTitlesByDay(app: App): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  try {
    const f = app.vault.getAbstractFileByPath(memoDataPath());
    if (!f) return map;
    const raw = JSON.parse(await app.vault.read(f as any));
    for (const it of Array.isArray(raw) ? raw : []) {
      if (!it || typeof it.title !== 'string' || !it.title) continue;
      const created = typeof it.created === 'string' ? it.created : '';
      const dk = created.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) continue;
      const arr = map.get(dk);
      if (arr) arr.push(it.title);
      else map.set(dk, [it.title]);
    }
  } catch (e) { /* 备忘读取失败静默（关键时刻只少备忘行） */ }
  return map;
}

function renderOverview(pane: HTMLElement, data: SmartCatData, memoTitles: Map<string, string[]>): void {
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
  // 安静陪伴期可见化（097 A2，095 quietMode 只读消费）：on 才渲染该元素（非 quiet 态不留占位）
  if (readQuietMode(data.editingData).on) {
    main.appendChild(el('span', 'bz-sc-dash-chip bz-sc-dash-chip-quiet', '安静陪伴中'));
  }
  hero.appendChild(emoji);
  hero.appendChild(main);
  pane.appendChild(hero);

  // ticket 093：缺席状态卡（自我事件直接呈现——表达先于数值，体验原则 3）
  pane.appendChild(buildAbsenceCard(data));

  // PAD 三轴
  const padCard = card('心情潮汐（PAD 三维）');
  padCard.body.appendChild(barRow('愉悦', pad.pleasure / 100));
  padCard.body.appendChild(barRow('唤醒', pad.arousal / 100));
  padCard.body.appendChild(barRow('支配', pad.dominance / 100));
  pane.appendChild(padCard.root);

  // 情绪趋势一句话
  const trend = analyzeEmotionTrend(buildEmotionSnapshots(data.memory?.memoryStream || []));
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

  // 「一起的日子」（ticket 094 方向八：事件表重放 + 低活跃兜底 + 情绪标签变化日）
  pane.appendChild(buildDossierCard(data, memoTitles));
}

/**
 * 「一起的日子」区块（ticket 094 设计第 8 条）：
 * 时间线 = deriveTimeline(dossierEvents) 纯函数重放（周聚合模板文案，最新在前）；
 * 首行恒为兜底统计（陪伴天数 + 正性事件计数，低活跃也有内容）；附最新叙事（可选 LLM 产物）
 * 与关键时刻（情绪标签变化日 + 当日备忘）。只读不写。
 */
function buildDossierCard(data: SmartCatData, memoTitles: Map<string, string[]>): HTMLElement {
  const dossierCard = card('一起的日子');
  const stream = data.memory?.memoryStream || [];
  const events = getDossierEvents(data);
  const rows = deriveTimeline(events, { companionDays: countCompanionDays(stream) });
  // 兜底统计行（恒在）
  const summary = rows.find((r) => r.kind === 'summary');
  if (summary) dossierCard.body.appendChild(el('div', 'bz-sc-dash-dossier-summary', summary.lines[0]));
  // 周时间线（截前 8 周）
  const weekRows = rows.filter((r) => r.kind === 'week').slice(0, 8);
  if (weekRows.length) {
    const wrap = el('div', 'bz-sc-dash-dossier-tl');
    for (const r of weekRows) {
      const item = el('div', 'bz-sc-dash-dossier-week');
      item.appendChild(el('span', 'bz-sc-dash-tl-time', r.title));
      item.appendChild(el('span', 'bz-sc-dash-tl-desc', r.lines.join(' ')));
      wrap.appendChild(item);
    }
    dossierCard.body.appendChild(wrap);
  }
  // 最新叙事摘要（可选 LLM 润色产物；无则省略整行）
  const narratives = buildDossierNarratives(stream);
  if (narratives.length) {
    const nRow = el('div', 'bz-sc-dash-dossier-narrative');
    nRow.appendChild(el('div', 'bz-sc-dash-group-title', '小橘的记忆'));
    nRow.appendChild(el('div', 'bz-sc-dash-report-text', truncateText(narratives[0].text, 160)));
    dossierCard.body.appendChild(nRow);
  }
  // 关键时刻：情绪标签变化日 + 当日备忘（现算现显，零新增持久化）
  const shifts = detectEmotionShiftDays(stream).slice(-3).reverse();
  if (shifts.length) {
    const kt = el('div', 'bz-sc-dash-dossier-moments');
    kt.appendChild(el('div', 'bz-sc-dash-group-title', '关键时刻'));
    for (const s of shifts) {
      const row = el('div', 'bz-sc-dash-trail-row');
      row.appendChild(el('span', 'bz-sc-dash-tl-time', s.dayKey));
      row.appendChild(el('span', 'bz-sc-dash-badge bz-sc-dash-badge-growth', `情绪转向「${emotionLabel(s.emotion)}」`));
      const memos = memoTitles.get(s.dayKey) || [];
      row.appendChild(el('span', 'bz-sc-dash-tl-desc', memos.length ? truncateText(memos.join('、'), 40) : '当日无备忘'));
      kt.appendChild(row);
    }
    dossierCard.body.appendChild(kt);
  }
  // 空态（无事件无变化日无叙事才出现；统计行仍在，不算空）
  if (!events.length && !shifts.length && !narratives.length) {
    dossierCard.body.appendChild(emptyHint('还没有值得纪念的大事小事——读完一本书、写一封信、给一部电影打分，都会留在这里。'));
  }
  return dossierCard.root;
}

function renderEmotion(pane: HTMLElement, data: SmartCatData): void {
  pane.innerHTML = '';
  const stream = data.memory?.memoryStream || [];

  // 趋势/波动度
  const trend = analyzeEmotionTrend(buildEmotionSnapshots(stream));
  const trendCard = card(`情绪趋势（${trend.count} 条情绪记录）`);
  trendCard.body.appendChild(el('div', 'bz-sc-dash-trend-text', describeEmotionTrend(trend)));
  trendCard.body.appendChild(el(
    'div',
    'bz-sc-dash-trend-meta',
    `波动度 ${trend.volatility.toFixed(2)}（≥0.5 视为高波动）`,
  ));
  // 标注覆盖率小字（097 A3）：复用 emotionDensityStats，meta 行下方纯读展示
  trendCard.body.appendChild(el('div', 'bz-sc-dash-trend-meta', describeEmotionCoverage(stream)));
  pane.appendChild(trendCard.root);

  // 情绪分布
  pane.appendChild(distributionCard('情绪分布', distributionRows(buildEmotionDistribution(stream)).slice(0, 8), {
    unit: '次', labelOf: emotionLabel, emptyText: '还没有带情绪标注的记忆——和小橘聊天、写日记都会有情绪记录。',
  }).root);

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

  // 感情（关系张量）——口径统一（097 B1）：依恋改走与总览 computeDashboardStats 相同的
  // lazyAttachment 读侧分离衰减视图（trust 无衰减语义仍直读基线）；只影响展示，绝不写盘
  const relTrust = g?.relationship?.trust ?? 0.5;
  const relAttachmentView = lazyAttachment(
    g?.relationship?.attachment ?? 0.5,
    data.editingData?.lastPresenceAt,
    Date.now(),
  );
  const relCard = card('感情（关系张量）');
  relCard.body.appendChild(barRow('信任', relTrust, 'warm'));
  relCard.body.appendChild(barRow('依恋', relAttachmentView, 'warm'));
  const tone = g?.behaviorStats?.emotionalTone || 0;
  relCard.body.appendChild(barRow('情绪基调', (tone + 1) / 2, 'warm'));
  relCard.body.appendChild(el(
    'div',
    'bz-sc-dash-hint',
    `情绪基调 ${tone >= 0 ? '+' : ''}${tone.toFixed(2)}（-1 冷淡 ~ +1 温暖）；信任/依恋随相处缓慢生长；依恋已按缺席分离衰减（读侧视图，不写盘）。`,
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
      // 归因徽标（097 A1）：llm → 「LLM 归因」；lexical → 「词法推断」；旧数据无 attribution 不显示
      if (r.mode === 'llm') row.appendChild(el('span', 'bz-sc-dash-badge bz-sc-dash-badge-attrib-llm', 'LLM 归因'));
      else if (r.mode === 'lexical') row.appendChild(el('span', 'bz-sc-dash-badge bz-sc-dash-badge-attrib-lexical', '词法推断'));
      if (r.detail) row.appendChild(el('span', 'bz-sc-dash-tl-desc', truncateText(r.detail, 24)));
      // 引用原文仅 mode=llm 且 quote 非空（buildGrowthTrail 已保证；词法推断一律无解释文案）
      if (r.quote) row.appendChild(el('span', 'bz-sc-dash-tl-quote', truncateText(r.quote, 30)));
      trailCard.body.appendChild(row);
    }
  } else {
    trailCard.body.appendChild(emptyHint('还没有成长记录——互动、反思与周深更新都会留痕。'));
  }
  pane.appendChild(trailCard.root);
}

/** 引用型条目 → 笔记正文（日记带定位符按 diary parser 拆回该时间段；null = 文件失效）。
 *  路径按首个 # 截断：旧 sidecar 的 ref.path 曾带定位符尾巴（#时:分），容错兼容。 */
async function resolveMemoryDetail(app: App, ref: { path: string; locator?: string }): Promise<string | null> {
  try {
    const filePath = ref.path.split('#')[0];
    const f = app.vault.getAbstractFileByPath(filePath);
    if (!f) return null;
    const content = await (app.vault.read as (f: any) => Promise<string>)(f);
    if (!ref.locator) return content;
    const date = noteMemoryDiaryDate(filePath);
    if (!date) return content;
    const seg = parseFile(content, date).find((e) => e.time === ref.locator);
    return seg && seg.content.trim() ? seg.content : null;
  } catch { return null; }
}

/** 详细日期（年 月 日 时:分；created 缺省回退相对时间），观察徽章后的元信息用 */
function formatDetailedDate(iso?: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return formatRelativeTime(iso);
  return `${dt.getFullYear()} 年 ${dt.getMonth() + 1} 月 ${dt.getDate()} 日 ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

/** 最近记忆正文 markdown 渲染（失败回退纯文本，渲染前清占位） */
function renderMemoryMarkdown(app: App, textEl: HTMLElement, md: string): void {
  textEl.textContent = '';
  try {
    void Promise.resolve((MarkdownRenderer as any).render(app, md, textEl, '', new Component()))
      .catch(() => { textEl.textContent = md; });
  } catch { textEl.textContent = md; }
}

function renderMemory(pane: HTMLElement, data: SmartCatData): void {
  pane.innerHTML = '';
  const stream = data.memory?.memoryStream || [];
  // ticket 163：来源分布按「记忆目录」的追查目录分行（标签随设置走，日记目录条目 source=diary 已在来源表）
  const dirs = normalizeMemoryDirectories((tryGetSettings() as any).memoryDirectories);
  const refl = data.memory?.reflection || ({} as SmartCatData['memory']['reflection']);

  // 统计
  const st = computeDashboardStats(data);
  const stats = el('div', 'bz-sc-dash-stats');
  stats.appendChild(statBlock(st.streamCount, '记忆总数'));
  stats.appendChild(statBlock(st.observationCount, '观察'));
  stats.appendChild(statBlock(st.insightCount, '洞察'));
  stats.appendChild(statBlock(st.digestCount || 0, '行为小结次数'));
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
    `上次反思：${lastReflect}（共 ${st.reflectionCount} 次）· 上次行为小结：${lastDigest}。`,
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

  // 来源分布（ticket 163：洞察单列 + note 按追查目录分行）
  pane.appendChild(distributionCard('记忆来源分布', distributionRows(buildSourceDistribution(stream, dirs)).slice(0, 6), {
    unit: '条', emptyText: '暂无观察来源。',
  }).root);

  // 最近记忆列表（新→旧，截前 30 条）
  const listCard = card('最近记忆');
  if (stream.length) {
    const list = el('div', 'bz-sc-dash-list');
    // 新→旧按 created 降序（插入序 ≠ 创建序：日记段靠 seed.created 还原真实时间），取前 30 条
    const recent = [...stream]
      .sort((a, b) => (Date.parse(b.created || '') || 0) - (Date.parse(a.created || '') || 0))
      .slice(0, 30);
    // 092 方向二（ADR-0039）：DDID 展示层短索引——超长 insight_id 显示为 #N（不写盘、不影响数据层）
    const shortIndex = buildInsightShortIndex(stream);
    for (const m of recent) {
      const item = el('div', 'bz-sc-dash-memory');
      const meta = el('div', 'bz-sc-dash-memory-meta');
      // 主题 chip（097 B2）：theme 经受限枚举校验（工作|兴趣|关系|健康|环境）才显示，置于行首
      const theme = m.type === 'insight' ? sanitizeInsightTheme(m.theme) : undefined;
      if (theme) meta.appendChild(el('span', 'bz-sc-dash-badge bz-sc-dash-badge-theme', theme));
      meta.appendChild(el(
        'span',
        `bz-sc-dash-badge ${m.type === 'insight' ? 'insight' : 'observation'}`,
        m.type === 'insight' ? '洞察' : '观察',
      ));
      if (m.type === 'insight') {
        const idx = m.id ? shortIndex.get(m.id) : undefined;
        if (idx !== undefined) meta.appendChild(el('span', 'bz-sc-dash-insight-id', `#${idx}`));
        // 推翻/固定视觉态（097 B2）：supersededBy 非空 → 整行降透明度 + 描述删除线 + 徽标「已被推翻」；
        // pinned → 徽标「已固定」；两者并存时 pinned 优先显示（人工保护盖过废弃视觉，行按活跃态呈现）
        if (m.pinned === true) {
          meta.appendChild(el('span', 'bz-sc-dash-badge bz-sc-dash-badge-pinned', '已固定'));
        } else if (isSupersededInsight(m)) {
          meta.appendChild(el('span', 'bz-sc-dash-badge bz-sc-dash-badge-superseded', '已被推翻'));
          item.classList.add('bz-sc-dash-memory--superseded');
        }
      }
      // ticket 163：note 引用条目按追查目录显示（与来源分布卡同口径；未命中回退旧标签）
      const src = m.source === 'note' ? (resolveTrackedDirLabel(m, dirs) ?? '记忆目录') : sourceLabel(m.source);
      if (src) meta.appendChild(el('span', '', src));
      if (m.created) meta.appendChild(el('span', '', formatDetailedDate(m.created)));
      meta.appendChild(el('span', '', `重要度 ${Math.round((m.importance ?? 0) * 100)}`));
      // 092 设计第 7 条 + P1-29：Dashboard「固定/废弃」人工修正（经常驻实例通道写点）
      if (m.type === 'insight' && m.id && dashState?.app) meta.appendChild(buildInsightActions(m));
      item.appendChild(meta);
      // 正文直出（markdown 渲染）：引用型条目当场读 vault 正文（日记段拆回该时间段），
      // 失效回显引用路径；普通条目显完整 description。不再点击展开。
      const textEl = el('div', 'bz-sc-dash-memory-text', m.ref ? '加载中…' : truncateText(m.description, 400));
      item.appendChild(textEl);
      if (m.ref && dashState?.app) {
        void resolveMemoryDetail(dashState.app, m.ref).then((body) => {
          if (!textEl.isConnected) return; // 面板已重渲染
          if (body != null) renderMemoryMarkdown(dashState!.app, textEl, body);
          else textEl.textContent = truncateText(`${m.ref!.path}#${m.ref!.locator ?? ''}（引用已失效）`, 400);
        });
      } else if (dashState?.app) {
        renderMemoryMarkdown(dashState.app, textEl, m.description || '');
      }
      // P3 structured 摘要：entityType/action/name/tags 展示
      if (m.structured) {
        const structParts: string[] = [];
        if (m.structured.entityType) structParts.push(m.structured.entityType);
        if (m.structured.action) structParts.push(m.structured.action);
        if (m.structured.name) structParts.push(m.structured.name);
        if (structParts.length) {
          item.appendChild(el('div', 'bz-sc-dash-structured-summary', structParts.join(' · ')));
        }
        if (m.structured.tags && m.structured.tags.length) {
          const tagsEl = el('div', 'bz-sc-dash-structured-tags');
          for (const tag of m.structured.tags.slice(0, 5)) {
            tagsEl.appendChild(el('span', 'bz-sc-dash-badge', tag));
          }
          item.appendChild(tagsEl);
        }
        // snapshot 摘要
        if (m.structured.snapshot?.summary) {
          item.appendChild(el('div', 'bz-sc-dash-snapshot-summary', truncateText(m.structured.snapshot.summary, 60)));
        }
      }
      list.appendChild(item);
    }
    listCard.body.appendChild(list);
  } else {
    listCard.body.appendChild(emptyHint('还没有记忆——和小橘聊聊天、写写日记吧。'));
  }
  pane.appendChild(listCard.root);
}

// ---------------- 洞察人工修正（092 设计第 7 条） ----------------

/**
 * 常驻实例补丁通道（P1-29 修正被回滚修复）：由 index 在 ensureSmartCat 装配时注册。
 * 面板「固定/废弃」经它修改常驻内存对象并走统一 dataSaver——废弃独立 load-modify-save 副本
 * （副本读盘改存会回滚常驻侧后续任何未同步改动：面板固定 → 常驻任意保存 → pinned 丢失）。
 */
interface InsightPatchChannel {
  apply: (id: string, patch: (m: MemoryStreamEntry) => void) => Promise<boolean>;
}
let insightPatchChannel: InsightPatchChannel | null = null;

/** 注册/清除常驻实例补丁通道（index ensure 注册；unloadSmartCat 清除；测试可注入替身） */
export function registerInsightPatchChannel(channel: InsightPatchChannel | null): void {
  insightPatchChannel = channel;
}

/** 洞察行「固定/废弃」动作按钮（面板唯二写点；经常驻实例通道原位修正 + 统一落盘） */
function buildInsightActions(m: MemoryStreamEntry): HTMLElement {
  const wrap = el('span', 'bz-sc-dash-insight-actions');
  const pinBtn = el('button', 'bz-sc-dash-mini-btn', m.pinned === true ? '取消固定' : '固定');
  pinBtn.addEventListener('click', () => { void persistInsightPatch(m.id as string, (t) => { t.pinned = !(t.pinned === true); }, m.pinned === true ? '已取消固定，该洞察恢复参与自动取代判定' : '已固定，该洞察不会被自动取代'); });
  wrap.appendChild(pinBtn);
  if (!isSupersededInsight(m)) {
    const depBtn = el('button', 'bz-sc-dash-mini-btn', '废弃');
    depBtn.addEventListener('click', () => { void persistInsightPatch(m.id as string, (t) => { t.supersededBy = MANUAL_SUPERSEDED_BY; }, '已废弃该洞察，检索时不再参与'); });
    wrap.appendChild(depBtn);
  }
  return wrap;
}

/** 洞察字段最小写点：经常驻实例通道原位修改 + 统一 dataSaver 落盘 → 重渲染；失败 toast 不抛错 */
async function persistInsightPatch(id: string, patch: (m: MemoryStreamEntry) => void, okMsg: string): Promise<void> {
  try {
    if (!insightPatchChannel) {
      // 常驻实例未装配（smartcat 未启动）：不再退回 load-modify-save 副本写盘（P1-29）
      notice('小橘未启动，无法修改洞察', 'error');
      return;
    }
    const applied = await insightPatchChannel.apply(id, patch);
    if (!applied) {
      notice('未找到该洞察', 'error');
      return;
    }
    notice(okMsg, 'success');
    if (dashState) renderPanes(await loadDashboardData(dashState.app)); // 只读现读渲染保持一致
  } catch (e) {
    notice('操作失败，请重试', 'error');
  }
}

/** 报告页签（2026-08-23：每周懂你报告从设置弹窗移入——最新一期全文 + 历史报告） */
function renderReport(pane: HTMLElement, data: SmartCatData): void {
  pane.innerHTML = '';
  const reports = buildWeeklyReports(data.memory?.memoryStream || []);

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

// ---------------- 行为页签（P3 ticket 123；ticket 129：时间线 + 筛选 + 滚动加载） ----------------

/** 行为来源中文标签（覆盖 routing 全部来源 + secondbrain/system 等） */
const BEHAVIOR_SOURCE_LABELS: Record<string, string> = {
  chat: '聊天', diary: '日记', flash: '闪念', clipping: '剪藏', movie: '影视', memo: '备忘录',
  reading: '书库', library: '书库', pomodoro: '番茄钟', news: '聚合讯', favorites: '收藏本', belongings: '归物本',
  letter: '信', poem: '现代诗', reflection: '反省', 'weekly-report': '周报', dossier: '相处史',
  literature: '文献盒', 'bili-downloader': '文献盒', // 文献盒（ADR-0072 迁出；bili-downloader 为旧存量来源遗留）
  secondbrain: '第二大脑', system: '系统',
};

function behaviorSourceLabel(source: string): string {
  return BEHAVIOR_SOURCE_LABELS[source] || source;
}

/** 行为列表单批加载条数（与旧截断值 50 对齐；首屏 + 触底/按钮追加均按此批次） */
const BEHAVIOR_BATCH_SIZE = 50;

/** 行为流按时间倒序（稳定副本） */
function sortedBehavior(data: SmartCatData): BehaviorItem[] {
  return [...(data.memory?.behaviorStream || [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/** 单个行为条目 DOM（时间线节点：type 徽标文案化 + 来源 + 相对时间 + 人类文案；无提升按钮） */
function buildBehaviorItemEl(b: BehaviorItem): HTMLElement {
  const item = el('div', 'bz-sc-dash-behavior-item');
  const meta = el('div', 'bz-sc-dash-behavior-meta');
  meta.appendChild(el('span', 'bz-sc-dash-badge bz-sc-dash-behavior-type', behaviorActionWord(b.type)));
  meta.appendChild(el('span', 'bz-sc-dash-behavior-source', behaviorSourceLabel(b.source)));
  meta.appendChild(el('span', 'bz-sc-dash-behavior-time', formatRelativeTime(b.timestamp)));
  item.appendChild(meta);
  item.appendChild(el('div', 'bz-sc-dash-memory-text', truncateText(buildBehaviorWording(b), 80)));
  return item;
}

/** 可点击来源统计块（点击筛选；「全部」块 data-source='' 常驻还原；active 高亮当前筛选态） */
function buildFilterStat(source: string, count: number, label: string, activeFilter: string | null): HTMLElement {
  const s = statBlock(count, label);
  s.classList.add('bz-sc-dash-stat-click');
  s.dataset.source = source;
  const active = source === (activeFilter ?? '');
  s.classList.toggle('active', active);
  s.title = source ? `点击只显示「${label}」；再次点击还原` : '点击还原全部来源';
  s.addEventListener('click', () => applyBehaviorFilter(source));
  return s;
}

/** 来源筛选切换（点来源块筛选；点「全部」/再点已选来源还原——语义闭环）；
 *  筛选态重置分页（回到首批 50 条）并重渲染行为页签。 */
function applyBehaviorFilter(source: string): void {
  const st = dashState;
  if (!st || !st.panes.behavior || !st.lastData) return;
  const normalized = source === '' ? null : source;
  st.behaviorFilter = st.behaviorFilter === normalized ? null : normalized;
  st.behaviorShown = BEHAVIOR_BATCH_SIZE;
  renderBehavior(st.panes.behavior, st.lastData);
}

/** 追加下一批行为条目（触底滚动 / 加载更多按钮共用；直接 append 不整页重排，保持滚动位置） */
function appendBehaviorBatch(): void {
  const st = dashState;
  if (!st || !st.behaviorListEl || !st.lastData) return;
  const sorted = sortedBehavior(st.lastData);
  const filtered = st.behaviorFilter ? sorted.filter((b) => b.source === st.behaviorFilter) : sorted;
  const list = st.behaviorListEl;
  const shown = st.behaviorShown;
  if (shown >= filtered.length) return;
  const next = Math.min(shown + BEHAVIOR_BATCH_SIZE, filtered.length);
  const frag = document.createDocumentFragment();
  for (let i = shown; i < next; i++) frag.appendChild(buildBehaviorItemEl(filtered[i]));
  list.appendChild(frag);
  st.behaviorShown = next;
  if (st.behaviorLoadMoreBtn) st.behaviorLoadMoreBtn.style.display = next < filtered.length ? '' : 'none';
}

function renderBehavior(pane: HTMLElement, data: SmartCatData): void {
  pane.innerHTML = '';
  const items = data.memory?.behaviorStream || [];

  // 统计（全量口径，不受筛选/分页影响）：行为总数 + 来源 top4，点击筛选
  const bySource: Record<string, number> = {};
  for (const b of items) bySource[b.source] = (bySource[b.source] || 0) + 1;
  let filter = dashState?.behaviorFilter ?? null;
  // 脏筛选守卫：来源已被滚动清理（条目清零）→ 自动还原全部，避免死区
  if (filter && !(filter in bySource)) {
    filter = null;
    if (dashState) dashState.behaviorFilter = null;
  }
  const topSources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const stCard = card('行为流');
  const stats = el('div', 'bz-sc-dash-stats');
  stats.appendChild(buildFilterStat('', items.length, '行为总数', filter));
  for (const [src, count] of topSources) {
    stats.appendChild(buildFilterStat(src, count, behaviorSourceLabel(src), filter));
  }
  stCard.body.appendChild(stats);
  if (filter) {
    stCard.body.appendChild(el('div', 'bz-sc-dash-hint', `已筛选：${behaviorSourceLabel(filter)}——点击「行为总数」或再点该来源块还原。`));
  }
  pane.appendChild(stCard.root);

  // 行为列表（时间线式；首屏 50 条，触底滚动 / 加载更多按钮追加）
  const listCard = card('最近行为');
  const sorted = sortedBehavior(data);
  const filtered = filter ? sorted.filter((b) => b.source === filter) : sorted;
  if (filtered.length) {
    const tl = el('div', 'bz-sc-dash-behavior-tl');
    const shown = Math.min(dashState?.behaviorShown ?? BEHAVIOR_BATCH_SIZE, filtered.length);
    for (let i = 0; i < shown; i++) tl.appendChild(buildBehaviorItemEl(filtered[i]));
    if (dashState) {
      dashState.behaviorShown = shown;
      dashState.behaviorListEl = tl;
    }
    listCard.body.appendChild(tl);
    if (filtered.length > shown) {
      const btn = el('button', 'bz-sc-dash-load-more', '加载更多（还有 ' + (filtered.length - shown) + ' 条）');
      btn.addEventListener('click', () => appendBehaviorBatch());
      if (dashState) dashState.behaviorLoadMoreBtn = btn;
      listCard.body.appendChild(btn);
    } else if (dashState) {
      dashState.behaviorLoadMoreBtn = null;
    }
  } else {
    listCard.body.appendChild(emptyHint(filter ? `「${behaviorSourceLabel(filter)}」暂无行为记录。` : '还没有行为记录——使用小橘的各种功能会自动记录行为轨迹。'));
    if (dashState) {
      dashState.behaviorListEl = null;
      dashState.behaviorLoadMoreBtn = null;
    }
  }
  pane.appendChild(listCard.root);
}

/** 行为体滚动触底自动加载（.bz-sc-dash-body 是唯一滚动容器；仅行为页签生效；近底 120px 触发） */
function onBehaviorBodyScroll(): void {
  const st = dashState;
  if (!st || !st.body || st.activeTab !== 'behavior') return;
  if (st.body.scrollTop + st.body.clientHeight >= st.body.scrollHeight - 120) {
    appendBehaviorBatch();
  }
}

// ---------------- 面板开关（bz 主窗口规范） ----------------

/** C1 自动刷新防抖窗口（ms）：vault modify 命中目标路径后，静默重读渲染前的合并等待 */
const DASH_REFRESH_DEBOUNCE_MS = 3000;

interface DashboardState {
  app: App;
  mask: HTMLElement;
  popup: HTMLElement;
  /** 滚动体（.bz-sc-dash-body 唯一滚动容器；行为页签触底加载监听） */
  body: HTMLElement;
  panes: Partial<Record<PaneKey, HTMLElement>>;
  tabs: Partial<Record<PaneKey, HTMLElement>>;
  activeTab: PaneKey;
  visibleKeys: PaneKey[];
  escHandle: { unregister: () => void };
  /** 当日备忘标题表（「一起的日子」关键时刻用；打开/刷新时现读） */
  memoTitles: Map<string, string[]>;
  /** C1 自动刷新：vault modify 事件引用（close 全量 offref 清理；幂等重开先 close 不泄漏） */
  eventRefs: unknown[];
  /** C1 自动刷新：防抖计时器句柄（close clearTimeout 清理） */
  debounceTimer: number | null;
  /** 最近一次渲染的数据引用（行为筛选/加载更多重渲染用；renderPanes 更新） */
  lastData: SmartCatData | null;
  /** 行为页签：当前来源筛选（null=全部） */
  behaviorFilter: string | null;
  /** 行为页签：已展示条数（首屏 50，触底/按钮追加） */
  behaviorShown: number;
  /** 行为页签：列表容器（追加加载复用，重渲染时重建） */
  behaviorListEl: HTMLElement | null;
  /** 行为页签：「加载更多」按钮（追加后按剩余条数显隐） */
  behaviorLoadMoreBtn: HTMLElement | null;
}

let dashState: DashboardState | null = null;

/** 切页签（display 显隐 + active 类，功能性内联仅此） */
function activateTab(key: PaneKey): void {
  if (!dashState) return;
  dashState.activeTab = key;
  for (const k of dashState.visibleKeys) {
    dashState.tabs[k]?.classList.toggle('active', k === key);
    if (dashState.panes[k]) dashState.panes[k]!.style.display = k === key ? 'block' : 'none';
  }
}

/** 重渲染全部页签（打开/刷新共用；数据现读现渲染；不触碰页签显隐 → 刷新保持当前页签） */
function renderPanes(data: SmartCatData): void {
  if (!dashState) return;
  dashState.lastData = data;
  if (dashState.panes.overview) renderOverview(dashState.panes.overview, data, dashState.memoTitles);
  if (dashState.panes.emotion) renderEmotion(dashState.panes.emotion, data);
  if (dashState.panes.personality) renderPersonality(dashState.panes.personality, data);
  if (dashState.panes.memory) renderMemory(dashState.panes.memory, data);
  if (dashState.panes.report) renderReport(dashState.panes.report, data);
  if (dashState.panes.behavior) renderBehavior(dashState.panes.behavior, data);
}

// ---------------- C1 事件驱动静默刷新（2026-08-24 用户拍板：去手动刷新按钮） ----------------

/** 清理自动刷新监听与防抖计时器（closeSmartcatDashboard 唯一清理点，幂等可重复调） */
function teardownAutoRefresh(): void {
  if (!dashState) return;
  if (dashState.debounceTimer !== null) {
    window.clearTimeout(dashState.debounceTimer);
    dashState.debounceTimer = null;
  }
  for (const ref of dashState.eventRefs) {
    try {
      (dashState.app.vault as any).offref?.(ref);
    } catch (e) { /* 句柄可能已失效 */ }
  }
  dashState.eventRefs = [];
}

/** 防抖重排静默刷新（3s 窗口内连续 modify 合并为一次重读；面板已关闭则忽略） */
function scheduleSilentRefresh(): void {
  if (!dashState || !dashState.popup.isConnected) return;
  if (dashState.debounceTimer !== null) window.clearTimeout(dashState.debounceTimer);
  dashState.debounceTimer = window.setTimeout(() => { void runSilentRefresh(); }, DASH_REFRESH_DEBOUNCE_MS);
}

/** 静默重读渲染（保持当前页签；失败保持旧画面静默——连续失败也不 toast 打扰，绝不弹通知） */
async function runSilentRefresh(): Promise<void> {
  const st = dashState;
  if (!st) return;
  st.debounceTimer = null;
  try {
    const fresh = await loadDashboardData(st.app);
    const memoTitles = await loadMemoTitlesByDay(st.app); // 当日备忘同步现读（094）
    if (dashState !== st || !st.popup.isConnected) return; // 刷新期间被关闭/重开 → 丢弃陈旧结果
    st.memoTitles = memoTitles;
    renderPanes(fresh);
  } catch (e) { /* 读失败保旧画面静默（含关闭前最后一次失败：同样忽略） */ }
}

/**
 * 打开小橘数据面板（命令 bz-smartcat-dashboard 回调）。
 * 幂等：重复调用先关旧再开新（数据重读）。只读——不写 smartcat.json。
 */
export async function openSmartcatDashboard(app: App): Promise<void> {
  closeSmartcatDashboard();
  let data: SmartCatData;
  try {
    data = await loadDashboardData(app);
  } catch (e) {
    notice('小橘数据读取失败', 'error');
    return;
  }

  const { mask, popup } = createOverlay({
    maskId: 'smartcat-dashboard-mask',
    popupId: 'smartcat-dashboard-panel',
    onMaskClick: () => closeSmartcatDashboard(),
    width: '94%',
    maxWidth: 720,
  });
  popup.style.maxHeight = '82vh';
  popup.style.flexDirection = 'column';

  // 头行（097 C1：手动 🔄 刷新按钮删除，id smartcat-dash-refresh 移除在票留档——面板私有 id 无外部
  // 依赖方；头行只剩标题 + ❌ 关闭，样式由 .bz-win-head 统一规范承接）
  const header = document.createElement('div');
  header.className = 'bz-win-head';
  const title = el('h3', '', '小橘数据面板');
  const btns = el('div', '');
  const closeBtn = el('button', 'bz-win-close', '❌');
  closeBtn.id = 'smartcat-dash-close';
  closeBtn.title = '关闭';
  btns.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(btns);
  popup.appendChild(header);

  // 页签栏（P3：根据 showBehaviorLog 设置决定可见页签）
  const visibleKeys = getVisiblePaneKeys();
  const tabBar = el('div', 'bz-sc-dash-tabs');
  const tabs: Partial<Record<PaneKey, HTMLElement>> = {};
  const panes: Partial<Record<PaneKey, HTMLElement>> = {};
  const body = el('div', 'bz-sc-dash-body');
  for (const key of visibleKeys) {
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

  // 当日备忘标题表现读（094「一起的日子」关键时刻；失败静默空表）
  const memoTitles = await loadMemoTitlesByDay(app);
  dashState = {
    app, mask, popup, body, panes, tabs, activeTab: 'overview', visibleKeys, escHandle: null as any,
    memoTitles, eventRefs: [], debounceTimer: null, lastData: null,
    behaviorFilter: null, behaviorShown: BEHAVIOR_BATCH_SIZE, behaviorListEl: null, behaviorLoadMoreBtn: null,
  };
  renderPanes(data);
  activateTab('overview');

  // ticket 129：行为页签滚动触底自动加载（body 是唯一滚动容器；行为页签激活才追加）
  body.addEventListener('scroll', onBehaviorBodyScroll);

  // 移动端默认全屏（ticket 68 规范三件事之二：打开路径必经处应用；
  //  2026-08-23 合并一套：跟随聊天/设置面板共用的 smartcatMobileDefaultFullscreen 开关）
  applyMobileWindowFullscreen(popup, tryGetSettings().smartcatMobileDefaultFullscreen === true);

  mask.style.display = 'block';
  popup.style.display = 'flex';

  closeBtn.addEventListener('click', () => closeSmartcatDashboard());

  // C1 事件驱动静默刷新：vault modify 命中 smartcat.json / memo.json → 防抖 3s 静默重读渲染
  //（保持当前页签、不弹任何 toast；本模块无 Component 宿主，用 vault.on 的 EventRef 注册，
  // closeSmartcatDashboard 统一 offref 清理——与 registerEvent(app.vault,'modify') 清理语义等价；
  // 注册失败仅失去自动刷新，面板功能不受影响）
  const watchPaths = [getSmartcatFilePath(), memoDataPath()];
  const onVaultModify = (file: unknown): void => {
    const p = typeof file === 'string' ? file : (file as any)?.path;
    if (!p || !watchPaths.includes(p)) return; // 非目标路径不触发
    scheduleSilentRefresh();
  };
  try {
    dashState.eventRefs.push((app.vault as any).on('modify', onVaultModify));
  } catch (e) { /* 老环境兜底：仅失去自动刷新 */ }

  const escHandle = escManager.register('smartcat-dashboard', {
    isVisible: () => !!dashState && dashState.popup.isConnected,
    close: () => closeSmartcatDashboard(),
  });
  dashState.escHandle = escHandle;
}

/** 关闭面板并解除 ESC + 全量清理自动刷新监听与防抖计时器（unloadSmartCat 全量清理时调用） */
export function closeSmartcatDashboard(): void {
  if (!dashState) return;
  teardownAutoRefresh();
  dashState.mask.remove();
  dashState.popup.remove();
  try {
    dashState.escHandle?.unregister();
  } catch (e) { /* 句柄可能已失效 */ }
  dashState = null;
}