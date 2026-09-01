# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，20 功能域（详见领域清单）。数据沿用既有格式（`CONFIG/STORAGE/*.json`、`我的/*.md`、frontmatter），旧数据直接可读。**项目语言：中文**。

## 命令与构建

- `pnpm install` / `pnpm run dev` / `pnpm run build` / `pnpm test` / `pnpm run test:watch` / `pnpm exec tsc --noEmit`（依赖管理已迁移 pnpm，勿用 npm 装依赖）
- 产物直出 `E:/Obsidian/叫我包仔/.obsidian/plugins/bz/`（esbuild.config.mjs 硬编码）；`pnpm run build` 另把发布版 `main.js`（minify）同步到仓库根目录，`styles.css` 聚合时即写根目录——根目录三件套是发 GitHub Release 的版本
- 测试经 vitest alias 将 `obsidian` 替换为 `tests/mock-obsidian-entry.ts`

## 架构

- `src/main.ts`：命令裸注册表、设置页、懒加载、onunload（39 命令）
- `src/core/`：共享层（不挂 window）——app/settings-provider/ai/json-store/domain-bus/obsidian-adapter/path-classify/esc-manager/flow-dialog/utils/dom/changelog/notice（自绘 toast）/settings-modal/settings-schema/settings-common
- `src/<域>/`：index.ts + data + ui + styles.css（该域样式源头，聚合进根 `styles.css`）；`src/settings.ts`；根 `styles.css`（构建聚合产物，勿手改）；`docs/adr/`；`CONTEXT.md`；`.scratch/<feature>/`
- **依赖方向（ADR-0002）**：`core ← config/state ← parser ← store ← ui ← main`。store 无 DOM；UI 刷新靠回调订阅；禁止模块顶层互访，函数级引用环须函数体内延迟解析。

## 铁律

1. 每次有改动必须走 worktree，流程详见「Git / 工作流」。
2. **命令注册单点**：id `bz-<域>-<动作>` 三段式
7. **通知规范**：正文不带 emoji 前缀；新语义先查 `src/core/notice.ts` ICONS 表，确无匹配才新增；详见 CONTEXT.md「通知类型规范」。
8. **样式收敛**：视觉样式一律写源头 `src/<域>/styles.css`（无则新建），构建时聚合并生成根 `styles.css` 
9. **视觉决策入口**：UI（桌面+移动端） `docs/ui-design-manual.md`

## 领域清单（数据均在 CONFIG/STORAGE/，表内只写文件名）

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
| secondbrain（第二大脑） | secondbrain.json（meta/panel/link 三段）+ secondbrain.vec |
| auto-summary | 剪藏 frontmatter |
| launcher | launcher.json |
| pomodoro | pomodoro.json |
| attach | —（搬当前笔记引用的 vault 附件） |
| bili-downloader | bili-tasks.json |
| encrypt | `CONFIG/.ENCRYPT/`（.safe.enc + .随机名.enc） |

## 测试与质量门禁

- 测试：Vitest + jsdom；新功能必须包含数据层+UI层测试，smoke.test.ts同步验证。
- 纯数据层测试文件首行标注 `// @vitest-environment node` 跳过 jsdom 环境创建（碰 DOM/UI 的测试不加，现有 50+ 个文件照此办理）。
- 多个 worktree 并发跑全量测试时设 `BZ_TEST_MAX_WORKERS=8`（如 `BZ_TEST_MAX_WORKERS=8 pnpm test`）限流防 CPU 超卖互拖；单会话不用设。
- 异步按项目约定处理，依赖注入使用已有 test helper。
- 全量测试已配置 `retry`（vitest.config.ts）：多个 worktree 并发跑测试时的 CPU 争抢抖动会被自动吸收；若仍出现失败，先排查是否为真 bug，**勿以「已知 flaky」豁免**。
- 完成门禁（必须全绿）：
  - Ticket验收 + 契约不破坏
  - pnpm test + pnpm exec tsc --noEmit
  - 自审 + diff审查
  - 构建验证通过
  - 任一失败 → 修复重测

## Git / 工作流

- **分支与提交**：主分支 `master`，提交信息遵循 Conventional Commits（`feat:`/`fix:`/`chore:` 等 + 简短说明，功能改动附 ticket 号）。
- **Worktree 流程（DSH）**
  1. 创建 worktree 前先对齐基线：主仓库 `git fetch origin && git pull --ff-only origin master`（无 remote 则省略），再创建 `git worktree add ../.dsh-worktrees/<分支名> -b worktree/<slug>`——确保分支从**最新 master** 分叉，不基于过期基线。
  2. worktree 内依赖用 `pnpm install`（store 在 `D:\.pnpm-store\`，与仓库/worktree 同卷硬链接，秒级完成；首次在本机装过即无需再从网络拉取）。
  3. 所有改动限制在该 worktree 内。
  4. 测试全绿后提交到 `worktree/<slug>`。
  5. 切回主仓库，**先确认工作区干净**（未提交改动先 stash/提交），再合并：
     `git pull --ff-only origin master` → `git merge worktree/<slug>`
     若 worktree 分支基点已过期产生分歧，先 `git rebase worktree/<slug>` 到最新 master 再 fast-forward 合并，或保留 merge commit。
  6. 合并后重新测试，构建并部署。
  7. 合并验证通过后**清理 worktree**：`git worktree remove ../.dsh-worktrees/<分支名>` + `git branch -d worktree/<slug>`（未完全合并时 `-d` 自动拒绝，勿用 `-D` 强删）。
- **Spec 驱动开发**  
  - 先更新 `.scratch/memo-suite-plugin/spec.md`。  
  - 任务状态记录在 `issues/NN-*.md`。  
  - 进度同步至 `PROGRESS.md`。  
  - 新 ADR 放 `docs/adr/`，并同步更新 `CONTEXT.md`，术语沿用 `CONTEXT.md`，不自造。
