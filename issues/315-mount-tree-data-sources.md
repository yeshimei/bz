# 315 挂载树·数据层二：同名文献对齐、手动挂载 mounted、引用计数与孤儿卡

- 状态：已交付（`mount-data.ts`：`findSameNameNote` 同名对齐（顺序无关）、`readMounts`／`writeMount`／`removeMount` 纯字符串 frontmatter 读写、`readRelated`、`buildMountTree` 三源/可达/非回指/严格跨代/方向翻转、`refCounts`／`orphanCards`（自链不计被引、`counts` 可选复用）；这些用例与 314 同在 `tests/knowledge/mount-data.test.ts`（现共 43 用例））
- 关联：ADR-0137 §1/§2 ／ spec ／ 共享契约 `src/knowledge/mount-types.ts` ／ 新增 `src/knowledge/mount-data.ts` ／ `src/knowledge/ui.ts:116`（`parseRelatedNames` 同路子）
- 依赖：314

## 背景

ADR-0137 §1 要求「文献目录里与卡片同名的笔记按名字**持续对齐**」——src 里不存在（唯一按名解析是 diary 对 `getFirstLinkpathDest` 的用法）；
§2 要求手动挂载写卡片 frontmatter（全插件**唯一落盘**项）。

## 交付

- [ ] `findSameNameNote(card)`：文献目录内按名查找（`getFirstLinkpathDest` + 目录前缀双保险），**实时读、零落盘**。
- [ ] 顺序无关：先卡后文献 / 先文献后卡都成立（遍历而非快照）；改名跟随由 `rename` 事件驱动（与 317 即时重算共用）。
- [ ] `readMounts` / `writeMount` / `removeMount`：frontmatter `mounted` 键，**纯字符串行读写**（幂等同 `appendRelatedLine`，不碰其它键）；仅允许卡片，违反抛错。
- [ ] `readRelated(card)` 复用 `parseRelatedNames`。
- [ ] `buildMountTree(card, { direction })`：三源汇总 + 六类形态 → 节点/边（可达 ／ 非回指 ／ **严格跨代**）+ `missing` 标记；**方向翻转走同一构建器**。
- [ ] `refCounts(vault)`：只数用户双链（正文 wikilink + related + mounted）→ 卡片行徽标。
- [ ] `orphanCards(vault)`：既无入链也无挂载 → 列表筛选。
- [ ] 测试：同名对齐两种顺序、改名跟随、mounted 幂等/去重/不伤其它键、三类边过滤、计数与孤儿判定。

## 验收

数据层全绿；`buildMountTree` 对固定样本产出**顺序稳定**的节点/边集合（可断言）。
