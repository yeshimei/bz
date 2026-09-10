// 一次性图标表生成（issue 256）：从既有域图标表并集抽取日记本域所需图标；
// 缺口（如 pen-line/video-off 等墙专属）逐字补 lucide 路径。
// 运行：node scripts/_gen-diary-icons.mjs（产物 prototypes/diary/prototype-icons.js 入库）。
import fs from 'node:fs';

// 消费面：墙头行/灯箱/媒体占位/右键菜单/抽屉/时光条/日期弹窗 + core 链（uiSearch/通知/弹窗）
const need = [
  'pen-line', 'search', 'calendar', 'settings', 'x',
  'chevron-left', 'chevron-right', 'image', 'video-off', 'music', 'play',
  'external-link', 'copy', 'file-text', 'paperclip', 'tags', 'lock', 'lock-open',
  'trash-2', 'history', 'book-open', 'check', 'plus', 'clock', 'undo-2',
];
const sources = [
  'prototypes/belongings/prototype-icons.js',
  'prototypes/clipbook/prototype-icons.js',
  'prototypes/cinema/prototype-icons.js',
  'prototypes/home/prototype-icons.js',
  'prototypes/settings-panel/prototype-icons.js',
  'prototypes/bookshelf/prototype-icons.js',
  'prototypes/favorites/prototype-icons.js',
  'prototypes/review/prototype-icons.js',
  'prototypes/password-vault/prototype-icons.js',
  'prototypes/secondbrain/prototype-icons.js',
];
const table = {};
for (const f of sources) {
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, 'utf8');
  const re = /"([a-z0-9-]+)":\s*"((?:[^"\\]|\\.)*)"/g;
  for (const m of t.matchAll(re)) {
    if (!need.includes(m[1]) || table[m[1]]) continue;
    // 既有表是 JS 字符串字面量（含 \" \\ 转义）——按 JSON 字符串一次性还原
    let val;
    try {
      val = JSON.parse('"' + m[2] + '"');
    } catch {
      val = m[2].replace(/\\"/g, '"');
    }
    table[m[1]] = val;
  }
}

// 缺口补 lucide 路径（lucide-static 0.5x；与 Obsidian asar 内置表同源）
const FALLBACK = {
  'pen-line':
    '<path d="M12 20h9" /> <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />',
  'calendar':
    '<path d="M8 2v4" /> <path d="M16 2v4" /> <rect width="18" height="18" x="3" y="4" rx="2" /> <path d="M3 10h18" />',
  'chevron-left': '<path d="m15 18-6-6 6-6" />',
  'chevron-right': '<path d="m9 18 6-6-6-6" />',
  'image':
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /> <circle cx="9" cy="9" r="2" /> <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',
  'video-off':
    '<path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.24-3.14A.5.5 0 0 1 22 7.78v8.44a.5.5 0 0 1-.5.5.5.5 0 0 1-.24-.08L16 13.5" /> <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h.34" /> <path d="m2 2 20 20" />',
  'music':
    '<path d="M9 18V5l12-2v13" /> <circle cx="6" cy="18" r="3" /> <circle cx="18" cy="16" r="3" />',
  'play': '<polygon points="6 3 20 12 6 21 6 3" />',
  'external-link':
    '<path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />',
  'copy':
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
  'paperclip':
    '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />',
  'tags':
    '<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19" /> <path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z" /> <circle cx="6.5" cy="9.5" r=".5" fill="currentColor" />',
  'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 10 0v4" />',
  'lock-open':
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 9.9-1" />',
  'trash-2':
    '<path d="M3 6h18" /> <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /> <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /> <line x1="10" x2="10" y1="11" y2="17" /> <line x1="14" x2="14" y1="11" y2="17" />',
  'history':
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" /> <path d="M12 7v5l4 2" />',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /> <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />',
};
for (const [k, v] of Object.entries(FALLBACK)) {
  if (!table[k]) table[k] = v;
}

const missing = need.filter((n) => !table[n]);
const out =
  '// 自动生成（issue 256）：既有域图标表并集抽取 + 墙专属缺口补 lucide 路径。\n' +
  '// 手改无效，重跑 node scripts/_gen-diary-icons.mjs 覆盖。加载顺序：本文件先于 prototype-behavior.js。\n' +
  'window.DIARY_ICONS = ' + JSON.stringify(table, null, 2) + ';\n';
fs.mkdirSync('prototypes/diary', { recursive: true });
fs.writeFileSync('prototypes/diary/prototype-icons.js', out);
console.log('written', Object.keys(table).length, 'icons; missing:', missing.join(',') || '(none)');
