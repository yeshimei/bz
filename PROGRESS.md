# PROGRESS — 包仔（bz）插件开发进度

> 进度同步总表（AGENTS.md）。每票一节，状态：计划中 → 进行中 → 门禁 → 已交付。

## Ticket 136 — 文献盒改版（literature 域 / 术语生成 / AI 回迁 / 去网页版）

**状态：已交付（含终审全项闭环）**

- [x] 设计定稿（grill-with-docs 五轮拍板，契约见 `issues/136-literature-box-redesign.md`）
- [x] 文档：ADR-0071（AI 回迁+去网页版）/ ADR-0072（新域迁出+literature.json）/ ADR-0073（type+domain）
- [x] CONTEXT.md 词条更新（文献盒/B站下载/快速流程/文献笔记/文献类型/领域/术语文献/文献目录）
- [x] Worktree A `worktree/tools-literature`：CLI 去 AI 去网页版、转录临时文件、压缩步骤 → 已合并 master（531bcd2）
- [x] Worktree B `worktree/literature-domain`：src/literature 域全量实现 + 集成 + 测试 + 构建 → 已合并 master（77e9222）
- [x] 全量测试绿 + tsc 0 错 + 构建通过 + 部署产物与仓库一致
- [x] 命令：bz-literature-open（文献盒）/ bz-literature-note-term（术语生成文献笔记）；移除 bz-bili-open / bz-bili-tasks-open
- [x] 独立终审（46172556）：P1×4（bz-bili 样式恢复/backfill type 回滚/instanceof 字符串/术语确认重跑 AI）+ P2×4 + P3×5 全部闭环

## Ticket 138 — 文献盒 UX 修复与增强（用户实测反馈）

**状态：已交付**

- [x] 规格：`issues/138-literature-ux-fixes.md`
- [x] 硬 bug：openTermNote 改 getActiveViewOfType(MarkdownView)（修 instanceof）；ensureLiterature 失败可重试 + createMainUI 自愈（点两次才打开）；backfill AI 25s 超时跳过（补全不卡批）
- [x] 术语流程：generateTermDraft 纯 AI 预览不落盘；确认写入 generateTermNote 传面板值所见即所得、不重跑 AI
- [x] 主面板 UI：emoji 按钮 📝🎬、🔍 前移、去类型分类栏、去类型徽章、样式对齐日记本、loadNotes 递归
- [x] worktree/literature-ux 3 提交合并 master（dc8728e）+ 全量 218 文件/3468 用例绿 + 构建部署

## Ticket 139 — 文献盒 UX 二轮（用户清单拍板 10 项 + 关闭按钮统一）

**状态：已交付**

- [x] 规格：`issues/139-literature-ux-round2.md`（spec.md「文献盒 UX 二轮」节同步）
- [x] 交互：📝/🎬 子面板叠开不隐藏主面板（关闭子面板回列表）；openNote 收起文献盒全部窗口
- [x] 增量刷新：新增 core/list-patch.ts 键控卡片 diff；literature + clipping 文件事件只 patch 差异卡片（滚动不跳顶）；diary/movie 单列后续
- [x] 视频队列：失败原因白话化（humanizeError，原文在 title）+ 失败卡片点击进编辑弹窗带原因提示条；移动端仅 ➕ + ❌；移动端默认全屏补齐
- [x] 弹窗：添加任务「整片/剪辑」分段开关 + 校验失败聚焦 + Enter 提交；术语面板重设计（输入同行/状态行/预览卡片化）+ 重新生成手改确认
- [x] 样式：筛选/搜索留白 16px 对齐卡片；关闭按钮 ✕→❌ 三处统一；加载中占位
- [x] worktree/literature-ux-139 合并 master（1e340df）+ 全量 219 文件/3484 用例绿 + tsc + 构建部署

## Ticket 140 — 收藏本抽屉归档（纯冷存，ADR-0074）

**状态：已交付**

- [x] 规格：`issues/140-favorites-archive.md`（grill-with-docs 五轮拍板 Q1-Q8）
- [x] 抽屉动作序：打开 → 置顶 → 跳转笔记 → 刷新余额 → 编辑 → 归档 → 删除；归档 openFlowDialog 确认 → archived+archivedAt 落盘 → 冷存消失 + 📁 toast + 观察流「你归档了收藏《X》」
- [x] 冷存全排除：主列表/搜索/标签计数/批量余额（refreshData 唯一装载点过滤，data.ts 零改动零迁移）
- [x] 文档：ADR-0074（归档=纯冷存不可见）+ CONTEXT.md「归档」词条 + 收藏本动作序更新
- [x] worktree/favorites-archive 合并 master（263b47e）+ 全量 219 文件/3493 用例绿 + tsc + 构建部署


## Ticket 141 — 小橘「对话即操作」助手（待实现计划）

**状态：计划中**（仅记录需求 + 设计概要 + 待拍板项，未实施）

- [ ] 需求：小橘聊天说一句话（如「添加关于黑洞的文献笔记」）→ 直接调用对应域函数生成产物，无需打开域面板
- [ ] 设计：三层结构——① 技能注册表（每域动作 = 一条技能：detect/execute/confirm?/summary，新域接入零改聊天主流程）② 意图识别（词法快路径 + AI 慢路径兜底，不命中则照常聊天）③ 执行与反馈（复用域既有函数落盘 + emit 域事件入行为流 + 结果注入 AI 回复 + 自动打开产物）
- [ ] 边界：数据格式零变化、域事件契约复用（与 UI 手动生成同口径）、命令单点不动、纯增量
- [ ] 待拍板：直接执行 vs 预览确认／参数缺失行为（多轮追问/开面板/不执行）／V1 范围（文献盒+备忘录 / 仅文献盒 / 多域）
- [ ] 详细记录：`issues/141-smartcat-agent-assistant-plan.md`

## Ticket 142 — 术语生成文献笔记面板简洁版（用户逐条拍板）

**状态：已交付**

- [x] 规格：`issues/142-term-note-panel-simple.md`（spec.md「术语生成面板简洁版」节同步）；原型 `.scratch/term-note-panel/index.html`（方案 A 属性表定稿，.scratch 不入库）
- [x] 删：弹窗标题（bz-win-head 整行）/「术语」label / 输入框 placeholder / 输入框下红色提示小字（生成中状态行并入按钮「生成中…」，输入行下方无文字）；「类型」行不展示
- [x] 预览只读：领域 input / 简介 textarea 删除，上属性卡（术语/领域/日期）下内容卡，无「属性/内容」区标题
- [x] 「重新生成」手改守卫删除（ticket 139 的 flow-dialog 确认随预览只读一并移除）；确认写入仍传面板 term+预览值（所见即所得不重跑 AI）
- [x] 测试改写：无标题/label/placeholder/状态行断言 + 预览只读 input/textarea 为空断言 + 重新生成直接覆盖无守卫用例；全量测试绿 + tsc 0 错 + 构建部署

## Ticket 143 — 文献盒桌面窗口简洁版（用户拍板：主面板/视频录入保留标题；worktree 交付）

**状态：进行中 → 已交付**

- [x] 规格：`issues/143-literature-simple-layouts.md`（spec.md「文献盒桌面窗口简洁版」节同步）；原型 `.scratch/literature-minimal/index.html` 每窗 4 套布局走查后全部拍板 A（.scratch 不入库）
- [x] 主面板/视频录入：**保留原标题**（用户拍板），仅搜索框简洁化（去 placeholder，盒内 🔍 图标）
- [x] 历史：去标题，工具栏 = 「🕘 历史 · 共 N 条」+ ❌；组头去「UP主」前缀与「N 条笔记」计数；笔记行 `shortNoteName` 去目录去 .md；时间 `formatRelativeTime` 相对显示
- [x] 添加任务：去 h4 标题（编辑态右上角 `#lit-add-mode` 标签）；链接输入 label + 整片/剪辑开关同行；新任务默认剪辑片段（编辑按 start/end 回显）；分P 去括号；去 placeholder；失败提示条红色 → 中性化
- [x] 移动端：表单行 / 链接行折单列，每行一个输入框
- [x] 测试：新增 4 用例 + 改写默认剪辑/mode 标签/历史路径与标题断言；全量测试绿 + tsc 0 错 + 构建部署（worktree/literature-simple → master 合并）

## Ticket 144 — 全站 UX/UI 批次第一波（19 域审查拍板，分波交付）

**状态：第一波已交付；待办归档见 issues/144-ux-batch.md**（原编号 141 与并行会话撞号重编；代码提交信息保留旧号）

- [x] core：notifyUndo/notifySaveError/confirmDiscard helper + toast action 按钮减重
- [x] review：flow-dialog 迁移 / ESC 层级 / 搜索防抖 / 移出可撤销 / 通知类型修复 / 样式收敛
- [x] quiz：普通模式删除（纯复习会话语义）/ 键盘快捷键 / 去 800ms 强制跳题 / 对错计数 / 样式收敛
- [x] secondbrain：对话可取消+流式 / 历史持久化+清空 / 多行输入 / 移动端吞错修复 / 移除 AI 生成概括 / ESC 层级
- [x] favorites：分页 / 排序（favoritesSortKey 设置键）/ 搜索空态区分 / 删除可撤销 / 保存防假死 / 脏表单拦截 / 样式收敛
- [x] 全量 221 文件 / 3528 用例绿 + tsc 零错误；待办（真 Bug 剪藏/影视、通病接入、加密盒/密码/番茄钟/聚合讯/小橘/自动摘要/影视报告/阅读报告）见 issues/144-ux-batch.md
