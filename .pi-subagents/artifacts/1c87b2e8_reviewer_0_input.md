# Task for reviewer

对 E:/Obsidian/1 仓库（Obsidian 插件工程）自首次提交以来的全部改动做两轴评审。

固定点：首个提交 f000d23（scaffold）。评审范围：`git diff f000d23...HEAD`（工作区 E:/Obsidian/1）。提交列表：`git log f000d23..HEAD --oneline`。

## Standards 轴

仓库编码标准来源：README.md（架构约定：core ← config/state ← parser ← store ← ui ← main 单向依赖、无循环依赖；命令 id 不带插件前缀的约定；UI 层不直接依赖数据层刷新函数）。CONTEXT.md（领域词汇：日记条目/日期文件/主标签/二级标签/摘抄/数据映射/全量-轻量刷新等，输出命名应使用这些术语）。docs/adr/0001、0002。

外加 Fowler 代码坏味道基线（每条都是判断而非硬违规；仓库文档覆盖则让位；工具已强制的不重复报）：
- Mysterious Name — 名字不揭示用途 → 改名
- Duplicated Code — 重复逻辑形态 → 提取共享
- Feature Envy — 方法过度读取他对象数据 → 移到数据所在
- Data Clumps — 同组字段/参数结伴出现 → 打包成类型
- Primitive Obsession — 原始类型代表领域概念 → 建小类型
- Repeated Switches — 同一类型上重复 switch/if 级联 → 多态或共享映射
- Shotgun Surgery — 一个逻辑变更散落多处 → 聚合
- Divergent Change — 一文件因多种无关原因被改 → 拆分
- Speculative Generality — 无需求支撑的抽象/参数 → 删除
- Message Chains — 长链导航 → 封装
- Middle Man — 纯转发的类/函数 → 直调
- Refused Bequest — 子类忽略大部分继承 → 组合

简报：按文件/代码块报告 (a) 违反文档标准的每一处（引用标准来源文件+规则）；(b) 基线坏味道（命名+引用代码块）。区分硬违规与判断项。跳过工具已强制项（tsc/vitest/esbuild 门禁）。400 词以内。

## Spec 轴

Spec 来源：.scratch/diary-notebook-plugin/spec.md + issues/01-10.md（tickets）。

简报：(a) spec/tickets 要求但缺失或不完整的部分；(b) diff 中未要求的越界行为；(c) 看似实现但实现有误的需求。每条引用 spec/ticket 行号。400 词以内。

## Acceptance Contract
Acceptance level: attested
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Return concrete findings with file paths and severity when applicable

Required evidence: review-findings, residual-risks

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
`criteriaSatisfied[].status` must be exactly one of: satisfied, not-satisfied, not-applicable.
`commandsRun[].result` must be exactly one of: passed, failed, not-run.
`manualNotes` and `notes` are optional strings; an empty string means no note and does not satisfy `manual-notes` evidence.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```