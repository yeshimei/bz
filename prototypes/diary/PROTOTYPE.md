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
| **总入口** | `index.html` | **日记本原型主页**：五方向概念稿 + 现状/皮肤/说明等全部入口一处归档 |
| **变体对比** | `prototype-skins.html` | **四版皮肤并排/切换评审（现状 + A 暖忆 + B 留白 + C 暗房）+ 明暗** |
| **方向探索** | `concepts/index.html` | **五方向结构级概念稿**（长卷 / 对谈室 / 年历图谱 / 镜头 / 四柜）——见下节 |

## 评审变体（视觉探索，只覆盖视觉层）

`prototype-skins.html` = 变体对比外景壳（标签页切换 + 明暗 + 并排四版）。皮肤只挂
一条 `<link>`，**markup（`render.ts`）/行为（`ui.ts`）零改动**，单源不破：

| 皮肤 | 文件 | 设计意图 |
|---|---|---|
| 现状 | （不挂） | `src/diary/styles.css` 原样 |
| A 暖忆 | `skins/warm.css` | 暖纸底（强调色低比例暖化替代冷灰）· 衬线标题与日期 · chips 收成单行幽灵筛选条 · 卡片 14px 圆角 + 暖调双层投影 |
| B 留白 | `skins/quiet.css` | 去盒子（无填充无边框，靠留白 + 发丝线分区）· 30px 轻字重日期 · chips 退成下划线文字筛选 · 媒体 16px 圆角 + 长柔投影 |
| C 暗房 | `skins/darkroom.css` | 刻意独立于宿主明暗的沉浸暗色（`--bz-*` 全套同转暗）· 媒体优先 + 常显渐变题注 · 章节栏胶片齿孔时间线 · 文字条目改左强调竖线便签卡 |

挂载口径：内景壳 `prototype-view.html?skin=<名>` 在域样式之后插 `skins/<名>.css`，
并给 `<body>` 挂 `skin-<名>` 类；皮肤选择器一律以 `body.skin-<名>` 兜底，
特异性 (0,2,x) 稳赢域样式，且不污染插件本体。**折叠口径**：定稿后把选中皮肤的规则
并入 `src/diary/styles.css` 即成正式实现（无需改 markup/行为）。

已知取舍：暗房刻意强制暗色（沉浸模式），A/B 仍跟随宿主 `?theme=`。

## 方向探索（概念稿，结构级重做）

`concepts/index.html` = 五方向入口。与上节「皮肤」不同，这批换的是**范式**——信息架构、
交互模型、版式语言各自独立，五个之间不构成变体关系：

| # | 方向 | 范式 | 立论 |
|---|---|---|---|
| 01 | 长卷 | 单列连续时间轴，年份为巨大章节页，右侧年尺导航 | 日记第一性是「时间连续」，不是一格格卡片 |
| 02 | 对谈室 | 左会话列表 + 右气泡线程 + 底输入条 | **数据真相：最大类是「对谈」208 条占 43%** |
| 03 | 年历图谱 | 一屏十年热力年历（色深=条数，角标=媒体）+ 统计侧栏 | 另一种用法不是「读」，是「看自己怎么活的」 |
| 04 | 镜头 | 无列表，全屏一次一条；那年今天/随机漫游/只看媒体 + 胶片条 | 第三种用法是「偶遇」——让过去的自己找上门 |
| 05 | 四柜 | 四种内容四柜，各柜自带版式与材质（暖纸页流/暗色海报墙/米色封面架/信笺） | 四种性质不同的东西，一种版式通吃=抹掉各自读法 |

数据同源：`concept-data.ts`（→ `concepts/concept-data.js`，由 `scripts/build-diary-concepts.mjs`
打包）用与 `fake-sim.ts` 完全相同的启动注入（FakeApp + 真 config/data 链），出口改为
`window.BZ_CONCEPT.boot()` 交出聚合条目模型——解析/排序/媒体 URL 全走 `src/diary/` 真实现，
零复制。概念稿换版式必然不可能沿用 `render.ts`/`ui.ts`，故这批**不复用行为单源**，
但**数据仍单源**。

> **本轮结论：五个方向一个都不采纳**（2026-09-10 评审）。概念稿留档备查，
> `src/diary/` 的 markup / 行为 / 样式一行未改。

两个已注释的坑：语义别名必须声明在 `body`（非 `:root`）——宿主 token 挂 `body.theme-*`，
在 `:root` 求值会整条 `var()` 失效；假层对清单内媒体返回 `./assets/` 相对路径，
概念稿在子目录须上跳一层（`concept-ui.js` 已处理）。

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
