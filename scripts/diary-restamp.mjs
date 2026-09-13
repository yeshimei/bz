#!/usr/bin/env node
/**
 * 日记题目改简写迁移脚本（ADR-0131 / issue 305）：v2 条目名 → v3 题目。
 *
 * v2：`我的/日记/YYYY-MM-DD HH-MM(-N).md`（frontmatter `日期:` + `类型:`）
 * v3：`我的/日记/YYMMDDHHmm(-N).md`（frontmatter `date:` + `type:`）
 * 由来：NTFS/exFAT 禁英文 `:`（实测 ENOENT），题目改用数字简写（字典序 = 时间序）；
 * 可读形式 `YYYY-MM-DD HH:mm` 只留在属性值与界面。
 *
 * 做三件事：
 *  1. 条目文件换名（同刻 `-N` 后缀原样保留）；
 *  2. 文件内 frontmatter 键英文化（`日期:`→`date:`、`类型:`→`type:`，只在 frontmatter 区内替换，
 *     正文里出现的同名文字不动）；
 *  3. CONFIG/STORAGE/smartcat-memory.json 里指向这些文件的 ref.path 与 description 同步改指
 *     （locator 原样保留），改前留 `.bak-diary-restamp` 备份。
 *
 * 用法：
 *   node scripts/diary-restamp.mjs [--vault <路径>] [--apply] [--skip-obsidian-check]
 *   - 默认 dry-run：只列计划（<vault>/.scratch/diary-restamp-report.md），不改任何文件；
 *   - --apply 实际写盘；检测到 Obsidian 正在运行直接拒绝（插件运行时按旧题目建索引，
 *     换名瞬间会造成条目「消失/重生」）。
 *   - 幂等：已是 v3 题目的文件跳过；目标名已存在且内容一致视为已完成。
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DEFAULT_VAULT = 'E:/Obsidian/叫我包仔';
const DIARY_DIR = '我的/日记';
const MEMORY_FILE = 'CONFIG/STORAGE/smartcat-memory.json';

/** v2 条目名：`YYYY-MM-DD HH-MM(-N).md` */
const V2_FILE_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})(?:-(\d+))?\.md$/;
/** v3 题目：`YYMMDDHHmm(-N).md` */
const V3_FILE_RE = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:-(\d+))?\.md$/;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const vaultIdx = args.indexOf('--vault');
const VAULT = (vaultIdx !== -1 ? args[vaultIdx + 1] : DEFAULT_VAULT).replace(/\\/g, '/').replace(/\/+$/, '');

const p = (...seg) => path.join(VAULT, ...seg);
const daysInMonth = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const isValidDate = (y, mo, d) => mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
const isValidTime = (h, mi) => h <= 23 && mi <= 59;

/** 原子写：tmp → rename */
function atomicWrite(file, content) {
  const tmp = file + '.tmp-diary-restamp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

/** frontmatter 区内的键英文化（只改区内的 `日期:`/`类型:` 行首键；正文同名文字不动） */
function rewriteKeys(content) {
  const text = content;
  if (!text.startsWith('---\n')) return null; // 无 frontmatter：不动（交体检报出）
  const end = text.indexOf('\n---', 4);
  if (end < 0) return null;
  const fm = text.slice(4, end);
  const nextFm = fm.replace(/^日期:/m, 'date:').replace(/^类型:/m, 'type:');
  if (nextFm === fm) return text; // 键已是英文：内容不变
  return text.slice(0, 4) + nextFm + text.slice(end);
}

function obsidianRunning() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq Obsidian.exe" /NH', { encoding: 'utf8' });
    return /Obsidian\.exe/i.test(out);
  } catch {
    return false; // 检测能力不可用（非 Windows）：不拦截，由用户自行保证
  }
}

// ===== 扫计划 =====
const diaryDir = p(DIARY_DIR);
const plans = [];   // { from, to, date, time, seq }
const already = []; // 已是 v3
const others = [];  // 非条目名（不动）
if (fs.existsSync(diaryDir)) {
  for (const name of fs.readdirSync(diaryDir)) {
    if (!name.toLowerCase().endsWith('.md')) continue;
    const v3 = V3_FILE_RE.exec(name);
    if (v3) { already.push(name); continue; }
    const m = V2_FILE_RE.exec(name);
    if (!m) { others.push(name); continue; }
    const [, y, mo, d, h, mi, seq] = m;
    if (!isValidDate(+y, +mo, +d) || !isValidTime(+h, +mi)) { others.push(name); continue; }
    const stamp = `${y.slice(2)}${mo}${d}${h}${mi}`;
    plans.push({ from: name, to: seq ? `${stamp}-${seq}.md` : `${stamp}.md`, seq: seq ? +seq : null });
  }
}

// 目标名冲突检测（含计划内部互撞与磁盘既有）
const taken = new Set(already);
const conflicts = [];
const renamed = new Map(); // 旧 basename → 新 basename（记忆引用重写用）
for (const pl of plans) {
  if (taken.has(pl.to)) { conflicts.push(pl); continue; }
  taken.add(pl.to);
  renamed.set(pl.from, pl.to);
}
const effective = plans.filter((pl) => renamed.has(pl.from));

console.log(`vault: ${VAULT}`);
console.log(`模式: ${APPLY ? 'APPLY（实写）' : 'dry-run（未改动任何文件）'}\n`);

if (APPLY && !args.includes('--skip-obsidian-check') && obsidianRunning()) {
  console.error('检测到 Obsidian 正在运行：请先完全退出 Obsidian 再执行（防换名瞬间条目消失/重生）。');
  process.exit(1);
}

// ===== 记忆引用重写（结构化改 JSON）=====
let memoryCount = 0;
let memoryBackup = false;
function rewriteMemoryRefs(baseNames) {
  const memFile = p(MEMORY_FILE);
  if (!fs.existsSync(memFile)) return 0;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(memFile, 'utf8'));
  } catch {
    return 0; // 记忆文件损坏：不动，交人工
  }
  const list = Array.isArray(data?.entries) ? data.entries : [];
  let count = 0;
  for (const m of list) {
    const ref = m && m.ref;
    if (!ref || typeof ref.path !== 'string') continue;
    const slash = ref.path.lastIndexOf('/');
    if (slash < 0) continue;
    const base = ref.path.slice(slash + 1);
    const next = baseNames.get(base);
    if (!next) continue;
    const newPath = `${ref.path.slice(0, slash + 1)}${next}`;
    const newDesc = typeof ref.locator === 'string' && ref.locator ? `${newPath}#${ref.locator}` : newPath;
    if (ref.path !== newPath || m.description !== newDesc) count++;
    ref.path = newPath;
    if (typeof m.description === 'string') m.description = newDesc;
  }
  if (count > 0 && APPLY) {
    if (!fs.existsSync(memFile + '.bak-diary-restamp')) {
      fs.copyFileSync(memFile, memFile + '.bak-diary-restamp');
      memoryBackup = true;
    }
    atomicWrite(memFile, JSON.stringify(data, null, 2));
  }
  return count;
}

// ===== apply =====
const done = [];
const keyFixed = [];
if (APPLY) {
  fs.mkdirSync(p('.scratch'), { recursive: true });
  for (const pl of effective) {
    const from = p(DIARY_DIR, pl.from);
    const to = p(DIARY_DIR, pl.to);
    if (fs.existsSync(to)) throw new Error(`目标已存在（不应发生）: ${pl.to}`);
    const content = fs.readFileSync(from, 'utf8');
    const next = rewriteKeys(content);
    if (next !== null && next !== content) {
      atomicWrite(from, next); // 先改内容（同名覆盖），再换名
      keyFixed.push(pl.from);
    }
    fs.renameSync(from, to);
    done.push(`${pl.from} → ${pl.to}`);
  }
}

const memoryCountOut = rewriteMemoryRefs(renamed);

// ===== 报告 =====
const report = [];
report.push('# 日记题目简写迁移报告（ADR-0131 / issue 305）');
report.push('');
report.push(`- 运行时间：${new Date().toISOString()}`);
report.push(`- 模式：${APPLY ? 'APPLY（已实写）' : 'dry-run（未改动任何文件）'}`);
report.push(`- vault：${VAULT}`);
report.push('');
report.push('## 总览');
report.push('');
report.push('| 项目 | 数量 |');
report.push('|---|---|');
report.push(`| 待换名（v2 条目） | ${effective.length} |`);
report.push(`| 已是 v3 题目（跳过） | ${already.length} |`);
report.push(`| 非条目命名（不动） | ${others.length} |`);
report.push(`| 目标名冲突（跳过，需人工） | ${conflicts.length} |`);
report.push(`| frontmatter 键改写 | ${APPLY ? keyFixed.length : effective.length} |`);
report.push(`| smartcat 记忆引用重写 | ${memoryCountOut} |`);
report.push(`| smartcat 备份 | ${memoryBackup ? 'smartcat-memory.json.bak-diary-restamp' : '（未写）'} |`);
report.push('');
if (conflicts.length) {
  report.push('## 目标名冲突（未处理）');
  report.push('');
  for (const c of conflicts) report.push(`- \`${c.from}\` → \`${c.to}\` 已存在`);
  report.push('');
}
if (others.length > 0 && others.length <= 50) {
  report.push('## 非条目命名（保持不动）');
  report.push('');
  for (const o of others) report.push(`- \`${o}\``);
  report.push('');
}
if (done.length) {
  report.push('## 换名明细');
  report.push('');
  for (const d of done) report.push(`- ${d}`);
  report.push('');
}
fs.mkdirSync(p('.scratch'), { recursive: true });
fs.writeFileSync(p('.scratch', 'diary-restamp-report.md'), report.join('\n'), 'utf8');

console.log(`待换名: ${effective.length}，已是 v3: ${already.length}，冲突: ${conflicts.length}`);
console.log(`smartcat 记忆条目重写: ${memoryCountOut}`);
console.log(`报告: .scratch/diary-restamp-report.md`);
if (!APPLY) console.log('\n（dry-run 未改动任何文件；确认报告后加 --apply 执行，须先关闭 Obsidian）');
