/**
 * 宿主主题桥生成器（prototype-first 宿主保真，issue 256 附带）。
 *
 * 评审壳的「宿主模拟」长期是壳内写死的一组浅色近似值——域样式 100% 消费宿主 token
 * （--background-primary / --text-normal / --interactive-accent …），于是壳内看到配色
 * 与真实 Obsidian 差距很大（强调色、字号、明暗全不对）。
 *
 * 本脚本把「宿主」还原为真实值：
 *   1. 读真实 vault 的 .obsidian/appearance.json → accentColor / baseFontSize / theme；
 *   2. 用 Obsidian 官方默认主题的变量表（app.css 同口径，见 PALETTE 注释）铺出
 *      --color-base-00…100 色阶与全部派生 token，明暗两套；
 *   3. 按 Obsidian 同款公式由 accentColor 推出 --accent-h/s/l 与 --color-accent-1/2。
 *
 * 产物 prototypes/host-theme.css 入库（与 prototype-data.js 同先例），
 * 由各域评审壳 `<link rel="stylesheet" href="../host-theme.css">` 引用。
 *
 * 用法：node scripts/fetch-host-theme.mjs [--vault <vault根>] [--light|--dark] [--with-snippets]
 *   vault 根缺省从 esbuild.config.mjs 的 VAULT_PLUGIN_DIR 反推（…/.obsidian/plugins/bz → 上三级）。
 *   --light/--dark 覆盖 appearance.json 的 theme（默认跟随 system 由壳的明暗切换决定）。
 *   --with-snippets 追加把已启用 CSS 片段原样内联（默认不内联：片段可能改版式，评审期按需开）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

// ---------- vault 定位 ----------
let vaultRoot = argOf('--vault', '');
if (!vaultRoot) {
  const cfg = fs.readFileSync(path.join(ROOT, 'esbuild.config.mjs'), 'utf8');
  const m = cfg.match(/VAULT_PLUGIN_DIR\s*=\s*"([^"]+)"/);
  if (!m) {
    console.error('esbuild.config.mjs 未找到 VAULT_PLUGIN_DIR，请用 --vault 指定 vault 根');
    process.exit(1);
  }
  vaultRoot = path.resolve(m[1], '..', '..', '..'); // <vault>/.obsidian/plugins/bz → <vault>
}

// ---------- 读 appearance.json ----------
const appearancePath = path.join(vaultRoot, '.obsidian', 'appearance.json');
let appearance = {};
try {
  appearance = JSON.parse(fs.readFileSync(appearancePath, 'utf8'));
} catch {
  console.warn(`[host-theme] 读不到 ${appearancePath}，退回 Obsidian 默认值`);
}
const accentHex = /^#[0-9a-f]{6}$/i.test(appearance.accentColor || '') ? appearance.accentColor : '#7852ee';
const baseFontSize = Number(appearance.baseFontSize) > 0 ? Number(appearance.baseFontSize) : 16;
const mode = argv.includes('--light') ? 'light' : argv.includes('--dark') ? 'dark' : appearance.theme || 'system';
const snippets = Array.isArray(appearance.enabledCssSnippets) ? appearance.enabledCssSnippets : [];

// ---------- hex → HSL（Obsidian 由 accentColor 推 --accent-h/s/l 的同口径） ----------
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
const hsl = hexToHsl(accentHex);

/* ---------- Obsidian 默认主题变量表（app.css 同口径，明暗两套 base 色阶） ----------
 * 派生 token 一律写成引用 base 色阶的表达式，与 Obsidian 自身的定义方式一致，
 * 换色阶即整体联动（也正是官方主题/社区主题的改法）。 */
const BASE = {
  light: {
    '--color-base-00': '#ffffff', '--color-base-05': '#fcfcfc', '--color-base-10': '#fafafa',
    '--color-base-20': '#f6f6f6', '--color-base-25': '#efefef', '--color-base-30': '#e4e4e4',
    '--color-base-35': '#dadada', '--color-base-40': '#bdbdbd', '--color-base-50': '#ababab',
    '--color-base-60': '#707070', '--color-base-70': '#5c5c5c', '--color-base-100': '#222222',
    '--mono-0': 'white', '--mono-100': 'black',
    '--background-secondary-alt': 'var(--color-base-05)',
    '--background-modifier-cover': 'rgba(220, 220, 220, 0.4)',
    '--background-modifier-form-field': 'var(--color-base-00)',
    '--background-modifier-box-shadow': 'rgba(0, 0, 0, 0.1)',
    '--text-accent': 'var(--color-accent)',
    '--text-selection': 'color-mix(in oklch, var(--interactive-accent) 20%, transparent)',
    '--interactive-normal': 'var(--color-base-00)',
    '--interactive-hover': 'var(--color-base-10)',
    '--interactive-accent': 'var(--color-accent-1)',
    '--interactive-accent-hover': 'var(--color-accent-2)',
    '--color-accent-1': 'hsl(calc(var(--accent-h) - 1), calc(var(--accent-s) * 1.01), calc(var(--accent-l) * 1.075))',
    '--color-accent-2': 'hsl(calc(var(--accent-h) - 3), calc(var(--accent-s) * 1.02), calc(var(--accent-l) * 1.15))',
    '--color-red': '#e93147', '--color-orange': '#ec7500', '--color-yellow': '#e0ac00',
    '--color-green': '#08b94e', '--color-cyan': '#00bfbc', '--color-blue': '#086ddd',
    '--color-purple': '#7852ee', '--color-pink': '#d53984',
    '--shadow-s': '0px 1px 2px rgba(0, 0, 0, 0.028), 0px 3.4px 6.7px rgba(0, 0, 0, 0.042), 0px 15px 30px rgba(0, 0, 0, 0.07)',
    '--shadow-l': '0px 1.8px 7.3px rgba(0, 0, 0, 0.071), 0px 6.3px 24.7px rgba(0, 0, 0, 0.112), 0px 15px 30px rgba(0, 0, 0, 0.1)',
  },
  dark: {
    '--color-base-00': '#1C1C1C', '--color-base-05': '#212121', '--color-base-10': '#232323',
    '--color-base-20': '#282828', '--color-base-25': '#2e2e2e', '--color-base-30': '#333333',
    '--color-base-35': '#3f3f3f', '--color-base-40': '#555555', '--color-base-50': '#666666',
    '--color-base-60': '#999999', '--color-base-70': '#b3b3b3', '--color-base-100': '#dadada',
    '--mono-0': 'black', '--mono-100': 'white',
    '--background-secondary-alt': 'var(--color-base-30)',
    '--background-modifier-cover': 'rgba(10, 10, 10, 0.4)',
    '--background-modifier-form-field': 'var(--color-base-25)',
    '--background-modifier-box-shadow': 'rgba(0, 0, 0, 0.3)',
    '--text-accent': 'var(--color-accent-1)',
    '--text-selection': 'color-mix(in oklch, var(--interactive-accent) 33%, transparent)',
    '--interactive-normal': 'var(--color-base-30)',
    '--interactive-hover': 'var(--color-base-35)',
    '--interactive-accent': 'var(--color-accent)',
    '--interactive-accent-hover': 'var(--color-accent-1)',
    '--color-accent-1': 'hsl(calc(var(--accent-h) - 3), calc(var(--accent-s) * 1.02), calc(var(--accent-l) * 1.15))',
    '--color-accent-2': 'hsl(calc(var(--accent-h) - 5), calc(var(--accent-s) * 1.05), calc(var(--accent-l) * 1.29))',
    '--color-red': '#fb464c', '--color-orange': '#e9973f', '--color-yellow': '#e0de71',
    '--color-green': '#44cf6e', '--color-cyan': '#53dfdd', '--color-blue': '#027aff',
    '--color-purple': '#a882ff', '--color-pink': '#fa99cd',
    '--shadow-s': '0px 1px 2px rgba(0, 0, 0, 0.121), 0px 3.4px 6.7px rgba(0, 0, 0, 0.179), 0px 15px 30px rgba(0, 0, 0, 0.3)',
    '--shadow-l': '0px 1.8px 7.3px rgba(0, 0, 0, 0.071), 0px 6.3px 24.7px rgba(0, 0, 0, 0.112), 0px 30px 90px rgba(0, 0, 0, 0.2)',
  },
};

// 与主题无关的派生 token（引用 base 色阶，明暗共用）
const SHARED = {
  '--background-primary': 'var(--color-base-00)',
  '--background-primary-alt': 'var(--color-base-10)',
  '--background-secondary': 'var(--color-base-20)',
  '--background-modifier-border': 'var(--color-base-30)',
  '--background-modifier-border-hover': 'var(--color-base-35)',
  '--background-modifier-border-focus': 'var(--color-base-40)',
  '--background-modifier-hover': 'color-mix(in oklch, var(--mono-100) 6.7%, transparent)',
  '--background-modifier-active-hover': 'color-mix(in oklch, var(--interactive-accent) 10%, transparent)',
  '--text-normal': 'var(--color-base-100)',
  '--text-muted': 'var(--color-base-70)',
  '--text-faint': 'var(--color-base-50)',
  '--text-error': 'var(--color-red)',
  '--text-success': 'var(--color-green)',
  '--text-warning': 'var(--color-orange)',
  '--text-accent-hover': 'var(--color-accent-2)',
  '--text-on-accent': 'white',
  '--text-on-accent-inverted': 'black',
  '--color-accent': 'hsl(var(--accent-h), var(--accent-s), var(--accent-l))',
};

const blk = (map, indent = '  ') =>
  Object.entries(map)
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join('\n');

// 字体：Obsidian 由 baseFontSize 推出一整套 ui 字号（默认 16 → small 13 / smaller 12 / medium 15）
const typography = `  --font-text-size: ${baseFontSize}px;
  --font-ui-smaller: calc(var(--font-text-size) - 4px);
  --font-ui-small: calc(var(--font-text-size) - 3px);
  --font-ui-medium: calc(var(--font-text-size) - 1px);
  --font-ui-large: calc(var(--font-text-size) + 2px);
  --font-default: ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif;
  --font-interface: var(--font-default);
  --font-text: var(--font-default);
  --font-monospace-default: ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, "Liberation Mono", Menlo, monospace;
  --font-monospace: var(--font-monospace-default);
  --radius-s: 4px;
  --radius-m: 8px;
  --radius-l: 12px;`;

let snippetBlock = '';
if (argv.includes('--with-snippets') && snippets.length) {
  const parts = [];
  for (const name of snippets) {
    const p = path.join(vaultRoot, '.obsidian', 'snippets', name.endsWith('.css') ? name : name + '.css');
    if (fs.existsSync(p)) parts.push(`/* ---- snippet: ${name} ---- */\n${fs.readFileSync(p, 'utf8')}`);
  }
  if (parts.length) snippetBlock = `\n/* ==================== 已启用 CSS 片段原样内联（--with-snippets） ==================== */\n${parts.join('\n\n')}\n`;
}

const css = `/* 自动生成：node scripts/fetch-host-theme.mjs —— 手改无效，重跑覆盖。
 * 宿主保真：把评审壳的宿主环境还原为真实 Obsidian。
 *   来源 vault   : ${vaultRoot}
 *   强调色       : ${accentHex} → --accent-h/s/l = ${hsl.h} / ${hsl.s}% / ${hsl.l}%
 *   基础字号     : ${baseFontSize}px（--font-ui-small 等按 Obsidian 公式联动）
 *   明暗         : appearance.theme = ${appearance.theme || '未设置'}${mode !== (appearance.theme || 'system') ? `（本次 --${mode} 覆盖）` : ''}（壳内仍有明暗切换钮）
 *   已启用片段   : ${snippets.length ? snippets.join(' / ') : '无'}
 *
 * 结构（与 Obsidian app.css 同口径）：
 *   body                → 字体/圆角 + --accent-h/s/l（强调色与明暗无关）
 *   body.theme-light    → 亮色 base 色阶 + 派生 token
 *   body.theme-dark     → 暗色 base 色阶 + 派生 token
 * 只列域样式真正消费的 token（host-fidelity 子集），不是 app.css 全量搬运。
 */

body {
${typography}
  --accent-h: ${hsl.h};
  --accent-s: ${hsl.s}%;
  --accent-l: ${hsl.l}%;
  font-family: var(--font-interface);
  font-size: var(--font-text-size);
  color: var(--text-normal);
  background-color: var(--background-primary);
}

body.theme-light {
${blk(SHARED)}
${blk(BASE.light)}
}

body.theme-dark {
${blk(SHARED)}
${blk(BASE.dark)}
}
${snippetBlock}`;

const outPath = path.join(ROOT, 'prototypes', 'host-theme.css');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, css);
console.log(
  `host-theme.css 已生成：强调色 ${accentHex}（h${hsl.h} s${hsl.s}% l${hsl.l}%）、字号基准 ${baseFontSize}px、` +
    `theme=${appearance.theme || 'unset'}${snippetBlock ? '、已内联片段' : ''}`
);
