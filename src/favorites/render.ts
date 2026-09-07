/**
 * 收藏本渲染纯层·域入口（ADR-0104 markup 单源 + ADR-0105 布局×主题分层）。
 *
 * 对外 API = 共享层 + 当前布局的聚合（ui.ts 与原型壳只认这里，对布局无感）：
 *   - 共享层（跨布局一份）：口径管道 / 卡片 / 表单 / 行操作集 / 菜单与抽屉 markup —— ./shared
 *   - 布局差异层（每布局一份）：layouts/board（亚麻板：面板骨架/磁贴行/卡墙胶水）
 * 加新布局：新建 layouts/<x>/render.ts 并在此工厂表登记；布局键自第二布局出现时再加设置。
 */
export * from './shared';
export {
  panelHtml, chipsHtml, boardHtml, renderTagsInto, renderBoardInto, renderPanelView,
  type FavRenderHooks,
} from './layouts/board/render';
