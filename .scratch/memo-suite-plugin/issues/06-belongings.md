# 06 — 归物本

**What to build:** 归物本物品登记面板完整移植：数据读写、增删改、分类、排序、统计。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] 数据文件（dataFolder 设置，默认 CONFIG/STORAGE）读写，条目 8 字段（id/name/description/category/purchase_price/purchase_date/current_status/last_updated）零迁移
- [ ] 物品面板：列表/卡片点击交互/刷新按钮（refreshBtn）/添加弹窗（名称/分类 select/描述/价格/日期/状态）
- [ ] 编辑物品、删除确认（「确认删除」）、customCategories 自定义分类设置
- [ ] 排序弹窗（showSortModal，自绘 + theme-dark 明暗色板适配）
- [ ] 分类统计显示
- [ ] 数据文件解析失败警告弹窗（「⚠️ 数据文件解析失败，请检查格式」）
- [ ] 命令 `belongings-add-item` 裸注册；changelog 'belongings'
- [ ] 测试：数据层 + UI jsdom
