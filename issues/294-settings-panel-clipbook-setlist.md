# 294 — 设置面板快速原型轮：剪藏本精简 + 管理弹窗通用组件化 + uiSetlist 组件入库

- 日期：2026-09-12
- 用户拍板（快速原型轮，逐条走查）：剪藏本设置删减、UP/RSS 管理弹窗样式与动态更新修复、列表组件四布局变体评审后定缺省
- 关联：ADR-0080（设置面板）、ADR-0104/0105（渲染/行为分层与 markup 单源）、ADR-0122（弹层 token 兜底）、issue 293（上一轮）
- 状态：已完成

## §1 设计决策

### 剪藏本设置精简（用户拍板）

- 删「面板宽度记忆 / 面板高度记忆 / 目录栏宽度记忆」三个 number 行（`clipbookPanelWidth/Height/MidWidth` 数据键保留，拖拽记忆功能不变，只是不再进设置面板）。
- 删「B站 UP 主」「RSS 订阅」两个开关：UP 主名单、RSS 订阅源、B站抓取条数三行改常显（开关退役后 `visibleWhen` 门控不再可用，抓取条数一并放开）。`news.json` 的 sources 段仍由数据层整段合并写。

### 管理弹窗通用组件化

- UP/RSS 管理弹窗内容改调设置面板通用渲染器 `renderPanelSchema`（函数级懒加载跨域，符合环引用规则），替代 core 声明渲染器；删 `settings-panel/styles.css` 里 `#bz-*-manager-popup .setting-item*` 全部 id 级模仿 CSS（RSS 弹窗此前完全没适配，UP 弹窗靠模仿也不完整——用户走查截图即证）。
- 弹窗壳保留自建 overlay（`openSettingsModal` 单例 toggle 语义会顶掉底层剪藏设置弹窗）；壳内头描边/内容色统一挂 `--sp-*`，`.bz-sp-btn`/input max-width 按 dir-picker 先例并入面板控件作用域组。
- 列表行宿主补 `bz-sp-set-row--list` modifier（名称/描述一行在上、列表占满行宽在下）——缺它时条目横铺进右侧控件区、行名被挤成竖排（面板渲染器 list 分支的潜在缺陷，此前无 schema 真用过）。

### 通用组件 uiSetlist（列表组件入库）

- 新增 `src/core/ui/setlist.ts` 工厂 + `BzSetlistItem/BzSetlistOpts` 类型 + `core/ui` 桶导出；样式 `.bz-setlist` 四布局变体 `rows/grid/chips/dense`。
- **缺省 = chips 流式胶囊**（用户四变体评审页拍板）；副文案（UID/URL）chips 不展示 → 条目 `title` 悬停提示保信息可达。
- 条目补发丝描边（`--bz-border`）：条目底 `--bz-surface-2` 与面板卡片/弹窗纸底同为近白，无描边时底形不可见（评审页实况）；`.bz-setlist:empty` 不占位。
- **两渲染器同调该工厂**（core `settings-schema.ts` / panel `renderer.ts`），删 `settings-panel/shared.ts` 的重复字符串实现——此前仅 CSS 类共用、markup 两份实现，结构漂移即布局事故；新增「两渲染器同构锁」测试（同一 ListRow 两端 `.bz-setlist` outerHTML 逐字一致）。
- 手册登记：§3.2 类表 + §4 工厂表（含「设置类名单一律走 uiSetlist，禁手搓条目」）。

### 列表行动态更新修复

- 症状：弹窗内添加/删除条目需重开弹窗才可见。
- 根因：列表重建此前只在移除路径自触发；「添加」走行内按钮动作，渲染器动作后只重算显隐/徽标，不触碰列表条目。
- 修法：列表行重读重建注册进两端刷新链（core `customRefreshes` / panel `valueRefreshes`），任意行变更即重建——与 `refreshKey` 行同机制，无新增私有路径。

### 文案删减（用户拍板）

- UP 弹窗「名单列表」desc、RSS 弹窗「添加 RSS 源」「订阅列表」desc 三处灰字删除。

## §2 改动面

| 文件 | 内容 |
|---|---|
| `src/core/ui/setlist.ts`（新） | 组件库工厂 `uiSetlist`：条目 markup/移除行为/空态唯一源 |
| `src/core/ui/types.ts` / `index.ts` | `BzSetlistItem/BzSetlistOpts` + 桶导出 |
| `src/core/ui/components.css` | `.bz-setlist` 变体重构（rows/grid/chips/dense）、移除钮基底、发丝描边、`:empty` |
| `src/core/settings-schema.ts` | list 分支改调 `uiSetlist`；列表行注册 `customRefreshes`；`ListRow.variant` 四值（缺省 chips） |
| `src/settings-panel/renderer.ts` | list 分支改调 `uiSetlist` + 注册 `valueRefreshes`；行宿主 `--list` modifier |
| `src/settings-panel/shared.ts` | 删 `listHtml/listEmptyHtml`（重复实现退役） |
| `src/settings-panel/styles.css` | 删 id 级模仿 CSS；`bz-sp-btn`/input 作用域入组；`--list` 宿主样式；弹窗壳三件保留 |
| `src/core/styles.css` | 删 UP/RSS 弹窗 `.setting-item-description` 死规则 |
| `src/clipbook/ui.ts` | 删三个尺寸记忆设置行 |
| `src/clipbook/news-sources-group.ts` | 删两开关与 cookie 行/灰字；管理弹窗改 `renderPanelSchema`；三处 desc 删除 |
| `prototypes/settings-panel/list-variants.html`（新） | 四布局变体评审页（评审工件，保留作变体参考） |
| `prototypes/**/prototype-behavior.js` 等 | 全量预览产物重出（core 改动影响所有行为包） |
| `docs/ui-kit-manual.md` | uiSetlist 登记（§3.2/§4） |

## §3 测试

- `tests/core/ui-setlist.test.ts`（新，7）：组件契约（缺省 chips/四变体类/条目结构/空态/移除回调）+ 两渲染器同构锁 + 列表行动态更新（两端）。
- `tests/clipbook/news-sources-settings.test.ts`：行型序列更新；显隐联动用例改「常显」断言。
- `tests/clipbook/rss-ui.test.ts`：行型断言更新（无 info 提示行）。
- `tests/core/settings-copy-lint-b.test.ts`：up-manager schema 调用去 cookie 参数。
- `tests/review-fix-b.test.ts`：触控档源头扫描指向 `src/core/ui/setlist.ts`。

## §4 门禁记录

- `pnpm exec vitest run`：294 文件 / 4518 用例全绿。
- `tsc --noEmit`：干净。
- `node scripts/build-preview.mjs`：全量预览产物重出（新鲜度守卫）。
