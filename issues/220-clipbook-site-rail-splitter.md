# issue 220：剪藏本 rail 按 site 分组 + 中右栏分割线 + 拖拽误关闭修复

用户四连需求（2026-09-06）：

1. 剪藏本左侧列表按 `site` 属性分类（替代 issue 206 平台聚合行）。
2. 中间分割线可拖动，调整中栏与右栏阅读区宽度。
3. 窗口自由调整大小，参考待办（核实：SE 热区缩放 + 尺寸记忆已在 enh 包 8 交付，
   用户实际被第 4 条 bug 劝退）。
4. 缩放拖拽中鼠标移到遮罩上松开 → 终端 click 落遮罩 → 误关闭窗口。

## 方案

### A. rail 按 site 分组（数据层 + UI）

- `store.ts`：`aggregateSites(articles, clipNotes, savedUrls, clipUrls)` 纯函数——
  全库站点行（剪藏全量 site + 未读 news 面 site；已存 news 骨架不计，防与剪藏重复），
  排序：总数降序 → 未读降序 → 名 ascending；空 site 归「未知」。
- `queryBySource` 新增 `{ kind: 'site', site }` 源：未读 news（剔除 saved 命中）+ 该站剪藏全量，
  时间降序；中栏桌面维持未读在前稳定排序。
- `types.ts` `RailKind` + `state.ts` `ClipSourceSel` 扩 `site` 维度；`toggleSource` 再点回全部同口径。
- `ui.ts`：rail「PLATFORM 平台」标签改「SITE 站点」，平台行 → site 行（徽标色按站名哈希，
  编辑部皮肤本就隐藏徽标）；B站 UP 子行、剪藏本聚合行保留；移动源胶囊同源对齐。

### B. 中右栏分割线（组件库新工厂）

- `core/ui/splitter.ts`：`uiVSplitter({ left, right, minLeft, minRight, persist })` →
  `{ el, flush, detach }`；拖动写 `left.style.width`，右栏弹性吸收；防抖 300ms 落盘同 uiResizable。
- `components.css`：`.bz-vsplit`（6px 竖条，col-resize，hover/拖拽态，触屏隐藏）。
- 设置键 `clipbookMidWidth`（0=未拖过走 CSS 默认 360px）；设置页基础组加「目录栏宽度记忆」行。

### C. 拖拽误关闭修复（core 级，全域受益）

- `core/dom.ts`：`swallowNextClick()`——capture 一次性吞掉拖拽终端 click，
  下次 mousedown 撤防（防 click 未触发时误吞正常点击）。
- `core/ui/resize.ts`：`onMouseUp` 接入——todo/剪藏本/保险库等「缩放热区 × 点遮罩关闭」全修复。
- `uiVSplitter` 拖拽结束同防（防终端 click 误触 rail 行/条目卡）。

## 验收

- rail 出现全库 site 行（果壳/果壳科学人/微信公众号/知乎…按真实数据 16+ 行），计数 = 未读/总数，
  搜索态 = 命中数/总数；点击行 → 中栏 = 该站未读流 + 剪藏；再点回全部未读。
- 拖动分割线：中栏宽度即拖即变，重开面板记忆恢复；移动端不受影响。
- 拖窗口右/下/角缩放，鼠标压遮罩松手：不再关闭；正常点遮罩关闭保留。
- 测试：aggregateSites / queryBySource site / uiVSplitter 结构与拖拽 / swallowNextClick；
  全量 vitest + tsc --noEmit 绿。
