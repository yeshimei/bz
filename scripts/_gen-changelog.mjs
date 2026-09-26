/**
 * 更新日志生成器（issue 472 v2）：从 git 提交历史生成 src/settings-panel/changelog-data.ts，
 * 并把最新版本号回写 manifest.json（单一版本事实源 = 提交历史 + 本文件的合成规则）。
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
 * 重跑：`pnpm changelog`（仓库根执行）。只写 changelog-data.ts 与 manifest.json。
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
  global: '通用', notice: '通知', ai: 'AI', 'settings-panel': '设置面板',
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

/* ==================== 产出 TS ==================== */

const ts = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
let shown = 0;
let out = `/** 由 scripts/_gen-changelog.mjs 从 git 提交历史生成——勿手改；更新跑 \`pnpm changelog\`。
 *  版本：部署日（约定前按周）为切点，前向合成（首版 1.0.0，含 feat +1 次版本），最新版回写 manifest。
 *  内容：feat/fix/perf 提交的主题句 + 弱化副行；内部工程条目已过滤；域为条目标签。生成于 ${generatedAt}。
 */
export interface ChangelogItem {
  domain: string;
  text: string;
  sub?: string;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  current: boolean;
  added: ChangelogItem[];
  fixed: ChangelogItem[];
  improved: ChangelogItem[];
}

export const CHANGELOG_DOMAIN_NAMES: Readonly<Record<string, string>> = {
`;
for (const [id, name] of Object.entries(DOMAIN_NAMES)) out += `  '${id}': '${name}',\n`;
out += `};

export const CHANGELOG_META = { generatedAt: '${generatedAt}', current: '${current}', releases: ${releases.length} } as const;

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
`;
for (const r of releases) {
  const item = (it) => `      { domain: '${it.domain}', text: '${ts(it.text)}'${it.sub ? `, sub: '${ts(it.sub)}'` : ''} },\n`;
  out += `  {\n    version: '${r.version}',\n    date: '${r.date}',\n    current: ${r.current},\n`;
  for (const sec of ['added', 'fixed', 'improved']) {
    out += `    ${sec}: [\n`;
    for (const it of r[sec]) { out += item(it); shown++; }
    out += `    ],\n`;
  }
  out += `  },\n`;
}
out += `];\n`;

writeFileSync(join(ROOT, 'src', 'settings-panel', 'changelog-data.ts'), out, 'utf8');
console.log(`版本数=${releases.length} 条目=${shown} 当前=${current}${manifestSynced ? '（manifest 已回写）' : ''}`);
console.log(releases.slice(-6).map((r) => `v${r.version}(${r.date}): +${r.added.length} !${r.fixed.length} ^${r.improved.length}`).join('  '));
