/**
 * 认知能力模块（2026-08-23 参考 cognitive-engine 设计，自研实现——不引依赖包，Apache-2.0 思路借鉴）
 * 三块能力（对齐库的核心算法，但零依赖、中文友好、纯函数可测）：
 *  ① 情绪趋势/波动度（VAD 映射 + EMA + trend/volatility/dominant——借鉴库 EmotionalModel）
 *  ② Thompson Bandit 自适应（贝叶斯线性回归对角近似的简化版——借鉴库 ThompsonBandit）
 *  ③ 元认知矛盾检测（当前话语 vs 存储事实的否定词检测——借鉴库 detectContradictions）
 * 全部纯函数/内存状态，无 Node API、无 DOM——Obsidian 桌面 + 移动端一致。
 * 持久化由调用方负责：trend 从记忆流情绪序列现算，bandit 参数存 data.editingData（不新增顶层字段）。
 */

// ═══════════════ ① 情绪趋势 / 波动度（VAD 模型） ═══════════════

/** 情绪 → VAD 三维（借鉴库 EMOTION_VAD 表，Russell circumplex + Mehrabian PAD） */
export const EMOTION_VAD: Record<string, { valence: number; arousal: number; dominance: number }> = {
  happy: { valence: 0.8, arousal: 0.5, dominance: 0.6 },
  excited: { valence: 0.7, arousal: 0.9, dominance: 0.6 },
  content: { valence: 0.7, arousal: 0.2, dominance: 0.5 },
  calm: { valence: 0.5, arousal: 0.1, dominance: 0.5 },
  grateful: { valence: 0.8, arousal: 0.3, dominance: 0.4 },
  proud: { valence: 0.7, arousal: 0.5, dominance: 0.8 },
  hopeful: { valence: 0.6, arousal: 0.4, dominance: 0.5 },
  amused: { valence: 0.7, arousal: 0.6, dominance: 0.5 },
  loving: { valence: 0.9, arousal: 0.4, dominance: 0.4 },
  neutral: { valence: 0, arousal: 0.2, dominance: 0.5 },
  sad: { valence: -0.7, arousal: 0.2, dominance: 0.2 },
  anxious: { valence: -0.5, arousal: 0.8, dominance: 0.2 },
  stressed: { valence: -0.6, arousal: 0.7, dominance: 0.3 },
  angry: { valence: -0.6, arousal: 0.8, dominance: 0.7 },
  frustrated: { valence: -0.5, arousal: 0.6, dominance: 0.4 },
  fearful: { valence: -0.7, arousal: 0.8, dominance: 0.1 },
  disappointed: { valence: -0.5, arousal: 0.3, dominance: 0.3 },
  lonely: { valence: -0.6, arousal: 0.2, dominance: 0.2 },
  bored: { valence: -0.3, arousal: 0.1, dominance: 0.3 },
  confused: { valence: -0.3, arousal: 0.5, dominance: 0.2 },
  overwhelmed: { valence: -0.6, arousal: 0.8, dominance: 0.1 },
};
const DEFAULT_VAD = { valence: 0, arousal: 0.3, dominance: 0.5 };

/** 情绪 → VAD 坐标（未知情绪回默认） */
export function emotionToVAD(emotion: string): { valence: number; arousal: number; dominance: number } {
  return EMOTION_VAD[emotion.toLowerCase()] ?? DEFAULT_VAD;
}

/** 情绪快照（一条观察的情绪 → VAD + 强度） */
export interface EmotionSnapshot {
  emotion: string;
  valence: number;
  arousal: number;
  dominance: number;
  intensity: number;
  timestamp: number;
}

/** 从观察序列构建情绪快照（emotion 字段 → VAD；intensity 取 importance） */
export function buildEmotionSnapshots(
  entries: { emotion?: string; importance?: number; created?: string }[],
): EmotionSnapshot[] {
  return entries
    .map((m) => {
      if (!m.emotion) return null;
      const vad = emotionToVAD(m.emotion);
      return {
        emotion: m.emotion,
        valence: vad.valence,
        arousal: vad.arousal,
        dominance: vad.dominance,
        intensity: m.importance ?? 0.5,
        timestamp: m.created ? new Date(m.created).getTime() : Date.now(),
      };
    })
    .filter((s): s is EmotionSnapshot => s !== null);
}

/** 情绪趋势结果（借鉴库 detectTrend/calculateVolatility/findDominantEmotion） */
export interface EmotionTrend {
  /** 最近 N 条主导情绪（众数） */
  dominantEmotion: string;
  /** 趋势：improving 转好 / stable 平稳 / declining 转差 */
  trend: 'improving' | 'stable' | 'declining';
  /** 波动度 0-1（近 10 条 valence 变化均值；≥0.5 视为高波动） */
  volatility: number;
  /** 当前 VAD 状态（最近一条或 EMA 平滑后的平均） */
  currentVad: { valence: number; arousal: number; dominance: number };
  /** 样本数 */
  count: number;
}

const TREND_THRESHOLD = 0.15;
const TREND_MIN_HISTORY = 3;
const VOLATILITY_WINDOW = 10;
const DOMINANT_WINDOW = 5;
const EMA_ALPHA = 0.3;

/** 情绪趋势/波动度分析（纯函数；从记忆流情绪序列现算——无持久化负担） */
export function analyzeEmotionTrend(snapshots: EmotionSnapshot[]): EmotionTrend {
  if (!snapshots.length) {
    return { dominantEmotion: 'neutral', trend: 'stable', volatility: 0, currentVad: { ...DEFAULT_VAD }, count: 0 };
  }
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  // 主导情绪：最近 DOMINANT_WINDOW 条众数
  const recent5 = sorted.slice(-DOMINANT_WINDOW);
  const counts = new Map<string, number>();
  for (const s of recent5) counts.set(s.emotion, (counts.get(s.emotion) ?? 0) + 1);
  let dominant = 'neutral';
  let max = 0;
  for (const [em, c] of counts) if (c > max) { max = c; dominant = em; }
  // 趋势：最近 TREND_MIN_HISTORY 条的 valence 前均值 vs 最后值
  let trend: EmotionTrend['trend'] = 'stable';
  if (sorted.length >= TREND_MIN_HISTORY) {
    const recent = sorted.slice(-TREND_MIN_HISTORY);
    const firstAvg = (recent[0].valence + recent[1].valence) / 2;
    const diff = recent[recent.length - 1].valence - firstAvg;
    if (diff > TREND_THRESHOLD) trend = 'improving';
    else if (diff < -TREND_THRESHOLD) trend = 'declining';
  }
  // 波动度：近 VOLATILITY_WINDOW 条 valence 绝对差均值
  let volatility = 0;
  if (sorted.length >= 2) {
    const recentWin = sorted.slice(-VOLATILITY_WINDOW);
    let total = 0;
    for (let i = 1; i < recentWin.length; i++) total += Math.abs(recentWin[i].valence - recentWin[i - 1].valence);
    volatility = total / (recentWin.length - 1);
  }
  // 当前 VAD：EMA 平滑演化（从最早到最新）
  const cur = { ...DEFAULT_VAD };
  for (const s of sorted) {
    cur.valence = cur.valence * (1 - EMA_ALPHA) + s.valence * EMA_ALPHA;
    cur.arousal = cur.arousal * (1 - EMA_ALPHA) + s.arousal * EMA_ALPHA;
    cur.dominance = cur.dominance * (1 - EMA_ALPHA) + s.dominance * EMA_ALPHA;
  }
  return { dominantEmotion: dominant, trend, volatility: Math.round(volatility * 100) / 100, currentVad: cur, count: sorted.length };
}

/** 情绪趋势中文描述（prompt/周报用） */
export function describeEmotionTrend(t: EmotionTrend): string {
  if (t.count === 0) return '情绪趋势：数据不足';
  const emoZh: Record<string, string> = {
    happy: '开心', excited: '兴奋', content: '满足', calm: '平静', grateful: '感激', proud: '自豪',
    hopeful: '满怀希望', amused: '愉悦', loving: '有爱', neutral: '平常', sad: '难过', anxious: '焦虑',
    stressed: '压力大', angry: '生气', frustrated: '沮丧', fearful: '害怕', disappointed: '失望',
    lonely: '孤独', bored: '无聊', confused: '困惑', overwhelmed: '不堪重负',
  };
  const emo = emoZh[t.dominantEmotion] || t.dominantEmotion;
  const trendText = t.trend === 'improving' ? '正在转好' : t.trend === 'declining' ? '有些转差' : '平稳';
  const vol = t.volatility >= 0.5 ? '，情绪波动明显' : '';
  return `最近常出现「${emo}」情绪，趋势${trendText}${vol}（基于 ${t.count} 条情绪记录）`;
}

// ═══════════════ ② Thompson Bandit 自适应（简化对角近似版） ═══════════════

/** Bandit 臂参数（贝叶斯线性回归对角近似：每维独立高斯） */
export interface BanditArmParams {
  actionId: string;
  /** 每维均值 μ */
  mu: number[];
  /** 每维方差 σ²（先验大 = 探索） */
  sigma2: number[];
  /** 噪声方差 σ²_noise（reward 观测噪声） */
  noiseVariance: number;
  /** 臂维度 */
  dim: number;
  /** 已选次数 */
  trials: number;
}

/** 初始化臂（平坦先验：μ=0，σ²=initialVariance） */
export function initBanditArm(actionId: string, dim: number, initialVariance = 1): BanditArmParams {
  return {
    actionId,
    mu: new Array(dim).fill(0),
    sigma2: new Array(dim).fill(initialVariance),
    noiseVariance: 0.1,
    dim,
    trials: 0,
  };
}

/** 从臂采样（Thompson：μ + σ·N(0,1)——每次采一个取最大） */
export function sampleThompson(
  arms: BanditArmParams[],
  context: number[],
  rng: () => number = Math.random,
): BanditArmParams | null {
  if (!arms.length) return null;
  const gauss = (): number => {
    // Box-Muller 近似
    const u1 = Math.max(1e-9, rng());
    const u2 = Math.max(1e-9, rng());
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  let best: BanditArmParams | null = null;
  let bestSample = -Infinity;
  for (const arm of arms) {
    let sum = 0;
    for (let i = 0; i < arm.dim; i++) {
      const x = context[i] ?? 0;
      sum += (arm.mu[i] + Math.sqrt(arm.sigma2[i]) * gauss()) * x;
    }
    if (sum > bestSample) { bestSample = sum; best = arm; }
  }
  return best;
}

/** reward 回填（贝叶斯更新：precision 加法——借鉴库 update 公式） */
export function updateBandit(arm: BanditArmParams, context: number[], reward: number): BanditArmParams {
  const noise = arm.noiseVariance;
  const mu = [...arm.mu];
  const sigma2 = [...arm.sigma2];
  for (let i = 0; i < arm.dim; i++) {
    const x = context[i] ?? 0;
    if (x === 0) continue;
    const precision = 1 / sigma2[i];
    const newPrecision = precision + (x * x) / noise;
    const newSigma2 = 1 / newPrecision;
    mu[i] = newSigma2 * (mu[i] / sigma2[i] + (x * reward) / noise);
    sigma2[i] = newSigma2;
  }
  return { ...arm, mu, sigma2, trials: arm.trials + 1 };
}

// ═══════════════ ③ 元认知矛盾检测（当前话语 vs 存储事实） ═══════════════

/** 存储事实（小橘从记忆流提炼的用户事实） */
export interface StoredFact {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}

/** 中文否定词（借鉴库 negation 词表，中文化） */
const CN_NEGATIONS = ['不', '没', '别', '不要', '不再', '没有', '不喜欢', '不想要', '拒绝了', '放弃了', '讨厌'];

/**
 * 矛盾检测：当前话语提到事实对象 + 含否定词 → 疑似与存储事实矛盾
 * （借鉴库 detectPerceptVsFacts：实体命中 + negation + 事实置信度）
 */
export function checkContradiction(
  text: string,
  facts: StoredFact[],
): { detected: boolean; detail: string[] } {
  const detail: string[] = [];
  const lower = text.toLowerCase();
  for (const fact of facts) {
    if (fact.confidence <= 0.5) continue;
    // 语义命中：话语包含事实对象（或主语）
    const mentions = lower.includes(fact.object.toLowerCase()) || lower.includes(fact.subject.toLowerCase());
    // 中文否定词的更稳策略：话语含否定词 且 提到对象
    const negated = CN_NEGATIONS.some((n) => lower.includes(n));
    // 反向语义修正：否定词紧贴对象才算（如「不再喜欢跑步」vs「不喜欢跑步的人」——简化先宽松）
    if (mentions && negated) {
      detail.push(`用户说「${fact.object}」时用了否定词，可能与已记事实（${fact.subject} ${fact.predicate} ${fact.object}，置信 ${Math.round(fact.confidence * 100)}%）矛盾`);
    }
  }
  return { detected: detail.length > 0, detail };
}

/** 把记忆流观察提炼成"用户事实"（轻量：从 insight/观察中正则主语-谓语-宾语；无则空数组由调用方补充） */
export function extractStoredFacts(
  entries: { description: string; importance?: number }[],
): StoredFact[] {
  const facts: StoredFact[] = [];
  // 常见模板：「用户说：我喜欢 X」「…不喜欢 X」（小橘观察多为「你写了日记：…」「你看了《X》，影评：…」）
  // 宽松匹配：「你(在…)?(写了|说了|看了|读了|记下|剪藏了)……(我喜欢|讨厌|爱|认定) X」——中间允许前缀词（如「日记：」「影评：」）
  // ADR-0025 补动词与「在…记下」前缀（闪念源），覆盖书库/影视/闪念/信/反省观察源
  const pattern = /(?:用户|你)(?:在[^，。：:]{0,8}?)?(?:说|说了|写下|写了|觉得|认为|看(?:过|了)|读(?:过|了)|剪藏了|记下).{0,14}?(我喜欢|我爱|我讨厌|我认定|我是|我决定)(.{1,20})/;
  for (const e of entries) {
    const m = e.description.match(pattern);
    if (m && m[2]) {
      facts.push({
        subject: '用户',
        predicate: m[1],
        // 观察文本尾部常带「（关键词：…）」等元信息或句尾标点——剥离后再存
        object: m[2].replace(/[（(].*$/, '').replace(/[，。！？、\s]$/, ''),
        confidence: e.importance ?? 0.6,
      });
    }
    if (facts.length >= 20) break;
  }
  return facts;
}