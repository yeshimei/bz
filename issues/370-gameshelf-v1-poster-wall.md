# 370 · 游戏架 UI v3：V1 海报墙落域 + 数据统计面板 + 详情全量数据

> labels: wayfinder:task ｜ map: 346 ｜ status: open ｜ assignee: — ｜ blocked-by: —
> 上游：368 建域（已闭）、ADR-0161；本票 = UI 层重做（用户 2026-09-17 点版）

## 拍板背景

368 交付的 v2 游戏墙是「封面网格 + 报告页」的通用形态。用户在五版展示方向探索稿里点了
**V1 海报墙**（`prototypes/gameshelf/v1-poster-wall.html`，另四版留在主仓 prototypes/gameshelf/ 备查），
要求一次性到位：单源落域 / 移动端 / 亮暗双态（默认亮色）/ 真实数据 / 数据统计面板 /
点卡片开详情弹窗且「能获取的所有数据都展示」。

## 交付面

1. **单源**：全部在 `src/gameshelf/`（ui.ts + styles.css 重写；detail.ts / report.ts / steam.ts 扩容）。
   评审壳 `prototypes/gameshelf/` 与插件消费同一份源码；`build-preview.mjs` 的
   `BEHAVIOR_DOMAINS` 加 gameshelf（无 render.ts，只产行为包，编码同 encrypt）。
2. **游戏墙**（视图一）：门面 hero（列表首位封面模糊作环境底 + 排序口径标签 + 三个总览数字）
   → 工具行（6 档位 chips + 排序三档 + 搜索，吸顶）→ 封面网格（460:215 原比例、排名角标只给
   未筛选按时长排的前三、下架置灰挂角标、时长条基准 = 全库最长）。
3. **数据统计面板**（视图二）：5 张统计卡（在架/累计时长/从未启动/最近玩过/成就覆盖）+
   时长排行 Top10 + 时长档位分布 + 最后游玩年份分布 + 平台分项 + 最近玩过 + 口径诚实注记。
4. **详情弹窗**（core uiModal）：我的游玩数据（本地秒出：时长/折合天数/最后游玩/同步时间/
   在架态/平台分项条/成就进度）→ 成就（进度 + 稀有成就 + 逐条明细：名称、描述、全球解锁率、
   解锁日期，按稀有度升序，无成就页直接明说）→ 游戏资料（价格/类型/开发商/发行商/发行日期/
   平台/玩法/评价（含好评差评数）/Metacritic/推荐数/DLC/商店成就数/简中/官网/简介）→
   商店截图（点开 core 灯箱）→ 在商店打开。
5. **Steam 通道扩容**：appdetails 全字段 + appreviews 正负票 + 成就三接口
   （Schema / PlayerAchievements / **GlobalAchievementPercentages**——368 只读 Schema 内嵌的
   globalAchievement，多数游戏缺这个字段，全局接口才是权威来源）。
6. **移动端**：≤768px 真全屏（`--bz-vvh`）+ `.bz-panel-mtop` 44px 顶部避让；
   触屏无 hover → 封面时长/日期改常显；单列资料网格。
7. **亮暗**：全部 `--bz` token；唯一固定色是「压在封面图片上的文字/遮罩」
   （`--bz-on-overlay` + 半透明黑），那类文字跟随主题翻转反而看不清。
8. **面板基座换 core**：v2 自造的 `.bz-gs-mask/.bz-gs-panel` 退役，改
   `.bz-panel-overlay / .bz-panel-frame / .bz-panel-mtop`（13 域同款）。

## 取舍记录

- **详情两级缓存**（ADR-0163）：frontmatter 只回写**标量**（商店展示字段 + 成就三键）；
  截图 URL 与成就逐条明细放**会话内存**。理由 = 体积不可控（截图 8 张、成就可上百条），
  写进 frontmatter 会让笔记头部膨胀十倍；frontmatter 标量的价值是断网/代理没开时仍有内容可看。
- **票 368 的「成就查询二版」在此兑现**，且不止摘要——明细逐条上屏。
- **`GetRecentlyPlayedGames` 恒空**（实测 total_count=0，且库里最晚最后游玩 2026-08-23 →
  「近两周」窗口永远空）：统计页的「最近玩过」按**最后游玩日期**取前 8，文案不写「两周内」。

## 顺带修掉的 master 红

`src/gameshelf/settings.ts` 引用的 `gameshelfPosterFolder` 键在 master 的 `src/settings.ts` 里
没有声明（368 的海报缓存批次漏了），tsc 因 `SettingsKeyOfType<string[]>` 报错。
本票补上 `gameshelfPosterFolder: string` 声明与默认值。
⚠️ 并行会话（影院海报文件夹）在主仓工作区也改了同一处，合并时注意这段。

## 门禁

`tests/gameshelf` 全绿（reconcile 18 / sync 10 / posters 3 / ui 17）+ `tsc --noEmit` 零错误；
原型 CDP 自检 `?selftest=1` 覆盖桌面与移动两侧。

---

## 追加批（2026-09-17 晚，用户三批评审）

### 批一：展示中文名 + 头行收敛 + 遮罩毛玻璃
中文名（`GetOwnedGames` 只给英文名，得问 `appdetails?l=schinese`）→ 新增 `names.ts`
串行队列回填 frontmatter `中文名`（`filters=basic` 轻量、900ms 间隔、连错 3 条即停、幂等）；
展示口径单源 `state.ts` 的 `displayNameOf()`。头行去掉视图页签，改右侧工具位单按钮（默认游戏墙）；
桌面取消关闭钮；库内无变化时状态行留空；详情弹窗遮罩补毛玻璃（core `.bz-overlay-mask` 是平色）。

### 批二：移动端收口
头行三钮只留图标；工具行一行 = 搜索 + 档位下拉 + 排序下拉（`uiSelect`，桌面形态与移动形态都渲染、
媒体查询取一套）；面板高改 `100dvh` 去掉底部空隙（本面板没有贴底固定条，不吃 `--bz-vvh`）。

### 批三：媒体本地化（ADR-0164）
封面与图标下载到本地文件夹，属性 `封面`/`图标` 改写成 vault 路径；
新增 `封面源`/`图标源` 承载远端地址（同步管辖）+ `mediaPending` 迁移标记；
显示层四级兜底 + img `data-fallback-src` 重试。
**未做（已向用户说明）**：成就逐条明细与截图 URL 仍是会话内缓存——要不要落盘成
`CONFIG/STORAGE/gameshelf.json` 待用户拍板（会新增一个会被 Obsidian Sync 同步的缓存文件）。

### 域改名候选（待用户选）
域显示名（命令「游戏架」/ 首页磁贴 / 设置面板域页 / 面板标题）待定，候选清单已给用户。

