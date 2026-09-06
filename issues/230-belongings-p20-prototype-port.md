# 230 · 归物本 P20 原型方向纠正——把拍板原型写进 bz（评审壳重建 + 域对齐）

## 背景

issue 226 的 P20 移植由并行会话完成，域代码（ui.ts/styles.css）吸收了后续修复，但拍板原型
`p20-full.html` 从未落域；本轮误拿域现状反向生成了域内 prototype.html（「把 bz 写进原型」），
用户纠正方向：**应该是把原型写到 bz 中**。

## 改动

1. **src/belongings/prototype.html** 重建为 p20-full 的域内定稿（共用 styles.css 评审壳）：
   p20 的设计值逐字回灌——方角墨框 chips（无图标）、下划线搜索/年份输入、墨底记一笔
   （hover 赤橙）、页脚品牌行 `BZ·BELONGINGS — P20 SWISS POSTER`、移动端 = 手机壳设计
   （m-kpis 四格缝线 / 工具行搜索+年份 / 横滑 chips / 排序 seg / 单列网格 / 底部记一笔 /
   居中脚注）。UI 图标沿用 lucide（数据分类 emoji 保留， favorites 先例）。
2. **src/belongings/styles.css** 对齐上述设计（组件库件在海报作用域内做皮覆盖，
   铁律 6 不破）；保留容器查询双端单源、[hidden] 压制、详情徽章 static 三个修复。
3. **src/belongings/ui.ts** 与新原型同构：
   - 移动窄头行只留关闭 ✕（＋/搜索钮与 mobsearch 折叠行退役——p20 手机壳搜索常驻工具行）；
   - 新增 `data-bel-mobsort`（移动排序段，与桌面段 uiSegmented 双实例 setValue 同步）、
     `.bz-bel-mobadd`（底部记一笔）、`.bz-bel-foot-brand`；
   - chips 去图标（桌面 + 横滑条）；
   - 状态 pick / 详情流转条闲置档挂 `bz-bel-c2`（p20 .cur.c2 赤橙）；
   - 右键菜单挂 `bz-bel-menu` 海报皮（openItemMenu menuClass 通道，域类作用域防泄漏）。
4. **tests/belongings/ui.test.ts**：骨架断言换 mobsort/mobadd/foot-brand；
   mobsearch toggle 用例替换为移动排序双实例同步用例。75/75 绿。

## 刻意保留（后续批准过的演化，不回退原型）

- 出离日期字段（ADR-0089，p20 原型没有）；uiSuggest 分类联想（issue 203）；移动点卡走
  core 底部抽屉（issue 202）；core 服务（esc/z 序/撤销/确认框）。
- 面板 920×640 相对 p20 整页海报的等比缩档（h1 40 / hero KPI 42 / em 40 / name 19 / price 23）。

## 门禁

tsc 干净；belongings ui.test 75/75；?selftest=1 自检绿 + CDP 双端截图评审。
按迭代规矩：**不构建不提交**，等「同步」。
