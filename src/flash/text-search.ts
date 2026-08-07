/**
 * 闪念文本检索（ticket 18，源码 L313-379 逐字）
 * 两处停用词表长度不同（35 字 vs 44 字），各自原样保留。
 */

/** searchTextIndex/extractTerms 停用词（35 字） */
export const STOP_WORDS = '的了是在我有和人这中大为上个国不以到说时要就出会也年对自其';

/** 提取检索词（CJK 逐字 + 英文 ≥2 字母） */
export function extractTerms(text: string): string[] {
  const terms: string[] = [];
  const cjk = text.match(/[一-鿿]/g) || [];
  for (const ch of cjk) {
    if (!STOP_WORDS.includes(ch)) terms.push(ch);
  }
  const words = text.toLowerCase().match(/[a-z]{2,}/g) || [];
  terms.push(...words);
  return terms;
}

export interface TextIndex {
  entries: { path: string; text: string }[];
  index: Map<string, Set<number>>; // term → docIdx
  docLen: number[];
}

/** 构建文本倒排索引 */
export function searchTextIndex(docs: { path: string; text: string }[]): TextIndex {
  const index = new Map<string, Set<number>>();
  const docLen: number[] = [];
  docs.forEach((doc, di) => {
    const terms = extractTerms(doc.text);
    docLen[di] = terms.length;
    for (const t of new Set(terms)) {
      if (!index.has(t)) index.set(t, new Set());
      index.get(t)!.add(di);
    }
  });
  return { entries: docs, index, docLen };
}

/** 文本检索（词频加权） */
export function searchText(query: string, idx: TextIndex, topK = 20): { path: string; score: number }[] {
  const qTerms = extractTerms(query);
  if (qTerms.length === 0) return [];
  const scores = new Map<number, number>();
  for (const t of qTerms) {
    const hits = idx.index.get(t);
    if (!hits) continue;
    for (const di of hits) {
      scores.set(di, (scores.get(di) || 0) + 1);
    }
  }
  const ranked = [...scores.entries()]
    .map(([di, score]) => ({
      path: idx.entries[di].path,
      score: score / Math.max(idx.docLen[di], 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  if (ranked.length && ranked[0].score > 0) {
    const max = ranked[0].score;
    ranked.forEach((r) => (r.score /= max));
  }
  return ranked;
}
