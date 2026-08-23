/**
 * 心情门控（ticket 095，086 v4 方向四裁决「限范围修：输出维度换」，ADR-0042）。
 *
 * 票据「设计」7 条逐条对应：
 *  1. 频率不动换输出维度：不降搭话频率（周上限/调度节奏不动）；平静期把 Bandit 选中臂
 *     映射到「温和话术子集」（gentleStyleFor / gentlePhraseFor，任意臂都落在子集内）；
 *     主动间隔 2 天 → 3~4 天（默认 3.5 天 QUIET_PROACTIVE_INTERVAL_DAYS，晨起可调）；
 *  2. 每日 1 次温和问候豁免：安静陪伴期每天至多一条纯本地温和问候（GENTLE_GREETINGS，
 *     零 LLM、零 Bandit）——不计 proactive 计数、不标记 pendingArm 不领 reward；
 *  3. 采样器固定挂载：窗口采样器挂既有 60s PAD 衰减循环（MoodSystem.onDecayTick 钩子）
 *     + 30 分钟趋势心跳（maybeTrendDrift），不新建循环；判定从瞬时阈值改为「窗口内多数
 *     采样低于阈值」（pushGateSample 最小间隔去重 + evalQuietEnter/Exit 多数表决，防抖动）；
 *  4. loadMoodState 接线在 mood.ts：新鲜合并 / 24h 陈旧归中性 / 无数据缺省中性（防重启假情绪）；
 *  5. 门控输入 = 趋势漂移：采样值取 analyzeEmotionTrend 的 EMA valence（currentVad.valence），
 *     非瞬时 PAD；60s tick 只复用缓存趋势值补采样，不现算趋势；
 *  6. quietMode 状态机持久化 editingData.quietMode = { on, since }（可选字段零迁移）；
 *     静默超时自动退出兜底（QUIET_SILENCE_TIMEOUT_MS 默认 48h，晨起可调——防情绪数据断供后永久静默）；
 *  7. 打扰总量守恒（体验原则 1）：温和问候与 Bandit 主动共享同一调度槽位——问候只在
 *     主动间隔闸门开启时发出并刷新 lastAt（顺延下一次 Bandit 主动），任一周内外发触点
 *     总数不超过既有间隔/周上限允许的量（3~4 天间隔下每周 ≤2）。
 *
 * 明确不做（票据）：不改 Bandit 结构与既有 reward 口径（只加臂→话术映射与豁免分支）；
 * 不新增设置面板项（全部阈值为出厂常量，「晨起可调」=改本文件常量）。
 */
import type { SmartCatData } from './types';
import { DAY_MS } from './data';

// ---------------- 可调常量（晨起可调；不进设置面板，涌现不可配置） ----------------

/** 采样低判阈值：趋势 EMA valence 严格小于该值记「低采样」（平静/低落倾向） */
export const QUIET_VALENCE_THRESHOLD = 0.2;
/** 进入判定窗口样本数（最近 N 条内做多数表决） */
export const QUIET_WINDOW_SAMPLES = 5;
/** 边界样本数：窗口不足 3 条不判定（防冷启动/稀疏数据误入） */
export const QUIET_MIN_SAMPLES = 3;
/** 退出判定窗口（最近 3 条内非低采样 ≥2 即多数转好） */
export const QUIET_EXIT_WINDOW_SAMPLES = 3;
/** 记录采样最小间隔：60s 衰减 tick 与 30 分钟心跳共用去重（防 60s 克隆灌满窗口） */
export const QUIET_SAMPLE_MIN_GAP_MS = 10 * 60 * 1000;
/** 平静期主动间隔（天）：2 天 → 3~4 天，默认取中 3.5（晨起可调） */
export const QUIET_PROACTIVE_INTERVAL_DAYS = 3.5;
/** 平静期静默超时自动退出兜底（晨起可调）：quietMode 持续超此时长强制退出 */
export const QUIET_SILENCE_TIMEOUT_MS = 48 * 60 * 60 * 1000;
/** 非平静期主动间隔（既有口径，兼容冻结：至少隔 2 天） */
export const NORMAL_PROACTIVE_INTERVAL_DAYS = 2;

// ---------------- 类型 ----------------

/** 安静陪伴期状态（editingData.quietMode，可选字段旧数据零迁移） */
export interface QuietModeState {
  on: boolean;
  /** 当前态开始时间戳（进入安静期/退出时刻） */
  since: number;
}

/** 门控窗口采样：v = 趋势 EMA valence（门控输入=趋势漂移，非瞬时 PAD） */
export interface GateSample {
  t: number;
  v: number;
}

/** 迁移原因：enter 进入安静陪伴 / exit 趋势转好退出 / timeout 静默超时兜底退出 */
export type QuietTransitionReason = 'enter' | 'exit' | 'timeout';

// ---------------- 温和话术子集（设计 1：臂→温和映射；不改 Bandit 结构） ----------------

/** Bandit 臂键（与 index.ts BANDIT_ARMS 同集；此处只作映射表键，不参与选臂） */
export const GENTLE_ARMS = ['empathy', 'life', 'vault'] as const;

/** 臂 → 温和兜底模板子集（LLM 未配置/失败时的模板路径替换；任意臂都落在子集内） */
export const GENTLE_TEMPLATES_BY_ARM: Record<string, string[]> = {
  empathy: [
    '喵~ 不多打扰，我在这儿陪着你。想说话的时候随时叫我。',
    '感觉这几天节奏慢下来了，不用急，我一直在。',
  ],
  life: [
    '今天还好吗？不聊别的，就是来看看你。',
    '喵~ 记得喝口水、伸个懒腰，我在呢。',
  ],
  vault: [
    '你的笔记我都好好收着，不着急整理，慢慢来。',
    '喵~ 库里的东西都在，等你状态好了再一起看。',
  ],
};

/** 臂 → 温和风格指令（LLM 路径 styleHint 替换；只换表达维度，不改选臂与 reward 口径） */
export const GENTLE_STYLE_BY_ARM: Record<string, string> = {
  empathy: '轻声陪伴，不追问情绪细节，只表达「我一直在」',
  life: '轻轻的日常问候，不寒暄不催促，一两句即可',
  vault: '安静提及他的笔记被好好保存着，不催更不提问',
};

/** 温和通用指令（未知臂回退；正常流不会走到） */
export const GENTLE_STYLE_FALLBACK = '极简温和的陪伴一句，不打扰';

/** 每日温和问候语料（纯本地池，含提案点名的「今天还好吗」；豁免分支专用） */
export const GENTLE_GREETINGS: string[] = [
  '今天还好吗？我在呢。',
  '喵~ 不打扰你，就来说声我在。',
  '嗯，陪你待一会儿。累了就歇歇。',
];

/** 臂 → 温和风格指令（未知臂回通用温和） */
export function gentleStyleFor(armId: string): string {
  return GENTLE_STYLE_BY_ARM[armId] ?? GENTLE_STYLE_FALLBACK;
}

/** 臂 → 温和话术（rng 注入可测；未知臂回每日问候池首条兜底，恒有产出） */
export function gentlePhraseFor(armId: string, rng: () => number = Math.random): string {
  const pool = GENTLE_TEMPLATES_BY_ARM[armId];
  if (pool && pool.length) return pool[Math.floor(rng() * pool.length)];
  return GENTLE_GREETINGS[0];
}

/** 每日温和问候语料抽取（rng 注入可测） */
export function gentleGreeting(rng: () => number = Math.random): string {
  return GENTLE_GREETINGS[Math.floor(rng() * GENTLE_GREETINGS.length)];
}

// ---------------- 纯函数：持久化读 / 间隔口径 / 日键 ----------------

/** 读安静陪伴状态（容忍旧数据：on 非布尔 → false；since 非数值 → 0；零迁移） */
export function readQuietMode(editingData: any): QuietModeState {
  const raw = editingData?.quietMode;
  return {
    on: raw?.on === true,
    since: typeof raw?.since === 'number' ? raw.since : 0,
  };
}

/** 读当日温和问候登记日键（editingData.gentleGreeting.day；无登记 → 空串） */
export function readGentleGreetingDay(editingData: any): string {
  const day = (editingData?.gentleGreeting as any)?.day;
  return typeof day === 'string' ? day : '';
}

/** 本地日键 YYYY-MM-DD（每日 1 次按用户本地日历日计，不用 UTC ISO 日） */
export function localDayKey(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 今日温和问候是否可用（纯函数）：当日尚未发过 → true */
export function gentleGreetingAvailable(editingData: any, now: number): boolean {
  return readGentleGreetingDay(editingData) !== localDayKey(now);
}

/**
 * 主动间隔口径（设计 1）：平静期 2 天 → 3~4 天（默认 3.5）；非平静维持既有 2 天。
 * index.ts 的 maybeProactiveCare 与温和问候豁免分支共用本口径（打扰总量守恒的间距基础）。
 */
export function proactiveMinGapMs(quiet: boolean): number {
  return (quiet ? QUIET_PROACTIVE_INTERVAL_DAYS : NORMAL_PROACTIVE_INTERVAL_DAYS) * DAY_MS;
}

// ---------------- 纯函数：窗口采样与多数表决（防抖动，替代 v3 hysteresis） ----------------

const isLowValence = (v: number): boolean => v < QUIET_VALENCE_THRESHOLD;

/** 容忍非法存量输入（旧数据/坏 JSON）：过滤出合法采样条目 */
function sanitizeSamples(raw: unknown): GateSample[] {
  return Array.isArray(raw)
    ? raw.filter((s): s is GateSample => !!s && typeof s === 'object' && typeof (s as any).t === 'number' && typeof (s as any).v === 'number')
    : [];
}

/**
 * 窗口采样写入（纯函数）：距上一条记录不足最小间隔 → 丢弃（60s tick 高频克隆去重，
 * 窗口时间跨度因此 ≥ (N-1)×10min）；追加后保尾截断 ≤ QUIET_WINDOW_SAMPLES。
 */
export function pushGateSample(samples: unknown, v: number, t: number): GateSample[] {
  const base = sanitizeSamples(samples);
  const last = base[base.length - 1];
  if (last && t - last.t < QUIET_SAMPLE_MIN_GAP_MS) return base;
  base.push({ t, v });
  return base.slice(-QUIET_WINDOW_SAMPLES);
}

/**
 * 进入判定（设计 3「窗口内多数采样低于阈值」）：有效样本 ≥ 边界数（3）且
 * 最近 min(len, QUIET_WINDOW_SAMPLES) 条中低采样严格多数。
 */
export function evalQuietEnter(samples: GateSample[]): boolean {
  if (samples.length < QUIET_MIN_SAMPLES) return false;
  const win = samples.slice(-QUIET_WINDOW_SAMPLES);
  const low = win.filter((s) => isLowValence(s.v)).length;
  return low * 2 > win.length;
}

/**
 * 退出判定：有效样本 ≥ 边界数（3）且最近 QUIET_EXIT_WINDOW_SAMPLES 条中
 * 非低采样严格多数（≥2/3）——进出对称防抖，杜绝阈值附近来回切换。
 */
export function evalQuietExit(samples: GateSample[]): boolean {
  if (samples.length < QUIET_MIN_SAMPLES) return false;
  const win = samples.slice(-QUIET_EXIT_WINDOW_SAMPLES);
  const notLow = win.filter((s) => !isLowValence(s.v)).length;
  return notLow * 2 > win.length;
}

/** 迁移评估结果：changed=true 时调用方需写回 quietMode 并落盘 */
export interface QuietTransitionResult {
  next: QuietModeState;
  changed: boolean;
  reason: QuietTransitionReason | null;
}

/**
 * 安静陪伴状态机迁移表（纯函数，设计 5+6）：
 *  - off 且窗口低多数 → enter（since=now）；
 *  - on 且窗口高多数 → exit（趋势转好优先于超时兜底）；
 *  - on 且持续超静默超时（48h 默认）→ timeout 强制退出（防情绪数据断供后永久静默）；
 *  - 其余保持不变（幂等，不落盘）。样本不足边界数时一律不判定。
 */
export function evalQuietTransition(state: QuietModeState, samples: GateSample[], now: number): QuietTransitionResult {
  if (!state.on) {
    if (evalQuietEnter(samples)) return { next: { on: true, since: now }, changed: true, reason: 'enter' };
    return { next: state, changed: false, reason: null };
  }
  if (evalQuietExit(samples)) return { next: { on: false, since: now }, changed: true, reason: 'exit' };
  if (state.since > 0 && now - state.since >= QUIET_SILENCE_TIMEOUT_MS) {
    return { next: { on: false, since: now }, changed: true, reason: 'timeout' };
  }
  return { next: state, changed: false, reason: null };
}

// ---------------- 状态机接线薄壳（对齐 AbsenceSystem 先例：纯函数之上只做内存写回 + dataSaver） ----------------

export class QuietGateSystem {
  private dataProvider: () => SmartCatData;
  private dataSaver: (d: SmartCatData) => Promise<void>;
  /** 窗口采样环形缓冲（内存态不落盘；quietMode 状态本身已持久化，窗口重启重建自愈） */
  private samples: GateSample[] = [];
  /** 缓存门控输入（最近一次趋势心跳的 EMA valence；null=尚无趋势数据，不采样不判定） */
  private trendValence: number | null = null;

  constructor(dataProvider: () => SmartCatData, dataSaver: (d: SmartCatData) => Promise<void>) {
    this.dataProvider = dataProvider;
    this.dataSaver = dataSaver;
  }

  /**
   * 30 分钟心跳入口（index.maybeTrendDrift 调用，设计 3/5）：更新门控输入 → 采样 → 评估迁移。
   * valence=null 表示本次心跳无足够情绪样本（<3 条）——保留上次缓存但照常走采样去重。
   */
  async onHeartbeat(valence: number | null, now = Date.now()): Promise<boolean> {
    if (valence !== null && Number.isFinite(valence)) this.trendValence = valence;
    return this.sampleAndEvaluate(now);
  }

  /** 60s PAD 衰减循环钩子入口（MoodSystem.onDecayTick，设计 3）：以缓存趋势值补采样评估 */
  async onDecayTick(now = Date.now()): Promise<boolean> {
    return this.sampleAndEvaluate(now);
  }

  /** 当前是否安静陪伴期（读持久化态；未装配/数据未加载 → false） */
  isQuiet(): boolean {
    try {
      return readQuietMode(this.dataProvider().editingData).on;
    } catch {
      return false;
    }
  }

  /** 测试辅助：直读窗口缓冲（内存态） */
  __samplesForTests(): GateSample[] {
    return [...this.samples];
  }

  /** 采样 + 迁移评估（私有主路）：仅迁移时写回 editingData.quietMode 并落盘 */
  private async sampleAndEvaluate(now: number): Promise<boolean> {
    if (this.trendValence === null) return false; // 设计 5 无数据缺省：不动
    const before = readQuietMode(this.dataProvider().editingData);
    this.samples = pushGateSample(this.samples, this.trendValence, now);
    const r = evalQuietTransition(before, this.samples, now);
    if (!r.changed) return false;
    const d = this.dataProvider();
    d.editingData = { ...(d.editingData || {}), quietMode: r.next };
    await this.dataSaver(d);
    return true;
  }
}