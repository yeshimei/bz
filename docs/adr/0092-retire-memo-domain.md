# ADR-0092：退役旧 memo 域，todo 全面接管 memo.json

- 状态：已接受（2026-09-05）
- 关联：ADR-0086（news/clipping 退役先例）、issue 191、issue 178（todo 接管立项）

## 背景
todo（待办场景工作台）自交付起逐步接管备忘录职责：被动捕获入口（启动自动弹出/打开笔记提醒/ribbon）已全部改道待办面板，写盘与 UI 归 todo 域。旧 `src/memo/` 只剩余两条主动命令（bz-memo-open/bz-memo-add）与 memo.json 引用同步后台（file-sync）。用户拍板（2026-09-05）：旧域整个文件夹删除，痕迹清干净。

## 决策
1. 删除 `src/memo/` 整目录与 `tests/memo/`（file-sync 测试随模块迁 `tests/todo/`）。
2. **命令下线**：bz-memo-open/bz-memo-add 删除，不设别名。旧快捷键绑定失效（ADR-0085 先例），待办入口由 bz-todo-open/bz-todo-add 承担。
3. **引用同步迁入 todo**：`src/memo/file-sync.ts` 迁 `src/todo/file-sync.ts`，导出更名 ensureFileSync/unloadFileSync，订阅 vault:md-renamed/deleted 写 memo.json 的语义逐行不变；无条件常驻（issue 187 数据完整性语义不变）。
4. **数据零迁移**：memo.json 仍是待办唯一数据文件，格式与存储路径不变；smartcat 的 `memo` 域事件通道名不变（todo 本就在该通道发 completed/restored/postponed/priority）。
5. **设置键处置**：7 个共享键（memoScenarios/memoSortMode/memoShowArchivedByDefault/memoDefaultPriority/memoAutoArchive/memoDefaultScene/memoDueFormat）保留原名，todo 域为消费属主（键名即存储契约，改名须迁移且收益为零）；孤儿键 memoMobileDefaultFullscreen（仅旧 memo 弹窗消费）删除。
6. **入口连带**：home 内容首页 memo 域卡整行删除（DEFAULT_PINNED 同步去 memo）；设置面板 memo 行与 schemaLoader 删除；checkup 的 memo.json 巡检保留（数据文件仍在，归待办）。

## 理由
- todo 与 memo 长期双 UI 并存，维护两套交互与常量无收益；todo 已是用户唯一使用面。
- 「反向正名」（todo 改名备忘录）评估过并暂缓：本轮只做删除，名号继承另行立项。
- file-sync 是纯 core 依赖的自包含模块，迁移零风险；smartcat 行为流（memo 通道事件 + 每日到期扫描直读 memo.json）不中断。

## 后果
- 备忘录旧弹窗（#todo-popup）从此不可达；编辑旧条目/标签管理等旧面板能力随域消失（待办工作台已覆盖同语义操作）。
- 旧 data.json 残留 memo 键（gestureSwipeDown 等历史值）被接口收窄后自然忽略。
- smoke 命令清单收缩；home/settings-panel/attach 等测试同步更新。
- 遗留：todo 的添加/编辑/删除三种动作不发域事件（小橘不观察），用户拍板本轮不补。
