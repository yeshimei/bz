# ADR-0155 · encrypt 摘除密码资产视图，快速取密统一

日期：2026-09-16 · 关联：issue 346、ADR-0109（密码本拆回独立域，本 ADR 兑现其挂起的第二步）、ADR-0085（统一保险库，已被 0109 修订）

## 背景

ADR-0109 将密码本拆回独立域时，encrypt 面板内的密码资产视图「暂存待摘除……摘除留待
下一步单独拍板」——该步至今未执行。现状是两套完整密码 UI 同库共存：`src/password-vault/`
（独立域）与 `src/encrypt/vault-pw-view.ts` + `vault-data.ts` + `encrypt/ui.ts` 的密码
资产视图，靠 `encrypt:changed` / `password-vault:changed` 双向事件同步防分叉——
这是持续的重复 UI 维护税，也是口径漂移的温床（两侧确认框/toast/relTime 已各漂一套）。

命令侧同有拆回后遗症：`bz-encrypt-copy-password`（快速复制密码，fuzzy 取现有条目）与
`bz-password-vault-gen`（快速生成密码）名近义异、各占一条。

## 决策

1. **摘除 encrypt 面板的密码资产视图**：`vault-pw-view.ts`、`vault-data.ts` 退役，
   encrypt 面板收敛为「加密笔记 + 加密日记」两资产；共享锁与 `SafeManager` 数据层
   不动（密码数据唯一属主回到 password-vault 域）。
2. **快速取密统一为一条 fuzzy 流**：`bz-encrypt-copy-password` 退役；
   `bz-password-vault-gen` 升级为「fuzzy 列现有密码 + 顶部『生成新』选项」的一条流
   （搜到即复制、无命中生成，60s 剪贴板清空语义不变）。
3. **不合并回一个域**：ADR-0109 已评估 encrypt 侧拆分后累积大量独立演进，整体回退
   风险大；本 ADR 只删重复 UI，不动域边界，避免重演 0085→0109 的合并-拆回乒乓。

## 后果

+ 密码 UI 单一属主，双向事件同步、两套表单/锁屏口径的维护税清零。
+ 快速取密一条命令覆盖「找现有 + 生成新」两个场景。
− 习惯在 encrypt 面板里看密码条目的用户需换 password-vault 面板（数据与锁完全同库，
  主密码不变，无迁移成本）。
− `bz-encrypt-copy-password` 若被外部调用（主页.js 等）将失效；同语义由
  `bz-password-vault-gen` 承接。
