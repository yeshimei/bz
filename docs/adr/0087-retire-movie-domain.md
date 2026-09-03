# ADR-0087：退役旧 movie 域，能力并入 cinema

- 状态：已接受（2026-09-04）
- 关联：ADR-0086（news/clipping 退役）、issue 185

## 背景
cinema（影院新域，原型一比一复刻）自交付起已完整覆盖影视目录/海报墙/状态流转/评分/AI 荐片/分析报告等能力，且入口命令活跃。旧 `src/movie/`（影视域）只剩余 UI 并存与重复命令，用户已在多轮迭代中把全部使用迁移到影院。

## 决策
1. 删除 `src/movie/` 整目录（8 文件 + styles.css）与命令 bz-movie-open/bz-movie-add。
2. **目录语义统一**：影视目录唯一由 `cinemaFolderPath` 承载（显式配置 → 回落「我的/影视」）；删除 `movieFolderPath/moviePageSize/movieDefault*/movieRatingDisplay/movieMobileDefaultFullscreen` 设置键。
3. **能力迁入 cinema**：
   - poster 抓取轮询（watchPosterFetch + progress 通知收尾）迁入 `src/cinema/poster-watch.ts`；
   - 找同类 AI（runSimilarRecommend/buildSimilarPrompt）迁入 `src/cinema/recommend.ts`，结果页内渲染（对齐影院 AI 页内化口味，不弹窗）；
   - 域事件补发：cinema 新增/快速状态窗/删除动作发 `movie:` 事件（kind=created/status/rated/review/deleted，载荷对齐 smartcat MovieActionEvent 契约），小橘行为流不中断。
4. **保留独立 movie-report 域**（ADR-0048）：报告命令 bz-movie-report 不变，仅其常量依赖改引 cinema/constants（ALL_TAGS/getGroupForTag/STATUS 值兼容且 cinema 更完整），目录/全屏键随 cinema。
5. path-classify：影视目录（缺省）归 cinema；movie 归类仅保留 movieDirectory（日记本键）语义，供 diary 侧区分。

## 理由
- 单入口单一实现：影视维护只动 cinema，不再维护两套并存 UI 与常量。
- 用户显式拍板（2026-09-04）：删 movieFolderPath、迁 poster/找同类、保 movie-report 命令。
- 事件契约与数据格式（frontmatter 海报/评分/观影日期、外部 douban-poster watcher）零改动，生态不破。

## 后果
- settings-panel：影视 tab 由 cinema 承接；movie tab 删除。
- 备忘录/待办「公开课」扫描目录键改读 cinemaFolderPath。
- 旧 data.json 残留 movie* 键被接口收窄后自然忽略。
- 相关测试删除/迁移；cinema 测试新增 poster-watch / 找同类 / 目录回落 / 事件补发覆盖。
- library / password 旧域退役另行处理（待 encrypt 保险箱原型定稿后统一，见 ADR-0086 后续）。
