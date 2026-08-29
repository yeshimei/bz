# Ticket 152：secondbrain.json/.vec Syncthing 冲突文件自动自愈

- 状态：进行中（worktree/sb-syncthing-conflict）
- 域：secondbrain
- 来源：用户反馈「secondbrain.json 总是因为 Syncthing 产生冲突文件」；参考小橘（smartcat）2026-08-29 落盘写前比对方案（提交 3325589），但诊断证明写前比对不足以覆盖本域

## 背景

### 现状（用户反馈 + 本地诊断）

`CONFIG/STORAGE/` 下存在冲突文件（Syncthing 对同步窗口内两端同时修改的同一文件保留的副本）：

- `secondbrain.sync-conflict-20260830-041207-6M2OGGC.vec`（25MB）
- `secondbrain.sync-conflict-20260830-041211-6M2OGGC.json`（3MB）

段级差异诊断（主文件 vs 冲突文件）：

| 段 | 主 | 冲突 | 差异 |
|---|---|---|---|
| meta.notes | 1670 | 1671 | only-conf 1 篇（文献盒/国产厂商联合推广新闪技术…md）；both-diff 4 篇 |
| panel | 有 | 有 | summary 相同（生成时间相同） |
| link.queue | 0 | 0 | 一致 |
| link.state | 4 | 5 | only-conf 1 条（文献盒/国产厂商联合推广新闪技术…md） |
| chatHistory | 0 | 0 | 一致 |
| .vec | 6478848 | 6479872 | 正好差 1 行 1024 维向量 = 4096 字节 |

**结论**：冲突 = 双设备各自 refresh 索引了不同的新笔记（桌面索引 A 篇、另一台索引 B 篇），meta/.vec 内容**真实分叉**。这不是无变化重写，写前比对（2026-08-29 止血）挡不住「两端真的都改了」。Syncthing 必然在两端同步周期内检测到同一文件双向修改 → 生成 `*.sync-conflict-*`。

### 小橘方案对照

小橘（smartcat）方向（提交 3325589）：写前比对跳过无变化写 + adopt 轮不再重写三份 JSON + 30s tick 防抖合并落盘。小橘数据写入频率很低（观察驱动 + 防抖合并），冲突窗口小；secondbrain 是 vault 事件驱动高频 refresh（每次库变更全量重写 meta+vec），冲突频率高得多。因此 secondbrain 除写前比对（已有）外，还需要**冲突文件兜底自愈**。

## 设计

加载（`store-file.loadStore` 串行链内）时扫描 `CONFIG/STORAGE/` 下 `secondbrain.sync-conflict-*.json` / `*.vec`：

### JSON 段级合并（mergeStoreWithConflict，纯数据层可测）

冲突 store 与主 store 逐段 union：

| 段 | 合并规则 |
|---|---|
| meta.notes | 键并集；同 path 取 mtime 大者（相等取主）；version/_dim 取主 |
| panel | 取 generatedAt 大者（null 视为旧） |
| link.queue | 按 path 去重并集（主序在前，冲突新增尾插） |
| link.state | 键并集；同 path 取 linkedAt 大者（无则保主） |
| chatHistory | 按 role+content 去重并集（主序在前），超上限截断最旧（沿用 CHAT_HISTORY_LIMIT） |

合并后写回主文件（经 saveStoreRaw 同款写前比对语义——差异必然存在则照写），随后删除冲突 JSON。

### .vec 行级重排合并（mergeVecByMeta）

行序不变式 = `meta.notes 键序 × 各篇 chunks 数`。合并后 meta 为权威：

1. 若主 .vec 行数 == 合并后 meta 需求行数（绝大多数：冲突仅差 link/panel/chatHistory，meta 未动）→ 直接删除冲突 .vec（主 .vec 已正确）；
2. 否则按合并后键序逐 path 重排：该 path 取「mtime 大者所在侧的 vec」对应行段拷贝（行偏移 = 该侧 meta 键序累计 chunks 数 × dim）；
3. 重排产物与主 .vec 字节比对（bytesEqual，沿用止血逻辑）：不同 → 写回主 .vec；相同 → 跳过；
4. 删除冲突 .vec。

### 兜底（重排失败/行数仍对不上）

主 .vec 删除 → 下次 refresh 走既有 `indexIncomplete` 自愈（ticket 107：meta 有条目但向量缺失 → 全量重建，断点续嵌 ticket 114 保护）。

### 边界

- 无冲突文件 → 一次 `adapter.list(dir)` 返回空，零开销；
- `adapter.list` 不可用/抛错 → 静默跳过自愈（不阻断加载）；
- 冲突 JSON parse 失败（损坏）→ 跳过该文件合并但**不删**（保留人工处置），console.warn；
- 冲突 .vec dim 与主不一致/不可读 → 不合并，走兜底；
- 自愈全程在串行写链内（loadStore 已 enqueue），与写入互斥；
- 静默自愈：不弹通知（数据层无 notice；同 jsonStore .corrupt- 留档静默先例），console.log 记录合并计数。

### 不做的（保留现语义）

- 不改变 `secondbrain.json` 数据格式（兼容性冻结）；
- 不新增 Syncthing 配置要求（.stignore 由用户自行决定，可选建议见下）；
- 不改写前比对 / 串行写链 / 30s 防抖等既有机制。

## 代码改动

- `src/secondbrain/store-file.ts`：
  - 新增 `mergeStoreWithConflict(primary, conflict)`（纯函数，段级 union）；
  - 新增 `reconcileConflictFiles(app)`（扫描目录 → JSON 合并写回删档 + vec 行级重排合并删档 + 兜底）；在 `readStoreRaw` 主文件读取成功后调用；
  - 头部注释补 ticket 152。
- `tests/secondbrain/store-file.test.ts`：新增冲突自愈用例（JSON 段级合并、vec 行级重排、无冲突零开销、损坏兜底、幂等）。

## 验收

- [ ] 主/冲突 JSON 各段 union 正确（meta mtime 择优、queue/state/chatHistory 并集去重）；
- [ ] .vec 行级重排：meta 附带新笔记 → 向量行跟随新键序，主 vec 行数不足时从冲突 vec 补行；
- [ ] meta 未动（仅 link 段冲突）→ 主 vec 直接复用，冲突 .vec 仅删除；
- [ ] 冲突文件删除、残留未合并损坏文件不删；
- [ ] 无冲突文件 → 加载零行为差（不落盘不删文件）；
- [ ] 全量测试 + tsc 全绿；构建部署通过。

## 后续（用户可选，非本票）

- 用户可在 vault `.stignore` 增加 `CONFIG/STORAGE/*.sync-conflict-*`，阻止 Syncthing 把冲突文件副本再扩散到其他设备（只影响传播，不影响本地生成后的自愈清理）。