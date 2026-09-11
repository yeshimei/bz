# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，21 功能域（详见领域清单）。**使用中文输出**。

## 命令与构建
- `pnpm install` / `pnpm run dev` / `pnpm run build` / `pnpm test` / `pnpm exec tsc --noEmit`（依赖用 pnpm，勿用 npm）
- 构建产物直出 Obsidian 插件目录（esbuild 硬编码），根目录三件套用于 GitHub Release。
- 测试用 vitest，alias 替换 obsidian 为 mock。

## 架构
- `src/main.ts`：命令注册、设置页、懒加载（命令量以代码为准，另有 diary 写日记命令域内注册）。
- `src/core/`：共享层；`src/<域>/`：index + data + ui + styles.css。
- **依赖方向（ADR-0002）**：`core ← config/state ← parser ← store ← ui ← main`。禁止模块顶层互访，函数级环引用须延迟解析。

## 铁律
1. 每次改动必须走 worktree（用户明说豁免的小修除外，详见 Git 工作流）。
2. 命令 ID 三段式：`bz-<域>-<动作>`。
3. 通知正文不带 emoji，新语义先查 `src/core/notice.ts` ICONS。
4. 样式写 `src/<域>/styles.css`，构建聚合至根 `styles.css`；**滚动条不自造**——bz 界面级单源隐藏（core 通杀，ADR-0122），域内禁 `scrollbar-width: thin/auto` 与自绘 thumb。
5. 域 UI 的唯一真理源是与原型共用的实现源码——样式 / 渲染 / 行为八域全单源（详见 `docs/prototype-first.md`）。
6. `MarkdownRenderer.render` 是**追加**语义：渲染前容器必须为空（新建空容器或先清空），纯文本只能是渲染失败后的兜底；测试 mock 与原型 fake 层必须复刻该语义（ADR-0122）。

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
| home（首页） | 各域命令入口 |
| literature（知识盒） |  |
| settings-panel（设置面板） | 插件设置键（域内 schema.ts 定义） |
| smartcat（小橘） | STORAGE/smartcat |

## 测试与质量门禁
- 新功能必须包含数据层+UI层测试，smoke.test.ts 同步验证。
- 纯数据层测试首行加 `// @vitest-environment node`。
- **门禁全绿**：pnpm test + tsc --noEmit + 自审 + diff 审查 + 构建验证。

## Git / 工作流

- 主分支 `master`，提交遵循 Conventional Commits。
- worktree 建在主仓库父级外（如 `../.dsh-worktrees/`），从最新 master 分叉。
- 工作流：worktree 开发 → `git merge master` 同步底 → `pnpm test`/tsc/自审/diff 审查全绿 → review 通过 → 合并回主仓库 → 主仓库 `pnpm run build` 并部署。
- 严禁在 worktree 内构建。
- 部署后清理 worktree。
- 并行会话占号（issues/ADR 编号）前先查主仓库最新号，防撞车重编号。
- Spec 驱动：先更新 `.scratch/memo-suite-plugin/spec.md`，任务记 `issues/NN-*.md`，ADR 放 `docs/adr/` 并同步 `CONTEXT.md`。