/**
 * bz 插件入口：装配、命令注册（ADR-0004 裸注册）、设置页、懒加载（ADR-0003）。
 *
 * 命令 id 统一 `bz-` 前缀（ADR-0004 修订：2025 用户决策统一品牌前缀），不设置默认快捷键，
 * 卸载时 removeCommand 清理——取代原脚本的 window.__*CommandRegistered 防重标志。
 */
import { Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { escManager } from './core/esc-manager';
import { setApp, getApp } from './core/app';
import { setAISettingsProvider, resetAIProviderCache } from './core/ai';
import { setSettingsProvider, setSettingsSaver } from './core/settings-provider';
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
import { openMovieManager, addMovieItem, openMovieReport } from './movie';
import { openReviewPanel, reviewAddCurrent, reviewRemoveCurrent, reviewJumpOverdue, reviewMarkDialog, reviewMarkRating, reviewStart } from './review';
import { quizUpdate, quizOpen } from './quiz';
import { openFlashReference, openFlashChat } from './flash';
import { openLauncherPanel, unloadLauncherPanel, setLauncherShowTextSetter, setLauncherGestureSetter } from './launcher';
import { registerGestureListeners } from './launcher/gestures';
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
  // 入口页
  { id: 'bz-launcher-open', name: '打开命令入口页', callback: () => openLauncherPanel(getApp()) },
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
  { id: 'bz-movie-report', name: '影视分析报告', callback: () => openMovieReport(getApp()) },
  // 复习计划（6 命令）
  { id: 'bz-review-open-panel', name: '打开复习面板', callback: () => openReviewPanel(getApp()) },
  { id: 'bz-review-start', name: '开始复习（进入复习流程）', callback: () => reviewStart(getApp()) },
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
  private unregisterGestures: (() => void) | null = null;

  async onload() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    // ADR-0009 迁移：共享数据路径 storagePath 初始化（旧 7 字段废弃仅兼容保留）
    if (!loaded || loaded.storagePath === undefined) this.migrateStoragePath();
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
    }
    setApp(this.app);
    // AI 设置注入（Q3 的 _q3Settings 语义 → 插件设置）
    setAISettingsProvider(() => this.settings);
    resetAIProviderCache();
    // 通用设置访问器（各域经 getSettings 读取）
    setSettingsProvider(() => this.settings);
    // 设置保存通道（域设置弹窗写回后持久化）
    setSettingsSaver(() => this.saveSettings());
    // 入口页：右上角文字开关写回设置（编辑模式右上角切换）
    setLauncherShowTextSetter((v) => {
      this.settings.launcherShowText = v;
      void this.saveSettings();
    });
    setLauncherGestureSetter((v) => {
      this.settings.launcherGesture = v;
      void this.saveSettings();
      this.syncGestures(); // 手势监听随设置变更重注册
    });
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
    // 手势触发（设置页可配，默认关闭）
    this.syncGestures();
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
    unloadLauncherPanel();
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
      ['META_PATH', fileDir(this.settings.META_PATH, 'ai_completion_meta.json')],
      ['VEC_PATH', fileDir(this.settings.VEC_PATH, 'ai_completion_vectors.vec')],
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
      new Notice('bz：检测到旧版独立数据路径设置（' + custom + '），已统一为 CONFIG/STORAGE。请手动迁移对应数据文件。');
    }
  }

  /** 手势监听同步：按设置单选手势注册（设置变更/插件加载时调用，幂等）；动作固定为打开入口页 */
  syncGestures(): void {
    if (this.unregisterGestures) {
      this.unregisterGestures();
      this.unregisterGestures = null;
    }
    const g = this.settings.launcherGesture;
    const on = (kind: string) => (g === kind ? 'bz-launcher-open' : 'off');
    this.unregisterGestures = registerGestureListeners(this.app, {
      gestureDoubleTap: on('double'),
      gestureTripleTap: on('triple'),
      gestureSwipeDown: on('swipe'),
    });
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

// ===== 设置页（ADR-0009：单页平铺，只含「🤖 AI」「📂 数据存储路径」两区块）=====

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

    // 🤖 AI 区块：服务商下拉 + 动态显示对应 API Key
    containerEl.createDiv({ cls: 'bz-setting-section-title', text: '🤖 AI' });
    let deepseekRow: Setting | null = null;
    let opencodeRow: Setting | null = null;
    const refreshKeys = () => {
      const isDeepseek = s.aiProvider === 'deepseek';
      if (deepseekRow) deepseekRow.settingEl.toggleClass('bz-setting-hidden', !isDeepseek);
      if (opencodeRow) opencodeRow.settingEl.toggleClass('bz-setting-hidden', isDeepseek);
    };
    new Setting(containerEl)
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
    deepseekRow = new Setting(containerEl)
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
    opencodeRow = new Setting(containerEl)
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

    // 📂 数据存储路径区块：共享 storagePath（ADR-0009，JSON 数据文件统一目录）
    containerEl.createDiv({ cls: 'bz-setting-section-title', text: '📂 数据存储路径' });
    this.textSetting(
      containerEl,
      '数据存储路径',
      '所有 JSON 数据文件（备忘录/归物本/密码本/收藏本/复习计划/做题家/闪念）的统一存放目录',
      s.storagePath,
      save,
      (v) => (s.storagePath = v)
    );
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
