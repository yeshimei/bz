# ADR-0276：退役评审壳与单源层，开发循环改走测试库直出

日期：2026-10-31 · 状态：已采纳

## 背景

ADR-0104（渲染层 markup 单源）与 ADR-0106（行为层单源）建起的「评审壳」体系：
`prototypes/<域>/`（prototype.html / fake-sim.ts / fake-obsidian.ts）、
`scripts/build-preview.mjs`、`scripts/preview-live.mjs`、根 `index.html` 导航页、
以及 31 份提交入 git 的 `prototype-render.js` / `prototype-behavior.js` 产物。

它的历史职责是「改一处源码、原型侧即时看到」。随着插件本体日渐完整、
本机测试库（`E:\Obsidian\测试`）成为更直接的观察窗口，壳的维护成本
（fake 层跟进、产物新鲜度守卫、双 iframe 差异调和）超过了收益。

## 决策

**评审壳与单源层整体退役**，从项目所有位置移除：

1. 删除 `prototypes/` 整目录、`scripts/build-preview.mjs`、`scripts/preview-live.mjs`、
   根 `index.html`、`scripts/_gen-diary-icons.mjs` / `_gen-review-icons.mjs` /
   `fetch-diary-data.mjs` / `_gen-cinema-demo.mjs` / `_selftest-cdp.mjs`。
2. `esbuild.config.mjs` 删除 `buildPreview` / `watchPreview` 及 `PREVIEW_DOMAINS` 消费。
3. 守卫测试退役：`tests/core/render-purity.test.ts`（预览包 import 纯度）、
   `tests/preview-freshness.test.ts`（产物新鲜度）、
   `tests/settings-panel/sp-style-chain.test.ts`（壳样式链）。
   render.ts 的纯度约束（禁 obsidian/core 服务 import、禁模块级可变状态）降为口头约定。
4. `prototypes/diary/fake/fake-obsidian.ts` 迁入 `tests/helpers/`（单测继续当假 obsidian 用）。
5. `render.ts` 保留为普通域内模块（ui.ts 照常 import）——它是 markup 唯一实现，
   溶解进 ui.ts 没有运行时收益，不折腾。
6. 历史注释里的「评审壳」改标「旧评审壳（已退役）」；AGENTS.md 删「唯一真理源对壳」
   与「走快速原型」两条，CONTEXT.md 渲染纯层/行为层单源两词条改记退役。

**替代工作流**（同 ADR 配套落地）：

- `BZ_VAULT_DIR` 环境变量覆盖构建落点（缺省仍主库，发布七步不受影响）；
- `esbuild.config.mjs` 新增 `once` 模式（一次性不压缩构建，供脚本消费）；
- `scripts/dev-restart.mjs`：构建 + styles.css 同步为测试库 snippet（CSS 免重启）+ 重启 Obsidian；
- `scripts/dev-vault.mjs snapshot|reset|wipe|seed`：测试库快照 / 回滚 / 清空 / 从主库播种；
- `storage/debug-open.json`（`{"command":"bz-<域>-open"}`）：插件启动 layout-ready 后
  自动执行该命令——改弹窗时重启即见，删文件恢复常规启动（`src/core/dev-auto-open.ts`）。

## 后果

- 仓库少了 ~210 个原型文件与 31 份产物，`build-preview` 相关守卫全部下线。
- 改 UI 的观察窗口从「壳预览」换成「测试库直出 + 重启」，CSS 走 snippet 通道免重启。
- 旧 ADR-0104 / ADR-0106 的机制描述仅作历史保留，现状以本 ADR 为准。
