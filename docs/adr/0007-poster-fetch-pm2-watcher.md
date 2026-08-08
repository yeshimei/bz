# 0007 — 海报抓取回归独立 PM2 守护进程（撤销 0006 插件内 spawn 方案）

## Context

ADR-0006（2026-08-07）决定由 bz 插件在桌面端 `vault.on('create')` / `workspace file-open` 事件驱动、spawn 外部 npm 包 `@jwbz/obsidian-douban-poster` 完成海报抓取。

实际使用后用户调整决策：**抓取与 Obsidian 插件彻底分离**，回到独立守护进程（PM2）长期运行；插件不再包含任何抓取逻辑，设置页仅保留文字指引。同时监听策略升级：

- 原插件方案：`create` 事件 → 延迟 3s → 逐条 fetch（串行，无间隔）——**触发口径窄**（只处理新文件），且快速连续 fetch 触发豆瓣限流（`m.douban.com` 403 → `sec.douban.com` 验证页，导致信息补全间歇失败）
- 新方案：监听文件夹 `create` + `change` → 防抖 10s → **全目录遍历**缺海报笔记 → 入队（按文件创建时间倒序，最新创建先抓）→ 串行处理，**每个完成后等 15s** 再抓下一个

## Considered Options

- 保留插件内 spawn（ADR-0006）→ 与 Obsidian 生命周期耦合（插件卸载/移动端/重载均影响抓取）；用户否决
- 插件内实现完整监听（vault 事件 + 队列 + 节流）→ 移动端仍不可用，且与独立进程重复；用户否决
- **独立 PM2 守护（选定）**：脚本 `douban-poster watch` 由 PM2 托管，开机自启、崩溃自动重启、日志可查；插件零逻辑，只提示安装与运行命令

## 决策

- **脚本侧**（`tools/obsidian-douban-poster/`，2.1.0）：
  - `watch` 命令：chokidar 监听影视文件夹 `add` + `change` 事件 → 10s 防抖 → 全目录扫描（`collectMissingPosterNotes`：frontmatter 无「海报」字段的 `.md`）→ `sortByBirthtime`（创建时间倒序，最新先抓）→ `createProcessor` 串行队列（每个完成后等 15s）
  - 扫描幂等：脚本自己写入 frontmatter 触发的 `change` 不会造成循环（已有海报自动跳过）
  - 队列去重：同一文件处理期间重复入队被拦截；单条失败不阻断队列
  - `start/stop/status/logs`（PM2 封装）继续提供
- **插件侧**（bz）：
  - 删除 `src/movie/poster.ts` 全部逻辑与 `tests/movie/poster.test.ts`
  - 删除设置项 `doubanPosterEnabled`；影视设置 tab 改为纯文字指引（安装 npm 包 + PM2 运行命令），移动端追加「仅桌面端可运行」标注
  - main.ts 移除探测/注册/卸载接线

## Consequences

- 抓取不依赖 Obsidian 运行状态；PM2 托管崩溃自愈、开机自启
- 插件包更小、移动端零残留逻辑
- 15s 间隔大幅降低豆瓣限流概率；仍有限流时配置 `~/.douban-cookies.txt` 兜底
- 用户需自行安装 npm 包并在 PM2 中启动（设置页提供完整指引）
