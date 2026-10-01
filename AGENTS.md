# bz —— 干活约定

Obsidian 插件。域 = `src/<域>/`，`core` 是共享层。中文输出。

## 跑什么
改一个域：`node scripts/test-domain.mjs <域>`（~10s）。跨域、说不清、或要下「通过」结论：`node scripts/test-affected.mjs`（~12s）——只跑受影响的测试 + 扫树守卫，**它的结论就是结论**；没变过的文件复用上次成功结果，通常几秒。

改到 core、依赖清单、测试配置、全局夹具时，选择器自己升格为全量，不用你判断。合回主干前跑 `node scripts/test-affected.mjs --since master`（覆盖整条分支）。手动强制全量才用 `--full`。

别用 `vitest --changed` / `related`：一批守卫靠读源码文本断言，模块图里没有这条边，改样式会「命中 0 个、退出码 0」——假绿，不是慢。

测试一律 `node` 直调，别走 `pnpm run`（package.json 同名脚本已同口径）：pnpm 11 跑脚本前的依赖自检默认会自动 `pnpm install`，本仓必判「过期」——主仓里 `tools/*` 子包被算成工作区项目，worktree 里还经 junction 读到主仓的状态文件。

## 硬约束（看见就是错）
- 样式源只有 `src/<域>/styles.css`（根 `styles.css` 是聚合产物）。域内禁 `scrollbar-width: thin/auto`、禁自绘 thumb、禁运行时注入 `<style>`、禁内联视觉样式。唯一例外：远端皮肤包只在 `src/core/skin-pack.ts` 单一注入点（ADR-0199），要扩先开 ADR。
- 域 UI 的唯一真理源是与评审壳共用的实现源码；两侧不一致 = 缺陷，改源码，别改壳、别改产物。未定稿的探索稿只写 `.scratch/<名>/`。
- UI 动手前读 `docs/ui-design-manual.md`（取值）与 `docs/ui-kit-manual.md`（分层、工厂）；域内不自造按钮 / chip / 输入基线，要新视觉先扩库并回写手册。
- 已上线 JSON 的字段名与结构只增不改——老数据得能读。
- 不手改生成物：根 `main.js` / `styles.css`、`changelog-data.ts`、`prototypes/**/prototype-*.js`、`downloads/manifest.json`、`downloads/skins/`。
- 命令 ID `bz-<域>-<动作>`；通知正文不带 emoji（新语义查 `src/core/notice.ts` 的 ICONS）。
- 改动走 worktree（仓库外，从最新 master 分叉）；**worktree 内不构建**——产物直出本机 vault（`esbuild.config.mjs` 硬编码）与仓库根。

## 「走快速原型」= 不许验证
不测试、不截图、不比对：禁 vitest 任何跑法（含「只跑当前域」）、禁 CDP / 无头探针、禁壳 `?selftest=1`、禁读计算样式自证。

改完源码 → 起或复用预览服务 → 把网址交给他，让他判。门禁等他喊「同步」一次补齐（改到类型边界可顺手 `tsc --noEmit`，但那不算验证、不许拿它拖交付）。

## 坑
- Git Bash 里 pnpm 起不来（shim 把路径解析成 `D:\d\...`）→ 用 PowerShell，或 `node node_modules/<包>/…` 直调。
- `git worktree remove` 后常残留 `node_modules`，要另删。
- 皮肤顺序固定：`skin-pack → changelog → manifest`（`manifest` 对已出版的 css 现算 sha256，顺序错则插件端校验不过）。

## 提交
Conventional Commits，**提交信息即更新日志正文**（写法 `docs/changelog.md`）；只有 `feat` / `fix` / `perf` 进更新日志。提交后跑 `pnpm changelog`。流程：worktree → `git merge master` → 门禁全绿（`node scripts/test-affected.mjs --since master` + `tsc --noEmit` + 自审 + diff 审查）→ 合回主仓 → 主仓 `pnpm run build` → 子代理 review → 清 worktree。

占 issues / ADR 编号前先查主仓库最新号；拍板结论进 `.scratch/memo-suite-plugin/spec.md`，决策进 `docs/adr/` 并同步 `CONTEXT.md`。

## 去哪儿查
| 要什么 | 去哪 |
|---|---|
| 某域数据落在哪 | 该域 `data.ts` 的路径 / 键常量（默认数据根 `CONFIG/STORAGE/`） |
| 域职责、术语、口径 | `CONTEXT.md` |
| 单源域名单 | `build-preview.mjs` 的 `PREVIEW_DOMAINS` / `BEHAVIOR_DOMAINS` |
| 皮肤清单 | `scripts/skins.catalog.json` |
| 原型约定与高频坑 | `docs/prototype-first.md` |

本文与代码冲突时以代码为准，并顺手改这里。历史注释里的「铁律 N」是旧编号，按内容找，别按号找。
