/**
 * 文献盒转文献任务类型（视频转文献，literature 域；ADR-0066 正名「文献盒」，ADR-0072 迁出为新域）
 * 数据格式：CONFIG/STORAGE/literature.json（单一数据文件，字段形状沿用 bili-tasks.json）
 */
export type LiteratureTaskStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface LiteratureTask {
  /** generateId('literature-task') */
  id: string;
  /** B站链接或 BV 号 */
  url: string;
  /** 剪辑开始时间 HH:MM:SS(.S)，null = 整片不剪辑 */
  start: string | null;
  /** 剪辑结束时间 HH:MM:SS(.S)，null = 整片不剪辑 */
  end: string | null;
  /** 待处理 / 处理中 / 成功 / 失败 */
  status: LiteratureTaskStatus;
  /** 失败原因；或处理中当前步骤文案（UI 行内进度显示） */
  reason: string | null;
  /** 可选备注 */
  remark: string | null;
  /** 成功后的文献笔记路径（vault 相对） */
  notePath: string | null;
  /** 成功后的交付视频文件路径（vault 相对，可能有多个产物时取主文件） */
  videoPath: string | null;
  /** 创建时间 YYYY-MM-DD HH:mm:ss */
  created: string;
  /** 处理完成时间（成功或失败），未处理为 null */
  processedAt: string | null;
  /** 视频标题——聚合讯「保存至文献」入口预填（ticket 134/ADR-0068）+ [bz-info] 解析落库（ADR-0067），行内「标题文字链接」展示 */
  title: string | null;
  /** UP主——预填与解析同上双源，行内次要行展示 */
  uploader: string | null;
  /** 成功自动归档到历史（ADR-0067：主列表只含 待处理/处理中/失败） */
  archived: boolean;
  /** 归档时间（=成功时刻），未归档为 null */
  archivedAt: string | null;
  /** 下载清晰度任务级覆盖（null/'highest'/'1080'/'720'；null=跟随全局设置，ADR-0067） */
  quality: string | null;
  /** 分P 序号（1 起；null=第 1 P，ADR-0067） */
  page: number | null;
}