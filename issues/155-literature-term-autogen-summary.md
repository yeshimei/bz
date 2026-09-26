# 155 — 术语窗口自动生成 + 生成/重新生成/总结按钮

**状态**：✅ 已完成

## 用户拍板

> 选中文字时打开术语窗口自动生成
> 当生成完成后，生成按钮变成重新生成按钮，底部的重新生成按钮改为总结按钮，点击后，对生成的原文进行一次总结，目的是精简内容

## 改动（src/literature/ui.ts + note-gen.ts + tests/literature/{ui,note-gen,index-cov}.test.ts）

- **自动生成**：`showTermEntry(term)` 预填非空即 `void this.onTermGenerate()`——选中文字打开（`openTermNote` 读编辑器选区）即生成，无需再点；主面板 📝 空词入口不变。
- **按钮态机**：新增 `termHasDraft`；`setTermGenLoading(false)` 恢复文案按有无结果分叉——有则「重新生成」，无则「生成」（`presentTermPreview` 置位、`showTermEntry` 复位）。重跑生成职责归输入行按钮，直接覆盖预览（ticket 142 语义保留）。
- **底部「总结」**：`#lit-term-regenerate`（id 保留 DOM 契约）文案与绑定改总结——`onTermSummarize` 调新增 `summarizeTermSummary(text)`（note-gen，`ai.chat` 精简 prompt，max_tokens 1024）精简 `termPreview.body` 并回填内容卡；术语/领域不变，总结后确认写入落精简正文（所见即所得）。无预览提示「请先生成简介」；`termSummarizing` 防重入 + `setTermSummarizing` 全按钮禁用。
- 测试：ui.test 622 拆自动生成/空术语两用例、732 改写（重跑归输入行 + 总结回填）、新增总结后确认落盘用例、762 补按钮文案断言；note-gen.test 补 summarizeTermSummary 正反用例；index-cov openTermNote 打桩 note-gen 并断言带词自动生成/空白不生成。

## 验收

- tests/literature 全绿（121 用例）；tsc 0 错。
- 面板行为：选中文字 → 打开即出预览；生成后输入行按钮「重新生成」；底部「总结」→ 内容卡精简；确认写入落盘精简正文。
