# 108 — 第二大脑面板打磨：增量进度 / 新维度 / 树形分布 / 统一 AI / 对话弹窗 / 窄窗头部

**What to build:** 用户 grilling 15 条共识（ticket 108）：①②⑦⑬⑭⑮主面板、③④⑤⑥⑧⑨⑩参考窄窗、⑪⑫对话弹窗、⑬AI 通道统一。

**Blocked by:** 107

**Status:** done（2026-08-26）

## 验收清单

- [x] 主面板存储占用卡：合计单值（如 54.4 MB），hover 明细 meta + 向量
- [x] 「上次索引」卡与「最近向量化」行用共享 formatRelativeTime（core/utils），hover 精确时间戳
- [x] 近 12 周趋势柱铺满整行（去 max-width 20px 上限）
- [x] 来源分布树形逐级展开：名称左对齐取消 92px 预留列宽；▸/▾ 点击下钻子目录（递归、子行缩进、占比条全局同尺度）；每级节点聚合其下全部计数（buildSourceTree 纯函数输出全树）
- [x] 新增统计维度：白名单覆盖率（N/M 篇）、内容规模（总字数/平均块长/平均每篇块数）、最厚笔记 Top5（点击跳转）、索引一致性健康灯（向量行数 vs 块总数，偏差告警色）
- [x] 打开即增量索引：`hasPendingChanges()` 预扫描（新文件/变更/删除）；有待处理 → 全屏进度视图接管（progress-title 复用引导位，标题「正在同步索引」），完成自动切统计；无变更直接统计；首次空库仍带按钮引导
- [x] 重新索引（设置弹窗 → confirm 确认 → 关设置 → 开主面板自动全量重建）：store.rebuildAll（等待在途 refresh 后清空 meta/vec/VP 缓存再整库重嵌）；失败给原因可重试
- [x] AI 通道统一（ADR-0052）：AI.ask 单参走 core AI（主设置页 aiProvider），失败直接抛、调用方 toast；设置弹窗删对话三行（键保留不消费）+「前往配置」行；桌面/移动端 DeepSeek 复选框删除；概括缓存文件保留（面板可重新生成覆盖），设置页清除入口移除
- [x] 参考窄窗：删 🤖/⚙️，按钮换 emoji 🔄/◀️▶️/❌；标题去 📚；收起边条固定 📖；密度切换（📃/📑，会话内有效）
- [x] 对话改居中弹窗（core createOverlay 9998/9999）：无头部按钮，遮罩+ESC，min(600px,92vw)×72vh；chat.show()/close()/destroy() API；index 接线同步更新
- [x] 测试：statistics.test.ts（buildSourceTree 聚合/排序/根目录、computeStats 新维度）、init-ready.test.ts +3（hasPendingChanges 四态、rebuildAll 清空重嵌）、onboarding-ui.test.ts +4（增量进度接管、无变更直进统计、重建流程、对话弹窗冒烟与 AI 失败气泡）
- [x] 门禁：secondbrain 117 例全绿 + tsc 0；文档（spec 55-58 + Further Notes、issues/108、PROGRESS、CONTEXT 三术语、ADR-0052、AGENTS 决策 6 修订）

## 决策记录（用户逐项拍板，grilling 两轮）

- 存储占用=合计单值；相对日期复用 core formatRelativeTime（其他 6 域同款）
- 来源分布逐级展开不设层数上限；密度切换不持久化（会话内）
- 「统一使用 ai」= 对话+概括走主设置页 AI；Embedding 仍 Ollama bge-m3；失败直接报错不回退 Ollama
- 旧对话三键保留 data.json 不消费（CONCURRENCY 死配置先例）；ollamaChat 函数与测试保留标注预留
- 重新索引=清空全量重建（Q7=A）；打开面板增量索引进度=全屏进度视图接管（Q10=A）
- 新维度选 a+b+c+e（覆盖率/内容规模/最厚 Top5/一致性）