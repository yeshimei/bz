# 290 首页秒开：关闭保留 DOM + 重开复用动态刷新

## 需求（用户 2026-09-12）

> 首页，首次打开主界面秒开，然后再动态加载时间线进行刷新，关闭主面板保留 dom 渲染。

拆解：

1. **首次打开秒开**：`openHome` 同步建 DOM + 骨架占位（现有 `createOverlay` 行为），时间线随后异步汇入（现有 `refreshRiverAndRender`）。确认保留，补测试钉死「同步返回即有骨架」。
2. **动态加载时间线刷新**：数据采集完成后整体重渲（既有）。重开路径也要触发（新增）。
3. **关闭保留 DOM**：`closeOverlay` 不再 `remove()` + 清状态，改隐藏（`display:none`）。重开复用同一 DOM 元素，先原地秒显上次渲染，再动态刷新。

## 改动

- `src/home/state.ts`：加 `H.overlayVisible`；`currentOverlay` 语义改为「创建后常驻，关闭仅隐藏，卸载才移除」。
- `src/home/ui.ts`：
  - `closeOverlay()`：隐藏保留 DOM，数据/顺序/查看日全部保留；
  - 新增 `showOverlay()`：恢复显示 + `topifyZ` 重发号（谁后显示谁在上）+ 立即 `refreshRiverAndRender()`；
  - `refreshRiverAndRender()`：刷新失败但已有旧渲染 → 保留旧内容直接返回（失败态只兜「从没有过数据」的首次场景，H12 不受影响）；
  - ESC 层 `isVisible` 加 `H.overlayVisible` 判据（隐藏层不得截胡别的面板的 ESC）。
- `src/home/index.ts`：`openHome` 三分支——显示中→关（隐藏）/ 隐藏中→复用秒显 + 刷新 / 无 DOM→首次创建；`unloadHome` 真销毁不变。

## 语义反转（有意）

- 查看日 `H.riverView`：原「随面板关闭失效，重开回默认打开日」→ 改「随关闭保留（DOM 渲染保留的应有之义），随卸载（resetHomeState）归零」。原注释记录的泄漏 bug 前提（remove 后模块变量残留导致非预期渲染）在「显式保留 DOM + 状态」下不再成立，重开显示旧渲染成为预期行为。

## 测试

- `tests/home/ui-river.test.ts`：3 个受影响用例改断言（关闭=隐藏非移除、river 保留、查看日随关闭保留随卸载归零）；新增「重开复用同一元素秒显 + 动态刷新写入新数据」「首次秒开骨架」「unloadHome 真销毁」。
- `tests/home/review-fix-panel-b.test.ts`：H12 尾部 `closeOverlay()` 变隐藏 + beforeEach 清 body/reset，不破。

## 门禁

pnpm test + tsc --noEmit + 自审 + diff 审查 + 主仓库 build 部署。
