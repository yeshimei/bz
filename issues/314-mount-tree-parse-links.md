# 314 挂载树·数据层一：正文双链解析与六类形态

- 状态：已交付（`src/knowledge/mount-types.ts` 共享契约 + `mount-data.ts` 解析层 `parseMountLinks`／`classifyKind`／`readSubpathBody`／`relocateAnchor`；`tests/knowledge/mount-data.test.ts` 覆盖六类／别名／全路径／大小写／重复／自链／断链与锚点重定位——该文件现共 43 用例，含 315 的计数与孤儿）
- 关联：ADR-0137 §3 ／ spec `.scratch/mount-canvas/spec.md` ／ 共享契约 `src/knowledge/mount-types.ts` ／ 新增 `src/knowledge/mount-data.ts`（`data.ts` 已被文献盒任务管理器占用）／ 测试 `tests/knowledge/mount-data.test.ts`
- 依赖：无（本包第一张卡）

## 背景

知识盒目前**没有**正文双链解析（预览是整篇 `MarkdownRenderer.render`，`src/knowledge/ui.ts:709`），
而挂载树要回答「从正文里哪句话挂到哪张卡」。ADR-0137 §3 定了六类内容形态。

## 交付

- [ ] `parseMountLinks(body)`：扫正文产出 `{ raw, target, alias, subpath, kind, from, to, text }[]`——
      支持 `[[笔记]]`／`[[笔记|别名]]`／`[[笔记#标题]]`／`[[笔记#^块id]]`／`![[图片.png]]`／`![[视频.mp4]]`（含 `!` 嵌入语法）；
      路径解析走 `metadataCache.getFirstLinkpathDest`，盒外/不存在标 `missing`。
- [ ] `classifyKind(target, subpath, raw)`：归入六类（note／head／para／image／video／card）；**卡片判定**：目标在卡片盒目录内（`cardboxDirOf()`）。
- [ ] `resolveBlockRef(file, blockId)` / 标题引用取 `metadataCache` headings 的内容范围（供画布显示那一段）。
      **交付项名以实现为准**：块引用与标题片段合并为一个入口 `readSubpathBody(file, subpath, ctx)`（`src/knowledge/mount-data.ts`），不再单独出 `resolveBlockRef`。
- [ ] 锚点**可重定位**：记文本片段而非只记字节偏移，编辑/换行后按内容匹配（ADR-0138 后果节）。
- [ ] 测试（`// @vitest-environment node`）：六类各一例 + 别名/全路径/大小写/重复/自链 + 断链（盒外、已删）。

## 验收

`pnpm test tests/knowledge` 绿；对 `tests/mock-vault.ts` 造的多形态样本逐条断言。
