# 18 — 闪念

**What to build:** 右侧窄窗闪念系统完整移植：吸附展开、参考面板、AI 对话、向量+TF-IDF 检索、Ollama/DeepSeek 双通道、移动端降级。

**Blocked by:** 01, 02, 03

**Status:** superseded → #103（第二大脑：按 QuickAdd 完整基准正名接管实现，2026-08-25。原清单由 103 验收清单吸收取代）

- [ ] 右侧窄窗：FloatWindow（吸附缩起/悬停展开 hoverExpandTimer/关闭）+ ReferencePanel（参考面板）+ ChatPanel（聊天：发送/··· 菜单）+ MobilePanel（移动端）
- [ ] 检索：向量（Ollama bge-m3，meta.json + vectors.vec 持久化）+ TF-IDF（停用词表、文档频率/平均长度）+ 移动端文本匹配降级；TOP_K/CHAT_TOP_K
- [ ] AI 对话：Ollama 本地/远程（qwen2.5:14b-instruct）+ DeepSeek（DEFAULT_USE_DEEPSEEK 开关）；降级链（DeepSeek 失败→回退本地；远程失败→本地；批量向量化失败→逐条）
- [ ] vault modify 监听向量增量重建（防抖 DEBOUNCE_DELAY）
- [ ] 17 项设置全量：OLLAMA_URL/EMBEDDING_MODEL/META_PATH/VEC_PATH/TOP_K/CHAT_TOP_K/CHUNK_MIN_LENGTH/ALLOW_PATHS（默认 卡片盒/主题盒/我的/归档/CODE）/CONCURRENCY/CONTEXT_LIMIT/DEBOUNCE_DELAY/CURSOR_POLL_INTERVAL/OLLAMA_CHAT_MODEL/DEEPSEEK_MODEL/DEFAULT_USE_DEEPSEEK/MAX_HISTORY/OLLAMA_REMOTE_URL
- [ ] 命令 `shan-nian-open-reference`/`shan-nian-open-chat` 裸注册；状态提示（✅ TF-IDF 就绪/✅ 远程 Ollama 已连接）；空态「⚠️ 没有符合条件的文件」
- [ ] 测试：TF-IDF 检索、向量 mock、降级链、窄窗交互 jsdom
