# Ticket 162：巩固语义重定义——行为小结并入反思 + 阈值精简 + 周报锚定首洞察

## 需求（用户拍板，逐条对话确认）

1. **反思只看素材阈值**：自上次反思记忆流新增 ≥N 条（默认 20）即反思——时间间隔闸退役，攒够就触发。
2. **「日小结」更名「行为小结」，改为反思前置步骤**：不再独立调度；每次反思前，把上次反思以来（首次取最近 24h）的**全部**行为流合并总结成 **1 条** observation 写入记忆流（source=digest，evidenceIds 溯源），保证每次反思恰有一条覆盖两窗行为的小结。
3. **行为小结不占反思素材额度**：小结入流不推 pendingSinceReflect，created 扫描排除 source=digest。
4. **反思证据池全量**：自上次反思以来的**全部**新增观察（含刚写入的行为小结）按重要度降序全量交给 AI，一条不删不排除——evidenceWindow/evidenceTop 窗口截断与 credibility 加权排序退役；洞察条数由 AI 按内容自定（洞察条数设置退役）。
5. **周报窗口锚定第一条洞察**：首窗 = [第一条洞察（排除周报自身产物），+7d)，此后每窗起点 = 上窗末端（weeklyReport.at 存窗口末端），按 7 天一周往后推链式生成；空窗不出报告、窗口静默推进防卡死；洞察门槛退役；窗口满 7 天且整点后由小时心跳分派。
6. **设置精简**：巩固参数 11 → 2（smartcatReflectMinNew 反思观察阈值、smartcatRefExcerptLimit 引用摘录字数）；「移动端默认全屏」组挪到设置面板最下面。

## 改动面

- `src/smartcat/memory.ts`：MEMORY_CONFIG 清理（evidenceWindow/evidenceTop/digestInterval 退役）；getConsolidationConfig 收敛为 {reflectMinNew=20, refExcerptLimit=400}；shouldReflect 去间隔闸；日小结调度（maybeDigest/shouldDigest/digest/digesting 锁）删除 → summarizeBehavior（1 条 observation，不占额度）；reflect 重排（前置小结 + 前置证据闸防「小结写入后反思中止致重复总结」+ 证据池全量按重要度排序 + 洞察条数 LLM 自定）；newObservationCountSince 排除 digest；behaviorEarliestBase 删除；来源标签 digest=行为小结。
- `src/smartcat/report.ts`：buildWeeklyReportData 增 baselineMs 参数（窗口 [baseline, now]；缺省回退 ISO 周窗口兼容）。
- `src/smartcat/index.ts`：maybeWeeklyReport 重写（firstInsightAt 锚点 + 链式窗口 + 空窗静默推进）；weekWindow import 退役。
- `src/settings.ts`：6 个退役键删除（smartcatReflectIntervalHours/ReflectEvidenceWindow/ReflectEvidenceTop/InsightCount、smartcatDigestIntervalHours/DigestMinNew/DigestMaxEvidence/DigestCount、smartcatWeeklyMinInsights；data.json 残留值忽略），smartcatReflectMinNew 默认 3→20。
- `src/smartcat/ui.ts`：「记忆巩固」组 11 行 → 2 行；移动端组挪面板末尾；DEFAULT_BEHAVIOR 同步。
- `src/smartcat/dashboard.ts`：日小结次数 → 行为小结次数等文案；`src/smartcat/behavior-wording.ts`、`src/smartcat/mood.ts`、`src/smartcat/types.ts` 文案/注释同步。

## 测试

- memory.test.ts：shouldReflect 无间隔闸重写；「睡前巩固」describe 整体重写为「行为小结」（前置小结入流/24h 窗口/不占额度/无行为不做小结/AI 未配置整轮中止退避/基线推进不重复总结）；routedFetch 按「行为记录（编号」路由 mock；getConsolidationConfig 两键。
- insight-version / emotion-recall / adr0069-core / trait-attribution / index-cov / behavior-wording / settings：mock 路由补 digests 负载、周报种子回填 8 天前洞察、徽标计数 11→2、文案同步。
- 门禁：tsc 0 错 + 全量 221 文件 3553 用例绿 + 构建部署 E 盘。

## 状态

- [x] spec 更新
- [x] 数据层实现
- [x] UI 层实现
- [x] 测试全绿
- [x] 构建验证
