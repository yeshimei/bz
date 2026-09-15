# 333 · 整体评审修复批：剪藏本×知识盒七项（issue 329/332 评审跟进）

- 状态：已实现（2026-09-16，无人值守整体 review 的明确项修复；其余 findings 记档 review-329-final.md）
- 关联：issue 329（四批）/ issue 332（memo zrurtk）

## 已修（7 项）

| # | 严重度 | 修复 |
|---|---|---|
| 1 | P1 | `refreshAfterAction` prevId 为空（如撤销唯一条目后 refresh）不再误 `markReadOnOpen(flat[0])`——撤销「恢复原状」不被前进动线破坏 |
| 2 | P2 | `deleteNewsItem`/`deleteClipNote` 删除路径同步 `clearArticleTracking`——侧写三段不再随条目删除永久残留 |
| 3 | P2 | 图版描述含 `]]` 插空格降级（note-gen）——嵌入语法不再被提前闭合、残文不落正文 |
| 4 | P2 | `commitEntryLinks` 抛错不再吞 `onCreated`——笔记已落盘时锚定/来源升级照常回调，重试不再落 `_2` 重名副本；通知区分「笔记已写入，但关联写入失败」 |
| 5 | P3 | 内部双链别名清洗 `]]`（`linkAliasText`，升级链两处拼点） |
| 6 | P3 | 本地嵌入图（src 非 http）不出「保存图片」工具框项——防误点报「网络失败」误导 |
| 7 | P3 | 直达预览的独立宿主弹层可 ESC 关闭（文献预览「关闭走 ✕/ESC」契约对齐） |

## 记档未修（见 review-329-final.md）

已存按钮不置灰的覆盖重写语义、保留策略裁剪不清侧写、loadClipBody 失败负缓存、B站分流不前进的动线豁免、本地化通知 N 含复用、knowledgeDir 手写归一漂移、混合行尾手术边界——均为 P2/P3 设计权衡项，留待用户拍板。
