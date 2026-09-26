# 338 · encrypt 共享附件他引保护

- 状态：已实现（2026-09-16，用户对 issue 335 审计报告拍板「全部修复」；本工作树 = 审计#16；
  门禁全绿：tsc --noEmit + vitest 329 文件 5196 用例通过，preview-freshness 按既定排除）
- 关联：ADR-0149 无关；encrypt 加密/解锁既有语义保持

## 现场审计#16

加密流程删原笔记 + 其附件（encrypt/data.ts deleteVaultFile，调用点 :1090/:1115）。
`collectNoteAttachments`（encrypt/ui.ts:145-196）只收集被加密笔记自身引用，
不查附件是否被**其他笔记**同时引用 → 加密期间他篇笔记的嵌入断链，无提示。

## 改动设计

1. 删除前他引检查：对每个候选附件，扫全库 md 的 embeds/links（metadataCache，
   排除被加密笔记自身）解析命中该附件路径者视为共享。实现可复用 ui.ts 现有
   basename 索引思路。
2. 共享附件：**不删原件**（保持他篇笔记嵌入完好）；密文侧照常加密。
3. manifest 记账：共享附件标记（如 keptShared），解锁还原时跳过还原该附件，
   防与保留的原件冲突/覆盖（还原冲突兜底 :1193-1196 保持不动）。
4. 通知：加密完成通知区分「N 个附件被其他笔记共用，原件保留」（正文无 emoji）。

## 测试

- 共享附件：加密后原件仍在、他篇嵌入不断、manifest 标记、解锁跳过还原。
- 非共享附件：既有语义不变（删原件、解锁还原）。
- 门禁：`pnpm exec tsc --noEmit` + vitest（preview-freshness 排除；其余不得新增失败）。
  严禁在 worktree 内 build。

## 边界

- 他引检查基于 metadataCache：极端未索引场景（刚建未落盘）可能漏判，
  与 Obsidian 自身链接能力同边界，不做全量文本扫描兜底。
