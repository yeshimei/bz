# 455 脸谱双卷画像：《其人》/《我们》+ 统计与档案弹窗化 + 大琳重画像

## 背景

现 `buildPortraitPrompt` 一张文混两条轴（人物表达层 vs 关系层），互相挤占篇幅；画像偏 distilly
表达层方法论，缺人物内核（性格/兴趣/价值观/习惯/情感倾向），关系侧散落无结构认知。
细化方案对齐社区提示词（titanwings/ex-skill 的 chat_analyzer 四维 + awesome-distill-skills
的 nuwa 五层心智模型/反模式/保留矛盾），并经大琳真实数据（18477 条）验盘：
月度密度 6221→31 是演变真信号但未喂 prompt；语音情感「难过 226 > 开心 138」未透用；
称呼/梗该归关系卷；小样本（莫莫 132 条）无可信度警示。

## 改动一：双卷数据模型（types.ts）

- `FaceDigest`：`portrait` → `person`（卷一《其人》）+ `bond`（卷二《我们》），旧字段保留可选作兼容读；
- 新素材类型：`InterestItem { ts, topic }`（兴趣信号）、`ThreadItem { ts, text }`（未竟之事）；
- 兼容读单源：`personOf(d) = d.person ?? d.portrait ?? ''`、`bondOf(d) = d.bond ?? ''`。

## 改动二：管线（digest.ts / insights.ts / incremental.ts / jobs.ts）

- 批采集 4→6 类：+interests（分享/安利具体内容、反复话题，≤15 字）、+threads（约定/邀约/
  「下次一起」/半截话题，≤30 字，只采集不判断兑现）；
- `MATERIAL_LIMITS` +interests: 40 / threads: 30，落盘与 moments/traits 同机制（增量不丢）；
- 画像阶段 2→3 次文本调用：其人（7 节）→ 我们（8 节）→ 编年史（best-effort 不变）；
  进度阶段 extracting / person / bond / chronicle；
- 卷一 7 节：画像速写（须含一组矛盾感）/ 性格与思维（行为规则化「当 X 时她 Y」+ 自我描述当线索）/
  表达 DNA（口头禅/句式/表情习惯/「不想理你」信号；称呼移卷二）/ 兴趣爱好（实际投入→内容口味→精神底色）/
  价值观与红线（全推断层强制「看来/似乎」+ 反模式）/ 习惯 / 情感倾向（voiceEmotion 计数直引）；
- 卷二 8 节：关系定性（手动 tags/metVia 优先，冲突以档案为准）/ 互动结构（statsNote 升一等素材，
  纯数字归指标卡 AI 只写解读）/ 演变阶段（月度密度支撑 + 转折点 + 消失与重现 + 现在在哪）/
  我们的语言（称呼演变 + 梗与暗语词典）/ 共同记忆 / 冲突与修复（触发点直接/推断分列 → 第一反应谱 →
  升级信号 → 收场；和解信号单独写，和解≠道歉）/ 未竟之事（threads 对照 events 判断兑现）/
  经营建议（手动 tags 翻译成相处规则）；
- 两卷各 ≤1200 字，受限语法不变（## / - / **粗体** / > 引用块）；
- `buildStatsNote(i, monthly?)` 增月度密度段（>12 个月按年合并）；
- 档案卡入 prompt：`FaceRunOptions.profile` → 两卷头部「素材〇：档案（手动信息，冲突以档案为准）」；
- 样本警示：messages < 200 时两卷 prompt 头注「样本偏少」。

## 改动三：UI（ui.ts / render.ts / styles.css）

- 详情折册：p 折拆「其人」「我们」两折（折序：其人 / 我们 / 事件 / 时间线）；
- 数据统计（d）与补充背景（f）两页改**独立弹窗**，入口改图标放详情头**返回图标前面**；
- 旧数据兼容读走 personOf/bondOf；jobs 进度文案同步四阶段；
- 样式入 `src/people/styles.css`（bz-people-* 前缀；滚动条不自造）。

## 改动四：大琳重画像（数据操作，不入库）

- `.scratch/people-two-volume/` 脚本：DeepSeek 直连（provider=deepseek / model=deepseek-flash，
  读插件 data.json），批级重试 ×3 + 断点续跑；
- 全量重跑大琳 18477 条 → person/bond/chronicle + 全量素材 → 备份 people.json 后写入
  大琳 digest（移除旧 portrait，更新 generatedAt / lastProcessedTs）。

## 门禁

pnpm test 全绿 + tsc --noEmit + 自审 + diff 审查 + 主仓库构建部署 + review 子代理。

## 评审追加（2026-09-26 快速原型轮，用户逐项拍板）

- **三折更名合并**：折序改「其人 / 相交 / 纪事」；编年时间线并入纪事折最前（「纪事 · 按月」分隔题头 + 按月折叠事件），大事记折取消；`FoldId` 收为 `p|b|e`。
- **朱砂戏台皮肤入库**：面板纸面金/朱双向晕染、收起折书脊金色缝线、展开折顶部朱红渐隐饰带、详情头印章落影。
- **长文层次排版**：miniMarkdown 重写为 bz-md-* 结构——印章字小节头（速/性/言/定…语义取字，编年按序号章）、条目行虚线分隔、行首（日期）抽日期签、`>` 引文卡、`**粗体**` 强调色。
- **H1 头部栏（居家档案型）**：56px 圆照金环（无头像回落首字印）、名旁手填标签印签、数字下地一行 meta；dt-nums 数字格移除，媒体明细归统计弹窗。
- **头像三处**：详情头照片 / 封面墙右上照片章（印章语义保留：金环已画、虚环待画，点击即补画）/ 数据源行照片；datasource 扫描探测 `<数据目录>/<联系人>/avatar.<ext>`，`localResourceUri` 支持插件端 app://local 与评审壳 /__real-media/ 双通道。
- **记一笔独立弹窗**：详情头铅笔图标（互动统计前），独立弹窗录入；纪事折内联录入行与按钮移除。
- **进度块精简**：只在对应联系人的详情页显示（done 不出块）；内容砍到进度条 + 一行状态 + 出错时错误行与按钮；`.bz-people-jobs` margin-top 20px、`.bz-people-dt-head` margin-top 15px。
- **评审壳真实数据**：preview-live 在行为脚本前同步注入 auto-seed（realdata.json = 真实 people.json / 预览桶 + 真实目录 DS_FILES 清单）；fake-sim 增加 DATA_DIR 钩子指向 `E:\Obsidian\微信脸谱数据\export_full`；新增 /__real-media/ 路由供壳内加载库外头像图片；壳内可对周宥希 / 徐雯静 / 可可 / 洛娗颖 / 丘羽 / 李燕姿 真实扫描与导入。
- 已知欠账：无。测试同步更新（foldBook 三参、三折、bz-md 结构、进度块详情页限定与一行文案）。

