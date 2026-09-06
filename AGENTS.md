# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，20 功能域（详见领域清单）。**项目语言：中文**。

## 命令与构建
- `pnpm install` / `pnpm run dev` / `pnpm run build` / `pnpm test` / `pnpm exec tsc --noEmit`（依赖用 pnpm，勿用 npm）
- 构建产物直出 Obsidian 插件目录（esbuild 硬编码），根目录三件套用于 GitHub Release。
- 测试用 vitest，alias 替换 obsidian 为 mock。

## 架构
- `src/main.ts`：命令注册、设置页、懒加载（44 命令，另有 diary 写日记命令域内注册）。
- `src/core/`：共享层；`src/<域>/`：index + data + ui + styles.css。
- **依赖方向（ADR-0002）**：`core ← config/state ← parser ← store ← ui ← main`。禁止模块顶层互访，函数级环引用须延迟解析。

## 铁律
1. 每次改动必须走 worktree（详见 Git 工作流）。
2. 命令 ID 三段式：`bz-<域>-<动作>`。
3. 通知正文不带 emoji，新语义先查 `src/core/notice.ts` ICONS。
4. 样式写 `src/<域>/styles.css`，构建聚合至根 `styles.css`。
5. **原型先行**（详见 `docs/prototype-first.md`）：域内 `prototype.html` 是该域 UI 的唯一视觉基准，与域 `styles.css` **共用同一份样式文件**（原型 `<link>` 引用，组件样式零内联）。任何 UI/样式修改只改 `styles.css` / 原型 markup 一处，双击原型评审两端与亮暗后过门禁；禁止绕过原型目测调参。**迭代轮只改原型与共享 styles.css，ui.ts 冻结不同构**；用户说「同步」时才一次性做 ui.ts 同构（照搬类名与钩子）+ 补测试断言 + 门禁 + build + 提交。
6. **禁用原生 button**：Obsidian 对 button 有强基线（display/特异性）干扰，多次炸样式；交互元素一律 `div/span` + `role="button"`（`tabindex="0"` + Enter/Space 触发），样式类挂在 div 上照常写。

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