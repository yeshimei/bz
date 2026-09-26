# 313 图版多图 + 正文顺序 + 图片目录可配

- 状态：完成（2026-09-14 原型评审第二轮，待合并主仓）
- 关联：issues/312（图版入口）/ issues/311（AI 多模态通道）/ ADR-0136（图版）/
  `src/knowledge/note-gen.ts` / `src/knowledge/ui.ts` / `src/settings.ts` / `prototypes/knowledge/`

## 背景

用户 2026-09-14 在图版（issues/312）落地后提出四点调整：

1. 入口：图版放到影像后面——随后**复核改口为影像之前**，已改（入口顺序现为 名词 / 段落 / 图版 / 影像）；
2. **支持多张图**（一次录入可为「一组图」）；
3. 笔记里**文字在上、图片在下**（原实现是图片在上、解读在下）；
4. **图片放到哪里由用户在设置里定**。

## 交付

### 多图（面板侧）

- [x] `entryImage`（单张）→ `entryImages`（数组，含 `mime` / `bytes` / `dataUrl`），
  **顺序 = 放入顺序 = 笔记里的图片顺序**；上限 `IMAGE_ENTRY_MAX = 9` 张（超出的不发、提示一次）。
- [x] 三条收图路都支持多张：拖入（`dataTransfer.files` 全部）、点选（`<input multiple>`）、
  粘贴（`clipboardImageFiles` 改收集数组，`items` 优先、`files` 兜底）。一批里不合规的那张只跳过它，
  其余照收（原来整批只处理第一张）。
- [x] 图片行改**缩略图网格**：`.bz-lit-drop-grid` + `.bz-lit-drop-item`（等宽自适，每张右上角 ✕），
  hint 随状态变「已放 N 张 · 继续拖入 / 粘贴，或点此添加」。删除走**事件委托**（网格每次重建，
  逐个挂监听会漏）。旧类 `.bz-lit-drop-thumb` 退役。
- [x] `removeEntryImage(i)` 删单张；**加图与删图都作废旧草稿**（`draftInvalidate()` 单一出口：预览收起、
  生成钮复位、关联行归位）。原来「换图」语义（点缩略图替换）自然消失——多图下点图 = 选择器添加、✕ = 删除。
- [x] 新增 `draftInvalidate()`：把「图组 / 输入变了」的失效处理收成一处，避免各处零散改字段。

### 多图（数据侧）

- [x] `generateImageDraft(imageUrls: string[])`：一次把全部 data URL 投给多模态模型（不拆请求）；
  提示词按张数分叉——单图仍是「看这张图片」，多图「看下面这 N 张图片，把它们**作为一组**生成一篇文献笔记」，
  summary 要求「先说这组图共同在讲什么，再按图交代各自可见的内容」。
- [x] `generateImageNote({images: Array<{bytes, ext}>})`：逐张 `writeUniqueBinary`（各自判重、永不覆盖，
  传入顺序即笔记里的嵌入顺序）；**一张都没有 → 抛错不落盘**（空笔记比拒写更糟）。
- [x] **正文顺序改为「文字在上、图片在下」**（用户拍板）：`[frontmatter, summary, ...嵌入]`。

### 图片目录可配

- [x] 新设置键 `knowledgeImageFolder`（`settings.ts` 类型 + DEFAULT 空串）。
- [x] `resolveImageDir(settings)`（note-gen 导出，纯函数）：非空则完全以它为准（两侧斜杠归一），
  留空回落到 `<文献目录>/assets`。
- [x] 设置面板「目录与分类」组新增 path 行「图版图片文件夹」，带 `fallbackValue`
  （空值时 chips 区显示**实际生效目录**，同书库先例，不让人猜）。

### 原型壳

- [x] 示例图 `loadDemoPlate(count = 1)` 可一次造多张（逐张换配色与题字，缩略图并排分得清）；
  「载入示例图」按钮可连点（title 说明）。
- [x] AI 罐头正则兼容新提示词（`看这张图片|看下面这 N 张图片`），多图回包标题写「N 张图的内容整理」，
  summary 报出实际收到的张数（自检据此断言「多图确实发到 AI 层」）。

## 不做 / 待定

- 不拆批请求：一次录入的一组图就是一篇文章（用户要的是「一组图合成一篇」，不是一图一文）。
- 不做客户端压缩 / 缩放；单图 ≤32MiB 仍由 `core/ai` 拦（上限 9 张是**张数**闸，不是体积闸）。
- 不做图组排序拖拽（顺序 = 放入顺序）；要调整顺序就删掉重放。
- 不做「从文库已有图片里挑」（同 issues/312）。

## 验收

- `pnpm exec tsc --noEmit` 0 错。
- `tests/knowledge`：多图面板（一次进两张 + 追加第三张 → 生成收全部 data URL → 写入 `images` 三项且
  扩展名顺序一致）、混批跳过非法项、加图 / 删图作废草稿、上限 9 张、加图与删图都解按钮闸门、
  粘贴多图；`note-gen`：单图 / 多图提示词分叉、空图拒发、逐张落盘 + 嵌入顺序 + 全在文字之后、
  `resolveImageDir` 四条回落规则 + 目录改后嵌入随变、无图拒写。
- 原型自检 `prototype.html?selftest=1` → **SELFTEST OK 42/42**（新增：一次 drop 两张、「已放 2 张」报数、
  每张带 ✕、✕ 删一张后只剩一张、再补一张回到两张、回包报出 2 张、
  正文两张图都渲染成 `<img>`、正文顺序「文字在上、图片在下」）。

## 整体 review 修复（2026-09-14，Standards/Spec 双轴 sub-agent 审查）

- [x] 图版缩略图移除钮 `✕` 字面 → **lucide `x`**（`iconSpan('x')` + innerHTML 重建后 `mountIcons(grid)`；
  评审壳图标白名单补 `"x"`）——对齐「界面图标一律 lucide」（CONTEXT 知识盒域规约）。
- [x] `litKindLabel` / `litKindPlain` 双份四类映射 → **合一派生**（plain 为源，label = 每字加空格）。
- [x] `pipeline.ts` 头注释残留已删的「issue 298 生成即跑经 knowledge:tasks」描述 → 清理。
- [x] 文档尺寸对齐：处理面板实际 `660×480`，ADR-0135 / issue 310 初稿误记 `680×520`。
- 记债不动（评审期不做结构性重构）：knowledge 域自 ADR-0112 起 markup 就写在 ui.ts（域内无 render.ts，
  也无 render-purity 门禁），本次两处新增 innerHTML 延续既有模式；`parseRelatedNames`（frontmatter
  related 解析）位置偏 UI 层。两笔都是「ui→render / ui→parser 拆分」级别的既有债务，建议单开 issue 处理。
