# 177 · 剪藏本×聚合讯融合（新域 clipbook）

- 状态：done（2026-09-03 已交付部署，commit 585b3b8/09a87b6/ad9b1e7）
- 分支：worktree/clipbook（已合并清理）
- 来源：.zcode/ui-prototypes/clipping-prototypes/clipping-p3-siteboxes.html（用户拍板三栏融合交互原型）
- 设计文件：docs/adr/0082-clipbook-news-clipping-merge.md

## 背景

news（聚合讯）与 clipping（剪藏本）是两个割裂的旧域：聚合讯是「外部守护进程写 news.json，插件逐篇阅读器处理（保存→写剪藏笔记）」，剪藏本是「纯扫剪藏目录 .md 的展示面板」。用户拍板融合成单一「剪藏本」工作台：聚合讯未读自动进收件流，中意内容一键「保存到剪藏本」转正式剪藏——同一面板内完成，无窗口跳转无割裂。旧域交付后可能删除（本票不动旧域，保留并存）。

## 交付范围

- 新域 `src/clipbook/`（桌面三栏工作台 + 移动端双屏），数据源 = news.json（聚合讯流）+ 剪藏目录扫描，操作闭环写入 news.json。
- 命令 `bz-clipbook-open`「剪藏本」（icon scissors），替换旧 `bz-clipping-open`/`bz-news-open` 两入口。
- 设置面板新增 clipbook 域（剪藏目录/批次/移动端全屏 + 数据源组 + 自动摘要组），隐藏 clipping/news 域条目（noSettings 保留可见性语义；入口命令仍可触发但指向新面板——开关语义与本票无关，无冲突）。
- 测试：数据层（状态机/合并/保留）+ UI 层（三栏/移动/保存流）+ smoke 同步。
- 文档：AGENTS.md 领域清单行、CONTEXT.md 词条、本 issue、ADR-0082。

## 设计要点（详见 ADR-0082）

- **数据模型**：news.json 不新增段。插件在 clipbook.json 维护 { articleOverrides, order, savedArchive } 侧写；文章字段裁剪器 `clipArticle` 输出轻量视图 {id,title,url,date,fetchedAt,platform,author,src,upName,body,summary,tags,st}，st ∈ unread/reading/read/saved 派生（saved = news.json read+state==='saved' 或侧写 savedArchive 残留；url 命中剪藏目录 → 保底 saved）。
- **状态机**：reading/read/saved 落侧写；saved/skipped 同步回写 news.json 文章（read=true,state,删 body,stats 计数），保留 news:read/saved 域事件（smartcat 行为流依赖）与 news-stats 迁移。
- **UI**：桌面 1280×800 三栏——左 rail（全部未读+三平台+B站按 UP 展开+剪藏本聚合，unread/总数徽标，底部「阅读分析数据」→ 打开 bz-reading-report-open）；中栏标题+摘要（状态点 蓝/琥珀/空心/绿，右键菜单：保存到剪藏本/移出/标记已读/在读/打开笔记/查看原文/删除）；右栏阅读（站点/标题/时间/状态 flag/摘要卡/正文）；移动端 375 全屏：屏1 源胶囊+列表，屏2 详情+头栏保存钮。组件库/uiModal 系（.bz-clip-* 前缀 + --bz-* token）。保存写 `归档/网页剪藏/<cleanTitle>.md`（frontmatter+dataviewjs 块，逻辑迁自 news/reader.ts saveToClip）；B站视频条目保存分流文献盒（ADR-0068）。
- **迁移面**：UP 名单管理/数据源组/剪藏 frontmatter 解析/站点域名图标/保留策略/双写者合并 等逻辑迁入或函数 import；旧域文件保留不删不改。
- **验证门禁**：pnpm test + tsc --noEmit + 主仓 build 直出部署。
