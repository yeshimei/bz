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
 *
 * 管辖键白名单（A1，P2）：本域真实管辖面只有 title/summary/tags 三键（FIELD_DEFS），
 * 其余键（url/author/created 与任意第三方键）的**原文行**一律进 extraLines 原样拼回——
 * 旧实现把全键重序列化，非管辖的数值/布尔键（`页数: 12`）被引号化成 `"12"`，
 * 属性面板类型冲突、dataview 数值查询失配（类型漂移）。保形原则与 extraLines
 * 既有设计合流：不重排不属于自己的东西。
 */
import { escapeYamlText, unescapeYamlText, yamlEscapeQuoted } from '../core/utils';

export interface FrontmatterResult {
  fm: Record<string, any> | null;
  body: string;
  /** 未识别原文行 + 非管辖键原文行（按原顺序，保留缩进）；buildFrontmatter 重建时原样拼回，防数据丢失 */
  extraLines: string[];
}

/** 本域管辖键白名单（A1）：只有这三键进 fm 参与缺失检测与重建，其余键原文行保留 */
export const OWNED_KEYS: ReadonlySet<string> = new Set(['title', 'summary', 'tags']);

/** 顶层键行：首字符非空白/#/列表符；键内可含中文、连字符、下划线等（值取首个冒号后全部） */
const KEY_LINE_RE = /^([^\s:#-][^:]*):(.*)$/;
/** 列表项行：任意缩进 `- ` 开头（兼容 `  - "a"` 与 `- a` 两种剪藏器风格） */
const LIST_ITEM_RE = /^[ \t]*-[ \t]+(.*)$/;
/** 块标量指示符：`|`/`>` 及其 chomping 修饰（`|-`/`|+`/`>-`/`>+`） */
const BLOCK_SCALAR_RE = /^[|>][+-]?$/;

/** 双引号标量反转义（写侧 escapeYamlText 的逆）；单引号仅剥壳（本域不产单引号形态） */
function unquote(v: string): string {
  if (v.startsWith('"') && v.endsWith('"')) return unescapeYamlText(v.slice(1, -1));
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

/**
 * 解析 frontmatter（简单 YAML 子集：引号/JSON 数组/任意缩进列表项/块标量/中文与连字符键）。
 * 管辖键（title/summary/tags）进 fm；其余键连同其附属行（列表项/块标量缩进行）原文进 extraLines（A1）。
 */
export function parseFrontmatter(content: string): FrontmatterResult {
  // AS2：闭合 `---` 后的换行改为可选（`(?:\r?\n)?`）——文件以 frontmatter 结尾且无尾换行
  // （Obsidian 自家认可此形态）时旧正则 fm=null，正文=全文，重建时旧 frontmatter 文本
  // 被整体复制进正文区（数据损坏面）
  const m = content.match(/^\s*---\s*\n([\s\S]*?)\n\s*---[ \t]*(?:\r?\n)?/);
  if (!m) return { fm: null, body: content, extraLines: [] };
  const fm: Record<string, any> = {};
  const extraLines: string[] = [];
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(KEY_LINE_RE);
    if (kv && !OWNED_KEYS.has(kv[1].trim())) {
      // 非管辖键（A1）：键行 + 后续附属行（列表项/块标量缩进/空行）直到下一顶层键行，原文保留
      extraLines.push(line);
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (KEY_LINE_RE.test(lines[j])) break;
        extraLines.push(lines[j]);
      }
      i = j - 1;
      continue;
    }
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
      val = unquote(val);
      // 解析数组（tags: ["a", "b"] 或 tags:\n  - "a" / - a）
      if (val.startsWith('[')) {
        try { val = JSON.parse(val); } catch { /* 保持字符串（N3：流式数组降级为字符串，交由消费侧「宁缺勿覆」） */ }
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

/**
 * 重建 frontmatter（数组→`  - "x"`、空值→`""`、转义单源 escapeYamlText（AS1：先 `\` 后
 * `"` 再换行折空格，unquote 反转义对齐）；extraLines 原样拼回防丢行。
 * 入参 fm 应只含管辖键（A1）——parseFrontmatter 已把非管辖键原文行归入 extraLines。
 */
export function buildFrontmatter(fm: Record<string, any>, extraLines: string[] = []): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${yamlEscapeQuoted(item)}`);
    } else if (v === null || v === undefined || v === '') {
      lines.push(`${k}: ""`);
    } else {
      lines.push(`${k}: ${yamlEscapeQuoted(v)}`);
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
