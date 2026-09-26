/**
 * 更新日志生成器（issue 472）：从 git 提交历史生成 src/settings-panel/changelog-data.ts。
 * 口径（参照社区 Keep a Changelog / Conventional Commits 的分类精神，按本项目「以域为纲」落地）：
 *   - 只收 feat / fix / perf 的非 merge 提交（chore/docs/test/refactor/build 等噪音不进用户日志）；
 *   - scope → 域映射（对齐设置面板 DOMAINS id），未知 scope / 无 scope 按关键词兜底归类；
 *   - 文本归一：剥「issue NNN / ticket NNN」前缀，前 16 字符键去重（保留最新日期与较长文本）；
 *   - 域内按日期倒序。
 * 重跑：`pnpm changelog`（在仓库根执行，读当前 checkout 的 git 历史）。
 * 只写 src/settings-panel/changelog-data.ts 一个文件，其余只读。
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// scope → changelog 域 id（对齐设置面板 DOMAINS id：剪藏本 = clipping）
const SCOPE2DOMAIN = {
  global: 'settings-panel', general: 'settings-panel', settings: 'settings-panel',
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
  checkup: 'checkup', recap: 'other', todo: 'other',
  build: 'other', preview: 'other', prototypes: 'other', docs: 'other',
  test: 'other', tests: 'other', ci: 'other', proto: 'other', deps: 'other',
  tsconfig: 'other', esbuild: 'other', gates: 'other', contract: 'other',
};

// 无 scope / scope 未知时按正文关键词兜底
const KEYWORDS = [
  [/\b(people|脸谱|画像|聊天仓|微信)/i, 'people'],
  [/(剪藏|clipbook|clipping|rss|未读流|聚合讯)/i, 'clipping'],
  [/(日记|diary)/i, 'diary'],
  [/(备忘录|memo)/i, 'memo'],
  [/(归物|belongings)/i, 'belongings'],
  [/(影院|cinema|影视)/i, 'cinema'],
  [/(书库|bookshelf|epub)/i, 'bookshelf'],
  [/(游戏库|gameshelf|steam)/i, 'gameshelf'],
  [/(复习|review|做题|间隔重复)/i, 'review'],
  [/(第二大脑|secondbrain|向量|rerank|嵌入)/i, 'secondbrain'],
  [/(番茄|pomodoro)/i, 'pomodoro'],
  [/(保险库|加密|encrypt|safe)/i, 'encrypt'],
  [/(密码本|password-vault)/i, 'password-vault'],
  [/(小橘|smartcat|陪伴猫)/i, 'smartcat'],
  [/(知识盒|knowledge|文献)/i, 'knowledge'],
  [/(收藏|favorites)/i, 'favorites'],
  [/(首页|home)/i, 'home'],
  [/(摘要|summary)/i, 'auto-summary'],
  [/(阅读报告|reading-report)/i, 'reading-report'],
  [/(附件|attach)/i, 'attach'],
  [/(体检|checkup)/i, 'checkup'],
  [/(通知|notice)/i, 'notice'],
  [/(设置|settings|面板)/i, 'settings-panel'],
  [/(AI|模型|deepseek|嵌入|rerank)/i, 'ai'],
];

// 域顺序：功能域在前（同设置面板语义序），基建/横切组在后，「其他」收尾
const DOMAIN_NAME = {
  diary: '日记本', memo: '备忘录', belongings: '归物本', people: '脸谱',
  clipping: '剪藏本', favorites: '收藏本', 'reading-report': '阅读报告',
  cinema: '影院', bookshelf: '书库', gameshelf: '游戏库', review: '复习计划',
  secondbrain: '第二大脑', 'auto-summary': '自动摘要', knowledge: '知识盒',
  home: '首页', pomodoro: '番茄钟', smartcat: '小橘陪伴猫', attach: '附件搬移',
  encrypt: '保险库', 'password-vault': '密码本',
  'settings-panel': '通用与设置', notice: '通知', ai: 'AI',
  core: '共享层 core', ui: '界面通用', checkup: '数据体检', other: '其他',
};

const TYPES = new Set(['feat', 'fix', 'perf']);

const norm = (t) => t
  .replace(/^(issue|ticket)\s*\d+\s*[-—:：]?\s*/i, '')
  .replace(/^评审\s*\d+\s*/, '')
  // 剥历史提交原文带入的 emoji（bz 界面无 emoji 风格；区间与 tests 的 EMOJI_RE 同口径）
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
  .replace(/\s+/g, ' ')
  .trim();

const raw = execSync('git log --no-merges --format=%ad%x09%s --date=short', {
  cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8',
});

const buckets = new Map();
let kept = 0;
for (const line of raw.split('\n')) {
  if (!line) continue;
  const i = line.indexOf('\t');
  const date = line.slice(0, i);
  const subject = line.slice(i + 1);
  const m = subject.match(/^([a-z]+)(?:\(([^)]*)\))?!?:\s*(.*)$/);
  if (!m || !TYPES.has(m[1])) continue;
  const text = norm(m[3]);
  if (text.length < 8) continue;
  kept++;

  const scope = (m[2] || '').toLowerCase();
  let dom = SCOPE2DOMAIN[scope];
  if (!dom) {
    dom = 'other';
    for (const [re, d] of KEYWORDS) {
      if (re.test(text) || (scope && re.test(scope))) { dom = d; break; }
    }
  }
  if (!buckets.has(dom)) buckets.set(dom, new Map());
  const seen = buckets.get(dom);
  const key = text.slice(0, 16);
  const prev = seen.get(key);
  if (!prev) seen.set(key, { date, type: m[1], text });
  else {
    if (date > prev.date) prev.date = date;
    if (text.length > prev.text.length) { prev.text = text; prev.type = m[1]; }
  }
}

const order = Object.keys(DOMAIN_NAME);
const domains = [];
let total = 0;
for (const id of order) {
  const seen = buckets.get(id);
  if (!seen || !seen.size) continue;
  const entries = [...seen.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  total += entries.length;
  domains.push({ id, name: DOMAIN_NAME[id], entries });
}

const ts = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
let out = `/** 由 scripts/_gen-changelog.mjs 从 git 提交历史生成——勿手改；更新跑 \`pnpm changelog\`。
 *  口径：feat/fix/perf 非 merge 提交；scope→域映射 + 关键词兜底；剥 issue/ticket 号前缀、
 *  前 16 字符键去重；域内日期倒序。生成于 ${new Date().toISOString().slice(0, 10)}。
 */
export type ChangelogType = 'feat' | 'fix' | 'perf';

export interface ChangelogEntry {
  date: string;
  type: ChangelogType;
  text: string;
}

export interface ChangelogDomainData {
  id: string;
  name: string;
  entries: ChangelogEntry[];
}

export const CHANGELOG_META = { generatedAt: '${new Date().toISOString().slice(0, 10)}', total: ${total} } as const;

export const CHANGELOG_DOMAINS: ChangelogDomainData[] = [
`;
for (const d of domains) {
  out += `  { id: '${d.id}', name: '${d.name}', entries: [\n`;
  for (const e of d.entries) {
    out += `    { date: '${e.date}', type: '${e.type}', text: '${ts(e.text)}' },\n`;
  }
  out += `  ] },\n`;
}
out += `];\n`;

const dest = join(ROOT, 'src', 'settings-panel', 'changelog-data.ts');
writeFileSync(dest, out, 'utf8');
console.log(`域数=${domains.length} 条目=${total} → ${dest}`);
console.log(domains.map((d) => `${d.name}:${d.entries.length}`).join(' '));
