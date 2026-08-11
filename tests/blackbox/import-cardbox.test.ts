/**
 * 卡片盒导入（一次性工具）测试：解析（frontmatter/(描述::)/嵌入剔除）、规则预筛（空卡/敏感/残渣）、
 * AI 批量分类（mock + 失败降级）、关联（双链 + TF-IDF）、批量导入（4 维度写入 + related 回填 + 日志幂等）、
 * 预览 UI（列表/✨AI 总结/🚫跳过↩恢复/导入）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  parseCardFile,
  prefilterCard,
  classifyCards,
  buildRelations,
  generateSummaries,
  readImportLog,
  runImport,
  extractLinks,
} from '../../src/blackbox/import-cardbox';
import { parseClassifyJson, parseSummaryJson, buildClassifyPrompt, buildSummaryPrompt, BlackBoxAI } from '../../src/blackbox/ai';
import { getBlackBoxFilePath } from '../../src/blackbox/data';
import { openCardboxImport, unloadCardboxImport, closeCardboxImport } from '../../src/blackbox/import-ui';
import { unloadBlackBox } from '../../src/blackbox';
import { TFIDF } from '../../src/flash/tfidf';

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

function mockOllama(content: string) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: { content } }) }));
  (global as any).fetch = fetchMock;
  return fetchMock;
}

function seedVault(vault: MockVault, entries: any[] = [], extra?: any): void {
  vault.files.set(
    getBlackBoxFilePath(),
    JSON.stringify({
      version: 2,
      settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动'] },
      persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
      entries,
      profiles: [],
      events: [],
      reviews: [],
      chat: [],
      meta: { lastReviewAt: '', totalEntries: entries.length, totalEvents: 0 },
      ...extra,
    })
  );
}

function loaded(vault: MockVault): any {
  return JSON.parse(vault.files.get(getBlackBoxFilePath())!);
}

/** 预置三张卡片盒卡片（含 frontmatter/描述/嵌入/敏感卡） */
function seedCards(vault: MockVault): void {
  vault.files.set('卡片盒/MIT协议.md', [
    '---',
    'tags: [开源, 许可协议]',
    'category: 计算机',
    '---',
    'MIT协议（MIT License）是由美国麻省理工学院制定的开源许可协议，允许无限制使用、修改、分发代码。',
    '',
  ].join('\n'));
  vault.files.set('卡片盒/Github.md', [
    '---',
    'tags: [Git]',
    'category: 计算机',
    '---',
    '(描述:: GitHub 恢复码清单)',
    '恢复码：',
    '- 54c21-aa866',
    '- 76a1b-88f17',
    '',
  ].join('\n'));
  vault.files.set('卡片盒/Calibre.md', [
    '---',
    'tags: [电子书, 软件]',
    'category: 计算机',
    '---',
    '(描述:: 一款功能强大且易于使用的电子书管理器)',
    '安装插件 markdown output，中文结构检测用正则。',
    '![[Pasted image 20250912113117.jpg]]',
    '',
  ].join('\n'));
  vault.files.set('卡片盒/空卡.md', '');
}

describe('卡片盒导入 · 解析与预筛', () => {
  it('parseCardFile：frontmatter（tags/category）+ (描述::) + 嵌入剔除', () => {
    const c = parseCardFile('Calibre', [
      '---',
      'tags: [电子书, 软件]',
      'category: 计算机',
      '---',
      '(描述:: 一款功能强大且易于使用的电子书管理器)',
      '安装插件 markdown output。',
      '![[Pasted image 1.jpg]]',
      '',
    ].join('\n'));
    expect(c.name).toBe('Calibre');
    expect(c.tags).toEqual(['电子书', '软件']);
    expect(c.category).toBe('计算机');
    expect(c.desc).toBe('一款功能强大且易于使用的电子书管理器');
    expect(c.text).toContain('安装插件');
    expect(c.text).not.toContain('![[Pasted image 1.jpg]]'); // 嵌入剔除
  });

  it('prefilterCard：空卡 / 敏感内容 / 剪藏残渣 → 跳过', () => {
    expect(prefilterCard({ name: '空卡', text: '', tags: [], category: '', desc: '', createdAt: '', path: '' })).toEqual({
      kind: 'skip',
      reason: '空卡或内容过短',
    });
    expect(prefilterCard({ name: 'Github', text: '2FA 恢复码 54c21-aa866 76a1b-88f17 备用恢复', tags: [], category: '', desc: '', createdAt: '', path: '' })!.reason).toContain('敏感');
    expect(prefilterCard({ name: '451 Not Found', text: 'xx'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '' })!.reason).toContain('残渣');
    // 正常卡放行
    expect(prefilterCard({ name: 'MIT协议', text: 'xx'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '' })).toBeNull();
  });
});

describe('卡片盒导入 · AI 分类与总结', () => {
  beforeEach(() => {
    setSettingsProvider(() => ({ blackboxAIProvider: 'ollama' } as any));
  });
  afterEach(() => {
    delete (global as any).fetch;
  });
  it('parseClassifyJson / parseSummaryJson 容错', () => {
    expect(parseClassifyJson('[{"i":1,"kind":"concept","reason":"定义"},{"i":2,"kind":"skip","reason":"私密"}]')).toEqual([
      { i: 1, kind: 'concept', reason: '定义' },
      { i: 2, kind: 'skip', reason: '私密' },
    ]);
    expect(parseClassifyJson('乱文')).toEqual([]);
    expect(parseSummaryJson('[{"i":1,"summary":"一句话总结"}]')).toEqual([{ i: 1, summary: '一句话总结' }]);
    expect(parseSummaryJson('bad')).toEqual([]);
  });

  it('classifyCards：mock AI 分类，未覆盖的卡默认 concept', async () => {
    mockOllama('[{"i":1,"kind":"concept","reason":"定义"},{"i":2,"kind":"literature","reason":"操作笔记"}]');
    const cards = [
      { name: 'A', text: 'A'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '' },
      { name: 'B', text: 'B'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '' },
      { name: 'C', text: 'C'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '' },
    ];
    const out = await classifyCards(new BlackBoxAI(), cards);
    expect(out[0].kind).toBe('concept');
    expect(out[1].kind).toBe('literature');
    expect(out[2].kind).toBe('concept'); // 未覆盖 → 默认
    expect(out[0].aiSummary).toBe(false);
    expect(out[0].summary).toBe('');
  });

  it('classifyCards：AI 失败整批降级 concept（永不拒收）', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('down'); });
    (global as any).fetch = fetchMock;
    const cards = [{ name: 'A', text: 'A'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '' }];
    const out = await classifyCards(new BlackBoxAI(), cards);
    expect(out[0].kind).toBe('concept');
    expect(out[0].reason).toContain('失败');
  });

  it('generateSummaries：勾选卡批量生成，失败行留空', async () => {
    mockOllama('[{"i":1,"summary":"开源许可协议"},{"i":2,"summary":"电子书管理器"}]');
    const cards = [
      { name: 'A', text: 'A'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '', kind: 'concept' as const, reason: '', relatedNames: [], aiSummary: true, summary: '' },
      { name: 'B', text: 'B'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '', kind: 'concept' as const, reason: '', relatedNames: [], aiSummary: true, summary: '' },
    ];
    await generateSummaries(new BlackBoxAI(), cards);
    expect(cards[0].summary).toBe('开源许可协议');
    expect(cards[1].summary).toBe('电子书管理器');
  });

  it('prompt 含分类说明与 JSON 约束', () => {
    const p = buildClassifyPrompt('1. A：正文');
    expect(p).toContain('concept');
    expect(p).toContain('literature');
    expect(p).toContain('skip');
    expect(p).toContain('JSON');
    expect(buildSummaryPrompt('1. A：正文')).toContain('JSON');
  });
});

describe('卡片盒导入 · 关联构建', () => {
  it('extractLinks：双链解析（含别名）', () => {
    expect(extractLinks('看 [[MIT协议]] 和 [[Calibre|电子书]]，还有 [[笔记#章节]]')).toEqual(['MIT协议', 'Calibre', '笔记']);
  });

  it('buildRelations：双链命中（卡片/既有概念）+ TF-IDF 相似度，上限 5 去重', () => {
    const cards = [
      { name: 'MIT协议', text: 'MIT 协议允许无限制使用修改分发代码，是开源领域最广泛采用的许可协议。参见 [[开源]]。', tags: [], category: '', desc: '', createdAt: '', path: '' },
      { name: 'GPL', text: 'GPL 是严格的开源许可协议，要求衍生作品必须开源。参见 [[MIT协议]]。', tags: [], category: '', desc: '', createdAt: '', path: '' },
      { name: 'Apache', text: 'Apache 许可协议包含专利条款，与 MIT 协议类似但更复杂。', tags: [], category: '', desc: '', createdAt: '', path: '' },
    ];
    const existing = [{ id: 'bb_c1', name: '开源', type: 'concept' as const, createdAt: 't', emotions: [], people: [], scene: '', toward: '', links: [] }];
    const rel = buildRelations(cards, existing as any);
    // 双链：GPL → MIT协议
    expect(rel.get('GPL')).toContain('MIT协议');
    // TF-IDF：MIT协议 ↔ Apache 相似
    expect(rel.get('MIT协议')).toContain('Apache');
    // 既有概念按 id
    expect(rel.get('MIT协议')).toContain('bb_c1');
    // 上限 5
    for (const v of rel.values()) expect(v.length).toBeLessThanOrEqual(5);
  });
});

describe('卡片盒导入 · 批量导入与幂等', () => {
  it('runImport：4 维度写入（createdAt/category/tags/summary）+ related 回填 + 日志（imported+skipped）', async () => {
    const vault = new MockVault();
    seedVault(vault, [
      { id: 'bb_c1', type: 'concept', createdAt: 't', name: '开源', definition: 'x', related: [], emotions: [], people: [], scene: '', toward: '', links: [] },
    ]);
    const { app } = setup(vault);
    const cards = [
      { name: 'MIT协议', text: 'MIT 协议允许无限制使用修改分发代码。', tags: ['开源'], category: '计算机', desc: '开源许可协议', createdAt: '2024-01-01T00:00:00.000Z', path: '', kind: 'concept' as const, reason: '', relatedNames: ['开源', 'GPL'], aiSummary: false, summary: '' },
      { name: 'GPL', text: 'GPL 是严格的开源许可协议。', tags: [], category: '计算机', desc: '', createdAt: '2024-02-01T00:00:00.000Z', path: '', kind: 'concept' as const, reason: '', relatedNames: ['MIT协议'], aiSummary: true, summary: '严格开源协议', aiSummary2: undefined as any },
      { name: 'Calibre', text: '安装插件 markdown output。', tags: ['电子书'], category: '计算机', desc: '电子书管理器', createdAt: '', path: '', kind: 'literature' as const, reason: '', relatedNames: [], aiSummary: false, summary: '' },
    ] as any;
    const data = loaded(vault);
    const r = await runImport(app, cards, data, ['Github']);
    expect(r.imported).toBe(3);
    const d = loaded(vault);
    const mit = d.entries.find((e: any) => e.name === 'MIT协议');
    expect(mit.createdAt).toBe('2024-01-01T00:00:00.000Z'); // 卡片创建时间 → 录入时间
    expect(mit.category).toBe('计算机');
    expect(mit.tags).toEqual(['开源']);
    expect(mit.summary).toBe('开源许可协议'); // 未勾 AI → 用自带 desc
    expect(mit.related).toContain('bb_c1'); // 既有概念按 id
    const gpl = d.entries.find((e: any) => e.name === 'GPL');
    expect(gpl.summary).toBe('严格开源协议'); // 勾了 AI → 用生成值
    expect(gpl.related).toContain(mit.id); // 本批卡片 name→id 回填
    const cal = d.entries.find((e: any) => e.type === 'literature');
    expect(cal.text).toContain('markdown output');
    expect(cal.source).toBe('[[Calibre]]');
    // 日志：imported + skipped 持久化
    const log = await readImportLog(app);
    expect(log.imported.has('MIT协议')).toBe(true);
    expect(log.imported.has('GPL')).toBe(true);
    expect(log.skipped.has('Github')).toBe(true);
  });

  it('scanCardboxAsync + 完整流程：敏感卡被预筛，重跑跳过已导入', async () => {
    const vault = new MockVault();
    seedVault(vault);
    seedCards(vault);
    const { app } = setup(vault);
    // 手动跑核心流程（UI 层之外）：
    // 1) 扫描
    const { scanCardboxAsync, prefilterCard } = await import('../../src/blackbox/import-cardbox');
    const cards = await scanCardboxAsync(app);
    expect(cards.length).toBe(4);
    const mit = cards.find((c) => c.name === 'MIT协议')!;
    expect(mit.tags).toEqual(['开源', '许可协议']);
    expect(mit.createdAt).toBe(new Date(Date.UTC(2024, 0, 1, 12, 0)).toISOString()); // mock stat.ctime
    // 2) 预筛：敏感卡跳过
    const github = cards.find((c) => c.name === 'Github')!;
    expect(prefilterCard(github)!.reason).toContain('敏感');
    expect(prefilterCard(cards.find((c) => c.name === '空卡')!)!.reason).toContain('空卡');
    // 3) 分类（mock AI）+ 导入
    mockOllama('[{"i":1,"kind":"concept","reason":"定义"},{"i":2,"kind":"literature","reason":"工具笔记"}]');
    const ai = new BlackBoxAI();
    const candidates = cards
      .filter((c) => !prefilterCard(c))
      .map((c) => ({ ...c, kind: 'concept' as const, reason: '', relatedNames: [], aiSummary: false, summary: '' }));
    const classified = await classifyCards(ai, candidates);
    expect(classified.length).toBe(2); // MIT + Calibre（Github 敏感/空卡被预筛）
    await runImport(app, classified, loaded(vault), ['Github']);
    // 4) 日志写入后：重跑（模拟）已导入的卡不再出现
    const log = await readImportLog(app);
    expect(log.imported.size).toBe(2);
    expect(log.skipped.has('Github')).toBe(true);
  });
});

describe('卡片盒导入 · 预览 UI', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadBlackBox();
  });
  afterEach(() => {
    unloadBlackBox();
    unloadCardboxImport();
    delete (global as any).fetch;
  });

  it('打开：扫描+分类渲染列表（内容预览/✨AI 总结/🚫跳过），统计正确', async () => {
    const vault = new MockVault();
    seedVault(vault);
    seedCards(vault);
    // 分类 mock：MIT→concept、Calibre→literature、Github（敏感）不进候选
    mockOllama('[{"i":1,"kind":"concept","reason":"定义"},{"i":2,"kind":"literature","reason":"工具笔记"}]');
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openCardboxImport(app);
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-import-run')!.textContent).toContain('导入 2 张');
    });
    // 预筛：Github（敏感）+ 空卡（空）跳过 → 候选 = MIT + Calibre = 2 张
    const rows = document.querySelectorAll('.bz-blackbox-import-row');
    expect(rows.length).toBe(2);
    // 行内容：原卡内容预览
    const first = rows[0] as HTMLElement;
    expect(first.textContent).toContain('MIT协议');
    expect(first.textContent).toContain('开源许可协议'); // 自带 desc 展示
    expect(first.textContent).toContain('✨ AI 总结');
    expect(first.textContent).toContain('🚫 跳过');
    // 统计
    expect(document.getElementById('bz-blackbox-import-stats')!.textContent).toContain('待确认 2');
  });

  it('跳过 → 移入跳过区可恢复；导入：AI 总结生成 + 批量写入 + 日志', async () => {
    const vault = new MockVault();
    seedVault(vault);
    seedCards(vault);
    mockOllama('[{"i":1,"kind":"concept","reason":"定义"},{"i":2,"kind":"literature","reason":"工具笔记"}]');
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openCardboxImport(app);
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-import-run')!.textContent).toContain('导入 2 张');
    });
    // 跳过 Calibre → 列表剩 1，跳过区出现
    const rows = document.querySelectorAll('.bz-blackbox-import-row');
    const calibreRow = Array.from(rows).find((r) => (r as HTMLElement).textContent!.includes('Calibre')) as HTMLElement;
    (calibreRow.querySelector('.bz-blackbox-import-skip') as HTMLElement).click();
    expect(document.querySelectorAll('.bz-blackbox-import-row').length).toBe(1);
    expect(document.getElementById('bz-blackbox-import-skipped')!.textContent).toContain('Calibre');
    // 恢复
    (document.querySelector('.bz-blackbox-import-restore') as HTMLElement).click();
    expect(document.querySelectorAll('.bz-blackbox-import-row').length).toBe(2);
    // 勾选 MIT 的 AI 总结 + 导入
    const mitRow = Array.from(document.querySelectorAll('.bz-blackbox-import-row')).find(
      (r) => (r as HTMLElement).textContent!.includes('MIT协议')
    ) as HTMLElement;
    (mitRow.querySelector('.bz-blackbox-import-ai') as HTMLElement).click();
    mockOllama('[{"i":1,"summary":"开源许可协议概述"}]');
    document.getElementById('bz-blackbox-import-run')!.click();
    await vi.waitFor(() => {
      expect(loaded(vault).entries.some((e: any) => e.name === 'MIT协议')).toBe(true);
    });
    const mit = loaded(vault).entries.find((e: any) => e.name === 'MIT协议');
    expect(mit.summary).toBe('开源许可协议概述'); // AI 生成
    expect(mit.category).toBe('计算机');
    expect(mit.tags).toEqual(['开源', '许可协议']);
    // 日志含 imported + skipped（Calibre 之前被恢复，不在 skipped；MIT 已导入）
    const log = await readImportLog(app);
    expect(log.imported.has('MIT协议')).toBe(true);
    expect(hasNotice(/已导入/)).toBe(true);
  });

  it('关闭重开：已导入/已跳过的卡不再出现（幂等）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    seedCards(vault);
    mockOllama('[{"i":1,"kind":"concept","reason":"定义"},{"i":2,"kind":"literature","reason":"工具笔记"}]');
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openCardboxImport(app);
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-import-run')!.textContent).toContain('导入 2 张');
    });
    // 跳过 MIT，导入 Calibre
    const mitRow = Array.from(document.querySelectorAll('.bz-blackbox-import-row')).find(
      (r) => (r as HTMLElement).textContent!.includes('MIT协议')
    ) as HTMLElement;
    (mitRow.querySelector('.bz-blackbox-import-skip') as HTMLElement).click();
    document.getElementById('bz-blackbox-import-run')!.click();
    await vi.waitFor(() => {
      expect(loaded(vault).entries.some((e: any) => e.type === 'literature')).toBe(true);
    });
    closeCardboxImport();
    // 重开：全部处理完毕（MIT 跳过 + Calibre 已导入）
    await openCardboxImport(app);
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-import-list')!.textContent).toContain('没有可导入的卡片');
    });
  });
});

describe('卡片盒导入 · TF-IDF 索引（复用 flash）', () => {
  it('TFIDF 中文相似检索可用（关联构建的底层）', () => {
    const tfidf = new TFIDF();
    tfidf.build([
      { path: 'a', text: '开源许可协议 允许无限制使用修改分发代码' },
      { path: 'b', text: 'GPL 严格开源协议 要求衍生作品开源' },
      { path: 'c', text: '电子书管理器 安装插件导出格式' },
    ]);
    const hits = tfidf.search('开源协议', 3);
    expect(hits.map((h: any) => h.path)).toContain('a');
  });
});
