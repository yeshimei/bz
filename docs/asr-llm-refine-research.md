# 中文 ASR 转写文本的 LLM 纠错：社区方案调研

> 2026-09-29 · 服务对象：脸谱（people）域 + 本地 Python 管线 bz-face（微信语音条 + 通话/见面录音 → 说话人分离 → ASR → `turns.json` 逐轮账本）
> 目标：把「LLM 纠正 ASR 错字」接进这条线，隐私优先（本地模型可选），可断点、幂等、可只重跑一部分
> 方法：只认一手来源（论文原文 / 官方文档 / 源码 / 厂商文档），二手材料回溯一手出处；每条关键论断后跟链接，并标注「论文」「官方文档」「源码」「项目自报」「我的推断」

---

## ① 一页结论

**推荐主路线（三段式，本地优先）**：

1. **先把热词/专名喂给 ASR 侧**（不改识别模型结构，只加偏置）：FunASR 系用 `hotword`（contextual paraformer / SeACo-Paraformer），Whisper 系用 `initial_prompt`。这是最便宜、最不容易出错的一段，能直接消掉「专名写错」这一大类错误。
2. **再做「分段受限纠错」而不是全文改写**：以逐轮 + 邻轮上下文为输入，要求模型输出**结构化错误对（index + 原句 + 修正句，或仅输出 diff 字段）**，并对每轮做**守门**（长度比 / 编辑距离上限 / 未命中专名表不许改 / 超限整轮拒绝）；被拒的轮保留原文并可打标待人工。
3. **原文与修正文双留档 + 幂等键**：`turns.json` 每轮同时保存 `text`（ASR 原文）与 `text_refined` + 元数据；重跑按内容哈希 + 提示词版本做键，只补缺口，允许按区间重跑。

**为什么**：
- 「生成式纠错」本身是社区已确立的路线且有开源基线（HyPoradise，334k 假设-转写对，NeurIPS 2023：<https://arxiv.org/abs/2309.15701>），它能改掉「候选表里根本没有」的错词，这是纯重排做不到的（论文摘要：「corrects tokens missing in N-best lists」）。
- 但**中文实证同时给出两个警告**：① 纯 prompt 在本领域基本无效——ASR-EC benchmark（EMNLP 2025 Industry）原文结论：「prompting is not effective for ASR error correction. Finetuning is effective only for a portion of LLMs. Multi-modal augmentation is the most effective method…」（<https://arxiv.org/abs/2412.03075>）；② **直接全文改写会过纠**——ChFT 论文发现全文直接输出在同质测试集上 CER 反而从 6.16% 退化到 8.38%（论文归因为幻觉/过纠），其后续 Chain-of-Correction 用「顺序逐段纠 + 超阈值拒绝」把同一集合做到 6.16% → 4.06%（<https://arxiv.org/abs/2409.07790>、<https://arxiv.org/abs/2504.01519>）。所以正确姿势是「全文上下文引导 + 分段落地 + 拒绝机制」，不是「把整条录音丢给模型重写」。
- 中文侧直接的收益证据：ChFT 微调模型把异质测试集 CER 12.61% → 8.38%、10.80% → 7.04%、25.24% → 22.99%（同上，论文表格，口径见 ⑤）。

**备选路线（按性价比排序）**：
- **N-best + 约束解码**：若 ASR 能出 n-best（Whisper 系可），把候选集交给 LLM 在候选空间内选择/纠错，风险显著低于自由生成（N-best T5：<https://arxiv.org/abs/2303.00456>；Ma et al. 2024 报告相对 WER 最多降约 38%：<https://arxiv.org/abs/2409.09554>）。FunASR/Paraformer 侧出 n-best 不便，这条更适合 Whisper 管线。
- **本地中文纠错小模型兜底**：pycorrector / MacBERT4CSC 这类 CSC 模型便宜、可控、只动个别字，适合当「词级预筛或兜底」，但没有上下文与专名概念，对 ASR 特有的漏字/截断/口音错误覆盖有限（<https://github.com/shibing624/pycorrector>）。
- **端到端语音 LLM 复核通道**：Qwen3-ASR 开源 0.6B/1.7B（52 语言/方言，中文 WER/CER 优于 Whisper，支持 context 提示、20 分钟音频：<https://github.com/QwenLM/Qwen3-ASR>、<https://arxiv.org/abs/2601.21337>）——不是「纠错」，而是「可疑段落重新识别」，可作为 P2 的可选复核。

**最大的三个坑**：
1. **零样本 prompt = 低收益 + 高风险**（中文 benchmark 直接证否 prompting：2412.03075）；
2. **过纠/幻觉**：把对的改错、把口语风格改掉、凭空补内容；必须用「拒绝阈值 + 结构化 pairs + 双留档」兜住（2504.01519、2409.07790）；
3. **评测口径**：不先做文本归一（数字/英文/标点）就算 CER，前后对比不可信（WeTextProcessing：<https://github.com/wenet-e2e/WeTextProcessing>）。

**成本量级（我的推断，算式见 ③.7）**：一条 616 轮的 30 分钟录音，文本约 9 千字 → 含上下文与 JSON 骨架的批量校正 ≈ 3–5 万输入 token + 1 万级输出 token。云端按 DeepSeek 官方定价页（<https://api-docs.deepseek.com/quick_start/pricing>）量级估算为**几角钱/条**；本地 4-bit 7B–14B（Ollama 上 5.2GB / 9.3GB：<https://ollama.com/library/qwen3>）可跑，但要配强守门，因为小模型过纠倾向更强。

---

## ② 方案谱系

### 2.1 LLM 后纠错（生成式纠错 / GER）

**A. HyPoradise —— 开源生成式纠错基线（必须先看这份）**
- 做法：把 ASR 的 1-best 或 N-best 假设 + 该段音频对应的参考文本，作为「错误-正确」训练/评测数据；用 LLM 做生成式纠错（而非从候选里挑）。
- 数据：HyPoradise（HP）数据集，>334,000 对 N-best 假设与正确转写；覆盖多套 ASR 系统（Whisper/WavLM 等）。
- 报告指标：论文报告显著 WER 下降；我抓到的正文数值为 WSJ 上 4.5% → 2.2%（相对 −51.1%），并强调可纠正「N-best 中不存在」的错词（即生成能力 > 重排能力）。具体表格归属的 ASR 系统请在原文核对（见 ⑤）。
- 后续被怎么用：成为「LLM 纠错」论文的标准参照与数据源；中文方向的 ASR-EC / ChFT 均把「GER（生成式纠错）」作为对照概念，并在其基础上讨论中文的适配问题（2412.03075、2409.07790）。
- 出处：<https://arxiv.org/abs/2309.15701>（NeurIPS 2023 D&B；NVIDIA 页：<https://research.nvidia.com/publication/2023-12_hyporadise-open-baseline-generative-speech-recognition-large-language-models>）

**B. N-best 重排 / 约束解码 —— 风险最低的一档**
- 做法一（重排）：对 n-best 候选用 LLM 打分或改写，输出被限制在候选集合内（「selection」）。
- 做法二（约束解码）：把输出空间约束到 n-best 列表/词格，允许合成新串但仍然「贴近候选」——N-best T5（Rao Ma 等，Interspeech 2023）就是把 n-best 作为输入、在受限解码空间里生成。
- 报告指标：Ma 等 2024 扩展版在 LibriSpeech / TED-LIUM3 / Artie Bias 上实验，Conformer-Transducer 在 test_other 相对降 WER 最多约 38%，并明确指出「约束解码（把输出限制在 n-best / lattice）是控制风险的关键」（<https://arxiv.org/abs/2409.09554>，HTML v2：<https://arxiv.org/html/2409.09554v2>）。
- 适配本项目的要点：**需要 ASR 能吐 n-best**。Whisper 可用 HF transformers 的 `num_beams` + `num_return_sequences` 出多候选；Paraformer 系基本只有 1-best（因此本项目若坚持 FunASR，此路优先级低）。
- 出处：<https://arxiv.org/abs/2303.00456>、<https://arxiv.org/abs/2409.09554>

**C. 置信度/选择性纠错 —— 只改「看起来错」的**
- Naderi 等（Interspeech 2024）：用 ASR 的置信度度量做过滤，再交给 LLM 做 post-hoc 修正；结论是**对较弱 ASR 系统提升明显**，对已经很强的系统收益有限（<https://arxiv.org/abs/2407.21414>）。
- Whisper 侧可直接用的置信信号（源码里就是默认守门参数）：`compression_ratio_threshold=2.4`、`logprob_threshold=-1.0`、`no_speech_threshold=0.6`，以及每段的 `avg_logprob` / `no_speech_prob`（whisper/transcribe.py L44–46、L205–218：<https://github.com/openai/whisper/blob/main/whisper/transcribe.py>）。
- 另一路线是把「整句是否可疑」先做二分类预检，再迭代纠错、最后验证（三阶段框架，见下）。
- 出处：<https://arxiv.org/abs/2407.21414>、<https://github.com/openai/whisper/blob/main/whisper/transcribe.py>

**D. 三阶段框架：预检 → 迭代纠错 → 验证（「Fewer Hallucinations, More Verification」）**
- 做法：① error pre-detection（判断哪些片段需要纠）；② chain-of-thought 迭代纠错；③ answer verification（对输出做验证/置信检查，不过关就拒绝）。
- 实验：AISHELL-1/2（中文）与 LibriSpeech，GPT-4o、DeepSeek V2；报告 CER/WER 相对下降最多约 21%。
- 价值：这是「守门规则」最直接的论文形态——**验证阶段是防止幻觉的主要机制**，而不是靠提示词祈祷。
- 出处：<https://arxiv.org/abs/2505.24347>（HTML：<https://arxiv.org/html/2505.24347v1>）

**E. 中文全文纠错：ChFT → Chain-of-Correction（本课题最贴的一对论文）**
- ChFT（arXiv 2409.07790，Zhiyuan Tang 等）：构建 41,651 篇文章的「中文 ASR 错文 → 正确文」数据，用 Paraformer 输出 + GLM-4-9B 微调；异质测试集 CER 12.61% → 8.38%、10.80% → 7.04%、25.24% → 22.99%；同时发现**全文直接输出会过纠/幻觉**（论文中 article_direct 之类配置在同质集上反而变差），因此采用 **JSON 形式的「错误对（error-correction pairs）**」输出以压缩幻觉空间。
- Chain-of-Correction（arXiv 2504.01519，同组后续）：改成「顺序逐段纠错，每个片段以前文已纠结果作引导」，并把「修正幅度超过阈值」的修改直接拒绝；微调模型把普通话同质集 CER 从 6.16% 降到 4.06%；论文结论支持「全文上下文有用，但要落到片段上执行」。
- 出处：<https://arxiv.org/abs/2409.07790>、<https://arxiv.org/abs/2504.01519>

**F. 中文 benchmark 的冷水：ASR-EC**
- 首个「工业级 ASR 错误」的中文评测（THCHS-30、AISHELL-1/2、WeNetSpeech；Kaldi K1/K2 产错；测 ChatGLM3 / Qwen / Baichuan2 等）。
- 摘要结论原文：prompting 无效；finetuning 只对部分 LLM 有效；多模态增强（音频 + 文本）最有效并取得该 benchmark 的最好成绩。
- 另一条发现：LLM 在**上下文里没有出现的姓名/代词**上容易幻觉。
- 出处：<https://arxiv.org/abs/2412.03075>（ACL 版：<https://aclanthology.org/2025.emnlp-industry.110/>）

**G. 反过纠的社区做法汇总（逐条给到来源）**
| 做法 | 依据 |
|---|---|
| 输出结构化「原文↔修正」对，而非自由全文 | ChFT 用 JSON 错误对（2409.07790） |
| 修正幅度超阈值整段拒绝 | CoC 的 rejection 阈值（2504.01519） |
| 输出约束在 n-best / 候选空间 | N-best T5（2303.00456）、Ma 2024（2409.09554） |
| 只纠低置信片段 | 置信度过滤（2407.21414）+ Whisper 段级 logprob（transcribe.py 源码） |
| 只对「疑似错」片段纠 + 纠后验证 | 三阶段框架（2505.24347） |
| 提示词层面：禁止改写风格/翻译/合并说话人、未把握则原样返回 | 由 ChFT/CoC 的「过纠」教训推导（**我的推断**，各论文未给出统一提示词模板） |
| 双跑一致性（同一批跑两次，只采纳两次一致的改动） | 通用自一致性技术（如 Ranked Voting 自一致性：<https://arxiv.org/abs/2505.10772>），**未见有论文直接用于 ASR 纠错——属我的推断** |

### 2.2 上下文偏置 / 热词

**FunASR 侧（与本项目最近）**
- `hotword` 参数：教程文档写明 Paraformer、contextual Paraformer、SeACo 支持热词；用法为 `model.generate(input=..., hotword="关键词 权重")`，并有 `postprocess_hotwords` 等后处理；文档同时提醒「偏置不保证插入」，需与基线对比验证（<https://github.com/modelscope/FunASR/blob/main/docs/tutorial/README.md>）。模型清单见模型库（Paraformer-zh、ct-punc、SenseVoice、fsmn-vad 等）：<https://github.com/modelscope/FunASR/blob/main/model_zoo/readme_zh.md>
- 原理来源：SeACo-Paraformer（ICASSP 2024）用「语义增强 + CIF 协调解码」做灵活热词定制，属非自回归结构下的热词注入（<https://arxiv.org/abs/2308.03266>；论文摘要未给出可引用的百分比，见 ⑤）。
- 顺带可用的副产品：SenseVoice 模型自带**情感与音频事件标签**（模型库页面），与本项目 `turns.json` 的 `emotion` 字段对口。

**Whisper 侧（prompt 偏置，但有硬上限）**
- 官方口径（OpenAI cookbook「Whisper prompting guide」，官方仓库原文：<https://github.com/openai/openai-cookbook/blob/main/examples/Whisper_prompting_guide.ipynb>）：prompt 是**软建议（soft suggestion）**，适合固定人名/术语的拼写（官方例子：`Aimee, Shawn`），不能强迫模型违反音频内容，稀有/古怪风格更难被遵循。
- **硬上限在源码里**：prompt 会被截断到 `n_text_ctx // 2 − 1 = 223` 个 token，并以 `<|startofprev|>` 前缀注入（whisper/decoding.py L601–609；whisper/transcribe.py L238–242：`remaining_prompt_length = model.dims.n_text_ctx // 2 - 1`）。这决定了「热词表不能太长」，长表必须靠检索/裁剪（见下）。
- Whisper 还会**把 prompt 内容抄进转写**（经典坑）：<https://github.com/openai/whisper/discussions/1150>

**「用 LLM 挖热词/专名再回灌」这条线**
- 偏置词检索与注入已成体系：BR-ASR 用对比学习检索偏置词喂给 Speech-LLM，报告 LibriSpeech 2.8% B-WER、约 20ms 检索延迟（<https://arxiv.org/abs/2505.19179>）。
- 把热词直接放进 LLM-based ASR 的提示：Kong 等（arXiv 2512.21828）用「⟨Audio⟩ + 偏置词表」的 prompt 形式，Qwen2.5-7B 上把 KER 降到 8.29%、热词召回 93.58%（英文媒体/医疗数据）。
- 「LLM 抽关键词」本身可不可信：有专门评测（AISD 2025：<https://aclanthology.org/2025.aisd-main.2.pdf>），结论是 LLM 抽关键词可用但需评估；**我的建议**是：抽出的词只作为「候选热词」，必须过一遍统计筛选（出现频次、与词典/历史记录的比对）再回灌，避免把幻觉词灌进偏置表。
- 与 LLM 纠错的分工：热词偏置解决「识别阶段就错」的专名与术语（成本最低）；LLM 纠错解决「已经错了、且上下文能救」的部分。两者不冲突，且共同依赖同一份「词表资产」（可以从历史 `turns.json`、通讯录、书库/影视条目里自动积累）。

### 2.3 说话人 / 对话结构感知的纠错

- 学术端：
  - CMT-LLM（Interspeech 2025）把多说话人上下文与 LLM 结合，并对多说话人稀有词做两阶段过滤；LibriMix WER 7.9%、AMI SDM 32.9%（<https://arxiv.org/abs/2506.12059>，ISCA PDF：<https://www.isca-archive.org/interspeech_2025/he25_interspeech.pdf>）。
  - DM-ASR（2026）把 diarization 当「显式结构先验」，把任务分解为「按说话人 + 时间条件化的查询」，在普通话/英语上验证（<https://arxiv.org/abs/2604.22467>）。
  - 结论：**「说话人标签作为上下文的一部分交给模型」在学术上成立，且是 2025–2026 的活跃方向**；但尚无「双人 WhatsApp 式对话 + 昵称纠错」的专门基准。
- 工程端（开源）：
  - WhisperX：Whisper + 强制对齐（词级时间戳）+ pyannote 说话人分离，产出「说了什么 + 谁说的」；它**不含 LLM 纠错**（<https://github.com/m-bain/whisperX>）。
  - Meetily：完全本地的会议记录（Whisper 转写 + Ollama 摘要），同样**只做摘要不做纠错**（<https://github.com/Zackriya-Solutions/meeting-minutes>）。
  - 含义（**我的推断**）：「本地转写 + 本地 LLM」链路在 OSS 里已成熟，但「说话人感知的纠错」目前没有现成件，本项目要自己搭——好在我们的数据形态（turns.json 已带 speaker/时间）比这些项目更适合直接做上下文组装。

### 2.4 中文纠错模型（非 LLM 系）

- **pycorrector**（shibing624）：规则 + Kenlm + MacBERT + Seq2Seq 的多模型工具箱；README 自报 MacBERT4CSC 的 F1 ≈ 0.8314（测试集口径未在页面上明确，见 ⑤）；提供 `MacBertCorrector` 等类（<https://github.com/shibing624/pycorrector>、MacBERT 示例：<https://github.com/shibing624/pycorrector/blob/master/examples/macbert/README.md>）。
- **ReaLiSe**（DaDaMrX，ACL 2021）：仓库 README 给出 Detection/Correction F1：SIGHAN13 85.4/84.1、SIGHAN14 69.6/68.1、SIGHAN15 79.3/77.8（<https://github.com/DaDaMrX/ReaLiSe>）。SoftMaskedBERT 是同族思路的起点（<https://arxiv.org/abs/2005.07421>）。
- **水平与边界（综述结论）**：中文拼写纠错综述（arXiv 2502.11508）指出：① SIGHAN 系基准**以繁体/有限领域为主，缺简体数据**，且错误是人工注入的同音/形近字——与 ASR 真实错误分布（漏字、截断、口音、专名）差异大；② LLM 系方法存在**过纠、长度失控、语音/字形感知弱**等问题，作者建议通过微调或对齐（alignment）来利用 LLM 的推理能力（<https://arxiv.org/abs/2502.11508>）。
- 取舍建议（**我的推断**）：CSC 模型适合当「先导过滤器」（找出疑似错字位置 + 给出同音候选），让 LLM 只在有候选的地方做上下文决策；纯 CSC 模型直接上生产会在专名与口语上频繁误改。

### 2.5 LLM 直接参与识别（端到端 / 语音理解）

- **Qwen3-ASR（开源，2026-01）**：0.6B / 1.7B 两个尺寸，52 语言/方言，中文 WER/CER 优于 Whisper，支持 20 分钟音频与通过 system token 注入 context 提示（<https://github.com/QwenLM/Qwen3-ASR>、技术报告：<https://arxiv.org/abs/2601.21337>）。对本项目意义：可作为「可疑段落重新识别」的本地复核通道（0.6B 量级可跟主 ASR 并存）。
- **Qwen3-ASR-Flash（API）**：阿里云百炼文档列出按秒计费（北京区 ¥0.00022/秒 ≈ ¥0.79/小时），但**当前文档的模型能力表未列自定义上下文**，与「上下文偏置」的宣传口径不一致——以官方最新文档为准（<https://help.aliyun.com/en/model-studio/qwen3-asr-flash>；发布博客：<https://qwen.ai/blog?id=41e4c0f6175f9b004a03a07e42343eaaf48329e7>）。见 ⑤。
- **Voxtral（Mistral，Apache 2.0）**：Mini 4.7B / Small 24.3B，支持 40 分钟音频，英文 WER 优于 Whisper，但官方语言列表不含中文（<https://mistral.ai/news/voxtral/>、论文：<https://arxiv.org/abs/2507.13264>）→ 中文场景**不建议**用来转写。
- **轻量后处理（只做标点/分段/顺句）**：
  - FunASR 系标点用独立模型 ct-punc（「不生成声学时间戳」，模型库页），即标点与识别解耦（<https://github.com/modelscope/FunASR/blob/main/model_zoo/readme_zh.md>）；
  - Whisper 系输出自带标点（项目侧可观察到的既定行为）；
  - 中文标点恢复的 LLM 路线有专门工作（如粤语 LLM 标注数据做标点恢复，Interspeech 2025：<https://www.isca-archive.org/interspeech_2025/suen25_interspeech.pdf>；医疗领域小 BERT 方案：<https://arxiv.org/abs/2308.12568>）。
  - 建议：**标点/顺句与错字纠错分两次调用或分两步**，避免「重写句子」的提示把纠错任务带偏（**我的推断**，但 ChFT/CoC 的过纠证据支持这个保守设计）。

### 2.6 工程件（结构化输出 / 断点 / 评测工具）

- 结构化输出：Ollama 的 `format` 参数支持 JSON Schema（2024-12 官方博客：<https://ollama.com/blog/structured-outputs>）；llama.cpp 用 GBNF 语法文件约束输出（<https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md>）；OpenAI 兼容侧用 `response_format: json_schema + strict`（官方 cookbook：<https://github.com/openai/openai-cookbook/blob/main/examples/Structured_Outputs_Intro.ipynb>）。三者都能保证「输出是合法 JSON」，这是走「错误对」格式的前提。
- 文本归一（评测必需）：WeTextProcessing（WeNet 生态）做 TN/ITN，中文 CER 评测前需把数字/英文/标点写成一致形式，否则数字写法差异会被算成错误（<https://github.com/wenet-e2e/WeTextProcessing>）。
- 批处理接口：云端厂商普遍提供批处理/异步折扣（OpenAI Batch、Anthropic Message Batches 等）——**我未逐一抓取官方页核验**，接入前请查官方最新文档（见 ⑤）。

---

## ③ 面向本项目的落地接线建议

以下把上面的证据翻译成 bz-face + 插件的具体接法；标 **推断** 的是我的设计建议而非论文结论。

### 3.1 数据模型（turns.json 扩展）

- 每轮建议扩为：`{speaker, start, end, text, text_refined?, refine?: {state, model, prompt_version, ts, reason}}`。
  - `text` = ASR 原始，**永不覆盖**（回滚与对比的根）。
  - `refine.state ∈ {ok, rejected_by_guard, skipped_uncertain, failed}`；`reason` 存守门拒绝原因，方便出「人工复核清单」。
- 不新增独立账本文件，避免两套时间轴对不上（沿用你们现有「账本按段并进聊天仓」的口径）。

### 3.2 上下文怎么组装（每批的输入）

1. **窗口**：以「一段连续对话」为批（例如 20–40 轮），块间重叠 2–3 轮做接续；超长录音按段切，**切点选在长静音/说话人切换处**，与现有 slide-hmm 分段边界对齐（推断）。
2. **每轮行格式**：`[序号] 说话人: 文本`（保持一一对应，强制模型按序号回）。
3. 头部（system）：
   - 任务约束：「只修 ASR 错字与同音字；不改口语风格；不合并/拆分轮次；不翻译；不补充原文没有的内容；拿不准就原样返回。」
   - 词表：`专名/称呼表`（对方昵称、共同朋友、地名、品牌）+ `领域词表`（来自书库/影视/知识盒的高频专名）。**长词表按批内文本做检索裁剪**（呼应 BR-ASR 的偏置检索思路：<https://arxiv.org/abs/2505.19179>），不要整表塞（Whisper prompt 223 token 的教训同样适用于 LLM 的注意力预算）。
   - 少量 in-context 示例：2–3 个「原句 → 修正对」示例（取自人工确认过的历史修正，可长期积累）。
4. 输出：JSON 数组，元素形如 `{"i": 12, "from": "...", "to": "..."}`，**只列改动项**；未列出的轮一律视为「不改」。这是 ChFT 的「错误对」思路（2409.07790）。

### 3.3 提示词的硬约束（照抄 ChFT/CoC 的教训）

- 输出**只允许**错误对 JSON；禁止输出整篇稿件（CoC 证明全文自由输出会过纠：2504.01519）。
- 显式禁止项：改写风格/语气、书面化、删口头语、翻译、增删轮次、改变说话人、改标点为「重写句子」。
- 允许项要写死：同音/近音错字、明显漏字、专名写错（若在词表内）、数字/单位明显识别错。
- 要求「不确定→不改」并把「不改」定义为默认动作（降低模型行动倾向；这是对三阶段框架「预检 + 验证」的轻量工程化：2505.24347）。

### 3.4 守门规则（每条都要落成代码里的检查）

| 规则 | 判定 | 处置 |
|---|---|---|
| 长度比 | `len(to) / len(from)` 越界（建议 0.6–1.6，需消融） | 拒绝该项，打 `rejected_by_guard` |
| 编辑距离比 | 与原文的字符级编辑距离 / 原长 > 阈值（建议 ≤ 0.3 起调） | 拒绝（CoC 的「超限拒绝」思路：2504.01519） |
| 禁改区 | `from` 在词表/时间/人名白名单外却整句重写 | 拒绝 |
| 空/异常 | 空串、含 prompt 痕迹（如出现「错误对」「JSON」等元词）、含新实体（原文与词表都没有的专名） | 拒绝 + 入人工清单 |
| 一致性 | 同一批跑两次（不同 seed 或不同温度），只采纳两次一致的改动 | 采纳；不一致的降级为 `skipped_uncertain`（**推断**） |
| 置信预算 | 每批改动条数超过比例上限（如 >20% 轮被改） | 整批降级为「只保留词表内改动」，其余回滚（**推断**） |

以上阈值**没有论文给出可直接抄的数值**（CoC 只说用阈值拒绝，未在我抓到的页面里给出数值）——必须用你自己的金标集做小网格消融（见 ⑤）。

### 3.5 账本写回、幂等与断点续跑

- **幂等键**：`hash(session_id, turn_index, text, prompt_version, model_id)`；键不变 = 结果可复用。提示词或模型升级 → 键变 → 自然触发重跑（推断）。
- **只重跑一部分**：CLI 支持 `--from/--to`（时间或轮号区间）与 `--only-rejected/--only-changed` 过滤器；配合 `state` 字段即可「只补缺口」。
- **只回写 `text_refined`**：绝不改 `speaker/start/end`，因此不会触发「改起点重排绝对时间」的既有机制（推断；与你们账本机制对齐的保守做法）。
- **重跑安全**：写盘用「临时文件 + 原子替换」；一批失败不影响已提交批次；失败的轮保持 `text` 原样 + `state=failed`。

### 3.6 评测口径（怎么算「真的变好了」）

1. **先做文本归一**：用 WeTextProcessing（或等价 TN/ITN）统一数字、英文、单位、标点后计算 CER（<https://github.com/wenet-e2e/WeTextProcessing>）。
2. **金标集**：挑 3–5 段（含一条长录音 + 一批微信语音条），**人工逐字校对**成参考文本；没有人工金标，前后对比没有意义（推断）。
3. **三组数字一起报**：
   - 整体 CER（字错率）前后对比；
   - 含专名/热词的轮单独算错误率（KER 思路，参照 2512.21828 的指标用法）；
   - **过纠率**：被改动轮中「改错/改坏」的比例；**幻觉率**：修正文出现原文与词表都没有的实体（推断口径）。
4. **人工抽检设计**（抽样三桶，各 30–50 条）：
   - 被改动的轮 → 算改动精度与过纠率；
   - 未被改动的轮（随机）→ 测漏改；
   - 被守门拒绝的轮 → 测守门是否误杀（必要时放宽阈值）。
5. A/B 一律同批同模型对照，禁止「上一版全量 vs 这一版全量」这种跨条件比较（推断）。

### 3.7 分期落地（建议顺序）

- **P0（先做，零 LLM 成本）**：热词/专名表接入 ASR（FunASR `hotword`；若换 Whisper 则 `initial_prompt`，注意 223 token 上限）；从历史 turns.json + 通讯录自动积累词表；同时把 `text_refined` 字段与守门框架先搭起来（只留空实现）。
- **P1（主收益）**：分段受限纠错（JSON 错误对）+ 守门 + 双留档 + 幂等；用云端便宜模型先跑通评测闭环，再决定是否切本地。
- **P2（可选）**：n-best 约束解码（若 ASR 能出候选）、本地 CSC 预筛（pycorrector/MacBERT 当候选发生器）、Qwen3-ASR 复核可疑段。
- **成本算式（我的推断）**：616 轮 × 每轮 ~15 字 ≈ 9.2k 字；含说话人与窗口上下文、提示词、JSON 骨架，输入按 3–5 倍膨胀 ≈ 3–5 万 token，输入+输出合计 ≈ 5 万 token/条录音。按 DeepSeek 官方页（<https://api-docs.deepseek.com/quick_start/pricing>，2026-09 检索；单价随版本变动，以官方页为准）的量级，单条录音在「几角人民币」；本地 4-bit 14B（Ollama 9.3GB：<https://ollama.com/library/qwen3>）在 24GB 显存机器上按 20–50 tok/s 估算 ≈ 十几分钟/条。微信语音条海量短句的场景：**按时间批量合并成一批调用**，不要一条一调用（推断）。

---

## ④ 参考来源清单

**后纠错 / 生成式纠错（GER）**
1. HyPoradise：开源生成式纠错基线（NeurIPS 2023）— <https://arxiv.org/abs/2309.15701>
2. NVIDIA 页面（HyPoradise）— <https://research.nvidia.com/publication/2023-12_hyporadise-open-baseline-generative-speech-recognition-large-language-models>
3. N-best T5：多假设输入 + 约束解码 — <https://arxiv.org/abs/2303.00456>
4. Rao Ma 等：ASR Error Correction using LLMs（含约束解码实验）— <https://arxiv.org/abs/2409.09554>（HTML：<https://arxiv.org/html/2409.09554v2>）
5. 三阶段框架（预检/CoT/验证）— <https://arxiv.org/abs/2505.24347>
6. ChFT：中文 ASR 全文纠错 + JSON 错误对 — <https://arxiv.org/abs/2409.07790>
7. Chain-of-Correction（ChFT 后续，阈值拒绝）— <https://arxiv.org/abs/2504.01519>
8. ASR-EC：中文 ASR 纠错 benchmark（EMNLP 2025 Industry）— <https://arxiv.org/abs/2412.03075>、ACL：<https://aclanthology.org/2025.emnlp-industry.110/>
9. 置信度 + prompting 接口（Naderi 等，Interspeech 2024）— <https://arxiv.org/abs/2407.21414>
10. Li 等：多语言 1-best 假设下的 ASR 纠错（Interspeech 2024，我未能读取 PDF 正文）— <https://www.isca-archive.org/interspeech_2024/li24h_interspeech.html>

**上下文偏置 / 热词**
11. FunASR 热词教程（hotword 用法与限制）— <https://github.com/modelscope/FunASR/blob/main/docs/tutorial/README.md>
12. FunASR 模型库（Paraformer / ct-punc / SenseVoice / VAD）— <https://github.com/modelscope/FunASR/blob/main/model_zoo/readme_zh.md>
13. SeACo-Paraformer（ICASSP 2024）— <https://arxiv.org/abs/2308.03266>
14. Whisper 源码：prompt 截断与默认守门阈值 — <https://github.com/openai/whisper/blob/main/whisper/decoding.py>、<https://github.com/openai/whisper/blob/main/whisper/transcribe.py>
15. OpenAI 官方 Whisper prompting guide（cookbook 仓库）— <https://github.com/openai/openai-cookbook/blob/main/examples/Whisper_prompting_guide.ipynb>
16. Whisper prompt 被抄进转写（官方 discussion #1150）— <https://github.com/openai/whisper/discussions/1150>
17. Lightweight Prompt Biasing（摘要报告内部数据 30.7% WER 下降）— <https://arxiv.org/abs/2506.06252>
18. Hotword retrieval + RL 的 LLM-ASR 偏置（KER 8.29% / 召回 93.58%）— <https://arxiv.org/abs/2512.21828>
19. BR-ASR：偏置词检索（2.8% B-WER / 20ms）— <https://arxiv.org/abs/2505.19179>
20. LLM 关键词抽取评测（AISD 2025）— <https://aclanthology.org/2025.aisd-main.2.pdf>

**说话人 / 对话结构**
21. CMT-LLM（Interspeech 2025）— <https://arxiv.org/abs/2506.12059>、ISCA：<https://www.isca-archive.org/interspeech_2025/he25_interspeech.pdf>
22. DM-ASR：diarization 作为结构先验 — <https://arxiv.org/abs/2604.22467>
23. WhisperX（词级对齐 + pyannote 分离）— <https://github.com/m-bain/whisperX>
24. Meetily（本地 Whisper + Ollama 摘要）— <https://github.com/Zackriya-Solutions/meeting-minutes>

**中文纠错模型（非 LLM）**
25. pycorrector — <https://github.com/shibing624/pycorrector>
26. pycorrector MacBERT 示例（MacBertCorrector）— <https://github.com/shibing624/pycorrector/blob/master/examples/macbert/README.md>
27. ReaLiSe（SIGHAN 结果表）— <https://github.com/DaDaMrX/ReaLiSe>
28. Soft-Masked BERT — <https://arxiv.org/abs/2005.07421>
29. 中文拼写纠错综述（SIGHAN 缺简体、LLM 过纠/语音弱）— <https://arxiv.org/abs/2502.11508>
30. Rethinking Masked Language Modeling for CSC（ACL 2023）— <https://aclanthology.org/2023.acl-long.600.pdf>
31. MacBERT 原文（Findings of EMNLP 2020）— <https://aclanthology.org/2020.findings-emnlp.58/>

**端到端 / 语音 LLM**
32. Qwen3-ASR（开源 0.6B/1.7B）— <https://github.com/QwenLM/Qwen3-ASR>
33. Qwen3-ASR 技术报告 — <https://arxiv.org/abs/2601.21337>
34. Qwen3-ASR-Flash 发布博客 — <https://qwen.ai/blog?id=41e4c0f6175f9b004a03a07e42343eaaf48329e7>
35. 阿里云 Qwen3-ASR-Flash 文档（计费 ¥0.00022/秒）— <https://help.aliyun.com/en/model-studio/qwen3-asr-flash>
36. Voxtral（Mistral，Apache 2.0，语言不含中文）— <https://mistral.ai/news/voxtral/>、论文：<https://arxiv.org/abs/2507.13264>
37. 中文标点恢复（粤语 LLM 标注，Interspeech 2025）— <https://www.isca-archive.org/interspeech_2025/suen25_interspeech.pdf>
38. 中文医疗标点小 BERT — <https://arxiv.org/abs/2308.12568>

**工程件 / 基础设施**
39. Ollama 结构化输出（JSON Schema）— <https://ollama.com/blog/structured-outputs>
40. Ollama Qwen3 模型库（各尺寸体积）— <https://ollama.com/library/qwen3>
41. llama.cpp GBNF 语法约束 — <https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md>
42. OpenAI 结构化输出 cookbook — <https://github.com/openai/openai-cookbook/blob/main/examples/Structured_Outputs_Intro.ipynb>
43. WeTextProcessing（TN/ITN，评测归一）— <https://github.com/wenet-e2e/WeTextProcessing>
44. DeepSeek 官方定价页 — <https://api-docs.deepseek.com/quick_start/pricing>
45. Whisper 非语音段幻觉缓解（论文）— <https://arxiv.org/abs/2505.12969>
46. Whisper 幻觉现象讨论（官方 issue）— <https://github.com/openai/whisper/discussions/1606>
47. 自一致性/多数投票（通用技术）— <https://arxiv.org/abs/2505.10772>

---

## ⑤ 没查到 / 存疑清单

1. **没有找到「中文、双人日常对话、非朗读」语料上的 LLM 纠错实证**。现有中文证据集中在朗读/新闻/文章类（ASR-EC 用 THCHS-30/AISHELL/WeNetSpeech；ChFT 用 4 万篇文章），微信语音条式口语对话的公开基准缺席 —— 本项目得自建评测（这与「先建金标集」的建议互相印证）。
2. **HyPoradise 具体数字的系统归属未核实**：我抓取到「WSJ 4.5% → 2.2%（−51.1%）」，但未核对该行对应哪套 ASR（Whisper/WavLM/哪一档）。使用前请回原文表格确认。
3. **SeACo-Paraformer 的量化收益没拿到**：论文摘要未含「热词召回提升 X%」的可引用数字（我抓到的页面摘要如此），需要读 PDF 正文核对。
4. **Qwen3-ASR-Flash 的「自定义上下文/热词」能力存疑**：Qwen 发布博客口径与阿里云文档的能力表不一致（文档未列 context 定制），且开源 Qwen3-ASR 报告说支持 context prompt（system token）——两件事不是同一个模型，勿混用。
5. **ChFT / CoC 的具体数字口径**：12.61→8.38 等数字来自论文 HTML 的抓取摘要，且「6.16% → 8.38%（直接输出）/ 4.06%（CoC）」两组数字分布在两篇论文，建议落地前把两张表对齐复核一遍。
6. **ASR-EC 的具体数值（如多模态 3.24% CER vs 基线 12.42%）未能核对**：只确认了摘要级结论（prompting 无效、多模态最佳），数值待核。
7. **pycorrector 的 MacBERT4CSC F1 0.8314 未标测试集口径**（SIGHAN13/14/15 未注明），且与我抓到的 ReaLiSe 数字不同口径，不可直接横向比较。
8. **守门阈值没有一手依据**：CoC 只说「用阈值拒绝」，我没找到给出具体比例（长度比/编辑距离比）的论文；表里的建议值属工程起点，必须自测消融。
9. **双跑一致性用于 ASR 纠错**：没找到直接论文；我引用的是通用自一致性技术，**属推断**。
10. **云端批处理折扣**（OpenAI Batch / Anthropic Message Batches 等）我没有抓到官方页核验（部分厂商页面对抓取返回 403），接入前请查官方最新文档。
11. **Whisper 系「n-best」的工程可得性**：源码层有 beam search，但要稳定拿到 n 条候选需要 HF transformers 的生成参数配合；我未能抓到 transformers 官方文档页核验（抓取失败），落地前请以官方 API 为准。
