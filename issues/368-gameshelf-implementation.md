# 368 · 实现：游戏架域（59，350 拍板完成）

> labels: wayfinder:task ｜ map: 346 ｜ status: open ｜ assignee: — ｜ blocked-by: —
> 上游：350 拍板票（已闭）、347 Steam 研究票（已闭，直连 API 可行）

## 拍板记录（用户 2026-09-17 逐项确认）

1. **定位 = 纯走 Steam 数据，零心智负担**（用户原话：类似小黑盒）——无状态机、无评分、无必填感想；数据全部自动来自 Steam，用户唯一动作是首次配置。md 正文自由可写感想（想写才写）。
2. **Steam = 直连自动拉库**：设置组填 SteamID64 + Web API key（免费，steamcommunity.com/dev/apikey）；GetOwnedGames（include_appinfo/include_played_free_games/skip_unvetted_apps=0）+ GetRecentlyPlayedGames；own key 查 own steamid 不受隐私设置限制（347 结论）；封面 = `cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg` 直拼。
3. **存储 = `我的/游戏/*.md`** 一作一笔记（影院范式）：frontmatter `tags`（游戏标签）+ Steam 管辖字段 `appid/playtimeMin/lastPlayed/cover/syncedAt`。
4. **报告 = 游戏自己的全量数据分析**（不照搬影院）：库总览（游戏数/总时长/今年新增）、时长排行 Top N、最近在玩（recently played）、游玩分布（口径诚实：Steam 仅提供 lastPlayed，无历史游玩记录）；成就查询成本高（逐游戏 API）列二版。

## 实现口径

- **同步对账**（数据层纯函数，重点可测）：打开面板自动同步 + 手动「立即同步」（lastSyncAt 间隔判定，仿 clipbook fetch）；Steam 管辖字段 upsert，用户正文/自定义 frontmatter 不碰；Steam 库中消失的游戏（退款/隐藏）笔记保留、标 `offShelf: true`（不删）。
- 面板：海报墙（封面网格 + 时长/最近在玩视图切换），overlay 范式（ESC/topifyZ/移动 `.bz-panel-mtop` 44px/遮罩点击关）；暗色全 token。
- 未配置 Steam 时：面板引导态（两键配置引导，不弹设置）。
- 命令 `bz-gameshelf-open`「游戏架」；main.ts 注册。
- 门禁：数据层（对账/合并纯函数）+ UI 层 + smoke 同步；门禁全绿。

## Resolution

（主会话直写，2026-09-17 完成；ADR-0161）

- **域文件**：`src/gameshelf/`（steam 拉库与响应归一 / reconcile 对账纯函数 / notes vault 读写 /
  sync 编排 / state / report 纯函数 / ui 面板 / settings schema / styles.css / index）。
- **接线**：`bz-gameshelf-open`「游戏架」（DOMAIN_ICONS.gameshelf=gamepad-2）；smoke 命令清单、
  设置面板「游戏架」域页（目录组 + SteamID64/Web API 密钥/自动同步开关）、home 磁贴、
  settings.ts 四键（gameshelfFolderPath/SteamId/SteamApiKey/AutoSync）；gameshelf 域事件
  （kind: synced）供 smartcat 行为流；无 json 数据文件，checkup 清单零扰动。
- **对账与覆盖取舍**（票面要求必写）：笔记身份取 appid 而非文件名——游戏名可改、文件名保持
  首次创建稳定（防改名误伤用户正文路径）；upsert 只碰六管辖键 + tags 保底「游戏」，用户正文与
  自定义 frontmatter 零覆盖；库中消失标 `offShelf: true` 保留不删、重新出现自动恢复在架并归入
  toUpdate。自动同步间隔 30 分钟（全库 syncedAt 取 max 判定；无笔记必过期 → 首开必拉），
  `gameshelfAutoSync` 关闭回落纯手动。
- **实测固化的口径**（347-steam-live-test）：错误三级分道（auth=密钥无效 / http=接口异常 /
  network=文案明示查系统代理——api.steampowered.com 国内直连被墙、requestUrl 跟随系统代理）；
  空库与空「最近在玩」的 response.games 均缺省兜底；无 img_logo_url，封面 header.jpg CDN 直拼
  （该 CDN 不走代理也可达）；playtime_forever=分钟、rtime_last_played=unix 秒。
- **测试**：`tests/gameshelf/reconcile.test.ts`（node，对账四分支+恢复在架+清洗消歧+响应归一+节律）
  + `tests/gameshelf/sync.test.ts`（jsdom，runSync 全链路 mock requestUrl + 用户数据零覆盖 +
  offShelf 往返 + 引导态/游戏墙/报告视图 + busy 防重入）；smoke 命令清单同步；
  settings-panel 域导航 18→19、home iconOf 计数 14→15 两处既有断言随域扩容更新。
- 门禁：tsc --noEmit 零错误；全量 vitest 仅 preview-freshness 环境性伪差异红（worktree 检出
  CRLF 假红，判据=主仓同守卫绿），本域相关全绿。
