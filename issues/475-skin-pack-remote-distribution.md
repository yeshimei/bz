# 475 · 皮肤包云端分发（主题轴远端化 + 唯一注入点）

- 状态：**已完成（2026-09-26 落地，v1.24.0 部署）**
- 域：core（新建 `skin-pack.ts`、扩展 `remote-asset.ts`）+ 被搬四域（smartcat / pomodoro / bookshelf / memo）+ settings-panel（外观组选择卡）+ scripts（皮肤切分与清单生成）+ `manual/skins/`（新目录）
- 来源：用户问「有些域有很多套皮肤，是不是也可以做成类似于日记更新和使用手册的在线下载的方式」（注：仓库并无「日记更新」通道，用户所指为**更新日志**）。
- 关联：**ADR-0199（本票决策）** / ADR-0020（样式按域拆分——本票在该 ADR 的注入否决上**开例外**）/ ADR-0105（布局×主题分层）/ ADR-0095（备忘录皮肤）/ issue 473·474（手册与更新日志的远端通道范式）/ issue 246（外观组范式）/ `docs/prototype-first.md`（单源口径）

## 落地记录（2026-09-26）

实现与设计定案一致，两处口径校正：

1. **「区间外不进卡」压过「卡片标不兼容」**：决策 7 写「卡片显式标『不兼容当前版本』」，决策 8 写「未下载/下架/区间外**不进选择卡**」——二者冲突，按决策 8 实现（不生效的东西不出现，与「未下载不进卡」同一条口径）。若日后要显式告知用户，需另开设计（例如设置面板加一行只读提示）。
2. **守卫测试文件名**：ADR-0199 决策 4 引用的 `tests/core/skin-pack-injection-guard.test.ts` 实际落在 `tests/core/skin-pack-split-guard.test.ts`（一并守「切分产物与源一致」与「唯一注入点」）。

实际产出：

- `src/core/skin-pack.ts`（唯一注入点）+ `src/core/sha256.ts`（纯 TS FIPS 180-4，比对前归一换行）
- `remote-asset.ts` 新增 `fetchAssetText` / `writeAssetText` / `ensureAssetWithHash`（本地 hash 匹配即复用，替代原「存在即跳过」）
- 四域切分产物 `src/<域>/skins/*.css` × 26（不进构建聚合），出版为 `manual/skins/` × 26 + `manual/skins/index.json`
- 切分/出版脚本：`scripts/split-domain-skins.mjs`、`scripts/build-skin-pack.mjs`、`scripts/skins.catalog.json`；npm 脚本 `pnpm split-skins` / `pnpm skin-pack`，二者均带 `--check`（守卫测试里跑）
- 启动编排：`scheduleSelfUpdateCheck(getApp, isUnloaded, after)` 新增 `after` 回调，`main.ts` 在布局就绪时先 `loadLocalSkinPack`（纯本地，不等 15 秒）、再由 `after` 串 `syncSkinPack`
- 原型验收页补链：`prototypes/pomodoro/skins.html` 直连九套远端皮肤文件；`prototypes/memo/prototype.html` 补 `skins/paper.css`
- 测试：`skin-pack.test.ts`（26）+ `skin-pack-catalog.test.ts`（29）+ `skin-pack-split-guard.test.ts`（6）+ `self-update-schedule.test.ts`（3）+ `tests/skin-pack-helpers.ts`（seed 就绪表公共辅件）；四域既有皮肤用例改为「先 seed 就绪表再断言」

## 子代理审查与修复（2026-09-26）

子代理只读审查（范围 `2f62a945..HEAD`）结论：**P0 无**；8 项怀疑点（切分正确性 / 构建隔离 / sha256 与 node crypto 一致 / 唯一注入点守卫 / 设置值保护 / 状态一致性 / 离线异常路径 / 版本区间）逐条验证**无问题**；提出 1 条 P1 + 3 条 P2，均已在合入前修掉：

1. **P1 `remote-asset.ts::ensureDir` 只建一级目录** → 皮肤落 `skins/<域>/<id>.css`，全新安装时 `skins/` 不存在；Obsidian `adapter.mkdir` 未文档化递归，非递归实现下 write 直接失败 → 远端皮肤**永久静默回落首套**（功能全失效）。改为**逐级 mkdir**（幂等 try/catch），并补断言 `skins/` 与 `skins/<域>/` 都建出来。
2. **P2 前 15 秒回落** → `syncSkinPack` 排在自更新巡检之后（启动 15s），只靠它会让用户上次选好的远端皮肤**每次重启的头十几秒**回落首套（像「皮肤被重置」）。新增 `loadLocalSkinPack`（纯本地、不碰网络）在布局就绪时先跑；版本区间按当下 manifest 判，自更新覆写后再由 `syncSkinPack` 重判。补 3 条用例（含「不发任何网络请求」）。
3. **P2 差集预筛不自愈** → 步骤 3 原用「本地索引的 sha256」判「是否要下」，索引说已就绪但文件被改写时会误跳过下载、要等下次启动才修。改为吃**本步验过的本地结果**，并补用例「本地文件被改写 → 当次启动即重下」。
4. **P2 sha256 边界缺测** → 补 55 / 56 / 64 / 1000 字节填充边界向量（前三个为定值，1000 与 node `crypto` 对拍）。
5. **额外加固（审查未提，自查发现）** → 唯一注入点守卫原本只扫 `.ts`；`src/**/*.css` 里的 `@import url(https://…)` / `url(http…)` 是绕过守卫的**第二通道**（且无 sha256 校验）。守卫补一条 CSS 侧扫描（现无命中）。

门禁（修复后）：`pnpm exec vitest run` 528 文件 / 7941 用例全绿；`tsc --noEmit` 0 error。



## 需求与拍板

原始诉求是「皮肤也做成手册那样的在线下载」，理由是「不想撑大插件包」。**该理由量化不成立**（现有皮肤零二进制资源，几十套纯 CSS 只值几十 KB）；真正成立的是**解开发版耦合**——新增皮肤不必发插件版本、不必进 changelog。

六轮 grilling 的结论全部固化进 ADR-0199，要点复述：

1. **术语**：布局 × 主题两条独立轴，**只有主题轴承载真皮肤**
2. **范围**：只搬主题轴 ≥2 值的域 —— smartcat 12 / pomodoro 9 / bookshelf 4 / memo 1，**共 26 套**；单值主题域与 `settingsPanelSkin` **不搬**
3. **包形态**：清单 + 每皮肤一 CSS，条目含 `id / domain / name / 预览色值 / 版本区间 / sha256`；零 JS
4. **通路**：复用 `remote-asset` 双源（raw → jsDelivr），落 `<configDir>/plugins/bz/skins/`
5. **注入**：**唯一例外点** `core/skin-pack.ts`，其余路径继续禁 + 守卫测试
6. **加载**：启动静默同步、不用按钮、**串在自更新检查之后**、无 24h 节流
7. **版本区间**：不在区间内 → 拒绝加载，卡片显式标「不兼容」
8. **兜底**：内置首套恒在；未下载/下架/区间外**不进选择卡**；下架 = 删本地文件
9. **预览**：随包下发，只显示本地已有皮肤
10. **排序**：内置首套恒首位，其余按清单顺序
11. **节奏**：一次全搬

## 任务分解

1. **`src/core/skin-pack.ts`** —— 注入单点 + 清单拉取 + sha256 校验 + 版本区间判定 + 落盘/清理；`remote-asset.ts` 扩展「本地 hash 比对」增量判据（现为「存在即跳过」）
2. **皮肤切分** —— 从 `src/<域>/styles.css` 切出非首套主题块。注意 smartcat 每套皮肤自带 `animation`（152 个 `@keyframes` 静态收敛在 `src/smartcat/styles.css`），需按名字归属随皮肤切走
3. **预览卡规则随包切走** —— **注意跨文件**：pomodoro 的预览卡在 `src/settings-panel/styles.css` 里引用 pomodoro 的 `--pz-<id>-*` 变量（`src/pomodoro/render.ts:25` 注释「三处同表」）
4. **清单生成器**（`scripts/`）+ `manual/skins/` 发布（走 git 推 `yeshimei/bz` master，与手册同路）
5. **`normalizeSkin` 白名单改造**（四域）—— `src/bookshelf/ui.ts:285/289/307` 是样板：写死 `SKIN_IDS` 会把远端皮肤 id **静默回落**；`classList.remove(...SKIN_IDS.map(...))` 要改成「按实际挂上的类摘」
6. **启动编排** —— `scheduleSelfUpdateCheck` 之后串行触发，失败静默
7. **选择卡渲染** —— 只列本地已有皮肤 + 「不兼容当前版本」标（未生效者不出现）
8. **守卫测试** —— 全仓除 `src/core/skin-pack.ts` 外不得出现 `<style>` 注入
9. **测试** —— 数据层（清单解析 / 版本区间 / hash 比对）+ UI 层 + `smoke.test.ts` 同步

## 风险

- **一次性迁移冲击**：上线时老用户 `skins/` 为空，其当前所选皮肤在首次下载成功前回落首套；墙内/离线用户此前只有内置首套。**用户已知悉并接受**（ADR-0199 后果节）
- **注入例外扩散**：铁律 9 的价值在「样式静态、单源、可审查」，例外一旦有第二处使用就废了 —— 靠单点封装 + 守卫测试兜底
- **跨版本契约**：皮肤与面板 DOM/token 耦合，插件改类名/token 会让远端皮肤静默失效，版本区间是唯一闸门
- **编号欠账**：issue 474 引用了「ADR-0198」但该文件不存在，本票未占用 0198（已用 0199），欠账待补
