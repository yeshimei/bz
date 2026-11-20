import { beforeEach, describe, expect, it } from 'vitest';
import {
  BZR_CACHE_KEY,
  BZR_CACHE_VERSION,
  _resetBzrDataForTests,
  _setBzrHttpForTests,
  currentBzrData,
  parseBzrData,
  refreshBzrData,
  safeFeedbackUrl,
} from '../../src/core/bzr-data';

/* ============================================================
 * 在线配置（更新日志 / 路线图 / 统计 / 跳转地址）的数据层
 *
 * 和感谢名单同一套：双源并发、本机缓存、坏数据不覆盖好数据。
 * 这一份测「远端内容不可信」那一面 + 链接白名单，网络本身不测（可注入）。
 * ============================================================ */

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  get length(): number { return this.m.size; }
}
const g = globalThis as unknown as Record<string, unknown>;
let calls: string[] = [];
function setHttp(fn: (url: string) => Promise<string | null> | string | null): void {
  calls = [];
  _setBzrHttpForTests(async (url) => { calls.push(url); return await fn(url); });
}

const GOOD = {
  version: 1,
  updatedAt: '2026-11-18',
  changelog: [
    { version: '1.5.2', date: '2026-11-17', improved: [
      { domain: { zh: '设置页', en: 'Settings' }, text: { zh: '分组', en: 'Groups' }, issue: 2 },
    ] },
  ],
  roadmap: [
    { theme: 'AI 能力', color: '#2f9e6e', order: 1, items: [
      { title: '多轮追问', state: 'doing', src: 'builtin', fb: { kind: 'issue', n: 12, label: '#12' } },
    ] },
  ],
  stats: { reward: 456, pro: 1286, patrons: 328 },
  links: {
    support: 'https://afdian.net/a/yeshimei',
    buy: 'https://afdian.net/a/yeshimei?plan=pro',
  },
};
const doc = (over: Record<string, unknown> = {}) => JSON.stringify({ ...GOOD, ...over });

beforeEach(() => {
  /* bz 主仓 vitest 带 jsdom：window.localStorage 是只读 getter，不能整体替换，
     清掉现成的即可（bz-reader 那边是 node 环境才用 MemoryStorage）。 */
  try { window.localStorage.clear(); } catch { /* 无 jsdom 时忽略 */ }
  _resetBzrDataForTests();
  _setBzrHttpForTests(null);
  calls = [];
});

describe('解析 · 一份远端 JSON 能变成什么', () => {
  it('合法文档：五块数据都在，issue 字段保留', () => {
    const d = parseBzrData(doc());
    expect(d).not.toBeNull();
    expect(d!.changelog[0]!.version).toBe('1.5.2');
    expect(d!.changelog[0]!.improved![0]!.issue).toBe(2);
    expect(d!.roadmap[0]!.items[0]!.fb.label).toBe('#12');
    expect(d!.stats.pro).toBe(1286);
    expect(d!.links.buy).toContain('afdian.net');
  });

  it('路线图只展现自己的：reader 的条目不进 bz，未标注的旧条目照收（发版前置 review 第 4 条）', () => {
    const d = parseBzrData(doc({ roadmap: [
      { theme: '混合', color: '#fff', order: 1, items: [
        { title: 'bz 自己的', state: 'doing', src: 'builtin', plugin: 'bz', fb: { kind: 'issue', n: 1, label: '#1' } },
        { title: 'reader 的', state: 'plan', src: 'builtin', plugin: 'reader', fb: { kind: 'issue', n: 2, label: '#2' } },
        { title: '老条目没标记', state: 'done', src: 'builtin', fb: { kind: 'issue', n: 3, label: '#3' } },
      ] },
      { theme: '全是 reader', color: '#fff', order: 2, items: [
        { title: 'PDF 重排', state: 'plan', src: 'builtin', plugin: 'reader', fb: { kind: 'issue', n: 4, label: '#4' } },
      ] },
    ] }));
    expect(d!.roadmap).toHaveLength(1);
    expect(d!.roadmap[0]!.theme).toBe('混合');
    expect(d!.roadmap[0]!.items.map((i) => i.title)).toEqual(['bz 自己的', '老条目没标记']);
  });

  it('顶层不对（不是对象 / 缺字段 / JSON 坏）→ null', () => {
    expect(parseBzrData('not json')).toBeNull();
    expect(parseBzrData('null')).toBeNull();
    expect(parseBzrData(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it('坏条目丢条目，好条目留着；整份全坏 = null', () => {
    const d = parseBzrData(doc({ roadmap: [
      { theme: '好主题', color: '#fff', order: 1, items: [
        { title: '好条目', state: 'doing', src: 'builtin', fb: { kind: 'issue', n: 1, label: '#1' } },
        { title: '', state: 'doing', src: 'builtin', fb: {} },
        { title: '坏状态', state: 'wat', src: 'builtin', fb: {} },
      ] },
      { theme: '', items: [] },
    ] }));
    expect(d!.roadmap).toHaveLength(1);
    expect(d!.roadmap[0]!.items).toHaveLength(1);
    /* 路线图坏光只是「没有路线图」，不该把整份日志一起作废 */
    expect(parseBzrData(doc({ roadmap: [{ theme: 'x', items: [{ title: '' }] }] }))!.roadmap).toEqual([]);
  });

  it('路线图可以是空的（作者把演示数据删了），日志与链接照旧可用', () => {
    const d = parseBzrData(doc({ roadmap: [] }));
    expect(d).not.toBeNull();
    expect(d!.roadmap).toEqual([]);
    expect(d!.changelog).toHaveLength(1);
  });

  it('数字统计：非数字 / 负数 / 离谱值丢掉退回 0；统计全坏也不连累日志', () => {
    const d = parseBzrData(doc({ stats: { reward: 1, pro: -1, patrons: '328' } }));
    expect(d!.stats.pro).toBe(0);
    expect(d!.stats.patrons).toBe(0);
    /* 统计只是附加信息，坏掉不能让整份日志与路线图一起消失 */
    expect(parseBzrData(doc({ stats: { reward: null, pro: null } }))!.stats.pro).toBe(0);
  });

  it('更新日志条目缺中英任一语言 → 丢那条；整版全坏 → null', () => {
    const d = parseBzrData(doc({ changelog: [{ version: '1.5.2', added: [
      { domain: { zh: '好', en: 'ok' }, text: { zh: '好', en: 'ok' } },
      { domain: { zh: '缺英文', en: '' }, text: { zh: 'x', en: 'x' } },
    ] }] }));
    expect(d!.changelog[0]!.added).toHaveLength(1);
    expect(parseBzrData(doc({ changelog: [{ version: 'x', added: [] }] }))).toBeNull();
  });
});

describe('用户反馈：两组、两态、坏条目', () => {
  const withFeedback = (feedback: unknown) => parseBzrData(doc({ feedback }));

  it('两组固定存在，按提交日期倒序，doneAt 保留', () => {
    const d = withFeedback([
      { key: 'feature', items: [
        { id: 'a', source: 'github-issue', summary: 's1', title: 't1', desc: 'd1', href: 'https://github.com/yeshimei/bz-reader/issues/3', submittedAt: '2026-11-10', doneAt: '' },
        { id: 'b', source: 'bili-dm', summary: 's2', title: 't2', desc: '', href: '', submittedAt: '2026-11-18', doneAt: '2026-11-19' },
      ] },
      { key: 'bug', items: [] },
    ])!;
    expect(d.feedback!.map((g) => g.key)).toEqual(['bug', 'feature']);
    const feat = d.feedback!.find((g) => g.key === 'feature')!;
    expect(feat.items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(feat.items[0]!.doneAt).toBe('2026-11-19');
    expect(feat.items[1]!.href).toContain('github.com');
  });

  it('否决态：rejectedAt 保留，非法日期当没否决', () => {
    const d = withFeedback([{ key: 'feature', items: [
      { id: 'r1', source: 'github-issue', summary: 's', title: 't', desc: '', href: '', submittedAt: '2026-11-18', doneAt: '', rejectedAt: '2026-11-18' },
      { id: 'r2', source: 'qq-group', summary: 's', title: 't', desc: '', href: '', submittedAt: '2026-11-18', doneAt: '', rejectedAt: '下周' },
    ] }]);
    const items = d!.feedback!.find((g) => g.key === 'feature')!.items;
    expect(items.find((i) => i.id === 'r1')!.rejectedAt).toBe('2026-11-18');
    expect(items.find((i) => i.id === 'r2')!.rejectedAt).toBe('');
  });

  it('没有 feedback 块 → 两个空组（老 JSON 仍合法）', () => {
    const d = parseBzrData(doc())!;
    expect(d.feedback).toHaveLength(2);
    expect(d.feedback!.every((g) => g.items.length === 0)).toBe(true);
  });

  it('坏条目逐条丢掉；坏 href 置空而不是丢整条', () => {
    const d = withFeedback([{ key: 'bug', items: [
      { source: 'qq-group', summary: 's', title: 't', submittedAt: '2026-11-18' },
      { id: 'x', source: 'weibo', summary: 's', title: 't', submittedAt: '2026-11-18' },
      { id: 'y', source: 'qq-friend', summary: 's', title: 't', submittedAt: '2026/11/18' },
      { id: 'z', source: 'qq-channel', summary: '', title: 't', submittedAt: '2026-11-18' },
      { id: 'ok', source: 'qq-group', summary: 's', title: 't', submittedAt: '2026-11-18', href: 'https://evil.example.com/' },
    ] }])!;
    const bug = d.feedback!.find((g) => g.key === 'bug')!;
    expect(bug.items.map((i) => i.id)).toEqual(['ok']);
    expect(bug.items[0]!.href).toBe('');
  });
});

describe('用户反馈 v2：五态、分钟日期、提交链接', () => {
  const withFeedback = (feedback: unknown) => parseBzrData(doc({ feedback }));

  it('五态 state 字段逐值保留', () => {
    const states = ['accepted', 'rejected', 'invalid', 'done', 'doing'];
    const items = states.map((s, i) => ({
      id: `s${i}`, source: 'bili-dm', summary: 's', title: 't', desc: '',
      href: '', state: s, submittedAt: '2026-11-15 23:09', doneAt: '', rejectedAt: '',
    }));
    const d = withFeedback([{ key: 'feature', items }])!;
    expect(d.feedback!.find((g) => g.key === 'feature')!.items.map((i) => i.state))
      .toEqual(states);
  });

  it('日期精确到分钟：submittedAt / doneAt / commitDate 都保留 HH:mm', () => {
    const d = withFeedback([{ key: 'bug', items: [{
      id: 'm1', source: 'bili-dm', summary: 's', title: 't', desc: '', href: '',
      state: 'done', submittedAt: '2026-11-15 23:55', doneAt: '2026-11-16 00:45',
      rejectedAt: '', commitRepo: 'bz', commitId: '972855ed', commitDate: '2026-11-16 00:45',
    }] }])!;
    const it = d.feedback!.find((g) => g.key === 'bug')!.items[0]!;
    expect(it.submittedAt).toBe('2026-11-15 23:55');
    expect(it.doneAt).toBe('2026-11-16 00:45');
    expect(it.commitDate).toBe('2026-11-16 00:45');
    expect(it.commitId).toBe('972855ed');
    expect(it.commitRepo).toBe('bz');
  });

  it('旧数据兼容：纯日期、无 state → 按 doneAt/rejectedAt 推导', () => {
    const d = withFeedback([{ key: 'feature', items: [
      { id: 'o1', source: 'github-issue', summary: 's', title: 't', desc: '', href: '', submittedAt: '2026-11-10', doneAt: '' },
      { id: 'o2', source: 'github-issue', summary: 's', title: 't', desc: '', href: '', submittedAt: '2026-11-11', doneAt: '2026-11-12', rejectedAt: '' },
      { id: 'o3', source: 'github-issue', summary: 's', title: 't', desc: '', href: '', submittedAt: '2026-11-09', doneAt: '', rejectedAt: '2026-11-09' },
    ] }])!;
    const items = d.feedback!.find((g) => g.key === 'feature')!.items;
    expect(items.find((i) => i.id === 'o1')!.state).toBe('accepted');
    expect(items.find((i) => i.id === 'o2')!.state).toBe('done');
    expect(items.find((i) => i.id === 'o3')!.state).toBe('rejected');
    expect(items.find((i) => i.id === 'o1')!.submittedAt).toBe('2026-11-10');
  });

  it('state 优先于日期：冲突时以 state 为准', () => {
    const d = withFeedback([{ key: 'bug', items: [{
      id: 'x', source: 'bili-dm', summary: 's', title: 't', desc: '', href: '',
      state: 'invalid', submittedAt: '2026-11-15 23:09', doneAt: '2026-11-16 00:45', rejectedAt: '',
    }] }])!;
    expect(d.feedback!.find((g) => g.key === 'bug')!.items[0]!.state).toBe('invalid');
  });

  it('新字段：plugin / domain / replyDigest / verify / releaseVersion 逐项保留', () => {
    const d = withFeedback([{ key: 'bug', items: [{
      id: 'n1', source: 'bili-dm', plugin: 'bz', domain: '日记本',
      summary: 's', title: 't', desc: 'd', href: '',
      reply: '00:12「好的」', replyDigest: '作者表示会跟进。', verify: '查过代码，属实。',
      state: 'done', submittedAt: '2026-11-15 23:55', doneAt: '2026-11-16 00:45',
      rejectedAt: '', commitRepo: 'bz', commitId: '972855ed', commitDate: '2026-11-16 00:45',
      releaseVersion: '1.44.5',
    }] }])!;
    const it = d.feedback!.find((g) => g.key === 'bug')!.items[0]!;
    expect(it.plugin).toBe('bz');
    expect(it.domain).toBe('日记本');
    expect(it.replyDigest).toBe('作者表示会跟进。');
    expect(it.verify).toBe('查过代码，属实。');
    expect(it.releaseVersion).toBe('1.44.5');
  });

  it('plugin 只认 bz / bz-reader，其余置空', () => {
    const d = withFeedback([{ key: 'feature', items: [
      { id: 'p1', source: 'github-issue', plugin: 'bz-reader', domain: '字体',
        summary: 's', title: 't', desc: '', href: '', submittedAt: '2026-11-18' },
      { id: 'p2', source: 'github-issue', plugin: 'evil', domain: 'x',
        summary: 's', title: 't', desc: '', href: '', submittedAt: '2026-11-18' },
    ] }])!;
    const items = d.feedback!.find((g) => g.key === 'feature')!.items;
    expect(items.find((i) => i.id === 'p1')!.plugin).toBe('bz-reader');
    expect(items.find((i) => i.id === 'p2')!.plugin).toBe('');
  });

  it('非法 commitId 过滤；非法 state 退回 accepted', () => {
    const d = withFeedback([{ key: 'bug', items: [
      { id: 'c1', source: 'bili-dm', summary: 's', title: 't', desc: '', href: '',
        state: 'done', submittedAt: '2026-11-15 23:09', commitId: 'javascript:alert(1)', commitRepo: 'bz' },
      { id: 'c2', source: 'bili-dm', summary: 's', title: 't', desc: '', href: '',
        state: 'whatever', submittedAt: '2026-11-15 23:10' },
    ] }])!;
    const items = d.feedback!.find((g) => g.key === 'bug')!.items;
    expect(items.find((i) => i.id === 'c1')!.commitId).toBe('');
    expect(items.find((i) => i.id === 'c2')!.state).toBe('accepted');
  });
});

describe('链接白名单：远端不可信', () => {
  it('合法域名放行，未知域名 / javascript: 拒绝', () => {
    expect(safeFeedbackUrl('https://github.com/yeshimei/bz-reader/issues/3')).toContain('github.com');
    expect(safeFeedbackUrl('https://afdian.net/a/x')).toContain('afdian.net');
    /* 链动小铺是高级版 / 赞助人的购买页：不白名单 → 整份在线数据作废 */
    expect(safeFeedbackUrl('https://wzyp.cn/shop/IFCEI5I3')).toContain('wzyp.cn');
    expect(safeFeedbackUrl('https://evil.example.com/phish')).toBeNull();
    expect(safeFeedbackUrl('javascript:alert(1)')).toBeNull();
    expect(safeFeedbackUrl('http://github.com.evil.com/')).toBeNull();
  });

  it('反馈链接不在白名单 → 解析时就不渲染成可点（fb.href 为空）', () => {
    const d = parseBzrData(doc({ roadmap: [{ theme: 't', color: '#fff', order: 1, items: [
      { title: 'x', state: 'plan', src: 'builtin', fb: { kind: 'bili', label: 'B站', href: 'https://evil.example.com/' } },
    ] }] }));
    expect(d!.roadmap[0]!.items[0]!.fb.href).toBe('');
  });
});

describe('缓存与拉取', () => {
  it('无缓存时返回内置兜底（路线图不空、链接可用）', () => {
    const d = currentBzrData();
    /* 日志的兜底由 shell/changelog 的内置数据负责，这里保证链接与结构不空 */
    expect(d.roadmap.length).toBeGreaterThan(0);
    /* 2026-11-18 起内置兜底也指向链动小铺的商品页，不再用爱发电 */
    expect(d.links.buy).toContain('wzyp.cn/shop/IFCEI5I3');
    expect(d.links.support).toContain('wzyp.cn/shop/IFCEI5I3');
  });

  it('拉取成功 → 覆盖内存并写缓存；第二个源胜出也能用', async () => {
    setHttp((u) => u.includes('github') ? 'bad json' : doc());
    expect(await refreshBzrData({ force: true })).toBe(true);
    expect(currentBzrData().stats.pro).toBe(1286);
    expect((g.localStorage as Storage).getItem(BZR_CACHE_KEY)).toContain('1286');
    expect(calls).toHaveLength(2);
  });

  it('两个源都挂 → 不覆盖已有好数据', async () => {
    setHttp(() => 'broken');
    const before = currentBzrData().stats.pro;
    expect(await refreshBzrData({ force: true })).toBe(false);
    expect(currentBzrData().stats.pro).toBe(before);
  });

  it('缓存里的坏字段不影响好条目；坏缓存整份作废退回内置', () => {
    (g.localStorage as Storage).setItem(BZR_CACHE_KEY, JSON.stringify({ v: BZR_CACHE_VERSION, at: Date.now(), data: GOOD }));
    expect(currentBzrData().stats.pro).toBe(1286);
    // v 不对 → 忽略（升版本就是为了让旧缓存当场作废）
    (g.localStorage as Storage).setItem(BZR_CACHE_KEY, JSON.stringify({ v: BZR_CACHE_VERSION + 1, at: Date.now(), data: GOOD }));
    _resetBzrDataForTests();
    expect(currentBzrData().stats.pro).not.toBe(1286);
  });
});
