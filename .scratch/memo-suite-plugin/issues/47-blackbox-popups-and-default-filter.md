# 47 — 黑匣子人物/时间线独立弹窗 + 默认类型筛选设置项

**What to build:** 主面板 header 右上角 👤 人物 / 🕐 时间线 打开**独立中央弹窗**（完整度保留，复用现有渲染函数），面板主视图保持单一时间流；新增设置项 `blackboxDefaultTypeFilter`（主面板默认类型筛选：''=全部 / concept / literature / thought，默认 ''，重启生效，与 diaryDefaultSelectedTag 同模式）全链路。

**Blocked by:** 46 — 黑匣子主面板流式化

**Status:** done

## 验收标准

- [ ] 人物弹窗（👤）：独立 mask+popup（`bz-blackbox-people-mask` / `bz-blackbox-people`，z-index 面板之上），内容 = 原人物页完整度：画像卡墙 + 详情（印象字段级锁 / AI 观察采纳+移除 / 情绪聚合 / 事件投影）+ 新建画像（AI 提炼初始印象）；点击遮罩或 ❌ 关闭；ESC 层级优先于面板（后注册先响应）
- [ ] 时间线弹窗（🕐）：独立 mask+popup（`bz-blackbox-timeline-mask` / `bz-blackbox-timeline`），内容 = 原时间线页完整度：按月分组事件流 + 推测事件虚线 ❓ [确认][删除] + 证据链展开 + 人物/年份筛选 + 推测事件显示开关消费（resolveShowSpeculative）
- [ ] 弹窗与面板数据同源：面板打开时若弹窗已开 → 关闭弹窗；refreshAll 时弹窗（若开）同步刷新；关闭面板连带关闭弹窗
- [ ] 设置项：`settings.ts` MemoSettings + DEFAULT_SETTINGS 增 `blackboxDefaultTypeFilter: ''`；`settings-ui.ts` ⚙️ 弹窗增下拉「主面板默认类型筛选」（全部/概念/文献/想法）；面板打开时消费（空串 → 空集 = 全部；非空 → 预选该类型）；重启生效（与 diaryDefaultSelectedTag 同模式，不做运行中热切换）
- [ ] 测试：人物弹窗（打开/关闭/画像采纳）、时间线弹窗（打开/关闭/推测事件确认删除）、设置项（默认值/下拉保存/面板消费）

## 引用

- `.scratch/blackbox-suite-plugin/spec.md`「人物弹窗」「时间线弹窗」「默认类型筛选设置」节
- `src/blackbox/panel.ts` 现有 renderPeople/renderProfileDetail/renderTimeline/eventCard 函数（v3 弹窗复用，宿主结构改为独立弹窗）
- `src/blackbox/settings-ui.ts`、`src/settings.ts`
