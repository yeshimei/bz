# ADR-0161 · 游戏架建域：Steam 直连自动拉库，一作一笔记

日期：2026-09-17 · 关联：issue 368（实现票）、350（拍板）、347（Steam 可行性研究票）、ADR-0087（影院建域先例）、ADR-0115（目录唯一真理跨域化）

## 背景

游戏库需要一块自己的展示与统计面板。用户拍板定位「类似小黑盒、纯走 Steam 数据、零心智负担」：
无状态机、无评分、无必填感想，数据全部自动来自 Steam，用户唯一动作是首次配置
（SteamID64 + 免费 Web API key，steamcommunity.com/dev/apikey）。

347 研究票 + 主会话真机实测（`.scratch/memo-suite-plugin/research/347-steam-live-test.md`）确认通道可行：
GetOwnedGames（include_appinfo/include_played_free_games/skip_unvetted_apps=0）一次全量拉库，
own key 查 own steamid 不受资料隐私设置限制；`api.steampowered.com` 国内直连常被重置，
但 requestUrl 跟随系统代理可用，封面 CDN `cdn.cloudflare.steamstatic.com` 不走代理也可达。

## 决策

1. **存储 = `我的/游戏/*.md` 一作一笔记**（影院范式，ADR-0087）：frontmatter `tags` 保底
   「游戏」标签 + Steam 管辖字段 `appid / playtimeMin / lastPlayed / cover / syncedAt / offShelf`，
   正文与自定义 frontmatter 用户自由。**笔记身份 = appid**（游戏名可改、文件名保持首次创建稳定，
   Windows 非法字符清洗为全角横线，同名不同 appid 追加 appid 消歧）。
2. **同步对账 = 数据层纯函数**（`reconcile.ts`，重点可测）：Steam 管辖字段 upsert、用户数据零覆盖
   （processFrontMatter 只碰管辖键）；Steam 库中消失的游戏（退款/隐藏）**笔记保留标 `offShelf: true`
   不删**，重新出现自动恢复在架。节律仿 clipbook fetch：打开面板自动同步（lastSyncAt 间隔 30 分钟
   判定，全库 syncedAt 取 max）+ 手动「立即同步」忽略间隔；`gameshelfAutoSync` 开关关闭回落纯手动。
   同步完成经 domain-bus 发 `gameshelf` 域事件（kind: synced，供 smartcat 行为流观察，emit-and-forget）。
3. **网络错误分级人话报错**（实测教训）：密钥无效（401/403）≠ 接口异常（4xx/5xx）≠ 网络不通
   （requestUrl reject）——网络不通的文案明确提示「检查网络，国内网络需系统代理开启」，不把代理
   问题伪装成密钥问题。GetRecentlyPlayedGames 失败可容忍（增强信息，不阻塞库存对账）。
4. **报告口径诚实**：Steam 只提供 lastPlayed（最后游玩日期），无逐日游玩历史——报告为
   库总览（在架数/累计时长/近两周在玩/下架保留）+ 时长排行 Top 10 + 最近在玩（两周内有动静）+
   lastPlayed 月份分布（近 6 月），面板原文注记数据边界；成就查询（逐游戏 API，成本高）列二版。
5. **面板 overlay 范式**（对齐 secondbrain/panel.ts:311）：遮罩 + 弹层挂 body、ESC 走 escManager、
   topifyZ 动态层级、移动端 ≤768px `.bz-panel-mtop` 真全屏 + 44px 顶部避让 + `--bz-vvh`、
   桌面遮罩点击关；样式全消费 core/ui token，暗色随 `.theme-dark` 自动跟随，无固定色、无入场动效。
   未配置时面板内引导态两键（去配置 = 设置面板游戏架页深链 / 重新检测），不自动弹设置。
6. **接线**：命令 `bz-gameshelf-open`「游戏架」（DOMAIN_ICONS.gameshelf = gamepad-2，单一事实源）；
   设置面板新增「游戏架」域页（目录组 + Steam 组）；内容首页磁贴接入；无 json 数据文件，
   checkup files.ts 清单不动。

## 后果

+ 全库数据零手工登记：首次配置后打开面板即自动生长，退款/隐藏不产生孤儿数据。
+ 对账纯函数 + 真机实测口径（数据形态/错误分级/CDN 独立性）全部固化进测试，通道行为可回归。
− Steam 数据边界即功能边界：无逐日游玩史（无每日曲线）、成就推迟；依赖用户网络可达
  api.steampowered.com（系统代理），国内网络代理关闭时同步失败但有明确指引。
− 文件名与 Steam 展示名可能漂移（改名不跟随，防误改用户正文路径）；appid 才是稳定身份。
