/**
 * 共享日期种子工具（全域扫描 2026-09 批次 E）。
 * 配合 vi.setSystemTime 冻结时间使用；offsetDays 支持跨天场景。
 */
export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
