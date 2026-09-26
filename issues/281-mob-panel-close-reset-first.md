# issue 281：移动端主面板 ✕「复位优先」——先收打开的列表，全收起才关面板

日期：2026-09-11 ｜ memo：item-1789107101755（用户原话「移动端，主界面点击关闭按钮，直接关闭主界面，而不是收起打开的列表，只有当列表都收起来时才会关闭主界面」）｜ 关联：clipbook ui.ts「关闭」钮既有语义（原型语义，用户已认可的先例）

## §1 归属判定

备忘的「主界面」未指名域。调研排除两个候选：home（无可复位常驻列表，长按抽屉的全屏遮罩天然拦截 ✕）与 settings-panel（推入域页后首页 ✕ 移出屏幕不可点；ESC 已是「先弹回再关」）。实际落点 = 当日刚装 ✕ 的两个主面板：**diary**（可复位态 = 搜索栏）与 **secondbrain**（可复位态 = 来源分布树 `expandedDirs` 展开目录），按 clipbook「复位优先」语义补齐。

## §2 修法

- diary：头行 ✕（`data-act="close"`）处理改分派——搜索栏开着 → 走完整 `toggleSearch` 收起（连带清关键词与高亮态）不关面板；已收起再点才 `hide()`。
- secondbrain：`#bz-sb-panel-close` 改分派——`expandedDirs.size > 0` → 全部收起 + `renderDist()` 重绘不关；无展开再点才 `close()`。
- 回归测试：`tests/diary/ui.test.ts`（✕ 只收搜索不关面板 → 再点才 hide）；`tests/secondbrain/panel-close-reset.test.ts`（新建，两用例：有展开先收不关/再点才关）。

## §3 交付与遗留

- commit `413b132e`（worktree/1）；review 通过（R1：搜索栏状态判定由 render.ts inline `display:none` 初始值保证，可靠）。
- 遗留 P3：secondbrain 面板不在统计视图时（重建/引导流程）`#bz-sb-dist` 不在 DOM，第一击复位无视觉反馈需再点——视图互斥下几乎不可达，可选修法为判定加容器在位条件。
