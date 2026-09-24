/**
 * 脸谱提炼管线（issue 435 / ADR-0191）：统一消息流 → 分批 LLM 提炼（交往事件 + 特质线索）
 * → 汇总生成脸谱 markdown。AI 依赖以 AskLLM 注入（ui 层组装：提炼批走 `.json()` 通道、
 * 画像走 `.chat()` 通道），本层纯编排，可整管单测（假 ask）。
 *
 * 批切双限（maxChars / maxCount）防单批爆上下文；maxBatches 均匀抽样封顶防超大记录白烧 token。
 */
import type { FaceEvent, UnifiedMessage } from './types';

/** LLM 依赖（注入；抛错 = 该次提炼失败，上层中止） */
export type AskLLM = (prompt: string) => Promise<string>;

export interface DigestChunk {
  /** 批内首末日期 YYYY-MM-DD */
  from: string;
  to: string;
  count: number;
  /** 已渲染对话行（[YYYY-MM-DD HH:mm][我|对方] 文本） */
  lines: string[];
}

export interface BatchExtract {
  events: FaceEvent[];
  traits: string[];
}

export interface ChunkOptions {
  maxChars?: number;
  maxCount?: number;
  maxBatches?: number;
}

const DEFAULTS: Required<ChunkOptions> = { maxChars: 12000, maxCount: 400, maxBatches: 60 };

/** 切批：滤空文本 → 双限累积 → 批数超上限均匀抽样（保留时序跨度） */
export function chunkMessages(messages: UnifiedMessage[], opts: ChunkOptions = {}): DigestChunk[] {
  const { maxChars, maxCount, maxBatches } = { ...DEFAULTS, ...opts };
  const chunks: DigestChunk[] = [];
  let lines: string[] = [];
  let chars = 0;
  for (const m of messages) {
    const text = (m.text ?? '').trim();
    if (!text) continue;
    const line = renderLine(m.ts, m.isSender, text);
    const fits = lines.length === 0 || (lines.length < maxCount && chars + line.length <= maxChars);
    if (!fits) {
      chunks.push(makeChunk(lines));
      lines = [];
      chars = 0;
    }
    lines.push(line);
    chars += line.length;
  }
  if (lines.length) chunks.push(makeChunk(lines));
  if (chunks.length <= maxBatches) return chunks;
  // 均匀抽样：首尾必保，中间等距取
  const picked: DigestChunk[] = [];
  for (let i = 0; i < maxBatches; i++) {
    picked.push(chunks[Math.round((i * (chunks.length - 1)) / (maxBatches - 1))]);
  }
  return picked.filter((c, i, a) => i === 0 || c !== a[i - 1]);
}

function makeChunk(lines: string[]): DigestChunk {
  const first = lines[0] ?? '';
  const last = lines[lines.length - 1] ?? '';
  return { from: first.slice(1, 11), to: last.slice(1, 11), count: lines.length, lines };
}

function renderLine(ts: number, isSender: boolean, text: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `[${day} ${hm}][${isSender ? '我' : '对方'}] ${text}`;
}

/** 批提炼 prompt：携带本批对话行，只产出严格 JSON，禁围栏禁解释 */
export function buildExtractPrompt(chunk: DigestChunk, personName: string): string {
  return [
    `你在帮用户整理与好友「${personName}」的微信聊天记录。以下是 ${chunk.from} 至 ${chunk.to} 的片段（[我] = 用户发出，[对方] = 好友发出）。`,
    '',
    ...chunk.lines,
    '',
    '请提炼：',
    '1. events：有信息量的交往事件（约定 / 计划 / 重要话题 / 情绪事件 / 共同经历 / 承诺），每条含 ts（YYYY-MM-DD，取事件发生日期）与 summary（一句话，不超过 40 字）。日常寒暄、表情包刷屏、无实义闲聊不要收。没有则给空数组。',
    '2. traits：关于对方的性格 / 兴趣 / 习惯 / 说话风格的线索短语（每条不超过 15 字）。没有则给空数组。',
    '',
    '只输出 JSON，不要任何解释或代码围栏：',
    '{"events":[{"ts":"YYYY-MM-DD","summary":"..."}],"traits":["..."]}',
  ].join('\n');
}

/** 脸谱汇总 prompt：受限 markdown 语法（## / - / **），素材不足以支撑的小节省略不编造 */
export function buildPortraitPrompt(name: string, events: FaceEvent[], traits: string[]): string {
  const eventLines = events.length
    ? events.map((e) => `- ${e.ts}：${e.summary}`).join('\n')
    : '（无）';
  const traitLines = traits.length ? traits.map((t) => `- ${t}`).join('\n') : '（无）';
  return [
    `你在帮用户为好友「${name}」画一张「脸谱」——基于以下从聊天记录提炼的素材，写一份人物画像。`,
    '',
    '## 素材一：交往事件',
    eventLines,
    '',
    '## 素材二：特质线索',
    traitLines,
    '',
    '要求：',
    '- 输出 markdown，只允许这些语法：## 二级小节、- 列表项、**加粗**。',
    '- 建议小节：画像速写、性格、兴趣、共同回忆、聊天风格、相处建议。',
    '- 基于素材、克制推断；素材不足以支撑的小节直接省略，不要编造。',
    '- 总长 500 字以内。直接输出 markdown 正文，不要代码围栏。',
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

/** 回执 → BatchExtract 归一校验：字段串化、数组兜底、事件去残缺项 */
export function parseBatchExtract(raw: string): BatchExtract {
  const data = extractJsonLoose(raw) as Record<string, unknown>;
  const rawEvents = Array.isArray(data.events) ? data.events : [];
  const events: FaceEvent[] = [];
  for (const e of rawEvents) {
    if (!e || typeof e !== 'object') continue;
    const ts = String((e as Record<string, unknown>).ts ?? '').trim();
    const summary = String((e as Record<string, unknown>).summary ?? '').trim();
    if (!ts || !summary) continue;
    events.push({ ts, summary });
  }
  const traits = (Array.isArray(data.traits) ? data.traits : [])
    .map((t) => String(t ?? '').trim())
    .filter(Boolean);
  return { events, traits };
}

export async function extractBatch(ask: AskLLM, chunk: DigestChunk, personName: string): Promise<BatchExtract> {
  return parseBatchExtract(await ask(buildExtractPrompt(chunk, personName)));
}

export interface BuiltFace {
  portrait: string;
  events: FaceEvent[];
}

/**
 * 全流程：切批 → 逐批提炼（askExtract / JSON 通道）→ 合并去重 → 汇总画像（askPortrait / 文本通道）。
 * onProgress(done, total) 供 UI 更新进度；任一批失败原样抛错（上层中止并报错）。
 * chunkOpts 透传切批参数（UI 缺省即默认双限）。
 */
export async function buildFace(
  askExtract: AskLLM,
  askPortrait: AskLLM,
  messages: UnifiedMessage[],
  personName: string,
  onProgress?: (done: number, total: number) => void,
  chunkOpts?: ChunkOptions
): Promise<BuiltFace> {
  const chunks = chunkMessages(messages, chunkOpts);
  if (!chunks.length) throw new Error('没有可提炼的文本消息');
  const batches: BatchExtract[] = [];
  for (let i = 0; i < chunks.length; i++) {
    batches.push(await extractBatch(askExtract, chunks[i], personName));
    onProgress?.(i + 1, chunks.length);
  }
  const events = mergeEvents(batches.flatMap((b) => b.events));
  const traits = [...new Set(batches.flatMap((b) => b.traits))].slice(0, 30);
  const portrait = (await askPortrait(buildPortraitPrompt(personName, events, traits))).trim();
  if (!portrait) throw new Error('画像生成为空');
  return { portrait, events };
}

/** 事件合并：key = ts|summary 去重，按 ts 字典序（=日期序） */
function mergeEvents(events: FaceEvent[]): FaceEvent[] {
  const seen = new Set<string>();
  const out: FaceEvent[] = [];
  for (const e of events) {
    const key = `${e.ts}|${e.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out.sort((a, b) => a.ts.localeCompare(b.ts));
}
