# ADR-0237 · 工具坞：工具目录文件名对齐 Obsidian 插件惯例；`main.mjs` 约定入口

日期：2026-10-04 · 状态：已采纳 · 关联：ADR-0235（声明文件自描述）、ADR-0236（bz 调度 +
运行记录归工具目录）、规格 `.scratch/dock/spec.md` §3/§4、契约文档 `docs/dock-tool-guide.md`

## 背景

ADR-0236 之后，一个工具的全部数据都住在它自己的目录里。但三份契约文件全顶着 `dock-`
前缀自报家门——`dock.json` / `dock.settings.json` / `dock.runs.json`——而目录本身已经是
身份了，文件再自称 dock 是重复；主程序反而随便起名（参考实现叫 `signin.mjs`）。
用户的原话：

> 脚本侧脚本命名非常奇怪，按照 obsidian 插件的方式命名吧，主程序 main 数据 data 声明等等。

`.obsidian/plugins/<id>/` 的形状是 `manifest.json + main.js + data.json`——每个 Obsidian
用户都已经认得这套语言。工具目录照这个形状长，认知成本为零。

## 决策

### 一、三份契约文件改名（契约 `v` 维持 1）

| 旧名 | 新名 | 对位 Obsidian 插件 | 谁写 |
|---|---|---|---|
| `dock.json` | **`manifest.json`** | `manifest.json`（插件清单） | 工具作者 |
| `dock.settings.json` | **`data.json`** | `data.json`（插件数据） | bz |
| `dock.runs.json` | **`runs.json`** | （无对位，剥前缀） | 工具写、bz 读 |

- **读侧双认回落**：新名读不到才试旧名（`declaration.ts` 的
  `DECLARATION_FILENAME_LEGACY` 等三个 `_LEGACY` 常量）。**回落只救「文件不在」**——
  新名在但无效（坏 JSON / 版本不符 / `tool` 串台）时以新名为准，不绕过它去翻旧名；
  「文件在」就让它说话，哪怕是说「没有值」。已有工具（`daily-signin` 等）零迁移零重登记。
- **写侧只落新名**。参数值写成功后顺手清掉旧名残留——同一份凭据不两处落盘；删除尽力
  而为，写失败时绝不动旧名（那可能是用户唯一的凭据副本）。
- **不升 `v`**：schema 一个字段都没变，变的只是文件名。为此拖所有工具升版本不值得，
  双认回落就是迁移方案。

### 二、`main.mjs` 约定入口（约定优于配置，只此一条）

声明没写 `run` 段、目录里有 `main.mjs` → 视为 `node main.mjs`（cwd = 工具目录，
`shell = false`）。最薄的声明可以只剩三行：

```jsonc
{ "v": 1, "id": "iamtxt-signin", "name": "iamtxt 每日签到" }
```

- **只认 `main.mjs` 这一个名字，不认 `main.js`**：工具目录里没有 `package.json`，
  `.js` 会被 Node 默认按 CommonJS 解析，本仓指南教的 `import` 语法直接 SyntaxError；
  `.mjs` 无条件按 ES Module 解析，作者零配置。单一名字还免掉「两个都在时用哪个」的
  歧义——守「不猜」。
- **Obsidian 插件的 `main.js` 能用 `.js`，是因为入口由 Obsidian 自己的加载器拉起、
  模块形态由打包产物决定**，不走 Node 的后缀判定。本条对齐的是「入口叫 main」的形状，
  后缀照抄反而踩坑。
- **其它运行时（python 等）不享受约定**，必须写 `run` 段——bz 不猜运行时。
  写了 `run` 就以声明为准，约定只在缺省时生效。
- 约定入口的探测发生在 `readDeclaration`（它拿得到 fs），以
  `DeclarationRead.conventionalRun` 交给 `resolveRun` 的第三参——判据仍是纯函数，
  探测与解析分离。

## 明确不做

- **不改**环境变量 `BZ_DOCK_*`（那是 bz 的命名空间，不是文件名）、记录 / 参数值里的
  `tool` 字段、四行协议前缀、id 规则、`DOCK_SETTINGS_VERSION`（维持 1）。
- **不做强制迁移**（弹窗催用户改名）——双认回落下旧工具照常工作，强制迁移是纯打扰。
- **不做 `main.js` 兼容**（见上，`.js` 是坑不是缺省）。

## 后果

- 工具目录 = `manifest.json + main.mjs + data.json + runs.json`，与
  `.obsidian/plugins/<id>/` 同构。
- `declaration.ts` 新增三个 `_LEGACY` 常量与 `DockFs` 的 `exists` / `unlink` 可选面；
  `DeclarationRead` 新增 `path`（回落时 ≠ 登记路径）与 `conventionalRun`。
- **runs 历史有一次性断档（要认）**：按 env 写记录的既有工具第一次写出新名 `runs.json`
  后，读侧「新名优先」即生效，旧 `dock.runs.json` 里的历史从面板隐去（文件还在）。
  bz 不代写合并（D9 只读），文档（guide §4.1）明示这一事实，迁移与否归工具/用户。
- 两个 `data.json` 同名不同处（插件目录的登记表 vs 工具目录的参数值账本），文档口径
  已在 CONTEXT.md 与 `data.ts` 头注标明，别混。
- 参考实现 `E:\Obsidian\dock-tools\daily-signin\` 已随本条迁移
  （`manifest.json + main.mjs`）；其历史记录与参数值仍以旧名落盘，由读侧回落认——
  参数值会在 bz 下次写参数时自动迁到 `data.json` 并清掉旧名。
- 契约文档 `docs/dock-tool-guide.md` 全面改口（§2.1 / §2.2 / §2.3 / §7 / §10）。
