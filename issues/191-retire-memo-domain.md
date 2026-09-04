# issue 191：退役旧 memo 域，todo 全面接管 memo.json（ADR-0092）

## 目标
删除 `src/memo/` 整域（文件夹级抹除），todo 域成为 memo.json 唯一属主。

## 决策记录（2026-09-05 grilling 拍板）
- memo＋launcher 全退役（文件夹级，痕迹清干净）；「todo 正名备忘录」暂缓另议。
- bz-memo-open/bz-memo-add 全下线；home memo 卡整行删除（非改指待办）。
- 8 个 memo* 设置键：7 共享键保留原名（todo 属主），孤儿键 memoMobileDefaultFullscreen 删除。
- todo 不补添加/编辑/删除三种动作的域事件（小橘观察缺口接受）。

## 任务清单
- [x] file-sync.ts 迁 `src/todo/file-sync.ts`（导出更名 ensureFileSync/unloadFileSync，写 memo.json 语义逐行不变），测试迁 `tests/todo/file-sync.test.ts`
- [x] main.ts：删 './memo' 三处 import/setBzSettingsProvider/ensureBz/unloadBz/bz-memo-open/bz-memo-add，接线换 './todo'
- [x] 删 `src/memo/`、`tests/memo/`
- [x] home：memo 域卡 + DOMAIN_DOT.memo + DEFAULT_PINNED 去 memo
- [x] settings-panel：memo 行 + schemaLoaders.memo 删除（20 域 → 19 域）
- [x] settings.ts：memoMobileDefaultFullscreen 接口+默认删除
- [x] 注释/清单过时引用清理（checkup consistency/snapshot/belongings 等）
- [x] 测试收缩：smoke 命令清单与 spy、home ui/snapshot、settings-panel 行索引与徽标、settings-modal memo 弹窗块、settings-copy-lint、enh-sweep-c、capture、mobile 默认键
- [x] 文档：ADR-0092、本票、CONTEXT.md 词条（备忘录删/待办重写/引用同步/行操作/样式拆分等）、AGENTS.md 领域清单

## 验收
- pnpm test 全绿 + tsc --noEmit 干净（worktree 4048/4048）。
- 全库 grep 无 `from './memo'|from '../memo'|bz-memo-` 残留（smartcat memo-source 为自有模块、memo.json 为数据文件名，属预期保留）。
