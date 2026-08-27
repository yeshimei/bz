# ADR-0058：洞察/Prompt 只取记忆流证据

日期：2026-09-01 ～ 状态：Accepted ～ 关联：ADR-0055（流拆分）

## Context

拆分记忆流/行为流后，需要明确四路洞察产出（反思、睡前小结、每周懂你报告、关系史叙事）和对话 prompt 的数据边界。

行为流包含系统操作（待办完成、收藏增删等），这些内容：
- 不具有情感深度，纳入洞察会稀释小橘的「懂你」质量
- 可能产生噪声模式（如「你今天完成了 3 个待办」），干扰情感陪伴定位
- prompt 中出现行为流内容会让小橘「不像猫」

## Decision

**四路洞察产出全部只从 memoryStream 取证据：**
- 反思（reflection）：evidence = memoryStream 中 importance×cred 前 50
- 睡前小结（digest）：当日 memoryStream 观察
- 每周懂你报告：全周 memoryStream 观察
- 关系史叙事（dossier）：dossier 事件表（与 stream 分离）

**对话 prompt 只取记忆流：**
- `selectSlotMemories` 不变，仍从 memoryStream 选 ≤6 条入 prompt
- 行为流不自动入 prompt
- 特定查询（如「你最近在忙什么」）可主动检索行为流，但不走 prompt 槽位

## Consequences

- 小橘的洞察和对话保持情感深度，不被系统操作稀释
- 行为流的价值限于「辅助上下文」——小橘偶尔参考，但不主动提及
- 检索系统（retrieve）仍可查行为流（用于主动查询），但 prompt 构建不使用
