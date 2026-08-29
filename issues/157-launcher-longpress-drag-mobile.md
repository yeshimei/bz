# 157 — 入口页：移动端长按无法拖拽图标（长按同手势直接拖）

**状态**：✅ 已完成

## 用户拍板

> 长按无法拖拽图标（移动端）

## 根因（移动端）

1. **交互断层**：长按 0.5s 只进编辑模式并 `render()` 重建网格，手指底下的磁贴 DOM 被换掉；拖拽必须松手后**重按**才进入（prepDrag 绑在编辑模式的 pointerdown 上）——iOS 式「长按不松手直接拖」永远不成立。
2. **触屏手势抢占**：磁贴无 `touch-action: none`（编辑态）、无 touchmove 阻断——WebView 把按住后的移动判定为滚动 → `pointercancel` → 长按计时/prepDrag/startDrag 全链路被杀；桌面鼠标无此抢占故仅移动端复现。
3. **系统长按菜单**：无 `contextmenu` 拦截、无 `-webkit-touch-callout: none`——移动端长按弹系统菜单打断手势。

## 改动（src/launcher/ui.ts + styles.css + tests/launcher/ui.test.ts）

- **长按同手势拖拽**：`bindDrag` 常态 pointerdown 挂延续监听（document 级，pointerId 校验）——长按触发（进编辑）后手指继续移动超 `MOVE_CANCEL` → 按 `tile.id` 找 render 后新元素直接 `startDrag(tile, ev, 按下点)`，无需松手重按；抬起/取消解绑。
- **触屏滚动阻断**：延续期间 document 非被动 `touchmove` + `preventDefault`（仅长按触发后生效，不干扰长按前的滚动取消语义）；拖拽全程保持，`pointerup/pointercancel`（含拖拽结束那次）解除；`detachDragListeners` 兜底（关弹窗解绑）。
- **编辑态拖拽防抢占**：`.launcher-tile.editing { touch-action: none }`（重按拖拽路径）；常态磁贴不加（保网格滚动）。
- **系统菜单**：grid `contextmenu` preventDefault；磁贴 `-webkit-touch-callout: none`。
- 测试：helper `longPressEnterEdit` 补 pointerup 释放（悬空按下会误触后续用例的 document 级延续监听）+ 两处内联长按同步补；新增「长按不松手同手势拖拽落位写盘」「长按后松手仅进编辑」两用例。

## 验收

- tests/launcher 76 用例全绿；tsc 0 错。
- 移动端行为：按住磁贴 0.5s 不松手直接移动 → 图标跟手拖拽、实时让位；松手落位。
