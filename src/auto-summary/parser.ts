/**
 * 自动摘要 parser（ticket 10）：frontmatter 解析/重建/正文提取，源码逐字移植。
 * 源码：自动摘要.js L8-60
 *
 * 审计修复（数据丢失面）：本域管辖 `归档/网页剪藏` 里任意来源的 md，旧解析只认
 * `^\w+:` 键和恰好两空格的列表项——中文键、带连字符键、块标量、注释行会在
 * processFile 写回重建时被永久删除；无缩进列表风格的 tags 被判缺失后被 AI 覆盖。
 * 现在：
 * - 键识别放宽为首字符非空白/#/列表符的顶层行（兼容中文键、连字符键）；
 * - 列表项兼容任意缩进（`  - "a"` 与 `- a` 等价，剪藏器两种风格都写）；
 * - 块标量（`key: |` / `>`）后续缩进行收进值，不再散落丢弃；
 * - 仍未识别的行（注释、嵌套子映射等）原文保留在 extraLines，写回时原样拼回。
 */

export interface FrontmatterResult {
  fm: Record<string, any> | null;
  body: string;
  /** 未识别原文行（按原顺序，保留缩进）；buildFrontmatter 重建时原样拼回，防数据丢失 */
  extraLines: string[];
}

/** 顶层键行：首字符非空白/#/列表符；键内可含中文、连字符、下划线等（值取首个冒号后全部） */
const KEY_LINE_RE = /^([^\s:#-][^:]*):(.*)$/;
/** 列表项行：任意缩进 `- ` 开头（兼容 `  - "a"` 与 `- a` 两种剪藏器风格） */
const LIST_ITEM_RE = /^[ \t]*-[ \t]+(.*)$/;
/** 块标量指示符：`|`/`>` 及其 chomping 修饰（`|-`/`|+`/`>-`/`>+`） */
const BLOCK_SCALAR_RE = /^[|>][+-]?$/;

function unquote(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

/** 解析 frontmatter（简单 YAML 子集：引号/JSON 数组/任意缩进列表项/块标量/中文与连字符键） */
export function parseFrontmatter(content: string): FrontmatterResult {
  const m = content.match(/^\s*---\s*\n([\s\S]*?)\n\s*---\s*\n/);
  if (!m) return { fm: null, body: content, extraLines: [] };
  const fm: Record<string, any> = {};
  const extraLines: string[] = [];
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(KEY_LINE_RE);
    if (kv) {
      const key = kv[1].trim();
      let val = kv[2].trim();
      // 块标量：`key: |` / `key: >` → 收集后续更缩进（或空）行为多行值，避免散落成未识别行
      if (BLOCK_SCALAR_RE.test(val)) {
        const bodyLines: string[] = [];
        let indent: string | null = null;
        let j = i + 1;
        for (; j < lines.length; j++) {
          const l = lines[j];
          if (l.trim() === '') { bodyLines.push(''); continue; }
          const lm = l.match(/^([ \t]+)\S/);
          if (!lm) break; // 非缩进行 = 块结束
          if (indent === null) indent = lm[1];
          bodyLines.push(l.startsWith(indent) ? l.slice(indent.length) : l.replace(/^[ \t]+/, ''));
        }
        fm[key] = bodyLines.join('\n').replace(/\n+$/, '');
        i = j - 1;
        continue;
      }
      if (val === '') {
        // 空值键：若紧跟缩进的「非列表」行 = 嵌套子映射，无法安全重建 → 键行+缩进块整段原文保留；
        // 紧跟列表项（任意缩进）则保持原语义：置空占位，交下方列表项归并
        const nested: string[] = [];
        let sawNested = false;
        let j = i + 1;
        for (; j < lines.length; j++) {
          const l = lines[j];
          if (l.trim() === '') { nested.push(l); continue; }
          if (LIST_ITEM_RE.test(l)) break; // 列表项 → 列表语义
          if (/^[ \t]/.test(l)) { sawNested = true; nested.push(l); continue; }
          break;
        }
        if (sawNested) {
          extraLines.push(line, ...nested);
          i = j - 1;
          continue;
        }
        fm[key] = '';
        continue;
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      // 解析数组（tags: ["a", "b"] 或 tags:\n  - "a" / - a）
      if (val.startsWith('[')) {
        try { val = JSON.parse(val); } catch { /* 保持字符串 */ }
      }
      fm[key] = val;
    } else if (LIST_ITEM_RE.test(line)) {
      // 数组项，找到最后一个有值的 key（任意缩进；空值键后紧跟列表 = 列表语义）
      const lastKey = Object.keys(fm).pop();
      if (lastKey && !Array.isArray(fm[lastKey])) fm[lastKey] = [];
      if (lastKey) {
        fm[lastKey].push(unquote(line.replace(LIST_ITEM_RE, '$1').trim()));
      } else {
        extraLines.push(line);
      }
    } else {
      // 未识别行（注释、嵌套子映射等）原文保留，写回时原样拼回
      extraLines.push(line);
    }
  }
  const body = content.slice(m[0].length);
  return { fm, body, extraLines };
}

/** 重建 frontmatter（数组→`  - "x"`、空值→`""`、引号转义、换行→空格；extraLines 原样拼回防丢行） */
export function buildFrontmatter(fm: Record<string, any>, extraLines: string[] = []): string {
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
  lines.push(...extraLines);
  lines.push('---');
  return lines.join('\n');
}

/** 提取正文给 AI（剔除 dataviewjs 代码块） */
export function extractBodyForAI(body: string): string {
  return body.replace(/^\s*```dataviewjs[\s\S]*?```\s*/m, '').trim();
}
