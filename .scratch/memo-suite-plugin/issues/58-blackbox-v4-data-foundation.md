# 58 — 清理旧容器 + v4 数据层地基

**What to build:** 黑匣子从容器壳变成分析层地基：删除录入/笔记化/导入功能全部源码与测试（capture、notes、import-cardbox、source-jump、inject、host-register、v3-seed）与 `bz-blackbox-capture` ×4 命令；建立 blackbox.json v4 读写（profiles/mentions/events/reviews/chat/cursor/settings 空派生层）、cursor 推进/失效回退、mentions 门槛（≥2 次跨日期建画像）、事件置信度分级（≥0.7/0.5-0.7/<0.5）、humanEdited 锁、事件去重纯函数；日记读取复用 diary/parser + diary/config（显式 import，轻量三目录扫描）。

**Blocked by:** 57（spec）

**Status:** ready-for-agent

- [ ] 旧容器源码与测试删除，黑匣子命令只剩 open/panel/review
- [ ] blackbox.json v4 读写 + 游标 + 门槛/分级/锁/去重纯函数测试通过
- [ ] 日记读取复用（三目录扫描 + 加密/空内容过滤）测试通过
- [ ] 全量测试绿、tsc 零新增