/**
 * 设置面板渲染纯层·域入口（settings-panel，ADR-0104 markup 单源 + ADR-0105 布局分层）。
 *
 * 对外 API = 共享层 + 当前布局的聚合（renderer.ts / ui.ts 与原型壳只认这里，对布局无感）：
 *   - 共享层（跨布局一份）：控件级 markup 工厂（开关/下拉/输入/滑杆/chips/卡组/行/组骨架）—— ./shared
 *   - 布局差异层（每布局一份）：layouts/jingwei（P1 系统面板 = 桌面 B 侧栏工作台 + 移动 M1 命令面板）
 * 与模板串孪生域不同：本域 schema 驱动，纯层收「schema 节点视图 + 值 → HTML 串」的工厂
 * （见 shared.ts 头注），schema 本体与绑定逻辑（visibleWhen/onChange/落盘）留 renderer.ts 行为层。
 * 加新布局：新建 layouts/<x>/render.ts 并在此登记分发；布局键自第二布局出现时再加设置。
 */
export * from './shared';
export {
  deskHeadHtml, deskShellHtml, navSecHtml, navItemHtml,
  mobHeadHtml, mobShellHtml, mobItemHtml, mobRowHitHtml, mobModalShellHtml,
  mobSecHtml, mobEmptyHtml,
} from './layouts/jingwei/render';
