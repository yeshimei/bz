# 黑匣子「情绪模块」设计调研报告

> 背景：黑匣子是一层「日记智能分析层」，**只读** `我的/日记/*.md`，用 AI 从日记正文推断情绪（24 词情绪词表），做情绪聚合（画像的情绪、事件的情绪、时间段情绪分布），并支撑与 AI 人格的「共情」对话。
> 铁律：**绝不打断日记书写**；情绪结果只作派生层（blackbox.json），不改动日记原文。
> 本文基于第一手来源（官方文档 / 源码 / 论文 / 论坛 / 产品官网）调研社区与成熟 mood-tracking 产品做法，每项发现附真实 URL，末尾给出落地的推荐设计要点。

---

## 0. 关键前置发现：「24 词情绪词表」对应的已知模型

投入五个问题前，先核对「24 词」是否命中某个标准化情绪模型。搜索结果**没有恰好 24 词的「官方标准词表」**，但有强候选映射：

| 模型 | 情绪数 | 层级 | 强度 | 来源 |
|---|---|---|---|---|
| **Plutchik 情绪轮** | 8 基本情绪 × 3 强度档 = **24** | **是**（8 大类 → 次生 dyads） | **是**（低/中/高三档） | [Plutchik 基本情绪 (personalityresearch.org)](http://www.personalityresearch.org/basicemotions/plutchik.html) · [Plutchik's Wheel (6seconds)](https://www.6seconds.org/2025/02/06/plutchik-wheel-emotions/) · [PyPlutchik 论文 (PLOS ONE)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0256503) |
| NRC Emotion Lexicon | 8（含 Ekman 6 + 正 + 预期） | 扁平（词→情绪映射） | 否 | [NRC Emotion Lexicon 官网](http://mail.saifmohammad.com/WebPages/lexicons.html) · [原论文 arxiv:1308.6297](https://ar5iv.labs.arxiv.org/html/1308.6297) · [README-NRC-Lex.txt](http://www.saifmohammad.com/WebDocs/README-NRC-Lex.txt) |
| PANAS | 20 项（10 正 + 10 负） | 两维（PA/NA） | 否（评分量表） | [PANAS (emerge.ucsd.edu)](https://emerge.ucsd.edu/r_27oo0ukrb8lin6a/) · [PANAS (teachforall)](https://www.taclmeasurementlibrary.teachforall.org/resources/positive-and-negative-affect-panas) |
| Ekman 六种基本情绪 | 6 | 扁平 | 否 | [离散情绪理论 (ar5iv)](https://ar5iv.labs.arxiv.org/html/2506.15497) |
| GoEmotions（现代数据集，社区常裁剪） | 27 | 细粒度 | 否 | [UnitXT GoEmotions 卡片](https://www.unitxt.ai/en/1.17.1/catalog/catalog.cards.go_emotions.simplified.html) |

**结论**：若坚持「24」这个数字，最贴合的现有模型是 **Plutchik 情绪轮的 24 个具名情绪区域（8 基本 × 3 强度）**——因为它是唯一同时具备「层级」与「强度」的模型，且 8×3 恰好是 24。强烈建议把该映射写进 spec/ADR（NRC 8 情绪作为兼容退路），不要自造无依据 24 词表。

---

## 1. 情绪标注方式：手动 vs AI 推断 vs 混合；词表规模 / 层级 / 强度加权

### 社区做法

**手动打标是 Obsidian 插件主流，但「打标负担」是公认痛点。** 几乎都是用户在日记 frontmatter / daily note 里手动写一个 mood 字段：

- [obsidian-mood-calendar (GitHub, 中文)](https://github.com/github-xzhi/obsidian-mood-calendar)：日记记录心情 emoji + 日历视图展示，手动、轻量、打标内嵌正文。
- [obsidian-emotion-book (GitHub)](https://github.com/oxilldat/obsidian-emotion-book)：在 daily note 内直接记录情绪状态，内嵌在书写流中，不额外开弹窗。
- [obsidian-mood-tracker (GitHub)](https://github.com/dartungar/obsidian-mood-tracker)：日记内图表式手动记录。
- [obsidian-emotion-picker (社区插件页)](https://community.obsidian.md/plugins/obsidian-emotion-picker)：从可定制情绪列表插入 frontmatter。
- [Obsidian 论坛：Dataview 及其他做 mood/sleep/dream 追踪](https://forum.obsidian.md/t/dataview-and-or-other-plugins-for-mood-sleep-dream-tracking/24330/3)：Dataview 做情绪聚合是主流范式。
- [Advanced Emotions Tracker 请求帖 (Forum)](https://forum.obsidian.md/t/advanced-emotions-tracker-request/51684)：用户想要比单一 mood 更细的情绪标签，且希望**不打断书写**。

**负担问题**：手动打标需每次写完都想起去标，长期坚持率低；用户甚至「为避免打标而少写」，反而伤害日记本身。

**混合 / 轻量交互产品化**：Daylio 靠「5 档心情图标点选 + 自定义活动勾选」把一次操作压到几秒，统计自动生成——**让打标足够轻才有人持续用**。
- [Daylio 官网](https://daylio.net/)
- [Daylio FAQ：创建与管理 moods（含默认 moods 列表）](https://daylio.net/faq/docs/daylio-faq/tutorials/create-and-manage-moods/)
- [Daylio: mood-quantification for a less stressful you (mHealth 论文)](https://mhealth.amegroups.org/article/view/11509/12040)

**AI 推断是 Obsidian 正在出现的差异化方向**：`obsidian-ai-journal-coach` 直接读日志条目并让 LLM 找模式——是黑匣子最接近的同类，印证「手动 → AI 推断」趋势。AI 推断的独特价值 = **零手动负担 + 事后回顾**（用户不需为 AI 打标，写时零打扰）。
- [AI Journal Coach 论坛展示帖 (Forum)](https://forum.obsidian.md/t/ai-journal-coach-a-plugin-that-reads-your-journal-entries-and-finds-patterns/115241)
- [ibrh96-prog/obsidian-ai-journal-coach (GitHub)](https://github.com/ibrh96-prog/obsidian-ai-journal-coach)

### 词表规模 / 层级 / 强度

- NRC 8 情绪：扁平无强度，工程上最常用（R `syuzhet` 内置）。来源：[get_nrc_sentiment (syuzhet)](https://search.r-project.org/CRAN/refmans/syuzhet/html/get_nrc_sentiment.html) · [NRC 镜像 (GitHub)](https://github.com/Franck-Dernoncourt/NRC_Emotion_Lexicon)。
- Plutchik 24 区域：具层级 + 三档强度，是最贴近「24 + 层级 + 强度」的答案。来源：[plutchik.html](http://www.personalityresearch.org/basicemotions/plutchik.html) · [6seconds wheel](https://www.6seconds.org/2025/02/06/plutchik-wheel-emotions/) · [healthline emotion wheel（高/低唤醒差异）](https://www.healthline.com/health/emotion-wheel)。
- **强度加权是加分项而非必需**：主流 Obsidian 插件普遍只有离散档不加权重。**建议把「强度」做成 24 词的内部属性而非强塞给用户**，聚合时同类别可合并、强度可累加。

---

## 2. 情绪聚合与可视化：分布 / 趋势 / 事件·人物关联

- **Obsidian 聚合范式 = Dataview 查询 + 图表**：用户把情绪写进 frontmatter 再用 Dataview 统计，配合日历/图表。缺点是把聚合负担全推给用户。来源：[Dataview 追踪帖 (Forum)](https://forum.obsidian.md/t/dataview-and-or-other-plugins-for-mood-sleep-dream-tracking/24330/3) · [obsidian-mood-calendar](https://github.com/github-xzhi/obsidian-mood-calendar)。
- **AI 聚合 = 读全量日志 → LLM 归纳模式**：`obsidian-ai-journal-coach` 的做法与黑匣子「人物/事件/时间周期聚合」高度同构。来源：[AI Journal Coach (GitHub)](https://github.com/ibrh96-prog/obsidian-ai-journal-coach) · [Forum 帖](https://forum.obsidian.md/t/ai-journal-coach-a-plugin-that-reads-your-journal-entries-and-finds-patterns/115241)。
- **App 范式以「相关性 / 洞察」为中心**：Exist.io 把心情与睡眠/运动/天气/社交做自动相关分析，输出「什么与你的心情相关」，而非罗列计数。来源：[Exist.io](https://exist.io/) · [Exist KB：跨多天找相关](https://kb.exist.io/article/55-will-exist-find-correlations-across-multiple-days) · [Exist Blog：Manual tracking](https://exist.io/blog/manual-tracking/) · [Exist Blog：Custom tracking](https://exist.io/blog/custom-tracking/)。
- **事件 / 人物关联是黑匣子的差异化**：把情绪锚定到「事件 / 某人」比裸分布更有洞察；这是纯手动插件难做好的点（事件抽取成本高），恰好是 AI 推断日志的方式优势——AI 可同时输出「人物 + 事件 + 情绪」做交叉聚合。

**对黑匣子的建议**：情绪分布产出为派生 JSON（blackbox.json）而非侵入式图表；聚合按「时间周期（日/周/月/年）、事件、人物、情绪词」四维展开；顶层给「正负平衡 + 强度极值」摘要。

---

## 3. AI 情绪推断可靠性：准确率 / 跨文化·中文语境 / 失败处理

### 准确性上限与偏差

- **系统性偏差**：文本情绪检测在不同人口 / 语言群体间系统性偏移，非母语与少数群体误判率更高。来源：[ACM 论文：文本情绪检测跨人群偏差 (IEEE)](https://ieeexplore.ieee.org/abstract/document/11484596) · [Automatic Emotion Extraction 的方法论缺陷 (Springer)](https://link-proxy.springer.com/article/10.1007/s12668-025-02129-5)。
- **直接命中中文语境**：《Limitations in cultural context: systematic biases of LLMs in Chinese sentiment analysis》——LLM 在中文情绪分析上有系统性文化偏见，委婉 / 隐性表达（covert sentiment）尤其易被误判。来源：[publicera.kb.se](https://publicera.kb.se/ir/article/view/64278)。
- **情绪 AI「读不出当事人情绪 + 伦理争议」**：情绪识别系统被质疑个人与群体层面的伤害、被指「监视式」。来源：[Public Concerns about Emotion Recognition Systems (Springer)](https://link.springer.com/article/10.1007/s44206-026-00272-4) · [Emotion AI Doesn't Read Minds (MorphCast)](https://www.morphcast.com/blog/emotion-ai-doesnt-read-minds/)。

### 中文 / 跨文化特殊点

- PANAS 跨文化 Rasch 分析显示正负情感表达与信效度在文化间有差异，英文词表直译不可直接套用。来源：[PANAS 跨文化 Rasch (Wiley)](https://onlinelibrary.wiley.com/doi/10.1002/ijop.70230) · [PANAS 亚洲样本效度 (Wiley)](https://onlinelibrary.wiley.com/doi/10.1111/ajsp.12390)。
- 中文反讽、成语、网络黑话是高危误判点。日报场景相对正式的表达比重高，是利好。来源：[中文混合文本情感分析稳定性探讨](https://blog.csdn.net/weixin_33759613/article/details/159189849)。

### 推断失败的处理（社区共识）

情绪推断本质是**有不确定性的猜测**，不应被当事实。对私密日记，**错标比重标更伤信任**（把平淡事标成「愤怒」会让整个情绪层信誉崩塌）。正确处理：低置信时输出「中性 / 无显著情绪」，或标注置信度，让聚合层对低置信样本**降权**而非硬凑。

---

## 4. 情绪数据的使用：复盘参考 / 对话记忆 / 共情

### 复盘参考（核心价值）

- 情绪追踪最被认可的价值在「回顾而不是当时」——趋势自己看不出，回头总结看得出。来源：[ustwo：为心理健康设计数字体验](https://ustwo.com/blog/designing-digital-experiences-for-mental-health/)（Moodnotes 把「记录→认知重构→复盘」串起来）· [CBT 认知重构应用（thought records）实践综述 (Cambridge)](https://www.cambridge.org/core/journals/the-cognitive-behaviour-therapist/article/digitized-thought-records-a-practitionerfocused-review-of-cognitive-restructuring-apps/7D79B49EEF560F78E1534F5C6DA264CD)。
- Daylio / Exist 都以此为核心价值主张。来源：[Daylio](https://daylio.net/) · [mHealth Daylio 论文](https://mhealth.amegroups.org/article/view/11509/12040) · [Exist.io](https://exist.io/)。

### 对话记忆 / 共情

- AI journaling 产品把情绪数据喂给 AI，让它「记得你上周难过的事」再做共情回应；Reflectly 是代表。来源：[Reflectly - Journal & AI Diary (App Store)](https://apps.apple.com/us/app/reflectly-journal-ai-diary/id1241229134) · [Reflectly Review (selfpause)](https://www.selfpause.com/resources/reflectly) · [Reflectly vs deariary (deariary blog)](https://blog.deariary.com/posts/2026-04-06-reflectly-vs-deariary)。
- 把聚合情绪当 **AI 角色确定性内部状态**（而非每轮重猜），能做到稳定的「你上周因为 XX 难过」。工程上已有「确定性情感中间层」做法。来源：[MATE: Deterministic Affective Middleware for LLM Companions (Zenodo)](https://zenodo.org/records/20400530) · [Cross-Temporal Emotional Modeling (arxiv)](https://arxiv.org/html/2605.15812v1) · [Building Persistent AI Relationships (Zenodo PDF)](https://zenodo.org/records/17684281/files/Building%20Persistent%20AI%20Relationships_v1.0%20Release.pdf)。
- **共情来源必须是用记真实记录，而非模型揣测**，否则成「AI 替用户定义情绪」，引发反感和不信任。

---

## 5. 社区踩过的坑

1. **打标负担扼杀坚持**。手动打标导致「为打标而写、或因怕打标而少写」。Daylio 靠几秒点选解决 → 负担必须趋近于零。黑匣子用 AI 推断天然规避，但**不要把推断结果反向要求用户确认 / 修正**，否则负担回归。来源：[Daylio FAQ](https://daylio.net/faq/docs/daylio-faq/tutorials/create-and-manage-moods/)。
2. **AI 误判情绪摧毁信任**。对私密日记一次明显误判（中性当愤怒）就让用户怀疑整个情绪层；中文隐性表达 + LLM 偏见放大该风险。来源：[publicera.kb.se 中文偏差](https://publicera.kb.se/ir/article/view/64278) · [Public Concerns about ERS](https://link.springer.com/article/10.1007/s44206-026-00272-4)。
3. **情绪被过度解读 / 标签化**。情绪分布易滑向「自我诊断 / 抑郁指数」式解读；机器把单次情绪固化成「你就是焦虑」的标签会造成自我认同伤害。情绪应是**描述而非诊断**，界面文案克制。来源：[Emotion AI Doesn't Read Minds](https://www.morphcast.com/blog/emotion-ai-doesnt-read-minds/) · [AI 情绪推断的伦理反思 (ACM)](https://dl.acm.org/doi/fullHtml/10.1145/3593013.3594011) · [AI therapy 的 toxic positivity 问题 (StellaLabs)](https://www.stellalabs.ai/blog/ai-therapy-toxic-positivity)。
4. **单一分数丢失语义**。早期插件只存单 mood 分数，丢失「为什么」。情绪必须锚定到对象（事件 / 人物）才有洞察。来源：[Exist.io 关联范式](https://exist.io/)。

---

## 6. 推荐设计要点（针对黑匣子：AI 推断 24 词、不打断书写）

1. **24 词表用 Plutchik「8 大类 × 3 强度」结构化并写进 spec/ADR**。
   网上无现成 24 词标准表；最贴近「24 + 层级 + 强度」的是 Plutchik 轮（8×3=24）。向上可聚合成 8 大类（画像/事件粗粒度），保留 3 档强度（趋势/波动精粒度），每词配强度值。NRC 8 情绪作兼容退路。来源：[plutchik.html](http://www.personalityresearch.org/basicemotions/plutchik.html) · [NRC lexicons](http://mail.saifmohammad.com/WebPages/lexicons.html)。

2. **AI 推断全程零手动打扰 + 后台异步 / 惰性增量算**。
   借 Daylio「低负担」哲学但推到极致：写日记时不弹任何框；推断后台异步完成并缓存到派生层（blackbox.json），日记写入后**仅增量重算该篇**，绝不轮询常驻、不打断输入；**绝不让用户反向确认推断结果**。来源：[Daylio FAQ](https://daylio.net/faq/docs/daylio-faq/tutorials/create-and-manage-moods/) · [mHealth Daylio](https://mhealth.amegroups.org/article/view/11509/12040)。

3. **低置信不断言 + 中性兜底**。
   高置信才输出具体情绪词；极短 / 语气中性 / 低置信段落输出「未知 / 无显著情绪」，聚合层对不确定样本降权——这是对私密文本的信任底线，防污染分布和人物画像。来源：[中文偏差论文](https://publicera.kb.se/ir/article/view/64278) · [Emotion AI doesn't read minds](https://www.morphcast.com/blog/emotion-ai-doesnt-read-minds/)。

4. **聚合必须锚定对象，不只给裸分布；情绪作为 AI 角色的确定性内部状态而非每轮重猜**。
   时间段分布（周/月/年热力图）+ 人物×情绪 + 事件×情绪交叉呈现，顶层给「正负平衡 + 强度极值」摘要；共情只引用真实记录的情绪锚点。工程上把聚合情绪当 persona 内部状态持久化，避免共情漂移（借鉴 MATE 中间层）。来源：[Exist.io](https://exist.io/) · [MATE (Zenodo)](https://zenodo.org/records/20400530) · [AI Journal Coach (GitHub)](https://github.com/ibrh96-prog/obsidian-ai-journal-coach)。

5. **只读 + 显式降级：派生数据永不合格校正反馈回 `我的/日记/*.md`**。
   黑匣子是 READ-ONLY 只读日记的派生层。与社区「写进 frontmatter」侵入路线相反，情绪结果全放 blackbox.json，用户可看「AI 说了什么」但**绝不改动日记原文**，尊重「情绪是自我叙述、不该被机器回写」的隐私边界，同时规避「情绪被固化成标签」之坑。中文语境对反讽 / 网络表达贴「低置信」降权。来源：[mood-tracker 侵入范式（对比用）](https://github.com/dartungar/obsidian-mood-tracker) · [Public concerns about ERS](https://link.springer.com/article/10.1007/s44206-026-00272-4)。

---

## 附：关键来源清单（去重）

| URL | 用途 |
|---|---|
| [obsidian-mood-calendar](https://github.com/github-xzhi/obsidian-mood-calendar) | 手动情绪 emoji + 日历视图（中文） |
| [obsidian-emotion-book](https://github.com/oxilldat/obsidian-emotion-book) | daily note 内嵌记录情绪、不打断书写 |
| [obsidian-mood-tracker](https://github.com/dartungar/obsidian-mood-tracker) | 手动图表式记录；frontmatter 侵入范式（对比） |
| [obsidian-emotion-picker](https://community.obsidian.md/plugins/obsidian-emotion-picker) | 可定制情绪列表插入 frontmatter |
| [Dataview 追踪帖 (Forum)](https://forum.obsidian.md/t/dataview-and-or-other-plugins-for-mood-sleep-dream-tracking/24330/3) | Obsidian Dataview 聚合范式 |
| [AI Journal Coach (Forum)](https://forum.obsidian.md/t/ai-journal-coach-a-plugin-that-reads-your-journal-entries-and-finds-patterns/115241) | AI 读日志找模式（黑匣子同类） |
| [obsidian-ai-journal-coach (GitHub)](https://github.com/ibrh96-prog/obsidian-ai-journal-coach) | AI 日志分析插件源码 |
| [Daylio 官网](https://daylio.net/) · [Daylio FAQ moods](https://daylio.net/faq/docs/daylio-faq/tutorials/create-and-manage-moods/) · [mHealth 论文](https://mhealth.amegroups.org/article/view/11509/12040) | 低负担点选 + 统计范式 |
| [Exist.io](https://exist.io/) · [KB 跨多天相关](https://kb.exist.io/article/55-will-exist-find-correlations-across-multiple-days) · [Blog manual/custom](https://exist.io/blog/custom-tracking/) | 心情与行为自动相关分析 |
| [Plutchik 基本情绪](http://www.personalityresearch.org/basicemotions/plutchik.html) · [6seconds wheel](https://www.6seconds.org/2025/02/06/plutchik-wheel-emotions/) · [PyPlutchik](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0256503) | 24 词 = 8×3 的结构依据 |
| [NRC Emotion Lexicon](http://mail.saifmohammad.com/WebPages/lexicons.html) · [原论文 arxiv](https://ar5iv.labs.arxiv.org/html/1308.6297) · [README](http://www.saifmohammad.com/WebDocs/README-NRC-Lex.txt) · [syuzhet 实现](https://search.r-project.org/CRAN/refmans/syuzhet/html/get_nrc_sentiment.html) | 词→情绪映射词表 |
| [PANAS (emerge)](https://emerge.ucsd.edu/r_27oo0ukrb8lin6a/) · [PANAS (teachforall)](https://www.taclmeasurementlibrary.teachforall.org/resources/positive-and-negative-affect-panas) · [跨文化 Rasch](https://onlinelibrary.wiley.com/doi/10.1002/ijop.70230) · [亚洲样本](https://onlinelibrary.wiley.com/doi/10.1111/ajsp.12390) | 正负维度 + 跨文化效度 |
| [GoEmotions 卡片](https://www.unitxt.ai/en/1.17.1/catalog/catalog.cards.go_emotions.simplified.html) · [healthline emotion wheel](https://www.healthline.com/health/emotion-wheel) | 现代词表参考 / 强度·唤醒维度 |
| [中文 LLM 情绪偏差 (publicera)](https://publicera.kb.se/ir/article/view/64278) | 中文语境系统性偏差（隐性情绪易误判） |
| [文本情绪跨人群偏差 (IEEE)](https://ieeexplore.ieee.org/abstract/document/11484596) · [Automatic Emotion Extraction (Springer)](https://link-proxy.springer.com/article/10.1007/s12668-025-02129-5) | 情绪推断准确率 / 偏差问题 |
| [Public concerns about ERS (Springer)](https://link.springer.com/article/10.1007/s44206-026-00272-4) · [Emotion AI doesn't read minds](https://www.morphcast.com/blog/emotion-ai-doesnt-read-minds/) · [AI 伦理反思 (ACM)](https://dl.acm.org/doi/fullHtml/10.1145/3593013.3594011) | 情绪过度解读 / 监视式 / 谨慎使用 |
| [ustwo 心理健康设计](https://ustwo.com/blog/designing-digital-experiences-for-mental-health/) · [CBT thought records 综述](https://www.cambridge.org/core/journals/the-cognitive-behaviour-therapist/article/digitized-thought-records-a-practitionerfocused-review-of-cognitive-restructuring-apps/7D79B49EEF560F78E1534F5C6DA264CD) | 记录→认知重构→复盘 |
| [Reflectly App Store](https://apps.apple.com/us/app/reflectly-journal-ai-diary/id1241229134) · [Review](https://www.selfpause.com/resources/reflectly) · [对比](https://blog.deariary.com/posts/2026-04-06-reflectly-vs-deariary) | AI 日记 + 情绪共情 |
| [MATE middleware (Zenodo)](https://zenodo.org/records/20400530) · [Cross-Temporal Modeling (arxiv)](https://arxiv.org/html/2605.15812v1) · [Persistent AI Relationships (Zenodo)](https://zenodo.org/records/17684281/files/Building%20Persistent%20AI%20Relationships_v1.0%20Release.pdf) | 情绪作为 AI 角色确定性内部状态 |
