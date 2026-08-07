# memo-suite 进度（上下文压缩恢复点）

最后更新：2026-08-07，241 测试全过。仓库 `E:/Obsidian/1`，构建产物直出 `E:/Obsidian/叫我包仔/.obsidian/plugins/memo-suite/`。

## 已完成（git 已提交）

| ticket | 域 | 说明 |
|---|---|---|
| 01 | 骨架 | esbuild→memo-suite、manifest、设置页全量、25 命令裸注册、ribbon、懒加载 |
| 02 | core | Q3 21 工具移植：`src/core/`（utils/dom/json-store/changelog/ai/app/esc-manager/confirm/settings-provider） |
| 03 | AI/changelog | AIService+createAI（deepseek/opencode-go、override、noCors、fallback）；CHANGELOGS 8 identifier |
| 04/05 | 备忘录 | `src/memo/`（types/due/data/ui/app/index），37 测试 |
| 06 | 归物本 | `src/belongings/`（default-categories.gen.ts 1226 条已落盘），18 测试 |
| 07 | 密码本 | `src/password/`（crypto/data/ui/index），22 测试 |
| 19 | AIAgent | `src/ai-agent/`（sync/dialog/index），16 测试 |

## 待完成（按序）

1. **08/09 剪藏本+聚合讯**：worker 已交付**完整代码**（9 个文件全文）在
   `E:\Obsidian\1\.pi-subagents\artifacts\7fbec595-deb3-46b9-9714-0f21db4bf584_worker_2_output.md`
   → 落盘 `src/clipping/view.ts`+`index.ts`、`src/news/reader.ts`+`index.ts`、`styles/clipping.css`、`styles/news.css`、`tests/clipping/parse.test.ts`、`tests/clipping/view.test.ts`、`tests/news/reader.test.ts` → tsc + vitest → commit。
   注意：worker 代码中 `getVault()` 辅助需在 setup 内补 `_vault = vault`；main.ts 无需改动（导出名一致）。
2. **10 自动摘要 + 11 收藏本**：蓝图在 `..._worker_3_output.md`（自动摘要 parser/processor 结构、收藏本 DataManager/BalanceService（findNumberInObject/5 分钟缓存）/UIManager DOM id/AI 整理/余额状态机）。
3. **12 书库 + 13 阅读报告**：蓝图在 `..._worker_4_output.md`（getBookItems/parseBookNotes/updateComment/deleteHighlight 用 window.confirm、报告 80+ 生成函数公式：热力图色板/香农多样性/基尼平衡/思考比/趋势方向等，重复函数只保留最终版）。
4. **14 影视 + 15 影视分析**：蓝图在 `..._worker_5_output.md`（TYPE_GROUPS/ALL_TAGS/TYPE_COLORS 常量、排序三键、无限滚动、AI 推荐链路、initQ3 海报整理；分析 48 字段聚合、7 图表组件、ratingBucketOf 6 档、21 section；**movie 域必须导出 getMovieFolderPath() 供 analysis 用**；主演计数源码 bug 取单次）。
5. **16 复习 + 17 做题**：蓝图在 `..._worker_6_output.md`（FSRS 幂律：w=[0.4,0.6,2.4,5.8,4.93,0.94,0.86,0.01,1.49,0.14,1.26,0.07,0.35,2.06,0.57,0.09,0.05,0.33,2.15] d=0.9；R(1,1)=0.5104；阶梯 10 级；review.json 兼容；`window.__quiz`→src/quiz 单例；做题家 quiz.json 结构/3 难度提示词；**「全完成替换」实际是 removeQuestion 机制**）。
6. **18 闪念**：蓝图在 `..._worker_7_output.md`（七模块；两处停用词表 35 字/44 字分别保留；meta.json v7 + vectors.vec 布局 dim(LE uint32)+float32；Ollama 三端点；降级链；17 设置；IS_MOBILE）。源码 2311 行最大域。
7. **20 e2e 验收**：15 域对照原宏、数据零迁移、27 命令、降级链、回退验证。

## 关键约定（勿破坏）

- 命令已在 main.ts 注册（25 个，id 无前缀），域内**不重复 addCommand**；导出名与占位 index.ts 一致
- 域设置经 `getSettings()`（src/core/settings-provider.ts）；AI 经 `createAI()`；app 经 `getApp()`
- 样式写 `styles/<domain>.css`（最终收敛进根 styles.css），域内仍可 injectStyles（data-xxx-styles 幂等）
- 测试：vitest+jsdom，`tests/mock-obsidian-entry.ts`（Notice/requestUrl/moment/Plugin/Setting mock）+ `tests/mock-vault.ts`（MockVault 有 getFiles/createFolder/create/modify/read/getAbstractFileByPath）；`setApp`+`setSettingsProvider` 注入
- 长异步（PBKDF2/crypto）测试用真实 setTimeout 等待；fake timers 下用 advanceTimersByTimeAsync
- 提交信息格式：`memo-suite: ticket NN <域> 完成——<要点>，N 测试`

## 环境注意

- 子代理写操作被环境全局拦截（权限门）——**只能主会话写盘**；worker 蓝图/代码在 `.pi-subagents/artifacts/*.md`
- 编辑器注意：src/memo/ui.ts 等大文件 anchor 易 stale，改动用 python 脚本或 replace_text
