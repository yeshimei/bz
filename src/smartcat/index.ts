/**
 * smartcat 域入口（小橘陪伴猫）
 * ensureSmartCat 幂等懒加载：挂载猫容器 + 装配全部子系统 + 常驻监听
 * （file-open 书评 / visibilitychange 欢迎回来 / 记忆固化）。
 * unloadSmartCat 全量清理。命令回调：open（召唤显示）/ chat（聊天）/ hide（隐藏）。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { loadSmartCatData, saveSmartCatData, getSmartcatFilePath, defaultPersonalityGrowth } from './data';
import { eventSystem, setSmartcatApp, setupVisibilityCheck, __resetVisibilityForTests } from './state';
import { mountCatContainer, unmountCatContainer, applyAppearance, createChatPanel, showChatPanel, hideChatPanel, openSmartcatSettings } from './ui';
import { BubbleManager } from './bubble';
import { MoodSystem, PersonalityGrowth } from './mood';
import { MemorySystem } from './memory';
import { SmartCatAnimation } from './animation';
import { InteractionManager, MobileInputAdapter } from './interaction';
import { getSmartCatMessage } from './messages';
import { generatePrompt } from './prompts';
import { callChat, isAIConfigured } from './api';
import { generateBookDescription, hasBookTag } from './content';
import { classifyPath, observationText } from './context-source';
import { DOMAIN_FILES, snapshotDomains } from './domain-source';
import { buildRhythmProfile, isActiveNow, describeRhythm, periodText, isoWeekKey } from './rhythm';
import { buildWeeklyReportData, generateWeeklyReport, weekWindow } from './report';
import { buildCompanionContext } from './companion-context';
import { analyzeEmotionTrend, buildEmotionSnapshots, describeEmotionTrend, checkContradiction, extractStoredFacts, initBanditArm, sampleThompson, updateBandit } from './cognitive';
import { openSmartcatDashboard, closeSmartcatDashboard } from './dashboard';
import type { SmartCatData, SmartCatConfig, ProactiveCareState } from './types';
import type { BanditArmParams } from './cognitive';
import type { SmartcatPanels } from './ui';

// 小橘数据面板（ticket 071）：命令 bz-smartcat-dashboard 入口（只读可视化，main.ts 经此转发）
export { openSmartcatDashboard, closeSmartcatDashboard };

let initialized = false;
let appRef: App | null = null;
let data: SmartCatData | null = null;
let bubbleManager: BubbleManager | null = null;
let moodSystem: MoodSystem | null = null;
let personalityGrowth: PersonalityGrowth | null = null;
let memorySystem: MemorySystem | null = null;
let animation: SmartCatAnimation | null = null;
let interaction: InteractionManager | null = null;
let mobileAdapter: MobileInputAdapter | null = null;
let panels: SmartcatPanels | null = null;
let fileOpenRef: any = null;
let vaultRefs: any[] = [];
/** vault 活动去弹跳：同一路径 10 分钟内只计一次（防自动保存连发；非严格只读不影响数据） */
const lastActivity = new Map<string, number>();
/** 机械去簇（红队 B P1-4）：1 分钟内 ≥5 个不同路径 = 批量导入/同步，折叠为机械事件（不计信任成长） */
const batchWindow: { path: string; t: number }[] = [];
let visibilityCleanup: (() => void) | null = null;
let greetTimer: ReturnType<typeof setTimeout> | null = null;
/** 主动关心调度（2026-08-23：作息模型判定时机，每周 ≤ proactiveWeeklyCap 次温和搭话） */
let proactiveTimer: ReturnType<typeof setInterval> | null = null;
/** 每周报告调度（每小时检查，10:00 触发生成） */
let weeklyReportTimer: ReturnType<typeof setInterval> | null = null;
/** 每周报告状态（editingData.weeklyReport） */
interface WeeklyReportState { weekKey: string; at: number; }
function getWeeklyReportState(): WeeklyReportState {
  const d = dataProvider();
  const s = (d.editingData?.weeklyReport || {}) as Partial<WeeklyReportState>;
  return { weekKey: typeof s.weekKey === 'string' ? s.weekKey : '', at: typeof s.at === 'number' ? s.at : 0 };
}

const dataProvider = (): SmartCatData => {
  if (!data) throw new Error('smartcat: 数据未加载');
  return data;
};
const dataSaver = async (d: SmartCatData): Promise<void> => {
  data = d;
  if (appRef) await saveSmartCatData(appRef, d);
};

/** 域配置读取（供 interaction） */
function getConfig(): SmartCatConfig {
  return dataProvider().config;
}
async function saveConfig(c: SmartCatConfig): Promise<void> {
  const d = dataProvider();
  d.config = c;
  await dataSaver(d);
}

/** 幂等初始化（懒加载；命令/onLayoutReady 触发） */
export async function ensureSmartCat(app: App): Promise<void> {
  if (initialized) return;
  initialized = true;
  appRef = app;
  setSmartcatApp(app);

  data = await loadSmartCatData(app);
  // 竞态守卫：等待期间若被 unload（main 的 void ensureSmartCat 是 fire-and-forget），停止装配
  if (!initialized) {
    data = null;
    return;
  }
  // 用户拍板：所有数据单 json——首次无文件时也落盘一次（迁移或在空账本上建文件）
  if (!app.vault.getAbstractFileByPath(getSmartcatFilePath())) {
    await saveSmartCatData(app, data);
  }
  // 竞态守卫 1.5：首次落盘等待期间被 unload 则停止装配
  if (!initialized) {
    data = null;
    return;
  }

  // ---- 子系统装配（顺序与原 SmartCompanionApp 一致） ----
  bubbleManager = new BubbleManager();
  moodSystem = new MoodSystem(app, dataProvider, dataSaver);
  personalityGrowth = new PersonalityGrowth(dataProvider, dataSaver);
  memorySystem = new MemorySystem(app, dataProvider, dataSaver);
  // ADR-0021：init = 探测 Ollama + 加载向量 + 反思调度（取代原 24h 固化调度）
  await memorySystem.init();
  if (!initialized) return; // 竞态守卫 2：init 期间被 unload 则丢弃装配
  // 反思驱动人格（ADR-0023：洞察 → existential 成长 + 行为周统计深更新）
  memorySystem.onReflect = async (insights) => {
    if (personalityGrowth) {
      if (insights && insights.length) await personalityGrowth.applyReflectionInsights(insights);
      // MATE character_from_experience：反思时把累积行为统计折算进 traits（周深更新）
      await personalityGrowth.applyWeeklyExperience();
    }
  };

  // ADR-0025 情绪闭环 A 面：每条观察（日记/闪念/聊天/域事件…）→ 瞬时情绪 + 温和共振进 PAD
  memorySystem.onObservation = (m) => {
    if (!moodSystem || !m?.emotion) return;
    try {
      moodSystem.registerEmotion(m.emotion);
      moodSystem.applyEmotionResonance(m.emotion);
    } catch (e) { /* 共振失败不影响记忆主流程 */ }
  };

  // 猫容器 + 皮肤 + 动画 + 指示器
  const container = mountCatContainer()!;
  applyAppearance(container, data.config.appearance);
  animation = new SmartCatAnimation(container);
  animation.initialize();
  // 100ms 后问候（原 SmartCatAnimation module.exports greet；定时器挂模块级供 unload 清理）
  greetTimer = setTimeout(() => animation?.greet(), 100);

  // 交互（2026-08-23 用户拍板：删语音模块）
  interaction = new InteractionManager({
    config: getConfig,
    saveConfig,
    bubble: bubbleManager,
    mood: moodSystem,
    openChat: () => openChat(),
    closeChat: () => closeChat(),
    openSettings: () => openSettings(),
    closeSettings: () => closeSettings(),
    onAppearanceChanged: (appearance) => {
      applyAppearance(mountCatContainer()!, appearance as any);
    },
    // ADR-0021：记忆流检索注入聊天上下文（格式化后返回；失败返回空串）
    // ADR-0025：第二参 lexicalQuery 供词法降级模式（纯用户消息，免「情绪/时段」噪音）
    retrieveMemories: async (query: string, lexicalQuery?: string) => {
      if (!memorySystem) return '';
      try {
        const memories = await memorySystem.retrieve(query, undefined, { lexicalQuery });
        return memories.length ? memorySystem.formatMemoriesForPrompt(memories) : '';
      } catch (e) {
        return '';
      }
    },
    // ADR-0023：prompt 状态向量数据（性格系统 traits/OCEAN）
    characterData: () => data,
    // ADR-0023：互动回流 → 性格微移 + 行为统计（MATE character_transition）
    onInteraction: (type: string, intensity = 1) => {
      if (personalityGrowth) {
        personalityGrowth.developBasedOnInteraction(type, intensity).catch(() => {});
      }
    },
  });
  interaction.setupInteractions();

  // 移动端输入法适配
  mobileAdapter = new MobileInputAdapter(container);

  // ---- 常驻监听 ----
  // file-open → 书评（原 ContentMonitor.setupNoteSwitchDetection：book 标签笔记首次打开生成一句话书评）
  fileOpenRef = (app.workspace as any).on('file-open', (file: any) => {
    if (!file) return;
    eventSystem.emit('fileOpened', { file });
    void generateBookReview();
  });

  // 笔记库接入（ADR-0024 决策，ticket 025）：vault create/modify（实时事件，不扫存量）
  //   → ① 写日记/闪念计入信任成长（轻质量 0.15）② 笔记库内容 → 小橘信息观察（隐私分级）
  const onVaultActivity = async (file: any) => {
    if (!file || !file.path || !data || !personalityGrowth || !memorySystem || !appRef) return;
    const kind = classifyPath(file.path);
    if (!kind || !data.config.noteSource) return;
    const now = Date.now();
    const last = lastActivity.get(file.path) || 0;
    if (now - last < 10 * 60 * 1000) return;          // 同一路径 10 分钟去弹跳
    lastActivity.set(file.path, now);
    if (lastActivity.size > 300) {
      const first = lastActivity.keys().next().value;
      if (first !== undefined) lastActivity.delete(first);
    }
    // 机械去簇：1 分钟内不同路径 ≥5 条 → 批量导入/同步，折叠为一次机械事件（不计信任、观察合并）
    const since = now - 60 * 1000;
    while (batchWindow.length && batchWindow[0].t < since) batchWindow.shift();
    batchWindow.push({ path: file.path, t: now });
    const distinct = new Set(batchWindow.map((b) => b.path)).size;
    const mechanical = distinct >= 5;
    if (kind === 'diary' || kind === 'flash') {
      if (!mechanical) {
        personalityGrowth.developBasedOnInteraction(kind, 0.3, 0.02, 0.15).catch(() => {});
      }
    }
    // PAD 生产补接线（2026-08-23 用户拍板，红队 C G1/G2 消除 sim 专属通道假阳性）：
    // vault 正向活动轻量影响心情——用生产 EFFECTS 表（不改公式，仅接线），强度 VAULT_PAD_GAIN=0.5
    if (!mechanical && moodSystem) {
      const padType = kind === 'diary' ? 'note_create' : kind === 'flash' ? 'note_edit' : 'note_read';
      moodSystem.handleInteraction(padType as any, 0.5);
    }
    try {
      const text = await observationText(appRef, file as any, kind);
      // 2026-08-23 用户拍板：所有内容走 LLM 云端打分 + 词法情绪（AI 未配置降级本地规则分）
      if (text) await memorySystem.addObservation(text, { source: kind });
    } catch { /* 读取失败静默（不打断主流程） */ }
  };
  if (app.vault && typeof (app.vault as any).on === 'function') {
    vaultRefs.push((app.vault as any).on('create', onVaultActivity));
    vaultRefs.push((app.vault as any).on('modify', onVaultActivity));
  }

  // 域 JSON 感知（2026-08-23 用户拍板：CONFIG/STORAGE 域数据 modify → 观察；懒启动探测）
  void onDomainActivity();

  // visibilitychange → 欢迎回来（离开超 60s 才允许）
  visibilityCleanup = setupVisibilityCheck({
    onLeaveLong: () => { /* 允许回程语 */ },
    onBack: () => {
      if (!appRef) return;
      const hour = new Date().getHours();
      let timeBasedMessages: string[] = [];
      if (hour >= 5 && hour < 12) timeBasedMessages = ['早晨好！新的一天开始啦！🌅', '早安！今天也要元气满满哦！', '清晨的阳光迎接你的归来~', '早上好！思维最清晰的时刻到了！'];
      else if (hour >= 12 && hour < 18) timeBasedMessages = ['下午好！继续上午的创作吧！', '午安~ 休息后思路更清晰！', '下午时光，正是创作好时节~', '日正当中，灵感正盛！'];
      else timeBasedMessages = ['晚上好！宁静的夜晚适合思考~', '晚安前的创作时间到了！', '星空下的灵感特别美丽~', '夜晚是思维最活跃的时候呢！'];
      let msg: string;
      if (Math.random() > 0.5) {
        msg = timeBasedMessages[Math.floor(Math.random() * timeBasedMessages.length)];
      } else {
        msg = getSmartCatMessage('WELCOME_BACK_MESSAGES');
      }
      // ADR-0025 B 面：欢迎回来也「懂你」——作息有数据时掺入作息感知话
      if (data && data.memory.stream.length >= 3 && Math.random() > 0.6) {
        try {
          const profile = buildRhythmProfile(data.memory.stream, 30, Date.now());
          if (profile.total >= 3) {
            msg = `我注意到你通常在${describeRhythm(profile)}最活跃。欢迎回来，我一直在哦~`;
          }
        } catch { /* 作息失败用原消息 */ }
      }
      bubbleManager!.showBubble(msg);
    },
  });

  // 主动关心（2026-08-23：作息模型 + 每周 ≤2 次温和搭话；每 10 分钟检查一次）
  startProactiveCare();
  // 每周懂你报告（2026-08-23：每周一检查，有观察则生成写回流 + 气泡展示）
  startWeeklyReport();
  void maybeWeeklyReport();
  // 情绪趋势回写心情（ADR-0025 A 面：30 分钟节流，declining/improving/高波动温和漂移 PAD）
  startTrendDrift();

  eventSystem.emit('appInitialized');
}


// ---------------- 主动关心（作息模型判定时机，2026-08-23 用户拍板） ----------------

/** 读取主动关心状态（editingData 可空/旧数据无 → 默认） */
function getProactiveState(): ProactiveCareState {
  const d = dataProvider();
  const s = (d.editingData?.proactiveCare || {}) as Partial<ProactiveCareState>;
  const week = isoWeekKey();
  // 跨周：重置计数（周键变化即新周）
  if (s.week !== week) return { week, count: 0, lastAt: typeof s.lastAt === 'number' ? s.lastAt : 0 };
  return { week, count: typeof s.count === 'number' ? s.count : 0, lastAt: typeof s.lastAt === 'number' ? s.lastAt : 0 };
}

// ---------------- Bandit 选臂（ticket 035：Thompson 自适应主动关心策略） ----------------

/** Bandit 臂：3 类话术（context 特征 [mood(0-1), hour(0-1)]，reward = 用户是否回应） */
const BANDIT_ARMS = ['empathy', 'life', 'vault'];
const BANDIT_DIM = 2;

/** 读取 Bandit 臂参数（无 → 初始化平坦先验；持久化于 editingData.ceBandit，不新增顶层字段） */
function getBanditArms(): BanditArmParams[] {
  const d = dataProvider();
  const raw = (d.editingData?.ceBandit || {}) as Record<string, any>;
  return BANDIT_ARMS.map((id) => {
    const p = raw[id];
    return p ? { ...initBanditArm(id, BANDIT_DIM, 1), ...p } : initBanditArm(id, BANDIT_DIM, 1);
  });
}

/** 保存 Bandit 臂参数 */
async function saveBanditArm(arm: BanditArmParams): Promise<void> {
  const d = dataProvider();
  const raw = (d.editingData?.ceBandit || {}) as Record<string, any>;
  d.editingData = { ...(d.editingData || {}), ceBandit: { ...raw, [arm.actionId]: arm } };
  await dataSaver(d);
}

/** 当前上下文特征（mood 愉悦归一 0-1；hour 归一 0-1）——Bandit 据此选臂 */
function banditContext(): number[] {
  const pad = moodSystem?.pad || { pleasure: 55, arousal: 50, dominance: 50 };
  const hourNorm = new Date().getHours() / 24;
  return [pad.pleasure / 100, hourNorm];
}

/** 主动关心后：标记 pending arm（等待用户回应与否回填 reward） */
function markProactiveArm(armId: string): void {
  const d = dataProvider();
  const s = (d.editingData?.ceBandit || {}) as Record<string, any>;
  d.editingData = { ...(d.editingData || {}), ceBandit: { ...s, pendingArm: armId, pendingAt: Date.now() } };
  void dataSaver(d);
}

/** 用户回应（聊天消息）时：回填上次主动关心的 reward（10 分钟内回应 = 1，超时 = 0） */
async function rewardProactiveArm(): Promise<void> {
  const d = dataProvider();
  const s = (d.editingData?.ceBandit || {}) as Record<string, any>;
  const armId = s.pendingArm as string | undefined;
  const at = s.pendingAt as number | undefined;
  if (!armId || !at) return;
  const responded = Date.now() - at < 10 * 60 * 1000;
  const arm = getBanditArms().find((a) => a.actionId === armId);
  if (arm) {
    const updated = updateBandit(arm, banditContext(), responded ? 1 : 0);
    await saveBanditArm(updated);
  }
  d.editingData = { ...(d.editingData || {}), ceBandit: { ...(d.editingData?.ceBandit || {}), pendingArm: undefined, pendingAt: undefined } };
  await dataSaver(d);
}

/** 主动关心调度：每 10 分钟检查；时机 = 距上次 ≥2 天 + 本周未超上限 + 当前在用户活跃时段 */
function startProactiveCare(): void {
  if (proactiveTimer) clearInterval(proactiveTimer);
  proactiveTimer = setInterval(() => {
    void maybeProactiveCare();
  }, 10 * 60 * 1000);
}

/** 温和主动搭话（LLM 生成一句关心；AI 未配置/失败 → 模板兜底；Bandit 选臂决定话术风格） */
async function maybeProactiveCare(): Promise<void> {
  if (!data || !bubbleManager || !moodSystem || !memorySystem || !personalityGrowth) return;
  const cfg = data.config;
  if (!cfg.proactiveCare) return;
  if (!memorySystem || data.memory.stream.length < 3) return; // 记忆太少还不知道你
  const st = getProactiveState();
  if (st.count >= Math.max(1, cfg.proactiveWeeklyCap || 2)) return;
  const since = Date.now() - st.lastAt;
  if (since < 2 * 24 * 60 * 60 * 1000) return; // 至少隔 2 天
  // 作息模型：当前是否用户活跃时段（无数据 → 保守不打扰）
  const profile = buildRhythmProfile(data.memory.stream, 30, Date.now());
  if (!profile.total || !isActiveNow(profile)) return;
  // Bandit 选臂（ticket 035）：从 3 类话术中按 mood+hour 上下文 Thompson 采样
  const chosen = sampleThompson(getBanditArms(), banditContext());
  const armId = chosen?.actionId ?? BANDIT_ARMS[0];
  try {
    if (!(await isAIConfigured())) {
      // 模板兜底（按臂分类）
      const templates: Record<string, string[]> = {
        empathy: [
          `我看记录你最近情绪有些波动，${describeEmotionTrend(analyzeEmotionTrend(buildEmotionSnapshots(data.memory.stream)))}。想说的时候我都在。`,
          `喵~ 感觉你这阵子心情起伏不小，要不要和我说说？`,
        ],
        life: [
          `我看了下你的记录，你通常在${describeRhythm(profile)}最活跃。这段时间你也总是很认真。`,
          `刚才我翻了下脑海里的记忆，想起你最近在忙的事。${periodText()}了，照顾好自己。`,
        ],
        vault: [
          `喵~ 我记住你${periodText()}也常出现。最近记了什么新想法吗？`,
          `我注意到你这几天的笔记很密集，是不是在忙什么大计划？`,
        ],
      };
      const pool = templates[armId] || templates.life;
      bubbleManager.showBubble(pool[Math.floor(Math.random() * pool.length)]);
    } else {
      // 近 3 条记忆做引子 + 懂你上下文块（作息/趋势/关系/检索记忆）→ LLM 温和关心（按臂给风格指令）
      const recent = data.memory.stream.slice(-3).map((m) => m.description).join('；');
      const styleHint = armId === 'empathy' ? '侧重共情，接住用户的情绪' : armId === 'vault' ? '侧重内容，聊他最近的笔记' : '侧重生活，像老朋友寒暄';
      // ADR-0025 B 面：与聊天同源的「懂你上下文」
      let memoriesText = '';
      try {
        const mems = await memorySystem.retrieve('', undefined);
        memoriesText = mems.length ? memorySystem.formatMemoriesForPrompt(mems) : '';
      } catch { /* 检索失败用空 */ }
      const companionContext = buildCompanionContext({
        stream: data.memory.stream,
        relationship: data.personalityGrowth?.relationship ?? null,
        emotion: moodSystem.getCurrentEmotion(),
        memoriesText,
      });
      const prompt = generatePrompt('auto_companion', '', {
        pad: moodSystem.pad,
        data,
        currentMood: moodSystem.currentMood,
        currentEmotion: moodSystem.getCurrentEmotion(),
        companionContext,
      });
      const response = await callChat([
        { role: 'system', content: prompt },
        { role: 'user', content: `你主动关心用户一次（温和、简短、像老朋友）。本次侧重：${styleHint}。最近记忆有：${recent}。\n\n你了解到的背景：\n${companionContext}` },
      ]);
      if (response) bubbleManager.showBubble(response);
      else bubbleManager.showBubble('喵~ 我注意到你最近常在深夜写东西，记得照顾好自己。');
    }
    // 记录本次主动（写回 editingData，不新增顶层字段）+ 标记 Bandit pending arm
    const d = dataProvider();
    const next: ProactiveCareState = { week: isoWeekKey(), count: st.count + 1, lastAt: Date.now() };
    d.editingData = { ...(d.editingData || {}), proactiveCare: next };
    markProactiveArm(armId);
    await dataSaver(d);
  } catch (e) {
    /* 主动失败静默（不打扰） */
  }
}

// ---------------- 情绪趋势回写心情（ADR-0025 A 面：近 48h 趋势 → PAD 温和漂移） ----------------

let trendDriftTimer: ReturnType<typeof setInterval> | null = null;

/** 趋势回写调度（每 30 分钟检查；观察情绪样本 ≥3 才动） */
function startTrendDrift(): void {
  if (trendDriftTimer) clearInterval(trendDriftTimer);
  trendDriftTimer = setInterval(() => {
    void maybeTrendDrift();
  }, 30 * 60 * 1000);
}

/** 近 48h 观察情绪序列 → 趋势/波动 → applyTrendDrift（温和回写；样本太少不动） */
async function maybeTrendDrift(): Promise<void> {
  if (!data || !moodSystem) return;
  const since = Date.now() - 48 * 60 * 60 * 1000;
  const recent = data.memory.stream.filter((m) => m.type === 'observation' && m.emotion && new Date(m.created).getTime() >= since);
  if (recent.length < 3) return;
  try {
    const trend = analyzeEmotionTrend(buildEmotionSnapshots(recent));
    moodSystem.applyTrendDrift(trend);
  } catch (e) { /* 趋势回写失败静默 */ }
}

// ---------------- 每周懂你报告（2026-08-23「懂你」增强：⑦） ----------------

/** 周报调度：每天 10:00 检查一次（新一周且本周有观察 → 生成） */
function startWeeklyReport(): void {
  if (weeklyReportTimer) clearInterval(weeklyReportTimer);
  weeklyReportTimer = setInterval(() => {
    const h = new Date().getHours();
    if (h === 10) void maybeWeeklyReport();
  }, 60 * 60 * 1000);
}

/** 生成本周报告（仅当新周 + 本周有观察；LLM/兜底 → 写回流 source weekly-report + 气泡展示 + 状态推进） */
async function maybeWeeklyReport(): Promise<void> {
  if (!data || !bubbleManager || !moodSystem || !memorySystem) return;
  const st = getWeeklyReportState();
  const weekKey = isoWeekKey();
  if (st.weekKey === weekKey) return; // 本周已生成
  const win = weekWindow(Date.now());
  const [start] = win;
  // 周一起算：只在本周窗口已至少过去 1 天且本周有观察时生成（周二起才可能）
  if (Date.now() - start < 24 * 60 * 60 * 1000) return;
  const weekEntries = data.memory.stream.filter((m) => {
    const t = m.created ? new Date(m.created).getTime() : NaN;
    return Number.isFinite(t) && t >= win[0] && t <= win[1] && m.type === 'observation';
  });
  if (weekEntries.length < 3) return; // 观察太少，本周报告无意义（下周再试）
  try {
    const report = buildWeeklyReportData(data.memory.stream, moodSystem.pad, Date.now());
    const text = await generateWeeklyReport(report);
    if (!text) return;
    // 写回流（insight，source weekly-report，importance 高——记忆流可见但 insight 不作反思 evidence）
    await memorySystem.addInsight(`【本周懂你报告】${text}`, [], 0.8, undefined, 'weekly-report');
    // 气泡展示（隐藏超长：先给一句导语，全文在设置弹窗「查看报告」）
    bubbleManager.showBubble(`喵~ 我读完这周关于你的记录了。${text.length > 60 ? text.substring(0, 60) + '……' : text}`);
    const d = dataProvider();
    d.editingData = { ...(d.editingData || {}), weeklyReport: { weekKey, at: Date.now() } as WeeklyReportState };
    await dataSaver(d);
  } catch (e) {
    /* 周报失败静默（下周再试；不推进状态） */
  }
}



/** 书评（原 ContentMonitor.generateBookReview：book 标签笔记首次打开一句话评价） */
async function generateBookReview(): Promise<void> {
  if (!appRef || !data || !bubbleManager || !moodSystem) return;
  try {
    const app = appRef;
    // 仅当当前笔记带 book 标签才生成；每文件一次（dom 内 Set 记忆）
    if (!hasBookTag()) return;
    const bookDescription = generateBookDescription();
    if (!bookDescription) return;
    // ADR-0025 B 面：书评也带「懂你上下文」（作息/趋势/关系；不额外检索记忆省一次调用）
    const companionContext = buildCompanionContext({
      stream: data.memory.stream,
      relationship: data.personalityGrowth?.relationship ?? null,
      emotion: moodSystem.getCurrentEmotion(),
    });
    const prompt = generatePrompt('book_review', `请基于以下书籍数据给出简短评价：${bookDescription}`, {
      pad: moodSystem.pad,
      data,
      currentMood: moodSystem.currentMood,
      currentEmotion: moodSystem.getCurrentEmotion(),
      companionContext,
    });
    const response = await callChat([
      { role: 'system', content: prompt },
      { role: 'user', content: '请用简短的一句话给出评价或建议。' },
    ]);
    if (response) {
      // 原版 showBubble(message, '🎓') 第二参当 duration（铁律 4 保留）
      (bubbleManager as any).showBubble(response, '🎓');
    }
  } catch (error) {
    console.error('[smartcat] 书评失败:', error);
  }
}

// ---------------- 命令回调 ----------------

/** 打开（召唤/显示小橘） */
export async function openSmartCat(app: App): Promise<void> {
  await ensureSmartCat(app);
}

/** 打开聊天面板 */
export async function openSmartCatChat(app: App): Promise<void> {
  await ensureSmartCat(app);
  openChat();
}

/** 隐藏小橘（卸载 DOM 与常驻，数据保留） */
export function hideSmartCat(): void {
  if (!initialized) return;
  closeChat();
  closeSettings();
  unmountCatContainer();
  const c = document.getElementById('smart-companion-cat');
  if (c && c.parentNode) c.parentNode.removeChild(c);
}

/** 打开聊天面板（挂猫容器 + 建面板 + 显示） */
function openChat(): void {
  if (!initialized || !appRef) return;
  if (!document.getElementById('chat-panel')) {
    panels = createChatPanel({
      onSend: (message) => void sendChatMessage(message),
      onSettings: () => openSettings(),
      onClose: () => closeChat(),
    });
  }
  if (!panels) return;
  const s = getSettings() as any;
  showChatPanel(panels, s.smartcatMobileDefaultFullscreen === true);
  renderChatHistory();
  if (interaction) {
    interaction.isChatOpen = true;
    interaction.isSettingsOpen = false;
  }
}

function closeChat(): void {
  if (panels) hideChatPanel(panels);
  if (interaction) {
    interaction.isChatOpen = false;
    interaction.isSettingsOpen = false;
  }
}

/** 打开设置弹窗（⚙️ / 长按 / 五击） */
function openSettings(): void {
  if (!initialized) return;
  openSmartcatSettings({
    getConfig,
    saveConfig,
    settingsKeys: {
      enabled: true,
      mobileFullscreen: (getSettings() as any).smartcatMobileDefaultFullscreen === true,
    },
    setMobileFullscreen: async (v) => {
      (getSettings() as any).smartcatMobileDefaultFullscreen = v;
      await saveSettings();
    },
    // ADR-0023：人格成长可视化 + 重置
    getPersonalityGrowth: () => {
      return data ? data.personalityGrowth : null;
    },
    resetPersonalityGrowth: async () => {
      if (!data || !appRef) return;
      const fresh = defaultPersonalityGrowth();
      // 保留已有 30 特质成长历史？重置 = 回新种子（MATE：重置出生）
      data.personalityGrowth = fresh;
      await saveSmartCatData(appRef, data);
    },
    // 每周懂你报告（2026-08-23：最近一份 weekly-report 洞察，无则 null）
    getWeeklyReport: () => {
      if (!data || !memorySystem) return null;
      const reports = data.memory.stream
        .filter((m) => m.source === 'weekly-report' && m.type === 'insight')
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      return reports.length ? reports[0].description : null;
    },
    // 数据面板移动端全屏（ticket 071，主窗口规范三件事之三：域设置弹窗挂行，仅移动端显示）
    getDashboardMobileFullscreen: () => (getSettings() as any).smartcatDashboardMobileDefaultFullscreen === true,
    setDashboardMobileFullscreen: async (v) => {
      (getSettings() as any).smartcatDashboardMobileDefaultFullscreen = v;
      await saveSettings();
    },
  });
  if (interaction) {
    interaction.isSettingsOpen = true;
    interaction.isChatOpen = false;
  }
}

function closeSettings(): void {
  // 设置弹窗由 openSettingsModal 管理（mask/ESC 关闭）；此处只清状态
  if (interaction) {
    interaction.isSettingsOpen = false;
    interaction.isChatOpen = false;
  }
}

/** 渲染历史消息 */
function renderChatHistory(): void {
  if (!panels || !data) return;
  panels.chatMessages.innerHTML = '<div class="message cat-message">你好！我是你的笔记陪伴小橘，可以基于你的笔记内容和你聊天~</div>';
  const history = data.config.conversationHistory || [];
  history.forEach((chat) => {
    const div = document.createElement('div');
    div.className = chat.role === 'user' ? 'message user-message' : 'message cat-message';
    div.textContent = chat.content;
    panels!.chatMessages.appendChild(div);
  });
  panels.chatMessages.scrollTop = panels.chatMessages.scrollHeight;
}

/** 发聊天消息（原 InteractionManager.sendMessage：历史 + AI 回复打字机） */
async function sendChatMessage(message: string): Promise<void> {
  if (!panels || !data || !interaction || !bubbleManager) return;
  const chatMessages = panels.chatMessages;
  const chatInput = panels.chatInput;

  // Bandit reward 回填（ticket 035）：用户主动发消息 = 对上次主动关心的回应
  void rewardProactiveArm();

  const userMessageEl = document.createElement('div');
  userMessageEl.className = 'message user-message';
  userMessageEl.textContent = message;
  chatMessages.appendChild(userMessageEl);
  chatInput.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'message cat-message';
  typingIndicator.textContent = '小橘正在思考...';
  typingIndicator.id = 'typing-indicator';
  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    // 元认知矛盾检测（ticket 035）：当前消息 vs 记忆流用户事实 → 命中则给回复加提醒
    let contradictionHint = '';
    try {
      const facts = extractStoredFacts(data.memory.stream);
      const cr = checkContradiction(message, facts);
      if (cr.detected && cr.detail.length) contradictionHint = '\n\n（小橘注意到：' + cr.detail[0] + '——你是不是改变主意了？）';
    } catch { /* 矛盾检测失败不阻断 */ }
    // 情绪趋势注入（ticket 035）：格式化后拼进 user 上下文尾
    let emotionContext = '';
    try {
      const trend = analyzeEmotionTrend(buildEmotionSnapshots(data.memory.stream));
      if (trend.count > 0) emotionContext = '\n用户近期情绪趋势：' + describeEmotionTrend(trend);
    } catch { /* 无情绪数据跳过 */ }
    const messages = await interaction.prepareChatMessages(message + emotionContext + contradictionHint);
    const response = await callChat(messages);
    const indicator = chatMessages.querySelector('#typing-indicator');
    if (indicator) indicator.remove();

    const catMessageEl = document.createElement('div');
    catMessageEl.className = 'message cat-message';
    chatMessages.appendChild(catMessageEl);
    await typewriterEffect(catMessageEl, response, 30);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    data.config.conversationHistory = data.config.conversationHistory || [];
    data.config.conversationHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    data.config.conversationHistory.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
    await dataSaver(data);
    // ADR-0021/0025：对话写入 observation（dedupe=聊天去重限流：近 20 条内重复跳过；
    //  非 calm 情绪或 importance≥0.55 才落库，低价值「用户说：X」不稀释记忆流）；
    //  情绪共振/瞬时情绪由 memorySystem.onObservation 钩子统一处理（不再此处手动 registerEmotion）
    await memorySystem!.addObservation(`用户说：${message}`, { source: 'chat', dedupe: true });
    // ADR-0023：聊天 → 性格微移 + 行为统计（tickBehaviorStats；情绪强度近似取消息长度）
    personalityGrowth!.developBasedOnInteraction('talk', 1, Math.min(0.8, message.length / 200)).catch(() => {});
  } catch (error) {
    const indicator = chatMessages.querySelector('#typing-indicator');
    if (indicator) indicator.remove();
    const errorMessageEl = document.createElement('div');
    errorMessageEl.className = 'message cat-message';
    chatMessages.appendChild(errorMessageEl);
    const errorText = '抱歉，我现在无法回复。请检查API密钥设置或网络连接。';
    await typewriterEffect(errorMessageEl, errorText, 30);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

/** 打字机效果（原 typewriterEffect 逐字） */
function typewriterEffect(element: HTMLElement, text: string, speed = 30): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;
    element.textContent = '';
    const timer = setInterval(() => {
      if (index < text.length) {
        element.textContent += text[index];
        index++;
        if (panels) panels.chatMessages.scrollTop = panels.chatMessages.scrollHeight;
      } else {
        clearInterval(timer);
        resolve();
      }
    }, speed);
  });
}

/** 卸载清理 */
export function unloadSmartCat(): void {
  if (!initialized) return;
  initialized = false;
  if (fileOpenRef && appRef) {
    try {
      (appRef.workspace as any).offref(fileOpenRef);
    } catch (e) { /* 忽略 */ }
    fileOpenRef = null;
  }
  if (vaultRefs.length && appRef) {
    for (const ref of vaultRefs) {
      try { (appRef.vault as any).offref(ref); } catch (e) { /* 忽略 */ }
    }
    vaultRefs = [];
  }
  lastActivity.clear();
  if (visibilityCleanup) {
    visibilityCleanup();
    visibilityCleanup = null;
  }
  if (proactiveTimer) {
    clearInterval(proactiveTimer);
    proactiveTimer = null;
  }
  if (weeklyReportTimer) {
    clearInterval(weeklyReportTimer);
    weeklyReportTimer = null;
  }
  if (trendDriftTimer) {
    clearInterval(trendDriftTimer);
    trendDriftTimer = null;
  }
  if (greetTimer) {
    clearTimeout(greetTimer);
    greetTimer = null;
  }
  animation?.dispose();
  memorySystem?.stopScheduler();
  moodSystem?.dispose();
  interaction?.dispose();
  domainReader?.();
  domainReader = null;
  domainPrev.clear();
  domainObserved.clear();
  mobileAdapter?.destroy();
  if (panels) {
    panels.dispose();
    panels = null;
  }
  closeSmartcatDashboard(); // 数据面板（ticket 071）：DOM + ESC 句柄一并清理
  unmountCatContainer();
  __resetVisibilityForTests();
  bubbleManager = null;
  moodSystem = null;
  personalityGrowth = null;
  memorySystem = null;
  animation = null;
  interaction = null;
  mobileAdapter = null;
  appRef = null;
  data = null;
}

/** 测试辅助：获取内部实例引用 */
export function __getSmartcatInternals(): any {
  return { data, bubbleManager, moodSystem, memorySystem, animation, interaction, panels, initialized };
}

/** 域 JSON 感知状态（domain-source.ts 提供 extract 纯函数；此处管理监听生命周期） */
const domainPrev = new Map<string, string>();
const domainObserved = new Set<string>();
let domainReader: (() => void) | null = null;

/** 域 JSON 观察接入（2026-08-23 用户拍板：CONFIG/STORAGE 域数据 modify → 观察；懒启动探测已有数据文件） */
async function onDomainActivity(): Promise<void> {
  if (!appRef || !memorySystem) return;
  const app = appRef;
  const mem = memorySystem;
  // 首次快照：记录各域当前状态（不产出观察）
  const found = await snapshotDomains(async (path) => JSON.parse(await app.vault.read(app.vault.getAbstractFileByPath(path) as any)), domainPrev);
  found.forEach((k) => domainObserved.add(k));
  if (!domainReader) {
    const ref = (app.vault as any).on?.('modify', async (file: any) => {
      if (!file?.path) return;
      const key = Object.keys(DOMAIN_FILES).find((k) => DOMAIN_FILES[k].file === file.path);
      if (!key || !domainObserved.has(key)) return;
      let raw: any = null;
      try { raw = JSON.parse(await app.vault.read(file)); } catch { return; }
      const text = DOMAIN_FILES[key].extract(raw, domainPrev);
      if (text) await mem.addObservation(text, { source: 'domain:' + key });
    });
    if (ref) domainReader = () => (app as any)?.vault?.offref?.(ref as any);
  }
}