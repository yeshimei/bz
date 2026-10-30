# ADR-0273：遮罩点击关闭改用「按下 + 抬起」手势配对（防跨元素松手误关）

- 状态：已采纳（2026-10-30 用户报障「选字时鼠标划到遮罩上，弹窗就没了」）
- 日期：2026-10-30
- 相关：`src/core/mask-dismiss.ts`（新增，判据单源）、`src/core/dom.ts`（`createOverlay`）、`src/core/ui/modal.ts`（`uiModal`）、`tests/core/mask-dismiss.test.ts`（行为 + 守卫）

## 背景

弹窗内容嵌在遮罩内部（`mask.appendChild(popup)`，或 `mask.innerHTML = 面板`），而 `click` 事件的 target 是 **mousedown 与 mouseup 两点的最近公共祖先**，不是「抬起时指针下的元素」。于是下面两种手势产生的 click 都落在遮罩本体上：

1. 在弹窗里选字，鼠标划出弹窗、在遮罩上松手 → 共同祖先 = 遮罩；
2. 在遮罩空白处误按，滑回弹窗里松手 → 共同祖先仍是遮罩。

旧判据 `if (e.target === mask) close()` 对这两种一视同仁地关闭。全仓 30 处在用这个写法（`createOverlay` 26 个调用点、`uiModal` 覆盖 22 个文件、各域自建遮罩十余处），症状是偶发——多数浏览器拖选后仍派发 click，个别路径不派发，所以表现为「有时候选字选着选着窗口就没了」。

弹窗限高 82vh、内部可滚动，拖滚动条时把手滑到遮罩上松手，走的是同一条路径。

## 决策

**遮罩点击关闭一律经 `bindMaskDismiss(mask, onDismiss)`（`src/core/mask-dismiss.ts`），四条判据全中才关：**

1. `mousedown` / `touchstart` 的 target 是遮罩本体（起点不在弹窗内任何节点）；
2. `mouseup` / `touchend` 的 target 也是遮罩本体（落点没滑进弹窗）；
3. 本次手势轨迹位移未超过 `MASK_DISMISS_SLOP`（8px）；
4. 关闭时机取 `click`，且 click 的 target 仍是遮罩本体。

`armed` 用三态（`true` / `false` / `null`）：

- `true` = 按下在遮罩上，候选关闭；
- `false` = 按下在内容上，本次一定不关；
- `null` = 没收到按下（合成事件 / 只派发 click 的既有测试）→ 回落旧判法 `e.target === mask`。

按下与移动都走**捕获阶段**，否则弹窗内任何 `stopPropagation` 都能把记录拦掉，静默退化成旧行为。

### 为什么不这么写

- **不用 `getSelection()` 判「有选区就不关」**：用户在弹窗里选了一段字、选区还留着，接着点遮罩想关时，多数浏览器会先折叠选区但不保证（控件 `preventDefault` 掉 mousedown 就不折叠），结果是「点了关不掉」——比误关更难自查。位移判据已覆盖选字场景。
- **不用 `mouseup` 当关闭出口**：提前摘遮罩后，浏览器仍会往当前顶层（body）派发那个 click，而全仓有文档捕获层的 click 监听（`item-actions` 的外部点击关闭 / 残余 click 抑制），会把它当成一次真实外部点击，轻则多关一层浮层。
- **不比较首尾净位移**：拖出去再拖回来，首尾两点几乎重合，只有轨迹累计（一旦超过容差就锁定为拖拽态、不回退）才拦得住。
- **不用 Pointer 事件**：jsdom 未实现 `PointerEvent`，测试里模拟手势会直接崩；`mousedown`/`touchstart` 与 `item-actions` 既有长按手势同一套口径。

## 影响面

- **A 类（popup 嵌在遮罩内，真有 bug）**：`createOverlay`、`uiModal`、`flow-dialog`、`lightbox`、belongings（面板 / 年度报告）、bookshelf、cinema（主面板 / 分析层）、clipbook（面板 / 报告）、checkup、diary 时辰选择器、dock、encrypt（主壳 / 体检 / 解锁屏）、favorites、gameshelf、home、knowledge（主窗 / 影像 / 新增 / 术语 / 挂载树 / sheet）、memo、password-vault（主壳 / 次级面板 / 条目弹窗 / 平台编辑）、people、pomodoro、review（做题会话）、settings-panel（更新日志 / 使用手册）——全部改绑。
- **B 类（popup 与遮罩并列挂 body）**：review 主面板 / 做题面板 / 统计 / 历史、knowledge 主窗族、mount-canvas、secondbrain 面板、encrypt 主壳。这类共同祖先是 body，遮罩收不到那个 click，本来没这个 bug；仍然改绑——它们之所以是兄弟，只是因为弹窗自带 `position: fixed` 居中，谁哪天为了省事把 popup 挪进遮罩，bug 立刻复现且没有测试会拦。改绑后行为等价（遮罩里本来没有子节点，target 恒等于遮罩）。
- **不改**：`core/item-actions.ts` 的抽屉与浮层（自有捕获层手势体系，处理的是长按残余 click，语义不同）。

## 守卫

`tests/core/mask-dismiss.test.ts` 扫 `src/**/*.ts`（排除 `mask-dismiss.ts` 自身）拦两条：

- `target === <遮罩变量>`（`mask` / `overlay` / `overlayEl` / `ov` / `ovl` / `addMask` / `statsMask` / `histMask`）；
- `<遮罩变量>.onclick =`。

新弹窗照抄旧弹窗是这条缺陷唯一的回流入口，靠测试卡住而不是靠记性。

## 代价与遗留

- **宽松分支是刻意留的**：只派发 click（无按下记录）仍会关闭。既有测试里有四十余处 `mask.dispatchEvent(new MouseEvent('click'))` 直接验证「点遮罩关」，收紧成「必须有完整手势」要逐处改成手势 helper，收益不抵成本；真实用户产生不了没有 down 的 click。
- **结构根治没做**：把 popup 移出遮罩、与遮罩并列挂 body，可以让误关从根上不存在。代价是遮罩当前承载了 flex 居中，popup 搬出来要各自 `position: fixed` 定位、单独管层级，二十多个调用点重新对齐，回归面远大于改判据。判定式修复是本轮的取舍，结构改造留作后续。
