/**
 * 追问线（open threads，2026-09-20「让小橘更智能」批，ADR-0172）
 *
 * 社区调研的第一结论：小冰（CL 2020）把社交聊天建模成 MDP、优化目标是**每次会话的轮数（CPS）**，
 * 而「记得多」并不提升 CPS。真正让对话变长的，是接住前文——「好问题必须含前文出现过的内容」
 * （Zhang et al. WWW 2020 的对话式问题生成结论）。
 * 小橘此前每次主动搭话都是一次性生成即销毁：聊过的像没聊过，全代码零命中「未完成悬念」。
 *
 * 设计取舍：**零 AI 成本的确定性抽取**。不做「调一次 LLM 抽取话题」——
 * 那会变成每条消息一次调用，且失败时静默丢线。这里用前瞻性语言标记（改天/下次/还没/打算…）
 * 从用户消息里切出「未完成句」，落 editingData.openThreads，后续消息命中关键词即判定完成。
 * 抽得粗，但永远不会错到编造；模型只是在 prompt 里看到「有这么几条线」，提不提由它按语境定。
 *
 * 纯函数、零 AI、无 DOM。
 */
import { replaceUserReference } from './memory';

export interface OpenThread {
  id: string;
  /** 首次抽出时间（毫秒） */
  createdAt: number;
  /** 抽到的那句话（截断；已做过称呼替换前的原文） */
  text: string;
  /** 用于判定「后来聊到了」的关键词 */
  keywords: string[];
  /** 由明确时间词推出的到期时间（有则优先回访） */
  dueAt?: number;
  /** 最近一次被提供给模型的时间（冷却用，防每条消息都塞同一条） */
  offeredAt?: number;
  resolvedAt?: number;
}

/** 未完成线保留上限（超出按「先丢已完成、再丢最旧」裁剪） */
export const THREAD_MAX = 12;
/** 未完成线存活时长：三周没再提就淡出（人是会忘的，硬留着只会像催办） */
export const THREAD_TTL_MS = 21 * 86400000;
/** 同一条线两次被提供给模型的最小间隔（避免复读） */
export const THREAD_OFFER_COOLDOWN_MS = 6 * 3600 * 1000;
/** 一次进 prompt 的线上限（一次全抛像清单，不像聊天） */
export const THREAD_PROMPT_MAX = 2;

/** 前瞻/未完成标记——命中即认为这句话「留了个尾巴」 */
const FORWARD_MARKERS = /改天|下次|回头|以后|有空|等下|等[^，。！？]{0,6}(?:再|后|完)|还没|没来得及|来不及|打算|计划|准备|想要|想去|想学|想读|要开始|得去|要去|要买|明天|后天|下周|下个?月|月底|这周|本周|周末|年底|放假/;
/** 完成标记——与线关键词同时命中才判「这条线收了」（保守，宁可不收也不误收） */
const DONE_MARKERS = /做完了|搞定|完成了|弄好了|看完了|读完了|写完了|买好了|买了|去过了|去了|已经|终于|解决了|收了|看过了|学会了|学完了|开始了|出发了/;
/** 关键词里的高频虚词二元组（不参与重叠判定） */
const STOP_BIGRAMS = new Set([
  '这个', '那个', '什么', '怎么', '因为', '所以', '但是', '如果', '还是', '就是', '可以', '应该',
  '我们', '你们', '他们', '自己', '现在', '今天', '明天', '以后', '最近', '然后', '有点', '一下',
  '一个', '不是', '没有', '可能', '觉得', '知道', '记得', '事情', '东西', '时候', '问题',
]);

let threadSeq = 0;

function newThreadId(now: number): string {
  threadSeq = (threadSeq + 1) % 100000;
  return `thr_${now}_${threadSeq}`;
}

/**
 * 关键词抽取：中文相邻两字 bigram（不引入词典的近似分词——整句当一个 token 会让
 * 「学吉他」和「吉他买好了」重叠为 0，判定直接失效）+ 西文词（≥3 字符），去虚词、保序去重。
 */
export function extractKeywords(text: string, limit = 12): string[] {
  const s = String(text || '');
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: string) => {
    if (!t || STOP_BIGRAMS.has(t) || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const run of s.matchAll(/[\u4e00-\u9fa5]+/g)) {
    const r = run[0];
    if (r.length === 1) continue;
    for (let i = 0; i + 1 < r.length; i++) push(r.slice(i, i + 2));
  }
  for (const m of s.matchAll(/[A-Za-z][A-Za-z0-9_-]{2,}/g)) push(m[0].toLowerCase());
  return out.slice(0, limit);
}

/** 由时间词推一个到期时间（只认最直白的几个，拿不准就不给 dueAt） */
export function inferDueAt(text: string, now = Date.now()): number | undefined {
  const day = 86400000;
  if (/明天/.test(text)) return now + day;
  if (/后天/.test(text)) return now + 2 * day;
  if (/下周|下星期/.test(text)) return now + 7 * day;
  if (/下个?月|月底/.test(text)) return now + 30 * day;
  if (/周末/.test(text)) return now + 3 * day;
  if (/这周|本周/.test(text)) return now + 5 * day;
  return undefined;
}

/**
 * 从一条用户消息里抽未完成线（0-2 条）。
 * 只切「含前瞻标记」的整句——不加工、不改写，避免把用户没说的话塞进她的记忆。
 */
export function extractOpenThreads(userMessage: string, opts: { now?: number } = {}): OpenThread[] {
  const now = opts.now ?? Date.now();
  const msg = String(userMessage || '').trim();
  if (!msg || msg.length < 4) return [];
  const sentences = msg
    .split(/[。！？!?；;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && FORWARD_MARKERS.test(s));
  const out: OpenThread[] = [];
  for (const s of sentences.slice(0, 2)) {
    const text = s.length > 60 ? s.slice(0, 60) : s;
    const keywords = extractKeywords(text);
    if (keywords.length < 2) continue; // 关键词太少的线，既判不了完成也回访不了
    out.push({ id: newThreadId(now), createdAt: now, text, keywords, dueAt: inferDueAt(text, now) });
  }
  return out;
}

/** 两条线是否「同一件事」：关键词重叠 ≥2（对同一话题换说法也大概率命中） */
export function threadOverlap(a: string[], b: string[]): number {
  if (!a?.length || !b?.length) return 0;
  const setB = new Set(b);
  let n = 0;
  for (const k of a) if (setB.has(k)) n++;
  return n;
}

/**
 * 并入新抽到的线（去重 + 裁剪）。
 * 同话题再次出现 = 刷新时间（说明这事还悬着），不新增重复条目。
 */
export function mergeThreads(existing: OpenThread[], incoming: OpenThread[], now = Date.now()): OpenThread[] {
  const live = (Array.isArray(existing) ? existing : []).filter(Boolean).map((t) => ({ ...t }));
  for (const inc of incoming) {
    const dup = live.find((t) => !t.resolvedAt && threadOverlap(t.keywords, inc.keywords) >= 2);
    if (dup) {
      dup.createdAt = now;
      dup.text = inc.text;
      dup.keywords = inc.keywords;
      dup.dueAt = inc.dueAt ?? dup.dueAt;
      dup.offeredAt = undefined; // 又提了一次 → 允许再回访
      continue;
    }
    live.push({ ...inc });
  }
  const alive = live.filter((t) => !t.resolvedAt);
  const resolved = live.filter((t) => t.resolvedAt).sort((a, b) => b.resolvedAt! - a.resolvedAt!);
  // 先保未完成（新的在前），再用已完成补足上限（保留最近完成的，供「你上次说的那件事办完了吗」自检）
  const keptAlive = alive.sort((a, b) => b.createdAt - a.createdAt).slice(0, THREAD_MAX);
  const kept = [...keptAlive, ...resolved.slice(0, Math.max(0, THREAD_MAX - keptAlive.length))];
  return kept;
}

/** 过期清理：超 TTL 的未完成线淡出（不报错、不提示） */
export function pruneThreads(threads: OpenThread[], now = Date.now()): OpenThread[] {
  return (Array.isArray(threads) ? threads : [])
    .filter(Boolean)
    .filter((t) => (t.resolvedAt ? true : now - t.createdAt <= THREAD_TTL_MS));
}

/**
 * 判定「这条线收了」：
 *  - 重叠 ≥1 且带完成标记（「吉他买好了」对「打算学吉他」——一个共同 bigram + 完成语气足够）；
 *  - 重叠 ≥3 且本条消息自身不是又一个前瞻句（防止「我还在打算学吉他」把线收掉）。
 * 口径偏保守——误收会让她再也不追问，比漏收更糟；漏收的自然会被 TTL 淡出。
 */
export function resolveThreads(threads: OpenThread[], userMessage: string, now = Date.now()): OpenThread[] {
  const text = String(userMessage || '');
  if (!text) return threads;
  const msgKeys = extractKeywords(text, 80);
  const done = DONE_MARKERS.test(text);
  const forward = FORWARD_MARKERS.test(text);
  return (Array.isArray(threads) ? threads : []).filter(Boolean).map((t) => {
    if (t.resolvedAt) return t;
    const ov = threadOverlap(t.keywords, msgKeys);
    if ((ov >= 1 && done) || (ov >= 3 && !forward)) return { ...t, resolvedAt: now };
    return t;
  });
}

/**
 * 可回访的线（给 prompt 用）：未完成、未过期、距上次提供超过冷却；
 * 排序 = 有明确时间且已到期的最优先，其次按「悬得最久」。
 */
export function pendingThreads(threads: OpenThread[], now = Date.now()): OpenThread[] {
  return pruneThreads(threads, now)
    .filter((t) => !t.resolvedAt)
    .filter((t) => !t.offeredAt || now - t.offeredAt >= THREAD_OFFER_COOLDOWN_MS)
    .sort((a, b) => {
      const aDue = a.dueAt != null && now >= a.dueAt ? 1 : 0;
      const bDue = b.dueAt != null && now >= b.dueAt ? 1 : 0;
      if (aDue !== bDue) return bDue - aDue;
      return a.createdAt - b.createdAt;
    });
}

/** 相对时间口语（线专用：三天内说「前几天」，更久说「上个月」） */
function threadAgeText(createdAt: number, now: number): string {
  const days = Math.floor((now - createdAt) / 86400000);
  if (days <= 0) return '刚刚';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  if (days < 14) return '上周';
  if (days < 45) return '上个月';
  return '早些时候';
}

/**
 * prompt 块：只给「有这么几条线」+ 原文，不替模型写问句。
 * 明确写「别硬提、别一次全问」——护栏③（主动消息需有钩子）的落地口径是
 * 「可以自然地接住」，不是「必须回访」。
 */
export function formatOpenThreads(threads: OpenThread[], now = Date.now(), max = THREAD_PROMPT_MAX): string {
  const picked = pendingThreads(threads, now).slice(0, Math.max(0, max));
  if (!picked.length) return '';
  const lines = picked.map((t) => {
    const ago = threadAgeText(t.createdAt, now);
    const due = t.dueAt != null && now >= t.dueAt ? '（约定的时间已经到了）' : '';
    return `- ${ago}你提到「${replaceUserReference(t.text)}」${due}`;
  });
  return '## 你们还没聊完的线（可以自然地接着问，别硬提、别一次全抛）\n' + lines.join('\n');
}

/** 标记「已提供给模型」（冷却起点）；返回新数组（不改原对象） */
export function markThreadsOffered(threads: OpenThread[], offered: OpenThread[], now = Date.now()): OpenThread[] {
  if (!offered?.length) return threads;
  const ids = new Set(offered.map((t) => t.id));
  return (Array.isArray(threads) ? threads : []).filter(Boolean).map((t) => (ids.has(t.id) ? { ...t, offeredAt: now } : t));
}
