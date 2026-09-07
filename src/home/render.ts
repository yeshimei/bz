/**
 * 内容首页（home）渲染纯层·域入口（ADR-0104 markup 单源 + ADR-0105 布局×主题分层）。
 *
 * 对外 API = 共享层 + 当前布局的聚合（ui.ts 与原型壳只认这里，对布局无感）：
 *   - 共享层（跨布局一份）：域清单 / 活动河类型与口径 / 规则纯函数（点评/预告/彩点/
 *     计数文案）/ 日期文案 —— ./shared
 *   - 布局差异层（每布局一份）：layouts/river/（活动河三栏 = layouts/river）
 * 加新布局：新建 layouts/<x>/render.ts 并在此登记；布局键/主题键自第二布局出现时再加设置。
 */
export * from './shared';
export {
  panelFrameHtml, loadingEntriesHtml, loadingFlowHtml,
  weekHtml, entriesHtml, flowHtml, nextHtml, tilesHtml,
} from './layouts/river/render';
