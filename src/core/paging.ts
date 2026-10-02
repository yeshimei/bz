/**
 * 列表分片加载的跨域共享口径（ADR-0231）。
 *
 * 影院（820 篇）与日记本（墙 1443 条）是笔记最多的两个域：全量渲染/全量读盘会把首帧占死。
 * 两个域的**首屏窗口大小各自算**（按各自版式，见 `cinema/state.ts` 的 `FIRST_PAINT_CARDS`
 * 与 `diary/config.ts` 的 `FIRST_PAINT_ENTRIES`），但**后台每批的粒度是跨域政策**，
 * 单源落在这一处——两域不得各写各的。
 */
export const LIST_BATCH_SIZE = 50;

/**
 * 下一批的渲染区间 `[from, to)`，`to` 封顶在 `total`。
 *
 * `from` 传**当前已渲染条数**（调用方从 DOM 子元素数读，比另存一份计数更稳——
 * 任何一次整刷都会让它自动对齐）。返回 `from >= to` 表示已无下一批。
 */
export function nextBatchRange(
  rendered: number,
  total: number,
  size: number = LIST_BATCH_SIZE
): { from: number; to: number } {
  const from = Math.max(0, Math.min(rendered, total));
  return { from, to: Math.min(from + Math.max(1, size), total) };
}
