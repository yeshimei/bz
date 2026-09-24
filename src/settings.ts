/**
 * 插件设置（对应原 QuickAdd 各脚本 settings.options 全量迁移，spec「设置项总表」）
 *
 * 迁移原则（ADR-0005 / spec「设置页」）：保留原脚本全部可配置项；
 * 默认值均提取自各脚本源码 settings.options.defaultValue。
 */
import { getKnowledgeBoxes, isBoxDir, parseDirList } from './core/knowledge-boxes';
import { DEFAULT_PW_CHARSET } from './password-vault/data';
import { AUTO_SUMMARY_KEYS } from './auto-summary/keys';
import { unsharpenScore } from './secondbrain/vector-math';
// AI 注册表/档位表（issue 411/ADR-0179）：迁移须与注册表同源判定「在册服务商」，防两处字面量漂移
import { AI_PROVIDER_REGISTRY, DEFAULT_AI_PROVIDER, thinkingLevelsOf } from './core/ai';

export default interface BzSettings {
  // ===== 🤖 AI 全局（Q3 语义，spec「AI 全局」）=====
  /** AI 服务商：注册表 id（ticket 170/171 策略模式）。**issue 411/ADR-0179 起只留三条在册通道**：
   *  deepseek（缺省）/ zhipu-plan（智谱 Coding 套餐）/ ollama（本地）——其余服务商与其密钥键一并
   *  退役（用到了再按 AI_PROVIDER_REGISTRY 加一行）；存量非法 id 由 migrateRetiredAIKeys 回落缺省 */
  aiProvider: string;
  /** 🔑 DeepSeek API Key（留空则回退读取 QuickAdd data.json） */
  deepseekApiKey: string;
  /** 🔑 智谱 Plan（Coding 套餐）API Key */
  zhipuPlanApiKey: string;
  /** 🔑 Ollama（本地）API Key（本地服务无鉴权，留空放行） */
  ollamaApiKey: string;
  /** 🧠 每提供商模型覆盖（ticket 172，键 = provider id）：未填用注册表默认模型 */
  aiModelOverrides: Record<string, string>;
  /** 📏 每提供商最大输出 token 覆盖（键 = provider id）：未填按当前模型查官方最大档
   *  （issue 342/ADR-0151 core/model-limits），未收录回落注册表 defaultMaxTokens。
   *  原 aiContextOverrides（上下文窗口覆盖）已退役——模型固有属性、插件零消费点（issue 342 后续） */
  aiMaxTokensOverrides: Record<string, number>;
  /** 🧠 每提供商思考档位（issue 411/ADR-0179，取代全局单值 aiThinking）：键 = provider id，
   *  值 = 该 provider 档位表内的 value（core/ai 的 descriptor.thinking），缺省 auto = 不注入参数。
   *  档位词表**逐家不同**（deepseek 有「关闭」无「中」/ 智谱 Plan 强制思考无「关闭」/
   *  ollama 走 reasoning_effort），故按 provider 分开存——切服务商互不污染，档位不在表内即不注入。
   *  modelOptions 显式思考键优先，不受本设置影响 */
  aiThinkingOverrides: Record<string, string>;

  // ===== 🧭 Jev 决策通道（ADR-0173 / issue 389；issue 424/ADR-0184 起常开）=====
  /** Jev 服务商（issue 424：照 LLM「AI 服务商」同款；issue 430 起 typesafe / bocha，端点走 JEV_PROVIDER_REGISTRY） */
  jevProvider: string;
  /** Jev 密钥（各服务商控制台创建，互不通用；创建时只显示一次）——填了即接管判定，无独立开关 */
  jevApiKey: string;
  /** Jev 模型名。留空跟随服务商缺省（issue 430：typesafe → jev-latest，博查 → bocha-jev-v1；可取模型列表后自选） */
  jevModel: string;

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
  /** 剪藏本图片文件夹（issue 329：保存正文图片落地目录；留空回落 <剪藏目录>/assets） */
  clipbookImageFolder: string;

  // ===== 🔐 密码本（6 项）=====
  /** 🔤 密码生成字符集 */
  passwordCharset: string;
  /** 🔢 密码生成长度 */
  passwordLength: string;
  /** 🔒 安全模式（关闭列表窗口立即自动上锁） */
  securityMode: boolean;
  /** 🎨 密码本面板布局：'default' = 三栏（导航 / 列表 / 详情；当前唯一布局） */
  passwordVaultSkin: string;
  /** 🎨 密码本面板主题：'gold' = 金印（金色印章语言，与解锁屏同源；当前唯一主题） */
  passwordVaultSkinTheme: string;

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
  /** 📚 书架墙：默认排序（recent=最近读完/time=时长最长/title=书名，issue 218 三档；
   *  存量值零感知迁移 date/author→recent、progress→time（state.applyDefaultView）；非法值回落 recent） */
  bookshelfSortMode: string;
  /** 📚 书架墙：面板皮肤（issue 216/236；nordic=雪松白默认，五选一，设置面板 choiceCards） */
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
  /** 🎬 影院：剧集按季合并（同一部剧的各季在片库里合并成一张卡；issue 376 / ADR-0168）。
   *  纯渲染层分组——不改笔记、不加存储，关掉即逐季一卡 */
  cinemaMergeSeasons: boolean;
  /** 面板风格（issue 236 / ADR-0103）：midnight/gazette/booth */
  cinemaStyle: string;
  /** 影院抓取：ApiZero Key（豆瓣字段接口，apizero.cn；空 = 字段走豆瓣演职员兜底，ADR-0129） */
  cinemaApizeroKey: string;
  /** 影院抓取：豆瓣 Cookie（搜索页风控时提高成功率，可选） */
  cinemaDoubanCookie: string;
  /** 影院抓取：海报保存文件夹（空 = 回落默认 CONFIG/MOVIE POSTER；写入 frontmatter 海报键与正文 embed） */
  cinemaPosterFolder: string;
  /** B站 Cookie（ADR-0133 知识盒视频档位查询；「数据源凭据」组设置项，桌面端可从 CLI 导入） */
  bilibiliCookie: string;

  // ===== 🎮 游戏架（gameshelf 域，issue 368：Steam 直连自动拉库，一作一笔记）=====
  /** 📁 游戏文件夹（游戏架域数据源；缺省回落「我的/游戏」） */
  gameshelfFolderPath: string;
  /** 📁 游戏海报文件夹（封面 header.jpg 本地缓存目录；缺省回落「CONFIG/游戏海报」） */
  gameshelfPosterFolder: string;
  /** 🎮 SteamID64（17 位数字；GetOwnedGames/GetRecentlyPlayedGames 查询主体） */
  gameshelfSteamId: string;
  /** 🎮 Steam Web API 密钥（steamcommunity.com/dev/apikey 免费申请；own key 查 own steamid 不受隐私限制） */
  gameshelfSteamApiKey: string;
  /** 🎮 自动同步开关（打开面板时 syncedAt 超过间隔即后台拉库；默认开。关闭只保留手动「立即同步」） */
  gameshelfAutoSync: boolean;
  /** 🎨 游戏库面板布局（外观组占位单卡；当前仅 default 海报墙，未知值域内回落） */
  gameshelfLayout: string;
  /** 🎨 游戏库面板主题（与布局一一对应占位；当前仅 ink 墨黑。2026-09-17 补外观组，皮肤待设计） */
  gameshelfSkinTheme: string;
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
  /** 时间线内容过滤：勾选显示哪些类（产出 / 状态推进 / 点评 ✦ / 已跳过，issue 305） */
  homeTimelineSkipped: boolean;
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
  /** 允许的文件夹（逗号分隔；f8：留空/空=不索引任何目录，不是「全库」） */
  secondBrainAllowPaths: string;
  /** 最大历史记录 */
  secondBrainMaxHistory: string;
  /** 远程 Ollama URL（移动端探活/降级链；空 = 未配置远程——移动端回落本地 URL，不探任何远程） */
  secondBrainRemoteOllamaUrl: string;
  /** 上次由插件自动填入的远程地址（issue 424/ADR-0184 自动跟随的判据：与当前值相同 = 该值归插件管，
   *  本机 IP 变了就跟着刷新；不同 = 用户手改过，一律不动。空 = 从没自动填过） */
  secondBrainRemoteOllamaAuto: string;
  /** 重排开关（issue 427/ADR-0186）：召回后交 Qwen3-Reranker 交叉编码重排。仅 Embedding 模型为
   *  Qwen3-Embedding-8B 时生效（与 AI 面板「启用重排」行可见性共用同一判定，见 core/ai-models） */
  secondBrainRerank: boolean;
  /** 重排模型名（issue 429）：留空回落 RERANK_MODEL（Qwen3-Reranker-4B）；换它不动向量索引，
   *  下一次检索即生效（重排是纯换序层，与 Embedding 模型的「换模型需重建」不同） */
  secondBrainRerankModel: string;

  // ===== 🔗 自动关联（知识盒设置页「自动关联」组；ADR-0141 自第二大脑迁入并正名）=====
  /** 自动关联总开关：三个盒子里的笔记落盘 / 改动后自动建立 related（false 时无任何监听与写入） */
  linkAgentEnabled: boolean;
  /** 单篇候选数量（三个盒子内向量近邻 Top-K） */
  linkAgentTopK: number;
  /** 每篇 related 写入上限；0 = 不限，由 AI 裁判自行决定（沿用复习域「0=不限制」惯例） */
  linkAgentMaxLinks: number;
  /** 处理完成后通知提醒（关闭则全程静默） */
  linkAgentNotify: boolean;
  /** 失效关联自动清理（metadataCache 删除事件 + 低频巡检） */
  linkAgentAutoClean: boolean;
  /** 已有关联不再建链（v1.7/ticket 167）：自动路径（创建/修改/队列消费）对 related 非空笔记跳过；手动重跑豁免 */
  linkAgentRespectRelated: boolean;
  /** 候选相似度下限（issue 330/ADR-0146）：vectorSearch 分数（原始余弦 [0,1]，与参考面板百分比同尺）
   *  低于此值的候选直接剔除不送 AI 裁判；0 = 不过滤。issue 425/ADR-0185 起分数不再锐化 */
  linkAgentMinScore: number;
  /** 内部标记（issue 425/ADR-0185，非设置项、不进设置面板）：'cos' = linkAgentMinScore 已从
   *  锐化尺换算到原始余弦尺。两把尺值域重叠、无法由数值判幂等，故显式留痕（见 migrateLinkMinScoreScale） */
  linkAgentMinScoreScale?: 'cos';

  // ===== 第二大脑（2026-09-12 拍板：启用开关退役）=====
  /** 第二大脑不再有启用键：启动时无条件自动加载（原 l7A secondBrainEnabled 开关与懒加载分支一并退役，
   *  用户拍板「去掉基础组中的启动，默认启动」） */

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
  /** 倒数滴答：最后十秒每秒一记轻响（默认开，2026-09-23 特效批） */
  pomodoroTickSound: boolean;
  /** 提示音音量 0-100（默认 100 最大） */
  pomodoroVolume: number;
  /** 打开时恢复方式：background（后台继续倒计时）/ popup（正在倒计时则自动弹窗） */
  pomodoroRestoreMode: string;
  /** 统计档位记忆（呈报#49-PM3）：弹窗统计区上次所选档（'week' 近 7 天 / 'month' 近 6 月，默认 week）——面板 UI 偏好，不进设置面板行 */
  pomodoroStatMode: string;

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
  // 旧 favoritesSortKey（toolbar 排序循环钮）已删（issue 364）：migrateRetiredFavoritesSortKey 清残留
  // 旧 favoritesTimeFormat（卡片日期显示）已删（ADR-0101）：固定相对时间
  /** 收藏本：打开面板默认筛选（issue 296）：''=全部 / '@last'=记住上次（取 favoritesLastFilter，同
   *  memoOpenScene '@last' 先例）/ 标签 label=固定该标签；非法值（含标签不在九类）回落全部 */
  favoritesOpenFilter: string;
  /** 收藏本：上次筛选记忆（issue 296；closePanel 写回：''=全部 / '@archived'=已归档视图 / 标签 label；
   *  仅 favoritesOpenFilter='@last' 时消费。落设置（data.json）而非 favorites.json——顶层纯条目数组
   *  不改根结构，与 memoSortMode 同惯例） */
  favoritesLastFilter: string;
  /** 收藏本：默认排序（issue 296）：new=最新收藏 / old=最早收藏 / title=按标题；置顶恒最前不变；
   *  非法值回落 new。只管「打开面板时是什么序」，与已退役的排序循环钮无涉 */
  favoritesDefaultSort: string;
  /** 收藏本：标签定义（issue 363 修订：定义本体迁入 data.json 设置键，伴生文件 favorites.tags.json
   *  退役——favorites.json 顶层纯条目数组契约不动）。形状 = favorites/types.ts FavTag（id/label/ic），
   *  条目 tags[] 仍存 label 零迁移。默认 [] = 未自定义，运行时回退内置 9 类 seed（seed 不预落盘，
   *  首次改动才写键）；坏值/空数组同样回退 seed */
  favoriteTags: Array<{ id: string; label: string; ic: string }>;
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
  /** 文献盒：图版图片落地目录（issue 313；留空 = `<文献目录>/assets`） */
  knowledgeImageFolder: string;
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
  /** 文献盒：打开挂载树时自动跑 AI 语义建议（默认开；关闭后仍可用顶栏「重新生成」手动跑，issue 318） */
  knowledgeMountAutoSuggest: boolean;

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

/**
 * ADR-0141 §2/§3 一次性迁移（自动关联迁入知识盒）：与 loadData 原始对象就地处理，随后才合并默认值。
 * - `linkAgentScopes` 键**退役**：关联范围不再可配（恒为三个盒子），旧值不迁移（本机旧值「文献盒」直接丢）；
 * - `secondBrainAllowPaths` 里的**三盒条目剔除**：三个盒子已无条件进索引，留着会被当成「额外检索目录」误导。
 *
 * 幂等：无旧键 / 无冗余条目即不改动，调用方据此决定要不要落盘（同 migrateMemoSettingKeys 的 C16 口径）。
 * 三盒目录从**同一份原始设置**解析（此时还没合并 DEFAULT_SETTINGS，故显式传入 rec）。
 */
/** 已退役的 AI 服务商设置键（issue 411/ADR-0179：注册表只留 deepseek / zhipu-plan / ollama）——
 *  14 家服务商的密钥键 + custom 的端点/模型/密钥三键，旧值不迁移直接丢 */
const RETIRED_AI_KEYS: string[] = [
  'opencodeGoApiKey',
  'openaiApiKey',
  'anthropicApiKey',
  'googleApiKey',
  'moonshotApiKey',
  'zhipuApiKey',
  'dashscopeApiKey',
  'siliconflowApiKey',
  'openrouterApiKey',
  'xaiApiKey',
  'groqApiKey',
  'mistralApiKey',
  'togetherApiKey',
  'aiCustomEndpoint',
  'aiCustomModel',
  'aiCustomApiKey',
];

/** per-provider 覆盖表（迁移时清掉退役 provider 的条目——留着是读不到的死值） */
const AI_OVERRIDE_MAPS: string[] = ['aiModelOverrides', 'aiMaxTokensOverrides', 'aiThinkingOverrides'];

/**
 * AI 设置一次性迁移（issue 411/ADR-0179；并入了原 issue 342 后续的 aiContextOverrides 清理）：
 * 1) **退役服务商密钥键删除**（上表 16 键）；
 * 2) **aiProvider 非在册 id → 回落缺省服务商**：已退役的 id（opencode-go / openai / custom…）
 *    若留在设置里，解析会一路落到缺省描述上（端点、密钥键、档位全对不上），必须显式改掉；
 * 3) 三个 per-provider 覆盖表清掉退役 provider 的条目；
 * 4) **全局 aiThinking → aiThinkingOverrides[当前 provider]**（旧键删除）：旧词表的 off/low/high
 *    在三条通道里同名可用；`medium` 按官方映射（medium→high）折成 high；折后不在该 provider
 *    档位表内的一律丢弃——宁可回落「跟随模型默认」，也不发服务商不认识的参数。
 * 幂等：无旧键/无脏值即不改动（同 migrateMemoSettingKeys 的 C16 口径，调用方据返回值调度落盘）。
 */
export function migrateRetiredAIKeys(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Record<string, unknown>;
  const isLive = (id: string): boolean => AI_PROVIDER_REGISTRY.some((p) => p.id === id);
  let migrated = false;
  // 1) 上下文窗口覆盖（issue 342 后续：模型固有属性、插件零消费点）
  if (rec.aiContextOverrides !== undefined) {
    delete rec.aiContextOverrides;
    migrated = true;
  }
  // 2) 退役服务商密钥键
  for (const key of RETIRED_AI_KEYS) {
    if (rec[key] !== undefined) {
      delete rec[key];
      migrated = true;
    }
  }
  // 3) 服务商回落（存量非法 id；缺键不动——合并 DEFAULT_SETTINGS 时自然取缺省值）
  const stored = rec.aiProvider === undefined ? undefined : String(rec.aiProvider);
  const currentId = stored && isLive(stored) ? stored : DEFAULT_AI_PROVIDER;
  if (stored !== undefined && !isLive(stored)) {
    rec.aiProvider = DEFAULT_AI_PROVIDER;
    migrated = true;
  }
  // 4) 覆盖表清退役 provider 条目
  for (const mapKey of AI_OVERRIDE_MAPS) {
    const map = rec[mapKey];
    if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
    for (const id of Object.keys(map as Record<string, unknown>)) {
      if (!isLive(id)) {
        delete (map as Record<string, unknown>)[id];
        migrated = true;
      }
    }
  }
  // 5) 旧全局思考档位 → per-provider 覆盖（旧键删）
  if (rec.aiThinking !== undefined) {
    const legacy = String(rec.aiThinking);
    delete rec.aiThinking;
    migrated = true;
    // 档位在该 provider 新表内 → 直接沿用；只有「中」不在表内时才按官方映射折 high
    // （deepseek / 智谱的 medium 都被服务端映射到 high）；折后仍不在表内或为 auto → 丢弃
    const levels = thinkingLevelsOf(currentId).map((l) => l.value);
    const mapped = levels.includes(legacy) ? legacy : legacy === 'medium' && levels.includes('high') ? 'high' : '';
    if (mapped && mapped !== 'auto') {
      const existing = rec.aiThinkingOverrides;
      const overrides =
        existing && typeof existing === 'object' && !Array.isArray(existing)
          ? (existing as Record<string, string>)
          : ((rec.aiThinkingOverrides = {}) as Record<string, string>);
      overrides[currentId] = mapped;
    }
  }
  return migrated;
}

/**
 * 第二大脑一次性迁移（issue 424/ADR-0184）：四个参数键退役——「段落最小长度」「上下文限制」
 * 不再限制（分块全留），「防抖延迟毫秒」「光标轮询毫秒」固化为常量（secondbrain/config.ts）。
 * 旧值不迁移直接丢（留着是读不到的死值）。幂等：无旧键即不改动。
 */
const RETIRED_SECONDBRAIN_KEYS: string[] = [
  'secondBrainChunkMinLength',
  'secondBrainContextLimit',
  'secondBrainDebounceDelay',
  'secondBrainCursorPollInterval',
];

export function migrateRetiredSecondBrainKeys(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Record<string, unknown>;
  let migrated = false;
  for (const key of RETIRED_SECONDBRAIN_KEYS) {
    if (rec[key] !== undefined) {
      delete rec[key];
      migrated = true;
    }
  }
  return migrated;
}

/** Jev 通道一次性迁移（issue 424/ADR-0184）：
 * 1) **总开关键退役**（`jevEnabled`）——常开：填了密钥即接管判定，清空即回落 LLM；
 * 2) **端点 / 超时两键退役**——端点由「Jev 服务商」决定（`JEV_PROVIDER_REGISTRY`），超时固定十秒；
 * 3) `jevModel` 仍钉在旧缺省 `jev-1.13.0` → 改写为 `jev-latest`（服务端最新版；旧值只是插件
 *    缺省被落盘的产物，用户自选的其他模型名一律保留）。
 * 幂等：无旧键/无脏值即不改动（同 migrateMemoSettingKeys 的 C16 口径，调用方据返回值调度落盘）。 */
const RETIRED_JEV_KEYS: string[] = ['jevEnabled', 'jevEndpoint', 'jevTimeoutMs'];
/** 旧缺省模型名（ADR-0173 §5 曾刻意钉版本；issue 424 起改为跟随服务端最新） */
const LEGACY_JEV_DEFAULT_MODEL = 'jev-1.13.0';

export function migrateRetiredJevKeys(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Record<string, unknown>;
  let migrated = false;
  for (const key of RETIRED_JEV_KEYS) {
    if (rec[key] !== undefined) {
      delete rec[key];
      migrated = true;
    }
  }
  if (rec.jevModel !== undefined && String(rec.jevModel) === LEGACY_JEV_DEFAULT_MODEL) {
    rec.jevModel = 'jev-latest';
    migrated = true;
  }
  return migrated;
}

/**
 * issue 364 一次性迁移：收藏本排序循环钮键退役——ADR-0083 重设计后循环钮已删，键全链
 * 零消费点（打开面板的排序由 favoritesDefaultSort 承担），旧值不迁移直接丢。
 * 幂等：无旧键即不改动，调用方据此决定要不要落盘（同 migrateRetiredAIKeys 口径）。
 */
export function migrateRetiredFavoritesSortKey(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Record<string, unknown>;
  if (rec.favoritesSortKey === undefined) return false;
  delete rec.favoritesSortKey;
  return true;
}

/**
 * issue 425/ADR-0185 一次性迁移：`linkAgentMinScore` 从「score^0.35 锐化尺」换算到「原始余弦尺」。
 *
 * 两把尺值域同为 [0,1]，光看数值判不出是否已换算（0.3 再换算一次会掉到 0.03 ≈ 关掉阈值），
 * 故留内部标记键 `linkAgentMinScoreScale`（'cos' = 已换算）作幂等凭据；标记在册即不再动值。
 * `0 = 不过滤` 是文档化语义、两把尺上同为 0，原样保留（换算公式会把 0 幂成 0 再被下限抬到 0.01，
 * 等于替用户把过滤打开）；换算与下限口径见 unsharpenScore。
 */
export function migrateLinkMinScoreScale(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Record<string, unknown>;
  if (rec.linkAgentMinScoreScale === 'cos') return false;
  if (rec.linkAgentMinScore === undefined) return false; // 未落盘过该键：缺省值走新尺，无需换算
  const old = rec.linkAgentMinScore;
  rec.linkAgentMinScoreScale = 'cos';
  if (old === 0) return true; // 不过滤：原样保留
  if (typeof old !== 'number' || !Number.isFinite(old) || old < 0) {
    rec.linkAgentMinScore = DEFAULT_SETTINGS.linkAgentMinScore; // 脏值（负数/非数）：回落新默认
    return true;
  }
  rec.linkAgentMinScore = unsharpenScore(old);
  return true;
}

export function migrateAutoLinkSettings(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Record<string, unknown>;
  let migrated = false;
  if (rec.linkAgentScopes !== undefined) {
    delete rec.linkAgentScopes;
    migrated = true;
  }
  if (rec.secondBrainAllowPaths !== undefined) {
    const before = String(rec.secondBrainAllowPaths ?? '');
    const boxes = getKnowledgeBoxes(rec);
    const after = parseDirList(before)
      .filter((p) => !isBoxDir(p, boxes))
      .join(',');
    if (after !== before) {
      rec.secondBrainAllowPaths = after;
      migrated = true;
    }
  }
  return migrated;
}

export const DEFAULT_SETTINGS: BzSettings = {
  // AI 全局（issue 411/ADR-0179：注册表只留三条通道，缺省 = DeepSeek 官方）
  aiProvider: DEFAULT_AI_PROVIDER,
  deepseekApiKey: '',
  zhipuPlanApiKey: '',
  ollamaApiKey: '',
  aiModelOverrides: {},
  aiMaxTokensOverrides: {},
  // 每提供商思考档位（issue 411/ADR-0179）：空 = 各 provider 都跟随模型默认（不注入思考参数）
  aiThinkingOverrides: {},

  // Jev 决策通道（ADR-0173；issue 424/ADR-0184 常开）：无开关，未填密钥时不接管任何判定
  jevProvider: 'typesafe',
  jevApiKey: '',
  jevModel: 'jev-latest',

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
  memoSkin: 'editorial',
  memoLayout: 'default',

  // 日记本（ADR-0115：3 键；影视/书库目录跨域读，退役键见接口注释）
  diaryDirectory: '我的/日记',
  letterDirectory: '我的/信',
  useFileDateTime: false,

  // 剪藏本
  articleDirectory: '归档/网页剪藏',
  // 自动摘要五键改引 keys.ts 单源（A6 跨域字面收口，呈报批 A6）：键名唯一定义处
  // src/auto-summary/keys.ts，改名只动一处（字面量散布时漏改一处即静默回退默认值）
  [AUTO_SUMMARY_KEYS.enabled]: true,
  [AUTO_SUMMARY_KEYS.length]: 'standard',
  [AUTO_SUMMARY_KEYS.tagsEnabled]: true,
  [AUTO_SUMMARY_KEYS.tagCount]: '3-6',
  [AUTO_SUMMARY_KEYS.timing]: 'immediate',
  newsRetentionUnsavedDays: '30',
  // clipbook（ADR-0082）：移动端默认全屏对齐 clipping 默认开
  // clipbook：右栏阅读字号三档（small/medium/large）
  clipbookReaderFontSize: 'medium',
  // clipbook：面板桌面尺寸记忆（ADR-0084；0=未拖过）
  clipbookPanelWidth: 0,
  clipbookPanelHeight: 0,
  // clipbook：目录栏宽度记忆（issue 222 分割线拖宽；0=未拖过）
  clipbookMidWidth: 0,
  // clipbook：图片文件夹（issue 329；留空回落剪藏目录 assets）
  clipbookImageFolder: '',


  // 字符集默认值收编 password-vault/data 单源（原字面量第三份拷贝，深审批 C 口径漂移清单）
  passwordCharset: DEFAULT_PW_CHARSET,
  passwordLength: '16',
  securityMode: false,
  // 外观组（2026-09-12）：布局/主题各一档（与保险库 · 影院 · 第二大脑同范式）
  passwordVaultSkin: 'default',
  passwordVaultSkinTheme: 'gold',





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
  // 剧集按季合并（issue 376 / ADR-0168）：2026-09-20 用户改默认**开**（合并已是常态视图）
  cinemaMergeSeasons: true,
  cinemaStyle: 'midnight',
  cinemaApizeroKey: '',
  cinemaDoubanCookie: '',
  cinemaPosterFolder: '',
  bilibiliCookie: '',

  // 游戏架（gameshelf，issue 368：Steam 直连自动拉库；目录缺省回落「我的/游戏」）
  gameshelfFolderPath: '我的/游戏',
  gameshelfPosterFolder: '',
  gameshelfSteamId: '',
  gameshelfSteamApiKey: '',
  gameshelfAutoSync: true,
  gameshelfLayout: 'default',
  gameshelfSkinTheme: 'ink',

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
  // issue 424/ADR-0184：段落最小长度 / 上下文限制（本就无消费方）/ 防抖 / 光标轮询四键退役——
  // 前三者不再限制，防抖 300ms 与轮询 500ms 固化为常量（secondbrain/config.ts）
  secondBrainAllowPaths: '', // ticket 116：默认空 = 什么也不录（不索引任何目录），由用户自行填写
  secondBrainMaxHistory: '10',
  // 空 = 未配置远程（enh-sweep-a：原写死内网 IP 改留空；secondbrain/config 同步去 IP 回落）
  secondBrainRemoteOllamaUrl: '',
  secondBrainRemoteOllamaAuto: '',
  secondBrainRerank: true, // issue 427/ADR-0186：默认开；仅 Qwen3-Embedding-8B 配置下显示与生效
  secondBrainRerankModel: '', // issue 429：空 = 默认 Qwen3-Reranker-4B（secondbrain/config RERANK_MODEL）

  // 自动双链管线（ticket 111；ticket 116 起默认空 = 什么也不录，由用户自行填写范围）
  linkAgentEnabled: true,
  linkAgentTopK: 8,
  linkAgentMaxLinks: 0,
  linkAgentNotify: true,
  linkAgentAutoClean: true,
  linkAgentRespectRelated: true, // v1.7/ticket 167：默认尊重「已有 related 不再自动建链」
  linkAgentMinScore: 0.3, // issue 330/ADR-0146（issue 425/ADR-0185 换算）：候选相似度下限（原始余弦，0.3≡旧锐化尺 0.65）；0=不过滤
  // issue 425/ADR-0185：换算标记必须随缺省值一起落盘——落盘路径写的是整份 Object.assign({}, DEFAULT_SETTINGS, loaded)，
  // 若缺省值不带标记，首次保存（ensureRemoteOllamaUrl / 设置页任意一键）写下的 0.3 会在第二次启动被当旧尺换算成 0.03
  linkAgentMinScoreScale: 'cos',

  // 常驻监听（issue 187：旧 aiAgent 4 键退役，引用同步无条件常驻，不设开关）
  // 第二大脑（2026-09-12 拍板）：启用开关退役，启动无条件自动加载，键不再落盘

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
  pomodoroTickSound: true,
  pomodoroVolume: 100,
  pomodoroRestoreMode: 'background',
  pomodoroStatMode: 'week',

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
  homeTimelineSkipped: false,
  homeTimelineProgress: true,
  homeTimelineNotes: true,
  homeDefaultDay: 'today',
  homeTimelineTime: true,
  homeNextCards: true,
  favoritesOpenFilter: '',
  favoritesLastFilter: '',
  favoritesDefaultSort: 'new',
  // 收藏本标签定义（issue 363 修订）：空 = 未自定义（运行时回退内置 9 类 seed），首次改动才落盘
  favoriteTags: [],
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
  knowledgeImageFolder: '',
  knowledgeDomainList: '',
  knowledgeFfmpegPath: 'ffmpeg',
  knowledgeFfprobePath: 'ffprobe',
  knowledgePythonPath: '',
  knowledgeWhisperModel: 'small',
  knowledgeCacheDir: '',
  knowledgeCacheRetentionDays: 7,
  // 挂载树 AI 语义建议（issue 318）：默认开（打开白板即跑；缓存命中则无感）
  knowledgeMountAutoSuggest: true,
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

