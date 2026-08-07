/**
 * memo-suite 插件入口：装配、命令注册（ADR-0004 裸注册）、设置页、懒加载（ADR-0003）。
 *
 * 命令 id 全部沿用原 QuickAdd 脚本（不带插件前缀），不设置默认快捷键，
 * 卸载时 removeCommand 清理——取代原脚本的 window.__*CommandRegistered 防重标志。
 */
import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { escManager } from './core/esc-manager';
import { setApp, getApp } from './core/app';
import { setAISettingsProvider, resetAIProviderCache } from './core/ai';
import { setMemoSettingsProvider, unloadMemo } from './memo';

import MemoSettings, { DEFAULT_SETTINGS } from './settings';

// 15 域（懒加载：首次命令/事件触发时 ensureXxx 幂等初始化）
import { openMemoPanel, createMemoItem } from './memo';
import { addBelongingsItem } from './belongings';
import { openArticleView } from './clipping';
import { openNewsReader } from './news';
import { openPasswordManager, addPasswordEntry, generatePassword } from './password';
import { openFavoritesPanel, addFavoriteItem } from './favorites';
import { openLibrary, openBookNotes } from './library';
import { showReadingReport } from './reading-report';
import { openMovieManager, addMovieItem } from './movie';
import { openMovieAnalysis } from './movie-analysis';
import { openReviewPanel, reviewAddCurrent, reviewRemoveCurrent, reviewJumpOverdue, reviewMarkDialog } from './review';
import { quizUpdate, quizOpen } from './quiz';
import { openFlashReference, openFlashChat } from './flash';
import { ensureAutoSummary } from './auto-summary';
import { ensureAIAgent } from './ai-agent';

/** 命令表：id/name 均提取自原脚本 addCommand 调用点（spec「命令 id 全清单」） */
const COMMANDS: { id: string; name: string; callback: () => void }[] = [
  // 备忘录
  { id: 'memo-open-panel', name: '打开备忘录面板', callback: () => openMemoPanel(getApp()) },
  { id: 'memo-create-item', name: '创建备忘录条目', callback: () => createMemoItem(getApp()) },
  // 归物本
  { id: 'belongings-add-item', name: '归物本：添加物品', callback: () => addBelongingsItem(getApp()) },
  // 剪藏本
  { id: 'article-open-view', name: '打开文章列表', callback: () => openArticleView(getApp()) },
  // 聚合讯
  { id: 'news-reader-open', name: '打开资讯阅读器', callback: () => openNewsReader(getApp()) },
  // 密码本
  { id: 'pw-open-manager', name: '打开密码本', callback: () => openPasswordManager(getApp()) },
  { id: 'pw-add-entry', name: '添加密码条目', callback: () => addPasswordEntry(getApp()) },
  { id: 'pw-generate-password', name: '生成随机密码', callback: () => generatePassword(getApp()) },
  // 收藏本
  { id: 'favorites-open-panel', name: '打开收藏面板', callback: () => openFavoritesPanel(getApp()) },
  { id: 'favorites-add-item', name: '添加收藏', callback: () => addFavoriteItem(getApp()) },
  // 书库
  { id: 'open-library', name: '打开书库', callback: () => openLibrary(getApp()) },
  { id: 'open-book-notes', name: '打开读书笔记', callback: () => openBookNotes(getApp()) },
  // 阅读数据分析报告
  { id: 'show-reading-report', name: '打开阅读数据分析报告', callback: () => showReadingReport(getApp()) },
  // 影视
  { id: 'movie-manager-open', name: '影视：打开', callback: () => openMovieManager(getApp()) },
  { id: 'movie-manager-add', name: '影视：添加', callback: () => addMovieItem(getApp()) },
  // 影视数据分析
  { id: 'movie-analysis-open', name: '影视：观影数据分析', callback: () => openMovieAnalysis(getApp()) },
  // 复习计划（5 命令）
  { id: 'review-open-panel', name: '打开复习面板', callback: () => openReviewPanel(getApp()) },
  { id: 'review-add-current', name: '加入复习计划', callback: () => reviewAddCurrent(getApp()) },
  { id: 'review-remove-current', name: '移出复习计划', callback: () => reviewRemoveCurrent(getApp()) },
  { id: 'review-jump-overdue', name: '复习（跳转逾期）', callback: () => reviewJumpOverdue(getApp()) },
  { id: 'review-mark-dialog', name: '复习（选择难度）', callback: () => reviewMarkDialog(getApp()) },
  // 做题家
  { id: 'quiz-master-update', name: '更新题库', callback: () => quizUpdate(getApp()) },
  { id: 'quiz-master-open', name: '打开做题家', callback: () => quizOpen(getApp()) },
  // 闪念
  { id: 'shan-nian-open-reference', name: '闪念：打开参考窗口', callback: () => openFlashReference(getApp()) },
  { id: 'shan-nian-open-chat', name: '闪念：打开 AI 对话', callback: () => openFlashChat(getApp()) },
];

export default class MemoSuitePlugin extends Plugin {
  settings: MemoSettings = { ...DEFAULT_SETTINGS };
  private registeredCommandIds: string[] = [];

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    setApp(this.app);
    // AI 设置注入（Q3 的 _q3Settings 语义 → 插件设置）
    setAISettingsProvider(() => this.settings);
    resetAIProviderCache();
    // 备忘录设置注入
    setMemoSettingsProvider(() => this.settings);

    // 命令裸注册（不设置默认 hotkeys，保留用户既有绑定）
    for (const c of COMMANDS) {
      this.addCommand({ id: c.id, name: c.name, callback: c.callback });
      this.registeredCommandIds.push(c.id);
    }

    // ribbon 主入口：备忘录面板
    this.addRibbonIcon('check-square', '备忘录', () => openMemoPanel(this.app));

    // 设置页
    this.addSettingTab(new MemoSuiteSettingTab(this.app, this));

    // 事件常驻域按设置开关注册（懒加载架构）
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.autoSummaryEnabled) ensureAutoSummary(this.app);
      if (this.settings.aiAgentEnabled) ensureAIAgent(this.app);
      if (this.settings.flashEnabled) ensureFlashOnReady(this.app);
    });
  }

  async onunload() {
    // 清理裸注册命令（id 不带插件前缀，必须显式 removeCommand）
    for (const id of this.registeredCommandIds) {
      try {
        (this.app as any).commands.removeCommand(id);
      } catch (e) {
        /* 命令可能已被移除 */
      }
    }
    escManager.destroy();
    unloadMemo();
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

export class MemoSuiteSettingTab extends PluginSettingTab {
  plugin: MemoSuitePlugin;

  constructor(app: any, plugin: MemoSuitePlugin) {
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

    containerEl.createEl('h2', { text: '🤖 AI 配置（Q3 语义）' });
    this.textSetting(containerEl, 'AI 服务商', 'deepseek / opencode-go', s.aiProvider, save, (v) => (s.aiProvider = v), 'deepseek');
    this.textSetting(containerEl, '🔑 DeepSeek API Key', '留空则回退读取 QuickAdd data.json 里的 key', s.deepseekApiKey, save, (v) => (s.deepseekApiKey = v));
    this.textSetting(containerEl, '🌐 OpenCode Go 接口地址', 'OpenAI 兼容 chat/completions 端点', s.opencodeGoEndpoint, save, (v) => (s.opencodeGoEndpoint = v));
    this.textSetting(containerEl, '🔑 OpenCode Go API Key', '从 opencode.ai/zen 订阅后获取', s.opencodeGoApiKey, save, (v) => (s.opencodeGoApiKey = v));
    this.textSetting(containerEl, '🧩 OpenCode Go 模型', '如 deepseek-v4-flash / deepseek-v4-pro / kimi-k2.6 / qwen3.7-max / glm-5.2', s.opencodeGoModel, save, (v) => (s.opencodeGoModel = v));
    const ov = s.aiOverride || {};
    this.textSetting(containerEl, '🔧 Override endpoint（可选）', '脚本内指定第三方端点时的覆盖', ov.endpoint || '', save, (v) => (s.aiOverride = { ...(s.aiOverride || {}), endpoint: v || undefined }));
    this.textSetting(containerEl, '🔧 Override apiKey（可选）', '', ov.apiKey || '', save, (v) => (s.aiOverride = { ...(s.aiOverride || {}), apiKey: v || undefined }));
    this.textSetting(containerEl, '🔧 Override model（可选）', '', ov.model || '', save, (v) => (s.aiOverride = { ...(s.aiOverride || {}), model: v || undefined }));

    containerEl.createEl('h2', { text: '📝 备忘录' });
    this.textSetting(containerEl, '📂 备忘录数据文件路径', '存放 memo.json 的目录', s.todoFilePath, save, (v) => (s.todoFilePath = v));
    this.textareaSetting(containerEl, '🏷️ 场景列表（每行一个）', '用于待办分类；留空使用默认场景', s.scenarios, save, (v) => (s.scenarios = v));
    this.textareaSetting(containerEl, '🌐 自定义平台映射（每行一个）', '格式：域名 平台名', s.platformMapping, save, (v) => (s.platformMapping = v));
    this.toggleSetting(containerEl, '📄 显示文件名', '在备忘录位置标签中显示笔记文件名', s.showFileName, save, (v) => (s.showFileName = v));
    this.toggleSetting(containerEl, '🚀 启动时自动弹窗', '启动时自动弹出备忘录面板（有重要备忘录时）', s.autoPopupOnStart, save, (v) => (s.autoPopupOnStart = v));

    containerEl.createEl('h2', { text: '📦 归物本' });
    this.textSetting(containerEl, '📁 存储文件夹路径', '存放 belongings.json 的文件夹', s.belongingsDataFolder, save, (v) => (s.belongingsDataFolder = v));
    this.textareaSetting(containerEl, '📂 自定义分类（每行一个）', '格式：图标+空格+分类名（如 📱 智能手机）', s.customCategories, save, (v) => (s.customCategories = v));

    containerEl.createEl('h2', { text: '📰 剪藏本' });
    this.textSetting(containerEl, '📂 剪藏目录', '存放网页剪藏 markdown 文件的文件夹', s.articleDirectory, save, (v) => (s.articleDirectory = v));
    this.textSetting(containerEl, '📄 每批加载数量', '滚动加载时每批显示的条目数', s.batchSize, save, (v) => (s.batchSize = v));
    this.textSetting(containerEl, '⏱️ 长按识别时长(毫秒)', '触发长按删除的毫秒数', s.longPressDuration, save, (v) => (s.longPressDuration = v));

    containerEl.createEl('h2', { text: '🔐 密码本' });
    this.textSetting(containerEl, '📂 数据存储路径', '存放加密密码数据文件的目录', s.pwStoragePath, save, (v) => (s.pwStoragePath = v));
    this.textSetting(containerEl, '🔤 密码生成字符集', '随机生成密码时使用的字符集', s.passwordCharset, save, (v) => (s.passwordCharset = v));
    this.textSetting(containerEl, '🔢 密码生成长度', '随机生成密码的长度（数字）', s.passwordLength, save, (v) => (s.passwordLength = v));
    this.toggleSetting(containerEl, '🔒 安全模式', '开启后，关闭列表窗口立即自动上锁', s.securityMode, save, (v) => (s.securityMode = v));

    containerEl.createEl('h2', { text: '⭐ 收藏本' });
    this.textSetting(containerEl, '📂 数据存储路径', '存放 favorites.json 的路径', s.favoritesStoragePath, save, (v) => (s.favoritesStoragePath = v));

    containerEl.createEl('h2', { text: '📚 书库' });
    this.textSetting(containerEl, '📁 书库文件夹', '存放书籍笔记的根目录', s.libraryFolderPath, save, (v) => (s.libraryFolderPath = v));
    this.textSetting(containerEl, '📁 读书笔记路径', '长按书籍时打开的读书笔记所在目录', s.libraryNotePath, save, (v) => (s.libraryNotePath = v));
    this.textSetting(containerEl, '🏷️ 书籍识别标签', 'Frontmatter 中用于识别书籍笔记的标签名', s.bookTag, save, (v) => (s.bookTag = v));
    this.toggleSetting(containerEl, '📦 显示文件大小', '', s.showFileSize, save, (v) => (s.showFileSize = v));
    this.toggleSetting(containerEl, '⏱️ 显示阅读时长', '', s.showReadingTime, save, (v) => (s.showReadingTime = v));
    this.toggleSetting(containerEl, '💡 显示划线数', '', s.showHighlights, save, (v) => (s.showHighlights = v));
    this.toggleSetting(containerEl, '🧠 显示想法数', '', s.showThinks, save, (v) => (s.showThinks = v));
    this.toggleSetting(containerEl, '📝 显示书评摘要', '', s.showReview, save, (v) => (s.showReview = v));

    containerEl.createEl('h2', { text: '🎬 影视' });
    this.textSetting(containerEl, '📁 影视文件夹', '存放影视笔记的文件夹路径', s.movieFolderPath, save, (v) => (s.movieFolderPath = v));
    this.textSetting(containerEl, '📄 每页加载数量', '列表初始加载及每次滚动加载的条数', String(s.moviePageSize), save, (v) => (s.moviePageSize = parseInt(v) || 50));
    this.toggleSetting(containerEl, '🖼️ 启用海报整理（Q3）', '自动将笔记中的海报图片移至指定文件夹并更新 frontmatter', s.enableQ3, save, (v) => (s.enableQ3 = v));
    this.textSetting(containerEl, '📁 海报存储文件夹', 'Q3 整理海报的目标文件夹路径', s.posterFolder, save, (v) => (s.posterFolder = v));

    containerEl.createEl('h2', { text: '📊 影视数据分析' });
    this.textSetting(containerEl, '📁 影视文件夹（分析）', '存放影视笔记的文件夹路径', s.analysisFolderPath, save, (v) => (s.analysisFolderPath = v));

    containerEl.createEl('h2', { text: '🧠 做题家' });
    this.toggleSetting(containerEl, '允许多选题', '若关闭，AI 只生成单选题', s.enableMultipleChoice, save, (v) => (s.enableMultipleChoice = v));
    this.textSetting(containerEl, '每笔记题目数量（0为自动）', '设为0则由AI决定，设为正整数则固定数量', s.questionsPerNote, save, (v) => (s.questionsPerNote = v));
    this.toggleSetting(containerEl, '打乱题目顺序', '每次打开做题窗口时是否随机打乱题目', s.shuffleQuestions, save, (v) => (s.shuffleQuestions = v));
    this.textSetting(containerEl, '题目难度', 'random/easy/medium/hard', s.difficulty, save, (v) => (s.difficulty = v));

    containerEl.createEl('h2', { text: '🔁 复习计划' });
    this.textSetting(containerEl, '⏱️ 检查间隔（秒）', '逾期检查间隔，单位秒', s.autoCheckInterval, save, (v) => (s.autoCheckInterval = v));
    this.toggleSetting(containerEl, '🔔 启用逾期通知', '是否在逾期时弹出通知', s.enableAutoNotify, save, (v) => (s.enableAutoNotify = v));
    this.toggleSetting(containerEl, '🎯 做题决定难度', '开启后，点击复习自动做题，根据正确率自动选择难度', s.forceQuizForReview, save, (v) => (s.forceQuizForReview = v));

    containerEl.createEl('h2', { text: '💭 闪念' });
    this.textSetting(containerEl, 'Ollama URL', '本地 Ollama 服务地址', s.OLLAMA_URL, save, (v) => (s.OLLAMA_URL = v));
    this.textSetting(containerEl, 'Embedding 模型', '向量化模型', s.EMBEDDING_MODEL, save, (v) => (s.EMBEDDING_MODEL = v));
    this.textSetting(containerEl, '元数据路径', '向量元数据 JSON 路径', s.META_PATH, save, (v) => (s.META_PATH = v));
    this.textSetting(containerEl, '向量文件路径', '二进制向量文件路径', s.VEC_PATH, save, (v) => (s.VEC_PATH = v));
    this.textSetting(containerEl, '参考结果数', '参考面板显示的匹配结果数', s.TOP_K, save, (v) => (s.TOP_K = v));
    this.textSetting(containerEl, 'AI 检索结果数', 'AI 对话时检索的笔记数量', s.CHAT_TOP_K, save, (v) => (s.CHAT_TOP_K = v));
    this.textSetting(containerEl, '段落最小长度', '短于此长度的段落将被跳过', s.CHUNK_MIN_LENGTH, save, (v) => (s.CHUNK_MIN_LENGTH = v));
    this.textSetting(containerEl, '允许的文件夹', '只处理这些文件夹下的笔记 (逗号分隔)', s.ALLOW_PATHS, save, (v) => (s.ALLOW_PATHS = v));
    this.textSetting(containerEl, '并发数', 'Embedding 请求并发数', s.CONCURRENCY, save, (v) => (s.CONCURRENCY = v));
    this.textSetting(containerEl, '上下文限制', 'AI 上下文限制', s.CONTEXT_LIMIT, save, (v) => (s.CONTEXT_LIMIT = v));
    this.textSetting(containerEl, '防抖延迟', '光标变化后延迟多久触发搜索 (ms)', s.DEBOUNCE_DELAY, save, (v) => (s.DEBOUNCE_DELAY = v));
    this.textSetting(containerEl, '光标轮询间隔', '移动端光标轮询间隔 (ms)', s.CURSOR_POLL_INTERVAL, save, (v) => (s.CURSOR_POLL_INTERVAL = v));
    this.textSetting(containerEl, 'Ollama 对话模型', '用于 AI 对话的模型', s.OLLAMA_CHAT_MODEL, save, (v) => (s.OLLAMA_CHAT_MODEL = v));
    this.textSetting(containerEl, 'DeepSeek 模型', 'DeepSeek API 模型名称', s.DEEPSEEK_MODEL, save, (v) => (s.DEEPSEEK_MODEL = v));
    this.textSetting(containerEl, '默认使用 DeepSeek', 'AI 对话时默认勾选 DeepSeek (true/false)', s.DEFAULT_USE_DEEPSEEK, save, (v) => (s.DEFAULT_USE_DEEPSEEK = v));
    this.textSetting(containerEl, '最大历史记录', 'AI 聊天保留的对话轮数', s.MAX_HISTORY, save, (v) => (s.MAX_HISTORY = v));
    this.textSetting(containerEl, '远程 Ollama URL', '手机端使用的远程 Ollama 地址', s.OLLAMA_REMOTE_URL, save, (v) => (s.OLLAMA_REMOTE_URL = v));

    containerEl.createEl('h2', { text: '👂 常驻监听（懒加载开关）' });
    this.toggleSetting(containerEl, '自动摘要', '监听 归档/网页剪藏 新文件，AI 生成摘要写回 frontmatter', s.autoSummaryEnabled, save, async (v) => {
      s.autoSummaryEnabled = v;
      if (v) ensureAutoSummary(this.plugin.app);
    });
    this.toggleSetting(containerEl, 'AI Agent', '笔记 rename/delete/create 自动同步备忘录/收藏本', s.aiAgentEnabled, save, async (v) => {
      s.aiAgentEnabled = v;
      if (v) ensureAIAgent(this.plugin.app);
    });
    this.toggleSetting(containerEl, '闪念', '常驻监听光标移动与笔记变更（向量检索/AI 对话）', s.flashEnabled, save, async (v) => {
      s.flashEnabled = v;
      if (v) ensureFlashOnReady(this.plugin.app);
    });
  }

  // ---- 设置项 helper ----
  private textSetting(containerEl: HTMLElement, name: string, desc: string, value: string, onSave: () => Promise<void>, apply: (v: string) => void, placeholder?: string) {
    new Setting(containerEl).setName(name).setDesc(desc).addText((text) =>
      text.setValue(value).setPlaceholder(placeholder || '').onChange(async (v) => {
        apply(v);
        await onSave();
      })
    );
  }

  private textareaSetting(containerEl: HTMLElement, name: string, desc: string, value: string, onSave: () => Promise<void>, apply: (v: string) => void) {
    new Setting(containerEl).setName(name).setDesc(desc).addTextArea((text) =>
      text.setValue(value).onChange(async (v) => {
        apply(v);
        await onSave();
      })
    );
  }

  private toggleSetting(containerEl: HTMLElement, name: string, desc: string, value: boolean, onSave: () => Promise<void>, apply: (v: boolean) => void) {
    new Setting(containerEl).setName(name).setDesc(desc).addToggle((toggle) =>
      toggle.setValue(value).onChange(async (v) => {
        apply(v);
        await onSave();
      })
    );
  }
}
