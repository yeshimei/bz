# @jwbz/obsidian-news

聚合讯数据源守护脚本——每 30 分钟抓取最近 24 小时文章（果壳科学人 + 知乎日报 + B站 UP 主视频投稿），URL + 标题双去重后入库 `CONFIG/STORAGE/news.json`（**六段结构**），供 bz 插件「聚合讯」阅读。

> **v1.1.2（ticket 127）**：B 站改为**每 UP 抓最近 N 条**（默认 10，news.json `bilibiliMaxItems`，插件「数据源」组可设），不走 24 小时窗口——长期未更新的 UP 也能抓到其最新动态；新增 `bilibiliCookie` 段——API 返回 412/-352（风控）时优先用用户配置的 Cookie（插件 UP 主名单管理弹窗引导配置**登录后**含 SESSDATA 的 Cookie），未配置则回退自动引导（GET 主页收集 buvid3）。**注意：B 站空间动态接口对匿名请求常返回 -352 或空结果，必须配置登录 Cookie 才能拿到真实动态**；接口请求带网页常规参数 `web_location=333.999`，被风控拦截时日志会打印引导提示。其余结构一致。
>
> **v1.1.1（ticket 126）**：B 站抓取到条目时回填 `bilibiliUpInfo` 段（uid → `{name, avatar}`，头像统一转 https）——插件侧名单/弹窗据此把 uid 显示为 UP 主名字和头像（无资料回退 uid）。
>
> **v1.1.0（ticket 124，ADR-0060）**：news.json 升级为 `{articles, stats, bilibiliUps, sources}` 四段（旧纯数组读取时自动包裹迁移）；新增 B 站 UP 主视频投稿源；三源独立开关（读 news.json `sources` 段，插件剪藏本设置「数据源」组写）；UP 主名单读 news.json `bilibiliUps` 段。rc 配置仍只需 vaultPath（不新增配置键）。

- 📡 三源并行抓取：果壳科学人（新站 API + 文章页正文）+ 知乎日报（官方 API + 详情正文）+ B站 UP 主（动态 API，仅视频投稿）
- 🔁 滚动 24 小时窗口，不是自然日——深夜发布的文章不丢；B 站源按 pub_ts 翻页直到越过窗口边界
- 🧹 双去重：URL + 标题，批内与库内都过滤，入库即未读
- 🎛️ 源开关：news.json `sources` 段（zhihu/guokr/bilibili 三布尔）决定抓哪些源，默认全开
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

**B 站 UP 主配置**（不走 rc）：在 bz 插件「剪藏本设置 → 数据源」组粘贴主页/视频链接添加 UP 主，名单写入 vault 内 `CONFIG/STORAGE/news.json` 的 `bilibiliUps` 段；守护进程每轮读取。

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
  ↓ 读 news.json：sources 开关决定抓哪些源；B 站用 bilibiliUps（名单）+ bilibiliMaxItems（每 UP 最近 N 条）+ bilibiliCookie（用户配置，可选）
  ↓ 果壳/知乎：滚动 24 小时窗口（按时间倒序，越过边界即停）
  ↓ B站：不走窗口，每 UP 收满最近 N 条（默认 10）即停，URL 去重
  ↓ 双去重：URL（批内 + 库内）→ 标题（库内）
  ↓ 写回：替换 articles 段 + 合并本轮 UP 主资料 bilibiliUpInfo（保留 stats/bilibiliUps/bilibiliMaxItems/bilibiliCookie/sources——插件侧维护段）
```

B 站抓取细节：**Cookie 优先用用户配置的 news.json `bilibiliCookie`**（插件 UP 主名单管理弹窗引导：浏览器 F12 → Cookie 复制 buvid3/SESSDATA；API 返回 412 风控时需要），未配置则 GET `https://www.bilibili.com/` 自动收集 buvid3 引导；请求 `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=<uid>`；仅收 `DYNAMIC_TYPE_AV`（视频投稿）；条目映射 platform='B站'、title=视频标题、url=`https://www.bilibili.com/video/<bvid>`、body=简介+封面+播放链接；每个 UP 首个条目取 `module_author` 的 name/face 回填其资料（ticket 126）；按最近优先收满 `bilibiliMaxItems` 条未抓过的（ticket 127，不走 24 小时窗口）。

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
├── watcher.js         # 抓取核心：路径解析/三源抓取/四段读写/HTML→Markdown/双去重/入库
├── test/              # node:test 单测（bilibili 条目映射纯函数）
├── CONTEXT.md         # 领域术语表
└── README.md
```

## 测试

```bash
npm test      # node --check 语法门禁（cli.js + watcher.js）+ node --test（B 站映射纯函数，零依赖）
```

发布门禁（incidents 沉淀的 checklist）：`npm test` → `obsidian-news fetch` 真实抓取冒烟 → `npm pack --dry-run` 核对打包清单 → 发布后全局安装实测。

## 与 bz 插件的关系

bz 插件**不包含**任何抓取逻辑（ADR-0008）：插件「聚合讯」只读 `CONFIG/STORAGE/news.json` 渲染阅读流；「数据源」组设置（源开关/UP 名单/保留天数）写 news.json 各段，守护进程下轮读取生效。抓取由本脚本以 PM2 守护进程独立承担，与 Obsidian 是否运行无关。

## License

MIT
