/**
 * 更新日志生成器（issue 472 立、issue 474 改为产出自包含 HTML）：从 git 提交历史生成
 * manual/bz-changelog.html，并把最新版本号回写 manifest.json（版本事实源 = 提交历史 + 本文件合成规则）。
 *
 * 产物去向：更新日志不随插件构建打包（旧产物 src/settings-panel/changelog-data.ts 已退役），
 * 由插件在用户点「更新日志」时从 GitHub 现场下载（core/changelog.ts + settings-panel/changelog.ts
 * 的 iframe srcdoc 弹窗）——与使用手册（manual/bz-manual.html）同一套口径。
 *
 * 版本合成规则：
 *   - 版本切点 = 「主构建部署产物」提交日（部署即发版）；该约定（2026-09-08）之前按自然周归并；
 *   - 版本号前向合成：首个版本 v1.0.0（插件诞生周）；此后每个版本块含 feat → 次版本 +1（修订归 0），
 *     仅 fix/perf → 修订 +1（判定用原始提交类型，不受内容过滤影响）；
 *   - 最新版本写回 manifest.json。
 *
 * 内容口径（给用户看，不是给程序员看）：
 *   - 只收 feat/fix/perf 非 merge 提交；scope→域映射 + 关键词兜底（域降级为条目上的标签）；
 *   - 主题句 = 「——」前的部分，其后的细节作弱化副行（过长截断）；剥 issue/ticket/ADR/呈报 尾注与 emoji；
 *   - 内部工程条目过滤（评审/走查/收口/测试/守卫/契约/基准/单源/重构…）；块内按主题句去重。
 * 重跑：`pnpm changelog`（仓库根执行，**只在主仓库跑**——worktree 里跑会生成残缺版本）。
 * 只写 manual/bz-changelog.html 与 manifest.json。
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/* ==================== 域映射（对齐设置面板 DOMAINS id） ==================== */

const SCOPE2DOMAIN = {
  global: 'global', general: 'global', settings: 'global',
  'settings-panel': 'settings-panel', appearance: 'settings-panel', sp: 'settings-panel',
  notice: 'notice', ai: 'ai',
  diary: 'diary', 'diary-wall': 'diary',
  memo: 'memo', belongings: 'belongings',
  people: 'people', person: 'people', tools: 'people',
  clipbook: 'clipping', clipping: 'clipping', news: 'clipping', rss: 'clipping', up: 'clipping',
  favorites: 'favorites', fav: 'favorites',
  'reading-report': 'reading-report',
  cinema: 'cinema', bookshelf: 'bookshelf', book: 'bookshelf',
  gameshelf: 'gameshelf', steam: 'gameshelf',
  review: 'review', secondbrain: 'secondbrain',
  'auto-summary': 'auto-summary', summary: 'auto-summary', digest: 'auto-summary',
  home: 'home', pomodoro: 'pomodoro', attach: 'attach',
  encrypt: 'encrypt', safe: 'encrypt',
  'password-vault': 'password-vault', vault: 'password-vault',
  smartcat: 'smartcat', knowledge: 'knowledge', literature: 'knowledge',
  core: 'core', ui: 'ui', components: 'ui', styles: 'ui',
  checkup: 'checkup',
};
const KEYWORDS = [
  [/\b(people|脸谱|画像|聊天仓|微信)/i, 'people'],
  [/(剪藏|clipbook|clipping|rss|未读流|聚合讯)/i, 'clipping'],
  [/(日记|diary)/i, 'diary'], [/(备忘录|memo)/i, 'memo'],
  [/(归物|belongings)/i, 'belongings'], [/(影院|cinema|影视)/i, 'cinema'],
  [/(书库|bookshelf|epub)/i, 'bookshelf'], [/(游戏库|gameshelf|steam)/i, 'gameshelf'],
  [/(复习|做题|间隔重复)/i, 'review'], [/(第二大脑|secondbrain|向量|rerank|嵌入)/i, 'secondbrain'],
  [/(番茄|pomodoro)/i, 'pomodoro'], [/(保险库|加密|encrypt|safe)/i, 'encrypt'],
  [/(密码本|password-vault)/i, 'password-vault'], [/(小橘|smartcat|陪伴猫)/i, 'smartcat'],
  [/(知识盒|knowledge|文献)/i, 'knowledge'], [/(收藏|favorites)/i, 'favorites'],
  [/(首页|home)/i, 'home'], [/(摘要|summary)/i, 'auto-summary'],
  [/(阅读报告|reading-report)/i, 'reading-report'], [/(附件|attach)/i, 'attach'],
  [/(体检|checkup)/i, 'checkup'], [/(通知|notice)/i, 'notice'],
  [/(设置|settings|面板)/i, 'settings-panel'], [/(AI|模型|deepseek)/i, 'ai'],
];
const DOMAIN_NAMES = {
  global: '通用', notice: '通知', ai: '人工智能', 'settings-panel': '设置面板',
  diary: '日记本', memo: '备忘录', belongings: '归物本', people: '脸谱',
  clipping: '剪藏本', favorites: '收藏本', 'reading-report': '阅读报告',
  cinema: '影院', bookshelf: '书库', gameshelf: '游戏库', review: '复习计划',
  secondbrain: '第二大脑', 'auto-summary': '自动摘要', knowledge: '知识盒',
  home: '首页', pomodoro: '番茄钟', smartcat: '小橘陪伴猫', attach: '附件搬移',
  encrypt: '保险库', 'password-vault': '密码本',
  core: '核心', ui: '界面', checkup: '数据体检', other: '其他',
};

/* ==================== 内容改写（用户视角） ==================== */

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;
// 尾注（issue/ticket/ADR/呈报/原型/自检…）——反复剥到剥不动
const TAIL_PAREN_RE = /\s*[（(]((?:issue|ticket|adr|呈报|rc|快速原型|原型|自检|selftest|#)\b[^）)]*)[）)]\s*$/i;
// 角色开头（内部工程动作）→ 整条丢弃
const ROLE_START_RE = /^(评审|走查|深审|收口|收编|守卫|测试|基准|契约|回归|对齐|对账|合并交叉|合并冲突|补\s*\d|补测|补登|样式聚合|清单|文档|构建|部署|合并|冲突切分|同皮|生命周期|同步门禁|lint|docs|test|chore|\d+\s)/i;
// 强内部标记（正文出现即丢）
const STRONG_INTERNAL_RE = /(单测|单源|mock|fake|行尾|指纹|白名单|重构|门禁|tsconfig|esbuild|eslint|vitest|CRLF|渲染纯层|upsert|内容哈希|回归测试|基线|sp-contract)/i;
const DETAIL_MAX = 78;
// 符号清理（用户要求：一句话，分隔只用逗号）——加号/箭头/斜杠/间隔点/竖线/顿号一律转逗号
const SYMBOL_COMMA_RE = /[+＋→←↔⇄\/／·•｜|、]/g;
function toSentence(s) {
  return s.replace(SYMBOL_COMMA_RE, '，').replace(/\s*，\s*/g, '，').replace(/，{2,}/g, '，').replace(/^，+|，+$/g, '').trim();
}

function cleanTail(t) {
  let prev;
  do { prev = t; t = t.replace(TAIL_PAREN_RE, ''); } while (t !== prev);
  return t.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

/** 提交主题 → { text 主题句, sub 弱化副行（可空） } 或 null（内部条目） */
function rewrite(subject) {
  let t = subject
    .replace(/^(issue|ticket)\s*\d+\s*[-—:：]?\s*/i, '')
    .replace(/^评审\s*\d+\s*/, '')
    .replace(/^\/+\d+\s*/, '') // 早期「/17 完成」式序号残留
    .replace(/\s+/g, ' ')
    .trim();
  // 中置括号引用（（ticket 150）/（issue 448 反馈）/（用户反馈，ticket 60 后续））——用户不关心出处
  t = t.replace(/[（(][^）)]*(?:issue|ticket)\s*\d+[^）)]*[）)]/gi, '');
  // 早期提交的「（N 测试全绿）/，N 新测试」式测试计数（用户不关心）
  t = t
    .replace(/[（(][^）)]*\d+\s*新?测试[^）)]*[）)]/g, '')
    .replace(/[，,]?\s*\d+\s*新?测试[^，。]*$/, '');
  t = cleanTail(t);
  const dash = t.indexOf('——');
  let text = t, sub = '';
  if (dash > 0) {
    text = t.slice(0, dash).trim();
    sub = cleanTail(t.slice(dash + 2));
  }
  text = toSentence(text);
  sub = toSentence(sub);
  if (text.length > 42) text = text.slice(0, 41) + '…';
  if (!ROLE_START_RE.test(text) && !STRONG_INTERNAL_RE.test(text) && text.length >= 4) {
    if (sub && (STRONG_INTERNAL_RE.test(sub) || sub.length < 6)) sub = '';
    if (sub && /(测试|断言|字面量|恒真|收口|清账)/.test(sub)) sub = ''; // 副行残留开发措辞 → 清空副行保留主题句
    if (sub.length > DETAIL_MAX) sub = sub.slice(0, DETAIL_MAX - 1) + '…';
    // 兜底：纯工程动作标题（收口/整改）或清洗后仍带测试计数/裸 issue·ticket 的是开发汇报条目，整条丢弃
    if (!/收口|整改/.test(text) && !/(\bticket\b|\bissue\b|\d+\s*新?测试|测试全绿|测试全过)/i.test(text + ' ' + sub)) {
      return { text, sub };
    }
  }
  return null;
}

/* ==================== 收集提交与版本切点 ==================== */

const raw = execSync('git log --no-merges --format=%ad%x09%s --date=short', {
  cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8',
});

const commits = [];   // { date, type, text(原始正文), domain }
const deployDays = new Set();
for (const line of raw.split('\n')) {
  if (!line) continue;
  const i = line.indexOf('\t');
  const date = line.slice(0, i);
  const subject = line.slice(i + 1);
  if (/主构建部署产物/.test(subject)) { deployDays.add(date); continue; }
  const m = subject.match(/^([a-z]+)(?:\(([^)]*)\))?!?:\s*(.*)$/);
  if (!m || !['feat', 'fix', 'perf'].includes(m[1])) continue;
  const text = m[3];
  if (text.length < 8) continue;
  const scope = (m[2] || '').toLowerCase();
  let domain = SCOPE2DOMAIN[scope];
  if (!domain) {
    domain = 'other';
    for (const [re, d] of KEYWORDS) {
      if (re.test(text) || (scope && re.test(scope))) { domain = d; break; }
    }
  }
  commits.push({ date, type: m[1], text, domain });
}

/** 归并键：部署约定日前按自然周（周一），之后按部署日；晚于最后一次部署 → 生成日 */
function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7; // 周一=0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
const deploySorted = [...deployDays].sort();
const firstDeployDay = deploySorted[0];
const lastDeployDay = deploySorted[deploySorted.length - 1];
const generatedAt = new Date().toISOString().slice(0, 10);

function shipKey(date) {
  if (deployDays.has(date)) return date;
  if (firstDeployDay && date > lastDeployDay) return generatedAt;
  if (firstDeployDay && date > firstDeployDay) {
    const days = deploySorted.filter((x) => x <= date);
    return days[days.length - 1];
  }
  return mondayOf(date); // 部署约定前的史前史按周
}

// 版本块（键有序）+ 原始类型收集（版本升降判定用，不受内容过滤影响）
const buckets = new Map(); // key → { types:Set, items:{added:[],fixed:[],improved:[]} }
for (const c of commits) {
  const key = shipKey(c.date);
  if (!buckets.has(key)) buckets.set(key, { types: new Set(), items: { added: [], fixed: [], improved: [] } });
  const b = buckets.get(key);
  b.types.add(c.type);
  const r = rewrite(c.text);
  if (!r) continue;
  const sec = c.type === 'feat' ? 'added' : c.type === 'fix' ? 'fixed' : 'improved';
  b.items[sec].push({ domain: c.domain, ...r });
}

/* ==================== 版本合成 + 去重截断 ==================== */

const CAPS = { added: 14, fixed: 12, improved: 8 };
const keys = [...buckets.keys()].sort();
const releases = [];
let major = 1, minor = 0, patch = 0;
keys.forEach((key, idx) => {
  const b = buckets.get(key);
  if (idx > 0) {
    if (b.types.has('feat')) { minor += 1; patch = 0; } else { patch += 1; }
  }
  const dedup = (arr, cap) => {
    const seen = new Set();
    const out = [];
    for (const it of arr) {
      if (seen.has(it.text)) continue;
      seen.add(it.text);
      out.push(it);
      if (out.length >= cap) break;
    }
    return out;
  };
  const items = {
    added: dedup(b.items.added, CAPS.added),
    fixed: dedup(b.items.fixed, CAPS.fixed),
    improved: dedup(b.items.improved, CAPS.improved),
  };
  const count = items.added.length + items.fixed.length + items.improved.length;
  if (!count) return; // 全是内部条目的版本块不展示（版本链照常推进）
  releases.push({ version: `${major}.${minor}.${patch}`, date: key, current: false, ...items });
});
if (releases.length) releases[releases.length - 1].current = true;
const current = releases.length ? releases[releases.length - 1].version : '1.0.0';

/* ==================== manifest.json 版本回写 ==================== */

const manifestPath = join(ROOT, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let manifestSynced = false;
if (manifest.version !== current) {
  manifest.version = current;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  manifestSynced = true;
}

/* ==================== 产出单文件 HTML（issue 474） ====================
 * 更新日志不再随构建打进 main.js（旧产物 changelog-data.ts 已退役）：改为发布
 * manual/bz-changelog.html——单文件自包含（样式 + 数据 + 脚本全内联），由插件在
 * 用户点「更新日志」时从 GitHub 现场下载，弹窗用 iframe srcdoc 内嵌渲染。
 * 与使用手册（manual/bz-manual.html）同一套口径与同一套 token。
 * ==================================================================== */

/** HTML 文本转义（title/属性位；正文数据走 JSON.stringify 无需转义） */
const htmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let shown = 0;
for (const r of releases) for (const sec of ['added', 'fixed', 'improved']) shown += r[sec].length;

const payload = JSON.stringify({
  current,
  generatedAt,
  domainNames: DOMAIN_NAMES,
  releases: releases.map((r) => ({
    version: r.version, date: r.date, current: r.current,
    added: r.added, fixed: r.fixed, improved: r.improved,
  })),
}).replace(/<\//g, '<\\/'); // 防数据里出现 </script> 提前闭合

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>更新日志</title>
<style>
:root{--sp-bg:#f6f2e9;--sp-panel:#fffcf6;--sp-line:#e5dfcf;--sp-line-soft:#f2eee1;--sp-ink:#2c2924;
--sp-ink-2:#7a7466;--sp-ink-3:#aca595;--sp-accent:#c95a28;--sp-accent-soft:#f7e8dd;--sp-on-accent:#fff;
--sp-radius:12px;--sp-code:#f7f3ea;}
.theme-dark{--sp-bg:#1b1b1f;--sp-panel:#242429;--sp-line:#35353c;--sp-line-soft:#2c2c32;--sp-ink:#e8e8ec;
--sp-ink-2:#a2a2ac;--sp-ink-3:#6a6a74;--sp-accent:#eda75c;--sp-accent-soft:rgba(237,167,92,.14);
--sp-on-accent:#1b1b1f;--sp-code:#1f1f24;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:var(--sp-bg);color:var(--sp-ink);font:14px/1.6 system-ui,'Segoe UI','Microsoft YaHei',sans-serif}
*{scrollbar-width:none}*::-webkit-scrollbar{display:none}
.cg{display:flex;flex-direction:column;height:100%}
.cg-bar{flex:none;display:flex;align-items:center;gap:12px;height:48px;padding:0 18px;background:var(--sp-panel);
border-bottom:1px solid var(--sp-line)}
.cg-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px}
.cg-title svg{width:17px;height:17px;color:var(--sp-accent)}
.cg-spacer{flex:1}
.cg-body{flex:1;display:flex;min-height:0}
.cg-side{width:196px;flex:none;overflow-y:auto;padding:10px 8px 24px;background:var(--sp-panel);
border-right:1px solid var(--sp-line);display:flex;flex-direction:column;gap:2px}
.cg-nav{width:100%;display:flex;align-items:center;gap:7px;padding:6px 10px;border:0;border-radius:9px;
background:none;font:inherit;font-size:12.5px;color:var(--sp-ink);cursor:pointer;text-align:left}
.cg-nav:hover{background:var(--sp-accent-soft)}
.cg-nav.on{background:var(--sp-accent);color:var(--sp-on-accent)}
.cg-nav .v{font-weight:600;font-variant-numeric:tabular-nums;flex:none}
.cg-nav .cur{font-size:10px;line-height:1;padding:3px 5px;border-radius:999px;background:var(--sp-accent-soft);
color:var(--sp-accent);flex:none}
.cg-nav.on .cur{background:rgba(255,255,255,.25);color:inherit}
.theme-dark .cg-nav.on .cur{background:rgba(27,27,31,.25)}
.cg-nav .d{margin-left:auto;font-size:11px;color:var(--sp-ink-3);font-variant-numeric:tabular-nums}
.cg-nav.on .d{color:inherit;opacity:.8}
.cg-main{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--sp-bg)}
.cg-page{flex:1;overflow-y:auto;padding:24px 30px 60px}
.cg-rel-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px}
.cg-rel-ver{font-size:21px;font-weight:700;font-variant-numeric:tabular-nums}
.cg-rel-cur{font-size:11px;padding:3px 8px;border-radius:999px;background:var(--sp-accent-soft);color:var(--sp-accent)}
.cg-rel-date{font-size:11.5px;color:var(--sp-ink-3);font-variant-numeric:tabular-nums}
.cg-blk{margin-top:20px}
.cg-blk-t{font-size:12px;font-weight:600;letter-spacing:.04em;padding-bottom:7px;border-bottom:1px solid var(--sp-line);
margin-bottom:2px}
.cg-blk-t--pri{color:var(--sp-accent)}
.cg-blk-t--sec{color:var(--sp-ink-2)}
/* 条目：域名标签固定宽 + 右对齐，后面描述文字从同一条竖线起（用户要求对齐） */
.cg-it{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--sp-line-soft)}
.cg-it:last-child{border-bottom:0}
.cg-dom{flex:none;width:76px;text-align:right;font-size:11.5px;line-height:1.55;
color:var(--sp-ink-2);white-space:nowrap}
.cg-it--pri .cg-dom{color:var(--sp-accent)}
.cg-txt{flex:1;min-width:0;font-size:12.5px;line-height:1.55;color:var(--sp-ink)}
.cg-it--sec .cg-txt{font-size:12px;color:var(--sp-ink-2)}
.cg-sub{font-size:11.5px;color:var(--sp-ink-3);margin-top:2px;line-height:1.5}
.cg-empty{padding:20px 0;color:var(--sp-ink-3);font-size:12.5px}
@media (max-width:768px){
.cg-body{flex-direction:column}
.cg-side{width:100%;flex:none;flex-direction:row;overflow-x:auto;overflow-y:hidden;gap:6px;
padding:8px;border-right:0;border-bottom:1px solid var(--sp-line)}
.cg-nav{width:auto;flex:none}
.cg-nav .d{display:none}
.cg-page{padding:16px 14px 40px}
/* 窄屏收窄域名列，避免挤掉描述文字 */
.cg-dom{width:62px;font-size:11px}
}
</style>
</head>
<body>
<div class="cg">
  <div class="cg-bar">
    <div class="cg-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
      <path d="M12 7v5l3 2"/></svg>
      更新日志</div>
    <span class="cg-spacer"></span>
  </div>
  <div class="cg-body">
    <aside class="cg-side" id="side"></aside>
    <main class="cg-main"><div class="cg-page" id="page"></div></main>
  </div>
</div>
<script>
const DATA = ${payload};
const DOMAIN_NAMES = DATA.domainNames;
const SECTIONS = [
  { key: 'added', label: '新功能', tier: 'pri' },
  { key: 'fixed', label: '问题修复', tier: 'sec' },
  { key: 'improved', label: '体验优化', tier: 'sec' }
];
const RAIL = DATA.releases.slice().reverse();
const BY_VER = {};
for (const r of DATA.releases) BY_VER[r.version] = r;
let cur = DATA.current;
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function renderRail(){
  let h = '';
  for (const r of RAIL){
    h += '<button class="cg-nav' + (r.version === cur ? ' on' : '') + '" data-v="' + esc(r.version) + '">' +
      '<span class="v">v' + esc(r.version) + '</span>' +
      (r.current ? '<span class="cur">当前</span>' : '') +
      '<span class="d">' + esc(r.date.slice(5)) + '</span></button>';
  }
  const side = document.getElementById('side');
  side.innerHTML = h;
  side.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { cur = b.dataset.v; render(); });
}
function renderPage(){
  const r = BY_VER[cur];
  const page = document.getElementById('page');
  if (!r){ page.innerHTML = '<div class="cg-empty">没有这一版</div>'; return; }
  let h = '<div class="cg-rel-head"><span class="cg-rel-ver">v' + esc(r.version) + '</span>' +
    (r.current ? '<span class="cg-rel-cur">当前版本</span>' : '') +
    '<span class="cg-rel-date">' + esc(r.date) + '</span></div>';
  for (const s of SECTIONS){
    const items = r[s.key];
    if (!items.length) continue;
    h += '<div class="cg-blk"><div class="cg-blk-t cg-blk-t--' + s.tier + '">' + s.label + '</div>';
    for (const it of items){
      const dom = DOMAIN_NAMES[it.domain] || it.domain;
      h += '<div class="cg-it cg-it--' + s.tier + '"><span class="cg-dom">' + esc(dom) + '</span>' +
        '<div class="cg-txt">' + esc(it.text) +
        (it.sub ? '<div class="cg-sub">' + esc(it.sub) + '</div>' : '') + '</div></div>';
    }
    h += '</div>';
  }
  page.innerHTML = h;
  page.scrollTop = 0;
}
function render(){ renderRail(); renderPage(); }
document.addEventListener('DOMContentLoaded', () => {
  try { if (localStorage.getItem('bz-changelog-theme') === 'dark') document.documentElement.classList.add('theme-dark'); } catch(_){}
  render();
});
</script>
</body>
</html>
`;

writeFileSync(join(ROOT, 'manual', 'bz-changelog.html'), html, 'utf8');
console.log(`版本数=${releases.length} 条目=${shown} 当前=${current}${manifestSynced ? '（manifest 已回写）' : ''}`);
console.log(`产出 manual/bz-changelog.html（${(Buffer.byteLength(html) / 1024).toFixed(1)}KB）`);
console.log(releases.slice(-6).map((r) => `v${r.version}(${r.date}): +${r.added.length} !${r.fixed.length} ^${r.improved.length}`).join('  '));
