# 532 · 数据源同步拉不到微信新消息（用户实测：已导入联系人同步后 0 新增）

## 用户报的

> 脸谱，数据源同步，微信已经有新的聊天记录了，那些已导入的点击同步之后，仍然没有任何新的数据

---

## 排查（盘上实测，2026-10-01 凌晨）

数据根 `E:\Obsidian\微信脸谱数据\export_full`，逐层验证产物新鲜度：

| 层 | 结论 | 证据 |
|---|---|---|
| 解密层 | **新鲜** | `decrypt_cache.json` 指纹与源库全一致（updated 00:25，issue 498 增量按库重解工作正常） |
| sync 轮 stats.json | **新鲜** | 57 人全部重写，解密库里的新消息都数进去了 |
| **chat.json** | **过期** | 6 人落后于源：鸩（源到 09-30 20:14 / chat 停在 09-26 21:48，差 88 条）、BD、小妹、冰玉、出门记得带雨伞、微信团队 |
| 导入 | **断了** | `importDsSelected` 的 `hasChatJson` 命中旧文件即跳过 export 轮（485 的「免重复导出」），合进来的永远是旧 chat.json |

### 病根一：导入盲用旧 chat.json（485 两轮口径的漏账）

485 拆两轮时 sync 轮不再产 chat.json，导入侧给「已有 chat.json 的直接用」——当时只想到
省重复导出，没想到「同步拉到了新消息但 chat.json 还是旧全量」的中间态。sync 轮只更新
stats.json 不碰 chat.json，于是已导入联系人的新消息**永远**停在数据根、进不了保库记录。

### 病根二：「有更新」角标判据失灵（maxSid 根本不单调）

485 的 stats 路径哨兵用 `stats.maxSid > watermarkSid` 判新。实测鸩（消息横跨 5 个分库）：

```
message_1.db sid 最大: 2026-03-08 的消息  sid=9222338158405296780
09-30 全部新消息 sid:   3969975118417904159 一类（都比它小）
```

server_id 与时间**无序**，两边 maxSid 相等 → 角标永远不亮 → 用户在列表上看不到任何
「有更新」，选了人导入也是 0 新增。三层叠一起 = 「同步完没有任何新的数据」。

---

## 修法

- `datasource.ts` 新增 `statsHasNewerData(stats, store)`：`stats.lastCt`（源里最新消息秒级
  ct，跨分库 max）对比仓内最后一条**聊天**消息 ts（排除 type=9001 录音段——录音起点可以比
  一切聊天晚，不排会遮新聊天）。「有更新」角标与导入重导出共用这一判定。
- `ui.ts` runScan 角标换轴；`importDsSelected` 在导入时刻读盘上 stats.json 现算——
  缺 chat.json 的、以及源比仓新的，都进 export 轮名单（export 轮只用缓存密钥，不要求微信在跑）。
- `bz_sync.py` stats.json 幂等比对剥掉 syncedAt：原字节比对带着每轮必变的时间戳，
  「更新 N 位」永远虚胖成全量；改后没变的人如实报「未变」，用户看得出这轮同步到底更新了谁。

485 快路径保留：内容没变不重导（原用例改词保留 + statsHasNewerData 持平→false 纯函数钉住）。
「已导入且无新素材」在 UI 层本就被 issue 507 的 skip 水位禁勾，走不到导入判定。

## 测试

- datasource.test.ts：statsHasNewerData 五组纯函数用例（空仓 / 持平 / 9001 遮挡 / maxSid 退役 / 边界）。
- sync-button.test.ts：已导入 + 源有新消息 → 行出「有新消息」、导入重导出、新消息进仓（同键
  upsert 不翻倍——预置仓条目 key 用 msgKey 现算，假 key 会在合并里翻倍）。
- face-toolkit-python.test.ts：write_stats_json 真 Python 驱动——unchanged 不重写保留旧
  syncedAt、内容变了 updated、坏文件按重写兜底。

## 遗留

- cinema 原型产物基线即红（并行票的 src 已合、重出产物还在主仓库工作树没提交），
  本票不动它；本票 src 改动牵连的各域 behavior 包（全 src 打包）已随票重出。
- downloads/manifest.json 基线失 sync（bz-changelog.html 改了没重出清单），随票 chore 补上。
