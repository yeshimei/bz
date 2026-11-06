#!/usr/bin/env node
// scripts/migrate-clip-summary-card.mjs — 存量剪藏笔记：dataviewjs 摘要块 → 原生摘要卡
//
// 背景（ADR-0290）：旧版保存剪藏时往每篇正文塞
//   ```dataviewjs
//   await dv.view(`CONFIG/SCRIPTS/DataView/摘要`)
//   ```
// 这是作者私人库里的脚本路径。别的用户没装 Dataview、或库里没有那份脚本，打开笔记就是
// 一段报错块。写侧已改成「AI 摘要写回成功时生成 Obsidian 原生 callout」，本脚本负责把
// 存量笔记一次性改成同款原生卡。
//
// 只动「正文开头就是 dataviewjs 块」的笔记——那正是旧写侧的产物。已有原生卡、正文没有
// 该块的笔记一律跳过（不猜、不动别的东西）。
//
// 用法：
//   node scripts/migrate-clip-summary-card.mjs --vault "E:/Obsidian/叫我包仔"
//       干跑：只列清单（哪些会改、哪些缺摘要跳过），不写盘
//   node scripts/migrate-clip-summary-card.mjs --vault "E:/Obsidian/叫我包仔" --apply
//       落盘：先备份到 <vault>/.bz-migrate-backup/<时间戳>/，再逐个改写
//   --dir "归档/网页剪藏"   手动指定剪藏目录（缺省从插件 data.json 的 articleDirectory 读）
//
// 缺摘要的笔记不落卡（AI 没生成过摘要，卡片会是一张空壳）——它们保持原样，之后在剪藏本里
// 「重新生成摘要」时会由 auto-summary 顺带清旧块、写新卡。
//
// 夹具口径与 src/clipbook/summary-card.ts 逐字对齐：改一边必改另一边（tests/clipbook/summary-card.test.ts
// 钉的是 TS 侧；本脚本只在存量迁移时跑一次，故不引构建产物）。

import fs from 'node:fs';
import path from 'node:path';

const CARD_HEAD_RE = /^>\s*\[!summary\][+-]?/;

function parseArgs(argv) {
  const out = { apply: false, vault: '', dir: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--vault') out.vault = argv[++i] || '';
    else if (a === '--dir') out.dir = argv[++i] || '';
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`未知参数：${a}`);
  }
  return out;
}

function unquote(v) {
  if (v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

/** frontmatter 解析（本脚本只读 summary/tags/title，够用即可）：
 *  顶层键行 + 任意缩进列表项，空值键后紧跟列表按列表处理——与 auto-summary/parser.ts 同口径。 */
function parseFrontmatter(text) {
  const m = text.match(/^\s*---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n)?/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  let lastKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([^\s:#-][^:]*):(.*)$/);
    if (kv) {
      lastKey = kv[1].trim();
      const val = kv[2].trim();
      fm[lastKey] = val === '' ? '' : unquote(val);
      continue;
    }
    const li = line.match(/^[ \t]*-[ \t]+(.*)$/);
    if (li && lastKey) {
      if (!Array.isArray(fm[lastKey])) fm[lastKey] = [];
      fm[lastKey].push(unquote(li[1].trim()));
    }
  }
  return { fm, body: text.slice(m[0].length) };
}

/** 生成摘要卡（与 src/clipbook/summary-card.ts 的 summaryCardText 同形） */
function cardText(title, summary, tags) {
  const s = String(summary ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!s) return '';
  const t = String(title ?? '').replace(/[\r\n]+/g, ' ').trim();
  const chips = (Array.isArray(tags) ? tags : [])
    .map((x) => String(x ?? '').trim().replace(/^#+/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .map((x) => `#${x}`);
  const out = [t ? `> [!summary] ${t}` : '> [!summary]', `> ${s}`];
  if (chips.length) out.push('>', `> ${chips.join(' ')}`);
  return out.join('\n');
}

function topCardRange(lines) {
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length || !CARD_HEAD_RE.test(lines[i].trim())) return null;
  let j = i + 1;
  while (j < lines.length && /^\s*>/.test(lines[j])) j++;
  return [i, j];
}

/** 正文开头的旧 dataviewjs 块（旧写侧产物）——不在开头的不算，返回 null 表示不是迁移对象 */
function legacyBlockAtTop(body) {
  const m = body.match(/^\s*```dataviewjs[\s\S]*?```[ \t]*(?:\r?\n|$)/);
  if (!m) return null;
  return { block: m[0], rest: body.slice(m[0].length) };
}

/** 与 TS 侧 upsertSummaryCard 同形：剥开头卡 + 前置新卡 */
function upsertCard(body, card) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const r = topCardRange(lines);
  const rest = (r ? lines.slice(r[1]) : lines).join('\n').replace(/^\s+/, '');
  return card + (rest ? '\n\n' + rest : '');
}

/** 解析插件数据目录：<vault>/.obsidian/plugins/<任意>/data.json 里 id === bz 的那个 */
function readArticleDirectory(vault) {
  const pluginsDir = path.join(vault, '.obsidian', 'plugins');
  if (!fs.existsSync(pluginsDir)) return { dir: '', from: '' };
  for (const name of fs.readdirSync(pluginsDir)) {
    const dataPath = path.join(pluginsDir, name, 'data.json');
    const manifestPath = path.join(pluginsDir, name, 'manifest.json');
    if (!fs.existsSync(dataPath) || !fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.id !== 'bz') continue;
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return { dir: String(data.articleDirectory || ''), from: dataPath };
    } catch {
      // 坏 JSON 跳过，继续找下一个
    }
  }
  return { dir: '', from: '' };
}

function walkMarkdown(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walkMarkdown(p, out);
    else if (name.isFile() && name.name.toLowerCase().endsWith('.md')) out.push(p);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.vault) {
    console.log('用法：node scripts/migrate-clip-summary-card.mjs --vault "<库路径>" [--dir "<剪藏目录>"] [--apply]');
    process.exit(args.help ? 0 : 1);
  }
  const vault = path.resolve(args.vault);
  if (!fs.existsSync(vault)) throw new Error(`库路径不存在：${vault}`);

  let clipDir = args.dir;
  let source = '--dir';
  if (!clipDir) {
    const found = readArticleDirectory(vault);
    clipDir = found.dir;
    source = found.from ? `插件设置（${found.from}）` : '';
  }
  if (!clipDir) {
    throw new Error('没读到剪藏目录：请在插件设置里配好「剪藏文件夹」，或用 --dir 指定');
  }
  const absClip = path.join(vault, clipDir);
  if (!fs.existsSync(absClip)) throw new Error(`剪藏目录不存在：${absClip}`);

  const files = walkMarkdown(absClip);
  const todo = [];
  const skipped = [];
  for (const file of files) {
    const rel = path.relative(vault, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    const { fm, body } = parseFrontmatter(text);
    const legacy = legacyBlockAtTop(body);
    if (!legacy) {
      skipped.push({ rel, why: '正文没有旧 dataviewjs 块' });
      continue;
    }
    const title = path.basename(file, '.md');
    const card = cardText(title, fm.summary, fm.tags);
    // 缺摘要：不落空卡（AI 没生成过摘要），但旧块必须清——留着它等于继续依赖 Dataview；
    // 之后在剪藏本里「重新生成摘要」时 auto-summary 会自动补卡
    const afterRest = card ? upsertCard(legacy.rest, card) : legacy.rest.replace(/^\s+/, '');
    // frontmatter 原样保留：只替换正文。frontmatter 段与正文之间统一留一空行（与写侧 save.ts 同形）
    const head = text.slice(0, text.length - body.length).replace(/\s+$/, '');
    const usesCrlf = /\r\n/.test(text) && !/(?<!\r)\n/.test(text);
    const nextBody = head + '\n\n' + afterRest;
    const next = (usesCrlf ? nextBody.replace(/\n/g, '\r\n') : nextBody).replace(/\s+$/, '') + (usesCrlf ? '\r\n' : '\n');
    todo.push({ rel, file, text, next, tags: Array.isArray(fm.tags) ? fm.tags.length : 0, withCard: !!card });
  }

  console.log(`剪藏目录：${clipDir}  ← ${source}`);
  console.log(`扫描 ${files.length} 篇 · 待改 ${todo.length} 篇 · 跳过 ${skipped.length} 篇`);
  for (const t of todo) {
    console.log(t.withCard
      ? `  改  ${t.rel}  （标签 ${t.tags} 个）`
      : `  清  ${t.rel}  （无摘要，只清旧块；生成摘要后自动补卡）`);
  }
  const byWhy = new Map();
  for (const s of skipped) byWhy.set(s.why, (byWhy.get(s.why) || 0) + 1);
  for (const [why, n] of byWhy) console.log(`  跳过 ${n} 篇：${why}`);

  if (!args.apply) {
    console.log('\n干跑结束（未写盘）。确认无误后加 --apply。');
    return;
  }
  if (!todo.length) {
    console.log('\n没有需要迁移的笔记。');
    return;
  }

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backupRoot = path.join(vault, '.bz-migrate-backup', stamp);
  let written = 0;
  const failed = [];
  for (const t of todo) {
    try {
      const relToVault = path.relative(vault, t.file);
      const backupPath = path.join(backupRoot, relToVault);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(t.file, backupPath);
      fs.writeFileSync(t.file, t.next, 'utf8');
      written++;
    } catch (e) {
      failed.push({ rel: t.rel, err: String(e && e.message ? e.message : e) });
    }
  }
  console.log(`\n已改写 ${written} 篇，失败 ${failed.length} 篇`);
  for (const f of failed) console.log(`  失败 ${f.rel}：${f.err}`);
  console.log(`备份：${backupRoot}`);
}

try {
  main();
} catch (e) {
  console.error(`[迁移] ${e && e.message ? e.message : e}`);
  process.exit(1);
}
