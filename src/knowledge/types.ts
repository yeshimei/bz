/**
 * 文献盒转文献任务类型（视频转文献，literature 域；ADR-0066 正名「文献盒」，ADR-0072 迁出为新域）
 * 数据格式：CONFIG/STORAGE/knowledge.json（单一数据文件，字段形状沿用 bili-tasks.json）
 *
 * ADR-0296 起任务有两种来源：B 站链接（sourceKind='url'，旧字段形状不变）与本机音视频文件
 * （sourceKind='local'，路径落 localPath、媒体类型落 mediaKind）。两类共用一个处理队列与同一套
 * 「转文字 → AI 生成文献笔记」链路；存量任务没有这两个字段，按 url / video 兜底。
 */
export type KnowledgeTaskStatus = 'pending' | 'processing' | 'success' | 'failed';

/** 来源形态：B 站链接 / 本机文件 */
export type KnowledgeSourceKind = 'url' | 'local';

/** 媒体类型：视频（影像）/ 音声（音频） */
export type KnowledgeMediaKind = 'video' | 'audio';

export interface KnowledgeTask {
  /** generateId('knowledge-task') */
  id: string;
  /** 来源：B站链接或 BV 号（sourceKind='local' 时为空串——本地文件不占 URL 语义） */
  url: string;
  /** 来源形态（ADR-0296；存量数据缺省 = 'url'） */
  sourceKind: KnowledgeSourceKind;
  /** 本机文件的绝对路径（仅 sourceKind='local'；反斜杠归一正斜杠） */
  localPath: string | null;
  /** 媒体类型（ADR-0296：本地任务按扩展名判定；B 站任务恒 'video'） */
  mediaKind: KnowledgeMediaKind;
  /** 剪辑开始时间 HH:MM:SS(.S)，null = 整片不剪辑 */
  start: string | null;
  /** 剪辑结束时间 HH:MM:SS(.S)，null = 整片不剪辑 */
  end: string | null;
  /** 待处理 / 处理中 / 成功 / 失败 */
  status: KnowledgeTaskStatus;
  /** 失败原因；或处理中当前步骤文案（UI 行内进度显示） */
  reason: string | null;
  /** 可选备注 */
  remark: string | null;
  /** 成功后的文献笔记路径（vault 相对） */
  notePath: string | null;
  /** 成功后的交付视频/音频文件路径（vault 相对；本地任务 = 复制进库的那份） */
  videoPath: string | null;
  /** 创建时间 YYYY-MM-DD HH:mm:ss */
  created: string;
  /** 处理完成时间（成功或失败），未处理为 null */
  processedAt: string | null;
  /** 视频标题——聚合讯「保存至文献」入口预填（ticket 134/ADR-0068）+ [bz-info] 解析落库（ADR-0067），行内「标题文字链接」展示 */
  title: string | null;
  /** UP主——预填与解析同上双源，行内次要行展示（本地任务恒空） */
  uploader: string | null;
  /** 成功自动归档到历史（ADR-0067：主列表只含 待处理/处理中/失败） */
  archived: boolean;
  /** 归档时间（=成功时刻），未归档为 null */
  archivedAt: string | null;
  /** 下载清晰度任务级覆盖（null=跟随全局设置；'highest' 或具体档位数字串如 '1080'/'720'/'480'，ADR-0067/ADR-0133；本地任务恒 null） */
  quality: string | null;
  /** 分P 序号（1 起；null=第 1 P，ADR-0067；本地任务恒 null） */
  page: number | null;
  /** 视频时长（秒）——该任务将下载的那个分 P 的时长（多 P 时随 page 取）；解析落库，编辑回显进度条与卡片展示用；null = 未知（ADR-0133） */
  duration: number | null;
}
