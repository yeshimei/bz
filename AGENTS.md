# bz —— 干活约定

Obsidian 插件。域 = `src/<域>/`，`core` 是共享层。中文输出。

## 动手之前：先读，再说，等回话

在改动代码之前，请先勘察相关代码细节，不要直接修改代码。然后按顺序列出五个清单，每个清单都要有编号，清单内每一项也用序号列出；每项用一句话或一段话，通俗、简洁地说明，不要附任何代码细节或技术细节：

1. 针对我提出的问题/需求，说明你是如何理解的、准备怎么做。
2. 指出我可能疏忽、会导致问题的地方，并附上你的建议。
3. 就以上问题，列出可以优化、增强的方向。
4. 列出你不确认、需要我回答的问题。
5. 做完就直接合并到主分支，部署到测试库。

等我确认后再改动代码。

## 硬约束（看见就是错）

1. 样式只认 `src/<域>/styles.css`，域内禁滚动条自绘/注入/内联视觉，例外仅 ADR 授权的皮肤包与展示板 iframe 滚动条。
2. 未定稿探索稿只放 `.scratch/<名>/`，不得混入 `src/` 或 `docs/`。
3. 生成物一律不手改，包括根 `main.js`、`styles.css`、`changelog-data.ts`、`downloads/manifest.json`、`downloads/skins/` 及 dock-watch 生成文件。
4. 命令 ID 用 `bz-<域>-<动作>`，通知正文不带 emoji，新语义查 `src/core/notice.ts` 的 ICONS。
5. 新增弹窗必须用本域 `styles.css` 给 `uiModal`/`openFlowDialog` 传皮肤类穿皮，并复用本域已有弹窗体。
6. 遮罩之上不得再压可点铺满层，否则点遮罩关闭失效；应设 `pointer-events: none` 或把该层纳入命中判据。
7. 改动走仓库外 worktree 并从最新 master 分叉，worktree 内不构建；日常 main.js 只直出测试库（`E:/Obsidian/bz`），主库与仓库根的 main.js 只在发版时落。
8. 存储路径的存在性/读取/mtime 一律走 `core/storage` 的问盘助手（`diskPathExists` / `diskReadText` / `diskPathStat`），不得用 `vault.getAbstractFileByPath` 探测——缺省数据目录是点前缀路径，vault 索引恒空（ADR-0289）。

## 开发工作流（测试库直出，ADR-0276）

改 UI 的快速循环，走**测试库** `E:/Obsidian/bz`（笔记库名就是 `bz`，数据笔记可随便造）：

- **日常只落测试库**：日常构建必须显式 `BZ_VAULT_DIR="E:/Obsidian/bz/.obsidian/plugins/bz"`；这个变量缺省是主库 `E:/Obsidian/叫我包仔`，漏写就把半成品推进主库了——构建前先确认。
- **发版才落主库与仓库根**：发版构建不带 `BZ_VAULT_DIR`（落主库），`node esbuild.config.mjs production` 再把 `main.js` 复制到仓库根；日常构建的 main.js 不进主库、也不进仓库根（根 `styles.css` 是聚合产物，构建时总会更新）。
- `BZ_VAULT_DIR="E:/Obsidian/bz/.obsidian/plugins/bz" node esbuild.config.mjs` —— watch 常驻，改动自动重出 main.js/styles.css 到测试库。
- `node scripts/dev-restart.mjs --vault bz` —— 一次性构建 + 把 styles.css 同步成测试库 snippet（`bz-dev.css`，CSS 改动免重启）+ 重启 Obsidian 直开测试库。`--no-build` 跳过构建；`--vault <名>` 换目标库。
- `node scripts/dev-vault.mjs snapshot|reset|wipe|seed` —— 测试库快照 / 回滚 / 清空（测首次引导）/ 从主库播种数据与日记笔记。
- **开机直达弹窗**：往测试库 `<插件目录>/storage/debug-open.json` 写 `{"command":"bz-<域>-open"}`，插件启动 layout-ready 后自动执行该命令——改某个弹窗时重启即见，不用翻菜单。删掉文件即恢复常规启动。
- **步骤器（自动播，肉眼看）**：往 `<插件目录>/storage/debug-flow.json` 写 `{"flow":"<流程 id>","auto":true}`，插件启动后自动把 `core/dev-flows` 里那条流程一步步播到底，每步停一会儿——作用是**替人点、替人滚**，人盯着屏幕判断流程对不对（不做自动断言、不写报告）。现成范例 `changelog-note`。跑完删文件，否则每次启动都会重播。
- 门禁口径不变：改完在 worktree 跑 `node scripts/test-affected.mjs --since master`；测试库只管「人眼看效果」，不算验证。

## 提交

收到，这些规则我记下了，关键约束复述确认：

- **提交信息即日志正文**：Conventional Commits，仅 `feat`/`fix`/`perf` 进日志；标题主句（`——` 前）≥4 字，否则被 `_gen-changelog.mjs` 的 `rewrite()` 静默丢弃。同版内修自己未发布的改动 squash 回原 `feat`，只有修已发布行为或升版后回归才单留 `fix`。
- **合入流程**：worktree → `git merge master` → 门禁（`test-affected --since master` + `tsc --noEmit` + 自审 + diff 审查）→ 合回主仓 → 推送。
- **升级提示内置**：文案在 `src/core/changelog-data.ts`，发版前把本版插数组最前，`version` 与 `manifest.json` 完全一致（`tests/core/changelog-data.test.ts` 对账，漏加必红），文案与 `downloads/bz-changelog.html` 一致。
- **推送即双推**：`git push origin` 同时推 GitHub 与码云（pushurl），单边用 `git push github/gitee`。码云是第二下载通道（GitHub Release 主 → 码云 Release 备，jsDelivr 已退场）。
- **码云 Release**：GitHub 七步后跑 `node scripts/push-gitee.mjs`，正文取 `docs/note-v<版本>.md`，挂 **15 个资产**（安装包/离线资源包/SHA256SUMS/三件套/downloads 扁平化 9 个）；令牌在 `~/.gitee-token`，绝不进仓库；只镜像已转正 Release（`gh release view` 非 draft），否则 exit 3。
- **对外镜像只剩码云**：assets 步为纯本地对账（不跑脚本不联网）；真正镜像只有 `release-gate.mjs finalize` 里的 `push-gitee`，动手前过 `enforceReleaseOrder`。`yeshimei/bz-assets` 已退役冻结，`push-assets.mjs` 仅留作手动重建，唯一在用的是 `--upload-only`（补传 `downloads/`，不碰分发仓）。
- **编号与沉淀**：占 issues/ADR 号先查主仓最新号；拍板结论进 `.scratch/memo-suite-plugin/spec.md`，决策进 `docs/adr/` 并同步 `CONTEXT.md`。


## 去哪儿查
| 要什么 | 去哪 |
|---|---|
| 某域数据落在哪 | 该域 `data.ts` 的路径 / 键常量（缺省数据根 `<插件目录>/storage/`，ADR-0270；`CONFIG/STORAGE/` 是老库的落位，不是缺省） |
| 域职责、术语、口径 | `CONTEXT.md` |
| 开发工作流（测试库） | ADR-0276 + `scripts/dev-restart.mjs` / `scripts/dev-vault.mjs` 文件头 |
| 皮肤清单 | `scripts/skins.catalog.json` |
| 离线值守（Obsidian 关着也跑） | `tools/dock-watch/README.md`（装法/排障）· 租约与状态接口 `src/dock/watchdog.ts` · ADR-0242 |
| 值守跑之前等网络 | `tools/dock-watch/net.js` 文件头 · ADR-0242 补记（等不到不记账，留给下一拍） |
| 写一个接入工具坞的外部脚本 | `docs/dock-tool-guide.md`（声明文件 / 参数值文件 / 四行协议 / 运行记录 / 展示板 `panel.html`） |
| 发布页正文怎么写、条目什么格式、离线包什么结构 | `docs/release-note-template.md`（条目格式段：标签说人话 + 全角冒号 + 标题 emoji）· `src/core/offline-source.ts` 文件头的目录图 |
| 发版前的 review 查什么、清单怎么给 | `docs/pre-release-review.md`（四维度检查点 / 编号规则 / 挑完之后） |
| 分发仓库怎么重建（已退役，仅手动） | `scripts/push-assets.mjs`（保留份数 / 压平阈值）· ADR-0269 |
| 资源地址、通道顺序 | `src/core/remote-base.ts`（唯一事实源；别在别处再写一份 slug 或域名）· ADR-0269 |
| 支持者名单（加人 / 改名 / 删除） | `docs/patrons.json`（唯一源，格式见 `docs/patrons.md`）· `node scripts/patron-add.mjs` · skill `bz-reward`。**不再改代码、不再发版**：两个插件都在运行期读它 |

本文与代码冲突时以代码为准，并顺手改这里。历史注释里的「铁律 N」是旧编号，按内容找，别按号找。
