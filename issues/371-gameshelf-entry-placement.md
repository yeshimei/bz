# issue 371 — 游戏库落位：设置面板归组 + 首页入口顺序 + 域外观组 + 首页快捷命令

> 2026-09-17 用户三条点名（承接 issue 368 / 370 的 UI v3 落域）：
> 「在设置面板和首页放到正确的位置，而不是最后 / 设置面板也如其他域加上外观组放到最前面 /
> 首页右键菜单和抽屉加上快捷命令」

## 一、落位（设置面板 + 首页）

### 设置面板导航

游戏库建域（issue 368）时只加进了 `settings-panel/ui.ts` 的 `DOMAINS` 表，**没进 `NAV_SECS`**
→ 落进「其他」尾组（导航最后一项）。本次：

- `NAV_SECS` 的「媒体与阅读」补入 `gameshelf`（影院 / 书库 / 游戏库 / 复习计划 / 知识盒）；
- `DOMAINS` 里把游戏库条目挪到书库之后（组内顺序 = DOMAINS 顺序，与首页入口同序：影院 → 书库 → 游戏库）。
- 连带：`其他` 尾组随之消失（可见域全部在语义组内）——`prototypes/settings-panel` 壳自检里
  「无「其他」尾组」与「七组分组顺序」两条由红转绿。

### 首页入口顺序（`home/shared.ts::applyOrder`）

**现场**：真实 vault 的 `CONFIG/STORAGE/home.json` 的 desk/mob 是建域前落盘的 14 项（无 gameshelf），
旧口径把「持久化顺序里没有的域」一律排到末尾 → 游戏库磁贴显示在「设置」后面。

新口径（ADR-0165）：未列出的域**插到它在 `DOMAINS` 里声明的前驱之后**（前驱缺失才落最前），
已列出域的先后零改动。现场数据下游戏库正好落在书库之后。

## 二、设置面板「外观」组（与各域同范式，issue 246）

`src/gameshelf/settings.ts` 组顺序改为 **外观 → 目录 → Steam**（此前只有后两组）：

- 面板布局：单卡占位「海报墙」（`gameshelfLayout`）
- 面板主题：单档占位「墨黑」（`gameshelfSkinTheme`，`layoutKey: gameshelfLayout` 联动）
- 预览类 `bz-sp-prev-ink` 在 `src/settings-panel/styles.css` 新增（prevClass 写错 = 卡片空白且不报错）
- 顺带把游戏库 schema 纳入文案 lint（`tests/core/settings-copy-lint-d.test.ts`），
  唯一豁免 = `SteamID64` 标题长度（Valve 官方字段名，折算仅 2 字宽）

## 三、首页右键菜单 / 长按抽屉（`DOMAIN_MENU.gameshelf`）

| 菜单项 | 命令 | 语义 |
|---|---|---|
| 立即同步 | `bz-gameshelf-sync` | 即时类：不开面板直接拉库，`keepHome`（拉完原地看结果）；成功后再补本地封面/图标与中文名队列 |
| 数据统计 | `bz-gameshelf-stats` | 开面板落统计页（影院分析报告同范式）；面板已开就地切页 |

- 通知口径同剪藏本手动抓取：有变化由 `runSync` 弹成功条 / 无变化补「已同步，暂无变化」/
  未配置给明话指引 / 进行中给 busy 条（其余失败原因 `runSync` 内已弹，不重复）。
- 图标：`refresh-cw`（同步）+ `chart-bar`（统计，与阅读分析报告的 `bar-chart-3` 错开）；
  `prototypes/home/prototype-icons.js` 补 `chart-bar`（手写白名单，缺了渲染成空白）。
- `openPanel(app, view = 'shelf')` 新增视图参数（缺省仍是游戏墙）。

## 门禁

- `tsc --noEmit` 零错误；新增/改动测试：`tests/home/domain-order.test.ts`（新）、
  `tests/gameshelf/settings.test.ts`（新）、`tests/gameshelf/sync.test.ts`（命令入口 4 例）、
  `tests/home/entry-menu.test.ts`、`tests/settings-panel.test.ts`（导航下标随之重排）、
  `tests/smoke.test.ts`（命令表 +2）。
- 原型壳：游戏库壳自检 52/52；首页壳补 4 条游戏库菜单断言（含「点立即同步不关首页」），
  并修掉 4 条因游戏库磁贴入列而失效的域数断言（13→14 / 14→15）。
