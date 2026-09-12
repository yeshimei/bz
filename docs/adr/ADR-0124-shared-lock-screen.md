# ADR-0124：三域共用解锁屏（core/ui/lock-screen）

- 状态：已采纳（2026-09-11）
- 涉及域：encrypt（保险库）／password-vault（密码本）／diary（加密日记）

## 背景

三域早已共用同一把主密码与同一个 `SafeManager` 单例（ADR-0085/0109/0110），
但解锁屏各自实现、结构不一致：

- `encrypt`：`UIManager.showPasswordDialog()` 纯 DOM 构造，类名 `.bz-encrypt-dialog-*`；
- `password-vault`：`render.ts::lockHTML()` 模板（desk/mob 双实例），类名 `.bz-password-vault-lock`；
- `diary`：没有自己的解锁屏，直接复用 encrypt 的弹窗（文案仍是「保险库」）。

保险库改版（原型 `prototypes/encrypt-lab/vault-pwstyle.html`）定下了新的解锁屏结构：
印章徽 + 标题 + 副题 + **三张统计卡** + 主密码输入 + 主按钮 + 安全提示行。
用户要求：密码本与加密日记沿用同一结构，**内容按各自域填、样式按各自域走**。

## 决策

1. **共享壳落 `src/core/ui/lock-screen.ts`（`uiLockScreen`）**，只提供结构与槽位：
   印章徽 / 标题 / 副题 / 统计卡 / 输入（首设双输入）/ 主按钮 / 错误行 / 安全提示行 / hint。
   - 组件**不碰密码语义**：校验、冷却节流、清单损坏重设、首设流程全部留在各域；
   - `inline: true` 时返回内容盒（供域内覆盖层复用，如密码本 desk/mob 双实例），
     缺省返回全屏遮罩（挂 body）。
   - 依据 ADR-0002（`core ← config ← store ← ui` 单向）：共享壳放任一域都会造成域间反向依赖；
     先例：`flow-dialog` / `uiModal` / `uiStat` / `attachItemActions` 已是同构「core 提供无域语义的壳」。
2. **内容与统计由调用域注入**：`LOCK_KIND_META`（encrypt/ui.ts）给出三套文案与统计口径——
   - vault：笔记条目 / 随库附件 / 附件密文
   - password-vault：平台 / 口令条目 / 收藏
   - diary：加密条目 / 随库附件 / 附件密文
   `ensureSafeUnlocked(kind)` 新增 `kind` 参数，`diary` 传 `'diary'` 即得本域口径与配色。
3. **样式按域作用域**：组件类名 `.bz-lockscreen*` + 作用域 `.bz-lockscreen--vault|password-vault|diary`，
   组件暴露 `--ls-accent / --ls-accent-soft / --ls-seal-radius / --ls-bg / --ls-surface / --ls-ink …` 变量供域覆盖。
4. **统计是快照（2026-09-12 修订，issue 300）**：清单（`safe.enc`）本身是密文，锁定态读不到计数。
   统计在解锁期间快照（`captureLockStats()`）——原仅存会话内存，冷启动一律「—」；
   **修订后快照同时落明文档 `CONFIG/STORAGE/lock-stats.json`（`core/lock-stats.ts`，段级合并写），
   冷启动回落「上次快照」而非一律「—」**；文件缺失 / 该档缺失 / 读失败仍显「—」，**不编造数字**（底线保留）。
   取舍：明文计数向能读 vault 目录者暴露条目规模（元数据级），系修订有意接受项。
   「密文总量」只统计附件镜像 `blobSize`（正文 .enc 大小清单未记），故标签写作「附件密文」。
5. **取消语义**：新解锁屏无「取消」按钮（原型口径），点遮罩即取消（resolve false）。

## 影响

- 退役类名：`.bz-encrypt-dialog-*`（encrypt）、`[data-lock-*]`（password-vault 锁屏内字段）。
  相关断言已迁移到 `[data-ls="…"]` / `.bz-lockscreen-action`。
- 错误反馈改为**行内报错 + 通知双通道**：原型是行内红字，插件既有语义保留 notice。
- 首设写盘失败：明示错误后收场（resolve false + 关窗），不再把用户困在弹窗里。
- 原型产物需重出（`node scripts/build-preview.mjs`），否则新鲜度守卫红。
