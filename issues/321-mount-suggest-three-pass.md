# 321 · 挂载建议三段式链路（查询官 / 采纳官 / 定位官）

- 状态：交付中（2026-09-15）
- ADR：0140（三段式 + 块 id 写入口径）；前作 issue 318（一次性裁判，被本包替换）
- 实测依据：`.scratch/mount-canvas/three-pass2.mjs`（GLM-5.3-Flash coding 端点真库端到端，43–58s/卡）

## 口径（实测拍板）

1. 轮 1 查询官：编号片段 → 每段 `{seg, sentence, keywords, why}`；sentence 是 20–40 字完整短句
   （关键词堆在 bge-m3 查询侧失配，召回质量差）。查询官不可用 → 退回机械分句当查询（兜底不硬失败）。
2. 召回：范围闸只排除「归档/网页剪藏」（全库召回 top5 有 4 条是剪藏噪声；只留卡片盒+文献盒会丢主题盒真邻居）；
   自指剔除；同笔记只留最高分块；句+词双查询并集按「命中次数 → 最高分」排序，每片段最优笔记保底进池，总量 10。
3. 轮 2 采纳官：片段 × 候选（命中数/最高分/块摘要）→ 同一目标最多 2 条，score<0.7 不出；`[]` = 无关联（落缓存）；
   形状认不出 = no-answer（不落缓存）。
4. 轮 3 定位官：现读全文（标题/段落编号，单篇 8000 字封顶，最多 6 篇）→
   `unit=whole|heading|paragraph + heading + quote + anchor + reason`，允许 skip 否决（实测会否掉泛泛相关的候选）；
   定位官不可用 → 采纳官结果按整篇兜底（仍落缓存）。
5. 本地复核：锚点三级回定位（精确 → 去空白 → 退片段锚点）；标题存在性校验（不存在 → 降级整篇）；
   摘录三级定位（渲染后文本 ≠ 原文是常态：去 `**`、表格规范化、省略号）。
6. AI 参数：`reasoning_effort:'low'` + `max_tokens:131072`（GLM 上限），prompt 纯文本通道 + 容错解析（318 口径延续）。
7. 进度：`onProgress` 回调（query/recall/adopt/locate/save + done/total），白板画进度条与动态文字。

## 交付物

- `mount-types.ts`：`SuggestUnit`；建议带 `unit/heading/quote/subpath`。
- `mount-suggest.ts`：链路重写 + `suggestionUnitMarkdown`（幽灵节点显示现读单元原文）+
  `ensureSuggestionBlockId`（固定时补写块 id，幂等）+ `suggestionLink`（三形态链接文本）。
- `mount-canvas.ts`：渐进渲染（树先画、建议后并入）、幽灵正文显示单元原文、固定三形态 +
  词级/表格锚点别名替换。
- 缓存 v3；`SUGGEST_CACHE_VERSION=3` 旧片自动失效。
- 测试：三段解析/聚合/复核/降级 + 固定三形态 + 块 id 幂等 + 词级替换；真库端到端脚本回归。
