# 252 · 复习计划域 UI 单源收编（V1 原型为真理）

- **状态**：落地
- **背景**：用户圈选第二批原型 V1「基线复刻版」（`.zcode/ui-prototypes/review-sprint-variants/`）并拍板
  「落域、单源、原型是真理」。复习计划成为 ADR-0104（markup 单源）/ ADR-0106（行为单源）
  范式的第七个收编域，也是首个「先有真行为原型评审、再按原型回灌域」的域。
- **markup 单源**：新增 `src/review/render.ts`（渲染纯层，纯度守卫通过）——三区队列
  （头行/工具行/开始本轮条/三区列/底部信息行/空态宿主）、整窗冲刺（头行/加载/题卡/本轮
  队列/结果卡/结算屏）、难度弹窗、悬浮迷你评级条全部迁入；`ui.ts` / `sprint.ts` 只剩
  生命周期/事件委托/数据流。产物 `prototype-render.js` 挂 `window.BZR_review`。
- **行为单源**：新增 `src/review/fake-sim.ts` + `src/review/fake/fake-obsidian.ts`；
  `prototype.html`（双 iframe 桌面 920/移动 396 + `?selftest=1` 41 断言）+ `prototype-view.html`
  评审壳真跑插件同款 ui.ts/sprint.ts/app.ts/quiz-core 依赖链。产物 `prototype-behavior.js`
  挂 `window.BZW_review`（~1.6MB：⚙ 直达动态 import settings-panel 全域 schema 闭包内联）。
  出题 AI 走 fake `requestUrl` canned 回放——按 generator prompt 特征（单篇/批量标记）识别
  出题请求，回放 `RVW.SEED.quizBank`；其余请求抛错降级。演示种子日期相对「当下」计算，
  永不过期。
- **V1 原型增量落地（原型是真理）**：
  1. 卡片「待重做」红 tag 显性化（`pendingRedo` → `.bz-q-tag.is-redo`）；
  2. 归档态状态条改绿点「已完成复习 · 再点回到队列」（旧态误用红点「开始本轮」）；
  3. 列内排序 置顶 → R 升序 → 到期（`render.sortColumn`，rp1 拍板规则首次实装）。
- **顺修真 bug**：底部信息行统计图标名 `chart` 在 Obsidian lucide 表中不存在（生产一直渲染
  空白），改 `bar-chart-3`（表内存在、同形状）。图标表经 asar 实证法核对
  （`skip-forward` 路径数据逐字取自 obsidian.asar）。
- **构建接线**：`scripts/build-preview.mjs` 的 `PREVIEW_DOMAINS`/`BEHAVIOR_DOMAINS` 加入
  `review`；`scripts/_gen-review-icons.mjs` 生成 `prototype-icons.js`（16 枚，既有域图标表
  并集 + asar 补缺）。
- **测试**：`tests/review/ui.test.ts` 增 4 用例（待重做 tag / R 升序排序 / 置顶排序 / 归档
  状态条）；`tests/review-fix-b.test.ts` 扫源守卫改指向 `render.ts`（markup 迁移惯常伴随）。
- **自检**：headless（Edge + CDP，`scripts/_selftest-cdp.mjs` 驱动）`SELFTEST OK 41/41`——
  含完整做题轮：开始本轮 → 待重做重做 + 6 篇 12 题全对 → 结果卡/结算屏 → 回队列 →
  重做解除/逾期归零/短档重排今日/长档入未来。验收铁律：`--allow-file-access-from-files`
  必带（file:// iframe 同源），数据种子必须在 `<head>`（clipbook 教训）。
- **观察项（不改动，留档）**：
  - 挂起（missing）条目被 `partitionQueue` 归入 done 列（ticket 098 语义），归档视图可见，
    「已完成 N 篇」计数含挂起——是否要独立「挂起」区，留待用户拍板；
  - 逾期卡若 R<阈值也会挂「提前」tag（`isEarlyDue` 不排除逾期）——语义可议；
  - 阶梯短档（6h/1d）通过后会重排回「今天」列，属间隔重复正常行为，评审时勿误判为漏销。
