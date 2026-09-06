# ADR-0101: 收藏本 C5 终版原型 1:1 换血 + 三项功能退役

日期：2026-09-06
状态：已拍板（用户逐项确认）
关联：ADR-0097（域内皮肤）、ADR-0074（归档冷存）、issue 219 系列（旧 C5 皮）、issue 227

## 背景

原型 `.zcode/ui-prototypes/favorites-cork-5/c5-linen-full.html` 经多轮迭代收敛为终版：
真实数据、右键菜单、添加/编辑弹窗（含 AI 整理）、手机端底部抽屉同页并存、亮暗双主题、
相对时间、竖排标签徽记脚注、无大模型/关联笔记。

## 决策

1. **1:1 照搬，豁免铁律 6**（用户拍板）：面板内样式与 UI（磁贴行/卡片/右键菜单/底部抽屉/
   表单/空态）全部逐字照搬原型，**不使用** core/ui 样式库与组件库；CSS 以 `.bz-fav-*` 前缀
   全量域内自带（styles.css 重写）。跨域服务级依赖保留（不属面板 UI）：notice/flow-dialog/
   esc-manager/mobile/z-order/settings-provider。
2. **大模型/余额整功能退役**：删表单「大模型配置」区块、右键「刷新余额」、卡片余额徽记、
   ai.ts 的 BalanceService 与打开面板自动查询链；favorites.json 的 llmConfig/balance* 字段
   保留不迁移（读旧数据不炸，写不再产出）。
3. **时间格式固定相对**：删设置键 favoritesTimeFormat（设置页「日期显示」行删除），
   卡片恒为相对时间（刚刚/N 分钟前/N 小时前/N 天前，超 7 天回落 `M-D` 短日期）。
4. **关联笔记整功能退役**：删表单字段、跳转笔记动作、卡片笔记徽记，**并整链退役
   file-sync.ts**（引用同步 + 同名自动关联的后台服务，其唯一职责即本功能）；
   main.ts 接线与 index 再导出摘除；数据字段 linkedNote 保留不迁移。
5. **主题跟随 Obsidian**：原型的 body.dark 手动切换钮不照搬；CSS 变量亮色为基，
   `.theme-dark` 作用域覆盖暗色（等价原型 dark 变量组）。
6. **checkup 零触碰**：favorites.json 字段不迁移，只读巡检白名单维持现状。

## 后果

- smartcat 契约（favoritesEditChanges 观察 title/url/description/tags）零改动。
- 归档/删除/置顶撤销、smartcat 事件、命令 ID、favoritesMobileDefaultFullscreen 键保留。
- file-sync.test.ts 删除；balance.test.ts 删除；ui.test.ts 按新 UI 重写；
  settings 相关断言删 favoritesTimeFormat 行。
