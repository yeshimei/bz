# 70 — 铁律 9 改为「CSS 按域拆分」：src/<域>/styles.css + 构建聚合

**What to build:** 把铁律 9 从「所有视觉样式收敛根 styles.css」（ticket 60）改为**样式按域拆分**：
1. 源文件布局：`src/<域>/styles.css` ×14（diary/launcher/memo/news/clipping/password/favorites/review/quiz/pomodoro/library/attach/encrypt/movie）+ `src/core/styles.css`（共享层/跨域：设置页分页、主窗口头部行统一规范、core 层 notice/settings-modal/confirm/dom、移动端主窗口默认全屏、统一右键菜单/长按抽屉）。原 2979 行单文件 22 分节逐字切块，零改写。
2. 构建：新 `scripts/build-css.mjs` 按 SOURCES 清单顺序聚合成根 `styles.css`（构建产物勿手改）并同步插件目录；`npm run build` 一次聚合、`npm run dev` 接 fs.watch(src/**) 监听 CSS 变化自动重新聚合。
3. 安全性：无损校验（按原序重组 byte-identical；去注释规则行排序 2664=2664）+ 跨节选择器审计（!important 支配对 / 互不冲突复合选择器 / slideUp 五处同义），级联行为不变。
4. 文档同步：AGENTS.md（铁律 9 重写/架构行/主窗口样式规范引用）、CONTEXT.md（新术语「样式按域拆分」+ Rules + 密码本词条去「含样式注入」）、spec.md（构建/样式/CSS 规模三处）、encrypt-suite spec 铁律 9 行、ADR-0020、PROGRESS.md、本 issue。

**Status:** done

## 变更面

- `scripts/build-css.mjs`（新增）、`esbuild.config.mjs`（接线 buildStyles/watchStyles）
- `src/{core,diary,launcher,memo,news,clipping,password,favorites,review,quiz,pomodoro,library,attach,encrypt,movie}/styles.css`（新增 15 个源文件）
- `styles.css`（变为构建聚合产物，内容重排 + 新文件头）
- 文档：AGENTS.md、CONTEXT.md、`.scratch/memo-suite-plugin/spec.md`、`.scratch/encrypt-suite/spec.md`、PROGRESS.md、`docs/adr/0020-styles-split-by-domain.md`、本 issue
- 测试：无样式表断言，不需改动（tests 仅注释提及 styles.css）

## 决策要点

- 拆分粒度 = 每域一文件 + 共享层一文件；不再复活 ticket 60 废止的运行时注入模式（Obsidian 只加载一个 styles.css，聚合在构建期完成）。
- 根 `styles.css` 保留入库（构建产物提交），保证仓库内所见即 Obsidian 所载；手改会被下次构建覆盖，规则文本明确「勿手改」。
- 拼接顺序沿用原文档顺序（共享节前置），不做字母排序——把顺序敏感性压到零。