# 51 — 番茄钟读书自动关联（epub 阅读联动 + 读书预设 + 读书番茄统计）

**What to build:** grilling 会话（2026-08）确认的读书自动番茄钟——打开/关闭 epub 书自动联动番茄钟 + 读书预设自动切换 + 读书统计改为完成番茄数 + 删目标选择器书库 tab + 两个新设置项：

1. **打开书自动联动**：检测到 EPUB 阅读器（fork-weave-epub-reader，视图类型 `weave-epub-reader-standalone`，视图形状探测只读属性）打开书 → 番茄钟自动进入**读书专注**（target 自动设为该书，`type:'book'`，path = epub 文件路径，label = 书名）。场景决策（grilling Q9/Q10/Q5/Q6 定稿）：
   - 番茄钟 idle → **直接自动开始**，免确认（启动形态按设置：后台静默 / 自动弹窗，默认后台）
   - 休息阶段（短/长休）→ **弹窗确认**「跳过休息，开始读书专注？」
   - 专注中且 target 非书 → **弹窗确认**「进入读书专注？」
   - 读书专注中换书（同一视图内 filePath 变化）→ 暂停旧书专注（不计 history）→ 直接开始新书专注，**不再确认**
   - 弹窗选「否」→ 保持原状，本次打开期间不再提示；关闭再打开/换书 → 重新询问
2. **关闭书自动暂停**：读书专注运行中关闭书（reader 视图关闭 / active leaf 离开）→ 自动暂停（remaining 保留、target 保留），**豁免强制专注模式**（自动暂停响应关书而非用户操作，grilling Q11 定稿）；非读书专注/休息/idle → 不动。重开同一本书 → **重新开始新专注**（不恢复剩余，Q2 定稿）。
3. **读书预设**：「阅读沉浸 **45/10/20**」（工作 45 分钟 / 短休 10 / 长休 20，第 12 个预设，进设置下拉；依据：成人主动注意可持续区间 40-50 分钟 + 课时制，与马拉松 45/15/30 区分短休/长休）。读书模式期间 durations() 自动切换到读书预设，**退出读书模式恢复读书前用户所选预设**（含自定义；Q16 选 A）——内存 override，不落盘。确认弹窗选「是」（Q17）→ **立即**按读书预设开始专注（当前段重启，不跑完）。
4. **读书统计改数量**：弹窗统计行 `📚 读书 X 分钟` 改为 `📚 读书 X 个 🍅`（X = 今日完成、target 为书的专注数）；撤销「阅读时长按分钟统计」需求（Q3 定稿），`bookMinutesToday` 删除，无新数据落盘，`pomodoro.json` 字段不动。
5. **删目标选择器书库 tab**：书籍目标只由自动关联产生，📚 书库 tab 及其渲染删除；📝 备忘录 / 📄 当前笔记 tab 保留；`FocusTarget type:'book'` 保留（自动关联用，Q8：path 只用 epub 文件路径，不匹配书库 md）。
6. **设置项**（⚙️ 番茄钟设置弹窗，Q13 定稿）：「读书自动番茄钟」开关（默认开）+「读书启动形态」下拉（后台静默 / 自动弹窗，默认后台静默）。总开关关闭 → 全部联动静默（不监听、不动作、不切预设）。

**Blocked by:** 无（32 已完成）

**Status:** ready-for-agent

## 验收标准（User Stories）

### 打开联动
- [ ] 打开 epub 书（reader 视图激活；含 Obsidian 启动时书已打开——上次未关书即退出，视为打开事件）且番茄钟 idle → 自动开始专注：target={type:'book', path: epub 文件路径, label: 书名}，预设切「阅读沉浸」，按启动形态设置执行
- [ ] 形态=后台静默（默认）：不弹窗，状态栏倒计时可见，专注完成仍有 toast+声音
- [ ] 形态=自动弹窗：自动打开番茄钟弹窗
- [ ] 休息阶段打开书 → 弹窗确认「跳过休息，开始读书专注？」：是 → 立即开始读书专注（当前休息不计 history，按读书预设开始）；否 → 保持休息，本次打开不再提示
- [ ] 他处专注中打开书 → 弹窗确认「进入读书专注？」：是 → 立即开始读书专注（当前专注不计 history，预设切读书）；否 → 保持原状，本次打开不再提示
- [ ] 读书专注中换书 → 暂停旧书专注（不计 history）→ 直接开始新书新专注（无确认），预设保持读书
- [ ] 弹窗选「否」后书保持打开：不再重复询问；关闭再打开该书 / 换书 → 重新询问
- [ ] 强制专注模式开启时打开书（idle）：正常自动开始（idle 开始不受 forceFocus 限制）

### 关闭联动
- [ ] 读书专注运行中关闭书 → 自动暂停：remaining 保留、target 保留、预设恢复读书前所选
- [ ] 强制专注模式开启 + 读书专注运行中关闭书 → 自动暂停仍生效（豁免）；手动暂停/跳过/重置仍禁用（状态机语义不变）
- [ ] 非读书专注（target 非书或专注已暂停）关闭书 → 番茄钟不动
- [ ] 休息阶段关闭书 → 番茄钟不动（休息继续走完）
- [ ] 重开同一本书 → 重新开始新专注（不恢复暂停剩余时间），target 重新挂上
- [ ] 暂停态（读书专注被自动暂停）下用户手动「继续」→ 恢复读书专注（书仍关着，用户主动操作允许）

### 读书预设
- [ ] ⚙️ 设置下拉出现第 12 项「阅读沉浸（45/10/20）」，选中可持久使用（用户手动选读书预设 = 正常持久使用，不触发恢复逻辑）
- [ ] 读书模式期间 durations() 返回读书预设；长休息间隔 N 仍用全局设置（预设不含 N）
- [ ] 退出读书模式（关书自动暂停）→ 预设恢复读书前用户所选（含自定义方案）；读书期间用户手动改预设 → 读书 override 优先，退出后恢复用户设置
- [ ] Obsidian 重启（书未开）：无读书 override，预设为用户设置值

### 统计
- [ ] 弹窗统计行 `📚 读书 X 个 🍅`：X = 今日（本地时区）完成、target.type=book 的专注数；X=0 时该行隐藏（与现状一致）
- [ ] `bookMinutesToday` 及「📚 读书 X 分钟」显示删除；history 中 book target 的完成专注仍计入「今日 N 个 🍅」

### 目标选择器
- [ ] 目标选择器只剩 📝 备忘录 / 📄 当前笔记 两个 tab；📚 书库 tab 删除（含测试更新）
- [ ] book target 仅由自动关联产生，手动选择器不再出现书籍选项

### 设置
- [ ] ⚙️ 弹窗新增「读书自动番茄钟」开关（默认开）+「读书启动形态」下拉（后台静默/自动弹窗，默认后台静默）；开关关闭后监听卸载（懒加载语义，ADR-0003）
- [ ] 设置落盘 BzSettings 新字段（默认值：`pomodoroEpubAuto: true`、`pomodoroEpubMode: 'background'`）；旧 data.json 无字段 → 默认开/后台，不破坏

### 清理
- [ ] 卸载（onunload）移除 workspace 监听、轮询定时器、确认弹窗 DOM，无残留

## Implementation Decisions

- **新模块 `src/pomodoro/epub-link.ts`**（读书联动接线层，ui 依赖方向内）：
  - `getEpubView(app)`：形状探测当前 active leaf——viewType ∈ {'weave-epub-reader-standalone'}（fork 构建；常量收在本模块），鸭子类型读 `view.filePath` / `view.bookTitle`；无 → null。**只读 view 属性，不注册任何阅读器公开 API**（区别于 ADR-0016 的双向契约，无需阅读器侧配合）
  - `decideReadingAction(prev, next, state, settings)`：**纯函数决策**——输入（打开/关闭/换书事件 + 当前状态 + 设置）→ 输出（`{ action: 'start-focus' | 'pause' | 'confirm-enter' | 'confirm-skip-break' | 'none', book?: {path, label} }`），承载 Q9/Q10/Q5/Q6/Q12 全部场景表
  - `ensurePomodoroEpubLink(app)`：幂等常驻初始化——`active-leaf-change` 监听 + 轻量轮询兜底（同视图内换书不触发 leaf 变化，每秒 tick 时顺带比对 filePath；轮询间隔与番茄钟 tick 复用，不新增独立定时器）
  - `unloadPomodoroEpubLink()`：清理监听/轮询/确认弹窗
- **确认弹窗**：复用 `createOverlay`（core/dom），zIndex 与目标选择器同级（10005）；文案按通知文案规范（`检测到阅读《书名》，进入读书专注？` / `跳过休息，开始读书专注？`），是/否两按钮
- **自动暂停豁免 forceFocus**：`state.ts` 状态机**不动**（forceFocus 语义保持）；`ui.ts` 暴露内部 `forcePause()`（pause 语义绕过 forceFocus 分支，仅 epub-link 调用），落盘走既有 save/render/tick 生命周期
- **读书预设 override**：模块级 `readingPresetActive` 标志 + `durations()` 优先分支（读书模式返回「阅读沉浸」），不落盘、不动 `settings.pomodoroPreset`；设置弹窗下拉显示用户设置值（读书模式下显示读书预设，退出恢复）
- **统计**：`stats.ts` 新增 `bookCountToday(history, now)`（今日完成、target.type=book 条数），删除 `bookMinutesToday`；`ui.ts renderStats` 改显示
- **设置**：`settings.ts` 加 `pomodoroEpubAuto: true`、`pomodoroEpubMode: 'background'`；⚙️ 弹窗两新行；`main.ts` onLayoutReady 随 `ensurePomodoro` 链注册（开关关 → 跳过注册，ADR-0003 事件常驻域模式）
- **无新命令**：不新增 bz- 命令 id（联动纯事件驱动）；smoke.test.ts 命令清单不变
- **数据格式**：`pomodoro.json` v1 字段不动（无新落盘）

## Testing Decisions

- **最高 seam = `decideReadingAction` 纯函数**（新）：表驱动全场景测试——idle 打开/休息中打开/他处专注打开/读书中换书/关书/重开同一本书/选否后不再提示/forceFocus 组合，覆盖 Q9-Q12 决策表；断言输出动作 + 是否弹确认 + 目标书。这是新功能唯一的新逻辑 seam，测试成本集中在决策表
- **现有 seam 复用**：`tests/pomodoro/ui.test.ts`（jsdom 交互）增：确认弹窗是/否交互、设置两新项、统计行改数量显示、书库 tab 删除（删「书库 tab：列出书籍并选中」用例）；`tests/pomodoro/stats.test.ts` 增 `bookCountToday`、删 `bookMinutesToday` 用例；`tests/pomodoro/settings.test.ts` 增两新字段默认值
- **检测接线测试**：自建 workspace mock（参照 `tests/auto-summary/index.test.ts` 的 emit 模式）——emit active-leaf-change（带假 reader view：viewType/filePath/bookTitle）验证打开/关闭/换书触发决策；轮询兜底（filePath 变化不换 leaf）单测
- **预设 override**：纯函数测试（读书模式 durations() 返回 45/10/20、退出恢复、用户手动改被覆盖、重启无 override）
- **好测试标准**：只断言外部行为（决策输出/UI 文案/DOM 状态/落盘数据），不测实现细节（不 mock 内部模块函数，只 mock workspace/view 形状）

## Out of Scope

- 不匹配书库 md 书籍（只用 epub 文件路径，Q8）；书库 md 书籍目标不再可选（书库 tab 删除）
- 不做阅读活跃检测、不按分钟统计阅读时长（Q3 已撤销）；「阅读时长」术语不再使用
- 不改状态机（state.ts）forceFocus/autoCycle 语义；不新增 pomodoro.json 字段
- 不新增阅读器跨插件 API（不注册 host 能力，只读 view 属性）；不处理阅读器未安装场景（无视图可探测，联动自然静默）
- 移动端适配（阅读器 isDesktopOnly:false，但联动按桌面端实现，不特判平台）
- 不新增 bz- 命令；不改 epub 阅读器侧任何行为

## Further Notes

- grilling 决策全表（Q1-Q17）：启动形态设置默认后台 / 重开书新专注 / 统计改完成番茄数 / 休息与他处专注均弹窗确认 / 换书直接切 / forceFocus 自动暂停豁免 / 选否保持原样 / 总开关默认开 / 只用 epub 路径 / 读书预设自动切换退出恢复 / 确认后立即按读书预设开始
- 「阅读沉浸 45/10/20」依据：成人主动注意可持续区间 40-50 分钟（注意力研究）+ 标准课时制；短休 10 分钟利于阅读后恢复；长休 20 分钟。与既有 11 预设均不重复
- 术语（随实现同步进 CONTEXT.md 番茄钟域）：**读书专注 (Reading Focus)** = target 为书籍的专注阶段，由打开 epub 自动触发；**读书模式 (Reading Mode)** = 打开书进入读书专注到关书自动暂停之间的状态，期间生效读书预设，退出恢复；**读书预设 (Reading Preset)** = 「阅读沉浸 45/10/20」；**读书番茄数 (Reading Pomodoro Count)** = 今日完成、target 为书的专注数
- spec.md（唯一事实源）番茄钟行待实现时同步：设置项总表 +2、测试数变更
