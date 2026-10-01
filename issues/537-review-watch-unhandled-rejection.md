# 537 · review/watch 测试的 4 条 Unhandled Rejection（`pnpm test` 退出码 1）

## 症状

跑全量 `pnpm test`（或增量选择器命中 `tests/review/watch.test.ts`）时：

```
  Test Files  589 passed (589)
       Tests  3104 passed (3104)
      Errors  4 errors        ← 全是 Unhandled Rejection
```

**用例一条没红，退出码却是 1** —— 本仓「门禁全绿」因此在 master 上不成立（2026-10-01 实测：
主仓库 `712fa698` 全量 `pnpm test` = 589 文件全过 + 4 errors + exit 1；单跑该文件同样 4 errors + exit 1）。

这意味着任何一次提交前的门禁都拿不到干净结论：退出码 1 会让 `pnpm changelog` 之外的自动化、
以及「只有退出码 0 才写回结果缓存」的增量缓存（`scripts/test-affected.mjs`）一起失效。

## 复现（最小）

```bash
pnpm exec vitest run tests/review/watch.test.ts   # 15 passed / 4 errors / exit 1
```

按 describe 分块可定位到 `ReviewWatcher 自动加入`（`-t "批 B 修复回归"` 反而干净）：

| 单跑用例 | Unhandled Rejection 条数 |
|---|---|
| `onVaultCreate：监听目录内新建自动加入…` | 1 |
| `ticket 100：自动加入提醒…` | 4 |
| `onVaultDelete：确认移除…` | 2 |
| `onVaultRename：自动更新路径…` | 2 |
| `ticket n2：批量改名通知合并…` | 5 |
| `confirmBatchAddForFolder` / `ticket 57` / `removeWatchedFolder` | 0 |

## 根因

栈一律长这样（`Vite module runner has been closed.`，落在 `_runInlinedModule` 求值 `src/review/quiz-core/index.ts`）：

```
Error: Vite module runner has been closed.
 ❯ VitestModuleRunner.getModuleInformation module-runner.js:1203
 ❯ VitestModuleRunner.cachedModule        module-runner.js:1185
 ❯ request                                module-runner.js:1225
 ❯ src/review/quiz-core/index.ts:5:37
```

链条：

1. `ReviewWatcher.onVaultCreate / onVaultRename / onVaultDelete / removeWatchedFolder` 都用
   **`void this.refresh()`** 发射列表刷新（列表即时补卡、不随事件 await —— 这是**被测行为**，
   `tests/review/watch.test.ts` 的 U8 用例专门断言它是 void 发射）；
2. `refresh()` 内部是 `await import('./index')` → `await import('./app')`，**冷模块**动态导入要付
   真实 transport + transform（实测几十 ms）；
3. 该文件的文件级 `beforeEach` 会 `vi.useFakeTimers()`。请求在用例中途发出，假钟一装上，
   这条还在飞的导入就再也不会被推进；下一个用例又把假钟装回去（`afterEach` 的
   `vi.useRealTimers()` 只是还原，不推进）；
4. 文件结束、模块 runner 关闭 → 悬着的请求被拒 → Unhandled Rejection。

**旁证（本 issue 定位时的对照实验，数字直接否掉了两个错误猜想）**：

- 在文件级 `afterAll` 里让出 **150ms** 真实时间 → **仍是 4 条**（单次收尾排空无效：
  前几个用例的请求已被后续 `useFakeTimers()` 卡死，收尾时不会再推进）；
- 在 `afterEach` 里逐个排空 → 有效，但要 **100ms × 15 用例**（墙钟 1.31s → 3.07s）才干净 ——
  说明差的不是「几个微任务跳数」，而是**冷模块导入的真实耗时**。

`tests/setup.ts` 的 `DRAIN_MS = 60` 全局排空救不了它：那是 `afterAll` 时点，正是上表第一行证明无效的位置。

> 与 `issues/534-test-affected-incremental.md` 第 191–193 行记的「把 setup.ts 排空窗口
> 60ms → 5ms 会冒出 4 个 Unhandled Rejection」是**同一数量级、不同来源**：那条是全局窗口太小，
> 本条是假钟冻住了动态导入。别再靠调 `DRAIN_MS` 治本条。

## 修法（测试侧预热，零排空）

在装假钟之前把 `refresh()` 的两个动态导入目标预热进 evaluator 缓存：

```ts
beforeAll(async () => {
  await import('../../src/review/index');
  await import('../../src/review/app');
});
```

图已进缓存后，`refresh()` 的两次 import 只剩微任务跳数、在用例内就跑完 —— 什么都不留在飞。
`beforeAll` 早于首次 `beforeEach`，此时是真实计时器，导入能正常完成。

实测：`15 passed / 0 errors / exit 0`，连跑 3 次稳定；墙钟 1.31s → 1.80s（+0.49s，一次性的）。

**边界**：`refresh()` 若新增动态 import 目标，`beforeAll` 要一起预热（已在该处注释写明）。
之所以不改 `src/review/watch.ts` 的 `void this.refresh()`——那是被测行为，改它会改掉 U8 覆盖的东西。

## 验收

- `pnpm exec vitest run tests/review/watch.test.ts` → 0 errors、exit 0（连跑 3 次）；
- 全量 `pnpm test` → 无 `Errors` 行、exit 0；
- 增量选择器 `node scripts/test-affected.mjs --since master` → exit 0 且**结果缓存写回**
  （此前恒为「vitest 退出码 1，不写回结果缓存」，等于缓存永远不长）。

## 明确不做

- 不把 `beforeAll` 预热改成 `afterEach` 排空 sleep：见上表，单次收尾无效、逐个排空要付 1.7s 墙钟。
- 不改 `tests/setup.ts` 的全局 `DRAIN_MS`：那是一处全局成本（59 文件 × Δms），且时点不对。
- 不遍历全部测试文件找同类泄漏：全量跑只命中这一个文件（4 errors 全部归属
  `tests/review/watch.test.ts`），没有证据支持再扩大改动面。
