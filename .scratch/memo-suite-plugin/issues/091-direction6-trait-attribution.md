# ticket 091 —— 方向六：特质归因学习（086 v4）

状态：**done**（2026-08-24，分支 trait-attribution 落地：LLM 归因主+词法兜底 mode 标记 / ≤2 截断 / digest 排除 existential / existential ×0.5 / none 不硬挑 / H4 继承 + 独立退避 editingData.traitAttribution；测试 tests/smartcat/trait-attribution.test.ts 23 用例，全量 1688 绿 + tsc 0；ADR-0038）
父文档：086-intelligence-evolution-proposal.md v4「方向六」（裁决：值得做，改动小）
基线：master 6419c06（含 087 H4 安全契约、088 lastPresenceAt）
日期：2026-08-24

## 现状缺陷

applyReflectionInsights（mood.ts ~L388）用裸关键词猜特质归属：
`/自我|自己|about me|self/ → exist_depth` 等 5 组正则。问题是：
1. 「我今天不想工作了」命中 /工作/? 不——但任何带「自己」的抱怨都会推 exist_depth
2. 词法命中即涨，**没有任何解释链**，growthHistory 里查不到「为什么变了」
3. 违反体验原则 4「展示即承诺」：不可追溯的因果不该存在

## 设计（v4 裁决逐条落地）

1. **LLM 归因主 + 词法兜底，结果带 mode 标记**（llm/lexical）写入 growthHistory 条目：
   `attribution?: { mode: 'llm' | 'lexical'; quote?: string }`
   —— llm 必须引用洞察原文片段作依据（quote）；**词法兜底不带 quote**（不产伪解释）
2. **每反思批次归因总数 ≤2 条**（超出按洞察顺序截断）
3. **来源约束**：digest 来源的洞察只允许非 existential 归因；
   existential 群组（exist_depth/familiarity/concern）增益单独 ×0.5 降频
4. **候选特质限定 5 个**：exist_depth / familiarity / concern / creativity / oxytocin
   （即现状词表对应集，不扩）
5. **无合适特质返回空 ≠ 硬挑一个**：LLM 返回 none 时本条洞察不归因不涨特质
6. **LLM 调用继承 H4 四件套**：system prompt 追加 USER_CONTENT_BOUNDARY
   （memory.ts 导出）；异常裁剪不整轮失败；独立退避（新 editingData 键，
   不共享 reflectBackoffUntil）；输出 JSON 校验 {trait, quote} | {trait:'none'}
7. trait 增益量级沿用现值（d1=0.01×DEEP_DELTA_SCALE / d2=0.005×DEEP_DELTA_SCALE）

## 调用位置建议

reflect 产出洞察的消费链（index.ts 反思钩子 → applyReflectionInsights）处插一次批量归因
LLM 调用（一条洞察一批，≤2 条），替代纯词法路径；LLM 失败/超时 → 整批回落词法（mode=lexical）。

## 测试要求

- mode 标记落 growthHistory（llm 带 quote / lexical 无 quote）
- ≤2 截断、digest×existential 排除、existential ×0.5、none 不硬挑
- LLM 失败回落词法；退避窗口内直接走词法不再请求
- 既有 mood 测试全量保留（词法行为回归不变）

## 工程规约（AGENTS.md 全量适用，重点）

- exFAT：新建文件一律 pwsh [System.IO.File]::WriteAllText(UTF8 无 BOM)；write/edit 仅用于已存在文件
- git 需两参数防 dubious ownership：`-c safe.directory=<worktree绝对路径>`
- 提交 Conventional Commits 中文；.scratch 用 git add -f
- npm test 默认并发下 library-source/memo-action 时序用例偶发 flake（已知环境问题）：
  单文件重跑绿 + `--maxWorkers=4` 全量绿即可判定通过
- 完成门禁：npm test 全绿 + npx tsc --noEmit 0 错误 + diff 自审

## 实现记录（2026-08-24）

- mood.ts：归因常量/纯函数（parseLLMAttributions 校验 {trait,quote}|{trait:none}、越权词表/digest 禁选/quote 原文子串校验逐条裁剪；
  planLexicalAttributions 词表逐字保留 + 批次约束）；applyReflectionInsights 重构为批量一次 LLM + 整批回落词法，
  growthHistory 每归因一条留痕 attribution{mode, quote?}；独立退避 editingData.traitAttribution（5min→30min 指数、成功重置、失败即落盘跨重启生效）
- memory.ts：onReflect 增加 meta.origin（reflection|digest），reflect/digest 分别透传
- index.ts：接线把 origin 传给 applyReflectionInsights
- 文档：ADR-0038、spec.md 一行、PROGRESS.md 小节、CONTEXT.md 特质归因词条