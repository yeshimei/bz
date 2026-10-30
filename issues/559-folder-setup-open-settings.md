# 559 · 未配置空态的「打开设置」点了只弹提示，面板根本没开

- 状态：已交付（2026-10-31，worktree `bz-wt-folder-settings`）
- 提出：2026-10-30 用户反馈「给未设置的文件夹加一个打开设置的按钮，结果打不开」（附截图：
  右下角一条 `⚠ 设置面板没能打开，可以从「设置 → 包仔」进入`）

## 病因：想躲开构建冲突，躲进了运行时不存在的路

`core/folder-setup.ts` 的 `openFolderSettings()` 要给六个域（日记 / 剪藏 / 影院 / 书库 /
游戏库 / 知识盒）的未配置空态开设置面板。它当时没写静态 import，因为静态 import 会被
esbuild 打进**每个**引用方——影院 / 书库 / 知识盒 的行为包会整块背上设置面板，而评审壳的
假 obsidian 层没有 `Setting` / `Component`，`build-preview` 当场失败。

于是换成了变量拼出的动态 import：

```ts
const spec = ['..', 'settings-panel'].join('/');
void import(spec).then((m) => m.openSettingsPanel(getApp(), plan.settingsId, key))
```

esbuild 对**说明符不是字面量**的 dynamic import 无法静态解析，只能原样保留。产物是 CJS
（`esbuild.config.mjs` `format: "cjs"`），`main.js` 里剩下的是真·`import()`：

```js
import(["..","settings-panel"].join("/")).then(...).catch(() => { /* 弹那句提示 */ })
```

插件运行时这个相对路径没有任何模块能解析 → 恒 reject → 恒走 catch。**按钮在所有六个域里
都是坏的**，只是提示写得像「可能没装」，看起来不像 bug。

## 修法：改成注入，core 不认识设置面板

| 文件 | 改了什么 |
|---|---|
| `src/core/settings-provider.ts` | 新增 `setSettingsPanelOpener()` / `requestSettingsPanel(domainId, anchorKey)`：一个可注入的打开通道，未注入返回 `false`、通道内抛错也只记日志 |
| `src/main.ts` | `onload` 紧挨 `setSettingsProvider` 注入 `(d, k) => openSettingsPanel(this.app, d, k)` |
| `src/core/folder-setup.ts` | 删掉动态 import 与 `getApp` 依赖，改调 `requestSettingsPanel()`；`false` 时才落回原来那句提示（评审壳里没有面板，仍留兜底） |

静态 import 的两个代价都没了：core 不 import 面板本体 → 各域行为包不再被拽上 Setting /
Component（19 个行为包重出，全部构建通过）；也不再依赖运行时的模块解析。

## 守卫

`tests/core/folder-setup.test.ts`（8 例）：

- 六个域点「打开设置」各自带到正确的 `settingsId` + 首个未配置键（`clipbook → clipping` 这类
  跨名映射也钉住了），且不再弹兜底提示；
- 空态 DOM 里的按钮真的接上通道（不是只有函数对）；
- 显式锚点优先；先收背后引导屏再开面板；
- 没注入 / 通道抛错 → 只弹提示、不抛给点击事件；
- 两条源码守卫：**src 下不许出现计算式动态 import**（剥注释后扫，正文里聊 `import()` 不算）、
  **core 里不许直接 import 设置面板**——两条路都会复发病。

## 验收

- `node scripts/test-affected.mjs --since master` → 635 文件 / 9478 用例全绿；
- `tsc --noEmit` 干净；`node scripts/build-preview.mjs` 重出 19 个行为包（源指纹守卫随之转绿）。
