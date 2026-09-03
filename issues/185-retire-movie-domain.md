# 185 — 退役旧 movie 域（并入 cinema，ADR-0087）

## 背景
cinema（影院新域）自原型一比一复刻后已完整承载影视目录/海报墙/状态流转/评分/AI 荐片/分析报告能力，命令 bz-cinema-open/bz-cinema-add 活跃。旧 `src/movie/`（影视域）命令 bz-movie-open/bz-movie-add 与 UI 并存但入口已被 cinema 取代。

## 用户拍板决策（2026-09-04）
1. **彻底删 movieFolderPath 设置键**：cinema 目录 = cinemaFolderPath（显式配置）→ 回落默认「我的/影视」。
2. **保留独立 movie-report 命令**（bz-movie-report / pie-chart / 报告 tab）。
3. **poster 轮询迁入 cinema**：添加后显示占位 + progress「正在获取海报…」通知，外部 watcher 写入后 vault modify 自动刷新替换为真实海报。
4. **runSimilarRecommend 迁入 cinema**（详情弹窗「找同类」按钮，结果页内渲染）。
5. cinema 补发 `movie:` 域事件（保 smartcat 小橘行为流）。

## 变更
- **cinema 增强**：
  - `state.ts`：导出 DEFAULT_FOLDER='我的/影视'；state 加 aiTitle（AI 页标题区分荐片/找同类）
  - `index.ts`：目录回落 cinemaFolderPath → DEFAULT_FOLDER；自动刷新订阅去掉 movie:file-*（只留 cinema:file-* + vault:md-*）
  - `poster-watch.ts`（新）：自旧 movie/poster-watch.ts 迁入（纯 core/notice 依赖）
  - `recommend.ts`：迁入 runSimilarRecommend/buildSimilarPrompt（页内化渲染，不弹窗）；quickAddWant 建笔记后发 movie:created(want) + poster 轮询通知
  - `ui.ts`：新增/快速状态窗/删除动作补发 movie 域事件（created/status/rated/review/deleted，对齐旧 movie 语义与 smartcat MovieActionEvent 契约）；详情弹窗加「找同类」按钮；AI 页标题用 M.aiTitle
- **删除 src/movie/**：constants/data/index/poster-watch/recommend/state/ui/styles.css
- **main.ts**：删 bz-movie-open/bz-movie-add 命令与 unloadMovie
- **settings-panel/ui.ts**：删 movie tab（loader + DOMAINS），cinema tab desc 改「影视目录与海报（ADR-0087 接管影视）」
- **settings.ts**：删 movie* 键（movieFolderPath/moviePageSize/movieDefault*/movieRatingDisplay/movieMobileDefaultFullscreen）；cinemaFolderPath 默认改 '我的/影视'
- **path-classify.ts**：影视目录归 cinema（缺省回落）；movie 语义仅靠 movieDirectory（日记本键）
- **memo/todo/data.ts**：公开课扫描目录键 movieFolderPath → cinemaFolderPath
- **movie-report**：import 改引 cinema/constants（ALL_TAGS/getGroupForTag/STATUS 兼容）；目录读 cinemaFolderPath 回落；全屏键 cinemaMobileDefaultFullscreen
- **build-css.mjs**：SOURCES 删 src/movie/styles.css
- **测试**：删 tests/movie/；entries-extra/main-lifecycle/settings-copy-lint-c/smoke/obsidian-adapter/mobile/settings-panel/path-classify/memo/todo/movie-report 同步；新增 tests/cinema/poster-watch.test.ts、index.test.ts（目录回落+事件）、recommend.test.ts 追加找同类

## 门禁
pnpm test 232 文件 3692 用例全绿 + tsc 0 错误 + pnpm run build 通过。

## 后续
library / password 旧域退役待保险箱原型定稿后统一处理（见 ADR-0086/issue 184「后续」）。
