/**
 * smartcat 域入口（小橘陪伴猫）
 * ensureSmartCat 幂等懒加载：挂载猫容器 + 装配全部子系统 + 常驻监听
 * （file-open 书评 / visibilitychange 欢迎回来 / 记忆固化）。
 * vault md 事件与六域动作观察均走域事件总线：vault 原生事件由 core/obsidian-adapter
 * 转译后订阅语义通道消费；movie/memo/news/favorites/belongings/pomodoro 六域 UI 动作
 * 经 emitDomainEvent(域名, 事件) 派发、此处订阅（原 notifyXxxAction 导出入口已收编为订阅端）。
 * unloadSmartCat 全量清理。命令回调：open（召唤显示）/ chat（聊天）/ hide（隐藏）。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { loadSmartCatData, saveSmartCatData, getSmartcatFilePath, smartcatStorageDir, defaultPersonalityGrowth, touchPresence, applyInsightPatch } from './data';
import { eventSystem, setSmartcatApp, setupVisibilityCheck, __resetVisibilityForTests } from './state';
import { mountCatContainer, unmountCatContainer, applyAppearance, createChatPanel, showChatPanel, hideChatPanel, openSmartcatSettings } from './ui';
import { BubbleManager } from './bubble';
import { MoodSystem, PersonalityGrowth } from './mood';
import { MemorySystem, USER_CONTENT_BOUNDARY, PROMPT_SLOTS } from './memory';
import { SmartCatAnimation } from './animation';
import { InteractionManager, MobileInputAdapter } from './interaction';
import { getSmartCatMessage } from './messages';
import { generatePrompt } from './prompts';
import { callChat, isAIConfigured } from './api';
import { generateBookDescription, hasBookTag } from './content';
import { classifyPath } from './context-source';
import { onDomainEvent } from '../core/domain-bus';
import { buildMovieActionText, type MovieActionEvent } from './movie-source';
import { buildMemoActionText, memoDueObservation, type MemoActionEvent, type MemoDueLike } from './memo-source';
import { parseDiaryFile, decideDiarySettle, diaryDeleteText, diaryDeleteFileText, DIARY_SETTLE_MS, type DiaryEntryLike } from './diary-source';
import { noteFirstText, noteDeleteText, noteFileName, noteBodyText, parseNoteDate, letterReadonly, decideNoteSettle, NOTE_SETTLE_MS, type NoteKind } from './note-source';
import { DIARY_DIRECTORY } from '../diary/config';

import { buildBelongingsActionText, type BelongingsActionEvent } from './belongings-source';

import { buildNewsReadText, buildNewsSavedFullText, type NewsReadEvent } from './news-source';
import { buildFavoritesActionText, type FavoritesActionEvent } from './favorites-source';

import { buildPomodoroActionText, type PomodoroActionEvent } from './pomodoro-source';
import { DOMAIN_FILES, snapshotDomains } from './domain-source';
import { buildLibraryNoteText, type LibraryWeaveDiff } from './library-source';
import { buildRhythmProfile, isActiveNow, describeRhythm, periodText, isoWeekKey } from './rhythm';
import { buildWeeklyReportData, generateWeeklyReport, weekWindow } from './report';
import { appendDossierEvent, getDossierEvents, shouldScanDossierNarrative, buildNarrativeInput, generateDossierNarrative, advanceDossierScanKey } from './dossier';
import { buildCompanionContext } from './companion-context';
import { analyzeEmotionTrend, buildEmotionSnapshots, describeEmotionTrend, checkContradiction, extractStoredFacts, initBanditArm, sampleThompson, updateBandit } from './cognitive';
import { openSmartcatDashboard, closeSmartcatDashboard, registerInsightPatchChannel } from './dashboard';
import { AbsenceSystem } from './absence';
import {
  QuietGateSystem, gentleGreeting, gentleGreetingAvailable, gentlePhraseFor, gentleStyleFor,
  localDayKey, proactiveMinGapMs,
} from './quiet-gate';
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
let absenceSystem: AbsenceSystem | null = null; // 缺席状态机（ticket 093，ADR-0040）
let quietGateSystem: QuietGateSystem | null = null; // 心情门控（ticket 095，ADR-0042；无自有定时器）
let animation: SmartCatAnimation | null = null;
let interaction: InteractionManager | null = null;
let mobileAdapter: MobileInputAdapter | null = null;
let panels: SmartcatPanels | null = null;
let fileOpenRef: any = null;
/** 域事件总线订阅退订函数收集（vault md 事件换线 + 六域方法监听换线；unload 逐一退订） */
const busUnsubs: (() => void)[] = [];
/** news 总线通道载荷（news/reader emitDomainEvent('news', ...) 派发；kind 区分两个入口——
 *  read = markAsRead('saved') 的保存立即形态；saved = saveToClip 登记待补全（带剪藏路径）） */
interface NewsChannelEvent {
  kind: 'read' | 'saved';
  evt: NewsReadEvent;
  /** saved 入口专用：剪藏落盘路径（待补全登记键） */
  clipPath?: string;
}
/** 聚合讯保存待补全登记（ticket 076，方案 a）：剪藏路径 → 登记（内存态不落盘）；
 *  auto-summary 写回 frontmatter 的剪藏 modify 命中 → 补全完整保存观察并移除；2 分钟降级定时器兜底。
 *  ticket 084b：登记追加 baseName/url（rename 反查锚点）——剪藏 frontmatter 无 title →
 *  auto-summary renameToTitle 必改文件路径，登记键（原路径）将永久失效；
 *  补全/降级按 url（URL 唯一）或 baseName 反查改名后新路径，AI 摘要/标签才能进记忆流。 */
interface NewsPendingSave {
  title: string;
  platform: string;
  durationMin: number;
  /** 剪藏原文件名去 .md（saveToClip 写入路径的 cleanTitle；rename 后 basename 反查兜底） */
  baseName: string;
  /** 剪藏 frontmatter url（URL 唯一标识原文：renameToTitle 只改文件名不碰 frontmatter，改名后反查主锚点；
   *  登记时异步读取，读失败为空串 → 走 baseName 兜底） */
  url: string;
  timer: ReturnType<typeof setTimeout>;
}
const newsPendingSaves = new Map<string, NewsPendingSave>();
/** 保存降级等待时长（ms；默认 2 分钟，测试可注入缩短） */
let newsSaveTimeoutMs = 2 * 60 * 1000;
/** 日记观察计时表（ticket 077，ADR-0030）：key = `${filePath}\u0001${date}\u0001${time}` → 该条结算状态。
 *  「每条日记独立 10 分钟结算」：该条任何修改重置其计时；静置到期 → 结算产出观察（首落有字/累计 >50 更新）。
 *  内存态不落盘（smartcat.json 零改动）；unload 全清。 */
interface DiaryTimerState {
  timer: ReturnType<typeof setTimeout> | null;
  /** 该条是否已结算产出过首次观察（重启基线有字条目视为已见——防重启后旧条目被当首次） */
  generated: boolean;
  /** 上次生成时的正文基线（累计字数差的基准） */
  baseline: string;
  /** 上次生成时的分类（更新观察括号内分类变化判断用） */
  baselineTags: string[];
  /** 自上次生成以来累计字数差（每次结算累加；生成更新观察后归零） */
  accum: number;
  /** 上次生成时间（毫秒时间戳；未生成过为 0） */
  lastGeneratedAt: number;
}
const diaryTimers = new Map<string, DiaryTimerState>();
/** 日记文件最近一次快照（diff 变更/删除用）：filePath → Map(entryKey → {body, tags})；内存态 */
const diaryTracked = new Map<string, Map<string, { body: string; tags: string[] }>>();
/** 结算静置时长（默认 DIARY_SETTLE_MS；测试可注入缩短） */
let diarySettleMs = DIARY_SETTLE_MS;
/** 卡片盒/现代诗/信 观察计时表（ticket 083，ADR-0035；v2 差异观察 + v3 真实日期 + v4 readonly 准入）：
 *  key = filePath → 该篇结算状态。「每篇文件独立 10 分钟结算」（对齐日记模型，per-file 简化版）：
 *  该篇任何修改重置计时；静置到期 → 结算产出观察（首落有字 / 正文有变化 → 段落 diff 摘要）。
 *  内存态不落盘（smartcat.json 零改动）；unload 全清。 */
interface NoteTimerState {
  timer: ReturnType<typeof setTimeout> | null;
  kind: NoteKind;
  /** 是否已进入「已生成」分支（重启基线有字文件视为已见——防重启后旧文件被当首次；v2 无累计阈值） */
  generated: boolean;
  /** 上次结算时的正文基线（diff 基准；每次结算后推进到当前正文全文） */
  baseline: string;
  /** 首落是否已处理（产出或确定不产）。基线预置=false → 存量信/诗首次修改先补带日期首落再产 diff（v3）；
   *  首落产出或无日期跳过（诗）后置 true。 */
  observed: boolean;
}
const noteTimers = new Map<string, NoteTimerState>();
/** 三域文件最近一次快照（modify diff / delete 感知、日期缓存）：filePath → {kind, body 全文, date}；内存态 */
const noteTracked = new Map<string, { kind: NoteKind; body: string; date: string | null }>();
/** 结算静置时长（默认 NOTE_SETTLE_MS；测试可注入缩短） */
let noteSettleMs = NOTE_SETTLE_MS;
/** 条目 key 分隔符（filePath / date / time 三段，控制字符防与路径字符冲突） */
const DIARY_KEY_SEP = '\u0001';

/** 书库划线/想法 5 分钟防抖合并（ticket 081 v2，对齐 diary timers / newsPendingSaves 先例）：
 *  per-book 独立窗口（bookId → pending），窗口内再变化追加内容并重置；超时结算一条入流。 */
interface LibraryPendingNote { title: string; highlights: string[]; excerpts: string[]; timer: ReturnType<typeof setTimeout>; }
const libraryPendingNotes = new Map<string, LibraryPendingNote>();
/** 书库防抖窗口时长（ms；默认 5 分钟，测试可注入缩短） */
let libraryDebounceMs = 5 * 60 * 1000;
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
  // ticket 088：在场口径缺省初始化——ensure 时 editingData 无 lastPresenceAt → 当前时间
  // （新用户不触发「缺席」；旧数据容忍零迁移——仅内存补齐，随首次既有 dataSaver 落盘）
  if (typeof data.editingData?.lastPresenceAt !== 'number') {
    touchPresence(data);
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
  // ticket 095 设计 4：接线原死代码 loadMoodState（新鲜合并 / 24h 陈旧归中性 / 无数据缺省中性，防重启假情绪）
  moodSystem.loadMoodState();
  // ticket 095 设计 3/5：心情门控窗口采样器——挂既有 60s PAD 衰减循环（钩子）+ 30 分钟趋势心跳
  //（心跳喂入在 maybeTrendDrift），不新建循环；quietMode 状态机持久化于 editingData.quietMode
  quietGateSystem = new QuietGateSystem(dataProvider, dataSaver);
  moodSystem.onDecayTick = () => { void quietGateSystem?.onDecayTick(); };
  personalityGrowth = new PersonalityGrowth(dataProvider, dataSaver);
  memorySystem = new MemorySystem(app, dataProvider, dataSaver);
  // ADR-0021：init = 探测 Ollama + 加载向量 + 反思调度（取代原 24h 固化调度）
  await memorySystem.init();
  if (!initialized) return; // 竞态守卫 2：init 期间被 unload 则丢弃装配
  // ticket 075：每日到期扫描并入反射调度（30s tick 检查，当天已扫过跳过不空转）
  // ticket 093：缺席状态机挂同一调度心跳（复用既有 30s tick，不自建定时器）——
  // 检查 lastPresenceAt 距今 → normal→missing 迁移；重逢由在场信号钩子触发
  absenceSystem = new AbsenceSystem(dataProvider, dataSaver, moodSystem);
  memorySystem.onSchedulerTick = () => { void maybeMemoDueScan(); void absenceSystem?.onSchedulerTick(); };
  // ticket 093：重逢判定 = 在场信号（观察路径统一经 addObservation→touchPresence 后到此）+ phase ≠ normal
  memorySystem.onPresence = () => { void absenceSystem?.onPresenceSignal(); };
  // 反思驱动人格（ADR-0023：洞察 → 特质归因成长 + 行为周统计深更新；ticket 091 origin 透传给归因来源约束）
  memorySystem.onReflect = async (insights, meta) => {
    if (personalityGrowth) {
      if (insights && insights.length) await personalityGrowth.applyReflectionInsights(insights, { origin: meta?.origin });
      // MATE character_from_experience：反思时把累积行为统计折算进 traits（周深更新）
      await personalityGrowth.applyWeeklyExperience();
    }
  };

  // ADR-0025 情绪闭环 A 面：每条观察（日记/闪念/聊天/域事件…）→ 瞬时情绪 + 温和共振进 PAD
  memorySystem.onObservation = (m) => {
    // 094 方向八：dossier 事件级即写（正性白名单来源 / eventId 幂等 / 环形 ≤200）；
    // 失败静默不影响情绪主流程；写入后随既有 dataSaver 链路补一次落盘（不新增独立调度）
    try {
      if (appendDossierEvent(dataProvider(), m)) void dataSaver(dataProvider());
    } catch { /* 事件表失败不影响主流程 */ }
    if (!moodSystem || !m?.emotion) return;
    try {
      moodSystem.registerEmotion(m.emotion);
      // ADR-0036：共振差量 × 可信度——低可信度观察的情绪不猛推 PAD（旧条目无 credibility → 0.5 中性）
      moodSystem.applyEmotionResonance(m.emotion, m.credibility ?? 0.5);
    } catch (e) { /* 共振失败不影响记忆主流程 */ }
  };

  // P1-29：数据面板「固定/废弃」经常驻实例通道修改内存对象并统一 dataSaver 落盘
  // （废弃独立 load-modify-save 副本——副本保存会回滚常驻侧后续任何未同步改动）
  registerInsightPatchChannel({
    apply: async (id, patch) => {
      const d = dataProvider();
      if (!applyInsightPatch(d, id, patch)) return false;
      await dataSaver(d);
      return true;
    },
  });

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
    bubble: bubbleManager,
    mood: moodSystem,
    openChat: () => openChat(),
    openSettings: () => openSettings(),
    // ADR-0021：记忆流检索注入聊天上下文（格式化后返回；失败返回空串）
    // ADR-0025：第二参 lexicalQuery 供词法降级模式（纯用户消息，免「情绪/时段」噪音）
    // 096 方向一：retrieve topN=10 冻结不动，≤6 收缩只落 formatMemoriesForPrompt 的 maxEntries（槽位保留制，ADR-0043）
    retrieveMemories: async (query: string, lexicalQuery?: string) => {
      if (!memorySystem) return '';
      try {
        const memories = await memorySystem.retrieve(query, undefined, { lexicalQuery });
        return memories.length ? memorySystem.formatMemoriesForPrompt(memories, PROMPT_SLOTS.maxEntries) : '';
      } catch (e) {
        return '';
      }
    },
    // ADR-0023：prompt 状态向量数据（性格系统 traits/OCEAN）
    characterData: () => data,
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

  // ---- 域事件总线订阅（vault md 事件换线）：vault create/modify/delete/rename 已由 core/obsidian-adapter
  //      统一转译为两路域事件（通用兜底 'vault:md-*' + 语义 '<域>:file-*'），此处只订阅语义通道消费；
  //      载荷 {path} 即原 TFile 的最小面——下游处理只用 file.path。movie/favorites/belongings/pomodoro/
  //      reading 的原事件通道短路分支随裸订阅一并移除：favorites/belongings/pomodoro 是 JSON 数据域本不产
  //      md 语义事件，reading（书库 md）不在 path-classify 域表内，movie 不订阅即维持「UI 动作单记录」短路。
  // 日记 create|modified → PAD 正向轻推照旧（红队 C 接线，diary→note_create）+ 新链路结算（ticket 077）
  const onDiaryFileUpsert = async (payload: { path: string }): Promise<void> => {
    if (!data || !personalityGrowth || !memorySystem || !appRef || !data.config.noteSource) return;
    if (moodSystem) moodSystem.handleInteraction('note_create' as any, 0.5);
    await handleDiaryVaultActivity(payload);
  };
  // 卡片盒/现代诗/信 create|modified → PAD 正向轻推照旧（note_create）+ 新链路结算（ticket 083）
  const onNoteFileUpsert = async (payload: { path: string }): Promise<void> => {
    if (!data || !personalityGrowth || !memorySystem || !appRef || !data.config.noteSource) return;
    if (moodSystem) moodSystem.handleInteraction('note_create' as any, 0.5);
    await handleNoteVaultActivity(payload);
  };
  // 聚合讯保存联动补全（ticket 076）：clipping modify 的唯一保留用途——命中待补全登记才产出完整保存观察
  const onClippingModified = async (payload: { path: string }): Promise<void> => {
    if (!data || !personalityGrowth || !memorySystem || !appRef || !data.config.noteSource) return;
    await completePendingNewsSave(payload);
  };
  busUnsubs.push(onDomainEvent('diary:file-created', (e: any) => void onDiaryFileUpsert(e)));
  busUnsubs.push(onDomainEvent('diary:file-modified', (e: any) => void onDiaryFileUpsert(e)));
  for (const ch of ['flash', 'poem', 'letter'] as const) {
    busUnsubs.push(onDomainEvent(`${ch}:file-created`, (e: any) => void onNoteFileUpsert(e)));
    busUnsubs.push(onDomainEvent(`${ch}:file-modified`, (e: any) => void onNoteFileUpsert(e)));
  }
  busUnsubs.push(onDomainEvent('clipping:file-modified', (e: any) => void onClippingModified(e)));
  // 文件删除感知（ticket 077/083）：四域 deleted → 原 onVaultDelete 分派（内部 classifyPath 分 diary/note）
  for (const ch of ['diary', 'flash', 'poem', 'letter'] as const) {
    busUnsubs.push(onDomainEvent(`${ch}:file-deleted`, (e: any) => void onVaultDelete(e)));
  }
  // 文件重命名/移动感知（ticket 084d B2）：三分支语义保持——订阅通用兜底 renamed 通道而非各域语义通道：
  // 语义 renamed 按新路径分类派发，「移出观察目录」时新路径不命中任何域、语义路不派发；
  // 通用通道恒发 {oldPath, newPath}，onVaultRename 内部按新旧路径分类自行三分支判定（迁移 / 删除+清理）
  busUnsubs.push(onDomainEvent('vault:md-renamed', (e: any) => void onVaultRename({ path: e?.newPath }, e?.oldPath)));

  // 日记重启基线（ticket 077）：监听挂载前先对日记目录当日文件建快照（不产出观察，
  // 防重启后旧条目被当首次——已有正文条目记「已见」，后续改动走更新分支）
  await buildDiaryBaseline();
  // 卡片盒/现代诗/信 重启基线（ticket 083）：监听挂载前先对三目录全部 md 建快照（不产出观察，
  // 防重启后旧文件被当首次——有字记「已见」，后续改动走更新分支；不装计时器，事件才起动）
  await buildNoteBaseline();
  if (!initialized) return; // 竞态守卫 3：基线扫描期间被 unload 则停止装配

  // ---- 方法监听换线（六域动作事件总线订阅）：生产域 UI 改经 emitDomainEvent(域名, 事件) 派发，
  //      此处订阅即原 notifyXxxAction 导出入口（守卫/防重/文案构造原样保留在各自函数体内）；
  //      news 两入口共用 'news' 通道，按载荷 kind 分派（read=保存立即形态 / saved=登记补全）
  busUnsubs.push(onDomainEvent<MovieActionEvent>('movie', (evt) => notifyMovieAction(evt)));
  busUnsubs.push(onDomainEvent<MemoActionEvent>('memo', (evt) => notifyMemoAction(evt)));
  busUnsubs.push(onDomainEvent<NewsChannelEvent>('news', onNewsChannelEvent));
  busUnsubs.push(onDomainEvent<FavoritesActionEvent>('favorites', (evt) => notifyFavoritesAction(evt)));
  busUnsubs.push(onDomainEvent<BelongingsActionEvent>('belongings', (evt) => notifyBelongingsAction(evt)));
  busUnsubs.push(onDomainEvent<PomodoroActionEvent>('pomodoro', (evt) => notifyPomodoroAction(evt)));

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
  // 关系史叙事扫描（ticket 094：独立周键退避，成功才推进 dossierScanKey）
  startDossierScan();
  void maybeDossierNarrative();
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

/** 温和主动搭话（LLM 生成一句关心；AI 未配置/失败 → 模板兜底；Bandit 选臂决定话术风格）。
 *  导出供测试驱动（对齐 maybeMemoDueScan 先例；生产仅 startProactiveCare 定时调用）。 */
export async function maybeProactiveCare(): Promise<void> {
  if (!data || !bubbleManager || !moodSystem || !memorySystem || !personalityGrowth) return;
  const cfg = data.config;
  if (!cfg.proactiveCare) return;
  if (!memorySystem || data.memory.stream.length < 3) return; // 记忆太少还不知道你
  const st = getProactiveState();
  const since = Date.now() - st.lastAt;
  // ticket 095 设计 1：平静期主动间隔 2 天 → 3~4 天（默认 3.5，晨起可调）；非平静维持既有 2 天
  const quiet = quietGateSystem?.isQuiet() ?? false;
  if (since < proactiveMinGapMs(quiet)) return;
  // 作息模型：当前是否用户活跃时段（无数据 → 保守不打扰）——温和问候豁免与 Bandit 主动共享本闸门
  const profile = buildRhythmProfile(data.memory.stream, 30, Date.now());
  if (!profile.total || !isActiveNow(profile)) return;
  // ticket 095 设计 2+7：每日 1 次温和问候豁免——安静陪伴期优先占用本次调度槽位：
  // 与 Bandit 主动共享间隔/作息闸门，发出即刷新 lastAt 顺延下一次 Bandit 主动（打扰总量守恒，
  // 外发触点总量不超过既有间隔允许的每周 ≤2）；不计 proactive 计数、不标 pendingArm 不领 reward。
  // 纯本地语料零 LLM；不 touchPresence（单向外发非用户在场信号，不喂缺席状态机重逢判定）。
  if (quiet && gentleGreetingAvailable(data.editingData, Date.now())) {
    bubbleManager.showBubble(gentleGreeting());
    const d = dataProvider();
    d.editingData = {
      ...(d.editingData || {}),
      gentleGreeting: { day: localDayKey(Date.now()), at: Date.now() },
      // 只顺延 lastAt（占用调度槽位）；count 不动（豁免不占周上限）、pendingArm 不标（reward 口径不改）
      proactiveCare: { week: isoWeekKey(), count: st.count, lastAt: Date.now() },
    };
    await dataSaver(d);
    return;
  }
  if (st.count >= Math.max(1, cfg.proactiveWeeklyCap || 2)) return;
  // Bandit 选臂（ticket 035）：从 3 类话术中按 mood+hour 上下文 Thompson 采样
  const chosen = sampleThompson(getBanditArms(), banditContext());
  const armId = chosen?.actionId ?? BANDIT_ARMS[0];
  try {
    if (!(await isAIConfigured())) {
      // 模板兜底（按臂分类）；ticket 095 设计 1：平静期选中任意臂都落在「温和话术子集」
      //（正常计数+reward 路径同样换输出维度——只换表达，不换 Bandit 口径）
      if (quiet) {
        bubbleManager.showBubble(gentlePhraseFor(armId));
      } else {
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
      }
    } else {
      // 近 3 条记忆做引子 + 懂你上下文块（作息/趋势/关系/检索记忆）→ LLM 温和关心（按臂给风格指令）
      const recent = data.memory.stream.slice(-3).map((m) => m.description).join('；');
      // ticket 095 设计 1：平静期臂 → 温和风格指令子集（只换表达维度，不改选臂与 reward 口径）
      const styleHint = quiet
        ? gentleStyleFor(armId)
        : armId === 'empathy' ? '侧重共情，接住用户的情绪' : armId === 'vault' ? '侧重内容，聊他最近的笔记' : '侧重生活，像老朋友寒暄';
      // ADR-0025 B 面：与聊天同源的「懂你上下文」（096 方向一：空 query 退化为 recency+importance，
      // 槽位保留制收缩 ≤6 入 prompt——ADR-0043）
      let memoriesText = '';
      try {
        const mems = await memorySystem.retrieve('', undefined);
        memoriesText = mems.length ? memorySystem.formatMemoriesForPrompt(mems, PROMPT_SLOTS.maxEntries) : '';
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
        { role: 'system', content: prompt + '\n\n' + USER_CONTENT_BOUNDARY },
        { role: 'user', content: `你主动关心用户一次（温和、简短、像老朋友）。本次侧重：${styleHint}。最近记忆有：${recent}。\n\n你了解到的背景：\n${companionContext}` },
      ]);
      if (response) bubbleManager.showBubble(response);
      else bubbleManager.showBubble('喵~ 我注意到你最近常在深夜写东西，记得照顾好自己。');
    }
    // 记录本次主动（写回 editingData，不新增顶层字段）+ 标记 Bandit pending arm
    const d = dataProvider();
    // ticket 088：主动关心触发 = 用户在场（刷新 editingData.lastPresenceAt，随下方既有 dataSaver 落盘）
    touchPresence(d);
    // ticket 093：在场信号 → 缺席状态机（重逢评估；钩子内部有迁移才落盘）
    void absenceSystem?.onPresenceSignal();
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
    // ticket 095 设计 3/5：30 分钟心跳把趋势漂移喂给心情门控（EMA valence 为门控输入，
    // 非瞬时 PAD；窗口多数采样判定，迁移才落盘 editingData.quietMode）
    void quietGateSystem?.onHeartbeat(trend.currentVad.valence);
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

// ---------------- 关系史叙事扫描（ticket 094 方向八：独立周键退避，不共享 reflectBackoffUntil） ----------------

/** 叙事扫描调度（每小时检查；本周未生成且本周有正性事件才尝试，AI 未配置静默跳过） */
let dossierTimer: ReturnType<typeof setInterval> | null = null;
/** 叙事失败内存退避（30 分钟；不落盘——重启即重置，周键才是持久化去重位） */
let dossierRetryAt = 0;
/** 叙事生成进行中锁（防 ensure 即扫与小时 tick 并发双发） */
let dossierScanning = false;

function startDossierScan(): void {
  if (dossierTimer) clearInterval(dossierTimer);
  dossierTimer = setInterval(() => { void maybeDossierNarrative(); }, 60 * 60 * 1000);
}

/** 生成本周关系史叙事（成功 → 洞察写回流 source=dossier + 推进 editingData.dossierScanKey；
 *  LLM 未配置/失败/空回包静默不推进周键（下轮小时检查再试，对齐周报先例）；
 *  写回流/落盘异常走 30 分钟内存退避——独立于 MemorySystem.reflectBackoffUntil / weeklyReport 状态） */
async function maybeDossierNarrative(): Promise<void> {
  if (!data || !memorySystem || dossierScanning) return;
  dossierScanning = true;
  try {
    const weekKey = isoWeekKey();
    const scanRaw = data.editingData?.dossierScanKey;
    const scanKey = typeof scanRaw === 'string' ? scanRaw : '';
    const events = getDossierEvents(data);
    if (!shouldScanDossierNarrative(scanKey, weekKey, events, Date.now())) return;
    if (Date.now() < dossierRetryAt) return; // 失败退避窗口内不重试
    const text = await generateDossierNarrative(buildNarrativeInput(events, Date.now()));
    if (!text) return; // AI 未配置 / 失败静默（不推进周键）
    await memorySystem.addInsight(`【一起的日子】${text}`, [], 0.6, undefined, 'dossier');
    advanceDossierScanKey(dataProvider(), weekKey);
    await dataSaver(dataProvider());
  } catch (e) {
    // 写路径失败静默 + 独立内存退避
    dossierRetryAt = Date.now() + 30 * 60 * 1000;
  } finally {
    dossierScanning = false;
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
      { role: 'system', content: prompt + '\n\n' + USER_CONTENT_BOUNDARY },
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
  // P1-28 召回不能修复：hide 后 initialized 仍 true → ensureSmartCat 幂等早退，猫容器永不重挂。
  // 已初始化时幂等 remount（mountCatContainer 存在即复用）+ 重刷皮肤 + 推进气泡队列
  // （容器缺失期入队的消息此刻消费；打字锁已在 showBubbleInternal 早退分支复位）。
  if (initialized) {
    const container = mountCatContainer();
    if (container && data) applyAppearance(container, data.config.appearance);
    bubbleManager?.processBubbleQueue();
    return;
  }
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
}

/** 打开聊天面板（挂猫容器 + 建面板 + 显示） */
function openChat(): void {
  if (!initialized || !appRef) return;
  if (!document.getElementById('chat-panel')) {
    panels = createChatPanel({
      onSend: (message) => void sendChatMessage(message),
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

/** 打开设置弹窗（长按 / 双击手势统一后的唯一设置入口） */
function openSettings(): void {
  if (!initialized) return;
  openSmartcatSettings({
    getConfig,
    saveConfig,
    // 弹窗关闭（遮罩/✕/ESC）复位交互锁——否则移动端长按开设置再关掉后，
    // isSettingsOpen 卡在 true，触摸拖拽全部早退，小橘再也拖不动
    onClose: () => {
      if (interaction) interaction.isSettingsOpen = false;
    },
    settingsKeys: {
      enabled: true,
      mobileFullscreen: (getSettings() as any).smartcatMobileDefaultFullscreen === true,
    },
    // 平铺色块换肤即时生效
    onAppearanceChanged: (appearance) => {
      const c = mountCatContainer();
      if (c) applyAppearance(c, appearance);
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
    // 「打开数据面板」（2026-08-23：原「每周懂你报告」行替换；周报全文在面板「报告」页签）
    onOpenDashboard: () => {
      if (appRef) void openSmartcatDashboard(appRef);
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

  // ticket 088：用户发消息本身即「在场」（刷新 editingData.lastPresenceAt 内存字段；
  // 成功路径随既有 dataSaver 落盘，AI 失败也已在场——不新增独立写盘）
  touchPresence(data);
  // ticket 093：在场信号 → 缺席状态机（重逢判定 = 在场 + phase ≠ normal）
  void absenceSystem?.onPresenceSignal();
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
    // ticket 072：强度上限 0.8→0.5（长度≠情绪浓度，粘贴长文不应拿满格人格微移）
    personalityGrowth!.developBasedOnInteraction('talk', 1, Math.min(0.5, message.length / 200)).catch(() => {});
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
  // 域事件总线订阅全量退订（vault md 事件换线 + 六域方法监听换线）
  for (const off of busUnsubs) {
    try { off(); } catch (e) { /* 忽略 */ }
  }
  busUnsubs.length = 0;
  // ticket 084a B6/B8：通知防重时间表 + 到期扫描失败计数（重开即重置）
  notifyLastAt.clear();
  memoDueScanFail = { date: '', count: 0 };
  // 聚合讯保存待补全登记（ticket 076）：定时器全清 + 表清空 + 降级等待复位
  for (const reg of newsPendingSaves.values()) clearTimeout(reg.timer);
  newsPendingSaves.clear();
  newsSaveTimeoutMs = 2 * 60 * 1000;
  // 日记观察计时表（ticket 077）：定时器全清 + 快照/计时表清空 + 结算时长复位
  for (const st of diaryTimers.values()) {
    if (st.timer) clearTimeout(st.timer);
  }
  diaryTimers.clear();
  diaryTracked.clear();
  diarySettleMs = DIARY_SETTLE_MS;

  // 书库划线/想法防抖 pending（ticket 081 v2）：定时器全清 + 表清空 + 窗口复位
  for (const p of libraryPendingNotes.values()) clearTimeout(p.timer);
  libraryPendingNotes.clear();
  libraryDebounceMs = 5 * 60 * 1000;

  // 卡片盒/现代诗/信 观察计时表（ticket 083）：定时器全清 + 快照/计时表清空 + 结算时长复位
  for (const st of noteTimers.values()) {
    if (st.timer) clearTimeout(st.timer);
  }
  noteTimers.clear();
  noteTracked.clear();
  noteSettleMs = NOTE_SETTLE_MS;
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
  // 关系史叙事扫描调度（ticket 094）
  if (dossierTimer) {
    clearInterval(dossierTimer);
    dossierTimer = null;
  }
  dossierRetryAt = 0;
  if (trendDriftTimer) {
    clearInterval(trendDriftTimer);
    trendDriftTimer = null;
  }
  if (greetTimer) {
    clearTimeout(greetTimer);
    greetTimer = null;
  }
  animation?.dispose();
  memorySystem?.stopScheduler(); // 反思调度（含 ticket 075 memo 到期扫描 tick）一并停止
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
  registerInsightPatchChannel(null); // P1-29：常驻通道随实例卸载一并清除
  unmountCatContainer();
  __resetVisibilityForTests();
  bubbleManager = null;
  moodSystem = null;
  absenceSystem = null; // 缺席状态机（ticket 093）：无自有定时器，随装配整体置空
  quietGateSystem = null; // 心情门控（ticket 095）：无自有定时器，随装配整体置空
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
  return { data, bubbleManager, moodSystem, memorySystem, absenceSystem, quietGateSystem, animation, interaction, panels, initialized };
}

// ------------- 影视动作观察（ticket 074 修订：方法监听，ADR-0026） -------------

// ------------- 通知防重（ticket 084a B6） -------------

/** 通知侧轻量防重：同事件同 key 近 300ms 只发一次（双击确认、勾选完成与抽屉「标记完成」双入口等
 *  重复触发）；模块级 Map（内存态不落盘，unload 全清）。payload 敏感——同一影视先后两次
 *  不同评分/影评的事件互不误伤；仅完全相同的重复事件被拦截。 */
const notifyLastAt = new Map<string, number>();
const NOTIFY_DEDUPE_MS = 300;

/** true = 近窗口内已发过同 key（本次丢弃）；false = 放行并记录本次时间 */
function notifyDeduped(kind: string, discriminator: string): boolean {
  const key = `${kind}\u0001${discriminator}`;
  const now = Date.now();
  const last = notifyLastAt.get(key) ?? 0;
  if (now - last < NOTIFY_DEDUPE_MS) return true;
  notifyLastAt.set(key, now);
  return false;
}

/** 影视事件判别键（同事件同 key 判定） */
function movieActionKey(evt: MovieActionEvent): string {
  switch (evt.kind) {
    case 'created': return `${evt.name}|${evt.status}`;
    case 'status': return `${evt.name}|${evt.from}|${evt.to}`;
    case 'rated': return `${evt.name}|${evt.fromRating}|${evt.toRating}`;
    case 'review': return `${evt.name}|${evt.fromReview || ''}|${evt.toReview || ''}`;
    case 'deleted': return evt.name;
  }
}

/** 备忘录事件判别键（同事件同 key 判定） */
function memoActionKey(evt: MemoActionEvent): string {
  switch (evt.kind) {
    case 'added': return evt.title;
    case 'edited': return `${evt.old.title}|${evt.next.title}`;
    case 'completed': case 'restored': case 'deleted': return evt.title;
    case 'postponed': return `${evt.title}|${evt.due}`;
    case 'priority': return `${evt.title}|${evt.to}`;
  }
}

/** 影视动作观察处理（movie 域 UI 经 emitDomainEvent('movie', evt) 派发 → 总线订阅进入）。
 *  未初始化 / 未启用（noteSource 关）→ 静默；文案构造见 movie-source.buildMovieActionText。 */
function notifyMovieAction(evt: MovieActionEvent): void {
  if (!initialized || !memorySystem || !data?.config?.noteSource) return;
  const text = buildMovieActionText(evt);
  if (!text) return;
  // B6（ticket 084a）：同事件同 key 近 300ms 防重（双击确认等重复触发）
  if (notifyDeduped(evt.kind, movieActionKey(evt))) return;
  void memorySystem.addObservation(text, { source: 'movie' });
}

// ------------- 备忘录动作观察（ticket 075：方法监听 + 每日到期扫描） -------------

/** 备忘录动作观察处理（memo 域 UI 经 emitDomainEvent('memo', evt) 派发 → 总线订阅进入）。
 *  未初始化 / 未启用（noteSource 关）→ 静默；文案构造见 memo-source.buildMemoActionText。 */
function notifyMemoAction(evt: MemoActionEvent): void {
  if (!initialized || !memorySystem || !data?.config?.noteSource) return;
  const text = buildMemoActionText(evt);
  if (!text) return;
  // B6（ticket 084a）：同事件同 key 近 300ms 防重（勾选完成与抽屉「标记完成」双入口/双击等）
  if (notifyDeduped(evt.kind, memoActionKey(evt))) return;
  void memorySystem.addObservation(text, { source: 'memo' });
}

/** memo.json 路径（跟随共享 storagePath，同 smartcatStorageDir 目录规则） */
function getMemoDataPath(): string {
  return `${smartcatStorageDir()}/memo.json`;
}

/** 今日日期（YYYY-MM-DD，本地时区；对齐 memo due.ts getTodayStr 语义；now 可注入供测试跨天） */
function memoTodayStr(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** 到期扫描状态（editingData.dueScan = { date: 'YYYY-MM-DD' }；同 proactiveCare 先例，旧数据缺省容忍） */
function getDueScanState(): { date: string } {
  const d = dataProvider();
  const s = (d.editingData?.dueScan || {}) as Partial<{ date: string }>;
  return { date: typeof s.date === 'string' ? s.date : '' };
}

/** 到期扫描连续失败计数（ticket 084a B8）：同一天连续失败达上限 → 当日放弃（不推进日期，
 *  下次 tick 直接跳过）；重开（unload 清空）或跨天（日期变化）自动重置。 */
let memoDueScanFail = { date: '', count: 0 };
const memoDueScanMaxFails = 3;

/** 每日到期扫描（并入 30s 反射调度 tick；用户拍板：每天只扫一次，合并成一条观察）：
 *  当天已扫过跳过（不空转）；读 memo.json（vault.read，不动 memo 域）→ memoDueObservation
 *  （今天到期且未完成，≤5 截断合并一条）→ addObservation(source 'memo')；
 *  扫描日期持久化 editingData.dueScan（跨重启去重；旧数据无该字段容忍）。
 *  B8：先推进扫描日期再观察——addObservation 内部 dataSaver 失败时观察已入内存流，
 *  若下 tick 重扫会把同文案二次入流；日期先落盘 → 观察侧任何后续失败也跳过当天重扫（杜绝重复）；
 *  读取/解析/落盘失败 → 记连续失败计数，达到上限当日放弃（不再每 30s 无限重试）。
 *  now 可注入（集成测试模拟跨天用；生产由调度以实际时间调用）。 */
export async function maybeMemoDueScan(now: Date = new Date()): Promise<void> {
  if (!initialized || !appRef || !memorySystem || !data?.config?.noteSource) return;
  const today = memoTodayStr(now);
  if (getDueScanState().date === today) return; // 当天已扫过
  // B8：跨天重置失败计数；连续失败达到上限 → 当日放弃（不推进日期，等次日/重开再扫）
  if (memoDueScanFail.date !== today) memoDueScanFail = { date: today, count: 0 };
  if (memoDueScanFail.count >= memoDueScanMaxFails) return;
  try {
    const file = appRef.vault.getAbstractFileByPath(getMemoDataPath());
    if (!file) return; // memo 域未启用（无 memo.json）：静默，不推进扫描日期（等 memo 数据出现再扫）
    const raw = JSON.parse(await appRef.vault.read(file as any));
    const items: MemoDueLike[] = Array.isArray(raw) ? (raw as any[]) : [];
    const text = memoDueObservation(items, now);
    // B8 防重复：先推进扫描日期（落盘）再观察——如上注释，任何后续失败也跳过当天重扫
    const d = dataProvider();
    d.editingData = { ...(d.editingData || {}), dueScan: { date: today } };
    await dataSaver(d);
    if (text) await memorySystem.addObservation(text, { source: 'memo' });
    memoDueScanFail = { date: today, count: 0 };
  } catch (e) {
    /* 读取/解析/日期落盘失败：不推进日期，记连续失败计数——达到上限当日放弃（下次 tick 不再重试） */
    memoDueScanFail = { date: today, count: memoDueScanFail.count + 1 };
  }
}

// ------------- 聚合讯观察（ticket 076：2026-08-25 修订——仅保存 + 累计可视时长，ADR-0029） -------------

/** 聚合讯观察处理（read 入口）：news 域 reader 经 emitDomainEvent('news', {kind:'read', evt}) 派发。
 *  2026-08-25 用户拍板：跳过/阅读不再产生观察，仅保存发（立即形态，auto-summary 补全走
 *  saved 入口登记）；文案构造见 news-source.buildNewsReadText；未初始化/未启用（noteSource 关）→ 静默。 */
function notifyNewsRead(evt: NewsReadEvent): void {
  if (!initialized || !memorySystem || !data?.config?.noteSource) return;
  const text = buildNewsReadText(evt.state, evt.title, evt.platform, evt.durationMin);
  if (text) void memorySystem.addObservation(text, { source: 'news' });
}

/** 保存登记待补全（方案 a，saved 入口）：news 域 reader saveToClip 经
 *  emitDomainEvent('news', {kind:'saved', evt, clipPath}) 派发 → 总线订阅进入。
 *  登记 {标题, 平台, 时长分, 剪藏 baseName, url} 进内存表并启动 2 分钟降级定时器：
 *  命中 auto-summary 写回的剪藏 modify → 补全完整保存观察并移除登记（clearTimeout）；
 *  定时器兜底（到时无提交）→ 降级产出保存观察并移除登记。未初始化 / noteSource 关 → 静默。
 *  ticket 084b：剪藏 frontmatter 无 title → auto-summary renameToTitle 必改名，登记键（原路径）
 *  会失效；补全/降级靠登记 baseName/url 反查新路径（见 complete/degradePendingNewsSave）。 */
function notifyNewsSaved(evt: NewsReadEvent, clipPath: string): void {
  if (!initialized || !memorySystem || !data?.config?.noteSource) return;
  const prev = newsPendingSaves.get(clipPath);
  if (prev) clearTimeout(prev.timer); // 同路径重复保存（覆盖）→ 重置等待
  const timer = setTimeout(() => {
    void degradePendingNewsSave(clipPath);
  }, newsSaveTimeoutMs);
  const baseName = clipPath.split('/').pop()?.replace(/\.md$/i, '') || evt.title;
  newsPendingSaves.set(clipPath, { title: evt.title, platform: evt.platform, durationMin: evt.durationMin, baseName, url: '', timer });
  // ticket 084b：异步登记 frontmatter url（rename 后反查主锚点；saveToClip 已创建文件读必成功，
  // 读失败留空走 baseName 兜底；unload 清表后该 then 自然空转）
  void readClipFrontmatterOrEmpty(clipPath).then((fm) => {
    const reg = newsPendingSaves.get(clipPath);
    if (reg && fm.url) reg.url = fm.url;
  });
}

/** news 总线通道分派：'news' 通道两入口共用，按载荷 kind 分派
 *  （read → notifyNewsRead 立即形态 / saved → notifyNewsSaved 登记补全，clipPath 必带）。 */
function onNewsChannelEvent(msg: NewsChannelEvent): void {
  if (!msg || !msg.evt) return;
  if (msg.kind === 'saved') {
    if (msg.clipPath) notifyNewsSaved(msg.evt, msg.clipPath);
    return;
  }
  notifyNewsRead(msg.evt);
}

/** 移除待补全登记（clearTimeout + 删除） */
function removePendingNewsSave(clipPath: string): void {
  const reg = newsPendingSaves.get(clipPath);
  if (reg) clearTimeout(reg.timer);
  newsPendingSaves.delete(clipPath);
}

/** 剪藏 modify 补全（'clipping:file-modified' 总线订阅）：命中登记 → 读 frontmatter summary/tags → 完整保存观察 → 移除登记。
 *  ticket 084b 二次匹配：事件路径 ≠ 登记键（auto-summary renameToTitle 改名后 modify 带新路径）时，
 *  按事件文件 frontmatter url / 文件名反查登记表，改名场景同样补全命中。 */
async function completePendingNewsSave(file: any): Promise<void> {
  const path = file?.path;
  let reg = newsPendingSaves.get(path);
  let regPath = path;
  const fm = await readClipFrontmatterOrEmpty(file);
  if (!reg) {
    // 键未命中 → 事件文件反查登记（link/文件名两路；无匹配 → 普通剪藏 modify，短路不产观察）
    const hit = reverseLookupPendingNewsSave(file, fm);
    if (!hit) return;
    reg = hit.reg;
    regPath = hit.clipPath;
  }
  removePendingNewsSave(regPath);
  const text = buildNewsSavedFullText(reg.title, reg.platform, reg.durationMin, fm.summary || null, fm.tags.length ? fm.tags : null);
  await addNewsSaveObservation(text);
}

/** 二次匹配（ticket 084b）：事件文件与登记键不一致时反查登记表——frontmatter url 一致（URL 唯一，
 *  renameToTitle 只改文件名不碰 frontmatter）优先；其次文件名 baseName 一致（AI 标题与原 cleanTitle 相同的
 *  未改名场景，或目录级移动）。返回命中登记的键（原剪藏路径）与登记本身。 */
function reverseLookupPendingNewsSave(file: any, fm: { summary: string; tags: string[]; url: string }): { reg: NewsPendingSave; clipPath: string } | null {
  const path = file?.path;
  if (!path || newsPendingSaves.size === 0) return null;
  const base = path.split('/').pop()?.replace(/\.md$/i, '') || '';
  let baseHit: { reg: NewsPendingSave; clipPath: string } | null = null;
  for (const [clipPath, reg] of newsPendingSaves) {
    if (clipPath === path) continue; // 键已在上层命中
    if (fm.url && reg.url === fm.url) return { reg, clipPath };
    if (!baseHit && base && reg.baseName === base) baseHit = { reg, clipPath };
  }
  return baseHit;
}

/** 降级：登记后 2 分钟未等到 auto-summary → 读剪藏 frontmatter（错过 modify 事件兜底）→ 产出保存观察并移除登记。
 *  ticket 084b：原路径读无摘要（auto-summary renameToTitle 已改名，原路径不存在）→
 *  按登记 baseName/url 全剪藏目录反查改名后新路径再读，AI 摘要/标签不再被改名吞掉。 */
async function degradePendingNewsSave(clipPath: string): Promise<void> {
  const reg = newsPendingSaves.get(clipPath);
  if (!reg) return; // 已被补全移除
  removePendingNewsSave(clipPath);
  let fm = await readClipFrontmatterOrEmpty(clipPath);
  if (!fm.summary && fm.tags.length === 0) {
    const moved = await locateRenamedClip(reg, clipPath);
    if (moved) fm = await readClipFrontmatterOrEmpty(moved);
  }
  const text = buildNewsSavedFullText(reg.title, reg.platform, reg.durationMin, fm.summary || null, fm.tags.length ? fm.tags : null);
  await addNewsSaveObservation(text);
}

/** 剪藏目录内反查改名后新文件（ticket 084b）：枚举 `归档/网页剪藏/` 下 .md，
 *  优先 frontmatter url 与登记一致（renameToTitle 改名场景），其次文件名 baseName 与登记一致；
 *  逐一读 frontmatter 判定，防误配其他剪藏。返回新路径，找不到返回 null（维持原降级语义：空摘要）。 */
async function locateRenamedClip(reg: NewsPendingSave, clipPath: string): Promise<string | null> {
  if (!appRef || !reg.baseName) return null;
  let candidates: any[] = [];
  try {
    if (typeof appRef.vault.getFiles === 'function') {
      candidates = appRef.vault.getFiles().filter((f: any) => {
        const p = String(f?.path || '');
        return p !== clipPath && p.startsWith('归档/网页剪藏/') && p.endsWith('.md');
      });
    }
  } catch {
    return null; // 枚举失败按无候选（维持原降级语义）
  }
  // 1) frontmatter url 完全匹配（URL 唯一标识原文；renameToTitle 保留 frontmatter）
  if (reg.url) {
    for (const c of candidates) {
      try {
        if ((await readClipFrontmatterOrEmpty(c)).url === reg.url) return String(c.path);
      } catch { /* 单个候选读取失败跳过 */ }
    }
  }
  // 2) 文件名 baseName 完全匹配（未改名兜底；原路径已试过，此处只收其他同 basename 文件）
  for (const c of candidates) {
    const p = String(c?.path || '');
    const base = p.split('/').pop()?.replace(/\.md$/i, '') || '';
    if (base === reg.baseName) return p;
  }
  return null;
}

/** 保存联动产出防重复：与近 20 条同文案（保存瞬间 notifyNewsRead 已产的立即形态）→ 跳过，防双条入流 */
async function addNewsSaveObservation(text: string): Promise<void> {
  const mem = memorySystem;
  if (!mem) return;
  const norm = text.trim();
  if (mem.stream.slice(-20).some((m) => (m.description || '').trim() === norm)) return;
  await mem.addObservation(text, { source: 'news' });
}

/** 读剪藏 frontmatter 的 url/summary/tags（auto-summary 产物原样处理；正则轻量解析，兼容 list 与 inline 数组两式） */
async function readClipFrontmatterOrEmpty(fileOrPath: any): Promise<{ summary: string; tags: string[]; url: string }> {
  const empty = { summary: '', tags: [] as string[], url: '' };
  if (!appRef) return empty;
  let content = '';
  try {
    const f = typeof fileOrPath === 'string' ? appRef.vault.getAbstractFileByPath(fileOrPath) : fileOrPath;
    if (!f) return empty;
    content = await appRef.vault.read(f);
  } catch {
    return empty; // 读取失败按无摘要降级
  }
  return parseClipFrontmatter(content);
}

/** frontmatter url/summary/tags 轻量解析（正则；兼容 `  - ` list 与 `["a","b"]` inline 两式）。
 *  url 为 rename 反查主锚点（ticket 084b）：剪藏模板 `url: "URL"`，renameToTitle 只改文件名不碰 frontmatter。 */
export function parseClipFrontmatter(content: string): { summary: string; tags: string[]; url: string } {
  const out: { summary: string; tags: string[]; url: string } = { summary: '', tags: [], url: '' };
  const fm = content.match(/^\s*---\s*\n([\s\S]*?)\n\s*---\s*\n/);
  if (!fm) return out;
  const tags: string[] = [];
  let inTags = false;
  for (const line of fm[1].split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('tags:')) {
      const inline = trimmed.slice(5).trim();
      if (inline.startsWith('[')) {
        try {
          const arr = JSON.parse(inline);
          if (Array.isArray(arr)) tags.push(...arr.map((t: any) => String(t ?? '').trim()).filter(Boolean));
        } catch { /* inline 解析失败走 list */ }
      } else {
        inTags = true;
      }
      continue;
    }
    if (inTags) {
      if (/^\s*-/.test(line)) {
        const v = line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '');
        if (v) tags.push(v);
      } else {
        inTags = false; // 离开 tags 列表块
      }
    }
    if (trimmed.startsWith('summary:') || trimmed.startsWith('summary：')) {
      out.summary = trimmed.slice(trimmed.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '');
    }
    if (trimmed.startsWith('url:')) {
      out.url = trimmed.slice(trimmed.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  out.tags = tags;
  return out;
}

/** 测试辅助：注入降级等待时长 / 读取待补全登记表 */
export function __setNewsSaveTimeoutForTests(ms: number): void { newsSaveTimeoutMs = ms; }
export function __getNewsPendingSavesForTests(): ReadonlyMap<string, NewsPendingSave> { return newsPendingSaves; }

// ------------- 日记观察（ticket 077：每条独立 10 分钟结算，ADR-0030） -------------
// 纯 smartcat 侧，不改 diary 域：vault create/modify/delete/rename 监听日记目录（classifyPath==='diary'），
// 每条日记（`# <emoji 序列> HH:mm` 块）持独立 10 分钟计时；该条任何修改重置其计时；
// 静置到期 → 读文件 → 解析 → 对该条结算（首落有字才生成 / 已有则累计 >50 才更新；瞬态读失败保留等下轮，
// 真删除才产删除观察——084d B1；累计差钳位 ≥0——084d B4）；
// 删除（文件 delete / 条目块消失 / rename 移出目录）→ 原观察保留、追加删除观察；rename 同目录内 → 计时/快照
// key 迁移（084d B2）。计时表/基线均内存态不落盘。

/** 条目 key（filePath + date + time 三段拼接；date = 文件名日期） */
function diaryEntryKey(filePath: string, date: string, time: string): string {
  return filePath + DIARY_KEY_SEP + date + DIARY_KEY_SEP + time;
}

/** 从日记文件路径取日期（`YYYY-MM-DD.md` 文件名 → 'YYYY-MM-DD'；非日期命名返回 null——不跟踪） */
function diaryFileDate(filePath: string): string | null {
  const base = (filePath || '').replace(/\\/g, '/').split('/').pop() || '';
  const m = base.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  return m ? m[1] : null;
}

/** 距今 offset 天日期（YYYY-MM-DD，本地时区；对齐 memoTodayStr 语义） */
function diaryDateStr(offset: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 重启基线（ticket 077 + 084d B3）：ensure 时对日记目录「当日 + 前 1 天 + 前 2 天」文件建快照
 * （不产出观察，防重启后旧条目被当首次——补写昨日/前日场景防整文件假首落重复入流）；
 * 更久远文件仍不基线（防启动扫描开销；ADR-0030 已知边界已记）；
 * 有字条目记「已见」（generated=true，后续改动走更新分支）；无字（标题即存）待首落；不装计时器（事件才起动）。 */
async function buildDiaryBaseline(): Promise<void> {
  if (!appRef) return;
  const app = appRef;
  const dir = (DIARY_DIRECTORY || '我的/日记').replace(/\/+$/, '');
  // B3（ticket 084d）：基线窗口 当日 → 当日 + 前 1 天 + 前 2 天（改动最小方案，不再评估 mtime 方案）
  for (let offset = 0; offset <= 2; offset++) {
    const date = diaryDateStr(offset);
    const filePath = `${dir}/${date}.md`;
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file) continue;
    let content = '';
    try { content = await app.vault.read(file as any); } catch { continue; }
    const tracked = new Map<string, { body: string; tags: string[] }>();
    for (const e of parseDiaryFile(content)) {
      tracked.set(`${date}${DIARY_KEY_SEP}${e.time}`, { body: e.body, tags: e.tags });
      const key = diaryEntryKey(filePath, date, e.time);
      if (!diaryTimers.has(key)) {
        diaryTimers.set(key, { timer: null, generated: e.body.length > 0, baseline: e.body, baselineTags: e.tags, accum: 0, lastGeneratedAt: 0 });
      }
    }
    diaryTracked.set(filePath, tracked);
  }
}

/** 重置某条独立计时（10 分钟静置后结算）；该条无记录则按新条目初始化（generated=false 待首落） */
function resetDiaryTimer(filePath: string, date: string, time: string): void {
  const key = diaryEntryKey(filePath, date, time);
  const st = diaryTimers.get(key) || { timer: null, generated: false, baseline: '', baselineTags: [], accum: 0, lastGeneratedAt: 0 };
  if (st.timer) clearTimeout(st.timer);
  st.timer = setTimeout(() => { void settleDiaryEntry(filePath, date, time); }, diarySettleMs);
  diaryTimers.set(key, st);
}

/** 移除某条计时（清定时器 + 删记录） */
function dropDiaryTimer(filePath: string, date: string, time: string): void {
  const key = diaryEntryKey(filePath, date, time);
  const st = diaryTimers.get(key);
  if (st?.timer) clearTimeout(st.timer);
  diaryTimers.delete(key);
}

/** 计时到期结算：读文件 → 解析 → 对该条按判定纯函数产出（首落有字 → 新增观察；已有且累计 >50 → 新增更新观察）；
 *  结算期间该条被再次修改（计时已重置）或 unload 清理 → 放弃本次（交给新计时）。 */
async function settleDiaryEntry(filePath: string, date: string, time: string): Promise<void> {
  const mem = memorySystem;
  if (!appRef || !mem || !data?.config?.noteSource) return;
  const key = diaryEntryKey(filePath, date, time);
  const st = diaryTimers.get(key);
  if (!st) return;
  st.timer = null; // 结算中：防重入（若期间被重设计时，其新 timer 会覆盖此 null）
  // B1（ticket 084d）：「真删除」与「瞬态读失败」分离——getAbstractFileByPath null（文件已删除/移出，
  // 事件未及感知）→ 删除观察 + 清记录；vault.read 抛错（瞬态 IO）→ 保留记录等下轮，不误判删除。
  let file: any = null;
  try { file = appRef.vault.getAbstractFileByPath(filePath); } catch { return; }
  if (!file) {
    appendDiaryDeleteObservation(date, time);
    diaryTimers.delete(key);
    // P2 重复删除观察修复：同步跟踪快照——否则随后到达的 vault delete 事件按旧快照
    // 再逐条产一遍删除观察（同一条日记两条「你删除了」）
    diaryTracked.get(filePath)?.delete(`${date}${DIARY_KEY_SEP}${time}`);
    return;
  }
  let entry: DiaryEntryLike | null = null;
  try {
    entry = parseDiaryFile(await appRef.vault.read(file as any)).find((e) => e.time === time) || null;
  } catch {
    return; // 瞬态读失败：保留计时/状态（下轮结算或 modify 事件再推进）
  }
  // 竞态守卫：结算读文件期间该条被重置（st.timer 非空 → 新计时已接棒）或 unload（表已清）→ 放弃本次结算
  if (diaryTimers.get(key) !== st || st.timer !== null) return;
  if (!entry) {
    // 结算时条目已消失（modify diff 未及感知的竞态）→ 兜底删除观察 + 清记录
    appendDiaryDeleteObservation(date, time);
    diaryTimers.delete(key);
    // P2：同文件消失分支——同步跟踪快照，防在途 modify 事件的 diff 再产一条重复删除观察
    diaryTracked.get(filePath)?.delete(`${date}${DIARY_KEY_SEP}${time}`);
    return;
  }
  const settled = decideDiarySettle(entry, date, {
    generated: st.generated, baseline: st.baseline, baselineTags: st.baselineTags, accum: st.accum,
  });
  if (settled.text) {
    // fire-and-forget：addObservation 的 appendVector（探测 Ollama）尾段在无向量环境可能不 resolve，
    // 结算状态须立即推进（对齐 notifyMovieAction 等既有 fire-and-forget 模式）
    void mem.addObservation(settled.text, { source: 'diary' });
    st.lastGeneratedAt = Date.now();
  }
  // 结算状态推进会话内生效（首落已见 / 基线更新 / 累计推进——本次补写 ≤50 也计入下次结算）
  st.generated = settled.next.generated;
  st.baseline = settled.next.baseline;
  st.baselineTags = settled.next.baselineTags;
  st.accum = settled.next.accum;
}

/** 追加一条删除观察（原观察全部保留，删除观察只是追加；fire-and-forget 防阻塞事件链） */
function appendDiaryDeleteObservation(date: string, time: string): void {
  const mem = memorySystem;
  if (!mem || !data?.config?.noteSource) return;
  void mem.addObservation(diaryDeleteText(date, time), { source: 'diary' });
}

/** 日记 create/modify 新链路（ticket 077）：diff 出变化的条目重置其独立计时；
 *  上次快照存在、这次消失的条目 → 追加删除观察 + 清该条计时（条目级删除感知的最小可靠方案：以每次
 *  modify 的全量解析快照 diff 实现，比正文子串匹配更稳——条目按 (日期, 时间) key 唯一标识）。 */
async function handleDiaryVaultActivity(file: any): Promise<void> {
  if (!appRef || !memorySystem || !data?.config?.noteSource) return;
  const filePath = file?.path;
  if (!filePath) return;
  const date = diaryFileDate(filePath);
  if (!date) return; // 非日期命名文件不跟踪（观察文案需要日期）
  let content = '';
  try { content = await appRef.vault.read(file as any); } catch { return; }
  const entries = parseDiaryFile(content);
  const prev = diaryTracked.get(filePath) || new Map<string, { body: string; tags: string[] }>();
  const cur = new Map<string, { body: string; tags: string[] }>();
  for (const e of entries) cur.set(`${date}${DIARY_KEY_SEP}${e.time}`, { body: e.body, tags: e.tags });
  // 条目级删除：上次快照有、现在消失 → 追加删除观察 + 清该条计时
  for (const key of prev.keys()) {
    if (!cur.has(key)) {
      const time = key.split(DIARY_KEY_SEP).pop()!;
      appendDiaryDeleteObservation(date, time);
      dropDiaryTimer(filePath, date, time);
    }
  }
  // 新增/变化条目 → 重置该条独立计时（各条目互不影响，另起 10 分钟）
  for (const [key, curVal] of cur) {
    const prevVal = prev.get(key);
    const changed = !prevVal || prevVal.body !== curVal.body || prevVal.tags.join(',') !== curVal.tags.join(',');
    if (changed) resetDiaryTimer(filePath, date, key.split(DIARY_KEY_SEP).pop()!);
  }
  diaryTracked.set(filePath, cur);
}

/** diary 文件删除处理（delete 事件与 rename 移出目录共用）：按跟踪快照逐条追加删除观察（日期+时间完整）
 *  + 清计时；从未跟踪过 → 文件级单条兜底（仅日期）。原观察全部保留，删除观察只是追加。 */
function handleDiaryTrackedDelete(filePath: string): void {
  const mem = memorySystem;
  if (!mem) return;
  const tracked = diaryTracked.get(filePath);
  if (tracked && tracked.size > 0) {
    for (const key of tracked.keys()) {
      const [date, time] = key.split(DIARY_KEY_SEP);
      appendDiaryDeleteObservation(date, time);
      dropDiaryTimer(filePath, date, time);
    }
  } else {
    const date = diaryFileDate(filePath);
    if (!date) return;
    // 文件级兜底（fire-and-forget，防阻塞 vault 事件链）
    void mem.addObservation(diaryDeleteFileText(date), { source: 'diary' });
  }
  diaryTracked.delete(filePath);
}

/** 卡片盒/现代诗/信 文件删除处理（delete 事件与 rename 移出目录共用）：有跟踪快照 → 追加删除观察
 * （原观察全部保留；fire-and-forget 防阻塞事件链）+ 清计时；未跟踪（无法知道内容）→ 跳过。 */
function handleNoteTrackedDelete(filePath: string): void {
  const mem = memorySystem;
  if (!mem) return;
  const tracked = noteTracked.get(filePath);
  if (tracked) {
    void mem.addObservation(noteDeleteText(tracked.kind, noteFileName(filePath)), { source: tracked.kind });
    dropNoteTimer(filePath);
  }
  noteTracked.delete(filePath);
}

/** 文件删除感知（ticket 077 + 083 分派）：diary 目录 → 按跟踪快照逐条追加删除观察（日期+时间完整），
 * 从未跟踪过 → 文件级单条兜底（仅日期）；卡片盒/现代诗/信 → 有跟踪快照才追加删除观察（未跟踪无法知道内容，跳过）。 */
async function onVaultDelete(file: any): Promise<void> {
  if (!file?.path || !initialized || !appRef || !memorySystem || !data?.config?.noteSource) return;
  const filePath = file.path;
  const kind = classifyPath(filePath);
  if (kind === 'diary') {
    handleDiaryTrackedDelete(filePath);
    return;
  }
  if (kind === 'flash' || kind === 'poem' || kind === 'letter') {
    handleNoteTrackedDelete(filePath);
    return;
  }
}

/** rename 同观察目录内迁移：diaryTimers（key=文件路径\u0001日期\u0001时间）与 diaryTracked（key=文件路径）的路径段替换 */
function migrateDiaryKeys(oldPath: string, newPath: string): void {
  const prefix = oldPath + DIARY_KEY_SEP;
  for (const k of [...diaryTimers.keys()]) {
    if (k.startsWith(prefix)) {
      const st = diaryTimers.get(k)!;
      diaryTimers.delete(k);
      diaryTimers.set(newPath + DIARY_KEY_SEP + k.slice(prefix.length), st);
    }
  }
  const tracked = diaryTracked.get(oldPath);
  if (tracked) {
    diaryTracked.delete(oldPath);
    diaryTracked.set(newPath, tracked);
  }
}

/** rename 同观察目录内迁移：noteTimers/noteTracked（key=文件路径）的路径段替换 */
function migrateNoteKeys(oldPath: string, newPath: string): void {
  const st = noteTimers.get(oldPath);
  if (st) {
    noteTimers.delete(oldPath);
    noteTimers.set(newPath, st);
  }
  const tracked = noteTracked.get(oldPath);
  if (tracked) {
    noteTracked.delete(oldPath);
    noteTracked.set(newPath, tracked);
  }
}

/** 文件重命名/移动感知（ticket 084d B2，083 note 链路同款）：diary/三域文件 oldPath → newPath
 *  （同观察目录内改名/移动）→ 迁移计时表与跟踪快照的路径 key（防「假删除 + 新路径重刷首落」）；
 *  移出观察目录（newKind ≠ oldKind）→ 按旧跟踪产删除观察 + 清理（对齐 delete 语义）。 */
async function onVaultRename(file: any, oldPath: string): Promise<void> {
  if (!file?.path || !oldPath || oldPath === file.path) return;
  if (!initialized || !appRef || !memorySystem || !data?.config?.noteSource) return;
  const oldKind = classifyPath(oldPath);
  if (oldKind !== 'diary' && oldKind !== 'flash' && oldKind !== 'poem' && oldKind !== 'letter') return;
  const newKind = classifyPath(file.path);
  if (newKind === oldKind) {
    if (oldKind === 'diary') migrateDiaryKeys(oldPath, file.path);
    else migrateNoteKeys(oldPath, file.path);
  } else {
    // 移出观察目录 → 按旧跟踪（delete 语义）产删除观察 + 清理
    if (oldKind === 'diary') handleDiaryTrackedDelete(oldPath);
    else handleNoteTrackedDelete(oldPath);
  }
}

/** 测试辅助：注入结算静置时长 / 读取日记计时表 / 读取日记跟踪快照 */
export function __setDiarySettleMsForTests(ms: number): void { diarySettleMs = ms; }
export function __getDiaryTimersForTests(): ReadonlyMap<string, DiaryTimerState> { return diaryTimers; }
export function __getDiaryTrackedForTests(): ReadonlyMap<string, Map<string, { body: string; tags: string[] }>> { return diaryTracked; }

// ------------- 卡片盒/现代诗/信 观察（ticket 083：每篇独立 10 分钟结算，ADR-0035） -------------
// 纯 smartcat 侧，不改 flash/poem/letter 域代码：vault create/modify/delete/rename 监听三目录
// （classifyPath ∈ {flash,poem,letter}，前缀匹配递归天然命中二级子目录），每篇 md 文件持独立 10 分钟计时；
// 该篇任何修改重置计时；静置到期 → 读文件 → 对该篇结算（首落有字才生成 / 正文有变化 → 段落 diff 摘要；
// 瞬态读失败保留等下轮——084d B1）；
// 删除（文件 delete / rename 移出目录）→ 原观察保留、追加删除观察；rename 同目录内 → 计时/快照 key 迁移（084d B2）。
// 计时表/基线均内存态不落盘。

/** 判定路径是否命中三域观察（classifyPath 返回 'flash'/'poem'/'letter' 才跟踪；reflection 已彻底移除） */
function observeNoteKind(filePath: string): NoteKind | null {
  const kind = classifyPath(filePath);
  if (kind === 'flash' || kind === 'poem' || kind === 'letter') return kind;
  return null;
}

/** 重启基线（ticket 083，v3/v4 准入）：ensure 时对三目录全部 md 建快照（不产出观察，防重启后旧文件被当首次）：
 *  有字记「已见」（generated=true，后续改动走 diff）；无字待首落；不装计时器（事件才起动）。
 *  信准入（v3/v4）：有 frontmatter date 且无 readonly:true 才跟踪；现代诗/卡片盒无字段约束。
 *  量级说明：一次 ensure 串行读三目录全部 md（实际实测 卡片盒 1506 + 现代诗 153 + 信 15 ≈ 1670 个），
 *  一次性成本可接受（对齐 077「重启基线防首次误产」取舍）。 */
async function buildNoteBaseline(): Promise<void> {
  if (!appRef) return;
  const app = appRef;
  let files: any[] = [];
  try { files = app.vault.getFiles?.() || []; } catch { return; }
  for (const file of files) {
    const filePath = String(file?.path || '');
    if (!filePath.endsWith('.md')) continue;
    const kind = observeNoteKind(filePath);
    if (!kind) continue;
    let content = '';
    try { content = await app.vault.read(file as any); } catch { continue; }
    const date = parseNoteDate(kind, content, filePath);
    if (kind === 'letter' && (!date || letterReadonly(content))) continue; // 信准入：date 必须、readonly 禁 → 不跟踪
    const body = noteBodyText(content);
    if (!noteTimers.has(filePath)) {
      noteTimers.set(filePath, { timer: null, kind, generated: body.length > 0, baseline: body, observed: false });
    }
    noteTracked.set(filePath, { kind, body, date });
  }
}

/** 重置某篇独立计时（10 分钟静置后结算）；该篇无记录则按新文件初始化（generated=false 待首落，observed=false） */
function resetNoteTimer(filePath: string, kind: NoteKind): void {
  const st = noteTimers.get(filePath) || { timer: null, kind, generated: false, baseline: '', observed: false };
  if (st.timer) clearTimeout(st.timer);
  st.timer = setTimeout(() => { void settleNoteFile(filePath); }, noteSettleMs);
  noteTimers.set(filePath, st);
}

/** 移除某篇计时（清定时器 + 删记录） */
function dropNoteTimer(filePath: string): void {
  const st = noteTimers.get(filePath);
  if (st?.timer) clearTimeout(st.timer);
  noteTimers.delete(filePath);
}

/** 计时到期结算：读文件 → 提取正文全文（去 frontmatter、trim，不截断）→ 现场解析日期 →
 *  对该篇按判定纯函数产出（首落有字 → 新增观察；正文有变化 → 段落 diff 摘要观察）；
 *  存量信/诗（generated 但从未出过首落）首次修改 → 先补带日期首落观察再产 diff（v3）；
 *  结算期间该篇被再次修改（计时已重置）或 unload 清理 → 放弃本次（交给新计时）。 */
async function settleNoteFile(filePath: string): Promise<void> {
  const mem = memorySystem;
  if (!appRef || !mem || !data?.config?.noteSource) return;
  const st = noteTimers.get(filePath);
  if (!st) return;
  st.timer = null; // 结算中：防重入（若期间被重设计时，其新 timer 会覆盖此 null）
  // B1（ticket 084d，对齐日记）：「真删除」与「瞬态读失败」分离——getAbstractFileByPath null（文件已删除/移出，
  // 事件未及感知）→ 兜底删除观察 + 清记录；vault.read 抛错（瞬态 IO）→ 保留记录等下轮，不误产差异观察。
  let file: any = null;
  try { file = appRef.vault.getAbstractFileByPath(filePath); } catch { return; }
  if (!file) {
    void mem.addObservation(noteDeleteText(st.kind, noteFileName(filePath)), { source: st.kind });
    dropNoteTimer(filePath);
    noteTracked.delete(filePath);
    return;
  }
  let content = '';
  try {
    content = (await appRef.vault.read(file as any)) || '';
  } catch {
    return; // 瞬态读失败：保留计时/状态（下轮结算或 modify 事件再推进）
  }
  // 竞态守卫：结算读文件期间该篇被重置（st.timer 非空 → 新计时已接棒）或 unload（表已清）→ 放弃本次结算
  if (noteTimers.get(filePath) !== st || st.timer !== null) return;
  const body = noteBodyText(content);
  const date = parseNoteDate(st.kind, content, filePath);
  const name = noteFileName(filePath);
  // 存量补首落（v3）：generated（基线预置/已进入已生成分支）但从未出过首落 + 信/诗 + 有日期 + 有正文 →
  // 先补「你在 <date> 写了一封信/一首现代诗「NAME」：<全文>」首落观察，再走下方 diff（两条观察一起产）。
  // flash 无日期概念不补（卡片盒存量修改直接 diff，v2 规则 3）；诗无日期来源也不补（v3：差异观察不依赖日期）。
  if (st.generated && !st.observed && (st.kind === 'letter' || st.kind === 'poem') && date && body) {
    const first = noteFirstText(st.kind, name, body, date);
    if (first) {
      void mem.addObservation(first, { source: st.kind }); // fire-and-forget，对齐 diary 链路
      st.observed = true;
    }
  }
  const settled = decideNoteSettle(st.kind, name, body, {
    generated: st.generated, baseline: st.baseline,
  }, date);
  if (settled.text) {
    // fire-and-forget：addObservation 的 appendVector（探测 Ollama）尾段在无向量环境可能不 resolve，
    // 结算状态须立即推进（对齐日记链路）
    void mem.addObservation(settled.text, { source: st.kind });
  }
  // 结算状态推进会话内生效：基线恒推进到当前正文全文（v2：无累计）；observed——首落已产出或确定不产（无日期）置 true
  st.generated = settled.next.generated;
  st.baseline = settled.next.baseline;
  if (settled.kind === 'first') st.observed = true;
  else if (!st.observed && body && !date && st.generated) st.observed = true; // 无日期首落机会用尽（诗），防重复补首落尝试
}

/** 三域 create/modify 新链路（ticket 083，v3/v4 准入）：diff 出正文变化才重置该篇独立计时并更新快照；
 *  文件不存在（modify 竞态）跳过；正文全量入快照（不截断）。
 *  信准入：有 frontmatter date 且无 readonly:true 才跟踪（无 date/readonly 的信不产任何观察）。 */
async function handleNoteVaultActivity(file: any): Promise<void> {
  if (!appRef || !memorySystem || !data?.config?.noteSource) return;
  const filePath = file?.path;
  if (!filePath) return;
  const kind = observeNoteKind(filePath);
  if (!kind) return;
  let content = '';
  try { content = (await appRef.vault.read(file as any)) || ''; } catch { return; } // 文件不存在（竞态）跳过
  const date = parseNoteDate(kind, content, filePath);
  if (kind === 'letter' && (!date || letterReadonly(content))) return; // 信准入：无 date / readonly → 不跟踪不观察
  const body = noteBodyText(content);
  const prev = noteTracked.get(filePath);
  if (prev && prev.body === body) return; // 正文未变（自动保存连发）→ 不重置计时
  noteTracked.set(filePath, { kind, body, date });
  resetNoteTimer(filePath, kind);
}

/** 测试辅助：注入结算静置时长 / 读取三域计时表 / 读取三域跟踪快照 */
export function __setNoteSettleMsForTests(ms: number): void { noteSettleMs = ms; }
export function __getNoteTimersForTests(): ReadonlyMap<string, NoteTimerState> { return noteTimers; }
export function __getNoteTrackedForTests(): ReadonlyMap<string, { kind: NoteKind; body: string; date: string | null }> { return noteTracked; }

// ------------- 收藏本动作观察（ticket 078：方法监听，ADR-0031） -------------

/** 收藏本动作观察处理（favorites 域 UI 经 emitDomainEvent('favorites', evt) 派发 → 总线订阅进入）。
 *  未初始化 / 未启用（noteSource 关）→ 静默；文案构造见 favorites-source.buildFavoritesActionText。 */
function notifyFavoritesAction(evt: FavoritesActionEvent): void {
  if (!initialized || !memorySystem || !data?.config?.noteSource) return;
  const text = buildFavoritesActionText(evt);
  if (text) void memorySystem.addObservation(text, { source: 'favorites' });
}

// ------------- 归物本动作观察（ticket 079：方法监听，ADR-0032） -------------

/** 归物本动作观察处理（belongings 域 UI 经 emitDomainEvent('belongings', evt) 派发 → 总线订阅进入）。
 *  未初始化 / 未启用（noteSource 关）→ 静默；文案构造见 belongings-source.buildBelongingsActionText。
 *  即时同步观察：无 timer/map 需清理。 */
function notifyBelongingsAction(evt: BelongingsActionEvent): void {
  if (!initialized || !memorySystem || !data?.config?.noteSource) return;
  const text = buildBelongingsActionText(evt);
  if (text) void memorySystem.addObservation(text, { source: 'belongings' });
}

// ------------- 番茄钟动作观察（ticket 080：方法监听） -------------

/** 番茄钟动作观察处理（pomodoro 域 applyAction 经 emitDomainEvent('pomodoro', evt) 派发 → 总线订阅进入）。
 *  未初始化 / 未启用（noteSource 关）→ 静默；文案构造见 pomodoro-source.buildPomodoroActionText。 */
function notifyPomodoroAction(evt: PomodoroActionEvent): void {
  if (!initialized || !memorySystem || !data?.config?.noteSource) return;
  const text = buildPomodoroActionText(evt);
  if (text) void memorySystem.addObservation(text, { source: 'pomodoro' });
}

/** 域 JSON 感知状态（domain-source.ts 提供 extract 纯函数；此处管理监听生命周期） */
const domainPrev = new Map<string, string>();
const domainObserved = new Set<string>();
let domainReader: (() => void) | null = null;

/** noteSource 开关守卫（ticket 084c A3，对齐 vault md 事件订阅 / 域动作订阅先例）：关 → 书库观察整链静默（不产即时/防抖） */
const watchEnabled = (): boolean => !!(data?.config?.noteSource);

/** 书库划线/想法事件入 pending（ticket 081 v2）：per-book 独立 5 分钟窗口，追加内容 + 重置计时；超时结算一条 */
function pushLibraryPending(id: string, title: string, more: { highlights?: string[]; excerpts?: string[] }): void {
  let p = libraryPendingNotes.get(id);
  if (!p) {
    p = { title, highlights: [], excerpts: [], timer: 0 as unknown as ReturnType<typeof setTimeout> };
    libraryPendingNotes.set(id, p);
  }
  p.title = title; // 标题以最新保存为准
  if (more.highlights?.length) p.highlights.push(...more.highlights);
  if (more.excerpts?.length) p.excerpts.push(...more.excerpts);
  clearTimeout(p.timer);
  p.timer = setTimeout(() => { void settleLibraryPending(id); }, libraryDebounceMs);
}

/** 书库防抖窗口结算（ticket 081 v2）：组稿一条入流并移除 pending。
 *  noteSource 关（A3）→ 已挂 pending 的结算也不产（内容丢弃防晚到入流，防抖表照常清）。 */
async function settleLibraryPending(id: string): Promise<void> {
  const p = libraryPendingNotes.get(id);
  if (!p) return;
  libraryPendingNotes.delete(id);
  if (!watchEnabled() || !memorySystem) return;
  const text = buildLibraryNoteText(p.title, p.highlights, p.excerpts);
  if (text) await memorySystem.addObservation(text, { source: 'domain:library' });
}

/** library 结构化 diff 消费（ticket 081 v2）：书架增删/读完/时长即时入流；划线/想法走 5 分钟防抖。
 *  noteSource 关（A3）→ 即时事件与防抖档案均不产。 */
async function consumeLibraryDiff(diff: LibraryWeaveDiff, mem: any): Promise<void> {
  if (!watchEnabled()) return;
  for (const e of diff.added) await mem.addObservation('你把《' + e.title + '》加入了书架', { source: 'domain:library' });
  for (const e of diff.started) await mem.addObservation('你开始读《' + e.title + '》', { source: 'domain:library' });
  for (const e of diff.done) await mem.addObservation('你读完了《' + e.title + '》', { source: 'domain:library' });
  for (const e of diff.removed) await mem.addObservation('你把《' + e.title + '》移出了书架', { source: 'domain:library' });
  for (const e of diff.sessions) {
    await mem.addObservation('你读了《' + e.title + '》约 ' + e.minutes + ' 分钟（读到 ' + e.percent + '%）', { source: 'domain:library' });
  }
  for (const e of diff.highlightEvents) pushLibraryPending(e.id, e.title, { highlights: e.texts });
  for (const e of diff.excerptEvents) pushLibraryPending(e.id, e.title, { excerpts: e.texts });
}

/** 域 JSON 观察接入（2026-08-23 用户拍板：CONFIG/STORAGE 域数据 modify → 观察；懒启动探测已有数据文件）。
 *  noteSource 关（A3）→ modify 监听照挂、事件逐个短接静默（对齐 vault md 事件订阅：开关可随时切换）。 */
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
      if (!watchEnabled()) return; // noteSource 关（ticket 084c A3）→ 域数据 modify 不产（对齐 vault md 事件订阅短接）
      const key = Object.keys(DOMAIN_FILES).find((k) => DOMAIN_FILES[k].file === file.path);
      if (!key || !domainObserved.has(key)) return;
      let raw: any = null;
      try { raw = JSON.parse(await app.vault.read(file)); } catch { return; }
      // ticket 081：library 走结构化 diff（书架/时长即时，划线/想法防抖）；其余域 string/数组逐条入流
      if (key === 'library') {
        const diff = DOMAIN_FILES.library.extract(raw, domainPrev) as LibraryWeaveDiff | null;
        if (diff) await consumeLibraryDiff(diff, mem);
        return;
      }
      const texts = DOMAIN_FILES[key].extract(raw, domainPrev);
      // type guard：library 的 LibraryWeaveDiff 已在上面分支处理；此处仅 string/数组
      if (texts && (typeof texts === 'string' || Array.isArray(texts))) {
        for (const t of (Array.isArray(texts) ? texts : [texts])) {
          if (t) await mem.addObservation(t, { source: 'domain:' + key });
        }
      }
    });
    if (ref) domainReader = () => (app as any)?.vault?.offref?.(ref as any);
  }
}

/** 测试辅助：注入书库防抖窗口时长 / 读取划线想法 pending 表 */
export function __setLibraryDebounceMsForTests(ms: number): void { libraryDebounceMs = ms; }
export function __getLibraryPendingForTests(): ReadonlyMap<string, LibraryPendingNote> { return libraryPendingNotes; }