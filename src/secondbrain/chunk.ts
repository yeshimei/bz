import { stripMdExt } from '../core/utils';
/**
 * 第二大脑 smartChunk（ticket 103；逐字对齐 QA 闪念.js L277-310）
 * 算法：空行分段聚合（块间保留 '\n' 结构）→ 超长段再按句界切分；短于 minChunk 的尾块丢弃。
 * issue 424/ADR-0184：minChunk 默认 1 = **不按长度丢块**（原「段落最小长度」设置项已删，用户拍板
 * 「不做限制」——只保留空块不推的兜底；参数保留供测试与特殊调用点显式指定）。
 * ⚠ 唯一有意偏差（Q3=B 修缺陷）：QA 原版大段路径不清 buffer，后续小段会与已入块的
 *   旧 buffer 重复拼接（内容重复入索引）；本版在 else 分支入口先 flush 并清空 buffer。
 * ticket 110：新增切块管线 embedChunks——先剥离 YAML frontmatter 再 smartChunk，
 *   笔记标题并入首块；frontmatter 样板字段（reviewStart/url 等）不进 embedding 文本
 *   （实测短卡近邻被格式相似度支配：探针 Top8 挤在 0.946–0.949 窄带）。
 * ADR-0141 §5：新增 canvasToText——主题盒里的 `.canvas` 白板抽节点文本进索引（只作候选来源，不写回）。
 */
export const CHUNK_SIZE = 256;
export const SENTENCE_BOUNDARY = /[。！？!?\n]+/;

/** frontmatter 界定：文件以 --- 行开头、至下一个独占一行的 --- 止（Obsidian 同口径；容忍 \r\n 与文末无换行闭合）。未闭合（如正文分隔线误开头）不视为 frontmatter，原样返回。 */
const FRONTMATTER_RE = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** 剥离 YAML frontmatter（ticket 110）：仅剥文件开头的 --- 界定块，正文原样保留 */
export function stripFrontmatter(text: string): string {
  return text.replace(FRONTMATTER_RE, '');
}

/** 路径 → 笔记标题（basename 去扩展名；md 与 canvas 通用）：标题信号并入首块用 */
export function noteTitleFromPath(path: string): string {
  return stripMdExt(path.slice(path.lastIndexOf('/') + 1)).replace(/\.canvas$/i, '');
}

/**
 * canvas 节点文本抽取（ADR-0141 §5）：`.canvas` 是 JSON 白板（`{nodes:[…],edges:[…]}`），
 * 抽节点可读文本后交既有切块链路——只作**候选来源**（可被召回、可当关联目标），**从不写回**
 * （canvas 无 frontmatter，related 无处落）。
 *
 * 逐节点按数组序取：text（正文卡片）> label（group 分组标题）> file（嵌入笔记 → 取笔记名）
 * > url（网页卡片）。畸形 JSON / 非对象 / 无 nodes 一律返回 ''（调用方按「无可嵌入内容」处理，
 * 不抛错——白板损坏不该让整轮索引挂掉）。
 */
export function canvasToText(raw: string): string {
  let data: unknown;
  try {
    data = JSON.parse(String(raw ?? ''));
  } catch {
    return '';
  }
  const nodes = (data as { nodes?: unknown } | null)?.nodes;
  if (!Array.isArray(nodes)) return '';
  const parts: string[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const rec = node as Record<string, unknown>;
    const text = typeof rec.text === 'string' ? rec.text.trim() : '';
    if (text) {
      parts.push(text);
      continue;
    }
    const label = typeof rec.label === 'string' ? rec.label.trim() : '';
    if (label) {
      parts.push(label);
      continue;
    }
    const file = typeof rec.file === 'string' ? rec.file.trim() : '';
    if (file) {
      parts.push(noteTitleFromPath(file));
      continue;
    }
    const url = typeof rec.url === 'string' ? rec.url.trim() : '';
    if (url) parts.push(url);
  }
  return parts.join('\n\n');
}

/**
 * 切块管线（ticket 110）：剥离 frontmatter → smartChunk → 空正文兜底截断（原 vector-store 内联逻辑上收）
 * → 标题并入首块（保留主题信号，首块可超 CHUNK_SIZE 一个标题长度，bge-m3 长文本无碍）。
 * 纯 frontmatter 无正文的文件返回 []，调用方按「无可嵌入内容」不入索引。
 */
export function embedChunks(content: string, title: string, minChunk = 1): string[] {
  const body = stripFrontmatter(content);
  const chunks = smartChunk(body, minChunk);
  if (chunks.length === 0 && body.trim().length > 0) chunks.push(body.trim().slice(0, CHUNK_SIZE));
  if (chunks.length > 0 && title) chunks[0] = title + '\n' + chunks[0];
  return chunks;
}

export function smartChunk(text: string, minChunk = 1): string[] {
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
