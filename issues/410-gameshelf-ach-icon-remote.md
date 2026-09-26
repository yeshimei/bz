# 410 · 游戏库成就图标改远端直取（本地只留封面 + 库内图标 + 截图）

用户原话（2026-09-22）：

> 游戏库把所有的图标和截图都保存在了本地的文件夹当中，导致 Obsidian 启动速度特别慢，有什么解决方案吗？先不写代码

诊断后追问「如果只保存游戏封面和截图，一共有多少张」，得到 1,248 张（封面 144 + 截图 1,104）。
中途口径变过两次，最终落到线上这条：

> 你做了什么东西？我的意思是让你帮我把文件夹中成就缓存在本地的图标给删了，不是让你修改代码。
> 代码的常用图标仍然是在线获取的，只是不再保存在本地而已

即 **成就图标照常显示、只是不往本地存**。文件清理与代码改造是两件事，本 issue 都记。

## 背景（只读盘点真实 vault `E:\Obsidian\叫我包仔`）

| 项 | 值 |
|---|---|
| vault 总文件数 | 26,247（28 GB，其中图片 17,621 张） |
| `CONFIG/GAME POSTER` | **9,512 个文件**（占 vault 文件数 36%），内容仅 635 MB、平均 70 KB |
| ├ 成就图标 `-ach-` | **8,118** |
| ├ 商店截图 `-shot-` | 1,104（147 款，每款最多 8 张） |
| ├ 库内小图标 `-icon` | 146 |
| └ 封面 `<appid>.jpg` | 144 |
| vault 所在盘 | E: = USB 外接 SSD（Xiaomi PSSD）；内置 NVMe 的 D 盘余 339 G |
| 社区插件 | 58 个 |

关键判断：**拖慢启动的是文件数量，不是体积**（9,512 个文件只有 635 MB）。Obsidian 每次启动
都要遍历 vault 全部文件做索引 diff，而 `userIgnoreFilters` 里已设的 `CONFIG/` 只影响
搜索 / 反链 / 图谱，**对启动扫描无效**。

另查明：bz 游戏库是纯懒加载（`main.ts` 只注册命令回调，`ensureGameshelf` 不遍历 vault），
启动时本域开销为 0——不是本域在启动时读图。

归因提示（未验证，留给后续排查）：vault 在 USB 外接盘、58 个社区插件（dataview / omnisearch /
smart-connections / find-unlinked-files 等会遍历全 vault）都比图片更可能是主因。本次只处理
用户拍板的图片口径这一项。

## 拍板（2026-09-22）

- **成就图标不本地化**：不下载、不落盘、属性里也不存地址；界面直取 Steam Schema 给的远端 URL。
- **封面 / 库内小图标 / 截图照旧本地化**（判据 = 是否随条目数膨胀：这三类都是每款一两张的固定量）。
- `成就` 行恒 **6 段**（撤销 ADR-0167 第 1 节）。

## 交付

**① 数据层（`posters.ts`）**
- 删 `localAchIconPath` / `achIconDisplayUrl` / `AchIconJob` / `ensureAchIcons` /
  `achIconsMissing` / `safeNameSeg`。
- 封面 / 库内图标（第一条队列）与截图（第二条队列）逻辑**原样保留**；第二条队列的注释与
  间隔口径改为只服务截图。

**② 成就行（`steam.ts` / `detail.ts` / `backfill.ts`）**
- `achRowText(row)` 去掉 `icons` 参数，恒 6 段；`achRowFromText` 删 `iconPath` / `iconGrayPath`
  返回；`achRowSegCount` 与 `achIconPathsMissing` 一并删除。
- `achToFm(d)` 去掉 `appid` 参数（不再需要推路径）。
- `backfillNeeds` 的成就判据收窄为「有成就页却缺全量列表」，删图标缺档判据与 import。

**③ 界面（`ui.ts` / `styles.css`）**
- `achListHtml` 的图标列**保留**，`<img src>` 直接吃 `r.icon` / `r.iconGray`（Schema 远端 URL）；
  没给地址的行画 `.bz-gs-achicon--none` 占位块，灰图缺失仍回落彩色 + CSS 灰度。
- `.bz-gs-detail-icon`（详情弹窗游戏名左侧小图标）与其 `iconDisplayUrl` 调用**不动**。
- `modalRepaintFn` 收窄为「只重画截图段」——成就段不再有随下载变化的东西。
- `AchievementRow.icon` / `iconGray` 字段保留（它是 Schema 的产物，不是本地路径）。

**④ 假层（评审壳）**
- `fake-sim.ts`：`achRowsOf` 行改 6 段；`SEED_MARK` v9 → v10（种子内容变了必须升版）。
- `fake-obsidian.ts`：删掉「`<appid>-ach-<apiname>-{on,off}.jpg` → 罐头 icon/icongray」这条
  映射（含只为它存在的 `safeNameSeg`）——成就图标不再走 vault 资源解析，`<img src=远端>`
  在浏览器里不受 CORS 限制，评审页照样看得到真图。截图那条映射保留。

## 效果

- 游戏库媒体：9,512 → **1,394 张**（封面 144 + 截图 1,104 + 库内图标 146），**-85%**。
- vault 总文件数：26,247 → **18,129**（-31%）。

## 已知代价（方案 A 的取舍）

- **从属性反解的那批成就行没有图标**：属性里不存图标地址（这是「不落盘」的必然结果），
  所以纯离线翻详情时成就段是占位块；打开详情若 `成就更新` 超过 24h 会静默重拉一次，
  拉回来（Schema 的远端 URL）当场就有图，**不写盘**。
- 断网 / 代理未开时成就段同样只有占位块——数据（名字 / 解锁态 / 全球率）全在属性里，一个不少。
- 备选方案（把远端 URL 存进第 7/8 段，离线也有图）被否：属性体积 +约 1.4 MB，
  且用户要的是「不存本地」，不是「属性变胖」。

## 存量数据清理（2026-09-22 已完成）

- **8,119 个** `*-ach-*.jpg`（8,118 个成就图标 + 1 个此前的漏网文件，共 89 MB）
  **已同盘移动到 vault 外**：`E:\Obsidian\_bz-media-archive\20260922-ach-icons\`。
  核对：归档目录 8,119 个且非 `-ach-` 文件 0 个；`CONFIG/GAME POSTER` 剩 1,394 个、
  `-ach-` 残留 0；`-icon` 146 / `-shot-` 1,104 / 封面 144 三项完好。
  用户的 vault 从下一次重启起不再索引这 8,119 个文件。
- 归档目录可随时整体删除（未 `rm`，先留退路）；确认无误后自行清理即可。
- **属性**：存量笔记的 `成就` 行是 8 段，末两段指向已移走的文件。解析侧只取前 6 段
  （无害，已有测试覆盖），打开详情时若 `成就更新` 超过 24h 会静默重拉、写回 6 段自然收敛。
  **不做强制迁移**——全库强制重拉要 147 款 × 3 个接口，为清一段文本不值得。

## 门禁

- `tsc --noEmit`：绿
- `vitest run --exclude tests/preview-freshness.test.ts`：474 文件 / 7,038 例全绿（域内 12 文件 / 172 例）
- worktree 内按 `docs/prototype-first.md` 跳过 `preview-freshness`；
  `prototype-behavior.js` 重出与 `pnpm run build` 回主仓做。
