# 320 挂载树·列表侧四项与全包门禁

- 状态：已交付（卡片列表行引用计数徽标（只数用户双链，0 不显示，自链不计）+ 孤儿筛选开关与行标记（含空态/扫描失败置灰）+ 整库扫描每轮 refresh 只走一遍（`refCounts` 结果交给 `orphanCards(ctx, counts)` 复用）并缓存到面板对象；`src/knowledge/ui.ts`／`mount-data.ts`／`styles.css`，`tests/knowledge/mount-list.test.ts` 8 用例。反向视图/面包屑等画布四项已由 317 覆盖）
- 关联：ADR-0138 §5（已采纳路线图，⑥布局持久化已作废）／ spec §界面 ／ `src/knowledge/ui.ts`（列表渲染）／ AGENTS.md 质量门禁
- 依赖：315（反向索引）；317（面包屑与反向视图若未收口则在此补齐）

## 交付

- [x] 卡片行**引用计数徽标**（只数用户双链：正文 wikilink + related + mounted；0 不显示，自链不计入）。
- [x] **孤儿卡**筛选 + 行标记（既无入链也无挂载；含空态文案与扫描失败置灰「未统计」）。
- [x] 反向视图与面包屑若 317 未收口：在此补齐 → **317 已收口**（`feat/mount-canvas` 的 `mount-canvas.ts`：面包屑/方向翻转/血缘高亮/悬停联动），本卡未重复实现。
- [x] 全包门禁：全量 `vitest`（含 smoke）＋ `tsc --noEmit` ＋ 自审 ＋ diff 审查全绿；整库扫描每轮 refresh 实测只走一遍（`getMarkdownFiles`/`cachedRead` 差值断言）；构建验证与样式聚合留集成方（worktree 禁构建）。
- [x] 文档回写：`HANDOFF.md` 状态段（原型 → 已落成插件功能，含 §6.1 实现文件表）、`CONTEXT.md` 挂载树词条复核、ADR 索引（仓库无索引文件，未新增）。

## 验收

全绿；卡片列表能用徽标与「孤儿」筛选回答「哪些卡没人挂、哪些卡没挂过谁」。
