# ADR-0061：设置路径输入统一卡片弹窗选择器 + 移动端设置行两行式

- 状态：采纳（2026-08-27 grill-with-docs 拍板 + 原型验收定稿，ticket 128）
- 关联：ADR-0009（设置所有权）、ADR-0019（移动端默认全屏）；原型 `.scratch/picker-prototype/`

## 背景

设置面板的路径类输入各自为政：8 处单值目录是纯文本框（storagePath/articleDirectory/diaryDirectory/movieDirectory/letterDirectory/libraryFolderPath/movieFolderPath/encryptRoot），多值目录三种形态并存——第二大脑 allowPaths 逗号分隔文本框、linkAgentScopes 白名单弹窗（whitelist-modal，搜索+chips+确定）、复习 reviewWatchedFolders 的 FolderSelectModal+chips 组合；附件搬移另有运行时 FolderSelectModal。移动端手输长路径体验差、交互三套不一致。用户要求「输入文件或文件夹统一改成文件搜索输入框，支持单个或多个，并对移动端做优化」。

同时，设置行移动端布局无统一规则：控件区多元素（输入框+按钮）时元素挤压。用户定规则「输入框所在行超过两个元素时，描述一行，输入框和其他元素一行」。

## 决策

1. **core 统一选择器**（`src/core/path-picker.ts`）：单选/多选参数化；**卡片弹窗**（居中卡：标题头+搜索框+目录列表+底部 selinfo/清空(多选)/确定，遮罩+ESC、无关闭按钮，遵主窗口规范）；已选 = chips（单选 chip 替换式可 ✕ 清除，多选逐个 ✕）。
2. **数据源 = 全部 vault 文件夹**：含空目录与点前缀隐藏目录（如 `CONFIG/.ENCRYPT`）；不再只聚合含笔记目录（whitelist-modal 旧逻辑不满足书库/保险箱等空目录场景）。
3. **不保留手输输入框**：设置行只显示 chips + 「选择…/添加…」按钮，路径一律经选择器录入（限 vault 内）。grill 过程中曾拍板保留手输双通道（Q8），原型验收后用户推翻——原型演示的混乱让手输通道成为负担。
4. **旧两套退役合并**：whitelist-modal（含 renderSelectedChips）与 FolderSelectModal 调用方全部改接 core 组件。
5. **移动端**：弹窗近全屏 + 键盘适配；样式收敛根 styles.css、`bz-` 前缀（铁律 8）。
6. **移动端两行式**：所有设置行（主设置页 + 域设置弹窗）通用——控件区（.setting-item-control）含 ≥2 个子元素时，移动端名称+描述独占一行、控件区一行（内部 flex-wrap）；单控件行（开关/下拉）保持原生。原型 JS 判定挂类，实现可用 `:has()` 纯 CSS，口径注释说明。
7. **兼容冻结不破**：设置键格式零变化（单值字符串/逗号分隔/数组照旧），仅换 UI。

## 备选

- **Obsidian 原生 FileSuggest/FolderSuggest**（AbstractInputSuggest 下拉补全）：贴近原生但单/多两套交互不一致，移动端下拉体验差——否。
- **保留手输双通道**（行内文本框 + 选择按钮）：grill Q8 曾拍板，原型验证移动端混乱——推翻，纯选择器。
- **底部抽屉 / 内联展开**（原型 B/C 变体）：用户验收拍板卡片弹窗——B/C 落选。

## 后果

- 路径录入收口到选择器，录入一定合法（vault 内存在目录）；「输入 vault 内尚不存在的目录」场景不再支持（如先建配置后建目录）——用户接受（拍板「不保留输入框」）。
- whitelist-modal / FolderSelectModal 删除，第二大脑/复习/附件搬移行为经回归测试保护。
- 两行式成为设置行新约定，后续新设置行默认兼容（控件区多元素即触发）。
