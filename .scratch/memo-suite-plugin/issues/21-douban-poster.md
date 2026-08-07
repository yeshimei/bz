# 21 — 海报抓取（集成 obsidian-douban-poster）

**What to build:** 新建影视笔记时自动调用全局 npm 包 `@jwbz/obsidian-douban-poster`（CLI `douban-poster fetch`），从豆瓣抓取高清海报并补全 13 个 frontmatter 字段。替代原先的外部 watcher；桌面端专属，移动端设置项置灰标注「仅桌面端可用」。

**Blocked by:** 01, 02, 03, 14

**Status:** ready-for-agent

- [ ] `src/movie/poster.ts`：幂等 `ensurePosterFetch(app)` 注册 `vault.on('create')` 监听（桌面端且仅 `我的/影视/` 下新 `.md`，设置 `movieFolderPath` 跟随）
- [ ] create 后延迟 3s（等添加弹窗写入 frontmatter）→ 串行队列（同一时刻一个 spawn）；延迟期间文件被删则取消
- [ ] `spawn('node', [<cli.js 绝对路径>, 'fetch', <笔记路径>])`；cli.js 经 `npm root -g` + `@jwbz/obsidian-douban-poster/cli.js` 定位（execFile 异步探测，缓存结果）；60s 超时 kill；onunload 杀掉活跃子进程
- [ ] 结果判定解析 stdout（脚本失败时 exit code 仍为 0）：`[完成]` 成功 / `[跳过]` 跳过 / `[失败]` 失败取原因行 / exit≠0 取 stderr 尾部
- [ ] 通知（Q9a）：触发时「正在为《xx》抓取海报与豆瓣信息…」+ 结束成功/跳过/失败各一条
- [ ] 未安装全局包：探测为 missing → 设置开关禁用 + desc 提示 `npm install -g @jwbz/obsidian-douban-poster`；运行期 spawn 兜底提示
- [ ] 设置项 `doubanPosterEnabled`（默认 false）：移动端 toggle 置灰 + 「仅桌面端可用」；开关开 → ensurePosterFetch，关 → unloadPosterFetch
- [ ] main.ts：onload 探测 + onLayoutReady 按开关注册；onunload 清理；影视 tab 渲染联动行
- [ ] 测试：mock `window.require('child_process')`（spawn/execFile）；覆盖过滤/延迟/队列/结果判定/通知/移动端/未安装/删除取消/超时/卸载/设置页联动
