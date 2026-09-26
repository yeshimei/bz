# ADR-0127：路径选择弹窗单源（core 实现 + 面板皮肤通道）

- 状态：已采纳（2026-09-12）
- 关联：ADR-0061（卡片弹窗式路径选择器，ticket 128/133）、ADR-0080 §4（面板路径行复用 core）、ADR-0095（皮肤 = 作用域类）、ADR-0125（浮层壳统一）、ADR-0002（依赖方向）；推翻 0296be50「文件夹选择器换域内自绘」的弹窗部分
- 涉及：`src/core/path-picker.ts`、`src/settings-panel/renderer.ts`、`src/settings-panel/styles.css`、`prototypes/settings-panel/prototype.html`（自检段），删除 `src/settings-panel/dir-picker.ts`

## 背景

同一件事（选一个 vault 内文件夹）长期有两套弹窗实现：

1. **`core/path-picker.ts::openPathPicker`**（ticket 128 / ADR-0061）——卡片弹窗：标题头 + 搜索框 + 全量目录列表（`已选置顶 → 库根 → 其余反转`）+ 底部（已选信息 / 清空(多选) / 确定），勾选框行，无关闭钮（遮罩 + ESC），`.bz-path-picker-*` 类。消费者：`core/settings-schema.ts` 的 `path` 行（→ `main.ts` 原生设置页、`core/settings-modal.ts` 各域 ⚙️ 弹窗）、`attach/ui.ts` 搬附件命令。
2. **`settings-panel/dir-picker.ts::openDirPicker`**（0296be50，2026-09-07）——域内自绘：头行标题 + 大搜索框、面包屑「将选用 A ▸ B ▸ C」、列表平铺反转 + 右侧浅色父链、底部取消/选用，`.bz-sp-picker-*` 类。消费者只有设置面板 `renderPanelSchema`。

副作用是**同一行 schema 因入口不同点出两种弹窗**（同一个「日记目录」在新面板与 ⚙️ 里长得不一样），且 `dir-picker` 是面板对自身 ADR-0080 §4「复用 core/path-picker，不另写选择器」的一次偏离；事后又有两处信息丢失：`pickerDesc`（review / smartcat / secondbrain 都写了说明文案）在面板被静默忽略，面板弹窗也没有「清空」与「已选计数」。

## 决策

1. **弹窗唯一实现 = `core/path-picker.ts`**。删除 `src/settings-panel/dir-picker.ts`；面板 `renderer.ts::makePathRowCtrl` 改调 `openPathPicker`。面板**行内控件保持自绘**（`.bz-sp-chips` / `.bz-sp-path-btn` / `.bz-sp-chip`）——行是面板控件层的事，弹窗才归 core。
2. **加一条皮肤通道**（不是第二套实现）：`PathPickerOptions.skinClassName?: string`，同时挂 mask 与 popup。两者是 body 下两个独立兄弟节点，皮肤类必须**同时**挂上，遮罩 tint 与弹窗材质才同皮（ADR-0125 口径：基座各自暴露一个显式皮肤入口，`createOverlay` 签名不动）。
3. **皮肤类自带 token 声明**。挂 body 的浮层在面板根之外，够不着面板作用域的 `--sp-*` → `.bz-sp-skin` 列入 `settings-panel/styles.css` 两份 tokens 挂载组（亮/暗各一份），皮肤段再消费（先例 `.bz-item-menu.bz-home-menu`）。缺这一步的症状是静默的：引不到变量 → 整条声明失效（透明底），页面不报错。
4. **皮肤只映射材质，不动 core 的布局与几何**：底色 `--sp-panel`、描边 `--sp-line`、圆角 14px、`--sp-shadow`、字色/字号、行高、勾选框、按钮形制（= `.bz-sp-btn`）、遮罩 tint、`max-height`。三段式版式（头/搜索/列表/底）、`.bz-path-picker-*` 契约类、列表排序、`内联宽度 440px` 全部归 core，皮肤不碰（要改宽度得加 core 选项，不在本 ADR）。
5. **文案口径按调用方定**：core 的确定键缺省「下一步」是附件搬移两段式（选目录 → 看清单）语义，面板传 `选用 / 添加所选`；面板同时**首次透传 `pickerDesc`**（补回 review / smartcat / secondbrain 丢失的说明文案）。
6. **行为差异随实现一并统一**（预期代价，见后果）：取消按钮取消、双击直选取消、列表排序改为「已选置顶 → 库根 → 其余反转」、行显示完整路径 + 勾选框（不再是「名称 + 右侧父链」）、目录扫描失败态取消（core 静默回落纯文件聚合，不挂「读取失败 + 重试」）。

## 后果

- 四个入口（⚙️ 原生设置页 / 各域设置弹窗 / 附件搬移命令 / 设置面板 path 行）从此同一套 DOM 与行为；面板内不再存在 `.bz-sp-picker-*` 弹窗类与 `openDirPicker`。
- **可见变化（面板内）**：弹窗宽度 560 → 440px；弹窗自身内边距 24 → 0（头/搜索/列表/底各自带，面板尺度更紧）；限高 520/78vh（皮肤覆写 core 的 560/82vh）；多选多了「清空」与「已选 N 项」；单选少了「取消」与面包屑。
- 面板段多出一层皮肤覆写（约 20 条规则），换来的是全域一份弹窗实现；日后改选择器行为只改 `core/path-picker.ts` 一处。
- 守护：`tests/settings-panel.test.ts`（皮肤类在场 + 遮罩节点关闭 + 选用落 chip）、`tests/core/overlay-glass.test.ts`（`.bz-sp-skin.bz-overlay-mask` 毛玻璃与暖黑底色）、`tests/core/path-picker-ui.test.ts`（core 侧结构与行为未变）、`prototypes/settings-panel/prototype.html` 自检段（core 选择器 + `.bz-sp-skin` 自带 token 可解析）。
- 域内不得再自绘路径选择弹窗（ADR-0080 §4 恢复生效）；新增需要选目录的域一律 `openPathPicker`，需要宿主观感时按第 2/3 条加皮肤类。
