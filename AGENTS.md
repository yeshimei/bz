# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，20 功能域（详见领域清单）。**项目语言：中文**。

## 命令与构建
- `pnpm install` / `pnpm run dev` / `pnpm run build` / `pnpm test` / `pnpm exec tsc --noEmit`（依赖用 pnpm，勿用 npm）
- 构建产物直出 Obsidian 插件目录（esbuild 硬编码），根目录三件套用于 GitHub Release。
- 测试用 vitest，alias 替换 obsidian 为 mock。

## 架构
- `src/main.ts`：命令注册、设置页、懒加载（39 命令）。
- `src/core/`：共享层；`src/<域>/`：index + data + ui + styles.css。
- **依赖方向（ADR-0002）**：`core ← config/state ← parser ← store ← ui ← main`。禁止模块顶层互访，函数级环引用须延迟解析。

## 铁律
1. 每次改动必须走 worktree（详见 Git 工作流）。
2. 命令 ID 三段式：`bz-<域>-<动作>`。
3. 通知正文不带 emoji，新语义先查 `src/core/notice.ts` ICONS。
4. 样式写 `src/<域>/styles.css`，构建聚合至根 `styles.css`。
5. UI 设计参照 `docs/ui-design-manual.md`。

## 领域清单（数据均在 CONFIG/STORAGE/）
| 域 | 数据 |
|---|---|
| diary | `我的/日记/*.md` |
| diary-wall（回忆墙） | `我的/日记/*.md`（只读派生视图，ADR-0081） |
| memo | memo.json |
| belongings | belongings.json |
| clipping | `归档/网页剪藏/*.md` |
| news | news.json |
| password | passwords.json |
| favorites | favorites.json |
| library | `书库/*.md`、`我的/读书笔记` |
| reading-report | metadataCache 统计 |
| movie | `我的/影视/*.md` |
| review | review.json |
| quiz | quiz.json |
| secondbrain | secondbrain.json + secondbrain.vec |
| auto-summary | 剪藏 frontmatter |
| launcher | launcher.json |
| pomodoro | pomodoro.json |
| attach | 搬附件 |
| bili-downloader | bili-tasks.json |
| encrypt | `CONFIG/.ENCRYPT/` |

## 测试与质量门禁
- 新功能必须包含数据层+UI层测试，smoke.test.ts 同步验证。
- 纯数据层测试首行加 `// @vitest-environment node`。
- **门禁全绿**：pnpm test + tsc --noEmit + 自审 + diff 审查 + 构建验证。

## Git / 工作流

- 主分支 `master`，提交遵循 Conventional Commits。
- 必须走 worktree（从最新 master 分叉）。
- 合并前必须满足 `pnpm test` 全绿。
- **严禁在 worktree 内构建**（`pnpm run build`），构建部署须在合并回 master 后的主仓库进行。
- 合并后清理 worktree + 子代理 review（耐心等待）。
- Spec 驱动：先更新 `.scratch/memo-suite-plugin/spec.md`，任务记 `issues/NN-*.md`，ADR 放 `docs/adr/` 并同步 `CONTEXT.md`。