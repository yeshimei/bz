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
| Steam 商店资料 | **真实** `store.steampowered.com/api/appdetails`（`l=schinese`）原样响应 | `prototype-detail.js` |
| 成就（Schema/Player/全局解锁率） | **真实** `api.steampowered.com` 三接口原样响应（经用户系统代理，凭据不入库） | `prototype-detail.js` |
| 库同步（GetOwnedGames） | 由 `GAMESHELF_DATA` **现拼**成 API 形状 → 壳里点「立即同步」跑的是真对账链 | 运行时现造 |

重抓（换了游戏或想看更新的商店资料时，脚本在本地 `.scratch/`，不入库）：

```bash
python .scratch/fetch-gameshelf-detail.py    # 种子快照 + 成就三接口（api 需系统代理，凭据从插件 data.json 读）
python .scratch/fetch-gameshelf-store.py     # 补 store 侧：appdetails 逐条 + appreviews，并瘦身成就段
```

注意 `appdetails` **只支持单个 appid**（逗号批量会 400）；`store.steampowered.com` 直连可达，
`api.steampowered.com` 要走系统代理。

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

## 缓存取舍（写在 `src/gameshelf/detail.ts` 文件头，此处只记结论）

- **frontmatter 标量回写**（持久）：商店展示标量 + 成就三键（成就已解/成就总数/稀有成就）
  与 `详情时间`。价值 = 断网或代理没开时详情弹窗仍有内容可看。只写点开过的游戏，不是全库预写。
- **会话内存缓存**（不落盘）：截图 URL 与成就逐条明细（体积不可控：截图 8 张、成就可上百条，
  塞 frontmatter 会让笔记头部膨胀十倍）。重开面板即重拉。

## 已知演示偏差（落域走真实现）

- 未抓到真实详情的 appid：商店/成就段为自报家门的演示罐头（见上）。
- `GetRecentlyPlayedGames` 真机返回空（近两周没玩）→ 统计页「最近玩过」按**最后游玩日期**取前 8，
  不是「近两周」，文案已按此口径写。
- 海报本地缓存：壳里 `requestUrl` 对图片 URL 只回 1 字节，故封面显示走远端 CDN；
  真机走 `CONFIG/游戏海报` 本地优先（设置键 `gameshelfPosterFolder`）。

## 媒体本地化（2026-09-17 第二批）

- 键分工见 ADR-0164：`封面源`/`图标源`（远端，同步管辖）vs `封面`/`图标`（vault 本地路径，媒体队列写）。
- 壳里能看到整条链路真跑：种子笔记没有源键 → 自动同步补齐源键（迁移）→ 媒体队列下封面/图标
  → 属性改写成 `CONFIG/游戏海报/<appid>.jpg`。
- **评审壳的 `vault.getResourcePath` 是壳专用实现**：返回 `/__vault-media/<文件名>`，
  由 preview-live 按 basename 从**真实 vault** 现取——所以评审页里的封面就是用户 vault 里那张真海报。
  图标（`<appid>-icon.jpg`）在真 vault 里没有同名文件，会 404，因此 UI 侧的 `data-fallback-src`
  兜底在这里正好被验证到：本地失败 → 回落远端图标。

## 自检

```bash
node scripts/_selftest-cdp.mjs "http://localhost:5177/prototypes/gameshelf/prototype.html?selftest=1"
```

断言覆盖：CSS 链生效、桌面/移动面板开、147 卡、门面首位、档位筛选与搜索、三种排序、
统计页五卡与排行首位、详情弹窗三段回填、ESC 分层、移动端满幅。
