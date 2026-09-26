# 344 · 知识盒清理批（评审裁决落地）

> 2026-09-16。起因：用户问「知识盒有哪些不合理」。通读 knowledge 域约 1.4 万行（ui 3498 /
> mount-canvas 2019 / mount-suggest 1652 / mount-data 899 / note-gen 637 / styles 1675），
> 出 17 条清单；用户逐条裁决后**一次性落地**本批。分支 `fix/kb-trim`（worktree `../.dsh-worktrees/kb-trim`）。

## 一、用户裁决（原文口径）

**采纳**：① 删「提炼成卡」② 去掉文献行 `LIT-xx` 编号 ③ `url` / `videoTitle` 统一并入
`source` / `sourceTitle`（**并同步迁移存量笔记属性**）④ 领域统一写 `domain` ⑤ 被引改走
Obsidian 反链函数 ⑥ 段落与名词一样自动跑 ⑦ 设置面板去掉装机参数 ⑧ 首页知识盒右键菜单补
段落 + 图版 ⑨ 部壹文献行补「被引」。

**不采纳**（各有明确理由，不再重提）：部壹搜索 / 筛选（有意如此）、手机端处理（物理限制）、
卡片送复习（复习计划有监听文件夹，会自动入）、四入口合一（有意如此，改用首页菜单补齐）、
入口重量分离、影像保存即开跑、来源行按上下文预填。

**另议后采纳**（建议 5「把生成→落盘从签收改成编目」，用户四项拍板）：
标题重新生成即**覆盖**（含用户改过的）；领域**要给候选**；关联点掉**不能恢复**；
编辑形态**点一下才变**。

## 二、实现清单

| # | 改动 | 要点 |
|---|---|---|
| 1 | 删「提炼成卡」 | ui 删 `openCardEditor` / `saveCard` / `syncSaveBtn` / `editor` / `sessionNewPaths` / `appendRelatedLine` / `ensureCards` 与弹层分支；styles 删整段表单样式；部贰空态文案改指「卡片文件夹」；d3 直写白名单条目随之移除（ui.ts 不再直写用户笔记） |
| 2 | 去 `LIT-xx` 编号 | 该编号取的是「当前列表第几行」，每新增一篇全体 +1，且超 99 篇撑破两位排版 |
| 3 | 来源统一 | 视频文献 `url→source`、`videoTitle→sourceTitle`；预览只出「来 源」一块；**存量迁移** `migrateVideoSourceKeys`（纯字符串、行级、幂等、不造重复键）挂进 `backfillNotes` 且**排在「已补全即跳过」之前**；backfill 的 video 判据改用 `author`（`source` 被四类共用，不能当判据） |
| 4 | 领域统一 | `loadCards` 去掉 `category` 兜底（历史别名；实测库里 0 张在用，写入侧唯一写者落卡已删） |
| 5 | 反链走缓存 | `mount-data` 新增 `outboundTargetsViaCache`（`resolvedLinks` + `getFileCache().frontmatter`，零 IO）与 `hasOutboundViaCache`（**断链也算有挂载**，读 `cache.links/embeds`）；`refCounts` 键改为**所有被指向路径**并供卡片部与文献部共用；`orphanCards` 同源。**根治卡片盒打开卡顿**（旧实现逐篇 `readText`，1500 篇量级占满主线程） |
| 6 | 段落自动跑 | `showEntry` 的自动生成从只挂 `term` 改为 `term + passage` |
| 7 | 设置去装机参数 | 删「工具」组（ffmpeg / ffprobe / Python 路径、Whisper 模型、缓存文件夹与保留天数）。**键与消费链保留**（存量用户配过的值继续生效，只是不再暴露） |
| 8 | 首页菜单补两入口 | `DOMAIN_MENU.knowledge` 补段落（`align-left`）/ 图版（`image`），顺序与主窗录入行同源；`prototypes/home/prototype-icons.js` 补两个 lucide 真值（新增段四） |
| 9 | 部壹补「被引」 | 新增 `patchLitBadges`（原地补、不重建整表）；徽标文案与卡片部统一走 `refBadgeTitle` |
| 10 | 建议 5 | 属性行**点一下才变**可编辑（负 margin 抵消 padding，不跳布局；hover 极轻提示；回车/失焦提交、ESC 放弃）；`userEdited` 集合实现「重新生成即覆盖、同轮流式不覆盖用户值」；名词行提交写回顶部输入框并重查重名；领域联想候选 = **已用过的领域 ∪ 设置词表**（频次降序，词表独有的排后）；关联行改 chip（每条可点掉、本轮不可恢复）；**关联行 idle 态整行隐藏**（草稿到达前不再挂一行假的「—」） |

## 三、测试

- 新增：`migrateVideoSourceKeys` 纯字符串 8 组断言；建议 5 端到端 1 例（idle 隐藏 → chip 点掉 →
  ESC 放弃 → 回车提交 → 落盘所见即所得 + 关联只带没点掉那条）。
- 改写：refCounts 口径（不再预填 0 项，消费方 `?? 0`）；孤儿/断链/自链三例；九键断言改统一键；
  段落「不自动生成」两例改为「同样自动生成」；设置组数量 6→5；`noteMd` helper 的 `url` 改 `source`。
- mock 增强：`mockAppWithVault` 新增 `metadataCache.resolvedLinks`（现算 getter）与
  `getFileCache().links`（**解析前**链接，断链也在）；**frontmatter 区不计入 resolvedLinks**（与真机一致，
  否则 related 会被重复计数）。
- 门禁：`tsc` 0 错；knowledge 508 项全绿；全量 5319 通过 / 唯一失败 = `preview-freshness` 13 项
  （改 src 未重出产物，**按规程回主仓重出即绿**）。

## 四、顺带修掉的真 bug

属性行编辑输入框的 Enter / ESC **冒泡到 document**，撞上「ESC 关面板」的分层处理器——
用户在属性行按 ESC 想放弃编辑，实际弹出的是关闭确认框。已 `stopPropagation`（测试先暴露的）。

## 五、未做 / 留给后续

- 四入口合一、手机端处理、入口重量分离、影像保存即开跑、来源行按上下文预填 —— 用户明确不采纳。
- 卡片不能从知识盒内创建（本批把唯一的入口也删了）：卡片归用户在卡片文件夹里自己写。
- `docs/CONTEXT.md` 的措辞同步与 ADR 决策 16-19 的正文落在本批一并提交。
