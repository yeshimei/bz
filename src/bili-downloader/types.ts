/**
 * 待转文献任务类型（视频转文献，bili-downloader 域升级）
 * 数据格式：CONFIG/STORAGE/bili-tasks.json（新数据文件，不涉及既有格式冻结）
 */
export type BiliTaskStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface BiliTask {
  /** generateId('bili-task') */
  id: string;
  /** B站链接或 BV 号 */
  url: string;
  /** 剪辑开始时间 HH:MM:SS(.S)，null = 整片不剪辑 */
  start: string | null;
  /** 剪辑结束时间 HH:MM:SS(.S)，null = 整片不剪辑 */
  end: string | null;
  /** 待处理 / 处理中 / 成功 / 失败 */
  status: BiliTaskStatus;
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
}