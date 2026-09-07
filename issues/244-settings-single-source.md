# issue 244：settings-panel markup 单源 + 布局分层迁移（ADR-0104/0105）+ 原型对齐

分支：`feat/settings-single-source`（worktree `../.dsh-worktrees/issue-244-settings-single-source`）

## 目标

把设置面板域接入 ADR-0104/0105 三件套范式，并按用户硬要求以原型为基准对齐域 UI。

## 迁移结构（schema 驱动域的特殊处理）

与模板串孪生域不同，settings-panel 是 schema 驱动——纯层收的是「schema 节点视图 + 值 → HTML 串」的工厂，**schema 本体与绑定逻辑（visibleWhen/onChange/落盘）留在 renderer.ts 行为层**：

```
src/settings-panel/
  render.ts                    ← 域入口：共享层 + layouts/jingwei 聚合
  shared.ts                    ← 控件级 markup 工厂（开关/下拉/输入/滑杆/chips/按钮徽标/cardpick/行/组骨架/页头/加载态）
  layouts/jingwei/render.ts    ← 布局差异层（P1 系统面板：桌面 B 侧栏工作台 + 移动 M1 命令面板骨架/导航/移动列表/域弹窗壳）
  renderer.ts                  ← 行为层：schema 行 → SpRowVm 投影 → 纯层串 innerHTML → 事件绑定/落盘（721 → ~590 行）
  ui.ts                        ← 行为层：面板生命周期/导航搜索/徽标回填/移动弹窗（755 → ~650 行）
```

- 纯度契约：shared.ts / layouts 仅 import `core/ui/str`（settings-schema 走 type-only 编译期剥除）；无模块级可变状态；图标一律 `<i data-lucide>` 占位（插件 mountIcons / 壳内联 SVG 兑现）。
- 预览包：`scripts/build-preview.mjs` PREVIEW_DOMAINS 加 `"settings-panel"`，产物 `src/settings-panel/prototype-render.js` 挂 `window.BZR_settings_panel`（连字符域名 globalName 取合法标识符形态 `BZR_settings_panel`，render-purity 守卫同步 sanitize——共享脚本最小改动）。
- 原型壳：prototype.html `<script src="./prototype-render.js">`，prototype.app.js 由 1101 行重复实现收编为演示层（~700 行：演示值层/localStorage、自绘弹层、toast、主题类同步、selftest）。

## 原型对齐清单（用户硬要求）

### a) 收进纯层的 markup 生成函数

- shared.ts（控件级，跨布局复用）：`toggleHtml` / `selectTriggerHtml` / `selectItemHtml` / `textInputHtml` / `textareaHtml` / `sliderHtml` / `pathChipsHtml` + `pathChipsItemsHtml`（容器版与项串版）/ `pathAddBtnHtml` / `rowBtnHtml` / `badgeHtml` / `cardpickHtml` / `rowHtml`（行骨架：info/ctrl/cards/custom 插槽三分支）/ `groupCardHtml` / `pageHeadHtml` / `loadingHtml` / `SpRowVm`。
- layouts/jingwei（布局差异层）：`deskHeadHtml` / `deskShellHtml` / `navSecHtml` / `navItemHtml` / `mobHeadHtml` / `mobShellHtml` / `mobItemHtml` / `mobRowHitHtml` / `mobModalShellHtml` / `mobSecHtml` / `mobEmptyHtml`。
- data-sp-path / data-sp-card / data-sp-domain 为事件层回查契约（原型与插件同构）。

### b) 原型有而域内未实现 → 以原型为基准补齐

| 项 | 处理 |
|---|---|
| 桌面搜索行命中高亮（`.bz-sp-set-row.hit`，右侧内容区命中行高亮） | ui.ts 桌面搜索在过滤左导航的同时对 pane 行 toggle `.hit`（styles.css 已有类，原是死样式） |
| choiceCards 行容器（原型 `.bz-sp-set-cards` 包裹卡组） | renderer choiceCards 行改为 `.bz-sp-set-cards` 容器（原直接挂行根），与原型 DOM 同构 |
| 下拉箭头旋转样式散置（原型/插件各自内联 transform） | 收敛进 styles.css `.bz-select-car { transform: rotate(90deg) }`（样式单源，改一处两侧生效） |
| 原型 tf-* 未来皮肤 token 组（linen/celadon/dark/mono 四套 --sp-* token 预览） | **待拍板**：保留在 prototype.html 壳 `<style>` 作未来皮肤预览，不入域 styles.css——域 schema 主题键当前仅「晨昏」（= 默认 linen 亮暗双皮），多皮肤入正式需先加 schema 选项与 settingsPanelSkin → 类名映射，避免发死代码 |
| 模型「获取模型名」弹层（原型 pickModel 自绘） | 非缺失：插件 AI 域模型行为 custom 行（⚙️ 同源），内嵌按钮 + 弹层已实现（ticket 172/173），原型为 mock 演示；原型弹层保留为壳演示件 |

### c) 域内有而原型没有 → 保留（不删，待拍板列表）

| 项 | 去留 |
|---|---|
| 移动端搜索「设置项」命中段 + 「设置」kind 徽标 + 清除按钮（原型只搜域） | 保留（功能更强，mobRowHitHtml 已收进纯层） |
| 移动搜索 placeholder「搜索设置、域…」（原型「搜索域」） | 保留域口径 |
| 无设置项域空态 / 全门控隐藏空态 / 加载失败态（uiEmpty） | 保留（行为层差异） |
| path 行 fallbackChip 锁定回落 chip / 「选择…」按钮恒显并存 | 保留（插件语义，原型无绑定值回退场景） |
| refreshKey 程序化刷新显示值 / 三函数逃生口 / visibleWhen WeakMap / 竞态序号 / ESC 栈 / topifyZ / preloadAllBadges 徽标回填 / 零项域按端剔除 / 移动全屏 / domainId 深度直达 | 保留（行为层，原型无真实数据源） |
| custom 行不渲 info 区（防标题描述两遍）+ 原生 Setting 插槽包裹 | 保留（插件 custom 行自带标题，原型 mock 是自绘子行） |

## 测试与门禁

- `tests/settings-panel.test.ts` 28/28 绿（DOM 契约未变：.bz-sp-group-icon data-icon、.bz-select 菜单 16 项、移动弹窗滚动等全保）；`tests/core/render-purity.test.ts` 守卫扩 settings-panel（BZR 键名 sanitize 一处同步）。
- headless Edge selftest：`?selftest=1` → SELFTEST 10/10（新增「markup 单源 BZR_settings_panel 在库」断言）。
- 设置项语义/数据键零改动（data.json 契约不动，动的只有 UI 层 markup 来源）。

## 坑

- esbuild globalName 禁连字符（`BZR_settings-panel` 编译炸）——build-preview 改为 `-`→`_` sanitize，purity 守卫同步。
- mountIcons 会 replaceWith 载体元素，内联 style 会丢——下拉箭头旋转改由 styles.css 承载。
- 分组卡图标契约：旧实现 setIcon 挂在 `.bz-sp-group-icon` 元素自身（data-icon 在上）——纯层须出单元素占位（iconSpan(icon,'bz-sp-group-icon)），不能再包一层 span，否则 data-icon 断言红。
