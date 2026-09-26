# 227: 收藏本 C5 终版原型 1:1 换血（ADR-0101）

对照原型：`.zcode/ui-prototypes/favorites-cork-5/c5-linen-full.html`（冒烟 26/26 绿）

## 拍板项
- 大模型/余额整功能退役（服务+UI；数据字段保留）
- favoritesTimeFormat 键删除，固定相对时间
- 关联笔记整功能退役（含 file-sync.ts 整链 + main.ts 接线）
- 面板 UI 豁免铁律 6：全部照搬原型，不用样式库/组件库；跨域服务（notice/flow-dialog/esc/mobile/z-order）保留
- 主题跟随 Obsidian 亮暗，不照搬原型手动切换钮

## 清单
- [ ] ui.ts 换血：头行（仅「收藏本」16px）、磁贴行（lucide plus 的「新收藏」chip 无磁点、已归档灰 chip）、卡墙（胶带/磁点/竖排标签徽记脚注+相对时间行、无 host/图钉/笔记徽记/余额）、右键菜单（域内自绘 linen 浮层：打开/置顶/编辑/归档⇄取消归档/分隔线/删除无日期）、移动底部抽屉（域内自绘：磁点+标题+meta+动作列）、表单（标题/链接/简介/标签多选/置顶开关 + AI 整理钮，无大模型/关联笔记）、空态照原型文案
- [ ] styles.css 全量重写（原型 CSS 逐字，bz-fav-* 作用域，.theme-dark 变量组）
- [ ] ai.ts 删 BalanceService；ui.ts 删 refreshBalances/余额徽记/表单 llm 区块
- [ ] file-sync.ts 删除 + index/main.ts 接线摘除
- [ ] settings schema 删「日期显示」行
- [ ] 测试：balance.test/file-sync.test 删；ui.test 重写；settings-modal/smoke 同步
- [ ] 门禁：pnpm test + tsc --noEmit；合并后 build 部署
