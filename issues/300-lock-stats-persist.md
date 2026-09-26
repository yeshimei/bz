# issue-300：锁屏统计明文落盘——冷启动回落上次快照

- 分支：worktree/1 ｜ worktree：work-1 ｜ 日期：2026-09-12
- 来源：备忘录 item-1789166485501-kriyl3（「把解锁界面的统计信息放到明文数据文件中」）
- 关联：ADR-0124（共享解锁屏）决策 4 修订 / ADR-0002（分层）

## 背景

三域解锁屏（保险库/密码本/加密日记，ADR-0124 共享骨架）的统计卡数字只在解锁期可算
（清单 `safe.enc` 是密文，锁定态读不到），原先仅存会话内存（`lockStatsCache` /
`pwLockStatsCache`）——冷启动（本次会话从未解锁）一律显示「—」。备忘录要求把统计快照
持久化到明文数据文件。

## 方案

1. **新增 `src/core/lock-stats.ts`**：读写 `CONFIG/STORAGE/lock-stats.json`（明文，新增
   文件，既有数据格式零变更）。键 = `LockScreenKind`（vault / password-vault / diary），
   值 = `LockScreenStat[]`（num/label 数组），core 无域语义。写走 `updateFileSections`
   段级合并写（多域并发各写各档互不覆盖）+ `writeIfChanged`；读容错，失败返回 null。
2. **encrypt/ui.ts**：`captureLockStats()` 三档算齐后 fire-and-forget 落盘（写失败静默，
   下次解锁重写）；`showPasswordDialog()` 兜底链改为 会话缓存 → lock-stats.json → 「—」。
3. **password-vault/ui.ts**：`showLock()` 前 hydrate 一次（仅首显，此后由
   `captureLockStats` 维护新鲜度）；解锁态快照即落盘本档。
4. **diary 零改动**：经 `ensureSafeUnlocked('diary')` 复用 encrypt 解锁屏，自动生效。

## 取舍（有意接受）

- 明文计数会向能读 vault 目录的人暴露条目规模（元数据级泄露）——需求本体，ADR-0124
  决策 4 同步修订（docs/adr/ADR-0124-shared-lock-screen.md）。
- 文件缺失 / 该档缺失 / 读失败仍显「—」，**不编造数字**（保留 ADR-0124 底线）。
- 快照可能过期（他设备删改后未再解锁）——下次解锁自动刷新。

## 验收

- [x] `pnpm exec tsc --noEmit` 干净
- [x] 数据层测试 `tests/core/lock-stats.test.ts`（node 环境）：读写回 / 段级合并互不覆盖 /
      损坏留档容错回落 null
- [x] UI 层：encrypt 冷启动回落（review-fix-lock-ui）+ 解锁态三档落盘；
      password-vault 冷启动回落 + 解锁态落盘（ui.test，waitForAsync 轮询防 flake）
- [x] reviewer 审查 pass（P2 轮询化 + P3 node 标注/encrypt 落盘测试当场回补）
- [x] 合并 master（含并行会话 encrypt 评审壳改动，无冲突）后主仓全量 4577 用例绿
