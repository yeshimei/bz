# 480 · 在线资源下载清单 + 设置面板通用域「在线资源」组

- 状态：进行中（2026-09-27）
- 域：core（download-manifest 新增 / remote-asset / skin-pack / manual / changelog）+ settings-panel（通用 loader + 在线资源组 + 样式）+ main.ts（启动链）+ scripts（build-manifest 新增 / build-skin-pack / _gen-changelog）
- 来源：用户要求把更新日志、使用手册、皮肤三个在线下载收进设置面板通用新组，维护英文命名下载清单，启动拉清单对比更新状态；皮肤由用户决定下载
- 关联：ADR-0202（本票决策）· ADR-0199（皮肤包分发，加载策略被本票修订）· ADR-0200（文档资产新鲜度）· issue 473 / 474 / 475 / 476（在线下载三连的前史）

## 需求与拍板（grilling 两轮，2026-09-27）

用户原话：「把更新日志，使用手册，皮肤这三个在线下载，放到设置面板的通用中，新组。维护一个下载清单（使用英文命名），本地放到插件中的目录中（单独的目录）」；「点击……仍然先打开旧的，然后后台根据下载清单决定是否下载新版本，下载完之后进行热更新。皮肤由用户决定是否下载」；「未下载的会有一个下载按钮，已下载有更新的，会显示更新按钮，如果更新的有数量，会显示更新加数量。如果已下载且没有更新，会显示"已下载"，并且这个按钮会被禁用。每次启动bz，都会先拉取下载清单进行对比，然后更新新组」。

逐项拍板：

1. **半自动**（Q1 选 B）：启动对比永不动下载，只更新按钮状态；下载仅由用户点按钮或点日志/手册入口触发。
2. **皮肤下载仅入库**（Q2）：不自动应用，各域选择卡手动切换。
3. **失败可见**（Q3+Q8）：有缓存沿用缓存渲染 + 细字「检查更新失败」+ 重试；无缓存三行禁用 + 失败横条 + 重试。
4. **落盘 = 插件安装目录**（Q4 选 A）：`<configDir>/plugins/bz/`，恰为现行口径，零迁移。
5. **组名「在线资源」**（Q5），Q10 改：通用域**最后一组**（数据存储路径之后）。
6. **统一清单内联**（Q6 选 A）：仓库目录 `manual/` 改名 `downloads/`，`downloads/manifest.json` 单一事实源，`manual/skins/index.json` 退役。
7. **皮肤永手动**（Q7）：已下载有更新也不自动更，不点就停旧版；下架沿用自动删本地（Q9）。

## 改动

### 仓库与构建

- `manual/` → `downloads/`：**copy 冻结**（旧版插件双源 URL 过渡可达，内容停更；若干版本后删），新产物写 `downloads/`。
- `scripts/_gen-changelog.mjs`：产物路径改 `downloads/bz-changelog.html`。
- `scripts/build-skin-pack.mjs`：css 产出改 `downloads/skins/`；**不再产 index.json**（清单合并）；catalog 双向校验与 previewClass 校验保留。
- `scripts/build-manifest.mjs`（新增，`pnpm manifest`，带 `--check`）：汇总 docs（bz-changelog.html / bz-manual.html）与 skins 条目，normalizeEol+sha256（与插件端 textSha256 逐位一致），写 `downloads/manifest.json`。

### core 层

- **`core/download-manifest.ts`（新增，单源）**：`MANIFEST_FILE = 'downloads/manifest.json'`；`parseDownloadManifest`（docs 条目校验 id/name/file/sha256，skins 条目复用皮肤形状校验）；`refreshManifest`（双源拉取 → 写缓存 → 返回 { manifest, fromCache }）；`docStatus`（missing / updated / ready，读本地文件算 sha256 对比清单）；`cachedManifest`（读缓存）。
- `core/remote-asset.ts`：`remotesFor` 路径 `manual/` → `downloads/`；`refreshAsset` 增可选 `expectedSha256`（本地 hash 与之一致 → 直接返回 null，跳过远端拉取）。
- `core/skin-pack.ts`：清单消费改吃统一清单（`applySkinManifest`：下架清理 + 重验 + 注入 + 算 updateCount，**不下载**）；`loadLocalSkinPack` 改读缓存清单；手动下载入口 `downloadSkinUpdates`（限并发 4，拉全部非就绪）；本地就绪表 `skins/index.json` 退役（resetSkinPackState/seedSkinPackState 适配）。
- `core/manual.ts` / `core/changelog.ts`：refresh 传缓存清单 hash（省流）；文件名常量与入口 API 不变。

### main.ts

- 启动链 after 回调改：`refreshManifest` → `applySkinManifest`（对比+清理+注入，不下载）；失败静默（console.warn，UI 打开时自见失败态）。

### settings-panel

- `ui.ts` general loader：组 push 到**最后**（数据存储路径组之后）。
- **`online-resources.ts`（新增）**：`onlineResourcesGroup()` 返回 GroupDecl（name「在线资源」，icon `cloud-download`，单 custom 行自绘）；状态机按钮（下载 [M] / 更新 N / 已下载禁用 / 转圈）；失败横条 + 重试；动作接线 downloadAsset / downloadSkinUpdates，完成后重算重渲。
- `styles.css`：`.bz-sp-res-*` 段。

## 非目标

- 移动端专用形态（组随通用域 schema 自适应，不做独立移动布局）。
- 清单里出现未认识的 doc 条目时动态加行（内置默认表只认三行；扩展留待真实资源出现）。
- 插件自更新机制不动（本票只管资源层）。

## 测试

- `tests/core/download-manifest.test.ts`（新增）：parse 正常/坏形/错误页；refreshManifest 双源与缓存回写；docStatus 三态；expectedSha256 跳过与回落。
- `tests/core/skin-pack.test.ts`（改造）：applySkinManifest 不自动下载、下架删文件、updateCount 计数；loadLocalSkinPack 吃缓存清单；downloadSkinUpdates 只拉非就绪。
- `tests/settings-panel/online-resources.test.ts`（新增）：组在通用域末尾；三行状态机各态渲染；重试接线；下载动作后状态翻转。
- smoke.test.ts 同步。

## 门禁

worktree 内 pnpm test + `tsc --noEmit` 全绿后合并；`pnpm manifest` / `pnpm skin-pack` / `pnpm changelog` 产物在主仓库重出（生成器读 cwd git 历史）。
