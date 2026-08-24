# ADR-0048：影视分析报告迁出为独立域（src/movie-report/）

日期：2026-08-25 ～ 状态：Accepted ～ 关联：ADR-0003（单插件多域）、ADR-0002（依赖方向）、铁律 2（命令 id 外部裸调用约定）、铁律 5（域间显式 import）

## Context

影视分析报告原为 movie 域内模块：`src/movie/analysis.ts` 承载全部统计与渲染，入口有二——命令 `bz-movie-report` 经 `src/movie/index.ts` 的 `openMovieReport`（`ensureMovie` + `openAnalysisModal`），以及影视主界面头部 📊 按钮直调 `openAnalysisModal`。用户拍板：与 reading-report 同构，**报告自成一个功能域**。

## Decision

1. 新建 `src/movie-report/` 三件套：`index.ts`（`ensureMovieReport` / `openMovieReport` / `unloadMovieReport`）+ `analysis.ts`（自 movie 域全量迁入，统计公式/配色/文案逐字不动）+ `state.ts`（本域目录态）。
2. 命令 id `bz-movie-report`、名称「影视分析报告」、icon **不变**（外部裸调用契约冻结）；main.ts COMMANDS 表拆出独立「影视分析报告」分节；onunload 增 `unloadMovieReport()`。
3. 解耦点：`buildAnalysisData` 不再读 `movie/state` 的 `M.folderPath`，改读本域 state——`ensureMovieReport` 时自设置 `movieFolderPath` 解析一次，「重启生效」语义与 movie 域一致。
4. 跨域引用保持显式且无环：`movie-report/analysis → ../movie/constants`（纯数据常量）；`movie/ui.ts` 📊 按钮 → `../movie-report/analysis`（`openAnalysisModal`）。ESC 键名 `movie-analysis` 不变。
5. 报告独立打开不再连带 `ensureMovie`（不注册面板自动刷新监听、不写 `__MOVIE_FOLDER_PATH` 遗留全局）——报告窗口自身可见行为不变。
6. 移动端默认全屏沿用 movie 键（2026-08 用户拍板：聚合讯/阅读报告/影视分析类跟随窗口不设独立开关）。
7. 测试随迁 `tests/movie-report/`（analysis.test.ts / analysis-cov.test.ts），目录态断言由 `M.folderPath` 改为本域 `setReportFolderPath`。

## Consequences

- `src/movie` 不再导出 `openMovieReport`，职责收敛为管理面板本体。
- 报告可不经影视面板独立懒加载（命令直达即只装本域），粒度更细。
- 功能域计数 21→22：README、manifest 描述、CONTEXT.md 词条同步。
