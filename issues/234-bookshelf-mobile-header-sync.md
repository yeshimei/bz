# 234 · 书库移动端头行一行横滑 + 原型迭代流程落规

## 背景

书库原型落域（issue 233）后两轮用户评审迭代，随「同步」一次性回灌域代码：

1. 移动端分类标签纸签堆叠占半屏 → 先拍板紧凑小片平铺 → 再拍板**与「书库」匾、状态四签
   全部并成一行横滑**（滚动条双向隐藏）。
2. 流程修正（用户拍板）：**迭代轮只改原型（含共享 styles.css），ui.ts 冻结不同构**；
   「同步」时才一次性 ui.ts 同构 + 补测试 + 门禁 + build + 提交。

## 改动

1. **src/bookshelf/styles.css**（移动端 ≤768 块）：`.bz-bs-header` 单行横滑
   （nowrap + overflow-x + 滚动条隐藏）；`.bz-bs-labels / .bz-bs-cats` 移动端
   `display: contents` 升入头行（桌面 `display: contents` 隐身、布局逐像素不变）；
   分类签紧凑小片（去图钉/歪贴、名称+册数横排）。
2. **src/bookshelf/ui.ts**：`renderLabels` 分类标签装进 `.bz-bs-cats` 子容器
   （原型带路后回灌，与 prototype.html 逐字同构）。
3. **src/bookshelf/prototype.html**：renderLabels 同构 + 自检断言
   （桌面 31/31、?mob=1 31/31：contents 隐身、头行横滑 overflow+隐藏滚动条）。
4. **tests/bookshelf/ui.test.ts**：补同构契约断言（分类 2 张在 `.bz-bs-cats` 内、
   状态 4 张留在 `#bz-bs-labels` 直下）。107/107 绿。
5. **AGENTS.md 铁律 5 + docs/prototype-first.md**（铁流程·改 / 迭代节奏）：
   流程修正落规（见背景 2）。

## 门禁

tsc 干净；bookshelf 107/107、smoke 13/13 绿；全量 4135/4136——唯一红
`tests/core/enh-sweep-c` 小字号守卫为 **cinema 域在途 WIP**（10px/9px×3，非本批文件，
随该批次收口转绿）。产物同批重建入库（main.js + styles.css，先 build 后 commit）。
