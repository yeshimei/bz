# ADR-0039：洞察版本化（supersede 前置剔除 + 主题受限枚举 + 候选通道）

日期：2026-08-24 ｜ 状态：Accepted ｜ 关联：ticket 092（086 v4 方向二）、ADR-0021（记忆流）、ADR-0036（可信度）、ADR-0037（H4 安全契约）

## Context

反思洞察（insight 条目）一旦入流永不失效：习惯变了、结论过时，检索时旧洞察与新观察平权竞争，
无「被推翻」语义。086 v4 裁决「值得做，机制补全」，要求：supersede 二选一路径、稳定主题键、
候选既有洞察通道、环形引用检测、pinned 保护、DDID 展示层短格式，且 smartcat.json 兼容冻结
（全部新增为可选字段，旧数据零迁移）。

## Options

**O1 supersede 语义路径**
- A. 排序前剔除：`retrieve`/`formatMemoriesForPrompt` 前置 filter ✅
- B. ×0.1 乘法惩罚：评分管线内乘系数降权 ❌

选 A。理由：GA 加法分空间下（αRel=1.5），线性减项盖不住高 importance 废弃洞察；
乘法惩罚即使压低得分，废弃条目仍参与 top10 名额竞争——剔除最简单且最稳。
`retrieve()` 的 topN=10 与三处调用点是冻结契约：剔除只发生在排序管线内部（pool 预过滤），
调用方零改动；`formatMemoriesForPrompt` 加第二道闸（防未来调用方绕过 retrieve 直传列表）。

**O2 主题键形态**
- A. 受限枚举 `工作|兴趣|关系|健康|环境` + 词法回退 ✅
- B. 源类型+ISO 周窗口复合键 ❌

选 A（v4 裁决推荐项）。LLM 打标经白名单校验（对齐 H4 sanitizeEmotion 风格），
解析失败回退 THEME_KEYWORDS 词法映射，两路皆空不强标——杜绝自由措辞导致同主题多键。

**O3 候选通道相似度与预算**
- 相似度：词法关键词重叠 + 新近 tiebreak（纯函数可测；语义向量增强留待后续）
- 预算：topN=12（对齐 evidenceTop=50 窗口量级的裁剪思路）+ 每条描述前 40 字 + 总字符预算 600 封顶
- 注入行格式 `C1[工作] 描述片段…`，编号供 LLM 回传 `{supersede: N}` 反解真实 id

**O4 dashboard「固定/废弃」写点**
面板「只读不写盘」铁律开唯二例外（v4 裁决明示保留人工修正信号）：洞察行「固定/取消固定」
（pinned 切换）与「废弃」（supersededBy='manual' 人工标记），load-modify-save 最小写点防并发覆盖。

## Consequences

- 已废弃洞察不再进检索结果与 prompt（历史纵深保留在数据层，只标记不删除）；pinned 洞察豁免自动取代。
- 环形引用：A→B 后再试图 B→A 被拒绝；既有环脏数据由 visited 集兜底不死循环。
- reflect prompt 新增参照块：洞察文本以标注段进 prompt（P1-1 原意收窄为「不作编号 evidence 素材」，
  对应 memory.test 断言同步收窄并注明）。
- 候选通道构造为防御式纯函数（畸形输入裁剪空块不抛错），失败不影响反思主流程、不走反思退避通道。
- 新增可选字段 `theme/supersededBy/pinned` 全部旧数据容忍零迁移；normalizeData 条目透传不丢字段。
- DDID 短索引仅展示层（dashboard `#N` 序号含已废弃洞察，序号稳定），数据层 id 不变。

## 测试

tests/smartcat/insight-version.test.ts 28 用例：剔除双闸/topN 不挤占/脏字段容忍、主题枚举+词法回退、
reflect 集成（theme 落库/supersede 编号与字符串 id/pinned 保护/畸形裁剪）、applySupersede 校验链
（幂等/自指/环形/既有环）、候选预算截断/排序/indexMap、DDID 索引、dashboard UI（短索引徽章/
固定切换落盘/废弃落盘/打开零写盘回归）。既有 memory.test 57 用例全量保留（1 处断言按上述收窄）。