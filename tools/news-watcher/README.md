# @jwbz/obsidian-news

聚合讯数据源守护脚本——每 30 分钟抓取最近 24 小时文章（果壳科学人 + 知乎日报），URL + 标题双去重后入库 `CONFIG/STORAGE/news.json`，供 bz 插件「聚合讯」阅读。

- 📡 双源并行抓取：果壳科学人（新站 API + 文章页正文）+ 知乎日报（官方 API + 详情正文）
- 🔁 滚动 24 小时窗口，不是自然日——深夜发布的文章不丢
- 🧹 双去重：URL + 标题，批内与库内都过滤，入库即未读
- 🛡️ 源级容错：单个源失败不影响其他源，下个轮次自然重试
- ⚙️ PM2 后台守护 + 崩溃自动重启（`start` / `stop` / `status` / `logs`）
- 🧩 与 bz 插件分离：脚本只负责抓取入库，不维护已读状态（ADR-0008）

## 要求

- Node.js >= 18（使用内置 `fetch`，零第三方依赖）

## 安装

```bash
npm install -g @jwbz/obsidian-news
```

## 配置

news.json 路径按以下优先级解析：

1. `NEWS_PATH` 环境变量（绝对路径，含文件名）
2. `~/.news-watcherrc`（用户目录 JSON）：

```json
{
  "vaultPath": "E:/Obsidian/你的vault名"
}
```

3. 缺省：相对脚本位置 `../../../STORAGE/news.json`（兼容旧版 vault 内嵌部署，从 npm 全局安装后需用前两种方式配置）

## 使用

```bash
# PM2 后台守护（推荐）
obsidian-news start
obsidian-news status      # 查看状态
obsidian-news logs        # 查看日志（最近 50 行）
obsidian-news stop        # 停止

# 前台运行抓取循环（调试用）
obsidian-news watch

# 单轮抓取后退出（手动补抓 / 冒烟）
obsidian-news fetch
```

### watcher 工作方式

```
启动即抓取一轮
  ↓ 每 30 分钟轮询（PM2 守护，崩溃自动重启）
  ↓ 滚动 24 小时窗口：过滤窗口外的文章（按时间倒序，越过边界即停）
  ↓ 双去重：URL（批内 + 库内）→ 标题（库内）
  ↓ 追加写入 CONFIG/STORAGE/news.json（fetch 超时 15s，单源失败不影响其他源）
```

## 从 vault 内嵌脚本迁移（旧部署）

若旧版 `CONFIG/SCRIPTS/NodeJs/news-watcher/` 仍在 PM2 中运行，迁移步骤：

```bash
# 1. 安装全局包
npm install -g @jwbz/obsidian-news

# 2. 创建 ~/.news-watcherrc（vaultPath 指向 vault 根目录）

# 3. 停旧进程（进程名 news-watcher 保持不变，引用不破）
pm2 delete news-watcher

# 4. 用全局包启动
obsidian-news start

# 5. 验证一轮抓取成功（logs 出现「✅ 新增 N 篇」或 news.json 时间戳更新）

# 6. 确认无误后删除 vault 内副本目录
rm -rf CONFIG/SCRIPTS/NodeJs/news-watcher
```

## 项目结构

```
tools/news-watcher/    （bz 插件仓库内的源码目录，npm 包 @jwbz/obsidian-news）
├── cli.js             # CLI 入口（watch/fetch/start/stop/status/logs）
├── watcher.js         # 抓取核心：路径解析/双源抓取/HTML→Markdown/双去重/入库
├── CONTEXT.md         # 领域术语表
└── README.md
```

## 测试

```bash
npm test      # node --check 语法门禁（cli.js + watcher.js，零依赖无需 install）
```

发布门禁（incidents 沉淀的 checklist）：`npm test` → `obsidian-news fetch` 真实抓取冒烟 → `npm pack --dry-run` 核对打包清单 → 发布后全局安装实测。

## 与 bz 插件的关系

bz 插件**不包含**任何抓取逻辑（ADR-0008）：插件「聚合讯」只读 `CONFIG/STORAGE/news.json` 渲染阅读流。抓取由本脚本以 PM2 守护进程独立承担，与 Obsidian 是否运行无关。

## License

MIT
