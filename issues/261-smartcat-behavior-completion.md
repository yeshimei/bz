# 261 — 小橘行为流补全 + 文案人性化重写

- status: doing
- type: §1 feature（接线补全，补齐行为）+ §2 refactor（文案重写，措辞一次拍板）
- 分支: `smartcat-behavior-261`（worktree `smartcat-behavior-261`，从 master c614eecd 分叉）
- 依据: ADR-0069（行为流全量盘点补齐）遗留；issue 255（knowledge 更名）/259（全域重构）/260（待办正名）大改后的接线与命名漂移

## 背景

多轮大改后，行为流存在**规则表/文案层就绪、但域侧从未 emit 或订阅端缺失**的接线缺口，以及**实体名与现域不一致**的命名漂移。本票补齐接线并重写文案。

## §1 接线补全

### 1. review 域接线（`coverage-source.ts` 转正）

- 现状：`buildReviewStructured` 纯函数就绪、routing `review:*` 规则就绪、wording `review` 模板就绪，但 **review 域从不 emit、smartcat 从不订阅**（coverage-source.ts 仅测试引用，生产零引用）。
- 动作点（`src/review/`）：
  - `reviewAddCurrent`（加入复习计划）→ `added`
  - `reviewRemoveCurrent`（移出）→ `removed`
  - `markReview` / `reviewMarkRating`（评分四档）→ `rated`
  - `startRoundSprint` / `startSingleSprint`（开始本轮）→ `started`
- 通道：`emitDomainEvent('review', { kind, title, rating })`
- 订阅端：smartcat `onDomainEvent('review')` → `buildReviewStructured` → `addObservation('review', { structured })`

### 2. attach 域接线

- 现状：`buildAttachMovedStructured` 就绪、routing `attach:moved` 就绪、wording `attach` 模板就绪，域侧不 emit。
- 动作点：`src/attach/ui.ts` `runMove` 成功后（`movedOps.length > 0`）→ `emitDomainEvent('attach', { kind: 'moved', count: movedOps.length })`
- 订阅端：smartcat `onDomainEvent('attach')` → `buildAttachMovedStructured` → `addObservation('attach', { structured })`

### 3. quiz

- quiz 已并入 review（`src/review/quiz-core/`）。routing `quiz:*` 与 wording `quiz` 模板保留；若无独立于 review 的动作点则不单接，随 review 域口径。

### 4. literature → knowledge 命名对齐

- `index.ts`：`addObservation('literature', …)` → `addObservation('knowledge', …)`（routing 键已是 `knowledge:converted`/`knowledge:term-generated`；现状落 `system:fallback`，规则失效）
- `knowledge-source.ts`：`entityType: 'literature'` → `'knowledge'`
- `behavior-wording.ts`：实体注册键 `literature` → `knowledge`，保留 `literature`/`bili`/`bili-downloader` 别名（存量条目兼容）
- `dashboard.ts`：`BEHAVIOR_SOURCE_LABELS` 补 `literature: '知识盒'`（存量来源遗留）

### 5. favorites:unarchived 补全

- wording `favorite` 实体补 `unarchived` 模板；routing 补 `favorites:archived` / `favorites:unarchived`（现状落 fallback）。

### 6. secondbrain / diary 判定

- secondbrain：wording 有 `secondbrain:*` 但无产出——**保留**（模板冻结 + 存量兼容），不接线。
- diary：`entry-added` / `entry-deleted` / `file-vacated` 无订阅——**有意不接**（`file-created`/`file-modified`/`file-deleted` 已覆盖，避免双记录）。

## §2 文案人性化重写

- 修正机械/别扭措辞（如「加入想看」→「加入了想看」）。
- 统一人称与语气，读起来自然；行为小结喂 AI 的文案同步受益。
- **措辞一次拍板**（新措辞冻结）；同步 `tests/smartcat/behavior-wording.test.ts`。

## 门禁

全量 `pnpm test` + `tsc --noEmit` + 自审 + diff 审查 → 合并回主仓 → 主仓构建部署 → 清理 worktree。
