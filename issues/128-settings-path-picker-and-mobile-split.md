# Ticket 128：设置面板统一文件选择器 + 移动端两行式（ADR-0061）

- 状态：进行中（worktree W1）
- 域：core/settings（跨域设置面板）
- 来源：grill-with-docs 拍板 + 原型验收（`.scratch/picker-prototype/`，卡片弹窗定稿）
- 关联：`src/core/settings-modal.ts`、`src/main.ts`、`src/secondbrain/whitelist-modal.ts`、`src/attach/ui.ts`（FolderSelectModal）、`src/clipping/view.ts`（剪藏设置）、`src/review/ui.ts`（监听文件夹）、`src/secondbrain/panel.ts`（自动双链组）、`src/styles.css`

## 拍板

1. **范围**：主设置页 + 所有域设置弹窗的路径类输入全部统一。
   - 单值目录：`storagePath`、`articleDirectory`、`diaryDirectory`、`movieDirectory`、`letterDirectory`、`libraryFolderPath`、`movieFolderPath`、`encryptRoot`
   - 多值目录：`secondBrainAllowPaths`、`linkAgentScopes`、`reviewWatchedFolders`、`reviewExcludedNotes`
   - `aiAgentWatchedFolders` 不暴露 UI，不动
2. **形态**：抽 core 统一选择器 `src/core/path-picker.ts`，单选/多选参数化；**卡片弹窗**（居中卡：标题头 + 搜索框 + 目录列表 + 底部 selinfo/清空(多选)/确定）；已选 = chips（单选 chip 替换式可 ✕ 清除，多选逐个 ✕）。原型 `index.html` 的 A 变体即视觉基准（head 52 / search / list 滚动 / foot），样式收敛根 `styles.css`、类名 `bz-` 前缀（铁律 8）。
3. **数据源**：全部 vault 文件夹（`vault.getFiles()` 聚合目录 + `vault.getAbstractFileByPath`/adapter 探测，含空目录与点前缀隐藏目录如 `CONFIG/.ENCRYPT`），不能只聚合含笔记目录（whitelist-modal 旧逻辑不够用）。
4. **不保留手输输入框**（原型验收推翻 grill Q8）：设置行只显示 chips + 「选择…/添加…」按钮，路径一律经选择器录入（限 vault 内）。
5. **旧两套迁移**：`secondbrain/whitelist-modal.ts`（多选弹窗，含 `renderSelectedChips`）与 `attach/ui.ts` `FolderSelectModal`（运行时单选）合并进 core 组件；调用方全部改接；z-index 对表 `settings-modal.ts` 家族注释（选择器叠于域设置弹窗 10050 之上，companion 档 11100+ 或复用 11200 档，实现时对表取一档并注释）。
6. **移动端**：弹窗近全屏 + 键盘适配（聚焦搜索框时列表可见、`env(safe-area-inset-bottom)` 避让）；无关闭按钮，遮罩 + ESC（主窗口规范）。
7. **移动端两行式**：所有设置行通用规则——控件区（`.setting-item-control`）含 ≥2 个子元素时，移动端（`is-mobile` / 窄视口）名称+描述独占一行、控件区一行且内部可折行；单控件行（开关/下拉/单按钮）保持原生布局。样式收敛 `styles.css`（媒体查询），JS 仅在构建行时标注（或 `:has()` 纯 CSS，实现自选，注释说明口径）。
8. **兼容**：设置键格式零变化（单值字符串/逗号分隔字符串/数组照旧），仅换 UI（铁律 1）；命令 id、DOM 契约不变。

## 验收标准

- a) 上述 8 个单值键 + 4 个多值键在设置面板全部以「chips + 选择按钮」呈现，点开为卡片弹窗搜索选择；
- b) 单选：点选即替换 chip，✕ 清除后为「未选择」态；多选：勾选累加、chips ✕ 移除、清空按钮；
- c) 数据源含空目录与点前缀目录（如 CONFIG/.ENCRYPT 可选中）；
- d) whitelist-modal 与 FolderSelectModal 退役，调用方（第二大脑白名单/自动双链组、附件搬移、复习监听文件夹）改接 core 组件行为不回退；
- e) 移动端：选择器近全屏可用、两行式规则生效且单控件行不受影响；
- f) 新组件数据层 + UI 层测试 + smoke 同步；全量测试绿 + tsc + 构建。
