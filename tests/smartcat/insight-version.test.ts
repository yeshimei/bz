/**
 * 洞察版本化测试（ticket 092 方向二，ADR-0039）：
 * supersede 排序前剔除 / 主题键枚举+词法回退 / reflect 集成（主题打标+supersede 写点）/
 * applySupersede 校验链（幂等/环形/pinned）/ 候选通道 token 预算 / DDID 短索引 + dashboard 人工修正。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '../../src/smartcat/memory';
import {
  INSIGHT_THEMES, THEME_KEYWORDS, MANUAL_SUPERSEDED_BY, CANDIDATE_CONFIG,
  sanitizeInsightTheme, lexicalTheme, resolveTheme,
  isSupersededInsight, supersedeCreatesCycle, applySupersede,
  buildReflectCandidates, buildInsightShortIndex,
} from '../../src/smartcat/insight-version';
import { defaultSmartCatData, getSmartcatFilePath } from '../../src/smartcat/data';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openSmartcatDashboard, closeSmartcatDashboard } from '../../src/smartcat/dashboard';
import { requestUrl } from '../mock-obsidian-entry';
import type { SmartCatData, MemoryStreamEntry } from '../../src/smartcat/types';

let data: SmartCatData;
let saver: ReturnType<typeof vi.fn<(d: SmartCatData) => Promise<void>>>;

function make(opts: { ai?: boolean } = {}): MemorySystem {
  data = defaultSmartCatData();
  saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
  resetAIProviderCache();
  if (opts.ai) setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  else setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }));
  const m = new MemorySystem({ vault: { adapter: {} } } as any, () => data, saver);
  (m as any).ollamaAvailable = false;
  return m;
}

/** 手工造 insight 条目（不走向 LLM） */
function insight(id: string, description = '', extra: Partial<MemoryStreamEntry> = {}): MemoryStreamEntry {
  const iso = new Date().toISOString();
  return { id, created: iso, lastAccessed: iso, description, importance: 0.75, type: 'insight', source: 'reflection', ...extra };
}

beforeEach(() => {
  (globalThis as any).fetch = undefined;
  vi.mocked(requestUrl).mockReset();
});

afterEach(() => {
  delete (globalThis as any).fetch;
});

describe('supersede 检索剔除（拍板路径：排序前前置 filter）', () => {
  it('已废弃洞察 retrieve 不返回，且不挤占 topN 名额（重要度再高也进不了前 10）', async () => {
    const m = make();
    for (let i = 0; i < 12; i++) await m.addObservation(`用户说：项目进展记录 ${i}`, { importance: 0.5 });
    data.memory.stream.push(insight('dead1', '用户说：旧结论已被推翻的洞察', { importance: 0.99, supersededBy: 'newer1' }));
    const results = await m.retrieve('项目');
    expect(results.length).toBe(10); // topN=10 契约不变
    expect(results.some((r) => r.id === 'dead1')).toBe(false); // 废弃者被剔除
    // 未废弃洞察照常返回
    expect(results.every((r) => r.type !== 'insight')).toBe(true);
  });

  it('未废弃洞察正常参与检索（版本化不误伤活跃洞察）', async () => {
    const m = make();
    await m.addObservation('用户说：填充观察一', { importance: 0.3 });
    await m.addObservation('用户说：填充观察二', { importance: 0.3 });
    data.memory.stream.push(insight('alive1', '用户对 TypeScript 有持续投入', {}));
    const results = await m.retrieve('TypeScript');
    expect(results.some((r) => r.id === 'alive1')).toBe(true);
  });

  it('formatMemoriesForPrompt 前置剔除已废弃洞察（第二道闸：绕过 retrieve 直传也不进 prompt）', async () => {
    const m = make();
    const text = m.formatMemoriesForPrompt([
      { id: 'o1', created: '', lastAccessed: '', description: '用户说：正常观察', importance: 0.5, type: 'observation' },
      insight('dead2', '被推翻的旧洞察原文', { supersededBy: 'newer-x' }),
      { ...insight('dead3', '另一条废弃洞察'), supersededBy: MANUAL_SUPERSEDED_BY },
    ] as MemoryStreamEntry[]);
    expect(text).toContain('正常观察');
    expect(text).not.toContain('被推翻的旧洞察原文');
    expect(text).not.toContain('另一条废弃洞察');
  });

  it('观察条目带脏 supersededBy 字段不受剔除影响（剔除只认 type=insight；旧数据容忍）', async () => {
    const m = make();
    data.memory.stream.push({ id: 'o-dirty', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '用户说：带脏字段的观察', importance: 0.9, type: 'observation', supersededBy: 'x' } as any);
    const results = await m.retrieve('脏字段');
    expect(results.length).toBe(1);
    expect(isSupersededInsight(data.memory.stream[0])).toBe(false);
  });

  it('isSupersededInsight 口径：空串/缺失/非 insight 一律 false', () => {
    expect(isSupersededInsight(insight('a', 'x', { supersededBy: '' }))).toBe(false);
    expect(isSupersededInsight(insight('b', 'x'))).toBe(false);
    expect(isSupersededInsight({ id: 'c', created: '', lastAccessed: '', description: 'x', importance: 0.5, type: 'observation', supersededBy: 'y' })).toBe(false);
    expect(isSupersededInsight(insight('d', 'x', { supersededBy: 'n' }))).toBe(true);
    expect(isSupersededInsight(null)).toBe(false);
    expect(isSupersededInsight(undefined)).toBe(false);
  });
});

describe('主题键：受限枚举校验 + 词法回退', () => {
  it('sanitizeInsightTheme 仅接受五枚举（大小写/空白敏感中文原样；未知/非字符串回 undefined）', () => {
    expect(sanitizeInsightTheme('工作')).toBe('工作');
    expect(sanitizeInsightTheme(' 兴趣 ')).toBe('兴趣');
    expect(INSIGHT_THEMES).toEqual(['工作', '兴趣', '关系', '健康', '环境']);
    expect(sanitizeInsightTheme('科技')).toBeUndefined(); // LLM 自由措辞拒绝
    expect(sanitizeInsightTheme('')).toBeUndefined();
    expect(sanitizeInsightTheme(null)).toBeUndefined();
    expect(sanitizeInsightTheme(42)).toBeUndefined();
  });

  it('lexicalTheme 词法映射：各主题关键词命中；无命中 undefined（不强标）', () => {
    expect(lexicalTheme('用户最近项目上线很忙，天天加班')).toBe('工作');
    expect(lexicalTheme('周末去爬山顺便拍了摄影')).toBe('兴趣');
    expect(lexicalTheme('和妈妈通电话聊了家人近况')).toBe('关系');
    expect(lexicalTheme('连续熬夜睡眠不足，压力很大')).toBe('健康');
    expect(lexicalTheme('这几天降温下雨，通勤变难')).toBe('环境');
    expect(lexicalTheme('一句完全不相关的话')).toBeUndefined();
    expect(lexicalTheme('')).toBeUndefined();
  });

  it('resolveTheme：LLM 枚举值优先，解析失败回退词法，两路皆空 undefined', () => {
    expect(resolveTheme('健康', '项目上线加班')).toBe('健康'); // 枚举合法 → 不看词法
    expect(resolveTheme('科技', '用户在学编程做项目')).toBe('工作'); // 非法 → 词法兜底
    expect(resolveTheme(undefined, '完全无关内容')).toBeUndefined();
    expect(resolveTheme('科技', '完全无关内容')).toBeUndefined();
  });
});

describe('reflect 集成：主题打标 + supersede 写点 + 候选通道', () => {
  async function seedTwoObservations(m: MemorySystem): Promise<void> {
    await m.addObservation('用户说：这周要考六级', { importance: 0.9 });
    await m.addObservation('用户说：每天背单词到深夜', { importance: 0.8 });
  }

  it('LLM 返回 theme 合法枚举 → 洞察落库带 theme；非法 → 词法兜底', async () => {
    const m = make({ ai: true });
    await seedTwoObservations(m);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ insights: [
          { text: '用户最近项目冲刺很忙，天天加班到深夜', evidence: [1], theme: '学习' }, // 非法枚举 → 词法兜底
          { text: '用户备考进入冲刺期', evidence: [2], theme: '工作' }, // 合法枚举（词义牵强但按契约放行）
        ] }) } }],
      }),
    }));
    (globalThis as any).fetch = fetchMock;
    await m.reflect();
    const insights = data.memory.stream.filter((x) => x.type === 'insight');
    expect(insights.length).toBe(2);
    expect(insights[0].theme).toBe('工作'); // 非法「学习」被拒 → 词法兜底（项目/加班命中）
    expect(insights[1].theme).toBe('工作'); // 合法枚举直通
  });

  it('supersede 候选编号写点：目标洞察被写 supersededBy=新洞察 id；候选块进 prompt', async () => {
    const m = make({ ai: true });
    await seedTwoObservations(m);
    data.memory.stream.push(insight('old-i1', '用户在准备英语考试'));
    let userPrompt = '';
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      userPrompt = JSON.parse((init as any).body).messages[1].content as string;
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        insights: [{ text: '用户的英语备考进入冲刺阶段', evidence: [1, 2] }],
        supersede: 1,
      }) } }] }) };
    });
    (globalThis as any).fetch = fetchMock;
    await m.reflect();
    expect(userPrompt).toContain('你既有的相关洞察'); // 候选块注入
    expect(userPrompt).toContain('C1[');
    expect(userPrompt).toContain('用户在准备英语考试'.slice(0, 10)); // 只注入描述片段
    const target = data.memory.stream.find((x) => x.id === 'old-i1')!;
    const newer = data.memory.stream.filter((x) => x.type === 'insight' && x.id !== 'old-i1')[0];
    expect(target.supersededBy).toBe(newer.id); // 被本批第一条新洞察取代
  });

  it('supersede 字符串 id 写点同样生效；最多 1 个/批次（顶层单值）', async () => {
    const m = make({ ai: true });
    await seedTwoObservations(m);
    data.memory.stream.push(insight('old-s1', '用户偏好夜间学习'));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        insights: [{ text: '用户的学习习惯集中在深夜', evidence: [1] }],
        supersede: 'old-s1',
      }) } }] }) }),
    ) as any;
    (globalThis as any).fetch = fetchMock;
    await m.reflect();
    expect(data.memory.stream.find((x) => x.id === 'old-s1')!.supersededBy).toBeTruthy();
  });

  it('pinned 保护：目标洞察人工固定后 LLM supersede 拒绝生效', async () => {
    const m = make({ ai: true });
    await seedTwoObservations(m);
    data.memory.stream.push(insight('pin1', '用户长期坚持英语学习', { pinned: true }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        insights: [{ text: '用户仍在坚持学英语', evidence: [1] }],
        supersede: 1,
      }) } }] }) }),
    ) as any;
    (globalThis as any).fetch = fetchMock;
    await m.reflect();
    const target = data.memory.stream.find((x) => x.id === 'pin1')!;
    expect(target.pinned).toBe(true);
    expect(target.supersededBy).toBeUndefined(); // 固定不被自动取代
    expect(data.memory.reflection.count).toBe(1); // 反思本体不受影响
  });

  it('候选通道异常裁剪：畸形 stream（description 缺失）不抛错、反思照常产出', async () => {
    const m = make({ ai: true });
    await seedTwoObservations(m);
    data.memory.stream.push({ id: 'bad-i', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: null as any, importance: 0.7, type: 'insight' });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ insights: [{ text: '正常结论', evidence: [1] }] }) } }] }),
    }));
    (globalThis as any).fetch = fetchMock;
    await expect(m.reflect()).resolves.not.toThrow();
    expect(data.memory.stream.some((x) => x.description === '正常结论')).toBe(true);
  });
});

describe('applySupersede 校验链（纯函数）', () => {
  it('字符串 ref 正常生效；number ref 经候选 indexMap 反解', () => {
    const s = [insight('A', '旧洞察'), insight('B', '新洞察')];
    expect(applySupersede(s, 'A', 'B')).toBe(true);
    expect(s[0].supersededBy).toBe('B');
    const s2 = [insight('C', '旧'), insight('D', '新')];
    expect(applySupersede(s2, 1, 'D', new Map([[1, 'C']]))).toBe(true);
    expect(s2[0].supersededBy).toBe('D');
  });

  it('id 不存在 / type=observation / 非法 ref → 拒绝且不改数据', () => {
    const s = [
      insight('A', '旧'),
      { id: 'obs1', created: '', lastAccessed: '', description: '观察', importance: 0.5, type: 'observation' } as MemoryStreamEntry,
      insight('B', '新'),
    ];
    expect(applySupersede(s, 'ghost', 'B')).toBe(false);       // 不存在
    expect(applySupersede(s, 'obs1', 'B')).toBe(false);        // 非 insight
    expect(applySupersede(s, 123, 'B', new Map())).toBe(false); // 编号不在 indexMap
    expect(applySupersede(s, null, 'B')).toBe(false);
    expect(s[0].supersededBy).toBeUndefined();
  });

  it('幂等：同后继重复标记 no-op 成功；异后继先到先得拒绝', () => {
    const s = [insight('A', '旧'), insight('B', '新1'), insight('E', '新2')];
    expect(applySupersede(s, 'A', 'B')).toBe(true);
    expect(applySupersede(s, 'A', 'B')).toBe(true);  // 幂等 no-op
    expect(applySupersede(s, 'A', 'E')).toBe(false); // 已被 B 取代
    expect(s[0].supersededBy).toBe('B');             // 状态不变
  });

  it('自指拒绝；环形拒绝（A→B 后再 B→A）；既有环不死循环', () => {
    // 自指
    const s0 = [insight('X', '自指')];
    expect(applySupersede(s0, 'X', 'X')).toBe(false);
    // 环形：A 已被 B 取代，再把 B 的后继写成 A → 拒绝
    const s = [insight('A', '旧'), insight('B', '新'), insight('W', '第三条')];
    s[0].supersededBy = 'B';
    expect(applySupersede(s, 'B', 'A')).toBe(false);
    expect(s[1].supersededBy).toBeUndefined();
    // 合法链：W 取代 B（B→W，无环）→ 放行
    expect(applySupersede(s, 'B', 'W')).toBe(true);
    // 既有环脏数据：visited 集防死循环
    const dirty = [insight('P'), insight('Q')];
    dirty[0].supersededBy = 'Q';
    dirty[1].supersededBy = 'P'; // P⇄Q 既有环
    expect(supersedeCreatesCycle(dirty, 'Z', 'P')).toBe(false); // 走不出 target → 判无环并终止
    expect(supersedeCreatesCycle(dirty, 'Q', 'P')).toBe(true);
  });

  it('supersedeCreatesCycle 直测：链路回达 target 即环；无关链无环', () => {
    const s = [insight('A'), insight('B'), insight('C')];
    s[0].supersededBy = 'B'; // A→B
    s[1].supersededBy = 'C'; // B→C
    expect(supersedeCreatesCycle(s, 'C', 'A')).toBe(true);  // 设 C→A：A⇝C 回达
    expect(supersedeCreatesCycle(s, 'A', 'C')).toBe(false); // 设 A→C：C 无出边
  });
});

describe('候选通道 token 预算（独立预算截断）', () => {
  it('每条只注入描述前 clipChars 字（不全文）；topN 封顶', () => {
    const stream = [
      insight('c1', '长'.repeat(100)),
      insight('c2', '短描述'),
    ];
    const res = buildReflectCandidates(stream, '', { topN: 1, clipChars: 40 });
    expect(res.count).toBe(1);
    expect(res.indexMap.get(1)).toBe('c1');
    expect(res.block).toContain('长'.repeat(40));
    expect(res.block).not.toContain('长'.repeat(41)); // 截到 40 字
    expect(res.block).not.toContain('短描述'); // topN=1 截掉第二条
  });

  it('总字符预算封顶：超预算截停（budgetChars 硬约束）', () => {
    const stream = [insight('k1', '甲'.repeat(40)), insight('k2', '乙'.repeat(40)), insight('k3', '丙'.repeat(40))];
    const res = buildReflectCandidates(stream, '', { budgetChars: 100 }); // 每行约 47 字符 → 第三行超预算
    expect(res.count).toBe(2);
    for (const line of res.block.split('\n')) {
      if (line.startsWith('C')) expect(line.length).toBeLessThanOrEqual(CANDIDATE_CONFIG.clipChars + 12);
    }
  });

  it('排序：词法重叠高者优先 + 同分新近优先；indexMap 编号与行序一致', () => {
    const oldIso = new Date(Date.now() - 86400000).toISOString();
    const stream = [
      insight('no-hit', '完全无关的内容', { created: oldIso }),
      insight('hit-weak', '提到一次TypeScript', { created: oldIso }),
      insight('hit-strong', 'TypeScript TypeScript 深度使用', {}),
    ];
    const res = buildReflectCandidates(stream, 'TypeScript 项目复盘');
    expect(res.indexMap.get(1)).toBe('hit-strong');
    expect(res.count).toBeGreaterThanOrEqual(2);
  });

  it('已废弃洞察不进候选；空流/空种子 → block 为空串', () => {
    const stream = [insight('live', '活跃洞察'), insight('gone', '废弃洞察', { supersededBy: 'live' })];
    const res = buildReflectCandidates(stream, '');
    expect(res.count).toBe(1);
    expect(res.block).toContain('活跃洞察');
    expect(res.block).not.toContain('废弃洞察');
    expect(buildReflectCandidates([], '').count).toBe(0);
    expect(buildReflectCandidates([], '').block).toBe('');
    expect(buildReflectCandidates(null as any, '').count).toBe(0); // 防御式不抛错
  });

  it('主题标注进候选行（theme 字段或词法兜底）', () => {
    const stream = [
      insight('t1', '关于加班与项目的结论', { theme: '工作' }),
      insight('t2', '熬夜睡眠不足的结论'),
    ];
    const res = buildReflectCandidates(stream, '');
    expect(res.block).toContain('[工作]');
    expect(res.block).toMatch(/C\d\[(工作|健康)\] 熬夜/); // t2 经词法兜底归「健康」
  });
});

describe('DDID 展示层短索引', () => {
  it('全量洞察按 stream 序编 1..n（含已废弃；观察不占号）', () => {
    const stream: MemoryStreamEntry[] = [
      { id: 'o1', created: '', lastAccessed: '', description: '观察', importance: 0.5, type: 'observation' },
      insight('i1', '洞察一'),
      insight('i2', '洞察二', { supersededBy: 'i1' }),
      { id: 'o2', created: '', lastAccessed: '', description: '观察二', importance: 0.5, type: 'observation' },
      insight('i3', '洞察三', { pinned: true }),
    ];
    const idx = buildInsightShortIndex(stream);
    expect(idx.get('i1')).toBe(1);
    expect(idx.get('i2')).toBe(2);
    expect(idx.get('i3')).toBe(3);
    expect(idx.has('o1')).toBe(false);
    expect(idx.size).toBe(3);
  });
});

// ---------------- dashboard UI：短索引展示 + 固定/废弃人工修正 ----------------

function uiFixture(): SmartCatData {
  const d = defaultSmartCatData();
  const iso = new Date().toISOString();
  d.memory.stream = [
    { id: 'u-o1', created: iso, lastAccessed: iso, description: '用户说：普通观察', importance: 0.6, type: 'observation', source: 'chat' },
    insight('u-i1', '洞察一（可修正）'),
    insight('u-i2', '洞察二（已固定）', { pinned: true }),
    insight('u-i3', '洞察三（人工废弃）', { supersededBy: MANUAL_SUPERSEDED_BY }),
    insight('u-i4', '洞察四（自动废弃）', { supersededBy: 'u-i1' }),
  ];
  return d;
}

function makeUi(vaultFixture: SmartCatData) {
  const vault = new MockVault();
  vault.create(getSmartcatFilePath(), JSON.stringify(vaultFixture));
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false }) as any);
  return { app, vault };
}

function storedData(vault: MockVault): SmartCatData {
  return JSON.parse(vault.files.get(getSmartcatFilePath())!);
}

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('dashboard：DDID 短索引 + 固定/废弃按钮', () => {
  afterEach(() => closeSmartcatDashboard());

  it('洞察行显示 #N 短索引与固定/废弃状态徽章（仅展示层）', async () => {
    const { app } = makeUi(uiFixture());
    await openSmartcatDashboard(app as any);
    (document.querySelector('[data-tab="memory"]') as HTMLElement).click();
    const pane = document.querySelector('[data-pane="memory"]') as HTMLElement;
    for (const n of ['#1', '#2', '#3', '#4']) expect(pane.textContent).toContain(n);
    expect(pane.textContent).toContain('已固定');
    expect(pane.textContent).toContain('已被推翻'); // 097 B2：废弃徽标统一「已被推翻」（人工/自动不再区分文案）
    // 观察行无短索引
    expect(pane.querySelectorAll('.bz-sc-dash-insight-id').length).toBe(4);
  }, 15000);

  it('点击「固定」落盘 pinned=true 并重渲染为「取消固定」；再点还原 false', async () => {
    const { app, vault } = makeUi(uiFixture());
    await openSmartcatDashboard(app as any);
    (document.querySelector('[data-tab="memory"]') as HTMLElement).click();
    const row1 = [...document.querySelectorAll('.bz-sc-dash-memory')].find((r) => r.textContent!.includes('#1')) as HTMLElement;
    (row1.querySelector('.bz-sc-dash-mini-btn') as HTMLElement).click(); // 「固定」
    await flush();
    expect(storedData(vault).memory.stream.find((m) => m.id === 'u-i1')!.pinned).toBe(true);
    const rowAfter = [...document.querySelectorAll('.bz-sc-dash-memory')].find((r) => r.textContent!.includes('#1')) as HTMLElement;
    expect(rowAfter.textContent).toContain('取消固定');
    ((rowAfter.querySelector('.bz-sc-dash-mini-btn') as HTMLElement)).click(); // 「取消固定」
    await flush();
    expect(storedData(vault).memory.stream.find((m) => m.id === 'u-i1')!.pinned).toBe(false);
  }, 15000);

  it('点击「废弃」落盘 supersededBy=manual；已废弃行不再提供「废弃」按钮', async () => {
    const { app, vault } = makeUi(uiFixture());
    await openSmartcatDashboard(app as any);
    (document.querySelector('[data-tab="memory"]') as HTMLElement).click();
    const row1 = [...document.querySelectorAll('.bz-sc-dash-memory')].find((r) => r.textContent!.includes('#1')) as HTMLElement;
    const depBtn = [...row1.querySelectorAll('.bz-sc-dash-mini-btn')].find((b) => b.textContent === '废弃') as HTMLElement;
    depBtn.click();
    await flush();
    const stored = storedData(vault).memory.stream.find((m) => m.id === 'u-i1')!;
    expect(stored.supersededBy).toBe(MANUAL_SUPERSEDED_BY);
    // 重渲染后 #1 行显示「已被推翻」（097 B2 文案）且不再有「废弃」按钮
    const rowAfter = [...document.querySelectorAll('.bz-sc-dash-memory')].find((r) => r.textContent!.includes('#1')) as HTMLElement;
    expect(rowAfter.textContent).toContain('已被推翻');
    expect([...rowAfter.querySelectorAll('.bz-sc-dash-mini-btn')].some((b) => b.textContent === '废弃')).toBe(false);
  }, 15000);

  it('打开面板本身零写盘；固定/废弃之外无其它写点（兼容冻结回归）', async () => {
    const { app, vault } = makeUi(uiFixture());
    await openSmartcatDashboard(app as any);
    const writes = vault.modifiedPaths.length;
    (document.querySelector('[data-tab="memory"]') as HTMLElement).click();
    await flush();
    expect(vault.modifiedPaths.length).toBe(writes);
  }, 15000);
});