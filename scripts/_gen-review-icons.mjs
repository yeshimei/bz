// 一次性图标表生成（issue 253）：从既有域图标表并集抽取复习域所需图标。
// 运行：node scripts/_gen-review-icons.mjs（产物 src/review/prototype-icons.js 入库）。
import fs from 'node:fs';

const need = [
  'repeat-2', 'settings', 'x', 'search', 'folder', 'bar-chart-3', 'skip-forward', 'flag',
  'file-text', 'check', 'inbox', 'history', 'trash-2', 'chevron-down', 'plus', 'clock', 'undo-2',
];
const sources = [
  'src/belongings/prototype-icons.js',
  'src/clipbook/prototype-icons.js',
  'src/cinema/prototype-icons.js',
  'src/home/prototype-icons.js',
  'src/settings-panel/prototype-icons.js',
  'src/bookshelf/prototype-icons.js',
  'src/favorites/prototype-icons.js',
];
const table = {};
for (const f of sources) {
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, 'utf8');
  const re = /"([a-z0-9-]+)":\s*"((?:[^"\\]|\\.)*)"/g;
  for (const m of t.matchAll(re)) {
    if (!need.includes(m[1]) || table[m[1]]) continue;
    // 既有表是 JS 字符串字面量（含 \" \\ \n 转义）——按 JSON 字符串一次性还原
    let val;
    try {
      val = JSON.parse('"' + m[2] + '"');
    } catch {
      val = m[2].replace(/\\"/g, '"');
    }
    table[m[1]] = val;
  }
}
// 'skip-forward' 不在既有域表：路径数据逐字取自 Obsidian asar lucide 表（issue 253 校验）
if (!table['skip-forward']) {
  table['skip-forward'] =
    '<path d="M21 4v16" /> <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />';
}
const missing = need.filter((n) => !table[n]);
const out =
  '// 自动生成（issue 253）：既有域图标表并集抽取（复习域消费面：队列头行/底部行/冲刺/空态/抽屉）。\n' +
  '// 手改无效，重跑 node scripts/_gen-review-icons.mjs 覆盖。加载顺序：本文件先于 prototype-behavior.js。\n' +
  'window.RVW_ICONS = ' + JSON.stringify(table, null, 2) + ';\n';
fs.writeFileSync('src/review/prototype-icons.js', out);
console.log('written', Object.keys(table).length, 'icons; missing:', missing.join(',') || '(none)');
