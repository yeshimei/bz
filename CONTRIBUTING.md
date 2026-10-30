# 参与开发

先谢谢。这个插件是一个人写的，改动越聚焦越好合。

## 起环境

需要 Node 22 和 pnpm。

```bash
pnpm install
```

`pnpm run dev` 会监听构建，产物**直接写进 vault 的插件目录**。仓库里 `esbuild.config.mjs` 顶部的 `VAULT_PLUGIN_DIR` 是目前这台机器的路径，第一次跑之前改成你自己的：

```js
const VAULT_PLUGIN_DIR = "<你的 vault>/.obsidian/plugins/bz"
```

`pnpm run dev` 期间改完代码，回 Obsidian 里 `Ctrl/Cmd + R` 重载插件即可，不用重启。

## 跑测试

```bash
node scripts/test-domain.mjs memo        # 单个模块，十秒左右
node scripts/test-affected.mjs           # 改动波及的 + 全树守卫（跨模块就靠它）
node scripts/test-affected.mjs --since origin/master   # 整条分支
```

别用 `vitest --changed` / `related`：有一批守卫是读源码文本断言的，模块图里没有这条边，改样式时会「命中 0 个、退出码 0」——假绿。

CI 在 Windows 上跑，PR 会同时跑类型检查：`npx tsc --noEmit`。

## 代码约定

- **模块即目录**：`src/<域>/`，共享能力放 `src/core/`。新模块不要反向依赖别的模块，跨模块只走 `core`。
- **样式只有一个源**：`src/<域>/styles.css`，根目录的 `styles.css` 是聚合产物，别手改。域内禁止内联视觉样式、禁止运行时注入 `<style>`。
- **命令 ID**：`bz-<域>-<动作>`。
- **不手改生成物**：根 `main.js`、`styles.css`、`downloads/manifest.json`、`prototypes/**/prototype-*.js` 都是构建出来的。
- 架构与目录的完整说明见 [AGENTS.md](AGENTS.md)，术语见 [CONTEXT.md](CONTEXT.md)，设计决策在 [docs/adr/](docs/adr/)。

## 提交信息

用 Conventional Commits，**提交信息本身就是更新日志正文**（只有 `feat` / `fix` / `perf` 会进日志）。

```
fix(memo): 勾选后列表不刷新
```

注意标题里 `——` 之前那段主句**至少 4 个字**。短于它整条会被生成脚本静默丢弃——提交照样成功，日志里就是没这条。

同一版里修自己刚加、还没发出去的东西，把 `fix` 并回那条 `feat`、主句写成最终态；日志里出现「新功能 + 修复它」两条，用户读到的是半成品（细则见 [docs/changelog.md](docs/changelog.md)）。

## 提 PR

- 一个 PR 一件事，别把重构和新功能混在一起。
- 按 `.github/pull_request_template.md` 填。
- 改到数据格式的话，在 PR 里说清老数据怎么迁——这个插件对「装上就能接着用」有硬要求。

## 报问题

用 [Issues](https://github.com/yeshimei/bz/issues)，按模板填。装不上、找不到入口之类的问题，先看 [B站视频](https://www.bilibili.com/video/BV1vNsZ6pE7i/)。

`issues/` 目录是作者内部的问题与设计记录，不是提交入口。
