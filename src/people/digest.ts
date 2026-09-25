/**
 * 脸谱提炼管线（issue 435 / ADR-0191；双卷画像 issue 455 / ADR-0192）：
 * 统一消息流 → 分批 LLM 采集素材（事件 / 原话 / 场景 / 特质 / 兴趣 / 未竟之事，6 类）
 * → 汇总生成双卷画像：卷一《其人》（人物画像）+ 卷二《我们》（关系画像）+ 关系时间线。
 *
 * 画像维度参考 distilly（titanwings/distilly）的 relationship persona 方法论：
 * 优先「行为模式」而非传记摘要、证据与推断分离、情绪落在具体说话方式上；
 * 双卷拆分与「保留矛盾」「价值观全推断层」等约束另参照 ex-skill / awesome-distill-skills
 * 的 chat_analyzer 四维与 nuwa 五层心智模型（issue 455）。
 * 故分批阶段只负责**采集素材**（含原话与场景），模式提炼交给拿到全量素材的画像阶段——
 * 单批 400 条消息看不出跨月模式，全局才看得出。
 *
 * AI 依赖以 AskLLM 注入（ui 层组装：提炼批走 `.json()` 通道、画像走 `.chat()` 通道），
 * 本层纯编排，可整管单测（假 ask）。
 *
 * 批切双限（maxChars / maxCount）防单批爆上下文；maxBatches 均匀抽样封顶防超大记录白烧 token。
 * 媒体素材（issue 445）：`[语音 …]` 转写与 `[图片]` 描述随文本进对话行，切批时顺带计数，
 * 提炼 prompt 据此说明标签含义并引导语音原话进 quotes、图片描述进 moments。
 */
import type { FaceEvent, InterestItem, MomentItem, PersonProfile, QuoteItem, ThreadItem, UnifiedMessage } from './types';
import { buildMediaNote, collectMediaStats, parseMediaTag } from './media';

/** LLM 依赖（注入；抛错 = 该次提炼失败，上层中止） */
export type AskLLM = (prompt: string) => Promise<string>;

export interface DigestChunk {
  /** 批内首末日期 YYYY-MM-DD */
  from: string;
  to: string;
  count: number;
  /** 已渲染对话行（[YYYY-MM-DD HH:mm][我|对方] 文本） */
  lines: string[];
  /** 批内媒体消息条数（语音转写 / 图片描述；无媒体则缺省，issue 445） */
  media?: { voice: number; image: number };
}

export interface BatchExtract {
  events: FaceEvent[];
  traits: string[];
  quotes: QuoteItem[];
  moments: MomentItem[];
  /** 兴趣信号（issue 455） */
  interests: InterestItem[];
  /** 未竟之事（issue 455） */
  threads: ThreadItem[];
}

/** 画像阶段吃到的素材（已合并去重并按上限抽样） */
export interface PortraitMaterial {
  events: FaceEvent[];
  traits: string[];
  quotes: QuoteItem[];
  moments: MomentItem[];
  /** 兴趣信号（卷一「兴趣爱好」的具体名目来源，issue 455） */
  interests: InterestItem[];
  /** 未竟之事（卷二「未竟之事」的线索来源，issue 455） */
  threads: ThreadItem[];
  /** 素材清单说明：媒体计数 + 情感标记含义（无媒体素材时缺省，issue 445） */
  mediaNote?: string;
  /** 素材五：互动统计叙述段（谁先开口 / 回复快慢 / 深夜比 / 通话时长等；ui 层由预览桶 insights 生成，issue 449） */
  statsNote?: string;
  /** 素材〇：手动档案文本段（buildProfileNote 产出；无档案时缺省，issue 455） */
  profileNote?: string;
}

export interface ChunkOptions {
  maxChars?: number;
  maxCount?: number;
  maxBatches?: number;
}

/** 切批默认双限（issue 450 导出：jobs 引擎的缺省 chunkOpts 与进度说明文案同源） */
export const DEFAULTS: Required<ChunkOptions> = { maxChars: 12000, maxCount: 400, maxBatches: 60 };

/** 画像素材总量上限：素材段过长会让单次调用失衡，超限按时间跨度均匀抽样（增量合并同用，issue 449；interests/threads 为 issue 455 新增） */
export const MATERIAL_LIMITS = { quotes: 60, moments: 40, traits: 30, interests: 40, threads: 30, chronicle: 300 } as const;

/** 切批：滤空文本 → 双限累积 → 批数超上限均匀抽样（保留时序跨度）；媒体标签顺带计数（issue 445） */
export function chunkMessages(messages: UnifiedMessage[], opts: ChunkOptions = {}): DigestChunk[] {
  const { maxChars, maxCount, maxBatches } = { ...DEFAULTS, ...opts };
  const chunks: DigestChunk[] = [];
  let lines: string[] = [];
  let chars = 0;
  let voice = 0;
  let image = 0;
  for (const m of messages) {
    const text = (m.text ?? '').trim();
    if (!text) continue;
    const line = renderLine(m.ts, m.isSender, text);
    const fits = lines.length === 0 || (lines.length < maxCount && chars + line.length <= maxChars);
    if (!fits) {
      chunks.push(makeChunk(lines, voice, image));
      lines = [];
      chars = 0;
      voice = 0;
      image = 0;
    }
    // 媒体计数随消息归属本批：先 flush 再计数，被挤出本批的消息不算上一批的媒体（issue 445）
    const mat = parseMediaTag(text);
    if (mat?.kind === 'voice') voice++;
    else if (mat?.kind === 'image') image++;
    lines.push(line);
    chars += line.length;
  }
  if (lines.length) chunks.push(makeChunk(lines, voice, image));
  if (chunks.length <= maxBatches) return chunks;
  return evenlySample(chunks, maxBatches);
}

/** 等距抽样（首尾必保），并去掉抽样造成的相邻重复项（people 增量合并素材同用，评审 443 导出） */
export function evenlySample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const picked: T[] = [];
  for (let i = 0; i < max; i++) picked.push(items[Math.round((i * (items.length - 1)) / (max - 1))]);
  return picked.filter((v, i, a) => i === 0 || v !== a[i - 1]);
}

function makeChunk(lines: string[], voice = 0, image = 0): DigestChunk {
  const first = lines[0] ?? '';
  const last = lines[lines.length - 1] ?? '';
  const chunk: DigestChunk = { from: first.slice(1, 11), to: last.slice(1, 11), count: lines.length, lines };
  if (voice || image) chunk.media = { voice, image };
  return chunk;
}

/** 批元数据快照（剥对话行的进度/落盘通用形态，issue 450：jobs 引擎与阶段回调单源） */
export interface ChunkMeta {
  from: string;
  to: string;
  count: number;
  voice?: number;
  image?: number;
}

export function chunkMetaOf(c: DigestChunk): ChunkMeta {
  const meta: ChunkMeta = { from: c.from, to: c.to, count: c.count };
  if (c.media) {
    meta.voice = c.media.voice;
    meta.image = c.media.image;
  }
  return meta;
}

function renderLine(ts: number, isSender: boolean, text: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `[${day} ${hm}][${isSender ? '我' : '对方'}] ${text}`;
}

/**
 * 批提炼 prompt：携带本批对话行，采集六类素材，只产出严格 JSON。
 * 采集范围刻意含「原话」与「场景」——它们是画像阶段写出具体模式（而非空话）的唯一证据来源。
 * 批内有媒体消息（issue 445）时补标签说明：语音转写行是亲口说的原话，quotes 优先收（表达 DNA 质量核心）；
 * 图片描述行可作「难忘画面」进 moments。
 * interests / threads（issue 455）：兴趣信号喂卷一「兴趣爱好」的具体名目，未竟之事喂卷二「未竟之事」。
 */
export function buildExtractPrompt(chunk: DigestChunk, personName: string): string {
  const media = chunk.media;
  const head = [
    `你在帮用户整理与好友「${personName}」的微信聊天记录。以下是 ${chunk.from} 至 ${chunk.to} 的片段（[我] = 用户发出，[对方] = 好友发出）。`,
    // 新对话行的语义说明（issue 449）：分享 / 引用 / 通话 / 命名表情是口味审美与关系温度的证据来源
    '行首方括号标签说明：`[分享]…` 与 `[小程序]…` 是分享 / 安利的内容标题（口味与审美的证据，可进 moments 与 traits）；`[文件]…` 是发送的文件；`[引用「…」]` 开头的行是引用回复（引号内为被引内容，其后是回复）；`[通话 …]` / `[通话中断 …]` / `[未接通·…]` 是通话事件（通话时长是关系温度的直接证据，可进 events 与 moments）；`[表情·名]` 是带名称的表情。群聊导出的行首会多一层 `[成员名]`——那不是标签，是群成员的名字，忽略它，谁在说仍看后面的 [我] / [对方]。',
  ];
  if (media?.voice || media?.image) {
    head.push(
      '本段含媒体消息：`[语音 …]` 开头的行是语音转写——] 后的文本就是原话内容，标签里可能带时长与情感标记（如 12s·平静）；`[图片]` 开头的行是一张图片的画面描述。'
    );
  }
  return [
    ...head,
    '',
    ...chunk.lines,
    '',
    '请采集以下六类素材，宁缺毋滥，没有就给空数组：',
    '',
    '1. events：交往事件，大事小事都要收。',
    '   每条含 ts（YYYY-MM-DD，事件发生日期）、kind 与 summary（一句话，不超过 40 字）。',
    '   kind = "major"：约定 / 见面 / 计划 / 重要话题 / 情绪事件 / 矛盾 / 承诺。',
    '   kind = "minor"：第一次做某事 / 分享的具体内容 / 习惯性互动 / 有画面的日常片段。',
    '   日常寒暄、表情包刷屏、无实义闲聊不要收。',
    '',
    '2. traits：对方的性格 / 兴趣 / 习惯线索短语（每条不超过 15 字）。',
    '   只收反复出现或特征鲜明的，不因单次提及就下判断。',
    '',
    '3. quotes：对方说过的有代表性原话（口头禅 / 典型语气 / 情绪外露的句子 / 冲突时的说法 / 关心人的说法）。',
    '   每条含 ts（YYYY-MM-DD）、who（固定为 "对方" 或 "我"）与 text（原话，可截断但**不要改写**）。',
    '   优先收能体现说话风格与脾气秉性的句子，最多 8 条。',
    ...(media?.voice
      ? ['   `[语音 …]` 行是亲口说的话：quotes 优先收这里的口语原话，text 只写转写文本（不要把标签、时长、情感标记写进去）。']
      : []),
    '',
    '4. moments：具体场景或细节（反复出现的地点 / 物件 / 习惯动作 / 难忘画面）。',
    '   每条含 ts（YYYY-MM-DD）与 summary（不超过 30 字）。抽象的形容词不要收。',
    '   反复分享的内容来源（如网易云 / B站 / 豆瓣）也是难忘画面。',
    ...(media?.image ? ['   `[图片]` 行的画面描述就是现成的「难忘画面」，summary 直接用描述本身（不带标签）。'] : []),
    '',
    '5. interests：兴趣信号——对方分享 / 安利的具体内容、反复聊起的话题、正在投入的事。',
    '   每条含 ts（YYYY-MM-DD）与 topic（话题名，不超过 15 字）。',
    '   单次顺带一提不收，反复出现或特征鲜明才收。',
    '',
    '6. threads：未竟之事——约定、邀约、「下次一起…」、聊到一半没下文的话题。',
    '   每条含 ts（YYYY-MM-DD）与 text（不超过 30 字）。',
    '   只采集，不判断是否兑现。',
    '',
    '只输出 JSON，不要任何解释或代码围栏：',
    '{"events":[{"ts":"YYYY-MM-DD","kind":"major","summary":"..."}],"traits":["..."],"quotes":[{"ts":"YYYY-MM-DD","who":"对方","text":"..."}],"moments":[{"ts":"YYYY-MM-DD","summary":"..."}],"interests":[{"ts":"YYYY-MM-DD","topic":"..."}],"threads":[{"ts":"YYYY-MM-DD","text":"..."}]}',
  ].join('\n');
}

/**
 * 关系时间线 prompt（第二个方向：共同经历 → 编年史）。
 * 输入是全部交往事件（含小事），产出按年份分节的成文史——不是事件列表的复述，
 * 而是把碎片串成「这段关系怎么一步步走到今天」。
 */
export function buildChroniclePrompt(name: string, events: FaceEvent[], mediaNote?: string, statsNote?: string): string {
  const eventLines = events.length ? events.map((e) => `- ${e.ts}：${e.summary}`).join('\n') : '（无）';
  return [
    `你在帮用户整理与好友「${name}」的交往史。以下是按时间顺序排列的交往事件（从认识到现在）。`,
    ...(mediaNote ? ['', `素材说明：${mediaNote}`] : []),
    // statsNote 自带「互动画像：」标签，原文成行即可（不再叠加前缀）
    ...(statsNote ? ['', statsNote] : []),
    '',
    eventLines,
    '',
    '请把这段关系写成一份「关系时间线」：',
    '',
    '要求：',
    '- 按时间顺序组织，用 `## 2023 年` 这样的年份小节分隔；素材密集的年份可用 `### 上半年 / 下半年` 再分。',
    '- 每个时期用 `-` 列表逐条写发生的事，**大事小事都要**：谁先开口、第一次做什么、一起去过哪、聊过什么重要话题、闹过什么别扭、怎么和好的。',
    '- 沉默期（断联与回联）也写进对应年份的叙事：哪段时间明显话少或断了联系、后来又怎么重新热络起来。',
    '- 通话或分享特别密集的时期，写成「这段关系的季节」——那是关系的高温期。',
    '- 有明确日期的条目以 `（YYYY-MM-DD）` 收在句尾；同一天的事合并成一条。',
    '- 开头先用一句话交代关系的起点（第一次说话是什么时候、从什么由头开始的）。',
    '- 只写素材里有的事，**不要编造**；素材稀疏的时期宁可只写一两条，也不要为填充而杜撰。',
    '- 可以适度归纳（如「这阵子聊得最多的是那家店」），但事实必须来自素材。',
    '- 总长 1500 字以内，直接输出 markdown 正文，不要代码围栏。',
  ].join('\n');
}

/**
 * 手动档案 → 「素材〇」文本段（issue 455）：生日 / 职业 / 家乡 / 怎么认识 / 什么时候认识 /
 * 关系标签 / 备注，逐项成句；空 / 缺省返回空串（prompt 不加该段）。
 */
export function buildProfileNote(profile?: PersonProfile): string {
  if (!profile) return '';
  const lines: string[] = [];
  if (profile.birthday) lines.push(`生日：${profile.birthday}`);
  if (profile.job) lines.push(`职业：${profile.job}`);
  if (profile.hometown) lines.push(`家乡：${profile.hometown}`);
  if (profile.metVia) lines.push(`怎么认识：${profile.metVia}`);
  if (profile.metAt) lines.push(`什么时候认识：${profile.metAt}`);
  if (profile.tags?.length) lines.push(`关系标签：${profile.tags.join('、')}`);
  if (profile.note) lines.push(`备注：${profile.note}`);
  return lines.join('\n');
}

/** 两卷共用的硬性要求块：沿用旧单卷画像的全部条目 + 「保留矛盾」一条（issue 455） */
const HARD_RULES = [
  '## 硬性要求',
  '- 输出 markdown，只允许这几种语法：`##` 二级小节、`-` 列表项、`**加粗**`、`> ` 引用块。不要一级标题、不要表格、不要代码块。',
  '- 优先写模式，不要写传记：写「TA 习惯用玩笑化解尴尬」，不要写「TA 三月去了北京」。',
  '- 证据与推断分开：有素材支撑的直接写；属于推断的用「看来」「似乎」起头。',
  '- 情绪要具体：不写抽象形容词（如「性格复杂」），写能看见的行为。',
  '- 保留矛盾：素材里相互张力的特征（如恋旧又独立、记仇又复盘）是特征不是噪声，如实保留，不许抹平。',
  '- 素材不足以支撑的小节，写「（素材不足）」，绝不编造。',
  '- 全文 1200 字以内，直接输出 markdown 正文，不要代码围栏。',
].join('\n');

/** 素材列表行：有条目逐行列出，无则写占位 */
function linesOrNone(lines: string[]): string {
  return lines.length ? lines.join('\n') : '（无）';
}

/**
 * 卷一《其人》prompt（issue 455：由旧单卷 buildPortraitPrompt 拆出的人物轴）。
 * 素材分段：档案（profileNote 若有）/ 事件 / 原话 / 场景 / 特质线索 / 兴趣信号 / 互动统计（statsNote 若有）；
 * 产出 7 节：画像速写（须含一组矛盾感）/ 性格与思维 / 表达 DNA（称呼归卷二）/ 兴趣爱好（三层）/
 * 价值观与红线（全推断层）/ 习惯 / 情感倾向（语音情感计数直引）。样本警示 sampleWarn 非空时插头部。
 */
export function buildPersonPrompt(name: string, material: PortraitMaterial, sampleWarn?: string): string {
  const { events, traits, quotes, moments, interests, mediaNote, statsNote, profileNote } = material;
  return [
    `你在帮用户为好友「${name}」画一张「脸谱」的卷一《其人》——基于以下从聊天记录里提炼的素材，写出这个人本身的人物画像。人物与关系是两条轴：TA 是个什么样的人归本卷，「我们」怎么相处归卷二《我们》，本卷不写关系。`,
    ...(sampleWarn ? [sampleWarn] : []),
    ...(mediaNote ? ['', `素材说明：${mediaNote}`, ''] : []),
    '',
    ...(profileNote ? ['## 素材〇：档案（手动信息，与聊天印象冲突时以档案为准）', profileNote, ''] : []),
    '## 素材一：交往事件',
    linesOrNone(events.map((e) => `- ${e.ts}：${e.summary}`)),
    '',
    '## 素材二：代表性原话',
    linesOrNone(quotes.map((q) => `- [${q.who}]「${q.text}」（${q.ts}）`)),
    '',
    '## 素材三：场景与细节',
    linesOrNone(moments.map((m) => `- ${m.ts}：${m.summary}`)),
    '',
    '## 素材四：特质线索',
    linesOrNone(traits.map((t) => `- ${t}`)),
    '',
    '## 素材五：兴趣信号',
    linesOrNone(interests.map((i) => `- ${i.ts}：${i.topic}`)),
    ...(statsNote ? ['', '## 素材六：互动统计', statsNote] : []),
    '',
    '## 要产出的卷一《其人》（按此顺序，每节用 ## 二级标题）',
    '',
    '## 画像速写',
    '两三句话抓住这个人给人的整体感觉。必须写出一组矛盾感（相互张力的特征）——矛盾是特征不是噪声，不许抹平。',
    '',
    '## 性格与思维',
    '处事风格、脾气秉性、社交姿态，加上思维模式：怎么想问题、自我对话的方式、对尝试与第一次的态度。',
    '写法用行为规则：「当 X 时，TA Y」。TA 对自己的描述（自嘲 / 自剖 / 人格梗）只当线索引述，不当下结论。',
    '',
    '## 表达 DNA',
    '口头禅、高频词、句式节奏、标点与语气习惯、表情使用习惯、「不想理人」的信号。',
    '每条特征后面跟一个 `> ` 引用块，放素材里的真实原话当证据。称呼 / 昵称不写在这节（归卷二《我们》）。',
    '',
    '## 兴趣爱好',
    '分三层写：实际投入（愿意花时间做的事）→ 内容口味（爱看什么听什么）→ 精神底色（审美取向）。',
    '每层要有具体名目（作品名 / 活动名），不许只写形容词；没有的层写「（素材不足）」。',
    '',
    '## 价值观与红线',
    '在乎什么、反感什么、评判人和事的角度、绝不做什么。本节全部属推断：每条必须以「看来」或「似乎」起头；素材不足整节写「（素材不足）」。',
    '',
    '## 习惯',
    '生活习惯与聊天习惯：写可感知的模式，不罗列数字。',
    '',
    '## 情感倾向',
    '情绪基线（素材里的语音情感计数可直引）、表达情绪的方式（外露 / 憋着 / 反话）、什么能点亮 TA、什么让 TA 沉默。',
    '',
    HARD_RULES,
  ].join('\n');
}

/**
 * 卷二《我们》prompt（issue 455：由旧单卷 buildPortraitPrompt 拆出的关系轴）。
 * 素材分段：档案（profileNote 若有）/ 事件 / 原话 / 场景 / 未竟之事线索（threads）/ 互动统计（statsNote 若有）；
 * 产出 8 节：关系定性 / 互动结构（不罗列数字）/ 演变阶段 / 我们的语言 / 共同记忆 /
 * 冲突与修复（和解信号单独写）/ 未竟之事（对照 events 判断兑现）/ 经营建议。样本警示同卷一。
 */
export function buildBondPrompt(name: string, material: PortraitMaterial, sampleWarn?: string): string {
  const { events, quotes, moments, threads, mediaNote, statsNote, profileNote } = material;
  return [
    `你在帮用户为好友「${name}」画一张「脸谱」的卷二《我们》——基于以下从聊天记录里提炼的素材，写出「用户与 TA」这段关系的画像。TA 本身是个什么样的人归卷一《其人》，本卷只写这段关系。`,
    ...(sampleWarn ? [sampleWarn] : []),
    ...(mediaNote ? ['', `素材说明：${mediaNote}`, ''] : []),
    '',
    ...(profileNote ? ['## 素材〇：档案（手动信息，与聊天印象冲突时以档案为准）', profileNote, ''] : []),
    '## 素材一：交往事件',
    linesOrNone(events.map((e) => `- ${e.ts}：${e.summary}`)),
    '',
    '## 素材二：代表性原话',
    linesOrNone(quotes.map((q) => `- [${q.who}]「${q.text}」（${q.ts}）`)),
    '',
    '## 素材三：场景与细节',
    linesOrNone(moments.map((m) => `- ${m.ts}：${m.summary}`)),
    '',
    '## 素材四：未竟之事线索',
    linesOrNone(threads.map((t) => `- ${t.ts}：${t.text}`)),
    ...(statsNote ? ['', '## 素材五：互动统计', statsNote] : []),
    '',
    '## 要产出的卷二《我们》（按此顺序，每节用 ## 二级标题）',
    '',
    '## 关系定性',
    '一段什么关系、TA 在用户生活里的独特角色、现在处在什么阶段。手动档案（关系标签 / 怎么认识）优先；档案与聊天印象冲突时，以档案为准并注明。',
    '',
    '## 互动结构',
    '谁更常先开口、回复节奏差、活跃时段、语音文字视频偏好、通话密度。互动统计是事实依据，但不要罗列数字——写可感知的相处模式与解读。',
    '',
    '## 演变阶段',
    '按素材把这段关系划成几个阶段（如热络期 / 转折 / 渐冷 / 回联），每个阶段一句定性 + 转折点事件。转淡或沉默是怎么发生的、后来是谁先开口回联。最后一句写「现在」——这段关系此刻在哪。',
    '',
    '## 我们的语言',
    '称呼演变：TA 怎么叫用户、用户怎么叫 TA、随情绪或亲密度的变化。再整理一份只属于这段关系的梗与暗语小词典。',
    '',
    '## 共同记忆',
    '反复出现的地点、物件、习惯、画面。要具体到能想起当时的场景。',
    '',
    '## 冲突与修复',
    '按行为链写：触发点清单（素材明说的标「直接」，推断的标「推断」）→ 冲突时的第一反应谱 → 升级信号 → 怎么收场。和解信号单独写——和解不一定是道歉，可能是发来一个梗、一句「有空吗」。收尾给一份雷区清单。',
    '',
    '## 未竟之事',
    '没兑现的约定、想一起做还没做的、聊一半断掉的话题。对照交往事件判断：约定过且后来一起做了的不收。',
    '',
    '## 经营建议',
    '怎么经营这段关系：什么能升温、什么会伤害、别踩什么。把档案标签翻译成具体的相处规则。',
    '',
    HARD_RULES,
  ].join('\n');
}

/** 松散 JSON 提取：剥代码围栏 → 截取首个 { 或 [ 到末个 } 或 ] → parse；失败抛错 */
export function extractJsonLoose(raw: string): unknown {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.search(/[{[]/);
  if (start < 0) throw new Error('AI 回执里没有 JSON');
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (end <= start) throw new Error('AI 回执 JSON 不完整');
  return JSON.parse(s.slice(start, end + 1));
}

/** 回执 → BatchExtract 归一校验：字段串化、数组兜底、残缺项剔除 */
export function parseBatchExtract(raw: string): BatchExtract {
  const data = extractJsonLoose(raw) as Record<string, unknown>;
  const events: FaceEvent[] = [];
  for (const e of arrOf(data.events)) {
    const ts = str(e.ts);
    const summary = str(e.summary);
    if (!ts || !summary) continue;
    const kind = str(e.kind);
    events.push(kind === 'major' || kind === 'minor' ? { ts, summary, kind } : { ts, summary });
  }
  const quotes: QuoteItem[] = [];
  for (const q of arrOf(data.quotes)) {
    const ts = str(q.ts);
    const text = str(q.text);
    if (ts && text) quotes.push({ ts, who: str(q.who) || '对方', text });
  }
  const moments: MomentItem[] = [];
  for (const m of arrOf(data.moments)) {
    const ts = str(m.ts);
    const summary = str(m.summary);
    if (ts && summary) moments.push({ ts, summary });
  }
  const traits = rawArr(data.traits)
    .filter((t) => typeof t !== 'object' || t === null) // traits 是短语数组，对象元素是脏数据
    .map((t) => str(t))
    .filter(Boolean);
  const interests: InterestItem[] = [];
  for (const it of arrOf(data.interests)) {
    const ts = str(it.ts);
    const topic = str(it.topic);
    if (ts && topic) interests.push({ ts, topic });
  }
  const threads: ThreadItem[] = [];
  for (const t of arrOf(data.threads)) {
    const ts = str(t.ts);
    const text = str(t.text);
    if (ts && text) threads.push({ ts, text });
  }
  return { events, traits, quotes, moments, interests, threads };
}

/** 数组字段兜底：非数组 → 空数组；元素须为对象（events / quotes / moments 的形态） */
function arrOf(v: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
}

/** 数组字段兜底：只保证是数组（traits 允许原始值元素） */
function rawArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  return String(v ?? '').trim();
}

export async function extractBatch(ask: AskLLM, chunk: DigestChunk, personName: string): Promise<BatchExtract> {
  return parseBatchExtract(await ask(buildExtractPrompt(chunk, personName)));
}

export interface BuiltFace {
  /** 卷一《其人》（issue 455） */
  person: string;
  /** 卷二《我们》（issue 455） */
  bond: string;
  events: FaceEvent[];
  quotes: QuoteItem[];
  /** 场景与细节（合并抽样后随返回值落盘，增量重画不丢，issue 449） */
  moments: MomentItem[];
  /** 特质线索（同 moments，issue 449） */
  traits: string[];
  /** 兴趣信号（合并抽样后随返回值落盘，issue 455） */
  interests: InterestItem[];
  /** 未竟之事（同 interests，issue 455） */
  threads: ThreadItem[];
  /** 关系时间线（编年史）；生成失败或素材不足时为空串，不阻断画像产出 */
  chronicle: string;
}

/** 批结果合并后的素材（去重未抽样；events 含轻重回填并按日期升序） */
export interface MergedMaterial {
  events: FaceEvent[];
  quotes: QuoteItem[];
  moments: MomentItem[];
  traits: string[];
  interests: InterestItem[];
  threads: ThreadItem[];
}

/**
 * 批结果 → 合并素材（全流程与 jobs 引擎共用的合并单源，issue 450 抽出）：
 * events 按 ts|summary 去重（同一件事可能被相邻两批都采到）且后出现的轻重标记回填、按日期升序；
 * quotes/moments/traits/interests/threads 按键去重只留首个、保持输入顺序（不抽样——抽样在 toPortraitMaterial）。
 */
export function mergeBatches(batches: BatchExtract[]): MergedMaterial {
  return {
    events: mergeEvents(batches.flatMap((b) => b.events)),
    quotes: dedupeBy(batches.flatMap((b) => b.quotes), (q) => q.text),
    moments: dedupeBy(batches.flatMap((b) => b.moments), (m) => m.summary),
    traits: dedupeBy(batches.flatMap((b) => b.traits), (t) => t),
    interests: dedupeBy(batches.flatMap((b) => b.interests), (i) => i.topic),
    threads: dedupeBy(batches.flatMap((b) => b.threads), (t) => t.text),
  };
}

/**
 * 合并素材 → 画像材料（抽样口径单源，issue 450 抽出）：
 * 素材按上限均匀抽样；events 缺省全量（full 口径），sampleEvents=true 时按时间线封顶抽样
 * （incremental 口径）。mediaNote / statsNote / profileNote 原样透传。
 */
export function toPortraitMaterial(
  merged: MergedMaterial,
  o: { mediaNote?: string; statsNote?: string; profileNote?: string; sampleEvents?: boolean } = {}
): PortraitMaterial {
  return {
    events: o.sampleEvents ? evenlySample(merged.events, MATERIAL_LIMITS.chronicle) : merged.events,
    traits: evenlySample(merged.traits, MATERIAL_LIMITS.traits),
    quotes: evenlySample(merged.quotes, MATERIAL_LIMITS.quotes),
    moments: evenlySample(merged.moments, MATERIAL_LIMITS.moments),
    interests: evenlySample(merged.interests, MATERIAL_LIMITS.interests),
    threads: evenlySample(merged.threads, MATERIAL_LIMITS.threads),
    mediaNote: o.mediaNote,
    statsNote: o.statsNote,
    profileNote: o.profileNote,
  };
}

/** 阶段化进度（issue 450 E1；issue 455 起成文阶段拆四段）：extracting 逐批推进（total = 抽样后的批数），person / bond / chronicle 各一步 */
export interface FaceProgress {
  stage: 'extracting' | 'person' | 'bond' | 'chronicle';
  done: number;
  total: number;
  /** 本批元数据（extracting 阶段携带；含媒体计数） */
  current?: ChunkMeta;
}

/** 素材采集完成后的中间计数（合并去重后、抽样前；供「事件 214 · 原话 63 …」成文文案） */
export interface MaterialCounts {
  events: number;
  quotes: number;
  moments: number;
  traits: number;
}

/** 样本不足阈值：消息量低于此数素材偏少，两卷 prompt 头注警示（issue 455） */
export const SAMPLE_WARN_THRESHOLD = 200;

/** 样本警示句（两卷共用同一段；样本充足返回 undefined） */
export function sampleWarnOf(count: number): string | undefined {
  return count < SAMPLE_WARN_THRESHOLD
    ? `注意：本次样本仅 ${count} 条消息，素材偏少——证据不足的小节直接写（素材不足），不要脑补。`
    : undefined;
}

/** buildFace / buildFaceIncremental 的运行参数（issue 450：旧位置参数 onProgress/chunkOpts/mediaNote/statsNote 收拢） */
export interface FaceRunOptions {
  /** 切批参数（缺省即 DEFAULTS；仅 buildFace 消费——增量管线固定默认双限） */
  chunkOpts?: ChunkOptions;
  /** 媒体素材清单说明（缺省由本次消息流自算） */
  mediaNote?: string;
  /** 互动统计叙述段（ui 层由预览桶 insights 生成后透传） */
  statsNote?: string;
  /** 手动档案（issue 455：经 buildProfileNote 转档案段进两卷 prompt 头部） */
  profile?: PersonProfile;
  /** 样本不足警示句覆盖（缺省按消息量自算：< 200 条时注入两卷 prompt；增量调用方可传全量口径） */
  sampleWarn?: string;
  /** 阶段化进度回调 */
  onProgress?: (p: FaceProgress) => void;
  /** 素材采集完成回调（画像开始前；中间计数供成文阶段文案） */
  onMaterial?: (c: MaterialCounts) => void;
}

/**
 * 全流程（issue 455 双卷版）：切批 → 逐批采集（askExtract / JSON 通道）→ 合并去重
 * → 三次文本调用：卷一《其人》（必产，空则抛错）→ 卷二《我们》（必产，空则抛错）
 * → 关系时间线（best-effort 兜空串）。
 * 任一批失败原样抛错（上层中止并报错）。
 * opts（issue 450 收拢旧位置参数）：chunkOpts 透传切批参数（缺省即 DEFAULTS 双限）；
 * onProgress 升级为阶段化进度（extracting 逐批带本批元数据 / person / bond / chronicle）；
 * onMaterial 在素材采集完成后回调中间计数（合并去重、抽样前口径）；
 * mediaNote 缺省由本次消息流自算（ui 层增量重画时传跨导入累计口径）；statsNote 缺省整段不进 prompt；
 * profile（issue 455）转档案段进两卷 prompt；样本不足（< 200 条，issue 455）两卷 prompt 头注警示。
 */
export async function buildFace(
  askExtract: AskLLM,
  askPortrait: AskLLM,
  messages: UnifiedMessage[],
  personName: string,
  opts: FaceRunOptions = {}
): Promise<BuiltFace> {
  const { chunkOpts, mediaNote, statsNote, profile, sampleWarn: warnOverride, onProgress, onMaterial } = opts;
  const chunks = chunkMessages(messages, chunkOpts);
  if (!chunks.length) throw new Error('没有可提炼的文本消息');
  const batches: BatchExtract[] = [];
  for (let i = 0; i < chunks.length; i++) {
    batches.push(await extractBatch(askExtract, chunks[i], personName));
    onProgress?.({ stage: 'extracting', done: i + 1, total: chunks.length, current: chunkMetaOf(chunks[i]) });
  }
  const merged = mergeBatches(batches);
  onMaterial?.({ events: merged.events.length, quotes: merged.quotes.length, moments: merged.moments.length, traits: merged.traits.length });
  const material = toPortraitMaterial(merged, {
    mediaNote: mediaNote ?? (buildMediaNote(collectMediaStats(messages)) || undefined),
    statsNote,
    profileNote: buildProfileNote(profile) || undefined,
  });
  const sampleWarn = warnOverride ?? sampleWarnOf(messages.length);
  onProgress?.({ stage: 'person', done: 0, total: 1 });
  const person = (await askPortrait(buildPersonPrompt(personName, material, sampleWarn))).trim();
  if (!person) throw new Error('卷一《其人》生成为空');
  onProgress?.({ stage: 'bond', done: 0, total: 1 });
  const bond = (await askPortrait(buildBondPrompt(personName, material, sampleWarn))).trim();
  if (!bond) throw new Error('卷二《我们》生成为空');
  // 时间线是次要产物：它失败不该把已经画好的双卷一起丢掉，故单独兜住
  let chronicle = '';
  if (merged.events.length) {
    onProgress?.({ stage: 'chronicle', done: 0, total: 1 });
    try {
      chronicle = (await askPortrait(buildChroniclePrompt(personName, evenlySample(merged.events, MATERIAL_LIMITS.chronicle), material.mediaNote, material.statsNote))).trim();
    } catch {
      chronicle = '';
    }
  }
  return {
    person,
    bond,
    chronicle,
    events: merged.events,
    quotes: material.quotes,
    moments: material.moments,
    traits: material.traits,
    interests: material.interests,
    threads: material.threads,
  };
}

/**
 * 事件合并：key = ts|summary 去重（同一件事可能被相邻两批都采到）。
 * 后出现的轻重标记要回填——先采到的可能没标 kind，直接丢会把「大事」降级成普通条目。
 */
function mergeEvents(events: FaceEvent[]): FaceEvent[] {
  const byKey = new Map<string, FaceEvent>();
  for (const e of events) {
    const key = `${e.ts}|${e.summary}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, e);
    else if (!prev.kind && e.kind) byKey.set(key, { ...prev, kind: e.kind });
  }
  return [...byKey.values()].sort((a, b) => a.ts.localeCompare(b.ts));
}

/** 去重（key 相同只留首个），保持输入顺序 */
function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
