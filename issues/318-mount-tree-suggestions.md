# 318 挂载树·建议链路：生成、缓存、否决记录与降级

- 状态：已交付（`src/knowledge/mount-suggest.ts`：分句 → 第二大脑块级向量召回 → LLM 裁判 → 过滤（否决/已固定/弱关联/已存在双链）+ 域内单文件缓存按 `bodyHash` 逐卡失效 + 否决留档永久不再推 + 缺索引降级；`tests/knowledge/mount-suggest.test.ts` 25 用例）
- 2026-09-14 实机修复（用户报「打开白板没有任何 AI 建议」）：三处叠加，且都把已拿到手的答案丢掉——① 模型按 prompt 的 `a1`/`t2` 标签作答，旧解析只认整数，逐条丢弃；② 带思考的 DeepSeek-V4.1-Flash 把 2048 / 8192 的预算全烧在 reasoning 上（`finish_reason=length`、content 空串）；③ `response_format: json_object` 与「输出数组」的 prompt 打架，模型吐 `{"type": "json_object"}` 空壳。新口径：裁判走 **prompt 纯文本通道**（不强制 json_object，同建链 agent）+ 容错解析（脱壳 / 标签编号 / 代码围栏 / 夹叙文字）+ 预算 128K（官方上限 384K；`reasoning_effort: max` 单卡 120s 已否，**思考不关、默认档**）+ 无回答单列 `no-answer` **不落缓存** + `SUGGEST_CACHE_VERSION=2` 让旧口径缓存片自动失效重跑；顺带修 `splitAnchors` 把 callout `[!quote]` 的 `!` 当句读（锚点被切成 `quote] …`）。真库端到端（真索引 + 真模型）：自证预言卡 59s / 5 条、马斯洛卡 6 条。
- 关联：ADR-0138 ／ ADR-0139 §3 ／ spec §数据模型 ／ `src/secondbrain/vector-store.ts:538`（新开只读导出）／ `src/core/ai`
- 依赖：314、315

## 背景

ADR-0138：AI **不写 related**；候选 = 「锚点 → 目标」+ 一句话理由；按卡生成、按主卡过滤（回指不显示）、弱关联不显示。
ADR-0139 §3（用户同轮修订）：候选**落域内单文件缓存**、按**正文 hash** 逐卡失效、固定与取消都留档、**取消过的「锚点 → 目标」永不再推**。

## 交付

- [ ] 第二大脑开一个**只读检索导出**（如 `exportVectorSearch()`）；知识盒不碰 `store` 私有变量（`src/secondbrain/index.ts:33`）。
- [ ] 生成链：`splitAnchors(body)`（词/句切分）→ 向量召回（块级、topK）→ LLM 裁判（`core/ai`，产出一句话理由）→ 过滤
      （弱关联不显示 ／ 存疑不链 ／ **建议否决表** ／ 已 fixed）。
- [ ] 缓存：`CONFIG/STORAGE/` 域内单文件、按主卡分片、`bodyHash` 逐卡失效、写串行（同 store-file 路子）。
- [ ] 降级：检测不到可用向量索引（未建 ／ 已降级 ／ 移动端）→ **不跑**建议、白板只画双链 + 顶栏一条提示（含「去建索引」入口），**不自动建索引**。
- [ ] 顶栏「重新生成」与命令 `bz-knowledge-mount-refresh` 同路径（重跑当前主卡并刷新缓存）。
- [ ] 设置：`knowledgeMountAutoSuggest`（默认开）+「清空建议缓存」按钮；schema 与测试同步。
- [ ] 测试：切分、过滤（否决 ／ 弱关联 ／ 已固定）、缓存读写与逐卡失效、无索引降级的提示分支。

## 验收

缓存命中时打开白板无感；改一张卡只重跑那张；同一条被取消过的建议不再出现。
