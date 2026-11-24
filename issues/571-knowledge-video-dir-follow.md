# 571 · 知识盒视频交付目录不再写死机器路径，与图版同构跟随卡片盒

- 状态：修复已落地（2026-11-24，worktree `bz-wt-video-dir`；只部署测试库，未合并主分支）
- 提出：2026-11-24 用户报「恶性 bug」并附截图——影像笔记打开时报「找不到 `E:/Obsidian/叫我包仔/CONFIG/APPENDIX/…_clip_00-00-12-00-00-25.mp4`」
- 相关：ADR-0300（本决策）、ADR-0296（本机音视频交付目录沿用 `knowledgeOutputDir`）、
  ADR-0275（图版三跳收口，本轮视频照其同构）、ADR-0293（卡片/主题目录行暂时隐藏，本轮恢复卡片行）

## 病灶

三个问题叠在一起，结果是「笔记里嵌了一个只在你本机能打开的绝对路径」：

1. 外部工具 `bili-downloader/config.js` 的 `DEFAULTS.outputDir` / `vaultPath` 写死了作者本机的
   `E:/Obsidian/叫我包仔/...`，换任何一台机器都是错的。
2. 插件侧 `knowledgeOutputDir` 留空时**不下发** outputDir，于是工具拿写死的默认值落盘；
   交付目录不在用户 vault 内，`vaultRel()` 无法相对化，只能把绝对路径回传，笔记尾部
   `![[绝对路径]]` 就成了死链。
3. 设置面板里「输出文件夹」藏在「视频处理」组且留空无回落显示；「卡片文件夹」行被 ADR-0293
   整体隐藏，图版行的说明还写着「跟随 Obsidian 的默认附件位置」——用户看不见跟随关系，
   自然认为「图版跟视频都没有跟随」。

## 改成什么

视频交付目录与图版同一套三跳，且空值也必须算出**库内**目录：

```
显式设置值 → Obsidian 固定附件位置 → <卡片文件夹>/media
```

- `src/knowledge/note-gen.ts` 新增 `resolveVideoDir()`，末跳单独给媒体一个 `media/`（不混进配图的 `assets/`），
  卡片目录按三盒口径归一到「卡片盒」，保证不产出空串。
- `src/knowledge/processor.ts` 把算出的目录拼上 vault 根变成绝对路径**恒下发**——工具的 outputDir
  走 `path.resolve`，相对路径会按进程 cwd 解析；用户显式填的绝对路径（盘符开头）原样下发；
  拿不到 vault 根时宁可不下发让工具明确报错，也不退回写死路径。
- `tools/bili-downloader/config.js` 两个写死的默认值清空，独立 CLI 使用者在 rc 自配，两者皆空报
  「交付目录未配置」。
- 设置面板：视频目录行挪进「目录与分类」组并带 `fallbackValue` 显示实际落点；卡片文件夹行恢复显示，
  图版/视频两行说明改成如实写三跳；视频行 `help` 讲清「填库外绝对路径 = 换机器打不开」。

## 改动清单

| 文件 | 改动 |
|---|---|
| `src/knowledge/note-gen.ts` | 新增 `resolveVideoDir()`（与 `resolveImageDir` 同构，末跳 `media/`） |
| `src/knowledge/processor.ts` | 新增 `resolveOutputDir()`；`options.outputDir` 恒下发库内绝对路径 |
| `src/knowledge/ui.ts` | 视频目录行入目录组 + fallbackValue + help；卡片行恢复；图版/视频 desc 按三跳重写 |
| `tools/bili-downloader/config.js` / `README.md` / `CONTEXT.md` | 清掉写死的 outputDir / vaultPath，文档同步 |
| `tests/knowledge/{note-gen,processor,ui}.test.ts` | 三跳矩阵、恒下发断言、设置行接线 |
| `tests/sp-contract-lock.test.ts` | knowledge 可见项数 21 → 22（+视频行、+卡片行） |

## 边界（知情项）

- **存量不迁移**：已经落在旧机器路径下的视频、笔记里已有的绝对路径不动；本次只保证新生成的正确。
- **显式库外路径仍允许**：用户执意填库外绝对路径时，笔记里嵌的仍是绝对路径，换机器打不开——
  设置行 `help` 已讲明，插件不越权拦。
- **主题盒仍隐藏**：本轮只恢复卡片文件夹行，ADR-0293 对主题行的隐藏不变。

## 守卫

- `tests/knowledge/note-gen.test.ts`：三跳矩阵（设置值 / 空白归一 / 绝对路径原样 / 卡片空归一）。
- `tests/knowledge/processor.test.ts`：空设置下 `options.outputDir` 恒为库内绝对路径；显式值原样下发。
- `tests/knowledge/ui.test.ts`：视频行在目录组、带 fallbackValue、不在视频处理组重复；卡片行可见。
- `tools/bili-downloader` 全部 89 项测试：清默认值后独立 CLI 的「未配置」报错口径不变。

## 验收

- `node scripts/test-affected.mjs --since master` → 706 文件 / 10453 用例全绿；
- `node node_modules/typescript/bin/tsc --noEmit` 干净；
- `cd tools/bili-downloader && node --test` → 89 项全绿；
- 真机验证见 `docs/verify-issue-571.md`（测试库，桌面 + 移动端）。
