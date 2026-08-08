# 0008 — 聚合讯数据源守护独立为 npm 包（ADR-0007 方向延伸）

## Context

聚合讯阅读流的数据源 `CONFIG/STORAGE/news.json` 此前由 vault 内嵌脚本 `CONFIG/SCRIPTS/NodeJs/news-watcher/watcher.js` 守护：每 30 分钟抓取最近 24 小时文章（果壳科学人 + 知乎日报），URL + 标题双去重后追加入库。

该脚本是 QuickAdd 时代遗留：**游离于版本控制之外**（只存在于用户 vault 里），无版本、无发布门禁、无回归网——与 incidents 2026-08-08（海报抓取 2.1.0/2.1.1 未验证发布事故）同类风险。而 ADR-0007（2026-08-07）已为抓取类能力定下方向：**独立 PM2 守护进程 + npm 包，与 bz 插件彻底分离**。

## Considered Options

- **插件内置抓取**（聚合讯域内加 fetch 逻辑）→ 依赖 Obsidian 运行状态、移动端不可用，与 ADR-0007 既定方向冲突；否决
- **保留 vault 内嵌脚本，仅源码入库** → 仍无版本化分发，用户环境无法升级；否决
- **独立 npm 包 + PM2 守护（选定）**：源码入仓 `tools/news-watcher/`，发布 npm 包 `@jwbz/obsidian-news`，CLI 六命令，与海报抓取（ADR-0007）完全同构

## 决策

- **包**：`@jwbz/obsidian-news` 1.0.0（MIT，零依赖，Node >= 18）；`files` 白名单 `cli.js` + `watcher.js`
- **CLI**：`obsidian-news watch/fetch/start/stop/status/logs`——`watch` 前台循环、`fetch` 单轮抓取（发布冒烟抓手）、`start/stop/status/logs` pm2 封装（`pm2 start cli.js --name news-watcher -- watch`）
- **路径解析**（三级回退）：`NEWS_PATH` 环境变量 → `~/.news-watcherrc` 的 `vaultPath` → 相对脚本位置（兼容 legacy 内嵌部署）
- **PM2 进程名保持 `news-watcher`**：历史部署引用不破，迁移无感
- **迁移**：发布后立即执行——停旧 pm2 → 全局包启动 → 验证一轮抓取 → 删除 vault 内副本（先备份 logs）
- **插件侧暂不动**：聚合讯设置页的安装/运行指引另开 ticket（本次只发包，最小化范围）

## Consequences

- 脚本纳入版本控制 + npm 版本化，走 incidents 沉淀的发布 checklist（语法门禁 → fetch 冒烟 → pack --dry-run → 装全局实测）
- 抓取与 Obsidian 运行状态无关，PM2 托管崩溃自愈、开机自启
- 用户机器需全局安装 npm 包并配置 `~/.news-watcherrc`
- legacy vault 内嵌部署废弃（README 提供迁移指南）
- 聚合讯设置页暂无指引文字，用户需从 README 获知安装方式（后续 ticket 补齐）
