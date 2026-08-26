# Ticket 120：第二大脑数据文件整合——JSON 全并 single 文件 + vec 改名 + 遗留清理（用户拍板）

- 状态：已实现（worktree/sb-single-file）
- 域：secondbrain
- 来源：双链体验优化讨论，用户拍板：「改名为这个 secondbrain.json……把这个实现的里面所有的本地数据存储，都放在一个文件当中，不需要分散成多个」「secondbrain_vectors.vec 改成 secondbrain.vec 那就写成两个文件吧，遗留的文件删掉吧」
- 关联：issues/111（双链管线）、issues/119（基准哈希）、`src/secondbrain/{config,vector-store,panel,store-file}.ts`、`src/secondbrain/link-agent/data.ts`、`.scratch/secondbrain-link-agent/spec.md`

## 背景

第二大脑域目前本地数据分散在 5 个文件：`secondbrain_meta.json`（索引元数据）、`secondbrain_vectors.vec`（二进制向量）、`secondbrain_panel.json`（AI 概括缓存）、`secondbrain_link_queue.json`（双链待处理队列）、`secondbrain_link_state.json`（正文基准哈希，ticket 119 新增）。用户拍板统一为**两个文件**：

- `CONFIG/STORAGE/secondbrain.json` — 全部 JSON 数据（meta / panel / link 三段）；
- `CONFIG/STORAGE/secondbrain.vec` — 二进制向量（原 `secondbrain_vectors.vec` 改名）。

并删除旧名时代遗留 `ai_completion_meta.json` + `ai_completion_vectors.vec`（已有 9.5MB + 80MB 残留）。

## 设计

### 单文件结构 secondbrain.json（v1）

```json
{
  "version": 1,
  "meta":  { ...原 secondbrain_meta.json 全部内容... },
  "panel": { "summary": "...", "generatedAt": 123 } | null,
  "link": {
    "queue": [ { "path": "...", "hash": "...", "queuedAt": "..." } ],
    "state": { "笔记路径": { "hash": "...", "linkedAt": "..." } }
  }
}
```

### 一次性迁移（零丢失）

首次加载（`loadStore`）时若 `secondbrain.json` 不存在而旧文件存在 → 读旧合并 → 写新 → 删旧：

- meta ← `secondbrain_meta.json`（存在才读，版本校验沿用 v9 重建语义）；
- panel ← `secondbrain_panel.json`；
- link.queue ← `secondbrain_link_queue.json`（数组容错）；
- link.state ← `secondbrain_link_state.json`（对象容错）；
- vec：`secondbrain_vectors.vec` → 改名 `secondbrain.vec`（adapter.rename 不可用时读改写删兜底）；
- 迁移完成即删除全部旧文件；幂等（新文件存在即跳过）。

### 共享数据层 store-file.ts（新文件）

- `getSecondBrainStorePath() / getSecondBrainVecPath()`（storagePath 唯一口径，同 ADR-0009）；
- `loadStore(app)`：读整文件 → parse（损坏 → 留档 .corrupt- 重建空结构，jsonStore 同款容错）→ 段结构校验；首次触发迁移；
- `mutateStore(app, fn)`：**串行写链**（模块级 promise 链），读 → fn 改内存对象 → 全量写回。meta/panel/queue/state 四个写方共用同一链，杜绝并发交错覆盖；
- 纯数据层（无 DOM / 无 notice），node 环境可测。

### 消费方改造

| 消费方 | 现读写 | 改后 |
|---|---|---|
| `vector-store.ts` | load/saveStore 直读写 `secondbrain_meta.json`；loadVectors/saveVectors 直读写 `secondbrain_vectors.vec` | meta 段经 `loadStore/mutateStore`；vec 路径改 `secondbrain.vec` |
| `panel.ts` | readCache/writeCache 直读写 `secondbrain_panel.json`；renderStats stat 两个旧文件 | panel 段经 store；统计 stat 改两个新文件 |
| `link-agent/data.ts` | queue/state 各自 `jsonStore` 独立文件 | link 段经 store（`getLinkQueueFilePath/getLinkStateFilePath` 删除，对外 API 签名不变） |

### 明确不做（防蔓延）

- 向量 `.vec` 不 JSON 化（二进制保留独立文件——用户拍板「写成两个文件」）；二进制格式（dim 头 + float32 平铺）与行序布局不变；
- `ai_completion_*` 遗留删除为**本地清理动作**（用户拍板），不进插件迁移代码（跨设备传播删除风险）；
- `*.sync-conflict-*` 冲突副本不碰；
- smartcat 域 `smartcat.json / smartcat-memory-vectors.vec` 不碰。

## 任务清单

1. **store-file.ts**：路径 + loadStore（含一次性迁移 + 损坏容错）+ mutateStore 串行写链；
2. **config.ts**：META_PATH → STORE_PATH（secondbrain.json）、VEC_PATH → secondbrain.vec；
3. **vector-store.ts**：load/saveStore 改 meta 段、loadVectors/saveVectors 改新 vec；
4. **panel.ts**：概括缓存改 panel 段；renderStats 统计路径改新文件；
5. **link-agent/data.ts**：queue/state 改 link 段（对外签名不变）；
6. **测试**：适配 4 个 vector-store/panel 测试 + 2 个 link-agent 测试的路径/预置结构；新增 store-file 迁移与串行写链测例；
7. **文档**：spec 数据设计节 v1.5、CONTEXT 词条、AGENTS 领域清单、PROGRESS。

## 验收门禁

- [x] 迁移测例：四旧文件 + 旧 vec → secondbrain.json 三段正确组装、旧文件删除、vec 改名、幂等跳过；
- [x] 串行写链测例：并发 mutate（meta + link 同时写）不互相覆盖丢失；
- [x] 既有 secondbrain 全量测试适配通过（路径/预置结构/断言全部换代）；
- [x] `pnpm test` + `pnpm exec tsc --noEmit` 全绿；
- [ ] 构建部署后真机冒烟：存量库升级后统计/检索/双链照常，`secondbrain.json` 生成、旧 JSON 消失、`secondbrain.vec` 就位。