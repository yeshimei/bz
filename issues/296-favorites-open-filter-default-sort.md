# 296 — 设置面板快速原型轮：收藏本设置补两项（打开默认筛选/默认排序）

- 日期：2026-09-12
- 用户拍板（快速原型轮）：候选 1/3 采纳——打开面板默认筛选、默认排序
- 关联：ADR-0080（设置面板）、ADR-0104（渲染纯净）、issue 246（收藏本外观组）、issue 293（memoOpenScene '@last' 先例）、issue 295（上一轮）
- 状态：已完成

## §1 设计决策

### 打开默认筛选（`favoritesOpenFilter`，缺省 `''`=全部）

- 单键三态（memoOpenScene '@last' 哨兵同款）：`''`=全部 / `'@last'`=记住上次 / 标签 label=固定该标签。
- 「记住上次」取数源 `favoritesLastFilter`（`''`=全部 / `'@archived'`=已归档视图 / 标签 label），**closePanel 写回**（memoLastScene 同款先例）+ `saveSettings()`；固定标签模式重开仍以设置为准。
- 非法值回落全部（标签不在九类 / 未知枚举）。

### 默认排序（`favoritesDefaultSort`，缺省 `new`）

- new=最新收藏 / old=最早收藏 / title=按标题；只管「打开面板时是什么序」，面板内行为不变；置顶恒最前与排序无关（稳定分区不变）。
- 纯层分派：`FavView.sort?` 显式入参（渲染纯净契约），`normalizeFavSort` 非法值回落 new；`filteredItems` 按键选比较器，title 用 `localeCompare('zh-CN')`、时间键兜底。

### 记忆落设置不落 favorites.json

- favorites.json 顶层是纯条目数组，顶层加字段破坏外部统计脚本（favoritesSortKey 同惯例），记忆键落 data.json。

## §2 改动面

| 文件 | 内容 |
|---|---|
| `src/settings.ts` | 三键：`favoritesOpenFilter/favoritesLastFilter/favoritesDefaultSort` + 默认值 |
| `src/favorites/shared.ts` | `FavSort`/`normalizeFavSort`；`FavView.sort?`；`filteredItems` 三档比较器 |
| `src/favorites/ui.ts` | `FavState.sort`；`resolveOpenFilter`；openPanel 播种筛选+排序；closePanel 写回记忆；schema 补「显示」组两行（eye） |
| `prototypes/favorites/fake-sim.ts` | 设置注入改稳定引用对象（原每次新建空对象——closePanel 写回落不住）+ 三新键 |
| `tests/favorites/ui.test.ts` | 新 describe ×2（打开默认筛选 5 / 默认排序 3）+ `activeChipKeys` 辅助 |
| `tests/settings-modal.test.ts` | 收藏本 schema 段：组数 1→2 + 显示组两行/选项序列断言 |
| `tests/settings-panel.test.ts` | 收藏本徽标 2→4 |
| `prototypes/**` | 全量预览产物重出 |

## §3 测试

- 打开默认筛选：缺省全部高亮 / '@last' 筛选→关闭写回→重开还原 / '@archived' 记忆 / 固定标签不被记忆覆盖 / 非法值回落。
- 默认排序：old 置顶恒前 / title（纯拉丁标题断言——zh collation 下 CJK 与拉丁相对序依 ICU，避免脆断言）/ 非法值回落。
- 贴纸高亮断言按 `data-fav-tag` 键不按文本（文案带计数）。

## §4 门禁记录

- `pnpm exec vitest run`：294 文件 / 4532 用例全绿。
- `tsc --noEmit`：干净。
- `node scripts/build-preview.mjs`：全量预览产物重出（新鲜度守卫）。
