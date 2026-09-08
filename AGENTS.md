# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，21 功能域（详见领域清单）。**项目语言：中文**。

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
4. 样式写 `src/<域>/styles.css`，构建聚合至根 `styles.css`。
5. 域 UI 的唯一真理源是与原型共用的实现源码——样式 / 渲染 / 行为六域全单源（详见 `docs/prototype-first.md`）。

## 领域清单（数据均在 CONFIG/STORAGE/）
| 域 | 数据 |
|---|---|
| diary | `我的/日记/*.md`（旧域，冻结：只保写安全，不投资） |
| diary-wall（回忆墙） | `我的/日记/*.md`（只读派生视图，ADR-0081） |
| todo（待办） | memo.json（唯一属主，ADR-0092：UI/写盘/引用同步/被动捕获全归本域） |
| belongings | belongings.json |
| clipbook（剪藏本，ADR-0082） | news.json（未读流）+ `归档/网页剪藏/*.md` + clipbook.json（侧写） |
| favorites | favorites.json |
| reading-report（读书分析） | metadataCache 统计（内嵌书架墙面板，ADR-0091） |
| review（复习；quiz 已并入） | review.json |
| secondbrain（第二大脑） | secondbrain.json + secondbrain.vec |
| auto-summary | 剪藏 frontmatter |
| pomodoro | pomodoro.json |
| attach | 搬附件 |
| encrypt（保险库，ADR-0085） | `CONFIG/.ENCRYPT/` |
| bookshelf（书架墙） | `书库/*.md`、EPUB（library 已退役并入） |
| cinema（影院） | `我的/影视/*.md`（movie 已退役并入，ADR-0087） |
| home（内容首页） | 各域只读快照 |
| recap（今日回顾） | 五域当天痕迹只读聚合 |
| checkup（数据体检） | 全插件数据只读巡检 |
| literature（文献盒） | literature 笔记 |
| settings-panel（设置面板） | 插件设置键（域内 schema.ts 定义） |
| smartcat（小橘） | STORAGE/smartcat |

## 测试与质量门禁
- 新功能必须包含数据层+UI层测试，smoke.test.ts 同步验证。
- 纯数据层测试首行加 `// @vitest-environment node`。
- **门禁全绿**：pnpm test + tsc --noEmit + 自审 + diff 审查 + 构建验证。

## Git / 工作流

- 主分支 `master`，提交遵循 Conventional Commits。
- worktree 建在主仓库父级外（如 `../.dsh-worktrees/`），从最新 master 分叉。
- 工作流：worktree 开发 → `git merge master` 同步底 → `pnpm test`/tsc/自审/diff 审查全绿 → 合并回主仓库 → 主仓库 `pnpm run build` 并部署。
- 严禁在 worktree 内构建。
- 部署后清理 worktree。
- 并行会话占号（issues/ADR 编号）前先查主仓库最新号，防撞车重编号。
- Spec 驱动：先更新 `.scratch/memo-suite-plugin/spec.md`，任务记 `issues/NN-*.md`，ADR 放 `docs/adr/` 并同步 `CONTEXT.md`。