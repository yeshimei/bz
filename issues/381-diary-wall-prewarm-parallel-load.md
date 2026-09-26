# 381 日记本：启动后台预热墙数据 + 四目录并行加载

- 状态：已实现（待主构建部署）
- 提出：2026-09-19 用户
- 相关：ADR-0170；ADR-0003（懒加载）、ADR-0115（回忆墙升格日记本）、ADR-0047（domain-bus / 全插件唯一 vault 订阅点）

## 用户原话

> 日记本加载特别慢，可不可以bz启动时在后台加载日记本，同时优化性能，先给建议

> 1 + 2

（用户从我给的三条建议中拍板 ①四目录并行 + ②启动后台预热；③跨会话持久缓存本轮不做。）

## 落地形态

- **① 四目录并行**：`loadWallEntries` 旧实现四段 `await` 串行（日记 → 影视 → 信 → 书），
  wall-clock ≈ 四目录耗时之和；改 `Promise.all` 后 ≈ 最慢目录，成功路径合并/排序结果与旧串行等价。
- **② 启动后台预热**：`onLayoutReady` 尾段调 `prewarmDiary(app, () => this.unloaded)` ——
  rAF + setTimeout 延迟一拍到空闲，仅 `loadWallEntries` 填数据缓存，**不建 DOM / 不实例化控制器**
  （ADR-0003：UI 仍懒加载，不拖慢启动关键路径）；幂等；禁用插件（C13 守卫）不预热。
- **② 会话级缓存**：`loadWallEntries` 内部按 app 键控缓存——命中在途或新鲜结果直接复用，
  并发调用去重（开墙 + 预热并发时只读一盘）。
- **失效**：经 `core/domain-bus` 订 `vault:md-*` 四类（通用路对范围内 md 恒发，ADR-0047 契约；
  语义通道不重复订阅），命中四目录（日记/影视/信/书）即作废缓存，下次调用回源；
  换 app 即失效（测试逐例新建 app 天然隔离）。

## 口径与边界

| 项 | 口径 |
|---|---|
| 开墙语义 | `show()` 开墙读允许命中缓存秒开（`_allowCacheNext`，含关墙后再开）；其余 `loadAndRender`（刷新/写后回刷/重试）一律先 `invalidateWallCache()` 回源，保持「每次刷新即读盘」原语义 |
| 脏数据防线 | 双保险：读盘期间的写改由 domain-bus 事件作废（`invalidated` → 本轮结果不落缓存，下次回源）+ 刷新路径无条件回源；关墙期间写改同样被事件作废 |
| 加密条目 | 不入缓存——`mergeEncryptedEntries` 仍在 UI 层每次现取（避免缓存层触碰解密态） |
| 失败处置 | 加载失败不缓存（复位 ctrl），下次调用重新读盘；行为与旧「异常即重抛、无残留态」一致 |
| 目录判定 | 四目录命中判定单源 `config.inWallDirs`（data 失效订阅 + ui 两处订阅共用） |
| 订阅卫生 | 每轮加载前先摘上一轮订阅（防 offFns 累积）；`unloadDiary` 调 `invalidateWallCache()` 全清 |
| 不改的 | 数据格式、解析层、渲染/排序/分组、写链路、加密合并逻辑全不动 |

## 不做（本轮明确排除）

- ③ **跨会话持久缓存**（写盘/IndexedDB 存墙面数据，二次启动直接读）：失效面大（外部工具改文件绕过
  vault 事件即脏）、收益递减（②已覆盖会话内全部重复打开），留待实测 ② 后仍不够再议。
- 不改影视/书库目录实时解析（D6）语义；不给缓存加 TTL（事件失效已覆盖，TTL 只会引入无谓回源）。

## 改动文件

- `src/diary/data.ts`（`readWallEntriesFresh` 并行化 + `WallLoadCtrl` 缓存层 + `invalidateWallCache`）
- `src/diary/config.ts`（`inWallDirs` 目录判定单源）
- `src/diary/index.ts`（`prewarmDiary` 导出 + `unloadDiary` 复位）
- `src/diary/ui.ts`（`_allowCacheNext` 开墙闸门 + 两处目录判定收口 config）
- `src/main.ts`（onLayoutReady 接线，C13 守卫）
- `tests/diary/data.test.ts`（缓存/失效/去重/失败 9 例）、`tests/diary/ui.test.ts`（开墙吃缓存 + 刷新回源 UI 层 1 例）、
  `tests/smoke.test.ts`（启动调度真实读盘 + unload 复位 1 例）、`prototypes/diary/prototype-behavior.js`（行为包重出）
