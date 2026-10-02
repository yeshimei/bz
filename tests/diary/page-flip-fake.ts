/**
 * 测试替身：内嵌的 StPageFlip（`src/diary/vendor/page-flip.browser.js`）。
 *
 * 为什么替身而不是真跑库：书的排版契约（页数、页序、`loadFromHTML` 收到哪些页元素、
 * `turnToPage` 落到哪页、`usePortrait` 是否跟端走）都在 **`ui.ts` → 库**这条边界上，
 * 真库在 jsdom 里量不出几何、也没法断言「第几页是日戳」；替身把这条边界变成可断言的记录。
 * 库自己的翻页动画/纸张弯曲不属本域逻辑，不在测试范围内。
 *
 * 替身刻意**模仿库的两条真实行为**，否则会掩盖缺陷：
 * 1. `loadFromHTML(items)` 把页元素挂进宿主（真库也把页插进容器）——
 *    这样「页面 DOM 里有什么」可以直接断言；
 * 2. `destroy()` 会把宿主从 DOM 摘掉（`ui.ts::buildBook` 的重新 append 正是为此）——
 *    替身不摘就无法暴露「重排后书页消失」这类回归。
 *
 * 第三条同样按真库来：`turnToPage` 走 `pages.show()` → `updatePageIndex()` → **照样发 `flip`**
 * （见 `vendor/page-flip.browser.js`）。不发的话 `ui.ts::cursor` 只在拖拽/`flipNext` 后同步，
 * 「Esc 回最新」「册页索引跳页」这类 `turnToPage` 路径就量不出真实行为。
 */
export interface FlipRecord {
  /** 建书时传入的容器（`.bz-diary-flipbook`） */
  host: HTMLElement;
  /** 建书参数（`usePortrait` / `showCover` / `flippingTime` …） */
  opts: Record<string, unknown>;
  /** `loadFromHTML` 收到的页元素（一页一项，顺序即页序） */
  items: HTMLElement[];
  /** 库当前页号 */
  page: number;
  destroyed: boolean;
}

/** 本次测试内建过的所有书（重建即追加） */
export const flipRecords: FlipRecord[] = [];

/** 最近建的那本（断言「当前这本书」用） */
export function lastFlip(): FlipRecord {
  const rec = flipRecords[flipRecords.length - 1];
  if (!rec) throw new Error('还没有建过书：先 show() 并等首屏落定');
  return rec;
}

export function resetFlips(): void {
  flipRecords.length = 0;
}

export class FakePageFlip {
  rec: FlipRecord;
  private handlers: Record<string, ((e: { data: number }) => void)[]> = {};

  constructor(host: HTMLElement, opts: Record<string, unknown>) {
    this.rec = { host, opts, items: [], page: 0, destroyed: false };
    flipRecords.push(this.rec);
  }

  loadFromHTML(items: HTMLElement[]): void {
    this.rec.items = items;
    for (const it of items) this.rec.host.appendChild(it);
  }

  on(ev: string, cb: (e: { data: number }) => void): this {
    (this.handlers[ev] ||= []).push(cb);
    return this;
  }

  turnToPage(n: number): void {
    this.goto(n);
  }

  flipNext(): void {
    this.goto(this.rec.page + 1);
  }

  flipPrev(): void {
    this.goto(this.rec.page - 1);
  }

  getPageCount(): number {
    return this.rec.items.length;
  }

  destroy(): void {
    this.rec.destroyed = true;
    this.rec.host.remove();
  }

  /** 模拟真实库：越界不动，合法翻页才发 `flip`（`ui.ts` 靠它同步 `cursor`） */
  private goto(n: number): void {
    if (n < 0 || n >= this.rec.items.length) return;
    this.rec.page = n;
    for (const cb of this.handlers.flip || []) cb({ data: n });
  }
}
