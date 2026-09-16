# 347 · 研究：游戏架接 Steam 数据的可行性（59）

> labels: wayfinder:research ｜ map: 346 ｜ status: closed ｜ assignee: research-subagent ｜ blocked-by: —

## Question

新域「游戏架」想接 Steam 游戏数据（用户提议）。在 Obsidian 插件环境（`requestUrl`，桌面+移动端）下，可行性如何？要回答：

1. **数据可得性**：Steam Web API（IPlayerService/GetOwnedGames、GetRecentlyPlayedGames 等）能拿到哪些字段——游戏名、appid、累计时长、最近时长、封面图 URL、成就？各字段的实际可用性？
2. **前提条件**：需要用户提供什么（SteamID64？Web API key？个人资料隐私设置？）。重点核实：2023 年后 Steam 默认将游戏库设为私有，GetOwnedGames 对私有库返回空——用户侧要怎么开启才能读到？有没有不需要 key 的路（如 XML profile、第三方只读接口）？
3. **限制**：rate limit、key 的申请门槛、移动端 requestUrl 可达性（api.steampowered.com / store.steampowered.com）。
4. **结论**：给「接 / 不接 / 变通接」（如手动导入 + 封面自动补）三种结局各自的事实依据。

## Resolution

**结论：推荐「直接接 Steam Web API」，手动导入作兜底；不存在不可行阻塞。**

1. 数据可得：`IPlayerService/GetOwnedGames`（全库）+ `GetRecentlyPlayedGames`（近两周）一次 GET 拿 name/appid/playtime（分钟）/最后游玩时间/图标；成就走 `ISteamUserStats`。票面 `rimg_icon/rimg_logo` 实为 `img_icon_url/img_logo_url`（hash，需 `include_appinfo=true`）。
2. 封面不依赖响应字段：`https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg`（Akamai 域名互备）按 appid 直拼，实测 200。
3. 前提：用户自备 SteamID64 + 免费 key（steamcommunity.com/dev/apikey，受限账号除外）。**关键：Valve wiki 明文——own key 查 own steamid 可绕过隐私设置**，包仔场景（用户查自己）无需引导开公开；`GetPlayerSummaries.communityvisibilitystate` 可编程探测。
4. 纠偏：「默认库私有」是 2018-04（GDPR，非 2023）；2025 年新增的是单游戏粒度私有。
5. 限制：terms 明文 100k 次/天/key，单用户绰绰有余；请求须带 `include_appinfo=true` + `include_played_free_games=true` + `skip_unvetted_apps=0`（缺游戏坑）。匿名路（profile `?xml=1`）可用但 Valve 官方标注 deprecated，仅作兜底。
6. 落地建议：主路径「自备 key + SteamID64 定时/手动同步」；设置页注明 key 本地存储勿共享；保留「手动录入 + appid 自动补封面」兜底。

详细调研（字段明细、URL 拼法、隐私与限额、来源清单）：`.scratch/memo-suite-plugin/research/347-steam-feasibility.md`

status: closed
