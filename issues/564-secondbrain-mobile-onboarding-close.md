# 564 · 移动端第二大脑「建立索引」界面没有关闭出口

- 状态：已交付（2026-11-15，worktree `.dsh-worktrees/sb-close`，memo `item-1794707640585-ajl4p7`）
- 提出：2026-11-15 用户反馈「移动端，第二大脑建立索引界面右上角增加关闭按钮」

## 根因

「建立索引界面」不是独立弹窗，是主面板 `SecondBrainPanel` 的**引导态 / 进度态**：
`showInitGuidance()` / `enterProgressView()` 会把头行 `.bz-sb-panel-func` 整组加 `bz-sb-btn-hidden`，
那枚常规 ✕ 也在组内。移动端面板是 `100vw × 100vh` 全屏，遮罩点不到、没有键盘按 Esc，
三条关闭路径同时失效 —— 进建索引页只能杀进程。

`tests/secondbrain/panel-close-reset.test.ts` 的文件头早写过「移动端全屏无遮罩可点，关闭钮是唯一入口」，
但这条口径只在内容态成立。

## 修法

| 位置 | 改了什么 |
|---|---|
| `src/secondbrain/render.ts` | 头行加 `#bz-sb-mb-close`：`bz-sb-mb-close` 独立类，**不进** `.bz-sb-panel-func` 那一组；初始带 `bz-sb-btn-hidden` |
| `src/secondbrain/panel.ts` | `syncMobileClose(show)` 在三个态里反着切：引导 / 进度态放出，内容态收起（不与常规 ✕ 并排）；点击直接 `close()`，不复用常规 ✕ 的「复位优先」语义 |
| `src/secondbrain/styles.css` | 默认 `display:none`，仅 `@media (max-width: 768px)` 放出来；`bz-sb-btn-hidden` 的 `!important` 仍压得住 |
| `tests/secondbrain/mobile-close.test.ts` | 引导态可见且点了就关、内容态让位、样式桌面零影响三条 |

## 验收

- `node scripts/test-domain.mjs secondbrain` → 39 文件 / 558 用例全绿；`tsc --noEmit` 干净。
- 合并前 `node scripts/test-affected.mjs --since master` → 544 文件 / 8434 用例全绿。
- 既有 `onboarding-ui.test.ts`（引导期 func 钮全藏）与 `render.test.ts`（func 钮计数 4）均不动：新钮用了独立类。
