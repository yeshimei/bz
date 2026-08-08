# @jwbz/obsidian-douban-poster

自动从豆瓣抓取高清海报 + 补全影视信息到 Obsidian vault 笔记的 YAML frontmatter。

- 👁️ 监听影视文件夹的新建与改动，自动扫描缺海报的笔记
- 🕒 每 15 秒串行处理一个，避免豆瓣接口限流
- 🖼️ 下载高清海报（`l_ratio_poster`，约 200-400KB）
- 📋 补全豆瓣信息：评分、导演、编剧、主演、类型、地区、上映日期、片长、语言、又名、IMDb、简介
- 🔁 失败自动重试（指数退避，最多 3 次）
- ⏭️ 已有海报的笔记自动跳过，不覆盖手动编辑的数据
- ⚙️ PM2 后台守护 + 开机自启（`start` / `stop` / `status` / `logs`）
- 🧩 与 bz 插件分离：插件设置页仅提供安装与运行指引（ADR-0007）

## 安装

```bash
npm install -g @jwbz/obsidian-douban-poster
```

要求 Node.js >= 18。

## 配置

创建 `~/.douban-posterrc`（用户目录下）：

```json
{
  "vaultPath": "E:/Obsidian/你的vault名",
  "movieFolder": "我的/影视",
  "posterFolder": "CONFIG/MOVIE POSTER"
}
```

| 字段 | 说明 | 默认值 |
|---|---|---|
| `vaultPath` | Obsidian vault 根目录的绝对路径 | (必填) |
| `movieFolder` | 影视笔记所在文件夹（相对 vault） | `我的/影视` |
| `posterFolder` | 海报图片存放文件夹（相对 vault） | `CONFIG/MOVIE POSTER` |

可选：在用户目录放 `~/.douban-cookies.txt`（一行 Cookie 文本）可绕过豆瓣风控限制。

## 使用

```bash
# 前台运行 watcher（调试用）
douban-poster watch

# PM2 后台守护（推荐）
douban-poster start
douban-poster status      # 查看状态
douban-poster logs        # 查看日志
douban-poster stop        # 停止

# 对单个笔记抓取海报 + 补全信息（推荐传绝对路径）
douban-poster fetch "E:/Obsidian/你的vault名/我的/影视/《肖申克的救赎》.md"
```

> ⚠️ `fetch` 传**相对路径**时会被拼接到 `vaultPath/movieFolder` 之下（`path.join(movieFolder, input)`）；若传的是 vault 内完整路径（如 `我的/影视/《x》.md`），会得到 `vaultPath/movieFolder/我的/影视/《x》.md` 这样的错误路径导致「笔记不存在」。**外部调用方务必传磁盘绝对路径**。

### watcher 工作方式

```
监听 movieFolder 的 add / change 事件
  ↓ 10s 防抖合并（脚本自身写入触发的 change 也接受，扫描幂等）
  ↓ 全目录遍历：收集 frontmatter 无「海报」字段的 .md
  ↓ 按文件创建时间倒序入队（最新创建的先抓；同文件去重）
  ↓ 串行处理：每个抓取完成后等 15s 再处理下一个
```

## 补全的字段

处理一个笔记时，写入以下 YAML 字段（已存在同名字段则更新；空值不写）：

| 字段 | 示例 | 来源 |
|---|---|---|
| `海报` | `CONFIG/MOVIE POSTER/xxx.jpg` | 豆瓣搜索结果 |
| `豆瓣评分` | `8.3` | 详情页 |
| `导演` | `韩杰` | Celebrities API / 详情页 |
| `编剧` | `韩杰` | Celebrities API / 详情页 |
| `主演` | `王宝强 / 谭卓 / 何洁` | Celebrities API / 详情页 |
| `类型` | `剧情` | 详情页 meta |
| `制片国家/地区` | `中国大陆` | 详情页 meta |
| `语言` | `汉语普通话` | 详情页 |
| `上映日期` | `2011-11-04` | 详情页 meta |
| `片长` | `88分钟` | 详情页 |
| `又名` | `Mr. Tree` | 详情页 |
| `IMDb` | `tt2043878` | 详情页 |
| `豆瓣链接` | `https://movie.douban.com/subject/4135710/` | 搜索结果 |
| `简介` | `树（王宝强 饰）…` | og:description |

笔记正文也会自动插入 `![[海报路径]]` 图片链接（已存在则跳过）。

**跳过条件**：笔记已有 `海报` 字段时跳过（watcher 扫描与 fetch 均适用）。仅有海报、缺豆瓣信息时仍会重跑补全。

**关于补全失败**：豆瓣对高频请求有限流（`m.douban.com` 可能 403 跳转到 `sec.douban.com` 验证页）。此时详情页解析不到信息块，脚本走 og:description 兜底，只写入能解析到的字段（主演/简介/链接），**stdout 仍会打印 `[完成] 豆瓣信息已写入`**——调用方若需严格校验，应自行读取笔记 frontmatter 检查核心字段（评分/导演/类型/上映日期等）是否齐全。15s 抓取间隔与 `~/.douban-cookies.txt` 可显著降低触发概率。

## 项目结构

```
tools/obsidian-douban-poster/    （bz 插件仓库内的源码目录）
├── cli.js              # CLI 入口（watch/fetch/start/stop/status/logs）
├── config.js           # 配置读取（~/.douban-posterrc）
├── watcher.js          # 监听核心：扫描/创建时间排序/串行队列（15s 间隔）
├── pipeline.js         # 处理管道：搜索 → 下载 → 更新笔记
├── douban-client.js    # 豆瓣客户端（搜索/详情/下载/重试）
├── note-processor.js   # frontmatter 读写
├── test/               # 单元测试（28 个，node --test）
└── package.json
```

## 测试

```bash
npm install   # 首次安装依赖（chokidar）
npm test      # node --test，28 个测试
```

## 与 bz 插件的关系

bz 插件**不包含**任何抓取逻辑（ADR-0007）：影视设置页仅提供本脚本的安装与运行指引（`npm install -g @jwbz/obsidian-douban-poster` + `douban-poster start`），并标注「该脚本仅桌面端可运行」。抓取由本脚本以 PM2 守护进程独立承担，与 Obsidian 是否运行无关。

## License

MIT
