# ADR-0014 附件搬移——链接更新交给 Obsidian 内建 fileManager.renameFile

状态：已实现（bz，ticket 65，v2 修正）
日期：2026-08

## 背景

「附件搬移」命令（`bz-attach-move`）把当前笔记引用的全部 vault 内非 .md 文件移动到用户选定文件夹；仅当目标文件夹存在同名文件时才改名（`原名 (N).ext`），并同步更新全库引用它的链接。

**v1 实现**：为可单测与自定义命名，选 `app.vault.rename` + **自研全库链接改写**（解析所有 md 笔记内容 → 生成替换对 → 逐个 `vault.modify` 写回）。

**用户实测反馈**：点击移动后 Obsidian 长时间卡顿。根因：
1. 全量读取 + 解析所有 markdown 笔记内容（大库 IO/CPU）；
2. 每个被改写笔记一次 `vault.modify`，Obsidian 都要重建 metadataCache / 反链图并刷新相关视图，多个笔记顺序触发叠加卡顿；
3. 重实现了 Obsidian 内建的链接调整逻辑，行为与内建不完全一致（含糊引用消歧等）。

Obsidian 内建 `App.fileManager.renameFile(file, newPath)`：移动文件的同时自动更新全库指向它的内部链接（文件管理器重命名「更新链接」的底层实现），增量、批量化、按 Obsidian 自身消歧规则处理。

## 决策（v2 反转）

1. **移动与链接更新一律走 `app.fileManager.renameFile(file, toPath)`**；删除 v1 自研全库改写引擎（buildLinkFromRef / planRewritePairs / applyReplacements）。
2. **自研纯函数仅保留「收集」与「命名」**：
   - `parseLinkRefs` / `resolveTarget` / `collectResources`：从当前笔记内容解析出它引用的附件（非 .md）路径；
   - `planMoves`：按「仅目标文件夹存在同名才改名」算出无冲突 `toPath`（`原名 (N).ext`），作为 renameFile 参数。
3. **回退**：异常环境无 `fileManager` 时回退 `app.vault.rename`（不更新链接），warning 通知「链接未自动更新」。
4. 其余不变：文件夹选择弹窗、记忆 `attachLastFolder`、不删空目录、无预览确认、结果 toast、主页磁贴自动播种（desktop+mobile 各 placeAtEnd 末尾）。

## 权衡

- **fileManager.renameFile vs v1 自研改写**：内建方案增量且正确（消歧/别名/最短路径），彻底消除全库扫描 + 逐笔记 modify 的卡顿；代价是链接更新行为不可单测（Obsidian 内部）——本 ADR 接受该代价，把正确性交给 Obsidian 内建。
- **自研解析仅留收集/命名**：仍为纯函数可单测，覆盖 Obsidian 内部不可见的上层决策。

## 已知限制

- 含糊引用消歧不再由插件判断：Obsidian 的 renameFile 按其自身规则处理（多数场景比自研更准确）。
- 无 fileManager 的回退只移动、不更新链接（生产环境不发生）。