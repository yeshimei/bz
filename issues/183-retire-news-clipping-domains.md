# 183 — 退役旧 news + clipping 域（并入 clipbook，ADR-0085）

## 背景
clipbook（剪藏本融合域，ADR-0082 / issue 177）已是「剪藏本」唯一入口，旧 `src/news/`（聚合讯）与 `src/clipping/`（旧剪藏本面板）的 UI/入口早已断开（main.ts 只注册 bz-clipbook-open）。两旧域仅剩内部代码与其测试，且 home 首页磁贴仍指向已断开的 `bz-clipping-open` / `bz-news-open`（点了静默无反应）。

## 变更
- **删除** `src/news/`（data.ts / reader.ts / source-settings.ts / index.ts / styles.css）、`src/clipping/`（index.ts / view.ts / news-sources-group.ts / styles.css）
- **迁入 clipbook**：
  - `src/clipbook/news-data.ts` ← news/data.ts（读/写 news.json、UP uid 解析、保留策略、迁移）
  - `src/clipbook/news-source-settings.ts` ← news/source-settings.ts（数据源状态读写）
  - `src/clipbook/news-sources-group.ts` ← clipping/news-sources-group.ts（设置「数据源」组 UI + upManager schema）
  - 日期工具 localDayKey / localDatetime / toDatetime ← news/reader.ts（并入 `src/clipbook/constants.ts`）
- **改接线**：clipbook 内 loader/flow/store/save/ui 的 import 指向新内部文件；home/snapshot.ts 删 news 已读统计（`readNewsData` 不再需要——聚合讯并入剪藏本，徽标取剪藏篇数）
- **home 磁贴**：`clipping` 磁贴 commandId 改 `bz-clipbook-open`、副题改「聚合讯与剪藏」；`news` 磁贴删除（与 clipping 同源合并）
- **测试**：删 tests/news/ + tests/clipping/；entries-extra 删 clipping/news 入口 describe；settings-copy-lint-b 改引 clipbook schema（clipbookSettingsSchema + 新址 upManager）；home/snapshot.test 删 news 断言、home/ui.test 剪藏本命令断言改 bz-clipbook-open
- **构建**：scripts/build-css.mjs SOURCES 移除 src/news/styles.css、src/clipping/styles.css

## 门禁
pnpm test（3780 过；唯一失败为 todo/due 午夜时间脆弱用例，master 同样失败，与本次无关）+ tsc --noEmit 0 错误 + pnpm run build 通过。

## 后续（不在本次）
- movie / library / password 旧域退役（待保险箱原型完成后连同 encrypt 一并处理）
