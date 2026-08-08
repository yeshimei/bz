/**
 * 插件设置（对应原 QuickAdd 各脚本 settings.options 全量迁移，spec「设置项总表」）
 *
 * 迁移原则（ADR-0005 / spec「设置页」）：保留原脚本全部可配置项；
 * 默认值均提取自各脚本源码 settings.options.defaultValue。
 */

export default interface BzSettings {
  // ===== 🤖 AI 全局（Q3 语义，spec「AI 全局」）=====
  /** AI 服务商：deepseek / opencode-go */
  aiProvider: string;
  /** 🔑 DeepSeek API Key（留空则回退读取 QuickAdd data.json） */
  deepseekApiKey: string;
  /** 🔑 OpenCode Go API Key */
  opencodeGoApiKey: string;

  // ===== 📂 数据存储路径（ADR-0009 共享数据路径）=====
  /** 共享 JSON 数据目录（memo/belongings/passwords/favorites/review/quiz/闪念 meta+vec 统一存放） */
  storagePath: string;

  // ===== 📝 备忘录（2 项；showFileName 固定显示，不暴露设置）=====
  /** 📂 备忘录数据文件路径（memo.json 所在目录）——ADR-0009 废弃，统一走 storagePath，仅兼容保留 */
  todoFilePath: string;
  /** 📄 显示文件名（固定 true，不暴露设置） */
  showFileName: boolean;
  /** 🚀 启动时自动弹窗（有重要备忘录时） */
  autoPopupOnStart: boolean;

  // ===== 📖 日记本（5 项，diary-notebook 合并）=====
  /** 📂 日记目录 */
  diaryDirectory: string;
  /** 🎬 影视目录（日记本用） */
  movieDirectory: string;
  /** ✉️ 信目录 */
  letterDirectory: string;
  /** 📊 显示标签计数 */
  showTagCount: boolean;
  /** 🕒 使用文件日期作为默认日期 */
  useFileDateTime: boolean;
  /** 📄 每批加载数量（滚动加载每批显示的条目数） */
  diaryBatchSize: string;

  // ===== 📦 归物本（1 项，ADR-0009 废弃）=====
  /** 📁 存储文件夹路径（belongings.json）——ADR-0009 废弃，统一走 storagePath，仅兼容保留 */
  belongingsDataFolder: string;

  // ===== 📰 剪藏本（2 项 + 自动摘要开关）=====
  /** 📂 剪藏目录 */
  articleDirectory: string;
  /** 📄 每批加载数量（滚动加载每批显示的条目数） */
  articleBatchSize: string;
  /** 📄 自动摘要：监听剪藏目录新文件（路径与剪藏目录一致） */
  autoSummaryEnabled: boolean;

  // ===== 🔐 密码本（4 项）=====
  /** 📂 数据存储路径——ADR-0009 废弃，统一走 storagePath，仅兼容保留 */
  pwStoragePath: string;
  /** 🔤 密码生成字符集 */
  passwordCharset: string;
  /** 🔢 密码生成长度 */
  passwordLength: string;
  /** 🔒 安全模式（关闭列表窗口立即自动上锁） */
  securityMode: boolean;

  // ===== ⭐ 收藏本（1 项，ADR-0009 废弃）=====
  /** 📂 数据存储目录（文件名固定 favorites.json，只允许改目录）——ADR-0009 废弃，统一走 storagePath，仅兼容保留 */
  favoritesStoragePath: string;

  // ===== 📚 书库（9 项）=====
  /** 📁 书库文件夹 */
  libraryFolderPath: string;
  /** 📁 读书笔记路径 */
  libraryNotePath: string;
  /** 🏷️ 书籍识别标签 */
  bookTag: string;
  /** 📦 显示文件大小 */
  showFileSize: boolean;
  /** ⏱️ 显示阅读时长 */
  showReadingTime: boolean;
  /** 💡 显示划线数 */
  showHighlights: boolean;
  /** 🧠 显示想法数 */
  showThinks: boolean;
  /** 📝 显示书评摘要 */
  showReview: boolean;
  /** 🏷️ 显示分类（源码无 UI 项，运行时默认 true，字段保留） */
  showCategory: boolean;

  // ===== 🎬 影视（1 项）=====
  /** 📁 影视文件夹 */
  movieFolderPath: string;
  /** 📄 每页加载数量（列表初始加载及每次滚动加载的条数） */
  moviePageSize: string;


  // ===== 🧠 做题家（4 项，含 shuffleQuestions；设置并入复习计划 tab）=====
  /** 允许多选题 */
  enableMultipleChoice: boolean;
  /** 每笔记题目数量（0 为自动） */
  questionsPerNote: string;
  /** 打乱题目顺序 */
  shuffleQuestions: boolean;
  /** 题目难度：random/easy/medium/hard */
  difficulty: string;

  // ===== 🔁 复习计划 + 做题家（合并 tab；quiz/review 共用数据路径）=====
  /** 数据存储路径（review.json / quiz.json 所在目录）——ADR-0009 废弃，统一走 storagePath，仅兼容保留 */
  reviewStoragePath: string;
  /** ⏱️ 检查间隔（秒） */
  autoCheckInterval: string;
  /** 🔔 启用逾期通知 */
  enableAutoNotify: boolean;
  /** 🎯 做题决定难度（开启时显示做题家选项） */
  forceQuizForReview: boolean;

  // ===== 🧩 入口页（3 项）=====
  /** 桌面端网格列数（3-8，默认 6） */
  launcherColumns: string;
  /** 移动端网格列数（3-8，默认 4——移动端格子更大更透气） */
  launcherMobileColumns: string;
  /** 显示磁贴文字（桌面端；关闭 = 全部磁贴仅显示图标） */
  launcherShowText: boolean;
  /** 移动端独立：显示磁贴文字（未设置 → 继承桌面端） */
  launcherShowTextMobile?: boolean;

  // ===== 🖐 手势触发（入口页域：选一个手势打开命令入口页，默认关闭）=====
  /** 打开入口页的手势（桌面端）：off | double | triple | swipe */
  launcherGesture: string;
  /** 移动端独立：打开入口页手势（未设置 → 继承桌面端） */
  launcherGestureMobile?: string;

  // ===== 💭 闪念（17 项，全量迁移）=====
  /** Ollama URL（本地） */
  OLLAMA_URL: string;
  /** Embedding 模型 */
  EMBEDDING_MODEL: string;
  /** 元数据路径（meta.json）——ADR-0009 废弃，统一走 storagePath，仅兼容保留 */
  META_PATH: string;
  /** 向量文件路径（vectors.vec）——ADR-0009 废弃，统一走 storagePath，仅兼容保留 */
  VEC_PATH: string;
  /** 参考结果数 */
  TOP_K: string;
  /** AI 检索结果数 */
  CHAT_TOP_K: string;
  /** 段落最小长度 */
  CHUNK_MIN_LENGTH: string;
  /** 允许的文件夹（逗号分隔） */
  ALLOW_PATHS: string;
  /** Embedding 请求并发数 */
  CONCURRENCY: string;
  /** 上下文限制 */
  CONTEXT_LIMIT: string;
  /** 防抖延迟（ms） */
  DEBOUNCE_DELAY: string;
  /** 光标轮询间隔（ms） */
  CURSOR_POLL_INTERVAL: string;
  /** Ollama 对话模型 */
  OLLAMA_CHAT_MODEL: string;
  /** DeepSeek 模型 */
  DEEPSEEK_MODEL: string;
  /** 默认使用 DeepSeek（true/false） */
  DEFAULT_USE_DEEPSEEK: string;
  /** 最大历史记录 */
  MAX_HISTORY: string;
  /** 远程 Ollama URL */
  OLLAMA_REMOTE_URL: string;

  // ===== 常驻监听开关（懒加载架构，ADR-0003）=====
  // AI Agent 4 项（ADR-0009）：设置不暴露 UI，运行时读字段（默认值兜底，尊重旧 data.json 值）
  /** AI Agent：笔记 rename/delete/create 同步 */
  aiAgentEnabled: boolean;
  /** 🤖 AI 剪藏匹配：开启后剪藏未命中时用 AI 判断并弹窗批准 */
  enableAIClipMatch: boolean;
  /** 📂 AI Agent 监听文件夹（逗号分隔） */
  aiAgentWatchedFolders: string;
  /** 🧠 AI Agent 剪藏匹配模型 */
  aiAgentModel: string;
  /** 闪念：常驻监听光标/文件 */
  flashEnabled: boolean;
}

export const DEFAULT_SETTINGS: BzSettings = {
  // AI 全局
  aiProvider: 'opencode-go',
  deepseekApiKey: '',
  opencodeGoApiKey: '',

  // 共享数据路径（ADR-0009）
  storagePath: 'CONFIG/STORAGE',

  // 备忘录
  todoFilePath: 'CONFIG/STORAGE',
  showFileName: true,
  autoPopupOnStart: true,

  // 日记本
  diaryDirectory: '我的/日记',
  movieDirectory: '我的/影视',
  letterDirectory: '我的/信',
  showTagCount: true,
  useFileDateTime: false,
  diaryBatchSize: '20',

  // 归物本
  belongingsDataFolder: 'CONFIG/STORAGE',

  // 剪藏本
  articleDirectory: '归档/网页剪藏',
  articleBatchSize: '20',
  autoSummaryEnabled: true,

  // 密码本
  pwStoragePath: 'CONFIG/STORAGE',
  passwordCharset:
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
  passwordLength: '16',
  securityMode: false,

  // 收藏本（只允许改目录，文件名固定 favorites.json）
  favoritesStoragePath: 'CONFIG/STORAGE',

  // 书库
  libraryFolderPath: '书库',
  libraryNotePath: '我的/读书笔记',
  bookTag: 'book',
  showFileSize: true,
  showReadingTime: true,
  showHighlights: true,
  showThinks: true,
  showReview: true,
  showCategory: true,

  // 影视
  movieFolderPath: '我的/影视',
  moviePageSize: '20',


  // 做题家（设置并入复习计划 tab）
  enableMultipleChoice: true,
  questionsPerNote: '0',
  shuffleQuestions: true,
  difficulty: 'random',

  // 复习计划（quiz/review 共用数据路径）
  reviewStoragePath: 'CONFIG/STORAGE',
  autoCheckInterval: '60',
  enableAutoNotify: true,
  forceQuizForReview: false,

  // 入口页
  launcherColumns: '6',
  launcherMobileColumns: '4',
  launcherShowText: true,

  // 手势触发（默认关闭；单选一个手势打开命令入口页）
  launcherGesture: 'off',

  // 闪念
  OLLAMA_URL: 'http://localhost:11434',
  EMBEDDING_MODEL: 'bge-m3',
  META_PATH: 'CONFIG/STORAGE/ai_completion_meta.json',
  VEC_PATH: 'CONFIG/STORAGE/ai_completion_vectors.vec',
  TOP_K: '20',
  CHAT_TOP_K: '20',
  CHUNK_MIN_LENGTH: '50',
  ALLOW_PATHS: '卡片盒,主题盒,我的,归档,CODE',
  CONCURRENCY: '15',
  CONTEXT_LIMIT: '600',
  DEBOUNCE_DELAY: '300',
  CURSOR_POLL_INTERVAL: '500',
  OLLAMA_CHAT_MODEL: 'qwen2.5:14b-instruct',
  DEEPSEEK_MODEL: 'deepseek-v4-flash',
  DEFAULT_USE_DEEPSEEK: 'false',
  MAX_HISTORY: '10',
  OLLAMA_REMOTE_URL: 'http://192.168.1.8:11434',

  // 常驻监听
  aiAgentEnabled: true,
  enableAIClipMatch: true,
  aiAgentWatchedFolders: '卡片盒,归档/网页剪藏',
  aiAgentModel: 'deepseek-v4-flash',
  flashEnabled: true,
};
