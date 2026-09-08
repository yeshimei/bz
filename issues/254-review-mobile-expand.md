# 254 · 复习计划移动端三区自然展开 + 列头吸顶

- **状态**：落地
- **背景**：issue 253 落地后用户报障：移动端「已逾期 / 今天到期 / 未来」三窗口各自内部滚动，
  而非正常展开。真身 = 移动端列继承桌面基线 `flex:1 + overflow-y:auto`，等分弹窗高度后
  各列内滚。经 grill-with-docs 拷问四轮定形。
- **拍板**（2026-09-09）：
  1. 移动端（≤768px）三区列 + 归档「已完成」单列一律取消内滚，按内容自然长高；
  2. `.bz-q-cols` 仍为唯一滚动宿主，搜索工具行 + 统计条钉在上方；
  3. 空区缩成一行列头（如「0 已逾期」）；
  4. 区列头 `position:sticky` 吸顶——当前区列头钉住、下一区列头滚上来顶走（sticky 经典
     行为），不透明底防卡片透出；
  5. 桌面端不动（三列并排、各自内滚照旧）。
- **实现**：纯 `src/review/styles.css` 移动端媒体查询块——样式单源一处生效，原型壳 F5 即见。
  坑：`.bz-q-col.done` 基线 `flex:1.4` 特异性 (0,2,0) 高于媒体查询内 `.bz-q-col` (0,1,0)，
  放开内滚须与 `.done` 同提，否则归档单列仍内滚。
- **文档判定**：不立 ADR（可逆 CSS 单点改，「难逆/费解/真权衡」三要件不满足）；CONTEXT 词条
  不动（纯实现细节不入词条），设计意图以 styles.css 注释留档。
- **测试**：`prototype.html` selftest 增 3 条移动端 CSS 生效断言（列 `flex:0 0 auto` +
  `overflow-y:visible` / 列区 `overflow-y:auto` / 列头 `position:sticky`），41→44；
  `scripts/_selftest-cdp.mjs` 目标页改相对脚本解析（可跨 worktree 复用，argv 可覆盖）。
- **验证**：headless（Edge + CDP）`SELFTEST OK 44/44`；全量 4199/4199 + `tsc --noEmit` 绿；
  主仓 build 部署，产物仅 `styles.css`（本次零 TS 改动，`main.js` 产物含并行会话在途源码
  未随本票提交）。
