# 570 · 写日记：回车换行回看变成一整段 + 写作页方向键「不能移动光标」

- 状态：已交付（2026-11-16，worktree `D:\Obsidian\bz-wt-diary-newline`，分支 `fix/diary-newline`）
- 提出：2026-11-16 用户反馈（B 站私信截图）「再次查看之前写的日记，发现换行效果没有显示出来，
  变成一个大自然段」「写日记时发现前面打错了一个字，但光标必须用鼠标点到那个字的后面再退格，
  左右按键不能移动」

## ① 换行被吞成一大段

存储侧没问题：落笔只 `trim()` 首尾，正文里的 `\n` 原样写进 md（`serializeDiaryEntryFile` /
`serializeLegacyBlock` 都是）。问题在册页排版：`render.ts::splitTextBlocks` 把同一段里的
连续非空行 `join('')` 无缝拼成一句（原型 `.scratch/diary-quill/app.js` 的沿袭），
`paraHTML` 又不认换行符——两层叠加，回车换的行在纸面上彻底消失。

修法：

- `splitTextBlocks` 拼回 `\n`（空行仍归 `pendingBlank` 分段，段距规则不变）；
- `paraHTML` 在 `inlineMd` 之后把 `\n` 落成 `<br>`（引用块早就是这个口径）。

不改磁盘上的 md：用户在 Obsidian 原生阅读里看到的单换行折叠，是 Obsidian 的「严格换行」
设置，不是日记本吞的。

## ② 写作页左右键不能移动光标

真机（独立 Obsidian 实例 + CDP 真实按键）复现结论：**焦点在正文输入框里时，左右键完全正常**
（caret 2→1→2，真实键盘事件，不是合成事件），bz 代码没有拦截 textarea 的方向键
（`onKeydown` 早退 + 阅读器 / 灯箱 / 步骤器都放过输入框）。

但查实一条真实副作用：写作内页摊着时，焦点一旦掉到纸边（点日戳 / 贴纸 / 纸面空白都会
让正文失焦，`document.activeElement` 变 body），再按左右键会走 `onKeydown` 的翻页分支
——纸盖着书，翻了看不见，用户看到的就是「方向键没反应、光标不动」。

修法：写作内页可见时，方向键不再翻背面的书；焦点不在正文就先还给正文（其余键照常交给
当前控件，不抢「落笔」按钮的 Enter）。

## 验收

- `tests/diary/render.test.ts`（新增 10 例）：单换行 / 三行 / 空行分段 / 混排 / 空行上限，
  以及 `entryBlockHTMLs` 里 `<br>` 落点与引用块回归。
- `tests/diary/ui-book.test.ts` 追加 1 例：写作页摊着时方向键不翻底书、点过纸边后
  先回正文；焦点在正文里时不拦按键。
- `node scripts/test-domain.mjs diary` → 31 文件 / 570 用例全绿；`tsc --noEmit` 干净。
- 真机（obs-test 独立实例，1024×800）：15 日旧日记的三行各自成行、空行后「第四段」独立；
  写作页 blur 后按 → 焦点回正文、书没翻、caret 正常移动。
