# 25 — 通知系统：自绘通知替代原生 Notice（ADR-0010）

**What to build:** 自绘 toast 通知系统（`src/core/notice.ts`）替代全仓 146 处原生 Notice 调用 + smartCat 通道；消息文案一致性审校；动态消息链路改造；测试迁移为通知 DOM 断言。

**Status:** resolved（grilling 会话 + 样式演示敲定后一次实施，770/771 测试通过，1 既有失败与本 ticket 无关）

## 设计决策（grilling 会话）

- **通道合一**：`new Notice(...)` → `notice(msg, dur?)`（自动语义归类）；`core/dom.ts` 的 `notice()` re-export 自 notice.ts，smartCat 分支删除
- **语义归类**：`classifyNoticeType`——✅🎉→success、⚠️→warning、❌/失败/错误→error、其余→info
- **动效映射**：success→pop（打勾描绘）、warning/error→shake、info→drop；可选 drop/pop/slide-left/slide-right/bounce/shake；reduced-motion 降级
- **布局**：顶部居中、z-index 10300、堆叠上限 5、点击关闭、错误 5s/其余 3s、progress 不自动消失
- **动态能力**：setMessage / setProgress（100 变绿、-1 跑马灯）/ setType / title+action 按钮
- **文案规范**：✅❌⚠️ 前缀统一、全角冒号、去感叹号、删 Q3.js/QuickAdd/控制台等遗留引用
- **动态链路**：auto-summary（progress → 结果 setType success）、复习批量出题（progress → 成功/失败）

## 改动清单

- [x] `src/core/notice.ts`（新）：通知系统核心 + classifyNoticeType + notice/notify API + 6 动效变体 + 动态能力 + 自包含样式注入（避免与 dom.ts 循环引用）
- [x] `src/core/notice-demo.ts`（新）：`bz-notification-demo` 演示命令（13 场景样式自查）
- [x] `src/core/dom.ts`：notice() 改 re-export，删除 smartCat 分支
- [x] 全仓 124 处 `new Notice` → `notice`（23 文件）+ import 修正
- [x] 文案审校：password 21 / review 25 / diary 18 / bz 11 / belongings 9 / quiz 8 / movie 10 / news 4 / launcher 4 / favorites 12 / library 6 / clipping 2 / main 1
- [x] 动态链路：auto-summary/processor.ts（progress → 结果）、review/app.ts 批量出题（progress → 成功/失败）
- [x] flash/notify.ts：前缀静默规则保留，内部走新通道
- [x] 测试迁移：`getNoticeMessages`/`hasNotice`/`clearNotices` 进 mock-obsidian-entry；~19 文件 90 处断言 MockNotice → DOM 断言；auto-summary 断言改动态链路
- [x] ADR-0010 + CONTEXT.md 术语（通知/通知文案规范）

## 验收

- [x] src 无 `new Notice` 残留
- [x] tsc 零新增错误（预存 9 文件错误清单不变）
- [x] 全量 771 测试，770 通过，1 既有失败（flash vector-store 删除清理，与本 ticket 无关）
- [x] 构建产物直出 vault，`bz-notification-demo` 演示通过（用户确认样式）
