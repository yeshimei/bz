/**
 * 第二大脑文本检索回退（ticket 103；逐字对齐 QA 闪念.js L312-379）
 * 与旧版倒排索引方案完全不同：QA 是对 meta.notes 的 chunk 全量扫描评分——
 * 精确子串命中 0.7+长度比×0.3；否则 词命中率×0.5 + 频次×0.25 + 覆盖密度×0.25；
 * <20 字惩罚 ×0.7；阈值 >0.25；返回**命中 chunk 原文**（旧版只映射 chunks[0]，已废弃）。
 */

/** extractTerms/searchTextIndex 停用词（35 字；与 tfidf 的 44 字表各自保留） */
export const STOP_WORDS = new Set('的了是在我有和人这中大为上个国不以到说时要就出会也年对自其');

/** 提取检索词（CJK 逐字 + 英文 ≥2 字母；全空时回退整串小写——QA L320） */
export function extractTerms(q: string): string[] {
  const terms: string[] = [];
  const cjk = q.match(/[一-鿿]/g) || [];
  const eng = q.toLowerCase().match(/[a-z]{2,}/g) || [];
  for (const c of cjk) {
    if (!STOP_WORDS.has(c)) terms.push(c);
  }
  for (const w of eng) {
    if (!STOP_WORDS.has(w)) terms.push(w);
  }
  if (terms.length === 0) terms.push(q.toLowerCase());
  return terms;
}

export interface TextSearchNotes {
  [path: string]: { chunks: { text: string }[] };
}

export interface TextSearchHit {
  path: string;
  chunk: string;
  score: number;
}

/** 文本检索：扫描 notes 全部 chunk 评分，阈值过滤 + path::chunk 去重 + topK */
export function searchTextIndex(query: string, notes: TextSearchNotes, topK = 20): TextSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const noteCount = Object.keys(notes).length;
  let chunkCount = 0;
  for (const n of Object.values(notes)) chunkCount += n.chunks.length;
  console.log(`[文本检索] query="${q}" notes=${noteCount} chunks=${chunkCount}`);
  if (noteCount === 0) return [];
  const terms = extractTerms(q);
  const qLower = q.toLowerCase();
  const results: TextSearchHit[] = [];
  for (const [path, note] of Object.entries(notes)) {
    for (const chunk of note.chunks) {
      const text = chunk.text || '';
      if (!text) continue;
      const lower = text.toLowerCase();
      let score = 0;
      if (lower.includes(qLower)) {
        score = 0.7 + 0.3 * Math.min(1, q.length / text.length);
      } else {
        let matched = 0;
        let totalFreq = 0;
        for (const term of terms) {
          const idx = lower.indexOf(term);
          if (idx !== -1) {
            matched++;
            let freq = 0;
            let pos = 0;
            while ((pos = lower.indexOf(term, pos)) !== -1) {
              freq++;
              pos += term.length;
            }
            totalFreq += freq;
          }
        }
        if (matched === 0) continue;
        const hitRate = matched / terms.length;
        const avgFreq = totalFreq / matched;
        const freqScore = Math.min(1, avgFreq / 5);
        const coverLen = terms.filter((t) => lower.includes(t)).reduce((s, t) => s + t.length, 0);
        const density = Math.min(1, (coverLen / Math.max(1, text.length)) * 10);
        score = hitRate * 0.5 + freqScore * 0.25 + density * 0.25;
      }
      if (text.length < 20) score *= 0.7;
      if (score > 0.25) {
        results.push({ path, chunk: text, score });
      }
    }
  }
  const seen = new Set<string>();
  const deduped: TextSearchHit[] = [];
  for (const item of results.sort((a, b) => b.score - a.score)) {
    const key = item.path + '::' + item.chunk;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  const final = deduped.slice(0, topK);
  console.log(`[文本检索] 命中 ${results.length} 条，去重后 ${deduped.length} 条，返回 ${final.length} 条`);
  return final;
}
