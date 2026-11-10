/**
 * 复习计划对外门面（ADR-0294 同范式：叶子模块，只放类型与注册表）。
 *
 * bz-reader 的「划线 → 复习卡」要往计划里加一篇**它自己写出来的笔记**，
 * 这是它第一次反向写 bz 的排期数据（以前只有 knowledge 录入与 readerAi 检索，
 * 都是「交给你内容」或「问你只读算力」）。所以单独开一个门面而不是塞进
 * knowledge：录入的生命周期是知识盒、复习的生命周期是复习域，混在一起
 * 调用方探测「能不能加复习」会拿到一个永远存在的函数，探测就失去意义。
 *
 * 注册方在 `review/index.ts` 的 ensureReview（复习域初始化时挂），
 * unloadReview 置 null。未注册时调用方按「这台 bz 还没有这个能力」降级。
 */

/** 没加进去的原因：已在计划中 / 文件不存在 */
export type ReviewAddReason = 'exists' | 'notFound';

export interface ReviewAddOutcome {
  /** 真的写进计划了（false 时看 reason） */
  added: boolean;
  reason?: ReviewAddReason;
}

export interface ReviewAddSummary {
  /** 本次新增的条数 */
  added: number;
  /** 已经在计划里（含批内重复）的条数 */
  exists: number;
  /** 文件不存在或路径为空的条数 */
  notFound: number;
}

export interface ReviewPlanApi {
  /** 门面本身能不能用（复习域已初始化） */
  isReady(): boolean;
  hasNote(path: string): Promise<boolean>;
  addNote(path: string): Promise<ReviewAddOutcome>;
  addNotes(paths: string[]): Promise<ReviewAddSummary>;
  removeNote(path: string): Promise<boolean>;
}

let source: ReviewPlanApi | null = null;

/** 注册/撤销（复习域 ensure 时注册、unload 时传 null） */
export function setReviewPlanApi(api: ReviewPlanApi | null): void {
  source = api;
}

/** 取门面；未注册返回 null */
export function getReviewPlanApi(): ReviewPlanApi | null {
  return source;
}
