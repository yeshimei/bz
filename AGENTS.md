# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，20 功能域（详见领域清单）。**项目语言：中文**。

## 命令与构建
- `pnpm install` / `pnpm run dev` / `pnpm run build` / `pnpm test` / `pnpm exec tsc --noEmit`（依赖用 pnpm，勿用 npm）
- 构建产物直出 Obsidian 插件目录（esbuild 硬编码），根目录三件套用于 GitHub Release。
- 测试用 vitest，alias 替换 obsidian 为 mock。

## 架构
- `src/main.ts`：命令注册、设置页、懒加载（40 命令，另有少量域内注册）。
- `src/core/`：共享层；`src/<域>/`：index + data + ui + styles.css。
- **依赖方向（ADR-0002）**：`core ← config/state ← parser ← store ← ui ← main`。禁止模块顶层互访，函数级环引用须延迟解析。

## 铁律
1. 每次改动必须走 worktree（详见 Git 工作流）。
2. 命令 ID 三段式：`bz-<域>-<动作>`。
3. 通知正文不带 emoji，新语义先查 `src/core/notice.ts` ICONS。
4. 样式写 `src/<域>/styles.css`，构建聚合至根 `styles.css`。
5. UI 设计参照 `docs/ui-design-manual.md`。
6. **UI 分层依赖（自上而下单向）**：`设计手册 → 样式库 → 组件库 → 域`。
   - 样式库（`src/core/ui/*.css`，token + 组件样式）**依据**设计手册取值/命名；
   - 组件库（`src/core/ui/*.ts` 工厂）**只消费**样式库的类与 token，不新造视觉值；
   - 各域 UI **只准用**组件库工厂 + 样式库类；域需要新视觉时，**先扩样式库/组件库**（共享类），禁止域内另起一套按钮/输入/chip 等基线；
   - 仅当**既有组件/样式确实无法表达**新功能时，才允许新增组件/样式——新增须回写样式库手册与设计手册。

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
| bili-downloader | bili-tasks.json |
| encrypt（保险库，ADR-0085） | `CONFIG/.ENCRYPT/` |
| bookshelf（书架墙） | `书库/*.md`、EPUB（library 已退役并入） |
| cinema（影院） | `我的/影视/*.md`（movie 已退役并入，ADR-0087） |
| home（内容首页） | 各域只读快照 |
| recap（今日回顾） | 五域当天痕迹只读聚合 |
| checkup（数据体检） | 全插件数据只读巡检 |
| literature（文献盒） | literature 笔记 |

> 已退役：movie（ADR-0087）、quiz（并入 review）、library（并入 bookshelf）、password（crypto 迁 core）、news/clipping（并入 clipbook）、memo（ADR-0092，todo 全面接管）、launcher（ADR-0093，home 唯一入口）。

## 测试与质量门禁
- 新功能必须包含数据层+UI层测试，smoke.test.ts 同步验证。
- 纯数据层测试首行加 `// @vitest-environment node`。
- **门禁全绿**：pnpm test + tsc --noEmit + 自审 + diff 审查 + 构建验证。

## Git / 工作流

- 主分支 `master`，提交遵循 Conventional Commits。
- worktree 建在主仓库父级外（如 `../.dsh-worktrees/`），从最新 master 分叉。
- 工作流：worktree 开发 → `pnpm test` 全绿 → 合并回主仓库 → 主仓库 `pnpm run build` 并部署。
- 严禁在 worktree 内构建。
- 部署后清理 worktree。
- Spec 驱动：先更新 `.scratch/memo-suite-plugin/spec.md`，任务记 `issues/NN-*.md`，ADR 放 `docs/adr/` 并同步 `CONTEXT.md`。