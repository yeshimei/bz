# 566 · 写日记：关闭确认框风格不对 + 强关 Obsidian 内容丢失

- 状态：已交付（2026-11-15，worktree `.dsh-worktrees/diary-draft`，memo `item-1794707500591-qyof20`）
- 提出：2026-11-15 用户反馈「写日记有内容关闭二次确认弹窗风格和日记本一致」「写日记随时保存为草稿，
  下次打开继续。避免强制关闭 obsidian 导致内容丢失」

## ① 确认框掉回 core 裸壳

`ui.ts::requestClose()` 的 `openFlowDialog` 没传 `className`。域内其余五处（加解密、全部解密、
正文冲突、删除）都传了 `bz-diary-flow-dialog`（`src/diary/styles.css:1441`，桌角撕下来的一角纸），
只有这一处漏了。补一行即可，样式本身早已就绪。

## ② 「先收着」不是真的留草稿

原实现只在同一个进程里保命：`hide()` 不销毁 `.bz-diary-wsp`（它在书壳内、不被 `lockOnHide()` 清掉），
正文仍在 textarea 的 DOM 里。但 `cleanup()` 会把 `draft` 置空、`root.remove()`；
强制关闭 Obsidian / 插件卸载一到，字连 DOM 一起没了。日记域此前**零草稿持久化**。

修法见 ADR-0299：新增 `src/diary/draft-store.ts`，按库分键同步落 `localStorage`；
`ui.ts` 在输入停顿 800ms、改日子时辰 / 贴纸、收起整本、插件卸载四处落盘，
`show()` 先摊回草稿，「落笔 / 揉掉 / 新开空纸 / 改字」立刻删键。

## 为什么用 localStorage 而不是数据目录 json

强杀进程时只有**同步**写盘来得及；`core/storage` 的 json 通道是异步的，卸载那一拍可能还没落。
草稿是临时态、按库分键、不进册子数据文件，也不参与加密写层；存储不可用（隐私模式 / 配额）
一律静默降级回旧行为，不让写日记崩掉。

## 验收

- `tests/diary/draft-store.test.ts`（5 例）：按库分键、往返逐字段、正文不 trim、脏数据自愈、
  改字信息不全整份作废、存储抛错静默。
- `tests/diary/ui-book.test.ts` 追加 3 条：确认框带皮肤类、强杀重开字与日子时辰贴纸都在、
  落笔后清键且重开是空纸；`beforeEach` 清 localStorage 防跨用例串稿。
- `node scripts/test-domain.mjs diary` → 30 文件 / 556 用例全绿；`tsc --noEmit` 干净。
- 合并前 `node scripts/test-affected.mjs --since master` → 691 文件 / 10272 用例全绿。
