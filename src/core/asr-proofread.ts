/**
 * 转写 LLM 校对（ADR-0222 / issue 518）：把 ASR 转写文本按批送 AI 面板所配 LLM 服务商
 * 做「只修错不创作」校对——脸谱语音条 / 脸谱录音 / 知识盒影像三处共用的唯一入口。
 *
 * 口径（2026-09-29 实验 + 用户拍板）：
 *  - 只修依上下文可确证的同音/近音错别字、串音与识别噪声；数字金额存疑不猜，语序、
 *    口语、方言原样保留，不书面化润色（错字实验：11 处确证错字全修、零过度改写）。
 *  - 条目按原顺序连续成批（模型在单次请求里看得见邻条，同音消歧吃局部上下文）；
 *    每批失败自动重试 1 次；整档任一批终败 → failed=true，调用方按原文落库不写回。
 *  - LLM 通道复用全局配置（createAI，跟随 aiProvider 与模型覆盖），不设专用键。
 */
import { createAI } from './ai';

/** 校对规则提示词单源（三处共用同一份，实验口径逐字收编）。条号 = 批内位置（1 起连续） */
function proofreadPrompt(entries: Array<{ n: number; text: string }>, contextNote?: string): string {
  const lines = entries.map((e) => `#${e.n}|${e.text}`).join('\n');
  const note = contextNote ? `\n背景（仅助理解，不构成改写依据）：${contextNote}\n` : '';
  return `你在校对语音识别（ASR）的转写输出，文本可能含同音错别字、字母/假名串音与识别噪声。逐条校对，规则：
1. 只修错，不创作：仅修正依上下文可确证的同音/近音错别字；不得改变原意、不得增删信息、不得调整语序、不得书面化润色。
2. 无法确证的一律保持原样：听不清或存疑的词（尤其数字与金额）、方言词、口语语气词一律保留。宁留原样，不猜不改。
3. 引擎串音与孤立噪声（无关外语字母、假名、拟声词）可删；口语缩写若上下文可确证可修正（如 BTSD→PTSD）。
4. 标点只修明显错误（如一句被误断成两句），不重排、不补省略号。
5. 条数与顺序不变：不合并、不拆分、不移动内容。${note}
输出严格 JSON（无解释、无代码围栏）：{"items":[{"n":<条号>,"text":"<校对后文本>"}]}，n 对应下方条号，必须覆盖每一条。

待校对转写：
${lines}`;
}

/** 批切分（纯函数，导出供测试）：连续非空条目按字数预算/条数上限成批；空条目不成批（原样透传） */
export function proofreadBatches(pieces: string[], charBudget = 3500, maxPieces = 16): number[][] {
  const batches: number[][] = [];
  let cur: number[] = [];
  let curLen = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = String(pieces[i] ?? '');
    if (!p.trim()) continue; // 空条目不进批
    if (cur.length && (curLen + p.length > charBudget || cur.length >= maxPieces)) {
      batches.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(i);
    curLen += p.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/** 严格 JSON 回解析：剥围栏后取首个平衡对象；解析不出返回 null（批判失败，走重试） */
export function parseProofreadJson(raw: string): Array<{ n: number; text: string }> | null {
  const cleaned = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const items = obj?.items;
    if (!Array.isArray(items)) return null;
    const out: Array<{ n: number; text: string }> = [];
    for (const it of items) {
      // 严格型：条号必须是真数字——宽松的 Number('1') 会放过字符串条号，回填对位会错
      const n = it?.n;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || typeof it?.text !== 'string') return null;
      out.push({ n, text: it.text });
    }
    return out;
  } catch {
    return null;
  }
}

export interface ProofreadResult {
  /** 与入参 pieces 等长对齐：成功批为校对文本，空条目/失败批为原文 */
  texts: string[];
  /** true = 至少一批重试后仍失败（调用方按原文落库，不得写回任何校对结果） */
  failed: boolean;
}

export interface ProofreadOptions {
  /** 背景 note（如「双人聊天转写」「B站视频讲解」），只助理解不构成改写依据 */
  contextNote?: string;
  /** 批级进度（done/total = 已落定批数/总批数） */
  onProgress?: (done: number, total: number) => void;
}

/** 测试注桩：替换 ai.chat 调用（不注入时走 createAI 全局配置） */
let chatCallerOverride: ((prompt: string) => Promise<string>) | null = null;
export function setProofreadChatCallerForTests(fn: ((prompt: string) => Promise<string>) | null): void {
  chatCallerOverride = fn;
}

const RETRIES_PER_BATCH = 1;

/**
 * 逐批校对一批条目。返回与 pieces 等长的 texts；任一批终败时 failed=true 且 texts 全为原文
 * （校对原子性：要么全成、要么不动，避免「半校对」状态混进写回）。
 */
export async function proofreadPieces(pieces: string[], opts?: ProofreadOptions): Promise<ProofreadResult> {
  const src = pieces.map((p) => String(p ?? ''));
  const out = [...src];
  const batches = proofreadBatches(src);
  const total = batches.length;
  if (!total) return { texts: out, failed: false };
  const ai = chatCallerOverride ? null : createAI();
  const call = chatCallerOverride
    ? (prompt: string) => chatCallerOverride!(prompt)
    : (prompt: string) => ai!.chat(prompt);
  let failed = false;
  let done = 0;
  for (const batch of batches) {
    // 条号 = 批内位置（1 起连续，模型侧最好对齐）；回填按位置映射回原序号
    const entries = batch.map((orig, pos) => ({ n: pos + 1, text: src[orig] }));
    const want = batch.length;
    let corrected: Array<{ n: number; text: string }> | null = null;
    for (let attempt = 0; attempt <= RETRIES_PER_BATCH; attempt++) {
      try {
        const raw = await call(proofreadPrompt(entries, opts?.contextNote));
        const parsed = parseProofreadJson(raw);
        if (parsed && want > 0 && parsed.length === want && parsed.every((p, i) => p.n === i + 1)) {
          corrected = parsed;
          break;
        }
      } catch {
        /* 重试一次后仍败 → 批失败 */
      }
    }
    if (corrected) {
      corrected.forEach((p, pos) => {
        const orig = batch[pos];
        out[orig] = p.text.trim() || src[orig]; // 空回文不吞原文
      });
    } else {
      failed = true;
    }
    done++;
    opts?.onProgress?.(done, total);
  }
  // 原子性：有失败批 → 全档回退原文（写回与否由调用方按 failed 决定，这里保证不给半成品）
  if (failed) return { texts: [...src], failed: true };
  return { texts: out, failed: false };
}
