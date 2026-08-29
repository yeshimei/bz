# Ticket 138 — 文献盒 UX 修复与增强（用户实测反馈）

> 基于 ticket 136 交付后的真实使用反馈。契约变更点用 ⚠️ 标注，必须落实。

## 1. 硬 Bug（必须修）

### 1.1 ⚠️ instanceof 报错（已定位根因）
- **症状**：选中文字后触发 `bz-literature-note-term` 命令，打开术语面板时报
  `app.js:1 TypeError: Right-hand side of 'instanceof' is not an object`。
- **根因**：`src/literature/index.ts` 的 `openTermNote` 用了
  `app.workspace.getActiveViewOfType('markdown')` —— Obsidian 内部实现是 `view instanceof type`，
  传**字符串**导致右侧非对象抛 TypeError（测试 mock 掩盖了这一点）。
- **修复**：改用 `getActiveViewOfType(MarkdownView)`（从 `obsidian` 导入 `MarkdownView` 类），
  再取 `view.editor.getSelection()`。注意类型/空判。

### 1.2 主面板要点两次才打开
- **症状**：`bz-literature-open` 命令第一次点击没反应，第二次才打开主面板。
- **待查**：可能是 `ensureLiterature` 首次调用 `new UIManager(app)` 时某处抛错被吞，
  或 UIManager 构造（createMainUI 等）与 showMain 之间有未捕获异常，或命令回调时机问题。
  需子代理调查根因（对照其他域 ensureXxx + showXxx 的打开流程，如 review/movie），修复后应单击即开。

### 1.3 ⚠️ 打开主面板时 backfill 卡住（已定位根因）
- **症状**：打开主面板，只对一个文献笔记做了领域补全，然后就没反应。
- **根因**：`note-gen.ts` `backfillNotes()` 对缺 domain 的笔记**逐个串行** `await ai.json()`，
  **无超时**。第一个成功后第二个调用挂起（网络/API 慢）→ 整批永停。
- **修复**：给 AI 调用加超时（建议单次调用超时上限，超时或失败即跳过该条并继续）；
  或改为分批/并行 + 失败不阻塞。至少保证「一条失败/超时不卡死整批」。

## 2. 术语流程契约变更 ⚠️

### 2.1 未点确认就落盘笔记
- **症状**：录入术语文字，点「生成」后还没点「确认写入」，文献盒里就已经出现笔记文件。
- **用户明确要求**：预览阶段**不得**在文献目录写笔记；只有点「确认写入」才真正落盘。
- **现状**：`generateTermNote()` 现行为即写盘，ui.ts 生成/重新生成都调它 → 会短暂落草稿文件。
- **修复方向（二选一，推荐 A）**：
  - A：`note-gen.ts` 新增**纯 AI 生成接口**（不写盘，返回 `{summary, domain}`），供预览；
    确认写入时才调落盘版 `generateTermNote`（只落一次，用户改过的术语/领域/正文用写入版应用）。
  - B：`generateTermNote` 加 `preview` 选项不写盘。更啰嗦，推荐 A。
- **连带**：ui.ts 术语面板「生成/重新生成」改走纯 AI 预览；「确认写入」走落盘版；
  预览面板里用户手改的领域/正文在确认时生效；无预览直接确认 → 提示先生成。
  相关测试同步改（ui.test.ts 术语流程 + note-gen.test.ts）。

## 3. 主面板 UI 调整（用户明确要求）

### 3.1 右上角按钮
- 文字录入、视频录入两按钮改用 **emoji**（不要中文文字按钮）。
- 搜索 emoji 按钮放到**设置按钮前面**（按钮秩序调整）。
- **去掉**「全部/视频/术语」类型分类栏（`#literature-typebar` 整行移除，相关筛选逻辑可留作死代码或一并清理，但 UI 不再展示）。

### 3.2 列表去掉视频徽章
- 文献笔记卡片上的**类型徽章（视频）**去掉（`bz-lit-badge-type` 不再显示「视频」）。

## 4. 布局/样式对齐日记本（用户：现在太简略）

- 用户要求**严格对比面板标签列表和日记本之间的布局和样式的差异**，文献盒主面板现在太简略。
- 参照系：`src/diary/ui/panel.ts` + `src/diary/styles.css`（diary 的标签筛选行、条目卡片、
  头部、间距、hover、滚动条、移动端适配等都是成熟样式）。
- 要求：文献盒主面板的**领域筛选行、搜索框、笔记卡片、头部按钮、间距、圆角、hover 态、
  空态、滚动条**等视觉细节对齐日记本的质感，不简略。
- 注意铁律：样式只写 `src/literature/styles.css`（`bz-` 前缀），不内联视觉样式。

## 5. 交付要求

- 全绿门禁：`pnpm exec tsc --noEmit` + `pnpm test`（子代理**不跑**，留给上级集成验证）。
- 测试同步：data/UI/术语流程/backfill 相关测试必须覆盖新行为（含 1.1 选区预填、1.3 超时继续、
  2.1 未确认不落盘）。
- 只改 literature 域相关文件，不触碰其他域。

## 6. 已知遗留（本轮不处理，仅记录）
- `LOCAL_CLI_CANDIDATE` 硬编码绝对路径（tools 已入 master，待后续稳定改全局 bili-dl）。
- smartcat behavior-wording 的 `ACTION_WORD_LABELS` 可能缺 term-generated/converted 标签（纯文案）。
