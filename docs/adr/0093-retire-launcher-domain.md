# ADR-0093：退役旧 launcher 域（入口页），home 为唯一入口

- 状态：已接受（2026-09-05）
- 关联：issue 178（home 立项时预挂的另票）、issue 192、ADR-0092（同批 memo 退役）

## 背景
home（内容首页，ticket 177/178）作为入口页「新标签页」升级交付后与旧入口页长期并存。issue 178 已预挂「稳定后 launcher 另票删除」及其连带清单。用户拍板（2026-09-05）：本轮执行完整退役，整个文件夹删除。

## 决策
1. 删除 `src/launcher/` 整目录（data/ui/gestures/icons/styles）与 `tests/launcher/`。
2. **命令下线**：bz-home 删除；手势功能随域退役（gestures.ts 依赖 launcher 生态，桌面/移动手势键 launcherGesture/launcherGestureMobile 与 launcherShowText/launcherShowTextMobile 四键删除，main.ts 手势迁移块与 syncGestures 一并拆除）。
3. **生态连带**：
   - attach 磁贴自动播种（ensureAttachSeed，写 launcher.json）删除，attach 命令与右键菜单保留；
   - checkup 段级漂移与 json 巡检清单去 launcher.json；
   - smartcat 行为流 launcher:opened 路由/文案/构造函数删除（通道无事件源，历史条目回落存储描述渲染）；
   - settings-panel 入口页行（noSettings 隐藏行）删除；DOMAIN_ICONS.launcher 条目删除；build-css SOURCES 去 launcher/styles.css。
4. **数据零迁移**：用户 vault 内 launcher.json 保留不主动删除（用户数据，先例 ADR-0088 残留自然忽略）；旧 data.json 残留 launcher*/gesture* 键自然忽略。

## 理由
- home 已覆盖入口语义且统计/钉选/搜索体验完整，双入口并存徒增维护面。
- 手势默认关闭且动作单一（开入口页），随域删除比迁移到 home 更符合「抹除痕迹」拍板；日后确需手势可在 home 域重建。
- 幽灵磁贴兜底机制随域删除后不再有消费方，无遗留风险。

## 后果
- 已绑定 bz-home 的快捷键失效（ADR-0085 先例）；入口动作由 bz-home-open（内容首页）承担。
- smartcat 行为流中历史 launcher 条目渲染回落旧式 `source:action` 文案。
- 相关测试（gestures/launcher ui/data/d3、main-lifecycle 手势迁移、smoke 清单）删除或收缩。
