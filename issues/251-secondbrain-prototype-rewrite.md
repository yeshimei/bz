# 251：第二大脑落域——定稿原型三界面重写（markup 单源 + 评审壳）

- 日期：2026-09-09
- ADR：`docs/adr/0110-secondbrain-prototype-rewrite.md`
- worktree：`secondbrain-domain-251`
- 原型：`.zcode/ui-prototypes/secondbrain-final/`（panel / chat / reference 三界面，米白红棕主题）

## 目标

用户拍板「原型是真理，完全抛弃 secondbrain 域中的 UI 和样式设计」：桌面三界面（主面板 / AI 对话 / 灵感参考）按定稿原型重写视觉与 markup；**行为逻辑、数据层、AI 层、命令与设置契约全部保留**。数据零迁移。

## 改动清单

- `render.ts`（新，ADR-0104 纯层）：`computeStats` / `buildSourceTree` / `fmtCompact` 自 panel.ts 收编；主面板（壳/统计带/趋势/树形来源/最近/摘要卡/底部操作/引导态）、对话（弹窗壳/推荐词/气泡/引用卡/检索中态）、参考（卡片/分数条/占位态）markup 构建器；来源色板常量。
- `styles.css`：全量重写（米白 #fbfaf7 / 红棕 #a33d2a token；面板固定浅色不跟随暗色，同 favorites 先例）；移动抽屉 `bz-sb-mb-*` 段原样保留（移动端本批不动，待后续原型）。
- `panel.ts`：重写为行为层（形态分派/onboard 三形态/进度回调/自动增量/树展开记忆/最近点击打开全保留），markup 改调 render.ts；`secondBrainSettingsSchema` / `openSecondBrainSettings` 原样保留并 re-export（settings-panel 动态 import 兼容）。原型六卡 + 真身运维维度（索引健康/存储占用）并入底部状态行。
- `chat-panel.ts`：重写视觉（气泡/引用卡/检索中态/推荐词），保留流式 onDelta / AbortController 停止 / isComposing / MAX_HISTORY 裁剪 / chatHistory 落盘。检索命中（path+score）以引用卡渲染，仅会话内展示不落盘（chatHistory 段结构零改动）。
- `reference-panel.ts`：卡片 markup 走 render.ts（+分数条/来源色点），密度切换/悬停预览/双击跳转/长按拖出浮卡/归位/全套竞态防护逐行保留。
- `float-window.ts` / `mobile-panel.ts`：零改动（样式重画）。
- `fake-sim.ts` + `fake/fake-obsidian.ts`（新，ADR-0106）：FakeVectorStore（真实快照同构 + 策划检索映射）+ Fake AI（流式策划回答）+ FakeVault（storage 桥 seed secondbrain.json）。
- `prototype.html` / `prototype-view.html`（新评审壳）：三界面切换，消费 prototype-render.js + prototype-behavior.js。
- `scripts/build-preview.mjs`：PREVIEW_DOMAINS / BEHAVIOR_DOMAINS 登记 secondbrain。
- 测试：statistics.test 改 import render.ts；onboarding-ui / chat-ux 锚点同步新 markup；新增 render.test.ts（纯层）；render-purity 自动纳管。

## 门禁

pnpm test 全量绿 + tsc --noEmit 干净 + 自审/diff 审查 + 主仓构建部署 + headless 验收。
