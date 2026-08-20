# ADR-0014 附件搬移——vault.rename + 自研链接改写（不用 fileManager.renameFile）

状态：已实现（bz，ticket 65）
日期：2026-08

## 背景

新增「附件搬移」命令（`bz-attach-move`）：把当前笔记引用的全部 vault 内非 .md 文件移动到用户选定的文件夹；仅当目标文件夹存在同名文件时才改名（`原名 (N).ext`），并同步改写全库引用它的链接。链接改写是本功能的核心难点——全库此前无任何 wikilink 解析/改写逻辑。

## 决策

1. **搬移用 `app.vault.rename(file, newPath)`**（Obsidian 移动文件的标准原语），而非 `app.fileManager.renameFile`。原因：
   - 需要自定义「仅在目标文件夹存在同名时改名」的命名策略（`原名 (N).ext`），renameFile 内建去重语义不可控；
   - 需要可单测的纯逻辑层——测试环境（mock vault）无 fileManager，而 vault.rename/read/modify 已全量 mock。
2. **链接改写自研**：解析笔记内容中的 wikilink（`[[...]]` / `![[...]]`）与 Markdown 链接（`[](...)` / `![](...)`），解析目标 → 文件（库根绝对 → 相对源笔记目录 → 库内唯一 basename；`|alias` / `#heading` / `^block` 后缀保留），只改写「引用被移动附件」的位置。新链接目标 = **新文件夹限定的库内路径**（wikilink 保留原扩展名写法、无扩展名写法去扩展名；md 链接带扩展名原样路径）。
3. **含糊引用保守处理**：多文件同 basename 且不在当前笔记同目录时无法确定所指 → 不改写（安全）；当前笔记同目录优先就近命中（笔记旁资源最常见）。
4. **无预览确认、不删空目录**（用户决策）：直接执行 + 结果 toast 汇总。
5. **主页磁贴自动播种**（用户决策）：main.onload 幂等检查 launcher.json，缺 `bz-attach-move` 即在 desktop/mobile 各 `placeAtEnd` 末尾追加（1×1，写 launcher.json，失败静默）。

## 权衡

- **vault.rename + 自研改写 vs fileManager.renameFile**：前者可控命名、可单测、依赖的 API 全部有 mock；代价是重实现了 Obsidian 的部分链接调整逻辑（解析 / 目标解析 / 路径生成），边界（代码块内链接、含糊引用）记录为已知限制。
- **路径限定形式 vs 最短形式**：路径限定（含新文件夹）无歧义、直观反映新位置；代价是链接从「纯文件名」变为「带路径」，Obsidian 渲染照常。
- **自绘文件夹选择弹窗 vs obsidian Modal**：沿用本插件自绘 DOM 弹窗惯例（铁律 3/9），测试不依赖 obsidian Modal mock。

## 已知限制

- 代码块 / 内联代码内的 wikilink 不做豁免（与 Obsidian 移动文件时的全量替换行为一致）。
- 含糊引用不改写，保持原链接（移动后若只剩一个同名文件可自然解析）。