# Ticket 113：通知动态停留时长（按字数自动延长）

- 状态：已完成
- 域：core（notice）
- 来源：用户需求——长文本通知需要足够阅读时间

## 背景

原通知系统所有类型的默认停留时长固定（info/success/warning 3s、error 5s），长文本通知来不及看完就消失了。需要在没有显式指定 `duration` 时，根据通知文字长度动态计算停留时间。

## 方案

新增 `calcDuration(text, base)` 函数：
- 公式：`base + max(0, len - 20) × 60ms`，上限 15s
- ≤20 字用类型默认值（短消息不受影响）
- 显式 `duration` 优先，不走动态计算
- `progress` 类型不变，仍默认常驻

## 改动文件

- `src/core/notice.ts` — 新增 `calcDuration`、`PER_CHAR_MS`、`SHORT_THRESHOLD` 常量；`armTimer` 增加 `text` 参数；调用处传入 `msg`（+ `title`）
- `tests/core/notice.test.ts` — 新增 2 个测试用例（长文本动态延长、显式 duration 优先）
- `CONTEXT.md` — 更新通知时长描述
- `docs/adr/0053-notice-dynamic-duration.md` — ADR 记录动态时长决策

## 验收标准

- [x] 短文本（≤20 字）行为不变
- [x] 长文本按字数延长停留时间
- [x] 显式 duration 仍优先
- [x] 全量测试 + tsc 全绿
