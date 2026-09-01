# ADR-0080: 设置面板域（settings-panel）与通用设置样式层

- 状态：已采纳
- 日期：2026-09-01
- 关联：ADR-0002（依赖方向）、ADR-0003（懒加载）、ADR-0004（命令裸注册）、ADR-0009（设置归属模型）、ADR-0019（移动端默认全屏）、ADR-0061（路径选择器）、ADR-0064（声明式设置页）、ADR-0067（动态 z-index）、ADR-0078（保险库域原型一比一）
- 原型：`.scratch/global-settings-panel-prototype.html`（桌面 B 侧栏工作台 + 移动 M1 命令面板，UI 一比一复刻）

## 背景

bz 现有设置架构（ADR-0009）：Obsidian 设置页单页（只含「🤖 AI」「📂 数据存储路径」两区块）+ 各域 ⚙️ 设置弹窗（ADR-0064 声明式 schema）。经原型评审（grill-with-docs 多轮 + 用户拍板），用户要求新增一个**全域设置面板**作为统一入口，并明确：

- 桌面端：B 侧栏工作台布局（左导航 + 右内容），无底部快捷键提示、无右侧导航条
- 移动端：M1 命令面板，主面板真全屏 + 关闭按钮，子面板一律居中弹窗（遮罩点击关闭）
- 视觉：参考 bz 保险库（encrypt）质感；控件全部可交互；文件选择器参考 core/path-picker
- 无滚动条（隐藏滚动条保留滚动）
- 为后续所有域 UI 逐步重设计提炼**基础公用样式层**

## 决策

### 1. 新域 settings-panel，独立于既有设置架构

新增 `src/settings-panel/` 域，命令 `bz-settings-panel-open`（名称「设置面板」，icon `settings-2`）。与既有设置架构（Obsidian 设置页 + 域 ⚙️ 弹窗）**并存不替换**：新面板是「聚合浏览入口」，域设置的读写仍走既有声明式 schema 与 settings-provider，面板不另造数据写入通道。

- 理由：ADR-0009 的「设置两分」是历史契约，一次性替换破坏面大；新面板先作为聚合层存在，验证交互后再逐步收编。
- 面板内容：左侧（桌面）域导航 / 移动端搜索命令列表；右侧（桌面）域设置分组卡。设置项数据来自现有 schema 域（review/pomodoro/secondbrain/global AI 等），占位域显示空态。

### 2. 移动端：主面板真全屏 + 关闭按钮；子面板一律弹窗

- 主面板：移动端挂 `.bz-win-mfs` 真全屏（跟随 `settingsPanelMobileDefaultFullscreen` 开关，ADR-0019 同款键），头部带 ✕ 关闭按钮（真全屏态 `.bz-win-close` 显示——core 既有规则）。
- 子面板（域详情、文件选择器）：**一律居中弹窗**（非全屏），复用 `.bz-overlay-popup`（440px 宽、12px 圆角、shadow-lg），遮罩点击关闭 + ESC。
- 理由：原型评审用户拍板「子面板不用全屏，用弹窗方式」。

### 3. 基础公用样式层（core/styles.css 新增 bz- 命名空间共享类）

保险库（encrypt）与原型对比提炼，供全域逐步重设计复用的组件（全部 `bz-` 前缀，进 core/styles.css）：

| 类 | 用途 | 取值 |
|---|---|---|
| `.bz-settings-card` | 设置分组卡 | `--background-secondary` 底、10px 圆角、hover 行背景 |
| `.bz-set-row` | 设置行（名称 14/500 + desc 12/muted + 控件右） | hover `--background-modifier-hover` |
| `.bz-toggle` | 开关（40×22 滑块） | accent 开态、`--text-on-accent` 钮 |
| `.bz-input` | 文本输入（等宽/数字/密钥变体） | `--input-bg` 底、1px 边框、focus accent |
| `.bz-select` / `.bz-select-menu` | 自绘下拉 | 同 `.bz-input` 底、shadow-md 菜单 |
| `.bz-empty` | 空态三件套 | 图标 faint + 标题 muted + 描述 faint，40px 上下 |
| `.bz-domain-icon` | 域图标方块 | 34×34、10px 圆角、tag-bg 底 |
| `.bz-range` | 滑块 | 4px 轨道 + 14px 圆钮 |

- 滚动条：全站隐藏（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`），滚动功能保留——写入手册 §9 组件表。
- 不新增主题特有变量；全部取 Obsidian 变量（手册 §2）。

### 4. 文件选择器复用 core/path-picker（不新造）

面板内路径设置行（共享数据路径/监听文件夹/白名单目录/关联范围）复用 `renderPathSettingRow` + `openPathPicker`（ADR-0061），不另写选择器。原型里的选择器是一比一复刻该组件的行为。

### 5. 移动端全屏键

settings.ts 新增 `settingsPanelMobileDefaultFullscreen`（默认 true，跟随主面板全屏习惯），仅移动端显示（`mobileFullscreenRow`）。

## 后果

- 正面：设置聚合入口 + 通用样式层，后续 20 域重设计有统一基础；与既有设置并存、无破坏。
- 反面：面板内设置项目前是「展示 + 读写既有 schema」的混合；占位域（未深做）只显示空态，需随各域逐步填充。
- 兼容：新域纯增量，不动既有数据格式、命令 id、DOM 契约。

## 术语

- **设置面板（Settings Panel）**：bz 全域设置聚合入口（新域 settings-panel），桌面侧栏工作台 / 移动命令面板，命令 `bz-settings-panel-open`。
