# ADR-0031：smartcat 收藏本动作观察（方法监听）

Status: accepted（2026-08-23，ticket 078 用户拍板定稿）

## Context

收藏本（favorites）此前只有 blind 事件渠道：`src/smartcat/domain-source.ts` 的 favorites extract 按 `raw.length` 数量增长发「你收藏了一条新资源」——无标题、只增不减、删除后计数失真。影视（ADR-0027）/备忘录（ADR-0028）/聚合讯（ADR-0029）已依次落地「方法监听」样板：域 UI 确认回调 → `notify*Action`，文案构造集中 source 纯函数。用户延续拍板：收藏本同样只走方法监听——观察集 = 添加 / 编辑 / 删除 3 类；置顶/取消置顶不观察（不单独发观察，编辑里的置顶变化也不列入变化列表）；打开链接、跳转笔记、刷新余额不观察（不落盘或系统数据）。

## Options

- A（采纳）方法监听：favorites UI 三处挂点（`_saveNewItem` 添加/编辑分支、`_deleteItem`）成功回调调 `notifyFavoritesAction`，文案构造集中 `favorites-source.ts` 纯函数；domain-source 移除 favorites extract，防 JSON 事件通道与 UI 动作双记录。
- B 保留 domain-source favorites 计数观察 + UI 挂点双通道：同一动作「方法一条 + JSON 一条」双记录（影视 ADR-0027 已踩过的坑），且计数观察无标题、只增不减删后失真的缺陷留存——弃。
- C 事件快照 diff（vault modify 比对）：favorites.json 是 JSON 数据文件，逐字段 diff 无 UI 语义且 JSON 写入无中间态可辨——弃。

## Decisions

- 观察**只**来自方法调用，notify 放 try 成功路径（与 `notice('收藏已添加')` / `notice('收藏已更新')` / `notice('已删除收藏')` 同一位置），失败不通知：
  - `_saveNewItem` add 分支（`editingItemId` 为空）：`data.id = Date.now().toString()` → `dataManager.add(data)` 成功后 `notifyFavoritesAction({kind:'add', item: data})`（用最终落盘的 data 对象）；
  - `_saveNewItem` edit 分支（`editingItemId` 非空）：update 成功后，用 `all.find((d) => d.id === this.editingItemId)` 已取到的 old vs data 调 `favoritesEditChanges(old, data)` 生成变化列表 → `{kind:'edit', title: data.title, changes}`（old 缺失——并发删除——不通知）；`data.created = old.created` 等既有逻辑不动；
  - `_deleteItem`：删除成功后 `{kind:'delete', title}`（先取 item 拿标题，数据缺失不通知）。
- 文案构造集中 `favorites-source.ts`（纯函数可测）：
  - 添加=键值式：标题必填（UI 已校验）；追加字段顺序固定、有才加——分类（tags 全列顿号）→ 简介「…」→ 链接 url 原文 → 已置顶（仅 pinned=true）。
  - 编辑=α 变化列表：参与比较字段仅 title/description/url/tags（tags 用 join(',') 比较）；pinned/created/id/type/llmConfig/balance* 一律不参与；变化项 `改了标题`/`改了简介`/`改了链接`/`改了分类` 顿号分隔；无变化省略列表——发「你编辑了收藏《X》」不带尾冒号（本域所有事件均有观察，buildFavoritesActionText 返回 string | null 但恒非 null，签名对齐 memo/movie）。
  - 删除=仅标题「你删除了收藏《X》」。
- 置顶抽屉动作（置顶/取消置顶）、打开链接、跳转笔记、刷新余额一律不通知（用户拍板）。
- domain-source 移除 favorites extract（「你收藏了一条新资源」计数观察不再产，snapshotDomains/盲通道不再读 favorites.json）；`onVaultActivity` 对 `kind === 'favorites'` 防御性短接（favorites 是 JSON 数据域，classifyPath 只认 .md 本不产 vault 事件；ActivityKind 联合类型加 'favorites' 成员仅作类型许可，零运行时影响）。
- 守卫：`notifyFavoritesAction` 在 smartcat 未初始化 / `noteSource` 关闭时静默；观察即时同步，无 pending 机制，无 timer/map 需在 unload 清理。

## Consequences

- 收藏本动作观察语义化：一条动作一条记忆，有标题有字段（「你收藏了《X》：分类（…）、简介「…」…」），旧「只增不减、删后计数失真」缺陷解除；删除有标题可回看。
- smartcat 与 favorites 域新增依赖边：src/favorites/ui.ts → src/smartcat（notifyFavoritesAction / favoritesEditChanges）。方向单向（smartcat 不 import favorites 运行时——favorites-source 仅 type import FavoritesItem，编译期擦除），符合 ADR-0002 域间显式 import。
- 行为变更：旧「你收藏了一条新资源」计数观察被 UI 动作观察取代（domain-source favorites extract 移除）；旧记忆不迁移（兼容冻结）。
- favorites.json / smartcat.json 数据格式零改动；MemoryStreamEntry source `favorites`。
- 代价：手改 favorites.json、AIAgent 同步等非 UI 写入不再观察（用户拍板：方法监听天然排除批量同步）。