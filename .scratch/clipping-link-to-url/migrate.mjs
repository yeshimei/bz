/**
 * 一次性迁移脚本（ADR-0050）：归档/网页剪藏/*.md frontmatter 主字段 link → url。
 * 只改 frontmatter 块内 `link:` 键名（含缩进原样保留），值与正文零改动；
 * 已有 url 键的文件跳过（防重复键）。BOM / CRLF / LF 原样保留。
 * 用法：node migrate.mjs [vaultRoot]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || 'E:/Obsidian/叫我包仔';
const dir = join(root, '归档', '网页剪藏');

let scanned = 0;
let changed = 0;
let skippedNoLink = 0;
let skippedHasUrl = 0;
let skippedNoFm = 0;
const failures = [];

for (const name of readdirSync(dir)) {
  if (!name.endsWith('.md')) continue;
  const p = join(dir, name);
  scanned++;
  let text;
  try {
    text = readFileSync(p, 'utf8');
  } catch (e) {
    failures.push(`${name}: 读取失败 ${e.message}`);
    continue;
  }
  // frontmatter 块：文件开头（允许 BOM）`---` 行 … `---` 行；捕获头/体/尾以保留原始换行风格
  const fm = text.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
  if (!fm) { skippedNoFm++; continue; }
  const [, head, body] = fm;
  if (/^\s*url:/m.test(body)) { skippedHasUrl++; continue; }
  if (!/^\s*link:/m.test(body)) { skippedNoLink++; continue; }
  const newBody = body.replace(/^(\s*)link(?=:)/m, '$1url');
  // 头(含 --- 行) + 换键后的体 + 其后全部原文（--- 收尾行与正文原样保留）
  const updated = head + newBody + text.slice(head.length + body.length);
  try {
    writeFileSync(p, updated, 'utf8');
    changed++;
  } catch (e) {
    failures.push(`${name}: 写入失败 ${e.message}`);
  }
}

console.log(JSON.stringify({ scanned, changed, skippedNoLink, skippedHasUrl, skippedNoFm, failures }, null, 2));
