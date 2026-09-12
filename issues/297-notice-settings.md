# 297 — 设置面板快速原型轮：通知设置四项（级别/停留档位/弹出位置/同屏上限）

- 日期：2026-09-12
- 用户拍板（快速原型轮）：通知候选 1/2/3/4 全采纳
- 关联：ADR-0080（设置面板）、ticket 25（notice toast 系统）、issue 296（上一轮）
- 状态：已完成

## §1 设计决策

### 通知级别（`noticeLevel`，缺省 `all`）

- all=全部 / important=仅警告与错误 / error=仅错误；`notify()` 入口过滤，先于去重登记（被静默的调用视同未发生）。
- **永不静默**：带 action/actions 的通知（撤销/查看等交互出口=安全兜底）、progress（调用方控制生命周期）。

### 停留时长（`noticeDuration`，缺省 `standard`=3s）

- quick=2s / standard=3s / relaxed=5s / persistent=常驻点击才关；只作用于未显式指定 duration 的默认时长，错误类比常规 +2s（3s/5s 差值语义保留），长文案动态加时保留。
- **显式时长不缩放**：撤销 6s 反悔窗口原样。
- persistent 档普通通知不设计时但 `persistent` 标志保持 false——与 progress 常驻帧（免疫驱逐）不同，仍参与堆叠挤兑，否则普通帧无限滞留堆出屏幕。

### 弹出位置（`noticePosition`，缺省 `top-right`）

- 桌面四角（容器角位类）；CSS 规则包 `@media (min-width: 769px)`——id+类特异性高于移动端媒体查询的纯 id 选择器，不限定会覆盖移动端顶部居中；移动端恒顶部居中。
- 左列位置默认变体换 slide-left（从左滑入），右列保持 slide-right。

### 同屏上限（`noticeMaxVisible`，缺省 `'5'`）

- '3'/'8' 可选，其余回落 5；`evictOldest` 改读运行时值。

### 通知设置读取全防抛（B7 回归教训）

- 首版直接 `tryGetSettings()` 读设置，挂了 belongings B7（「设置读取失败→弹错误通知」场景：provider 抛错，通知自己读设置也炸，兜底通道反失效）。
- 修法：`noticePref()` 统一 try/catch + 类型收窄，provider 未注入/抛错一律按缺省行为走。**通知是最后兜底的报告通道，它自己必须炸不了。**

## §2 改动面

| 文件 | 内容 |
|---|---|
| `src/settings.ts` | 四键：`noticeLevel/noticeDuration/noticePosition/noticeMaxVisible` + 默认值 |
| `src/core/notice.ts` | `noticePref` 防抛读取；`suppressedByLevel` 级别过滤；`durationGear` 档位；`maxVisible`；`applyPositionClass` 角位类；左列 slide-left；常驻档可驱逐 |
| `src/core/styles.css` | `#bz-notice-container` 三角位规则包 769px+ 媒体查询 |
| `src/core/settings-main-schema.ts` | 通用域补「通知」组四行（bell；文案过 copy-lint：desc 仅逗号句号 8-32 字） |
| `prototypes/settings-panel/fake-sim.ts` | SEED_SETTINGS 补四键（壳跑真 notice.ts，改档位实时生效） |
| `tests/core/notice.test.ts` | 新 describe ×4 共 17 用例（级别/档位/位置/上限 + provider 抛错兜底回归） |
| `tests/settings-panel.test.ts` | 通用组数/图标/徽标 1→5 |
| `tests/settings-tab.test.ts` / `tests/core/settings-schema.test.ts` | 原生设置页组名/图标序列补「通知」 |
| `prototypes/**` | 全量预览产物重出 |

## §3 测试

- 级别：all 全弹 / important 压 info+success / error 连 warning 也压 / 带按钮通知与 progress 放行 / 静默返回 noop handle / provider 抛错按缺省弹出。
- 档位：quick 2s+error 4s / relaxed 5s / 撤销 6s 不缩放 / persistent 60s 不自动消失且仍被挤兑。
- 位置：缺省不挂类 / 挂类与换角清旧 / 左列 slide-left。
- 上限：缺省 5 / '3' 挤最旧 / 非法回落。

## §4 门禁记录

- `pnpm exec vitest run`：294 文件 / 4551 用例全绿。
- `tsc --noEmit`：干净。
- `node scripts/build-preview.mjs`：全量预览产物重出（新鲜度守卫）。
