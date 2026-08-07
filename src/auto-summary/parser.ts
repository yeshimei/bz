/**
 * 自动摘要 parser（ticket 10）：frontmatter 解析/重建/正文提取，源码逐字移植。
 * 源码：自动摘要.js L8-60
 */

export interface FrontmatterResult {
  fm: Record<string, any> | null;
  body: string;
}

/** 解析 frontmatter（简单 YAML 子集：引号/JSON 数组/`  - ` 列表项） */
export function parseFrontmatter(content: string): FrontmatterResult {
  const m = content.match(/^\s*---\s*\n([\s\S]*?)\n\s*---\s*\n/);
  if (!m) return { fm: null, body: content };
  const fm: Record<string, any> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      let val = kv[2].trim();
      // 简单 YAML 解析：去掉引号
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      // 解析数组（tags: ["a", "b"] 或 tags:\n  - "a"）
      if (val.startsWith('[')) {
        try { val = JSON.parse(val); } catch { /* 保持字符串 */ }
      }
      fm[kv[1]] = val;
    } else if (line.startsWith('  - ')) {
      // 数组项，找到最后一个有值的 key
      const lastKey = Object.keys(fm).pop();
      if (lastKey && !Array.isArray(fm[lastKey])) fm[lastKey] = [];
      if (lastKey) {
        let v = line.replace(/^\s*-\s+/, '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        fm[lastKey].push(v);
      }
    }
  }
  const body = content.slice(m[0].length);
  return { fm, body };
}

/** 重建 frontmatter（数组→`  - "x"`、空值→`""`、引号转义、换行→空格） */
export function buildFrontmatter(fm: Record<string, any>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - "${item}"`);
    } else if (v === null || v === undefined || v === '') {
      lines.push(`${k}: ""`);
    } else {
      lines.push(`${k}: "${String(v).replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/** 提取正文给 AI（剔除 dataviewjs 代码块） */
export function extractBodyForAI(body: string): string {
  return body.replace(/^\s*```dataviewjs[\s\S]*?```\s*/m, '').trim();
}
