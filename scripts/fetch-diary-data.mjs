// scripts/fetch-diary-data.mjs — 日记本原型种子抓取（issue 256，先例 fetch-home-data 精神）
//
// 从真实 vault 抓「我的/日记」+「我的/影视」+「我的/信」+「书库」的 md 原文快照，
// 写 prototypes/diary/prototype-data.js（window.DIARY.FILES：{path, content, ctime} 原文逐字），
// 并把正文 `![[媒体]]` 引用到的真实媒体【择要】复制到 prototypes/diary/assets/<文件名>
//（清单落 window.DIARY.ASSETS）。预算外/超单限的媒体不入库但仍可见——预览服务
// preview-live.mjs 的 /__vault-media/ 会现场从真实 vault 取流（引用全量 1.8G，
// 图 577M / 视频 1.07G / 音频 151M，不可能入库）；只有「双击直开无服务端」时才退
// 渐变占位（评审语义仍成立）。
//
// 快照是「原始 md 原文」而非解析产物：评审壳把 FILES 写进 fake vault（localStorage），
// 由真数据链（src/diary/parser.ts + data.ts + config.ts）现场解析——标签/媒体/排序全单源，
// 抓取脚本不做任何解析复制（零解析漂移）。
//
// 用法：node scripts/fetch-diary-data.mjs [--vault <vault根>] [--max-media-mb 8]
//   vault 根缺省从 esbuild.config.mjs 的 VAULT_PLUGIN_DIR 反推（…/.obsidian/plugins/bz → 上三级）。
// 产物入库（prototype-data.js 双击零依赖先例）；assets/ 媒体文件同样入库（评审必需）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 参数 ----------
const argv = process.argv.slice(2);
function argOf(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
let vaultRoot = argOf('--vault', '');
if (!vaultRoot) {
  const cfg = fs.readFileSync(path.join(ROOT, 'esbuild.config.mjs'), 'utf8');
  const m = cfg.match(/VAULT_PLUGIN_DIR\s*=\s*"([^"]+)"/);
  if (!m) {
    console.error('esbuild.config.mjs 未找到 VAULT_PLUGIN_DIR，请用 --vault 指定 vault 根');
    process.exit(1);
  }
  // <vault>/.obsidian/plugins/bz → <vault>
  vaultRoot = path.resolve(m[1], '..', '..', '..');
}
const MAX_MEDIA_BYTES = Number(argOf('--max-media-mb', '8')) * 1024 * 1024;

// ---------- 目录（与 src/diary/config.ts 默认值同源；用户改过目录时用 --vault 外再手改此处即可） ----------
const DIRS = ['我的/日记', '我的/影视', '我的/信', '书库'];

// ---------- 收集 md ----------
function listMd(dir) {
  const out = [];
  const abs = path.join(vaultRoot, dir);
  if (!fs.existsSync(abs)) return out;
  const stack = [abs];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) out.push(p);
    }
  }
  return out;
}

// ---------- 媒体引用（与 data.ts WIKILINK_RE 同口径） ----------
function mediaRefs(content) {
  const names = new Set();
  const re = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
  let m;
  while ((m = re.exec(content))) {
    const ref = m[1].trim();
    const dot = ref.lastIndexOf('.');
    if (dot <= 0 || dot === ref.length - 1) continue;
    names.add(ref);
  }
  return [...names];
}

/** 引用名 → vault 内真实文件（Obsidian 链接语义近似：全库按 basename 匹配，优先同目录相对路径） */
const byBase = new Map();
function indexVault() {
  const stack = [vaultRoot];
  while (stack.length) {
    const cur = stack.pop();
    let ents;
    try {
      ents = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of ents) {
      if (ent.name === '.obsidian' || ent.name === '.trash' || ent.name.startsWith('.git')) continue;
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (!byBase.has(ent.name.toLowerCase())) byBase.set(ent.name.toLowerCase(), p);
    }
  }
}

// ---------- 主流程 ----------
// 样本预算（评审需「真实且近况」，不搬全库）：日记取最近 N 篇、影视/信/书按名字倒序取样；
// 媒体只收保留文件引用到的，逐个拷贝并在总预算内截止（超预算/超单限 → 不进清单 → 壳内占位）。
const KEEP = { '我的/日记': 150, '我的/影视': 40, '我的/信': 20, '书库': 30 };
const ASSET_BUDGET_BYTES = 16 * 1024 * 1024;

indexVault();
const files = [];
const assets = new Map(); // basename → src abs path（含大小）
let skipped = 0;
for (const dir of DIRS) {
  const list = listMd(dir).sort((a, b) => b.localeCompare(a)).slice(0, KEEP[dir] ?? 40);
  for (const abs of list) {
    const rel = path.relative(vaultRoot, abs).replace(/\\/g, '/');
    const content = fs.readFileSync(abs, 'utf8');
    const st = fs.statSync(abs);
    files.push({ path: rel, content, ctime: st.birthtimeMs || st.ctimeMs });
    for (const ref of mediaRefs(content)) {
      const base = ref.split('/').pop();
      if (assets.has(base)) continue;
      const src = byBase.get(base.toLowerCase());
      if (!src || !fs.existsSync(src) || fs.statSync(src).size > MAX_MEDIA_BYTES) {
        skipped++;
        continue;
      }
      assets.set(base, src);
    }
  }
}

// ---------- 复制媒体（总预算内截止） ----------
// 顺序 = DIRS 优先序（我的/日记 → 影视 → 信 → 书库），即 assets Map 的插入序。
// 【坑】曾按 basename 字典序排（早先为「产物稳定」），结果书库书页扫描图 00001.jpeg…
// 按字序全部排在日记照片（P1058888.jpg…）之前，16M 预算被书页吃光，日记媒体命中率
// 掉到 25%——评审时满墙渐变占位。字典序稳定换个实现方式即可，优先级不能丢。
// 另：预算外/超单限的引用并非「看不到」——预览服务 /__vault-media/ 会现场从真实
// vault 取流，本子集只服务「双击直开、无服务端」的离线评审。
const assetDir = path.join(ROOT, 'prototypes', 'diary', 'assets');
fs.rmSync(assetDir, { recursive: true, force: true });
fs.mkdirSync(assetDir, { recursive: true });
let budget = ASSET_BUDGET_BYTES;
let overBudget = 0;
for (const [base, src] of assets) {
  const size = fs.statSync(src).size;
  if (size > budget) {
    assets.delete(base);
    overBudget++;
    continue;
  }
  fs.copyFileSync(src, path.join(assetDir, base));
  budget -= size;
}

// ---------- 写 prototype-data.js ----------
const out =
  '// 自动生成：node scripts/fetch-diary-data.mjs（真实 vault 快照，原文逐字入库）。\n' +
  '// 手改无效，重跑覆盖。加载顺序：本文件先于 prototype-behavior.js。\n' +
  '// FILES = fake vault 种子（真数据链现场解析）；ASSETS = assets/ 实际可用媒体文件名（缺 → 壳内占位）。\n' +
  'window.DIARY = {\n' +
  `  ASSETS: ${JSON.stringify([...assets].sort())},\n` +
  `  FILES: ${JSON.stringify(files)},\n` +
  '};\n';
fs.writeFileSync(path.join(ROOT, 'prototypes', 'diary', 'prototype-data.js'), out);
console.log(
  `files=${files.length}（${Object.entries(KEEP)
    .map(([d, n]) => `${d}:${n}`)
    .join(' ')} 上限内取样） assets=${assets.size} over-budget=${overBudget} skipped-media=${skipped}`
);
