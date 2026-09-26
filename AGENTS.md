# AGENTS.md — 包仔（bz）Obsidian 插件

独立 Obsidian 插件，21 功能域 + `core` 共享层（详见领域清单）。**使用中文输出**。

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

## 领域清单（域 id = `src/<域>/` 目录名；未注明者数据均在 CONFIG/STORAGE/）
| 域 | 数据 |
|---|---|
| diary（日记本） | 四目录：`我的/日记`、`我的/信`（本域设置键）+ `我的/影视`、`书库`（跨域读影院/书库设置）；条目为 vault 内 md |
| memo（备忘录） | memo.json |
| belongings（归物本） | belongings.json |
| people（脸谱） | 加密保库记录，每联系人一条（kind=people SafeNote，与 encrypt 共锁同库，ADR-0194；原 people.json/people-jobs.json 已并入）；读数据根 `<peopleDataDir>/<联系人>/`（vault 外，明文）；头像为密文附件（`CONFIG/FACES` 明文目录只退役不删） |
| clipbook（剪藏本） | news.json（未读流）+ `归档/网页剪藏/*.md` + clipbook.json（侧写） |
| favorites（收藏本） | favorites.json |
| review（复习计划） | review.json、quiz.json（做题家出题）、review-fit.json（FSRS 拟合） |
| secondbrain（第二大脑） | secondbrain.json（meta/panel/队列/链接状态段）+ secondbrain.vec（向量二进制） |
| auto-summary（自动摘要） | 无自有数据文件——写剪藏 frontmatter（摘要/标签）；键名单源 `src/auto-summary/keys.ts` |
| pomodoro（番茄钟） | pomodoro.json |
| attach（附件搬移） | 无自有数据——搬移 vault 内附件；仅记忆上次目标目录（设置键） |
| encrypt（保险库） | `<storagePath>/.ENCRYPT/`（清单 `.safe.enc` + 平铺随机名密文镜像；注意：旧文档写的 `CONFIG/.ENCRYPT/` 已不存在） |
| password-vault（密码本） | 同上 `.ENCRYPT/`（kind=password-vault SafeNote，与 encrypt 共锁同库） |
| bookshelf（书库） | `书库/*.md`（frontmatter tags 含 bookTag；目录可配）+ EPUB 元数据 weave-data.json |
| cinema（影院） | `我的/影视/*.md`（日记本跨域共用同目录）；海报落 `CONFIG/MOVIE POSTER`（可配 cinemaPosterFolder） |
| gameshelf（游戏库） | `我的/游戏/《名》.md`（同名消歧加 appid）+ `CONFIG/游戏海报`（可配 gameshelfPosterFolder） |
| knowledge（知识盒） | 三盒：`文献盒/`、`卡片盒/`、`主题盒/`（三键可配，单源 `core/knowledge-boxes.ts`；三盒恒含索引）+ knowledge.json（知识卡片）、mount-suggest.json（挂载建议缓存）；图版图片落 `<文献目录>/assets`（可配 knowledgeImageFolder） |
| smartcat（小橘陪伴猫） | smartcat.json（主数据）、smartcat-memory.json + smartcat-memory-vectors.vec（记忆库）、smartcat-behavior.json（行为流） |
| home（首页） | home.json（入口顺序与显隐）；域入口无独立数据 |
| settings-panel（设置面板） | 插件设置键（域内 schema.ts 定义）；changelog-data.ts 为提交历史生成物 |
| checkup（数据体检） | 全域 json 只读巡检（无独立数据文件） |
| reading-report（阅读报告） | 书库墙面板内视图（ADR-0091，借宿主数据无独立文件） |

## 测试与质量门禁
- 新功能必须包含数据层+UI层测试，smoke.test.ts 同步验证。
- 纯数据层测试首行加 `// @vitest-environment node`。
- **门禁全绿**：pnpm test + tsc --noEmit + 自审 + diff 审查 + 构建验证。

## Git / 工作流

- 主分支 `master`，提交遵循 Conventional Commits（**提交信息即更新日志正文**，写法见 `docs/changelog.md`）。
- worktree 建在主仓库父级外（如 `../.dsh-worktrees/`），从最新 master 分叉。
- 工作流：worktree 开发 → `git merge master` 同步底 → `pnpm test`/tsc/自审/diff 审查全绿 → 合并回主仓库 → 主仓库 `pnpm run build` 并部署 -> 子代理 review。
- **每次提交后必写更新日志**：commit 完立刻跑 `pnpm changelog`（重出 changelog-data.ts + 回写 manifest 版本），不得攒着补——规范见 `docs/changelog.md`。
- 严禁在 worktree 内构建。
- 部署后清理 worktree。
- 并行会话占号（issues/ADR 编号）前先查主仓库最新号，防撞车重编号。
- Spec 驱动：先更新 `.scratch/memo-suite-plugin/spec.md`，任务记 `issues/NN-*.md`，ADR 放 `docs/adr/` 并同步 `CONTEXT.md`。