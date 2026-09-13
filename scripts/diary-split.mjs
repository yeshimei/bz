#!/usr/bin/env node
/**
 * 日记一目一文件迁移脚本（issue 304 / ADR-0130）。
 *
 * 把「一天一文件多条目」（我的/日记/YYYY-MM-DD.md，`# emoji HH:mm` 头行切条目）
 * 拆分为条目文件（我的/日记/YYYY-MM-DD HH-MM(-N).md，frontmatter 日期+类型）：
 *  1. 逐日期文件解析条目（旧 parser 同语义：emoji 逐字反查标签名、无命中兜底「日记」）；
 *  2. 有「未解析行」（游离正文/时间越界头行）的文件不拆——列入需人工处理清单，绝不静默丢行；
 *  3. 每条目写为条目文件（同刻多条：第 1 条基名、后续 -2/-3…；与磁盘已有文件撞名同样让位）；
 *  4. CONFIG/STORAGE/smartcat-memory.json 内日记引用 `我的/日记/YYYY-MM-DD.md#HH:mm`
 *     全树重写为条目文件路径（locator 保留；同刻多条指向基名条目），原文件留 .bak 备份；
 *  5. 拆分成功的原日期文件归档至 归档/日记/（目标已存在同名则报错停，绝不覆盖）。
 *
 * 用法：
 *   node scripts/diary-split.mjs [--vault <路径>] [--apply]
 *   - 默认 dry-run：只解析与出报告（<vault>/.scratch/diary-split-report.md），不改任何文件；
 *   - --apply 实际写盘；检测到 Obsidian 正在运行直接拒绝（插件运行时会竞写 smartcat-memory.json
 *     并对新条目文件重复入库——必须在 Obsidian 关闭后执行）。
 *   - 先迁移后部署：新解析层不做旧格式兼容，旧格式文件在插件内不可见。
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DEFAULT_VAULT = 'E:/Obsidian/叫我包仔';
const DIARY_DIR = '我的/日记';
const ARCHIVE_DIR = '归档/日记';
const MEMORY_FILE = 'CONFIG/STORAGE/smartcat-memory.json';

// 与 src/diary/config.ts DEFAULT_TAGS_CONFIG 同步的 emoji→标签名映射（含二级标签）
const EMOJI_TO_TAG = {
  '📖': '日记', '🔐': '加密', '😶': '念念碎', '🤝': '对谈', '✍️': '随笔', '🌙': '梦',
  '🌟': '诗', '📕': '书', '✉️': '信', '📌': '摘抄', '📸': '摄影', '🚴': '骑行',
  '⚙️': '代码', '🥘': '做饭', '🎮': '游戏', '🎧': '音乐', '📽': '电影', '📺': '电视剧',
  '🎨': '动漫', '🎞': '纪录片', '🐱': '猫', '🐶': '狗', '🐹': '仓鼠', '🐼': '熊猫',
  '🏛️': '博物馆', '🍔': '美食', '✈️': '旅游',
  '🀄': '四川', '🛶': '大理',
  '⭐': '收藏', '🐈': '咪咪', '📢': '广告', '🤣': '神评', '😅': '冷笑话', '🌀': '抽象',
  '🤖': 'AI', '🤪': '愚人节', '🕺': '舞蹈', '🤹': '达人秀', '🧑‍🎨': '艺术', '📷': '摄影集',
  '🌳': '植物', '🧩': '创意',
};

const DAY_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;
const ENTRY_FILE_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})(?:-(\d+))?\.md$/;
const HEADING_RE = /^#\s*((?:\S+)+)\s+(\d{2}:\d{2})/u;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const vaultIdx = args.indexOf('--vault');
const VAULT = (vaultIdx !== -1 ? args[vaultIdx + 1] : DEFAULT_VAULT).replace(/\\/g, '/').replace(/\/+$/, '');

const p = (...seg) => path.join(VAULT, ...seg);
const daysInMonth = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const isValidDate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
};
const isValidTime = (s) => {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return !!m && +m[1] <= 23 && +m[2] <= 59;
};

function tagsFromEmojiSeq(seq) {
  const tags = [];
  for (const ch of Array.from(seq)) {
    const tag = EMOJI_TO_TAG[ch];
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags.length ? tags : ['日记'];
}

/** 旧 parser 同语义解析日期文件：返回 {entries:[{time,tags,body}], unparsed} */
function parseDayFile(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const entries = [];
  let unparsed = 0;
  let cur = null;
  let body = [];
  const flush = () => {
    if (cur) {
      cur.body = body.join('\n').trim();
      entries.push(cur);
      cur = null;
      body = [];
    }
  };
  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m && isValidTime(m[2])) {
      flush();
      cur = { time: m[2], tags: tagsFromEmojiSeq(m[1]), body: '' };
      continue;
    }
    if (m && !isValidTime(m[2])) { unparsed++; continue; } // 时间越界头行
    if (cur) body.push(line);
    else if (line.trim() !== '') unparsed++; // 首个条目前的游离行
  }
  flush();
  return { entries, unparsed };
}

/** 递归枚举目录下全部 .md（含子目录） */
function listMd(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...listMd(full));
    else if (name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

/** 原子写：tmp → rename */
function atomicWrite(file, content) {
  const tmp = file + '.tmp-diary-split';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

// ===== Obsidian 运行检测（--apply 才拦） =====
function obsidianRunning() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq Obsidian.exe" /NH', { encoding: 'utf8' });
    return /Obsidian\.exe/i.test(out);
  } catch {
    return false; // 检测能力不可用（非 Windows）：不拦截，由用户自行保证
  }
}

// ===== 主流程 =====
const diaryDir = p(DIARY_DIR);
const files = listMd(diaryDir);

const dayFiles = [];      // { rel, date }
const entryFiles = [];    // 已迁移条目文件
const otherFiles = [];    // 非日期命名（不动）
for (const full of files) {
  const rel = path.relative(diaryDir, full).split(path.sep).join('/');
  const base = rel.split('/').pop();
  const dm = DAY_FILE_RE.exec(base);
  const em = ENTRY_FILE_RE.exec(base);
  if (dm && isValidDate(dm[1])) dayFiles.push({ full, rel, date: dm[1] });
  else if (em) entryFiles.push(rel);
  else otherFiles.push(rel);
}

// 同名日期文件多目录撞车检测（顶层 + 子目录同日期）：拆分目标路径会冲突
const dateCount = new Map();
for (const f of dayFiles) dateCount.set(f.date, (dateCount.get(f.date) || 0) + 1);

const plans = [];   // { date, rel, entries:[{time,tags,body,targetRel}] }
const manual = [];  // { rel, unparsed }（有未解析行：不拆，防丢行）
const emptyFiles = []; // 空文件（无可解析条目且无未解析行）：无内容可拆，apply 时直接归档
for (const f of dayFiles) {
  const content = fs.readFileSync(f.full, 'utf8');
  const { entries, unparsed } = parseDayFile(content);
  if (unparsed > 0) {
    manual.push({ rel: f.rel, unparsed });
    continue;
  }
  if (entries.length === 0) {
    emptyFiles.push(f.rel);
    continue;
  }
  plans.push({ ...f, content, entries });
}

// 目标路径分配（按日期分组序号 + 磁盘撞名让位；dry-run 用纯计算让位只考虑脚本内序号）
const perDate = new Map(); // date -> Map(time -> count)
for (const plan of plans) {
  if (!perDate.has(plan.date)) perDate.set(plan.date, new Map());
  const counter = perDate.get(plan.date);
  plan.entries.forEach((e) => {
    const n = counter.get(e.time) || 0;
    counter.set(e.time, n + 1);
    const [h = '00', m = '00'] = e.time.split(':');
    e.seq = n === 0 ? null : n + 1;
    const mk = (s) => (s ? `${plan.date} ${h}-${m}-${s}.md` : `${plan.date} ${h}-${m}.md`);
    e.targetRel = mk(e.seq);
    // 磁盘已有同名条目文件（重跑/既有条目）：让位至下一序号
    let s = e.seq ? e.seq + 1 : 2;
    while (fs.existsSync(p(DIARY_DIR, e.targetRel))) {
      e.targetRel = `${plan.date} ${h}-${m}-${s}.md`;
      s += 1;
    }
  });
}

// smartcat-memory 引用重写：旧日期路径(+可选#HH:mm) → 条目路径（同刻多条取基名条目）
const timeToTarget = new Map(); // `${date} ${time}` -> targetRel（第一个同名刻）
for (const plan of plans) {
  for (const e of plan.entries) {
    const key = `${plan.date} ${e.time}`;
    if (!timeToTarget.has(key)) timeToTarget.set(key, e.targetRel);
  }
}
const diaryDateDirs = [...dateCount.keys()]; // 参与重写的日期集合
const DIARY_REF_RE = new RegExp(
  '(' + DIARY_DIR + '\\/(' + diaryDateDirs.map((d) => d.replace(/-/g, '\\-')).join('|') + ')\\.md)(#[0-9]{2}:[0-9]{2})?',
  'g'
);

let memoryRewritten = 0;
let memoryBackup = false;
function rewriteMemoryRefs() {
  const memFile = p(MEMORY_FILE);
  if (!fs.existsSync(memFile)) return 0;
  const raw = fs.readFileSync(memFile, 'utf8');
  let count = 0;
  const next = raw.replace(DIARY_REF_RE, (whole, filePath, date, locator) => {
    // 带 locator：映射到该时刻条目文件；无 locator：映射到该日期第一条条目文件
    let target;
    if (locator) {
      target = timeToTarget.get(`${date} ${locator.slice(1)}`);
    }
    if (!target) {
      // 该时刻无条目（或无 locator）：取该日期时间序最靠前的条目（基名先于 -2，按 HHMM+seq 数值排）
      const sortKey = (rel) => {
        const em = ENTRY_FILE_RE.exec(rel.split('/').pop() || '');
        return em ? +em[2] * 10000 + +em[3] * 100 + (em[4] ? +em[4] : 1) : 99999999;
      };
      const candidates = plans
        .filter((pl) => pl.date === date)
        .flatMap((pl) => pl.entries.map((e) => e.targetRel))
        .sort((a, b) => sortKey(a) - sortKey(b));
      target = candidates[0];
      if (!target) return whole; // 该日期没有任何可拆条目：保持原样（报告会列出）
    }
    count++;
    return `${DIARY_DIR}/${target}`;
  });
  if (count > 0 && APPLY) {
    fs.copyFileSync(memFile, memFile + '.bak-diary-split');
    memoryBackup = true;
    atomicWrite(memFile, next);
  }
  return count;
}

// ===== dry-run / apply =====
console.log(`vault: ${VAULT}`);
console.log(`模式: ${APPLY ? 'APPLY（实写）' : 'dry-run（只出报告）'}\n`);

if (APPLY && !args.includes('--skip-obsidian-check') && obsidianRunning()) {
  console.error('检测到 Obsidian 正在运行：请先完全退出 Obsidian 再执行迁移（防插件竞写记忆与重复入库）。');
  process.exit(1);
}

const created = [];
if (APPLY) {
  for (const plan of plans) {
    for (const e of plan.entries) {
      const fmLines = ['---', `日期: ${plan.date} ${e.time}`, '类型:'];
      for (const t of e.tags) fmLines.push(`  - ${t}`);
      fmLines.push('---', '', e.body);
      const target = p(DIARY_DIR, e.targetRel);
      if (fs.existsSync(target)) throw new Error(`目标已存在（不应发生）: ${e.targetRel}`);
      atomicWrite(target, fmLines.join('\n') + '\n');
      created.push(e.targetRel);
    }
  }
  // 归档原日期文件（拆分成功的 + 空文件——无内容可拆，一并归档收口）
  fs.mkdirSync(p(ARCHIVE_DIR), { recursive: true });
  for (const plan of [...plans]) {
    const dest = p(ARCHIVE_DIR, `${plan.date}.md`);
    if (fs.existsSync(dest)) throw new Error(`归档目标已存在，拒绝覆盖: 归档/日记/${plan.date}.md`);
    fs.renameSync(plan.full, dest);
  }
  for (const rel of emptyFiles) {
    const dest = p(ARCHIVE_DIR, rel);
    if (fs.existsSync(dest)) throw new Error(`归档目标已存在，拒绝覆盖: 归档/日记/${rel}`);
    fs.renameSync(p(DIARY_DIR, rel), dest);
  }
}

const memoryCount = diaryDateDirs.length ? rewriteMemoryRefs() : 0;

// ===== 报告 =====
fs.mkdirSync(p('.scratch'), { recursive: true });
const report = [];
report.push('# 日记一目一文件迁移报告（issue 304 / ADR-0130）');
report.push('');
report.push(`- 运行时间：${new Date().toISOString()}`);
report.push(`- 模式：${APPLY ? 'APPLY（已实写）' : 'dry-run（未改动任何文件）'}`);
report.push(`- vault：${VAULT}`);
report.push('');
report.push('## 总览');
report.push('');
report.push(`| 项目 | 数量 |`);
report.push(`|---|---|`);
report.push(`| 日期文件（待拆） | ${dayFiles.length} |`);
report.push(`| 拆出条目 | ${plans.reduce((n, pl) => n + pl.entries.length, 0)} |`);
report.push(`| 已是条目文件（跳过） | ${entryFiles.length} |`);
report.push(`| 空文件（直接归档） | ${emptyFiles.length} |`);
report.push(`| 需人工处理（未解析行，不拆） | ${manual.length} |`);
report.push(`| 非日期命名（不动） | ${otherFiles.length} |`);
report.push(`| smartcat 记忆引用重写 | ${memoryCount} |`);
report.push(`| smartcat 备份 | ${memoryBackup ? 'smartcat-memory.json.bak-diary-split' : '（dry-run 不写）'} |`);
report.push('');
if (emptyFiles.length) {
  report.push('## 空文件（无可解析条目、无未解析行——apply 时直接归档）');
  report.push('');
  for (const rel of emptyFiles) report.push(`- \`${rel}\``);
  report.push('');
}
if (manual.length) {
  report.push('## 需人工处理（有未解析行，不拆防丢行）');
  report.push('');
  for (const m of manual) report.push(`- \`${m.rel}\`：${m.unparsed} 行未解析`);
  report.push('');
}
report.push('## 拆分明细');
report.push('');
for (const plan of plans) {
  report.push(`### ${plan.rel}（${plan.entries.length} 条）`);
  report.push('');
  for (const e of plan.entries) {
    report.push(`- ${e.time} [${e.tags.join('/')}] → \`${DIARY_DIR}/${e.targetRel}\`（${e.body.length} 字）`);
  }
  report.push('');
}
if (otherFiles.length) {
  report.push('## 非日期命名文件（保持不动）');
  report.push('');
  for (const rel of otherFiles) report.push(`- \`${rel}\``);
  report.push('');
}
const reportFile = p('.scratch', 'diary-split-report.md');
fs.writeFileSync(reportFile, report.join('\n'), 'utf8');

console.log(`日期文件: ${dayFiles.length}，拆出条目: ${plans.reduce((n, pl) => n + pl.entries.length, 0)}`);
console.log(`需人工处理: ${manual.length}，smartcat 引用重写: ${memoryCount}`);
console.log(`报告: .scratch/diary-split-report.md`);
if (!APPLY) console.log('\n（dry-run 未改动任何文件；确认报告后加 --apply 执行，须先关闭 Obsidian）');
