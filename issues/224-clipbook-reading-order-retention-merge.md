# issue 224：剪藏本在读让位移动端对齐 + 保留天数两键合一

用户反馈（2026-09-06）：

1. 「剪藏本点击进去就会变为在读，但是不会把这个文章的顺序往下排，还是在原来的位置」
2. 设置里「已保存文章保留天数(3)」「已跳过文章保留天数(7)」是一个意思，合并为
   「未保存文章保留天数」，默认 30 天。

## 方案

### A. 在读让位（移动端补齐）

- 核实：桌面中栏 sortedView 未读在前重排正常（无头复现：点首篇 → 自动落在读 → 让位最底）。
- 缺口在移动端：renderMobList 用 `listWithSearch()`（时间降序、不按状态重排），且
  autoMarkReading 刷新序列不含 renderMobList——落在读后移动列表既不重排也不重绘。
- 修法：renderMobList 改用 `sortedView()`（未读在前、组内最新在前，与桌面目录同序）；
  autoMarkReading 补 `renderMobList()`。

### B. 保留天数两键合一

- `newsRetentionSavedDays`(默认 3) + `newsRetentionSkippedDays`(默认 7) 退役；
  新键 `newsRetentionUnsavedDays` 默认 30。
- applyRetention 以同值应用于已保存骨架与已跳过骨架两档（签名不动，调用方传同值）。
- 数据源组设置两行并一行：「未保存文章保留天数」，desc 说明清理范围与默认值。
- smoke 同步：旧键缺席断言 + 新键默认 30。

## 验收

- 移动双屏：未读在前，点进文章落在读后该篇让位到未读之后（组内保持最新在前）。
- 设置数据源组只剩一行保留天数，默认 30；超期清理对已保存/已跳过骨架同口径生效。
- 全量 vitest + tsc --noEmit 绿。
