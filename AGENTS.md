# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，21 功能域（详见领域清单）。**使用中文输出**。

## 命令与构建
- `pnpm install` / `pnpm run dev` / `pnpm run build` / `pnpm test` / `pnpm exec tsc --noEmit`（依赖用 pnpm，勿用 npm）
- 构建产物直出 Obsidian 插件目录（esbuild 硬编码），根目录三件套用于 GitHub Release。
- 测试用 vitest，alias 替换 obsidian 为 mock。

## 架构
- `src/main.ts`：命令注册、设置页、懒加载（命令量以代码为准；diary 两命令（bz-diary-open/bz-diary-write）均在 main.ts COMMANDS 表注册（ADR-0004 裸注册通道），域内仅出回调）。
- `src/core/`：共享层；`src/<域>/`：index + data + ui + styles.css。
- **依赖方向（ADR-0002）**：`core ← config/state ← parser ← store ← ui ← main`。禁止模块顶层互访，函数级环引用须延迟解析。

## 铁律
1. 每次改动必须走 worktree（用户明说豁免的小修除外，详见 Git 工作流）。
2. 命令 ID 三段式：`bz-<域>-<动作>`。
3. 通知正文不带 emoji，新语义先查 `src/core/notice.ts` ICONS。
4. 样式写 `src/<域>/styles.css`，构建聚合至根 `styles.css`；**滚动条不自造**——bz 界面级单源隐藏（core 通杀，ADR-0122），域内禁 `scrollbar-width: thin/auto` 与自绘 thumb。
5. 域 UI 的唯一真理源是与原型共用的实现源码——样式 / 渲染 / 行为八域全单源（详见 `docs/prototype-first.md`）。
7. **未定稿的探索稿一律写 `.scratch/<名>/`**（gitignored，不入 git）：方案对比 / 一次性实验页 / 动效试做 / 探针脚本都不许落进 `src/<域>/`（随构建进插件）与 `prototypes/<域>/`（定稿评审壳）——方案拍板后才按单源口径上岸源与原型（详见 `docs/prototype-first.md`）。
8. **用户说「走快速原型」= 不测试、不截图、不验证**（2026-09-24 定为铁律，此前反复犯）。
   禁止：任何 `vitest` 跑法（含「只跑当前域」这种自以为克制的版本）、CDP / 无头浏览器探针、
   壳 `?selftest=1`、读计算样式自证、截图比对。
   唯一该做的：改完源码 → 开/复用预览服务 → 把网址交给用户，由**用户**判断。
   门禁（全量测试 / 壳自检 / freshness / tsc）一律推迟到他说「同步」时一次性补。
   （注：改到类型边界时可顺手一次 `tsc --noEmit` 防编译崩——它不是验证步骤，不得据此延后交付。）

## 领域清单（数据均在 CONFIG/STORAGE/）
| 域 | 数据 |
|---|---|
| diary（日记本） | `我的/日记/*.md` |
| memo（备忘录） | memo.json |
| belongings（归物本） | belongings.json |
| clipbook（剪藏本） | news.json（未读流）+ `归档/网页剪藏/*.md` + clipbook.json（侧写） |
| favorites（收藏夹） | favorites.json |
| review（复习） | review.json |
| secondbrain（第二大脑） | secondbrain.json + secondbrain.vec |
| auto-summary（自动摘要） | 剪藏 frontmatter |
| pomodoro（番茄钟） | pomodoro.json |
| attach（附件） | 搬附件 |
| encrypt（保险库） | `CONFIG/.ENCRYPT/` |
| password-vault（密码本） | `CONFIG/.ENCRYPT/`（kind=password-vault SafeNote，与 encrypt 共锁同库） |
| bookshelf（书库） | `书库/*.md`、EPUB |
| cinema（影院） | `我的/影视/*.md` |
| gameshelf（游戏库） | `我的/游戏/*.md` |
| home（首页） | 各域命令入口 |
| literature（知识盒） |  |
| settings-panel（设置面板） | 插件设置键（域内 schema.ts 定义） |
| checkup（数据体检） | 全域 json 只读巡检（无独立数据文件） |
| reading-report（阅读报告） | 书库墙面板内视图（ADR-0091，借宿主数据无独立文件） |
| recap（回顾） | ADR-0157 面板已退役（summary 纯函数库保留，供 home 消费） |
| smartcat（小橘） | STORAGE/smartcat |

## 测试与质量门禁
- 新功能必须包含数据层+UI层测试，smoke.test.ts 同步验证。
- 纯数据层测试首行加 `// @vitest-environment node`。
- **门禁全绿**：pnpm test + tsc --noEmit + 自审 + diff 审查 + 构建验证。

## Git / 工作流

- 主分支 `master`，提交遵循 Conventional Commits。
- worktree 建在主仓库父级外（如 `../.dsh-worktrees/`），从最新 master 分叉。
- 工作流：worktree 开发 → `git merge master` 同步底 → `pnpm test`/tsc/自审/diff 审查全绿 → 合并回主仓库 → 主仓库 `pnpm run build` 并部署 -> 子代理 review。
- 严禁在 worktree 内构建。
- 部署后清理 worktree。
- 并行会话占号（issues/ADR 编号）前先查主仓库最新号，防撞车重编号。
- Spec 驱动：先更新 `.scratch/memo-suite-plugin/spec.md`，任务记 `issues/NN-*.md`，ADR 放 `docs/adr/` 并同步 `CONTEXT.md`。