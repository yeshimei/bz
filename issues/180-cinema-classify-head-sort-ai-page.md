# Ticket 180 — 影院（cinema）分类交互重构 + AI 页内化 + 哥伦比亚剧分类

> 状态：✅ 已完成并部署（2026-09-03）
> 提交：f66753a（worktree/cinema-classify-head-sort，feat 源码+测试）→ 71247ab（合流 master）→ 构建产物已直出（main.js/styles.css/manifest.json）
> 门禁：worktree 全量 246 文件 3911 用例全绿 + tsc 0 错误；合流后主仓 cinema+smoke 55 用例绿；构建通过
> 流程：grill-with-docs 轮询拍板（全部/单选切换模型、排序三档、AI 页内化、哥伦比亚剧）→ worktree 开发 → 合并 → 构建部署 → worktree 清理
> 数据：vault《百年孤独》.md tag `- "#美剧"` → `- 哥伦比亚剧`（顺带修正全库唯一带 #+引号的错误 tag 写法）

## 一、左栏分类模型（对齐待办 todo 心智）

- 类型区顶部加「全部」（默认选中、无圆点、带总数）；点组 = 筛该组并**展开其二级**（其余组手风琴收起）；
- **再点同组不取消**（回全部靠「全部」）；点二级 = 筛该二级（组跟随选中、二级容器保持展开）；**再点同二级 = 回到该组全部**（清二级、保持组）；点其他组/全部 = 收起二级。
- 状态区（想看/在看/已看）同样顶部加「全部」默认项，单选切换；状态再点已选 = 可取消回全部（类型组则不能，因「全部」在顶部）。
- 移动端分类横滑条同样顶部「全部」chip + 组/状态 chips；类型 chip 选中 = 筛该组（或组内二级）。

## 二、主头行 + 排序（右侧内容区）

- 搜索框上方新加主头行（对齐 todo `.bz-todo-main-head`）：**标题 = 当前筛选名**（全部/组名/二级名，跟随筛选）+「· N 部」灰色小字（计数随当前筛选+搜索+排序）+ 右侧「添加影视」主按钮。
- 搜索框后加**排序 segmented**（组件库 uiSegmented）：最近观看（date，默认）/ 按创建（created，文件 mtime 倒序）/ 按评分（rating，已看评分高→低、未看靠后）。移动端隐藏（同待办）。
- data.ts：新增 `applySortMode` / `sortByCreatedDesc` / `sortByRatingDesc`，`getDisplayItems` 先筛选后排序。
- 之前定稿记忆里「排序功能用户明确不用」——本次用户反转需求补上。

## 三、AI 荐片页内化（不弹窗）

- 点 AI 入口（左栏工具/移动头钮/引导页开始按钮）→ 立即切到 AI 页 → **等待消息就地在页内显示**（不再 notify/notice 顶栏进度）→ 完成后**结果列表直接渲染在页内（原窗口）**，不再弹结果窗。
- 状态落 `M.aiRunning / aiWaitMsg / aiResult / aiError`；renderAiPageHtml 分待机引导/运行中等待/完成列表/失败（含重试）四态。
- `showResultWindow`（弹窗）与 notify 动态通知整段删除；结果卡「加入想看」按钮保留（quickAddWant），事件改走 overlay 委托 `[data-rec-add]`。
- recommend.test 同步改为页内断言（无 mask / 无 notice）；ui.test AI 页切页后等异步收尾再断言仍在页内无弹窗。

## 四、哥伦比亚剧分类 + 笔记修正

- 事实：**《百年孤独》是 2024 Netflix 哥伦比亚西语剧**（导演劳拉·莫拉·奥尔特加/卡洛斯·莫瑞诺，片源用户正看 S02E05 佐证）。
- 代码：`src/cinema/constants.ts` 剧集 TYPE_GROUPS 与 GROUP_SUBS 尾各加 `'哥伦比亚剧'`（**只改 cinema 域**；movie 旧域不动）。
- 笔记：vault `我的/影视/《百年孤独》.md` 原 `tags: - "#美剧"`（全库唯一带 #+引号写法，cinema 精确匹配 tags.includes('美剧') 会失败 → 该片当前实际落「其他」组）→ 改为 `- 哥伦比亚剧` 规范写法。
- 用户拍板只改《百年孤独》1 篇；其余 6 部拉美西语影视（饥饿站台1/2、看不见的客人、荒蛮故事、我是谁、书店、寻梦环游记，均 tag=电影）不动。

## 遗留 / 备注
- 旧 worktree `../.dsh-worktrees/movie-category-ai`（残留尝试在旧 movie 域加「拉美剧」，与本次拍板不符）未动，用户可自行决定是否清理；其分支未合入。
- AI 页内状态仅内存级，切走列表再切回 AI 页会回到待机引导（结果不持久）——符合「页内一次分析」预期。
