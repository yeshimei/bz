# 359 · 第二大脑对话改走 AI 设置

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #25（用户已采纳，**语义已修正**）｜ status: open ｜ assignee: — ｜ blocked-by: —

## What

第二大脑 AI 对话现在写死 DeepSeek 系接口（不回退、没配就用不了）。改为遵循插件「AI 设置」：走 core AIService 的提供商/模型配置（用户配什么模型对话就用什么），检索上下文注入与流式渲染链路保持不变。

**用户原话口径：ai 对话根据 ai 设置走。** 不是「回落 Ollama」方案。

## Scene

用户在 AI 设置里配了任意兼容模型，第二大脑对话直接用同一个模型；换模型只改一处设置。

## Acceptance

- 对话请求全部经 core AIService，域内无独立 API key/写死域名
- 流式输出、取消、引用卡不受影响（回归测试覆盖）
- 数据层 + UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/secondbrain/chat-panel.ts、api.ts（旧 DeepSeek 通道退役）、src/core/ai.ts
- 旧配置键迁移（若存在 DeepSeek 专用键）按项目零迁移/迁移惯例处理，spec 里写清。
