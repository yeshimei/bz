# issue 239：ADR-0105 布局×主题分层——书库首批落结构

- docs/adr/0105-layout-theme-layering.md：一域多布局、每布局自带主题；布局=信息架构，主题=token 皮肤组，结构颜色正交。
- bookshelf 拆分：`render.ts`（域入口，聚合共享层+布局，对外 API 不变）/ `shared.ts`（跨布局一份：筛选排序管道、itemId、借书卡、RenderHooks）/ `layouts/wall/render.ts`（书脊墙差异层：骨架/标签/排序/装箱/空态）。
- 入口经 `export … from './layouts/wall/render'` 聚合——ui.ts/原型壳零改动；单布局期不加布局设置键（防死键）。
- 共享件归属判据：detailBodyHtml/RenderHooks 跨布局复用 → shared；骨架/排布 → 布局层。
- 环引用规避：wall 只 import shared，入口只 re-export——无 entry↔layout 环。
- belongings（layouts/poster/）排队：等主仓进行中的自绘下拉批落地再迁（同文件并行冲突）。
- 门禁：tsc 干净；原型自检 38/38；全量见提交前记录。
