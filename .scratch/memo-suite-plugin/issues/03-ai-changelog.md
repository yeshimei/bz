# 03 — AIService 移植 + changelog 机制

**What to build:** Q3 的 AIService（DeepSeek/OpenCode Go 双 provider、流式+兜底）完整移植，以及各脚本的版本更新日志（changelog）机制。

**Blocked by:** 01（插件骨架）

**Status:** ready-for-agent

- [ ] AIService 方法集：prompt/chat/reason/search/json/reasonAndSearch；createAI(params, defaultModel='deepseek-v4-flash', defaultOptions, defaultMaxTokens=8192)
- [ ] prompt 行为：fetch 流式（stream:true、max_tokens 默认 4096、modelOptions 透传 response_format/enable_thinking）；失败自动 fallback requestUrl 非流式；provider.noCors 直接走 requestUrl
- [ ] provider 配置：deepseek / opencode-go 从插件设置读取（aiProvider/opencodeGoApiKey/override 对象），provider.model 默认模型覆盖
- [ ] changelog：CHANGELOGS 8 identifier（memo/article/luhmann/library/movie/belongings/diary/password-manager）+ checkAndShowChangelog/displayChangelog（localStorage 已读版本 `changelog_<id>_shown_version`）
- [ ] 测试：mock fetch 断言请求参数（URL/body/model/max_tokens）、失败兜底路径、降级行为
