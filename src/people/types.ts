/**
 * 脸谱域（people）数据模型（issue 435 / ADR-0191；双卷画像 issue 455 / ADR-0192）。
 *
 * 隐私口径（ADR-0191 §2）：微信聊天**原文不落盘**——导入解析与 AI 提炼全程在内存，
 * people.json 只存人物卡、提炼出的事件、脸谱画像与导入元数据；原始消息用完即弃。
 */

/** 统一消息（解析层输出；ts = 毫秒时间戳） */
export interface UnifiedMessage {
  ts: number;
  isSender: boolean;
  text: string;
}

/**
 * 图片描述确认窗数据（issue 470 / ADR-0196 决策 8）：引擎在 describe 段开始前组装、
 * 经注入的确认门（askDescribeConfirm）交给 UI 弹窗。只报张数 / 批数 / 调用数，**不报金额**。
 */
export interface DescribeConfirmInfo {
  /** 服务商显示名（如 DeepSeek / 智谱 Plan / Ollama（本地）） */
  provider: string;
  /** 当前生效模型名 */
  model: string;
  /** 联系人称呼 */
  name: string;
  /** 该人图片总数（聊天仓 type=3 且已关联 img 的口径） */
  totalImages: number;
  /** 已完成张数（描述已合并进聊天仓的；本次从第 doneImages+1 张开始） */
  doneImages: number;
  /** 本次约调用次数（有剩余工作的批数；每批一次调用） */
  calls: number;
  /** 每批张数 */
  batchSize: number;
}

/** 画像生成确认信息（471 / ADR-0196 决策 8 第二次确认：只报素材条数 / 调用数，不报金额） */
export interface PortraitConfirmInfo {
  /** 服务商显示名（如 DeepSeek / 智谱 Plan / Ollama（本地）） */
  provider: string;
  /** 当前生效模型名 */
  model: string;
  /** 联系人称呼 */
  name: string;
  /** 素材条数（聊天仓派生文本非空的消息数；增量口径为本次计划提炼的条数） */
  materials: number;
  /** 本次约调用次数（采集批数 + 其人 + 我们 + 时间线） */
  calls: number;
}

/**
 * 画谱总确认信息（issue 497，用户拍板：两次确认合并成开跑前的一次，确认后不再弹窗）：
 * startGeneration 在起引擎前组装，一次报清全部要花钱 / 花时间的事，**不报金额**。
 */
export interface GenerationConfirmInfo {
  /** 图片描述通道（服务商 / 模型；与画像同走 AI 面板当前通道） */
  provider: string;
  model: string;
  /** 逐人明细（弹窗里一人一行） */
  items: GenerationConfirmItem[];
  /** 图片总数（合计；0 = 无图可描述，弹窗省略描述段） */
  images: number;
  /** 图片描述至多调用次数（ceil(图片 / 每批张数)；引擎幂等，已描述的自动跳过——实际 ≤ 此数） */
  describeCalls: number;
  /** 每批张数（与引擎 describe 段同源 batchSizeFromSettings） */
  batchSize: number;
  /** 语音总数（合计；本地离线转写，不花钱） */
  voices: number;
  /** 画像至多调用次数（采集批 + 其人 + 我们 + 时间线，逐人估算合计；补录 / 增量模式素材照 msgs 口径计） */
  portraitCalls: number;
}

/** 总确认逐人明细行 */
export interface GenerationConfirmItem {
  /** 联系人称呼 */
  name: string;
  /** 素材条数（本次计划提炼口径：full / older = 全量时间线，newer = 锚点后的新增集） */
  materials: number;
  /** 图片张数（全量口径） */
  images: number;
  /** 语音条数（全量口径） */
  voices: number;
  /** 提炼模式（issue 513）：older = 补录（素材与已有画像合并重画）；缺省 = 首画 / 常规增量 */
  mode?: 'full' | 'newer' | 'older';
}


/** 交往事件（LLM 从聊天片段提炼；ts = 日期字符串 YYYY-MM-DD，字典序即时间序） */
export interface FaceEvent {
  ts: string;
  summary: string;
  /** 轻重：major = 大事（约定 / 见面 / 冲突 / 承诺），minor = 小事（日常片段）；旧数据无此字段 */
  kind?: 'major' | 'minor';
}

/** 代表性原话（画像的证据层：口头禅 / 典型语气 / 冲突时的说法） */
export interface QuoteItem {
  /** 日期 YYYY-MM-DD */
  ts: string;
  /** 说话人：'对方' 或 '我' */
  who: string;
  /** 原话（提炼时要求不改写） */
  text: string;
}

/** 场景与细节（反复出现的地点 / 物件 / 习惯动作 / 难忘画面） */
export interface MomentItem {
  ts: string;
  summary: string;
}

/** 兴趣信号（LLM 从聊天片段采集：分享/安利的具体内容、反复聊起的话题、正在投入的事；issue 455） */
export interface InterestItem {
  /** YYYY-MM-DD */
  ts: string;
  /** 话题名 ≤15 字 */
  topic: string;
}

/** 未竟之事（约定/邀约/「下次一起…」/聊一半没下文的话题；兑现与否由画像阶段对照 events 判断，不落盘判断结论；issue 455） */
export interface ThreadItem {
  /** YYYY-MM-DD */
  ts: string;
  /** ≤30 字 */
  text: string;
}

/**
 * 人物档案（手动填写；issue 487 起扩展 10 个可选维度并支持画谱时 AI 按证据回填）。
 * ADR-0191 背景即写明「聊天记录是素材来源**之一**而非全部」，
 * 本结构承载聊天之外的信息：社交账号、生日、怎么认识的、标签、备注等。
 */
export interface PersonProfile {
  /** 社交账号：平台 + 账号（微信 / QQ / 微博 / 小红书 / Telegram…） */
  socials?: Array<{ platform: string; handle: string }>;
  /** 生日（YYYY-MM-DD；年份不明可只写 MM-DD） */
  birthday?: string;
  /** 怎么认识的 */
  metVia?: string;
  /** 什么时候认识的（自由文本，如「2023 年夏天」） */
  metAt?: string;
  /** 家乡 / 现居 */
  hometown?: string;
  /** 职业 */
  job?: string;
  /** 关系标签（家人 / 同学 / 同事 / 网友…） */
  tags?: string[];
  /** 一句话备注 */
  note?: string;
  /** 性格特点（一段话；issue 487） */
  personality?: string;
  /** 兴趣爱好（issue 487） */
  interests?: string[];
  /** 作息 / 生活习惯（issue 487） */
  habits?: string;
  /** 近况（issue 487） */
  recentLife?: string;
  /** 称呼偏好（issue 487） */
  nickname?: string;
  /** 口头禅 / 代表句（issue 487） */
  quote?: string;
  /** 喜欢：话题 / 送礼参考（issue 487） */
  likes?: string[];
  /** 反感 / 雷点（issue 487） */
  dislikes?: string[];
  /** 提到的身边人：谁 + 关系（issue 487） */
  relationships?: Array<{ who: string; relation: string }>;
  /** 重要日子：日子 + 是什么（issue 487） */
  importantDates?: Array<{ date: string; what: string }>;
}

/** 随手记的一笔（手动事件；重画画像时与导入提炼的事件合并） */
export interface ManualEvent {
  id: string;
  /** YYYY-MM-DD */
  ts: string;
  summary: string;
  /** 记录时间 ISO */
  createdAt: string;
}

/**
 * 互动统计（纯本地计算，零 AI 成本）。落盘的是**聚合结果**，不含聊天原文——
 * 与 ADR-0191 §2 的隐私口径一致。
 */
export interface ContactStats {
  /** 按月消息量（升序）：[['2026-03', 1234], ...] */
  monthly: Array<[string, number]>;
  /** 会话发起数（相邻消息间隔 ≥ 30 分钟视为新会话） */
  initiatedByMe: number;
  initiatedByOther: number;
  /** 平均回复时延（秒；新口径：会话首条不计、相邻间隔 >3600 秒不计；0 = 无样本） */
  myAvgReplySec: number;
  otherAvgReplySec: number;
  /** 回复时延中位数（秒；口径同上，中位数比均值抗离群；旧数据无此字段） */
  myMedianReplySec?: number;
  otherMedianReplySec?: number;
  /** 24 小时活跃分布（消息条数，索引 = 小时） */
  myHourly: number[];
  otherHourly: number[];
  /** 消息形态计数：文本 / 图片 / 语音 / 视频 / 表情 / 通话 / 文件 / 引用 / 分享 / 系统 */
  kindCounts: Record<string, number>;
  /** 媒体素材：语音条数（标签带转写的；issue 445，旧数据无此字段） */
  voiceCount?: number;
  /** 媒体素材：语音总时长（秒；标签没写时长的不计入） */
  voiceTotalSec?: number;
  /** 媒体素材：图片张数（带画面描述的） */
  imageCount?: number;
  /** 媒体素材：录音轮次条数（509；旧数据无此字段） */
  recordingCount?: number;
  /** 媒体素材：录音总时长（秒；标签没写时长的不计入） */
  recordingTotalSec?: number;
}

/** 一次导入的元数据 */
export interface ImportRecord {
  /** 源文件名（不含路径） */
  file: string;
  /** 导入时间 ISO */
  importedAt: string;
  /** 解析得的文本消息条数（进提炼的） */
  messageCount: number;
  /** 无法入仓的条数（非对象 / 无效时间；聊天仓 v2 起非文本消息全量入仓，issue 466） */
  skippedCount: number;
  /** 消息时间跨度 ISO */
  timeFrom: string;
  timeTo: string;
  /**
   * 本次导入的互动统计（旧数据无此字段）。
   * issue 454：允许**部分统计**——墙上合成记录（452）只带媒体三项（语音 / 图片明细聊天仓有现成的），
   * 没有 monthly 等明细；消费方以「有没有 monthly」判定能不能出统计卡。
   */
  stats?: Partial<ContactStats>;
}

/**
 * 脸谱（AI 生成产物，重新导入可覆盖重画；issue 455 起拆双卷：《其人》person + 《相交》bond）。
 * 读侧一律走 personOf / bondOf 兼容读单源，不直摸字段。
 */
export interface FaceDigest {
  /** 卷一《其人》人物画像 markdown——受限语法：## 小节 / - 列表 / **粗体** / > 引用块（ui 层迷你渲染器消费）；旧数据无此字段 */
  person?: string;
  /** 卷二《相交》关系画像 markdown（语法同卷一）；旧数据无此字段 */
  bond?: string;
  /** 旧单卷画像（issue 455 前的形态）：兼容读保留，重画后不再写入 */
  portrait?: string;
  events: FaceEvent[];
  /** 画像引用的代表性原话（证据层；旧数据无此字段） */
  quotes?: QuoteItem[];
  /** 《纪事》（编年史 markdown，从认识到现在；旧数据无此字段） */
  chronicle?: string;
  /** 提炼出的特质标签（口头禅 / 典型说话方式等关键词；旧数据无此字段） */
  traits?: string[];
  /** 场景与细节（与导入提炼的 MomentItem 同构；旧数据无此字段） */
  moments?: MomentItem[];
  /** 兴趣信号（分享/安利内容、反复话题；旧数据无此字段，issue 455） */
  interests?: InterestItem[];
  /** 未竟之事（约定/邀约/半截话题，只采集不判断兑现；旧数据无此字段，issue 455） */
  threads?: ThreadItem[];
  /** 生成时间 ISO */
  generatedAt: string;
}

/** 双卷兼容读单源（issue 455）：卷一优先 person，旧数据回落 portrait */
export function personOf(d: FaceDigest | undefined): string {
  return d?.person ?? d?.portrait ?? '';
}

/** 双卷兼容读单源（issue 455）：卷二只有 bond，旧数据无卷二返回空串 */
export function bondOf(d: FaceDigest | undefined): string {
  return d?.bond ?? '';
}

/** 人物卡 */
export interface PersonEntry {
  /** 稳定 id：优先 talker（wxid），缺省回落文件名去扩展名 */
  id: string;
  /** 称呼（默认取 id，可改） */
  name: string;
  /** 建卡时间 ISO */
  createdAt: string;
  imports: ImportRecord[];
  digest?: FaceDigest;
  /** 手动档案（聊天之外的补充信息） */
  profile?: PersonProfile;
  /** 随手记的事件（与导入提炼的事件并存） */
  manualEvents?: ManualEvent[];
  /** 增量提炼锚点：上次提炼过的最大消息时间戳（毫秒）；更早的消息不再重复送 AI */
  lastProcessedTs?: number;
}

export interface PeopleData {
  version: 1;
  people: PersonEntry[];
}

export function emptyPeopleData(): PeopleData {
  return { version: 1, people: [] };
}
