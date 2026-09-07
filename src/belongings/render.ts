/**
 * 归物本渲染纯层·域入口（ADR-0104 markup 单源 + ADR-0105 布局×主题分层）。
 *
 * 对外 API = 共享层 + 当前布局的聚合（ui.ts 与原型壳只认这里，对布局无感）：
 *   - 共享层（跨布局一份）：口径计算/详情/表单/行操作集 —— ./shared
 *   - 布局差异层（每布局一份）：layouts/poster（瑞士大字报，P20 拍板稿）
 * 加新布局：新建 layouts/<x>/render.ts 并在此登记分发；布局键自第二布局出现时再加设置。
 */
export * from './shared';
export {
  panelHtml, chipsHtml, mobChipsHtml, yearsOptionsHtml, sortOptionsHtml, segmentedHtml,
  kpisHtml, stampCount, mobStatsText, emptyHtml, cellHtml, gridHtml,
  renderPanelView, type RenderHooks,
} from './layouts/poster/render';
