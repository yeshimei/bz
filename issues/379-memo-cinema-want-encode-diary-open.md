# 379 memo 代码闭环批：影院想看编码 + 日记创建后打开笔记

- 状态：已交付（2026-09-18，memo-code-fix 流程）
- 提出：2026-09-18 用户备忘录（scene=代码 两条）
- 相关：无 ADR（域内缺陷修复 + 行为补齐，不改数据格式——「想看 = 评分 -1」是既有合法编码）

## 用户原话（memo 两条）

> 编辑无法从在看和已看改为想看
> 创建日记后关闭弹窗打开笔记

## 票一 item-1789722741019-t82vuk（影院）

**根因**：影院条目状态无独立字段，由 frontmatter「评分」推断（-1=想看 / 0=在看 / 其余=已看）。
编辑/新增表单的保存回调把「想看」的 rating 收成 `null`，`persistItem` 的 `?? 0` 兜底把
null 写成 0 → 落盘重解析判为「在看」，条目当场弹回。新增想看同路径；AI「＋想看」
（直写 -1）是唯一正确路径，但其条目进编辑窗随便一存也会被降级。

**修法**：`src/cinema/ui.ts` openForm 保存回调「想看」分支 `null` → `-1`（saveEdit/saveNew
共用收集点，单点全修，与 quickAddWant 内存/落盘形态一致）。状态域事件、观影日期刷新、
markStatus 快速标记路径零改动。

**回归**：`tests/cinema/ui.test.ts` +2——已看→想看编辑落盘 -1 且重建后仍想看（含 watched→want
域事件断言）；新增想看落盘 -1。行为包 `prototypes/cinema/prototype-behavior.js` 同步重出。

## 票二 item-1789672493967-y11jgy（日记本）

**现状**：创建日记成功后写日记弹窗虽关，但新笔记没打开；从主窗口（墙）头部「✏️写日记」
进入时，墙仍盖在最上层挡住背后的笔记。

**修法**：
- `src/diary/ui/dialogs.ts`：saveNewEntry 接住 `addEntry` 返回的 entry，关弹窗后
  `await jumpToDiaryEntry(entry)` 打开新笔记 → 触发 `onSaved` 回调（消费即清）；
  打开/回调包内层 try 静默兜底，不落入「保存失败」分支误报。`openAddDialog` opts 增
  `onSaved?: () => void`——回调注入避免 dialogs 反向依赖 ui.ts（依赖铁律）。
- `src/diary/ui.ts`：openAddEntry 注入 `onSaved: () => this.hide()`（对齐 jumpTo 先例
  「跳转后关日记本」）；`openDiaryWrite`（无墙场景）不传，行为不变。
- 顺序对齐先例：先 await 打开笔记，再回调收墙；失败路径（守卫拒写/写盘失败）完全不触发。

**回归**：`tests/diary/dialogs-entries.test.ts` +2——成功创建 openLinkText 调一次（去 .md
路径 + active）且 onSaved 调一次；失败路径不打开不回调。既有用例的 entry-actions 整模块
mock 改 partial mock（保真 jumpToDiaryEntry）。

## 门禁

- tsc 0 错；全量 366 文件 5780 用例绿；主仓库构建部署（main.js/styles 同步 E 盘 + 仓库根）
- 排查备注：worktree 内 preview-freshness 报 11 域过期为**环境假象**——`src/core/ai.ts`、
  `src/core/model-limits.ts` 主仓库工作区是 LF、worktree 新检出是 CRLF（autocrlf 下
  status 不敏感但守卫按原始字节 sha1），主仓库与 worktree 均绿，非代码问题
