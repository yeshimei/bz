/**
 * 插件设置（对应原 QuickAdd 各脚本 settings.options 全量迁移，spec「设置项总表」）
 *
 * 迁移原则（ADR-0005 / spec「设置页」）：保留原脚本全部可配置项；
 * 默认值均提取自各脚本源码 settings.options.defaultValue。
 */

export default interface BzSettings {
  // ===== 🤖 AI 全局（Q3 语义，spec「AI 全局」）=====
  /** AI 服务商：注册表 id（ticket 170/171 策略模式；deepseek / opencode-go / openai / anthropic /
   *  google / moonshot / zhipu / dashscope / siliconflow / openrouter / xai / groq / mistral /
   *  together / ollama / custom） */
  aiProvider: string;
  /** 🔑 DeepSeek API Key（留空则回退读取 QuickAdd data.json） */
  deepseekApiKey: string;
  /** 🔑 OpenCode Go API Key */
  opencodeGoApiKey: string;
  /** 🔑 OpenAI API Key */
  openaiApiKey: string;
  /** 🔑 Anthropic（Claude）API Key */
  anthropicApiKey: string;
  /** 🔑 Google Gemini API Key */
  googleApiKey: string;
  /** 🔑 Moonshot（Kimi）API Key */
  moonshotApiKey: string;
  /** 🔑 智谱（GLM）API Key */
  zhipuApiKey: string;
  /** 🔑 阿里云百炼（通义）API Key */
  dashscopeApiKey: string;
  /** 🔑 硅基流动 API Key */
  siliconflowApiKey: string;
  /** 🔑 OpenRouter API Key */
  openrouterApiKey: string;
  /** 🔑 xAI（Grok）API Key */
  xaiApiKey: string;
  /** 🔑 Groq API Key */
  groqApiKey: string;
  /** 🔑 Mistral API Key */
  mistralApiKey: string;
  /** 🔑 Together AI API Key */
  togetherApiKey: string;
  /** 🔑 Ollama（本地）API Key（本地服务通常无需密钥） */
  ollamaApiKey: string;
  /** 🌐 自定义 AI 服务 API 地址（OpenAI 兼容，ticket 170；覆盖任意提供商如 commandcode） */
  aiCustomEndpoint: string;
  /** 🧠 自定义 AI 服务默认模型名（如 commandcode 的 taste-1） */
  aiCustomModel: string;
  /** 🔑 自定义 AI 服务 API Key */
  aiCustomApiKey: string;
  /** 🧠 每提供商模型覆盖（ticket 172，键 = provider id）：未填用注册表默认模型 */
  aiModelOverrides: Record<string, string>;
  /** 📏 每提供商上下文窗口覆盖（token 数，键 = provider id）：未填用注册表 defaultContextWindow */
  aiContextOverrides: Record<string, number>;
  /** 📏 每提供商最大输出 token 覆盖（键 = provider id）：未填用注册表 defaultMaxTokens（=模型最大输出） */
  aiMaxTokensOverrides: Record<string, number>;

  // ===== 📂 数据存储路径（ADR-0009 共享数据路径）=====
  /** 共享 JSON 数据目录（memo/belongings/passwords/favorites/review/quiz/闪念 meta+vec 统一存放） */
  storagePath: string;

  // ===== 🔔 通知（core notice toast 横切偏好，issue 297）=====
  /** 通知级别：all=全部 / important=仅警告与错误 / error=仅错误。低档位静默常规通知，
   *  但带操作按钮的通知（撤销/查看等交互出口）与 progress 永不放行（notice.ts 消费） */
  noticeLevel: string;
  /** 通知停留档位：quick=干脆 2s / standard=标准 3s（缺省）/ relaxed=从容 5s / persistent=常驻点击才关。
   *  只作用于未显式指定 duration 的默认时长；错误类比常规 +2s；撤销 6s 等显式语义时长不缩放 */
  noticeDuration: string;
  /** 通知弹出位置（仅桌面）：top-right（缺省）/ bottom-right / bottom-left / top-left；移动端恒顶部居中 */
  noticePosition: string;
  /** 通知同屏上限：'3' / '5'（缺省）/ '8'；超出挤掉最旧 */
  noticeMaxVisible: string;

  // ===== 📎 附件搬移（ticket 65，运行时记忆，不暴露设置）=====
  /** 上次选择的目标文件夹（文件夹选择器默认值） */
  attachLastFolder: string;

  // ===== 📝 备忘录（memo.json 共享键）=====
  /** 🚀 启动时自动弹出：启动时若存在未完成的重要或到期备忘录，自动弹出面板提醒 */
  autoPopupOnStart: boolean;
  /** 🔔 打开笔记自动提醒：打开笔记时若该笔记有重要/到期未完成备忘录，自动弹出面板 */
  openNoteReminder: boolean;
  /** 🪟 备忘录面板桌面尺寸记忆（ADR-0084：拖动缩放后记住宽高；0 = 未拖过走默认 720×580） */
  memoPanelWidth: number;
  memoPanelHeight: number;
  /** 🎨 备忘录面板皮肤（issue 210）：paper（纸感手账）/ editorial（编辑部）；未知值按纸感渲染（issue 210 四轮：默认风格下线） */
  memoSkin: string;
  memoLayout: string;
  /** 🏷️ 场景列表（逗号分隔，空则内置默认：剪藏,工作,学习,生活,代码,公开课） */
  memoScenarios: string;
  /** 🔀 默认排序方式：priority（紧急优先）/ due（仅到期）/ created（创建时间） */
  memoSortMode: string;
  /** 📁 默认显示归档：打开面板时显示已归档条目 */
  memoShowArchivedByDefault: boolean;
  /** ⭐ 新条目默认优先级：minor / important */
  memoDefaultPriority: string;
  /** 🆕 新条目默认场景（空=第一个场景） */
  memoDefaultScene: string;
  /** 🚪 打开面板默认场景：'@last'（上次停留，关面板时记忆）/ '全部' / '今日' / '重要' / 场景名；非法值回落「全部」 */
  memoOpenScene: string;
  /** ↩️ 上次停留场景（memoOpenScene='@last' 的取数源；关面板时写入，场景已删则回落「全部」） */
  memoLastScene: string;
  /** 🗂️ 已完成折叠区时间窗（天）：'7'/'30'/'90'，'all'=全部不折叠；非法值回落 30 */
  memoDoneWindow: string;
  // 退役：memoDueFormat（到期时间格式）——口径固定相对，键与设置行一并下线，data.json 残留值忽略

  // ===== 📖 日记本（ADR-0115：旧 12 键按消费面收编为 3 键 + 2 跨域读；退役键 data.json 残留值忽略）=====
  /** 📂 日记目录 */
  diaryDirectory: string;
  /** ✉️ 信目录 */
  letterDirectory: string;
  /** 🕒 写日记默认日期取自文件（否则当前时间） */
  useFileDateTime: boolean;
  // 跨域读：影视目录走影院域 cinemaFolderPath、书库目录走书架墙域 resolveFolderPath（ADR-0115，
  // 用户拍板「影视部分走影院的」）；退役：movieDirectory/showTagCount/diaryBatchSize/diaryTagShowEmoji/
  // diaryContentRenderMode/diaryTagSortMode/diaryDefaultDateFilter/diaryDefaultSelectedTag/diaryJumpToEditAfterSave


  // ===== 📰 剪藏本（自动摘要开关 + ticket 124 详设/数据源）=====
  /** 📂 剪藏目录 */
  articleDirectory: string;
  /** 📄 自动摘要：监听剪藏目录新文件（路径与剪藏目录一致） */
  autoSummaryEnabled: boolean;
  /** 📏 自动摘要长度档位：simple（简短）/ standard（标准）/ detailed（详细）——ticket 124 详设 */
  autoSummaryLength: string;
  /** 🏷️ 自动摘要标签生成开关（关 = 不生成/不补全 tags）——ticket 124 详设 */
  autoSummaryTagsEnabled: boolean;
  /** 🔢 自动摘要标签数量（"3-6" 区间文本）——ticket 124 详设 */
  autoSummaryTagCount: string;
  /** ⏱️ 自动摘要时机：immediate（保存后立刻，create+file-open 双监听）/ lazy（仅打开文件时补全）——ticket 124 详设 */
  autoSummaryTiming: string;
  /** 🗑️ 聚合讯保留策略：未保存文章（已读/跳过骨架与已保存骨架同口径）保留天数——issue 224 两键合一（原 newsRetentionSavedDays/SkippedDays） */
  newsRetentionUnsavedDays: string;
  // ===== 📚 剪藏本（clipbook 融合域，ADR-0082；与旧 clipping/news 并存）=====
  /** 移动端默认全屏（剪藏本融合面板） */
  /** 阅读字号档位：small/medium/large（右栏正文三档，默认 medium） */
  clipbookReaderFontSize: string;
  /** 剪藏本面板桌面尺寸记忆（ADR-0084；0=未拖过，打开走默认 1180×760） */
  clipbookPanelWidth: number;
  /** 剪藏本面板桌面尺寸记忆（ADR-0084；0=未拖过） */
  clipbookPanelHeight: number;
  /** 剪藏本目录栏宽度记忆（issue 222：拖动中/右栏分割线后记住；0=未拖过走默认 360px） */
  clipbookMidWidth: number;

  // ===== 🔐 密码本（4 项）=====
  /** 🔤 密码生成字符集 */
  passwordCharset: string;
  /** 🔢 密码生成长度 */
  passwordLength: string;
  /** 🔒 安全模式（关闭列表窗口立即自动上锁） */
  securityMode: boolean;

  // ===== ⭐ 收藏本（1 项，ADR-0009 废弃）=====

  // ===== 📚 书架墙（bookshelf 域；旧书库域 library 已退役，本域独立承担书库 UI）=====
  /** 📁 书库文件夹（书架墙域；空 = 运行时回落旧 libraryFolderPath 存量值，再回落「书库」） */
  bookshelfFolderPath: string;
  /**
   * 书架墙：移动端默认全屏（默认开——与书库同控）。
   * 读书报告内嵌化后语义仍成立：书架墙面板与读书笔记弹窗（notes-ui）共用此键；
   * 报告随面板同控（独立报告弹窗已退役，不再单独消费）。
   */
  /** 📚 书架墙：默认筛选（all=全部/reading=在读/unread=未读/done=已读；打开面板时侧栏选中态，
   *  非法值回落 all。issue 194） */
  bookshelfDefaultSide: string;
  /** 📚 书架墙：默认排序（date=最近阅读/title=书名/author=作者/progress=进度；非法值回落 date） */
  bookshelfSortMode: string;
  /** 📚 书架墙：面板皮肤（issue 216；nordic=雪松白默认，十选一，设置面板 choiceCards） */
  bookshelfSkin: string;
  bookshelfLayout: string;

  // ===== 🎬 影院（cinema 域；ADR-0087 起接管旧影视域）=====
  /** 📁 影视文件夹（影院域数据源；缺省回落「我的/影视」。目录唯一真理跨域化（ADR-0115）：
   *  日记本域的影视目录经 resolveCinemaFolderPath 实时读本键，两域同源联动 */
  cinemaFolderPath: string;
  /** 🎬 影院：默认排序（date=最近观看/created=按创建/rating=按评分；打开面板时选中态，
   *  非法值回落 date。issue 194） */
  cinemaSortMode: string;
  /** 🎬 影院：默认状态筛选（空串=全部，其余为想看/在看/已看；非法值回落全部。issue 194） */
  cinemaStatusFilter: string;
  /** 🎬 影院：海报网格每行列数（2~12，默认 5；issue 208） */
  cinemaGridColumns: string;
  /** 面板风格（issue 236 / ADR-0103）：midnight/gazette/booth */
  cinemaStyle: string;
  /** 📦 归物本：默认状态筛选（空串=全部，其余 using/idle/sold/discard；非法值回落全部。issue 194） */
  belongingsDefaultStatus: string;
  /** 📦 归物本：默认排序（recent 最近购入 / price 投入最高 / daily 日均最高；非法值回落 recent。issue 294） */
  belongingsDefaultSort: string;
  /** 📦 归物本：新记条目默认状态（使用中/闲置；非法值回落「使用中」。issue 294） */
  belongingsNewStatus: string;
  /** 📦 归物本：金额单位（cny=￥ 前缀默认 / yuan=元 后缀 / usd=$ / none=无符号；非法值回落 cny。issue 294） */
  belongingsCurrency: string;
  /** 🎨 归物本面板布局皮肤（外观组占位单卡，用户拍板 C）：当前仅 poster（P20 瑞士大字报）；未知值回落 poster */
  belSkin: string;
  /** 🎨 归物本主题（与布局一一对应，poster ↔ warmwhite 恒定纸面） */
  belSkinTheme: string;
  /** 🎨 外观组占位键（issue 246 范式铺开）：各面板域布局/主题各一档（布局值统一 default），
   *  由设置页 choiceCards 行读写（可看可选可落盘）；域 UI 消费在各域真做皮肤时接入（届时挂 onChange 热切换）。
   *  日记本键沿用 diarySkin/diarySkinTheme（ADR-0115 正名；旧 diaryWallSkin/Theme 占位键退役，值零迁移） */
  diarySkin: string;
  diarySkinTheme: string;
  clipbookSkin: string;
  clipbookSkinTheme: string;
  favoritesSkin: string;
  favoritesSkinTheme: string;
  /** 🎨 影院主题占位（布局=cinemaStyle 真键，非法值域内回落午夜场） */
  cinemaSkinTheme: string;
  reviewSkin: string;
  reviewSkinTheme: string;
  secondbrainSkin: string;
  secondbrainSkinTheme: string;
  knowledgeSkin: string;
  knowledgeSkinTheme: string;
  pomodoroSkin: string;
  pomodoroSkinTheme: string;
  encryptSkin: string;
  encryptSkinTheme: string;
  /** 🎨 内容首页外观占位（issue 246 同范式）：布局=活动河单卡，主题=米白单卡 */
  homeLayout: string;
  homeSkin: string;
  // ===== 首页时间线（issue 287，2026-09-11 用户点名六项；issue 288 拆组 + 去「已跳过」）=====
  /** 时间线字号档：compact 紧凑 / normal 标准 / loose 宽松（域 UI 在 .bz-home-panel 上挂 data-tl-size） */
  homeTimelineSize: string;
  /** 时间线时间范围（天数口径）：today 当天 / 3d 最近 3 天 / week 本周 7 天（= 周历窗口，默认） */
  homeTimelineRange: string;
  /** 时间线内容过滤：勾选显示哪些类（产出 / 状态推进 / 点评 ✦） */
  homeTimelineProduce: boolean;
  homeTimelineProgress: boolean;
  homeTimelineNotes: boolean;
  /** 打开首页默认落到哪天：today 今天 / lastActive 最后有动静的那天 */
  homeDefaultDay: string;
  /** 时间线显示时刻列（11:03 那列；关掉整列隐藏，行首缩进随之内收） */
  homeTimelineTime: boolean;
  /** 明天预告卡开关（第三栏整块） */
  homeNextCards: boolean;
  // 旧 cinemaPageSize（每批加载数量）已删除：全仓无消费点（列表一次全量渲染），死配置随审计清理


  // ===== 🧠 做题家（4 项，含 shuffleQuestions；设置并入复习计划 tab）=====
  /** 允许多选题 */
  enableMultipleChoice: boolean;
  /** 每篇笔记出题数量（f8：留空/0=自动） */
  questionsPerNote: string;
  /** 打乱题目顺序 */
  shuffleQuestions: boolean;
  /** 题目难度：random/easy/medium/hard */
  difficulty: string;

  // ===== 🔁 复习计划 + 做题家（合并 tab；quiz/review 共用数据路径）=====
  /** 🔔 到期提醒（ticket 100：原「启用逾期通知」键名不动，真正生效——有逾期即弹） */
  enableAutoNotify: boolean;
  /** 🆕 新笔记自动加入提醒（ticket 100：自动收编时弹提示，多条合并一条；关=静默收编） */
  reviewAutoAddNotice: boolean;
  /** 🎯 用做题测难度（原「做题决定难度」，键名不动） */
  forceQuizForReview: boolean;
  /** 🆕 每日复习上限（0=不限；一轮开始复习最多处理 N 篇逾期） */
  reviewDailyLimit: number;
  /** 🆕 复习间隔缩放（FSRS 相位出题天数 × 系数，0.1-5，默认 1；阶梯阶段不受影响）——ADR-0046 */
  reviewIntervalScale: number;
  /** 🆕 文件树标记（ticket 100：为复习笔记着色并标到期时间；关=清爽文件树） */
  reviewTreeBadge: boolean;
  /** 🆕 FSRS 参数自动拟合开关（ADR-0077：按个人复习历史拟合权重，默认开） */
  reviewEnableFit: boolean;
  /** 🆕 每 N 次复习自动重拟合（ADR-0077：全自动定期重算，默认 10） */
  reviewFitEveryN: number;
  /** 🆕 R 目标阈值（ADR-0077：低于该值视为可复习/提前；默认 0.9） */
  reviewRThreshold: number;
  /** 🗂️ 监听文件夹（多个目录；目录内未加入且未排除的 .md 自动进入复习计划，递归） */
  reviewWatchedFolders: string[];
  /** 🚫 排除名单（不参与监听自动加入的笔记路径数组；手动移除/确认移除/批量取消/不更新落此名单） */
  reviewExcludedNotes: string[];

  // ===== 🧠 第二大脑（secondbrain 域；原闪念 17 键 ticket 103 全量更名，onload 迁移旧值）=====
  /** Ollama URL（本地） */
  secondBrainOllamaUrl: string;
  /** Embedding 模型 */
  secondBrainEmbeddingModel: string;
  /** 参考结果数 */
  secondBrainTopK: string;
  /** AI 检索结果数 */
  secondBrainChatTopK: string;
  /** 段落最小长度 */
  secondBrainChunkMinLength: string;
  /** 允许的文件夹（逗号分隔；f8：留空/空=不索引任何目录，不是「全库」） */
  secondBrainAllowPaths: string;
  /** 上下文限制 */
  secondBrainContextLimit: string;
  /** 防抖延迟（ms） */
  secondBrainDebounceDelay: string;
  /** 光标轮询间隔（ms） */
  secondBrainCursorPollInterval: string;
  /** Ollama 对话模型 */
  secondBrainChatModel: string;
  /** DeepSeek 模型 */
  secondBrainDeepseekModel: string;
  /** 默认使用 DeepSeek（true/false） */
  secondBrainDefaultUseDeepseek: string;
  /** 最大历史记录 */
  secondBrainMaxHistory: string;
  /** 远程 Ollama URL（移动端探活/降级链；空 = 未配置远程——移动端回落本地 URL，不探任何远程） */
  secondBrainRemoteOllamaUrl: string;

  // ===== 🔗 第二大脑·自动双链管线（ticket 111，⚙️ 弹窗「自动双链」组）=====
  /** 自动双链总开关：关联范围新笔记落盘时自动建立 related 双链（false 时无任何监听与写入） */
  linkAgentEnabled: boolean;
  /** 关联范围：英文逗号分隔的 vault 内目录清单（风格同 aiAgentWatchedFolders），同时决定落盘监听与候选过滤；f8：留空/空=不自动关联（ticket 116 起不再回退「文献盒」） */
  linkAgentScopes: string;
  /** 单篇候选数量（关联范围内向量近邻 Top-K） */
  linkAgentTopK: number;
  /** 每篇 related 写入上限；0 = 不限，由 AI 裁判自行决定（沿用复习域「0=不限制」惯例） */
  linkAgentMaxLinks: number;
  /** 处理完成后通知提醒（关闭则全程静默） */
  linkAgentNotify: boolean;
  /** 失效关联自动清理（metadataCache 删除事件 + 低频巡检） */
  linkAgentAutoClean: boolean;
  /** 已有关联不再建链（v1.7/ticket 167）：自动路径（创建/修改/队列消费）对 related 非空笔记跳过；手动重跑豁免 */
  linkAgentRespectRelated: boolean;

  // ===== 常驻监听开关（懒加载架构，ADR-0003）=====
  /** 第二大脑启用开关（l7A）：仅控制启动时自动加载（常驻监听/面板初始化），关闭后仍可从命令面板手动打开；原 flashEnabled，ticket 103 更名迁移 */
  secondBrainEnabled: boolean;

  // ===== 🍅 番茄钟（9 项，ticket 31）=====
  /** 预设方案 id（PRESETS 12 档：11 科学预设 + custom 自定义） */
  pomodoroPreset: string;
  /** 自定义工作时长（分钟） */
  pomodoroWorkMin: string;
  /** 自定义短休息时长（分钟） */
  pomodoroShortBreakMin: string;
  /** 自定义长休息时长（分钟） */
  pomodoroLongBreakMin: string;
  /** 几个专注后进长休息（N，默认 4） */
  pomodoroLongBreakInterval: string;
  /** 强制专注模式：专注阶段禁暂停/跳过/重置 */
  pomodoroForceFocus: boolean;
  /** 自动循环：阶段完成自动进入下一阶段 */
  pomodoroAutoCycle: boolean;
  /** 自动跳过休息：连续工作模式 */
  pomodoroAutoSkipBreak: boolean;
  /** 声音提醒（默认开） */
  pomodoroSound: boolean;
  /** 提示音音量 0-100（默认 100 最大） */
  pomodoroVolume: number;
  /** 打开时恢复方式：background（后台继续倒计时）/ popup（正在倒计时则自动弹窗） */
  pomodoroRestoreMode: string;
  /** 后台自动暂停：窗口 hidden（最小化/遮挡/休眠）时主番茄钟暂停，恢复可见自动继续（默认开，ticket 62；blur 不触发） */
  pomodoroAutoPauseOnHide: boolean;

  // ===== 🔐 加密保险箱（encrypt 域，ticket NN）=====
  /** 📂 保险箱根目录（加密清单 .safe.enc 与点前缀密文镜像的统一存放目录，默认 CONFIG/.ENCRYPT——点前缀目录 Obsidian 侧栏不可见，防误删） */
  encryptRoot: string;
  /** 🖼️ 生成省略图预览：加密时生成图片/视频压缩预览层（体积小但看得清，默认开） */
  encryptPreviewEnabled: boolean;
  /** 📏 预览目标长边（px，默认 384——用户可调，越小预览打开越快） */
  encryptPreviewSize: string;
  /** 🎚️ 预览 JPEG 质量 0-1（默认 0.5——用户可调） */
  encryptPreviewQuality: string;
  /** 🚀 预览自动加载原图：打开预览窗即自动解密原始层替换省略图（默认关——省流量/内存；开启后点击缩略图的手动逻辑仍可用） */
  encryptAutoLoadOriginal: boolean;
  /** 🔒 安全模式：关闭保险箱面板立即自动上锁（默认关） */
  encryptSecurityMode: boolean;

  // ===== 📱 移动端主窗口默认全屏（ticket 68，跨域，ADR-0019）=====
  // 仅移动端（Platform.isMobile）显示与生效；≤768px 开=真全屏（.bz-win-mfs）/关=95% 常规卡。
  // 只决定每次打开的初始形态；默认值=行为保持（原移动端即全屏→开，原居中卡→关）。
  // 阅读报告跟随书架墙键（2026-08 用户拍板，不设独立开关）。
  /** 日记本：移动端默认全屏（默认开——原 ≤480px 即全屏，480-768 原抽屉形态） */
  /** 备忘录（memo 新域）：移动端默认全屏（默认关——与旧备忘录一致） */
  /** 归物本：移动端默认全屏（默认开——原 JS 内联强制全屏） */
  /** 收藏本：移动端默认全屏（默认开——原 JS 内联强制全屏） */
  /** 收藏本：列表排序键（created=创建时间最新优先 / title=标题；toolbar 排序循环钮读写。
   *  ADR-0083 重设计去 domain 键——循环仅 created/title 两档；旧 domain 值兼容回落 created。
   *  排序选择持久化于 data.json 而非 favorites.json——favorites.json 顶层是纯条目数组，
   *  顶层加字段需改根结构，会破坏仍在用的外部统计脚本 主页.js（读 favorites.length），
   *  且违背「既有结构不改」铁律；排序键落设置与 memoSortMode 同惯例） */
  favoritesSortKey: string;
  // 旧 favoritesTimeFormat（卡片日期显示）已删（ADR-0101）：固定相对时间
  /** 收藏本：打开面板默认筛选（issue 296）：''=全部 / '@last'=记住上次（取 favoritesLastFilter，同
   *  memoOpenScene '@last' 先例）/ 标签 label=固定该标签；非法值（含标签不在九类）回落全部 */
  favoritesOpenFilter: string;
  /** 收藏本：上次筛选记忆（issue 296；closePanel 写回：''=全部 / '@archived'=已归档视图 / 标签 label；
   *  仅 favoritesOpenFilter='@last' 时消费。落设置（data.json）而非 favorites.json——顶层纯条目数组
   *  不改根结构，与 favoritesSortKey 同惯例） */
  favoritesLastFilter: string;
  /** 收藏本：默认排序（issue 296）：new=最新收藏 / old=最早收藏 / title=按标题；置顶恒最前不变；
   *  非法值回落 new。只管「打开面板时是什么序」，与退役的 favoritesSortKey（排序循环钮）无涉 */
  favoritesDefaultSort: string;
  /** 影院：移动端默认全屏（默认开——原 JS 内联强制全屏；ADR-0087 起影视报告同控此键） */
  /** 复习计划：移动端默认全屏（默认开——原 JS 内联强制全屏） */
  /** 番茄钟：移动端默认全屏（默认关——原移动端 320px 居中卡） */
  /** 保险箱：移动端默认全屏（默认开——原 JS 内联强制全屏） */
  /** 文献盒：移动端默认全屏（默认关——95% 居中卡，ADR-0065） */
  /** 文献盒：步骤进度详细度（默认开——当前步骤+耗时+百分比+步骤时间线；关=仅步骤徽章，ADR-0066） */
  knowledgeProgressDetail: boolean;
  /** 文献盒：处理完是否保留视频原件（默认保留；关=只出文献笔记不落视频，ADR-0066） */
  knowledgeKeepVideo: boolean;
  /** 文献盒：下载清晰度（'highest'/'1080'/'720'，默认最高；透传工具 options.quality，ADR-0066） */
  knowledgeQuality: string;
  /** 文献盒：遇错即停（默认关=失败后继续；开=单条失败后剩余保持待处理，ADR-0066） */
  knowledgeStopOnFailure: boolean;
  /** 文献盒：输出目录覆盖（默认空=跟随工具配置 ~/.bilibili-dl.json 的 outputDir，ADR-0066） */
  knowledgeOutputDir: string;
  /** 文献盒：压缩开关（默认开——用户拍板 ticket 136；透传工具 options.compress） */
  knowledgeCompress: boolean;
  /** 文献盒：压缩质量 CRF（默认 23，范围 18-28；透传工具 options.crf，ticket 136） */
  knowledgeCrf: number;
  /** 文献盒：文献目录（文献笔记落盘位置，默认 vault 根下「文献盒」；ticket 136/ADR-0072） */
  knowledgeCardboxDirectory: string;
  knowledgeTopicDirectory: string;
  knowledgeDirectory: string;
  /** 文献盒：领域词表（逗号分隔；空 = AI 自由写，ticket 136/ADR-0073） */
  knowledgeDomainList: string;
  /** 文献盒：ffmpeg 路径（原工具 rc ffmpegPath，ticket 136 全并进设置） */
  knowledgeFfmpegPath: string;
  /** 文献盒：ffprobe 路径（原工具 rc ffprobePath） */
  knowledgeFfprobePath: string;
  /** 文献盒：Python 路径（faster-whisper，原工具 rc pythonPath） */
  knowledgePythonPath: string;
  /** 文献盒：Whisper 模型（原工具 rc whisperModel） */
  knowledgeWhisperModel: string;
  /** 文献盒：缓存目录（原工具 rc cacheDir；留空=系统临时目录/bili-dl-cache） */
  knowledgeCacheDir: string;
  /** 文献盒：缓存保留天数（原工具 rc cacheRetentionDays） */
  knowledgeCacheRetentionDays: number;

  // ===== 🐱 小橘陪伴猫（smartcat 域：桌面宠物 + AI 陪伴）=====
  /** 小橘启用开关（l7A）：仅控制启动时自动加载（猫容器挂载/常驻行为），关闭后仍可从命令面板手动打开 */
  smartcatEnabled: boolean;
  /**
   * 小橘主窗口：移动端默认全屏（默认关——原居中卡）。
   * 2026-08-23 合并一套（用户拍板）：聊天/设置/数据面板三窗共用本开关；
   * 原独立键 smartcatDashboardMobileDefaultFullscreen（ticket 071）删除，旧值残留忽略。
   */
  /** 小橘记忆库向量化模型（'' = 跟随第二大脑嵌入模型；改动需重建记忆向量索引） */
  smartcatEmbeddingModel: string;
  /** 小橘记忆库分块字符上限（200–6000；默认 800——中文语义检索粒度优先，改动后新入库条目生效） */
  smartcatChunkLimitChars: number;

  // ===== 🐱 小橘记忆巩固（ticket 160 三层流水线；ticket 162 精简——反思只看素材阈值（证据池全量进
  // prompt，仅按重要度排序）；行为小结为反思前置步骤（1 条，不占素材额度）；周报窗口=上次周报以来（首次 7 天），
  // 洞察/小结条数由 AI 定）=====
  /** 反思新观察阈值（自上次反思记忆流新增达到该条数即反思；无时间间隔闸） */
  smartcatReflectMinNew: number;
  /** 反思引用原文摘录字数（0 表示不附原文） */
  smartcatRefExcerptLimit: number;
  /** 每次反思最多归纳洞察条数（ticket 163：默认 3——LLM 输出超限按序截断，防一次性产出过多） */
  smartcatReflectMaxInsights: number;
  /** 小橘对我的称呼（ticket 163：默认「包仔」；把记忆流/行为流喂给 AI 时「你/用户」替换为称呼） */
  smartcatUserName: string;

  // ===== 🐱 小橘行为流设置（P1 数据基座，ticket 123）=====
  /** 行为流最大保留天数（超出部分删除最旧条目） */
  behaviorMaxDays: number;
  /** 行为流最大保留条数（超出部分删除最旧） */
  behaviorMaxCount: number;
  /** 显示行为日志面板（控制 UI 入口是否可见） */
  showBehaviorLog: boolean;
  /** 启用自动双链（关联范围新笔记落盘时自动建立 related 双链） */
  enableAutoLinking: boolean;
  /** 自动双链窗口天数（关联范围内的笔记时间窗口） */
  linkWindowDays: number;
  /** 记忆目录（ADR-0069 记忆目录流）：进入小橘笔记记忆库的多个 vault 文件夹（⚙️ 小橘设置弹窗配置） */
  memoryDirectories: string[];

  // ===== 🧠 第二大脑 =====
  /** 第二大脑主面板：移动端默认全屏（默认开——总览信息密度高；ticket 103） */

  // ===== ⚙️ 设置面板（ADR-0080） =====
  /** 设置面板主窗口：移动端默认全屏（默认开；主面板全屏 + 关闭按钮，子面板一律弹窗） */
  /** 设置面板布局：'jingwei' = 经纬（左栏右域经纬分明；当前唯一布局） */
  settingsPanelLayout: string;
  /** 设置面板主题：'chenhun' = 晨昏（亮如晨、暗如夜，跟随 Obsidian 自动切合；当前唯一主题） */
  settingsPanelSkin: string;

}

/** issue 260 正名一次性迁移：旧 todo* 面板设置键 → memo*（读旧写新删旧；键缺失不写） */
const MEMO_KEY_MIGRATIONS: Array<[string, string]> = [
  ['todoPanelWidth', 'memoPanelWidth'],
  ['todoPanelHeight', 'memoPanelHeight'],
  ['todoSkin', 'memoSkin'],
  ['todoLayout', 'memoLayout'],
];

/** onload 对 loadData 原始对象就地迁移，随后才与 DEFAULT_SETTINGS 合并。
 *  返回是否发生了迁移（旧键存在即算，含新键已在的场景）——C16：调用方据此调度落盘，
 *  否则 data.json 旧键长期残留、每次启动重复迁移 */
export function migrateMemoSettingKeys(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Record<string, unknown>;
  let migrated = false;
  for (const [from, to] of MEMO_KEY_MIGRATIONS) {
    if (rec[from] !== undefined) {
      if (rec[to] === undefined) rec[to] = rec[from];
      delete rec[from];
      migrated = true;
    }
  }
  return migrated;
}

export const DEFAULT_SETTINGS: BzSettings = {
  // AI 全局
  aiProvider: 'opencode-go',
  deepseekApiKey: '',
  opencodeGoApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  googleApiKey: '',
  moonshotApiKey: '',
  zhipuApiKey: '',
  dashscopeApiKey: '',
  siliconflowApiKey: '',
  openrouterApiKey: '',
  xaiApiKey: '',
  groqApiKey: '',
  mistralApiKey: '',
  togetherApiKey: '',
  ollamaApiKey: '',
  aiCustomEndpoint: '',
  aiCustomModel: '',
  aiCustomApiKey: '',
  aiModelOverrides: {},
  aiContextOverrides: {},
  aiMaxTokensOverrides: {},

  // 共享数据路径（ADR-0009）
  storagePath: 'CONFIG/STORAGE',

  // 附件搬移（ticket 65，运行时记忆）
  attachLastFolder: '',

  // 通知（core notice toast 横切偏好，issue 297）
  noticeLevel: 'all',
  noticeDuration: 'standard',
  noticePosition: 'top-right',
  noticeMaxVisible: '5',

  // 备忘录
  autoPopupOnStart: true,
  openNoteReminder: true,
  memoScenarios: '',
  memoSortMode: 'priority',
  memoShowArchivedByDefault: false,
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoLastScene: '',
  memoDoneWindow: '30',
  // memoDueFormat 已退役（到期文案固定相对，2026-09-12 用户拍板）
  // 备忘录面板桌面尺寸记忆（ADR-0084；0=未拖过，打开走默认 720×580）
  memoPanelWidth: 0,
  memoPanelHeight: 0,
  memoSkin: 'paper',
  memoLayout: 'default',

  // 日记本（ADR-0115：3 键；影视/书库目录跨域读，退役键见接口注释）
  diaryDirectory: '我的/日记',
  letterDirectory: '我的/信',
  useFileDateTime: false,

  // 剪藏本
  articleDirectory: '归档/网页剪藏',
  autoSummaryEnabled: true,
  autoSummaryLength: 'standard',
  autoSummaryTagsEnabled: true,
  autoSummaryTagCount: '3-6',
  autoSummaryTiming: 'immediate',
  newsRetentionUnsavedDays: '30',
  // clipbook（ADR-0082）：移动端默认全屏对齐 clipping 默认开
  // clipbook：右栏阅读字号三档（small/medium/large）
  clipbookReaderFontSize: 'medium',
  // clipbook：面板桌面尺寸记忆（ADR-0084；0=未拖过）
  clipbookPanelWidth: 0,
  clipbookPanelHeight: 0,
  // clipbook：目录栏宽度记忆（issue 222 分割线拖宽；0=未拖过）
  clipbookMidWidth: 0,


  passwordCharset:
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
  passwordLength: '16',
  securityMode: false,





  // 书架墙（bookshelf；空 = 未配置，运行时回落旧 libraryFolderPath 存量值——零感知迁移）
  bookshelfFolderPath: '',
  bookshelfDefaultSide: 'all',
  bookshelfSortMode: 'date',
  bookshelfSkin: 'nordic',
  bookshelfLayout: 'default',

  // 影院（cinema；ADR-0087 起接管影视；缺省回落默认目录，旧 movieFolderPath 键已退役）
  cinemaFolderPath: '我的/影视',
  cinemaSortMode: 'date',
  cinemaStatusFilter: '',
  cinemaGridColumns: '5',
  cinemaStyle: 'midnight',

  // 做题家（设置并入复习计划 tab）
  enableMultipleChoice: true,
  questionsPerNote: '0',
  shuffleQuestions: true,
  difficulty: 'random',


  enableAutoNotify: true,
  reviewAutoAddNotice: true,
  forceQuizForReview: false,
  reviewDailyLimit: 0,
  reviewIntervalScale: 1,
  reviewTreeBadge: true,
  reviewEnableFit: true,
  reviewFitEveryN: 10,
  reviewRThreshold: 0.9,
  reviewWatchedFolders: [],
  reviewExcludedNotes: [],

  // 第二大脑（ticket 103：原闪念键更名，值语义与存储类型不变；META_PATH/VEC_PATH 废弃清除）
  secondBrainOllamaUrl: 'http://localhost:11434',
  secondBrainEmbeddingModel: 'bge-m3',
  secondBrainTopK: '20',
  secondBrainChatTopK: '20',
  secondBrainChunkMinLength: '50',
  secondBrainAllowPaths: '', // ticket 116：默认空 = 什么也不录（不索引任何目录），由用户自行填写
  secondBrainContextLimit: '600',
  secondBrainDebounceDelay: '300',
  secondBrainCursorPollInterval: '500',
  secondBrainChatModel: 'qwen2.5:14b-instruct',
  secondBrainDeepseekModel: 'deepseek-v4-flash',
  secondBrainDefaultUseDeepseek: 'false',
  secondBrainMaxHistory: '10',
  // 空 = 未配置远程（enh-sweep-a：原写死内网 IP 改留空；secondbrain/config 同步去 IP 回落）
  secondBrainRemoteOllamaUrl: '',

  // 自动双链管线（ticket 111；ticket 116 起默认空 = 什么也不录，由用户自行填写范围）
  linkAgentEnabled: true,
  linkAgentScopes: '',
  linkAgentTopK: 8,
  linkAgentMaxLinks: 0,
  linkAgentNotify: true,
  linkAgentAutoClean: true,
  linkAgentRespectRelated: true, // v1.7/ticket 167：默认尊重「已有 related 不再自动建链」

  // 常驻监听（issue 187：旧 aiAgent 4 键退役，引用同步无条件常驻，不设开关）
  secondBrainEnabled: true,

  // 番茄钟（9 项，ticket 31）
  pomodoroPreset: 'classic',
  pomodoroWorkMin: '25',
  pomodoroShortBreakMin: '5',
  pomodoroLongBreakMin: '15',
  pomodoroLongBreakInterval: '4',
  pomodoroForceFocus: false,
  pomodoroAutoCycle: false,
  pomodoroAutoSkipBreak: false,
  pomodoroSound: true,
  pomodoroVolume: 100,
  pomodoroRestoreMode: 'background',
  pomodoroAutoPauseOnHide: true,

  // 加密保险箱（encrypt 域）
  encryptRoot: 'CONFIG/.ENCRYPT',
  encryptPreviewEnabled: true,
  encryptPreviewSize: '384',
  encryptPreviewQuality: '0.5',
  encryptAutoLoadOriginal: false,
  encryptSecurityMode: false,

  // 移动端主窗口默认全屏（ticket 68：默认值=行为保持——原移动端即全屏→开，原居中卡→关；
  // 阅读报告跟随书架墙键，不设独立键）
  belongingsDefaultStatus: '',
  belongingsDefaultSort: 'recent',
  belongingsNewStatus: '使用中',
  belongingsCurrency: 'cny',
  belSkin: 'poster',
  belSkinTheme: 'warmwhite',
  // 外观组占位键默认值（issue 246；布局统一 default，主题各域一名，与原型 VALUES 同值）；
  // 日记本主题默认画廊白（ADR-0115 正名沿用 diarySkinTheme 键，默认值随墙语义 ivory→gallery）
  diarySkin: 'default',
  diarySkinTheme: 'gallery',
  clipbookSkin: 'default',
  clipbookSkinTheme: 'newsprint',
  favoritesSkin: 'default',
  favoritesSkinTheme: 'linen',
  cinemaSkinTheme: 'nightfall',
  reviewSkin: 'default',
  reviewSkinTheme: 'sage',
  secondbrainSkin: 'default',
  secondbrainSkinTheme: 'graphite',
  knowledgeSkin: 'default',
  knowledgeSkinTheme: 'manila',
  pomodoroSkin: 'default',
  pomodoroSkinTheme: 'tomato',
  encryptSkin: 'default',
  encryptSkinTheme: 'steel',
  homeLayout: 'default',
  homeSkin: 'cream',
  // 首页时间线（issue 287/288）：默认 = 标准字号 / **本周**（能往回翻整周，用户 2026-09-11 拍板）/
  // 三类中前三类开 / 默认今天 / 显示时刻 / 预告卡开
  homeTimelineSize: 'normal',
  homeTimelineRange: 'week',
  homeTimelineProduce: true,
  homeTimelineProgress: true,
  homeTimelineNotes: true,
  homeDefaultDay: 'today',
  homeTimelineTime: true,
  homeNextCards: true,
  favoritesSortKey: 'created',
  favoritesOpenFilter: '',
  favoritesLastFilter: '',
  favoritesDefaultSort: 'new',
  // 文献盒处理设置（键名随域更名 literature*；ticket 136 默认值=既存行为不动，零迁移）
  knowledgeProgressDetail: true,
  knowledgeKeepVideo: true,
  knowledgeQuality: 'highest',
  knowledgeStopOnFailure: false,
  knowledgeOutputDir: '',
  knowledgeCompress: true,
  knowledgeCrf: 23,
  knowledgeCardboxDirectory: '卡片盒',
  knowledgeTopicDirectory: '主题盒',
  knowledgeDirectory: '文献盒',
  knowledgeDomainList: '',
  knowledgeFfmpegPath: 'ffmpeg',
  knowledgeFfprobePath: 'ffprobe',
  knowledgePythonPath: '',
  knowledgeWhisperModel: 'small',
  knowledgeCacheDir: '',
  knowledgeCacheRetentionDays: 7,
  // 设置面板（ADR-0080）：移动端默认全屏（默认开）；布局默认经纬；主题默认晨昏（跟随亮暗）
  settingsPanelLayout: 'jingwei',
  settingsPanelSkin: 'chenhun',
  // 小橘陪伴猫（smartcat 域；移动端默认全屏键聊天/设置/数据面板共用，2026-08-23 合并一套）
  smartcatEnabled: true,
  smartcatEmbeddingModel: '',
  smartcatChunkLimitChars: 800,
  // 小橘对我的称呼（ticket 163）：默认包仔——把记忆流/行为流喂给 AI 时「你/用户」替换为此称呼
  smartcatUserName: '包仔',

  // 小橘记忆巩固（ticket 160 引入；ticket 162 精简——窗口化语义，见接口注释。旧键（间隔/条数阈值/
  // 证据窗口/洞察条数/周报门槛）从默认值退役，data.json 残留值被忽略）
  smartcatReflectMinNew: 20,
  smartcatRefExcerptLimit: 400,
  // ticket 163：洞察条数上限（默认 3——反思 prompt 最高 N 条 + LLM 返回按序截断）
  smartcatReflectMaxInsights: 3,

  // 小橘行为流设置（P1 数据基座，ticket 123；ADR-0069：全量补齐后扩容 30→60 天 / 2000→10000 条）
  behaviorMaxDays: 60,
  /** 行为流最大保留条数（ticket 129：1000→2000；ADR-0069：2000→10000——全域事件补齐后条目增速再升，已有 data.json 值尊重、零迁移） */
  behaviorMaxCount: 10000,
  showBehaviorLog: true,
  enableAutoLinking: true,
  linkWindowDays: 7,

  // 记忆目录（ADR-0069 记忆目录流）：默认空=不启用笔记记忆库
  memoryDirectories: [],
};

