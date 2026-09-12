# 292 — 备忘录设置退役「到期时间格式」：到期文案固定相对

- 日期：2026-09-12
- 用户拍板（一句话需求）：备忘录的设置面板去掉到期时间格式，固定相对日期
- 关联：ADR-0126（决策记录）、ADR-0117（memo* 键保留名单，本批修订）、ADR-0092（键名即存储契约）、ADR-0104（渲染/行为分层）
- 状态：已完成

## §1 改动

| 面 | 文件 | 内容 |
|---|---|---|
| 设置面板 | `src/memo/settings.ts` | 「显示」组删掉「到期时间格式」行（原本 relative/absolute 二选一） |
| 文案口径 | `src/memo/due.ts` | `formatDueText(due)` 去掉 `mode` 参数与 absolute 分支——逾期=「N天前已过期 / 今天 HH:mm 已过期」、今日=「今天 HH:mm 到期」、明日=「明天 HH:mm 到期」、更远=「MM/DD HH:mm 到期」（相对口径本就是默认，此处只删分支） |
| 消费侧 | `src/memo/ui.ts` | `metaDueOf` 不再读设置（少一次 `tryGetSettings()`），直接 `formatDueText(it.due)` |
| 设置键 | `src/settings.ts` | `memoDueFormat` 从 `BzSettings` 与 `DEFAULT_SETTINGS` 一并删除，data.json 残留值忽略（对齐 ADR-0115 退役键口径，不改名不迁移） |
| 注释 | `src/memo/render.ts` | `MetaDue` 注入包注释去掉 `settings.memoDueFormat` 提法 |

## §2 测试

- `tests/memo/due.test.ts`：原「absolute 模式」用例改为回归守卫「口径固定相对：第二参不再影响输出」（传 `'absolute'` 仍出相对文案，防分支复活）。
- `tests/memo/ui.test.ts`：设置 schema 用例补两条断言——「显示」组不含「到期时间格式」行、不含 `memoDueFormat` 键绑定。
- `tests/settings-panel.test.ts`：备忘录徽标计数 10 → 9（少一行设置）。
- 三个 memo 测试 fixture 删除 `memoDueFormat: 'relative'`（键已不存在）。

## §3 门禁记录

- `pnpm exec tsc --noEmit` → 0 错误（顺带验证全仓无残留消费点）。
- `pnpm test tests/memo` → 12 文件 / 160 测试全绿；`tests/settings-panel.test.ts` + 两例既有抖动文件单独跑 57 全绿。
- 全量 `pnpm test` 唯一残红为 `tests/preview-freshness.test.ts`（源指纹）——按 issue 291 §7② 既有口径在主仓库重出原型产物，不在 worktree 重出。

## §4 未覆盖（备查）

- 全量跑时 `tests/home/ui-river.test.ts` / `tests/password-vault/review-fix-lock.test.ts` 仍会因固定 `setTimeout(20ms)` 在高负载下红（issue 291 §7① 既有问题，与本批无关）。
