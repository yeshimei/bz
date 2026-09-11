# issue 275：文献预览正文重复渲染（渲染前清空 + 兜底判定重写）

日期：2026-09-11 ｜ 用户拍板（一句话需求）：文献笔记内容重复了两遍，只需要使用 Obsidian 的内部渲染即可，不要调整笔记内容的位置 ｜ 关联：ADR-0122（渲染器追加语义契约）、issue 273（剪藏正文 MarkdownRenderer 化先例）

## §1 缺陷与真因

实测现象：知识盒「部壹 · 文献」点开视频文献 → 「文献预览 · 影像」弹层里同一段正文出现两份，中间隔着 `![[…mp4]]` 的字面文本与一份真播放器。

真因（单一成因，非拼接、非开两次）：

1. 弹层骨架先把整篇正文以**纯文本段落**预填进渲染容器——`src/knowledge/ui.ts:553` 的 `<div class="bz-kb-paras" id="bz-kb-preview-body">${parasHtml}</div>`，`parasHtml` 由 `body.split(/\r?\n\r?\n+/)` + `esc()` 生成（`:530-535`），不识别 `![[…]]` 嵌入语法，故视频以字面文本出现在第一份里。
2. 随后又在**同一容器**上跑真渲染——`ui.ts:563` `MarkdownRenderer.render(this.app, body, bodyEl, n.path, comp)`。Obsidian 该 API 是**追加**语义（类型定义 `node_modules/obsidian/obsidian.d.ts` 写明 `el - The element to append to`），不清空容器 → 第二份（真 Markdown + 原生 `<video>`）叠在第一份之后。
3. 兜底分支是死代码——`ui.ts:566` 判 `!bodyEl.querySelector('*') || !bodyEl.textContent?.trim()`，而预填必然已产出元素与文本，条件恒假，「渲染成功即替换预填」的设计从未生效。

引入时间：`b9e151ba`「正文整段交 MarkdownRenderer」把旧的独立视频槽 `#bz-kb-video-slot` 换成整段渲染时，保留了预填骨架，留下双份。

测试为何全绿：共用 mock `tests/mock-obsidian-entry.ts:48` 是 `el.textContent = md`（**覆盖**语义），原型 fake 渲染器 `prototypes/knowledge/fake/fake-obsidian.ts:138` 是 `el.innerHTML = …`（同样覆盖）——两侧都掩盖了真机的追加行为。

## §2 修法契约

**渲染容器初始为空，正文只由 MarkdownRenderer 产出。**

- 骨架模板改为空容器：`<div class="bz-kb-paras" id="bz-kb-preview-body"></div>`（行内不再内联 `parasHtml`）。
- 取到容器后：`bodyEl.empty()` → 渲染 → 以「是否产出元素」判定成败；失败/抛错才写入 `parasHtml`。
- **空正文分支必须显式保留**：`body` 为空串时现行为是显示 `<p>（无正文）</p>`（`parasHtml` 的 `||` 兜底）。新写法不能因为「不渲染」而让空笔记预览变全白——正文为空时同样写入该兜底。
- 笔记内容一律不动：不拆分、不移动 `![[…mp4]]`，`sourcePath` 仍传 `n.path`（内嵌解析依赖它）。
- `_previewNote`、关联 chips、来源外开链接、关闭路径均不变。

参照实现（同为「渲染前清空」范式的既有写法）：`src/diary/ui.ts:827`、`:834`（渲染前 `container.textContent = ''`）、`src/encrypt/ui.ts:2285`、`src/clipbook/ui.ts:799`（渲染进新建空容器）。

## §3 测试防回归（ADR-0122 第 1 条）

- **共用 mock 改追加语义**：`tests/mock-obsidian-entry.ts:46-50` 改为把 `md` 追加进容器（如包一层 `div` 后 `appendChild`），与真机一致；已核查 `el.textContent` 单次渲染后仍等于 `md`，`tests/secondbrain/ui-tools-extra.test.ts:21` 等既有断言不受影响。其余五处 render 调用点（diary / encrypt / clipbook / secondbrain `ui-tools.ts`）均渲染进新建或已清空容器，改 mock 不会误伤。
- **知识盒预览新增回归断言**：`tests/knowledge/ui.test.ts` 影像文献预览用例中，断言正文标记串在 `#bz-kb-preview-body` 的 `textContent` 里**恰好出现一次**，且 `![[…mp4]]` 只出现一次（双份立即失败）。
- 原型侧（ADR-0122 第 1 条同款要求）：`prototypes/knowledge/fake/fake-obsidian.ts` 的 `render` 由 `innerHTML =` 改追加语义，使「预填 + 追加」在评审壳里可复现。

## 改动清单

- **实现**：`src/knowledge/ui.ts` —— `openPreview` 骨架（:548-555）去 `parasHtml` 内联、渲染段（:559-569）重写为「清空 → 渲染 → 判产出 → 兜底」；`parasHtml` 生成逻辑保留作兜底词，注释改为「渲染失败兜底」。
- **测试**：`tests/mock-obsidian-entry.ts` 追加语义；`tests/knowledge/ui.test.ts` 新增「正文只出现一次」回归。
- **原型**：`prototypes/knowledge/fake/fake-obsidian.ts` 追加语义 + `prototypes/knowledge/prototype-behavior.js` 重出（行为单源产物）。
- **文档**：无 CONTEXT 词条改动（域内可逆修复）；ADR-0122 记录追加语义契约。

## 验收

- [ ] 真机（桌面 + 移动）打开视频文献预览：正文一份、视频在正文原位可播、关闭/ESC 正常
- [ ] 术语文献 / 卡片预览 / 主题预览三类弹层（同一 `openPreview`）均只出一份正文
- [ ] 渲染失败场景（mock 抛错）仍能看到纯文本兜底；空正文笔记仍显示「（无正文）」
- [ ] `pnpm exec vitest run tests/knowledge tests/secondbrain tests/clipbook tests/diary tests/encrypt` 全绿
- [ ] 全量门禁：`pnpm test` + `pnpm exec tsc --noEmit` + 自审 + diff 审查 + 主仓 `pnpm run build` 部署
