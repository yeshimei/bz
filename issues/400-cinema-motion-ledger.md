# 400 影院动效台账单源（口径统一 + reduce 分歧收口 + 死规则清理）

## 背景

2026-09-21 动效走查发现：影院的节奏和缓动散在三层——影院 CSS 硬编码、影院 WAAPI 常量、
core 的 `--bz-dur-*` / `--bz-ease-*` 令牌。实测：

- `src/cinema/styles.css` 消费动效令牌 **0 次**（diary / bookshelf / belongings 等八个域都在用）；
- 影院 CSS 里交互类时长有 10 个自由值（.14/.16/.18/.2/.22/.28/.32/.36/.44/.74），曲线三条；
- **reduce 策略在前后两层里是相反的**：`styles.css` 段尾走「放缓 + 减幅」，而
  `ui.ts` 的共享元素（issue 396）、滑动高亮（issue 398）、涟漪（issue 399）三处明确
  「刻意不做分支」。用户本人机器恒报 `prefers-reduced-motion: reduce`
  （Windows 关窗口动画 → Chromium 恒报，core/styles.css 有实证记录），所以现状是
  「卡片抬升被压到 3px、按下无回弹、过渡 0.42s」与「涟漪 / 飞行 / 高亮全速全幅」同屏并存。
- 死规则与错注释：`.rec-row`（无任何元素带此类，实际渲染的是 rec-card / rec-list / rec-add）；
  styles.css 里「时长在 flyDur，reduce 时放缓」与实际（`SE_FLIGHT` / `SE_GROW` 常量 + 不做分支）不符。

## 决策（2026-09-21 用户拍板「按照你的来」）

1. **一套台账，四档时长两条曲线**，CSS 侧出 token、TS 侧出等价常量，两侧取值由门禁钉死：

   | 语义 | token | 值 | 用途 |
   |---|---|---|---|
   | 微反馈 | `--cn-m-fast` | .16s | hover / 按下 / 底色 / 高亮滑行 |
   | 空间位移 | `--cn-m-move` | .2s | 海报飞行、FLIP 让位、面板撑开与折回、涟漪 |
   | 揭示 | `--cn-m-base` | .28s | 面板入场、下拉展开、内容接力、海报淡入、卡片抬升与推近 |
   | 冲量 | `--cn-m-impulse` | .74s | 表单翻转这类一次性状态切换 |

   曲线两条：`--cn-e-out` = `cubic-bezier(.22,.82,.3,1)`（揭示：先快后缓、末尾收势）、
   `--cn-e-move` = `cubic-bezier(.34,.06,.16,1)`（迁移与冲量）。
   加载类循环（转圈 / 骨架 / 脉冲 / 扫描）属功能性指示，不入台账，取值不动。

2. **reduce 口径统一为「不做分支」**，与 396 / 398 / 399 三处已拍板口径一致：删掉影院段尾的
   `prefers-reduced-motion` 块。理由不只是「一致」——用户机器恒报 reduce，该媒体查询
   分不清「我关了系统窗口动画」与「我想要更少的动效」，**表达不了意图**；真要控制只有设置项能做
   （本批不做，留作后续可选项）。功能性指示（转圈 / 骨架）本来就不降级，不受影响。

3. 清理死规则与错注释（`.rec-row`、「flyDur」注释、段首「整段受 prefers-reduced-motion 收束」）。

## 落地

| 文件 | 改动 |
|---|---|
| `src/cinema/motion.ts`（新） | 台账常量 + `EASE` + 台账门禁用的取值表；纯数据，无运行时依赖 |
| `src/cinema/styles.css` | 段首加 token 块；全部时长/曲线改 `var(--cn-m-*)` / `var(--cn-e-*)`；删 reduce 块、`.rec-row`；改错注释 |
| `src/cinema/ui.ts` | 涟漪（`PEEK_MS` / `PEEK_BACK_MS`）、飞行与撑开（`SE_FLIGHT` / `SE_GROW`）、FLIP 走 `MOTION` 常量；曲线走 `EASE` |
| `tests/cinema/motion-ledger.test.ts`（新） | ①CSS token 取值 === TS 常量；②影院样式里所有 `transition` / `animation` 时长要么是 `var()`、要么在功能性循环白名单内（挡住手写 `.37s`）；③影院样式不含 `prefers-reduced-motion`（口径守卫） |

## 验证

- `tests/cinema/motion-ledger.test.ts` 五条：①CSS token === `motion.ts` 常量；②所有 transition/animation
  时长要么 `var(--cn-m-*)` 要么在功能性循环白名单；③`cubic-bezier` 只许出现在台账块内；
  ④内容接力阶梯步进 === `STAGGER`；⑤无 `@media (prefers-reduced-motion)`。
  打坏验证（把一处 token 换成 `.37s`）：检测器当场报出 `.37s`，非空转。
- 原型自检：真浏览器读 `.pcard` 的 `transition-duration` === 280ms（自检里临时改成 .31s 会红）。
- 全量 `pnpm test` + `tsc --noEmit` 绿。

## 遗留

- 跨域曲线收口（home `.2,.7,.3,1`、smartcat `0.4,0,0.2,1`、core `0.32,0.72,0.24,1`、secondbrain `.2,.8,.3,1`）不在本批白名单内，留给跨域动效批。
- 「少动效」偏好若要给出口，走设置项而不是 reduce 媒体查询。
