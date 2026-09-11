# review-fix-diary.md — 日记家族审查修复批（D1–D15 + R1）

worktree：`D:\Obsidian\.dsh-worktrees\sweep-diary`（分支 `fix/sweep-diary`，基于最新 master）。
范围：review-all-bugs.md 第二节「日记家族（diary + recap + checkup）」中划给本组的 15 条（D4 归锁家族组，未触碰 src/encrypt）。

| 编号 | 位置 | 状态 | 说明 | 测试文件 |
|---|---|---|---|---|
| D1 | src/diary/store.ts（syncDateFromDisk / withDateFile） | 已修 | 读失败不再视为空文件：发人话通知后抛 `DiaryFileReadError` 中止队列任务（与守卫拒写同待遇），删/写路径均不会拿空数组跑完把整天日记删掉/覆盖；新增 `isDiaryReadFailure` 供 UI catch 静默 | tests/diary/store.test.ts（读失败中止删除+写入 2 例） |
| D2 | src/diary/store.ts + data.ts + types.ts + ui/locator + ui/entry-actions + ui/dialogs + ui.ts + encrypt.ts | 已修 | 选「WallEntry/DiaryEntry 存完整路径定位」方向（递归读是既有测试钉死的特性）：DiaryEntry/WallEntry 新增 `filePath`，写层公开 API 增加可选 `{filePath}`（缺省顶层平面路径不变，既有调用方零冲击），diaryDataMap 改按路径分键，队列键=目标文件路径；跳转/双链/删除/改标签/加密/媒体 sourcePath 全链路按实际路径，同刻兜底不再跨文件误命中（locator 对未带 filePath 的旧定位面保持旧行为） | tests/diary/store.test.ts（子目录读写 5 例）；tests/diary/actions.test.ts（D5 用例断言路径接线） |
| D3 | src/diary/ui/repair-modal.ts（collectDiaryFiles） | 已修 | 「检测日记解析」改递归枚举子目录 .md——子目录日记同样受写守卫约束，检测扫不到就永久修不了 | tests/diary/ui/repair-modal.test.ts（子目录纳入检测 1 例） |
| D4 | src/encrypt/data.ts + repair-modal runFix | 未处理 | 划归锁家族组（src/encrypt 禁改），本组未动；repair-modal 内 runFix 侧留待该组一并处理 | — |
| D5 | src/diary/ui.ts（encryptEntryAction） | 已修 | 摘除原块返回 0 或抛错（守卫拒写/读失败）时回滚保险箱密文（deleteEncryptedEntry），不再留「保险箱+原文」双份 | tests/diary/actions.test.ts（摘除失败回滚 1 例） |
| D6 | src/diary/config.ts + data.ts + ui.ts | 已修 | `MOVIE_DIRECTORY`/`BOOK_DIRECTORY` 快照常量退役，改 `movieDirectory()`/`bookDirectory()` 实时 resolve 影院/书架设置（data 聚合与 vault modify 订阅同步改），与注释「实时读」契约对齐；DIARY/LETTER 两键仍走 applyDirectories | tests/diary/config.test.ts（实时解析+回落 1 例） |
| D7 | src/diary/ui/dialogs.ts（saveNewEntry） | 已修 | 写盘进行中标志防连点：上一笔未落盘时再点「保存」直接忽略，写盘结束（含失败，finally 释放）才放行 | tests/diary/dialogs-entries.test.ts（防连点+失败释放 2 例） |
| D8 | src/recap/summarize.ts（sanitizeSummaryText） | 已修 | 消毒扩大为行首任意 `#{1,6}\s` 转全角＃：不带时间的 `# 标题` 行（前有空行）曾提前闭合条目致尾部丢失+守卫锁死，现一并转全角 | tests/recap/summarize.test.ts（含 parseFile 重解析零未解析行回归 1 例） |
| D9 | src/diary/encrypt.ts（encryptEntry / reclassifyEntry） | 已修 | noteId 改取 lockNote 返回的 SafeNote.id（不再取 notes[length-1] 耦合追加末尾）；新增 realignRestorePath：还原落点按当前日记目录实时重算（目录变更/文件移动后不再 merge 进旧目录），仅动 diary-entry 清单项并尽力 saveManifest | tests/diary/encrypt-cov.test.ts（noteId 一致性+目录重算还原 2 例） |
| D10 | src/diary/encrypt.ts（buildRestoreBlock） | 已修 | newTags 滤掉「加密」后为空时兜底「日记」重建标题行——不再原样保留 🔐 把条目永久藏进墙里（无 noteId 可再解） | tests/diary/encrypt-cov.test.ts（空标签兜底 1 例，更新原「原样保留」钉死用例） |
| D11 | src/diary/parser.ts（parseFile） | 已修 | emoji 保留标题行原始序列（配置外 emoji 如 🐲 不再被重生成映射值抹掉），跳转锚点/双链与文件实际标题一致；仅旧 type 字段兼容分支保留 emoji↔tags 重同步 | tests/diary/parser.test.ts（原始序列保留 1 例） |
| D12 | src/diary/parser.ts（parseMovieFile） | 已修 | 海报 frontmatter 缺失/空白时跳过 `![[海报]]` 拼接，不再产出 `![[undefined]]` 幽灵媒体格 | tests/diary/parser.test.ts（无海报/空白海报 1 例） |
| D13 | src/diary/ui.ts（fillLbMedia） | 已修 | 灯箱加密媒体异步回填捕获发起时连看下标 `_lbIdx`，回填落地时下标已推进则丢弃——快速连按不再图文错位 | tests/diary/ui.test.ts（可控桩注入慢/快回填竞态 1 例） |
| D14 | src/diary/thumb-cache.ts + ui.ts（loadAndRender） | 已修 | 新增 `railThumbKeepKeys`（48px+wall480 双档键集）与 `pruneRailThumbs`（getAllKeys 全库扫尾删除基线外键），每次 loadAndRender 后惰性清扫；无 IDB 静默降级 | tests/diary/thumb-cache.test.ts（键集+无 IDB 降级 2 例） |
| D15 | src/diary/index.ts（unloadDiary） | 已修 | 卸载时按 id 摘除标签选择器 `diary-tag-selector-mask` 与写日记 `add-diary-mask` 两个 body 级残留 mask | tests/smoke.test.ts（ensure 后存在、unload 后移除 1 例） |
| R1 | src/recap/aggregate.ts（collectRecap 日记过滤） | 已修 | 加密过滤口径对齐墙（tags 含「加密」∪ 正文 🔐）——标题带 🔐、正文无 🔐 的条目不再「回顾计数却在墙上隐藏」 | tests/recap/aggregate.test.ts（口径对齐 1 例） |

## 门禁记录

- `pnpm exec tsc --noEmit`：0 错误。
- `pnpm test`：272 文件 4301 测试全绿（原基线 4280 + 本批新增 21 例）。
- 原型产物新鲜度：`node scripts/build-preview.mjs` 重出（脚本仅写 prototypes/** 与 src/**，未触碰插件构建）；tests/preview-freshness.test.ts 通过。
- 未修改任何 *.css；未修改 src/diary、src/recap、src/checkup 之外的源码（tests 与 prototypes 产物除外）；未执行 pnpm run build / dev。
