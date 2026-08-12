/**
 * 黑匣子关联双链改完整路径（用户 2026-08-12：正文关联区 `[[名]]` → `[[完整路径|名]]`，Obsidian 可点跳转、同名不歧义）。
 * 扫描 `黑匣子/` 下全部笔记：
 *   - 正文关联区行（`- 关联：` / `关联概念：` / `来自：`）内的旧格式 `[[名]]` / `[[名|别名]]`：
 *       · 名字唯一命中 → `[[黑匣子/<类型>/<分类>/<名>|显示名]]`（保留原别名）
 *       · 多个同名 → 全部同名路径链接都写出（不丢数据）
 *       · 未命中 → 保持原样（pendingLinks）
 *   - 已是路径（含 `/`）的链接 → 不动（幂等）
 *   - frontmatter 一律不动；`来源：` 行不动
 * 幂等可重跑；不生成 .bak（用户 2026-08-12 决策）。用法：node tools/rewrite-blackbox-wikilinks.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const VAULT = 'E:/Obsidian/叫我包仔';
const NOTE_ROOT = path.join(VAULT, '黑匣子');

/** 解析 frontmatter 为对象（简单 YAML 子集：标量 + 列表） */
function parseFm(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const fm = {};
  let cur = null;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) {
      cur = kv[1];
      fm[cur] = kv[2].trim().replace(/^["']|["']$/g, '');
    } else if (line.startsWith('  - ') && cur) {
      fm[cur] = Array.isArray(fm[cur]) ? [...fm[cur], line.slice(4).trim()] : [fm[cur], line.slice(4).trim()];
    }
  }
  return fm;
}

/** 行内旧格式链接 → 新格式（唯一/多同名/未命中/路径已存在） */
const LINK_RE = /\[\[([^\]|#]+?)(?:\|([^\]|#]*))?(?:#([^\]]*))?\]\]/g;

function rewriteLine(line, nameToPaths, selfPath) {
  return line.replace(LINK_RE, (whole, main, alias, anchor) => {
    const m = main.trim();
    if (!m) return whole;
    if (m.includes('/')) return whole; // 已是路径链接（幂等）
    const hits = (nameToPaths.get(m) || []).filter((p) => p !== selfPath);
    if (!hits.length) return whole; // 未命中 → 保持（pendingLinks）
    const disp = (alias || m).trim();
    const suffix = anchor ? `#${anchor}` : '';
    // 唯一 → 单链接；同名多个 → 全部写出（数据不丢）
    return hits.map((p) => `[[${p.replace(/\.md$/, '')}${suffix}|${disp}]]`).join(' ');
  });
}

function main() {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files.push(p);
    }
  };
  walk(NOTE_ROOT);

  // 建名 → 路径表（同名多值）
  const nameToPaths = new Map();
  for (const f of files) {
    const fm = parseFm(fs.readFileSync(f, 'utf8'));
    if (!fm || !fm.id) continue;
    const name = fm.type === 'concept' ? (fm.name || '').trim() : (fm.title || '').trim();
    if (!name) continue;
    const rel = path.relative(VAULT, f).split(path.sep).join('/');
    const list = nameToPaths.get(name);
    if (list) list.push(rel);
    else nameToPaths.set(name, [rel]);
  }

  let changed = 0;
  const relLineRe = /^([- ]*(?:关联|关联概念|来自)：.*)$/;
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const lines = raw.split('\n');
    let dirty = false;
    const rel = path.relative(VAULT, f).split(path.sep).join('/');
    const next = lines.map((line) => {
      if (!relLineRe.test(line.trim())) return line;
      const n = rewriteLine(line, nameToPaths, rel);
      if (n !== line) dirty = true;
      return n;
    });
    if (dirty) {
      fs.writeFileSync(f, next.join('\n'), 'utf8');
      changed += 1;
    }
  }
  console.log(`扫描 ${files.length} 篇，重写关联区 ${changed} 篇（幂等：已路径化的跳过）`);
}

main();
