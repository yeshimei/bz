/**
 * page-flip（StPageFlip）v2.0.7 的手写类型声明——**仅覆盖本域用到的 API 面**。
 *
 * 上游 `dist/js/page-flip.browser.js` 是零依赖 UMD，npm 包不带随文件 .d.ts；
 * 这里不用 `any` 兜底：用到新 API 就在此补声明，缺声明会编译报错——
 * 比 `any` 更早暴露「原型里调了库、单源忘了搬」（ADR-0230）。
 *
 * 该文件与 `page-flip.browser.js` 同名，TypeScript 按 `./vendor/page-flip.browser.js`
 * 的字面量路径解析到这里。
 */

/** 建书参数（键名与上游 settings 一致；只声明本域实际传入的项） */
export interface PageFlipSettings {
  /** 单页宽（必填） */
  width: number;
  /** 单页高（必填） */
  height: number;
  /** `fixed`：不随容器拉伸（本域页宽由 CSS 变量 `--pg-w` 单源给定） */
  size?: 'fixed' | 'stretch';
  /** 竖屏单页模式（窄屏开） */
  usePortrait?: boolean;
  /** 翻页阴影最深值 */
  maxShadowOpacity?: number;
  /** 首页/末页是否当硬封面单页显示（本域无封面页，恒 false） */
  showCover?: boolean;
  /** 移动端内容滚动支持（false：交还页面滚动） */
  mobileScrollSupport?: boolean;
  /** 翻页动画时长 ms */
  flippingTime?: number;
  /** 是否响应鼠标/触摸事件 */
  useMouseEvents?: boolean;
  /** 点击页边是否翻页（本域自管点击，故置 true = 禁用库的点击翻页） */
  disableFlipByClick?: boolean;
  /** 悬停是否显示卷起的页角 */
  showPageCorners?: boolean;
}

/** `'flip'` 事件载荷：`data` = 翻到的页索引 */
export interface FlipEvent {
  data: number;
}

export declare class PageFlip {
  constructor(element: HTMLElement, settings: PageFlipSettings);

  /** 从既有 DOM 元素建页：元素顺序即页序 */
  loadFromHTML(items: NodeListOf<Element> | Element[] | ArrayLike<Element>): void;

  /** 监听事件（本域只订阅 `'flip'`） */
  on(event: 'flip', callback: (e: FlipEvent) => void): PageFlip;

  /** 翻到指定页索引（**越界由调用方钳制**，库不保证兜底） */
  turnToPage(page: number): void;

  /** 往后翻一页 */
  flipNext(corner?: 'top' | 'bottom'): void;

  /** 往前翻一页 */
  flipPrev(corner?: 'top' | 'bottom'): void;

  /** 总页数 */
  getPageCount(): number;

  /** 销毁实例——**会把容器整个从 DOM 摘掉**，宿主需自行把容器放回去 */
  destroy(): void;
}
