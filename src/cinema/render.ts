/**
 * 影院（cinema）渲染纯层·域入口（ADR-0104 markup 单源 + ADR-0105 布局×主题分层）。
 *
 * 对外 API = 共享层 + 当前布局的聚合（ui.ts 与原型壳只认这里，对布局无感）：
 *   - 共享层（跨布局一份）：格式化口径/稳定键/片卡/共享弹窗/AI 页/菜单抽屉行 —— ./shared
 *   - 布局差异层（每布局一份）：layouts/midnight/（午夜场 desk/mob 壳与渲染胶水）
 * 加新布局（gazette/booth）：新建 layouts/<x>/render.ts 并在此登记。
 */
export * from './shared';
export {
  midnightDeskHtml, midnightMobHtml, railHtml, chipsHtml,
  emptyPageHtml, spHeadHtml, listHeadHtml, listToolsHtml,
  renderMidnightDesk, renderMidnightMob,
  type MidnightRenderInput,
} from './layouts/midnight/render';
