# 248：剪藏本移动端目录化（编辑部皮 + site 章 + 已收折叠）

日期：2026-09-08 ｜ 分支：feat/clipbook-mob-toc-248 ｜ worktree：clipbook-mob-toc-248

## 背景

桌面编辑部印刷风（issue 214）落域后，移动端仍是「标准组件库皮肤」，且列表 = 源横滑条
（全部未读 / site 动态聚合 / B站 UP / 剪藏本）+ 通栏卡列表。用户提出移动端也要编辑部化，
五套原型对照（`.zcode/ui-prototypes/clipbook-mob-editorial/` m1~m5）后拍板 **m3 目录索引**
并确认两个决策：

1. **完整替换移动端**：目录章即导航，源横滑条（mobstrip）退役；UP/剪藏本聚合入口并入目录
   （UP 信息在条目标题/meta，回看靠章展开 + 检索）；源级批量已读迁移到章头长按。
2. **章粒度 = site**：与桌面 rail 同源口径（aggregateSites：剪藏全量 + 未读 news 面，
   总数降序）；已收量大时折叠行承接——「未读/在读常显、已收 N 篇收成点线行可展开」（方案①）。

## 改动

- **render.ts**：移动骨架去 `[data-clip-mob-sources]` 槽；移动条目去摘要行（目录化，保留
  dot/标题/meta + st 类）；新增章头 / 折叠行 / 章目录 markup（mobChHeadHtml / mobFoldHtml /
  mobTocHtml，章数据显式入参，纯层可测）；移动详情正文加「打开笔记」文字脚（clip 且
  notePath 存在时）。
- **styles.css**：移动端整块重写为编辑部皮（纸墨 token 消费 --clip-*，直角细线 / 衬线 /
  橘章印 / 章头吸顶 / 点线折叠行）；移动详情页同皮（返回/保存钮透明细线化、正文两端对齐）。
  触控热区（44px 档）与刘海安全区保留。
- **ui.ts**：renderMobSources / mobstrip 绑定全删（含搜索态源 chip 计数联动退役）；
  renderMobList → renderMobToc（章 = aggregateSites 行，章内 active = 未读/在读常显 + 已收
  折叠；搜索态命中平铺不折叠）；折叠展开态模块级 Set 记忆（详情返回不丢）；章头挂
  buildRailActions 长按（全部标为已读）；条目长按抽屉保留（attachItemActions 同源）；
  移动详情打开笔记委托。
- **tests**：render.test 移动 chip 断言退役、补章目录 markup 单测；ui/enhance 相关断言随动。

## 关联

ADR-0107（本次新增）；原型 `.zcode/ui-prototypes/clipbook-mob-editorial/m3-toc-index.html`
不入 git；桌面 rail / 列表与移动详情（非本文所涉结构）不动。
