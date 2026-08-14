# ticket 57：黑匣子 v4 重构——日记智能分析层

Status: `ready-for-agent`
Type: task
Feature: blackbox-suite-plugin

## Problem

黑匣子长成了第二个容器（v1 感触/v2 三类条目/v3 笔记化），与日记本书写体系平行重复，用户负担重、内容割裂。用户决策：黑匣子不做容器——**数据仍由日记本书写，黑匣子只读日记、AI 提炼、产出派生层**。

## Solution

设计事实源（grilling 会话 + `/grill-with-docs` 社区调研封板）：
- `.scratch/blackbox-suite-plugin/spec.md`（v4 完整 spec，Status: ready-for-agent）
- 主 spec `.scratch/memo-suite-plugin/spec.md` 黑匣子章节（US 1-14）/命令清单/设置总表/事件监听表已同步

核心决策速览（Q1-Q16 grilling 全记录见 spec Further Notes）：
- 数据流：日记流（`我的/日记` + `我的/影视` + `我的/信`）→ vault modify/create 监听（防抖 30 分钟）→ 一次 AI 调用批量提炼（{people, events, emotions}）→ blackbox.json v4 → 对话/三标签面板/复盘
- 删除：capture ×4 命令 + import-cardbox + 录入弹窗 + 三类条目 + 笔记目录（存量已删）
- 保留改造：对话（三层记忆：日记 TF-IDF + 画像概要 + 历史）、画像（≥2 次跨日期建，provenance 分层）、事件（两级置信度 + 证据链行号跳转）、复盘（纯手动，JSON 落盘 reviews[] 四段事实锚定）、情绪（24 词 AI 推断 1-3 词）
- 复用：diary/parser 纯函数 + diary/config 目录常量（显式 import，不重造扫描）
- v4 schema 冻结（Q14，见专属 spec 数据格式节）
- 设置 6 项（删 reviewThreshold/typeFilter）

## 切片拆分（实现按序，每切片一次提交）

| 切片 | 内容 |
|---|---|
| **57a 数据层 v4** | blackbox.json v4 读写（profiles/mentions/events/reviews/chat/cursor/settings）+ 游标推进/失效回退 + mentions 门槛（≥2 次跨日期建画像）+ humanEdited 锁 + 事件去重/置信度分级入库 + 日记读取复用（diary/parser + config，轻量三目录扫描）+ 测试 |
| **57b 增量提炼链路** | vault modify/create 监听（三目录边界 + 防抖 30 分钟）+ 一次 AI 调用批量提炼（prompt 构造/JSON 解析/失败跳过重试）+ 首次全量分批 50 串行 + 进度通知 + 打开黑匣子即时提炼 + 测试 |
| **57c 三标签面板 + 设置 + 命令** | 人物墙/事件时间线/复盘流三标签 + 设置弹窗 6 项（删 2）+ 命令调整（删 capture ×4 + import-cardbox，smoke 同步）+ 移动端双断点 + 测试 |
| **57d 对话改造 + 复盘 + 装配** | 对话三层记忆（TF-IDF 日记检索 + 画像概要）+ 复盘四段报告（JSON 落盘 + 对话流可见 + 新人物提示）+ 降级链 + 样式收敛 + 全量测试绿 + tsc 零新增 + 提交 |

## 测试缝（已与用户确认）

- 数据层缝（data.test.ts 重写）：v4 读写/游标/门槛/锁/去重/分级
- 提炼缝（ai.test.ts 重写）：mock fetch 断言批量提炼 prompt/解析/分级/失败重试
- 日记读取缝：复用 diary/parser 读三目录 → 过滤 → cursor 增量
- UI 缝（panel/chat/review.test.ts 重写）：三标签交互/对话记忆/复盘四段
- 监听缝（sync.test.ts 重写）：防抖 30 分钟/打开即时提炼
- 删除旧缝：capture/capture-epub/notes/import-cardbox/panel-source-jump/source-jump/inject/host-register/v3-seed
- smoke.test.ts：黑匣子命令 4 → 3

## Comments

- 2026-08：grilling 3 轮（Q1-Q16）封板；社区调研 4 主题（画像/时间线/复盘/情绪）；存量清理已执行（`我的/黑匣子/` 1492 文件 + blackbox.json 删除）；4218 处断链不管（Q11）。