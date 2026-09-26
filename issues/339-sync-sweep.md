# 339 · 同步补漏包：secondbrain rename rekey / diary 内存同步 / checkup 扩展

- 状态：已实现（2026-09-16，用户对 issue 335 审计报告拍板「全部修复」；本工作树 = 审计#19/#21/#15 + 建议②）
- 关联：memo file-sync 范式；issue 336（knowledge/clipbook 同步，另一工作树）

## 改动设计

### 1. secondbrain `vault:md-renamed` 消费（审计#19/#21）
- 现状：全域无 renamed 订阅。`link.queue[]`/`link.state{}` 键=笔记路径
  （store-file.ts:33-37），改名后旧键残留、笔记可能被当新笔记重复入队。
- 新增 renamed 消费（link-agent/watch.ts 已有 md-deleted 先例 :121）：
  队列条目与 link.state 键 oldPath→newPath rekey（去抖 1.5s 合并、链式改名按序回放，
  写 JSON 走既有 mutateStore 串行链语义不变；新旧都在盒外的无关改名短路不空转）。
- 向量索引键：**结论=不做 rekey**。.vec 为「uint32LE dim 头 + float32 平铺行」二进制，
  路径不存于 .vec——寻址全靠 secondbrain.json `meta.notes` 键序（行序=键序×chunks）；
  JSON 侧 rekey 虽廉价，但首块文本混入笔记标题（ticket 110 标题入首块），保 mtime 会让
  旧标题首块在 refresh 中被 mtime 比对判「已最新」而永久滞留，重置 mtime 则成本与不 rekey
  相同。改名后的向量自愈走既有路径：doRefresh 删除失效键 + 新路径当新文件重嵌，
  findCandidates 存在性过滤（pipeline.ts:494）与 flushBatch 存在性过滤兜底 ghost 命中。

### 2. diary 内存路径同步（审计#15）
- `diaryDataMap` 键=entry.filePath（store.ts:37,135-137），墙开着时改名/删除条目文件
  → 跳转与媒体解析 stale，重开自愈。
- 新增轻量订阅：renamed → 更新 entry.filePath 与映射键；deleted → 移除内存条目
  （墙自动反映）。不落盘语义不变（快照读时回写机制不动）。
  订阅挂墙 show/hide/cleanup 生命周期（ui.ts subscribeRefSync，照 modify/unlock 先例）；
  改名移出墙目录按删除口径移出（movedOut 同语义）；store.ts 出纯内存口
  rekeyDiaryMapPath/dropDiaryMapPath（store 不挂监听的分层不变）。

### 3. checkup 孤儿检查扩展（审计结论「修复边界」）
- checks-orphans.ts 现查 favorites/clipbook/海报/封面。扩展：
  knowledge.json task.notePath / videoPath 指向文件缺失 → 报告条目；
  clipbook.json marks/pendingSource notePath 指向文件缺失 → 报告条目（现有 clipbook
  检查只覆盖 savedArchive，marks/pendingSource 为全新检查项）。
- 修复口径结论：现有框架带一键修复（fixOrphanIssues 按 fixGroup 定点清理 + notifyUndo
  撤销链）且目标均为插件自有 JSON → 按现有模式提供三组修复：
  `knowledge`（清任务 notePath/videoPath，任务本体保留，fixKey=`<id>|note|video` 分字段）、
  `clipbook-marks` / `clipbook-source`（移除失效记录，清空连键删，fixKey=JSON 数组编码
  防 find 串特殊字符，undo 按原索引插回）。读取沿用体检只读纪律（readRawJson adapter
  直读 + jsonScanTargets 收敛路径），不走域 jsonFileStore 读（会触发损坏留档写路径）。

## 测试

- secondbrain rekey：renamed 后队列/状态键更新、无重复入队。
- diary：renamed/deleted 后内存映射一致、墙渲染取数路径正确。
- checkup：构造孤儿路径 → 报告含新检查项。
- 门禁：`pnpm exec tsc --noEmit` + vitest（preview-freshness 排除；其余不得新增失败）。
  严禁在 worktree 内 build。

## 边界

- secondbrain related 双链本身靠 Obsidian 原生改名联动，不加扫描改写。
- diary 硬删无回收站为数据安全话题，非引用同步，不在本包。
