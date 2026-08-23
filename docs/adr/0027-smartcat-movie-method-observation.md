# ADR-0027：smartcat 影视动作观察改走方法监听（supersedes ADR-0026 事件 diff）

Status: accepted（2026-08-23，ticket 074 修订 2）

## Context

ADR-0026 采用「vault 事件快照 diff」观察影视动作。用户指出根本缺陷：**编辑器逐字输入时 Obsidian 自动保存连发 modify**——事件层无法区分「UI 一次写入最终值」与「逐字输入中间态」，靠防抖/节流窗口只能压条数、不可根治（且正文打字无论如何都经事件通道）。用户提出「不监听事件，监听方法」并拍板：**只走方法监听，覆盖不了的不覆盖**。

## Options

- A（采纳）方法监听：movie 域 UI 确认回调直接调 `smartcat.notifyMovieAction(事件)`，事件里带 from→to/评分/影评文本等结构化数据，smartcat 构造文案入流。
- B 事件 + 防抖/节流组合（ADR-0026 修订 1 拟定）：300ms 防抖 + 文本 10 分钟节流。缺点：正文打字仍须事件通道；文本节流窗口会吞「UI 10 分钟内写→改影评」等真实动作；评分逐字敲仍有 1~2 条中间噪音。
- C 混合（方法为主 + 事件兜底 + 快照基线同步去重）：覆盖手改/正文，但双通道同步复杂，且正文打字仍需节流。

## Decisions

- 观察**只**来自方法调用：movie 域五个确认回调（openAddModal 确认 / setMovieStatus / openRateModal 确认 / openReviewModal 确认 / confirmDeleteMovie 确认）调 `notifyMovieAction`。
- 事件通道对影视**短路**：onVaultActivity 遇 `classifyPath==='movie'` 直接 return，防 UI 动作「方法一条 + 事件一条」双记录。
- 文案构造集中 `movie-source.ts` 纯函数（`movieCreatedText`/`movieStatusChangeText`/`movieRatedText`/`movieReviewText`/`movieDeletedText`/`buildMovieActionText`），事件 → 文本映射可单测。
- **放弃观察**（用户拍板）：手改 frontmatter（含回退想看）、正文记内容、自动保存连发、文件手动删除/重命名。零防抖/零节流/零定时器（打字的连发事件根本不在观察链路内）。
- 守卫：`notifyMovieAction` 在 smartcat 未初始化或 `data.config.noteSource` 关闭时静默。
- 影评空串视为无（写/删判断）；无变化（写回同值）不产出。

## Consequences

- 打字爆炸根治：观察只出现在用户 UI 确认动作上，一次动作一条，无任何时间窗口。
- smartcat 与 movie 域产生新依赖边：src/movie/ui.ts → src/smartcat（notifyMovieAction）。方向单向（smartcat 不 import movie），符合 ADR-0002 域间显式 import。
- 代价：小橘失去对「手改 frontmatter / 正文写作」的影视感知（周报/懂你的影视维度变轻）；若未来要回补正文观察，需另议事件通道 + 节流（本 ADR 明确放弃）。
- 观察文本、MemoryStreamEntry、评分三值语义均与 ADR-0026 一致；仅采集路径变化。