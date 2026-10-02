# ADR-0230 · 日记本换「桌上那本」书页 UI：整域 UI 替换、内嵌 StPageFlip、不带外链字体

日期：2026-10-02 · 状态：已采纳 · 关联：ADR-0115（回忆墙升格正名）、ADR-0104（渲染纯层）、
ADR-0106（样式/渲染/行为三层单源原型）、ADR-0020（样式按域拆分）、ADR-0122（界面级单源）、
ADR-0199（皮肤包）、issue 538

## 背景

日记本（diary）域当前的 UI 是「回忆墙」（ADR-0115 升格正名）：头行 + chips + 章节栏 + 瀑布流 + 灯箱。
2026-10-02 在 `.scratch/diary-quill/`（v43：`index.html` 145 + `app.js` 1882 + `style.css` 968）做了一版
**自由拟物探索稿**——「桌上那本」：一本书落在台灯下的桌面上，翻页即翻日记，所有功能都是桌上实物
（书口抽册页索引 / 台历跳日 / 放大镜检索 / 铅笔写 / 贴纸册分类 / 火漆信封加密 / 撕页删除 / 相纸显影灯箱 /
那年今天明信片 / 票根·信笺·藏书票）。该稿不接单源、不参与门禁，其 README 既定口径是
「拍板后若上岸，按 `src/diary` 单源口径**重写**，勿回灌」。

用户拍板：**实现到单源，单源所有 UI 全部废弃，全部采纳原型中的。**

把探索稿搬进单源，暴露了四处不入代码看不出来的落差：

1. **字体是外链的。** 原型观感的一半靠四个 webfont（Ma Shan Zheng / Long Cang / Zhi Mang Xing /
   霞鹜文楷屏幕版），`index.html` 里走 Google Fonts + jsdelivr。插件不能依赖 CDN；CJK 字体又无法
   子集化（正文是动态的），全量打包十几 MB 起。
2. **翻页引擎是 vendored 的第三方。** 原型翻页动画（纸张弯曲 / 拖拽 / 页角提示）全部由
   StPageFlip v2.0.7 渲染；仓库当时的那份是**无 license 头的压缩 UMD**。经核实上游为
   `page-flip`（Nodlik），**MIT、零依赖**。
3. **样式聚合是固定清单。** `scripts/build-css.mjs` 的 `SOURCES` 是显式数组、只做文件拼接
   （**不认 `@import`**）——vendored 库的 CSS 必须登记进去才会进产物。
4. **数据层已经把影视/书库压平了。** `src/diary/parser.ts` 把影评 + `![[海报]]` 拼进 `content`、
   把「`**《书名》**` + 书评 + `![[cover]]`」拼进 `content`；导演/类型/片长/年代/评分/作者/分类
   这些 FM 字段**解析时就被丢弃**。原型的票根（`meta`）与藏书票（`author`/`category`）要显示它们。

另有一处**有利**的发现：`prototypes/diary/fake-sim.ts` 在评审壳里跑的不是复刻件，而是真
`openDiary` → 真 `controller.show()`（FakeApp + 快照种子）。所以「域 UI 的唯一真理源是与评审壳
共用的实现源码、两侧不一致 = 缺陷」（AGENTS.md）在本次改造里**由构造保证**，不需要人工同步两份。

## 决策

1. **整域替换，且是重写不是搬运。** `src/diary/ui.ts`（3053 行回忆墙）+ `src/diary/styles.css`
   （1758 行）整体作废，按原型的新形态重写；**不保留回忆墙、不做双视图开关**。数据层
   （`data.ts`/`store.ts`/`encrypt.ts`/`config.ts`）不动，只换 UI 与样式。
   `index.ts` 对 `main.ts` 的契约（`ensureDiary`/`openDiary`/`openDiaryWrite`/`prewarmDiary`/
   `unloadDiary`）与 `DiaryAppController` 的对外面（`getInstance`/`show`/`hide`/`cleanup`/
   `getYearRange`）保持不变——命令 ID `bz-diary-open` / `bz-diary-write`、懒加载口径
   （ADR-0003）、启动预热口径都不动。

2. **三层结构照旧，`render.ts` 仍是 markup 纯层。** 书桌 DOM 骨架与全部纯渲染函数
   （`seal` / `ticket` / `exlibris` / `para` / `entryBlocks` / `daystamp` / `photo`）落 `render.ts`，
   受 render-purity 守卫约束（不 import obsidian/moment/core 服务，类型取自 `./types`）；
   行为（分页测量、StPageFlip 建书与翻页、文具五项、台历/贴纸册/检索/信封/撕页/灯箱/便签菜单、
   懒加载与 markdown）留 `ui.ts`。

3. **不带任何字体。** 不打包、不挂 CDN、不加「字体名」设置项。`font-family` 回归宿主
   （`inherit` 与 Obsidian 主题变量）。**观感从「手写」转向「印刷」，这是明确接受的代价**——
   换来的是一条零体积、离线可用、不向外部发起请求的路径。
   （原型里那条「不靠外链字体就立不住」的观感假设，就此作废；后续若想要手写感，
   属于新决策，须另开 ADR。）

4. **内嵌 StPageFlip v2.0.7**（`page-flip`，Nodlik，**MIT**，零依赖，压缩后 44KB）。
   位置随 `src/core/vendor/` 先例（与 `normalize.css` 同级），文件头保留上游署名、
   另附 MIT 原文；补 `.d.ts` 声明（上游 UMD 无类型随文件走）。
   实现方式上，UMD 的首分支就是 CommonJS（`typeof exports === 'object'`），
   在 esbuild 的 CJS 包装下 `require`/`import` 可直接拿到 `{ PageFlip, HTMLPage }`，
   不需要改库源码、也不需要挂 `window`。
   其 `stPageFlip.css` 登记进 `scripts/build-css.mjs` 的 `SOURCES`（紧邻 normalize.css 之后），
   与「唯一例外：远端皮肤包只在 `src/core/skin-pack.ts` 单一注入点」（ADR-0199）不冲突——
   本项是**构建期内联**，不涉及运行时注入。

5. **数据层只做两处加性扩展。** ① `DiaryEntry`/`WallEntry` 增设可选字段承载影视/书库的
   FM 余项（`导演`/`类型`/`片长`/`年代`/`评分`/`作者`/`分类`），`parser.ts` 填充、
   `toWallEntry` 透传。不改既有字段语义、不改解析结果里已经压平的 `content`——
   加性变更，存量测试的断言面不动。
   ② `parseEntryFile` 补 `id`（`makeEntryId('diary', …)`，与影视/信/书同口径）。
   原型是拿 `data-eid` 定位条目的，而单源里**只有**影视/信/书有 id、日记条目一直是 `undefined`——
   全册日记塌成同一个 `data-eid=""`，便签菜单（`!menuEid` 早退）、撕页的碎纸动画、
   明信片「展信」跳页都会落到最后一篇日记上。这是移植时才会暴露的落差，属加性补齐。

6. **域内选择器全部命名空间化。** 原型的裸 id（`#book` / `#desk` / `#tools` / `#menu` /
   `#sheet` / `#slip` / `#album-pop` / `#cal-pop` / `#lightbox` / `#toast` / `#hint`）在插件内会与
   宿主及其他域撞（多个域共用同一个 `document`），一律加 `bz-diary-` 前缀；样式选择器同步。

7. **回忆墙测试整体退役，覆盖面由新测试重建。** 删除 `tests/diary/ui.test.ts`(1700) /
   `wall-fix-c.test.ts`(571) / `wall-event-contract.test.ts`(275) / `ui-logic.test.ts`(51)；
   新写「桌上那本」的 UI 测试（分页测量与块高度、块类型映射、命名空间守卫、翻页与文具动作契约、
   灯箱/信封/撕页）。`data` / `parser` / `store` / `encrypt` / `thumb-cache` 等非 UI 测试保留。

8. **两处「偏离仓库惯例」是刻意的，一并记录在案。** 书页界面不是面板，凡「按面板写的口径」
   在这里都不适用，涉及两条现役惯例：
   ① **域根不再是任何面板帧**：原 `.bz-diary-mob bz-panel-mtop`（回忆墙挂 core 面板壳、吃移动
   全屏顶距）随墙退役，改 `.bz-diary-scene`（`position:fixed; inset:0` 的拟物桌面），与 cinema
   的整屏布局域同档。挂 `bz-panel-mtop` 只会得到一份无用的顶距垫，故明确不挂——`enh-sweep-c`
   的断言随之改成「不得回潮」（`not.toContain('bz-panel-mtop')`）。
   ② **拟物浮层不掺 token 遮罩**：纸条 / 贴纸册 / 台历 / 抽出的纸这四层的压暗底是**材料**
   （`rgba(20,12,5,…)`），不是「遮罩」——它们压的是域根那块固定深色桌面，而不是宿主内容，
   「底色随主题自适应」在这儿没有可观察差别。故既不挂 `.bz-overlay-mask`、也不带
   `backdrop-filter`，与决策里「不改调色板」同源（材料 ≠ 主题表面）。`overlay-glass` 的
   diary 组断言据此改写为「保留域内拟物压暗底 + 不得掺 `--bz-overlay` / `backdrop-filter`」，
   防「只抄底不抄 blur」的中间态。**除这四层外，本域不再有任何手绘遮罩。**

## 后果

- **一次性可见的回归面很大**：单源 diary 域 UI 从「墙」变「书」，1758 行样式与 3053 行控制器整体换代；
  约 2597 行测试在同一轮删掉，**覆盖率在新测试写完前会掉**（这是第 7 条决策的已知代价，
  不是意外；故门禁要求测试与实现同批交付，不留「先删后补」的中间态）。
- **观感差异可预期且已知**：没有手写体后，标题/日戳等原依赖毛笔字的层级需要靠字号、字重、
  字距与留白重建（决策 3 的代价由这条承接）。
- **多一个第三方进产物**：`main.js` 增约 44KB（压缩前）；发布侧需在 README/许可说明里
  体现 StPageFlip 的 MIT 署名。
- **评审壳零额外工作**：`build-preview.mjs` 的 `PREVIEW_DOMAINS` / `BEHAVIOR_DOMAINS` 两份清单
  都含 `diary`，重写后 `prototype-render.js` 与 `prototype-behavior.js` 自动重出，
  人工同步两份 UI 的风险归零。
- 若日后要恢复手写体观感、或要换掉 StPageFlip，都属**新决策**：前者（字体）与后者（引擎）
  在本 ADR 里是明确被排除的选项，不是悬置项。
