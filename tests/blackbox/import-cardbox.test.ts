/**
 * 卡片盒导入（一次性工具）测试：解析（frontmatter/(描述::)/嵌入剔除）、规则预筛（空卡/敏感/残渣）、
 * AI 批量分类（mock + 失败降级）、关联（双链 + TF-IDF）、批量导入（4 维度写入 + related 回填 + 日志幂等）、
 * 预览 UI（列表/✨AI 总结/🚫跳过↩恢复/导入）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { seedV3 } from './v3-seed';
import { resetObsidianMocks, hasNotice, mockMarkdownRenderer } from '../mock-obsidian-entry';
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
import { BlackBoxDataManager, getBlackBoxFilePath } from '../../src/blackbox/data';
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

/** 动态分类 mock：按请求 prompt 里的编号逐条返回（i%3===0 归文献，其余概念） */
function mockClassify() {
  const fetchMock = vi.fn(async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    const prompt = body.messages[body.messages.length - 1].content as string;
    const items = prompt
      .split('\n')
      .filter((l) => /^\d+\./.test(l))
      .map((l) => {
        const i = parseInt(l, 10);
        return { i, kind: i % 3 === 0 ? 'literature' : 'concept', reason: 'mock' };
      });
    return { ok: true, json: async () => ({ message: { content: JSON.stringify(items) } }) };
  });
  (global as any).fetch = fetchMock;
  return fetchMock;
}

function seedVault(vault: MockVault, entries: any[] = [], extra?: any): void {
  seedV3(vault, {
    settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动'] },
    persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
    entries,
    profiles: [],
    events: [],
    reviews: [],
    chat: [],
    meta: { lastReviewAt: '', totalEntries: entries.length, totalEvents: 0 },
    ...extra,
  });
}

async function loaded(app: any, vault: MockVault): Promise<any> {
  return new BlackBoxDataManager(app).load();
}

/** 造 N 张普通卡片（用于分批测试） */
function seedMany(vault: MockVault, n: number): void {
  for (let i = 1; i <= n; i++) {
    vault.files.set(`卡片盒/卡${String(i).padStart(3, '0')}.md`, [
      '---',
      'tags: [测试]',
      'category: 测试',
      '---',
      `这是第 ${i} 张测试卡片，内容足够长用于导入验证，包含一些正文文字。`,
      '',
    ].join('\n'));
  }
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
      { name: 'A', text: 'A'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '', kind: 'concept' as const, reason: '', relatedNames: [], aiSummary: true, summary: '', aiRelated: [], aiChecked: false },
      { name: 'B', text: 'B'.repeat(30), tags: [], category: '', desc: '', createdAt: '', path: '', kind: 'concept' as const, reason: '', relatedNames: [], aiSummary: true, summary: '', aiRelated: [], aiChecked: false },
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
    const data = await loaded(app, vault);
    const r = await runImport(app, cards, data, ['Github']);
    expect(r.imported).toBe(3);
    const d = await loaded(app, vault);
    const mit = d.entries.find((e: any) => e.name === 'MIT协议');
    expect(mit.createdAt).toBe('2024-01-01T00:00:00.000Z'); // 卡片创建时间 → 录入时间
    expect(mit.category).toBe('计算机');
    expect(mit.tags).toEqual(['开源']);
    expect(mit.definition).toContain('MIT 协议允许无限制使用修改分发代码'); // 无 AI → 原文
    expect(mit.summary).toBe('开源许可协议'); // 自带 desc 存入 summary
    expect(mit.related).toContain('bb_c1'); // 既有概念按 id
    const gpl = d.entries.find((e: any) => e.name === 'GPL');
    expect(gpl.definition).toBe('严格开源协议'); // AI 内容 → 概念主体
    expect(gpl.summary).toBeUndefined(); // AI 内容已在 definition
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
    await runImport(app, classified, await loaded(app, vault), ['Github']);
    // 4) 日志写入后：重跑（模拟）已导入的卡不再出现
    const log = await readImportLog(app);
    expect(log.imported.size).toBe(2);
    expect(log.skipped.has('Github')).toBe(true);
  });
});

describe('卡片盒导入 · 预览 UI（组模式）', () => {
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

  it('打开：载入第一组，展示第一张完整原始内容（Markdown 渲染）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    seedCards(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openCardboxImport(app);
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('MIT协议');
    });
    const card = document.getElementById('bz-blackbox-import-card')!;
    expect(card.textContent).toContain('概念'); // 全部按概念
    expect(card.textContent).toContain('开源许可协议'); // 自带 desc 展示
    // 完整原始内容（不截断）：正文全文都在 DOM 里
    expect(card.textContent).toContain('MIT协议（MIT License）是由美国麻省理工学院制定的开源许可协议');
    // Markdown 渲染被调用（markdown 原文传入）
    expect(mockMarkdownRenderer.render).toHaveBeenCalled();
    const mdArg = mockMarkdownRenderer.render.mock.calls[0][1] as string;
    expect(mdArg).toContain('由美国麻省理工学院制定');
    // 统计
    expect(document.getElementById('bz-blackbox-import-stats')!.textContent).toContain('累计导入 0');
  });

  it('组流程：确认暂存 → 跳过可撤销 → 本组处理完 → 批量 AI 生成并导入', async () => {
    const vault = new MockVault();
    seedVault(vault, [
      { id: 'bb_c1', type: 'concept', createdAt: 't', name: '开源', definition: 'x', related: [], emotions: [], people: [], scene: '', toward: '', links: [] },
    ]);
    seedCards(vault);
    // 批量生成 mock：i=1 → MIT 定义+关联开源；i=2 → Calibre 定义
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      const prompt = body.messages[body.messages.length - 1].content as string;
      const items = prompt
        .split('\n')
        .filter((l) => /^\d+\./.test(l))
        .map((l) => {
          const i = parseInt(l, 10);
          return { i, summary: `AI定义第${i}张`, relatedNames: i === 1 ? ['开源'] : [] };
        });
      return { ok: true, json: async () => ({ message: { content: JSON.stringify(items) } }) };
    });
    (global as any).fetch = fetchMock;
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openCardboxImport(app);
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('MIT协议');
    });
    // 确认第一张（MIT）→ 下一张 Calibre
    (document.getElementById('bz-blackbox-import-confirm') as HTMLElement).click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('Calibre');
    });
    // 跳过 Calibre → 撤销恢复
    (document.getElementById('bz-blackbox-import-skip') as HTMLElement).click();
    expect(document.getElementById('bz-blackbox-import-undobox')!.textContent).toContain('Calibre');
    (document.querySelector('.bz-blackbox-import-restore') as HTMLElement).click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('Calibre');
    });
    // 确认 Calibre → 本组处理完 → 出现「生成并导入本组 2 张」
    (document.getElementById('bz-blackbox-import-confirm') as HTMLElement).click();
    await vi.waitFor(async () => {
      const btn = document.getElementById('bz-blackbox-import-run') as HTMLElement;
      expect(btn.textContent).toContain('生成并导入本组 2 张');
    });
    // 批量生成+导入
    document.getElementById('bz-blackbox-import-run')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.name === 'MIT协议')).toBe(true);
    });
    const mit = (await loaded(app, vault)).entries.find((e: any) => e.name === 'MIT协议');
    expect(mit.type).toBe('concept');
    expect(mit.definition).toBe('AI定义第1张'); // AI 内容作为概念主体
    expect(mit.category).toBe('计算机');
    expect(mit.tags).toEqual(['开源', '许可协议']);
    expect(mit.related).toContain('bb_c1'); // AI 关联落盘（既有概念 id）
    const cal = (await loaded(app, vault)).entries.find((e: any) => e.name === 'Calibre');
    expect(cal.definition).toBe('AI定义第2张');
    expect(cal.summary).toBe('一款功能强大且易于使用的电子书管理器'); // 自带 desc
    // 双向关联：既有概念「开源」反向关联新卡 MIT
    const kaiyuan = (await loaded(app, vault)).entries.find((e: any) => e.name === '开源');
    expect(kaiyuan.related).toContain(mit.id);
    // 日志
    const log = await readImportLog(app);
    expect(log.imported.size).toBe(2);
    expect(hasNotice(/已导入本组 2 张/)).toBe(true);
    // 全部完成
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('全部处理完毕');
    });
  });

  it('跳过 → 持久化永不录入；关闭重开不再出现', async () => {
    const vault = new MockVault();
    seedVault(vault);
    seedCards(vault);
    mockOllama('[]'); // 批量生成空结果（降级按原文导入）
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openCardboxImport(app);
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('MIT协议');
    });
    // 跳过 MIT → 确认 Calibre → 生成并导入
    (document.getElementById('bz-blackbox-import-skip') as HTMLElement).click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('Calibre');
    });
    (document.getElementById('bz-blackbox-import-confirm') as HTMLElement).click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-run')!.textContent).toContain('生成并导入本组 1 张');
    });
    document.getElementById('bz-blackbox-import-run')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.name === 'Calibre')).toBe(true);
    });
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('全部处理完毕');
    });
    const log = await readImportLog(app);
    expect(log.imported.has('Calibre')).toBe(true);
    expect(log.skipped.has('MIT协议')).toBe(true);
    // 重开：全部处理完毕（MIT 跳过 + Calibre 已导入）
    closeCardboxImport();
    await openCardboxImport(app);
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('全部处理完毕');
    });
  });

  it('AI 生成失败 → 整组按原文导入，不阻断', async () => {
    const vault = new MockVault();
    seedVault(vault);
    seedCards(vault);
    const fetchMock = vi.fn(async () => {
      throw new Error('AI down');
    });
    (global as any).fetch = fetchMock;
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openCardboxImport(app);
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('MIT协议');
    });
    (document.getElementById('bz-blackbox-import-confirm') as HTMLElement).click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('Calibre');
    });
    (document.getElementById('bz-blackbox-import-confirm') as HTMLElement).click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-run')!.textContent).toContain('生成并导入本组 2 张');
    });
    document.getElementById('bz-blackbox-import-run')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.name === 'MIT协议')).toBe(true);
    });
    const mit = (await loaded(app, vault)).entries.find((e: any) => e.name === 'MIT协议');
    expect(mit.definition).toContain('由美国麻省理工学院制定'); // 原文降级
    expect(mit.related).toEqual([]); // 无 AI 关联
  });
});

describe('卡片盒导入 · 组间补链', () => {
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

  it('45 张卡：三组（20/20/5），逐组确认并导入；跨组关联 pendingLinks 补链为 id', async () => {
    const vault = new MockVault();
    seedVault(vault);
    seedMany(vault, 45);
    // 批量生成 mock：按调用次数固定映射（组1=卡001-020、组2=卡021-040、组3=卡041-045），每张指向「下一张」
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      const start = (call - 1) * 20;
      const size = call === 3 ? 5 : 20;
      const items: { i: number; summary: string; relatedNames: string[] }[] = [];
      for (let k = 0; k < size; k++) {
        const n = start + k + 1;
        items.push({ i: k + 1, summary: '', relatedNames: ['卡' + String(n + 1).padStart(3, '0')] });
      }
      return { ok: true, json: async () => ({ message: { content: JSON.stringify(items) } }) };
    });
    (global as any).fetch = fetchMock;
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openCardboxImport(app);
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('卡001');
    });
    // 三组：每组全确认 → 生成并导入
    for (let g = 0; g < 3; g++) {
      // 本组 20/20/5 张逐张确认
      const size = g === 2 ? 5 : 20;
      for (let k = 0; k < size; k++) {
        await vi.waitFor(async () => {
          expect(document.getElementById('bz-blackbox-import-confirm')).toBeTruthy();
        });
        (document.getElementById('bz-blackbox-import-confirm') as HTMLElement).click();
        if (k < size - 1) {
          await vi.waitFor(async () => {
            const card = document.getElementById('bz-blackbox-import-card')!;
            expect(card.textContent).not.toContain('全部处理完毕');
          });
        }
      }
      await vi.waitFor(async () => {
        expect(document.getElementById('bz-blackbox-import-run')!.textContent).toContain('生成并导入本组');
      });
      document.getElementById('bz-blackbox-import-run')!.click();
      if (g < 2) {
        // 下一组第一张卡出现（组已载入）
        await vi.waitFor(async () => {
          const card = document.getElementById('bz-blackbox-import-card')!;
          expect(card.textContent).toContain('卡' + String((g + 1) * 20 + 1).padStart(3, '0'));
        });
      }
    }
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('全部处理完毕');
    });
    const d = await loaded(app, vault);
    expect(d.entries.length).toBe(45);
    // 跨组补链：卡020（第 1 组尾）→ 卡021（第 2 组头）
    const e20 = d.entries.find((e: any) => e.name === '卡020');
    const e21 = d.entries.find((e: any) => e.name === '卡021');
    expect(e20.related).toContain(e21.id);
    expect(e20.pendingLinks).toBeUndefined(); // 补链后清空
    // 卡045 → 卡046（不存在）→ 无关联
    const e45 = d.entries.find((e: any) => e.name === '卡045');
    expect(e45.related).toEqual([]);
    const log = await readImportLog(app);
    expect(log.imported.size).toBe(45);
  });

  it('组内暂存确认列表统计正确（本组已确认 N）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    seedMany(vault, 45);
    mockOllama('[]');
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openCardboxImport(app);
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-card')!.textContent).toContain('卡001');
    });
    (document.getElementById('bz-blackbox-import-confirm') as HTMLElement).click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-stats')!.textContent).toContain('本组已确认 1');
    });
    (document.getElementById('bz-blackbox-import-confirm') as HTMLElement).click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-import-stats')!.textContent).toContain('本组已确认 2');
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