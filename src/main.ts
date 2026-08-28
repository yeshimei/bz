/**
 * bz 插件入口：装配、命令注册（ADR-0004 裸注册）、设置页、懒加载（ADR-0003）。
 *
 * 命令 id 统一 `bz-` 前缀（ADR-0004 修订：2025 用户决策统一品牌前缀），不设置默认快捷键，
 * 卸载时 removeCommand 清理——取代原脚本的 window.__*CommandRegistered 防重标志。
 */
import { Plugin, PluginSettingTab } from 'obsidian';
import { notice, cleanupNotices } from './core/notice';
import { escManager } from './core/esc-manager';
import { closeItemMenu } from './core/item-actions';
import { setApp, getApp } from './core/app';
import { setAISettingsProvider, resetAIProviderCache } from './core/ai';
import { setSettingsProvider, setSettingsSaver } from './core/settings-provider';
import { clearDomainEvents } from './core/domain-bus';
import { attachObsidianAdapter, detachObsidianAdapter } from './core/obsidian-adapter';
import { renderSettingsInto } from './core/settings-schema';
import { mainSettingsSchema } from './core/settings-main-schema';
import { setBzSettingsProvider, unloadBz, ensureBz } from './memo';

import BzSettings, { DEFAULT_SETTINGS, migrateSecondBrainSettings } from './settings';

// 15 域（懒加载：首次命令/事件触发时 ensureXxx 幂等初始化）
import { openBzPanel, createMemoItem } from './memo';
import { addBelongingsItem, openBelongings, unloadBelongings } from './belongings';
import { openArticleView, unloadArticleView } from './clipping';
import { openNewsReader, unloadNewsReader } from './news';
import { openPasswordManager, addPasswordEntry, generatePassword, unloadPassword } from './password';
import { openFavoritesPanel, addFavoriteItem, unloadFavorites } from './favorites';
import { openLibrary, openBookNotes, unloadLibrary } from './library';
import { showReadingReport, unloadReadingReport } from './reading-report';
import { openMovieManager, addMovieItem, unloadMovie } from './movie';
// 影视分析报告（独立域，ADR-0048）
import { openMovieReport, unloadMovieReport } from './movie-report';
import { openReviewPanel, reviewAddCurrent, reviewRemoveCurrent, reviewJumpOverdue, reviewMarkDialog, reviewMarkRating, reviewStart, ensureReview, unloadReview } from './review';
import {
  openSecondBrainPanel,
  openSecondBrainReference,
  openSecondBrainChat,
  rebuildSecondBrainLinks,
  runSecondBrainLinkAll,
  unloadSecondBrain,
} from './secondbrain';
import { openPomodoro, unloadPomodoro, ensurePomodoro } from './pomodoro';
import { mountPomodoroStatusBar, unmountPomodoroStatusBar } from './pomodoro/statusbar';
// B站下载器启动命令（外部工具 @jwbz/bili-downloader，tools/bili-downloader，ADR-0011）
import { openBiliDownloader, openBiliTasksPanel, unloadBiliDownloader } from './bili-downloader';
// 附件搬移（ticket 65 新域：移动当前笔记附件，fileManager 自动更新内部链接 + 入口页磁贴播种）
import { openAttachMove, ensureAttachSeed, ATTACH_COMMAND_ID } from './attach';
// 保险箱（encrypt 域：移出式清单容器加密，正文+图片/视频附件；原名「加密保险箱」，ticket 68 更名仅文案）
import { openEncrypt, encryptCurrentNote, unloadEncrypt, mountEncryptStatusBar, unmountEncryptStatusBar } from './encrypt';
import { openLauncherPanel, unloadLauncherPanel, setLauncherShowTextSetter, setLauncherGestureSetter, LauncherModal } from './launcher';
import { registerGestureListeners } from './launcher/gestures';
import { ensureAutoSummary, unloadAutoSummary } from './auto-summary';
// ai-agent 域解散：文件同步拆入 memo/favorites 域（原 ensureAIAgent/unloadAIAgent 换线）
import { ensureMemoFileSync, unloadMemoFileSync } from './memo';
import { ensureFavoritesFileSync, unloadFavoritesFileSync } from './favorites';
// 日记本（diary-notebook 合并）
import { setApp as setDiaryApp } from './diary/app';
import { applyDirectories } from './diary/config';
import { loadAll } from './diary/store';
import { state as diaryState } from './diary/state';
import { applyUiSettings, init as diaryInit, showDiaryPanel, unregisterEscLayer } from './diary/ui/panel';
// 小橘陪伴猫（smartcat 域：桌面宠物 + AI 陪伴；AI 走 bz core/ai，数据单 json smartcat.json）
import { ensureSmartCat, unloadSmartCat, openSmartCat, openSmartCatChat, hideSmartCat, openSmartcatDashboard } from './smartcat';

/** 命令表：id/name 统一命名（spec「命令 id 全清单」第 9 轮：bz-<域>-<动作>，icon 与入口页磁贴一致） */
const COMMANDS: { id: string; name: string; icon: string; callback: () => void }[] = [
  // 入口页（t1：主页 → 入口页，术语随 CONTEXT.md；id bz-home 不变）
  { id: 'bz-home', name: '入口页', icon: 'home', callback: () => openLauncherPanel(getApp()) },
  // 备忘录
  { id: 'bz-memo-open', name: '备忘录', icon: 'sticky-note', callback: () => openBzPanel(getApp()) },
  { id: 'bz-memo-add', name: '加备忘', icon: 'pencil', callback: () => createMemoItem(getApp()) },
  // 归物本
  { id: 'bz-belongings-add', name: '加物品', icon: 'archive', callback: () => addBelongingsItem(getApp()) },
  { id: 'bz-belongings-open', name: '归物本', icon: 'package', callback: () => openBelongings(getApp()) },
  // 剪藏本
  { id: 'bz-clipping-open', name: '剪藏本', icon: 'scissors', callback: () => openArticleView(getApp()) },
  // 聚合讯
  { id: 'bz-news-open', name: '聚合讯', icon: 'rss', callback: () => openNewsReader(getApp()) },
  // 密码本
  { id: 'bz-pw-open', name: '密码本', icon: 'key', callback: () => openPasswordManager(getApp()) },
  { id: 'bz-pw-add', name: '加密码', icon: 'key-round', callback: () => addPasswordEntry(getApp()) },
  { id: 'bz-pw-generate', name: '生成随机密码', icon: 'key-square', callback: () => generatePassword(getApp()) },
  // 收藏本
  { id: 'bz-favorites-open', name: '收藏本', icon: 'star', callback: () => openFavoritesPanel(getApp()) },
  { id: 'bz-favorites-add', name: '加收藏', icon: 'bookmark', callback: () => addFavoriteItem(getApp()) },
  // 书库
  { id: 'bz-library-open', name: '书库', icon: 'library', callback: () => openLibrary(getApp()) },
  { id: 'bz-book-notes-open', name: '读书笔记', icon: 'book-open', callback: () => openBookNotes(getApp()) },
  // 阅读数据分析报告（t2：阅读分析报告 → 阅读数据分析报告，术语随 CONTEXT.md）
  { id: 'bz-reading-report-open', name: '阅读数据分析报告', icon: 'bar-chart-3', callback: () => showReadingReport(getApp()) },
  // 影视
  { id: 'bz-movie-open', name: '影视', icon: 'film', callback: () => openMovieManager(getApp()) },
  { id: 'bz-movie-add', name: '加影视', icon: 'clapperboard', callback: () => addMovieItem(getApp()) },
  // 影视分析报告（独立域，ADR-0048；f7 解冻：去 clapperboard 重复 → pie-chart，id/名称契约不动）
  { id: 'bz-movie-report', name: '影视分析报告', icon: 'pie-chart', callback: () => openMovieReport(getApp()) },
  // 复习计划（9 命令）
  { id: 'bz-review-open', name: '复习计划', icon: 'calendar', callback: () => openReviewPanel(getApp()) },
  { id: 'bz-review-start', name: '开始复习', icon: 'play', callback: () => reviewStart(getApp()) },
  { id: 'bz-review-add', name: '加入复习计划', icon: 'plus', callback: () => reviewAddCurrent(getApp()) },
  { id: 'bz-review-remove', name: '移出复习计划', icon: 'minus', callback: () => reviewRemoveCurrent(getApp()) },
  { id: 'bz-review-overdue', name: '复习（跳转逾期）', icon: 'alarm-clock', callback: () => reviewJumpOverdue(getApp()) },
  { id: 'bz-review-rate', name: '复习（选择难度）', icon: 'gauge', callback: () => reviewMarkDialog(getApp()) },
  // f3：评级四命令去英文后缀并统一「复习（X）」标点（id 不动）
  { id: 'bz-review-again', name: '复习（忘了）', icon: 'rotate-ccw', callback: () => reviewMarkRating(getApp(), 'again') },
  { id: 'bz-review-hard', name: '复习（困难）', icon: 'trending-up', callback: () => reviewMarkRating(getApp(), 'hard') },
  { id: 'bz-review-good', name: '复习（一般）', icon: 'check', callback: () => reviewMarkRating(getApp(), 'good') },
  { id: 'bz-review-easy', name: '复习（简单）', icon: 'sparkles', callback: () => reviewMarkRating(getApp(), 'easy') },
  // 第二大脑（ticket 103：原闪念正名接管，主面板为统一入口）
  { id: 'bz-secondbrain-panel', name: '第二大脑面板', icon: 'brain', callback: () => openSecondBrainPanel(getApp()) },
  // f7：与「第二大脑面板」区分——本命令打开参考侧边栏（右侧窄窗/移动端抽屉参考 tab）
  { id: 'bz-secondbrain-open', name: '第二大脑参考', icon: 'zap', callback: () => openSecondBrainReference(getApp()) },
  { id: 'bz-secondbrain-chat', name: '第二大脑对话', icon: 'message-circle', callback: () => openSecondBrainChat(getApp()) },
  // 自动双链（ticket 111）：当前笔记重跑一次关联（正文大改后的手动兜底入口）
  { id: 'bz-secondbrain-rebuild-links', name: '重跑当前笔记关联', icon: 'link', callback: () => rebuildSecondBrainLinks(getApp()) },
  // 自动双链（ticket 115）：存量未连接笔记手动批量补链（启动自动补链的显式兜底）
  { id: 'bz-secondbrain-link-all', name: '为未关联笔记批量补链', icon: 'link-2', callback: () => runSecondBrainLinkAll(getApp()) },
  // 番茄钟（ticket 26-32 新域）
  { id: 'bz-pomodoro-open', name: '番茄钟', icon: 'timer', callback: () => openPomodoro(getApp()) },
  // B站下载器（外部工具 @jwbz/bili-downloader，tools/bili-downloader，ADR-0011）
  { id: 'bz-bili-open', name: 'B站下载器', icon: 'tv-minimal-play', callback: () => openBiliDownloader() },
  // 文献盒（视频转文献，ADR-0065 起建 / ADR-0066 正名：面板并入下载入口 + 设置提取 + 行内进度）
  { id: 'bz-bili-tasks-open', name: '文献盒', icon: 'list-video', callback: () => openBiliTasksPanel(getApp()) },
  // 附件搬移（ticket 65 新域：移动当前笔记附件到指定文件夹，fileManager 自动更新内部链接）
  { id: ATTACH_COMMAND_ID, name: '移动附件', icon: 'folder-down', callback: () => openAttachMove(getApp()) },
  // 保险箱（encrypt 域：移出式清单容器加密；原名「加密保险箱」，ticket 68 更名仅文案）
  { id: 'bz-encrypt-open', name: '保险箱', icon: 'lock', callback: () => openEncrypt(getApp()) },
  { id: 'bz-encrypt-lock', name: '加密当前笔记', icon: 'lock-keyhole', callback: () => encryptCurrentNote(getApp()) },
  // 小橘陪伴猫（smartcat 域）
  { id: 'bz-smartcat-open', name: '小橘', icon: 'cat', callback: () => openSmartCat(getApp()) },
  // f7：去 message-circle 重复（第二大脑对话保留）→ messages-square
  { id: 'bz-smartcat-chat', name: '小橘聊天', icon: 'messages-square', callback: () => openSmartCatChat(getApp()) },
  { id: 'bz-smartcat-hide', name: '隐藏小橘', icon: 'eye-off', callback: () => hideSmartCat() },
  { id: 'bz-smartcat-dashboard', name: '小橘数据面板', icon: 'activity', callback: () => openSmartcatDashboard(getApp()) },
];

/** 应用日记本设置到运行时常量（diary-notebook 原 applySettingsToRuntime） */
function applyDiarySettingsToRuntime(s: BzSettings) {
  applyDirectories(s);
  applyUiSettings(s);
}

export default class BzPlugin extends Plugin {
  settings: BzSettings = { ...DEFAULT_SETTINGS };
  private registeredCommandIds: string[] = [];
  private unregisterGestures: (() => void) | null = null;

  async onload() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    // ADR-0009 迁移：共享数据路径 storagePath 初始化（旧 7 字段废弃仅兼容保留）
    let migrated = false;
    if (!loaded || loaded.storagePath === undefined) {
      this.migrateStoragePath();
      migrated = true;
    }
    // 手势设置迁移：旧 gestureDoubleTap/TripleTap/SwipeDown（string 'off'/命令 id 或 boolean）→ launcherGesture 单选
    const old = this.settings as any;
    const hasOldGesture =
      old.gestureDoubleTap !== undefined || old.gestureTripleTap !== undefined || old.gestureSwipeDown !== undefined;
    if (hasOldGesture) {
      const pick = (k: string): boolean => {
        const v = old[k];
        if (typeof v === 'string') return v !== 'off';
        return !!v;
      };
      (this.settings as any).launcherGesture = pick('gestureDoubleTap')
        ? 'double'
        : pick('gestureTripleTap')
          ? 'triple'
          : pick('gestureSwipeDown')
            ? 'swipe'
            : 'off';
      delete old.gestureDoubleTap;
      delete old.gestureTripleTap;
      delete old.gestureSwipeDown;
      migrated = true;
    }
    // ticket 103 迁移：闪念 16 键 → secondBrain* 更名平移（META_PATH/VEC_PATH 废弃清除）
    if (migrateSecondBrainSettings(this.settings)) migrated = true;
    // P2：迁移完成立即落盘——storagePath/手势结果写回 data.json，迁移 warning 不随每次启动重播
    if (migrated) void this.saveSettings();
    setApp(this.app);
    // AI 设置注入（Q3 的 _q3Settings 语义 → 插件设置）
    setAISettingsProvider(() => this.settings);
    resetAIProviderCache();
    // 通用设置访问器（各域经 getSettings 读取）
    setSettingsProvider(() => this.settings);
    // 设置保存通道（域设置弹窗写回后持久化）
    setSettingsSaver(() => this.saveSettings());
    // 入口页：右上角文字/手势开关写回设置（平台独立字段：桌面 launcherShowText/launcherGesture，移动 launcherShowTextMobile/launcherGestureMobile）
    setLauncherShowTextSetter((v) => {
      if (LauncherModal.isMobileEnv()) this.settings.launcherShowTextMobile = v;
      else this.settings.launcherShowText = v;
      void this.saveSettings();
    });
    setLauncherGestureSetter((v) => {
      if (LauncherModal.isMobileEnv()) this.settings.launcherGestureMobile = v;
      else this.settings.launcherGesture = v;
      void this.saveSettings();
      this.syncGestures(); // 手势监听随设置变更重注册
    });
    // 备忘录设置注入
    setBzSettingsProvider(() => this.settings);
    // 日记本注入（diary-notebook 合并）
    setDiaryApp(this.app);
    applyDiarySettingsToRuntime(this.settings);
    // 域事件总线地基：全插件唯一 vault 订阅点挂载（registerEvent 保证插件卸载时 Obsidian 自动清理引用）
    attachObsidianAdapter(this.app, (ref) => this.registerEvent(ref as any));

    // 命令裸注册（ADR-0004：app.commands.addCommand 原样 id 注册——plugin.addCommand 会被 Obsidian 自动加插件前缀，主页.js 等外部裸 id 调用会失效）
    for (const c of COMMANDS) {
      (this.app as any).commands.addCommand({ id: c.id, name: c.name, icon: c.icon, callback: c.callback });
      this.registeredCommandIds.push(c.id);
    }

    // 附件搬移：入口页磁贴自动播种（desktop+mobile 末尾，幂等）
    void ensureAttachSeed(this.app);

    // ribbon 主入口：备忘录面板 + 日记本
    this.addRibbonIcon('check-square', '备忘录', () => openBzPanel(this.app));
    this.addRibbonIcon('notebook-pen', '日记本', () => showDiaryPanel(this));

    // 番茄钟状态栏（ticket 29：常驻倒计时，点击打开弹窗）
    mountPomodoroStatusBar(this.addStatusBarItem(), this.app);

    // 保险箱状态栏（补丁2：锁状态提示，点击打开面板；解锁态由 encrypt Controller 接管刷新）
    mountEncryptStatusBar(this.addStatusBarItem());

    // 日记本面板命令（统一 bz- 前缀；bz-diary-write 由 quote.ts init 内注册）
    (this.app as any).commands.addCommand({ id: 'bz-diary-open', name: '日记本', icon: 'notebook', callback: () => showDiaryPanel(this) });
    this.registeredCommandIds.push('bz-diary-open');

    // 设置页
    this.addSettingTab(new BzSettingTab(this.app, this));

    // 事件常驻域按设置开关注册（懒加载架构）
    this.app.workspace.onLayoutReady(() => {
      // 备忘录：启动即初始化（对齐源码 App.init：file-open 提醒 + 剪贴板监听 + autoPopupOnStart）
      void ensureBz(this.app);
      // 日记本：启动即初始化（diary-notebook 原行为：onLayoutReady → init）
      void diaryInit(this);
      if (this.settings.autoSummaryEnabled) ensureAutoSummary(this.app);
      if (this.settings.aiAgentEnabled) {
        ensureMemoFileSync(this.app);
        ensureFavoritesFileSync(this.app);
      }
      if (this.settings.secondBrainEnabled) ensureSecondBrainOnReady(this.app);
      // 复习计划：到期提醒开启时常驻（ticket 100——监听/染色/轮询统一启动；否则懒加载）；enableAutoNotify 缺省视为开
      if (this.settings.enableAutoNotify !== false) void ensureReview(this.app);
      // 番茄钟：启动即恢复（load+recover，正在倒计时则后台继续/按设置自动弹窗）
      void ensurePomodoro(this.app);
      // 小橘：启动即挂载（smartcatEnabled 开关；桌面宠物常驻）
      if (this.settings.smartcatEnabled) void ensureSmartCat(this.app);
    });
    // 手势触发（设置页可配，默认关闭）
    this.syncGestures();
  }

  async onunload() {
    // 统一右键菜单/长按抽屉浮层先收口（fix(main)：卸载接线补全）
    closeItemMenu();
    // toast 卸载清理（UX 整改 l2-toast）：清空通知容器 DOM + 存活/去重状态
    cleanupNotices();
    // 清理裸注册命令（统一 bz- 前缀，必须显式 removeCommand）
    for (const id of this.registeredCommandIds) {
      try {
        (this.app as any).commands.removeCommand(id);
      } catch (e) {
        /* 命令可能已被移除 */
      }
    }
    escManager.destroy();
    unmountPomodoroStatusBar();
    unmountEncryptStatusBar();
    unloadPomodoro();
    unloadBz();
    unloadMemoFileSync();
    unloadFavoritesFileSync();
    unloadLauncherPanel();
    unloadEncrypt();
    unloadSmartCat();
    // 第二大脑：窄窗/抽屉 DOM、5s 防抖定时器、DeepSeek 服务、模块单例复位（ticket 107 补接线——
    // 原先 unloadSecondBrain 导出但从未被调用，禁用插件后残留窗体且防抖 refresh 仍会触发）
    unloadSecondBrain();
    // 各域卸载清理补全（fix(main)：unload 函数均不内部触发 ensure，可无条件调用；
    // 未初始化域调用为幂等空清理，不引起无谓装载）
    unloadPassword();
    unloadBelongings();
    unloadFavorites();
    unloadReview();
    unloadMovie();
    unloadMovieReport();
    unloadReadingReport();
    unloadLibrary();
    unloadNewsReader();
    unloadArticleView();
    unloadAutoSummary();
    // 文献盒（ADR-0065 起建：面板 DOM + 模块单例复位；ADR-0066 正名）
    unloadBiliDownloader();
    // 域事件总线收口：摘除 vault 订阅点 + 清空全部域事件订阅（总线为进程内单例，随插件卸载全量清空）
    detachObsidianAdapter();
    clearDomainEvents();
    if (this.unregisterGestures) {
      this.unregisterGestures();
      this.unregisterGestures = null;
    }
    // 日记本清理（diary-notebook 原 onunload；escManager.destroy 已在上面统一调用）
    const diaryIds = [
      'diary-tag-filter',
      'diary-filter-mask',
      'diary-search-container',
      'diary-subtags-container',
      'add-diary-mask',
      'add-diary-popup',
      'diary-tag-selector-mask',
      'diary-tag-selector-popup',
      'unified-datetime-picker-mask',
      'diary-date-filter-mask',
      'diary-date-filter-popup',
      '__shared_confirm_mask__',
      'diary-styles',
    ];
    for (const id of diaryIds) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    unregisterEscLayer();
    try {
      (this.app as any).commands.removeCommand('bz-diary-write');
    } catch (e) {
      /* 命令可能已被移除 */
    }
    diaryState.events.fileListenerAttached = false;
    // 卸载兜底（UX 整改 l2）：异步尾任务禁用前若 notify 重建过通知容器，此处再次清理
    cleanupNotices();
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // 设置变更后重置 AI provider 缓存：DeepSeek key/服务商改动立即生效（AI 消费方）
    resetAIProviderCache();
  }

  /** ADR-0009 迁移：旧 7 个 JSON 路径字段初始化 storagePath（全同 → seed；参差 → 默认 + Notice 列出被忽略路径） */
  migrateStoragePath(): void {
    const dirOf = (v: string) => (v || '').trim().replace(/\/+$/, '');
    const fileDir = (v: string, file: string) => dirOf(v).replace(new RegExp('/' + file + '$'), '');
    const oldPaths: Array<[string, string]> = [
      ['todoFilePath', dirOf(this.settings.todoFilePath)],
      ['belongingsDataFolder', dirOf(this.settings.belongingsDataFolder)],
      ['pwStoragePath', dirOf(this.settings.pwStoragePath)],
      ['favoritesStoragePath', dirOf(this.settings.favoritesStoragePath)],
      ['reviewStoragePath', dirOf(this.settings.reviewStoragePath)],
      // ticket 103：META_PATH/VEC_PATH 已从接口删除；此处仅 ADR-0009 首次迁移窗口读旧 data.json 残值
      ['META_PATH', fileDir(String((this.settings as any).META_PATH ?? ''), 'ai_completion_meta.json')],
      ['VEC_PATH', fileDir(String((this.settings as any).VEC_PATH ?? ''), 'ai_completion_vectors.vec')],
    ];
    const vals = oldPaths.map(([, v]) => v || 'CONFIG/STORAGE');
    if (vals.every((v) => v === vals[0])) {
      this.settings.storagePath = vals[0] || 'CONFIG/STORAGE';
      return;
    }
    this.settings.storagePath = 'CONFIG/STORAGE';
    const custom = oldPaths
      .filter(([, v]) => v && v !== 'CONFIG/STORAGE')
      .map(([k]) => k)
      .join('、');
    if (custom) {
      notice('检测到旧版数据路径设置（' + custom + '），已统一为 CONFIG/STORAGE，请手动迁移对应数据文件。', 'warning');
    }
  }

  /** 手势监听同步：按设置单选手势注册（设置变更/插件加载时调用，幂等）；动作固定为打开入口页 */
  syncGestures(): void {
    if (this.unregisterGestures) {
      this.unregisterGestures();
      this.unregisterGestures = null;
    }
    const isMobile = LauncherModal.isMobileEnv();
    const g = isMobile
      ? (this.settings.launcherGestureMobile ?? this.settings.launcherGesture) // 移动端未设置 → 继承桌面
      : this.settings.launcherGesture;
    const on = (kind: string) => (g === kind ? 'bz-home' : 'off');
    this.unregisterGestures = registerGestureListeners(this.app, {
      gestureDoubleTap: on('double'),
      gestureTripleTap: on('triple'),
      gestureSwipeDown: on('swipe'),
    });
  }
}

/** 第二大脑在布局就绪后初始化（按设置开关；ticket 103 原闪念懒加载换线） */
function ensureSecondBrainOnReady(app: any) {
  // 延迟到 onLayoutReady 之后的事件循环，避免 onload 时序问题
  setTimeout(() => {
    // 动态引入避免循环依赖；第二大脑自身懒加载
    import('./secondbrain').then((m) => m.ensureSecondBrain(app));
  }, 0);
}

// ===== 设置页（ADR-0009：单页平铺，只含「🤖 AI」「📂 数据存储路径」两区块）=====
// ticket 131：两区块 schema 化（ADR-0064 声明式渲染器），原私有 textSetting/toggleSetting/
// pathSetting helper 退役（text 防抖落盘/onCommit 一次性提示语义收口 core 渲染器）。

export class BzSettingTab extends PluginSettingTab {
  plugin: BzPlugin;

  constructor(app: any, plugin: BzPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    // AI 服务商切换 → 密钥行显隐走 visibleWhen；存储路径 onCommit warning 文案逐字保留
    // （schema 定义见 core/settings-main-schema.ts）；渲染器统一完成徽标/两行式标注/初始显隐
    renderSettingsInto(containerEl, mainSettingsSchema());
  }
}
