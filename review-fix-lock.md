# 锁家族 + 备忘录修复批结果（review-all-bugs.md 三节 E1-E23 + 二节 D4）

- 分支：`fix/sweep-lock`（worktree `D:\Obsidian\.dsh-worktrees\sweep-lock`，基于最新 master）
- 门禁：`pnpm exec tsc --noEmit` 0 错误；`pnpm test` 全量 **277 文件 / 4311 测试全绿**（基线 272/4280 + 本批新增 5 个测试文件 31 条用例）。
- 提交：`fd69c4d5` fix(encrypt) · `bdfb3b03` fix(password-vault) · `870f3f9e` fix(memo) · `863803b2` chore(原型产物重出，含 master 基线已滞后的 home/pomodoro render)。
- 禁改红线遵守：未动任何 `*.css`；未动 src/encrypt、src/password-vault、src/memo 之外源码（tests 内对既有用例的断言随语义更新除外）；未执行 `pnpm run build/dev`（原型产物重出用守卫测试明示的 `node scripts/build-preview.mjs`，只写仓内 `prototypes/`）。

| 编号 | 位置 | 状态 | 一句话说明 | 测试文件 |
|---|---|---|---|---|
| E1 | `src/password-vault/ui.ts` askConfirm | 已修 | `.ok` 监听器随弹窗首绑一次，回调存实例字段 `confirmYes` 每次 askConfirm 覆写，ESC 关闭同步作废挂起回调——第一次取消后第二次确认不再执行第一次的动作 | `tests/password-vault/review-fix-lock.test.ts`（含连续两次确认对照） |
| E2 | `src/password-vault/ui.ts` show/hide/cleanup | 已修 | 面板打开期间订阅 `encrypt:unlock-changed`：别域上锁 → 数据清空 + 锁屏接管，解锁 → 重载重绘；旗标防 lock 重复广播死循环 | 同上 |
| E3 | `src/encrypt/ui.ts` renderNoteDetail | 已修 | 日记详情异步解密回填增加「当前资产 === diary」校验，切到密码资产后迟到回填被拦下 | `tests/encrypt/review-fix-lock-ui.test.ts` |
| E4 | `src/encrypt/data.ts` firstTimeSetup | 已修 | 首设写盘失败回滚时补发 `onUnlockChange(false)` + `encrypt:unlock-changed(false)` 双通道，状态栏/订阅方不再卡「已解锁」 | `tests/encrypt/review-fix-lock.test.ts` |
| E5 | `src/password-vault/render.ts` modalHTML + ui.ts bindDialogs | 已修 | 弹窗密码框补 `type="password"` 默认掩码 + eye 按钮明文/掩码切换（对齐 encrypt 侧同弹窗） | `tests/password-vault/review-fix-lock.test.ts` |
| E6 | `src/password-vault/ui.ts` handleAccountAction/refreshMobPage | 已修 | 新增 refreshMobPage：eye/fav/删除后按 mobPagePlatform（区分平台页/账号页）即时重建移动详情页内容，条目删光则收起页面 | `tests/password-vault/review-fix-lock.test.ts`（eye/fav 即时生效 + 删除收页） |
| E7 | `src/memo/reminder.ts` | 已修 | 提醒后台自持 `fileOpenApp` 模块变量，卸载不再经 `M.appRef` 可选链短路——禁用插件后 file-open 监听真正摘除，再启用不叠加 | `tests/memo/review-fix-lock.test.ts` |
| E8 | `src/memo/ui.ts` openMemoPanel | 已修 | 打开面板时重置 `M.search`，重开后列表不再被旧关键词过滤；notePath 定位在 loadData 后另行覆写不受影响 | `tests/memo/review-fix-lock.test.ts` |
| E9 | `src/encrypt/ui.ts` renderWithTimeout | 已修 | render 渲入私有容器，超时即弃用并返回全新容器走纯文本兜底——迟到 promise 追加进孤儿节点，正文不再叠双份 | `tests/encrypt/review-fix-lock-ui.test.ts` |
| E10 | `src/encrypt/ui.ts` EncryptAppController.cleanup | 已修 | cleanup 末尾 `EncryptAppController.instance = null`，同会话禁用再启用按新设置重建（对齐 password-vault 先例） | 手工核对（模式与 password-vault 一致，行为由 getInstance 单例语义保证） |
| E11 | `src/encrypt/ui.ts` hide/lockNow + `src/encrypt/index.ts` lockSafe | 已修 | hide 增 suppressed 参数：空闲自动上锁由 bumpIdleLock 发一条「15 分钟无操作」，lockNow(assertTrue 命令路径) 安静上锁由命令侧发一条——一次上锁恒一条通知 | `tests/encrypt/review-fix-lock-ui.test.ts` |
| E12 | `src/encrypt/data.ts` unlock | 已修 | 清单密文解出 null/标量/数组（合法 JSON 结构损坏）走 corrupt 分支可重设，不再因对 null 赋值抛 TypeError 误判「密码错误」 | `tests/encrypt/review-fix-lock.test.ts`（null + 数组 + 密码错对照） |
| E13 | `src/encrypt/data.ts` removeNote/updateNotePayload/resolveHealth | 已修 | 三者整体包入 `enqueueOp`，与 lockNote/restoreNote 同链串行——内存清单快照不再互踩（后落盘旧快照抹掉并发新增） | `tests/encrypt/review-fix-lock.test.ts`（探针断言 lockNote 清单写完整结束后 removeNote 才落盘） |
| E14 | `src/encrypt/data.ts` lockNoteSerial S5 + `src/encrypt/ui.ts` lockCurrentNote | 已修（验证证实） | 证实：读正文→确认框→附件加密（PBKDF2）→S5 删原文窗口内编辑即丢。S5 删前重读比对（归一化行尾），不一致保留原文件并经新增 `onSkippedStale` 上报提示重做 | `tests/encrypt/review-fix-lock.test.ts`（stale 保留 + 一致删除对照） |
| E15 | `src/password-vault/ui.ts` hide | 已修 | 安全模式自动上锁提示从面板内 toast（已隐藏不可见）改为全局 `notice` | `tests/password-vault/review-fix-lock.test.ts` |
| E16 | `src/password-vault/ui.ts` handleAccountAction/buildAccountActions/buildPlatformActions | 已修 | fav/删除/删平台写操作 try/catch → 面板 toast 报错 + 回滚重绘，不再裸 await 成 unhandled rejection | `tests/password-vault/review-fix-lock.test.ts` |
| E17 | `src/password-vault/render.ts` avatarHTML | 已修 | 平台头像首字符 `esc()` 转义，与其他出口同口径 | `tests/password-vault/review-fix-lock.test.ts` |
| E18 | `src/encrypt/ui.ts` showPasswordDialog | 已修 | encrypt 侧首设补「主密码至少 4 位」（与 password-vault 锁屏同规则，同一把锁一套阈值） | `tests/encrypt/review-fix-lock-ui.test.ts`；既有用例短密码随语义更新 |
| E19 | `src/memo/ui.ts` addFromComposer | 已修 | composer 加 busy 标志防落盘窗口期双击双提交（清空移入成功分支后输入框不再是防重入屏障） | `tests/memo/review-fix-lock.test.ts` |
| E20 | `src/memo/ui.ts` addFromComposer | 已修 | 输入框清空移入成功分支，保存失败草稿保留（与移动端弹窗路径同口径） | `tests/memo/review-fix-lock.test.ts`（失败保留 + 成功清空对照） |
| E21 | `src/memo/file-sync.ts` syncRename | 已修 | 标题联动仅对本条 notePath/linkedNote 命中该笔记时生效，内容恰好同名的无关条目不再被盲改 | `tests/memo/review-fix-lock-data.test.ts` |
| E22 | `src/memo/file-sync.ts` 事件守卫 | 已修 | 监听范围外但被 memo.json 实际引用（notePath/linkedNote 命中）的笔记 rename/delete 照常放行同步；无引用范围外事件仍零写入。既有「范围外一律不动」用例断言的正是报告认定的缺陷行为，已随新语义更新 | `tests/memo/review-fix-lock-data.test.ts` + `tests/memo/file-sync.test.ts`（用例更新） |
| E23 | `src/memo/data.ts` loadItems | 已修 | 合法 JSON 但非数组（对象/标量）→ 按原样留档 `CONFIG/.CORRUPT/` 后重建空清单 + warning 通知，面板不再静默空白 | `tests/memo/review-fix-lock-data.test.ts`（损坏重建 + 合法数组对照） |
| D4 | `src/encrypt/data.ts` mergeDiaryBlock | 已修（encrypt 侧）＋跨域-移交（diary 侧） | encrypt 侧：mergeDiaryBlock 的读改写整体包入 `enqueueFileTask(datePath)`（键 = 日期 md 路径，与 diary 写层 withDateFile 同队列互斥），「还原块被写层全量重写抹掉且清单已删」的 P2 场景闭环；diary 侧 `src/diary/ui/repair-modal.ts` runFix 仍是裸 read/modify 直写（修复写盘不进队列），按授权不改 diary 源码 → 移交 diary 域处理 | `tests/encrypt/review-fix-lock.test.ts`（还原与占队慢任务互斥，双方内容都落盘） |

## 统计

- **已修 24/24**：E1-E23 全部 + D4 encrypt 侧；其中 E13/E14（【待验证】）均先验证证实后修复（E13 代码推演清单写交错窗口；E14 推演确认框+附件加密+PBKDF2 耗时窗口）。
- **移交 1 项**：D4 的 diary 侧 `runFix`（src/diary/ui/repair-modal.ts:274-296）裸直写不入队列——超出本组「禁改 src/diary」授权，需 diary 域代理把它包进 `enqueueFileTask(同路径)` 或改走 diary 写层。
- **无「已失效 / 证伪 / UI样式-跳过 / 产品拍板-移交 / 未处理」条目**。

## 连带调整（非 E 条目，为保门禁绿）

1. `tests/encrypt/data.test.ts`：并发 lockNote 测试中 X 的盘上原文改为与加密 content 一致——E14 删前重读比对上线后，故意不一致的人工构造会被正确判为「加密期间被编辑」保留原文件。
2. `tests/encrypt/ui.test.ts`：三处首设主密码用例的 'pw'/'pw1' 改为 ≥4 位——E18 统一最短 4 位规则。
3. `tests/memo/file-sync.test.ts`：「watchedFolders 外不动」用例按 E22 新语义更新（被引用的范围外笔记照常同步，无引用的仍零写入）。
4. `prototypes/*/prototype-{render,behavior}.js`：源码变更触发新鲜度守卫，按守卫提示 `node scripts/build-preview.mjs` 重出（仅仓内产物；home/pomodoro render 两处系 master 基线已滞后的存量，一并收敛）。
