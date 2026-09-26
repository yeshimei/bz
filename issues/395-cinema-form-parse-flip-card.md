# 395 · 影院「添加影视」改版：解析按钮 → 豆瓣预取 → 双面翻转卡片

> labels: feat ｜ map: cinema ｜ status: done ｜ assignee: — ｜ blocked-by: —
> 上游：issue 394（影院 Jev 命令全删——本票是它的**替代品**，不是复活）／ADR-0173（Jev 决策通道）
> 实现于 `wt/bz-cinema-parse`

## 背景

issue 394 删掉了影院类型判定的命令形态：它的跳过条件「已有受控分类即跳过」在真实库（686 篇全有分类）下一次都不会触发，而**默认值「电影」造成的隐性错分类**才是高频问题（新建表单 `initTag` 硬编码 `'电影'`，忘了改就落盘）。本票把自动分类接到**添加流程本身**：分类的材料（豆瓣字段）在解析时才存在，判定就该发生在那一刻。

设计经 grill-with-docs 拷问（Q1–Q15），中途**整体改向一次**：原方案是「表单内预取 → 预选类型 chip」，用户看完改为——

> 保存按钮改成解析；点解析出 loading；完成后翻转卡片，翻到背面展示所有信息；分类和状态允许用户点改。

## 决策（2026-09-21 用户拍板）

| # | 决策 |
|---|---|
| 材料 | **全交 Jev**，不做确定性规则短路——规则要处理优先级（纪录片压过 is_tv）、多值区域、脏数据，写完不比提示语短还更脆 |
| 候选 | `ALL_TAGS` 去掉「公开课」（公开课不参与自动分类，手选仍可用）+ 显式哨兵「以上都不是」；哨兵命中或置信度 < 0.5 一律不写值（不允许逃逸） |
| 失败 | 解析失败（风控 / 未找到 / 网络）→ notice 说明 + 回到正面，**不回落 LLM**、不落默认值假装成功 |
| 手点优先 | 用户点过任何分类 chip → 解析出的分类**不覆盖**他的选择 |
| 交互 | 正面只有名称 + 状态；解析 ≈1s（真实网络时序，非固定延迟）→ 翻面；背面与详情弹窗同形制，分类 / 状态是**可点下拉**；无「返回」按钮；无「我的记录」段 |
| 写入边界 | 分类仍只从表单写入（issue 394 的规则延续）；豆瓣其余字段照旧走后台队列，本票不碰 |

## 落地

| 文件 | 改动 |
|---|---|
| `src/cinema/douban-fetcher.ts` | 从 `fetchNoteDouban` 抽出**不依赖 TFile** 的纯查询 `queryDoubanByName(name, deps)`（搜索 + ApiZero + rexxar 兜底），落盘抓取与表单预取共用同一实现——两份搜索逻辑必然漂移 |
| `src/cinema/douban-queue.ts` | 导出 `queryDoubanForPreview(app, name)`（复用 `fetchDepsFromSettings` 组装依赖）；`configureFetchQueue` 加 `preview` 注入点供测试替换 |
| `src/cinema/type-decide.ts` | **新建**：`buildTypeCriteria`（ALL_TAGS 单源 − 公开课 + 哨兵）／`buildTypeState`（跳过空字段）／`judgeTypeChoice`（哨兵 → null、置信度 < 0.5 → null、不在清单 → null）／`decideCinemaType`（未配置即抛、失败上抛） |
| `src/cinema/shared.ts` | `formModalHtml` 拆双面（正面名称+状态+解析，背面 `.j-back` 槽 + 保存）；`formBackHtml`（详情弹窗同形制，分类 / 状态徽标可点开下拉）；`formTagChipHtml` / `formStChipHtml` |
| `src/cinema/ui.ts` | 表单状态机 `idle → parsing → parsed`（+`classifying` 子态：翻面后分类未落定期间锁保存）；`runParse`（查询 → 翻面 → 判定 → 就地换徽标）；`flipToBack`；chips / 下拉事件委托 |
| `src/cinema/styles.css` | 翻转 3D（perspective 900 + keyframes 中段 translateZ 抬起 + 两面光照遮罩）；**grid 同格叠放**（容器高度自动取较高面 → 翻转全程零重排）；加载转圈 / 骨架占位 / 下拉 max-height 过渡；影院全域动效段（弹窗开合、详情分段接力、卡片 hover、按钮回弹）与 reduced-motion「放缓 + 减幅」降级 |
| `prototypes/cinema/fake/fake-obsidian.ts` | 罐头网关：豆瓣搜索页（按片名给 6 套预设）／ApiZero 字段／Jev 按 state 现场推分类；原型专属延迟（真实插件无） |
| `tests/cinema/ui.test.ts` | 受双面改造影响的用例改写为「解析 → 翻面 → 背面操作」流 |
| `tests/cinema/type-decide.test.ts` | **新建** 17 条：criteria 是对象（422 tripwire）、公开课不在候选、哨兵 / 置信度 / 越界三道闸、state 压缩、未配置抛错、失败上抛不回落 |

## 关键实现口径

- **翻转零重排**：两面 grid 同格叠放后，行为层不再量高、不再写 `style.height`、不再需要 ResizeObserver——此前「量高 + height 过渡 + 观察者同步」每帧重排整个弹窗，是「翻转时卡顿一下」的根因（2026-09-21 用户反馈后定位移除）。居中由 `.cn-modal--flip{margin:auto}` 承担。
- **分类就地换徽标**：判定回来只重渲 `.dm-badges` 两个节点，不整卡重渲染——重渲染会重建海报 `<img>`，图片重新请求、白闪一下。
- **is-flipped 仍立刻挂上**：动画期间 keyframes 接管 transform（中段抬起），落定后自然对齐终态；动画不可用（测试 / 系统降级）时终态仍正确。

## 测试

- `tests/cinema/`：258 + 17 = 275 条通过；全量 472 文件 / 7031 用例通过；`tsc --noEmit` 零错；原型自检 60/60（含双面卡片段）。
- 门禁曾抓到一条本票前段引入的违规：`prefers-reduced-motion` 段内两条 `:hover` 未包 `@media (hover: hover)`（呈报#9 F4 触屏粘滞范式）——改为嵌套媒体后放行。

## 遗留

- **豆瓣搜索重名**：取结果第一条（拍板）。同名多版本（剧版 / 动画版）判错时无提示，靠背面「豆瓣信息」肉眼核对——后续可加「不是这部？」入口，代价几乎为零。
- **解析失败的降级面**：ApiZero 未配置时兜底 rexxar 只有「是否剧集」+ 演职员，判不出剧种，多数会落哨兵 → 保持默认「电影」。属可接受退化。
- **关闭方向**：详情弹窗的收起仍是原淡出，无「缩回卡片」的逆向飞行。
