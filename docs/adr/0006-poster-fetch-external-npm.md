# 0006 — 海报抓取：spawn 外部全局 npm 包，桌面端专属

## Context

影视域（ticket 14/15）已移植完成，但「抓海报 + 补全豆瓣信息」一直由独立的外部脚本 `obsidian-douban-poster`（Node.js CLI，已发布为全局 npm 包 `@jwbz/obsidian-douban-poster`）承担：监听影视文件夹、豆瓣搜索、下载高清海报、写 13 个 frontmatter 字段。

整合进 bz 时面临两条路：

1. **spawn 外部进程**：插件在桌面端用 `child_process.spawn('node', [cli.js, 'fetch', <笔记>])` 调用全局 npm 包。移动端（Capacitor，无 Node 环境）不可用。
2. **移植为 TS**：把 douban-client/note-processor/pipeline 移植进插件（`requestUrl` 替代 http、vault API 替代 fs），移动端也能用。

用户明确选择方案 1：脚本已打包上传 npm，全局安装即用；且明确要求「移动端提醒/隐藏」。

## Considered Options

- 移植 TS 原生实现 → 移动端可用、无安装依赖，但重复维护整套豆瓣爬取逻辑（重试/风控 cookie/HTML 解析）；用户否决（已有可维护的 npm 包）
- 插件内置 chokidar 监听 → 与桌面端 vault 事件重复；依赖原生模块，构建复杂
- 引用 vault 内脚本目录（`CONFIG/SCRIPTS/...`）→ 依赖 vault 内文件存在；全局 npm 包是唯一事实源

## 决策

- **桌面端**：`vault.on('create')` 新影视笔记 → 延迟 3s（等添加弹窗写入 frontmatter）→ 串行队列 → `spawn('node', [<npm root -g>/@jwbz/obsidian-douban-poster/cli.js, 'fetch', <笔记绝对路径>])`；60s 超时 kill；结果解析 stdout（脚本内部失败时 exit code 仍为 0，判 `[完成]`/`[跳过]`/`[失败]` 标记）
- **安装探测**：`npm root -g` + `existsSync(cli.js)` 异步探测（onload + 设置页打开时）；未安装 → 设置开关禁用 + 安装指引
- **移动端**：不注册监听（`window.require('child_process')` 为 null 即判定非桌面端）；设置项置灰标注「仅桌面端可用」
- **设置**：仅一个开关 `doubanPosterEnabled`（默认关），无 nodePath/路径配置——定位全部走 `npm root -g`
- **替代原 watcher**：原 pm2 watcher 方案废弃，不再有独立常驻进程（用户侧自行停止）

## Consequences

- 桌面端可用；移动端无此功能（设置项置灰，不静默降级）
- 依赖全局 npm 包安装；未装时功能开关禁用并提示 `npm install -g @jwbz/obsidian-douban-poster`
- spawn 进程生命周期由插件管理（超时/卸载 kill），不泄漏进程
- 结果通知粒度：触发时 + 结束时各一条（成功/跳过/失败）
