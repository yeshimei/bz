# 413 · 设置面板「数据源凭据」三行统一单行掩码 × 行序调整

- 状态：已实现（2026-09-23，用户拍板；ADR-0180）
- 关联：issue 331（拆组与 textarea 化）/ ADR-0147 决策 2（本批取代）/ ADR-0180（新决策）/ ADR-0133（凭据收编）/ c7c16ec39（输入方式体检批，多行掩码档位引入）
- 号位说明：初稿误占 412（与并行会话的 `412-review-fixes.md` 撞号），按仓内惯例改挂 413

## 用户原话拆解

1. 「设置面板，文本输入框加密感觉太奇怪了，加密的都改成单行的输入框」——
   截图里 B站 Cookie / 豆瓣 Cookie 是「多行 textarea + 圆点打点」形态，用户看着别扭；
   口径 = 凡加密控件一律单行（password 框 + 眼睛切明文），不再有「多行掩码」这一档。
2. 「把图片当中的第二项放到前面，Cookie 放到后面」——组内行序改为
   **ApiZero Key → B站 Cookie → 豆瓣 Cookie**（自截图的 B站、ApiZero、豆瓣序调整）。

## 落地

- [x] `src/core/settings-main-schema.ts`：凭据组三行全改 `type:'secret'`
      （ApiZero Key / B站 Cookie / 豆瓣 Cookie），行序重排；B站行 `actions`（桌面端「从 CLI 导入」）
      原样保留——secret 行的 actions 挂载与 text 行同口径，键与行为零变化。
- [x] 多行掩码档位整体退役（**无生产行再用**，留作死代码即噪音）：
      - `core/settings-schema.ts`：删 `TextAreaRow.masked` 字段、core 弹窗渲染器的 masked 分支、
        `wireSecretEye` 的 class 模式（只剩翻 `input.type`）；
      - `settings-panel/renderer.ts`：删 `makeMaskedArea` 与 textarea 分支的 masked 分叉；
      - `settings-panel/shared.ts`：删 `maskedAreaHtml`；
      - `core/ui/components.css`：删 `.bz-maskarea / --revealed`；
      - `settings-panel/styles.css`：删 `.bz-sp-secret--area`（多行外壳顶对齐）。
      textarea 行（普通多行文本）与 secret 行（单行掩码）两个档位本身不变。
- [x] 测试同步：`tests/core/settings-schema.test.ts`（凭据组行型/行序/桌面端按钮定位改按行名找）、
      `tests/core/settings-input-modes.test.ts`（盘点改「凭据 3 行全 secret」；两处多行用例改断言
      「普通 textarea 无掩码外壳、本行无眼睛」且提交链照常）、
      `tests/settings-panel.test.ts`（三行 `.bz-sp-secret-input` + 行序断言 + CLI 导入回填单行框）。

## 验证

- worktree：`vitest run` + `tsc --noEmit` 全绿。
- 原型产物：`node scripts/build-preview.mjs` 全量重出（凭据组在行为包内联，
  shared.ts 被 clipbook/gameshelf/home/memo/review 行为包引用）→ 主仓跑
  `tests/preview-freshness.test.ts` 取权威结论。
- 眼睛/提交链行为未动：只翻 `input.type`，不落盘；防抖落盘/失焦提交链沿用 text 行内核。
- 双轴子代理 review（Standards/Spec）后的整改：补 ADR-0180（取代 ADR-0147 决策 2，标准轴
  指出「推翻已接受 ADR 未记档」）、issue 改挂 413（412 与并行会话撞号）、测试夹具与恒真
  断言清理、注释口径同步。
