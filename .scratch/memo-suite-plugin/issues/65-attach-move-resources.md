# 65 — 附件搬移：把当前笔记附件移动到指定文件夹 + 改名去重 + 全库改写链接（新域 attach）

**What to build:** 新域 `attach`，命令 `bz-attach-move`（中文名「移动附件」，icon folder-down）：
1. 解析当前笔记引用的全部 vault 内非 .md 文件（wikilink 嵌入 + Markdown 链接）。
2. 自绘文件夹选择弹窗（记忆上次 `attachLastFolder`，运行时字段不暴露设置页）→ 移动到目标文件夹。
3. 同名冲突：仅当目标文件夹已存在同名文件时才改名（`原名 (N).ext`）；已在目标文件夹的跳过。
4. 链接改写：全库所有引用被移动附件的笔记同步改写（保留 `!` 嵌入 / `|别名` / `#标题` / `^块` / 显示文字）；含糊引用保守不改写、当前笔记同目录优先就近命中。
5. 行为：不删空目录、无预览确认直接执行 + 结果 toast（移动 / 改名 / 改写处数）。
6. 主页磁贴自动播种：main.onload `ensureAttachSeed` 幂等，desktop+mobile 各 `placeAtEnd` 末尾追加 1×1，写 launcher.json（失败静默）。

**Status:** done

## 变更面

- `src/attach/data.ts`（纯逻辑：parseLinkRefs / buildLinkFromRef / resolveTarget / collectResources / planMoves / planRewritePairs / applyReplacements）
- `src/attach/ui.ts`（FolderSelectModal 自绘 DOM 弹窗 + runMove 编排 + moveAttachments 命令入口）
- `src/attach/index.ts`（openAttachMove + ensureAttachSeed 播种 + ATTACH_COMMAND_ID）
- `src/main.ts`（import + COMMANDS 表加 bz-attach-move + onload 播种）
- `src/settings.ts`（BzSettings.attachLastFolder：运行时记忆，不暴露设置页）
- `styles.css`（bz-attach-* 弹窗样式）
- `tests/attach/data.test.ts` + `ui.test.ts`；`tests/smoke.test.ts` EXPECTED_COMMAND_IDS 登记
- 文档：spec.md（命令清单 + 决策条目）、CONTEXT.md（附件/附件搬移/链接改写术语）、ADR-0014

## 决策要点

- vault.rename + 自研链接改写（不用 fileManager.renameFile）——见 ADR-0014
- 链接新目标 = 新文件夹限定库内路径；含糊引用（库内多同 basename 且非笔记同目录）保守不改写
- 无预览确认、不删空目录（用户决策）
- 主页磁贴自动播种 desktop+mobile（用户决策）

## 测试

- tests/attach/data.test.ts（20）：解析/构建/链接解析/收集/去重规划/改写规划/应用替换
- tests/attach/ui.test.ts（7）：runMove 全流程 / 同名冲突 / 无资源 / 已在目标 / 命令入口守卫 / 弹窗交互 / 播种幂等
- smoke 登记裸注册 + 回调冒烟