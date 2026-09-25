# 454 · 合成卡的媒体数（语音 / 图片）看不见

## 现象

大琳（452 后以「待画」折子出现在墙上）的详情头，右上数字格里「语音」「图片」都是「—」，
卡面也没有「语音 1289 条 · 图片 1615 张」徽章。但预览桶里数据是齐的：

```
people-preview.json → contacts["大琳"]
  stats: { msgCount: 18477, voiceCount: 1289, voiceTotalSec: 8464, imageCount: 1615 }
  kindCounts: { 语音: 1289, 图片: 1616, 文本: 14004, ... }
```

## 根因

`ui.personMedia(p)` 只从 `p.imports[].stats` 汇总媒体三项（voiceCount / voiceTotalSec / imageCount）——
**而 452 造的合成导入记录 `poolRecord()` 没带 `stats`**（只造了条数 / 首尾跨度）。

→ 合成卡（无卡者 + 盘上无导入记录者）的 `personMedia` 恒为 `null`
→ 详情头数字格「—」、卡面徽章不出。

预览桶侧写里 `stats` 就是导入时算好的（`previewStatsOf`，含语音总时长 8464 秒——这个值
`computeStats(msgs, kindCounts)` 复现不出来，因为 `previewToUnified` 只留了 text/ts/isSender，
时长信息只在预览桶侧写里）。所以合成记录**取预览桶侧写**才对，不是自己重算。

## 修法

1. `ImportRecord.stats` 放宽为 `Partial<ContactStats>`（语义更诚实：导入记录本来就可能有部分统计）。
2. `poolRecord()` 带上媒体三项（取 `contact.stats`，缺省 0）。
3. 消费方按「有没有明细」判定：
   - `buildInsightsCard()`（「数据」折统计卡）判定从「有 stats」改为「有 `monthly` 明细」——
     否则合成记录会画出一张全 0 的统计卡，比原来的占位更糟。
   - `render.replyLatencySec(median, avg)` 的 `avg` 改为可缺省（部分统计下没有），
     避免类型与运行期双坑。
4. 「数据」折对合成卡仍走占位（预览桶没有 monthly / 时段分布，不编造）。

## 边界

- 合成记录**只在盘上卡没有导入记录时**生效（452 口径不变）。人物画完脸谱后 `persistJobDone`
  追加真实导入记录（完整 `computeStats`），此后合成不再介入——**不会出现媒体数翻倍**。
- 导入记录的 `stats` 三处口径仍然一致：预览桶合成（媒体三项）/ done 落盘（完整）/ 数据源弹窗水位（预览桶侧写）。

## 验收

- 单测：合成卡带媒体数 → `personMedia` 出值、详情头数字格显示 1289 / 1615 类比例
- 单测：合成卡（只有媒体三项）的「数据」折仍出占位，不出空统计卡
- 单测：`buildInsightsCard` 对完整 stats 行为不变（旧用例保绿）
- 全量 `vitest run` + `tsc --noEmit` 绿
