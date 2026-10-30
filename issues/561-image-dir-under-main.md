# 561 · 图片目录第三跳改为主目录下的 assets，四个写死缺省退役

- 状态：已交付（2026-10-31，worktree `bz-wt-image-dir`）
- 提出：2026-10-31 用户拍板「如果可以跟随 Obsidian 附件默认存放路径就采用，如果不行为空」→
  随后具体化为「剪藏文件夹配了就落它下面的 assets（自动建目录）、知识盒的图片放卡片盒、影院和游戏库同上」
- 相关：ADR-0275（本决策）、ADR-0274（修订其决策 4）、issue 560（上一轮：显示实际落点）

## 病灶

issue 560 把设置页的显示和写入侧对齐了，但第三跳仍是四个各写各的常量：

| 域 | 旧第三跳 | 问 题 |
|---|---|---|
| 影院 | `CONFIG/MOVIE POSTER` | CLI 时代的遗留目录，与影视目录无关 |
| 游戏库 | `CONFIG/游戏海报` | 同上 |
| 剪藏本 | `归档/网页剪藏/assets` | 主目录的字面量缺省，不是现算 |
| 知识盒 | `文献盒/assets` | 挂在文献文件夹，而用户要的是卡片文件夹 |

两层后果：**页面在教错的事**（用户把 Obsidian 附件位置设成 `CONFIG/APPENDIX`，页面却写 `CONFIG/MOVIE POSTER`）；
**主目录改了图不动**（影视目录从 `我的/影视` 改到别处，海报仍往老地方堆）。

## 改成什么

```
显式设置值 → Obsidian 附件位置（仅固定文件夹） → <本域主目录>/assets
```

第三跳由 `core/attachment-dir.ts` 的 `domainAssetsDir(mainDir)` 现算，主目录空则空串：

| 域 | 主目录键 | 落点 |
|---|---|---|
| 剪藏本 | `articleDirectory` | `<剪藏文件夹>/assets` |
| 知识盒 | `knowledgeCardboxDirectory` | `<卡片文件夹>/assets` |
| 影院 | `cinemaFolderPath` | `<影视目录>/assets` |
| 游戏库 | `gameshelfFolderPath` | `<游戏目录>/assets` |

## 改动清单

| 文件 | 改动 |
|---|---|
| `src/core/attachment-dir.ts` | 新增 `domainAssetsDir()`；`resolveAssetDir` 注释改成三跳新口径 |
| `src/core/folder-setup.ts` | 字段表用 `imageBaseKey` 显式声明主目录（不再按「第一个非图片字段」猜，知识盒因此不再跟着文献盒走）；图片字段 `missing` 恒 false |
| `src/clipbook/image-save.ts` | 直接读 `articleDirectory`（不借 `clipDir()` 的 `归档/网页剪藏` 兜底）；空目录拒绝写盘 |
| `src/cinema/douban-fetcher.ts` | 删 `POSTER_FOLDER` 常量；没有可写目录时返回 `write` 失败而不是回落 |
| `src/cinema/douban-queue.ts` / `src/cinema/settings.ts` | 解析改 `domainAssetsDir(cinemaFolderPath)` |
| `src/gameshelf/constants.ts` / `posters.ts` / `settings.ts` | 删 `DEFAULT_POSTER_FOLDER`；空目录时整套媒体队列不启动 |
| `src/knowledge/note-gen.ts` | `resolveImageDir` 读卡片文件夹；删无消费点的 `IMAGE_ASSETS_DIR`；`writeUniqueBinary` 空目录拒绝 |
| `src/settings.ts` | 两条键注释按新口径重写 |

## 边界（知情项）

- **存量不迁移**：老图留在 `CONFIG/MOVIE POSTER` / `CONFIG/游戏海报`，frontmatter 记的是路径，显示不受影响；
  只有新图去新位置。
- **游戏库会重下一轮媒体**：`needsWork` 拿新目录拼的路径与 frontmatter 的 `封面` 比对，目录一变即判「不是本地那版」
  → 封面 / 库内图标 / 截图按新目录重下（上限约 460 MB）。旧文件不自动删。
- **知识盒图与笔记分家**：图版笔记正文仍在文献文件夹，图在卡片文件夹（用户明确要这样）。
- **`./` 相对形态不跟**：影院海报、游戏库封面没有「当前笔记」上下文；日记「＋贴一件」走宿主 API，属另一类（术语已分列）。

## 守卫

`tests/core/image-folder-default.test.ts`（13 例）：

- 三跳各形态（只配主目录 / Obsidian 固定文件夹 / `''`·`/`·`./`·`./子目录` / 宿主无此配置）；
- 三跳全空 → 空串，不发明目录；显式值优先；
- 图片字段 `missing` 恒 false，主目录仍正常 gate；
- **源码扫描**：`src/` 里再出现那四个写死目录即红。

配套改动：`tests/cinema/douban-fetcher.test.ts`（空白目录不再回落，改为 `write` 失败且零写盘）、
`tests/cinema/settings.test.ts`、`tests/clipbook/anchor.test.ts`（缺省 → 空串）、
`tests/gameshelf/posters.test.ts`、`tests/knowledge/note-gen.test.ts`（落点改卡片盒）。

## 验收

- `node scripts/test-affected.mjs --since master` → 636 文件 / 9491 用例全绿（2 skipped）；
- `tsc --noEmit` 干净；`node scripts/build-preview.mjs` 重出 19 个行为包。
