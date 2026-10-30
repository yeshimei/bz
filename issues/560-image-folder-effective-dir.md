# 560 · 图片类目录：设置页显示的默认值和实际落点不是一回事

- 状态：已交付（2026-10-31，worktree `bz-wt-image-defaults`）
- 提出：2026-10-31 用户提问「图片相关的文件夹设置是不是自动获取 Obsidian 附件默认存放路径？
  图片相关的默认值也是空」

## 先回答：是，但只有一处是真跟的

解析链在 `core/attachment-dir.ts` 的 `resolveAssetDir()`，全仓唯一：

```
显式设置值 → Obsidian「默认新附件位置」→ 域内缺省
```

Obsidian 那一跳只认**固定文件夹**形态（`附件` / `归档/附件`）；空串、`/`（库根）、`./`、`./子目录`
（跟随当前笔记）一律当没设——插件写的是固定位置，没有「当前笔记」这个上下文。

五个图片键的默认值确实都是空串（`src/settings.ts`）。所以「默认值空」本身不是错，错在设置页
**没把空值背后实际会落到哪说出来**，而且四域各写各的：

| 域 | 行 | 原来的空值表现 | 实际落点 |
|---|---|---|---|
| 剪藏本 | 图片文件夹 | 没配 `fallbackValue` → 空行只剩「选择…」 | 附件位置 → `归档/网页剪藏/assets` |
| 游戏库 | 海报文件夹 | 同上 | 附件位置 → `CONFIG/游戏海报` |
| 影院 | 海报文件夹 | 写死常量 `CONFIG/MOVIE POSTER`，**不含附件位置** | 附件位置 → `CONFIG/MOVIE POSTER` |
| 知识盒 | 图版图片文件夹 | 走 `resolveImageDir()`（含附件位置） | 附件位置 → `文献盒/assets` |
| 书库 | 封面文件夹 | 设置页根本没这一行 | —— |

影院的毛病最贵：用户在 Obsidian 设了附件位置，页面上写着 `CONFIG/MOVIE POSTER`，图其实进了
`附件/`。页面在教一件错的事。

## 改了什么

| 文件 | 改动 |
|---|---|
| `src/clipbook/ui.ts` | 图片行补 `fallbackValue: () => clipbookImageDir()`（与写入侧同一个函数，不另抄回落链） |
| `src/gameshelf/settings.ts` | 补 `fallbackValue`，走 `resolveAssetDir(gameshelfPosterFolder, DEFAULT_POSTER_FOLDER)` |
| `src/cinema/settings.ts` | 去掉「只给域内缺省常量」，改走 `resolveAssetDir(...)` |
| `src/knowledge/ui.ts` | 口径本来就对，desc 补一句「留空跟随 Obsidian 的默认附件位置」 |
| `src/gameshelf/constants.ts` | `DEFAULT_POSTER_FOLDER` 从 `posters.ts` 搬来（posters 会拖进 notes/state/steam 整条下载链，为一行提示不值），`posters.ts` 保留 re-export 不影响既有引用方 |
| `src/core/path-picker.ts` | `PathSettingRowOptions` 加 `fallbackChip`：空值时挂「实际生效目录」锁定 chip（点击可改为显式设置） |
| `src/core/settings-schema.ts` | path 行把 `row.fallbackValue()` 传给 `renderPathSettingRow` |
| `src/core/folder-setup.ts` | 书库摘掉 `bookshelfPosterFolder` 幽灵字段 |

后两条是**两个渲染器同口径**：设置面板（`settings-panel/renderer.ts`）本来就支持 `fallbackValue`，
core 的原生渲染器（剪藏本 ⚙️ 弹窗、保险库设置、第二大脑设置都还走它）没支持——只加域行的
`fallbackValue` 的话，同一个 schema 在两个入口会显示两种样子。

## 顺手清掉的一个幽灵

`bookshelfPosterFolder` 三处全空：`BzSettings` 里没声明、设置页没有这一行、域内没有任何消费点
（书库封面是**读**用户笔记里的 `cover` / `coverPath`，插件从不落封面图）。可它挂在
`FOLDER_PLANS.bookshelf.fields` 里，等于空态替一个用户改不动的字段算 missing。已摘除，书库空态
现在只认「书库目录」。

## 守卫

`tests/core/image-folder-default.test.ts`（8 例）：

- 四行都挂了 `fallbackValue`；
- 什么都没设 → 各显域内缺省（`归档/网页剪藏/assets` / `CONFIG/MOVIE POSTER` / `CONFIG/游戏海报` / `文献盒/assets`）；
- Obsidian 设成 `附件` / `归档/附件` → 四行一起跟着变；
- 设成 `''` / `/` / `./` / `./子目录` 或宿主没有这项配置 → 回落域内缺省；
- 显式设置值优先于附件位置；
- 两个渲染器：core 弹窗空值时挂出同一枚锁定 chip，已填值时两边都不挂。

变异验证：把影院那行改回 `fallbackValue: () => POSTER_FOLDER`，第 3 例（跟随附件位置）即红。

## 验收

- `node scripts/test-affected.mjs --since master` → 636 文件 / 9486 用例全绿；
- `tsc --noEmit` 干净；`node scripts/build-preview.mjs` 重出 19 个行为包。
