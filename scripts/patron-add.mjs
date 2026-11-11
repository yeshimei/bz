#!/usr/bin/env node
/**
 * 支持者名单加一位（docs/patrons.json）
 *
 * 2026-11-11 名单从两个仓库的代码常量搬成在线 JSON 之后，记一笔就只剩这一条命令：
 *
 *   node scripts/patron-add.mjs --name 沁弦 --amount 6.66 --date 2026-11-11 --message "留言"
 *   node scripts/patron-add.mjs --name 面包 --amount patron --date 2026-11-10
 *   node scripts/patron-add.mjs --name 测试 --amount 1 --dry-run
 *
 * 为什么要有脚本：JSON 手改容易漏逗号、顺序加反、金额写成字符串；而名单坏掉是
 * **静默失败**——插件里只是名单变短，没人会报 bug。脚本负责校验、插到正确位置、
 * 写回，然后提交。默认还推一次 origin（bz 的 origin 同时推 GitHub 与码云）。
 *
 * 参数：
 *   --name <昵称>       必填，1–40 字
 *   --amount <金额|patron>  必填；数字 = 微信赞赏码收到的元数，patron = 赞助商店那条路
 *   --date <YYYY-MM-DD> 省略取今天
 *   --message <留言>    可省略；最长 120 字，换行压成空格
 *   --no-push           只提交，不推送
 *   --dry-run           只打印将写入的那条，不改文件、不提交
 *
 * 边界（与两个插件的解析口径一致，改这里要同步改 docs/patrons.md）：
 *   · 名单时间倒序；同一天新记的排在前面；
 *   · 坏一条丢一条是客户端的兜底，这里在写入前就挡住，别让坏数据进仓库；
 *   · 昵称与留言是别人写的字：不改写、不翻译、不补标点（换行除外——落进 JSON 会把版面打散）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'docs', 'patrons.json');
const MAX_NAME = 40;
const MAX_MESSAGE = 120;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return '';
  const v = argv[i + 1];
  return typeof v === 'string' && !v.startsWith('--') ? v : '';
};

const dryRun = flag('--dry-run');
const noPush = flag('--no-push');

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function cleanText(v, max) {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function validDate(s) {
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 每条一行：字段顺序固定，diff 才看得懂 */
function entryLine(p) {
  const parts = [
    `"name": ${JSON.stringify(p.name)}`,
    `"amount": ${JSON.stringify(p.amount)}`,
    `"date": ${JSON.stringify(p.date)}`,
  ];
  if (p.message) parts.push(`"message": ${JSON.stringify(p.message)}`);
  return `    { ${parts.join(', ')} }`;
}

function readDoc() {
  if (!fs.existsSync(FILE)) die(`找不到 ${FILE}`);
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    die(`docs/patrons.json 不是合法 JSON：${e.message}`);
  }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.patrons)) {
    die('docs/patrons.json 缺 patrons 数组');
  }
  return doc;
}

const name = cleanText(value('--name'), MAX_NAME);
if (!name) die('缺 --name');
if (name.length > MAX_NAME) die(`昵称超过 ${MAX_NAME} 字`);

const amountRaw = String(value('--amount') ?? '').trim();
if (!amountRaw) die('缺 --amount');
let amount;
if (amountRaw.toLowerCase() === 'patron') {
  amount = 'patron';
} else {
  amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999) {
    die('--amount 要么是大于 0 的金额（元），要么写 patron');
  }
  // 3.14 记 3.14、12.00 记 12：去掉浮点尾巴
  amount = Math.round(amount * 100) / 100;
}

const dateRaw = value('--date') || todayLocal();
const date = dateRaw.replace(/\//g, '-');
if (!validDate(date)) die(`--date 不是合法日期：${dateRaw}`);

const message = cleanText(value('--message'), MAX_MESSAGE);

const doc = readDoc();
const entry = { name, amount, date };
if (message) entry.message = message;

// 插到「第一条不比它新」的前面：时间倒序，同一天新记的排最前
const at = doc.patrons.findIndex((p) => String(p && p.date) <= date);
const index = at === -1 ? doc.patrons.length : at;
doc.patrons.splice(index, 0, entry);
doc.updatedAt = todayLocal();

const lines = [
  '{',
  `  "version": ${Number(doc.version) || 1},`,
  `  "updatedAt": ${JSON.stringify(doc.updatedAt)},`,
  '  "patrons": [',
  doc.patrons.map(entryLine).join(',\n'),
  '  ]',
  '}',
  '',
];

const preview = lines.join('\n');
if (dryRun) {
  console.log(`[dry-run] ${entryLine(entry).trim()}`);
  console.log(`[dry-run] 现在共 ${doc.patrons.length} 位，文件未改动`);
  process.exit(0);
}

fs.writeFileSync(FILE, preview, 'utf8');
console.log(`✓ 已写入 ${path.relative(ROOT, FILE)}：${name} · ${amount === 'patron' ? '赞助人' : `¥${amount}`} · ${date}`);
console.log(`  现在共 ${doc.patrons.length} 位`);

function git(args, quiet = false) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

try {
  git(['add', 'docs/patrons.json']);
  git(['commit', '-m', `chore(patrons): 名单加一位——${name}`]);
} catch (e) {
  die(`提交失败（文件已改，可手动补提交）：${String(e.message || e).slice(0, 200)}`);
}

if (noPush) {
  console.log('· 已提交，未推送（--no-push）');
} else {
  try {
    git(['push', 'origin']);
    console.log('✓ 已推送（GitHub + 码云）');
  } catch {
    die('推送失败：文件与提交都在本地，检查网络后 git push origin');
  }
}

console.log('· 生效时间：码云 60 秒内、GitHub 5 分钟内；插件下次打开弹窗即可看到');
