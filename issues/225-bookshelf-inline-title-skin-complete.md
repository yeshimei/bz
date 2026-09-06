# issue 225：书库头行行内标题 + 十肤全量补全 + 设置预览重画

日期：2026-09-06　域：bookshelf　ADR：无（沿用 ADR-0095 两层皮肤范式与 ADR-0096 书脊墙决策，本次为补全与修订，不立新 ADR）

## 用户拍板（grill 五问）

1. **木匾刊头不删了改小**：变行内标题，与统计标签行**同行居左**；标题「书脊墙」→「**书库**」；
   副标「SPINE WALL · 以书脊读一座书房」随之删除（截图对照原型确认布局）。
2. **分类卡轻缩一档**：去 `min-width:110px` 随内容收缩、计数 14→12px、副文 11→10px、
   内边距 8×14→4×10、图钉 9→7px；**保留**图钉+微旋转纸标造型；状态标签不动。
3. **皮肤全量对齐原型**：issue 218 换血把皮肤结构层全删只剩 token 层 → 逐肤自
   `.zcode/ui-prototypes/bookshelf-10/build-themes.js` 移植结构层（墙纹理/书脊做法/书挡/隔板/
   检索框/排序选中态/标签/墙尾格言随肤）；dark 补 `--bsw-*` 墙变量映射（曾为 0 条）；
   类名映射 body→.bz-bs-wallpage、spine→.bz-bs-spine、tag-label→.bz-bs-taglabel 等。
4. **设置页预览重画**：30 条 `.bz-skinprev-bs-*` 曾被 ee83305 删光致预览透明空壳 →
   重画 10 张（墙纸渐变 + 双迷你书脊签名元素），顶层全局作用域（同 todo 预览范式）。
5. 标题色随肤：新增 `--bsw-title`（十肤各一，浅墙肤用墨色、深墙肤用铜金/霓虹色）。

## 实现

- `src/bookshelf/ui.ts`：木匾块 → `.bz-bs-header`（`.bz-bs-title`「书库」+ 标签行同容器）；
  报告返回钮 title「返回书脊墙」→「返回书库」。
- `src/bookshelf/styles.css`：
  - 头行区重写；分类卡轻缩（见上）；`.bz-bs-view { flex:1; min-height:0 }` 补墙体填满
    （218 时代靠标签行 flex:1 意外兜底，头行改造后需显式声明）；
  - 九肤结构层 + dark 映射 + `--bsw-title` ×10；设置预览 20 组伪元素规则 + 公共迷你书脊壳；
  - 移动端块同步（木匾规则→头行/标题；dim-cat 移动端不设 min-width）。
- `src/bookshelf/constants.ts`：删死常量 `SIDE_DEFS`（零引用）；死规则 `.bz-bs-label` 删除。

## 测试与门禁

- `tests/bookshelf/ui.test.ts`：头行断言换新（标题「书库」+ 木匾不存在断言）；
  新增「皮肤全量补全」守护用例（源文本断言：十肤预览+迷你书脊壳、`--bsw-title`×10、
  九肤结构层盖到 `.bz-bs-spine`/`.bz-bs-seg button.on`、dark 有 `--bsw-wall`、`.bz-bs-plaque` 不复活）。
- vitest 全量 4183/4183 绿；`tsc --noEmit` 干净。
- 视觉自检：worktree `.scratch/skin-harness.html`（复刻面板 DOM 挂真域 CSS）十肤 headless
  截图逐一核对原型；`prev-harness.html` 预览卡 10 张核对——全部对齐。

## 后续可选

- 分类卡「N 册 · X 时」副文在更小档位可考虑仅 hover 展示（未拍板不做）。
- P1/P2/P3/P5-P10 等异构原型（目录柜/周报/终端等）非 CSS 皮肤可承载，仍属独立版式构想。
