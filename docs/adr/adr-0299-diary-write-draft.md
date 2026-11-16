# ADR-0299 · 写日记草稿按库同步落 localStorage，强杀重开接着写

日期：2026-11-15 · 状态：已采纳 · 关联：ADR-0233（书内写作页）、ADR-0270（数据根）、issue 566

## 背景

ADR-0233 把「写日记」从弹窗换成书内的一张纸。纸上有字时收起整本，`requestClose()` 会问
「接着写 / 先收着 / 落笔」，选「先收着」后 `hide()` 不销毁 `.bz-diary-wsp`，下次翻开还是这张纸。
这套「草稿」的载体是**进程内的 DOM**：

- 正文只在 `textarea.value`，不进 `draft` 状态（当时刻意避免两份真相）；
- `cleanup()` 把 `draft` 置空并 `root.remove()`，插件卸载 / 强制关闭 Obsidian 时字全部消失；
- `src/diary/` 里没有任何草稿落盘，也没有可抄的域内先例。

用户 2026-11-15 报：「避免强制关闭 obsidian 导致内容丢失」。

## 决策

1. **同步写 localStorage，按库分键**。新增 `src/diary/draft-store.ts`：键
   `bz-diary-write-draft:<vaultKeyOf(vault 路径)>`，空路径退裸键（同 `core/setup-state.ts` 口径）。
   localStorage 是 Obsidian 整个应用共用的，不分键会让 A 库的草稿冒到 B 库。
2. **写入时机只挑同步可达的四处**：输入停顿 800ms（防抖）、改日子时辰 / 贴纸、收起整本 `hide()`、
   插件卸载 `cleanup()`。强杀进程没有卸载回调，所以主力是输入防抖那一次；最坏丢 800ms 内的字。
3. **存的形状**：`text` 原文（不 trim，留住换行与行尾空格）、`date` / `time` / `tags`、
   可选 `edit`（`filePath` / `lineNumber` / `expectContent` / `originalTags` / `whole`）、`savedAt`。
   有 `edit` 才是「改字」态，恢复后原地替换，不新增一条。
4. **有正文才写，落笔 / 揉掉 / 新开空纸 / 改字即删键**。草稿是临时态，不留长期副本；
   读侧对坏 JSON、空正文、缺字段、改字信息不全一律当没草稿并删键。
5. **重开时 `show()` 先摊回这张纸**，放在读册 / 成册之前，不依赖快路；内存里已有 `draft` 时不让
   磁盘旧稿盖掉。`openWrite()` 命令若撞上恢复出来的纸，沿既有 `startWrite()` 语义提示并聚焦。
6. **存储不可用静默降级**：隐私模式 / 配额满时 `getItem/setItem/removeItem` 抛错一律吞掉，
   回到「只在内存里保着」的旧行为，不打断写字。

## 代价与边界

- 草稿是**明文**，且不跟库同步（localStorage 在应用侧）。日记条目的加密由写层 / 保险库负责，
  这里不另造一套，也不把草稿混进 vault 数据文件。加密分类册里没有「写作中」这回事，
  所以不产生「明文尾巴落在册子里」的新面；但用户若把整台机器的应用数据当敏感面，需要自己知道这一点。
- 不做多槽草稿：写作内页本来就是单张纸（有 `draft` 时连「写」都不让再开一张），
  多槽只会把「哪张是当前那张」变成新的状态问题。
- 没选数据目录 json：`core/storage` 的通道是异步的，卸载那一拍等不到；这是「强杀不丢字」的硬约束。
- `cleanup()` 里 `persistDraft()` 遇到 `draft === null` 直接返回，绝不拿空态把上一轮的稿子清掉
  （重启后新控制器还没摊纸就被卸载，是很常见的一拍）。

## 验收

`tests/diary/draft-store.test.ts`（纯数据层）与 `tests/diary/ui-book.test.ts` 的三条控制器回归；
`test-domain diary` 556 用例、`test-affected --since master` 10272 用例全绿。
