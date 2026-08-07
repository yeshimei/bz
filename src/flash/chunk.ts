/**
 * 闪念 smartChunk（ticket 18，源码 L280-310 逐字）
 */
export const CHUNK_SIZE = 256;
export const SENTENCE_BOUNDARY = /[。！？!?\n]+/;

/** 按句界切块（每块 ≤256 字） */
export function smartChunk(text: string, minLength = 50): string[] {
  const chunks: string[] = [];
  let current = '';
  const sentences = text.split(SENTENCE_BOUNDARY);

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if (current.length + s.length > CHUNK_SIZE && current.length >= minLength) {
      chunks.push(current);
      current = s;
    } else {
      current = current ? current + s : s;
    }
  }
  if (current.trim() && current.length >= minLength) {
    chunks.push(current);
  }
  return chunks;
}
