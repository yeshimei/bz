/**
 * bz 插件入口：装配、命令注册（ADR-0004 裸注册）、设置页、懒加载（ADR-0003）。
 *
 * 命令 id 统一 `bz-` 前缀（ADR-0004 修订：2025 用户决策统一品牌前缀），不设置默认快捷键，
 * 卸载时 removeCommand 清理——取代原脚本的 window.__*CommandRegistered 防重标志。
 */
import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { escManager } from './core/esc-manager';
import { setApp, getApp } from './core/app';
import { setAISettingsProvider, resetAIProviderCache } from './core/ai';
import { setSettingsProvider } from './core/settings-provider';
import { setBzSettingsProvider, unloadBz, ensureBz } from './bz';

import BzSettings, { DEFAULT_SETTINGS } from './settings';

// 15 域（懒加载：首次命令/事件触发时 ensureXxx 幂等初始化）
import { openBzPanel, createMemoItem } from './bz';
import { addBelongingsItem, openBelongings } from './belongings';
import { openArticleView } from './clipping';
import { openNewsReader } from './news';
import { openPasswordManager, addPasswordEntry, generatePassword } from './password';
import { openFavoritesPanel, addFavoriteItem } from './favorites';
import { openLibrary, openBookNotes } from './library';
import { showReadingReport } from './reading-report';
import { openMovieManager, addMovieItem } from './movie';
import { openReviewPanel, reviewAddCurrent, reviewRemoveCurrent, reviewJumpOverdue, reviewMarkDialog, reviewMarkRating } from './review';
import { quizUpdate, quizOpen } from './quiz';
import { openFlashReference, openFlashChat } from './flash';
import { ensureAutoSummary } from './auto-summary';
import { ensureAIAgent, unloadAIAgent } from './ai-agent';
// 日记本（diary-notebook 合并）
import { setApp as setDiaryApp } from './diary/app';
import { applyDirectories } from './diary/config';
import { loadAll } from './diary/store';
import { state as diaryState } from './diary/state';
import { applyUiSettings, init as diaryInit, showDiaryPanel, unregisterEscLayer } from './diary/ui/panel';

/** 命令表：id/name 均提取自原脚本 addCommand 调用点（spec「命令 id 全清单」） */
const COMMANDS: { id: string; name: string; callback: () => void }[] = [
  // 备忘录
  { id: 'bz-memo-open-panel', name: '打开备忘录面板', callback: () => openBzPanel(getApp()) },
  { id: 'bz-memo-create-item', name: '创建备忘录条目', callback: () => createMemoItem(getApp()) },
  // 归物本
  { id: 'bz-belongings-add-item', name: '归物本：添加物品', callback: () => addBelongingsItem(getApp()) },
  { id: 'bz-belongings-open-panel', name: '归物本：打开面板', callback: () => openBelongings(getApp()) },
  // 剪藏本
  { id: 'bz-article-open-view', name: '打开文章列表', callback: () => openArticleView(getApp()) },
  // 聚合讯
  { id: 'bz-news-reader-open', name: '打开资讯阅读器', callback: () => openNewsReader(getApp()) },
  // 密码本
  { id: 'bz-pw-open-manager', name: '打开密码本', callback: () => openPasswordManager(getApp()) },
  { id: 'bz-pw-add-entry', name: '添加密码条目', callback: () => addPasswordEntry(getApp()) },
  { id: 'bz-pw-generate-password', name: '生成随机密码', callback: () => generatePassword(getApp()) },
  // 收藏本
  { id: 'bz-favorites-open-panel', name: '打开收藏面板', callback: () => openFavoritesPanel(getApp()) },
  { id: 'bz-favorites-add-item', name: '添加收藏', callback: () => addFavoriteItem(getApp()) },
  // 书库
  { id: 'bz-open-library', name: '打开书库', callback: () => openLibrary(getApp()) },
  { id: 'bz-open-book-notes', name: '打开读书笔记', callback: () => openBookNotes(getApp()) },
  // 阅读数据分析报告
  { id: 'bz-show-reading-report', name: '打开阅读数据分析报告', callback: () => showReadingReport(getApp()) },
  // 影视
  { id: 'bz-movie-manager-open', name: '影视：打开', callback: () => openMovieManager(getApp()) },
  { id: 'bz-movie-manager-add', name: '影视：添加', callback: () => addMovieItem(getApp()) },
  // 复习计划（5 命令）
  { id: 'bz-review-open-panel', name: '打开复习面板', callback: () => openReviewPanel(getApp()) },
  { id: 'bz-review-add-current', name: '加入复习计划', callback: () => reviewAddCurrent(getApp()) },
  { id: 'bz-review-remove-current', name: '移出复习计划', callback: () => reviewRemoveCurrent(getApp()) },
  { id: 'bz-review-jump-overdue', name: '复习（跳转逾期）', callback: () => reviewJumpOverdue(getApp()) },
  { id: 'bz-review-mark-dialog', name: '复习（选择难度）', callback: () => reviewMarkDialog(getApp()) },
  { id: 'bz-review-mark-again', name: '复习：忘了（Again）', callback: () => reviewMarkRating(getApp(), 'again') },
  { id: 'bz-review-mark-hard', name: '复习：困难（Hard）', callback: () => reviewMarkRating(getApp(), 'hard') },
  { id: 'bz-review-mark-good', name: '复习：一般（Good）', callback: () => reviewMarkRating(getApp(), 'good') },
  { id: 'bz-review-mark-easy', name: '复习：简单（Easy）', callback: () => reviewMarkRating(getApp(), 'easy') },
  // 做题家
  { id: 'bz-quiz-master-update', name: '更新题库', callback: () => quizUpdate(getApp()) },
  { id: 'bz-quiz-master-open', name: '打开做题家', callback: () => quizOpen(getApp()) },
  // 闪念
  { id: 'bz-shan-nian-open-reference', name: '闪念：打开参考窗口', callback: () => openFlashReference(getApp()) },
  { id: 'bz-shan-nian-open-chat', name: '闪念：打开 AI 对话', callback: () => openFlashChat(getApp()) },
];

/** 应用日记本设置到运行时常量（diary-notebook 原 applySettingsToRuntime） */
function applyDiarySettingsToRuntime(s: BzSettings) {
  applyDirectories(s);
  applyUiSettings(s);
}

export default class BzPlugin extends Plugin {
  settings: BzSettings = { ...DEFAULT_SETTINGS };
  private registeredCommandIds: string[] = [];

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    setApp(this.app);
    // AI 设置注入（Q3 的 _q3Settings 语义 → 插件设置）
    setAISettingsProvider(() => this.settings);
    resetAIProviderCache();
    // 通用设置访问器（各域经 getSettings 读取）
    setSettingsProvider(() => this.settings);
    // 备忘录设置注入
    setBzSettingsProvider(() => this.settings);
    // 日记本注入（diary-notebook 合并）
    setDiaryApp(this.app);
    applyDiarySettingsToRuntime(this.settings);

    // 命令裸注册（ADR-0004：app.commands.addCommand 原样 id 注册——plugin.addCommand 会被 Obsidian 自动加插件前缀，主页.js 等外部裸 id 调用会失效）
    for (const c of COMMANDS) {
      (this.app as any).commands.addCommand({ id: c.id, name: c.name, callback: c.callback });
      this.registeredCommandIds.push(c.id);
    }

    // ribbon 主入口：备忘录面板 + 日记本
    this.addRibbonIcon('check-square', '备忘录', () => openBzPanel(this.app));
    this.addRibbonIcon('notebook-pen', '日记本', () => showDiaryPanel(this));

    // 日记本面板命令（统一 bz- 前缀；bz-diary-open-add-dialog/bz-diary-create-quote 由 init 内注册）
    (this.app as any).commands.addCommand({ id: 'bz-open-panel', name: '打开日记本面板', callback: () => showDiaryPanel(this) });
    this.registeredCommandIds.push('bz-open-panel');

    // 设置页
    this.addSettingTab(new BzSettingTab(this.app, this));

    // 事件常驻域按设置开关注册（懒加载架构）
    this.app.workspace.onLayoutReady(() => {
      // 备忘录：启动即初始化（对齐源码 App.init：file-open 提醒 + 剪贴板监听 + autoPopupOnStart）
      void ensureBz(this.app);
      // 日记本：启动即初始化（diary-notebook 原行为：onLayoutReady → init）
      void diaryInit(this);
      if (this.settings.autoSummaryEnabled) ensureAutoSummary(this.app);
      if (this.settings.aiAgentEnabled) ensureAIAgent(this.app);
      if (this.settings.flashEnabled) ensureFlashOnReady(this.app);
    });
  }

  async onunload() {
    // 清理裸注册命令（统一 bz- 前缀，必须显式 removeCommand）
    for (const id of this.registeredCommandIds) {
      try {
        (this.app as any).commands.removeCommand(id);
      } catch (e) {
        /* 命令可能已被移除 */
      }
    }
    escManager.destroy();
    unloadBz();
    unloadAIAgent();
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
      (this.app as any).commands.removeCommand('bz-diary-open-add-dialog');
      (this.app as any).commands.removeCommand('bz-diary-create-quote');
    } catch (e) {
      /* 命令可能已被移除 */
    }
    diaryState.events.fileListenerAttached = false;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

/** 闪念在布局就绪后初始化（按设置开关） */
function ensureFlashOnReady(app: any) {
  // 延迟到 onLayoutReady 之后的事件循环，避免 onload 时序问题
  setTimeout(() => {
    // 动态引入避免循环依赖；闪念自身懒加载
    import('./flash').then((m) => m.ensureFlash(app));
  }, 0);
}

// ===== 设置页 =====

export class BzSettingTab extends PluginSettingTab {
  plugin: BzPlugin;

  constructor(app: any, plugin: BzPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const save = async () => {
      await this.plugin.saveSettings();
    };

    // 顶部分页（参考 obsidian-linter 设置页：tab 组 + 分区内容）
    const tabs: { id: string; label: string; build: (el: HTMLElement) => void }[] = [
      { id: 'ai', label: 'AI', build: (el) => this.buildAiTab(el, s, save) },
      { id: 'bz', label: '备忘录', build: (el) => this.buildMemoTab(el, s, save) },
      { id: 'diary', label: '日记本', build: (el) => this.buildDiaryTab(el, s, save) },
      { id: 'belongings', label: '归物本', build: (el) => this.buildBelongingsTab(el, s, save) },
      { id: 'clipping', label: '剪藏本', build: (el) => this.buildClippingTab(el, s, save) },
      { id: 'password', label: '密码本', build: (el) => this.buildPasswordTab(el, s, save) },
      { id: 'favorites', label: '收藏本', build: (el) => this.buildFavoritesTab(el, s, save) },
      { id: 'library', label: '书库', build: (el) => this.buildLibraryTab(el, s, save) },
      { id: 'movie', label: '影视', build: (el) => this.buildMovieTab(el, s, save) },
      { id: 'review', label: '复习计划', build: (el) => this.buildReviewTab(el, s, save) },
      { id: 'ai-agent', label: 'AI Agent', build: (el) => this.buildAIAgentTab(el, s, save) },
      { id: 'flash', label: '闪念', build: (el) => this.buildFlashTab(el, s, save) },
    ];

    const header = containerEl.createDiv({ cls: 'bz-setting-header' });
    const tabGroup = header.createDiv({ cls: 'bz-tab-group' });
    const contentWrap = containerEl.createDiv({ cls: 'bz-setting-content' });

    const buttons: HTMLElement[] = [];
    const contents: HTMLElement[] = [];
    for (const t of tabs) {
      const btn = tabGroup.createDiv({ cls: 'bz-tab', text: t.label });
      const content = contentWrap.createDiv({ cls: 'bz-tab-content' });
      t.build(content);
      btn.addEventListener('click', () => {
        buttons.forEach((b, i) => b.toggleClass('bz-tab-active', b === btn));
        contents.forEach((c, i) => c.toggleClass('bz-tab-content-active', c === content));
      });
      buttons.push(btn);
      contents.push(content);
    }
    // 默认显示第一个 tab（AI）
    buttons[0].addClass('bz-tab-active');
    contents[0].addClass('bz-tab-content-active');
  }

  // ===== AI =====（服务商下拉 + 动态显示对应 API Key）
  private buildAiTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    let deepseekRow: Setting | null = null;
    let opencodeRow: Setting | null = null;
    const refreshKeys = () => {
      const isDeepseek = s.aiProvider === 'deepseek';
      if (deepseekRow) deepseekRow.settingEl.toggleClass('bz-setting-hidden', !isDeepseek);
      if (opencodeRow) opencodeRow.settingEl.toggleClass('bz-setting-hidden', isDeepseek);
    };
    new Setting(el)
      .setName('AI 服务商')
      .setDesc('选择 AI 服务商，切换后显示对应的 API Key 配置')
      .addDropdown((dd) => {
        dd.addOption('deepseek', 'DeepSeek');
        dd.addOption('opencode-go', 'OpenCode Go');
        dd.setValue(s.aiProvider === 'deepseek' ? 'deepseek' : 'opencode-go');
        dd.onChange(async (v) => {
          s.aiProvider = v;
          refreshKeys();
          await save();
        });
      });
    deepseekRow = new Setting(el)
      .setName('DeepSeek API Key')
      .setDesc('留空则回退读取 QuickAdd data.json 里的 key')
      .addText((text) =>
        text
          .setValue(s.deepseekApiKey)
          .onChange(async (v) => {
            s.deepseekApiKey = v;
            await save();
          })
      );
    opencodeRow = new Setting(el)
      .setName('OpenCode Go API Key')
      .setDesc('从 opencode.ai/zen 订阅后获取')
      .addText((text) =>
        text
          .setValue(s.opencodeGoApiKey)
          .onChange(async (v) => {
            s.opencodeGoApiKey = v;
            await save();
          })
      );
    refreshKeys();
  }

  // ===== 备忘录 =====（场景/平台映射设置已移除；显示文件名固定开启不暴露）
  private buildMemoTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.textSetting(el, '备忘录数据文件路径', '存放 memo.json 的目录', s.todoFilePath, save, (v) => (s.todoFilePath = v));
    this.toggleSetting(el, '启动时自动弹窗', '启动时自动弹出备忘录面板（有重要备忘录时）', s.autoPopupOnStart, save, (v) => (s.autoPopupOnStart = v));
  }

  // ===== 日记本 =====（长按手势固定启用；每批加载数量可配）
  private buildDiaryTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.textSetting(el, '日记目录', '存放日记 markdown 文件的文件夹路径', s.diaryDirectory, save, (v) => (s.diaryDirectory = v));
    this.textSetting(el, '影视目录', '存放影视笔记的文件夹路径（日记本用）', s.movieDirectory, save, (v) => (s.movieDirectory = v));
    this.textSetting(el, '信目录', '存放信件的文件夹路径', s.letterDirectory, save, (v) => (s.letterDirectory = v));
    this.textSetting(el, '每批加载数量', '滚动加载时每批显示的条目数', s.diaryBatchSize, save, (v) => (s.diaryBatchSize = v));
    this.toggleSetting(el, '显示标签计数', '在标签按钮上显示该标签包含的条目数量', s.showTagCount, save, (v) => (s.showTagCount = v));
    this.toggleSetting(el, '使用文件日期作为默认日期', '开启后，添加日记时默认日期取自当前打开的日记文件的日期（若为日记文件）；关闭则使用当前时间', s.useFileDateTime, save, (v) => (s.useFileDateTime = v));
  }

  // ===== 归物本 =====（自定义分类设置已移除）
  private buildBelongingsTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.textSetting(el, '存储文件夹路径', '存放 belongings.json 的文件夹', s.belongingsDataFolder, save, (v) => (s.belongingsDataFolder = v));
  }

  // ===== 剪藏本 =====（长按识别时长固定默认；自动摘要开关并入本 tab）
  private buildClippingTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.textSetting(el, '剪藏目录', '存放网页剪藏 markdown 文件的文件夹', s.articleDirectory, save, (v) => (s.articleDirectory = v));
    this.textSetting(el, '每批加载数量', '滚动加载时每批显示的条目数', s.articleBatchSize, save, (v) => (s.articleBatchSize = v));
    this.toggleSetting(el, '自动摘要', '监听剪藏目录新文件，AI 生成摘要写回 frontmatter（路径与剪藏目录一致）', s.autoSummaryEnabled, save, async (v) => {
      s.autoSummaryEnabled = v;
      if (v) ensureAutoSummary(this.plugin.app);
    });
  }

  // ===== 密码本 =====
  private buildPasswordTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.textSetting(el, '数据存储路径', '存放加密密码数据文件的目录', s.pwStoragePath, save, (v) => (s.pwStoragePath = v));
    this.textSetting(el, '密码生成字符集', '随机生成密码时使用的字符集', s.passwordCharset, save, (v) => (s.passwordCharset = v));
    this.textSetting(el, '密码生成长度', '随机生成密码的长度（数字）', s.passwordLength, save, (v) => (s.passwordLength = v));
    this.toggleSetting(el, '安全模式', '开启后，关闭列表窗口立即自动上锁', s.securityMode, save, (v) => (s.securityMode = v));
  }

  // ===== 收藏本 =====
  private buildFavoritesTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.textSetting(el, '数据存储路径', '存放 favorites.json 的目录（文件名固定，不可修改）', s.favoritesStoragePath, save, (v) => (s.favoritesStoragePath = v));
  }

  // ===== 书库 =====
  private buildLibraryTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.textSetting(el, '书库文件夹', '存放书籍笔记的根目录', s.libraryFolderPath, save, (v) => (s.libraryFolderPath = v));
    this.textSetting(el, '读书笔记路径', '长按书籍时打开的读书笔记所在目录', s.libraryNotePath, save, (v) => (s.libraryNotePath = v));
    this.textSetting(el, '书籍识别标签', 'Frontmatter 中用于识别书籍笔记的标签名', s.bookTag, save, (v) => (s.bookTag = v));
    this.toggleSetting(el, '显示文件大小', '', s.showFileSize, save, (v) => (s.showFileSize = v));
    this.toggleSetting(el, '显示阅读时长', '', s.showReadingTime, save, (v) => (s.showReadingTime = v));
    this.toggleSetting(el, '显示划线数', '', s.showHighlights, save, (v) => (s.showHighlights = v));
    this.toggleSetting(el, '显示想法数', '', s.showThinks, save, (v) => (s.showThinks = v));
    this.toggleSetting(el, '显示书评摘要', '', s.showReview, save, (v) => (s.showReview = v));
  }

  // ===== 影视 =====（海报抓取为外部脚本 + 独立守护进程，设置页仅提示；每页加载数量可配）
  private buildMovieTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.textSetting(el, '影视文件夹', '存放影视笔记的文件夹路径', s.movieFolderPath, save, (v) => (s.movieFolderPath = v));
    this.textSetting(el, '每页加载数量', '列表初始加载及每次滚动加载的条数', s.moviePageSize, save, (v) => (s.moviePageSize = v));
    // 海报抓取：独立脚本 + PM2 守护（不内置于插件），仅文字提示
    new Setting(el).setName('海报抓取（外部脚本）').setDesc(this.posterGuideText());
  }

  /** 海报抓取使用指引：安装 npm 包并以 PM2 守护运行（桌面端）；移动端标注仅桌面端可运行 */
  private posterGuideText(): string {
    const steps = [
      '影视海报与豆瓣信息抓取由独立脚本 @jwbz/obsidian-douban-poster 提供，不内置于本插件。',
      '桌面端安装并运行：',
      '1. npm install -g @jwbz/obsidian-douban-poster',
      '2. douban-poster start（PM2 守护，监听影视文件夹的新建/改动，遍历缺海报的笔记自动抓取，每 15 秒处理一个避免接口限流）',
      '3. douban-poster status / logs 查看状态与日志；douban-poster stop 停止',
    ];
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    return steps.join('\n') + (isMobile ? '\n\n该脚本仅桌面端可运行（依赖 Node.js 环境）。' : '');
  }

  // ===== 复习计划 + 做题家 =====（做题家选项在「做题决定难度」开启时动态显示）
  private buildReviewTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.textSetting(el, '数据存储路径', '存放 review.json 与 quiz.json 的目录（做题家共用）', s.reviewStoragePath, save, (v) => (s.reviewStoragePath = v));
    this.textSetting(el, '检查间隔（秒）', '逾期检查间隔，单位秒', s.autoCheckInterval, save, (v) => (s.autoCheckInterval = v));
    this.toggleSetting(el, '启用逾期通知', '是否在逾期时弹出通知', s.enableAutoNotify, save, (v) => (s.enableAutoNotify = v));
    // 做题决定难度开关 + 做题家选项动态组（仿 AI tab 动态显示模式）
    const quizRows: Setting[] = [];
    const refreshQuizRows = () => {
      const show = s.forceQuizForReview;
      quizRows.forEach((r) => r.settingEl.toggleClass('bz-setting-hidden', !show));
    };
    new Setting(el)
      .setName('做题决定难度')
      .setDesc('开启后，点击复习自动做题，根据正确率自动选择难度；同时显示下方做题家选项')
      .addToggle((toggle) =>
        toggle.setValue(s.forceQuizForReview).onChange(async (v) => {
          s.forceQuizForReview = v;
          refreshQuizRows();
          await save();
        })
      );
    quizRows.push(
      this.toggleSetting(el, '允许多选题', '若关闭，AI 只生成单选题', s.enableMultipleChoice, save, (v) => (s.enableMultipleChoice = v)),
      this.textSetting(el, '每笔记题目数量（0为自动）', '设为0则由AI决定，设为正整数则固定数量', s.questionsPerNote, save, (v) => (s.questionsPerNote = v)),
      this.toggleSetting(el, '打乱题目顺序', '每次打开做题窗口时是否随机打乱题目', s.shuffleQuestions, save, (v) => (s.shuffleQuestions = v)),
    );
    const difficultyRow = new Setting(el)
      .setName('题目难度')
      .setDesc('生成题目时的难度等级')
      .addDropdown((dd) => {
        dd.addOption('random', '随机');
        dd.addOption('easy', '简单');
        dd.addOption('medium', '中等');
        dd.addOption('hard', '困难');
        dd.setValue(s.difficulty || 'random');
        dd.onChange(async (v) => {
          s.difficulty = v;
          await save();
        });
      });
    quizRows.push(difficultyRow);
    refreshQuizRows();
  }

  // ===== 闪念 =====
  private buildFlashTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.toggleSetting(el, '启用', '常驻监听光标移动与笔记变更（向量检索/AI 对话）', s.flashEnabled, save, async (v) => {
      s.flashEnabled = v;
      if (v) ensureFlashOnReady(this.plugin.app);
    });
    this.textSetting(el, 'Ollama URL', '本地 Ollama 服务地址', s.OLLAMA_URL, save, (v) => (s.OLLAMA_URL = v));
    this.textSetting(el, 'Embedding 模型', '向量化模型', s.EMBEDDING_MODEL, save, (v) => (s.EMBEDDING_MODEL = v));
    this.textSetting(el, '元数据路径', '向量元数据 JSON 路径', s.META_PATH, save, (v) => (s.META_PATH = v));
    this.textSetting(el, '向量文件路径', '二进制向量文件路径', s.VEC_PATH, save, (v) => (s.VEC_PATH = v));
    this.textSetting(el, '参考结果数', '参考面板显示的匹配结果数', s.TOP_K, save, (v) => (s.TOP_K = v));
    this.textSetting(el, 'AI 检索结果数', 'AI 对话时检索的笔记数量', s.CHAT_TOP_K, save, (v) => (s.CHAT_TOP_K = v));
    this.textSetting(el, '段落最小长度', '短于此长度的段落将被跳过', s.CHUNK_MIN_LENGTH, save, (v) => (s.CHUNK_MIN_LENGTH = v));
    this.textSetting(el, '允许的文件夹', '只处理这些文件夹下的笔记 (逗号分隔)', s.ALLOW_PATHS, save, (v) => (s.ALLOW_PATHS = v));
    this.textSetting(el, '并发数', 'Embedding 请求并发数', s.CONCURRENCY, save, (v) => (s.CONCURRENCY = v));
    this.textSetting(el, '上下文限制', 'AI 上下文限制', s.CONTEXT_LIMIT, save, (v) => (s.CONTEXT_LIMIT = v));
    this.textSetting(el, '防抖延迟', '光标变化后延迟多久触发搜索 (ms)', s.DEBOUNCE_DELAY, save, (v) => (s.DEBOUNCE_DELAY = v));
    this.textSetting(el, '光标轮询间隔', '移动端光标轮询间隔 (ms)', s.CURSOR_POLL_INTERVAL, save, (v) => (s.CURSOR_POLL_INTERVAL = v));
    this.textSetting(el, 'Ollama 对话模型', '用于 AI 对话的模型', s.OLLAMA_CHAT_MODEL, save, (v) => (s.OLLAMA_CHAT_MODEL = v));
    this.textSetting(el, 'DeepSeek 模型', 'DeepSeek API 模型名称', s.DEEPSEEK_MODEL, save, (v) => (s.DEEPSEEK_MODEL = v));
    this.textSetting(el, '默认使用 DeepSeek', 'AI 对话时默认勾选 DeepSeek (true/false)', s.DEFAULT_USE_DEEPSEEK, save, (v) => (s.DEFAULT_USE_DEEPSEEK = v));
    this.textSetting(el, '最大历史记录', 'AI 聊天保留的对话轮数', s.MAX_HISTORY, save, (v) => (s.MAX_HISTORY = v));
    this.textSetting(el, '远程 Ollama URL', '手机端使用的远程 Ollama 地址', s.OLLAMA_REMOTE_URL, save, (v) => (s.OLLAMA_REMOTE_URL = v));
  }


  // ===== AI Agent =====（笔记同步，懒加载开关 + 同步选项）
  private buildAIAgentTab(el: HTMLElement, s: BzSettings, save: () => Promise<void>) {
    this.toggleSetting(el, '启用', '笔记 rename/delete/create 自动同步备忘录/收藏本', s.aiAgentEnabled, save, async (v) => {
      s.aiAgentEnabled = v;
      if (v) ensureAIAgent(this.plugin.app);
    });
    this.textSetting(el, '监听文件夹', '笔记同步监听的文件夹（逗号分隔）', s.aiAgentWatchedFolders, save, (v) => (s.aiAgentWatchedFolders = v));
    this.toggleSetting(el, 'AI 剪藏匹配', '剪藏未精确命中时用 AI 判断并弹窗批准', s.enableAIClipMatch, save, (v) => (s.enableAIClipMatch = v));
    this.textSetting(el, 'AI 匹配模型', 'AI 剪藏匹配使用的模型', s.aiAgentModel, save, (v) => (s.aiAgentModel = v));
  }


  // ---- 设置项 helper ----
  private textSetting(containerEl: HTMLElement, name: string, desc: string, value: string, onSave: () => Promise<void>, apply: (v: string) => void, placeholder?: string): Setting {
    return new Setting(containerEl).setName(name).setDesc(desc).addText((text) =>
      text.setValue(value).setPlaceholder(placeholder || '').onChange(async (v) => {
        apply(v);
        await onSave();
      })
    );
  }

  private toggleSetting(containerEl: HTMLElement, name: string, desc: string, value: boolean, onSave: () => Promise<void>, apply: (v: boolean) => void): Setting {
    return new Setting(containerEl).setName(name).setDesc(desc).addToggle((toggle) =>
      toggle.setValue(value).onChange(async (v) => {
        apply(v);
        await onSave();
      })
    );
  }
}
