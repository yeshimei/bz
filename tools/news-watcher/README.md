# @jwbz/news-watcher

聚合讯数据源的守护脚本——每 30 分钟抓取最近 24 小时文章（果壳科学人 + 知乎日报），URL + 标题双去重后入库 `CONFIG/STORAGE/news.json`，供 bz 插件聚合讯阅读。

- 📡 双源并行抓取：果壳科学人（新站 API + 文章页正文）+ 知乎日报（官方 API + 详情正文）
- 🔁 滚动 24 小时窗口，不是自然日——深夜发布的文章不丢
- 🧹 双去重：URL + 标题，批内与库内都过滤，入库即未读
- 🛡️ 源级容错：单个源失败不影响其他源，下个轮次自然重试
- ⚙️ PM2 后台守护 + 自动重启（`pm2:start` / `pm2:stop` / `pm2:logs`）
- 🧩 与 bz 插件分离：脚本只负责抓取入库，不维护已读状态

## 要求

- Node.js >= 18（使用内置 `fetch`，零第三方依赖）

## 配置

news.json 路径按以下优先级解析：

1. `NEWS_PATH` 环境变量（绝对路径，含文件名）
2. `~/.news-watcherrc`（用户目录 JSON，`vaultPath` 字段）：

```json
{
  "vaultPath": "E:/Obsidian/你的vault名"
}
```

3. 缺省：相对脚本位置 `../../../STORAGE/news.json`（保持原 vault 内 `CONFIG/SCRIPTS/NodeJs/news-watcher` 部署兼容）

## 运行

```bash
npm start                # 前台运行：启动即抓 + 每 30 分钟轮询
npm run pm2:start        # PM2 后台守护
npm run pm2:stop         # 停止
npm run pm2:logs         # 查看日志
npm run check            # 语法门禁（node --check）
```

## 目录结构

```
tools/news-watcher/
├── watcher.js            # 抓取/去重/入库主脚本（零依赖，可直接 node 运行）
├── ecosystem.config.cjs  # PM2 守护配置
├── CONTEXT.md            # 领域术语表
└── README.md
```

术语与规则见 `CONTEXT.md`。
