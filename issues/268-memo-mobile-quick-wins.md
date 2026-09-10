# 267 备忘录移动端评审四改（头行收敛 / 添加场景入场景条 / 排序改下拉 / 底部添加开弹窗）

状态：已完成
类型：feat（移动端 UI 交互调整，用户逐条拍板）
涉及域：memo（render markup 单源 + ui 行为单源 + styles.css 皮肤段）

## 来源

用户在快速原型模式（`memo-quick` worktree，5179 热重载）上评审备忘录移动端，逐条口述
四改；均为 UI/交互口径调整，**不动数据层与写盘链路**。

## 四改

### 1) 移动端头行收敛：撤设置/新建，只留关闭

- 设置钮：移动端 `display: none`（桌面本就由皮肤段整组收掉）。设置入口仍在——
  场景项右键/长按菜单「在设置中编辑」（`buildSceneActions`）。
- 新建钮 `.bz-memo-head-new`（issue 266 为「移动端无新建入口」补的那一枚）**退役**：
  移动端新建改由「底部录入 → 添加」与「场景条尾部 → 添加场景」承担。
  随之删除 issue 266 的 `@media (min-width: 769px){ .bz-memo-head-new{display:none} }`
  与收口段的 32px 档规则（`src/memo/render.ts` / `src/memo/styles.css`）。
- 关闭钮：移动端唯一按钮。issue 268 定 38px → **issue 269 收小到 28px**
  （与头行品牌块 `.bz-panel-brand` 28×28 同尺寸，头行两端等重）。
  命中区：28px 档默认 `-6px` 外扩只到 40px < 44px，故 markup 改挂
  `.bz-touch-target--lg`（`-8px`）→ 28 + 16 = **44px** 达标（设计手册 §8.2）。
  皮肤形态：纸感 = 白底 2px 墨框 + `2px 2px 0` 硬阴影；编辑部 = 方角 1.5px 墨框白底。
  三者（background/border/box-shadow）必须 `!important` ——核心层 `src/core/styles.css`
  的 `.bz-icon-btn` 基线把这三值全钉死在 `!important`，普通声明压不住。

### 2) 「添加场景」进移动场景条尾部

- 新增纯层 `mobAddSceneChipHtml()`（`src/memo/render.ts`）：虚线空底 + tag 图标，
  复用既有 `data-memo-addscene` 钩子（**零新增行为代码**），范式同收藏本
  `.bz-fav-chip-add` 的虚线动作磁贴。
- 位置：`renderMobScenes()` 在场景 chips 之后拼接（**平铺场景的最后面**，用户拍板）。
- 动作不是场景：不带 `data-memo-scene` → 自检的「9 个场景」口径不变；
  桌面左栏那条 `.bz-memo-side-add` 位置不变（两形态同语义）。

### 3) 排序：三档平铺 → 单枚下拉（搜索框变长）

- issue 199 的三档浮岛 segmented 退役，改组件库 `uiSelect`（`.bz-select`）：
  收起态只占一行文案宽，`.bz-search`（`flex: 1`）吃掉腾出的宽度。
  实测：移动 260px、桌面 392px（此前被三档挤到约 110px）。
- 展开菜单按皮肤换装（组件库默认 `surface-4` 底 + 细描边与两套皮肤语汇都不搭）：
  - 纸感：`#fffdf6` 底 + 2px 墨框 + 11px 圆角 + `4px 4px 0` 硬阴影；选中项黑底白字；
  - 编辑部：方角白底 + 1.5px 墨框 + 选中项红字（编辑部红是唯一强调色）+ 选项间 1px 分隔线。
- detach 语义随组件变化：`sortChoiceDetach` → `sortSelectDetach`（uiSelect 的
  document 级开合/ESC 监听，面板关闭时摘除）。

### 4) 底部「添加」：桌面快速落盘 / 移动打开创建弹窗

- 新增 `submitComposer()`（`src/memo/ui.ts`）把两端分叉收在一处：
  - 桌面 → 原 `addFromComposer()` 快速落盘（「输入即存 + toast 补全」链路不变）；
  - 移动 → `openEditor(null, {…})` 打开创建弹窗。
- 弹窗预填（`openEditor` 新增可选 `opts`，编辑态忽略）：
  - `presetContent`：底部已输入的文字带进内容框；
  - `presetTitle`：剪藏剪贴板预填抓到的页面标题（内容仍是原始 URL 才认）；
  - `presetScene`：**当前选中场景**带进场景平铺预选（issue 269，与桌面
    `composerScene()` 同口径；伪场景「全部/今日/重要」回落 `memoDefaultScene` → 第一个）；
  - `onSaved`：仅在保存成功后回调 → 调用方清底部草稿（**取消不丢草稿**）。

## 数据结构

无变化。`memo.json` 字段与写盘路径（`CONFIG/STORAGE/memo.json`）零改动。

## 守卫（防回归）

- `tests/memo/ui.test.ts` 新增「memo 移动端（issue 268）」组：迁移排序断言为下拉形态
  （收起态文案 + 箭头 + 三档菜单 + 写回 + 外部/ESC 收起）、底部「添加」开弹窗带稿、
  空稿也开弹窗、取消留稿、动作 chip 位置、桌面未受影响、场景预选、伪场景回落。
- `tests/memo/mobile-ui-3fix.test.ts` 改写 A/B 组为 267/268 口径：关闭钮 28px 档 +
  `--lg` 命中区 + 双皮肤形态 + 设置钮 `display:none` + `.bz-memo-head-new` 已退役
  （含「全仓不得再出现该字符串」的反向断言）。
- 原型壳自检（`?selftest=1`）补 267/268 断言：三枚手动演示钮已撤、布局钮在场。

## 验收

- 移动端头行只剩一枚 28px 关闭钮，纸感/编辑部两套皮肤形态各自成立；
- 场景条尾部可见虚线「添加场景」chip，点开即添加场景弹窗；
- 排序收起为单枚下拉，展开菜单两套皮肤各自风格化，搜索框明显变长；
- 移动端点「添加」→ 创建弹窗（带草稿 + 预选当前场景），保存成功才清底部；
  桌面端点「添加」仍直接落盘、不开弹窗。
