# Ticket 139 — 文献盒 UX 二轮（用户清单拍板 10 项 + 关闭按钮统一）

> ticket 138 交付后的二轮实测反馈。spec 见 `.scratch/memo-suite-plugin/spec.md`「文献盒 UX 二轮」节。不改数据格式。

## 1. 交互修复

### 1.1 子面板不隐藏主面板
- 主面板 📝/🎬 打开术语/视频面板时不再 `hideMain()`，子面板 topifyZ 叠开；关闭子面板回主面板。
- ESC 层级顺序不变（术语→历史→添加→视频→主）。

### 1.2 卡片级增量刷新（core list-patch，全域同构域接入）
- 根因：文件事件 → applyFilter → renderList(true) `innerHTML=''` 全列表重建 → 滚动跳顶。
- 新增 `src/core/list-patch.ts`：键控卡片 diff（dataset key 增/删/移/换，内容变才替换节点，不清容器）。
- 接入：literature（renderNoteCard path 键）+ clipping（createArticleCard path 键，含 findCardByPath）。
- 用户主动筛选/搜索仍走全量重建（回顶是预期）；diary/movie 单列后续 ticket。

### 1.3 失败原因白话化 + 失败卡片点击反馈
- 渲染层 `humanizeError`：识别 bili-dl 未安装 / ffmpeg·ffprobe·python 缺失 / AI 未配置·Key 无效 / 网络超时·连接失败 / 转录文件缺失 → 一句中文；原文保留 title 悬浮。
- 失败任务卡片点击 → flow-dialog「处理失败」：白话原因 + 原文 + 「编辑任务」/「关闭」。

## 2. 面板重设计

### 2.1 术语面板重做
- 视觉重做：布局/间距/预览区卡片化/按钮秩序/生成中加载态（对齐主面板质感）。
- 「重新生成」守卫：预览被手改（当前值 ≠ presentTermPreview 记录值）→ flow-dialog 确认后才覆盖。

### 2.2 添加任务弹窗：整片/剪辑开关 + 视觉统一
- 「整片 / 剪辑片段」分段选择；剪辑才展开开始/结束时间输入；编辑按 start/end 回显。
- 保存校验不变（剪辑须成对、分P 正整数、URL 非空）；校验失败聚焦对应输入框。
- 不复用 openSettingsModal（设置「改即落盘」绑定模型与表单「整体提交」相反，见 spec 答复）。

## 3. 面板行为

- **视频面板移动端全屏**：showVideoEntry 接 applyMobileWindowFullscreen。
- **移动端视频面板只留 ➕ + ✕**：isMobileEnv() 隐藏 ▶️/⏹/🕘（原只藏前两个）。
- **打开笔记收起面板**：openNote 统一收起主面板/视频面板/历史弹窗。
- **主面板加载中状态**：refreshPanel 完成前列表显示加载态。

## 4. 样式

- 筛选行/搜索框 padding 24px → 16px 与列表卡片对齐。
- 关闭按钮 ✕ → ❌（主面板/视频面板/历史弹窗三处；全域 11 域已 ❌，文献盒漏网）。
- 全部写 src/literature/styles.css（铁律 8）。

## 5. 门禁

- tsc --noEmit + 全量测试（data/ui/note-gen/clipping 回归）+ 构建。
- 新增测试：list-patch diff（node 纯数据）、文献盒卡片级刷新（滚动保持/增删改）、失败白话化、术语手改确认、整片/剪辑开关、移动端按钮裁剪。
