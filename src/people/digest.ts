/**
 * 脸谱提炼管线（issue 435 / ADR-0191；双卷画像 issue 455 / ADR-0192）：
 * 统一消息流 → 分批 LLM 采集素材（事件 / 原话 / 场景 / 特质 / 兴趣 / 未竟之事，6 类）
 * → 汇总生成双卷画像：卷一《其人》（人物画像）+ 卷二《相交》（关系画像）+ 《纪事》。
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
  /** 素材五：互动统计叙述段（谁先开口 / 回复快慢 / 深夜比 / 通话时长等；ui 层由聊天仓 insights 生成，issue 449） */
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
    `我在整理我和好友「${personName}」的微信聊天记录。以下是 ${chunk.from} 至 ${chunk.to} 的片段（[我] = 我发出的，[对方] = 对方发出的）。`,
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
 * 《纪事》 prompt（第二个方向：共同经历 → 编年史）。
 * 输入是全部交往事件（含小事），产出按年份分节的成文史——不是事件列表的复述，
 * 而是把碎片串成「这段关系怎么一步步走到今天」。
 */
export function buildChroniclePrompt(name: string, events: FaceEvent[], mediaNote?: string, statsNote?: string): string {
  const eventLines = events.length ? events.map((e) => `- ${e.ts}：${e.summary}`).join('\n') : '（无）';
  return [
    `我在整理我和「${name}」这些年的交往史，要写成一份《纪事》。下面是从认识到现在、按时间排的交往事件。`,
    ...(mediaNote ? ['', `素材说明：${mediaNote}`] : []),
    // statsNote 自带「互动画像：」标签，原文成行即可（不再叠加前缀）
    ...(statsNote ? ['', statsNote] : []),
    '',
    eventLines,
    '',
    '请把这段关系写成一份《纪事》：',
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
    '- 下面的文体要求同样适用；其中「小节标题照抄给定的标题」在这里指年份小节固定用 `## 2023 年` 的写法。',
    '',
    TONE_RULES,
  ].join('\n');
}

/**
 * 手动档案 → 「素材〇」文本段（issue 455 建；issue 487 扩十维）：生日 / 称呼 / 职业 / 家乡 /
 * 怎么认识 / 什么时候认识 / 关系标签 / 备注 / 性格 / 兴趣爱好 / 作息 / 近况 / 口头禅 /
 * 喜欢 / 反感 / 身边人 / 重要日子，逐项成句；空 / 缺省返回空串（prompt 不加该段）。
 */
export function buildProfileNote(profile?: PersonProfile): string {
  if (!profile) return '';
  const lines: string[] = [];
  if (profile.birthday) lines.push(`生日：${profile.birthday}`);
  if (profile.nickname) lines.push(`称呼：${profile.nickname}`);
  if (profile.job) lines.push(`职业：${profile.job}`);
  if (profile.hometown) lines.push(`家乡：${profile.hometown}`);
  if (profile.metVia) lines.push(`怎么认识：${profile.metVia}`);
  if (profile.metAt) lines.push(`什么时候认识：${profile.metAt}`);
  if (profile.tags?.length) lines.push(`关系标签：${profile.tags.join('、')}`);
  if (profile.note) lines.push(`备注：${profile.note}`);
  if (profile.personality) lines.push(`性格：${profile.personality}`);
  if (profile.interests?.length) lines.push(`兴趣爱好：${profile.interests.join('、')}`);
  if (profile.habits) lines.push(`作息 / 习惯：${profile.habits}`);
  if (profile.recentLife) lines.push(`近况：${profile.recentLife}`);
  if (profile.quote) lines.push(`口头禅：${profile.quote}`);
  if (profile.likes?.length) lines.push(`喜欢：${profile.likes.join('、')}`);
  if (profile.dislikes?.length) lines.push(`反感 / 雷点：${profile.dislikes.join('、')}`);
  if (profile.relationships?.length) {
    const rel = profile.relationships
      .map((r) => (r.who && r.relation ? `${r.who}（${r.relation}）` : r.who || r.relation))
      .filter(Boolean)
      .join('、');
    lines.push(`身边人：${rel}`);
  }
  if (profile.importantDates?.length) {
    lines.push(`重要日子：${profile.importantDates.map((d) => [d.date, d.what].filter(Boolean).join(' ')).filter(Boolean).join('、')}`);
  }
  return lines.join('\n');
}

/**
 * 两卷共用的硬性要求块：沿用旧单卷画像的全部条目 + 「保留矛盾」一条（issue 455）。
 * 去 AI 味修订：模式条改「用事写」（原「当 X 时，TA Y」句式本身就是公式感的来源）、
 * 补引用块全篇配比、字数 1200 → 1500（散笔比概括句吃长度）。
 */
const HARD_RULES = [
  '## 硬性要求',
  '- 输出 markdown，只允许这几种语法：`##` 二级小节、`-` 列表项、`**加粗**`、`> ` 引用块。不要一级标题、不要表格、不要代码块。',
  '- 写模式，但用事写，不要用规则写。不要「当 X 时，TA 会 Y」这种句式——改写成「那次我说要去，他回了句『随便』，过了两天自己订了票」。模式让读的人自己看出来，不要替他总结。',
  '- 证据与推断分开：有素材支撑的直接写；属于推断的用「看来」「似乎」起头。',
  '- 情绪要具体：不写抽象形容词（如「性格复杂」），写能看见的行为。',
  '- 保留矛盾：素材里相互张力的特征（如恋旧又独立、记仇又复盘）是特征不是噪声，如实保留，不许抹平。',
  '- 全篇 3~6 处 `> ` 引用块，放在最像 TA 的原话上；没有原话可引就少写，不要凑数。',
  '- 素材不足以支撑的小节，写「（素材不足）」，绝不编造。',
  '- 全文 1500 字以内，直接输出 markdown 正文，不要代码围栏。',
].join('\n');

/**
 * 三处成文 prompt 共用的文体块（去 AI 味：第一人称日记散笔）。
 *
 * 规则分两层，边界要守住：
 * - **句法 / 语气层**（可搬社区去 AI 味口径）：人称、节奏量化、口语额度、禁词表、犹豫配额。
 *   社区方案的共同经验是「像人写」这种定性要求不落地，得给可检查的数（句长区间、犹豫次数、
 *   抽象结论后必须垫事）——定性只会让模型继续写它的平均人格。
 * - **内容层**（不许搬）：社区普遍允许「没有细节时根据上下文合理虚构」，本条**绝不适用**——
 *   脸谱素材是聊天记录里真实发生过的事，属事实层；为凑人味编一个细节，等于往一个人的关系档案
 *   里塞假记忆，比 AI 味严重得多。故本块只管「怎么写」，一个字都不放松「写什么」。
 */
const TONE_RULES = [
  '## 文体：日记散笔',
  '- 这是我自己写给自己的笔记，不是交给别人看的报告。通篇用「我」，提到对方时用名字或「TA」；**正文里不许出现「用户」两个字**。',
  '- 从具体的事开口。「上次他发来那首歌的时候」比「在互动中 TA 表现出」好。每节至少落一个素材里真实出现过的时刻、原话或物件。',
  '- 长短句交替，别让每句一样长、每段一样长：连续两句都超过 18 字就拆开，连续两句都不到 10 字就并起来。',
  '- 口语可以进来（「说真的」「其实」「后来才想起来」），每百字不超过 3 个；可以用语气词、破折号，用括号补一句心里话。',
  '- 全篇至少出现一次犹豫或自我修正：「我记得」「也可能是我多想了」「这事儿我到现在也没想明白」。',
  '- 每写一个抽象的结论，后面就跟一件能看见的事垫着，不要只给判断。',
  '- 宁可写得像随手记，也不要写得像总结。**每节不要升华、不要收尾金句、不要排比三段。**',
  '- 禁用这些套话：值得注意、整体而言、表现出……的特点、具有……的特质、从……来看、不难看出、这说明、某种程度上、既……又……、不仅……而且、首先其次最后、在当今、随着……的发展、具有重要意义、发挥积极作用。',
  '- 小节标题照抄给定的标题，不要改写标题。',
  '',
  '同一个意思，两种写法（按后一种写）：',
  '- 报告腔：TA 是一个性格复杂的人，既有独立的一面，也有恋旧的一面，在关系中常常表现出矛盾的情感。',
  '- 散笔：她说自己一个人待着最舒服，转头又把我三个月前随口提的那家店记在备忘录里，发来问我什么时候去。',
].join('\n');

/** 素材列表行：有条目逐行列出，无则写占位 */
function linesOrNone(lines: string[]): string {
  return lines.length ? lines.join('\n') : '（无）';
}

/**
 * 卷一《其人》prompt（issue 455：由旧单卷 buildPortraitPrompt 拆出的人物轴）。
 * 素材分段：档案（profileNote 若有）/ 事件 / 原话 / 场景 / 特质线索 / 兴趣信号 / 互动统计（statsNote 若有）；
 * 产出 7 节：画像速写（须含一组别扭处）/ 性格与思维 / 表达 DNA（称呼归卷二）/ 兴趣爱好（三层）/
 * 价值观与红线（全推断层）/ 习惯 / 情感倾向（语音情感计数直引）。样本警示 sampleWarn 非空时插头部。
 */
export function buildPersonPrompt(name: string, material: PortraitMaterial, sampleWarn?: string): string {
  const { events, traits, quotes, moments, interests, mediaNote, statsNote, profileNote } = material;
  return [
    `我在给好友「${name}」画一张「脸谱」，这是卷一《其人》，写 TA 这个人本身。下面是我从我们的聊天记录里提炼出来的素材。人和关系分两条轴：TA 是个什么样的人归卷一，我们俩怎么相处归卷二《相交》，卷一只写 TA，不写关系。`,
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
    '两三句话，像跟人介绍一个刚认识的朋友。必须带着一组别扭的地方（相互打架的特征）——别扭是特征不是噪声，不许抹平。',
    '不要用「TA 是一个……的人」开头，从一个具体的事说起。',
    '',
    '## 性格与思维',
    '处事风格、脾气秉性、社交姿态，加上思维模式：怎么想问题、自我对话的方式、对尝试与第一次的态度。',
    'TA 自己怎么讲自己（自嘲 / 自剖 / 人格梗）只当线索引一句，后面接我实际看到的，不当下结论。',
    '',
    '## 表达 DNA',
    '口头禅、高频词、句式节奏、标点与语气习惯、表情使用习惯、「不想理人」的信号。',
    '挑两三条最能代表 TA 的说法，每条后面跟一个 `> ` 引用块放真实原话当证据。称呼 / 昵称不写在这节（归卷二《相交》）。',
    '',
    '## 兴趣爱好',
    '分三层写：实际投入（愿意花时间做的事）→ 内容口味（爱看什么听什么）→ 精神底色（审美取向）。',
    '每层都要点到具体的作品名 / 活动名；想不起名目就写「（素材不足）」，不要拿形容词凑数。',
    '',
    '## 价值观与红线',
    '在乎什么、反感什么、评判人和事的角度、绝不做什么。本节全部属推断：每条必须以「看来」或「似乎」起头；素材不足整节写「（素材不足）」。',
    '',
    '## 习惯',
    '生活习惯与聊天习惯：写可感知的模式，不罗列数字。',
    '',
    '## 情感倾向',
    '情绪基线（素材里的语音情感计数可直引）、表达情绪的方式（外露 / 憋着 / 反话）、什么能点亮 TA、什么让 TA 沉默。',
    '不要用「情绪稳定」「内心丰富」这类词，写我见过的那一次。',
    '',
    HARD_RULES,
    '',
    TONE_RULES,
  ].join('\n');
}

/**
 * 卷二《相交》prompt（issue 455：由旧单卷 buildPortraitPrompt 拆出的关系轴）。
 * 素材分段：档案（profileNote 若有）/ 事件 / 原话 / 场景 / 未竟之事线索（threads）/ 互动统计（statsNote 若有）；
 * 产出 8 节：关系定性 / 互动结构（不罗列数字）/ 演变阶段 / 我们的语言 / 共同记忆 /
 * 冲突与修复（和解信号单独写）/ 未竟之事（对照 events 判断兑现）/ 经营建议。样本警示同卷一。
 */
export function buildBondPrompt(name: string, material: PortraitMaterial, sampleWarn?: string): string {
  const { events, quotes, moments, threads, mediaNote, statsNote, profileNote } = material;
  return [
    `我在给好友「${name}」画一张「脸谱」，这是卷二《相交》，写我和 TA 这段关系。下面是我从我们的聊天记录里提炼出来的素材。TA 本身是个什么样的人归卷一，本卷只写我们俩怎么相处。`,
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
    '## 要产出的卷二《相交》（按此顺序，每节用 ## 二级标题）',
    '',
    '## 关系定性',
    '这是一段什么关系、TA 在我这儿是什么角色、现在走到哪一步了。手填档案（关系标签 / 怎么认识）优先；档案和聊天印象打架时以档案为准，并写一句「档案里是这么记的」。',
    '开头不要写「我们是一段……的关系」这种判断句，从一个具体的事说起。',
    '',
    '## 互动结构',
    '谁更常先开口、回复节奏差、活跃时段、语音文字视频偏好、通话密度。互动统计是事实依据，但不要罗列数字——写可感知的相处模式与解读。',
    '',
    '## 演变阶段',
    '按素材把这段关系划成几个阶段（如热络期 / 转折 / 渐冷 / 回联），每个阶段一句定性 + 转折点事件。转淡或沉默是怎么发生的、后来是谁先开口回联。最后一句写「现在」——这段关系此刻在哪。',
    '',
    '## 我们的语言',
    'TA 怎么叫我、我怎么叫 TA，随情绪和关系冷热怎么变。再列一份只有我们俩才懂的梗与暗语小词典。',
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
    '',
    TONE_RULES,
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

// ---------------- 人物档案提炼（issue 487：画谱时 AI 按证据自动回填） ----------------

/** PersonProfile 自由文本字段（AI 契约 / 表单回填 / 只填空合并三处共用的清单） */
export const PROFILE_TEXT_FIELDS = [
  'birthday', 'metVia', 'metAt', 'hometown', 'job', 'note',
  'personality', 'habits', 'recentLife', 'nickname', 'quote',
] as const;

/** PersonProfile 字符串数组字段（同上三处共用） */
export const PROFILE_LIST_FIELDS = ['tags', 'interests', 'likes', 'dislikes'] as const;

/** 档案提炼的素材面（FaceDigest 与 MergedMaterial 的公共投影；只吃已落盘的提炼素材，不碰聊天原文） */
export interface ProfileExtractMaterial {
  events?: FaceEvent[];
  quotes?: QuoteItem[];
  moments?: MomentItem[];
  traits?: string[];
  interests?: InterestItem[];
  threads?: ThreadItem[];
}

/**
 * 提炼素材 → 档案提炼 prompt 的素材文本（ui 的「AI 补充」与 jobs 的画谱回填共用同一组装口径）：
 * 大事前置的事件在前，其后原话 / 场景 / 特质 / 兴趣 / 未竟逐段成节；全空返回空串。
 */
export function profileExtractMaterial(m: ProfileExtractMaterial): string {
  const events = m.events ?? [];
  const majors = events.filter((e) => e.kind === 'major');
  const sections: string[] = [];
  const add = (title: string, lines: string[]): void => {
    if (lines.length) sections.push(`【${title}】\n${lines.join('\n')}`);
  };
  add('交往事件', [...majors, ...events.filter((e) => e.kind !== 'major')].slice(0, 200).map((e) => `${e.ts} ${e.summary}`));
  add('代表性原话', (m.quotes ?? []).slice(0, 40).map((q) => `${q.who}：${q.text}`));
  add('场景细节', (m.moments ?? []).slice(0, 30).map((x) => `${x.ts} ${x.summary}`));
  add('特质线索', (m.traits ?? []).slice(0, 30));
  add('兴趣信号', (m.interests ?? []).slice(0, 40).map((i) => `${i.ts} ${i.topic}`));
  add('未竟之事', (m.threads ?? []).slice(0, 30).map((t) => `${t.ts} ${t.text}`));
  return sections.join('\n\n');
}

/** 已手填档案 → 「我已经自己填过的档案（不要覆盖）」声明文本（契约里全部可填字段都列举）；全空返回空串 */
export function knownProfileText(profile?: PersonProfile): string {
  if (!profile) return '';
  const parts: string[] = [];
  const push = (s: string): void => {
    const t = s.trim();
    if (t) parts.push(t);
  };
  push(profile.birthday ? `生日 ${profile.birthday}` : '');
  push(profile.nickname ? `称呼 ${profile.nickname}` : '');
  push(profile.metVia ? `认识方式 ${profile.metVia}` : '');
  push(profile.metAt ? `认识时间 ${profile.metAt}` : '');
  push(profile.hometown ? `家乡/现居 ${profile.hometown}` : '');
  push(profile.job ? `职业 ${profile.job}` : '');
  push(profile.tags?.length ? `标签 ${profile.tags.join('、')}` : '');
  push(profile.note ? `备注 ${profile.note}` : '');
  push(profile.personality ? `性格 ${profile.personality}` : '');
  push(profile.interests?.length ? `兴趣爱好 ${profile.interests.join('、')}` : '');
  push(profile.habits ? `作息/习惯 ${profile.habits}` : '');
  push(profile.recentLife ? `近况 ${profile.recentLife}` : '');
  push(profile.quote ? `口头禅 ${profile.quote}` : '');
  push(profile.likes?.length ? `喜欢 ${profile.likes.join('、')}` : '');
  push(profile.dislikes?.length ? `反感/雷点 ${profile.dislikes.join('、')}` : '');
  push(profile.relationships?.length
    ? `身边人 ${profile.relationships.map((r) => (r.who && r.relation ? `${r.who}（${r.relation}）` : r.who || r.relation)).join('、')}`
    : '');
  push(profile.importantDates?.length ? `重要日子 ${profile.importantDates.map((d) => [d.date, d.what].filter(Boolean).join(' ')).filter(Boolean).join('、')}` : '');
  return parts.join('；');
}

/**
 * 档案提炼 prompt（issue 487）：JSON 契约覆盖全部维度；只许填素材能支撑的，无证据给空；
 * 已有手填值（known 非空）声明「不要覆盖」。隐私口径不变：mat 只装已落盘的提炼素材。
 */
export function buildProfileExtractPrompt(name: string, mat: string, known?: string): string {
  return [
    `我在整理好友「${name}」的人物档案。以下是已经落盘的交往素材。`,
    ...(known ? [`我已经自己填过的档案（不要覆盖也不要重复推断）：${known}`] : []),
    '',
    ...(mat ? [mat, ''] : []),
    '请推断档案缺失字段，只输出 JSON，不要解释、不要代码围栏：',
    '{"birthday":"","nickname":"","metVia":"","metAt":"","hometown":"","job":"","tags":[],"note":"","personality":"","interests":[],"habits":"","recentLife":"","quote":"","likes":[],"dislikes":[],"relationships":[{"who":"","relation":""}],"importantDates":[{"date":"","what":""}]}',
    '规则：',
    '- 只填素材能明确支撑的；没有证据的字段给空串 / 空数组，绝不编造。',
    '- birthday 仅当素材明确提到出生日期或生日时填（YYYY-MM-DD 或 MM-DD）。',
    '- metVia 一句话写怎么认识的；metAt 写认识时间（如 2023 年夏天）。',
    '- tags 2-3 个、每个不超过 6 字；note 一句话整体备注。',
    '- personality 一段话写性格特点（要有行为证据，不写抽象形容词）；interests / likes / dislikes 每项不超过 10 字。',
    '- habits 写作息 / 生活习惯；recentLife 写素材里能看出的近况；nickname 写对方习惯的称呼；quote 写口头禅或代表句（不改写）。',
    '- relationships 收素材里提到的身边人（who = 称呼，relation = 与对方的关系）；importantDates 收对对方重要的日子（date 可为 YYYY-MM-DD 或 MM-DD）。',
  ].join('\n');
}

/** 字符串数组归一：数组元素串化；单个字符串按顿号 / 逗号切分（宽容 AI 的形态偏差）；去空去重 */
function strListOf(v: unknown): string[] {
  let items: unknown[];
  if (Array.isArray(v)) items = v;
  else if (typeof v === 'string' && v.trim()) items = v.split(/[、,，;；\n]+/);
  else return [];
  return [
    ...new Set(
      items
        .filter((x) => typeof x !== 'object' || x === null)
        .map((x) => String(x).trim())
        .filter(Boolean)
    ),
  ];
}

/**
 * AI 档案回执 → PersonProfile（issue 487）：剥围栏 / 宽松 JSON / 逐字段防御归一——
 * 自由文本串化去空；数组去空去重（宽容顿号串形态）；结构行残缺剔除；契约外的字段（如 socials）一律不收。
 */
export function parseProfileReply(raw: string): PersonProfile {
  const data = extractJsonLoose(raw) as Record<string, unknown>;
  const out: PersonProfile = {};
  const rec = out as Record<string, unknown>;
  for (const f of PROFILE_TEXT_FIELDS) {
    const v = str(data[f]);
    if (v) rec[f] = v;
  }
  for (const f of PROFILE_LIST_FIELDS) {
    const arr = strListOf(data[f]);
    if (arr.length) out[f] = arr;
  }
  const rels: Array<{ who: string; relation: string }> = [];
  for (const r of arrOf(data.relationships)) {
    const who = str(r.who);
    const relation = str(r.relation);
    if (who && relation) rels.push({ who, relation });
  }
  if (rels.length) out.relationships = rels;
  const dates: Array<{ date: string; what: string }> = [];
  for (const d of arrOf(data.importantDates)) {
    const date = str(d.date);
    const what = str(d.what);
    if (date && what) dates.push({ date, what });
  }
  if (dates.length) out.importantDates = dates;
  return out;
}

/**
 * 档案合并（issue 487 语义铁则）：**只填空白字段**——undefined / 空串 / 空数组才收 AI 值，
 * 手填的绝不覆盖（重新画谱也不会冲掉用户改过的字段）。数组做浅拷贝，不与 AI 结果共享引用。
 */
export function fillProfile(existing: PersonProfile | undefined, ai: PersonProfile): PersonProfile {
  const out: PersonProfile = { ...(existing ?? {}) };
  const rec = out as Record<string, unknown>;
  const aiRec = ai as Record<string, unknown>;
  for (const f of PROFILE_TEXT_FIELDS) {
    const aiVal = str(aiRec[f]);
    if (!aiVal) continue;
    if (!str(rec[f])) rec[f] = aiVal;
  }
  for (const f of PROFILE_LIST_FIELDS) {
    const aiArr = ai[f];
    if (!aiArr?.length) continue;
    if (!out[f]?.length) out[f] = [...aiArr];
  }
  if (ai.relationships?.length && !out.relationships?.length) out.relationships = ai.relationships.map((r) => ({ ...r }));
  if (ai.importantDates?.length && !out.importantDates?.length) out.importantDates = ai.importantDates.map((d) => ({ ...d }));
  return out;
}

export async function extractBatch(ask: AskLLM, chunk: DigestChunk, personName: string): Promise<BatchExtract> {
  return parseBatchExtract(await ask(buildExtractPrompt(chunk, personName)));
}

export interface BuiltFace {
  /** 卷一《其人》（issue 455） */
  person: string;
  /** 卷二《相交》（issue 455） */
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
  /** 《纪事》（编年史）；生成失败或素材不足时为空串，不阻断画像产出 */
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
  /** 互动统计叙述段（ui 层由聊天仓 insights 生成后透传） */
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
 * → 三次文本调用：卷一《其人》（必产，空则抛错）→ 卷二《相交》（必产，空则抛错）
 * → 《纪事》（best-effort 兜空串）。
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
  if (!bond) throw new Error('卷二《相交》生成为空');
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
