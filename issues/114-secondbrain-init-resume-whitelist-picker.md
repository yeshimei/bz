# Ticket 114：第二大脑初始化进度可续 + 白名单目录选择器

- 状态：已合并（master，ticket 113 编号被并行 core 域占用，本票启用 114）
- 域：secondbrain
- 前置：ticket 107（引导态）/ 108（进度视图/增量）/ 111（link agent）

## 背景（用户反馈两处）

1. **首次初始化索引库时关页重开 → 进度全丢**：`startInitialIndex` 置 `initializing=true` 后
   refresh 在后台跑，重开面板 `render()` 只见空库 → 回引导态（「🚀 开始向量化」页面）；
   再点按钮被 `if (this.initializing || this.refreshing) return` 静默吞掉 → **点击无任何反应**。
   且嵌入中途（尤其长库）一旦中断，未写盘的进度全部作废。
2. **白名单录入体验差**：设置页只有「逗号分隔」手写文本框，用户需自己知道文件夹精确名称。

## 任务清单

1. **断点暂存（vector-store）**：`doRefresh` 批量嵌入期间按「时间 ≥5s + 新增完成块 ≥200」
   双阈值触发（`CHECKPOINT_POLICY` 导出可变属性对象供测试收紧），把**槽位全部填满且
   embedding 已赋值**的文件登记入 meta 并 `mergeWrite` 落盘；暂存链 `ckptChain` 串行化防并发写盘；
   最终合并前排空链。`mergeWrite` 与最终写回共用同一实现（未变文件按删除前源偏移拷贝、
   新文件写新向量），**布局不变式零改动、数据格式冻结**。嵌入维度在第一批完成时即确定
   （原实现只在最终注册阶段赋值，导致 checkpoint 在 dim=0 时被挡）。
2. **面板恢复进度视图（panel）**：`render()` 空库分支新增 `store.isRefreshing()` 检查 →
   `enterProgressView('正在初始化向量数据库')` + fire-and-forget `runInitialIndexView()`
   （不 await，避免 panel.open 被永挂的 refresh 阻塞）；`startInitialIndex` 不再静默失效，
   进行中点击 → 接回进度视图；原按钮逻辑抽为 `runInitialIndexView` 共用（点击/重开两路）。
3. **白名单目录选择器（新文件）**：`whitelist.ts` 纯函数（parsePathList/formatPathList/
   normalizeSelection——祖先已选去冗余后代/collectFolderInfos——每级祖先+根级单文件聚合计数）；
   `whitelist-modal.ts` 弹窗（搜索过滤 + checkbox 目录树 + 已选 chips ✕ + 清空/全选/确定，
   z-index 11200/11201 companion 档，escManager 注册，遮罩/ESC 取消不保存）；
   设置页「白名单目录」行 = 文本框 + 📁 选择按钮 + chips 预览，「关联范围」行同样加 📁 按钮；
   存储格式不变（仍逗号分隔字符串），兼容冻结零破坏。
4. **测试**：whitelist 纯函数（node）+ vector-store 断点暂存（A 嵌完落盘→新 store 从磁盘恢复
   →补嵌 B）+ onboarding-ui 重开恢复进度视图 + index-cov FakeVectorStore 补 isRefreshing。

## 明确不做

首屏长任务取消按钮｜暂停/续传接口｜进度持久化到独立文件（meta 即进度源）｜移动端专用选择器（复用同一弹窗）。

## 验收门禁

- [ ] Ticket验收 + 契约不破坏（数据格式/文案/CSS/命令零变更审查通过）
- [ ] pnpm test 全绿（含新用例）+ pnpm exec tsc --noEmit 0 错误
- [ ] 构建验证通过，产物部署后真机冒烟（首次初始化关页重开恢复进度 / 白名单 📁 选择入库生效）