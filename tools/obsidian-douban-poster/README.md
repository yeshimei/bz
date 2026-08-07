# @jwbz/obsidian-douban-poster

自动从豆瓣抓取高清海报 + 补全影视信息到 Obsidian vault 笔记的 YAML frontmatter。

- 🖼️ 下载高清海报（`l_ratio_poster`，约 200-400KB）
- 📋 补全豆瓣信息：评分、导演、编剧、主演、类型、地区、上映日期、片长、语言、又名、IMDb、简介
- 🔁 失败自动重试（指数退避，最多 3 次）
- ⏭️ 已有海报与豆瓣链接的笔记自动跳过，不覆盖手动编辑的数据
- 🧩 被 bz 插件（`src/movie/poster.ts`）以外部进程方式调用：新建/打开影视笔记时自动抓取（ADR-0006）

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
# 前台运行 watcher，监听影视文件夹的新笔记
douban-poster watch

# 对单个笔记抓取海报 + 补全信息（推荐传绝对路径）
douban-poster fetch "E:/Obsidian/你的vault名/我的/影视/《肖申克的救赎》.md"

# 也可传笔记文件名（相对 movieFolder 解析）
douban-poster fetch 《肖申克的救赎》.md
```

> ⚠️ `fetch` 传**相对路径**时会被拼接到 `vaultPath/movieFolder` 之下（`path.join(movieFolder, input)`）；若传的是 vault 内完整路径（如 `我的/影视/《x》.md`），会得到 `vaultPath/movieFolder/我的/影视/《x》.md` 这样的错误路径导致「笔记不存在」。**外部调用方（如插件）务必传磁盘绝对路径**。

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

**跳过条件**：笔记已同时具备 `海报` 与 `豆瓣链接` 字段时跳过（视为已处理过）。仅有海报、缺豆瓣信息时仍会重跑补全。

**关于补全失败**：豆瓣对高频请求有限流（`m.douban.com` 可能 403 跳转到 `sec.douban.com` 验证页）。此时详情页解析不到信息块，脚本走 og:description 兜底，只写入能解析到的字段（主演/简介/链接），**stdout 仍会打印 `[完成] 豆瓣信息已写入`**——调用方若需严格校验，应自行读取笔记 frontmatter 检查核心字段（评分/导演/类型/上映日期等）是否齐全。配置 `~/.douban-cookies.txt` 可显著降低触发概率。

## 工作原理

```
输入笔记路径
  ↓ 提取文件名（《名称》或 名称）
  ↓ 搜索豆瓣（cat=1002）→ 取第一条结果
  ↓ 下载高清海报（s_ratio → l_ratio）→ 存 posterFolder
  ↓ 写入「海报」字段 + 正文 ![[海报]] embed
  ↓ 抓详情页 → 解析评分/导演/主演/类型/地区/…（缺演职员时回退 Celebrities API，再缺主演从 og:description 补）
  ↓ 批量写入 frontmatter
```

所有网络请求带指数退避重试（1s/2s/4s，最多 3 次），单请求超时 15s、下载超时 30s。

## 项目结构

```
tools/obsidian-douban-poster/    （bz 插件仓库内的源码目录）
├── cli.js              # CLI 入口（watch/fetch）
├── config.js           # 配置读取（~/.douban-posterrc）
├── pipeline.js         # 处理管道：搜索 → 下载 → 更新笔记
├── douban-client.js    # 豆瓣客户端（搜索/详情/下载/重试）
├── note-processor.js   # frontmatter 读写
├── test/               # 单元测试（21 个，node --test）
└── package.json
```

## 测试

```bash
npm install   # 首次安装依赖（chokidar）
npm test      # node --test，21 个测试
```

## 在 bz 插件中的集成

bz 插件（桌面端）在**新建影视笔记**或**打开无海报的影视笔记**时，以 `node <cli.js> fetch <笔记绝对路径>` 方式调用本工具：

- 全局包位置经 `npm root -g` 探测，未安装时插件设置页开关禁用并给出安装指引
- 移动端（无 Node.js 环境）不调用，设置项置灰标注「仅桌面端可用」
- 详见 bz 仓库 `docs/adr/0006-poster-fetch-external-npm.md`

## License

MIT
