# ticket 097 —— 数据面板：归因展示 / 安静期可见化 / 口径统一

状态：**done**（2026-08-24 实现：A1 归因徽标+LLM 引用截 30 字·lexical 零解释/A2 安静陪伴 chip/A3 标注覆盖率小字样本阈值分支/B1 感情卡 lazyAttachment 口径对齐总览/B2 theme chip+已被推翻行态+pinned 优先/C1 删手动刷新改 vault modify 防抖 3s 静默刷新；dashboard-097.test.ts 12 用例，全量绿 + tsc 0 错误）
基线：以合并时 master HEAD 为准（≥9d42948）；开工前 git log 确认
日期：2026-08-24
父需求：用户拍板「做吧」（A1/A2/A3/B1/B2 全做）

## 背景

六方向（091-096）数据层已落地，面板存在两类缺口：新数据未露出（A 组）、口径分裂（B 组）。
本票纯展示层+口径统一，**不改任何数据写入逻辑、不加设置项、不加命令**。

## A1 成长轨迹显示「为什么变了」（091 票面遗留，P0）

位置：renderPersonality 的「成长轨迹」卡（buildGrowthTrail）。
- growthHistory 归因条目现带 `attribution: { mode: 'llm'|'lexical'; quote?: string }`
- 行内追加徽标：llm → 「LLM 归因」；lexical → 「词法推断」（复用 bz-sc-dash-badge，可加第二色调类）
- **仅 mode=llm 且 quote 非空时**在行尾展示引用原文（truncateText ~30 字，样式 bz-sc-dash-tl-desc 或专用 quote 类）
- **lexical 一律不显示解释文案**（体验原则：不产伪解释——只露徽标即可）
- buildGrowthTrail 返回结构需扩字段（mode/quote），dashboard.ts 内消费；注意既有调用兼容

## A2 安静陪伴 chip（095 可见化）

位置：renderOverview 英雄区（hero-main 尾部，瞬时情绪 chip 旁）。
- `editingData.quietMode?.on === true` 时显示 chip「🌙 安静陪伴中」（emoji 仅此一处允许？否——遵守通知/正文无 emoji 铁律的精神：chip 用文字「安静陪伴中」即可，样式用既有 chip 类 + 新增低调色类）
- 非 quiet 态不渲染该元素（不留占位）

## A3 情绪页标注覆盖率小字

位置：renderEmotion「情绪趋势」卡 meta 行下方（或卡标题右侧小字）。
- 复用 emotionDensityStats（096 已有纯函数）输出一行：
  `情绪标注覆盖 X%（非 calm 占比 Y%）`；样本 <5 条时只显示条数不显百分比
- 纯读展示，零交互

## B1 感情卡口径统一（真不一致修复）

现状：renderPersonality 感情卡直读 `g.relationship.trust/attachment`，
而总览相处数据走 computeDashboardStats（内含 093 lazyAttachment 分离衰减视图）→ 同时刻两数不同。
- 改法：感情卡的信任/依恋改走与 computeDashboardStats 相同的 lazyAttachment 视图
- 卡片 hint 文案补一句「已按缺席分离衰减（读侧视图，不写盘）」
- **禁止**反向改 computeDashboardStats 回直读

## B2 洞察行 theme 徽标 + 废弃视觉态

位置：renderMemory 洞察列表行（已有固定/废弃按钮）。
- 有 `theme`（工作|兴趣|关系|健康|环境）→ 行首小 chip 显示主题名
- `supersededBy` 非空 → 整行降透明度 + 描述加删除线 + 徽标「已被推翻」；
  pinned → 徽标「已固定」；两者并存时 pinned 优先显示
- 操作按钮行为不变（废弃后刷新即呈现新态）

## C1 去掉手动刷新按钮，改自动刷新（用户 2026-08-24 拍板）

现状：头行 🔄 按钮（id smartcat-dash-refresh）→ 点击重读渲染 + toast。
改为：
1. **删除 🔄 按钮及其监听**（头行只剩标题 + ❌ 关闭；id 移除在票中留档——面板私有 id，无外部依赖方）
2. **事件驱动静默刷新**：`registerEvent(app.vault, 'modify')` 监听
   `getSmartcatFilePath(app)` 与 memo.json 两路径 → 命中即防抖 3s 后静默重读渲染
   （保持当前页签；**不弹任何 toast**）
3. 刷新失败保持旧画面静默（连续失败也不 toast 打扰；关闭前最后一次失败可忽略）
4. 生命周期：监听与防抖计时器在 closeSmartcatDashboard 全部清理；
   openSmartcatDashboard 幂等重开路径不得泄漏旧监听
5. 保留既有 escManager 注册与 mask 关闭路径不动
## 样式纪律

- 只复用 card()/barRow()/statBlock()/el()/emptyHint() 工厂与既有 bz-sc-dash-* 类
- 确需新样式一律进根 styles.css（bz-sc-dash- 前缀），构建自动复制；禁止内联视觉样式与运行时 <style>
- 不动 DOM 既有 id/类名（外部契约）

## 测试要求

- buildGrowthTrail 扩展字段单测（llm 带 quote/lexical 无/缺 attribution 兼容旧数据）
- 安静 chip 渲染开/关两态；覆盖率小字（样本阈值分支）
- 感情卡惰性视图口径（与 computeDashboardStats 一致性断言）
- theme/superseded/pinned 三态行渲染（UI 测试）
- C1：modify 命中防抖刷新（保持页签/无 toast）；非目标路径 modify 不触发；close 后监听清理（二次 open 无泄漏）；刷新失败静默保旧画面
- 既有 dashboard/memory/mood 测试全量回归绿

## 工程规约

exFAT pwsh 写盘（新建必 WriteAllText UTF8 无 BOM）/ git 已全局 safe.directory /
Conventional Commits 中文 / .scratch add -f / flake 协议 maxWorkers=4 /
门禁 npm test 全绿 + tsc --noEmit 0。汇报 ≤15 行。工作树保持干净。