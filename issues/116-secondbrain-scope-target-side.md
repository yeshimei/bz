# Ticket 116：关联范围语义修订（目标侧） + 候选来源 = 白名单索引库 + 两目录字段默认空

- 状态：已完成（master 09d37b9；合并后全量 2710 用例复核绿 + tsc 0 + 构建部署验证）
- 域：secondbrain
- 设计文档：`.scratch/secondbrain-link-agent/spec.md`（v1.2 语义修订节）
- 前置：ticket 115（存量补链，本票在其上修订范围/候选语义）

## 背景（用户澄清，三连拍板）

ticket 111 的 `linkAgentScopes` 同时决定「监听目录 + 候选过滤」，且缺省回退「文献盒」。实际使用中：
- 文献盒只有 1 篇笔记 → 候选按范围过滤后恒为空 → 启动补链进度显示「处理中 1/1 篇」但 0 产出、手动命令报「未发现实质关联」——尽管弗洛伊德等笔记明明在索引里；
- 用户确认语义：**关联范围只决定"哪些笔记会被关联"（目标/触发侧）**；**关联来源（候选池）= 白名单索引库（secondBrainAllowPaths）中的全部笔记**；
- **「白名单目录」与「关联范围」两个文件夹字段默认均为空；空 = 什么也不录（不索引 / 不自动关联），不是"全库"**；取消「文献盒」缺省回退。

## 任务清单

1. **候选来源**：`findCandidates` 去掉 `linkAgentScopes` 过滤——取整个索引库近邻，剔除自身 / 已删除文件 / encrypt 锁定文件；
2. **范围 = 目标侧**：`matchesScope(scopes, path)`（空 = 任何路径不命中）接入 监听触发（watch.onCreated）/ 存量补链目标（computeBackfillTargets.inScope）/ 死链扫描（cleanDeadLinks）；`parseScopeList` 空值返回 `[]`，删除 `LINK_AGENT_DEFAULT_SCOPE` 回退；
3. **默认空**：`DEFAULT_SETTINGS.linkAgentScopes = ''`、`DEFAULT_SETTINGS.secondBrainAllowPaths = ''`；`buildConfig.ALLOW_PATHS` 空 = `[]`；`whitelistedFiles` 空白名单 = 不录任何文件（原为"全库"，一并修订）——两字段空 = 什么也不录；
4. **文案**：⚙️ 弹窗「关联范围」「单篇候选数量 TopK」「自动双链」「白名单目录」四处描述按新语义更新；
5. **测试**：数据层（空值 = [] / matchesScope / 默认值）+ UI/通知层（候选不受范围限制 / 空范围 backfill 无目标不触发 / 监听空范围不触发 / 显式范围回归），既有「缺省回退文献盒」用例改写；
6. **文档**：spec v1.2、CONTEXT、PROGRESS。

## 边界

- 手动命令 `bz-secondbrain-rebuild-links` 不受范围限制的语义保留（候选来源同步变更为全索引库）；
- `bz-secondbrain-link-all` / 启动补链：目标 = 范围（空 → 无目标 → 明确提示/静默）；
- 引导提示（白名单未含范围目录）保留，文案按新语义微调；
- 不代改用户 data.json：默认值只对缺省（新装）生效；存量用户已显式配置的字段保留。

## 验收门禁

- [ ] spec「验收标准」v1.2 项全过
- [ ] `pnpm test` + `pnpm exec tsc --noEmit` 全绿
- [ ] 构建部署后真机冒烟：范围外笔记也能把弗洛伊德列为候选并建链；空范围下不触发任何监听/补链