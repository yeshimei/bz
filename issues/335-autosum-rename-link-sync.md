# 335 · 自动摘要改名断知识盒来源链：renameToTitle 改走 fileManager.renameFile

- 状态：已实现（2026-09-16，用户报障 + 拍板「修复 + 存量一次性手修」）
- 关联：issue 329 / ADR-0144（保存物化回写知识盒 source）、ADR-0116（术语来源）

## 现场

剪藏保存物化时知识盒卡片 frontmatter 落 `source: "[[归档/网页剪藏/旧名.md|标题]]"`；
随后自动摘要 AI 补全 title 用 `vault.rename()` 改名剪藏——该 API 只搬路径不更新任何引用，
知识盒来源当场悬挂（实证：文献盒/菲尔兹奖.md source 指旧名，剪藏已改名）。

## 修复

- `src/auto-summary/processor.ts` `renameToTitle`：优先 `app.fileManager.renameFile`
  （Obsidian 联动更新全库双链，含 frontmatter 引号字符串内的 `[[路径|名]]`），
  老宿主无 fileManager 回退 `vault.rename`（对齐 attach 域同一范式）。
- 回归测试（tests/auto-summary/processor.test.ts 新组）：mock 层复刻「renameFile 联动改链 /
  vault.rename 裸搬」的语义分叉，断言知识盒 source 与正文双链随改名更新；
  已验证红绿两态（去掉修复即红在 source 未联动）。

## 存量（一次性手修，不入代码）

文献盒/菲尔兹奖.md 的 source 行路径与别名同步为改名后的剪藏文件名；sourceTitle（原网页标题）保留。

## 排查边界

主仓库 master 上 preview-freshness 六项红为既有错位（另一会话重出原型未提交），
与本修复无关；worktree 内除该项外全量测试 + tsc 全绿。
