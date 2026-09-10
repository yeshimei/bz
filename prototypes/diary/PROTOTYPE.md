# 日记本 · 原型（行为单源，issue 256 / ADR-0115）

> 本域 = 回忆墙升格正名「日记本」。唯一真理源 = `src/diary/` 实现源码
> （`styles.css` / `render.ts` / `ui.ts` / `store.ts` 写层 / `data.ts` / `config.ts`）。
> 原型评审壳与插件是同一份代码的两个运行端：改源码一处两侧生效。

## 打开方式

| 方式 | 入口 | 说明 |
|---|---|---|
| 双击 | `prototype.html` | 桌面 980px 卡 + 移动 396px 真全屏双 iframe，跑真行为 |
| 自检 | `prototype.html?selftest=1` | headless 可读 `document.title`（`SELFTEST OK n/n`）|
| 暗色 | `prototype-view.html?theme=dark` | 单视图直达暗模式 |
| 热重载 | 主仓 `node scripts/preview-live.mjs` | 快速原型模式（见 docs/prototype-first.md）|

## 单源构成

- **markup 单源**：`src/diary/render.ts`（壳模板 `wallPanelHTML` / 图标表 `ACT_ICON`/`KIND_ICON`
  / MIME / 日统计 `dayStats`/`statHtml` / 灯箱题注 / 媒体题注）→ esbuild 产 `prototype-render.js`
  挂 `BZR_diary`；插件 `ui.ts` 消费同一份（render-purity 守卫强制纯层）。
- **行为单源**：`fake-sim.ts` 以真 `ui.ts`/`store.ts`/`dialogs.ts`/`entry-actions`/`data.ts`/
  `config.ts` 依赖链为入口 → 产 `prototype-behavior.js` 挂 `BZW_diary`；壳只调
  `bootDiarySim()` + `openPanel()` / `openWrite()`（bz-diary-open / bz-diary-write 同链路）。
- **宿主差异**全部在 `fake/fake-obsidian.ts`：localStorage fake vault（读改写/删/adapter.list
  目录面）、`getResourcePath`+`getFirstLinkpathDest`（媒体 URL 走 `assets/` 清单）、
  MarkdownRenderer 纯文本直渲、moment（npm）、Setting/壳类（settings-panel 全域 schema 闭包）。

## 种子数据（真实 vault 快照）

`prototype-data.js` = `node scripts/fetch-diary-data.mjs` 产出（勿手改）：
`我的/日记|影视|信|书库` 的 md **原文逐字**（不做任何解析，真 parser/config 现场解析——
标签/媒体/排序零漂移）；正文 `![[媒体]]` 解析到的真实媒体拷入 `assets/`（>8MB 或缺失的
不进清单 → 墙渐变占位，评审语义仍成立）。改 vault 数据后重跑脚本刷新。

- 「重置演示数据」= 清 `bz-sim:*` 后重载；评审期写入持久在 localStorage。
- 自检会在今日日期写一篇再删除（端到端验证写层 + 守卫 + 串行队列 + 回刷），跑完自清理。

## 自检断言清单（?selftest=1）

CSS 生效（`--dw-bg` 双端计算样式，防 view 页 CSS 404 前科）→ 面板开（双端）→ 品牌「日记本」
→ chips/加密锁定 chip/日期节头/章节栏月份/灯箱抽屉壳 → 写日记弹窗（类型按钮/默认今天）
→ 保存落盘 fake vault → vault modify 防抖回刷上墙 → 右键菜单删除 → flow 确认 →
整文件清空 + 墙回刷。

## 与插件的已知差异

- markdown 正文为纯文本直渲（真 Obsidian 走宿主 MarkdownRenderer，语法着色/内链跳转缺失）。
- 加密日记链路：保险箱未初始化，加密条目不可见（合并函数幂等空操作）；加密/解锁动作走
  真流程但保险箱面板为壳（评审以普通条目为准）。
- 媒体 URL 指向 `assets/` 静态拷贝；视频时长角标（读 metadata）依赖加载，弱环境可能为空。
