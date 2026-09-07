/**
 * 书架墙（bookshelf）渲染纯层·域入口（ADR-0104 markup 单源 + ADR-0105 布局×主题分层）。
 *
 * 对外 API = 共享层 + 当前布局的聚合（ui.ts 与原型壳只认这里，对布局无感）：
 *   - 共享层（跨布局一份）：筛选排序管道 / itemId / 借书卡 / RenderHooks —— ./shared
 *   - 布局差异层（每布局一份）：layouts/<布局>/（书脊墙 = layouts/wall）
 * 加新布局：新建 layouts/<x>/render.ts 并在此工厂表登记；布局键/主题键自第二布局出现时再加设置。
 */
export * from './shared';
export {
  panelHtml, labelsHtml, sortSegHtml, wallEmptyHTML, wallLoadingHTML, renderWallInto,
  wallScale, spineVars, spineHTML, fitTitle, packZone, catColor,
  type BsWallScale,
} from './layouts/wall/render';
