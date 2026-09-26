# Issue 203: 输入联想收敛组件库 uiSuggest（三域手搓 .bz-popover 联想统收一处）

日期：2026-09-05　状态：已交付（master abb726c）
前置：issue 202（归物分类下拉惰性弹出——用户问「这个方式能不能抽象成组件库」）

## 需求（用户拍板）

把「输入框聚焦/输入弹联想下拉」的方式抽象成组件库组件；全域排查同款实现并替换。

## 全域排查结论

同范式（input 锚定 + 聚焦/输入惰性弹出 + 过滤联想）共 **3 处**：

| 域 | 原实现 | 候选源 | 上限 | 排除现值 | 键盘导航 |
|---|---|---|---|---|---|
| 归物本 | categoryPicker | DEFAULT_CATEGORIES 静态库 | 60 | 否 | ArrowDown/Enter（本票前已有） |
| 收藏本 | notePicker（ticket 188） | vault markdown 路径（动态） | 30 | 是 | 无 |
| 待办 | bindSug（issue 201 .bz-popover 化） | 已有脚本/课程名（动态） | 5 | 是 | 无 |

**非同范式不换**：uiPopover（点击开合 select 语义）、encrypt 快速复制密码（独立弹窗+模糊搜索）、
home 命令面板（搜索框+自绘面板，非字段锚定）。

## 新组件 src/core/ui/suggest.ts（uiSuggest）

- 签名 `{anchor: HTMLInputElement, source, max?=30, excludeCurrent?, iconOf?, labelOf?, onPick?}` → `{close, detach}`。
- 交互：聚焦/输入惰性弹出（issue 202 拍板：默认不弹）→ 现值子串过滤（上限 max）→
  无匹配即收（不开空壳）→ 点选/回车回填 + onPick + 回焦 → 外点 mousedown 收起（isConnected 自清）→
  Esc 只收下拉（stopPropagation 不穿 escManager）；ArrowDown/Up 移 is-on（三域统一补齐）。
- 点选回填后压一次 focus 弹出（回焦不复弹自身，favorites notePicker 语义入库）；输入事件清压（打字恒可重开）。
- 现值高亮 is-on 作键盘导航起点；DOM 全 textContent 构造（免注入）；视觉复用 .bz-popover 族零新类。
- jsdom 兼容：scrollIntoView 可选调用。

## 三域替换

归物分类（iconOf=catEmoji / labelOf=catNameOf / max 60）、收藏关联笔记（动态 vault 源 / max 30 /
excludeCurrent）、待办脚本·课程（动态源 / max 5 / excludeCurrent / onPick）——bindSug/notePicker/
categoryPicker 手搓开合逻辑全删，域内只留 source 构造。**统一增益**：三域都获得 ArrowDown/Up/Enter
键盘导航与「无匹配即收」。

## 测试与手册

- tests/core/ui.test.ts 新 uiSuggest describe 6 例（惰性弹出/过滤/上限/excludeCurrent/点选回焦不弹/
  键盘+Esc 不冒泡/外点+离场自清）；belongings 断言 data-cat→data-value；favorites/todo 断言 textContent
  不变零改动。全量 4138/4138 绿 + tsc 干净。
- docs/ui-kit-manual.md §4 加 uiSuggest 行 + uiPopover/uiSuggest 分工段（选择 vs 联想）。

## 坑记录

- emoji 是代理对，`slice(0,1)` 切成乱码——测试用 `[...v]` 按 code point 取。
- jsdom 键盘用例断言「Esc 不冒泡」时 document 监听须按 e.key 过滤——箭头/回车本就冒泡，别误判组件漏拦。
