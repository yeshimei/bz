# 复习计划 · 原型评审壳（prototype-first，issue 253）

通用规则见 `docs/prototype-first.md`，本文只记复习域专属映射与坑。

## 文件

| 文件 | 作用 |
|---|---|
| `prototype.html` | 评审壳。组件样式零内联，按构建同序链接 core 三件套 + `./styles.css`；`<head>` 内联演示种子（`window.RVW.SEED`：真实 vault 复习条目扩写 + 真实 quiz 题库节选，日期相对「当下」）；内联脚本只剩徽牌（重置数据/移动端开关）与 `?selftest=1` 自检 |
| `prototype-view.html` | iframe 视图页：`bootReviewSim()` + `openReviewPanel()` 面板跑在 iframe body（iframe 即全屏视口，宽度定桌面/移动布局） |
| `prototype-render.js` | **构建产物（入库，勿手改）**：`render.ts` → IIFE 挂 `window.BZR_review`（ADR-0104） |
| `prototype-behavior.js` | **构建产物（入库，勿手改）**：`fake-sim.ts` → IIFE 挂 `window.BZW_review`（ADR-0106），真 ui.ts/sprint.ts/app.ts/quiz-core 依赖链，alias obsidian→公共假层 |
| `prototype-icons.js` | 演示图标表（生成物）：`window.RVW_ICONS`，16 枚——既有域图标表并集 + asar 补缺（`skip-forward`），再生成：`node scripts/_gen-review-icons.mjs` |
| `render.ts` | 渲染纯层（markup 单源）：三区队列/冲刺/难度弹窗/评级条；纯度由 `tests/core/render-purity.test.ts` 守卫；日期一律 now 参数注入 |
| `fake-sim.ts` | 行为产物入口：种子写 fake vault（review.json/quiz.json/文献盒笔记）+ 注入设置（forceQuizForReview 开）+ 面板入口 |
| `fake/fake-obsidian.ts` | 公共假 obsidian：Platform 视口/setIcon（RVW_ICONS）/TFile/Setting + settings-panel 闭包壳类/moment；**requestUrl = 出题 AI canned 回放**（按 generator prompt 特征识别，回放 `RVW.SEED.quizBank`；其余抛错降级）；FakeVault = localStorage + storage 桥 + 目录合成 |

再生成（仓库根目录执行）：

```bash
node scripts/_gen-review-icons.mjs     # 图标表
node scripts/build-preview.mjs review  # 渲染 + 行为产物（worktree 内可安全执行）
node scripts/_selftest-cdp.mjs         # headless 自检（Edge + CDP，读 document.title）
```

## 单源映射（issue 253）

| render.ts | 两侧用途 |
|---|---|
| `queueViewHtml / cardHtml / sortColumn` | 三区队列整视图（头行/开始本轮条/三区列/底部信息行/空态宿主）；列内排序 置顶→R升序→到期（V1 拍板） |
| `sprintHeadHtml / sprintLoadingHtml / sprintQuestionHtml / sprintBodyHtml / sprintAsideHtml / sprintResultHtml / sprintSummaryHtml` | 整窗冲刺全部视图（题卡/本轮队列/结果卡/结算） |
| `difficultyDialogHtml / reviewBarHtml` | 难度弹窗 / 悬浮迷你评级条 |
| `dueLabelOf / isPlayable / currentRPct / stageTagHtml / stageNum / todayLabel / esc / icon / markHtml` | 到期/阶段/保留率口径唯一实现（事件绑定两侧各自实现：插件 ui.ts ↔ 壳真跑同一份 ui.ts） |

## 自检（?selftest=1，41 断言）

双 iframe 开面板、三区计数（3/3/6）、列内排序（R 升序首位/置顶首位）、待重做红 tag、
提前卡 .no、归档切换（绿点「已完成复习」+ 挂起卡在 done 列）、**完整做题轮**
（开始本轮 → 待重做重做 + 6 篇 12 题全对——题目按种子题库查正确答案作答 → 结果卡 →
结算屏 → 回队列 → 重做解除/逾期归零/短档重排今日/长档入未来）。结果写 `document.title`
（`SELFTEST OK 41/41`）。

## 域内坑（踩过的）

1. **file:// 同源**：headless 自检必须带 `--allow-file-access-from-files`，否则壳够不到
   iframe DOM（面板其实渲染正常，selftest 报「面板超时」）。
2. **数据种子必须放 `<head>`**：iframe boot 早于宿主 body 尾脚本（clipbook 同款教训）。
3. **挂起（missing）在 done 列**：`partitionQueue` 把 !active（completed/missing）全归
   done（ticket 098 语义）——挂起卡在归档视图看，「已完成 N 篇」计数含挂起。
4. **阶梯短档通过会重排回「今天」**：6h/1d 档（stage 1-3）easy 通过后 nextReviewDate 落
   今明，属正常调度，勿误判漏销。
5. **出题 AI canned**：round 模式先清题库再 `ensureQuestions` 重生成——假层必须让 AI 链
   成功（prompt 特征识别回放题库），否则全篇「暂无题目已跳过」；fetch 先行失败靠设置
   默认端点 CORS 失败自动 fallback requestUrl，无需真密钥。
6. **`R<阈值` 才是「提前」**：提前 = 记忆保留率跌破阈值且未到日历日（RPct 低者先排）；
   逾期卡若同样低 R 也会挂「提前」tag（现行口径，见 issues/252 观察项）。
