# ADR-0284：引导页 / 环境自检安装 bz reader（GitHub Release 主，码云备）

日期：2026-11-05 · 状态：已采纳

## 背景

bz 阅读（plugin id `bz-reader`，独立仓库 `yeshimei/bz-reader`）已是书库 EPUB 条目的
唯一数据源（ADR-0283），并且 2026-11-04 已进入 Obsidian 社区目录（0.2.0）。但 bz 的
两个「检查」入口——首次准备引导与环境自检——都只说得出「这台机器缺什么」，说不出
「bz reader 装没装、是不是最新版」，更没有把它补上的动作。用户 2026-11-05 拍板：

1. 引导页和检查页都要有 bz reader 的检查与安装；
2. **安装走 GitHub Releases**（不走市场详情页，市场只能把用户送到页面，还要点两下）；
3. **码云同样给一条备用线路**（与 bz 自己的通道口径一致）。

市场安装的实测（2026-11-05，Obsidian 1.12.7 CLI `plugin:install`）确认社区目录可用，
但它不能从插件进程内触发；`obsidian://show-plugin` 只打开详情页。要做「一键装上并启用」，
只有 bz 自己下载三件套写盘这一条路。

## 决策

1. **新增 `src/core/reader-install.ts`**，只做三件事：读本机状态、查最新版、安装/启用。
   不碰 bz reader 的运行时功能门禁（激活码验签在它自己的包里，bz 不参与）。
2. **本机状态三处真值**：`app.plugins.manifests['bz-reader']`（用户改过插件目录时唯一
   记得真路径的地方）、磁盘 `<dir>/manifest.json`（此刻真实版本；刚装完还没刷新清单时
   内存里是旧版）、`app.plugins.enabledPlugins`（启用态）。目录解析与 bz 自己的
   `core/plugin-path` 同构，但不复用注入层。
3. **最新版免 API**：GitHub 用 `releases/latest/download/manifest.json`（302 到当前
   Release，不碰 GitHub API 的 60 次/小时限流）；码云没有 latest 别名，走「API
   releases/latest 拿 tag → 该 tag 的 manifest」，API 被限流时退 `raw/master/manifest.json`。
4. **安装落盘顺序**：`main.js` → `styles.css` → `manifest.json`，manifest 最后写。
   Obsidian 只看 manifest 判断目录是不是插件；先写它会留下「声称装好却打不开」的坏条目，
   反过来最坏只是「还是上一版」，可自愈。单个文件走 `.bz-tmp` → `rename`（失败退直写）。
5. **启用走软加载**：`loadManifests()` → `enablePluginAndSave()`；任何一步失败都只降级为
   「已安装，请手动启用」，不把装好的东西报成失败。
6. **两个入口共用一套动作**：
   - `environmentCheck` 加一行 `bz reader`（只读本机、不联网）。未安装 = 灰行（可选增强，
     markdown 书照常），目录在但 manifest 读不出 = 红行（半装要修）；`fix: 'reader'`。
   - 引导检测屏单独一组「bz reader」：本地状态立刻显示，最新版异步查（GitHub 主 → 码云备）
     后补「新版 x.y.z」与「更新」按钮；行内「安装 / 重装 / 重试」就地跑完整安装。
   - ③ 下载队列增加 `reader` 项（未安装才默认勾选，已装视为就绪）；完成屏在仍未装好时
     再给一颗「安装 bz reader」次级按钮。
7. **码云备用线路**（跨两个仓库）：
   - bz-reader 仓库推到 `ntbl/bz-reader`（代码 + tag + Release 0.2.0），三件套从 GitHub
     Release 原样下载后上传，**sha256 两端一致**；
   - bz-reader 仓库新增 `scripts/push-gitee.mjs`（推代码/tag + 建 Release + 传三件套；
     只镜像 GitHub 上已转正的 Release），并在其 AGENTS 第 10 节的上架流程里加一步；
   - bz 侧通道顺序：GitHub 主 → 码云同 tag 备；两条都不通时错误文案同时给出两边原因。

## 后果

- 引导页从「列出缺什么」变成「缺的能就地装上」：首次准备一路「下一步」即可把 bz reader
  装好并启用；环境自检打开就能看到状态并补装/更新。
- 两套安装入口（bz 直装 / Obsidian 市场）装的是同一批 Release 资产，版本一致；用户以后
  从市场更新也不会与 bz 的检查冲突（bz 只比较版本号）。
- bz **不做卸载与版本回滚**：那是 Obsidian 插件管理的职责，bz 只负责「装上、启用、告诉你
  有没有新版」。
- 已知边界：码云 Release 的 tag 必须与 GitHub 一致（0.2.0，不带 `v`）；bz-reader 发版时
  必须先转正 GitHub Release，再跑 `push-gitee.mjs`，否则备份通道会先于正本对外可见。

## 补记（2026-11-05）：设置面板「插件」组 + 启动自动更新

用户追加要求：设置面板「通用 → 外部工具」**上面**加一组「插件」，组首「全部更新」，
bz reader 一行显示版本号 + 两个按钮（GitHub / 安装更新）；它的更新要跟着「自动更新」
开关走——开着时启动链顺带更新，关着时只显示「新版 x.y.z」、由用户自己点。

- `src/settings-panel/plugin-resources.ts`：组 = 「全部更新」button 行 + bz reader info 行
  （GitHub + 安装/更新两个 actions）。打开面板先按本机状态渲染，最新版在后台查
  （`fetchLatestReaderRelease`），查到后改写行对象并补丁已渲染 DOM（同 online-resources）；
  关着自动更新也能看到新版号。
- `src/settings-panel/ui.ts`：插件组插在「外部工具」之前（`groups.push(插件组, 外部工具, 在线资源)`）。
- `core/reader-install.autoUpdateReaderPlugin`：`autoUpdate` 开 + 桌面端时，启动链在
  `auto-assets` 之后顺带检查并更新 bz reader（main.ts 调用，失败静默）；关着时一个字节都不下。
  已是最新时不重复下载，更新后提示「重启 Obsidian 后生效」，不自动重启。
- 手动「全部更新」/ 行内「更新」= 用户显式同意，不受 `autoUpdate` 开关限制；先现查最新版，
  已是最新就只给一句提示，不白下一次 0.8 MB。
