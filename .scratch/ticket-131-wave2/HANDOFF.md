# ticket 131 Wave-2 交接文档（新会话专用）

> 本会话（grill-with-docs 定案 → Wave-1 实施完成）因代理运行时资源耗尽，无法继续派子代理。
> **新会话从这里接手**：master 基线全绿，三个 worktree 与依赖已就绪，按下方「接手步骤」直接并发三组。

## 当前状态（已确认）

- **设计定案**：`issues/131-settings-row-builder.md`（定稿）、`docs/adr/0064-declarative-settings-schema.md`；CONTEXT.md 四词条；spec.md/PROGRESS.md 已同步。
- **Wave-1 完成并合并 master**（`1f76ef7`，全量 206 文件 / 3284 用例绿 + tsc 0）：
  - `src/core/settings-schema.ts`（十类行 + `renderSettingsInto` 渲染器：键直绑/外部绑定/800ms 防抖+blur+Enter/onCommit 一次性提示/visibleWhen 联动+徽标+两行式收口/path 接选择器/actionRow 豁免/custom 插槽）
  - `src/core/settings-common.ts`（`mobileFullscreenGroup(key, {desc?})` 预设）
  - `src/core/settings-main-schema.ts`（主设置页两区块）+ `src/main.ts` display() schema 化，旧 helper 退役
  - `src/core/settings-modal.ts`：schema 入口；**build 参数 @deprecated 过渡保留**，全部域迁移完由主会话收尾删除
  - `src/core/flow-dialog.ts`：openFlowDialog 承继 confirm 的 `__shared_confirm_*` DOM 契约，confirm 退役、23 处调用点已改写
  - `tests/core/settings-copy-lint-engine.ts`（引擎，可复用）+ `settings-copy-lint.test.ts`（主设置页组）；`.bz-tab-*` 死类已清
- **三个 Wave-2 worktree 已建好、依赖已装、从 1f76ef7 分叉**：
  - `D:\Obsidian\.dsh-worktrees\t131-domains-a`（分支 `worktree/t131-domains-a`）
  - `D:\Obsidian\.dsh-worktrees\t131-domains-b`（分支 `worktree/t131-domains-b`）
  - `D:\Obsidian\.dsh-worktrees\t131-domains-c`（分支 `worktree/t131-domains-c`）
- 主仓库 `D:\Obsidian\bz` 工作区干净，master 无未提交改动。

## 接手步骤（新会话照做）

1. 对齐基线：`git -C D:\Obsidian\bz fetch origin` + `git pull --ff-only origin master`（本地领先可跳过），确认 master = 1f76ef7 之后。
2. 并行派 **3 个子代理**（互不相交，可同时跑）：
   - 代理 A → `D:\Obsidian\.dsh-worktrees\t131-domains-a`：diary / memo / belongings / password 设置弹窗 schema 化
   - 代理 B → `D:\Obsidian\.dsh-worktrees\t131-domains-b`：clipping（含数据源组与 UP 名单管理弹窗）/ favorites / library
   - 代理 C → `D:\Obsidian\.dsh-worktrees\t131-domains-c`：movie / review / pomodoro / encrypt / secondbrain / smartcat
   - 三份任务 prompt 见下方附录（可直接原样发给子代理）。
3. 每组完成 → 合并：`git merge worktree/t131-domains-<x>`（先确认该组测试全绿），每步全量测试。
4. 收尾（全组合并后）：删除 `settings-modal.ts` 的 @deprecated build 参数与残留 build 调用方；`pnpm run build` 部署（产物直出 E 盘）；更新 issues/131 状态与 PROGRESS.md；清理三个 worktree（`git worktree remove` + `git branch -d`）。
5. 完成门禁：全量测试 + tsc + 构建 + **Review**（用户要求：全部完成合并后 review——diff 审查子代理 + 自审）。

## 关键约束（写进每个子代理 prompt）

- 只在自家 worktree 工作；禁止改主仓库、其他 worktree、E:\；禁 build、禁 push、禁 merge。
- **禁止修改** `src/core/settings-schema.ts` / `settings-common.ts` / `settings-modal.ts` / `settings-main-schema.ts` / `tests/core/settings-copy-lint.test.ts` / `tests/core/settings-copy-lint-engine.ts`（并行共享文件；渲染器能力不足用 custom 插槽兜底，缺口报主会话）。
- 行为零变化（铁律 1/3）：键、数据格式、DOM id/类名、通知文案全保持；ticket 100 文案修正例外（标题可改、描述可改自然句，键名/行为/通知文案不动）。
- 域内 confirm 已全库 flow-dialog 化，不要动那些行。
- 组 = `{ icon, name, rows }`，icon 照抄现状；组序/行序/maxWidth/空态保持（favorites/belongings 例外：按拍板统一分组卡片 + maxWidth 520）。
- 「移动端默认全屏」手写块 → `mobileFullscreenGroup(key [, { desc }])`，文案差异用 desc **逐字对齐现状**（belongings/favorites、review、smartcat、secondbrain）。
- 文案 lint：各组新建 `tests/core/settings-copy-lint-<a|b|c>.test.ts`（`// @vitest-environment node`），import `lintTargets` from `./settings-copy-lint-engine`，注册本组域 schema 断言零违规；违规按 ticket 100 修正，无法整改的局部白名单并注明理由。**禁止改公共 lint 文件**。
- 门禁：`BZ_TEST_MAX_WORKERS=8 pnpm test` 全绿 + `pnpm exec tsc --noEmit` 0 错；Conventional Commits 附 ticket 131；提交到自家分支。

---

## 附录：三份子代理任务 prompt（可直接复制）

### 代理 A（域组 A：diary/memo/belongings/password）

```
你是「包仔（bz）」Obsidian 插件仓库的实施工程师，负责 ticket 131 Wave-2 域组 A：把 4 个域的 ⚙️ 设置弹窗从手写 build 迁移到声明式 schema。用中文工作与报告。

## 工作目录（铁律）
只在 git worktree D:\Obsidian\.dsh-worktrees\t131-domains-a（分支 worktree/t131-domains-a）内工作与提交。禁止读写 D:\Obsidian\bz 主仓库、其他 worktree、E:\；禁止 pnpm run build；禁止 push、merge。禁止修改 src/core/settings-schema.ts、settings-common.ts、settings-modal.ts、settings-main-schema.ts、tests/core/settings-copy-lint.test.ts、tests/core/settings-copy-lint-engine.ts（并行组共享文件；渲染器能力不足时用 custom 插槽兜底，缺口写进报告，主会话统一评估）。

## 你负责的域
1. diary（src/diary/ui/panel.ts 约 299-317 行设置 build；模块级 dropdownSetting/textSetting/toggleSetting 三件套退役）：组结构照现状；「维护」组「检测日记解析」button 行保留（repair-modal 本身不在范围）。
2. memo（src/memo/ui.ts 设置段，约 9 项：提醒组/显示组/新建组/场景列表）：场景列表逗号分隔 text 行保持。
3. belongings（src/belongings/ui.ts 约 1157 行附近）：空态域（emptyText/emptyDesc 保留）+ 从平铺改为分组卡片（拍板 Q11）+ maxWidth 从默认 400 改 520；「移动端默认全屏」文案与多数派不同，用 mobileFullscreenGroup(key, { desc }) 覆盖逐字对齐现状。
4. password（src/password/ui.ts 约 212-266 行）：warnReload 一次性提示改 onCommit（文案逐字保留）；其余行逐一等价迁移。

## 先读（按序）
AGENTS.md → issues/131-settings-row-builder.md → docs/adr/0064-declarative-settings-schema.md → src/core/settings-schema.ts（API 真源，读透）→ src/core/settings-common.ts → src/core/settings-main-schema.ts + src/main.ts 的 display()（已迁移样板）→ tests/core/settings-schema-ui.test.ts（渲染行为基准）→ 各域 build 现状（先抄现状再声明化）。

## API 速览（已合入你的基线，Wave-1 交付）
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
openSettingsModal({ title, maxWidth, emptyText?, emptyDesc?, schema: { groups: [
  { icon, name, rows: [
    { type: 'path', mode: 'single', name, desc, binding: { key }, onCommit },
    { type: 'toggle', name, binding: { key }, onChange },
    { type: 'select', name, binding: { key }, options: [{ value, label }] },
    { type: 'number', name, binding: { key }, min, max, step },
    { type: 'button', name, buttonText, onClick },   // actionRow 豁免徽标
    { type: 'custom', visibleWhen, render: (body, ctx) => {} },
  ]},
  mobileFullscreenGroup('diaryMobileDefaultFullscreen'),
]}});
渲染器已内置：text 800ms 防抖 + blur/Enter + onCommit 一次性提示（warnedInitial 语义）、toggle 即时落盘、number 钳制、visibleWhen 联动（显隐 + 组徽标 + 两行式一并收口）、path 接 ADR-0061 选择器、actionRow 豁免。

## 通用迁移规则
- openSettingsModal({ title, maxWidth, emptyText?, emptyDesc?, schema })；迁移后该域不得残留 build 用法。
- 组 = { icon, name, rows }（icon 照抄现 createSettingsGroup 调用）；组序/行序/maxWidth/空态保持现状（belongings 例外见上）。
- 行语义逐一等价：data.json 键用 binding { key }；域内防抖/blur/Enter/warnReload 手写块全删（渲染器已收口，onCommit 文案逐字保留）；副作用挂 onChange。
- 动态显隐改 visibleWhen；手写 addListener/display 切换与手动 refreshSettingsGroupCounts 全删。
- 「移动端默认全屏」手写块 → mobileFullscreenGroup(key)；文案差异用 { desc } 覆盖逐字对齐（先抄现状）。
- 非常规内容 type:'custom' 插槽；纯操作行 type:'button'；说明行 type:'info'。
- 行为零变化（铁律 1/3）：键、数据格式、DOM id/类名、通知文案全保持；ticket 100 lint 修正例外（标题可改、描述可改自然句，键名/行为/通知文案不动）。
- 域内 confirm 调用已全库改写为 openFlowDialog（Wave-1 已在你的基线）——不要动那些行。
- UI 测试：每域现有设置弹窗测试断言适配 schema 渲染产物（分组/关键行文案/显隐行为），不得删用例逃避；补充移动端组与关键 visibleWhen 覆盖。

## 文案 lint 注册（不碰公共文件）
新建 tests/core/settings-copy-lint-a.test.ts（首行 // @vitest-environment node）：import 引擎 lintTargets（./settings-copy-lint-engine）与本组四个域的 schema 工厂，构造 targets（source 用 'diary'/'memo'/'belongings'/'password'），断言零违规；存量违规按 ticket 100 修正，无法整改的在本文件局部白名单豁免并注明理由。

## 门禁与提交
- BZ_TEST_MAX_WORKERS=8 pnpm test 全绿 + pnpm exec tsc --noEmit 0 错。
- 提交到当前分支（Conventional Commits，附 ticket 131）；不合并、不 push。
- 报告：逐域完成表（组数/行数/custom/visibleWhen 统计）、文案修正清单、测试改写清单、渲染器缺口（若有）、门禁数字、提交 hash。
```

### 代理 B（域组 B：clipping+UP/favorites/library）

```
你是「包仔（bz）」Obsidian 插件仓库的实施工程师，负责 ticket 131 Wave-2 域组 B：把 3 个域的 ⚙️ 设置弹窗 + UP 名单管理弹窗迁移到声明式 schema。用中文工作与报告。

## 工作目录（铁律）
只在 git worktree D:\Obsidian\.dsh-worktrees\t131-domains-b（分支 worktree/t131-domains-b）内工作与提交。禁止读写 D:\Obsidian\bz 主仓库、其他 worktree、E:\；禁止 pnpm run build；禁止 push、merge。禁止修改 src/core/settings-schema.ts、settings-common.ts、settings-modal.ts、settings-main-schema.ts、tests/core/settings-copy-lint.test.ts、tests/core/settings-copy-lint-engine.ts（并行组共享文件；渲染器能力不足时用 custom 插槽兜底，缺口写进报告，主会话统一评估）。

## 你负责的域
1. clipping（src/clipping/view.ts 约 200-308 行设置 build + src/clipping/news-sources-group.ts 358 行）：
   - 设置弹窗含「数据源」组与自动摘要详设（开关展开长度档位/标签/时机）。
   - 「数据源」组：news.json 是外部数据（非 data.json），三源开关/保留天数/B站抓取条数优先用 binding: { get, set, save } 声明化；注意渲染器 visibleWhen 的 snapshot 只覆盖 data.json 键——news.json 驱动的段内联动（B 站开关关→UP 名单段隐藏、news.json 缺失安装引导、异步状态行）允许整段用 type:'custom' 插槽保留现有内部逻辑，但组壳（createSettingsGroup 卡片形态）保持。
   - UP 名单管理弹窗（openUpManagerModal）：内容 schema 化，用 renderSettingsInto(容器, schema) 渲染进现有自建 overlay——bz-up-manager-mask/-popup id 与 z 序 10100/10101 不变，不得改用 openSettingsModal（单例会顶掉底层剪藏设置弹窗）；UP 列表区（头像+名字+移除）用 custom 插槽；添加行/Cookie 区尽量声明化（外部绑定）。
2. favorites（src/favorites/ui.ts 约 186 行）：空态域（emptyText/emptyDesc 保留）+ 从平铺改为分组卡片（拍板 Q11）+ maxWidth 520；「移动端默认全屏」文案差异用 mobileFullscreenGroup(key, { desc }) 覆盖逐字对齐现状。
3. library（src/library/ui.ts 约 166-216 行）：闭包内 field 名驱动 textSetting/toggleSetting 工厂退役 → 键直绑行；Weave 数据路径等行逐一等价。

## 先读（按序）
AGENTS.md → issues/131-settings-row-builder.md → docs/adr/0064-declarative-settings-schema.md → src/core/settings-schema.ts（API 真源，读透）→ src/core/settings-common.ts → src/core/settings-main-schema.ts + src/main.ts 的 display()（已迁移样板）→ tests/core/settings-schema-ui.test.ts（渲染行为基准）→ 各域 build 现状（先抄现状再声明化，clipping 的 news-sources-group.ts 要整文件读透）。

## API 速览（已合入你的基线，Wave-1 交付）
import { openSettingsModal, renderSettingsInto } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
openSettingsModal({ title, maxWidth, emptyText?, schema: { groups: [
  { icon, name, rows: [
    { type: 'toggle', name, binding: { get: () => d.sources.zhihu, set: (v) => { d.sources.zhihu = v; }, save: saveNews } },
    { type: 'number', name, binding: { key }, min, max },
    { type: 'custom', render: (body, ctx) => {} },   // news.json 联动/异步段逃生口
  ]},
  mobileFullscreenGroup('clippingMobileDefaultFullscreen'),
]}});
const { refresh } = renderSettingsInto(任意容器, schema);   // UP 弹窗自建 overlay 用
渲染器已内置：text 800ms 防抖 + blur/Enter + onCommit 一次性提示、toggle 即时落盘、number 钳制、visibleWhen 联动（显隐 + 组徽标 + 两行式一并收口）、path 接 ADR-0061 选择器、actionRow 豁免、custom 插槽。

## 通用迁移规则
- openSettingsModal({ title, maxWidth, emptyText?, emptyDesc?, schema })；迁移后该域不得残留 build 用法。
- 组 = { icon, name, rows }（icon 照抄现状）；组序/行序/maxWidth/空态保持现状（favorites 例外见上）。
- data.json 键 binding { key }；外部数据 binding { get, set, save }；域内防抖/warnReload 手写块全删（onCommit 文案逐字保留）；副作用挂 onChange。
- data.json 键驱动的动态显隐改 visibleWhen；news.json 驱动的段内联动留 custom 插槽（见上）；手动 refreshSettingsGroupCounts 全删。
- 「移动端默认全屏」手写块 → mobileFullscreenGroup(key)，文案差异 { desc } 覆盖逐字对齐（先抄现状）。
- 行为零变化（铁律 1/3）：键、数据格式、DOM id/类名、通知文案全保持；ticket 100 lint 修正例外（标题可改、描述可改自然句，键名/行为/通知文案不动）。
- 域内 confirm 调用已全库改写为 openFlowDialog（Wave-1 已在你的基线）——不要动那些行。
- UI 测试：每域现有设置弹窗/数据源组/UP 弹窗测试断言适配 schema 渲染产物，不得删用例逃避；补充移动端组与关键行为覆盖。

## 文案 lint 注册（不碰公共文件）
新建 tests/core/settings-copy-lint-b.test.ts（首行 // @vitest-environment node）：import 引擎 lintTargets 与本组域 schema 工厂（source 用 'clipping'/'up-manager'/'favorites'/'library'），断言零违规；违规按 ticket 100 修正，无法整改的局部白名单豁免并注明理由。custom 插槽内文案不经 lint（引擎只扫行 name/desc）。

## 门禁与提交
- BZ_TEST_MAX_WORKERS=8 pnpm test 全绿 + pnpm exec tsc --noEmit 0 错。
- 提交到当前分支（Conventional Commits，附 ticket 131）；不合并、不 push。
- 报告：逐域完成表（组数/行数/custom/visibleWhen 统计）、UP 弹窗迁移说明（z 序核验）、文案修正清单、测试改写清单、渲染器缺口（若有）、门禁数字、提交 hash。
```

### 代理 C（域组 C：movie/review/pomodoro/encrypt/secondbrain/smartcat）

```
你是「包仔（bz）」Obsidian 插件仓库的实施工程师，负责 ticket 131 Wave-2 域组 C：把 6 个域的 ⚙️ 设置弹窗迁移到声明式 schema。用中文工作与报告。

## 工作目录（铁律）
只在 git worktree D:\Obsidian\.dsh-worktrees\t131-domains-c（分支 worktree/t131-domains-c）内工作与提交。禁止读写 D:\Obsidian\bz 主仓库、其他 worktree、E:\；禁止 pnpm run build；禁止 push、merge。禁止修改 src/core/settings-schema.ts、settings-common.ts、settings-modal.ts、settings-main-schema.ts、tests/core/settings-copy-lint.test.ts、tests/core/settings-copy-lint-engine.ts（并行组共享文件；渲染器能力不足时用 custom 插槽兜底，缺口写进报告，主会话统一评估）。

## 你负责的域（6 个 ⚙️ 弹窗）
1. movie（src/movie/ui.ts 约 1074-1188 行）：目录/默认视图/移动端三组；text + dropdown×4 + 「海报抓取」无控件说明行（→ type:'info'）；warnReload 一次性提示 → onCommit（文案逐字保留）。
2. review（src/review/ui.ts 约 142-345 行，类方法 _buildSettingsItems/_addNotifySettings/_addQuizSettings/_addRhythmSettings/_addWatchFolderSettings/_addViewSettings/_addMobileSettings）：六组逐一转 schema groups；做题家子项显隐（quizBox style.display + refreshSettingsGroupCounts）改 visibleWhen；监听文件夹 chips 区 = type:'custom' 插槽 + 「添加监听文件夹」type:'button' 行（actionRow 豁免）；enableAutoNotify 常驻轮询注册等副作用挂 onChange 保持；「移动端默认全屏」desc 差异用 mobileFullscreenGroup(key, { desc }) 覆盖逐字对齐。quiz/ui.ts 无独立设置弹窗，确认无 build 残留即可。
3. pomodoro（src/pomodoro/ui.ts 约 336-461 行）：时间方案/行为/移动端三组；预设方案 dropdown、时长 number 行、音量 slider（全仓唯一 addSlider）+「试听」按钮——先读 settings-schema.ts 确认 slider 行能力，若不支持同行附加按钮则该行（或音量+试听小块）用 custom 插槽保行为；numSetting/toggleSetting 闭包工厂退役。
4. encrypt（src/encrypt/ui.ts 约 1186-1284 行 openSettings）：存储/预览/安全/移动端四组 7 键（encryptRoot 用 type:'path' single；encryptPreviewEnabled/encryptAutoLoadOriginal/encryptSecurityMode/encryptMobileDefaultFullscreen toggle；encryptPreviewSize/Quality text）；warnReload → onCommit；「移动端默认全屏」desc 差异覆盖。主密码弹窗/体检清理弹窗/预览窗是流程展示型，禁止迁移。
5. secondbrain（src/secondbrain/panel.ts 约 872 行附近设置段）：局部箭头 set()/group() helper 退役；「重新索引」button 行（其确认已 flow 化，别动）；「本机局域网 IP」行逻辑保持（可 custom 插槽）；省略 desc 的行保持省略（lint 只查有 desc/name 的行，别为过 lint 加文案）。
6. smartcat（src/smartcat/ui.ts 约 217 行附近）：八组（外观/可视化/互动/记忆/移动端/存储与记忆/关联/显示）；皮肤网格 = type:'custom' 插槽；「打开数据面板」等特殊行 button/custom；onClose 交互锁复位语义保持（openSettingsModal 的 onClose 仍支持）；「移动端默认全屏」desc 差异覆盖。

## 先读（按序）
AGENTS.md → issues/131-settings-row-builder.md → docs/adr/0064-declarative-settings-schema.md → src/core/settings-schema.ts（API 真源，读透）→ src/core/settings-common.ts → src/core/settings-main-schema.ts + src/main.ts 的 display()（已迁移样板）→ tests/core/settings-schema-ui.test.ts（渲染行为基准）→ 各域 build 现状（先抄现状再声明化）。

## API 速览（已合入你的基线，Wave-1 交付）
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
openSettingsModal({ title, maxWidth, schema: { groups: [
  { icon, name, rows: [
    { type: 'toggle', name, binding: { key }, onChange: () => rearm() },
    { type: 'select', name, binding: { key }, options: [{ value, label }] },
    { type: 'slider', name, binding: { key }, min, max, step },
    { type: 'info', name, desc },
    { type: 'button', name, buttonText, onClick },
    { type: 'custom', render: (body, ctx) => {} },
  ]},
  mobileFullscreenGroup('movieMobileDefaultFullscreen'),
]}});
渲染器已内置：text 800ms 防抖 + blur/Enter + onCommit 一次性提示、toggle 即时落盘、number 钳制、visibleWhen 联动（显隐 + 组徽标 + 两行式一并收口）、path 接选择器、actionRow 豁免、custom 插槽。

## 通用迁移规则
- openSettingsModal({ title, maxWidth, emptyText?, emptyDesc?, schema })；迁移后该域不得残留 build 用法（build 参数是全局 @deprecated，主会话收尾删，你只保证你的域不再传）。
- 组 = { icon, name, rows }（icon 照抄现状）；组序/行序/maxWidth/空态保持现状。
- data.json 键 binding { key }；域内防抖/warnReload 手写块全删（onCommit 文案逐字保留）；副作用挂 onChange。
- 动态显隐改 visibleWhen；手写 addListener/display 切换与手动 refreshSettingsGroupCounts 全删。
- 「移动端默认全屏」手写块 → mobileFullscreenGroup(key)，desc 差异 { desc } 覆盖逐字对齐现状（先抄）。
- 行为零变化（铁律 1/3）：键、数据格式、DOM id/类名、通知文案全保持；ticket 100 lint 修正例外（标题可改、描述可改自然句，键名/行为/通知文案不动）。
- 域内 confirm 调用已全库改写为 openFlowDialog（Wave-1 已在你的基线）——不要动那些行。
- UI 测试：每域现有设置弹窗测试断言适配 schema 渲染产物，不得删用例逃避；补充移动端组与关键 visibleWhen 覆盖。

## 文案 lint 注册（不碰公共文件）
新建 tests/core/settings-copy-lint-c.test.ts（首行 // @vitest-environment node）：import 引擎 lintTargets 与六个域 schema 工厂（source 用 'movie'/'review'/'pomodoro'/'encrypt'/'secondbrain'/'smartcat'），断言零违规；违规按 ticket 100 修正，无法整改的局部白名单豁免并注明理由。

## 门禁与提交
- BZ_TEST_MAX_WORKERS=8 pnpm test 全绿 + pnpm exec tsc --noEmit 0 错。
- 提交到当前分支（Conventional Commits，附 ticket 131）；不合并、不 push。
- 报告：逐域完成表（组数/行数/custom/visibleWhen 统计）、文案修正清单、测试改写清单、渲染器缺口（若有）、门禁数字、提交 hash。
```