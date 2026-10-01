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

/**
 * 相对「今天」的时间串（`YYYY-MM-DD HH:MM:SS`），days = 距今过去第 N 天。
 *
 * clipbook 的保留策略（`applyRetention`，src/clipbook/news-data.ts）按**真实时钟**判定：
 * `read === true` 且 `fetchedAt ?? date` 超过保留天数（默认 30）的条目在 loader 阶段被整条删掉。
 * 因此种子里写死日期 = 定时炸弹：日期一满 30 天，用例就集体翻红，且症状（列表少一条 /
 * `M.articles.length` 为 0）与真实 bug 难分辨。
 *
 * 2026-10-01 实例：clipbook / review 共 9 个文件种子里写死 `2026-09-01`，恰在这天满 30 天，
 * 10 个用例整体翻红（review-fix-clip-ui、clipbook/ui、views-fix-d、item-menu、toolbar、
 * enhance、adr0147、review-fix-clip2-ui1/ui2）。
 *
 * 凡「会经 loader 进盘」的种子（news.json 的 articles[].date / fetchedAt），一律用它，
 * 不要写死绝对日期。旧数据/剪藏笔记 frontmatter 的 `created:` 若被断言引用，保持原样。
 */
export function ago(days: number, hms = '08:00:00'): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${hms}`;
}
