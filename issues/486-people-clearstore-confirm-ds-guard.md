# 486 清空聊天数据加确认 + 暂停任务不锁数据源（2026-09-27 实案热修）

## 实案经过

用户在数据源导入大琳后「数据源页面打不开」。排查（解密保库记录 + 代码追踪）确认两个叠加缺陷：

1. **设置 → 脸谱 → 「清空聊天数据」无任何确认**：schema 行 `onClick` 直连 `clearStores()`，
   注释声称的 confirm 从未实现——误点一下即清空所有联系人聊天仓（06:57:54 实际发生，
   大琳 18,477 条被清，人物卡/画像侥幸保留）。
2. **遗留 paused 生成任务永久锁死数据源弹窗**：梨花花一条上古任务停在 `paused`，
   `jobsBusy()`（running+paused）恒真 → `openDsIfIdle` 永远拦截，只有一条一闪而过的 toast。

## 修复

1. `src/people/settings.ts`：「清空聊天数据」onClick 先弹 `openFlowDialog` 确认
   （danger 主按钮，写明不可恢复、人物卡与脸谱保留），确认后才接 `onClearStore`。
2. `src/people/ui.ts` 四处数据操作守卫（开弹窗 / 同步 / 扫描 / 导入）由 `jobsBusy()`
   收窄为 `jobsRunning()`——暂停任务不再拦；继续跑时既有指纹漂移判废兜底消息集变化。
   「画脸谱」入口仍用 `jobsBusy()`（startJobs 整体替换会吞掉暂停任务，必须先显式处理）。

## 测试

- tests/people/sync-button.test.ts：paused 任务弹窗照开、导入可走通；running 任务仍拦。
- tests/people/settings-clear.test.ts：清空先出确认、取消不执行、确认才执行。
