# 336 · 知识盒×剪藏引用同步包：删除降级 / 摘除 / JSON 路径 file-sync

- 状态：实现中（2026-09-16，用户对 issue 335 审计报告拍板「全部修复」；本工作树 = 审计#1 尾巴 + #3/#4/#6）
- 关联：issue 335（改名断链已修）、issue 329 / ADR-0144（保存物化回写 source）、ADR-0116、memo file-sync 范式

## 背景

审计（2026-09-16）确认：插件侧文件变更后，持路径引用的 knowledge 数据无同步。
本包补齐知识盒/剪藏两个域的四条同步链路。

## 改动设计

### 1. 剪藏删除 → 知识盒 source 降级回外链（ADR-0144 的逆向，ADR-0149）
- `deleteClipNote`/`deleteNewsItem` 删除流（clipbook/ui.ts:1165 vault.trash 附近）trash 前：
  读剪藏 frontmatter `url` → 对知识盒目录内所有 frontmatter `source` 为内部双链且指向该
  剪藏路径的卡片，行级改写 `source` 为 `quoteYaml(url)`（`sourceTitle` 零扰动，即回到物化前
  两态）。剪藏无 url → 改调摘除（同 2 的行级手术）。
- 通知合并或独立一条：「已把 N 张知识卡片来源回退为原链接」（正文无 emoji）。

### 2. knowledge md-deleted 消费者 → 摘除断链 source
- knowledge 域新增 `vault:md-deleted` 消费（经 core/obsidian-adapter 域事件总线）：
  被删 md 若被卡片 source 内链指向（覆盖影院笔记、用户经 Obsidian 删除等一切路径），
  行级摘除该 `source` 行（`sourceTitle` 保留），合并通知。路径1已降级的卡片天然幂等跳过。

### 3. knowledge.json 路径 file-sync（仿 memo/file-sync.ts：域事件订阅 + 去抖 + 写 JSON）
- `vault:md-renamed` → 更新所有 task 的 `notePath`/`videoPath`。
- `vault:md-deleted` → notePath 置空/剔除（读 data.ts 结构与 UI 容错后取最小惊讶方案，
  UI 对空路径不得炸）。

### 4. clipbook.json 路径 file-sync（同范式）
- `vault:md-renamed` → 更新 `marks[][].notePath` 与 `pendingSource[][]`。
- `vault:md-deleted` → 剔除指向被删文献笔记的 marks 条目与 pendingSource 项（划词文本
  保持纯文本不挂链），防物化时 anchor 写未解析链接 / upgrade 静默失败（审计#4）。

## 行级手术边界

source 改写/摘除沿用 `upgradeSourceLine`（knowledge/source.ts:139）口径：只动 source 一行、
换行符保真、幂等；不改整体重序列化。扫描卡片范围 = knowledgeDir 目录内 md
（dir 解析复用域内现有逻辑），frontmatter 读取走 metadataCache（避免全量读文件）。

## 测试

- 数据层：source 降级/摘除/幂等/换行保真；knowledge.json 与 clipbook.json 的 renamed/deleted 同步。
- 集成：删除流 trash 前降级（mock vault + 域事件总线，参考 tests/memo file-sync 测试先例）。
- 门禁：`pnpm exec tsc --noEmit` + vitest（preview-freshness 为并行会话既有红，排除；
  其余不得有新增失败）。严禁在 worktree 内 build。

## 不做

- 撤销重建（ui.ts:1180）后的 URL→内链逆向重升级（回到物化前态可接受）。
- 正文任意 `[[剪藏]]` 双链的扫描改写（只管插件自管的 source 结构引用）。
