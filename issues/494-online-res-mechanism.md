# 494 · 在线资源机制四改：清单驱动行集合 + 组级全部更新 + doc 版本区间 + 条目体积

- 状态：进行中（2026-09-27）
- 域：core（`remote-base` 新增 / `download-manifest` / `remote-asset` / `self-update` / `skin-pack`）+ settings-panel（在线资源组）+ scripts（`build-manifest`）
- 来源：用户采纳 `review-online-resources.md` 第 1–5 条（「采纳 1 2 3 4 5」）
- 关联：ADR-0207（本票决策）· ADR-0203（统一下载清单与在线资源组成立）· ADR-0205（组回归通用声明行）· issue 480 / 490 / 492

## 需求

用户原话：「采纳 1 2 3 4 5」，即清单里第 1–5 条：

1. 「在线资源」组改**清单驱动**，删掉写死的四行（★★★，S）
2. 组级「全部更新 / 全部下载」按钮（★★，S）
3. doc 条目补 `since` / `until` 版本区间（★，S）
4. 行描述带上体积（★，S）
5. 资源通道与自更新通道合并双源常量（★，S）

第 1 条是纲：issue 480 当时把「清单里出现未认识的条目时动态加行」列为**非目标**（「扩展留待真实资源出现」），
此后资源从 3 条涨到 4 条（归物分类表），而本次盘点又提出十余条候选——每加一条都要动
`FALLBACK_ROWS` + 构建脚本两处，是纯手工税。

## 改动

### 仓库与构建

- `scripts/build-manifest.mjs`：
  - 新增 `fileSize(rel)`（对 `downloads/` 已出版产物 `statSync`，产物缺席沿用 `fileSha256` 的报错口径）；
  - docs 与 skins 条目各带 `size`；
  - 新增显式行序表 `ROW_ORDER = ['changelog', 'manual', 'skins', 'belongings-categories']` 并产出到清单顶层；
  - 新增行序守卫：`ROW_ORDER` 必须覆盖 DOCS 全部 id、必须含保留 id `'skins'`、除 `'skins'` 外不得有 DOCS 里没有的 id。

### core 层

- **`core/remote-base.ts`（新增，零依赖叶子模块）**：`REPO_BASES`（GitHub raw 主 → jsDelivr 备）、
  `repoRemotesFor(name)`（仓库根文件）、`downloadRemotesFor(fileName)`（downloads 资产）。
  `remote-asset.ts` 的 `remotesFor` 与 `self-update.ts` 的 `REMOTE_BASES` 都改为消费它（行为逐字不变）。
- `core/download-manifest.ts`：
  - `ManifestDocEntry` 加 `since?` / `until?` / `size?`；`SkinPackEntry` 加 `size?`；
  - 新增导出 `SKINS_ROW_ID = 'skins'`（皮肤聚合行的保留 id，不是 doc 条目）；
  - `DownloadManifest` 加可选 `rowOrder?: string[]`；
  - `parseDownloadManifest` 收新字段：`since` / `until` 只认非空字符串；`size` 只认有限正数；
    `rowOrder` 必须是「逐项非空字符串的数组」，**任一不合格只丢弃该字段**（回落默认行序），不让整份清单失效。
- `core/skin-pack.ts`：`isInVersionRange` 首参泛化为 `{ since?: string; until?: string }`（doc 条目复用同一条判定）；
  `readPluginVersion` 加 `export`（消费方 = 在线资源组做 doc 区间过滤）。

### settings-panel 层

- `online-resources.ts` 重构：
  - 删除 `FALLBACK_ROWS`；行集合 = 清单 `rowOrder`（缺失回落 `docs 顺序 + skins 末位`；
    `rowOrder` 漏提的 doc 与 `skins` 都补在末尾），无清单 → **没有资源行**；
  - 新增恒在 `rows[1]` 的「全部更新」行（无待办 → 「已是最新」禁用；只有未下载 → 「全部下载 N」；
    无清单 → 「等待检查更新」禁用）；
  - doc 行按插件版本过滤区间外条目；就绪描述捎带规模与体积（`已是最新版本（26 组 515 条，318 KB）`）；
  - 行集合变化（清单增删条目 / 改 `rowOrder`）时**本轮不补丁**——DOM 行数与行对象不再对位，硬补必错位，
    等面板重开按新清单重建整组；
  - 下载动作抽 `downloadOne(app, manifest, id)`，单行 `runAction` 与组级 `runAll` 共用；
    `runAll` 逐条落盘后同步一次（逐条可见进展），失败聚合成一条通知，`__all__` 哨兵拦重入。

## 非目标

- 不做「清单变化即整组重渲」的通道（低频事件，重开面板即得）。
- 不把 AI / Jev 服务商注册表远端化（`review-online-resources.md` 附录已记账：报文格式与档位语义要代码支撑）。
- 不动 `downloads/manifest.json` 的出版与主仓构建（收尾时在主仓一次性做）。

## 测试

- `tests/core/download-manifest.test.ts`：doc 的 `since` / `until` / `size` 解析与坏值丢弃；skin 的 `size`；`rowOrder` 正常/坏形丢弃/缺席回落；必填字段缺失仍整份失效（回归）。
- `tests/settings-panel/online-resources.test.ts`：组形状（两行操作行恒在组首）；清单驱动行集合与顺序（含 rowOrder 与回落）；版本区间过滤；体积（doc 与皮肤合计）；全部更新行四态与组级动作；原有失败态/动作/跨入口同步/补丁边界全部保留并按新索引对齐。
- `tests/smoke.test.ts`：无清单 → 只剩两行操作行、全部更新禁用。

## 门禁

worktree 内 `pnpm exec tsc --noEmit` + 相关测试文件全绿；全量测试与产物重出（`pnpm manifest` / `pnpm skin-pack` / `pnpm changelog`）回主仓做。
