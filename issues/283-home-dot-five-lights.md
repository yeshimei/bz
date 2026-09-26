# issue 283：首页入口彩点五条件点亮（剪藏未读/专注中/复习逾期/影院在看/重要备忘）

日期：2026-09-11 ｜ memo：item-1789106079981 ｜ 关联：ADR-0104（render 纯层单源）、src/memo/reminder.ts 重要判定先例

## §1 现状

首页彩点规则单源 `src/home/shared.ts buildDots`（纯函数）五条差距：剪藏无规则恒 off（`clippingUnread` 已采集未消费）；番茄只按「今日轮数」非「正在专注」（`isFocusing` 已读未进彩点）；影院只按「今日痕迹」缺「在看」（`cinemaWatching` 已采集）；备忘只按「今日动静」缺「重要未完成」维度（`memoOpen` 不筛 priority）。复习逾期→hot 已满足。

## §2 修法

**等级语义定案**：ok=今日有动静（绿）/ warn=进行中·待处理（琥珀）/ hot=逾期·需立即关注（红）。

| 域 | 规则 |
|---|---|
| clipping | 未读 > 0 → warn |
| pomodoro | 专注中 → warn；否则今日轮数 > 0 → ok（取高） |
| review | 逾期 > 0 → hot（既有不动） |
| cinema | 在看 > 0 → warn；否则今日痕迹 → ok（取高） |
| memo | 重要未完成（priority==='important' && !completed）> 0 → hot；否则今日动静 → ok（取高） |

实现约束：纯层契约——专注态作为**数据入参**（RiverData 增 `pomodoroFocusing`、计数增 `memoUrgentOpen`，不覆盖 `memoOpen`，riverCountText「N 条待办」口径不变）；`collectRiver` 动态 import('../pomodoro') 只读 `isFocusing()`，失败回落 false。

## §3 交付

- commit `b2604c4b`（worktree/3）；review 通过（R2：cinema「评分: 0」测试数据精确命中三分口径非假阳性；memoUrgent/memoOpen 口径隔离干净）。
- 测试：river.test（buildDots 全组合 + 采集回落 + 重要筛选）、ui-river.test（真实 DOM dot class）、entry-menu.test（RiverData 新必填字段）。
