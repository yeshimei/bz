# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，23 个域（`src/<域>/` 目录，下表）+ `core` 共享层。**使用中文输出**。

## 命令与构建
- 依赖用 pnpm（勿用 npm）：`pnpm install` / `pnpm run dev`（watch）/ `pnpm run build` / `pnpm test` / `pnpm exec tsc --noEmit`。
- **Git Bash 里 pnpm 起不来**（shim 把路径解析成 `D:\d\...`，报 MODULE_NOT_FOUND）→ 用 PowerShell，或 `node node_modules/<包>/…` 直调。
- 构建产物直出本机 vault 插件目录（`E:/Obsidian/叫我包仔/.obsidian/plugins/bz`，路径硬编码在 `esbuild.config.mjs`），并把 `main.js` 复制回仓库根（GitHub Release 版）。根目录三件套 = main.js / manifest.json / styles.css。
- 测试用 vitest，alias 把 obsidian 换成 mock。
- 开发循环**按域跑** `pnpm test:dom <域>`（~10s）；跨域/多域改动用 `pnpm test:affected`（ADR-0229：只跑受影响 + 扫树守卫，~11–15s；`--list` 只看选择结果、`--since master` 相对主线、`--full` 强制全量、`--no-cache` 关缓存）。输入逐字节没变的文件**复用上次成功结果**（落 `.bz-test-cache/`，gitignored）。
  **别用 `vitest --changed`/`related`**：本仓有测试靠 `readFileSync` 读源码文本断言、没有 import 边，改样式会「命中 0 个且退出码 0」（实测，issue 534）；原生版本只在 `test:changed:vitest` 留作诊断。**增量只是开发循环加速器，合并前仍跑全量 `pnpm test`（~32s）。**
- 皮肤包（ADR-0199）：源在 `src/<域>/skins/<id>.css`，`pnpm split-skins` 切分、`pnpm skin-pack` 出版到 `downloads/skins/`。改了皮肤按**固定顺序** `skin-pack → changelog → manifest` —— 清单 sha256 由 `pnpm manifest` 对**已出版**的 css 现算，顺序错了清单就与产物不一致（插件端校验不过）。`split-skins` / `skin-pack` / `manifest` / `catalog` 都带 `--check`，只校验不写盘（守卫测试复用）。

## 架构
- `src/main.ts`：命令注册、设置页、懒加载。diary 两命令（bz-diary-open / bz-diary-write）在 main.ts COMMANDS 表裸注册（ADR-0004），域内只出回调。
- `src/core/`：共享层。`src/<域>/`：`index.ts` + `data.ts` + `ui.ts` + `styles.css`；带 markup 单源的域另有 `render.ts`。
- **依赖方向（ADR-0002）**：`core ← config/state ← parser ← store ← ui ← main`。禁止模块顶层互访，函数级环引用须延迟解析。
- `src/<域>/skins/*.css`：远端皮肤源，不进构建聚合（`scripts/build-css.mjs` 的 SOURCES 不登记）；每域只有「首套」留在 `src/<域>/styles.css` 作离线兜底。皮肤清单唯一事实源 `scripts/skins.catalog.json`。
- 单源域清单的唯一事实源是 `scripts/build-preview.mjs` 的 `PREVIEW_DOMAINS`（渲染单源）/ `BEHAVIOR_DOMAINS`（行为单源）——**别在文档里抄域名单**。

## 铁律
1. 每次改动走 worktree（从最新 master 分叉，建在主仓库外如 `../.dsh-worktrees/`）；用户明说豁免的小修除外。
2. 命令 ID 三段式：`bz-<域>-<动作>`。
3. 通知正文不带 emoji；新语义先查 `src/core/notice.ts` 的 ICONS 表。
4. 样式写 `src/<域>/styles.css`，构建聚合至根 `styles.css`（根产物是生成物，勿手改）。**滚动条不自造**——bz 界面级单源隐藏（core 通杀，ADR-0122），域内禁 `scrollbar-width: thin/auto` 与自绘 thumb。运行时注入 `<style>` 与内联视觉样式禁止；唯一例外是远端皮肤包，只能在 `src/core/skin-pack.ts` 的**单一注入点**生效，例外不得扩散（有静态守卫测试），要用就得另开 ADR。*（本条在代码注释与 ADR 里的旧编号是「铁律 9」。）*
5. 域 UI 的唯一真理源是**与原型共用的实现源码**（`src/<域>/`）：改源码一处两侧生效，两侧不一致 = 缺陷，禁任一侧私改、禁手改构建产物。详见 `docs/prototype-first.md`。
6. UI 先查手册再动手：视觉取值查 `docs/ui-design-manual.md`，分层与组件库查 `docs/ui-kit-manual.md`（设计手册 → 样式库 `src/core/ui/*.css` → 组件库 `src/core/ui/*.ts` → 域）。域内禁自造按钮/chip/输入基线，需要新视觉**先扩样式库或组件库**，确实无法表达才新增，并回写手册。
7. **未定稿的探索稿一律写 `.scratch/<名>/`**（gitignored，不入 git）：方案对比 / 一次性实验页 / 动效试做 / 探针脚本都不许落进 `src/<域>/`（随构建进插件）与 `prototypes/<域>/`（定稿评审壳）——方案拍板后才按单源口径上岸（详见 `docs/prototype-first.md`）。
8. **用户说「走快速原型」= 不测试、不截图、不验证。** 禁止：任何 `vitest` 跑法（含「只跑当前域」这种自以为克制的版本）、CDP / 无头浏览器探针、壳 `?selftest=1`、读计算样式自证、截图比对。唯一该做的：改完源码 → 开/复用预览服务 → 把网址交给用户，由**用户**判断。门禁（全量测试 / 壳自检 / freshness / tsc）一律推迟到他说「同步」时一次性补。
   （注：改到类型边界时可顺手一次 `tsc --noEmit` 防编译崩——它不是验证步骤，不得据此延后交付。）

## 领域清单（域 id = `src/<域>/` 目录名；未注明者数据均在 CONFIG/STORAGE/）
已上线的 JSON 字段名与结构视为对外契约（老数据要能读），只增不改。

| 域 | 数据 |
|---|---|
| diary（日记本） | 四目录：`我的/日记`、`我的/信`（本域设置键）+ `我的/影视`、`书库`（跨域读影院/书库设置）；条目为 vault 内 md |
| memo（备忘录） | memo.json |
| belongings（归物本） | belongings.json |
| people（脸谱） | 加密保库记录，每联系人一条（kind=people SafeNote，与 encrypt 共锁同库，ADR-0194）；读数据根 `<peopleDataDir>/<联系人>/`（vault 外，明文）；头像为密文附件 |
| clipbook（剪藏本） | news.json（未读流）+ `归档/网页剪藏/*.md` + clipbook.json（侧写） |
| favorites（收藏本） | favorites.json |
| review（复习计划） | review.json、quiz.json（做题家出题）、review-fit.json（FSRS 拟合） |
| secondbrain（第二大脑） | secondbrain.json（meta/panel/队列/链接状态段）+ secondbrain.vec（向量二进制） |
| auto-summary（自动摘要） | 无自有数据文件——写剪藏 frontmatter（摘要/标签）；键名单源 `src/auto-summary/keys.ts` |
| pomodoro（番茄钟） | pomodoro.json |
| attach（附件搬移） | 无自有数据——搬移 vault 内附件；仅记忆上次目标目录（设置键） |
| encrypt（保险库） | `<storagePath>/.ENCRYPT/`（清单 `.safe.enc` + 平铺随机名密文镜像） |
| password-vault（密码本） | 同上 `.ENCRYPT/`（kind=password-vault SafeNote，与 encrypt 共锁同库） |
| bookshelf（书库） | `书库/*.md`（frontmatter tags 含 bookTag；目录可配）+ weave-data.json（EPUB 元数据） |
| cinema（影院） | `我的/影视/*.md`（与日记本共用同目录）；海报落 `CONFIG/MOVIE POSTER`（可配 cinemaPosterFolder） |
| gameshelf（游戏库） | `我的/游戏/《名》.md`（同名消歧加 appid）+ `CONFIG/游戏海报`（可配 gameshelfPosterFolder） |
| knowledge（知识盒） | 三盒：`文献盒/`、`卡片盒/`、`主题盒/`（三键可配，单源 `core/knowledge-boxes.ts`；三盒恒含索引）+ knowledge.json（知识卡片）、mount-suggest.json（挂载建议缓存）；图版图片落 `<文献目录>/assets`（可配 knowledgeImageFolder） |
| smartcat（小橘陪伴猫） | smartcat.json（主数据）、smartcat-memory.json + smartcat-memory-vectors.vec（记忆库）、smartcat-behavior.json（行为流） |
| home（首页） | home.json（入口顺序与显隐）；域入口无独立数据 |
| settings-panel（设置面板） | 插件设置键（域内 schema.ts 定义）；changelog-data.ts 为提交历史生成物，勿手改 |
| checkup（数据体检） | 全域 json 只读巡检（无独立数据文件） |
| recap（今日回顾） | 无自有数据——纯函数库供首页取摘要/周历/连击（面板已退役，ADR-0157） |
| reading-report（阅读报告） | 书库墙面板内视图（ADR-0091，借宿主数据无独立文件） |

## 测试与门禁
- 新功能必须包含数据层 + UI 层测试，`tests/smoke.test.ts` 同步验证。
- 纯数据层测试首行加 `// @vitest-environment node`。
- **门禁全绿**：`pnpm test`（全量）+ `tsc --noEmit` + 自审 + diff 审查 + 构建验证。

## Git / 工作流

- 主分支 `master`，提交遵循 Conventional Commits（**提交信息即更新日志正文**，写法见 `docs/changelog.md`）。
- 工作流：worktree 开发 → `git merge master` 同步底 → 门禁全绿 → 合并回主仓库 → 主仓库 `pnpm run build` 并部署 → 子代理 review → 清 worktree。
- **严禁在 worktree 内构建**（产物直出本机 vault 与仓库根）；`git worktree remove` 后目录常残留 `node_modules`，需另删。
- 提交后跑 `pnpm changelog`（重出 changelog-data.ts + 回写 manifest 版本），不得攒着补——规范见 `docs/changelog.md`。只有 `feat`/`fix`/`perf` 会生成版本块，`chore`/`docs` 不进更新日志（顺序要求见上「皮肤包」）。
- 并行会话占号（issues/ADR 编号）前先查主仓库最新号，防撞车重编号。
- Spec 驱动：拍板结论记 `.scratch/memo-suite-plugin/spec.md`（插件总 spec 索引），任务记 `issues/NN-*.md`，ADR 放 `docs/adr/` 并同步 `CONTEXT.md`。
