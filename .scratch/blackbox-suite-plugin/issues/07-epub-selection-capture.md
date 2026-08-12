# 07 — 书内选区录入：EPUB 阅读器选区工具栏接入概念/摘抄 + 来源双链 + 列表回跳

**What to build:** 在 EPUB 阅读器（weave-epub-reader / fork 构建）的**选区工具栏**（现为高亮/样式/网页搜索/翻译）常驻接入「🧩 概念」「📎 摘抄」两个入口，点击打开黑匣子录入弹窗（文字自动填充锁定）；摘抄与概念均带**来源**——书内选区录入时来源 = 阅读器双链 `[[书路径#weave-cfi=位置|书名]]`；黑匣子主面板列表中，来源可点击：epub 双链 → 阅读器打开书并定位原文位置，`[[笔记]]` → Obsidian 打开笔记，URL → 浏览器打开，其余纯文本不可点。跨仓库契约（ADR-0016）：weave 提供选区按钮与公开跳转 API，bz 实现录入能力与跳转调用，weave 不依赖 bz（bz 缺失时按钮置灰）。

**Blocked by:** 06 — 原位注入（已完成，注入守卫与选区快照复用）；weave 侧 EpubLinkService 双链格式（已存在，复用）

**Status:** ready-for-agent

## Problem Statement

用户（包仔）在 EPUB 阅读器里读书时，看到想留下的文字，目前必须：手动复制 → 切到 Obsidian → 打开黑匣子录入弹窗 → 粘贴 → 手动填来源。选中的文字和它所在的书内位置（CFI）本来就在手边，但黑匣子的 `getSelectionSnapshot` 只能读 Obsidian 编辑器选区，**读不到阅读器 iframe 内的选区**——书内信息链断了。

同时，摘抄的「来源」目前只有 URL 与 `[[笔记]]` 两种形态；从书里摘抄时来源无从附着。用户希望：来源 = 阅读器双链路径（weave 已有成熟格式 `[[书路径#weave-cfi=…|书名]]`，笔记中点击可跳回原文），并且黑匣子列表里点一下就能跳回书里对应位置。概念卡片此前没有来源（数据格式冻结，无 source 字段），用户拍板：概念同样有来源（单值，与摘抄对称），经既有 links 字段承载，笔记中展示在 `- 关联：` 下方。

## Solution

用户视角的完整链路：

1. **阅读器选区工具栏**（选中文字后浮出）新增两个常驻按钮「🧩 概念」「📎 摘抄」，排在翻译按钮之后。未安装/未启用 bz 插件（bz 未提供对应能力）时按钮**置灰不可点**，不隐藏（用户拍板常驻）。
2. 点击「概念」→ 打开黑匣子概念录入（直达流程）：选中文字自动填入概念名并锁定只读；来源 = 阅读器双链（存 links）。点击「摘抄」→ 打开黑匣子摘抄录入（直达流程）：选中文字自动填入摘抄文本并锁定只读；来源 = 阅读器双链（存 source）。
3. 保存后黑匣子笔记落盘：
   - `黑匣子/摘抄/<AI 标题>.md`：正文 `来源：[[书路径#weave-cfi=…|书名]]`（现格式不变，仅新增取值形态）；
   - `黑匣子/概念/<概念名>.md`：关联区在 `- 关联：[[…]]` 下方新增 `来源：[[书路径#weave-cfi=…|书名]]` 行（单值）。
   - epub 不可写：**无原位注入**（不修改书籍文件，与笔记选区录入的注入豁免无关）。
4. **主面板列表**：摘抄卡「📌 来源」、概念卡来源行变为可点击；点击按形态分派——epub 双链 → 阅读器公开 API 打开书并定位原文；`[[笔记]]` → Obsidian 打开笔记；`https://…` → 浏览器打开；其他 → 不可点击。跳转失败（书被移动/删除）→ toast 提示，不静默。
5. 从**笔记选区**录入（现有流程）行为对称：摘抄来源 = `[[来源笔记]]`（现状不变）；概念新增来源 = `[[来源笔记]]`（新，对称）。无选区录入 → 无来源（现状不变）。

## User Stories

1. 作为读者，我想在 EPUB 阅读器中选中文字后看到「概念」「摘抄」按钮，以便不离开阅读器直接录入黑匣子。
2. 作为未安装 bz 插件的用户，我想看到这两个按钮但置灰，以便知道该功能存在且需要安装黑匣子。
3. 作为读者，我想点击「概念」后黑匣子概念录入弹窗直接打开、选中文字自动成为概念名（锁定只读），以便只确认 AI 生成的定义即可保存。
4. 作为读者，我想点击「摘抄」后黑匣子摘抄录入弹窗直接打开、选中文字自动成为摘抄文本（锁定只读）、来源自动填好，以便保存即完成摘抄。
5. 作为读者，我想摘抄的来源自动是阅读器双链（`[[书路径#位置|书名]]`），以便来源可点击跳回书内原文。
6. 作为读者，我想概念卡片也有来源（与摘抄对称），以便概念也能追到出处。
7. 作为黑匣子列表用户，我想点击摘抄卡上的来源图标直接跳到书里对应原文位置，以便快速回看上下文。
8. 作为黑匣子列表用户，我想点击概念卡上的来源图标跳到书里对应原文位置，以便回看概念出自哪一段。
9. 作为有历史数据的用户（来源是 URL），我想点击来源用浏览器打开，以便 URL 形态同样可跳。
10. 作为有历史数据的用户（来源是 `[[笔记]]`），我想点击来源在 Obsidian 中打开该笔记，以便笔记形态同样可跳。
11. 作为用户，我想无法识别的来源保持纯文本不可点，以便不产生误跳转。
12. 作为用户，我想书被移动/删除后点击来源得到明确提示，以便知道链接失效而不是静默无反应。
13. 作为用户，我想在 Obsidian 里手动编辑概念笔记的 `来源：` 行后不被下一次刷新覆盖，以便手改内容与插件解析往返无损。
14. 作为用户，我想从笔记选区录入概念时来源自动是 `[[来源笔记]]`，以便与摘抄行为对称。
15. 作为读者，我想从书里录入时书籍文件不被改动，以便原位注入只作用于笔记（epub 不可写）。
16. 作为移动端读者，我想选区工具栏在移动端 docked 形态下同样能看到这两个按钮，以便手机上也能书内录入。
17. 作为用户，我想点击来源跳转时书在已有阅读器叶子中打开（不无限开新标签），以便阅读体验连续。

## Implementation Decisions

### 跨仓库契约（bz ↔ weave 阅读器，ADR-0016）

- **方向**：weave 是提供方（选区按钮 + 公开跳转 API），bz 是消费方（实现录入能力 + 调用跳转）。weave **不依赖** bz——bz 缺失时按钮置灰而非隐藏，置灰不阻断其他按钮。
- **契约机制**：复用既有 reader→host 契约模式（`EpubHostCapabilities` 可选 key 集合）。**新增两个 capability key**（如 `captureConceptFromEpub?` / `captureExcerptFromEpub?`），**不挪用**现有 `openCreateCardModal` / `openIRReadingPointFromExternalSelection`（语义不同：现有 key 属主 weave 插件的卡片/阅读点系统，挪用会与主 weave 共存时产生 host 合并抢占——`composeEpubHost` 按 key 第一个 host 优先）。
- **能力输入**（两个 key 共用形状）：`{ filePath: string; selectedText: string; sourceLink: string }`——sourceLink 由阅读器侧现成的 `buildReadingPointSourceLink(text, cfiRange)` 构造（复用，不新增格式）。
- **公开跳转 API**（weave 侧新增，插件公开方法，供 bz 跨插件调用）：接收完整双链（如 `[[书架/三体.epub#weave-cfi=…|三体]]`），内部解析 `path#locator|alias` → 校验 epub 路径 → 复用现有 `navigateToEpubLocation` / NavigationHub 定位跳转（`policy: { reuseLeaf, preferredLeaf, focus }`）。返回成功与否（布尔或 result 对象），供 bz 决定 toast。bz 侧**不复刻** subpath 解析（`weave-cfi=` / compact 两种定位符格式归 weave 一处解析，避免双份实现漂移）。
- **bz 定位阅读器插件**：`app.plugins.getPlugin(id)` 遍历候选 id（`weave-epub-reader` 及 fork 构建 id），按公开方法形状探测；找不到 → 按钮不可达（weave 侧置灰由能力探测负责，bz 侧跳转失败 toast）。

### 数据层（bz，冻结格式扩展）

- **概念来源**：不加新字段（ADR-0013 冻结）。存既有 `links` 数组（语义「URL 或 [[笔记]]」天然匹配 epub 双链），**单值约定**（取数组第一项为「来源」，与摘抄 source 单值对称；其余 links 仍按原语义展示）。
- **摘抄来源**：沿用 `source` 字段，取值形态新增「epub 双链」第三种（URL / `[[笔记]]` / epub 双链）。旧数据零迁移。
- **笔记格式**（ADR-0015 冻结格式的**显式扩展**，需同步 ADR-0016）：概念笔记关联区在 `- 关联：` 行下方新增 `来源：` 行（单值；无来源不输出行）。`buildNoteContent` 与 `parseNoteContent` **成对修改**保证 round-trip 无损：解析时 concept 分支把正文 `来源：` 行并入 links（frontmatter links 为准、正文合并去重——沿用现有 related/terms 的合并策略）；不解析的话手改的 `来源：` 行会在笔记重写时消失（现解析器会把该行剥离而不回写，是必须修对的坑）。

### 录入（bz capture.ts）

- **外部选区路径**：capture 入口接受可选参数 `{ selectedText, sourceLink }`（host 调用传入），`applySelectionFill` 优先级：外部选区 > 编辑器选区快照（两者互斥，书内录入时编辑器快照为 null）。概念名/摘抄文本由外部选区锁定只读；摘抄来源 = sourceLink；概念来源 = sourceLink 写入 links 单值。
- **注入**：原位注入（injectIntoSourceNote）依赖 SelectionSnapshot（编辑器），书内录入时恒 null → 自然跳过，**不改注入逻辑**。

### 列表跳转（bz panel.ts）

- 新增**来源分派纯函数**（新模块，如 `src/blackbox/source-jump.ts`）：输入 source 文本 → 输出动作判定：`[[` 开头且路径以阅读格式扩展名结尾（.epub/.mobi/.azw3/.fb2/.fbz/.cbz/.txt）→ epub 跳转；`[[` 开头 → 笔记跳转（`app.workspace.openLinkText`）；`http(s)://` → 浏览器打开（`window.open`）；其他 → 不可点。
- 摘抄卡「📌 来源」与概念卡来源行渲染为可点击元素（样式沿用现有 chip/链接风格，不破坏 DOM id 约定）；点击 epub 双链 → 调阅读器公开 API，失败 → toast「未能定位原文位置」。
- 概念卡来源展示：从 links 单值取；摘抄卡维持现状（source 直接展示）。

### 阅读器侧（weave 仓库）

- `SelectionToolbar.svelte`：actions 行新增「🧩 概念」「📎 摘抄」两按钮（i18n key 双语 + overlay 同步流程）；点击 → 事件上抛（沿用 `onInsertToNote` 回调模式，新增 `onCaptureToBlackBox` 或等价回调），由宿主组件（EpubReaderApp）构造 `{filePath, selectedText, sourceLink}` 并调 host 能力。
- 置灰逻辑：宿主组件探测 bz 能力（`getEpubActionHost()` 新 key 存在性）→ 以 prop 传给工具栏；缺失时按钮 `disabled` + tooltip「未安装黑匣子插件」（i18n）。
- 公开跳转 API：插件公开方法 + 服务层实现（复用 `EpubLinkService.navigateToEpubLocation` 与现有双链解析）；**不新增 obsidian:// 协议处理器**（桌面内跳转走插件方法调用即可，协议留作未来外部入口）。

## Testing Decisions

好测试 = 只测外部行为（纯函数输入输出、DOM 交互结果、契约调用形状），不测内部实现细节；两仓库各自按既有测试体系落。

| Seam | 模块 | 测什么 | 先例 |
|---|---|---|---|
| S1 笔记引擎 round-trip | bz `notes.ts` 纯函数 | 概念来源：build 输出 `来源：` 行于 `- 关联：` 下方 → parse 并入 links；手改正文 `来源：` 行 → 解析保留；frontmatter links 为准、正文合并去重；无来源不输出行；摘抄 epub 双链来源 build/parse 往返 | `tests/blackbox/data.test.ts`、`inject.test.ts` |
| S2 来源分派 | bz `source-jump.ts` 纯函数 | 四形态判定：epub 双链（含 `#weave-cfi=` 与 compact 定位符、各阅读格式扩展名）、`[[笔记]]`、URL、纯文本不可点；边界（大小写扩展名、带 alias、链接含锚点） | `tests/blackbox/panel.test.ts` 纯函数风格 |
| S3 capture 外部选区 | bz `capture.ts` + `inject.ts` | 外部参数 `{selectedText, sourceLink}` 直达概念/摘抄：文本锁定填充、概念来源=links 单值、摘抄来源=sourceLink；保存后笔记含来源；编辑器快照为 null 时注入跳过；无外部参数时行为与现状一致 | `tests/blackbox/capture.test.ts` |
| S4 公开跳转 API | weave 公开方法 + 服务层 | 合法双链 → NavigationHub 收到 book+locate 意图；路径缺书/非 epub/坏链接 → 失败返回；compact 与 `weave-cfi=` 两种定位符；reuseLeaf 策略生效 | weave `EpubLinkService.test.ts`、`NavigationHub.test.ts` |
| S5 工具栏按钮 + 置灰 | weave `SelectionToolbar.svelte` + 宿主接线 | 能力缺失 → 两按钮 disabled（其余按钮不受影响）；能力存在 → 点击触发宿主回调且参数含 text/sourceLink；i18n 文案存在 | weave `epub-host.test.ts`（探测）、`components/ui/FloatingMenu.test.ts`（组件） |

**旧数据回归**：既有 URL / `[[笔记]]` 来源的摘抄渲染不崩、跳转可用（S2 覆盖）。

## Out of Scope

- **想法（thought）** 的书内选区录入：工具栏只有「概念」「摘抄」，想法仍走命令弹窗（用户拍板，可后续追加）。
- **书内选区 → 原位注入**：epub 不可写，无注入语义。
- **weave 主插件共存**时的 host 合并治理：新 key 天然隔离（主 weave 无此 key），共存场景不测。
- **移动端工具栏专属布局**：按钮沿用现有 actions 行样式随工具栏整体适配，不做专属设计（仅回归确认可见）。
- **黑匣子笔记中的 epub 双链在 Obsidian 阅读视图点击跳转**：weave 的 markdown post-processor 已天然支持（既有能力），不在本次实现范围。
- **obsidian:// 协议深链**：本次只做插件方法调用跳转。

## Further Notes

- 术语（已同步 CONTEXT.md 黑匣子域）：**书内来源 (In-book Source)**——书内选区录入时摘抄/概念的来源，形态为阅读器双链；与「来源笔记」并列，无选区 → 无来源。概念来源单值约定、笔记 `来源：` 行位置（`- 关联：` 下方）为领域语义，实现时不得漂移。
- ADR-0015 冻结笔记格式的扩展（概念 `来源：` 行）与跨仓库契约（新 capability key + 公开跳转 API）需落 **ADR-0016**（本票实现前先写 ADR，Context/Options/Consequences 含：新 key vs 挪用现有 key 的取舍、置灰 vs 隐藏、links 复用 vs 新字段、bz 复刻解析 vs weave 公开 API）。
- 本票落地后更新 `spec.md`（黑匣子域主 spec）的「领域模型/命令清单」节与 `PROGRESS.md`。
