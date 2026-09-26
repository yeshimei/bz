# 380 术语文献退役 term 冗余键（ADR-0169）

- 状态：已交付（2026-09-19，wt/380-term-key-retire 流程）
- 提出：2026-09-19 用户核对术语笔记属性时的提问 → 当场拍板删除
- 相关：ADR-0169；ADR-0073（判型启发式）、ADR-0116（来源键）

## 用户原话

> term 是什么，为什么和 title 完全一样
> 不是有一个 type 可以判断吗
> 冗余键那就删掉吧，代码和笔记属性中都删掉

## 改动

- `src/knowledge/note-gen.ts`：`generateTermNote` 落盘四键（删 `term:` 行）；新增导出 `dropTermKeyIfTyped`
  （仅 `type=term` 时删 term 行；缺 type 判型窗口不动；引号包裹 type 同认）；`backfillNotes` 前置清理 +
  type 补丁落地时同趟清。
- 测试 `tests/knowledge/note-gen.test.ts`：四键断言替换（含图版/来源用例措辞）；新增 `dropTermKeyIfTyped`
  纯函数用例（幂等 / CRLF / 判型窗口保护 / type 非 term 防误删 / 正文行不受影响）+ backfill 两条场景
  （双全存量清理、缺 type 同趟清）。
- 原型 `prototypes/knowledge/fake-sim.ts`：8 条术语样张落四键，行为包重出（多域行为包含 note-gen）。
- 文档：CONTEXT.md「文献笔记」词条、ADR-0169、spec.md 补注。

## 验收

- 新生成术语笔记属性无 term 行；打开知识盒面板后，存量术语笔记（type 已定）的 term 行自动清除；
- 缺 type 的存量：term 保留至 type 补上，同一趟落盘即清。
