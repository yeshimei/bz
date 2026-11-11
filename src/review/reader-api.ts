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
  /**
   * 本次真正新进来的卡片钥匙（只对 addCards 有意义）。
   *
   * 复习域用它决定「给哪几张生成 AI 内容」——已经在计划里的卡不重复生成，
   * 用户手点的「重新生成」才覆盖。调用方不读这个字段也不影响既有行为。
   */
  addedKeys?: string[];
}

/**
 * 一张卡片在复习计划里的现状（只读）。
 *
 * 阅读器拿它做两件事：划线上标「复习中」，以及把下次复习日期写在提示里。
 * `planned: false` 时其余字段全是空态——调用方不必再判空。
 */
export interface ReviewNoteStatus {
  /** 传进来的原路径（原样回传，好让调用方直接按路径对齐） */
  path: string;
  planned: boolean;
  /** 下次复习日期（ISO）；没进计划 / 还没排期时为 null */
  nextReviewDate: string | null;
  /** 当前级数（阶梯阶段是 0–9，FSRS 阶段沿用进入时的级数） */
  stage: number;
  phase: 'ladder' | 'fsrs';
  /** 已经复习过几次 */
  totalReviews: number;
}

/**
 * 一张划线卡（阅读器交过来的内容）。
 *
 * 阅读器不再生成 Markdown：内容直接进排期表。所以这里要收齐「复习时用户
 * 需要看见的一切」——原文、想法、出处、回原文的链接。少给一样，复习时那
 * 一面就是空的。
 */
export interface ReviewCardInput {
  /** 稳定钥匙（阅读器建议 `reader:<bookId>:<highlightId>`） */
  key: string;
  bookTitle: string;
  chapterTitle?: string;
  /** 划线原文（调用方负责截断超长文本） */
  text: string;
  comment?: string;
  /** 回到原文的链接（obsidian:// 协议串） */
  backlink?: string;
}

export interface ReviewPlanApi {
  /** 门面本身能不能用（复习域已初始化） */
  isReady(): boolean;
  hasNote(path: string): Promise<boolean>;
  addNote(path: string): Promise<ReviewAddOutcome>;
  addNotes(paths: string[]): Promise<ReviewAddSummary>;
  removeNote(path: string): Promise<boolean>;
  /** 批量加划线卡（内容进条目，不落文件） */
  addCards(cards: ReviewCardInput[]): Promise<ReviewAddSummary>;
  /** 移出一张划线卡 */
  removeCard(key: string): Promise<boolean>;
  /** 批量查现状（一趟读盘）；返回顺序与入参一致 */
  statusOf(paths: string[]): Promise<ReviewNoteStatus[]>;
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
