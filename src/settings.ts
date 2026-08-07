/**
 * 插件设置（对应原 QuickAdd 各脚本 settings.options 全量迁移，spec「设置项总表」）
 *
 * 迁移原则（ADR-0005 / spec「设置页」）：保留原脚本全部可配置项；
 * 默认值均提取自各脚本源码 settings.options.defaultValue。
 */

export default interface MemoSettings {
  // ===== 🤖 AI 全局（Q3 语义，spec「AI 全局」）=====
  /** AI 服务商：deepseek / opencode-go */
  aiProvider: string;
  /** 🔑 DeepSeek API Key（留空则回退读取 QuickAdd data.json） */
  deepseekApiKey: string;
  /** 🌐 OpenCode Go 接口地址 */
  opencodeGoEndpoint: string;
  /** 🔑 OpenCode Go API Key */
  opencodeGoApiKey: string;
  /** 🧩 OpenCode Go 模型 */
  opencodeGoModel: string;
  /** override 对象 {endpoint, apiKey, model}（脚本内部自由指定第三方端点） */
  aiOverride: { endpoint?: string; apiKey?: string; model?: string } | null;

  // ===== 📝 备忘录（5 项）=====
  /** 📂 备忘录数据文件路径（memo.json 所在目录） */
  todoFilePath: string;
  /** 🏷️ 场景列表（每行一个） */
  scenarios: string;
  /** 🌐 自定义平台映射（每行：域名 平台名） */
  platformMapping: string;
  /** 📄 显示文件名 */
  showFileName: boolean;
  /** 🚀 启动时自动弹窗（有重要备忘录时） */
  autoPopupOnStart: boolean;

  // ===== 📦 归物本（2 项）=====
  /** 📁 存储文件夹路径（belongings.json） */
  belongingsDataFolder: string;
  /** 📂 自定义分类（每行一个，格式：图标+空格+分类名） */
  customCategories: string;

  // ===== 📰 剪藏本（3 项）=====
  /** 📂 剪藏目录 */
  articleDirectory: string;
  /** 📄 每批加载数量 */
  batchSize: string;
  /** ⏱️ 长按识别时长(毫秒) */
  longPressDuration: string;

  // ===== 🔐 密码本（4 项）=====
  /** 📂 数据存储路径 */
  pwStoragePath: string;
  /** 🔤 密码生成字符集 */
  passwordCharset: string;
  /** 🔢 密码生成长度 */
  passwordLength: string;
  /** 🔒 安全模式（关闭列表窗口立即自动上锁） */
  securityMode: boolean;

  // ===== ⭐ 收藏本（1 项）=====
  /** 📂 数据存储路径（favorites.json） */
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

  // ===== 🎬 影视（4 项）=====
  /** 📁 影视文件夹 */
  movieFolderPath: string;
  /** 📄 每页加载数量 */
  moviePageSize: number;
  /** 🖼️ 启用海报整理（Q3） */
  enableQ3: boolean;
  /** 📁 海报存储文件夹 */
  posterFolder: string;

  // ===== 📊 影视数据分析（1 路径 + 10 组分析配置）=====
  /** 📁 影视文件夹（分析用） */
  analysisFolderPath: string;
  /** 分析配置：groups（分组） */
  analysisGroups: string;
  /** 分析配置：buckets（评分桶） */
  analysisBuckets: string;
  /** 分析配置：genres（类型） */
  analysisGenres: string;
  /** 分析配置：ageBuckets（年龄段） */
  analysisAgeBuckets: string;
  /** 分析配置：eras（年代） */
  analysisEras: string;
  /** 分析配置：durBuckets（时长桶） */
  analysisDurBuckets: string;
  /** 分析配置：groupDur（分组时长） */
  analysisGroupDur: string;
  /** 分析配置：reviewKeywords（评论关键词） */
  analysisReviewKeywords: string;
  /** 分析配置：series（剧集） */
  analysisSeries: string;
  /** 分析配置：yearRating（年度评分） */
  analysisYearRating: string;

  // ===== 🧠 做题家（4 项，含 shuffleQuestions）=====
  /** 允许多选题 */
  enableMultipleChoice: boolean;
  /** 每笔记题目数量（0 为自动） */
  questionsPerNote: string;
  /** 打乱题目顺序 */
  shuffleQuestions: boolean;
  /** 题目难度：random/easy/medium/hard */
  difficulty: string;

  // ===== 🔁 复习计划（3 项）=====
  /** ⏱️ 检查间隔（秒） */
  autoCheckInterval: string;
  /** 🔔 启用逾期通知 */
  enableAutoNotify: boolean;
  /** 🎯 做题决定难度 */
  forceQuizForReview: boolean;

  // ===== 💭 闪念（17 项，全量迁移）=====
  /** Ollama URL（本地） */
  OLLAMA_URL: string;
  /** Embedding 模型 */
  EMBEDDING_MODEL: string;
  /** 元数据路径（meta.json） */
  META_PATH: string;
  /** 向量文件路径（vectors.vec） */
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
  /** 自动摘要：监听 归档/网页剪藏 新文件 */
  autoSummaryEnabled: boolean;
  /** AI Agent：笔记 rename/delete/create 同步 */
  aiAgentEnabled: boolean;
  /** 闪念：常驻监听光标/文件 */
  flashEnabled: boolean;
}

export const DEFAULT_SETTINGS: MemoSettings = {
  // AI 全局
  aiProvider: 'deepseek',
  deepseekApiKey: '',
  opencodeGoEndpoint: 'https://opencode.ai/zen/go/v1',
  opencodeGoApiKey: '',
  opencodeGoModel: 'deepseek-v4-flash',
  aiOverride: null,

  // 备忘录
  todoFilePath: 'CONFIG/STORAGE',
  scenarios: '',
  platformMapping: '',
  showFileName: true,
  autoPopupOnStart: true,

  // 归物本
  belongingsDataFolder: 'CONFIG/STORAGE',
  customCategories: '',

  // 剪藏本
  articleDirectory: '归档/网页剪藏',
  batchSize: '20',
  longPressDuration: '800',

  // 密码本
  pwStoragePath: 'CONFIG/STORAGE',
  passwordCharset:
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
  passwordLength: '16',
  securityMode: false,

  // 收藏本
  favoritesStoragePath: 'CONFIG/STORAGE/favorites.json',

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
  moviePageSize: 50,
  enableQ3: true,
  posterFolder: 'CONFIG/MOVIE POSTER',

  // 影视数据分析
  analysisFolderPath: '我的/影视',
  analysisGroups: '',
  analysisBuckets: '',
  analysisGenres: '',
  analysisAgeBuckets: '',
  analysisEras: '',
  analysisDurBuckets: '',
  analysisGroupDur: '',
  analysisReviewKeywords: '',
  analysisSeries: '',
  analysisYearRating: '',

  // 做题家
  enableMultipleChoice: true,
  questionsPerNote: '0',
  shuffleQuestions: true,
  difficulty: 'random',

  // 复习计划
  autoCheckInterval: '60',
  enableAutoNotify: true,
  forceQuizForReview: false,

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
  autoSummaryEnabled: true,
  aiAgentEnabled: true,
  flashEnabled: true,
};
