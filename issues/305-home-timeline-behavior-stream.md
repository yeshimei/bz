# issue-305：首页时间线改吃小橘行为流——痕迹源整体替换

- 分支：worktree/1 ｜ 日期：2026-09-13
- 来源：影院批量回填触发 recap 文件推导误报事故 + grill 三问拍板
- 关联：ADR-0132 / issue 288（前提反转）/ ADR-0104（首页活动河）

## 背景

时间线（collectRecap 文件统计推导）在批量编辑影院笔记时误报「创建几十条电影」（ctime/mtime 推导对外部改动脆弱）。行为流对此免疫。用户拍板：时间线痕迹源整体替换为行为流；宁缺勿假不混合；「已跳过」回归为过滤第四项默认关。

## 方案

1. **`src/home/behavior-timeline.ts`（新）**：
   - `readBehaviorItems(app)`：读 `CONFIG/STORAGE/smartcat-behavior.json`（探测存在再读，损坏/缺失回落空）。
   - `mapBehaviorEvent(item)` 纯函数：按 ADR-0132 映射表产出 `{kind, domain, text, ts} | null`（deleted/edited/无效动作返回 null）；名称 metadata.name 优先、description 剥前缀兜底；`review:started` 无名白名单单独成条。
   - `behaviorToDays(items, now, days)`：7 天窗口按本地日分桶，事件携带显式 kind（升序）。
   - `behaviorSourceDomain(source)`：行为流 source → 首页域 id（渲染徽标/彩点认 id，见 ADR-0132）。
2. **`src/home/river.ts`**：时间线 items 换 behavior 事件（recap 继续供 summary/计数/周历 hit）；`toRiverDay` 改收 TimelineEvent[]，memoCreated 派生维持「新增备忘录」前缀契约。
3. **`src/home/shared.ts`**：`RiverEvent` 从 `= RecapItem` 改为自有类型（domain: string + 可选 kind）；TimelineFilter + `skipped`；TIMELINE_KIND_LABEL + 「已跳过」；`eventKind`/`eventVisible` 为过滤判据单源（事件 kind 直判，旧形态回落文案前缀）；layouts/river/render.ts 的 flowHtml 改用 eventVisible（原为前缀判类，会漏掉 skipped/note 两类）；注释回写 issue 288 反转。
4. **设置**：`homeTimelineSkipped`（settings.ts，默认 false）+ home/settings.ts 内容过滤组第四个 toggle（题名「跳过痕迹」）+ ui.ts readHomeSettings 读取；「小橘点评」描述同步覆盖星级评价。
5. **测试**：映射表逐源用例（含 deleted/edited 剔除、name 兜底解析、source→domain 归一）、分桶（跨天边界）、只读契约（缺失不建文件/损坏回落）、过滤 skipped 开关、kind 直判、river 装配（MockVault 注入行为文件 + 影院批量回填免疫回归）、UI 层痕迹源换行为流、设置组行。
6. **编号撞车修复**：并行会话先占 304/ADR-0130（日记条目文件格式），本条重编号为 issue 305 / ADR-0132。

## 验收

- 时间线只显示行为流真实动作；外部批量改文件不再产生任何时间线条目（回归用例：观影日期=今天的影院笔记 → 摘要 movies=1 但时间线零条目）。
- 已跳过开关默认关，打开后显示 news skipped 痕迹；kind 直判（produce 文案写成 progress 形态也按 kind 走）。
- 入口计数/周历/连击/摘要与替换前一致。
- 门禁全绿（pnpm test + tsc --noEmit + 自审 + diff 审查 + 主仓构建/原型重出）。
