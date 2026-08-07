# 16 — 复习计划

**What to build:** FSRS 驱动的复习计划完整移植：幂律算法、阶梯引导、面板、5 命令、事件监听。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] FSRS 幂律模型（实现时从源码复制）：R(t,S)=(1+t/(S·0.9))^(-0.9)、d=0.9、四评级（again/hard/good/easy）、initS/nextDiff/nextStab/nextInterval 公式、w 18 权重数组
- [ ] 固定阶梯：FSRS_FIRST_INTERVALS 10 级（1/1440→120 天，文案 1m/30m/6h/1d/3d/7d/15d/30d/60d/120d）、stage≥9 转 fsrs 阶段
- [ ] review.json 读写 + 向后兼容（reviewStage→stage、缺省 stability=1/difficulty=0.3/phase 推断）；复习历史数组追加（{timestamp, stage, rating, stability, R}）
- [ ] 面板：复习列表（状态文案 ✅ 已完成/R=X%/📅 逾期/⏳ 待定）、搜索框（「搜索笔记...」）、归档显示开关（showArchived）、评级按钮（再次/困难/良好/简单）、完成复习、移出确认（「确定移出"xxx"？」）
- [ ] 5 命令裸注册：review-open-panel/review-add-current（当前笔记入复习）/review-remove-current/review-jump-overdue（跳转逾期）/review-mark-dialog（评级弹窗）
- [ ] 事件监听（resolved/modify/rename/quit 四类）数据自动同步；重命名处理失败提示
- [ ] 空态「🎉 没有逾期笔记」；难度字段（difficulty）
- [ ] 测试：FSRS 公式数值断言（评级→S/D/间隔）、阶梯推进、兼容迁移
