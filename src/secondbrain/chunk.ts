/**
 * 第二大脑 smartChunk（ticket 103；逐字对齐 QA 闪念.js L277-310）
 * 算法：空行分段聚合（块间保留 '\n' 结构）→ 超长段再按句界切分；短于 minChunk 的尾块丢弃。
 * ⚠ 唯一有意偏差（Q3=B 修缺陷）：QA 原版大段路径不清 buffer，后续小段会与已入块的
 *   旧 buffer 重复拼接（内容重复入索引）；本版在 else 分支入口先 flush 并清空 buffer。
 * ticket 110：新增切块管线 embedChunks——先剥离 YAML frontmatter 再 smartChunk，
 *   笔记标题并入首块；frontmatter 样板字段（reviewStart/url 等）不进 embedding 文本
 *   （实测短卡近邻被格式相似度支配：探针 Top8 挤在 0.946–0.949 窄带）。
 */
export const CHUNK_SIZE = 256;
export const SENTENCE_BOUNDARY = /[。！？!?\n]+/;

/** frontmatter 界定：文件以 --- 行开头、至下一个独占一行的 --- 止（Obsidian 同口径；容忍 \r\n 与文末无换行闭合）。未闭合（如正文分隔线误开头）不视为 frontmatter，原样返回。 */
const FRONTMATTER_RE = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** 剥离 YAML frontmatter（ticket 110）：仅剥文件开头的 --- 界定块，正文原样保留 */
export function stripFrontmatter(text: string): string {
  return text.replace(FRONTMATTER_RE, '');
}

/** 路径 → 笔记标题（basename 去 .md）：标题信号并入首块用 */
export function noteTitleFromPath(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
}

/**
 * 切块管线（ticket 110）：剥离 frontmatter → smartChunk → 空正文兜底截断（原 vector-store 内联逻辑上收）
 * → 标题并入首块（保留主题信号，首块可超 CHUNK_SIZE 一个标题长度，bge-m3 长文本无碍）。
 * 纯 frontmatter 无正文的文件返回 []，调用方按「无可嵌入内容」不入索引。
 */
export function embedChunks(content: string, title: string, minChunk = 50): string[] {
  const body = stripFrontmatter(content);
  const chunks = smartChunk(body, minChunk);
  if (chunks.length === 0 && body.trim().length > 0) chunks.push(body.trim().slice(0, CHUNK_SIZE));
  if (chunks.length > 0 && title) chunks[0] = title + '\n' + chunks[0];
  return chunks;
}

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
