/**
 * 第二大脑 TF-IDF（实为 BM25 k1=1.5 b=0.75）移动端二级检索
 * （ticket 103；对齐 QA 闪念.js L382-440：**以 chunk 为文档单位**，结果带命中 chunk 原文。
 *  旧版由调用方把整篇笔记拼成一个 doc——粒度错误已废弃，粒度归 vector-store 建索引时保证。）
 */
export const TFIDF_STOP_WORDS = '的了是在我有和人这中大为上个国不以到说时要就出会也年对自其他里去子后也得着与把等';

const STOP_SET = new Set(TFIDF_STOP_WORDS);

export interface TfidfDoc {
  path: string;
  text: string;
  tf: Map<string, number>;
  len: number;
}

export interface TfidfHit {
  path: string;
  chunk: string;
  score: number;
}

export class TFIDF {
  docs: TfidfDoc[] = [];
  df = new Map<string, number>();
  N = 0;
  avgDl = 1;

  static tokenize(text: string): string[] {
    const tokens: string[] = [];
    const cjk = text.match(/[一-鿿]/g) || [];
    const eng = text.toLowerCase().match(/[a-z]{2,}/g) || [];
    for (const c of cjk) {
      if (!STOP_SET.has(c)) tokens.push(c);
    }
    for (const w of eng) {
      if (!STOP_SET.has(w)) tokens.push(w);
    }
    return tokens;
  }

  /** docs 必须是 chunk 粒度（path=所属笔记路径，text=chunk 原文） */
  build(docs: { path: string; text: string }[]): void {
    this.docs = [];
    this.df = new Map();
    let totalLen = 0;
    for (const doc of docs) {
      const tokens = TFIDF.tokenize(doc.text);
      if (!tokens.length) continue;
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      const seen = new Set(tokens);
      for (const t of seen) this.df.set(t, (this.df.get(t) || 0) + 1);
      this.docs.push({ path: doc.path, text: doc.text, tf, len: tokens.length });
      totalLen += tokens.length;
    }
    this.N = this.docs.length;
    this.avgDl = this.N > 0 ? totalLen / this.N : 1;
  }

  /** BM25 式检索；返回含 chunk 原文，最高分归一化 */
  search(query: string, topK = 20): TfidfHit[] {
    if (!this.N || !query) return [];
    const qTokens = TFIDF.tokenize(query);
    if (!qTokens.length) return [];
    const k1 = 1.5;
    const b = 0.75;
    const scores: TfidfHit[] = [];

    for (const doc of this.docs) {
      let score = 0;
      for (const qt of qTokens) {
        const tf = doc.tf.get(qt);
        if (!tf) continue;
        const df = this.df.get(qt) || 0;
        const idf = Math.log((this.N - df + 0.5) / (df + 0.5) + 1);
        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.len) / this.avgDl));
        score += idf * tfNorm;
      }
      if (score > 0) scores.push({ path: doc.path, chunk: doc.text, score });
    }

    scores.sort((a, b) => b.score - a.score);
    if (scores.length > 0 && scores[0].score > 0) {
      const maxS = scores[0].score;
      for (const s of scores) s.score = s.score / maxS;
    }
    return scores.slice(0, topK);
  }
}
