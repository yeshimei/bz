/**
 * 设置面板渲染纯层·域入口（settings-panel，ADR-0104 markup 单源 + ADR-0105 布局分层）。
 *
 * 对外 API = 共享层 + 当前布局的聚合（renderer.ts / ui.ts 只认这里，对布局无感）：
 *   - 共享层（跨布局一份）：控件级串工厂 + 行/组骨架 + 子弹窗骨架 —— ./shared
 *     （ADR-0104 markup 单源；ADR-0106 起行为唯一真理 = 域 ui.ts，原型壳为双 iframe 评审壳）
 *   - 布局差异层（每布局一份）：layouts/jingwei（P1 系统面板 = 桌面 B 侧栏工作台）
 * 与模板串孪生域不同：本域 schema 驱动，纯层收「schema 节点视图 + 值 → HTML 串」的工厂；
 * schema 本体（数据/绑定/行为）留壳与 renderer.ts 行为层。
 * 加新布局：新建 layouts/<x>/render.ts 并在此登记分发；布局键自第二布局出现时再加设置。
 */
export * from './shared';
export {
  deskShellHtml, navSecHtml, navItemHtml,
  mobShellHtml, mobItemHtml,
} from './layouts/jingwei/render';
