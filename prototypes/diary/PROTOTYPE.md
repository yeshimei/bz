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

## 历史探索（已清理）

本目录评审期曾有两批探索，**2026-09-10 结论为全部不采纳**，产物已按「只留单源」清理
（`git log` 可查，需要时可从历史取回）：

- **三版皮肤**（`skins/{warm,quiet,darkroom}.css` + `prototype-skins.html`）——纯视觉层变体，
  挂 `?skin=` 覆盖域样式。
- **五版概念稿**（`concepts/` + `scripts/build-diary-concepts.mjs`）——结构级方向探索：长卷（连续
  时间轴）/ 对谈室（消息流）/ 年历图谱（十年热力）/ 镜头（单张全屏播放）/ 四柜（类型原生多视图）。
  数据经 `concept-data.ts` 复用真解析链；因换版式必然不沿用 `render.ts`/`ui.ts`，**不复用行为单源**。

副产物结论（与文件无关，值得留记）：快照 235 篇 → 484 条，最大类是**「对谈」208 条（43%）**，
其次念念碎 87 / 日记 41；「影视 40 篇」里仅 4 部能进墙（需同时有影评 + 观影日期），
「书库 30 本」仅 5 本（需有书评）；非 `YYYY-MM-DD.md` 命名的文件（如 `我的/日记/其他/已逝.md`）
会被解析器直接跳过。

## 评审环境保真（宿主主题桥 + vault 媒体按需）

原型壳与插件同码，但**运行端环境**要另行还原，否则评审看到的是假色、假图：

- **宿主主题桥**：`node scripts/fetch-host-theme.mjs` → `prototypes/host-theme.css`。
  读真实 vault 的 `.obsidian/appearance.json`（`accentColor` / `baseFontSize` / `theme`）
  结合 Obsidian 官方默认变量表，生成明暗双套 `--background-*` / `--text-*` /
  `--interactive-accent` 等（**替代**壳内早先手写的一组浅色近似值）。壳 `<body>` 的
  `theme-light`/`theme-dark` 由 `?theme=` 或外景壳切换按钮决定。核因：域样式 130 处
  `var(--…)` 几乎全派生自宿主变量，壳模拟值一偏，色就差得离谱。
- **vault 媒体按需取流**：正文引用的媒体全量 **1.8 G**（图 577M / 视频 1.07G / 音频 151M），
  不可能入库。快照只拷【择要】子集到 `assets/`（服务「双击直开」的离线评审）；其余由
  `preview-live.mjs` 的 **`/__vault-media/<文件名>`** 现场从真实 vault 按 basename 取流
  （**支持 Range**，视频可拖拽），`fake/fake-obsidian.ts` 的 `getResourcePath` /
  `getFirstLinkpathDest` 在 http 环境下自动回退到该路由。vault 根由 `esbuild.config.mjs`
  的 `VAULT_PLUGIN_DIR` 反推，可 `--vault <根>` 覆盖；`file://` 无服务端时退渐变占位。
- **抓取优先级**：`fetch-diary-data.mjs` 的媒体拷贝**必须保持 DIRS 优先序**（日记 → 影视 →
  信 → 书库）。曾按 basename 字典序排，书页扫描图 `00001.jpeg…` 挤掉日记照片，命中率掉到
  25%（满墙渐变占位）。


## 单源构成

- **markup 单源**：`src/diary/render.ts`（壳模板 `wallPanelHTML` / 图标表 `ACT_ICON`/`KIND_ICON`
  / MIME / 日统计 `dayStats`/`statHtml` / 灯箱题注 / 媒体题注）→ esbuild 产 `prototype-render.js`
  挂 `BZR_diary`；插件 `ui.ts` 消费同一份（render-purity 守卫强制纯层）。
- **行为单源**：`fake-sim.ts` 以真 `ui.ts`/`store.ts`/`dialogs.ts`/`entry-actions`/`data.ts`/
  `config.ts` 依赖链为入口 → 产 `prototype-behavior.js` 挂 `BZW_diary`；壳只调
  `bootDiarySim()` + `openPanel()` / `openWrite()`（bz-diary-open / bz-diary-write 同链路）。
- **宿主差异**全部在 `fake/fake-obsidian.ts`：localStorage fake vault（读改写/删/adapter.list
  目录面）、`getResourcePath`+`getFirstLinkpathDest`（媒体 URL：入库子集走 `assets/` 清单，
  其余 http 环境下回退 `/__vault-media/` 现场取流）、
  MarkdownRenderer 纯文本直渲、moment（npm）、Setting/壳类（settings-panel 全域 schema 闭包）。

## 种子数据（真实 vault 快照）

`prototype-data.js` = `node scripts/fetch-diary-data.mjs` 产出（勿手改）：
`我的/日记|影视|信|书库` 的 md **原文逐字**（不做任何解析，真 parser/config 现场解析——
标签/媒体/排序零漂移）；正文 `![[媒体]]` 引用到的媒体**择要**拷入 `assets/`（保持 DIRS
优先序、限总预算），预算外/超单限者不入库但评审仍可见（走 `/__vault-media/` 现场取流，
仅 `file://` 双击直开时退渐变占位）。改 vault 数据后重跑脚本刷新。

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
- 媒体 URL 优先 `assets/` 静态拷贝（离线可用），未入库者走 `/__vault-media/` 现场取流
  （**依赖 `preview-live.mjs` 在跑**）；`file://` 双击直开时后者不可用，退渐变占位。
  视频时长角标（读 metadata）依赖加载，弱环境可能为空。
