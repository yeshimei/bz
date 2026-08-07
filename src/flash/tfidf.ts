/**
 * 闪念 TF-IDF 移动端二级检索（ticket 18，源码 L382-440 逐字）
 * 44 字停用词表（与 text-search 的 35 字版不同，各自保留）。
 */
export const TFIDF_STOP_WORDS = '的了是在我有和人这中大为上个国不以到说时要就出会也年对自其他里去子后也得着与把等';

export class TFIDF {
  docs: { path: string; text: string; tf: Map<string, number>; len: number }[] = [];
  df = new Map<string, number>();
  N = 0;
  avgDl = 1;

  tokenize(text: string): string[] {
    const tokens: string[] = [];
    const cjk = text.match(/[一-鿿]/g) || [];
    for (const ch of cjk) {
      if (!TFIDF_STOP_WORDS.includes(ch)) tokens.push(ch);
    }
    const words = text.toLowerCase().match(/[a-z]{2,}/g) || [];
    tokens.push(...words);
    return tokens;
  }

  build(docs: { path: string; text: string }[]): void {
    this.docs = [];
    this.df = new Map();
    let totalLen = 0;
    for (const doc of docs) {
      const tokens = this.tokenize(doc.text);
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

  /** BM25 式检索 */
  search(query: string, topK = 20): { path: string; score: number }[] {
    const qTokens = this.tokenize(query);
    if (qTokens.length === 0) return [];
    const k1 = 1.5;
    const b = 0.75;
    const scores: { path: string; score: number }[] = [];

    for (const doc of this.docs) {
      let score = 0;
      for (const t of qTokens) {
        const tf = doc.tf.get(t);
        if (!tf) continue;
        const df = this.df.get(t) || 0;
        const idf = Math.log((this.N - df + 0.5) / (df + 0.5) + 1);
        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.len) / this.avgDl));
        score += idf * tfNorm;
      }
      if (score > 0) scores.push({ path: doc.path, score });
    }

    scores.sort((a, b) => b.score - a.score);
    if (scores.length && scores[0].score > 0) {
      const max = scores[0].score;
      scores.forEach((s) => (s.score /= max));
    }
    return scores.slice(0, topK);
  }
}
