# 383 日记本：打开「先面板后内容」——首帧让位读盘与整墙渲染

- 状态：已实现（待主构建部署）
- 提出：2026-09-19 用户
- 相关：ADR-0171；issue 381 / ADR-0170（墙数据启动预热 + 缓存）、ADR-0003（懒加载）

## 用户原话

> 打开日记本，不能等待渲染好了才打开，等用户空等，以后是卡了，先打开面板

## 根因

`show()` 本就同步 `display=flex`——「面板」不等数据。真正堵首帧的是 issue 381 后
**缓存命中**这一新路径：`loadWallEntries` 立即 resolve → `show() → loadAndRender` 整条链
在一个任务链里跑完（微任务一口气到 `renderAll`），浏览器首帧被「读盘 + 整墙 DOM 构建」堵住 →
观感「点了没反应，然后整墙突然出现」，像卡了。

## 落地形态

- 修法：`loadAndRender` 在 `showSkeleton()` 之后插 `await this.afterPaint()`——
  `rAF → setTimeout(0)`，浏览器完成一次绘制（面板 + 骨架已在屏上）才放行读盘/整墙渲染。
- 范式对齐 `prewarmDiary` 的「rAF + setTimeout 到空闲」（issue 381 引入）。

## 口径与边界

| 项 | 口径 |
|---|---|
| 覆盖范围 | `afterPaint` 只插 `loadAndRender` 一处 → 全部调用点（开墙 / 刷新 / 写后回刷 / 重试 / 加密合并后）天然继承；除开墙外路径本就在面板可见时跑，各多一帧延迟（~16ms，可忽略） |
| 隐藏窗口 / 无 rAF | `document.hidden` 或无 `requestAnimationFrame` → 直接 `setTimeout(0)`：后台标签页 rAF 不触发，等它会把刷新卡住 |
| 重开旧墙留场 | `showSkeleton` 对已有 `.bz-diary-item` 的墙跳过（既有语义）——重开首帧直接是旧内容，无骨架闪烁；让位后照常刷新 |
| 数据层 | **零改动**：不动 `loadWallEntries` / 缓存 / 失效（ADR-0170 语义原样） |
| 不加的 | 人为 loading 时长下限（让位只等一帧，非表演式最小 loading）；两段式渲染 / 数据分片（骨架是既有产物，不需要新中间态） |
| 不改的 | 渲染/排序/分组/写链路/加密合并全不动 |

## 测试

`tests/diary/ui.test.ts`（describe「回忆墙 UI」首例后）新增 2 例：

1. **冷开**：`await openManager()` 返回时 `display=flex` + 骨架已在位 + 无 day-head + `entries` 为空；
   `waitFor` 后内容到达、骨架退场。
2. **缓存命中**（预热填缓存后同断言）：钉住「缓存命中会让整条链在微任务里跑完」这条回归——
   没有让位时它正是首帧被堵的路径。

## 改动文件

- `src/diary/ui.ts`（`afterPaint()` + `loadAndRender` 让位）
- `tests/diary/ui.test.ts`（2 例）
- `prototypes/diary/prototype-behavior.js`（行为包重出，源指纹同步）
