# issue 287 — 首页时间线六项设置 + 入口拖拽两个 bug

日期：2026-09-11 ｜ 域：home ｜ 关联：issue 246（外观组范式）、issue 283（入口彩点）、ADR-0104/0105/0106

## 背景

用户先要「首页有哪些设置项可以给用户」，拿到 16 条候选后点名 **8 / 9 / 10 / 11 / 13 / 14** 六条。
同一条消息里报了拖拽排序的两个 bug（连说两遍，强调）：

> 「设置页拖拽排序入口，桌面端上拖拽的时候，没有其他元素往上移动的那个动态效果。移动端长按拖拽没有效果。」

## 一、拖拽两个 bug（先修，因为它是「已存在的功能坏了」）

### Bug A：桌面端拖拽无让位动画

**根因**：`entry-editor.ts` 的 `onMove` 只写被拖行自己的 `transform`，
其余行完全不动 —— 用户看到的是「一行卡片浮起来在别的内容上飘」，没有「插进去」的**因果**。

**修法**：`applyShift(c)` 给**除被拖行外的所有可排序行**按「是否落在被跨区间内」设反向位移：

```ts
if (c.to > c.from && i > c.from && i <= c.to) shift = -1;      // 向下拖：途中行上移一格
else if (c.to < c.from && i >= c.to && i < c.from) shift = 1;  // 向上拖：途中行下移一格
```

配套 CSS：`.bz-home-ent-row { transition: transform .16s cubic-bezier(.2,.7,.3,1) }`，
被拖行 `.bz-home-ent-drag { transition: none }`（跟手要**即时**，不能吃这 160ms）。
`.bz-home-ent-shift { z-index: 1 }` 让它垫在浮起行下面。

### Bug B：移动端长按拖拽完全没效果

**根因**（两层叠着，缺一层都还是没效果）：

1. **`touch-action: pan-y` 让浏览器接管纵向手势。** 手指一动，浏览器就往滚动方向走，
   `pointermove` 直接被 `pointercancel` 掐断 —— 整个拖拽静默死掉，连报错都没有。
2. **长按期间没有压住长按菜单**，真机上先弹出选择框/上下文菜单，手指还没开始拖就被打断。

修法：

- 触屏 `pointerdown` 里**立刻**把本行 `touch-action` 置 `none`（拿住手势所有权），
  `endDrag` 时改回。桌面端不动（鼠标没这个问题）。
- 按住窗口（`TOUCH_ARM_MS = 250`）内位移 > `TOUCH_SLOP_PX = 8` → 认定为「用户要滚列表」，
  **不 preventDefault** 直接交还手势（自然继续滚）。
- 移除了原来「按满 200ms 自动 armed」的写法 —— 那会让「按住想滚动」的用户突然进入拖拽态。
  改为「按住 ≥250ms 后，第一次移动才真正起拖」，观感是「按住不动、一动就跟着走」。
- `contextmenu` 在拖拽中 `preventDefault()`；`window.blur` 兜底收尾（切窗口/切端不留脏状态）。

### 守卫

新增 `tests/home/entry-drag.test.ts`（6 例），逐条钉住上面每一条：

- 桌面端向下拖两格 → 第 1、2 行带 `.bz-home-ent-shift` 且 `translateY(-step)`，第 3 行起不动；
- 桌面端往回拖 → 邻居下移一格（负向区间）；
- 触屏 `pointerdown` 后 `style.touchAction === 'none'`；
- 触屏按住窗口内大幅滑动 → 交还手势、不进拖拽；
- 触屏按住满窗口后移动 → 起拖 + 带动邻居；
- 落地后邻居位移清干净、顺序真的变了。

评审壳 `prototypes/settings-panel/prototype.html` 同步加两条：让位行的 `translateY(-` 前缀、
落地后 `.bz-home-ent-shift` 清零。

## 二、时间线六项设置

> **2026-09-11 后续（issue 288）**：「已跳过」已删除（数据源没接、开关点不动）；
> 时间范围默认改为 `week`；本表九行已拆成「时间线 / 内容过滤 / 预告栏」三组。详见 issue 288。

| # | 设置项 | 键 | 默认 | 类型 |
|---|---|---|---|---|
| 8 | 时间线字号（紧凑/标准/宽松） | `homeTimelineSize` | `normal` | select |
| 9 | 内容过滤：产出 | `homeTimelineProduce` | `true` | toggle |
| 9 | 内容过滤：状态推进 | `homeTimelineProgress` | `true` | toggle |
| 9 | 内容过滤：点评 ✦ | `homeTimelineNotes` | `true` | toggle |
| ~~9~~ | ~~内容过滤：已跳过~~ | ~~`homeTimelineSkipped`~~ | — | **issue 288 已删除** |
| 10 | 时间范围（当天/最近 3 天/本周） | `homeTimelineRange` | ~~`today`~~ → `week` | select |
| 11 | 默认打开日（今天/最后有动静） | `homeDefaultDay` | `today` | select |
| 13 | 显示时刻列 | `homeTimelineTime` | `true` | toggle |
| 14 | 明天预告卡 | `homeNextCards` | `true` | toggle |

**默认值的总原则：加完设置、一个开关都不动，观感必须和加之前**完全**一样。**
所以产出/状态推进/点评默认开、已跳过默认关、时刻列开、预告卡开、字号标准、默认今天。
（例外：范围与「已跳过」在 issue 288 按用户后续要求改过。）

### 9 的口径（用户专门问了「解释一下 9」）

时间线数据源是 recap 五域痕迹（`recap/aggregate.ts` 的 `buildRecap`）。四类的判据是**文案前缀**，
不是域 —— 同一个域两种动作会分属两类，只有文案才带这个信息：

| 类别 | 判据（`shared.timelineKind`） | 例 |
|---|---|---|
| 产出 | 其余全部 | 「新增 3 条」「标记《X》已看」「读完《Y》」「完成『Z』」「专注…分钟」 |
| 状态推进 | 前缀 `新增备忘录` / 含 `加入片单` / 含 `读到 ` | 「新增备忘录『甲』」「《乙》加入片单」「《丙》读到 40%」 |
| 点评 ✦ | 不在痕迹里，是 `buildNotes` 挂在痕迹下面的那句话 | 「动手比昨天晚了 12 分钟…」 |
| 已跳过 | 剪藏流划掉的条目（`news:skipped`，**占真实行为流 51%**） | — |

**关于「已跳过」的诚实说明**：它的数据源是 `smartcat-behavior.json` 行为流，
而首页时间线当前只吃 recap 五域痕迹 —— 这两条链**还没接上**。
本次先把设置项与过滤口径落齐（键 + 类别表 + 守卫），
**已跳过开关勾上后暂时看不到新东西**，属于已知的「设置先行、数据源待接」状态，
不是静默失效。接数据源要动 recap 采集层（新增一个 news 痕迹源），留作后续。

**过滤为什么放渲染层而不是采集层**：切开关要即时可见，重采一遍 vault 太贵，
而痕迹本身已在 `RiverData.days` 里。代价是 `summary`/彩点仍按全量算 —— 这是**有意**的：
「今天有动静」不该因为关了「已跳过」就变暗。

**过滤光的空态与「本来就没痕迹」区分开**：前者明说「有痕迹，但都被挡掉了，去设置里勾回来」，
否则用户会以为数据丢了。

### 10 时间范围

窗口是**固定的 7 天采集**（`collectRiver` 的 `DAYS_N = 7`），设置只控制**周历画几格 +
days 里几格可选**：

- `today` → 周历一格「今」（范围设置本身就管「能往回翻几天」，不需要再给一堆格点不动）；
- `3d` → 3 格；`week` → 7 格（完整采集窗口）。

**注意行为变化**：默认从「7 格」变成「1 格」。这是 #10 的题中之义
（不选范围 = 只看当天），但 `tests/home/ui-river.test.ts` 里两处 `toBe(7)` 断言随之更新为 1。

### 11 默认打开日

`lastActive` = 时间线窗口内**最近一天有痕迹的**那天。只在数据刚到、用户还没点过周历时定一次
（`riverView` 为 `null` 时），窗口内全空则仍回今天。

### 13 时刻列

关掉时**不渲染 `.bz-home-ev-tm` 那个 span**（不是 CSS 藏）—— 藏了也还在 DOM 里被读屏念出来。
配 `data-tl-time="0"` 让行内缩进从 `--bz-space-xl` 收到 `--bz-space-lg`。

### 8 字号档

`data-tl-size` 落在 `.bz-home-timeline` 上，用 **`em` 基数**实现三档：
`compact: .875em` / `normal:` 不覆盖 / `loose: 1.125em`。
用 em 而不是再造三套 px —— 档位只改一个基数，时刻列/域徽/点评/空态按各自比例跟着缩，
改档不用同步改十个数。normal 档不加任何覆盖 = 基础值原样 = 与改前零差异。

## 三、三处同值（issue 246 铁律）

九个新键都要在三处同值，否则评审壳里 select/toggle 渲染成未选中、自检全红：

1. `src/settings.ts` 的 `BzSettings` 类型 + `DEFAULT_SETTINGS`；
2. `src/home/settings.ts` 的 `homeSettingsSchema()` 行声明；
3. `prototypes/settings-panel/fake-sim.ts` 的 `SEED_SETTINGS`。

## 四、测试

- `tests/home/entry-drag.test.ts`（**新**，6 例）：拖拽让位 / 触屏手势所有权。
- `tests/home/timeline-settings.test.ts`（**新**，9 例）：`timelineKind` 判据与 buildRecap 文案对齐、
  `filterEvents`、`timelineRangeDays`、过滤空态两种、时刻列/字号 data 属性、点评开关、预告开关。
- `tests/home/ui-river.test.ts`（改）：周历格数 7 → 默认 1 + 调宽后 7；新增 issue 287 三例
  （过滤+时刻列+字号从设置读、预告栏整块收掉、默认打开日落在昨天）。
- `tests/settings-panel.test.ts`（改）：首页徽标 `3` → `12`（外观 2 + 时间线 9 + 入口 1）。
- `prototypes/settings-panel/prototype.html`（改）：组序断言 `外观>入口` → `外观>时间线>入口`，
  新增时间线组 4 条 + 让位动画 2 条自检。

## 五、遗留

- **「已跳过」数据源未接**（见上）。开关与口径已就位，接 news 行为流是独立一次改动。
- **`homeTimelineNotes` 只作用于今天那一格**：`buildNotes` 本来就只给今天算点评
  （`flowHtml` 里 `isToday ? buildNotes(data) : []`），沿用了这个既有口径，未扩到往前的天。
