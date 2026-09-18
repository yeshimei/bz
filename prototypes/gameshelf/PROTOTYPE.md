# 游戏架域原型 · V1 海报墙（真行为单源）

> 通用规则见 `docs/prototype-first.md`；本文件只记游戏架域的落地形态与特例。

## 形态

`prototype.html` = 评审壳（不载宿主 app.css，只载 host-theme + core 三链 + 本域 styles.css；
组件样式零内联），内含两个 iframe 跑**同一份真 ui.ts 依赖链**：

| 视图 | 尺寸 | 说明 |
|---|---|---|
| 桌面 | 1280×900 | 面板 `min(1180px, 94vw)` 居中 |
| 移动 | 412×915 | 物理 1:1（`../mob-1to1.css`，缩放只走 transform）；`Platform.isMobile` 视口判定 |

壳顶栏：**亮暗切换（默认亮色）** / 隐藏移动端 / 重置演示数据 / 自检结果位。
URL 钩子：`?theme=dark`（直达暗色）、`?selftest=1`（跑 iframe 内真 DOM 断言）。

## 数据来源（这是本域与其他域最大的差别）

游戏架的核心数据来自网络，所以评审壳要回放 Steam 响应：

| 数据 | 来源 | 文件 |
|---|---|---|
| 我的游戏库（147 款） | **真实 vault** `我的/游戏/*.md` 的 frontmatter 快照 | `prototype-data.js` |
| Steam 商店资料 + 截图 | **真实** `store.steampowered.com/api/appdetails`（`l=schinese`，**含 screenshots：147 款 2270 张**）原样响应 | `prototype-detail.js` |
| 成就（Schema/Player/全局解锁率） | **真实** `api.steampowered.com` 三接口原样响应（经用户系统代理，凭据不入库） | `prototype-detail.js` |
| 库同步（GetOwnedGames） | 由 `GAMESHELF_DATA` **现拼**成 API 形状 → 壳里点「立即同步」跑的是真对账链 | 运行时现造 |

重抓（换了游戏或想看更新的商店资料时，脚本在本地 `.scratch/`，不入库）：

```bash
python .scratch/refetch-gameshelf-detail.py   # 商店（逐条，含 screenshots）+ 成就三接口（schema 带 l=schinese）
python .scratch/merge-gameshelf-detail.py     # 两条通道分开抓时合并（store 直连可达 / ach 需代理）
```

⚠️ 两个抓取坑（都踩过）：
- `appdetails` **只支持单个 appid**（逗号批量 400），必须逐条跑；
- 商店白名单**必须含 `screenshots`**——先前那版脚本先按白名单过滤再判 `screenshots`，
  那个分支永远不成立，于是评审壳的截图段一直是空的（真机代码直读 appdetails，一直有）。

注意 `store.steampowered.com` 直连可达（偶发被重置，重试即可），`api.steampowered.com` 要走系统代理。
两条通道分开抓、分开合，哪条好了补哪条。

没抓到详情的 appid 走**自报家门的演示罐头**（成就名 `演示成就 NN`、简介写明「原型罐头」、
开发商写「演示开发商」），绝不拿编造值冒充真数据；真机（装了系统代理）会拉到真值。

## 落域形态（与插件同一份源码）

- 面板基座 = core `.bz-panel-overlay` / `.bz-panel-frame` / `.bz-panel-mtop`（13 域同款），
  域内不再自造遮罩（v2 的 `.bz-gs-mask` 已退役）。
- 两个视图：**游戏墙**（门面 hero + 工具行 + 封面网格）、**数据统计**（5 张统计卡 + 排行 +
  档位分布 + 年份分布 + 平台分项 + 最近玩过 + 口径注记）。
- 详情弹窗（core `uiModal`）：我的游玩数据（本地秒出）/ 成就（进度 + 逐条明细：名称、描述、
  全球解锁率、解锁日期，按稀有度升序）/ 游戏资料（价格、类型、开发商、发行商、发行日期、
  平台、玩法、评价、Metacritic、推荐数、DLC、商店成就数、简中、官网、简介）/ 商店截图（点开灯箱）。
- 亮暗：全部消费 `--bz` token；只有**图片浮层上的文字**（门面 hero、封面悬停提示）用
  与主题无关的 `--bz-on-overlay`——那类文字压在封面上，跟随主题翻转反而看不清。
- 移动端：≤768px 真全屏（`--bz-vvh` 口径）+ `.bz-panel-mtop` 44px 顶部避让；触屏无 hover，
  封面上的时长/日期改为常显。

## 全量落盘（2026-09-18 用户拍板，ADR-0166）

结论写在 `docs/adr/adr-0166-gameshelf-full-persistence.md`，这里只记壳侧形态：

- 种子的游戏笔记**直接带上全量属性**（`成就` 每行 6 段、`截图源`、`成就已解/总数`），
  由**真解析器 + 真序列化器**（`parseAchievementRows` / `parseStoreMeta` → `achRowText`）现造
  ——所以评审跑的是「属性优先、零网络」那条主路径，而不是靠罐头现拉再回填。
- 种子的 `成就更新` **刻意写成过去时间**：点开任一详情都会走「属性过期 → 静默刷新」，
  顺带把该款的成就图标与截图补到本地。这样评审时开哪款都是齐的，不用等全量回填轮到它
  （回填按 vault 序排队，展示首位那款不一定是第一个）。
- 真机口径：成就明细与截图 URL **都进属性**，画像与体量见 ADR-0166（属性全库约 1 MB，
  极值约 190 KB/款）；会话缓存降级为「同会话别重复拉」的加速层。

## 已知演示偏差（落域走真实现）

- 未抓到真实详情的 appid：商店/成就段为自报家门的演示罐头（见上）。
- `GetRecentlyPlayedGames` 真机返回空（近两周没玩）→ 统计页「最近玩过」按**最后游玩日期**取前 8，
  不是「近两周」，文案已按此口径写。
- **罐头的成就 schema 是加 `l=schinese` 之前抓的** → 壳里成就名是英文、且没有 `icongray`
  （界面因此走「彩色图 + CSS 灰度」那条兜底）。真机走 `&l=schinese` 出中文名；
  代理可用时重跑 `refetch-gameshelf-detail.py` 即可补齐。**这是当前壳与真机唯一的可见差异。**
- 壳里媒体下载写的是 1 字节占位（显示走 `getResourcePath` 的远端映射），
  所以「本地文件已存在」在壳里体现为文件清单与属性正确，字节本身不是真的。

## 媒体本地化（2026-09-17 第一批 · 2026-09-18 扩到成就图标与截图）

- 键分工见 ADR-0164/0166：`封面源`/`图标源`/`截图源`（远端，同步管辖）
  vs `封面`/`图标`/`截图`（vault 本地路径，媒体队列写）；**成就图标不占属性键**，文件名可推导。
- 本地命名：`<appid>.jpg` 封面 / `<appid>-icon.jpg` 库内图标 /
  `<appid>-ach-<apiname>-{on,off}.jpg` 成就图标 / `<appid>-shot-<n>.jpg` 截图；
  都在设置键 `gameshelfPosterFolder`（默认 `CONFIG/游戏海报`）下。
- **评审壳的 `vault.getResourcePath` 是壳专用实现**，两条路：
  1. **媒体队列下过的文件**（成就图标、截图）→ 按文件名**推导**出罐头里的远端源并返回。
     为什么必须这么绕：浏览器写不了磁盘，而成就图标在 `steamcdn-a.akamaihd.net`、**只给图不给
     CORS 头**（实测 ACAO 缺失）→ 壳里 `fetch` 拿不到字节；但 `<img src=远端>` 不受 CORS 限制，
     于是评审页里看到的成就图标与截图是**真的**。真机走 `requestUrl`（Electron 主进程，不受 CORS），
     下载到本地后由 `app://` 提供 —— 这条捷径只在壳里存在。
  2. 其余（封面、库内图标）→ `/__vault-media/<文件名>`，由 preview-live 按 basename 从**真实 vault**
     现取——所以评审页里的封面就是用户 vault 里那张真海报。`<appid>-icon.jpg` 在真 vault 里没有同名文件，
     会 404，正好验证 UI 侧的 `data-fallback-src` 兜底（本地失败 → 回落远端图标）。
- 壳里 `setMediaInterval(0)`：生产那 120ms 是给 Steam CDN 留的礼貌间隔，壳里没有真网络，
  留着只会让评审时图标一张张才出来（一款成就就上百张）。

## 自检

```bash
node scripts/_selftest-cdp.mjs "http://localhost:5177/prototypes/gameshelf/prototype.html?selftest=1"
```

断言 **69 条**，覆盖：CSS 链生效、桌面/移动面板开与满幅、147 卡、门面首位、档位筛选与搜索、
三种排序、统计页五卡与排行首位、详情弹窗三段回填、**成就逐条明细渲染 + 已解锁行数 = 属性
`成就已解`**、**成就图标落本地且弹窗出真图**、**截图段与 `截图源` 对账 + `截图` 本地路径写回**、
ESC 分层、移动端工具行一行与两个下拉。

三个写断言时的坑（别再踩）：
- `dt()` / `mob()` 是**单元素**助手，要多个必须 `dd.querySelectorAll`（`.length` 恒 undefined，
  断言名里会打出 `undefined`——靠这个一眼认出）；
- 别把断言绑在「展示首位那款」的运气上：回填按 **vault 序**排队，而展示序是按游玩时长排的，
  两者不是一回事；
- 别假设「某款必有未解锁成就」：用户的深岩银河是 100% 全成就，`is-on` 会铺满整列。
