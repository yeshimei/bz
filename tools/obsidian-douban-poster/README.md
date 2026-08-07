# @jwbz/obsidian-douban-poster

自动从豆瓣抓取高清海报 + 补全影视信息到 Obsidian vault 笔记的 YAML frontmatter。

- 🎬 监听文件夹，新笔记自动处理
- 🖼️ 下载高清海报 (`l_ratio_poster`, ~200-400KB)
- 📋 补全豆瓣信息：评分、导演、编剧、主演、类型、地区、上映日期、片长、语言、又名、IMDb
- ⏭️ 已有海报/豆瓣信息的笔记自动跳过
- ⚙️ pm2 后台守护 + 开机自启

## 安装

```bash
npm install -g @jwbz/obsidian-douban-poster
```

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

## 使用

```bash
# 前台运行 watcher，监听影视文件夹
douban-poster watch

# 对单个笔记抓取海报 + 补全信息
douban-poster fetch 《肖申克的救赎》.md

# 通过 pm2 启动后台守护（推荐）
douban-poster start

# 查看 pm2 状态
douban-poster status

# 查看 pm2 日志
douban-poster logs

# 停止 pm2 进程
douban-poster stop
```

## 补全的字段

处理一个笔记时，会自动写入以下 YAML 字段（仅当笔记中没有 `豆瓣评分` 或 `豆瓣链接` 时）：

| 字段 | 示例 | 来源 |
|---|---|---|
| `海报` | `CONFIG/MOVIE POSTER/xxx.jpg` | 豆瓣搜索结果 |
| `豆瓣评分` | `8.3` | 详情页 |
| `导演` | `韩杰` | Celebrities API |
| `编剧` | `韩杰` | Celebrities API |
| `主演` | `王宝强 / 谭卓 / 何洁` | Celebrities API |
| `类型` | `剧情` | 详情页 meta |
| `制片国家/地区` | `中国大陆` | 详情页 meta |
| `语言` | `汉语普通话` | 详情页 |
| `上映日期` | `2011-11-04` | 详情页 meta |
| `片长` | `88分钟` | 详情页 meta |
| `又名` | `Mr. Tree` | 详情页 |
| `IMDb` | `tt2043878` | 详情页 |
| `豆瓣链接` | `https://movie.douban.com/subject/4135710/` | 搜索结果 |
| `简介` | `树（王宝强 饰）的父亲亲手杀死了树的大哥...` | og:description |

笔记正文也会自动插入 `![[海报路径]]` 图片链接。

## 工作原理

```
Watcher 检测到新 .md 文件
  ↓
提取文件名 → 搜索豆瓣 → 取第一条结果
  ↓
下载高清海报 → 保存到 posterFolder
  ↓
补全 YAML 字段 (评分/导演/主演/...)
  ↓
插入海报图片链接到笔记正文
```

已有 `豆瓣评分` 或 `豆瓣链接` 字段的笔记自动跳过，不会覆盖手动编辑的数据。

## 开机自启

```bash
# 安装 pm2（如未安装）
npm install -g pm2

# 启动 watcher 后台守护
douban-poster start

# 设置开机自启
pm2 startup
pm2 save
```

## 前置要求

- Node.js >= 18
- npm

## 项目结构

```
obsidian-douban-poster/
├── cli.js              # CLI 入口 (watch/fetch/start/stop/status/logs)
├── config.js           # 配置读取 (~/.douban-posterrc)
├── pipeline.js         # 处理管道: 搜索 → 下载 → 更新笔记
├── douban-client.js    # 豆瓣 API 客户端 (搜索/详情/下载)
├── note-processor.js   # Obsidian 笔记 frontmatter 读写
├── test/               # 单元测试
└── package.json
```

## License

MIT
