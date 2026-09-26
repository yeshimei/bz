# 270 — 皮肤暗色补齐 + 域内风格化扫尾批

日期：2026-09-11 ｜ 来源：全域审计（对话内清单，用户拍板并行修复）｜ 状态：已完成（6 worktree 并行 → 串行合并 → 全量门禁 265 文件/4235 测试绿 + tsc 0 错 → 构建部署 c9488559）

## 结果速记

- memo：paper「深纸夜读」/ editorial「碳黑反转」两套暗色变体（+148 行纯新增）+ 编辑器弹窗四类补样式
- belongings：夜版海报 token 组（#1a1815 底/米白墨/赤橙提亮）+ 硬编码色收编 6 个新 token
- secondbrain：七根 token 组暗色（含浮动参考卡/hover 预览两个 body 直挂逸出点同治）+ 19 处收编 + 4 个新 token
- review：quiz-core 会话弹窗 96 行样式找回（token 对档，源自 9c603ed7 丢失）+ 统计/历史弹窗内联 55→19（余为数据驱动/行为性）
- knowledge：品牌头/批量处理钮/ghost 钮三处纸墨皮样式（零硬编码，自动暗色）
- reading-report：静态内联 187→6，指标色 .theme-dark color-mix 提亮，chart-palette 零改动
- 遗留（后续拍板）：10 域假主题占位行（落真皮肤 or 隐藏）、settings-panel 皮肤预览卡暗色、rr stats.ts/index.ts 残余内联、home ui-river 2 用例偶发 flaky（与本批无关）

## 背景

全 21 域审计结论：

1. **有皮肤但无暗色模式的 3 域**（原拍板「恒定亮面」，本次推翻补暗色）：
   - memo：paper/editorial 两肤固定亮面（`src/memo/styles.css` 零 `.theme-dark`；ADR-0095 原文「固定明度不随 Obsidian 明暗」作废）
   - belongings：poster 纸面双主题恒定（ADR-0100 表述作废）
   - secondbrain：米白×红棕固定浅色，37 条硬编码色零 dark（文件头「不随 .theme-dark 反色」表述作废）
2. **没风格化的 UI**：
   - review 做题家弹窗（quiz-core/session.ts）整块零样式——9c603ed7 并入 review 时 src/quiz/styles.css 96 行被删未迁入（回归；现产品路径走 SprintSession，该入口休眠，补样式不退役）
   - review 统计/历史弹窗（stats-ui.ts）55 处内联样式，类名无 CSS
   - reading-report/report.ts 187 处内联样式 + chart-palette 硬编码色
   - memo 编辑器弹窗 bz-memo-editor/due-row/form-actions/sortsel 四类无样式
   - knowledge bz-kb-brand / bz-lit-ghost-btn / bz-lit-run-btn 无样式
   - clipbook bz-clip-art-dur 无样式（顺带清死代码 dotHtml）
   - settings-panel bz-sp-path-btn 无样式（靠 bz-sp-btn 兜底，P3 顺手）
3. 假主题占位行（10 域）与 settings-panel 预览卡暗色：**本次不做**，另行拍板。

## 分工（6 worktree 并行，文件集互斥）

| worktree | 分支 | 范围 |
|---|---|---|
| skin-dark-memo | worktree/skin-dark-memo | memo 暗色两肤 + 编辑器四类样式 |
| skin-dark-belongings | worktree/skin-dark-belongings | belongings poster 暗色 |
| skin-dark-secondbrain | worktree/skin-dark-secondbrain | secondbrain 暗色（token 收编） |
| review-style-fix | worktree/review-style-fix | quiz 弹窗样式恢复 + 统计/历史弹窗内联收编 |
| knowledge-style-fix | worktree/knowledge-style-fix | knowledge 三处补样式 |
| rr-inline-fix | worktree/rr-inline-fix | reading-report 去内联 + 暗色适配 |

## 方案规范

- 暗色优先纯 CSS：`.theme-dark .bz-<域>…` 覆盖域 token 组（先例：cinema/favorites/knowledge/home），零 TS 改动优先；浮层挂 body 的（uiModal/item-menu/弹窗）验证 `.theme-dark` 祖先可达。
- 每肤暗色 = token 整组覆盖（表面/文字/品牌/边框/语义）+ 关键结构位（纹理/墨边/硬阴影）微调，亮侧零改动。
- 硬编码色收编进域 token 组；样式一律写 `src/<域>/styles.css`（铁律 4/9），禁内联/禁运行时注入。
- 测试：仿 `tests/review-fix-b.test.ts` 的 CSS 文本断言惯例补守护；UI 行为改动同步域测试。

## 门禁

worktree 内：`pnpm test` 全绿 + `pnpm exec tsc --noEmit` 0 错误 + diff 自审（**worktree 内严禁构建**）。
主仓库串行合并后：全量门禁 + `pnpm run build` 部署。
