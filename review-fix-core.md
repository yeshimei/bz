# review-fix-core.md — 共享基座（core + main.ts + settings.ts）C1–C16 修复报告

- worktree：`D:\Obsidian\.dsh-worktrees\sweep-core`（分支 `fix/sweep-core`，基于 master 09ce3fb9）
- 提交：`76c993e7` fix(core) C1–C12 ／ `acc8573c` fix(main) C13–C16
- 门禁：`pnpm exec tsc --noEmit` 0 错误；全量 vitest 275 文件 4316 测试全绿（含新增 32 个回归用例）
- 附带：`node scripts/build-preview.mjs` 重出原型快照（src 指纹变化，preview-freshness 守卫要求；只写 prototypes/**，未触碰部署产物）

| 编号 | 位置 | 状态 | 说明 | 测试 |
|---|---|---|---|---|
| C1 | `src/core/ai.ts` | 已修 | 【待验证→证实】流式 fetch/reader.read() 与 requestUrl 均无超时，建连不回包即永不 settle；加 60s 空闲超时（每段数据重置，长流不误杀；requestUrl 以 race 先行 settle），超时抛 TimeoutError 且仍走 requestUrl 兜底一次，用户取消路径不变 | tests/core/sweep-core-ai.test.ts |
| C2 | `src/core/ai.ts` | 已修 | 带 override 的 getAIProvider 解析结果不再写全局缓存（cachePut 仅无 override 时落缓存），无参调用命中语义保留 | tests/core/sweep-core-ai.test.ts |
| C3 | `src/core/obsidian-adapter.ts` | 已修 | 【待验证→证实】查 obsidian.d.ts：TFolder 无 extension（仅 TFile 有），名为 xxx.md 的目录走路径兜底被误判为 md；兜底排除 children 数组形态（目录恒不派发，rename 同防） | tests/core/obsidian-adapter.test.ts |
| C4 | `src/core/obsidian-adapter.ts` | 已修 | rename 按「新旧任一为 .md」判定派发（目录改名排除）；md→非md 时通用 `vault:md-renamed` 照发，语义路维持 classifyFilePath 只认 .md 的既有契约不发 | tests/core/obsidian-adapter.test.ts |
| C5 | `src/core/ui/select.ts`、`src/core/ui/popover.ts` | 已修 | 私挂 document 级 ESC 监听退役，开层 register / 关层 unregister 走 escManager；面板开着下拉时按 ESC 先关下拉、面板保留 | tests/core/sweep-core-fixes.test.ts（ui.test.ts 旧断言同步更新） |
| C6 | `src/core/item-actions.ts` | 已修 | 400ms 静置窗口只吞落在浮层（抽屉/遮罩）内的合成 click；浮层外窗口期点击判真实点击放行（外部点击关闭语义照常） | tests/core/sweep-core-fixes.test.ts |
| C7 | `src/core/crypto.ts` | 已修 | 派生密钥缓存改 **LRU 有界**（128 条 + 命中刷新 + 上限淘汰）。实现注记：先试「encrypt 不缓存」方案，实测导致 decrypt 端每条目重复十万次 PBKDF2 的性能回归（password-vault 渲染路径复现），按报告备选改 LRU——命中语义与性能零回归，明文密码副本不再无界驻留；clearCryptoKeyCache 语义不变 | tests/core/sweep-core-fixes.test.ts |
| C8 | `src/core/z-order.ts` | 已修 | 补 `unregisterAlwaysOnTop` 导出 + sync 时对 `!isConnected` 元素自动清扫（重挂载型组件重新 register 即恢复），Set 不再滞留离场 DOM 子树 | tests/core/sweep-core-fixes.test.ts |
| C9 | `src/core/ui/lightbox.ts` | 已修 | esc 句柄提为模块级 `currentEscHandle`，导出的 `closeLightbox()` 一并注销 esc 层 | tests/core/sweep-core-fixes.test.ts |
| C10 | `src/core/settings-schema.ts` | 已修 | list 行移除 onChange 抛错 → notifySaveError 通知 + finally 回滚重绘（条目恢复显示），不再 unhandled rejection；成功路径不变 | tests/core/sweep-core-fixes.test.ts |
| C11 | `src/core/settings-model-picker.ts` | 已修 | onPick 同步抛错 / Promise reject 均在 try/catch/finally 内收口并关闭选择器（原先同步抛错直接冒泡卡死不关）；异常经 console.error 不静默 | tests/core/sweep-core-fixes.test.ts |
| C12 | `src/core/ui/choice.ts` | 已修 | float 形态 resize 回调检测 `!el.isConnected` 即自摘 window 监听（detach 契约保留，忘调自愈） | tests/core/sweep-core-fixes.test.ts |
| C13 | `src/main.ts` | 已修 | 【待验证→证实】onLayoutReady 回调无卸载路径（推演证实：启动窗口期禁用插件后回调仍被 workspace 持有执行）；加 `unloaded` 旗标 onunload 首行置位、回调首行短路；同型第二处 `ensureSecondBrainOnReady` 的 setTimeout 同旗标短路（双向对照测试：未卸载正常触发/卸载后全静默） | tests/core/sweep-core-main.test.ts |
| C14 | `src/main.ts` + `src/core/flow-dialog.ts` | 已修 | flow-dialog 导出 `cancelActiveFlowDialog()`（按取消语义 resolve undefined + settle 全量清理，幂等）；onunload 硬删 `__shared_confirm_mask__` 前先调用，在途确认框 Promise 不再悬挂 | tests/core/sweep-core-fixes.test.ts |
| C15 | `src/main.ts` | 已修 | 【待验证→证实】saveSettings 无串行化（代码推演证实）；promise 链串行队列——并发调用排队写 data.json，失败不断链、错误照常透出调用方 | tests/core/sweep-core-main.test.ts |
| C16 | `src/settings.ts` | 已修 | `migrateMemoSettingKeys` 返回是否发生迁移（旧键存在即算）；onload 检测到迁移即调度 saveSettings，data.json 不再残留旧键、不再每次启动重复迁移 | tests/core/sweep-core-main.test.ts |

## 未尽事项
- 无「未处理 / 证伪 / 产品拍板」项，16 条全部修复。
- 全量测试出现过一次 `tests/home/ui-river.test.ts` 并发 flaky（单跑与复跑全量均绿，与本批改动无关，属既有并发时序抖动，vitest retry 吸收）。
- 本 worktree 未做插件主构建（铁律：严禁 worktree 内构建），合并回主仓库后按流程 `pnpm run build` 部署。
