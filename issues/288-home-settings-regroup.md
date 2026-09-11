# 288 · 首页设置：拆细分组 / 去「已跳过」/ 默认本周 / 入口列表版式

**状态**：已实现（原型阶段，未合并）
**日期**：2026-09-11
**来源**：用户 2026-09-11 点名五条

## 用户原话（五条）

> 去掉设置面板中已跳过，时间范围默认为本周
> 分组不够详细，全部放到时间线中不太对
> 删除入口下面的灰色说明小字
> 让列表尽量往左对齐，左边不留内边距
> 走快速原型

## 改动

### 1. 去掉「已跳过」

| 层 | 改动 |
|---|---|
| `src/home/settings.ts` | 删掉「已跳过」toggle 行 |
| `src/home/shared.ts` | `TimelineKind` 去掉 `'skipped'`；`TimelineFilter` 只剩 `produce/progress/notes`；`TIMELINE_KIND_LABEL` 去 `skipped` |
| `src/home/ui.ts` | `readHomeSettings` 不再读 `homeTimelineSkipped` |
| `src/settings.ts` | 类型字段 + DEFAULT 双双删除 |
| `prototypes/settings-panel/fake-sim.ts` | 种子删除（**三处同值铁律**第三处必须同步） |

**为什么是删而不是留**：2026-09-11 issue 287 已记「已跳过」数据源没接（剪藏跳过在
`smartcat-behavior.json` 行为流里，首页时间线只吃 recap 五域痕迹），当时留着一个
**点不动的开关**。用户这次直接要求去掉 → 删干净（`TimelineKind` 里也不留悬空的 `'skipped'`）。

### 2. 时间范围默认「本周」

- `src/settings.ts` DEFAULT `homeTimelineRange: 'today' → 'week'`
- `src/home/ui.ts` 缺键回落值同步 `'today' → 'week'`（老 data.json 无此键时也落 week）
- `prototypes/settings-panel/fake-sim.ts` 种子同步

### 3. 分组拆细：三组 → 五组

用户：「分组不够详细，全部放到时间线中不太对」。

| 组 | 行 | 口径 |
|---|---|---|
| **外观** | 面板布局 / 面板主题 | 既有（issue 246 范式） |
| **时间线** | 字号 / 时间范围 / 默认打开日 / 显示时刻列 | **时间线自己长什么样** |
| **内容过滤** | 产出 / 状态推进 / 点评 ✦ | **哪些痕迹进来** |
| **预告栏** | 明天预告卡 | 右侧那一栏，不属于时间线 |
| **入口** | 内联编辑器 | 既有 |

拆法理由：**「长相」与「内容」是两类设置**（前者改观感、后者改数据面），
混在一组里用户找不到；「预告栏」是另一栏的开关，也不该挂在「时间线」名下。

顺带把过滤空态文案从「时间线内容过滤」改成「内容过滤」+「设置 → 首页 → 内容过滤」，与组名同口径。

### 4. 入口列表：无说明小字 + 靠左不留内边距

- 删掉 `.bz-home-ent-hint`（原「拖动排序 · 点 × 移除（移除的排到最下面，点 + 加回）」）及其两条 CSS 规则。
- 列表**靠左、左边不留内边距**：宿主 custom 行左 padding 归零 + 行自身左 padding 归零
  → 拖柄贴卡片左缘；**右侧照常留边距**（×/+ 按钮原有 `margin-left:auto` 不变）。

> 注：本条首轮实现时做成了「贴右缘」（右边不留内边距），用户随即纠正为**左边**，
> 已按左对齐收紧。判据留在自检里（宿主行 `padding-left === 0px` 且 `padding-right > 0`）。

CSS 挂标记类的做法：CSS 管不着祖先，故由 `entry-editor.ts` 在 mount 时
`body.closest('.bz-sp-set-row')` 上挂 `.bz-home-ent-flush`，样式仍写在域内 `home/styles.css`
（铁律 4：样式归域）。

### 5. 顺带修的两个坑（都不是用户点名，但被本次改动暴露/绊住）

**(a) `riverView` 跨面板泄漏（真 bug）**
`riverView` 原本是 `ui.ts` 的模块级变量，**不在 `H` 里**，`resetHomeState()` 清不掉、
`closeOverlay()` 也不清。此前默认范围 `today` 只留一格窗口，旧的选中日必然被
`windowDays.some(...)` 滤掉，泄漏被掩盖；本次默认放宽到 7 天后**前一天不再被滤掉**，
于是「关面板再开」会以旧选中日渲染（回归测试里表现为「时间线空的」）。
修法：把 `riverView` 移进 `H`（模块状态单例），`resetHomeState()` 与 `closeOverlay()` 都归零。
已加回归测试。

**(b) `enh-sweep-c` 守卫在 HEAD 就是红的（既有问题）**
`tests/core/enh-sweep-c.test.ts` 禁止 `EDITABLE` 域出现 9/10px 字号，而
`src/home/styles.css` 的 `.bz-home-ev-dm`（时间线域名徽标）是 `10px` —— 该行早于本次改动
（`git show HEAD:src/home/styles.css` 确认）。顺手提到 11px，门禁转绿。

## 测试

| 文件 | 变化 |
|---|---|
| `tests/home/timeline-settings.test.ts` | +2 例（DEFAULT 范围=week；已跳过退役、过滤类型只剩三键） |
| `tests/home/ui-river.test.ts` | 周历用例改写为「默认 7 格 → 缩当天 1 格 → 回本周点昨天」；+1 例（查看日随关面板失效）；空态文案断言跟随组名 |
| `tests/settings-panel.test.ts` | 首页徽标 12 → 11 项 |
| `prototypes/settings-panel/prototype.html` | 自检：组序改五组、组归属按 `data-key` 逐一核对、组头图标全部兑现、入口行贴左缘、无小字、已跳过退役 |

**门禁**：`tsc --noEmit` 干净；全量 270 文件 / 4233 测试全绿；
评审壳自检 **SELFTEST OK 94/94**。

## 遗留

- 时间线「点评 ✦」只作用于今天那格（沿用 `flowHtml` 既有 `isToday ? buildNotes : []` 口径）——
  非今天的日子本来就没有点评可挂。
- 入口列表左缘贴齐后，观感是否过紧由用户在预览里定；若要留一点手位，
  只需给 `.bz-home-ent-row` 的 `padding-left` 从 `0` 改成一个 `--bz-space-xs`。
