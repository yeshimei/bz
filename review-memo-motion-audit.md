# 备忘录动效排查（落地后复检）

> 2026-09-22 · 针对 `wt/memo-strike` 本批落地的动效（`src/memo/ui.ts` +537 / `styles.css` +191 / `src/core/ui/flip.ts` 新增 / `slide-pill.ts` 新增）
> 判定方式：**实测**＝在预览壳里真点一次、高频采样 DOM；**读码**＝从代码与 CSS 层叠推断。共 14 条。

## 状态：14 条全部已修复并同步主仓（commit e57605c3 + d8abd24b）

修复后在预览壳里重新实测的证据：

| 条目 | 修复后实测 |
|---|---|
| A1 折叠条动画覆盖 | `animationName` = `"bz-memo-donebar-hit, bz-memo-donebar-bump"` —— 两个并列，bump 真的在跑（修复前只有一个）；t=1446 时 hit 已摘、bump 继续跑完 0.9s |
| A2 撞击/refresh 竞态 | 涟漪出现那一帧计数仍是**旧值**（`cnt:"6"`、`cntOut:1`），说明撞击整段跑在 `refresh()` 之前 |
| C1 面板关闭 | 退场板子 `board:1, boardSize:"716x576"`，按面板真实矩形裁出，`is-out` 在演 |
| C2 编辑器关闭 | 返程板子 `board:1, size:"461x235"`，按弹窗真实矩形裁出后缩回源卡 |

**排查时的一处误判（如实记录）**：B3 我原写「第二根残影 opacity 算成负数」，实际那两行在 `fly()` 里，而 `fly` 只有一个调用点且 `inset` 恒为 0 —— 是**走不到的死分支**，不会真算出负值。残影本体用的是 `0.34 - i*0.13`（0.34/0.21），是合理的。修复改为删掉这个恒不生效的参数与分支，而不是改公式。


---

## 一、实际看不到效果的（最先修）

### A1 · 折叠条的两个动画互相覆盖，既有那条「完成去向反馈」被吃掉了 【实测】【高】

`bumpDoneBar()`（既有，呈报#13 13A）与新的撞击 `bz-memo-donebar-hit` **同时挂在同一元素上**：

```
实测采样（点一次勾选）：
{"t":1079, hit:true, bump:true, cntOut:1, cnt:"7"}
```

两条 CSS 规则特异性完全相同，`.bz-memo-donebar-hit` 声明在 **289 行**、`.bz-memo-donebar-bump` 在 **189 行** —— 后者胜出。

```
.bz-memo-donebar.bz-memo-donebar-bump { animation: bz-memo-donebar-bump 0.9s ease; }   /* 189 */
.bz-memo-donebar.bz-memo-donebar-hit  { animation: bz-memo-donebar-hit 520ms ...; }    /* 288 ← 生效 */
```

**后果**：`animation` 是简写属性，一个元素上只跑一个。bump 的「背景高亮 + 计数数字色变缩放」**完全不出现**，只剩 hit 的 scaleY 压凹。也就是说——加了新的撞击，把原来那条唯一有效的完成反馈顶掉了。

**建议**：二选一。要么把 bump 的背景/计数色变并进 hit 的 keyframes（一条动画演完），要么 bump 改走 `box-shadow` / `color`（不与 `transform` 抢同一个属性）。

---

### A2 · 撞击 / 涟漪 / 计数滚动与 `refresh()` 撞在同一毫秒，是竞态 【实测】【高】

时序对齐得很整齐，整齐到危险：

| 事件 | 触发时刻 |
|---|---|
| `rollAway` 起卷 | t=0 |
| 卷起结束 → 注册撞击 | t=340（`ROLL_CURL_MS`） |
| **撞击 setTimeout 到期** | **t=740** |
| **`rollWait` 到期 → `refresh()`** | **t=740**（`ROLL_MS = 340+400`） |

两者**同刻到期**，只靠「谁先注册」决定先后——`rollWait` 注册在先（`completeItem` 里 await 之后），所以它先跑，紧接着 `refresh()` 执行 `content.innerHTML = sections.join('')`（第 978 行），**折叠条连同计数一起被重建**。

撞击那段拿到的是**新节点**：

```js
const shown = Number((cntEl?.textContent ?? '').trim());
if (cntEl && Number.isFinite(shown)) rollCount(cntEl, shown, shown + 1);
```

实测这次是 `cntOut:1`（旧数字节点建出来了），说明**抢在 refresh 前面跑到了**——但这是运气：落盘慢一点、`MemoData.completeItem` 多花几十毫秒，顺序就反过来，`shown` 就会读到已经是新值的计数，`from === to` → `rollCount` 直接 return，**计数滚动一次都不演**。

**建议**：把「演完」的口径从「卡片落进计数」延长到「+ 撞击阶段演完」（约 +300ms），让整条链在 refresh 之前结束；或者把撞击阶段提到 refresh 之前显式 await。现在是靠事件循环排队顺序在赌。

---

## 二、会错位 / 会闪的

### B1 · FLIP 幽灵在滚动列表里位置偏一个 scrollTop 【读码】【高】

`src/core/ui/flip.ts:115`：

```js
g.style.cssText = `position:absolute;left:${Math.round(r.left - rr.left)}px;top:${Math.round(r.top - rr.top)}px;...`
```

`r` / `rr` 都是 `getBoundingClientRect()`（**视口坐标**），相减得「相对容器可视框」的偏移。但幽灵是 `position:absolute` 挂在容器里，absolute 相对的是**内容区 padding box**，两者差一个 `root.scrollTop`。

`[data-memo-content]` 正是滚动容器（`content.scrollTop = keepTop`，第 980 行）。

**后果**：滚到列表中部再切场景 / 敲搜索，被过滤掉的卡片留下的残影会**偏上一段距离**（正好是 scrollTop）。滚得越多偏得越离谱。平时列表短、不滚动，所以一直没暴露。

**建议**：`+ root.scrollTop` / `+ root.scrollLeft`（非滚动容器时为 0，无副作用）。同样的问题 `slide-pill.ts` 也有（它按 `clip` 容器裁剪，横滑场景条滚起来会偏）。

---

### B2 · 删除离场会「闪一下」 【读码】【中】

`playDeleteExit` 给卡片挂 `.bz-memo-vanishing`（180ms 淡出到 opacity 0），**不等它演完**就 `deleteItem → refresh()`：

```js
function playDeleteExit(id) { ...; card.classList.add('bz-memo-vanishing'); }   // 1481
// 注释：离场由 playFlip 的幽灵接住（两段视觉接得上）
```

但幽灵的起始帧是 `opacity: 0.9`（flip.ts:119）——**从近乎不透明重新淡出**。卡片本体已经淡到接近 0，refresh 后突然跳回 0.9 的灰块再淡：中间有一下明显的亮度跳变。

**后果**：落盘快（<180ms）时最明显，正是最常见的情形。

**建议**：删除时 `await` 完 180ms 再 refresh；或让幽灵的起始 opacity 继承被删卡片当时的实际值。

---

### B3 · 第二根残影几乎透明，且末帧 opacity 算成了负数 【读码】【中】

`ui.ts:1337-1338`：

```js
{ transform: ..., opacity: inset ? 0.4 - delay / 240 : 1 },   // delay=90 → 0.025
{ transform: ..., opacity: inset ? 0.24 - delay / 240 : 1 },  // delay=90 → -0.135  ← 无效值
```

delay 取 `[45, 90]`：
- 第二根起始 opacity = **0.025**（基本看不见，「两层拖尾」实际只有一层）
- 第二根末帧 = **-0.135**，不是合法 opacity，会被忽略或 clamp

**建议**：改用固定递减（如 0.34 / 0.21），别把 opacity 和 delay 线性耦合。

---

## 三、不完整 / 不对称的

### C1 · 面板关闭没有动效，只有一层遮罩在淡 【读码】【中】

`closeMemoPanel` 是同步语义（几十处调用点 + 测试都假定「返回即没了」），所以 `playPanelExit` 只留了一层与遮罩同色的 `.bz-memo-veil` 淡出，**面板本体瞬间消失**。

代码注释里把这个权衡写清楚了（试过保留面板 / 克隆快照，都会让「面板还在不在」的查询命中残影），判断本身没错。但从用户视角就是：**开的时候纸抽起来，关的时候"啪"一下没了**——开合不对称，这是最容易被感知到的缺口。

**建议**：veil 那层可以做点文章——比如带上最后的位置与尺寸做一次下沉/回缩再淡，或至少让 veil 的淡出时长与开场的时长对齐（现在 300ms vs 开场 420ms）。

---

### C2 · 编辑器只做「生长」，没有返程 【读码】【中】

`playEditorGrow`（1696）只做打开方向。注释说明关闭若也折回去就得把弹窗留到动画播完，而「关了没有」是同步语义（脏表单校验、连续开下一个都靠它）。权衡成立，但同样是不对称。

---

### C3 · 撤销删除的卡片凭空出现 【读码】【中】

删除有离场（B2），撤销回来**没有任何入场**：refresh 时 `newView=false` → `enter: false`，而 ghost 只管「消失的件」。卡片就那么出现了。

**建议**：撤销走一次 `touchViewEpoch()` + `nextEnterFrom='bottom'`，让它自下长出。

---

## 四、死代码与失真注释

| 位置 | 问题 |
|---|---|
| `styles.css:269` `.bz-memo-rollph` | 改用 FLIP 补位后已无 JS 引用（`ui.ts` 中 0 处） |
| `styles.css:32` `.bz-memo-leaving` | 改用 veil 后无引用（只在注释里被提到） |
| `styles.css:41` `.bz-memo-ovout` | 同上，无引用 |
| `styles.css:243` | 注释仍写「reduced-motion 由 ui.ts 的 `ROLL_REDUCED_*` 控时长」，但 `ROLL_REDUCED_*` 已随「去 reduce 分支」删掉了——**注释与代码不符**，会误导下一个人 |

---

## 五、节奏与观感

### D1 · 搜索每敲一下都排 12 张接力入场 【读码】【中】

`touchViewEpoch()` 在搜索防抖的回调里（第 71 行）→ 每次过滤结果变化都算「换了一批」→ `enter: { n: 12, stagger: 26 }`。打字快时，上一轮 300ms 的接力还没演完就被下一轮打断，动画互相覆盖，观感偏"闹"。

**建议**：搜索时把 `n` 降到 4–6、stagger 降到 14ms；或只在「关键词从空变非空 / 从非空变空」时排接力，词内增量过滤只演补位 + 幽灵。

### D2 · 卡片 hover 只有背景色过渡，没有层级变化 【读码】【低】

`.bz-memo-card { transition: background-color ... }`——相比侧栏底片、排序底片的滑动质感，卡片这一层还是最素的。属于「还能再往上走」而不是「有问题」。

---

## 建议的修复顺序

1. **A1 + A2**（一组改）：折叠条动画合并 + 撞击阶段移到 refresh 之前 —— 这两个修完，"完成"这条主链的五段编排才真的都看得见
2. **B1**：FLIP 幽灵加 scrollTop —— 一行的事，长列表滚起来必现
3. **B2 + B3**：删除离场的亮度跳变 + 残影 opacity 公式
4. **C1 / C3**：开合对称与撤销入场
5. **死代码清理 + 注释校正**

---

*本次只做排查，未改动任何源码。实测数据来自预览壳 `http://localhost:5177/prototypes/memo/prototype.html`（桌面端 iframe）的一次真实点击采样。*
