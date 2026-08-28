# Ticket 131（提案·待排期）：设置行构建助手 + 通用设置组分发

- 状态：提案（2026-08-27 用户提出，本批 128-130 合并后另排期；不阻塞当前批次）
- 域：core/settings（跨域）
- 来源：用户在 ticket 128 实现期间提出「设置面板是通用模板吗？开关只需要指定是开关、文本、绑定的值，同时提供回调」；随后追加方向——「面板尽量多一些通用设置，分发到不同域，减少重复，让所有域的设置面板调用逻辑和显示逻辑一致」
- 关联：`src/core/settings-modal.ts`（骨架）、`src/core/path-picker.ts` + 路径行助手（ticket 128 产出，本 ticket 的 API 风格基准）、`src/main.ts`（既有 textSetting/toggleSetting 私有 helper）、各域设置弹窗 build

## 想法 A：设置行构建助手（kind + 绑定值 + 回调）

core 层提供统一的设置行构建助手（API 风格对齐 ticket 128 路径行助手）：

```ts
addRow(group, { kind: 'toggle', name: '自动摘要', desc: '…', value: true, onChange })
addRow(group, { kind: 'text', name, desc, value, onChange, placeholder?, onCommit? })
addRow(group, { kind: 'path', name, desc, value, onChange, mode: 'single'|'multi' })  // ticket 128 已交付
addRow(group, { kind: 'select', name, desc, value, options, onChange })
addRow(group, { kind: 'slider', name, desc, value, min, max, step, onChange })
```

- 产出仍是标准 `.setting-item` DOM（铁律「DOM 契约稳定」不破）；数据键格式零变化。
- main.ts 的 textSetting/toggleSetting（防抖落盘/onCommit 提示）语义并入助手，成为全库统一行为。
- 各域设置弹窗逐行替换为助手调用（机械改造，量：约 10+ 个域弹窗 × 各 3-10 行）。
- 动态逻辑（联动显隐、启动快照提示、自定义行）保留在各域 build 内，助手只封装「标准行」；非常规行（chips 区、皮肤网格、动作行）不走助手。

## 想法 B：通用设置组分发（定义一次、挂载到域）

跨域重复的设置项在 core 定义一次，域 build 一行挂载，消灭逐域复制：

```ts
// core/settings-common.ts
mountCommonRows(el, {
  mobileFullscreen: 'clippingMobileDefaultFullscreen',  // 键名按域前缀传入
});
// 域 build 里：
mountCommonRows(el, { mobileFullscreen: 'libraryMobileDefaultFullscreen' });
```

- **首批纳入的通用项候选**（按重复度盘点）：
  - 「移动端默认全屏」——11 个域逐字复制（AGENTS.md 主窗口规范第 3 条），最典型的模板代码；
  - 批次/每页加载数量（diary/article/movie 三域同构的 addText 数字行）；
  - 排序方式/默认筛选类下拉（movie 等）。
- 显示逻辑一致性随分发收敛：`isMobileEnv()` 门控、文案规范（ticket 100：标题 4-8 字零符号、描述 20 字上下）、防抖口径，全部只在 core 一处。
- **边界**：真正域专属的设置（剪载数据源、小橘记忆打分、保险箱预览参数）不进通用层；通用层只收「≥3 个域同构」的项。

## 两步的关系

想法 A 是地基（行级一致），想法 B 是其上的复用层（组级一致）。实现顺序：A 先行（含路径行已交付部分），B 在 A 稳定后把「移动端默认全屏」等候选逐个迁入。均可分批落地，不要求一次全换。

## 验收标准（排期后细化）

- a) 助手覆盖 toggle/text/path/select/slider 五类，主设置页与域设置弹窗通用；
- b) 至少 3 个域弹窗完成替换作为样板（其余域可分批跟进）；
- c) 防抖落盘/onCommit 语义与现 textSetting 一致；
- d) 「移动端默认全屏」迁入通用分发，11 域调用点各收敛为一行，行为与文案零变化；
- e) 全量测试绿 + tsc + 构建。
