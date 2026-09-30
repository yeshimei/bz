/**
 * 脸谱面板行为层（issue 447 / ADR-0106）：markup 全部出自 render.ts（折子语义单源），
 * 本文件只做生命周期 / 事件委托 / 数据流。
 *
 * 视图：list（折子封面墙）/ detail（折页册：其人/相交/纪事三折，issue 455 双卷拆折、编年并入纪事折；
 * 数据统计与补充背景改独立弹窗，入口在详情头返回钮前）+
 * 数据源独立弹窗（447 拍板：默认不打开、打开即扫、默认不勾选、四态水位、「导入所选」只进聊天仓；
 * D 组拍板：页脚「画脸谱」退役——画谱从详情页动作列 / 印章逐人发起）。
 * 文件向导已退役（447）：bz-people-import 命令改开数据源弹窗；聊天原文只在本层内存流转
 * （ADR-0191），聊天仓只落标签化文本。
 *
 * 生成链（issue 450 / 451）：本层不再内联跑生成循环——组装 targets 交给 jobs.ts 生成引擎
 * （模块级单例，独立于面板生命周期），面板只订阅快照渲染进度块；done 产物在本层
 * 落人物卡（PeopleStore 门面 / ImportRecord 口径沿用 446 收编形态，467 起写入保库记录）。关面板转后台，
 * 重开面板 snapshot+resume 渲染当前任务态，中断任务出「继续生成」。
 * 451：折子封面卡的印章升级为四态（未画谱 / 画谱中 / 画谱中断 / 已画谱）且本身就是动作入口
 * （画脸谱 / 暂停 / 继续生成 / 补画），快照每帧原位只换印章节点。
 * 452：墙成员 = 人物卡 ∪ 聊天仓联系人——「导入过素材但没画过」的人也要以「待画」折子上墙
 * （合成占位卡纯内存零写盘；占位卡上写档案 / 随手记前先 ensureEntry 落一张空卡）。
 */
import { notice, notifyActionError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { topifyZ } from '../core/z-order';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { getApp } from '../core/app';
import { onDomainEvent } from '../core/domain-bus';
import { ENCRYPT_UNLOCK_CHANGED_CHANNEL } from '../encrypt/data';
import { ensureSafeUnlocked, getSafeManager } from '../encrypt';
import { PeopleStore } from './data';
import {
  PROFILE_LIST_FIELDS,
  PROFILE_TEXT_FIELDS,
  buildProfileExtractPrompt,
  fillProfile,
  knownProfileText,
  parseProfileReply,
  profileExtractMaterial,
} from './digest';
import { createAI } from '../core/ai';
import { mergeManualEvents, planIncremental, type IncrementalPlan } from './incremental';
import { emptyMediaStats, formatMediaCount, type MediaStats } from './media';
import { computeStats, formatReplySec } from './stats';
import * as jobsApi from './jobs';
import type { JobResumeOptions, JobStartOptions, JobTarget, JobView, JobsSnapshot as EngineSnapshot } from './jobs';
import type { ContactStats, FaceDigest, GenerationConfirmInfo, ImportRecord, PersonEntry, PersonProfile, UnifiedMessage } from './types';
import { bondOf, personOf } from './types';
import {
  applyRecordingTurnsToMsgs,
  hasChatJson,
  listContactDirs,
  mergeStore,
  normalizeChatJson,
  normalizeOptionsFromSettings,
  plainNameOf,
  recordingTurnSegments,
  readAvatarInput,
  readContactAvatarPath,
  readContactBundle,
  readStatsJson,
  storeMediaBadge,
  storeStatsOf,
  storeToUnified,
  pendingMediaCounts,
  isDescSkipped,
  descSkipOf,
  SENSITIVE_SKIP,
  BROKEN_SKIP,
  MISSING_SKIP,
  type DescSkip,
  isGroupChat,
  SIDE_SPEECH_SPEAKER,
  type StoreContact,
  type StoreStats,
} from './datasource';
import {
  buildRecordingCheckSpec,
  buildRecordingSpec,
  buildRecordingTurnsMd,
  buildVoiceprintSpec,
  clearRecordingQueue,
  dequeueRecordingTask,
  duplicateRecordingGroups,
  enqueueRecordingTask,
  faceRecSupportError,
  fileSha256,
  formatRecElapsed,
  fmtClock,
  isRecordingFile,
  isRecordingQueued,
  isRecordingRunning,
  parseRecordingCheckResult,
  parseRecordingFilenameTs,
  probeFaceCapabilities,
  readRecordingMeta,
  readRecordingSidecar,
  recControlFilePath,
  recordingArtifactPaths,
  recordingFailureText,
  recordingPhasePct,
  recordingQueuePosition,
  recordingSidecarPath,
  recordingStartCandidates,
  recordingStartOf,
  recordingStageOf,
  recordingTmpPrefix,
  recordingTurnsComplete,
  recordingTsOf,
  recordingsDirOf,
  queuedRecordingCount,
  queuedRecordingItems,
  resolveRecordingTargetName,
  runningRecordingItems,
  startRecordingTask,
  stopRecordingTask,
  subscribeRecordingQueue,
  voiceprintRefStatus,
  writeRecordingMeta,
  writeRecordingTurnsMd,
  writeRecordingTurnsProofread,
  type RecordingSidecar,
} from './recording';
import { proofreadPieces } from '../core/asr-proofread';
import { pickSystemFiles } from '../core/path-picker';
import { startContactsExport, type ContactsExportHandle } from './export';
import { getPeopleSafeStore, type PeopleSafeRecord, type PeopleSafeStore } from './safe-store';
import { migrateLegacyPeopleData } from './migrate';
import { descImagePath, describeModelLabelOf, describeOverallPct, describeStageLine } from './describe';
import { prepOverallPct, prepStageLine } from './prep';
import { describeSyncStats, formatSyncElapsed, isSyncing, startSync, stopSync, subscribeSync, syncPhaseLabel, syncState, type PeopleSyncState } from './sync';
import {
  AL_PER_PAGE,
  PER_SPREAD,
  albumBlankPage,
  albumEmpty,
  albumGutter,
  albumLoad,
  albumPage,
  albumSealNode,
  albumSealOf,
  albumSpread,
  avatarNode,
  chatPage,
  dateRow,
  deleteTierOf,
  delPage,
  detailPage,
  dsPage,
  dsSyncLineNode,
  dsWaterOf,
  duoBar,
  findPage,
  foldBondBody,
  foldEventsBody,
  foldPersonBody,
  genPage,
  importMeta,
  insightsCard,
  jobsStagesDone,
  kindChips,
  lastCur,
  lockCover,
  mergeBanner,
  miniMarkdown,
  monthlyChart,
  noteAddRow,
  recNote,
  suppPage,
  suppRecStageLabel,
  applyRecStageChain,
  pageTotal,
  panelShell,
  profilePopBody,
  profPage,
  jobsNote,
  dueSoonOf,
  relationRow,
  replyLatencySec,
  socialRow,
  statsPage,
  statsPopBody,
  statsText,
  subPage,
  suppLocalTsValue,
  tagChip,
  turnLoad,
  type AlbumPhoto,
  type ChatLine,
  type ChatViewState,
  type DsModalState,
  type DsRowState,
  type DsSyncLine,
  type DeleteTier,
  type DetailOpts,
  type FindRow,
  type FoldCardJob,
  type FoldId,
  type JobsBlockState,
  type JobsUiStatus,
  type SuppImageQueueItem,
  type SuppImageViewState,
  type SuppRecQueueItem,
  type SuppRecRowState,
  type SuppRecViewState,
  type SuppTab,
} from './render';

import { appendSuppImageGridPage, el, profLeaveAsk, text, textEl } from './render';
import { chatLinesOf, chatSepOf, isGroupChatLines, type ChatLineData } from './chat';
import { clearMyAvatarCache, localImgOf, resolveMyAvatar } from './me-avatar';
import { cancelThumbQueue, descThumbPath, queueThumbBuild, resetThumbQueueForPanel, thumbHandled } from './thumbs';
import { mountIcons, openLightbox } from '../core/ui';
import { bindWheelTurn } from '../core/gesture';
import { tryGetSettings } from '../core/settings-provider';

const ESC_ID = 'people-panel';

type Stage = 'list' | 'detail';

let overlay: HTMLElement | null = null;
let store: PeopleStore | null = null;
/** 保库记录读写器（面板会话内共享；openPeoplePanel 解锁门禁后赋值） */
let peopleSafe: PeopleSafeStore | null = null;
/** 解锁门禁进行中（防双击重复弹解锁） */
let opening = false;
/** 解锁态订阅退订（面板开着才订；上锁即清明文并转不可读态） */
let offUnlockWatch: (() => void) | null = null;
/** 同步状态订阅退订（面板开着才订；同步进程独立于面板——关面板照跑，重开即恢复进度行） */
let offSyncWatch: (() => void) | null = null;
/** 滚轮翻页解绑（issue 507；桌面端鼠标滚轮翻摊，面板开着才挂） */
let offWheelTurn: (() => void) | null = null;
/** 视口尺寸跟帧：窄↔宽翻转时页眉高度变了，折签吸顶基准（--bz-page-head-h）要重量 */
let offResizeWatch: (() => void) | null = null;
let stage: Stage = 'list';
let detailId: string | null = null;
/** 互动统计卡的实时形态计数（issue 513）：打开统计页时异步读保库 store.kindCounts（全量口径，
 *  含并仓的录音轮次），到货重画；上锁 / 读失败回落 null = 用导入快照 */
let statsKinds: Record<string, number> | null = null;
/** 详情当前展开的折（换人回落画像折） */
let detailFold: FoldId = 'p';
/** 最近一次 renderList 拉到的人物（合并确认取名用） */
let listCache: PersonEntry[] = [];
/** 合并流程（issue 442）：mergeFromId = 待并出的人物；mergeToId = 已点选、待二次确认的目标 */
let mergeFromId: string | null = null;
let mergeToId: string | null = null;

// ---------------- 生成引擎接线状态（issue 450；引擎独立于面板生命周期） ----------------

/** 快照退订（订阅跟会话走：关面板后引擎照推，重开面板即时恢复任务态） */
let jobsUnsub: (() => void) | null = null;
/** 引擎最近一次快照（关面板后仍在更新——关面板转后台 + 重开渲染都靠它） */
let jobsCache: EngineSnapshot | null = null;
/** 本次会话提交给引擎的目标（talker → target）：done 落盘要引擎不回传的入参（kindCounts 等） */
const targetsInFlight = new Map<string, GenTarget>();
/** 已落过盘的任务（防引擎保留的 done 任务重复推送重复落盘；重新生成时按 talker 清除） */
const jobsPersisted = new Set<string>();
/** 引擎本会话是否已从保库记录的 job 段重建（resumeJobs 只做一次，防覆盖运行中的内存队列） */
let jobsBooted = false;

// ---------------- 数据源弹窗（issue 447） ----------------

/** 一位数据源联系人的扫描快照（内存态，不入盘） */
interface DsContact {
  /** 目录名（即聊天仓键 / PersonEntry.id） */
  name: string;
  /** 界面显示名（issue 501：剥掉重名唯一键后缀的纯名；目录名仍是 name） */
  displayName: string;
  rawCount: number;
  isGroup: boolean;
  /** 归一化后的时间线口径统计（按当前聊天仓开关）；stats 路径为原始口径聚合（485） */
  stats: StoreStats;
  /** 聊天仓已有条数（全量原始消息口径） */
  previewCount: number;
  /** 扫描时发现的新消息条数（原始 keys − 仓内 keys） */
  newCount: number;
  /** true = newCount 是「有无新」哨兵（stats 路径拿不到键集合，只能按 maxSid 对水位判定；485） */
  newApprox: boolean;
  /** 已画到的提炼锚点（PersonEntry.lastProcessedTs） */
  processedTs: number | null;
  /** 头像文件绝对路径（数据目录 avatar.<ext>；无则 null） */
  avatar: string | null;
}

let dsContacts: DsContact[] | null = null;
let dsSelected = new Set<string>();
let dsScanning = false;
let dsImporting = false;
let dsHiddenGroups = 0;
let dsNotice = '';
/** 导入完成且新增 >0（合上数据源那页时新照片飞回册页的点名账；D 组起不再挂「画脸谱」钮） */
let dsGenerateable = false;
/** 这一趟导入并进来的那几位（issue 507：导入后勾选就摘了，飞回点名按这份名单走） */
let dsLastImported: string[] = [];
let dsScannedAt = '';
/** 这一趟导入真的并进了素材（合上数据源那页时让带「新」的照片飞回册页） */
let dsImported = false;
/** 这一趟已经导出过完整聊天的联系人（还没入库：水位签的「已导出 · 待入库」中间态） */
const dsExported = new Set<string>();
/** 「找一找」的关键字（空 = 提示与标签） */
let findQuery = '';
/** 「找一找」键入防抖（B 组审查 P1）：输入框是重画重建的，停手 150ms 才整册重画并找回焦点 */
let findDebounce: ReturnType<typeof setTimeout> | null = null;
/** 数据源页过滤字（D 组拍板：只影响显示，不动勾选账；空 = 全列表） */
let dsFilter = '';
/** 数据源过滤键入防抖（与找一找同口径：停手 150ms 才重画并找回焦点） */
let dsFilterDebounce: ReturnType<typeof setTimeout> | null = null;
/** 撕掉确认开着的那条随手记（D 组拍板：先就地问一声；id 为 ManualEvent.id） */
let noteDelPending: string | null = null;

/** 在跑的按需导出（485「导入所选」前置段；面板关闭即 stop——导出生命周期跟着导入走） */
let exportRun: ContactsExportHandle | null = null;

// ---------------- 册子状态（issue 505：打开面板就是一本相册，弹窗也是册子里的一页） ----------------

/** 册页弹窗：ds / gen / find 不靠人（单页摊满整册）；stats / prof / note / chat / del 靠人（翻在详情那侧） */
type DialogKind = 'ds' | 'gen' | 'find' | 'stats' | 'prof' | 'note' | 'chat' | 'del';

/** 当前摊的左页序号（0 基，恒偶数）：翻摊改它，重画按它摆左右两页 */
let cur = 0;
/** 抽出来的那张照片的主人（同时表示详情翻开在对面那页；null = 只摊册页） */
let pulled: string | null = null;
/** 册页弹窗（同时只开一页） */
let dialog: { kind: DialogKind; tier?: DeleteTier } | null = null;

// —— 补充素材页状态（issue 509；hook 沿用 'note'） ——
let suppTab: SuppTab = 'text';
/** 暂存属于哪位联系人（换人清队列——图片队列 / ts 覆盖不跨人带） */
let suppOwnerId: string | null = null;
/** 图片页签的待落盘暂存（页内编辑归属 / 时间；关页不清——重开继续编） */
let suppImages: SuppImageQueueItem[] = [];
/** 落盘 / 加录音进行中（按钮防双击） */
let suppBusy = false;
/** 留影页签：点了叉、等二次确认的那张（img 相对路径；复评点名要问一声） */
let suppImgDelPending: string | null = null;
/** 留影网格分片页张量（issue 519）：首屏 120 张，滚到哨兵再追加一片——千张级全量把
 *  data URL 一次拉齐是开页冻死的病根（514 之前 python 预处理线直落 1616 张的教训）。 */
const SUPP_IMG_PAGE = 120;
/** 已展开的留影张数（开面板重置；删图重画不重置——保住用户已滚出来的量） */
let suppImgShown = SUPP_IMG_PAGE;
/** 哨兵的滚动观察（每次渲染 / 追加重挂；面板与弹窗关闭摘除） */
let suppImgMoreIO: IntersectionObserver | null = null;
/** 录音页签的待落盘暂存（选完文件、确认起点，再落盘；ADR-0217 起点是一等数据） */
let suppRecQueue: SuppRecQueueItem[] = [];
/** 删除二次确认开着的那条录音（issue 516 Q13；null = 没开） */
let recDelPending: string | null = null;
/** 确认里「同时删除录音原件」勾选态（默认勾选 = 原意：整条消失） */
let recDelAlsoFile = true;
/** 正在改起点的那条录音（ADR-0217；null = 没在改） */
let recStartEditFile: string | null = null;
/** 「查看轮次」正在看的那条（null = 没在看） */
let recTurnsFile: string | null = null;
/** 「重建质心」二次确认开着（复评：覆盖式重跑先问一声；确认 / 取消 / 换人即清） */
let recRefConfirm = false;
/** 终态标注的界面文案（单源：图片格子角标、汇总行、通知共读；取值见 DescSkip） */
const SKIP_LABEL: Record<DescSkip, string> = {
  [SENSITIVE_SKIP]: '敏感',
  [BROKEN_SKIP]: '源图损坏',
  [MISSING_SKIP]: '源图缺失',
};

/** 聊天仓侧事实缓存（弹窗渲染是同步的：开页异步刷，刷完重画） */
let suppStoreInfo: {
  imported: number;
  undescribed: number;
  /** 源图损坏 / 缺失、已标终态跳过的张数（ADR-0225；页面汇总行如实报，别让它们变成神秘数字） */
  broken: number;
  missing: number;
  mergedRecs: Set<string>;
  /** 已入库的留影（img 相对路径 + 派生描述 + 终态标注；新的在前——留影页签的预览网格用） */
  imageItems: Array<{ img: string; text: string; skip?: DescSkip; label?: string }>;
} = { imported: 0, undescribed: 0, broken: 0, missing: 0, mergedRecs: new Set(), imageItems: [] };
/** 录音页签的进度轮询（只在页签可见时跑） */
let recPollTimer: number | null = null;

// —— 聊天页状态（issue 529；hook 走 dialog.kind = 'chat'） ——
/** 一页上屏多少条（进页落在最新一条，往上长一页；两万条不整页铺） */
const CHAT_PAGE = 50;
/** 聊天仓时间线全量展示行（进页现读；换人 / 上锁 / 关面板即清） */
let chatAll: ChatLineData[] = [];
/** 已上屏的条数（从最新那头往回数） */
let chatShown = CHAT_PAGE;
/** 正在读保库记录（首屏） */
let chatLoading = false;
/** 加载更早时重画前记下的「离底距离」（重画后按同一距离还原——内容往上长，不是往下长） */
let chatAnchorBottom: number | null = null;
/** 这一次重画完要滚到底（进页 / 点「回到最新」） */
let chatScrollBottom = false;
/** 「更早的消息」哨兵的观察（进视口自动放一页；非聊天页即摘） */
let chatMoreIO: IntersectionObserver | null = null;

// —— 一次性动效标志：只在「刚发生」那一次重画里放，重画后立刻清掉（同页后续重画不重放） ——
let animBoot = true;      // 册子首次摊开（照片显影、纸边探出来）
let animTurn: '' | 'next' | 'prev' = '';
let animDetail = false;   // 详情那页转进来
let animFold = false;     // 折页内容换页
let animDrop: string[] = []; // 导入完：这几位的照片飞回册页（id 名单——导入那刻 newCount 已清零，认角标认不出人）
let animDev = '';         // 刚画完的那位：照片从灰里洗出颜色
let animNote = false;     // 进度便签落下来贴上
/** 换折之后详情正文要从头读（issue 507）：这一次重画别把滚动位置还回去 */
let foldScrollTop = false;

/** 开一只册页弹窗（靠人的页要有人开着；另一只开着则换页） */
function openDialog(kind: DialogKind, tier?: DeleteTier): void {
  // 画谱总确认开着时被换页（B 组审查 P1）：先按未授权结清，再动 dialog——
  // 否则直接覆盖会把 genConfirmOpen / pendingGenAnswer 永久挂起，本会话画脸谱恒返回「取消」
  if (genConfirmOpen) answerGenConfirm('cancel');
  dialog = { kind, tier };
  if (kind === 'note' && detailId) {
    // 换人清页内暂存（509 评审 P0）：图片队列 / 录音 ts 覆盖都是上一人的，跟着人走
    if (suppOwnerId !== detailId) {
      suppOwnerId = detailId;
      suppImages = [];
      suppRecQueue = [];
      recDelPending = null;
      recStartEditFile = null;
      recRefConfirm = false;
      suppImgDelPending = null;
      suppImgShown = SUPP_IMG_PAGE; // 分片跟着人走（issue 519）：别把上一人滚出来的量带给下一人
      noteDelPending = null; // 撕掉确认跟着人走（D 组）：换人不把确认带到别人的纸条上
      closeImgViewer();
      suppStoreInfo = { imported: 0, undescribed: 0, broken: 0, missing: 0, mergedRecs: new Set(), imageItems: [] };
    }
    void refreshSuppStoreInfo(detailId);
    startRecPolling();
  } else {
    stopRecPolling();
  }
  void renderAlbum();
}

/** 合上弹窗：刚导入完就合上时，让带「新」的那几张飞回册页；开工单则按未授权结算（Esc 与「取消」同路） */
function closeDialog(): void {
  if (!dialog) return;
  if (dialog.kind === 'gen') { answerGenConfirm('cancel'); return; }
  dialog = null;
  stopRecPolling();
  if (dsImported) {
    dsImported = false;
    animDrop = dsLastImported.slice(); // 这一趟导进来的那几位飞回册页
  }
  void renderAlbum();
}

export function isPeopleOpen(): boolean {
  return overlay !== null;
}

/**
 * 脸谱口径解锁门禁（issue 482）：ensureSafeUnlocked 传 'people' 档——解锁屏标题 / 副文案 /
 * 统计（联系人 / 随记录附件 / 附件密文）与朱砂配色走脸谱口径，不再借保险库的 'vault' 文案。
 */
export function peopleUnlockGate(): Promise<boolean> {
  return ensureSafeUnlocked('people');
}

/** 解锁门禁（默认 = peopleUnlockGate；测试经 setUnlockGateForTests 注入假件——jsdom 锁不住真锁屏） */
let unlockGate: () => Promise<boolean> = peopleUnlockGate;

/** 测试注入缝：替换 / 还原解锁门禁假件 */
export function setUnlockGateForTests(fn: (() => Promise<boolean>) | null): void {
  unlockGate = fn ?? peopleUnlockGate;
}

/**
 * 测试注入缝：直接摆好录音导入队列（起点候选 / 移出队列的面板交互回归用——
 * 真路径要弹系统文件对话框与本机 fs，jsdom 里走不到）。传入的条目对象原样进队列，
 * 测试持有同一引用即可断言模型侧的 startMs 变化；传 null 清空。
 */
export function setSuppRecQueueForTests(items: SuppRecQueueItem[] | null): void {
  suppRecQueue = items ? [...items] : [];
}

/**
 * 打开面板（已开则聚到前台；不自动开弹窗、不自动扫描——447 拍板）。
 * **解锁门禁前置（467 / ADR-0194 决策 3）**：脸谱数据整体在保险库里（索引也加密）——
 * 未解锁先弹主密码；取消 / 失败不开面板、不展示任何数据。
 */
export function openPeoplePanel(app?: unknown): void {
  if (overlay) {
    topifyZ(overlay);
    return;
  }
  if (opening) return;
  opening = true;
  void (async () => {
    try {
      const safe = await getPeopleSafeStore();
      if (!safe.unlocked) {
        const ok = await unlockGate();
        if (!ok) {
          pendingDs = false; // 取消解锁：数据源直开的账也一并清（B 组审查 P2）
          notice('脸谱数据在保险库里——解锁后才能查看', 'info');
          return;
        }
      }
      peopleSafe = safe;
      buildPanelShell(app);
      // 数据源直开补账（B 组审查 P2）：bz-people-import 面板未开时先开了面板——壳建好了就补开数据源页
      if (pendingDs) {
        pendingDs = false;
        void openDsIfIdle();
      }
      // 存量迁移（幂等）：明文三件（people.json / people-preview.json / people-jobs.json）
      // 每人拆进保库记录；全部校验通过才清理旧明文。半途崩溃重跑自动收敛。
      await runLegacyMigration();
      void renderAlbum();
      // 状态恢复（issue 450）：面板打开即拉引擎快照 + 订阅——运行中 / 暂停 / 中断 / done 都有对应呈现
      await restoreJobsView();
    } catch (e) {
      console.warn('[people] 打开面板失败:', e);
      notice('脸谱面板打开失败，请重试', 'error');
    } finally {
      opening = false;
    }
  })();
}

/** 面板壳与事件接线（解锁门禁通过后调；DOM 挂载与订阅集中在这里） */
function buildPanelShell(app?: unknown): void {
  if (overlay) return;
  store = new PeopleStore(app ?? getApp());
  overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay bz-people-scope';
  overlay.appendChild(panelShell());
  document.body.appendChild(overlay);
  topifyZ(overlay);
  // ESC 分层（448 评审；455 弹窗再加一层）：统计/档案弹窗最上先关，其次数据源弹窗（保扫描快照与勾选），再层层关面板
  registerPanelEsc(ESC_ID, isPeopleOpen, () => {
    if (dialog) {
      // 档案编辑脏守卫（D 组）：Esc 同一行内确认，不直接丢内容
      if (dialog.kind === 'prof') { guardProfLeave(closeDialog); return; }
      closeDialog();
    } else closePeoplePanel();
  });
  trapPanelFocus(overlay.querySelector<HTMLElement>('.bz-people-panel') ?? overlay);
  overlay.addEventListener('click', onOverlayClick);
  // 补充素材·图片行的时间改写即落状态（509 评审 P2：落盘才读回会被中途重画打回 mtime）
  // 录音导入行的起点同理（ADR-0217）——落盘前随时可改，不逐键绑状态只在 selected 时落
  overlay.addEventListener('change', (e) => {
    const tgt = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement ? e.target : null;
    if (!tgt) return;
    // 录音起点候选下拉（ADR-0217；B 组审查 P1）：只认 change——之前挂在 click 上，
    // 点开下拉那一下就带着旧值重画（DOM 重建把下拉合上），选完的 change 又没人接。
    // 只落账 + 原位同步起点输入框，不整页重画（起点输入框是落盘前 harvest 的事实源）。
    const cand = tgt.getAttribute('data-people-supp-rec-cand');
    if (cand !== null) {
      const path = tgt.getAttribute('data-people-supp-rec-path');
      const it = path !== null ? suppRecQueue.find((q) => q.path === path) : suppRecQueue[Number(cand)];
      const v = Number((tgt as HTMLSelectElement).value);
      if (it && Number.isFinite(v)) {
        it.startMs = v;
        const ts = tgt.closest('.bz-people-supp-qrow')?.querySelector<HTMLInputElement>('[data-people-supp-rec-ts]');
        if (ts) ts.value = suppLocalTsValue(v);
      }
      return;
    }
    const inp = tgt as HTMLInputElement;
    const idxRaw = inp.getAttribute('data-people-supp-img-ts');
    if (idxRaw !== null) {
      const it = suppImages[Number(idxRaw)];
      const v = inp.value ? new Date(inp.value).getTime() : NaN;
      if (it && Number.isFinite(v)) it.ts = v;
      return;
    }
    const recIdx = inp.getAttribute('data-people-supp-rec-ts');
    if (recIdx !== null) {
      const recPath = inp.getAttribute('data-people-supp-rec-path');
      const it = recPath !== null ? suppRecQueue.find((q) => q.path === recPath) : suppRecQueue[Number(recIdx)];
      const v = inp.value ? new Date(inp.value).getTime() : NaN;
      if (it) it.startMs = Number.isFinite(v) ? v : null;
      return;
    }
    if (inp.hasAttribute('data-people-supp-rec-del-file')) { recDelAlsoFile = inp.checked; return; }
    const startFile = inp.getAttribute('data-people-supp-rec-start');
    if (startFile) {
      const v = inp.value ? new Date(inp.value).getTime() : NaN;
      if (Number.isFinite(v)) void suppSetRecordingStart(startFile, v);
    }
  });
  // 桌面端鼠标滚轮翻摊（issue 507）：与触摸手势同一口径——累积到位翻一幕、一次只翻一幕。
  // 详情正文 / 数据源列表这种真能滚的块里先让原生滚完，滚到边了才轮到翻摊（滚轮挂在 overlay 上：
  // 册页每次重画都换节点，挂在 overlay 才不会被一起换掉）。
  offWheelTurn = bindWheelTurn(overlay, (dir) => turnTo(dir > 0 ? 'next' : 'prev'));
  // 键盘可达（D 组拍板）：① 输入框 Enter 直提交（448 评审 P3：标签 / 随手记连续录入免鼠标往返；
  // 506 补主密码框）——焦点在输入框 / 下拉 / 多行框里时其余键位一律不抢（「找一找」等
  // 既有 Enter 处理与方向键移动光标不受影响）；② 照片格 Enter / Space = 抽照片；
  // ③ 数据源勾选行 Space 切勾选（行内有 tabindex，与点击同账）；④ 无弹窗无详情 ←/→ 翻摊。
  overlay.addEventListener('keydown', (e) => {
    const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement
      || e.target instanceof HTMLTextAreaElement;
    const input = e.target instanceof HTMLInputElement ? e.target : null;
    if (e.key === 'Enter' && input) {
      if (!input.hasAttribute('data-people-prof-tag-input') && !input.hasAttribute('data-people-note-text')
        && !input.hasAttribute('data-people-del-pw')) return;
      e.preventDefault();
      if (input.hasAttribute('data-people-prof-tag-input')) addTagChip();
      else if (input.hasAttribute('data-people-del-pw')) {
        const p = listCache.find((x) => x.id === detailId) ?? null;
        const btn = overlay?.querySelector<HTMLButtonElement>('[data-people-del-ok]') ?? null;
        if (p && btn && !btn.disabled) void confirmDeleteFromPage(p, btn);
      } else void saveManualNote();
      return;
    }
    if (inField) return;
    const focus = e.target instanceof HTMLElement ? e.target : null;
    // 照片格：Enter / Space 抽照片（格上有 tabindex + role=button，此前键盘只聚焦不动作）
    const pocket = focus?.closest<HTMLElement>('[data-people-pocket]');
    if (pocket && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const id = pocket.dataset.peoplePocket ?? '';
      if (id) pullPhoto(id);
      return;
    }
    // 数据源勾选行（role=checkbox 的 span）：Space 走与点击同一条勾选账
    const chk = focus?.closest<HTMLElement>('[data-people-ds-check]');
    if (chk && e.key === ' ') {
      e.preventDefault();
      const name = chk.dataset.peopleDsCheck ?? '';
      const row = chk.closest('.bz-people-ds-row');
      // 群聊（未纳入）与「已导入且无新素材」两档不可勾（与点击分支同口径）
      const inert = row?.classList.contains('bz-people-ds-off') || row?.classList.contains('bz-people-ds-skip');
      if (name && !inert) {
        if (dsSelected.has(name)) dsSelected.delete(name); else dsSelected.add(name);
        syncDsChecks();
      }
      return;
    }
    // 无弹窗无详情：←/→ 翻摊（turnTo 自带 pulled / dialog 守卫，这里不重复判弹窗类型）
    if (!dialog && !pulled && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      turnTo(e.key === 'ArrowLeft' ? 'prev' : 'next');
    }
  });
  // 「找一找」键入即滤（B 组审查 P1）：输入框每次重画都按 findQuery 重建，input 委托必须挂在
  // overlay 上才活得过重画——否则打字永远不过滤，且任意重画把输入框按旧关键字重建回空。
  // 停手 150ms 才整册重画（逐键重画会抢走焦点），画完 focusFind 找回焦点（与清空 / 标签同路）。
  overlay.addEventListener('input', (e) => {
    const inp = e.target instanceof HTMLInputElement ? e.target : null;
    if (!inp) return;
    // 档案编辑卡内任何输入即脏（D 组脏守卫的记账点；结构增删在各自 click 分支记账）
    if (inp.closest('.bz-people-prof-edit')) { markProfDirty(); return; }
    if (inp.hasAttribute('data-people-find')) {
      findQuery = inp.value;
      if (findDebounce !== null) clearTimeout(findDebounce);
      findDebounce = setTimeout(() => {
        findDebounce = null;
        void renderAlbum().then(() => focusFind());
      }, 150);
      return;
    }
    // 数据源过滤框（D 组）：与找一找同一套防抖重画 + 找回焦点的口径
    if (inp.hasAttribute('data-people-ds-filter')) {
      dsFilter = inp.value;
      if (dsFilterDebounce !== null) clearTimeout(dsFilterDebounce);
      dsFilterDebounce = setTimeout(() => {
        dsFilterDebounce = null;
        void renderAlbum().then(() => focusDsFilter());
      }, 150);
    }
  });
  // 解锁态跟帧（ADR-0194 决策 5）：任意路径上锁（面板/锁屏/安全模式）→ 面板立即转不可读；
  // 重新解锁 → 恢复渲染
  offUnlockWatch = onDomainEvent<{ unlocked: boolean }>(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
    if (!overlay) return;
    if (evt?.unlocked === false) {
      peopleSafe?.clearPlainCaches();
      recordCache = null;
      clearChatState(); // 聊天页的行也是解密后的聊天原文（issue 529）
      void renderAlbum(); // renderBody 检查解锁态，渲染锁定占位
    } else if (evt?.unlocked === true) {
      void renderAlbum();
    }
  });
  // 同步状态跟帧（issue 465）：运行中进度行原位推进；终态刷新列表 / 错误面。
  // 同步进程独立于面板：关面板不退订同步本身（模块级单例照跑），只退本面板的渲染订阅。
  offSyncWatch = subscribeSync(onSyncState);
  // 库外图字节缓存在开面板时清一次（同路径换了图 / 补了文件不用重载插件）
  clearMyAvatarCache();
  // 分片与缩略档跟面板走（issue 519）：shown 回首屏量；坏档办结记录清了给重试机会
  suppImgShown = SUPP_IMG_PAGE;
  resetThumbQueueForPanel();
  // 视口尺寸跟帧：容器宽窄翻转（缩窗 / 转屏）而没重画时，折签吸顶基准跟着页眉重新量
  const onViewportResize = (): void => { syncStickyHeadH(); };
  window.addEventListener('resize', onViewportResize);
  offResizeWatch = (): void => window.removeEventListener('resize', onViewportResize);
}

/** 存量迁移（467 / ADR-0194；幂等，明文三件 → 保库记录；旧文件清理失败不阻断面板） */
async function runLegacyMigration(): Promise<void> {
  if (!peopleSafe?.unlocked) return;
  try {
    const out = await migrateLegacyPeopleData(getApp(), peopleSafe);
    if (out.migrated > 0) {
      recordCache = null;
      const extra = out.keptBack.length
        ? '。旧明文文件校验未全部通过，暂未删除（下次打开自动重试）'
        : '，旧明文文件已清理';
      notice(`已把 ${out.migrated} 位联系人的数据迁入保险库加密记录${extra}`, 'success');
    }
  } catch (e) {
    console.warn('[people] 存量迁移失败:', e);
    notice('存量数据迁移没有完成，将在下次打开时重试', 'warning');
  }
}

export function closePeoplePanel(): void {
  // 画谱总确认开着时点遮罩关面板（B 组审查 P1）：先按未授权结清再拆——否则
  // genConfirmOpen / pendingGenAnswer 不结清，Promise 与开工单泄漏，本会话画脸谱恒返回「取消」
  if (genConfirmOpen) answerGenConfirm('cancel');
  // 关面板转后台（issue 450）：引擎照跑；有正在跑的任务才提示，只剩暂停 / 排队不打扰。
  // 录音转写同理（D 组拍板）：进程独立于面板，关面板只在真在跑时交代去向。
  const backgrounded = jobsRunning();
  const recBackgrounded = runningRecordingItems().length > 0;
  unregisterPanelEsc(ESC_ID);
  offUnlockWatch?.();
  offUnlockWatch = null;
  offSyncWatch?.();
  offSyncWatch = null;
  offWheelTurn?.();
  offWheelTurn = null;
  offResizeWatch?.();
  offResizeWatch = null;
  overlay?.remove();
  overlay = null;
  store = null;
  if (findDebounce !== null) { clearTimeout(findDebounce); findDebounce = null; } // 关面板不欠一次重画
  stopRecPolling();
  exportRun?.stop(); // 在跑的按需导出跟着导入一起中止（485：导出生命周期不独立于面板）
  exportRun = null;
  detailId = null;
  detailFold = 'p';
  stage = 'list';
  listCache = [];
  recordCache = null; // 452 缓存语义沿用：保库记录快照随面板关闭失效（下次打开重读）
  clearChatState(); // 聊天页读出来的行同样随面板关失效（issue 529）
  loadActive = false; // 483：冷读指示态不随面板存续（进行中的 readAll 照常完成，落盘缓存供热读）
  loadDone = 0;
  loadTotal = null;
  mergeFromId = null;
  mergeToId = null;
  clearProfEditState(); // 编辑态不随面板存续（评审 P1-2：重开面板不落回编辑态）
  noteAddId = null;
  noteDelPending = null;
  dialog = null; // 弹窗不随面板存续（505：册页同样随面板关）
  pulled = null;
  cur = 0;
  suppImgDelPending = null;
  disarmSuppImgMore();
  cancelThumbQueue(); // 缩略档补齐跟着面板停（重开入新活自然接着补）
  closeImgViewer();
  closeDsState();
  if (findDebounce !== null) { clearTimeout(findDebounce); findDebounce = null; } // 关面板不欠一次重画
  if (dsFilterDebounce !== null) { clearTimeout(dsFilterDebounce); dsFilterDebounce = null; }
  if (backgrounded) notice('已转后台继续生成，重开面板查看进度', 'info');
  // 录音转写在跑（D 组拍板）：关面板不杀进程，与画谱后台同一口径交代去向
  if (recBackgrounded) notice('录音转写转后台继续，重开面板查看进度', 'info');
}

function closeDsState(): void {
  dsContacts = null;
  dsSelected = new Set();
  dsScanning = false;
  dsImporting = false;
  dsHiddenGroups = 0;
  dsNotice = '';
  dsGenerateable = false;
  dsLastImported = [];
  dsScannedAt = '';
  dsFilter = '';
}

/** 数据源延迟开门（B 组审查 P2）：bz-people-import 在未解锁时只能先开面板——解锁成功建好壳后按它补开数据源页 */
let pendingDs = false;

/** 直开数据源弹窗（bz-people-import 命令回调；面板未开先开） */
export function openDataSource(): void {
  if (!overlay) {
    pendingDs = true; // 面板还没建（可能卡在解锁门禁）：记一笔，解锁建壳后补开
    openPeoplePanel();
    return;
  }
  void openDsIfIdle();
}

/**
 * 数据源弹窗开闭守卫（issue 486 收窄）：只有真在跑（running）的生成才拦——导入会动聊天仓，
 * 跑动中任务指纹会漂移判废（450 沿用 447）。**暂停任务不再拦**：暂停可跨会话遗留，
 * 过去会永久锁死弹窗；继续跑时的指纹漂移判废（resumeExisting）已兜底消息集变化。
 */
async function openDsIfIdle(): Promise<void> {
  await ensureJobsBoot();
  await ensureJobsWatch();
  if (!overlay) return;
  if (jobsRunning()) { notice('正在生成脸谱，请等这批结束再开数据源', 'info'); return; }
  openDs();
}

// ---------------- 数据源弹窗状态机 ----------------

function dsDataDir(): string {
  return String(tryGetSettings()?.peopleDataDir ?? '').trim();
}

function isDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as { require?: unknown }).require);
}

/** 头像字节 → 内存 data URL（数据源弹窗行预览；记录里的头像走 safe.avatarDataUrl） */
function dataUrlOf(a: { base64: string; ext: string } | null): string | null {
  if (!a) return null;
  const mime =
    a.ext === 'png' ? 'image/png' : a.ext === 'webp' ? 'image/webp' : a.ext === 'gif' ? 'image/gif' : 'image/jpeg';
  return `data:${mime};base64,${a.base64}`;
}

function openDs(): void {
  if (dsOpen()) return;
  openDialog('ds');
  // 打开即扫（拍板 Q3）；已有快照不重扫（465：数据根刷新走「同步」，完成后自动重扫）
  if (dsContacts === null) void runScan();
}

/** 数据源册页开着（dialog 的单源视图） */
function dsOpen(): boolean {
  return dialog?.kind === 'ds';
}

/** 弹窗行状态（快照 + 水位 → 渲染入参）；query 缺省取过滤字（dsFilter），传空串取全量 */
function dsRowStates(query = dsFilter): DsRowState[] {
  const q = query.trim();
  const rows = (dsContacts ?? []).map((c) => {
    const badge = storeMediaBadge(c.stats);
    const rec = recordCache?.get(c.name);
    return {
      name: c.name,
      displayName: c.displayName,
      rawCount: c.rawCount,
      isGroup: c.isGroup,
      media: badge ? formatMediaCount(badge) : '',
      previewCount: c.previewCount,
      newCount: c.newCount,
      newApprox: c.newApprox,
      processedTs: c.processedTs,
      avatar: c.avatar,
      // 水位判定：保库记录里有聊天仓 = 已入库（导入只动记录，记录在即素材在）
      imported: Boolean(rec?.store?.msgs?.length),
      exported: dsExported.has(c.name),
    };
  });
  // 排序在这里落（不是扫描时）：水位依赖 recordCache，导入后水位才落到「无新素材」——
  // 排在渲染前算，关掉数据源页再打开就能看到刚导入的那几位沉到下面（issue 507）。
  const rank = (r: DsRowState): number => {
    const k = dsWaterOf(r)?.k;
    return k === 'newer' ? 0 : k === 'skip' ? 2 : 1;
  };
  const sorted = rows.sort((a, b) => rank(a) - rank(b) || b.newCount - a.newCount || a.name.localeCompare(b.name, 'zh'));
  // 过滤（D 组）：按显示名 contains；被滤掉的行只是不显示，dsSelected 原样保留
  return q ? sorted.filter((r) => r.displayName.includes(q)) : sorted;
}

function dsPageState(): DsModalState {
  const sel = (dsContacts ?? []).filter((c) => dsSelected.has(c.name));
  return {
    dataDir: dsDataDir(),
    scanning: dsScanning,
    importing: dsImporting,
    rows: dsContacts === null ? null : dsRowStates(),
    selected: sel.map((c) => c.name),
    hiddenGroups: dsHiddenGroups,
    notice: dsNotice,
    desktopOnly: !isDesktop(),
    scannedAt: dsScannedAt,
    syncing: isSyncing(),
    sync: dsSyncLine(),
    // 过滤（D 组）：框里现挂的字 + 全量总人数（页眉「N / 共 M 位」的 M）+ 全量行（页脚账不丢勾选）
    filter: dsFilter,
    totalRows: (dsContacts ?? []).length,
    allRows: dsContacts === null ? undefined : dsRowStates(''),
  };
}

/** 数据源过滤框重画后把焦点交回输入框（连打字不丢位置，与找一找同口径） */
function focusDsFilter(): void {
  overlay?.querySelector<HTMLInputElement>('[data-people-ds-filter]')?.focus();
}

// ---------------- 同步（issue 465：bz-face sync 驱动，弹窗内一条进度行） ----------------

/** 已耗时心跳定时器（484：running 期间每秒原位刷主行；终态 / 面板无关自清） */
let syncTickTimer: ReturnType<typeof setInterval> | null = null;

function stopSyncTick(): void {
  if (syncTickTimer) {
    clearInterval(syncTickTimer);
    syncTickTimer = null;
  }
}

/**
 * 同步状态 → 弹窗进度行（DsSyncLine）。idle 不出（null）；运行中主行 = 阶段标签 +
 * 段内位置（统计 N/M，484）+ 已耗时（每秒心跳，慢不再像死）、副行 = [bz-step] 文案、
 * 联系人行 = 最近一位处理完的联系人（484）；终态各自有文案与下一步动作。
 */
function dsSyncLine(): DsSyncLine | null {
  const s = syncState();
  if (s.outcome === 'idle') return null;
  if (s.outcome === 'running') {
    const label = syncPhaseLabel(s.phase) || '正在同步';
    const pos = s.phase === 'contacts' && s.contactsTotal ? ` ${s.contactsDone}/${s.contactsTotal}` : '';
    const elapsed = s.startedAt != null ? ` · 已 ${formatSyncElapsed(Date.now() - s.startedAt)}` : '';
    return { status: 'running', text: label + pos + elapsed, sub: s.step, contact: s.lastContact, pct: s.pct, hint: '', failures: [] };
  }
  if (s.outcome === 'ok') {
    return {
      status: 'ok',
      text: s.stats.failed > 0 ? `同步完成（${s.stats.failed} 位失败）` : '同步完成',
      sub: s.message || describeSyncStats(s.stats),
      contact: '',
      pct: 100,
      hint: '',
      failures: s.stats.failures.map((f) => `${plainNameOf(f.name)}：${f.error}`),
    };
  }
  if (s.outcome === 'stopped') {
    return {
      status: 'stopped',
      text: '已停止',
      sub: `已导出的部分保留——本次已更新 ${s.stats.written} 位，重跑可续传`,
      contact: '',
      pct: null,
      hint: s.hint,
      failures: [],
    };
  }
  return { status: 'error', text: '同步失败', sub: s.message, contact: '', pct: null, hint: s.hint, failures: [] };
}

/** 同步状态跟帧：运行中优先原位推进进度行（不重建弹窗）+ 心跳起表；首帧 / 终态走整渲染 */
function onSyncState(s: PeopleSyncState): void {
  if (s.outcome !== 'running') stopSyncTick(); // 终态（含面板关着收到终态）必须停表
  if (!overlay) return;
  if (s.outcome === 'running') {
    if (!syncTickTimer) {
      syncTickTimer = setInterval(() => {
        // 面板关着时终态通知收不到（订阅随面板退订）——心跳自检收表，不空转
        if (syncState().outcome !== 'running') {
          stopSyncTick();
          return;
        }
        updateSyncLine();
      }, 1000);
    }
    if (!updateSyncLine()) void renderAlbum(); // 进度行还没渲染出来（开跑首帧）→ 整渲染出停止钮与进度行
    return;
  }
  if (s.outcome === 'ok') {
    void runScan(true); // 完成后重读数据根：列表刷新并按聊天仓水位标出更新数（不自动导入）
    return;
  }
  void renderAlbum(); // stopped / error：进度行落终态文案，右上角恢复「同步」
}

/** 进度行原位更新（data-people-ds-sync-line 钩子；弹窗没渲染返回 false；结构过期也返回 false 走整渲染） */
function updateSyncLine(): boolean {
  const line = overlay?.querySelector<HTMLElement>('[data-people-ds-sync-line]');
  if (!line) return false;
  const view = dsSyncLine();
  if (!view) return false;
  const main = line.querySelector<HTMLElement>('[data-people-ds-sync-text]');
  const sub = line.querySelector<HTMLElement>('[data-people-ds-sync-sub]');
  const contact = line.querySelector<HTMLElement>('[data-people-ds-sync-contact]');
  if (main) main.textContent = view.text + (view.pct != null ? ` ${view.pct}%` : '');
  if (sub) {
    sub.textContent = view.sub;
    sub.hidden = !view.sub;
  }
  if (contact) {
    contact.textContent = view.contact;
    contact.hidden = !view.contact;
  }
  // 进度条结构跟 pct 对齐：不定态（null → 脉冲条）与确定态（有值 → 宽度条）互切时
  // 原位换不了节点，返回 false 让 onSyncState 走整渲染重建（484）
  const bar = line.querySelector<HTMLElement>('.bz-people-sync-bar');
  const indet = line.querySelector<HTMLElement>('.bz-people-sync-indet');
  if ((view.pct != null) !== Boolean(bar) || (view.pct == null) !== Boolean(indet)) return false;
  if (bar && view.pct != null) bar.style.width = `${Math.max(0, Math.min(100, view.pct))}%`;
  return true;
}

/** 点「同步」（数据根未配置等错误面由 startSync 落状态，经订阅回调渲染） */
function handleSyncClick(): void {
  if (isSyncing()) return;
  if (jobsRunning()) { notice('正在生成脸谱——等这批结束再同步', 'info'); return; }
  if (!isDesktop()) {
    dsNotice = '同步仅桌面端支持（需要调用外部工具 bz-face）。';
    renderAlbum();
    return;
  }
  dsNotice = '';
  startSync();
}

/**
 * 同步运行中把「画脸谱」类动作全部置灰（ADR-0196 决策 10：数据正在变，不画半截素材）。
 * 覆盖详情页动作签（画脸谱 / 继续生成 / 重新生成共用一个钩子）、数据源页脚与（万一在跑的）印章；
 * 渲染后调用（renderAlbum / 印章原位刷新）；程序路径另有 isSyncing 守卫兜底。
 */
function applySyncLockdown(): void {
  const lock = isSyncing();
  overlay?.querySelectorAll<HTMLButtonElement>('[data-people-act="generate"], [data-people-seal-act]').forEach((b) => {
    if (lock) {
      b.disabled = true;
      b.setAttribute('data-people-sync-lock', '1');
      b.title = '同步进行中——等同步完成再画脸谱';
      // 理由亮在按钮上（507 二审与画谱锁同口径）：hint 平时收着，锁住时 CSS 放它出来
      const hint = b.querySelector<HTMLElement>('.bz-people-act-hint');
      if (hint) hint.textContent = '等同步完成';
    } else if (b.hasAttribute('data-people-sync-lock')) {
      // 解锁（同步终态后）：恢复可点。title 由下一次节点重建还原（印章原位刷新 / renderBody）。
      b.disabled = false;
      b.removeAttribute('data-people-sync-lock');
    }
  });
}

/**
 * 画谱进行中把**别人**那页的「画脸谱」按下去（issue 507）。
 * 口径：同时只画一位——引擎队列是单跑的，起第二位要等前一位收工。这条限制本身是既定行为，
 * 缺的是**看得见**：过去点下去只弹一条一闪而过的通知，观感就是「点了没反应」。
 * 所以照同步锁那条老规矩办——不可点的动作不装作能点，理由直接写在按钮上。
 * 自己那一位留着（继续生成 / 补画 / 重画都走这枚钮，可续任务得能点），关锁由下一次重画自然还原。
 */
function applyJobsLockdown(): void {
  const queue = jobsCache?.queue ?? [];
  if (!jobsBusy()) return;
  // 在跑的优先；只剩暂停 / 中断时理由换一句（那一位在等用户，不在等 AI）
  const active = queue.find((j) => j.status === 'running')
    ?? queue.find((j) => j.status === 'paused' || j.status === 'interrupted');
  const who = active?.name || active?.talker || '';
  const running = active?.status === 'running';
  const why = running
    ? `正在给「${who}」画谱——一位一位来，等它画完再画这位`
    : `「${who}」那一趟还没收工——先接着画它（或删掉它的任务），再画这位`;
  const short = running ? `等「${who}」画完` : '先接上没画完的那位';
  overlay?.querySelectorAll<HTMLElement>('[data-people-detail]').forEach((page) => {
    const id = page.dataset.peopleDetail ?? '';
    if (queue.some((j) => j.talker === id)) return; // 这一位自己有任务（在跑 / 排队 / 待续）：照旧可点
    const btn = page.querySelector<HTMLButtonElement>('[data-people-act="generate"]');
    if (!btn) return;
    btn.disabled = true;
    btn.setAttribute('data-people-jobs-lock', '1');
    btn.title = who ? why : '已有画谱在进行——等它收工再画这位';
    const hint = btn.querySelector<HTMLElement>('.bz-people-act-hint');
    if (hint) hint.textContent = who ? short : '等前一位收工';
  });
}

/**
 * 扫描数据源：列目录 → 逐人读 stats.json（485 优先；缺文件回落 chat.json 归一化，兼容存量）
 * → 对照聊天仓算新素材 → 落快照（不导入、不自动勾选——447 拍板：默认不选任何联系人）。
 * stats 路径没有键集合，「新 N 条」退化成「有无新」哨兵（maxSid 对聊天仓 watermarkSid），
 * newCount=1 且 newApprox=true；chat.json 回落路径照旧精确计数。
 */
async function runScan(force = false): Promise<void> {
  const dataDir = dsDataDir();
  // 同步进行中不扫（issue 465）：数据根正在被工具写，扫到的会是半成品；完成后会自动重扫
  if (!overlay || !store || !dataDir || dsScanning || dsImporting || jobsRunning() || isSyncing()) return;
  if (!isDesktop()) {
    dsNotice = '';
    renderAlbum();
    return;
  }
  dsScanning = true;
  dsGenerateable = false;
  if (force) dsContacts = null;
  dsNotice = '';
  renderAlbum();
  const contacts: DsContact[] = [];
  let hidden = 0;
  try {
    const dirNames = listContactDirs(dataDir);
    const includeGroups = tryGetSettings()?.peopleIncludeGroups === true;
    const opts = normalizeOptionsFromSettings();
    const [storeData, people] = await Promise.all([records(), store.list()]);
    for (const name of dirNames) {
      if (!overlay) return; // 面板已关，放弃本次扫描
      // 485：sync 轮只产 stats.json——优先读统计；缺文件回落 chat.json（存量兼容）
      const stats = readStatsJson(dataDir, name);
      if (stats) {
        if (stats.group && !includeGroups) { hidden++; continue; }
        const pv = storeData.get(name)?.store;
        const entry = people.find((p) => p.id === name);
        contacts.push({
          name,
          displayName: plainNameOf(name),
          rawCount: stats.msgs,
          isGroup: stats.group,
          // 原始口径聚合（不随预览开关变）——扫描行徽章是预览，不是时间线权威
          stats: { msgCount: stats.msgs, voiceCount: stats.voices, voiceTotalSec: Math.round(stats.voiceSec), imageCount: stats.images },
          previewCount: pv?.msgs.length ?? 0,
          newCount: stats.maxSid > (pv?.watermarkSid ?? 0) ? 1 : 0,
          newApprox: true,
          processedTs: entry?.lastProcessedTs ?? null,
          avatar: dataUrlOf(readAvatarInput(readContactAvatarPath(dataDir, name))),
        });
        continue;
      }
      const bundle = readContactBundle(dataDir, name);
      if (!bundle) continue;
      const group = isGroupChat(bundle.raws);
      if (group && !includeGroups) { hidden++; continue; }
      const norm = normalizeChatJson(bundle.raws, opts, { voice: bundle.voice, imageDesc: bundle.imageDesc });
      const pv = storeData.get(name)?.store;
      const keys = new Set((pv?.msgs ?? []).map((m) => m.key));
      const entry = people.find((p) => p.id === name);
      contacts.push({
        name,
        displayName: plainNameOf(name),
        rawCount: bundle.raws.length,
        isGroup: group,
        stats: norm.stats,
        previewCount: pv?.msgs.length ?? 0,
        newCount: norm.msgs.reduce((s, m) => s + (keys.has(m.key) ? 0 : 1), 0),
        newApprox: false,
        processedTs: entry?.lastProcessedTs ?? null,
        // 头像预览（467）：直接读数据根字节解成内存 data URL（不再复制进库内明文目录）
        avatar: dataUrlOf(readAvatarInput(bundle.avatar)),
      });
    }
  } catch (e) {
    console.warn('[people] 数据源扫描失败:', e);
    dsNotice = '扫描失败：读不到数据文件夹或文件格式不对。';
  }
  dsScanning = false;
  dsHiddenGroups = hidden;
  if (overlay) {
    // 顺序不在这儿定：「有更新排最前」（拍板 Q4）与「已导入无新素材沉底」（issue 507）
    // 都在 dsRowStates 渲染前算——水位依赖 recordCache，扫描这一刻还看不到最新水位
    dsContacts = contacts;
    const names = new Set(dsContacts.map((c) => c.name));
    dsSelected = new Set([...dsSelected].filter((n) => names.has(n)));
    const now = new Date();
    dsScannedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    renderAlbum();
  }
}

/**
 * 导入进度行原位刷新（[data-people-ds-notice] 钩子；按需导出段逐联系人更新时
 * 不重建弹窗——节点不在（首帧未渲染）才走整渲染）。
 */
function updateImportNotice(text: string): void {
  dsNotice = text;
  const n = overlay?.querySelector<HTMLElement>('[data-people-ds-notice]');
  if (n) {
    n.textContent = text;
    return;
  }
  renderAlbum();
}

/** 导出的水位落账（485）：已完成导出的联系人标记「已导出 · 待入库」，未导入水位于行上露出 */
function markExported(names: string[], dataDir: string): void {
  for (const n of names) if (hasChatJson(dataDir, n)) dsExported.add(n);
}

/**
 * 导入所选（第一段：原始→聊天仓增量）：
 * ① 按需导出（485）：缺 chat.json 的勾选者先起一条 `bz-face export --contact …`
 *    拉全量消息（进度行显示当前联系人）；存量已有 chat.json 的直接用，不强制重导出。
 * ② 归一合并：逐人 readContactBundle → normalizeChatJson → mergeStore upsert（同键覆盖升级）
 *    → 写进该联系人的保库记录（467 / ADR-0194）。完成后弹窗出「画脸谱」（447 拍板：不自动生成）。
 * 画谱路径不重复导出：「画脸谱」只吃保库记录里的聊天仓素材（storeToUnified），不碰数据根。
 */
async function importDsSelected(): Promise<void> {
  const dataDir = dsDataDir();
  // 同步进行中不导入（issue 465）：数据根正在变，页脚按钮也置灰——这是双保险
  if (!overlay || !dataDir || dsImporting || dsScanning || jobsRunning() || isSyncing()) return;
  // 群聊能出现在 dsContacts = 设置已放开（runScan 按 peopleIncludeGroups 筛过），导入照单全收
  const chosen = (dsContacts ?? []).filter((c) => dsSelected.has(c.name));
  if (!chosen.length) { notice('还没有勾选联系人', 'warning'); return; }
  if (!isDesktop()) {
    dsNotice = '数据源导入仅桌面端支持（需要读取库外文件夹）。';
    renderAlbum();
    return;
  }
  dsImporting = true;
  dsGenerateable = false;
  dsNotice = '正在导入聊天仓…';
  renderAlbum();
  const opts = normalizeOptionsFromSettings();
  const now = new Date().toISOString();
  const addedOf = new Map<string, number>();
  const readFail: string[] = [];
  try {
    // ① 按需导出（485）：只对缺 chat.json 的勾选者起工具（一条命令带全部名单，工具侧逐人导出）
    const missing = chosen.filter((c) => !hasChatJson(dataDir, c.name)).map((c) => c.name);
    if (missing.length) {
      updateImportNotice('正在导出所选联系人的完整聊天…');
      const run = startContactsExport({ dataRoot: dataDir, contacts: missing }, (ev) => {
        updateImportNotice(`正在导出「${ev.name}」的完整聊天（${ev.idx}/${ev.total}）…`);
      });
      exportRun = run; // 面板关闭时中止（closePeoplePanel）
      const res = await run.done;
      exportRun = null;
      if (!overlay) return; // 面板已关，中止导入
      if (res.stopped) {
        markExported(missing, dataDir); // 已导出的那几位落「已导出 · 待入库」水位
        dsNotice = '导出已停止——已完成的部分保留，重新点「导入所选」可续';
        dsImporting = false;
        renderAlbum();
        return;
      }
      if (!res.ok) {
        markExported(missing, dataDir);
        dsNotice = `导出失败：${res.error}`;
        if (res.hint) notice(res.hint, 'warning');
        dsImporting = false;
        renderAlbum();
        return;
      }
      updateImportNotice('正在导入聊天仓…');
    }
    // ② 归一合并（存量 chat.json 直接用；导出轮写好的也在此读）。
    //    D 组拍板：逐人进度原位刷进导入通知行（i/total），多人并仓不再是黑箱。
    for (const [i, c] of chosen.entries()) {
      if (!overlay) return; // 面板已关，中止
      updateImportNotice(`正在并入「${c.displayName}」（${i + 1}/${chosen.length}）…`);
      const bundle = readContactBundle(dataDir, c.name);
      if (!bundle) { readFail.push(c.name); continue; }
      const norm = normalizeChatJson(bundle.raws, opts, { voice: bundle.voice, imageDesc: bundle.imageDesc });
      const existing = (await records()).get(c.name)?.store;
      const { contact, added } = mergeStore(existing, norm, now);
      // 头像（467）：字节直接进保库记录附件（渲染时解密成内存 data URL，不落明文文件）；
      // 外部头像已删 → 记录侧一并移除。路径字段退役，不再进密文记录。
      const avatar = readAvatarInput(bundle.avatar);
      delete contact.avatar;
      await peopleSafe!.write(c.name, (rec) => {
        rec.store = contact;
      }, { avatar });
      addedOf.set(c.name, added);
      dsExported.delete(c.name); // 进了库就不算「待入库」
      // 快照同步（水位行即时反映，不重扫）
      c.previewCount = contact.msgs.length;
      c.newCount = 0;
      c.newApprox = false;
      c.stats = contact.stats;
    }
  } catch (e) {
    console.warn('[people] 聊天仓导入失败:', e);
    dsNotice = '导入失败：读数据文件时出错。';
    dsImporting = false;
    renderAlbum();
    return;
  }
  dsImporting = false;
  // issue 492：导入写了保库记录——面板记录快照（recordCache）失效重读。写入虽经
  // peopleSafe 缓存原地 mutate（引用同源），但详情 / 画谱等后手路径一律走 records()，
  // 置空重读是兜底：快照与新写入永不脱钩（徐雯静实案：导入后同会话画谱读空仓）。
  recordCache = null;
  const fresh = [...addedOf.values()].reduce((s, n) => s + n, 0);
  const summary = `已导入（新增 ${fresh} 条）${readFail.length ? ` · ${readFail.length} 位读文件失败` : ''}`;
  // D 组拍板：数据源页不再有「画脸谱」钮——导完指去详情页动作列逐人补画
  dsNotice = fresh > 0 && !readFail.length ? `${summary}。到对应联系人的详情页点「画脸谱」生成。` : summary;
  dsGenerateable = fresh > 0 && !readFail.length;
  // 这一趟导进来的从勾选里摘掉（issue 507）：水位已经落到「无新素材」，留着勾选等于等着重复入账。
  // dsLastImported 仍记着这一趟的名单：合页时新照片飞回册页靠它点名。
  dsLastImported = chosen.map((c) => c.name);
  for (const c of chosen) dsSelected.delete(c.name);
  if (dsGenerateable) dsImported = true; // 合上这页时新照片飞进册页
  // 飞回要看得见（507 review ③，方案①）：新人若不在当前摊，先把册子拨到含新人的那摊再合页。
  // 位置必须按**导入后**的排序算（首导的新人旧 listCache 里根本没有；复导的也会跳到最前）——
  // 落库后重拉一次上墙人群；算不出（面板已关 / 读库翻车）就不拨，合页照常。
  if (dsGenerateable && overlay) {
    try {
      const people = await wallPeople();
      const at = pagination(people).sorted.findIndex((p) => dsLastImported.includes(p.id));
      if (at >= 0) {
        const pi = Math.floor(at / AL_PER_PAGE);
        if (pi !== cur && pi !== cur + 1) cur = pi - (pi % PER_SPREAD);
      }
    } catch { /* 位置算不出就不拨 */ }
  }
  // 导入完成即合上数据源这一页（issue 507）：新照片飞回册页，这一页留到下次要用再开
  // （横幅走「不打断手上动作」那档：导入是状态告知，不该像出错那样抢眼）
  showBanner(`${summary}——新照片飞回册页了`, true);
  closeDialog();
}

/**
 * 详情 / 卡面「画脸谱」（448 仅未生成时出；451 卡上印章的「画脸谱 / 补画」也走这里）：
 * 用聊天仓里该人物的消息素材单人生成，交引擎后台跑，进度走面板进度块。
 * 还没有预览素材时提示先走数据源导入。
 *
 * issue 453：**先看有没有可续任务**——中断 / 失败 / 暂停的人直接续跑，绝不走 startJobs。
 * 这是覆盖所有入口的那道闸（详情头按钮、印章的「画脸谱 / 补画」都从这里出去）：error 态下
 * `jobsBusy()` 为 false，过去会一路走到 startJobs 的整体替换 = 从第 1 批重烧 AI。
 * `force` 供「重新生成」用（消息集已变、断点接不上时，用户明确要求从头重画）。
 */
async function generateOne(id?: string, opts: { force?: boolean } = {}): Promise<void> {
  const name = id ?? detailId;
  if (!store || !name) return;
  if (isSyncing()) { notice('正在同步微信数据——同步完成后再画脸谱', 'info'); return; } // ADR-0196 决策 10
  if (!opts.force && resumeExisting(name)) return;
  if (jobsBusy()) { notice('已有生成在进行——等它完成或暂停后再画', 'info'); return; }
  let target: GenTarget | null = null;
  try {
    const pv = (await records()).get(name)?.store;
    const unified = storeToUnified(pv?.msgs ?? []);
    if (unified.length) {
      target = {
        talker: name,
        name,
        msgs: unified,
        kindCounts: pv?.kindCounts ?? {},
        skippedCount: 0,
        fileLabel: `数据源:${name}`,
        insights: pv?.insights,
        pending: pendingMediaCounts(pv?.msgs ?? []),
      };
    }
  } catch (e) {
    console.warn('[people] 读取聊天仓失败:', e);
  }
  if (!target) { notice('还没有可画的消息素材——点右上「数据源」导入后再画', 'warning'); return; }
  await startGeneration([target]);
}

/**
 * 该人有未完成任务（非 running / 非 done）就直接续跑，返回是否接手（issue 453）。
 * `resume` 不受理 = 漂移判废（消息集已变，断点接不上）——**不偷偷重烧**：
 * 明确告知，要重来由用户点印章上的「重新生成」（那条路带 force）。
 */
function resumeExisting(name: string): boolean {
  const pending = (jobsCache?.queue ?? []).find((j) => j.talker === name);
  if (!pending || pending.status === 'running' || pending.status === 'done') return false;
  if (jobs().resume(name)) {
    notice(`「${name}」从第 ${pending.batchesDone + 1} 批继续——已完成的 ${pending.batchesDone} 批不重画`, 'info');
    return true;
  }
  notice(`「${name}」的消息集已变，断点接不上——点印章上的「重新生成」会从头重画`, 'warning');
  return true;
}

// ---------------- 生成引擎接线（issue 450：引擎化 + 后台化 + 断点续跑） ----------------

/** 待办媒体（issue 514 口径）：未描述图片 / 未转写语音——开工单只报本次真实工作量 */
export interface PendingMedia {
  images: number;
  voices: number;
}

/** 生成目标（引擎 JobTarget 同形；msgs 必须是全量时间线消息——引擎断点续跑要重读校验指纹） */
export interface GenTarget {
  talker: string;
  name: string;
  msgs: UnifiedMessage[];
  /** 全形态计数（数据源路径 = chat.json 全量口径，见 datasource） */
  kindCounts: Record<string, number>;
  /** 被过滤的非文本 / 空消息条数（导入记录 skippedCount 口径，评审 P2-2） */
  skippedCount: number;
  /** 导入记录的 file 标注 */
  fileLabel: string;
  /** 聊天仓侧写里的互动统计汇总（issue 449；旧数据可能没有）→ 引擎拼互动统计叙述段喂画像与时间线 */
  insights?: StoreContact['insights'];
  /** 手动档案（issue 455）：planTargets 从人物卡带上 → 引擎拼「档案」素材段进两卷 prompt 头 */
  profile?: PersonProfile;
  /** 跨导入合并的月度密度（issue 455）：planTargets 从导入记录 stats 现算 → buildStatsNote 月度段 */
  monthly?: Array<[string, number]>;
  /** 提炼模式（issue 513）：planTargets 判定后带出 → 开工单逐人提示；full 缺省不标 */
  mode?: 'full' | 'newer' | 'older';
  /** 本次计划提炼集条数（issue 514：planTargets 从 plan.msgs 带出——newer = 新增集，其余 = 全量） */
  planCount?: number;
  /** 待办媒体（issue 514）：未描述图片 / 未转写语音——开工单只报本次真实工作量 */
  pending?: PendingMedia;
}

/**
 * 跨导入月度密度合并（issue 455）：各导入记录 stats.monthly 同名月相加，按月升序；
 * 没有任何明细（旧数据 / 合成占位卡）返回 undefined——引擎侧不拼月度段。
 */
export function mergedMonthlyOf(imports: Array<{ stats?: Partial<ContactStats> }>): Array<[string, number]> | undefined {
  const acc = new Map<string, number>();
  for (const r of imports) {
    for (const [month, n] of r.stats?.monthly ?? []) acc.set(month, (acc.get(month) ?? 0) + n);
  }
  if (!acc.size) return undefined;
  return [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * 生成引擎（jobs.ts）的 ui 消费面——模块本体天然满足；测试经 setJobsModuleForTests 注入假件
 * （测试域避免 vi.mock，与 obsidian alias 同一思路：注入缝比模块 mock 稳）。
 */
export interface JobsApi {
  startJobs(app: unknown, targets: JobTarget[], opts?: JobStartOptions): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }>;
  /** 从保库记录的 job 段重建队列；崩溃遗留 running → interrupted（本会话只调一次） */
  resumeJobs(app: unknown, ai?: JobResumeOptions): Promise<void>;
  /** 从断点继续指定人物（已完成批次不重烧） */
  resume(talker: string): boolean;
  /** 当前批完成后暂停 */
  pauseJobs(): void;
  /** 删除任务（error 态「删除任务」；运行中的也删） */
  removeJob(talker: string): boolean;
  /** 重试 prep 失败项（469：清工具段断点账本重跑，工具幂等只补失败项；可选——旧假件没有） */
  retryPrepFailures?(talker: string): boolean;
  /** 进度快照推送（启动即推一次当前态），返回退订函数 */
  subscribe(fn: (s: EngineSnapshot) => void): () => void;
  snapshot(): EngineSnapshot;
}

let jobsOverride: JobsApi | null = null;

/** 引擎入口（生产 = jobs.ts 模块；测试 = 注入假件） */
function jobs(): JobsApi {
  return jobsOverride ?? (jobsApi as unknown as JobsApi);
}

/** 测试注入缝：假引擎替换 jobs 模块（传 null 还原模块本体；一并清订阅 / 缓存 / 幂等标记） */
export function setJobsModuleForTests(mod: JobsApi | null): void {
  if (jobsUnsub) { jobsUnsub(); jobsUnsub = null; }
  jobsOverride = mod;
  jobsCache = null;
  jobsBooted = false;
  lastJobsBusy = false; // 忙闲沿一并复位：上个用例收在忙态，下个用例首帧不再多放一次无谓重画
  targetsInFlight.clear();
  jobsPersisted.clear();
}

/** 画谱锁的忙闲上次态（507 二审）：翻转那一下整渲染——锁挂在全量重画后，帧间只刷便签的话解不开 */
let lastJobsBusy = false;

/** 快照进场（订阅回调 / 打开面板恢复共用）：done 落盘 → 渲染进度块 */
function applySnapshot(s: EngineSnapshot | null): void {
  const hadNote = Boolean(jobsCache?.queue.length);
  jobsCache = s;
  // 便签「落下来贴上」只放这一下（issue 507）：队列从空到有的那一次——505 之后这枚标志没人置位
  if (!hadNote && s?.queue.length) animNote = true;
  if (s) handleJobsSnapshot(s);
  else renderNote();
  // 忙闲翻转（507 二审）：起跑 / 收工 / 中断 / 便签上删任务的当下把册子重画一遍——
  // 「画脸谱」的锁是全量重画时挂的，平时快照只走 renderNote，任务翻脸了别人的按钮会灰到下一次交互
  const busy = jobsBusy();
  if (busy !== lastJobsBusy) {
    lastJobsBusy = busy;
    if (overlay) void renderAlbum();
  }
}

/**
 * 面板打开时恢复任务态（openPeoplePanel 调）：先从保库记录的 job 段重建引擎队列
 * （崩溃遗留 running → interrupted，出「继续生成」），再订阅快照渲染。
 */
async function restoreJobsView(): Promise<void> {
  if (!overlay) return;
  await ensureJobsBoot();
  await ensureJobsWatch();
}

/** 引擎启动扫描（每会话一次；resumeJobs 会整体重建内存队列，不能在运行中重放）。
 *  上锁期不落 boot 旗标（任务队列在保库记录里读不到——等解锁后重试，防空引擎占位） */
async function ensureJobsBoot(): Promise<void> {
  if (jobsBooted) return;
  const safe = peopleSafe ?? (await getPeopleSafeStore());
  if (!safe.unlocked) return;
  jobsBooted = true;
  // 497：续跑的任务在入队时已过总确认——两道门自动放行，不再打断
  await jobs().resumeJobs(getApp(), { askDescribeConfirm: autoApproveDescribe, askPortraitConfirm: autoApprovePortrait });
}

/** 订阅引擎快照（整个会话只订一次；关面板不退订——引擎推送照收，重开面板即时恢复） */
async function ensureJobsWatch(): Promise<void> {
  if (!jobsUnsub) jobsUnsub = jobs().subscribe((s) => applySnapshot(s));
  applySnapshot(jobs().snapshot());
}

/** 快照处理：done 任务落保库记录（每任务恰好一次）+ 进度块原位刷新 */
function handleJobsSnapshot(s: EngineSnapshot): void {
  for (const job of s.queue) {
    if (job.status !== 'done') continue;
    const target = targetsInFlight.get(job.talker);
    if (target) {
      targetsInFlight.delete(job.talker); // 先摘再落盘：快照重复推送不会重复写导入记录
      jobsPersisted.add(job.talker); // 引擎保留的 done 任务再推快照也不重落
      void persistJobDone(job, target);
    } else if (!jobsPersisted.has(job.talker) && job.person) {
      // 重启续跑完成的任务：入参走 job.importRecord / job.stats（引擎落盘口径）
      jobsPersisted.add(job.talker);
      void persistJobDone(job);
    }
  }
  renderNote();
}

/**
 * 生成入口（数据源弹窗 / 详情「画脸谱」共用）：
 * 1) 本地预筛——同一导出再导（指纹命中）不进引擎不烧 AI（441 语义原样保留，顺带应用改名
 *    与旧记录 stats 补齐）；补录 / 增量的提示条数沿用原口径；
 * 2) **总确认一次**（497，用户拍板）：起跑前弹一次总览（逐人素材 / 图片 / 语音、服务商模型
 *    与约调用数），确认后两道引擎门自动放行，中途不再弹任何窗，一直到完成；
 * 3) targets 交 startJobs（引擎内部切批 / 逐批采集 / 画像 / 时间线，每批原子落盘）；
 * 4) 订阅快照渲染进度块——独立于面板生命周期，关面板照跑。
 */
export async function startGeneration(targets: GenTarget[]): Promise<void> {
  const { runnable, skipped } = await planTargets(targets);
  if (!runnable.length) {
    // issue 523：没有新素材也翻开工单——把「没有新素材」说清楚，「开始生成」置灰（用户拍板）。
    // 旧行为是直接弹一条通知返回，用户看不到为什么点了没反应、按钮也照旧可点。
    await askGenerationConfirm(buildGenerationConfirmInfo([], skipped));
    return;
  }
  const answer = await askGenerationConfirm(buildGenerationConfirmInfo(runnable));
  if (answer !== 'start') {
    notice('已取消，本次不生成', 'info');
    return;
  }
  for (const t of runnable) {
    targetsInFlight.set(t.talker, t);
    jobsPersisted.delete(t.talker); // 同人重新生成：上一次的落盘幂等标记不复用
  }
  let engineSkipped = 0;
  let resumed: string[] = [];
  // 497：总确认已在上面完成——引擎两道门注入自动放行，起跑后一路到底
  const res = await jobs().startJobs(getApp(), runnable, {
    askDescribeConfirm: autoApproveDescribe,
    askPortraitConfirm: autoApprovePortrait,
  }); // mode 缺省 auto：引擎逐人按增量计划判定
  engineSkipped = res.skipped.length;
  resumed = res.resumed ?? [];
  await ensureJobsWatch();
  const started = runnable.length - engineSkipped;
  const fresh = Math.max(0, started - resumed.length);
  const parts: string[] = [];
  if (fresh > 0) parts.push(`已开始生成 ${fresh} 张脸谱（后台进行，可关面板）`);
  if (resumed.length) parts.push(`${resumed.join('、')} 接着上次没画完的批次继续（已完成的不重烧）`);
  if (skipped.length + engineSkipped > 0) parts.push(`${skipped.length + engineSkipped} 位没有新消息、无需重画`);
  if (parts.length) notice(parts.join('，'), 'success');
  renderNote();
}

/**
 * 总确认 → 引擎起跑的入参（497；523 精简）：只报三类素材条数与逐人明细。
 * runnable 为空 = 全部联系人都没有新素材 → `empty` 为真，开工单只出说明、开始生成置灰。
 */
function buildGenerationConfirmInfo(runnable: GenTarget[], skipped: string[] = []): GenerationConfirmInfo {
  const items = runnable.map((t) => {
    // issue 514 待办口径：图片 / 语音只报没做过的（构造时从仓消息现算）；newer 的素材 = 新增集条数
    const pending = t.pending ?? { images: 0, voices: 0 };
    const materials = t.mode === 'newer' ? (t.planCount ?? t.msgs.length) : t.msgs.length;
    return { name: t.name, materials, images: pending.images, voices: pending.voices, ...(t.mode && t.mode !== 'full' ? { mode: t.mode } : {}) };
  });
  return {
    items,
    materials: items.reduce((s, it) => s + it.materials, 0),
    images: items.reduce((s, it) => s + it.images, 0),
    voices: items.reduce((s, it) => s + it.voices, 0),
    empty: items.length === 0,
    ...(skipped.length ? { skipped } : {}),
  };
}

/**
 * 「这批候选其实一条新的都没有」判定（issue 523，ADR-0226 的同批补偿）：
 * `planIncremental` 的同秒容差认「ts ≥ 锚点」的候选（评审 P2-1b，秒级导出不丢同秒消息），
 * 但候选若**全都停在锚点那一秒之内**，它们就是上次已经处理过的那一批——锚点本来就是
 * 「上次处理到的末条」，落在锚点里的消息不可能还没处理过。指纹之所以对不上，是因为 523 之前
 * 的版本把导入记录条数记成了「本次提炼子集条数」（增量只跑 1 条就记 1，ADR-0226），
 * 不是真有新素材。这层把它判成「没有新素材」：不再白烧一遍采集批 + 双卷（ADR-0225 决策 3 同一精神）。
 * 只要候选里有**任何一条严格晚于锚点**（真新消息），照常进引擎。
 */
function onlyWatermarkMsgs(plan: IncrementalPlan, existing: PersonEntry | undefined, pending?: PendingMedia): boolean {
  const anchor = existing?.lastProcessedTs;
  if (plan.mode !== 'newer' || !anchor || !plan.msgs.length) return false;
  // 有待办媒体（未描述图片 / 未转写语音）就不判「无新素材」：这些素材在仓里 text 还是空的，
  // 所以不进文本时间线、也就进不了上面这份候选——但它们是真素材。旧版记错条数时这些人本来
  // 会照跑一趟、顺手把图描述掉；这层闸只该拦「真的什么都没有」的人，不该比改前拦得更宽。
  if ((pending?.images ?? 0) + (pending?.voices ?? 0) > 0) return false;
  return plan.msgs.every((m) => m.ts <= anchor);
}

/**
 * 本地预筛（441 planIncremental 语义保留在 ui 层）：skip 不进引擎；补录 / 增量的提示沿用原口径。
 * 模式与旧画像的解析归引擎（startJobs opts / 增量所需 old digest 由引擎内部处理）。
 */
async function planTargets(targets: GenTarget[]): Promise<{ runnable: GenTarget[]; skipped: string[] }> {
  const store = new PeopleStore(getApp());
  const people = await store.list();
  const runnable: GenTarget[] = [];
  const skipped: string[] = [];
  for (const t of targets) {
    const existing = people.find((p) => p.id === t.talker);
    const plan = planIncremental(t.msgs, existing);
    if (plan.mode === 'skip' || onlyWatermarkMsgs(plan, existing, t.pending)) {
      // skip 只可能发生在已有导入的人物上；顺带应用改名，并给 440 之前的旧数据补一份
      // 互动统计到最近一条导入记录（没有记录则不动）
      if (existing) {
        let imports = existing.imports;
        if (imports.length && !imports.some((r) => r.stats)) {
          imports = [...imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
          imports[0] = { ...imports[0], stats: computeStats(t.msgs, t.kindCounts) };
          await store.upsert({ ...existing, name: t.name, imports });
        } else {
          await store.upsert({ ...existing, name: t.name });
        }
      }
      skipped.push(t.name);
      continue;
    }
    if (plan.mode === 'older') {
      notice(`「${t.name}」这批 ${plan.msgs.length} 条消息早于上次提炼点，将作为补充素材提炼`);
    } else if (plan.olderCount > 0) {
      notice(`「${t.name}」另有 ${plan.olderCount} 条消息早于上次提炼点，本次不重复提炼`);
    }
    // issue 455：档案与跨导入月度密度在这里带上（statsNote 组装在引擎内，入参经 JobTarget 传入）
    // issue 513：提炼模式带出 → 开工单逐人提示（older = 补录合并重画）
    runnable.push({ ...t, mode: plan.mode, planCount: plan.msgs.length, profile: existing?.profile, monthly: mergedMonthlyOf(existing?.imports ?? []) });
  }
  return { runnable, skipped };
}

/**
 * done 落盘（沿用 446 收编形态的 PeopleStore / ImportRecord 口径）：
 * 会话内任务用 targetsInFlight 里的原始入参（时间跨度 / 统计 / 锚点全量可算）；
 * 重启续跑完成的任务走引擎落盘的 importRecord / stats（批元数据口径，不含原文）。
 * 成功后把 done 任务从引擎队列清掉（产物已安全入保库记录，进度块不再挂旧账）。
 */
async function persistJobDone(job: JobView, target?: GenTarget): Promise<void> {
  const talker = target?.talker ?? job.talker;
  const name = target?.name ?? job.name;
  try {
    // issue 455 双卷：卷一《其人》为必达产物（旧落盘 portrait 已由引擎 resumeJobs 读入时映射成 person）
    const person = job.person;
    if (!person) {
      // 「done 且无产物」只有一个来源：描述段报「有欠账、零可读」后提前收尾（ADR-0225 决策 3）。
      // 只说清楚 + 把任务清出队列（不清 = 进度块挂着一条永远不动的 done），不写导入记录 / 不动
      // 锚点：本次确实什么都没提炼，下次补画照旧从同一水位续。
      if (job.describe?.unreadable) {
        notice(`「${name}」${job.message ?? '本次没有可提炼的内容'}`, 'warning');
        jobs().removeJob(talker);
        if (overlay) void renderAlbum();
        return;
      }
      notice(`「${name}」生成完成但其人画像为空`, 'warning');
      return;
    }
    const store = new PeopleStore(getApp());
    const existing = (await store.list()).find((p) => p.id === talker);
    const now = new Date().toISOString();
    const msgs = target?.msgs;
    const rec: ImportRecord = {
      file: target?.fileLabel ?? job.importRecord?.fileLabel ?? job.fileLabel ?? `数据源:${talker}`,
      importedAt: now,
      // messageCount 是「这一份导出的可消费消息条数」——与 timeFrom / timeTo 同口径（同取 msgs），
      // 也与导入路径（ui 层 importMsgs：msgs.length）一致。它有两个消费者：界面的「消息总数」，
      // 以及 incremental.planIncremental 里「同一导出再导」的整份指纹（条数 + 跨度）。
      // 旧写法优先取 job.importRecord.messageCount（= 本次提炼子集条数，如新增 1 条就是 1），
      // 指纹因此永不命中 → 每次再导都判成 newer → 开工单反复报「新增素材 N 条」（issue 523）。
      messageCount: msgs ? msgs.length : (job.importRecord?.messageCount ?? 0),
      skippedCount: target?.skippedCount ?? job.importRecord?.skippedCount ?? 0,
      timeFrom: msgs ? new Date(msgs[0].ts).toISOString() : job.importRecord?.timeFrom ?? now,
      timeTo: msgs ? new Date(msgs[msgs.length - 1].ts).toISOString() : job.importRecord?.timeTo ?? now,
      stats: target ? computeStats(msgs!, target.kindCounts) : job.stats,
    };
    const entry: PersonEntry = existing ? { ...existing, name } : { id: talker, name, createdAt: now, imports: [] };
    // issue 487：画谱完成的档案自动回填——AI 只填空白字段（fillProfile），手填值原样保留；
    // 归一后一个字段都没有则不动档案
    if (job.aiProfile) {
      const mergedProfile = fillProfile(existing?.profile, job.aiProfile);
      if (Object.keys(mergedProfile).length) entry.profile = mergedProfile;
    }
    await store.upsert(entry);
    await store.appendImport(talker, rec);
    const digest: FaceDigest = {
      person, // 卷一《其人》
      bond: job.bond || undefined, // 卷二《相交》（旧引擎无此产物）
      events: mergeManualEvents(job.events ?? [], existing?.manualEvents), // 439：手动随手记并入事件素材
      quotes: job.quotes,
      moments: job.material?.moments, // 449：场景 / 特质随生成落盘
      traits: job.material?.traits,
      chronicle: job.chronicle || undefined,
      ...(job.revisedFrom ? { revisedFrom: job.revisedFrom } : {}), // issue 517：修订前旧卷留档
      generatedAt: now,
    };
    await store.setDigest(talker, digest);
    // 锚点写回：已提炼过的最大消息时间戳（计划内末条；重启续跑的任务用引擎落盘的导入跨度末点——
    // 466 起指纹是内容哈希、解不出 ts——缺了不动锚点）
    const lastTs = msgs ? msgs[msgs.length - 1].ts : Date.parse(job.importRecord?.timeTo ?? '');
    if (Number.isFinite(lastTs)) {
      await store.setLastProcessedTs(talker, Math.max(existing?.lastProcessedTs ?? 0, lastTs));
    }
    notice(`「${name}」的脸谱已生成`, 'success');
    // 敏感标注是终态、不会重跑（ADR-0224）：不说一句用户会以为图漏了；说了还得告诉他去哪儿撤
    const sens = job.describe?.sensitive ?? 0;
    if (sens > 0) {
      notice(`其中 ${sens} 张图片被判敏感已跳过描述——图片页签里可以解除标注并重试`, 'warning');
    }
    jobs().removeJob(talker); // 产物已入保库记录：done 任务清出队列，进度块自然收起
    if (overlay) {
      animDev = talker; // 刚画完那位：照片从灰里洗出颜色（issue 507：505 之后这枚标志没人置位）
      void renderAlbum(); // 封面墙 / 详情立即可见新脸谱
    }
  } catch (e) {
    if (target) targetsInFlight.set(talker, target); // 落盘失败放回：下个快照重试
    notifyActionError(e, `写入「${name}」的脸谱`);
  }
}

// ---------------- 进度块渲染与动作（render.progressBlock 的 ui 侧） ----------------

/** 当前展示的任务：running > paused/interrupted > error > done（同档取队列靠前） */
function currentJobsItem(): JobView | null {
  const queue = jobsCache?.queue ?? [];
  if (!queue.length) return null;
  const rank: Record<JobsUiStatus, number> = { running: 0, paused: 1, interrupted: 1, error: 2, done: 3 };
  return [...queue]
    .map((job, i) => ({ job, i }))
    .sort((a, b) => rank[a.job.status] - rank[b.job.status] || a.i - b.i)[0].job;
}

/** 引擎任务 → 进度块视图（百分比口径见 render.jobsPercent；派生字段缺省自算兜底） */
function toBlockState(job: JobView): JobsBlockState {
  const queue = jobsCache?.queue ?? [];
  const pos = queue.findIndex((j) => j.talker === job.talker);
  return {
    talker: job.talker,
    name: job.name || job.talker,
    status: job.status,
    message: job.message ?? '',
    stage: job.stage,
    batchesDone: job.batchesDone ?? 0,
    batchesTotal: job.batchesTotal ?? job.chunks?.length ?? 0,
    stagesDone: jobsStagesDone(job.stage, job.status),
    queueIndex: job.queueIndex ?? pos + 1,
    queueTotal: job.queueTotal ?? queue.length,
    errorText: job.error,
    resumable: isResumable(job),
    // 工具段进度（469）：阶段行 / 折算总进度只在 preprocess 阶段上屏（AI 段回落批口径）；
    // 失败计账保留到任务终局（非 running 态出「重试失败项」）
    prep: job.prep
      ? {
          stageText: job.stage === 'preprocess' ? prepStageLine(job.prep) : null,
          overall: prepOverallPct(job.prep),
          failed: job.prep.failed ?? 0,
        }
      : undefined,
    // 图片描述段进度（470）：阶段行 / 折算总进度只在 describe 阶段上屏（批口径）
    describe:
      job.describe && job.stage === 'describe'
        ? {
            stageText: describeStageLine(job.describe.doneBatches, job.describe.totalBatches),
            overall: describeOverallPct(job.describe.doneBatches, job.describe.totalBatches),
          }
        : undefined,
  };
}

/** 失败态能否断点续跑（issue 453）：漂移判废（消息集已变）接不上——印章与进度块共用同一判定 */
function isResumable(job: JobView): boolean {
  return job.error !== jobsApi.DRIFT_ERROR;
}

/** 有无活跃任务（运行中 / 排队或已暂停）：数据源导入类守卫用它（导入会动聊天仓 → 指纹漂移判废） */
function jobsBusy(): boolean {
  return (jobsCache?.queue ?? []).some((j) => j.status === 'running' || j.status === 'paused');
}

/** 是否有正在跑的任务（关面板转后台提示用；仅剩暂停 / 排队时关面板不打扰） */
function jobsRunning(): boolean {
  return (jobsCache?.queue ?? []).some((j) => j.status === 'running');
}

// ---------------- 画谱总确认（issue 497 / 505：确认是册子里的一页） ----------------

/** 引擎两道门的自动放行件（497）：授权已在总确认一次拿齐，起跑后一路到底不再打断 */
const autoApproveDescribe = (): Promise<'start' | 'skip'> => Promise.resolve('start');
const autoApprovePortrait = (): Promise<'start' | 'cancel'> => Promise.resolve('start');

/** 总确认页开着标记（防叠页；Esc 与「取消」都归「取消」——那是唯一不花钱的路） */
let genConfirmOpen = false;
/** 当前待确认的开工单（画谱确认页的入参） */
let pendingGenInfo: GenerationConfirmInfo | null = null;
/** 确认页的答复（页上点「开始生成 / 取消」时结算） */
let pendingGenAnswer: ((a: 'start' | 'cancel') => void) | null = null;

/**
 * 画谱总确认（startGeneration 起引擎前唯一一次询问）：翻开开工单那一页，报清本次要走流程的
 * 聊天记录 / 图片 / 录音条数与逐人明细（issue 523 精简：不再报 AI 通道与调用次数）。
 * 解析值：开始生成 / 取消。无新素材的那一页「开始生成」是置灰的——真被点到也按取消结（不空转）。
 */
function askGenerationConfirm(info: GenerationConfirmInfo): Promise<'start' | 'cancel'> {
  if (genConfirmOpen) return Promise.resolve('cancel'); // 已有页开着：不叠页，按未授权处理
  genConfirmOpen = true;
  pendingGenInfo = info;
  dialog = { kind: 'gen' };
  void renderAlbum();
  return new Promise((resolve) => { pendingGenAnswer = resolve; });
}

function answerGenConfirm(answer: 'start' | 'cancel'): void {
  const done = pendingGenAnswer;
  // 无新素材的开工单没有可跑的东西：置灰钮在真实浏览器点不动，这里兜一道——
  // 真收到 start（合成点击 / 测试派发）也按取消结，绝不返回一个空转的「开始」
  const final: 'start' | 'cancel' = answer === 'start' && pendingGenInfo?.empty ? 'cancel' : answer;
  pendingGenAnswer = null;
  pendingGenInfo = null;
  genConfirmOpen = false;
  dialog = null;
  void renderAlbum();
  done?.(final);
}

/**
 * 便签动作派发（talker 从便签根 data 钩子读）。
 * 502 续：运行中不再出「暂停」钮（画谱是一段想看完的连续过程），故本派发器无 pause 分支。
 */
function jobsAction(kind: 'resume' | 'dismiss' | 'prep-retry' | 'cancel'): void {
  const api = jobs();
  const talker = overlay?.querySelector<HTMLElement>('[data-people-jobs]')?.getAttribute('data-people-jobs-talker') ?? '';
  if (kind === 'cancel') {
    // issue 517：中断 / 暂停 / 报错任务的「取消」——删任务（AI 作废不落盘，prep 断点清），
    // 详情头失去可续任务后自动回到「补画脸谱」。D 组拍板：删前过一道流程框确认——
    // 断点丢了对长任务是一笔看得见的钱（已完成批次全部作废），不兴一键直通。
    const who = talker || currentJobsItem()?.talker || '';
    if (!who) return;
    const job = (jobsCache?.queue ?? []).find((j) => j.talker === who);
    const doneBatches = job?.batchesDone ?? 0;
    const label = job?.name || who;
    void openFlowDialog({
      title: '取消这次画脸谱',
      message: `「${label}」已完成的批次断点将一并丢弃${doneBatches > 0 ? `（已完成 ${doneBatches} 批）` : ''}，之后要画得从头再来。`,
      actions: [
        { label: '继续画', value: 'cancel' },
        { label: '取消任务', value: 'ok', danger: true },
      ],
    }).then((v) => {
      if (v !== 'ok') return;
      if (api.removeJob(who)) notice('已取消这次画脸谱——详情页可重新补画', 'delete');
      renderNote();
      void renderAlbum();
    });
    return;
  }
  if (kind === 'prep-retry') {
    const who = talker || currentJobsItem()?.talker || '';
    if (!who) return;
    if (api.retryPrepFailures?.(who)) notice('重试失败项——已完成的产物与批次不重跑', 'info');
    return;
  }
  if (kind === 'resume') {
    if (isSyncing()) { notice('正在同步微信数据——同步完成后再继续生成', 'info'); return; } // ADR-0196 决策 10
    const who = talker || currentJobsItem()?.talker || '';
    if (!who) return;
    api.resume(who);
    notice('继续生成——已完成的批次不重画', 'info');
    return;
  }
  if (talker && api.removeJob(talker)) {
    notice('已删除该任务', 'delete');
    renderNote();
  }
}

// ---------------- 折子印章四态接线（issue 451） ----------------

/** 引擎队列按 talker 索引（同人至多一个任务——引擎排队即替换） */
function jobViews(): Map<string, JobView> {
  const m = new Map<string, JobView>();
  for (const j of jobsCache?.queue ?? []) m.set(j.talker, j);
  return m;
}

/** 引擎任务 → 印章任务视图（百分比与进度块同源：render.jobsPercent / jobsStagesDone） */
function sealJobOf(job: JobView | undefined): FoldCardJob | null {
  if (!job) return null;
  return {
    status: job.status,
    batchesDone: job.batchesDone ?? 0,
    batchesTotal: job.batchesTotal ?? job.chunks?.length ?? 0,
    stagesDone: jobsStagesDone(job.stage, job.status),
    // 漂移类失败（消息集已变）接不上——印章改出「重新生成」
    resumable: isResumable(job),
    // 工具段总进度（469）：preprocess 阶段印章百分比按它算（AI 段回落批口径）
    prepPct: job.prep && job.stage === 'preprocess' ? prepOverallPct(job.prep) : undefined,
    // 图片描述段总进度（470）：describe 阶段印章百分比按它算
    describePct:
      job.describe && job.stage === 'describe'
        ? describeOverallPct(job.describe.doneBatches, job.describe.totalBatches)
        : undefined,
  };
}

// ---------------- 照片角上的印 / 头像原位刷新（issue 451 / 505） ----------------

/** 照片角上的印原位刷新（快照每帧都来；重画整册会打断抽照片 / 翻页动画，只换印节点） */
function syncPhotoSeals(): void {
  if (!overlay) return;
  const map = jobViews();
  const byId = new Map(listCache.map((p) => [p.id, p]));
  for (const cell of Array.from(overlay.querySelectorAll<HTMLElement>('[data-people-pocket]'))) {
    const p = byId.get(cell.dataset.peoplePocket ?? '');
    if (!p) continue;
    const next = albumSealNode(p, sealJobOf(map.get(p.id)));
    const old = cell.querySelector('.bz-people-seal');
    if (old) { if (next) old.replaceWith(next); else old.remove(); }
    else if (next) cell.querySelector('.bz-people-print')?.appendChild(next);
  }
  applySyncLockdown(); // 印章换新后保持同步置灰态（issue 465 / ADR-0196 决策 10）
}

// ---------------- 详情页一眼账 ----------------

/** 详情页那几张小纸片的数：谁先开口 / 最热的一月 / 素材水位（没有的项不贴那一片） */
function detailFactsOf(p: PersonEntry): DetailOpts['facts'] {
  const latest = [...p.imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  const s = latest?.stats;
  const media = personMedia(p);
  const images = media?.imageCount ?? 0;
  const voices = media?.voiceCount ?? 0;
  if (!s?.monthly?.length && !images && !voices) return null;
  const byMe = s?.initiatedByMe ?? 0;
  const byOther = s?.initiatedByOther ?? 0;
  const initiated = byMe + byOther;
  let month: [string, number] | null = null;
  for (const m of s?.monthly ?? []) if (!month || m[1] > month[1]) month = m;
  return {
    mePct: initiated ? Math.round((byMe / initiated) * 100) : 50,
    month,
    images,
    voices,
  };
}

/**
 * 印章动作派发（451 四态的下一步）：暂停 / 继续生成 / 画脸谱·补画·重新生成。
 * draw 与 redraw 同一实现——都走聊天仓素材单人生成，引擎 auto 判全量 / 增量 / 跳过。
 * 只认这四个 kind（不设兜底分支：认不出的 hook 不该顺手烧一次 AI）。
 */
async function sealAction(kind: string, id: string): Promise<void> {
  const api = jobs();
  // 同步运行中印章全灰（applySyncLockdown）——这里拦程序路径（ADR-0196 决策 10）
  if (isSyncing()) { notice('正在同步微信数据——同步完成后再操作脸谱', 'info'); return; }
  if (kind === 'pause') {
    api.pauseJobs();
    notice('这一批做完就暂停', 'info');
    return;
  }
  if (kind === 'resume') {
    const pending = (jobsCache?.queue ?? []).find((j) => j.talker === id);
    if (!api.resume(id)) { notice('这个任务接不上了，请点「重新生成」', 'info'); return; }
    notice(pending
      ? `「${id}」从第 ${pending.batchesDone + 1} 批继续——已完成的 ${pending.batchesDone} 批不重画`
      : '继续生成——已完成的批次不重画', 'info');
    return;
  }
  // draw（未画谱）/ redraw（补画 · 重新生成）都走 generateOne：它内部先认可续任务；
  // redraw 带 force 才能越过那道闸——漂移判废时用户要的正是从头重画（印章文案也这么说）
  if (kind === 'draw') await generateOne(id);
  else if (kind === 'redraw') await generateOne(id, { force: true });
}

// ---------------- 事件委托（issue 505：册子单页的钩子全集） ----------------

function onOverlayClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (e.target === overlay) { closePeoplePanel(); return; }
  // 反光：点照片那一下也把反光带到那张
  // —— 册子：抽照片 / 翻摊 / 合上（先于其它分支，照片在整个册面上） ——
  const pocket = t.closest<HTMLElement>('[data-people-pocket]');
  if (pocket) {
    if (mergeFromId) {
      const id = pocket.dataset.peoplePocket ?? '';
      if (id && id !== mergeFromId) { mergeToId = id; void renderAlbum(); }
      return;
    }
    // 印是照片格的子节点，须先于抽照片判定：画谱中那枚点一下 = 本批做完后暂停
    const seal = t.closest<HTMLElement>('[data-people-seal-act]');
    if (seal) {
      const id = pocket.dataset.peoplePocket ?? '';
      if (id) void sealAction(seal.dataset.peopleSealAct ?? '', id);
      return;
    }
    const id = pocket.dataset.peoplePocket ?? '';
    if (id) pullPhoto(id);
    return;
  }
  const turn = t.closest<HTMLElement>('[data-people-turn]');
  if (turn) { turnTo(turn.dataset.peopleTurn === 'prev' ? 'prev' : 'next'); return; }
  // —— 生成进度便签动作（450：继续 / 删除任务；469 加重试失败项） ——
  if (t.closest('[data-people-jobs-resume]')) { jobsAction('resume'); return; }
  if (t.closest('[data-people-jobs-prep-retry]')) { jobsAction('prep-retry'); return; }
  if (t.closest('[data-people-jobs-dismiss]')) { jobsAction('dismiss'); return; }
  if (t.closest('[data-people-jobs-cancel]')) { jobsAction('cancel'); return; }
  // —— 小签 / 弹窗（数据源 / 找一找 / 统计 / 档案 / 记一笔 / 删除 / 开工单） ——
  const dlg = t.closest<HTMLElement>('[data-people-dialog]');
  if (dlg) { void openDialogByHook(dlg.dataset.peopleDialog ?? ''); return; }
  if (t.closest('[data-people-close]')) { guardProfLeave(closeDialog); return; }
  if (t.closest('[data-people-banner-close]')) { banner = null; renderBanner(); return; }
  // —— 聊天页（issue 529）：往上放更早的一页 / 回到最新 ——
  if (t.closest('[data-people-chat-more]')) { growChat(); return; }
  if (t.closest('[data-people-chat-bottom]')) { chatScrollBottom = true; chatAnchorBottom = null; void renderAlbum(); return; }
  // —— 数据源册页 ——
  if (t.closest('[data-people-ds-sync]')) { handleSyncClick(); return; }
  if (t.closest('[data-people-ds-sync-stop]')) { stopSync(); return; }
  if (t.closest('[data-people-ds-pickfresh]')) { pickFresh(); return; }
  // 过滤清空（D 组）：恢复全列表并把焦点交回输入框
  if (t.closest('[data-people-ds-filter-clear]')) { dsFilter = ''; void renderAlbum().then(() => focusDsFilter()); return; }
  if (t.closest('[data-people-ds-import]')) { void importDsSelected(); return; }
  const dsRow = t.closest<HTMLElement>('.bz-people-ds-row');
  if (dsRow && t.closest('[data-people-ds-list]')) {
    // 目录键从勾选框钩子取（issue 501：行上显示名与目录键已分离，显示名不可回推键）
    const name = dsRow.querySelector<HTMLElement>('[data-people-ds-check]')?.dataset.peopleDsCheck ?? '';
    // 群聊（未纳入）与「已导入且无新素材」两档都不可勾（issue 507：后者原来还能勾，导了等于白导）
    const inert = dsRow.classList.contains('bz-people-ds-off') || dsRow.classList.contains('bz-people-ds-skip');
    if (name && !inert) {
      if (dsSelected.has(name)) dsSelected.delete(name); else dsSelected.add(name);
      syncDsChecks();
    }
    return;
  }
  // —— 找一找 ——
  if (t.closest('[data-people-find-clear]')) { findQuery = ''; void renderAlbum().then(() => focusFind()); return; }
  const ftag = t.closest<HTMLElement>('[data-people-find-tag]');
  if (ftag) { findQuery = ftag.dataset.peopleFindTag ?? ''; void renderAlbum().then(() => focusFind()); return; }
  const frow = t.closest<HTMLElement>('[data-people-find-open]');
  if (frow) {
    const id = frow.dataset.peopleFindOpen ?? '';
    const { sorted } = pagination(listCache);
    const at = sorted.findIndex((p) => p.id === id);
    if (at >= 0) cur = Math.floor(at / AL_PER_PAGE) - (Math.floor(at / AL_PER_PAGE) % PER_SPREAD);
    closeDialog();
    pullPhoto(id);
    return;
  }
  // —— 详情页动作 ——
  const act = t.closest<HTMLElement>('[data-people-act]');
  if (act) {
    const kind = act.dataset.peopleAct ?? '';
    if (kind === 'back') { closePerson(); return; }
    if (kind === 'generate') { void generateOne(detailId ?? undefined); return; }
    if (kind === 'stats') { openDialog('stats'); void refreshStatsKinds(); return; } // issue 513：实时形态异步到货重画
    // 补充背景再点一下（编辑中重开）：脏着先确认（D 组拍板三路之一）
    if (kind === 'prof') { guardProfLeave(() => { clearProfEditState(); openDialog('prof'); }); return; }
    if (kind === 'note') { openDialog('note'); return; }
    if (kind === 'chat') { openChat(); return; } // issue 529：聊天仓里的消息终于有地方看
    if (kind === 'del') { void handleDelete(act.dataset.peopleDel ?? detailId ?? ''); return; }
  }
  // —— 折页切换 / 「另有 N 条」摊开 / 月组开合 / 撕掉随手记 ——
  const foldTab = t.closest<HTMLElement>('[data-people-fold]');
  if (foldTab) {
    const id = foldTab.dataset.peopleFold as FoldId | undefined;
    if (!id) return;
    // 同一折再点一下 = 回到这一折的开头（折签贴在上沿，往下读远了就找它回来）
    if (id === detailFold) {
      foldToHead();
      return;
    }
    // 切折退出编辑（编辑态内容不跨折保留）；编辑中带着未保存改动先确认（D 组拍板三路之一）
    guardProfLeave(() => {
      detailFold = id;
      animFold = true;
      foldScrollTop = true; // 换折从头顶读起（issue 507：原来会接着上一折的滚动位置落进正文中间）
      clearProfEditState();
      noteAddId = null;
      noteDelPending = null;
      void renderAlbum();
    });
    return;
  }
  // 「另有 N 条」：原地把收着的那几条摊开，按钮自己退场（issue 507；六处列表同一套）
  const more = t.closest<HTMLElement>('[data-people-more]');
  if (more) {
    const box = more.parentElement;
    box?.querySelectorAll<HTMLElement>('.bz-people-more-hide').forEach((n) => n.classList.remove('bz-people-more-hide'));
    more.remove();
    return;
  }
  const mon = t.closest<HTMLElement>('[data-people-mon]');
  if (mon) {
    mon.closest<HTMLElement>('.bz-people-mon')?.classList.toggle('on');
    return;
  }
  const noteDel = t.closest<HTMLElement>('[data-people-note-del]');
  if (noteDel) {
    // 撕掉先就地确认（D 组拍板，照 suppImgask 的行内范式）：单击不删
    noteDelPending = noteDel.dataset.peopleNoteDel ?? null;
    void renderAlbum();
    return;
  }
  if (t.closest('[data-people-note-del-cancel]')) { noteDelPending = null; void renderAlbum(); return; }
  const noteDelOk = t.closest<HTMLElement>('[data-people-note-del-ok]');
  if (noteDelOk) {
    const id = noteDelOk.dataset.peopleNoteDelOk ?? '';
    noteDelPending = null;
    void removeManualNote(id);
    return;
  }
  // —— 合并 / 删除确认页 ——
  if (t.closest('[data-people-merge-cancel]')) { mergeFromId = null; mergeToId = null; void renderAlbum(); return; }
  if (t.closest('[data-people-merge-confirm]')) { void handleMergeConfirm(); return; }
  if (t.closest('[data-people-del-cancel]')) { closeDialog(); return; }
  if (t.closest('[data-people-del-ok]')) {
    const btn = t.closest<HTMLButtonElement>('[data-people-del-ok]')!;
    const p = listCache.find((x) => x.id === detailId) ?? null;
    if (!p) return;
    if (openedTier === 'drawn') void confirmDeleteFromPage(p, btn);
    else void deletePerson(p);
    return;
  }
  // —— 开工单 ——
  if (t.closest('[data-people-gen-cancel]')) { answerGenConfirm('cancel'); return; }
  if (t.closest('[data-people-gen-start]')) { answerGenConfirm('start'); return; }
  // —— 档案与随手记（编辑态行内增删） ——
  if (t.closest('[data-people-prof-new]') || t.closest('[data-people-prof-edit]')) { profEditId = detailId; profDirty = false; profLeaveConfirm = false; requestProfRender(); return; }
  if (t.closest('[data-people-prof-leave-ok]')) { discardProfEdit(); return; }
  if (t.closest('[data-people-prof-leave-cancel]')) { keepProfEdit(); return; }
  if (t.closest('[data-people-prof-cancel]')) { clearProfEditState(); requestProfRender(); return; }
  if (t.closest('[data-people-prof-save]')) { void saveProfile(); return; }
  if (t.closest('[data-people-prof-ai]')) { void aiFillProfile(); return; }
  if (t.closest('[data-people-prof-add-social]')) { markProfDirty(); overlay?.querySelector<HTMLElement>('[data-people-prof-social-list]')?.appendChild(socialRow('', '')); return; }
  if (t.closest('[data-people-prof-add-rel]')) {
    markProfDirty();
    overlay?.querySelector<HTMLElement>('[data-people-prof-rel-list]')?.appendChild(relationRow('', ''));
    return;
  }
  if (t.closest('[data-people-prof-add-date]')) {
    markProfDirty();
    overlay?.querySelector<HTMLElement>('[data-people-prof-date-list]')?.appendChild(dateRow('', ''));
    return;
  }
  if (t.closest('[data-people-prof-rel-del]')) { markProfDirty(); t.closest('.bz-people-prof-subrow')?.remove(); return; }
  if (t.closest('[data-people-prof-date-del]')) { markProfDirty(); t.closest('.bz-people-prof-subrow')?.remove(); return; }
  if (t.closest('[data-people-prof-social-del]')) { markProfDirty(); t.closest('.bz-people-prof-subrow')?.remove(); return; }
  if (t.closest('[data-people-prof-tag-add]')) { addTagChip(); return; }
  if (t.closest('[data-people-prof-tag-del]')) { markProfDirty(); t.closest('.bz-people-tag-chip')?.remove(); return; }
  if (t.closest('[data-people-note-save]')) { void saveManualNote(); return; }
  // —— 补充素材页（issue 509） ——
  const suppTabBtn = t.closest<HTMLElement>('[data-people-supp-tab]');
  if (suppTabBtn) {
    suppTab = (suppTabBtn.getAttribute('data-people-supp-tab') as SuppTab | null) ?? 'text';
    recRefConfirm = false; // 换页签收起没点完的质心重建确认
    startRecPolling();
    void renderAlbum();
    // 进录音页就交代「有哪些能续跑」（issue 516 Q16g）：中断的不会自己动，别让它们躺着没人管
    if (suppTab === 'rec') void noticeInterruptedRecordings();
    return;
  }
  // 网格哨兵（issue 519）：滚到自动追加（IO），点了也追加——兜底 IO 怪异的环境
  if (t.closest('[data-people-supp-img-more]')) { armSuppImgMore(growSuppImgGrid()); return; }
  if (t.closest('[data-people-supp-img-pick]')) { void suppPickImages(); return; }
  const imgDrop = t.closest<HTMLElement>('[data-people-supp-img-drop]');
  if (imgDrop) { suppImages.splice(Number(imgDrop.getAttribute('data-people-supp-img-drop')), 1); void renderAlbum(); return; }
  const imgPeer = t.closest<HTMLElement>('[data-people-supp-img-peer]');
  if (imgPeer) {
    const it = suppImages[Number(imgPeer.getAttribute('data-people-supp-img-peer'))];
    if (it) it.peer = !it.peer;
    void renderAlbum();
    return;
  }
  if (t.closest('[data-people-supp-img-import]')) { void suppImportImages(); return; }
  if (t.closest('[data-people-supp-img-desc]')) { void suppDescribe(); return; }
  // 敏感格子的撤回入口（ADR-0224）：一键 = 解除标注 + 重跑描述，点击本身即计费授权
  const imgUnsens = t.closest<HTMLElement>('[data-people-supp-img-unsens]');
  if (imgUnsens) {
    void suppUnmarkSensitive(imgUnsens.getAttribute('data-people-supp-img-unsens') ?? '');
    return;
  }
  // 留影格：点图开大图 / 叉开二次确认 / 确认或取消（复评）
  const imgView = t.closest<HTMLElement>('[data-people-supp-img-view]');
  if (imgView) { openImgViewer(imgView.getAttribute('data-people-supp-img-view') ?? ''); return; }
  const imgDel = t.closest<HTMLElement>('[data-people-supp-img-del]');
  if (imgDel) { suppImgDelPending = imgDel.getAttribute('data-people-supp-img-del'); void renderAlbum(); return; }
  if (t.closest('[data-people-supp-img-del-cancel]')) { suppImgDelPending = null; void renderAlbum(); return; }
  const imgDelOk = t.closest<HTMLElement>('[data-people-supp-img-del-ok]');
  if (imgDelOk) {
    const img = imgDelOk.getAttribute('data-people-supp-img-del-ok') ?? '';
    suppImgDelPending = null;
    void suppDeleteImage(img);
    return;
  }
  if (t.closest('[data-people-supp-rec-add]')) { void suppPickRecordings(); return; }
  // （录音起点候选下拉不在这：select 只认 change 委托——click 会把展开的下拉合上，见 buildPanelShell）
  const recDrop = t.closest<HTMLElement>('[data-people-supp-rec-drop]');
  if (recDrop) {
    // 移出队列（B 组审查 P1）：先 harvest 再 splice——renderAlbum 开头的 harvest 按旧 DOM 下标
    // 写新数组，删第 k 条后其后所有录音的起点会被前一条的值串位覆盖
    harvestRecQueueInputs();
    suppRecQueue.splice(Number(recDrop.getAttribute('data-people-supp-rec-drop')), 1);
    void renderAlbum();
    return;
  }
  const recKeep = t.closest<HTMLElement>('[data-people-supp-rec-keep]');
  if (recKeep) {
    const it = suppRecQueue[Number(recKeep.getAttribute('data-people-supp-rec-keep'))];
    if (it) it.keep = !it.keep;
    void renderAlbum();
    return;
  }
  if (t.closest('[data-people-supp-rec-import]')) { void suppImportRecordings(); return; }
  const recDel = t.closest<HTMLElement>('[data-people-supp-rec-del]');
  if (recDel) {
    recDelPending = recDel.getAttribute('data-people-supp-rec-del') ?? null;
    recDelAlsoFile = true; // 默认勾选（原意 = 整条消失）
    void renderAlbum();
    return;
  }
  if (t.closest('[data-people-supp-rec-del-cancel]')) {
    recDelPending = null;
    void renderAlbum();
    return;
  }
  const recDelOk = t.closest<HTMLElement>('[data-people-supp-rec-del-ok]');
  if (recDelOk) {
    void suppDeleteRecording(recDelOk.getAttribute('data-people-supp-rec-del-ok') ?? '');
    return;
  }
  const recStartBtn = t.closest<HTMLElement>('[data-people-supp-rec-start-edit]');
  if (recStartBtn) {
    recStartEditFile = recStartBtn.getAttribute('data-people-supp-rec-start-edit');
    void renderAlbum();
    return;
  }
  if (t.closest('[data-people-supp-rec-start-cancel]')) {
    recStartEditFile = null;
    void renderAlbum();
    return;
  }
  const recTurns = t.closest<HTMLElement>('[data-people-supp-rec-turns]');
  if (recTurns) {
    recTurnsFile = recTurns.getAttribute('data-people-supp-rec-turns');
    void renderAlbum();
    return;
  }
  if (t.closest('[data-people-supp-rec-turns-close]')) {
    recTurnsFile = null;
    void renderAlbum();
    return;
  }
  const recRun = t.closest<HTMLElement>('[data-people-supp-rec-run]');
  if (recRun) { void suppRunRecording(recRun.getAttribute('data-people-supp-rec-run') ?? ''); return; }
  const recMerge = t.closest<HTMLElement>('[data-people-supp-rec-merge]');
  if (recMerge && detailId) { void suppMergeRecording(detailId, recMerge.getAttribute('data-people-supp-rec-merge') ?? ''); return; }
  const recStop = t.closest<HTMLElement>('[data-people-supp-rec-stop]');
  if (recStop) {
    // 510 修存量缺陷：注册表键是 sidecar 路径，此前把文件名当键传 → 停止按钮其实是 no-op；
    // 现按 sidecar 路径寻键，并带任务三参走协作式停止（写该任务专属 rec-control 文件，90s 未退兜底杀）
    const file = recStop.getAttribute('data-people-supp-rec-stop') ?? '';
    const root = suppDataRoot();
    if (detailId && root && file) stopRecordingTask(recordingSidecarPath(root, detailId, file), { dataRoot: root, talker: detailId, file });
    void renderAlbum();
    return;
  }
  // 重建才问「覆盖」（复评）：没建过（按钮是「建质心」）没有可覆盖的东西，直接开工
  if (t.closest('[data-people-supp-rec-ref]')) {
    const talker = detailId;
    const root = suppDataRoot();
    if (!talker || !root || voiceprintRefStatus(root, talker) !== 'ready') { void suppBuildVoiceprintRef(); return; }
    recRefConfirm = true;
    void renderAlbum();
    return;
  }
  if (t.closest('[data-people-supp-rec-ref-ok]')) { recRefConfirm = false; void suppBuildVoiceprintRef(); return; }
  if (t.closest('[data-people-supp-rec-ref-cancel]')) { recRefConfirm = false; void renderAlbum(); return; }
  const recDeq = t.closest<HTMLElement>('[data-people-supp-rec-dequeue]');
  if (recDeq) {
    // 排队行「移出队列」：这条不对了就走（与进度块的「清空队列」语义正交，ADR-0218 决策 7）
    const file = recDeq.getAttribute('data-people-supp-rec-dequeue') ?? '';
    const root = suppDataRoot();
    if (detailId && root && file) dequeueRecordingTask(recordingSidecarPath(root, detailId, file));
    void renderAlbum();
    return;
  }
  if (t.closest('[data-people-rec-clear-queue]')) {
    const n = clearRecordingQueue();
    notice(n > 0 ? `已清空队列（${n} 条）` : '队列已是空的', 'info');
    void renderAlbum();
    return;
  }
  // —— 上锁封面 ——
  const lock = t.closest<HTMLElement>('[data-people-lock]');
  if (lock) {
    if (lock.dataset.peopleLock === 'cancel') { closePeoplePanel(); return; }
    void (async () => {
      if (!peopleSafe) peopleSafe = await getPeopleSafeStore();
      if (peopleSafe?.unlocked || (await unlockGate())) void renderAlbum();
    })();
    return;
  }
}

/** 弹窗小签 → 开页（不靠人的直接开；靠人的要有人开着） */
async function openDialogByHook(kind: string): Promise<void> {
  if (kind === 'ds') { await openDsIfIdle(); return; }
  if (kind === 'find') { openDialog('find'); return; }
}

/** 档案页的编辑态切换：只重画那一页（不动册子） */
function requestProfRender(): void {
  void renderAlbum();
}

/** 「勾有更新的」：一键勾上全部有新素材的单聊（弹窗内原位刷新） */
function pickFresh(): void {
  for (const c of dsContacts ?? []) {
    if (c.newCount > 0 && !c.isGroup) dsSelected.add(c.name);
  }
  syncDsChecks();
}

/** 弹窗勾选集合 → DOM 勾选框（aria-checked + 勾图标 + 行高亮，原位）与页脚账 */
function syncDsChecks(): void {
  if (!overlay) return;
  overlay.querySelectorAll<HTMLElement>('[data-people-ds-check]').forEach((box) => {
    const on = dsSelected.has(box.dataset.peopleDsCheck ?? '');
    box.setAttribute('aria-checked', on ? 'true' : 'false');
    box.replaceChildren(...(on ? [el('i', 'bz-ic', { 'data-lucide': 'check', 'aria-hidden': 'true' })] : []));
    box.closest('.bz-people-ds-row')?.classList.toggle('bz-people-ds-on', on);
  });
  mountIcons(overlay);
  updateDsFooter();
}

function updateDsFooter(): void {
  const sel = (dsContacts ?? []).filter((c) => dsSelected.has(c.name));
  const fresh = sel.reduce((s, c) => s + (c.newApprox ? 0 : c.newCount), 0);
  const approx = sel.filter((c) => c.newApprox && c.newCount > 0).length;
  const bits = [
    ...(fresh ? [`新素材 ${fresh} 条`] : []),
    ...(approx ? [`${approx} 位有新消息`] : []),
  ];
  const label = !sel.length
    ? '未勾选联系人'
    : bits.length
      ? `已选 ${sel.length} 位 · ${bits.join(' · ')}`
      : `已选 ${sel.length} 位 · 所选暂无新素材`;
  const count = overlay?.querySelector<HTMLElement>('[data-people-ds-count]');
  if (count) count.textContent = label;
}

// ---------------- 渲染分发（issue 505：打开面板就是这一册相册） ----------------

/** 一页贴几张（2 列 × 3 行）的排序分页：按「最近说过话」排完，每 6 位一页（渲染与翻页两边共用） */
function pagination(people: PersonEntry[]): { sorted: PersonEntry[]; pages: PersonEntry[][] } {
  const sorted = sortPeople(people);
  const pages: PersonEntry[][] = [];
  for (let i = 0; i < sorted.length; i += AL_PER_PAGE) pages.push(sorted.slice(i, i + AL_PER_PAGE));
  return { sorted, pages };
}

/** 头像表：保库记录里的密文头像 → 内存 data URL（id 定位——记录键是 talker，不随改名漂移） */
async function avatarMap(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!peopleSafe?.unlocked) return out;
  for (const id of await peopleSafe.talkers()) {
    const url = await peopleSafe.avatarDataUrl(id);
    if (url) out.set(id, url);
  }
  return out;
}

/** 这一位有没有新素材（数据源扫描快照里的「新条数」——导入 / 同步后那一趟的账） */
function freshOf(id: string): number {
  const c = (dsContacts ?? []).find((x) => x.name === id);
  return c && !c.newApprox ? Math.max(0, c.newCount) : 0;
}

/** 一格照片的入参 */
function photoOf(p: PersonEntry, index: number, avatars: Map<string, string>): AlbumPhoto {
  return {
    p,
    avatar: avatars.get(p.id) ?? '',
    index,
    fresh: freshOf(p.id),
    due: dueSoonOf(p),
    job: sealJobOf(jobViews().get(p.id)),
  };
}

/** 一页照片（按当前摊页序切好，缺位补空） */
function pagePhotos(list: PersonEntry[], indexOf: Map<string, number>, avatars: Map<string, string>): Array<AlbumPhoto | null> {
  return list.map((p, i) => photoOf(p, indexOf.get(p.id) ?? i, avatars));
}

/** 册子骨头：分页、当前摊、并页（详情 / 弹窗摆在哪一侧） */
async function albumBody(people: PersonEntry[]): Promise<HTMLElement> {
  const avatars = await avatarMap();
  const { sorted, pages } = pagination(people);
  const indexOf = new Map(sorted.map((p, i) => [p.id, i % AL_PER_PAGE]));
  const total = pages.length;
  const ledger = { faces: people.filter((p) => p.digest).length, msgs: people.reduce((s, p) => s + p.imports.reduce((x, r) => x + r.messageCount, 0), 0) };

  // ① 不靠人的弹窗（数据源 / 画谱确认 / 找一找）：单页摊满整册
  if (dialog && !pulled && dialog.kind !== 'stats' && dialog.kind !== 'prof' && dialog.kind !== 'note' && dialog.kind !== 'del') {
    return albumSpread([dialogPage(null, avatars)], { left: { pages: 0, flips: 0 }, right: { pages: 0, flips: 0 } }, { mod: 'bz-people-spread-one' });
  }

  // ② 详情：抽出来的那张留在被点的那一页，脸谱翻开在对面那页
  if (pulled) {
    const at = sorted.findIndex((p) => p.id === pulled);
    const d = at >= 0 ? sorted[at] : null;
    if (d) {
      const pi = Math.min(Math.floor(at / AL_PER_PAGE), total - 1);
      if (pi !== cur && pi !== cur + 1) cur = pi - (pi % PER_SPREAD);
      const clickedLeft = pi === cur;
      const leaf = dialog ? dialogPage(d, avatars) : albumPage(pagePhotos(pages[pi] ?? [], indexOf, avatars), pi + 1, sorted.length, ledger, { drop: animDrop, dev: animDev });
      const det = detailPage(d, detailOpts(d, clickedLeft ? 'right' : 'left', avatars));
      const inner = clickedLeft ? [leaf, albumGutter(), det] : [det, albumGutter(), leaf];
      return albumSpread(inner, { left: { pages: 0, flips: 0 }, right: { pages: 0, flips: 0 } });
    }
    pulled = null; // 人没了（被删）：流程自愈
  }

  // ③ 摊开的册页
  cur = Math.min(Math.max(0, cur), lastCur(total));
  const halves: HTMLElement[] = [];
  for (let h = 0; h < PER_SPREAD; h++) {
    const idx = cur + h;
    if (h) halves.push(albumGutter());
    // 照片没排到的那半张也照样摊开（issue 507）：册子不只剩半本，缺的那页出空位占位页
    halves.push(pages[idx]
      ? albumPage(pagePhotos(pages[idx], indexOf, avatars), idx + 1, sorted.length, ledger, { drop: animDrop, dev: animDev })
      : albumBlankPage());
  }
  return albumSpread(halves, turnLoad(cur, total), { boot: animBoot, turn: animTurn });
}

/** 详情页入参 */
function detailOpts(p: PersonEntry, side: 'left' | 'right', avatars: Map<string, string>): DetailOpts {
  const person = personOf(p.digest);
  const bond = bondOf(p.digest);
  const md = person ? miniMarkdown(person) : null;
  const bondMd = bond ? miniMarkdown(bond) : null;
  return {
    side,
    fold: detailFold,
    foldIn: animFold, // 刚换折 → 正文放进动画（issue 507：505 之后这一支的类名没人挂了）
    avatar: avatars.get(p.id) ?? '',
    body: detailFold === 'p' ? foldPersonBody(md, p) : detailFold === 'b' ? foldBondBody(bondMd, p) : foldEventsBody(p, noteDelPending),
    job: sealJobOf(jobViews().get(p.id)),
    facts: detailFactsOf(p),
  };
}

/** 当前该翻开哪一页弹窗（靠人的 / 不靠人的都在里面）；avatars = 头像表（逐轮时间轴两侧头像用） */
function dialogPage(p: PersonEntry | null, avatars?: Map<string, string>): HTMLElement {
  const kind = dialog?.kind;
  if (kind === 'ds') return dsPage(dsPageState());
  if (kind === 'gen') return genPage(pendingGenInfo ?? { items: [], materials: 0, images: 0, voices: 0, empty: true });
  if (kind === 'find') return findPageState(avatars);
  if (p && kind === 'stats') return statsPage(p, statsPopBody(buildInsightsCard(p, statsKinds), p));
  if (p && kind === 'prof') return profPage(p, profilePopBody(p, profEditId === p.id, profLeaveConfirm), profEditId === p.id);
  if (p && kind === 'note') return suppPage(p, suppTab, suppImageState(), suppRecState(p.id, avatars?.get(p.id) ?? ''), todayStr(), noteDelPending);
  if (p && kind === 'chat') return chatPage(chatPageState(p, avatars));
  if (p && kind === 'del') return delPage(p, dialog?.tier ?? deleteTierOf(p, sealJobOf(jobViews().get(p.id))));
  return subPage({ title: '', hook: 'none' }, []);
}

/**
 * 「找一找」册页：按名字 / 标签捞人（结果里写清在第几页，点一下翻过去把脸谱翻开）。
 * avatars（D 组拍板）：结果行给真头像——不再写死空串落成首字圆章。
 */
function findPageState(avatars?: Map<string, string>): HTMLElement {
  const q = findQuery.trim();
  const { sorted } = pagination(listCache);
  const rows: FindRow[] = [];
  if (q) {
    for (const p of sorted) {
      const name = p.name || p.id;
      const tags = (p.profile?.tags ?? []).filter(Boolean);
      if (!name.includes(q) && !tags.some((t) => t.includes(q))) continue;
      const at = sorted.indexOf(p);
      const job = sealJobOf(jobViews().get(p.id));
      const seal = albumSealOf(p, job);
      const pi = Math.floor(at / AL_PER_PAGE); // 按页序号定左右（B 组审查 P3）：全局下标奇偶会把偶数摊整页报错边
      rows.push({
        p,
        avatar: avatars?.get(p.id) ?? '',
        page: pi + 1,
        half: pi % PER_SPREAD === 0 ? '左' : '右',
        state: seal.state === 'none' ? 'todo' : seal.state === 'drawn' || seal.state === 'legacy' ? 'drawn' : 'drawing',
      });
    }
  }
  const tagPool = [...new Set(listCache.flatMap((p) => (p.profile?.tags ?? []).filter(Boolean)))].slice(0, 6);
  return findPage({ q, total: listCache.length, rows, tags: tagPool });
}

// ---------------- 聊天页（issue 529：详情页动作签「查看聊天」） ----------------

/** 开聊天页：按人现读聊天仓（保库记录解密缓存命中时是一次 microtask），渲染落最新一条 */
function openChat(): void {
  const id = detailId;
  if (!id) return;
  chatAll = [];
  chatLoading = true;
  chatShown = CHAT_PAGE;
  chatScrollBottom = true;
  chatAnchorBottom = null;
  openDialog('chat');
  void loadChatRows(id);
}

/** 读聊天仓 → 展示行（换页 / 换人 / 关面板期间回来的结果一律丢掉） */
async function loadChatRows(id: string): Promise<void> {
  let rows: ChatLineData[] = [];
  try {
    const recs = await records();
    rows = chatLinesOf(recs.get(id)?.store.msgs);
  } catch (e) {
    console.warn('[people] 读取聊天记录失败:', e);
  }
  if (dialog?.kind !== 'chat' || detailId !== id) return;
  chatAll = rows;
  chatLoading = false;
  chatScrollBottom = true;
  void renderAlbum();
}

/**
 * 聊天页展示态：**末 `chatShown` 条**（往上长的分页）+ 时间分隔条 + 群聊才出的发送者名。
 * 头像：我方 = 设置 / 微信里的本人头像，对方 = 保库记录里那张（没有就首字印）。
 */
function chatPageState(p: PersonEntry, avatars?: Map<string, string>): ChatViewState {
  const name = p.name || p.id;
  const shown = chatAll.slice(Math.max(0, chatAll.length - chatShown));
  const group = isGroupChatLines(chatAll);
  const now = Date.now();
  const meAvatar = myAvatarOf();
  const otherAvatar = avatars?.get(p.id) ?? '';
  let prevTs: number | null = null;
  const lines: ChatLine[] = shown.map((l) => {
    const sep = chatSepOf(l.ts, prevTs, now);
    prevTs = l.ts;
    return {
      ...(l.key ? { key: l.key } : {}),
      me: l.me,
      avatar: l.me ? meAvatar : otherAvatar,
      who: l.me ? '我' : l.who || name,
      ...(group && !l.me && l.who ? { name: l.who } : {}),
      ...(l.tag ? { tag: l.tag } : {}),
      text: l.text,
      ...(sep ? { sep } : {}),
    };
  });
  return {
    name,
    lines,
    total: chatAll.length,
    hasMore: chatAll.length > shown.length,
    loading: chatLoading,
  };
}

/** 往上再放一页（哨兵进视口自动 / 点哨兵兜底）：重画前记离底距离，回来还按它落 */
function growChat(): void {
  if (dialog?.kind !== 'chat' || chatLoading) return;
  if (chatShown >= chatAll.length) return;
  chatAnchorBottom = chatBottomGap();
  chatShown = Math.min(chatAll.length, chatShown + CHAT_PAGE);
  void renderAlbum();
}

/** 聊天页那块滚动当前离底多少像素（加载更早的锚点） */
function chatBottomGap(): number | null {
  const box = overlay?.querySelector<HTMLElement>('[data-people-sub="chat"] [data-people-scroll]');
  if (!box) return null;
  return Math.max(0, box.scrollHeight - box.clientHeight - box.scrollTop);
}

/** 聊天页滚动落点（重画后调）：进页 / 回到最新 → 贴底；加载更早 → 保持离底距离 */
function restoreChatScroll(): void {
  if (dialog?.kind !== 'chat') return;
  const box = overlay?.querySelector<HTMLElement>('[data-people-sub="chat"] [data-people-scroll]');
  if (!box) return;
  if (chatScrollBottom) {
    box.scrollTop = box.scrollHeight;
    chatScrollBottom = false;
    chatAnchorBottom = null;
    return;
  }
  if (chatAnchorBottom !== null) {
    box.scrollTop = Math.max(0, box.scrollHeight - box.clientHeight - chatAnchorBottom);
    chatAnchorBottom = null;
  }
}

function disarmChatMore(): void {
  chatMoreIO?.disconnect();
  chatMoreIO = null;
}

/** 重挂哨兵观察（rootMargin 提前量：滚到离顶一屏就放上一页，不露等待；IO 缺席点哨兵兜底） */
function armChatMore(sentinel: HTMLElement | null): void {
  disarmChatMore();
  if (!sentinel || typeof IntersectionObserver === 'undefined') return;
  chatMoreIO = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    disarmChatMore();
    growChat();
  }, { rootMargin: '600px 0px' });
  chatMoreIO.observe(sentinel);
}

/** 聊天页状态整个丢掉（上锁 / 关面板：解密过的聊天文本不跟着留在内存里） */
function clearChatState(): void {
  chatAll = [];
  chatShown = CHAT_PAGE;
  chatLoading = false;
  chatAnchorBottom = null;
  chatScrollBottom = false;
  disarmChatMore();
}

/**
 * 把导入队列里**已上屏但还没提交**的起点收回模型（issue 516 回归防护）。
 * 必须在任何整页重画前调用：否则「用户正在输起点时队列动了一下（抽检进程出队 / 转写推进）」
 * 会把输入框里的字连同 DOM 一起抹掉——模型还是旧值，字却没了。
 * 按 path 身份认条目（B 组审查 P1）：下标在队列增删后会串位——删第 k 条，其后录音的起点
 * 会被前一条的输入值覆盖。页签没开时 querySelectorAll 为空，零成本。
 */
function harvestRecQueueInputs(): void {
  if (!suppRecQueue.length || !overlay) return;
  overlay.querySelectorAll<HTMLInputElement>('[data-people-supp-rec-ts]').forEach((inp) => {
    const path = inp.getAttribute('data-people-supp-rec-path');
    const it = path !== null ? suppRecQueue.find((q) => q.path === path) : suppRecQueue[Number(inp.getAttribute('data-people-supp-rec-ts'))];
    if (!it) return;
    const v = new Date(inp.value).getTime();
    it.startMs = inp.value && Number.isFinite(v) ? v : null;
  });
}

/** 渲染整册（唯一入口：面板重画全走这儿） */
async function renderAlbum(): Promise<void> {
  const panel = overlay?.querySelector<HTMLElement>('.bz-people-panel');
  const wrap = overlay?.querySelector<HTMLElement>('[data-people-scroll]');
  if (!panel || !wrap || !store || !overlay) return;
  harvestRecQueueInputs(); // 重画前先把没提交的起点收回（否则队列一动就吃字）
  const scroll = scrollSnapshot();
  // 上锁不可读（ADR-0194）：解锁态被任何路径翻掉 → 只剩一张合着的封面，不渲染任何联系人数据
  if (!peopleSafe?.unlocked) {
    listCache = [];
    recordCache = null;
    clearChatState(); // 上锁即丢（聊天页的行 = 解密后的聊天原文）
    panel.classList.add('bz-people-locked');
    wrap.replaceWith(lockCover(animBoot));
    renderNote();
    renderBanner();
    applySyncLockdown();
    mountIcons(overlay);
    clearAnim();
    return;
  }
  panel.classList.remove('bz-people-locked');
  // 冷读加载占位（issue 483）：记录缓存不在且保库记录非全量热读 → 先出解密中的册子
  if (!recordCache && peopleSafe && !peopleSafe.isFullyCached()) {
    wrap.replaceWith(albumLoad(loadDone, loadTotal));
  }
  const people = await wallPeople(); // 一次拉全量：册页 / 详情 / 弹窗三处同源
  if (!overlay || !peopleSafe?.unlocked) return; // await 期间面板被关 / 保险库被上锁：本次渲染作废
  listCache = people;
  const next = people.length || dialog ? await albumBody(people) : albumEmpty();
  if (!overlay || !peopleSafe?.unlocked) return; // await 期间面板被关 / 保险库被上锁：本次渲染作废
  overlay.querySelector<HTMLElement>('[data-people-scroll]')?.replaceWith(next);
  restoreScroll(scroll);
  restoreChatScroll(); // 聊天页：进页 / 回到最新贴底，加载更早保持离底距离（覆盖上面的通用还原）
  // 吸附基准先量（窄屏折签吸在页眉下沿；换折落点要用它算）——重画换了页元素，量必须在本轮
  syncStickyHeadH();
  // 换折（issue 507；复评二改）：落到**折页**的起头处，不是整页顶——照片/动作区之上不动，
  // 切完先看见这一折的第一行（折签钉在上沿，正文不许顶到签底下）
  if (foldScrollTop) foldToHead();
  syncScrollEdges();
  renderNote();
  renderBanner();
  applySyncLockdown();
  applyJobsLockdown();
  // 留影网格哨兵（issue 519）：渲染后重挂观察——非素材页 query 不到 = 仅摘，幂等
  armSuppImgMore(overlay.querySelector<HTMLElement>('[data-people-supp-img-more]'));
  // 聊天页「更早的消息」哨兵（issue 529）：同上——非聊天页 query 不到 = 仅摘
  armChatMore(overlay.querySelector<HTMLElement>('[data-people-chat-more]'));
  mountIcons(overlay); // lucide 占位 → SVG
  clearAnim();
}

/** 一次性动效标志：放完即清（同页后续重画不重放） */
function clearAnim(): void {
  animBoot = false;
  animTurn = '';
  animDetail = false;
  animFold = false;
  animDrop = [];
  animDev = '';
  animNote = false;
  foldScrollTop = false;
}

/** 窄屏页眉吸在顶上，折签要吸在页眉下沿（两条中间露正文就是道缝）：把页眉高度量成 CSS 变量。
 *  宽屏页眉不吸、滚动区在页身之内，变量没人用（foldToHead 按「页身滚不滚」判基准）。 */
function syncStickyHeadH(): void {
  overlay?.querySelectorAll<HTMLElement>('[data-people-detail]').forEach((page) => {
    const head = page.querySelector<HTMLElement>('.bz-people-page-head');
    if (head) page.style.setProperty('--bz-page-head-h', `${Math.round(head.offsetHeight)}px`);
  });
}

/** 折页起头：把详情正文滚到「折页第一行贴着折签下沿」的位置。
 *  折签是 sticky（贴在上沿），所以不能只置 0——那样落回来的是整页顶的照片区，
 *  正文还在屏幕外（复评：从相交切其人，该落在其人这一折的起头）。
 *  窄屏整条在滚（页身不自己滚）、页眉也吸着：基准再加页眉高度。 */
function foldToHead(): void {
  const body = overlay?.querySelector<HTMLElement>('[data-people-scroll="detail"]');
  const sheet = body?.querySelector<HTMLElement>('.bz-people-fsheet');
  if (!body || !sheet) return;
  // 真正在滚的那一层：页身滚不动（窄屏 auto 高）就往上找能滚的（overflow: hidden 的不算）
  const scrollable = (elm: HTMLElement): boolean => {
    if (elm.scrollHeight <= elm.clientHeight + 1) return false;
    const oy = window.getComputedStyle(elm).overflowY;
    return oy === 'auto' || oy === 'scroll';
  };
  let scroller: HTMLElement = body;
  if (!scrollable(body)) {
    for (let p = body.parentElement; p; p = p.parentElement) {
      if (scrollable(p)) { scroller = p; break; }
    }
  }
  const page = body.closest<HTMLElement>('[data-people-detail]');
  const headH = scroller === body ? 0 : Number.parseFloat(page?.style.getPropertyValue('--bz-page-head-h') || '0') || 0;
  const tabs = body.querySelector<HTMLElement>('.bz-people-ftabs');
  const pad = tabs ? tabs.getBoundingClientRect().height : 0;
  const target = scroller.getBoundingClientRect().top + headH + pad;
  scroller.scrollTop += sheet.getBoundingClientRect().top - target;
}

/** 能滚的那块：记下滚动位置，重画后放回去（切折 / 换页不跳回顶端） */
function scrollSnapshot(): Record<string, number> {
  const out: Record<string, number> = {};
  overlay?.querySelectorAll<HTMLElement>('[data-people-scroll]').forEach((el) => {
    out[el.getAttribute('data-people-scroll') ?? ''] = el.scrollTop;
  });
  return out;
}

function restoreScroll(m: Record<string, number>): void {
  overlay?.querySelectorAll<HTMLElement>('[data-people-scroll]').forEach((el) => {
    const v = m[el.getAttribute('data-people-scroll') ?? ''];
    if (typeof v === 'number') el.scrollTop = v;
  });
}

/** 滚到顶了就不该有上面那条内影（底部那条已退役：滚动边缘提示「下面还有」反而像故障，复评点名去掉） */
function scrollEdges(el: Element): void {
  const box = el as HTMLElement;
  box.classList.toggle('sc-top', box.scrollTop <= 1);
}

function syncScrollEdges(): void {
  overlay?.querySelectorAll('.bz-people-pagebody').forEach(scrollEdges);
}

// ---------------- 册子交互：翻摊 / 抽照片 / 反光 ----------------

/** 翻一摊：整册往那侧让一下，再让「那一页纸」从中缝掀过去 */
function turnTo(dir: 'next' | 'prev'): void {
  // 详情 / 弹窗那一摊是钉住的（albumBody 只渲染它，跟着 cur 翻不动）：滚到边的滚轮**不许**触发翻页——
  // 否则整册重画会把折内状态（「另有」摊开 / 月份开合）一并抹掉（「滚一下全收起来」的根因，复评）
  if (pulled || dialog) return;
  const total = pageTotal(listCache.length);
  const to = dir === 'next' ? Math.min(lastCur(total), cur + PER_SPREAD) : Math.max(0, cur - PER_SPREAD);
  if (to === cur) return;
  const spread = overlay?.querySelector<HTMLElement>('.bz-people-spread');
  const oldPages = overlay?.querySelectorAll<HTMLElement>('.bz-people-spread > .bz-people-page');
  const oldR = oldPages && oldPages.length ? oldPages[oldPages.length - 1] : null;
  const keep = spread?.getAttribute('style') ?? null;
  if (spread) spread.style.transform = 'none'; // 量之前先收掉「随视线微转」的角度，不然纸会大一圈
  const rect = oldR?.getBoundingClientRect();
  if (spread) { if (keep === null) spread.removeAttribute('style'); else spread.setAttribute('style', keep); }
  const sheet = rect && rect.width
    ? {
      face: dir === 'next' ? oldR!.outerHTML : (oldPages?.[0]?.outerHTML ?? ''),
      back: '',
      rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    }
    : null;
  cur = to;
  animTurn = dir;
  void renderAlbum().then(() => {
    if (!sheet) return;
    const pages = overlay?.querySelectorAll<HTMLElement>('.bz-people-spread > .bz-people-page');
    if (pages?.length) sheet.back = (dir === 'next' ? pages[0] : pages[pages.length - 1]).outerHTML;
    flipSheet(dir, sheet);
  });
}

/** 掀纸：一块 position:fixed 的纸，绕自己的左边（中缝）转 180°，落地淡掉 */
function flipSheet(mode: 'next' | 'prev', s: { face: string; back: string; rect: { x: number; y: number; w: number; h: number } }): void {
  // 少动效（issue 507）：翻摊照翻，只是不掀这一张飞纸（与 runFly 同一口径）
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('div');
  el.className = `bz-people-sheet bz-people-sheet-${mode}`;
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${s.rect.x}px`;
  el.style.top = `${s.rect.y}px`;
  el.style.width = `${s.rect.w}px`;
  el.style.height = `${s.rect.h}px`;
  for (const k of ['--fx', '--fy']) {
    const v = overlay?.style.getPropertyValue(k);
    if (v) el.style.setProperty(k, v);
  }
  const front = document.createElement('div');
  front.className = 'bz-people-sheet-face bz-people-sheet-f';
  front.innerHTML = noFocus(s.face);
  const back = document.createElement('div');
  back.className = 'bz-people-sheet-face bz-people-sheet-b';
  back.innerHTML = noFocus(s.back);
  el.append(front, back);
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 900);
}

/** 纸上的两页是复制品：去掉键盘焦点，Tab 不进正在飞的纸 */
function noFocus(html: string): string {
  return String(html ?? '').replace(/ tabindex="0" role="button"/g, '');
}

/** 照片：先在膜下抽出来（.bz-people-out 起过渡），再看是哪一页抽的；再点同一张＝塞回去合上 */
function pullPhoto(id: string): void {
  if (pulled === id) { closePerson(); return; }
  const cell = overlay?.querySelector<HTMLElement>(`[data-people-pocket="${cssEscape(id)}"]`);
  const img = cell?.querySelector<HTMLImageElement>('.bz-people-photo img');
  const txt = cell?.querySelector<HTMLElement>('.bz-people-photo .bz-people-ava-txt');
  flyPending = { src: img?.getAttribute('src') ?? '', txt: txt?.textContent ?? '' };
  cell?.classList.add('bz-people-out');
  window.setTimeout(() => {
    if (!overlay) return; // 240ms 内面板关了：落地即作废（B 组审查 P3）——别把详情页直落到重开的面板上
    pulled = id;
    detailId = id;
    detailFold = 'p';
    dialog = null;
    animDetail = true;
    void renderAlbum().then(() => runFly());
  }, 240);
}

/** 合上：抽出来的那张反向塞回膜下，对面那页跟着收走 */
function closePerson(): void {
  if (!pulled) return;
  overlay?.querySelector<HTMLElement>('.bz-people-cell.bz-people-out')?.classList.remove('bz-people-out');
  const id = pulled;
  const finish = (): void => {
    pulled = null;
    detailId = null;
    dialog = null;
    void renderAlbum().then(() => {
      overlay?.querySelector<HTMLElement>(`[data-people-pocket="${cssEscape(id)}"]`)?.focus();
    });
  };
  if (overlay?.querySelector('.bz-people-cell.bz-people-out')) window.setTimeout(finish, 200);
  else finish();
}

/** 点照片那一下放下的哨：要飞的那张图（起飞点等抬到位了再量） */
let flyPending: { src: string; txt: string } | null = null;

/** 照片飞进对面页的相框：从抬起的那张起飞、落到对面页的相框里 */
function runFly(): void {
  const f = flyPending;
  flyPending = null;
  if (!f || !overlay) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const cell = overlay.querySelector<HTMLElement>('.bz-people-cell.bz-people-out');
  const print = cell?.querySelector<HTMLElement>('.bz-people-print');
  const box = print?.getBoundingClientRect();
  const target = overlay.querySelector<HTMLElement>('.bz-people-bigphoto');
  if (!box?.width || !target) return;
  target.classList.add('bz-people-hold'); // 相框立刻空着，免得先亮一下再飞
  const w = print!.offsetWidth || box.width;
  const h = print!.offsetHeight || box.height;
  const from = { x: box.left + box.width / 2 - w / 2, y: box.top + box.height / 2 - h / 2 };
  window.setTimeout(() => {
    const to = target.getBoundingClientRect();
    if (!to.width) { target.classList.remove('bz-people-hold'); return; }
    const fly = document.createElement('div');
    fly.className = 'bz-people-fly';
    if (f.src) fly.innerHTML = `<img src="${f.src}" alt="">`;
    else fly.innerHTML = `<span class="bz-people-fly-txt"></span>`;
    if (!f.src) (fly.firstElementChild as HTMLElement).textContent = f.txt;
    fly.style.left = `${from.x}px`;
    fly.style.top = `${from.y}px`;
    fly.style.width = `${w}px`;
    fly.style.height = `${h}px`;
    fly.style.setProperty('--dx', `${to.left - from.x}px`);
    fly.style.setProperty('--dy', `${to.top - from.y}px`);
    fly.style.setProperty('--sx', (to.width / w).toFixed(3));
    fly.style.setProperty('--sy', (to.height / h).toFixed(3));
    document.body.appendChild(fly);
    window.setTimeout(() => {
      fly.remove();
      target.classList.remove('bz-people-hold');
      target.classList.add('bz-people-arrive');
      window.setTimeout(() => target.classList.remove('bz-people-arrive'), 420);
    }, 600);
  }, 120);
}

/** 反光 / 视差：指针在册内移动时写变量（不动 DOM、不重画） */
function setFx(x: number, y: number, box: DOMRect): void {
  if (!overlay) return;
  const px = Math.max(0, Math.min(1, (x - box.left) / Math.max(1, box.width)));
  const py = Math.max(0, Math.min(1, (y - box.top) / Math.max(1, box.height)));
  overlay.style.setProperty('--fx', `${(px * 100).toFixed(1)}%`);
  overlay.style.setProperty('--fy', `${(py * 100).toFixed(1)}%`);
  overlay.style.setProperty('--pnx', ((px - 0.5) * 2).toFixed(3));
  overlay.style.setProperty('--pny', ((py - 0.5) * 2).toFixed(3));
}

/** 选择器转义（id 可能是 wxid 之外的任意目录名） */
function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
}

// ---------------- 进度便签 / 合并横幅 ----------------

/** 进度便签（issue 505）：贴在册子左下沿；无活跃任务不出现；画完撕下来。
 *  509：引擎队列空而录音在跑时，同一位置出录音处理块（UI 层渲染，不入引擎队列）。 */
function renderNote(): void {
  const slot = overlay?.querySelector<HTMLElement>('[data-people-jobs-slot]');
  if (!slot) return;
  const item = currentJobsItem();
  if (!item) {
    const recRows = recNoteRows();
    if (recRows.length) slot.replaceChildren(recNote(recRows));
    else slot.replaceChildren();
    return;
  }
  const note = jobsNote(toBlockState(item));
  // 落下来这一下是**一次性的**：用掉就清（每次快照都重画便签，不清就会一秒落一次）
  if (animNote) { note.classList.add('bz-people-note-in'); animNote = false; }
  const old = slot.querySelector<HTMLElement>('.bz-people-jobs');
  if (old) old.replaceWith(note);
  else slot.replaceChildren(note);
  syncPhotoSeals(); // 451：照片角上的印跟帧刷新
}

/** 画完那一枚便签：揪着角撕下来，翻着个儿掉出册子 */
function tearNote(): void {
  const note = overlay?.querySelector<HTMLElement>('.bz-people-jobs');
  const box = note?.getBoundingClientRect();
  if (note && box?.width) {
    const clone = note.cloneNode(true) as HTMLElement;
    clone.classList.add('bz-people-tear');
    clone.style.left = `${box.left}px`;
    clone.style.top = `${box.top}px`;
    clone.style.width = `${box.width}px`;
    document.body.appendChild(clone);
    window.setTimeout(() => clone.remove(), 720);
  }
  overlay?.querySelector('[data-people-jobs-slot]')?.replaceChildren();
}

/** 合并横幅：横贴在册子上沿的一条纸（9 秒自己收，也能点 × 收起） */
let bannerSeq = 0;
let banner: { id: number; text: string; calm: boolean } | null = null;

function showBanner(text: string, calm = false): void {
  const id = ++bannerSeq;
  banner = { id, text, calm };
  renderBanner();
  window.setTimeout(() => {
    if (banner?.id === id) { banner = null; renderBanner(); }
  }, 9000);
}

function renderBanner(): void {
  const slot = overlay?.querySelector<HTMLElement>('[data-people-banner-slot]');
  if (!slot) return;
  if (!banner) { slot.replaceChildren(); return; }
  const node = mergeBanner(banner.text, banner.calm);
  if (animNote) node.classList.add('bz-people-note-in');
  slot.replaceChildren(node);
  mountIcons(slot);
}

// ---------------- 列表（折子封面墙） ----------------

/** 保库记录快照缓存（issue 452 语义沿用：墙要记录算素材水位；18k 条的仓每次切视图重解会卡；
 *  记录对象与 PeopleSafeStore 缓存同引用——写入路径原地 mutate，快照天然跟新） */
let recordCache: Map<string, PeopleSafeRecord> | null = null;

// —— 冷读加载态（issue 483）：解锁后首开面板 readAll 逐人解密期，骨架 + 「N/M」进度行 ——
/** 冷读进行中（进度回调窗口内为真；paintLoadCount 只在此窗口上屏） */
let loadActive = false;
/** 冷读进度（readAll 逐人回调喂入；total null = 清单尚未读到） */
let loadDone = 0;
let loadTotal: number | null = null;
/** 冷读去重：并发 records() 复用同一次 readAll（渲染跟帧 / 引擎订阅撞进同一窗口不再重复解密） */
let recordsInflight: Promise<Map<string, PeopleSafeRecord>> | null = null;

/** 进度原位刷新（issue 483；514 换进度卡钩子）：只换数字与进度条宽度，不重建骨架；
 *  面板没开 / 骨架已被真实数据替换则静默 */
function paintLoadCount(): void {
  if (!loadActive || !overlay) return;
  const num = overlay.querySelector<HTMLElement>('[data-people-load-num]');
  if (!num) return;
  num.textContent = String(loadDone);
  const totalEl = overlay.querySelector<HTMLElement>('.bz-people-load-total');
  if (totalEl) totalEl.textContent = loadTotal != null ? `/ ${loadTotal} 位` : '位';
  const pct = loadTotal && loadTotal > 0 ? Math.min(100, Math.round((loadDone / loadTotal) * 100)) : null;
  const fill = overlay.querySelector<HTMLElement>('[data-people-load-fill]');
  if (fill) fill.style.width = `${pct ?? 0}%`;
}

/** 保库记录读取（缓存到「面板关闭」「上锁」失效；读不到按空表兜底，照常出已有卡）。
 *  冷读（issue 483）：缓存不在时走 readAll 逐人解密，进度经回调刷进骨架的 N/M 计数；
 *  全库热读（重开面板缓存命中）不置加载态，渲染跟帧无感。 */
async function records(): Promise<Map<string, PeopleSafeRecord>> {
  if (recordCache) return recordCache;
  if (!peopleSafe) peopleSafe = await getPeopleSafeStore();
  if (recordsInflight) {
    // 复用在途冷读（483）：面板关了又开撞进同一窗口时重新武装指示态，进度行继续跟帧
    loadActive = true;
    paintLoadCount();
    return recordsInflight;
  }
  recordsInflight = (async () => {
    try {
      loadActive = true;
      loadDone = 0;
      loadTotal = null;
      const failedStat = { failedCount: 0 };
      const map = await peopleSafe!.readAll((done, total) => {
        loadTotal = total;
        loadDone = done;
        paintLoadCount();
      }, failedStat);
      // 单条坏记录不再拖垮全墙（readAll 已跳过），但损坏必须让人知道
      if (failedStat.failedCount > 0) {
        notice(`有 ${failedStat.failedCount} 条记录损坏，无法读取`, 'warning');
      }
      recordCache = map;
      return map;
    } catch (e) {
      console.warn('[people] 读取保库记录失败:', e);
      // 解锁态下的读失败按空表兜底（照旧，止住逐帧重试）；因上锁中途被打断则保持缓存失效——
      // 再解锁后按冷读重走（记录缓存已被上锁清掉，旧空表会把再解锁的首屏钉成假空墙）
      if (peopleSafe!.unlocked) recordCache = new Map();
      return recordCache ?? new Map();
    } finally {
      loadActive = false;
      recordsInflight = null;
    }
  })();
  return recordsInflight;
}

/**
 * 聊天仓素材 → 合成导入记录（issue 452）：条数 / 首尾跨度取时间线口径（text 非空，与改前一致）——
 * 这就是「已经导入了什么」的真实写照，让统计行、折子卡、详情头三处口径自动一致。
 * 无素材返回 null（清空后的残留仓不建占位卡）。
 * 合成记录**只喂渲染**：写入路径全走 PeopleStore.mutate（读盘上数据），不会落盘。
 */
function poolRecord(id: string, contact: StoreContact | undefined): ImportRecord | null {
  if (!contact) return null;
  const msgs = storeToUnified(contact.msgs ?? []);
  if (!msgs.length) return null;
  return {
    file: `数据源:${id}`,
    importedAt: contact.updatedAt || new Date(msgs[msgs.length - 1].ts).toISOString(),
    messageCount: msgs.length,
    skippedCount: 0,
    timeFrom: new Date(msgs[0].ts).toISOString(),
    timeTo: new Date(msgs[msgs.length - 1].ts).toISOString(),
    // issue 454：媒体计数取聊天仓侧写（导入时从原始消息算的，语音总时长只有它知道）——
    // 缺了它，合成卡与详情头的「语音 / 图片」永远是「—」（大琳 1289 条语音 / 1615 张图看不见）。
    // 只带媒体三项：月度 / 时段明细聊天仓没有，不在这编造——「数据」折见无 monthly 即出占位。
    stats: {
      voiceCount: contact.stats?.voiceCount ?? 0,
      voiceTotalSec: contact.stats?.voiceTotalSec ?? 0,
      imageCount: contact.stats?.imageCount ?? 0,
    },
  };
}

/**
 * 墙上人员 = 保库记录的人物卡全集（issue 452 语义沿用：有仓没卡者由迁移 / 导入补卡，
 * 面板侧兜底仍保留——记录里没有导入记录时用聊天仓素材合成「待画」占位卡，**纯内存**）。
 * records() 在前（issue 483）：冷读集中在带进度回调的那次 readAll，骨架的 N/M 跟的是
 * 真实解密慢阶段；随后 store.list() 全走缓存命中，不再有第二遍解密。
 */
async function wallPeople(): Promise<PersonEntry[]> {
  const recs = await records();
  const people = store ? await store.list() : [];
  // 501：记录里的 name 是导入当时的目录名（可能带重名唯一键后缀）——出墙前统一成纯名，
  // 列表 / 详情 / 生成提示词 / 印章都只看这一个 displayName；id 不动，仍是目录键
  const out: PersonEntry[] = people.map((p) => {
    const rec = p.imports.length ? null : poolRecord(p.id, recs.get(p.id)?.store);
    const named = { ...p, name: plainNameOf(p.name || p.id) };
    return rec ? { ...named, imports: [rec] } : named;
  });
  const known = new Set(people.map((p) => p.id));
  for (const [id, r] of recs) {
    if (known.has(id)) continue;
    const pool = poolRecord(id, r.store);
    if (!pool) continue;
    out.push({ ...r.person, id, name: plainNameOf(r.person.name || id), imports: [...r.person.imports, pool] });
  }
  return out;
}

/**
 * 占位卡写入前兜底（issue 452）：PeopleStore.mutate 对盘上不存在的 id 抛「人物不存在」，
 * 所以在占位卡上写档案 / 随手记前先落一张空卡（真卡由此诞生，之后画脸谱正常接上）。
 */
async function ensureEntry(id: string): Promise<void> {
  if (!store || !id) return;
  if ((await store.list()).some((p) => p.id === id)) return;
  const name = listCache.find((x) => x.id === id)?.name ?? id;
  await store.upsert({ id, name, createdAt: new Date().toISOString(), imports: [] });
}

/** 删除确认窗开着标记（防叠窗；Esc 与遮罩点击都归「取消」） */
/** 排序（448：工具条退役，固定最近互动优先；无导入记录按建卡时间兜底）——分页与「找一找」共用 */
function sortPeople(list: PersonEntry[]): PersonEntry[] {
  const lastSeen = (p: PersonEntry) => p.imports.reduce((m, r) => (r.timeTo > m ? r.timeTo : m), '');
  return [...list].sort((a, b) => (lastSeen(b) || b.createdAt).localeCompare(lastSeen(a) || a.createdAt));
}

/** 「找一找」重画后把焦点交回输入框（连打字不丢位置） */
function focusFind(): void {
  overlay?.querySelector<HTMLInputElement>('[data-people-find]')?.focus();
}

// ---------------- 删除流程（issue 500 / 501 / 502 续：确认是册子里的一页） ----------------

/**
 * 详情「删除联系人」：先按 {@link deleteTierOf} 判档，三档统一翻成删除册页——
 *   已画谱（有画像正文）→ 页内重输主密码（不可逆产物，同密文销毁防护）；
 *   未画谱 / 画谱未完成 → 本页二次确认（501 换真弹窗，502 续换成本域皮肤，505 换册页，
 *   506 已画谱那档也从宿主锁屏收进本页——一门到底，不再中途换屏）。
 * 只删保库记录（人物卡 + 聊天仓 + 脸谱 + 随手记 + 头像附件）；数据源目录与聊天原文不动，可重新导入。
 */
async function handleDelete(id: string): Promise<void> {
  if (!store) { notice('保险库未解锁——先解锁再删', 'info'); return; }
  const open = (p: PersonEntry): void => {
    openedTier = deleteTierOf(p, jobViews().get(id) ?? null);
    dialog = { kind: 'del', tier: openedTier };
    void renderAlbum().then(focusDelPw);
  };
  // 册子上摊着的这位就直接翻删除页——先出页、后读库（issue 507）：删除是册子里的一页，
  // 点下去就该翻过去；把它挂在一次异步读库后面，读慢的那几秒观感就是「点了没反应」。
  const here = listCache.find((x) => x.id === id) ?? null;
  if (here) { open(here); return; }
  const p = (await store.list()).find((x) => x.id === id) ?? null;
  if (!p) { notice('这位联系人已不在库里', 'info'); await renderAlbum(); return; }
  open(p);
}

/** 删除册页重画后把焦点交给主密码框（只有已画谱档有这枚框；没有就什么也不做） */
function focusDelPw(): void {
  overlay?.querySelector<HTMLInputElement>('[data-people-del-pw]')?.focus();
}

/** 确认页当前那一档（页上点「删除」时读它） */
let openedTier: DeleteTier = 'undrawn';

/** 删除页上的错误行（页内校验失败就地写，空串时 CSS 收起） */
function setDelError(msg: string): void {
  const box = overlay?.querySelector<HTMLElement>('[data-people-del-err]');
  if (box) box.textContent = msg;
}

/**
 * 已画谱的删除门禁（issue 500 / 506）：主密码就在删除册页里重输，走
 * `SafeManager.verifyPassword` **只读**校验——通过才删，失败留在页上改。
 * 这是防误触确认而非解锁，不改解锁态、不进解锁冷却节流（同 encrypt 域密文销毁口径）。
 */
async function confirmDeleteFromPage(p: PersonEntry, btn: HTMLButtonElement): Promise<void> {
  const input = overlay?.querySelector<HTMLInputElement>('[data-people-del-pw]') ?? null;
  const pw = input?.value ?? '';
  if (!pw) { setDelError('请输入主密码确认'); input?.focus(); return; }
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '正在确认…';
  try {
    if (await getSafeManager().verifyPassword(pw)) { await deletePerson(p); return; }
    setDelError('主密码不对，再试一次。');
    if (input) { input.value = ''; input.focus(); }
  } catch (e) {
    setDelError(`校验失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    // 删成功后本页连同详情一起销毁，这里的复位只对「失败留下」那条路有意义
    if (btn.isConnected) { btn.disabled = false; btn.textContent = label; }
  }
}

/**
 * 落地删除（issue 500）：先停该人未完成的任务——引擎是保库记录的唯一写方，
 * 任务还在队列里会把 job 段（乃至 done 产物）写回来，删了等于白删。
 * 501：删完还要把面板的记录快照里的这一条摘掉——{@link wallPeople} 会把
 * 「记录里有、人物卡里没有」的 id 拿聊天仓素材合成「待画」占位卡，不摘的话
 * 卡片会一直挂在册子上，要等关面板（快照失效）才消失。
 */
async function deletePerson(p: PersonEntry): Promise<void> {
  try {
    const stopped = await Promise.resolve(jobs().removeJob(p.id));
    await store!.remove(p.id);
    recordCache?.delete(p.id);
    if (pulled === p.id) pulled = null;
    detailId = null;
    dialog = null;
    notice(stopped ? `已删除「${p.name}」，未完成的任务一并停掉` : `已删除「${p.name}」`, 'delete');
    void renderAlbum();
  } catch (e) {
    notifyActionError(e, `删除「${p.name}」`);
  }
}

// ---------------- 详情（折页册） ----------------

// ---------------- 互动数据（issue 440：纯本地统计展示；447 收进「数据」折） ----------------

/** 统计卡实时形态（issue 513）：读保库 store.kindCounts（全量口径，含并仓的录音轮次等）。
 *  到货后若统计页还开着就重画；上锁 / 读失败回落 null = 用导入快照，不劣化。
 *  先清后读：换人打开时不能把上一位的形态缓存安到新头上。 */
async function refreshStatsKinds(): Promise<void> {
  const talker = detailId;
  if (!talker) return;
  statsKinds = null;
  if (!peopleSafe) peopleSafe = await getPeopleSafeStore();
  let kinds: Record<string, number> | null = null;
  try {
    kinds = (await peopleSafe.read(talker))?.store.kindCounts ?? null;
  } catch {
    kinds = null; // 读不到按零值回落导入快照
  }
  if (detailId !== talker) return; // await 期间换人：旧形态不顶替新视图（B 组审查 P3）
  statsKinds = kinds;
  if (dialog?.kind === 'stats') void renderAlbum();
}

/**
 * 数据折互动卡：形态与总量用**实时全量**（保库 store.kindCounts，含并仓的录音轮次等，issue 513），
 * 读不到（上锁 / 失败）回落最近一次导入的冻结快照；谁主动 / 回复时延 / 活跃时段 / 月度图保留
 * 导入快照口径——导入历史语义不变。
 * 判定口径是**有没有明细**（monthly），不是「有没有 stats」——452 的合成记录只带媒体三项
 * （issue 454：给详情头 / 卡面徽章供数），拿它画统计卡会得到一张全 0 的空卡，比占位更糟。
 */
function buildInsightsCard(p: PersonEntry, liveKinds?: Record<string, number> | null): HTMLElement | null {
  if (!p.imports.length) return null;
  const latest = [...p.imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  const s = latest.stats;
  if (!s?.monthly?.length) return null;
  const live = liveKinds && Object.keys(liveKinds).length ? liveKinds : null;
  const totalMsg = live ? Object.values(live).reduce((a, n) => a + n, 0) : s.monthly.reduce((a, [, n]) => a + n, 0);
  const rows = document.createElement('div');
  rows.className = 'bz-people-ins-rows';
  // 谁主动：会话发起占比条 + 数字
  const byMe = s.initiatedByMe ?? 0;
  const byOther = s.initiatedByOther ?? 0;
  const initiated = byMe + byOther;
  rows.appendChild(insRow('谁主动', initiated
    ? duoBar(Math.round((byMe / initiated) * 100), Math.round((byOther / initiated) * 100))
    : duoBar(0, 0), initiated ? `我 ${byMe} · 对方 ${byOther}` : '暂无会话'));
  // 回复时延（issue 449）：优先中位数（更抗刷屏失真），旧数据无中位数字段回落平均
  rows.appendChild(insRow('回复时延', '', `我 ${formatReplySec(replyLatencySec(s.myMedianReplySec, s.myAvgReplySec))} · 对方 ${formatReplySec(replyLatencySec(s.otherMedianReplySec, s.otherAvgReplySec))}`));
  // 活跃时段：双方合计的 24 小时分布
  const hourly = (s.myHourly ?? []).map((n, i) => n + (s.otherHourly?.[i] ?? 0));
  const max = hourly.length ? Math.max(...hourly) : 0;
  const total = hourly.reduce((a, n) => a + n, 0);
  const strip = el('div', 'bz-people-strip', hourly.map((n, i) => {
    const h = max > 0 && n > 0 ? Math.max(Math.round((n / max) * 100), 6) : 0;
    return el('div', 'bz-people-strip-bar', { style: `height:${h}%`, title: `${i} 点 · ${n} 条` });
  }));
  rows.appendChild(insRow('活跃时段', strip, total ? `峰值 ${hourly.indexOf(max)} 点` : '—'));
  // 形态占比（issue 513：优先实时全量——含并仓的录音轮次；快照回落）
  const kinds = Object.entries(live ?? s.kindCounts ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (kinds.length) rows.appendChild(insRow('消息形态', kindChips(kinds), ''));
  return insightsCard(importMeta(latest, totalMsg), latest.file, monthlyChart(s.monthly), rows);
}

function insRow(label: string, mid: HTMLElement | string, val: string): HTMLElement {
  return el('div', 'bz-people-ins-row', [
    el('span', 'bz-people-ins-label', text(label)),
    typeof mid === 'string' ? textEl('span', '') : mid,
    el('span', 'bz-people-ins-val', text(val)),
  ]);
}

// ---------------- 卡墙（448：排序固定最近互动，筛选/搜索退役） ----------------

/** 人物媒体统计：跨导入累计（零素材返回 null——徽章空数据不渲染） */
export function personMedia(p: PersonEntry): MediaStats | null {
  const acc = emptyMediaStats();
  for (const r of p.imports) {
    const s = r.stats;
    if (!s) continue;
    acc.voiceCount += s.voiceCount ?? 0;
    acc.voiceTotalSec += s.voiceTotalSec ?? 0;
    acc.imageCount += s.imageCount ?? 0;
    acc.recordingCount = (acc.recordingCount ?? 0) + (s.recordingCount ?? 0);
    acc.recordingTotalSec = (acc.recordingTotalSec ?? 0) + (s.recordingTotalSec ?? 0);
  }
  return acc.voiceCount || acc.imageCount || acc.recordingCount ? acc : null;
}

// ---------------- 合并重复人物（issue 442） ----------------

async function handleMergeConfirm(): Promise<void> {
  const fromId = mergeFromId;
  const toId = mergeToId;
  if (!store || !fromId || !toId || fromId === toId) return;
  const from = listCache.find((x) => x.id === fromId);
  const to = listCache.find((x) => x.id === toId);
  try {
    await store.mergeInto(fromId, toId);
    // 合并走横幅（横贴册沿的一条纸）：状态类告知不打断手上动作（原型定稿口径）
    showBanner(`已把「${from?.name ?? fromId}」并到「${to?.name ?? toId}」——原人物已删除，要更新脸谱可从数据源补画`, true);
  } catch (e) {
    notifyActionError(e, '合并人物');
  }
  mergeFromId = null;
  mergeToId = null;
  void renderAlbum();
}

// ---------------- 档案与随手记（issue 439） ----------------
// 手动输入路径：档案落盘走 store.updateProfile，随手记走 store.addManualEvent /
// removeManualEvent；显式保存按钮写盘，不随 input 落盘。

/** 编辑态 / 记一笔态只对当前人物生效（换人即自然退出；面板关闭在 closePeoplePanel 一并重置） */
let profEditId: string | null = null;
let noteAddId: string | null = null;
// —— 档案编辑脏守卫（D 组拍板）：input 过后即脏；脏着离开（合上这页 / 切折 / 重开 / Esc）
// 先劫持成行内确认，放弃才清编辑态并放行原动作，继续编辑留在原地 ——
let profDirty = false;
/** 行内确认开着（只在脏态出现；编辑卡上方一条「改动还没保存——放弃？」） */
let profLeaveConfirm = false;
/** 被劫持的原动作（放弃后放行） */
let profPendingLeave: (() => void) | null = null;

/** 编辑卡内的输入 / 结构改动即脏（进编辑态才有编辑卡，profEditId 为空时不必记账） */
function markProfDirty(): void {
  if (profEditId !== null) profDirty = true;
}

/**
 * 离开编辑态的统一守卫：不脏（或不在档案编辑页）直走；脏则劫持成行内确认。
 * 确认条**就地插入**不整页重画——编辑卡的值只活在 DOM 里，重画会把没保存的字连同节点一起抹掉。
 */
function guardProfLeave(perform: () => void): void {
  if (dialog?.kind !== 'prof' || profEditId === null || !profDirty) { perform(); return; }
  profPendingLeave = perform;
  if (!profLeaveConfirm) {
    profLeaveConfirm = true;
    const page = overlay?.querySelector<HTMLElement>('[data-people-sub="prof"] .bz-people-pagebody');
    if (page && !page.querySelector('[data-people-prof-leave-ok]')) page.prepend(profLeaveAsk());
  }
}

/** 确认里的「放弃」：清编辑态与脏账，再放行被劫持的原动作（原动作自带重画，内容随之弃）。
 *  注意先取走 pending 再清账——clearProfEditState 会一并清它，反过来取就成了空操作。 */
function discardProfEdit(): void {
  const go = profPendingLeave;
  clearProfEditState();
  go?.();
}

/** 确认里的「继续编辑」：收起确认条，留在原地（不打重画，输入值原样保留） */
function keepProfEdit(): void {
  profLeaveConfirm = false;
  profPendingLeave = null;
  overlay?.querySelector('.bz-people-prof-leaveask')?.remove();
}

/** 退出编辑态时清账（保存 / 显式取消 / 面板关闭等不含「放弃确认」的路径共用） */
function clearProfEditState(): void {
  profEditId = null;
  profDirty = false;
  profLeaveConfirm = false;
  profPendingLeave = null;
}

function addTagChip(): void {
  const input = overlay?.querySelector<HTMLInputElement>('[data-people-prof-tag-input]');
  const list = overlay?.querySelector<HTMLElement>('[data-people-prof-tag-list]');
  const v = (input?.value ?? '').trim();
  if (!input || !list || !v) return;
  markProfDirty(); // 加了标签就是改了内容（脏守卫与输入框同一本账）
  const dupes = new Set(
    Array.from(list.querySelectorAll('.bz-people-prof-tag-text')).map((n) => (n.textContent ?? '').trim())
  );
  if (!dupes.has(v)) list.appendChild(tagChip(v));
  input.value = '';
  input.focus();
}

/** 读编辑卡全量输入 → updateProfile；整卡为空 = 清档案（落盘 undefined） */
/** AI 补充背景进行中（防双击；完成/失败都复位） */
let profAiBusy = false;

/**
 * AI 补充背景（455 评审建；issue 487 契约扩到全部维度）：读交往素材（事件 / 原话 / 场景 /
 * 特质 / 兴趣 / 未竟，全部已落盘的提炼素材）推断缺失档案字段，只填编辑表单里的**空白**项
 * ——手填的绝不覆盖，填完停在编辑态等用户检查保存。prompt 与解析走 digest 单源
 * （buildProfileExtractPrompt / parseProfileReply）。隐私口径不变：不送聊天原文。
 */
async function aiFillProfile(): Promise<void> {
  if (profAiBusy || !store || !detailId || !overlay) return;
  const p = listCache.find((x) => x.id === detailId);
  if (!p) return;
  const dg = p.digest;
  if (!dg) { notice('还没有脸谱素材——先导入并画脸谱，AI 才有据可依', 'warning'); return; }
  const talker = detailId; // 起跑时把人记下（B 组审查 P2）：等待期间换人，结果不许填进别家的表单
  if (profEditId !== detailId) { profEditId = detailId; await renderAlbum(); } // 表单在编辑卡里，先进入编辑态
  profAiBusy = true;
  notice('AI 正在读交往素材补充背景…', 'info');
  try {
    const prompt = buildProfileExtractPrompt(p.name, profileExtractMaterial(dg), knownProfileText(p.profile));
    const data = parseProfileReply(await createAI().json(prompt));
    if (detailId !== talker || !overlay) return; // await 期间换人 / 关面板：这次回包作废，一个字都不写
    let filled = 0;
    // 自由文本字段：只填空白输入行
    for (const f of PROFILE_TEXT_FIELDS) {
      const v = String((data as Record<string, unknown>)[f] ?? '').trim();
      if (!v) continue;
      const inp = overlay.querySelector<HTMLInputElement>(`[data-people-prof-field="${f}"]`);
      if (inp && !inp.value.trim()) { inp.value = v; filled++; }
    }
    // 数组字段：tags 走标签片（列表空才补）；interests / likes / dislikes 回填顿号串（空白才填）
    for (const f of PROFILE_LIST_FIELDS) {
      const arr = data[f];
      if (!arr?.length) continue;
      if (f === 'tags') {
        const tagList = overlay.querySelector('[data-people-prof-tag-list]');
        if (tagList && tagList.children.length === 0) {
          for (const t of arr.slice(0, 3)) tagList.appendChild(tagChip(t));
          filled++;
        }
        continue;
      }
      const inp = overlay.querySelector<HTMLInputElement>(`[data-people-prof-field="${f}"]`);
      if (inp && !inp.value.trim()) { inp.value = arr.join('、'); filled++; }
    }
    // 结构维度：行列表为空才补（手加过行就不动）
    const relList = overlay.querySelector('[data-people-prof-rel-list]');
    if (relList && relList.children.length === 0 && data.relationships?.length) {
      for (const r of data.relationships.slice(0, 6)) relList.appendChild(relationRow(r.who, r.relation));
      filled++;
    }
    const dateList = overlay.querySelector('[data-people-prof-date-list]');
    if (dateList && dateList.children.length === 0 && data.importantDates?.length) {
      for (const d of data.importantDates.slice(0, 6)) dateList.appendChild(dateRow(d.date, d.what));
      filled++;
    }
    if (filled > 0) notice(`AI 已补 ${filled} 项，请检查后点「保存档案」`, 'success');
    else notice('素材里没有能支撑的档案信息，未作补充', 'info');
  } catch (e) {
    notifyActionError(e, 'AI 补充背景');
  } finally {
    profAiBusy = false;
  }
}

async function saveProfile(): Promise<void> {
  if (!store || !detailId || !overlay) return;
  await ensureEntry(detailId); // 452：占位卡（聊天仓合成，盘上还没卡）先落一张空卡
  const val = (sel: string) => overlay!.querySelector<HTMLInputElement>(sel)?.value?.trim() ?? '';
  // 三种结构行共用 socials 的行类名，按内嵌 data 钩子区分归属
  const allRows = Array.from(overlay.querySelectorAll('.bz-people-prof-subrow'));
  const rowVal = (row: Element, hook: string) => row.querySelector<HTMLInputElement>(`[${hook}]`)?.value?.trim() ?? '';
  const socialRows = allRows.filter((row) => row.querySelector('[data-people-prof-social-platform]'));
  const relRows = allRows.filter((row) => row.querySelector('[data-people-prof-rel-who]'));
  const dateRows = allRows.filter((row) => row.querySelector('[data-people-prof-date-date]'));
  const socials = socialRows
    .map((row) => ({ platform: rowVal(row, 'data-people-prof-social-platform'), handle: rowVal(row, 'data-people-prof-social-handle') }))
    .filter((s) => s.platform && s.handle);
  const relationships = relRows
    .map((row) => ({ who: rowVal(row, 'data-people-prof-rel-who'), relation: rowVal(row, 'data-people-prof-rel-relation') }))
    .filter((r) => r.who && r.relation);
  const importantDates = dateRows
    .map((row) => ({ date: rowVal(row, 'data-people-prof-date-date'), what: rowVal(row, 'data-people-prof-date-what') }))
    .filter((d) => d.date && d.what);
  const partial = socialRows.length - socials.length + relRows.length - relationships.length + dateRows.length - importantDates.length;
  const tagTexts = Array.from(overlay.querySelectorAll('[data-people-prof-tag-list] .bz-people-prof-tag-text'))
    .map((n) => (n.textContent ?? '').trim())
    .filter(Boolean);
  const tags = [...new Set(tagTexts)];
  // 数组维度：顿号 / 逗号切分，去空去重（issue 487）
  const splitList = (name: string): string[] => {
    const raw = val(`[data-people-prof-field="${name}"]`);
    if (!raw) return [];
    return [...new Set(raw.split(/[、,，;；\n]+/).map((s) => s.trim()).filter(Boolean))];
  };
  const interests = splitList('interests');
  const likes = splitList('likes');
  const dislikes = splitList('dislikes');
  const profile: PersonProfile = {};
  const f = {
    birthday: val('[data-people-prof-field="birthday"]'),
    nickname: val('[data-people-prof-field="nickname"]'),
    metVia: val('[data-people-prof-field="metVia"]'),
    metAt: val('[data-people-prof-field="metAt"]'),
    hometown: val('[data-people-prof-field="hometown"]'),
    job: val('[data-people-prof-field="job"]'),
    personality: val('[data-people-prof-field="personality"]'),
    quote: val('[data-people-prof-field="quote"]'),
    habits: val('[data-people-prof-field="habits"]'),
    recentLife: val('[data-people-prof-field="recentLife"]'),
    note: val('[data-people-prof-field="note"]'),
  };
  if (f.birthday) profile.birthday = f.birthday;
  if (f.nickname) profile.nickname = f.nickname;
  if (f.metVia) profile.metVia = f.metVia;
  if (f.metAt) profile.metAt = f.metAt;
  if (f.hometown) profile.hometown = f.hometown;
  if (f.job) profile.job = f.job;
  if (f.personality) profile.personality = f.personality;
  if (f.quote) profile.quote = f.quote;
  if (f.habits) profile.habits = f.habits;
  if (f.recentLife) profile.recentLife = f.recentLife;
  if (f.note) profile.note = f.note;
  if (socials.length) profile.socials = socials;
  if (tags.length) profile.tags = tags;
  if (interests.length) profile.interests = interests;
  if (likes.length) profile.likes = likes;
  if (dislikes.length) profile.dislikes = dislikes;
  if (relationships.length) profile.relationships = relationships;
  if (importantDates.length) profile.importantDates = importantDates;
  const empty =
    !socials.length && !tags.length && !interests.length && !likes.length && !dislikes.length &&
    !relationships.length && !importantDates.length && !Object.keys(profile).length;
  try {
    await store.updateProfile(detailId, empty ? undefined : profile);
    clearProfEditState();
    notice(empty ? '档案已清空' : '档案已保存', 'success');
    if (partial > 0) notice(`${partial} 行没填完整，已跳过`, 'warning');
  } catch (e) {
    notifyActionError(e, '保存档案');
  }
  void renderAlbum();
}

async function saveManualNote(): Promise<void> {
  if (!store || !detailId || !overlay) return;
  const summary = overlay.querySelector<HTMLInputElement>('[data-people-note-text]')?.value?.trim() ?? '';
  if (!summary) { notice('随手记还没写内容', 'warning'); return; }
  const ts = overlay.querySelector<HTMLInputElement>('[data-people-note-date]')?.value?.trim() || todayStr();
  try {
    await ensureEntry(detailId); // 452：占位卡先落一张空卡，再记（mutate 对不存在的 id 会抛）
    await store.addManualEvent(detailId, { id: genId(), ts, summary, createdAt: new Date().toISOString() });
    noteAddId = null;
    // 记完留在这一页（复评：下面就是已记列表，写一条看一眼；关掉再开反而绕）
    notice('已记一笔', 'success');
  } catch (e) {
    notifyActionError(e, '记随手记');
  }
  void renderAlbum();
}

async function removeManualNote(evId: string): Promise<void> {
  if (!store || !detailId || !evId) return;
  try {
    // notice 带内容摘要：手动录入不可再生，误删至少要有感（448 评审 P2 最小改动档）
    const found = (await store.list()).find((p) => p.id === detailId)?.manualEvents?.find((m) => m.id === evId);
    await store.removeManualEvent(detailId, evId);
    const brief = found?.summary ? `：${[...found.summary].slice(0, 20).join('')}${[...found.summary].length > 20 ? '…' : ''}` : '';
    notice(`已删除随手记${brief}`, 'delete');
  } catch (e) {
    notifyActionError(e, '删除随手记');
  }
  void renderAlbum();
}

// ---------------- 补充素材（issue 509 / ADR-0212：图片落盘并仓、录音任务、质心） ----------------

/** 桌面端 fs（同 datasource 口径；非桌面端 null——补充素材整页只桌面可用） */
function suppFs(): any {
  const w = typeof window === 'undefined' ? null : (window as any);
  if (!w || !w.require) return null;
  try {
    return w.require('fs');
  } catch {
    return null;
  }
}

/** 数据根（未配置 = 空串；补充素材的落盘 / 工具脚本都挂它） */
function suppDataRoot(): string {
  return dsDataDir();
}

/** pythonPath 设置键（录音 / 质心工具用；空 = 跟随 PATH 上的 python） */
function suppPython(): string {
  const s = (tryGetSettings() ?? {}) as Record<string, unknown>;
  return typeof s.pythonPath === 'string' ? s.pythonPath.trim() : '';
}

/** ffmpegPath 设置键（录音转 16k wav 用，issue 510 对齐 prep；空 = 跟随 PATH 上的 ffmpeg） */
function suppFfmpeg(): string {
  const s = (tryGetSettings() ?? {}) as Record<string, unknown>;
  return typeof s.ffmpegPath === 'string' ? s.ffmpegPath.trim() : '';
}

/** 录音 / 质心起跑前的版本门：本机 bz-face 探测过且过旧 → 人话引导，不起跑 */
async function suppFaceGate(): Promise<boolean> {
  const err = faceRecSupportError(await probeFaceCapabilities());
  if (err) {
    notice(err, 'warning');
    return false;
  }
  return true;
}

/** 开页 / 并仓后刷新聊天仓侧事实（图片统计 + 已并录音集合），刷完重画弹窗 */
async function refreshSuppStoreInfo(talker: string): Promise<void> {
  if (!peopleSafe) peopleSafe = await getPeopleSafeStore();
  let imported = 0;
  let undescribed = 0;
  let broken = 0;
  let missing = 0;
  const mergedRecs = new Set<string>();
  const imageItems: Array<{ img: string; text: string; skip?: DescSkip; label?: string }> = [];
  try {
    const rec = await peopleSafe.read(talker);
    for (const m of rec?.store.msgs ?? []) {
      if (m.type === 3 && m.img) {
        imported++;
        // 敏感标注的图不算未描述（ADR-0224）：标注是终态，计进欠账会与「生成描述」按钮的
        // 可用性、开工单待办口径对不上
        // 敏感标注的图不算未描述（ADR-0224）：标注是终态，计进欠账会与「生成描述」按钮的
        // 可用性、开工单待办口径对不上。源图损坏 / 缺失（ADR-0225）同理，且单独计数上屏。
        const skip = descSkipOf(m);
        if (skip === BROKEN_SKIP) broken++;
        else if (skip === MISSING_SKIP) missing++;
        imageItems.push(skip ? { img: m.img, text: m.text, skip, label: SKIP_LABEL[skip] } : { img: m.img, text: m.text });
        if (m.text === '' && !skip) undescribed++;
      }
      if (m.key.startsWith('rec:')) {
        const end = m.key.lastIndexOf(':');
        if (end > 4) mergedRecs.add(m.key.slice(4, end));
      }
    }
  } catch {
    /* 读不到按零值渲染 */
  }
  if (!overlay || suppOwnerId !== talker) return; // await 期间换人 / 关面板：旧仓账不顶替新页（B 组审查 P3）
  suppStoreInfo = { imported, undescribed, broken, missing, mergedRecs, imageItems: imageItems.reverse() };
  if (dialog?.kind === 'note') void renderAlbum();
}

function suppImageState(): SuppImageViewState {
  const running = jobsApi.isDescribeOnlyBusy();
  const root = suppDataRoot();
  const talker = detailId ?? '';
  // 预览网格（issue 519 分片）：只切已展开的前段换 data URL——缩略档命中读小图，
  // 缺档回退原图并后台补齐；全量一次拉齐是开页冻死的病根，不再犯。
  // 只在留影页签才算（note 弹窗每个页签每轮重画都会路过这里）：录音页千张全展开时
  // 不该白跑一遍千次 existsSync。
  const active = suppTab === 'image' && Boolean(root && talker);
  const total = active ? suppStoreInfo.imageItems.length : 0;
  const shown = Math.min(suppImgShown, total);
  return {
    queue: suppImages,
    imported: suppStoreInfo.imported,
    undescribed: suppStoreInfo.undescribed,
    broken: suppStoreInfo.broken,
    missing: suppStoreInfo.missing,
    describeBusy: running,
    modelLabel: `${describeModelLabelOf().provider}/${describeModelLabelOf().model}`,
    items: active
      ? suppStoreInfo.imageItems.slice(0, shown).map((it) => ({ ...it, url: suppGridImgOf(root!, talker!, it.img) }))
      : [],
    hidden: Math.max(0, total - shown),
    ...(suppImgDelPending ? { imgDel: suppImgDelPending } : {}),
  };
}

/** 网格取图（issue 519）：优先 240px 缩略档；缺档回退原图 data URL 并入队后台补齐，
 *  补上后原位换图（不整页重画）。thumb 缺档时**不过** localImgOf——空串会被按路径缓存住，
 *  档补齐后原位换图 / 重画取小图全都命中空串，管线整个白做。坏档（存在但读不出）
 *  同样回退原图，由 settled 记账不再空转。 */
function suppGridImgOf(root: string, talker: string, img: string): string {
  const thumbAbs = descThumbPath(root, talker, img);
  const fs2 = suppFs();
  if (!fs2) return ''; // 非桌面：补充素材整页不可用，别碰缓存
  if (fs2.existsSync(thumbAbs)) {
    const thumbUrl = localImgOf(thumbAbs);
    if (thumbUrl) return thumbUrl;
  }
  if (!thumbHandled(thumbAbs)) {
    queueThumbBuild(fs2, descImagePath(root, talker, img), thumbAbs, (ok) => {
      if (ok) swapGridThumb(talker, img, thumbAbs);
    });
  }
  return localImgOf(descImagePath(root, talker, img));
}

/** 缩略档补齐后原位换图：这张格子在弹窗里还挂着原图回退的话悄悄换成小图。
 *  人对不上就不换（关面板→重开的窄窗里在跑任务的回调还活着；跨人同名相对路径
 *  会把旧人的缩略塞进新人的格——下次重画自愈的便宜不占，直接不动手）。 */
function swapGridThumb(talker: string, img: string, thumbAbs: string): void {
  const url = localImgOf(thumbAbs);
  if (!url || !overlay || detailId !== talker) return;
  overlay.querySelectorAll<HTMLImageElement>('[data-people-supp-img-view]').forEach((im) => {
    if (im.getAttribute('data-people-supp-img-view') === img && im.src !== url) im.src = url;
  });
}

/** 摘掉哨兵观察（幂等） */
function disarmSuppImgMore(): void {
  suppImgMoreIO?.disconnect();
  suppImgMoreIO = null;
}

/** 留影网格追加下一片（哨兵进视口自动 / 点哨兵兜底）；返回当前哨兵（没有更多 = null） */
function growSuppImgGrid(): HTMLElement | null {
  const talker = detailId;
  const root = suppDataRoot();
  const grid = overlay?.querySelector<HTMLElement>('.bz-people-supp-imggrid');
  // 同源守卫：非 note 弹窗 / 换人清仓后的 await 窗口里，旧哨兵的 IO 不替新页追加
  if (!talker || !root || !grid || dialog?.kind !== 'note' || suppOwnerId !== detailId) return null;
  const total = suppStoreInfo.imageItems.length;
  const from = Math.min(suppImgShown, total);
  const to = Math.min(suppImgShown + SUPP_IMG_PAGE, total);
  if (from >= to) return grid.querySelector<HTMLElement>('[data-people-supp-img-more]');
  const page = suppStoreInfo.imageItems.slice(from, to).map((it) => ({ ...it, url: suppGridImgOf(root, talker, it.img) }));
  suppImgShown = to;
  // 只 append 不走 renderAlbum：全量重建千格是同一笔卡账的第二处（增量路就是为绕开它）
  const more = appendSuppImageGridPage(grid, page, Math.max(0, total - to), suppImgDelPending ?? undefined);
  return more;
}

/** 重挂哨兵观察（rootMargin 提前量：滚到离底一屏就开始拼下一片，不露等待；
 *  IO 缺席的环境不挂——哨兵点击兜底还在） */
function armSuppImgMore(sentinel: HTMLElement | null): void {
  disarmSuppImgMore();
  if (!sentinel || typeof IntersectionObserver === 'undefined') return;
  suppImgMoreIO = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    disarmSuppImgMore();
    armSuppImgMore(growSuppImgGrid());
  }, { rootMargin: '600px 0px' });
  suppImgMoreIO.observe(sentinel);
}

/** 账本是否本轮起跑后落过笔（fs mtime 判；读不到 / 无起跑时刻 = 旧账，按冷加载期算） */
function recSidecarFresh(fs2: any, key: string, startedAt: number | undefined): boolean {
  if (!startedAt) return false;
  try {
    return fs2.statSync(key).mtimeMs >= startedAt;
  } catch {
    return false;
  }
}

/** running 行 / 进度块共用的进度主文案（issue 511；不含耗时——elapsed 有独立显示位）：
 *  load 段给冷加载预期消除「像卡死」，处理段优先脚本的 progress.text（自带段内 done/total）。 */
function recRunningPtext(side: RecordingSidecar | null, stage: ReturnType<typeof recordingStageOf>): string {
  if (stage === 'load') return '启动模型…（首次冷加载约 1-2 分钟）';
  return side?.progress?.text ?? `${suppRecStageLabel(stage)}…`;
}

/** 删除确认态（issue 516 Q13）：已画过谱要说清「正文不会随之改写」 */
function recDelState(): SuppRecViewState['del'] {
  if (!recDelPending) return undefined;
  const p = listCache.find((x) => x.id === detailId) ?? null;
  const drawn = p ? deleteTierOf(p, sealJobOf(jobViews().get(p.id))) === 'drawn' : false;
  return { file: recDelPending, alsoFile: recDelAlsoFile, drawn };
}

/**
 * 「我」的头像（issue 529 起解析单源在 me-avatar.ts）：自定义图（设置 peopleMyAvatar，
 * 库内相对路径 / 库外绝对路径读字节转 data URL）→ 微信数据里扒出来的本人头像 → 空（首字印）。
 * 面板每次打开清一次字节缓存（同路径换了图不用重载插件）。
 */
function myAvatarOf(): string {
  const s = tryGetSettings() as { peopleMyAvatar?: string } | null;
  return resolveMyAvatar(s?.peopleMyAvatar, dsDataDir());
}

/** 「查看轮次」的展示态（面板内读 sidecar，含旁音轮；与 `<名>.turns.md` 同口径） */
function recTurnsViewState(root: string, talker: string, otherAvatar: string): SuppRecViewState['turnsView'] {
  if (!recTurnsFile) return undefined;
  const side = readRecordingSidecar(root, talker, recTurnsFile);
  const turns = side?.turns ?? [];
  const base = recordingStartOf(root, talker, recTurnsFile, recMtimeOf(root, talker, recTurnsFile));
  const p2 = (n: number): string => String(n).padStart(2, '0');
  // 段界单源（ADR-0220 §7）：与并仓的段切分同一判据，预览里能直接对上「并成几条」
  const segs = recordingTurnSegments(turns);
  return {
    file: recTurnsFile,
    meAvatar: myAvatarOf(),
    otherAvatar,
    lines: turns.map((t, i) => {
      const emo = String(t.emotion ?? '').trim();
      const date = new Date(base + Math.round((Number(t.start) || 0) * 1000));
      const sg = segs[i] ?? { seg: 0, head: false };
      return {
        idx: i + 1,
        at: `${p2(date.getHours())}:${p2(date.getMinutes())}:${p2(date.getSeconds())}`,
        range: `${fmtClock(t.start)}-${fmtClock(t.end)}`,
        speaker: String(t.speaker ?? '').trim() || '?',
        ...(emo ? { emotion: emo } : {}),
        text: String(t.text ?? '').trim(),
        side: String(t.speaker ?? '').trim() === SIDE_SPEECH_SPEAKER,
        ...(sg.seg > 0 ? (sg.head ? { segHead: sg.seg } : { segCont: true }) : {}),
      };
    }),
  };
}

/** 录音原件 mtime（起点回落用；读不到 undefined） */
function recMtimeOf(root: string, talker: string, file: string): number | undefined {
  try {
    return suppFs()?.statSync(`${recordingsDirOf(root, talker)}/${file}`).mtimeMs;
  } catch {
    return undefined;
  }
}

function suppRecState(talker: string, otherAvatar = ''): SuppRecViewState {
  const rows: SuppRecRowState[] = [];
  const root = suppDataRoot();
  const del = recDelState();
  /** 起点（meta 优先，回落旧口径）：行上可见、改起点时预填 */
  const startOf = (file: string): number => recordingStartOf(root, talker, file, recMtimeOf(root, talker, file));
  const refKey = `ref:${talker}`;
  const refBusy = isRecordingRunning(refKey) || isRecordingQueued(refKey);
  const ref: SuppRecViewState['ref'] = refBusy ? 'building' : voiceprintRefStatus(root, talker);
  const fs2 = suppFs();
  if (!fs2 || !root) return { rows, ref, queue: suppRecQueue, ...(del ? { del } : {}), ...(recRefConfirm ? { refConfirm: true } : {}) };
  const dir = recordingsDirOf(root, talker);
  let files: string[] = [];
  try {
    files = fs2
      .readdirSync(dir)
      .filter((f: string) => isRecordingFile(f)) // 派生物后缀单源过滤（recording.ts，ADR-0217）
      .filter((f: string) => {
        try {
          return fs2.statSync(`${dir}/${f}`).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return { rows, ref, queue: suppRecQueue, ...(del ? { del } : {}), ...(recRefConfirm ? { refConfirm: true } : {}) }; // 目录还没有 = 还没加过录音
  }
  const runMap = new Map(runningRecordingItems().map((r) => [r.path, r]));
  for (const f of files) {
    const key = recordingSidecarPath(root, talker, f);
    const side = readRecordingSidecar(root, talker, f);
    // 并仓只认仓事实（mergedRecs）：sidecar done 但没并上（上锁竞态等）出「待并仓」，可手动补并
    const merged = suppStoreInfo.mergedRecs.has(f);
    if (isRecordingQueued(key)) {
      // 排队中（ADR-0218 决策 5）：全局一条串行，排队行只给「移出队列」（排队中不给删除，Q14）
      rows.push({ file: f, status: 'queued', phaseText: '', pct: null, queuePos: recordingQueuePosition(key) });
      continue;
    }
    if (isRecordingRunning(key)) {
      const it = runMap.get(key);
      const stage = recordingStageOf(side, recSidecarFresh(fs2, key, it?.startedAt));
      const elapsed = it ? formatRecElapsed(Date.now() - it.startedAt) : undefined;
      rows.push({
        file: f,
        status: 'running',
        phaseText: recRunningPtext(side, stage),
        pct: recordingPhasePct(side),
        stage,
        ...(elapsed ? { elapsed } : {}),
        ...(side?.mode ? { mode: side.mode } : {}),
        ...(side?.turns ? { turns: side.turns.length } : {}),
      });
      continue;
    }
    if (merged) {
      rows.push({ file: f, status: 'merged', phaseText: '', pct: null, ...(side?.mode ? { mode: side.mode } : {}), ...(side?.turns ? { turns: side.turns.length } : {}) });
      continue;
    }
    if (!side) {
      rows.push({ file: f, status: 'pending', phaseText: '', pct: null });
      continue;
    }
    if (side.phase === 'error') {
      rows.push({ file: f, status: 'failed', phaseText: '', pct: null, errText: recordingFailureText(side) });
      continue;
    }
    if (side.phase === 'done' || recordingTurnsComplete(side)) {
      // done 无轮次仍出「待并仓」（并仓守卫会挡，行为同旧）；停在 transcribe 但成果已齐 = 兜底
      // 可并仓（账本收尾标记被插件读句柄拒掉，ADR-0219），行上注明来源。
      const tail = side.phase === 'done' ? '' : '（账本收尾标记缺失，已按全部轮次）';
      rows.push({ file: f, status: 'awaiting-merge', phaseText: side.turns?.length ? `转写完成 · ${side.turns.length} 轮${tail}` : '转写完成', pct: 100, ...(side.mode ? { mode: side.mode } : {}), ...(side.turns ? { turns: side.turns.length } : {}) });
      continue;
    }
    rows.push({ file: f, status: 'interrupted', phaseText: side.progress?.text ?? '中断', pct: recordingPhasePct(side), ...(side.mode ? { mode: side.mode } : {}), ...(side.turns ? { turns: side.turns.length } : {}) });
  }
  // 起点补到每行（ADR-0217：可见可改；绝对时间的唯一来源）；旁音计数（ADR-0216：留账不进仓）
  for (const r of rows) {
    r.startMs = startOf(r.file);
    const n = (readRecordingSidecar(root, talker, r.file)?.turns ?? []).filter((t) => t.speaker === SIDE_SPEECH_SPEAKER).length;
    if (n) r.sideSpeaks = n;
  }
  const turnsView = recTurnsViewState(root, talker, otherAvatar);
  // 疑似重复巡检（Q3：只报不清）；同尺寸才读盘哈希——正常录音时长各异，绝大多数一次不读
  const dupGroups = duplicateRecordingGroups(recordingsDirOf(root, talker), suppFs());
  return {
    rows,
    ref,
    queue: suppRecQueue,
    ...(dupGroups.length ? { dupGroups } : {}),
    ...(del ? { del } : {}),
    ...(recStartEditFile ? { startEdit: recStartEditFile } : {}),
    ...(turnsView ? { turnsView } : {}),
    ...(recRefConfirm ? { refConfirm: true } : {}),
  };
}

async function suppPickImages(): Promise<void> {
  const files = await pickSystemFiles('选择图片', [
    { name: '图片', ext: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] },
    { name: '全部文件', ext: ['*'] },
  ]);
  if (!files.length) return;
  const fs2 = suppFs();
  for (const p of files) {
    if (suppImages.some((x) => x.path === p)) continue;
    let mtime = Date.now();
    try {
      mtime = fs2.statSync(p).mtimeMs;
    } catch {
      /* 读不到 mtime 按 now */
    }
    suppImages.push({ path: p, name: p.slice(p.lastIndexOf('/') + 1), ts: Math.round(mtime), peer: true });
  }
  void renderAlbum();
}

async function suppImportImages(): Promise<void> {
  const talker = detailId;
  const root = suppDataRoot();
  if (!talker || !root || !peopleSafe || !suppImages.length || suppBusy) return;
  if (!suppFs()?.existsSync(root)) {
    notice('脸谱数据根不存在——先到设置里确认数据源目录', 'warning');
    return;
  }
  // 页内可改的时间落选那一刻才读回（不逐键绑状态）
  overlay?.querySelectorAll<HTMLInputElement>('[data-people-supp-img-ts]').forEach((inp) => {
    const i = Number(inp.getAttribute('data-people-supp-img-ts'));
    const v = inp.value ? new Date(inp.value).getTime() : NaN;
    if (Number.isFinite(v) && suppImages[i]) suppImages[i].ts = v;
  });
  suppBusy = true;
  try {
    const fs2 = suppFs();
    if (!fs2?.existsSync(root)) {
      notice('脸谱数据根不存在——先到设置里确认数据源目录', 'warning');
      return;
    }
    const imported: Array<{ file: string; ts: number; isSender: boolean }> = [];
    for (const it of suppImages) {
      const d = new Date(it.ts);
      const p2 = (n: number): string => String(n).padStart(2, '0');
      const month = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
      const dir = `${root}/${talker}/desc/${month}`;
      fs2.mkdirSync(dir, { recursive: true });
      const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}`;
      const dot = it.name.lastIndexOf('.');
      const ext = dot > 0 ? it.name.slice(dot).toLowerCase() : '.jpg';
      let seq = 1;
      let target = '';
      for (;;) {
        target = `${dir}/${stamp}_${p2(seq)}${ext}`;
        if (!fs2.existsSync(target)) break;
        seq++;
      }
      fs2.copyFileSync(it.path, target);
      // 缩略档随后台队列出（issue 519）：不挡导入主流程；补上后网格原位换小图
      const rel = `${month}/${stamp}_${p2(seq)}${ext}`;
      const thumbAbs = descThumbPath(root, talker, rel);
      queueThumbBuild(fs2, target, thumbAbs, (ok) => {
        if (ok) swapGridThumb(talker, rel, thumbAbs);
      });
      imported.push({ file: rel, ts: it.ts, isSender: !it.peer });
    }
    // 并仓：type=3 消息（text 空 = 不进时间线，描述并仓后自然出现）+ 形态计数 + 统计重算
    let n = 0;
    await peopleSafe.write(talker, (rec) => {
      for (const it of imported) {
        const key = `img:${it.file}`;
        if (rec.store.msgs.some((m) => m.key === key)) continue;
        rec.store.msgs.push({ key, ts: it.ts, isSender: it.isSender, type: 3, img: it.file, text: '' });
        n++;
      }
      if (n > 0) {
        rec.store.msgs.sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
        rec.store.kindCounts = { ...(rec.store.kindCounts ?? {}), 图片: (rec.store.kindCounts?.图片 ?? 0) + n };
        rec.store.stats = storeStatsOf(rec.store.msgs);
        rec.store.updatedAt = new Date().toISOString();
      }
    });
    suppImages = [];
    notice(n > 0 ? `已导入 ${n} 张图片——要进时间线就点「生成描述」` : '所选图片都已在库里', 'success');
    await refreshSuppStoreInfo(talker);
  } catch (e) {
    notifyActionError(e, '导入图片');
  } finally {
    suppBusy = false;
    void renderAlbum();
  }
}

/**
 * 点开看大图（复评；D 组改走 core 灯箱）：留影网格整组交给 openLightbox 的多图模式——
 * ←→ 键与两侧箭头在本人的留影里翻页，描述文案作底部说明原样带上。
 * 罩层 / Esc 层不再自绘（core 灯箱自管 esc 层与关闭）；这里只留一个句柄，
 * 面板收起 / 换人时代为关闭（close 幂等：灯箱已被用户关掉时是空操作）。
 */
let imgLightboxClose: (() => void) | null = null;

function closeImgViewer(): void {
  imgLightboxClose?.();
  imgLightboxClose = null;
}

function openImgViewer(img: string): void {
  const talker = detailId;
  const root = suppDataRoot();
  if (!overlay || !talker || !root || !img) return;
  closeImgViewer();
  const index = suppStoreInfo.imageItems.findIndex((x) => x.img === img);
  if (index < 0) return;
  const { close } = openLightbox({
    title: '留影',
    // srcOf 惰性（issue 519）：翻到哪张才读哪张的原图——千张组一次性把 data URL 拉齐是同一笔卡账
    items: suppStoreInfo.imageItems.map((it) => ({
      src: '',
      srcOf: () => localImgOf(descImagePath(root, talker, it.img)),
      caption: it.text.replace(/^\[图片\]\s*/, ''),
    })),
    index,
  });
  imgLightboxClose = close;
}

/**
 * 删一张已入库的留影（复评：预览网格右上角的叉；点开二次确认才删）——只清仓里这条，
 * **数据根的原件不动**：盘上删文件不可逆，这份代劳不接；要清盘自己去目录里删（通知里把位置说清）。
 */
async function suppDeleteImage(img: string): Promise<void> {
  const talker = detailId;
  if (!talker || !img) return;
  if (!peopleSafe) peopleSafe = await getPeopleSafeStore();
  const safe = peopleSafe;
  if (!safe?.unlocked) return;
  try {
    let removed = 0;
    await safe.write(talker, (rec) => {
      const before = rec.store.msgs.length;
      // 按 img 认条目：导入进来的图键是 `s<sid>:<ct>` / `h<hash>`（msgKey 口径），补录的才是 `img:`——
      // 只按键前缀删会把导入的那批静默漏掉（imageItems 就是从 type=3 + img 建的，这里同口径回认）
      rec.store.msgs = rec.store.msgs.filter((m) => !(m.type === 3 && String(m.img ?? '') === img));
      removed = before - rec.store.msgs.length;
      if (removed > 0) {
        rec.store.kindCounts = { ...(rec.store.kindCounts ?? {}), 图片: Math.max(0, (rec.store.kindCounts?.图片 ?? 0) - removed) };
        rec.store.stats = storeStatsOf(rec.store.msgs);
        rec.store.updatedAt = new Date().toISOString();
      }
    });
    if (removed > 0) notice(`已删掉「${img.split('/').pop() ?? img}」——原件还在数据根 desc/ 里，没动`, 'delete');
  } catch (e) {
    notifyActionError(e, '删除留影');
  }
  await refreshSuppStoreInfo(talker);
  void renderAlbum();
}

async function suppDescribe(): Promise<void> {
  if (!detailId || jobsApi.isDescribeOnlyBusy()) return;
  const r = await jobsApi.runDescribeOnly(getApp(), detailId);
  if (!r.ok && r.reason) notice(`图片描述没有跑：${r.reason}`, 'warning');
  else if (r.ok && r.skipped) notice('没有需要描述的图片（零图片或已全部描述）', 'info');
  else if (r.ok) notice('图片描述完成，已并进时间线', 'success');
  await refreshSuppStoreInfo(detailId);
  void renderAlbum();
}

/**
 * 解除敏感标注并重试描述（ADR-0224 决策 7）：标注是启发式判定，一定有误伤，必须有撤回入口——
 * 没有撤回入口的错杀不可挽回。清掉该图消息上的 descSkip 后直接走「只跑描述段」入口：这一次
 * 点击即计费授权（与 suppDescribe 同口径，不再二次弹确认）；若它确实敏感，下一轮会被重新标注
 * （幂等自愈，不会反复烧钱也不会漏）。
 */
async function suppUnmarkSensitive(img: string): Promise<void> {
  const talker = detailId;
  if (!talker || !img || jobsApi.isDescribeOnlyBusy()) return;
  if (!peopleSafe) peopleSafe = await getPeopleSafeStore();
  const safe = peopleSafe;
  if (!safe?.unlocked) {
    notice('保险库上锁——先解锁再解除敏感标注', 'warning');
    return;
  }
  let cleared = 0;
  try {
    await safe.write(talker, (rec) => {
      for (const m of rec.store.msgs) {
        if (m.type === 3 && String(m.img ?? '') === img && isDescSkipped(m)) {
          delete m.descSkip;
          cleared++;
        }
      }
      if (cleared > 0) rec.store.updatedAt = new Date().toISOString();
    });
  } catch (e) {
    notifyActionError(e, '解除敏感标注');
    return;
  }
  await refreshSuppStoreInfo(talker);
  void renderAlbum();
  if (!cleared) {
    notice('这张已经没有敏感标注了', 'info');
    return;
  }
  const r = await jobsApi.runDescribeOnly(getApp(), talker);
  if (!r.ok && r.reason) notice(`重试描述没有跑：${r.reason}`, 'warning');
  else if (r.ok && r.skipped) notice('没有需要描述的图片', 'info');
  else if (r.ok) notice('已解除敏感标注，重新描述完成', 'success');
  await refreshSuppStoreInfo(talker);
  void renderAlbum();
}

/**
 * 删一条录音（issue 516 Q12/Q13）：六处清干净——原件（勾选时）/ `.turns.json` / 半截 `.tmp` /
 * `.meta.json` / `.turns.md` / `rec-control` 控制文件 / 仓内 `rec:<文件>:*` 消息（kindCounts 与
 * stats 同步重算）。不勾原件 = 只清我们这边的副本，行回落「待处理」可重跑（改阈值 / 重建质心后重转）。
 * **不自动重画脸谱**（正文是产物）：已画过就在确认里说清。
 */
async function suppDeleteRecording(file: string): Promise<void> {
  const talker = detailId;
  const root = suppDataRoot();
  const fs2 = suppFs();
  if (!talker || !root || !file || !fs2) return;
  // 上锁 → 整条不删（issue 516 Q13 口径：账本 / meta / 仓内轮次必须一起清干净）。
  // 若只删文件，仓里 `rec:<文件>:` 轮次就成了**清不掉的孤儿**——行按 recordings/ 列，
  // 文件没了就再没有删除入口，而它还在参与统计与画谱素材。宁可先请用户解锁。
  if (!peopleSafe) peopleSafe = await getPeopleSafeStore();
  if (!peopleSafe?.unlocked) {
    notice('保险库上锁——删除要连仓里的转写轮次一起清，请先解锁保险库再删', 'warning');
    return;
  }
  const alsoFile = recDelAlsoFile;
  recDelPending = null;
  suppBusy = true;
  const removed: string[] = [];
  try {
    // 1~5 磁盘侧
    const paths = [...recordingArtifactPaths(root, talker, file)];
    try {
      const dir = recordingsDirOf(root, talker);
      const pre = recordingTmpPrefix(file);
      for (const f of fs2.readdirSync(dir) as string[]) {
        if (f.startsWith(pre) && f.endsWith('.tmp')) paths.push(`${dir}/${f}`);
      }
    } catch {
      /* 目录不在：没什么可清的 */
    }
    paths.push(recControlFilePath(root, talker, file));
    for (const p of paths) {
      try {
        if (fs2.existsSync(p)) {
          fs2.unlinkSync(p);
          removed.push(p);
        }
      } catch {
        /* 单项失败不阻断其余（原件被占用等情况在下面统一说） */
      }
    }
    if (alsoFile) {
      const src = `${recordingsDirOf(root, talker)}/${file}`;
      try {
        if (fs2.existsSync(src)) fs2.unlinkSync(src);
      } catch {
        notice(`录音原件删不掉（可能被播放器占用）：「${file}」——账本与仓内数据已清`, 'warning');
      }
    }
    // 6 聊天仓（插件是唯一写入者；统计与形态计数同步重算）
    const prefix = `rec:${file}:`;
    let gone = 0;
    await peopleSafe.write(talker, (rec) => {
      const before = rec.store.msgs.length;
      rec.store.msgs = rec.store.msgs.filter((m) => !m.key.startsWith(prefix));
      gone = before - rec.store.msgs.length;
      if (gone > 0) {
        const k = rec.store.kindCounts?.录音 ?? 0;
        rec.store.kindCounts = { ...(rec.store.kindCounts ?? {}), 录音: Math.max(0, k - gone) };
        rec.store.stats = storeStatsOf(rec.store.msgs);
        rec.store.updatedAt = new Date().toISOString();
      }
    });
    if (gone > 0) removed.push(`${gone} 条仓内轮次`);
    notice(`已删除「${file}」${removed.length ? `（清掉 ${removed.length} 项）` : ''}${alsoFile ? '' : '；原件保留，行已回落「待处理」'}`, 'success');
  } catch (e) {
    notifyActionError(e, '删除录音');
  } finally {
    suppBusy = false;
    void refreshSuppStoreInfo(talker);
    void renderAlbum();
  }
}

/** 进录音页时的「有 N 条中断可续跑」提示（issue 516 Q16g；只提示，不自动起进程） */
async function noticeInterruptedRecordings(): Promise<void> {
  const talker = detailId;
  const root = suppDataRoot();
  if (!talker || !root) return;
  const fs2 = suppFs();
  if (!fs2) return;
  try {
    const dir = recordingsDirOf(root, talker);
    const names: string[] = [];
    for (const f of fs2.readdirSync(dir) as string[]) {
      if (!isRecordingFile(f) || !suppFs().existsSync(`${dir}/${f}`)) continue;
      const side = readRecordingSidecar(root, talker, f);
      if (side && !recordingTurnsComplete(side) && side.phase !== 'error') names.push(f);
    }
    if (names.length) notice(`有 ${names.length} 条录音中断可续跑：${names.slice(0, 3).join('、')}${names.length > 3 ? ' 等' : ''}——点「续跑」按账本只补缺口`, 'info');
  } catch {
    /* 目录不在：没录音 */
  }
}

/**
 * 选录音 → 进导入队列（不立刻落盘）。每条算好 sha256（判重）与起点候选（ADR-0217）：
 * 文件名能解析出绝对时间 → 直接预填；只有「周X / N点N分」这类相对信息 → 给候选下拉；
 * 什么都推不出 → 留空必填（**不许静默回落 mtime**）。
 */
async function suppPickRecordings(): Promise<void> {
  const talker = detailId;
  const root = suppDataRoot();
  if (!talker || !root) return;
  const files = await pickSystemFiles('选择录音', [
    { name: '录音', ext: ['aac', 'm4a', 'mp3', 'wav', 'amr', 'flac', 'ogg', 'opus'] },
    { name: '全部文件', ext: ['*'] },
  ]);
  if (!files.length) return;
  const fs2 = suppFs();
  if (!fs2) {
    notice('非桌面端读不了本机文件——录音导入只在桌面端可用', 'warning');
    return;
  }
  const dir = recordingsDirOf(root, talker);
  // 库里已存在的录音 sha256（判重 + 预检提示"这条是重复的"）；只算一次
  const existing = existingRecordingDigests(dir, fs2);
  for (const p of files) {
    if (suppRecQueue.some((x) => x.path === p)) continue;
    const name = p.slice(p.lastIndexOf('/') + 1);
    let mtime = Date.now();
    try {
      mtime = fs2.statSync(p).mtimeMs;
    } catch {
      /* 读不到 mtime 按 now（只影响候选窗口，不影响正确性） */
    }
    const sha = fileSha256(p);
    const cands = recordingStartCandidates(name, mtime);
    const dupOf = sha ? existing.get(sha) : undefined;
    suppRecQueue.push({
      path: p,
      name,
      sha256: sha,
      startMs: cands[0] ?? null,
      candidates: cands,
      ...(dupOf ? { dupOf } : {}),
    });
  }
  void renderAlbum();
  void suppCheckRecordingOwners(talker, root);
}

/**
 * 归属抽检（issue 516 Q15）：**一个进程查完所有待导入源文件**（每条起一个进程会白付
 * 分钟级模型冷加载），走录音队列 = 与画谱的 funasr 段互斥（ADR-0218）。
 * 存疑的只打标（不硬拦）；用户点「仍然导入」才落盘，否则导入时跳过。
 * 无质心 / 只有 me / 抽检失败 → verdict=unknown，一律放行（不做判定）。
 */
function suppCheckRecordingOwners(talker: string, root: string): void {
  const srcs = suppRecQueue.filter((q) => !q.dupOf).map((q) => q.path);
  if (!srcs.length) return;
  for (const q of suppRecQueue) q.checking = true;
  let done = false;
  enqueueRecordingTask({
    key: `check:${talker}`,
    talker,
    file: 'recording_check',
    spec: () => buildRecordingCheckSpec({ dataRoot: root, talker, srcs, python: suppPython(), ffmpeg: suppFfmpeg() }),
    onResult: (data) => {
      done = true;
      const verdicts = parseRecordingCheckResult(data);
      let n = 0;
      for (const q of suppRecQueue) {
        q.checking = false;
        if (verdicts.get(q.path) === 'stranger') {
          q.suspect = true;
          n++;
        }
      }
      void renderAlbum();
      if (n) notice(`抽检：${n} 条录音里听不出你或「${talker}」的声音——可能选错了（默认不导入；确认没错就点「仍然导入」）`, 'warning');
    },
    onExit: (o) => {
      if (!done) {
        for (const q of suppRecQueue) q.checking = false;
        if (!o.ok && !o.stopped) notice(`归属抽检没跑成（${o.error || '进程异常退出'}）——这批录音不做预检，直接落盘`, 'info');
        void renderAlbum();
      }
    },
    meta: { talker, file: 'recording_check', dataRoot: root },
  });
}
/** `recordings/` 里已入库录音的 sha256 → 文件名（判重；只读原件、跳过派生物） */
function existingRecordingDigests(dir: string, fs2: any): Map<string, string> {
  const out = new Map<string, string>();
  try {
    for (const f of fs2.readdirSync(dir) as string[]) {
      if (!isRecordingFile(f)) continue;
      const sha = fileSha256(`${dir}/${f}`);
      if (sha && !out.has(sha)) out.set(sha, f);
    }
  } catch {
    /* 目录还不存在：空表 */
  }
  return out;
}

/** 落盘导入（起点必填；同名同内容跳过、同名不同内容加 ` (2)`；meta 一起落） */
async function suppImportRecordings(): Promise<void> {
  const talker = detailId;
  const root = suppDataRoot();
  if (!talker || !root || suppBusy || !suppRecQueue.length) return;
  const fs2 = suppFs();
  if (!fs2) return; // 非桌面端：没有本机文件可复制
  harvestRecQueueInputs();
  const missing = suppRecQueue.filter((q) => q.startMs === null);
  if (missing.length) {
    notice(`有 ${missing.length} 条还没确认起点：${missing.map((m) => m.name).join('、')}`, 'warning');
    void renderAlbum();
    return;
  }
  suppBusy = true;
  try {
    if (!fs2.existsSync(root)) {
      notice('脸谱数据根不存在——先到设置里确认数据源目录', 'warning');
      return;
    }
    const dir = recordingsDirOf(root, talker);
    fs2.mkdirSync(dir, { recursive: true });
    // 库里现有 sha256（本次新落的也进表：同批选两个相同文件只留一份）
    const seen = existingRecordingDigests(dir, fs2);
    const usedNames = new Set<string>();
    let n = 0;
    let dup = 0;
    let renamed = 0;
    let skippedSuspect = 0;
    const dupNames: string[] = [];
    for (const it of suppRecQueue) {
      if (it.suspect && !it.keep) {
        skippedSuspect++; // 抽检存疑且没点「仍然导入」：默认不落盘（issue 516 Q15）
        continue;
      }
      if (it.sha256 && seen.has(it.sha256)) {
        dup++;
        dupNames.push(it.name);
        continue; // 同名同内容 / 换了名同内容：都不重复入库
      }
      const taken = (nm: string): boolean => usedNames.has(nm) || fs2.existsSync(`${dir}/${nm}`);
      const target = resolveRecordingTargetName(taken, it.name);
      if (!target) {
        notice(`「${it.name}」同名副本太多，跳过`, 'warning');
        continue;
      }
      if (target !== it.name) renamed++;
      fs2.copyFileSync(it.path, `${dir}/${target}`);
      usedNames.add(target);
      writeRecordingMeta(root, talker, target, {
        startMs: it.startMs!,
        ...(it.sha256 ? { sha256: it.sha256 } : {}),
        startSource: it.candidates.includes(it.startMs!) ? (parseRecordingFilenameTs(it.name) !== null ? 'name' : 'candidate') : 'manual',
      });
      // 同批去重：新落的也记进去（sha 判重靠内容，同名不同内容不算重复）
      if (it.sha256) seen.set(it.sha256, target);
      n++;
    }
    suppRecQueue = [];
    const bits = [`已添加 ${n} 条录音`];
    if (dup > 0) bits.push(`重复 ${dup} 条未再入库`);
    if (renamed > 0) bits.push(`同名不同内容 ${renamed} 条已另存`);
    if (skippedSuspect > 0) bits.push(`${skippedSuspect} 条抽检存疑未导入`);
    notice(`${bits.join('，')}${n > 0 ? '——点「处理」开始转写' : ''}`, n > 0 ? 'success' : 'info');
    if (dupNames.length && n === 0) notice(`（重复：${dupNames.join('、')}）`, 'info');
  } catch (e) {
    notifyActionError(e, '添加录音');
  } finally {
    suppBusy = false;
    void renderAlbum();
  }
}

async function suppRunRecording(file: string): Promise<void> {
  const talker = detailId;
  const root = suppDataRoot();
  if (!talker || !root || !file || !suppFs()) return;
  if (!(await suppFaceGate())) return;
  const key = recordingSidecarPath(root, talker, file);
  if (isRecordingRunning(key) || isRecordingQueued(key)) return;
  // 起跑预检（issue 511）：账本已完整（done + 有轮次）= 脚本会幂等秒退，此前观感是「起跑就凭空
  // 消失」——改为不起进程、直接交代现状；真要重转 = 删掉该录音的 .turns.json 再来（极低频，不给按钮）
  const pre = readRecordingSidecar(root, talker, file);
  if (recordingTurnsComplete(pre)) {
    notice(`「${file}」已转写完成（${pre?.turns?.length ?? 0} 轮）——要重新转写先删除它的 .turns.json 账本`, 'info');
    return;
  }
  enqueueRecordingTask({
    key,
    talker,
    file,
    // 质心前置（ADR-0218 决策 5）：**出队那一刻**才判——前面的任务可能刚把质心建好，入队时判会白建
    prepare: () => prepareVoiceprintFor(talker, root),
    spec: () => buildRecordingSpec({ dataRoot: root, talker, file, python: suppPython(), ffmpeg: suppFfmpeg() }),
    onExit: (o) => {
      if (o.stopped) {
        void renderAlbum();
        return;
      }
      if (!o.ok) {
        notice(`录音处理失败：${o.error || '进程异常退出'}（可点「重试」，账本续跑只补缺口）`, 'warning');
        void renderAlbum();
        return;
      }
      void suppMergeRecording(talker, file);
    },
    meta: { talker, file, dataRoot: root },
  });
  notice('已加入录音队列（全局一条串行跑，进度见左下面板）', 'info');
  startRecPolling();
  void renderAlbum();
}

/**
 * 出队时的质心前置（issue 516 Q7）：缺质心就先串行建好再转写——降级跑完再重建要白付一遍
 * 声纹 + 转写（76 分钟录音是小时级），而 refs 只有几分钟。建不出来**不拦**（Q8：文本证据先落袋，
 * 与 ADR-0213「任何降级不阻断导入」一致），只把原因说人话。返回 false = 放弃该条（仅当进程起不来）。
 */
async function prepareVoiceprintFor(talker: string, root: string): Promise<boolean> {
  if (voiceprintRefStatus(root, talker) === 'ready') return true;
  notice('缺声纹质心——先建质心再转写（本地跑，按语音量几分钟）…', 'info');
  const handle = startRecordingTask(
    buildVoiceprintSpec({ dataRoot: root, talker, python: suppPython() }),
    `ref:${talker}`,
    undefined,
    { talker, file: 'voiceprint_refs', dataRoot: root },
  );
  if (!handle) return true; // 已有质心任务在跑：不打断它，按当前质心状态继续
  const outcome = await handle.done;
  if (!outcome.ok) {
    const detail = outcome.error?.message ?? '';
    notice(`质心建不出来（${detail || '该联系人还没有微信语音素材'}）——本次按「非我即对方」降级跑；先做数据源导入再回来重建`, 'info');
  } else if (voiceprintRefStatus(root, talker) === 'missing') {
    notice('该联系人还没有微信语音素材，质心建不出来——本次按「非我即对方」降级跑；先做数据源导入再回来重建', 'info');
  }
  return true;
}

/**
 * 录音转写 LLM 校对（ADR-0222 / issue 518）：开关关 / 已校过 / 重排（why='restart' 只动 ts）零开销直返。
 * 逐轮文本送 LLM「只修错不创作」，全成写回账本（顶层 `proofread` 标记 + 轮次 text 就地替换）后
 * 以校对稿并仓；任一批终败不写回——原文并仓并通知，缺口留给重跑任务（Python 对已有 text 不重转）
 * 或再点「并仓」补校。
 */
async function proofreadRecordingSidecarIfEnabled(
  root: string,
  talker: string,
  file: string,
  side: RecordingSidecar,
  why: 'merge' | 'restart'
): Promise<RecordingSidecar> {
  if (why === 'restart') return side;
  if (tryGetSettings()?.asrLlmProofread !== true || side.proofread) return side;
  const pieces = (side.turns ?? []).filter((t) => t.text.trim() !== '').map((t) => t.text);
  if (!pieces.length) return side;
  notice(`「${file}」LLM 校对转写中（${pieces.length} 轮）…`, 'info');
  const res = await proofreadPieces(pieces, {
    contextNote: `双人录音聊天的逐轮转写（「我」与「${talker}」交替说话，口语）`,
  });
  if (res.failed) {
    notice(`「${file}」LLM 校对失败——按原文并仓，重跑或再点并仓可补校`, 'warning');
    return side;
  }
  if (!writeRecordingTurnsProofread(root, talker, file, res.texts)) {
    notice(`「${file}」LLM 校对结果写回失败——按原文并仓`, 'warning');
    return side;
  }
  return readRecordingSidecar(root, talker, file) ?? side;
}

/**
 * 转写成果齐（done，或停在 transcribe 但成果已齐的兜底）→ 聊天仓轮次并仓
 * （插件是聊天仓唯一写入者；kindCounts / stats 同步重算）。
 * `why = 'restart'` 是改起点后的重排：同一函数幂等（先按 `rec:<文件>:` 前缀清旧再写），
 * 所以「改起点回写已有消息 ts」不用另写一条通路（issue 516 Q11）。
 */
async function suppMergeRecording(talker: string, file: string, why: 'merge' | 'restart' = 'merge'): Promise<void> {
  const root = suppDataRoot();
  if (!root || !peopleSafe) peopleSafe = await getPeopleSafeStore();
  if (!peopleSafe?.unlocked) {
    notice('保险库上锁——解锁后在这条录音上点「并仓」补上', 'warning');
    return;
  }
  let side = readRecordingSidecar(root, talker, file);
  if (!side || !recordingTurnsComplete(side)) {
    void renderAlbum();
    return;
  }
  side = await proofreadRecordingSidecarIfEnabled(root, talker, file, side, why);
  const salvaged = side.phase !== 'done'; // 账本收尾标记缺失的兜底并仓（ADR-0219）
  const base = recordingStartOf(root, talker, file, recMtimeOf(root, talker, file));
  let added = 0;
  let removed = 0;
  try {
    await peopleSafe.write(talker, (rec) => {
      const r = applyRecordingTurnsToMsgs(rec.store.msgs, { file, ts: base, turns: side.turns! });
      rec.store.msgs = r.msgs;
      added = r.added;
      removed = r.removed;
      const net = Math.max(0, added - removed); // kindCounts 取净增量（重并不翻倍）
      if (net > 0) rec.store.kindCounts = { ...(rec.store.kindCounts ?? {}), 录音: (rec.store.kindCounts?.录音 ?? 0) + net };
      rec.store.stats = storeStatsOf(rec.store.msgs);
      rec.store.updatedAt = new Date().toISOString();
    });
    if (why === 'restart') notice(`「${file}」起点已改——仓里 ${added} 条轮次的绝对时间已重排`, 'success');
    else if (salvaged) notice(`「${file}」已并入 ${added} 条转写轮次（账本收尾标记缺失，已按全部轮次并入）`, 'success');
    else notice(`「${file}」已并入 ${added} 条转写轮次`, 'success');
    // 逐轮时间轴：插件写、幂等覆盖（ADR-0217 Q21）——改起点也重写（绝对时间跟着变）
    writeRecordingTurnsMd(root, talker, file, buildRecordingTurnsMd(file, base, side));
  } catch (e) {
    notifyActionError(e, why === 'restart' ? '重排录音轮次' : '并仓录音轮次');
  }
  await refreshSuppStoreInfo(talker);
  void renderAlbum();
}

/**
 * 改起点（ADR-0217 决策 3）：写进 `<名>.meta.json`（插件侧一等数据，与脚本账本解耦），
 * 若这条已并仓则**就地重排**仓内轮次绝对时间（复用并仓的幂等实现，Q11）。
 * 已生成的脸谱正文不自动改写——那是产物不是索引（Q14 同口径）。
 */
async function suppSetRecordingStart(file: string, ms: number): Promise<void> {
  const talker = detailId;
  const root = suppDataRoot();
  if (!talker || !root || !file) return;
  if (!writeRecordingMeta(root, talker, file, { ...(readRecordingMeta(root, talker, file) ?? {}), startMs: ms, startSource: 'manual' })) {
    notice('起点写盘失败——数据根可能不可写', 'warning');
    return;
  }
  recStartEditFile = null;
  if (suppStoreInfo.mergedRecs.has(file)) {
    await suppMergeRecording(talker, file, 'restart');
    return;
  }
  notice(`「${file}」起点已改（下次并仓按新起点排绝对时间）`, 'success');
  void renderAlbum();
}

/** 质心构建（bz-face refs；语音样本不足时脚本自行降级 me-only）——同走录音队列（全局一条串行） */
async function suppBuildVoiceprintRef(): Promise<void> {
  const talker = detailId;
  const root = suppDataRoot();
  if (!talker || !root) return;
  const key = `ref:${talker}`;
  if (isRecordingRunning(key) || isRecordingQueued(key)) return;
  if (!(await suppFaceGate())) return;
  enqueueRecordingTask({
    key,
    talker,
    file: 'voiceprint_refs',
    spec: () => buildVoiceprintSpec({ dataRoot: root, talker, python: suppPython() }),
    onExit: (o) => {
      if (o.stopped) {
        void renderAlbum();
        return;
      }
      if (o.ok) notice('声纹参考已建好——之后的录音按双人分离归属', 'success');
      else notice(`质心构建失败：${o.error || '该联系人可能没有微信语音样本'}（没有质心也能处理录音，按降级阶梯归属）`, 'warning');
      void renderAlbum();
    },
    meta: { talker, file: 'voiceprint_refs', dataRoot: root },
  });
  notice('已加入队列（建质心，全局一条串行跑）', 'info');
  void renderAlbum();
}

/** 录音页签的进度轮询：只在页签可见且有任务在跑 / 排队时跑；行内原位更新（不整页重画，焦点不丢） */
function startRecPolling(): void {
  wireRecordingQueue();
  if (recPollTimer !== null) return;
  recPollTimer = window.setInterval(() => {
    if (dialog?.kind !== 'note' || suppTab !== 'rec') return;
    const active = runningRecordingItems().length > 0 || queuedRecordingCount() > 0;
    if (active) tickRecRows();
    // 引擎队列空时进度块由本轮询负责摘挂（有引擎任务时引擎快照自己会画，别抢）
    if (active || !currentJobsItem()) renderNote();
  }, 1000);
}

function stopRecPolling(): void {
  if (recPollTimer !== null) {
    window.clearInterval(recPollTimer);
    recPollTimer = null;
  }
}

/**
 * 队列一动就重画录音页（issue 516）：出队那一瞬行要从「排队中 · 第 N 位」翻成「转写中」，
 * 光靠每秒轮询只会原位刷新**已在跑**的行，翻不了态。重画前会 `harvestRecQueueInputs`，
 * 所以正在输的起点不会被吃掉。只订阅一次。
 */
let recQueueWired = false;
function wireRecordingQueue(): void {
  if (recQueueWired) return;
  recQueueWired = true;
  subscribeRecordingQueue(() => {
    if (dialog?.kind !== 'note' || suppTab !== 'rec') return;
    void renderAlbum();
  });
}

/** 轮询帧：在跑的录音行原位刷新进度条与文案 */
function tickRecRows(): void {
  const talker = detailId;
  const root = suppDataRoot();
  if (!talker || !root) return;
  const fs2 = suppFs();
  const runMap = new Map(runningRecordingItems().map((r) => [r.path, r]));
  overlay?.querySelectorAll<HTMLElement>('[data-people-supp-row]').forEach((rowEl) => {
    const file = rowEl.getAttribute('data-people-supp-row') ?? '';
    const key = recordingSidecarPath(root, talker, file);
    const it = runMap.get(key);
    if (!isRecordingRunning(key) || !it) return;
    const side = readRecordingSidecar(root, talker, file);
    const stage = recordingStageOf(side, fs2 ? recSidecarFresh(fs2, key, it.startedAt) : false);
    const pct = recordingPhasePct(side);
    if (pct !== null) {
      const fill = rowEl.querySelector<HTMLElement>('.bz-people-jobs-fill');
      const pctEl = rowEl.querySelector<HTMLElement>('.bz-people-jobs-pct');
      if (fill) fill.style.width = `${pct}%`;
      if (pctEl) pctEl.textContent = `${pct}%`;
    }
    // 阶段链高亮（切阶段帧才动 DOM）与主文案 / 耗时（每秒帧定点原位更新，不整行重画）
    const chain = rowEl.querySelector<HTMLElement>('[data-rec-chain]');
    if (chain && rowEl.getAttribute('data-rec-stage') !== stage) {
      rowEl.setAttribute('data-rec-stage', stage);
      applyRecStageChain(chain, stage);
    }
    const ptext = rowEl.querySelector<HTMLElement>('[data-rec-ptext]');
    if (ptext) ptext.textContent = recRunningPtext(side, stage);
    const elapsedEl = rowEl.querySelector<HTMLElement>('[data-rec-elapsed]');
    if (elapsedEl) elapsedEl.textContent = `已 ${formatRecElapsed(Date.now() - it.startedAt)}`;
  });
}

/** 录音处理进度块的数据面：手上在跑 / sidecar 停在中途的录音（面板重开也能列出来） */
function recNoteRows(): SuppRecRowState[] {
  const root = suppDataRoot();
  if (!root) return [];
  const fs2 = suppFs();
  const rows: SuppRecRowState[] = [];
  for (const it of runningRecordingItems()) {
    if (it.file === 'voiceprint_refs') continue; // 质心构建不在进度块显（页签里有状态行）
    const key = recordingSidecarPath(root, it.talker, it.file);
    const side = readRecordingSidecar(root, it.talker, it.file);
    const stage = recordingStageOf(side, fs2 ? recSidecarFresh(fs2, key, it.startedAt) : false);
    rows.push({
      file: it.file,
      status: 'running',
      // 进度块单行显示：主文案 + 已耗时（块由轮询整画，耗时随帧刷新）
      phaseText: `${recRunningPtext(side, stage)} · 已 ${formatRecElapsed(Date.now() - it.startedAt)}`,
      pct: recordingPhasePct(side),
      stage,
      elapsed: formatRecElapsed(Date.now() - it.startedAt),
    });
  }
  // 排队中的条（ADR-0218 决策 5：全局一条串行；进度块交代「N 条等待」，另给「清空队列」）
  for (const q of queuedRecordingItems()) {
    if (q.file === 'voiceprint_refs') continue; // 质心构建不占进度块（页签里有状态行）
    rows.push({ file: q.file, status: 'queued', phaseText: `排队中 · 第 ${q.position} 位`, pct: null, queuePos: q.position });
  }
  return rows;
}

/** 本地日期 YYYY-MM-DD（随手记默认值；FaceEvent.ts 同构） */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 随手记 id：优先 crypto.randomUUID，降级时间戳+随机串 */
function genId(): string {
  const c = typeof crypto !== 'undefined' ? (crypto as unknown as { randomUUID?: () => string }) : null;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
