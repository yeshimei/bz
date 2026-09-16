# 346 · wayfinder 地图：2026 秋季批次（13 项采纳 + 3 新域拍板）

> labels: wayfinder:map ｜ status: open ｜ 2026-09-16 建图

## Destination

本轮 roadmap 全部钉清：**13 项采纳增强**每项有可开工的任务票并按仓库惯例完成开发；**三个新域方向**（账本、游戏架、小橘主动化）各自走到方案拍板（做/不做、怎么做），可汇入 `spec.md` 与后续任务票。

## Notes

- 领域：bz 插件。来源清单 = `.scratch/memo-suite-plugin/next-ideas.md`（2026-09-16 全域盘点），用户采纳编号：1、5、6、7、9、11、18、25、27、28、29、32、49，新域 51/59/62 逐个讨论。
- **本 effort 携带执行（override）**：12 张 `wayfinder:task` 票直接进入开发，按 AGENTS.md 工作流（worktree → 门禁全绿 → review → 合并 → 主仓库构建部署）。非纯决策图。
- 动工前惯例：先更 `.scratch/memo-suite-plugin/spec.md`；**本图已占号 issues/346–363**，后续新票从 364 起。
- 过 grilling 票时用 `/grilling` + `/domain-modeling`；研究票由 research 子代理认领Resolve，产物落 `.scratch/memo-suite-plugin/research/`。
- **语义修正（用户拍板）**：采纳条目 25 的实现方向修正为「第二大脑 AI 对话改走 core AI 设置（用户配什么模型就用什么）」，不是回落 Ollama。
- 49（小橘主动播报）并入「小橘主动化路线拍板」票讨论后实施，不单独开工。
- 执行票建议开发顺序（互相独立，可并行 worktree）：352 / 356 / 357 / 361 / 362（小活先行）→ 353 / 354 / 355（备忘录三连，动同一 schema 建议串行）→ 358 / 359 / 360 / 363。

## Decisions so far

- [研究：AI 识图记账的能力与路径](348-research-ai-receipt-photo-bookkeeping.md) — **直接复用**：core AI 多模态 JSON 通道（`ai.json({text, images})`，知识盒图版同构）零改造可承载账单识图；默认模型档即视觉模型；风险=无视觉能力探测、手工通道必须保留、需明示图片发往第三方 AI。详见 `.scratch/memo-suite-plugin/research/348-vision-bookkeeping.md`。
- [研究：游戏架接 Steam 数据的可行性](347-research-steam-data-feasibility.md) — **直接接 API**：GetOwnedGames/GetRecentlyPlayedGames 覆盖名称/时长/封面（header.jpg 按 appid 直拼）；前提仅 SteamID64 + 免费 Web API key，且 own key 查 own steamid 可绕过隐私设置（无需引导用户改隐私）；限额 100k/天可忽略。详见 `.scratch/memo-suite-plugin/research/347-steam-feasibility.md`。

## Not yet specified

**批次执行状态（2026-09-17 凌晨无人值守完成）**：12 张执行票全部交付闭票（352/353/354/355/356/357/358/359/360/361/362/363），逐票全量门禁绿（终态 5544/5544），部署 commit `2b2fdbbc`。spec.md 补记两段、CONTEXT.md 词条同步、ADR-0154（番茄归档层）。执行中发现并修正两处票面勘误：358 阅读时长原仅内存累计（补 readLog 落盘）、361 旧拟合公式不读权重（重写为回放式 MLE）。


- **账本（51）**：识图调研闭合后才能钉的细节——账单截图的支持范围（支付宝/微信/银行 App 各形态）、手工记账与识图记账的双通道配比、与归物本「购入流转」的契约、分类体系。→ 毕业为 349 拍板票的后续细化票。
- **游戏架（59）**：Steam 调研闭合后才能钉——数据形态（同步哪些字段、同步频率）、非 Steam 游戏的手动补录、与影院范式的差异。→ 毕业为 350 拍板票的后续。
- **小橘主动化（62）**：49 播报落地后的后续票——月度对话、年度故事（与 next-ideas #63「年度之书」可能合并立项）。
- ~~执行票的 spec 批量更新~~ 已完成（spec 两段 + ADR-0154 + CONTEXT 词条 62381df1）。

## Out of scope

- next-ideas.md **其余未采纳编号**（2/3/4/8/10/12/13/14/15/16/17/19/20/21/22/23/24/26/30/31/33/34/35/36/37/38/39/40/41/42/43/44/45/46/47/48/50/52–58/60–63）——未采纳 ≠ 否决，本轮不排期，留待后续轮次复议。
- 已退役方向复活（每日简报、读书番茄钟/专注目标、B站保存分流）——需先复议当年否决理由，本图不开票。
