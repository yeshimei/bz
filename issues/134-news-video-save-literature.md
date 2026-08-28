# Ticket 134：聚合讯视频条目「保存至文献」+ B站跳过行为流静音（grill-with-docs 拍板）

- 状态：进行中（worktree/news-video-save-literature 已合并回 master，与并行落库的文献盒 v3 完成冲突融合）
- 域：news/reader（跨域）→ bili-downloader（文献盒入口与任务元数据）
- 来源：grill-with-docs 拍板（三轮 Q&A 收敛，ADR-0068）
- 关联：`src/news/reader.ts`、`src/bili-downloader/{types,data,ui,index}.ts`、`tests/news/reader-literature.test.ts`、`tests/bili-downloader/{data,ui,index-cov}.test.ts`
- 融合说明（与 ADR-0067 文献盒 v3 并行落库）：本票原新增可选字段 `title/uploader`，v3 已把同名字段做成了 `[bz-info]` 解析落库字段——合并后归一为**同字段双源**（预填写入在前、解析回传覆盖在后）；队列行展示以 v3 的「标题文字链接」形态为准（预填 title 即渲染锚点）；弹窗输入框与 v3 的清晰度/分P 输入框共存；本票 ADR 编号让位改编 ADR-0068。

## 拍板

1. **范围**：仅 B站视频条目（platform='B站' 且 url 非空）把「📥 保存至剪藏」换成「📥 保存至文献」；
   普通文章原样；url 异常缺失的 B站条目回退剪藏按钮。data-action="save" 契约不变。
2. **点击行为**：新增 bili-downloader 导出 `openBiliAddTask(app, {url, title?, uploader?})`——
   ensureBiliTasks → showMain → showAddDialog 预填（无 id = 新增模式）；点击不写剪藏、
   不标已读、不发任何 'news' 域事件；阅读器保持打开停在本篇未读。
3. **弹窗新字段**：添加弹窗新增「视频标题（可选）」「UP主（可选）」输入框（#bili-add-vtitle /
   #bili-add-uploader，手动 ➕ 同样可见）；`BiliTask` 增可选 `title`/`uploader`，旧数据零迁移；
   仅任务元数据（队列行优先展示标题、编辑可改），不进转换流程、外部 CLI 不动。
4. **下一篇静音仅 B站条目**：markAsRead 对 B站条目不发 'news' read 事件（部分推翻 ticket 123
   「跳过也发」，普通文章保留）；news.json 统计照记。
5. **文献盒 added 上报保留**（ADR-0066 既有）：面板内保存任务仍发 'bili-tasks' added 进小橘。
6. 弹窗层级走动态 z-index 机制（并行改造，本票不碰 zIndex）；已知限制：面板开着按 ESC 可能两层同关。

## 验收标准

- a) B站条目底栏按钮「保存至文献」，普通文章「保存至剪藏」；点击 B站按钮 → 文献盒主面板+添加弹窗
     叠开，链接/标题/UP主预填，news.json 无任何写入、无 'news' 域事件、阅读器留在本篇未读；
- b) 手动 ➕ 打开弹窗可见两个新可选输入框；保存后 bili-tasks.json 含 title/uploader；
     队列行有标题显标题、无标题回退链接；编辑回填两个新字段；
- c) B站条目「下一篇/完成阅读」无 'news' 事件且统计照记；普通文章跳过仍发事件（ticket 123 保留）；
- d) 旧 bili-tasks.json（无新字段）读入零迁移不崩；全量测试绿 + tsc + 构建验证。
