/* 移动端评审外景的缩放基准（**全域唯一来源**，13 个行为单源域共用）。
 *
 * 浏览器拿不到显示器的真实 PPI，系统缩放不是 100% 时 1 CSS px 的实际长度会偏离
 * 标准参考像素（1px = 1/96 英寸 = 0.2646mm）。所以这里的换算只能靠**实测一次**：
 *
 *   RULER_MM = 用尺子量「412 CSS px 的基准线」在本机屏幕上的毫米数
 *             （2026-09-10 实测 = 118mm，本机 1 CSS px ≈ 0.2864mm，比标准值大 8%）
 *   MOB_MM   = 小米13U 屏幕实宽（mm，实测；注意不是整机宽 74.64mm，整机含约 2.2mm 边框）
 *
 * --mob-scale 由 prototypes/mob-1to1.css 消费：412 × 915 CSS px → 屏幕上 70.2 × 155.9mm。
 * 换显示器 / 觉得尺寸有偏差时，只改 RULER_MM 一个数。
 */
(function () {
  var RULER_MM = 118; // 实测基准：412 CSS px 在本机屏幕上的物理宽度（mm）
  var MOB_MM = 70.2; // 小米13U 屏幕宽（mm，实测）
  document.documentElement.style.setProperty('--mob-scale', String(MOB_MM / RULER_MM));
})();
