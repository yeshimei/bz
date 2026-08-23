/**
 * 单一缺席状态机（ticket 093，086 v4 方向三+七 绿队 C 裁决合并落地，ADR-0040）。
 *
 * 设计要点（票据「设计」7 条逐条对应）：
 *  1. 全库唯一缺席判定：状态持久化 editingData.absenceState = { phase, since }
 *     （可选字段旧数据零迁移；phase: normal | missing | reunion），杜绝双写；
 *  2. selfEvents 环形缓冲（≤20 条）持久化 editingData.selfEvents —— 表达先于数值
 *    （体验原则 3）：事件直接呈现 dashboard，不依赖 PAD 可见性；
 *  3. PAD 幅度域 [1.0, 1.8]：下限 ≥ MoodSystem.updatePad 落盘阈值 1.0（|adjusted|≥1 才
 *     saveMoodState，幅度不足无可见效果）；上限对齐 handleInteraction 最小行量级；
 *     且单事件每轴分量 ≤ 0.5 × 用户共振幅度（emotionResonanceDelta 同期差量为顶——
 *     缺席情绪永远弱于用户真实情绪共振）；
 *  4. 时序归因分离：按 lastPresenceAt 分窗——触发时刻距上次在场 <24h 只走重逢分支，
 *     ≥N 天才先补「牵挂」再等重逢（重逢喜悦不与牵挂同日抵消）；
 *  5. attachment 惰性算分：lazyAttachment 纯函数只作用于读取视图，绝不写盘不漂移，
 *     now 注入可测、缺省容忍（旧数据无 lastPresenceAt 原样返回）；
 *  6. 画像选择器砍掉：安全/焦虑/回避三套参数为出厂内部常量候选（本文件内注释标明），
 *     不进设置面板、不做用户选择（涌现不可配置原则）；
 *  7. 触发源：调度心跳（memorySystem.onSchedulerTick 复用既有 30s tick，不自建定时器）
 *     检查 lastPresenceAt 距今 → 状态迁移；重逢判定 = 在场信号（sendChatMessage /
 *     onVaultActivity 观察路径统一经 touchPresence 后触发 onPresence 钩子）
 *     + absenceState.phase ≠ normal。
 *
 * 范围裁定：本票不实现 trust/attachment 写盘衰减与 H1 分离降速倍数（随 089 PARKED，
 * 留待方向五重新定义后另票）；不新增任何 LLM 调用；设置面板零新项。
 */
import type { SmartCatData } from './types';
import { DAY_MS, getAbsenceDays } from './data';
import { emotionResonanceDelta } from './mood';

// ---------------- 类型 ----------------

/** 缺席阶段：normal 在场陪伴 / missing 牵挂中 / reunion 重逢喜悦 */
export type AbsencePhase = 'normal' | 'missing' | 'reunion';

/** 持久化状态（editingData.absenceState，可选字段零迁移） */
export interface AbsenceState {
  phase: AbsencePhase;
  /** 当前阶段开始时间戳 */
  since: number;
}

/** 自我事件类型：miss 开始牵挂 / reunion 重逢 */
export type SelfEventType = 'miss' | 'reunion';

/** 自我事件（editingData.selfEvents 环形缓冲条目） */
export interface SelfEvent {
  type: string;
  at: number;
}

// ---------------- 常量 ----------------

/** 调度心跳重评窗口（时序分窗）：距 lastPresenceAt ≥24h 才允许进入牵挂分支 */
export const ABSENCE_REUNION_WINDOW_MS = DAY_MS;

/** selfEvents 环形缓冲上限 */
export const SELF_EVENTS_CAP = 20;

/** PAD 单轴分量幅度域：[1.0, 1.8]（见模块头注释第 3 条） */
export const ABSENCE_PAD_MIN = 1.0;
export const ABSENCE_PAD_MAX = 1.8;

/** 共振帽比例：单事件分量 ≤ 0.5 × 用户共振幅度（applyEmotionResonance 同期差量为顶） */
export const ABSENCE_RESONANCE_CAP_RATIO = 0.5;

/** 唤醒/支配分量相对主分量的振幅折算份额（各自仍过 [1.0,1.8]+共振帽收敛） */
export const ABSENCE_AROUSAL_SHARE = 0.7;
export const ABSENCE_DOMINANCE_SHARE = 0.6;

/**
 * 依恋画像参数（设计 6：安全/焦虑/回避三套为出厂内部常量候选——涌现不可配置原则，
 * 不进设置面板、不做用户选择；当前出厂启用 safe。字段含义：
 *  - missingDays：进入「牵挂」的缺席天数门槛（焦虑型更敏感更低、回避型更迟钝更高）；
 *  - missAnchorEmotion / reunionAnchorEmotion：PAD 差量锚点情绪（经共振帽收敛幅度）。
 */
export interface AbsenceProfile {
  key: 'safe' | 'anxious' | 'avoidant';
  missingDays: number;
  missAnchorEmotion: string;
  reunionAnchorEmotion: string;
}

export const ABSENCE_PROFILES: Record<'safe' | 'anxious' | 'avoidant', AbsenceProfile> = {
  safe: { key: 'safe', missingDays: 3, missAnchorEmotion: 'lonely', reunionAnchorEmotion: 'happy' },
  anxious: { key: 'anxious', missingDays: 2, missAnchorEmotion: 'anxious', reunionAnchorEmotion: 'excited' },
  avoidant: { key: 'avoidant', missingDays: 5, missAnchorEmotion: 'calm', reunionAnchorEmotion: 'content' },
};

/** 出厂启用画像（safe）。换画像 = 改此常量一行，永不暴露为用户配置。 */
export const ACTIVE_ABSENCE_PROFILE: AbsenceProfile = ABSENCE_PROFILES.safe;

/** 读侧依恋视图参数（出厂常量候选，同画像不外露）：分离半衰期 14 天、视图地板 0.05 */
export const ATTACHMENT_HALF_LIFE_DAYS = 14;
export const ATTACHMENT_VIEW_FLOOR = 0.05;

// ---------------- 展示文案 ----------------

/** 阶段中文标签（dashboard 用） */
export const ABSENCE_PHASE_LABELS: Record<AbsencePhase, string> = {
  normal: '陪伴中',
  missing: '牵挂中',
  reunion: '重逢喜悦',
};

/** 自我事件中文标签（表达层直接呈现） */
export const SELF_EVENT_LABELS: Record<string, string> = {
  miss: '开始牵挂你',
  reunion: '你回来了，很开心',
};

// ---------------- 纯函数 ----------------

/** 读持久化状态（容忍旧数据：缺字段/非法 phase/since → normal/0，零迁移） */
export function readAbsenceState(editingData: any): AbsenceState {
  const raw = editingData?.absenceState;
  const phase: AbsencePhase = raw?.phase === 'missing' || raw?.phase === 'reunion' ? raw.phase : 'normal';
  const since = typeof raw?.since === 'number' ? raw.since : 0;
  return { phase, since };
}

/**
 * 距上次在场天数（唯一口径复用 H5）：委托 data.getAbsenceDays 读在场，
 * 不自造第二套换算（体验原则 2 缺席单一语义）；lastPresenceAt 缺失 → 0 天。
 */
export function daysSincePresence(lastPresenceAt: unknown, now: number): number {
  const ed = typeof lastPresenceAt === 'number' ? { lastPresenceAt } : {};
  return getAbsenceDays({ editingData: ed } as SmartCatData, now);
}

/** 迁移评估结果：changed=true 时调用方需写回 absenceState 并落盘 */
export interface AbsenceEvalResult {
  next: AbsencePhase;
  changed: boolean;
  /** 本次迁移应记录的自我事件类型（无则 null） */
  event: SelfEventType | null;
}

/**
 * 调度心跳评估（纯函数，全库唯一缺席迁移表）：
 *  - normal：缺席 ≥N 天且距上次在场 ≥24h（<24h 只走重逢分支的窗口闸门，兼防时钟回拨/
 *    补写 lastPresenceAt 的边界抖动）→ missing，记「miss」事件；
 *  - missing：缺席回落到 N 天内（如主动关心等在场刷新）→ 静默自愈回 normal，
 *    不补发事件（同日不抵消窗口）；仍在缺席 → 保持（since 不动，不重复计事件）；
 *  - reunion：重逢保持窗口（距上次在场 <24h）内不再评估缺席；窗口后按普通规则重评
 *   （再次缺席 ≥N 天 → 直接迁移 missing 并补发牵挂；否则回 normal）。
 */
export function evalAbsenceTick(phase: AbsencePhase, lastPresenceAt: unknown, profile: AbsenceProfile, now: number): AbsenceEvalResult {
  const days = daysSincePresence(lastPresenceAt, now);
  switch (phase) {
    case 'normal': {
      const pastWindow = typeof lastPresenceAt === 'number' && now - lastPresenceAt >= ABSENCE_REUNION_WINDOW_MS;
      if (days >= profile.missingDays && pastWindow) return { next: 'missing', changed: true, event: 'miss' };
      return { next: 'normal', changed: false, event: null };
    }
    case 'missing': {
      if (days < profile.missingDays) return { next: 'normal', changed: true, event: null }; // 静默自愈
      return { next: 'missing', changed: false, event: null };
    }
    case 'reunion': {
      if (typeof lastPresenceAt === 'number' && now - lastPresenceAt < ABSENCE_REUNION_WINDOW_MS) {
        return { next: 'reunion', changed: false, event: null }; // 重逢保持窗口
      }
      if (days >= profile.missingDays) return { next: 'missing', changed: true, event: 'miss' };
      return { next: 'normal', changed: true, event: null };
    }
  }
}

/**
 * 在场信号评估（纯函数）：重逢判定 = 在场 + phase ≠ normal。
 * missing → reunion 记「reunion」事件（牵挂已在缺席期间落账，重逢喜悦单独成账，
 * 不同日抵消）；normal/reunion → 无操作（重复在场信号不重复计）。
 */
export function evalAbsencePresence(phase: AbsencePhase): AbsenceEvalResult {
  if (phase === 'missing') return { next: 'reunion', changed: true, event: 'reunion' };
  return { next: phase, changed: false, event: null };
}

/** 锚点情绪的共振幅度（emotionResonanceDelta 三轴绝对值最大者，作为 0.5× 帽的基数） */
export function resonanceAmplitudeOf(emotion: string): number {
  const d = emotionResonanceDelta(emotion);
  return Math.max(Math.abs(d.pleasure), Math.abs(d.arousal), Math.abs(d.dominance));
}

/**
 * 单事件单轴 PAD 分量（纯函数）：先按 0.5× 共振幅度封顶，再收敛进幅度域 [1.0, 1.8]——
 * 下限保证 ≥ updatePad 落盘阈值 1.0（有可验证效果），上限对齐 handleInteraction 最小行量级。
 * 不做十进制取整（边界值如 1.05 会被浮点抖动翻档；updatePad 落盘侧自有 0.1 精度）。
 */
export function absencePadDelta(kind: SelfEventType, resonanceAmplitude: number): number {
  const capped = Math.min(ABSENCE_PAD_MAX, ABSENCE_RESONANCE_CAP_RATIO * Math.abs(resonanceAmplitude));
  return Math.max(ABSENCE_PAD_MIN, capped);
}

/** selfEvents 环形缓冲写入（纯函数）：容忍非法存量输入（旧数据/坏 JSON），追加后保尾截断 ≤20 */
export function pushSelfEvent(events: unknown, type: SelfEventType, at: number): SelfEvent[] {
  const base = Array.isArray(events)
    ? events.filter((e): e is SelfEvent => !!e && typeof e === 'object' && typeof (e as any).at === 'number' && typeof (e as any).type === 'string')
    : [];
  base.push({ type, at });
  return base.slice(-SELF_EVENTS_CAP);
}

/**
 * 读侧依恋视图（方向七裁决纯函数）：stored 为写盘基线（由信任跟随维护，本函数绝不写盘），
 * 分离衰减按半衰期指数作用于读取视图并钳地板，不漂移存储；
 *  - lastPresenceAt 缺失/非法 → 原样返回基线（旧数据容忍，H5 字段出现前视图=存储）；
 *  - 时钟回拨（now < lastPresenceAt）→ 按 0 天处理返回基线；
 *  - now 注入可测；结果保留 4 位小数。
 */
export function lazyAttachment(stored: number, lastPresenceAt: unknown, now: number): number {
  const base = Math.min(1, Math.max(0, typeof stored === 'number' && isFinite(stored) ? stored : 0));
  if (typeof lastPresenceAt !== 'number') return base;
  const days = Math.max(0, Math.floor((now - lastPresenceAt) / DAY_MS));
  const decayed = base * Math.pow(0.5, days / ATTACHMENT_HALF_LIFE_DAYS);
  const view = Math.min(base, Math.max(base > 0 ? Math.min(base, ATTACHMENT_VIEW_FLOOR) : 0, decayed));
  return Math.round(view * 10000) / 10000;
}

/** 相对时间文案（自我事件列表用；轻量自带，不引 core/utils） */
export function formatSelfEventTime(at: number, now: number): string {
  const diff = Math.max(0, now - at);
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  if (diff < DAY_MS) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  return `${Math.floor(diff / DAY_MS)} 天前`;
}

// ---------------- dashboard 卡片（表达层：事件直接呈现，体验原则 3） ----------------

/** 缺席状态卡构造（dashboard 总览页挂载；类名沿用 bz-sc-dash-* 既有契约，样式零新增） */
export function buildAbsenceCard(data: SmartCatData, now = Date.now()): HTMLElement {
  const root = document.createElement('div');
  root.className = 'bz-sc-dash-card';
  const title = document.createElement('div');
  title.className = 'bz-sc-dash-card-title';
  title.textContent = '缺席状态';
  root.appendChild(title);
  const body = document.createElement('div');
  body.className = 'bz-sc-dash-card-body';
  root.appendChild(body);

  const st = readAbsenceState(data.editingData);
  const line = document.createElement('div');
  line.className = 'bz-sc-dash-trend-text';
  line.textContent = ABSENCE_PHASE_LABELS[st.phase]
    + (st.phase === 'missing' ? ` · 距上次在场 ${daysSincePresence(data.editingData?.lastPresenceAt, now)} 天` : '');
  body.appendChild(line);

  const events = Array.isArray(data.editingData?.selfEvents) ? (data.editingData.selfEvents as SelfEvent[]) : [];
  const recent = events.filter((e) => e && typeof e.at === 'number').slice(-5).reverse();
  if (!recent.length) {
    const empty = document.createElement('div');
    empty.className = 'bz-sc-dash-empty';
    empty.textContent = '最近没有分离与重逢';
    body.appendChild(empty);
    return root;
  }
  for (const e of recent) {
    const row = document.createElement('div');
    row.className = 'bz-sc-dash-trend-text';
    row.textContent = `${SELF_EVENT_LABELS[e.type] || e.type} · ${formatSelfEventTime(e.at, now)}`;
    body.appendChild(row);
  }
  const omitted = events.length - recent.length;
  if (omitted > 0) {
    const more = document.createElement('div');
    more.className = 'bz-sc-dash-empty';
    more.textContent = `更早 ${omitted} 条…`;
    body.appendChild(more);
  }
  return root;
}

// ---------------- 状态机（接线薄壳：纯函数之上只做内存写回 + 既有 dataSaver 落盘） ----------------

/** PAD 写入最小接口（结构化鸭子类型，避免依赖 MoodSystem 具体类造成模块环） */
export interface PadWriter {
  updatePad(axis: 'pleasure' | 'arousal' | 'dominance', change: number, reason?: string): void;
}

export class AbsenceSystem {
  private dataProvider: () => SmartCatData;
  private dataSaver: (d: SmartCatData) => Promise<void>;
  private pad: PadWriter | null;

  constructor(dataProvider: () => SmartCatData, dataSaver: (d: SmartCatData) => Promise<void>, pad: PadWriter | null = null) {
    this.dataProvider = dataProvider;
    this.dataSaver = dataSaver;
    this.pad = pad;
  }

  /**
   * 调度心跳（设计 7）：检查 lastPresenceAt 距今 → 状态迁移。
   * 复用 memorySystem.onSchedulerTick 既有 30s tick，不自建定时器；有迁移才落盘。
   */
  async onSchedulerTick(now = Date.now()): Promise<boolean> {
    const data = this.dataProvider();
    const st = readAbsenceState(data.editingData);
    const r = evalAbsenceTick(st.phase, data.editingData?.lastPresenceAt, ACTIVE_ABSENCE_PROFILE, now);
    if (!r.changed) return false;
    this.applyTransition(data, r, now);
    await this.dataSaver(data);
    return true;
  }

  /** 在场信号（设计 7 重逢判定）：sendChatMessage / onVaultActivity 观察路径统一在 touchPresence 后调用 */
  async onPresenceSignal(now = Date.now()): Promise<boolean> {
    const data = this.dataProvider();
    const st = readAbsenceState(data.editingData);
    const r = evalAbsencePresence(st.phase);
    if (!r.changed) return false;
    this.applyTransition(data, r, now);
    await this.dataSaver(data);
    return true;
  }

  /** 迁移落地：内存写回 absenceState + selfEvents 环形缓冲 + PAD 幅度差量（随后由调用方落盘） */
  private applyTransition(data: SmartCatData, r: AbsenceEvalResult, now: number): void {
    const ed = { ...(data.editingData || {}) };
    ed.absenceState = { phase: r.next, since: now };
    if (r.event) ed.selfEvents = pushSelfEvent(ed.selfEvents, r.event, now);
    // 先改内存再触发 PAD（updatePad 内部 |adjusted|≥1 会随 mood 既有 saver 一并带上新 editingData）
    data.editingData = ed;
    if (r.event) this.applyPadDelta(r.event);
  }

  /** 缺席情绪差量（设计 3）：锚点情绪共振幅度 → 各轴独立过 [1.0,1.8]+0.5× 帽收敛后施加 */
  private applyPadDelta(kind: SelfEventType): void {
    if (!this.pad) return;
    const amp = resonanceAmplitudeOf(kind === 'miss' ? ACTIVE_ABSENCE_PROFILE.missAnchorEmotion : ACTIVE_ABSENCE_PROFILE.reunionAnchorEmotion);
    const dP = absencePadDelta(kind, amp);
    const dA = absencePadDelta(kind, amp * ABSENCE_AROUSAL_SHARE);
    const dD = absencePadDelta(kind, amp * ABSENCE_DOMINANCE_SHARE);
    const sign = kind === 'miss' ? -1 : 1;
    // 牵挂：愉悦↓ 支配↓ 唤醒↑（思念不安）；重逢喜悦：三轴齐升
    this.pad.updatePad('pleasure', sign * dP, `absence:${kind}`);
    this.pad.updatePad('arousal', dA, `absence:${kind}`);
    this.pad.updatePad('dominance', sign * dD, `absence:${kind}`);
  }
}