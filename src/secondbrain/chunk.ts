/**
 * 第二大脑 smartChunk（ticket 103；逐字对齐 QA 闪念.js L277-310）
 * 算法：空行分段聚合（块间保留 '\n' 结构）→ 超长段再按句界切分；短于 minChunk 的尾块丢弃。
 * ⚠ 唯一有意偏差（Q3=B 修缺陷）：QA 原版大段路径不清 buffer，后续小段会与已入块的
 *   旧 buffer 重复拼接（内容重复入索引）；本版在 else 分支入口先 flush 并清空 buffer。
 */
export const CHUNK_SIZE = 256;
export const SENTENCE_BOUNDARY = /[。！？!?\n]+/;

export function smartChunk(text: string, minChunk = 50): string[] {
  const blocks = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buffer = '';
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if ((buffer + '\n' + trimmed).length <= CHUNK_SIZE) {
      buffer = buffer ? buffer + '\n' + trimmed : trimmed;
    } else {
      // ticket 103 修复：flush 后立即清空（QA 原版缺这步 → 大段落场景内容重复）
      if (buffer.length >= minChunk) chunks.push(buffer);
      buffer = '';
      if (trimmed.length > CHUNK_SIZE) {
        const sentences = trimmed.split(SENTENCE_BOUNDARY);
        let sbuf = '';
        for (const s of sentences) {
          if ((sbuf + s).length > CHUNK_SIZE) {
            if (sbuf.length >= minChunk) chunks.push(sbuf.trim());
            sbuf = s;
          } else {
            sbuf += s;
          }
        }
        if (sbuf.trim().length >= minChunk) chunks.push(sbuf.trim());
      } else {
        buffer = trimmed;
      }
    }
  }
  if (buffer.trim().length >= minChunk) chunks.push(buffer.trim());
  return chunks;
}
