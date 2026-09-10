# 行为流接线补齐（review/attach）+ 域名词条对齐（knowledge）

背景：ADR-0069「行为流全量盘点补齐」为 review/quiz/attach 三域预先落好了 routing 规则与 behavior-wording 模板（`src/smartcat/coverage-source.ts`），但**域侧从未 emitDomainEvent、smartcat 订阅端也从未订阅**——三域行为长期不进行为流（coverage-source 仅测试引用，生产零引用）。同期 issue 255（literature 更名 knowledge）只改了 routing 键 `knowledge:*`，`index.ts` 仍以 `addObservation('literature',…)` 入流、`knowledge-source.ts` 仍产 `entityType: 'literature'`，导致路由落 `system:fallback`、来源标签与现域名不符。issue 261 补齐接线并对齐命名。

## 拍板要点

1. **review 域接线**：`review/index.ts`（移出）与 `review/app.ts`（加入 / 评分 / 开始本轮）经 `emitDomainEvent('review', { kind, title, rating })` 派发；smartcat 订阅 `review` 通道 → `buildReviewStructured` → `addObservation('review', { structured })`（routing `review:started/added/removed/rated`）。
2. **attach 域接线**：`attach/ui.ts` `runMove` 成功后（`movedOps.length > 0`）`emitDomainEvent('attach', { kind: 'moved', count })`；smartcat 订阅 → `buildAttachMovedStructured` → 行为流（routing `attach:moved`）。
3. **quiz**：已并入 review（`src/review/quiz-core/`），构造层保留；其动作点未独立接线，随 review 域口径。
4. **literature → knowledge 对齐**：`index.ts` source 改 `'knowledge'`；`knowledge-source.ts` entityType 改 `'knowledge'`；behavior-wording 实体注册键改 `knowledge` 并保留 `literature`/`bili`/`bili-downloader` 别名（存量条目兼容）；dashboard 来源标签补 `literature`（旧存量）与 `review`/`quiz`/`attach`。
5. **favorites archived/unarchived**：routing 补两键；wording 补 `unarchived` 模板。
6. **文案人性化**：修正机械/别扭措辞（「加入想看」→「加入了想看」；review rated →「你复习了《X》，自评「一般」」）；knowledge 实体默认改「知识盒动态」。
7. **secondbrain / diary 判定**：secondbrain 模板保留、不接线（模板冻结 + 存量兼容）；diary `entry-added`/`entry-deleted`/`file-vacated` **有意不接**（`file-created`/`file-modified`/`file-deleted` 已覆盖，防双记录）。

## Considered Options

- review/attach 保持「规则就绪待接线」现状：ADR-0069 的补齐承诺长期悬空，行为小结/反思原料缺这两域——否
- knowledge 只改 `index.ts` source、保留 entityType `'literature'`：routing 命中但实体名与域名仍不一致，dashboard 来源标签需额外别名——否，一并改 entityType + 保留旧别名
- review 从 `index.ts` 命令层 emit（不改 app.ts）：`markReview` 会被 sprint/reviewLoop 内部调用，命令层会漏采——否，emit 落在 app.ts 方法内
- 新增独立 `quiz` 域事件通道：quiz 已并入 review，独立通道无派发方——否，随 review 域

## Consequences

- review/attach 用户动作首次进入行为流（行为小结/反思原料更完整）
- knowledge 行为条目 source/entityType 与现域名对齐；旧 `literature`/`bili` 存量条目渲染不受影响（别名兼容）
- 行为流来源筛选新增「复习计划」「附件搬移」；知识盒来源标签覆盖旧 `literature`
- 实现与验收细节见 `issues/261-smartcat-behavior-completion.md`
