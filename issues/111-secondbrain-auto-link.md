# Ticket 111：第二大脑自动双链管线（link agent）

- 状态：待开发
- 域：secondbrain
- 设计文档：`.scratch/secondbrain-link-agent/spec.md`（已评审定稿，含用户逐项拍板记录）
- 前置：ticket 110（切块剥离 frontmatter）先行合并——向量候选质量前提

## 任务清单

1. **数据层**：队列文件 `CONFIG/STORAGE/secondbrain_link_queue.json` 的读写/合并/消费移除；`related` 解析与幂等写入（单侧；`linkAgentMaxLinks > 0` 时截断，默认 0 = 不限，由 AI 自行决定）；
2. **管线**：落盘监听（范围 = `linkAgentScopes`，默认仅文献盒）+ 防抖聚合 → embedding 可达性探测（短超时）→ 增量索引 → `linkAgentScopes` 范围内向量近邻 Top8 → core AI 裁判（档案卡 prompt，严格 JSON 输出）→ 写入；
3. **队列消费**：域初始化时发现队列非空且服务可达即自动消费；完成发合并通知；
4. **死链清理**：metadataCache 删除事件 + 低频巡检，自动移除失效 `related`，有清理才通知；
5. **设置与命令**：⚙️ 弹窗加 `linkAgentEnabled` 总开关行（默认开），**联动明细设置显隐**——开启展开 `linkAgentTopK`(8) / `linkAgentMaxLinks`(0=不限) / `linkAgentNotify`(true) / `linkAgentAutoClean`(true) / `linkAgentScopes`('文献盒'，逗号分隔目录，同时决定监听与候选范围，风格同 aiAgentWatchedFolders) 五行，关闭整体隐藏，onChange 即时重渲染、各键独立持久化；命令 `bz-secondbrain-rebuild-links`（当前笔记重跑关联，不受范围限制但候选按范围过滤）；scopes 含 allowPaths 缺失目录时一次性引导提示；
6. **测试**：数据层（队列 CRUD / 幂等写入 / 清理逻辑 / 范围解析与默认回退 / 明细键默认值与读写）+ UI/通知层（开关联动显隐 / 通知触发条件），纯数据层文件标注 `// @vitest-environment node`，smoke 同步。

## 明确不做（用户拍板，防 scope 蔓延）

晋升流程｜负缓存｜标签/TF-IDF 多级候选器｜复习计划联动。

## 边界

- 只写新笔记侧 `related`，旧笔记零改动；
- encrypt 锁定文件跳过；
- 全量重建类长任务单写者纪律（增量任务不受限）。

## 验收门禁

- [ ] spec「验收标准」全项通过
- [ ] `pnpm test` + `pnpm exec tsc --noEmit` 全绿
- [ ] 构建验证通过，产物部署后真机冒烟（桌面建链 / 断网入队 / 桌面消费 三场景）
