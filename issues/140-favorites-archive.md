# Ticket 140 — 收藏本抽屉归档（纯冷存）

> grill-with-docs 会话拍板（Q1-Q8）。favorites.json 加法扩展，旧数据零迁移可读。决策依据见 ADR-0074，术语见 CONTEXT.md「归档」。

## 拍板记录

- **Q1 语义**：纯冷存不可见——归档条目从界面彻底消失，唯一用途是删除前的缓冲区（非 memo 完成式、非 literature 历史区式）。
- **Q2 字段**：`archived?: boolean` + `archivedAt?: string | null` 可选字段，旧数据无字段 = 未归档。
- **Q3 动作序**：打开 → 置顶 → 跳转笔记 → 刷新余额 → 编辑 → **归档** → 删除。
- **Q4/Q8 观察**：写观察；短文案「你归档了收藏《X》」（与删除同构），行为流 action=`archived`。
- **Q5 反悔**：不提供 UI 反悔（无查看面 → 抽屉不出现在归档条目上），手改 JSON 兜底。
- **Q6 确认**：openFlowDialog「归档确认」（无反悔故误触代价接近删除，不沿用置顶式原地生效）。
- **Q7 余额批量**：跳过已归档条目（冷存不发 API）。

## 实现

- `src/favorites/types.ts`：FavoritesItem 加 `archived?` / `archivedAt?`（注释标注 ADR-0074）。
- `src/favorites/ui.ts`：
  - `refreshData` 唯一装载点过滤 `!item.archived`——主列表/搜索/标签计数/批量余额随之全排除（`_fetchBalances` 遍历 currentItems，天然跳过冷存）。
  - 抽屉动作 6「归档」（icon `archive`，无条件显示；非 keepOpen：点即收抽屉 → confirm → `update(id, { archived: true, archivedAt })` → 观察事件 → refresh → `notice('已归档收藏', 'archive')`）；删除顺延为动作 7。
  - 新增 `_archiveItem`（对齐 `_deleteItem` 观察挂点模式：先取 item 拿标题，数据缺失不通知）。
- `src/smartcat/favorites-source.ts`：FavoritesActionEvent 加 `{ kind: 'archive'; title }`；`favoritesArchivedText`；`buildFavoritesStructured` action=`archived`。
- `data.ts` 零改动（归档走既有 `update` 浅合并；未归档条目不携带归档键，写路径最小扰动）。

## 测试

- `tests/favorites/data.test.ts`：旧格式零迁移可读 + 归档 update 落盘字段断言（12+2=14；未归档条目仍 12 键）。
- `tests/favorites/ui.test.ts`：动作序两处断言补「归档」；归档 confirm 成功（写盘+消失+toast）、取消保留、冷存全排除（主列表/搜索/标签计数）、批量余额只喂未归档、归档观察挂点 `{kind:'archive', title}`。
- `tests/smartcat/favorites-source.test.ts`：`favoritesArchivedText` / `buildFavoritesActionText` / `buildFavoritesStructured` archive 分支。
