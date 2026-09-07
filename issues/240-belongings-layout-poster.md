# issue 240：归物本接入 ADR-0105 布局×主题分层

- `src/belongings/render.ts` 收敛为域入口（14 行聚合）；`shared.ts`（370 行）= 跨布局共享层
  （常量/格式化/计算口径/详情/表单/抽屉头/行操作集）；`layouts/poster/render.ts`（220 行）=
  「瑞士大字报」布局差异层（面板骨架/hero/chips/自绘下拉/KPI/网格卡/渲染胶水）。
- 归属判据同书库批：跨布局复用（详情/表单/口径）→ shared；排布差异 → 布局层；wall→shared 单向依赖无环。
- 守卫改指：review-fix-b / enh-sweep-c 源码扫描改指 layouts/poster/render.ts。
- ui.ts / 原型壳 / 预览包 API 零改动（入口 re-export 兼容）。
- 门禁：tsc 干净；全量 4146/4146；原型自检 30/30。
- 前置：并行会话的年份/移动排序自绘下拉批已入库（e8a9a03）。
