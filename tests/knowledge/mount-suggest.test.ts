// @vitest-environment node
/**
 * 挂载树·AI 语义建议链路测试（issue 318 一次性裁判 + **issue 321 三段式**，ADR-0138 / ADR-0139 §3 / ADR-0140）：
 * 分句、稳定键、过滤（否决/已固定/弱关联/已存在双链）、缓存读写与逐卡失效、处置留档与否决表、
 * 降级三分支（无索引/移动端/无 AI）、幽灵节点并树、清空缓存；
 * 321 新增：三段解析器、召回聚合（范围闸/自指/去重/多样性保底）、三级回定位、标题校验降级、
 * 三形态链接、块 id 幂等、别名替换、suggestionId 单元粒度、onProgress 阶段。
 *
 * AI 与向量检索全程 mock（不联网、不真调模型）。三段链路按**调用次序**供回答：
 * ① 查询官 → ② 采纳官 → ③ 定位官（缺省查询官 `[]` = 退回机械分句当查询）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  judge: vi.fn(),
  /** 哨兵：裁判**不得**走 json()（带了 response_format=json_object 模型会吐 {"type":"json_object"} 空壳） */
  jsonForced: vi.fn(),
  aiOk: true,
  /** 按调用次序消费的三段回答（查询官 / 采纳官 / 定位官） */
  answers: [] as string[],
}));

vi.mock('../../src/core/ai', () => ({
  createAI: () => ({ prompt: mocks.judge, json: mocks.jsonForced }),
  getAIProvider: async () => {
    if (!mocks.aiOk) throw new Error('未配置 API Key');
    return { endpoint: 'https://example.invalid', apiKey: 'test-key' };
  },
}));

import { Platform } from 'obsidian';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { hash31 } from '../../src/core/utils';
import { setVectorSearchSource } from '../../src/secondbrain/readonly';
import {
  SUGGEST_CACHE_FILE,
  SUGGEST_CACHE_VERSION,
  SUGGEST_JUDGE_MAX_TOKENS,
  SUGGEST_MIN_SCORE,
  SUGGEST_REASONING_EFFORT,
  aggregatePool,
  blockIdFor,
  cacheValid,
  clearSuggestCache,
  collectExistingTargets,
  ensureSuggestionBlockId,
  filterSuggestions,
  findHeadingText,
  generateSuggestions,
  inRecallScope,
  locateInText,
  markSuggestion,
  mergeSuggestions,
  parseAdoptPicks,
  parseJudgePicks,
  parseLocatePicks,
  parseQueryList,
  readSuggestCache,
  replaceAnchorWithAlias,
  sliceUnitText,
  splitAnchors,
  suggestKey,
  suggestProgressLabel,
  suggestProgressPercent,
  suggestionId,
  suggestionLink,
  suggestionUnitMarkdown,
  type SuggestCtx,
} from '../../src/knowledge/mount-suggest';
import type { MountSuggestion, MountTree, SuggestProgress, SuggestRun, SuggestState } from '../../src/knowledge/mount-types';

const CARDBOX = '卡片盒';
const LIT = '文献盒';
const ANCHOR_A1 = '甲卡正文：这是第一段足够长的锚点句子';
const ANCHOR_A2 = '这是第二段足够长的锚点句子';
const BODY_A = `${ANCHOR_A1}。${ANCHOR_A2}。`;
const BODY_ONE = `${ANCHOR_A1}。`; // 单锚点正文（处置配对断言用）
const BODY_B = '乙卡正文：这是唯一一段足够长的锚点句子。';
const T1 = '文献盒/目标一.md';
const T2 = '文献盒/目标二.md';

let vault: MockVault;
let ctx: SuggestCtx;

/** 造一条候选（锚点偏移只影响 from/to，键只认文本） */
function mk(text: string, target: string, score = 0.9, state: SuggestState = 'pending'): MountSuggestion {
  return { anchor: { from: 0, to: text.length, text }, target, kind: 'note', reason: '一句话理由', score, state };
}

/** 采纳官回答（片段编号 × 目标路径） */
function adoptRaw(picks: Array<{ seg: number; path: string; score?: number; reason?: string }>): string {
  return JSON.stringify(picks.map((p) => ({ seg: p.seg, path: p.path, score: p.score ?? 0.9, reason: p.reason ?? '理由' })));
}

/**
 * 装配三段回答：① 查询官（缺省 `[]` = 机械分句当查询）② 采纳官 ③ 定位官（缺省空串 = 按整篇兜底）。
 * 每段按调用次序消费；某一段要重试就再 push 一组。
 */
function aiPass(adopt: string, locate: string | null = null, query: string | null = null): void {
  mocks.answers.length = 0; // 装配**这一轮**：上一轮若中途降级会留下未消费的回答，不能串到下一轮
  mocks.answers.push(query ?? '[]', adopt, locate ?? '');
}

beforeEach(() => {
  vault = new MockVault();
  vault.files.set(T1, '目标一正文');
  vault.files.set(T2, '目标二正文');
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  mocks.search.mockReset();
  mocks.judge.mockReset();
  mocks.answers.length = 0;
  mocks.judge.mockImplementation(async () => mocks.answers.shift() ?? '');
  mocks.aiOk = true;
  setVectorSearchSource({ isIndexReady: () => true, search: mocks.search }); // 假检索面注入（叶子桥，无需 mock 整条 index）
  (Platform as any).isMobile = false;
  ctx = { app, cardboxDir: CARDBOX, litDir: LIT };
});

afterEach(() => {
  setSettingsProvider(() => ({}) as any);
  setVectorSearchSource(null); // 复位检索桥（未注册 = 无索引降级）
  (Platform as any).isMobile = false;
});

describe('splitAnchors（分句/分词切分）', () => {
  it('中英混排按标点断句；空串、纯符号、过短片段跳过；from/to 指回原文', () => {
    const body = [
      '卡片盒是思考的组织核心。It overlaps with statistics nicely.',
      '短。',
      '---',
      '- 列表项也是一个足够长的句子；',
      '> [!quote] 引用块里的 callout 标记也不算锚点内容；',
    ].join('\n');
    const anchors = splitAnchors(body);
    expect(anchors.map((a) => a.text)).toEqual([
      '卡片盒是思考的组织核心',
      'It overlaps with statistics nicely',
      '列表项也是一个足够长的句子',
      '引用块里的 callout 标记也不算锚点内容',
    ]);
    expect(body.slice(anchors[0].from, anchors[0].to)).toBe('卡片盒是思考的组织核心');
    expect(body.slice(anchors[2].from, anchors[2].to)).toBe('列表项也是一个足够长的句子');
  });

  it('双链转显示文本、行内标记剥离；纯符号段落不产锚点', () => {
    const body = '看这张 [[卡片盒/某卡|别名卡片]] 的论述是否成立，**重点**在后面。\n***\n';
    const anchors = splitAnchors(body);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].text).toBe('看这张 别名卡片 的论述是否成立，重点在后面');
    expect(splitAnchors('')).toEqual([]);
    expect(splitAnchors('***\n\n###\n')).toEqual([]);
  });

  it('未闭合的 `[[`（句读切在双链别名里）取 `|` 后的显示文本（321 实测噪声）', () => {
    // 句读把 `[[书库/社会心理学#^26kpix|社会心理学]]` 切成两段时，前一段会带未闭合的 `[[…|`
    const body = '这段引用了 [[书库/社会心理学#^26kpix|社会心理学]] 的巴纳姆效应论述。';
    const anchors = splitAnchors(body);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].text).toBe('这段引用了 社会心理学 的巴纳姆效应论述');
    // 未闭合且无别名：整段丢掉，不留 `[[` 残渣
    expect(splitAnchors('前面很长的正文内容 [[书库/某本没有别名的书').map((a) => a.text)).toEqual([
      '前面很长的正文内容',
    ]);
  });
});

describe('三段解析器（标签 / 围栏 / 包壳 / 空回答）', () => {
  it('轮1 查询官：sentence+keywords 双查询；标签编号、围栏、夹叙文字都认', () => {
    const one = JSON.stringify([{ seg: 1, sentence: '卡片盒是思考的组织核心', keywords: '卡片盒 思考 组织', why: '定义' }]);
    const parsed = parseQueryList(one);
    expect(parsed).toMatchObject({ found: true, count: 1 });
    expect(parsed.items[0]).toMatchObject({ seg: 1, sentence: '卡片盒是思考的组织核心', keywords: '卡片盒 思考 组织' });
    expect(parseQueryList('```json\n' + one + '\n```').items).toHaveLength(1);
    expect(parseQueryList('好的：\n' + one + '\n以上').items).toHaveLength(1);
    // 标签编号（s1 / "2"）+ 缺一补一（只给 sentence 时 keywords 顶上）
    expect(parseQueryList(JSON.stringify([{ seg: 's1', sentence: '甲' }, { seg: 2, keywords: '乙 丙' }])).items).toEqual([
      { seg: 1, sentence: '甲', keywords: '甲', why: '' },
      { seg: 2, sentence: '乙 丙', keywords: '乙 丙', why: '' },
    ]);
    expect(parseQueryList('')).toEqual({ found: false, count: 0, items: [] });
    expect(parseQueryList('抱歉，我不能。')).toEqual({ found: false, count: 0, items: [] });
  });

  it('轮2 采纳官：路径原文认目标；json_object 包壳脱壳；`[]` 与「认不出」分得清', () => {
    const one = JSON.stringify([{ seg: 1, path: T1, score: 0.9, reason: '同一主题' }]);
    expect(parseAdoptPicks(one).items).toEqual([{ seg: 1, path: T1, score: 0.9, reason: '同一主题' }]);
    expect(parseAdoptPicks(JSON.stringify({ type: 'json_object', content: one })).items).toHaveLength(1);
    // 标签编号 / 字符串分数 / 分数钳制 / 理由截断
    const parsed = parseAdoptPicks(
      JSON.stringify([
        { seg: 'a1', path: T2, score: '0.88', reason: '标签' },
        { seg: 2, path: T1, score: 9, reason: 'x'.repeat(200) },
        { seg: 3, score: 0.9, reason: '缺路径' },
      ])
    );
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toMatchObject({ seg: 1, path: T2, score: 0.88 });
    expect(parsed.items[1].score).toBe(1);
    expect(parsed.items[1].reason).toHaveLength(80);
    expect(parseAdoptPicks('[]')).toEqual({ found: true, count: 0, items: [] });
    expect(parseAdoptPicks('')).toEqual({ found: false, count: 0, items: [] });
  });

  it('轮3 定位官：unit 归一（中文/head/para）、skip 透传、坏编号逐条丢', () => {
    const raw = JSON.stringify([
      { n: 1, unit: '整篇', reason: '全文相关' },
      { n: 'n2', unit: 'head', heading: '巴纳姆效应', reason: '小节' },
      { n: 3, unit: 'para', quote: '人们倾向于认为模糊描述精准对应自己', reason: '段落' },
      { n: 4, skip: true, reason: '泛泛相关，否决' },
      { n: 5, unit: 'none', reason: 'none 也是否决' },
      { n: 'x', unit: 'whole', reason: '编号认不出' },
    ]);
    const parsed = parseLocatePicks(raw);
    expect(parsed.found).toBe(true);
    expect(parsed.items).toHaveLength(5);
    expect(parsed.items[0]).toMatchObject({ n: 1, unit: 'whole', skip: false });
    expect(parsed.items[1]).toMatchObject({ n: 2, unit: 'heading', heading: '巴纳姆效应' });
    expect(parsed.items[2]).toMatchObject({ n: 3, unit: 'paragraph', skip: false });
    expect(parsed.items[3].skip).toBe(true);
    expect(parsed.items[4]).toMatchObject({ n: 5, skip: true, unit: 'whole' });
    expect(parseLocatePicks('```json\n[]\n```')).toEqual({ found: true, count: 0, items: [] });
    expect(parseLocatePicks('抱歉')).toEqual({ found: false, count: 0, items: [] });
  });

  it('318 一次性裁判的解析器保留（low 思考档下模型仍可能照旧 a1/t2 作答）', () => {
    const one = JSON.stringify([{ anchor: 1, target: 2, score: 0.9, reason: '理由' }]);
    expect(parseJudgePicks(one)).toMatchObject({ found: true, count: 1 });
    expect(parseJudgePicks(one).picks[0]).toMatchObject({ anchor: 1, target: 2, score: 0.9 });
    expect(parseJudgePicks(JSON.stringify([{ anchor: 'a1', target: 't2', score: '0.88', reason: '标签' }])).picks[0]).toMatchObject({
      anchor: 1,
      target: 2,
      score: 0.88,
    });
    expect(parseJudgePicks('')).toEqual({ found: false, count: 0, picks: [] });
    expect(parseJudgePicks('[{"foo":1}]')).toEqual({ found: true, count: 1, picks: [] });
  });
});

describe('aggregatePool（范围闸 / 自指 / 同笔记去重 / 多样性保底）', () => {
  it('范围闸只排除归档与网页剪藏；自指剔除；同笔记合并留最高分块', () => {
    const hits = [
      { seg: 0, query: 'q1', path: '归档/网页剪藏/噪声一.md', score: 0.99, chunk: '噪声' },
      { seg: 0, query: 'q1', path: '归档/旧物.md', score: 0.98, chunk: '归档' },
      { seg: 0, query: 'q1', path: `${CARDBOX}/A.md`, score: 0.97, chunk: '自指' }, // 主卡自身
      { seg: 0, query: 'q1', path: T1, score: 0.8, chunk: '块的低分片段' },
      { seg: 0, query: 'q2', path: T1, score: 0.95, chunk: '块的高分片段' },
      { seg: 1, query: 'q1', path: '主题盒/巴纳姆效应.md', score: 0.7, chunk: '主题盒邻居' },
    ];
    const pool = aggregatePool(hits, { selfPath: `${CARDBOX}/A.md` });
    const paths = pool.map((p) => p.path);
    expect(paths).not.toContain('归档/网页剪藏/噪声一.md');
    expect(paths).not.toContain('归档/旧物.md');
    expect(paths).not.toContain(`${CARDBOX}/A.md`);
    expect(paths).toContain('主题盒/巴纳姆效应.md'); // 范围闸是排除式：主题盒真邻居保留
    const t1 = pool.find((p) => p.path === T1)!;
    expect(t1.hitCount).toBe(2); // 双查询并集
    expect(t1.maxScore).toBe(0.95);
    expect(t1.snippet).toBe('块的高分片段');
  });

  it('排序「命中次数 → 最高分」+ 每片段最优保底（不能只看命中次数）', () => {
    // 泛泛被两个片段命中但分低；巴纳姆只被片段 1 命中但分高 → 保底让它进池（不被命中数挤出）
    const hits = [
      { seg: 0, query: 'q1', path: '文献盒/泛泛.md', score: 0.5, chunk: 'a' },
      { seg: 1, query: 'q1', path: '文献盒/泛泛.md', score: 0.5, chunk: 'a' },
      { seg: 1, query: 'q1', path: '主题盒/巴纳姆效应.md', score: 0.93, chunk: 'b' },
      { seg: 2, query: 'q1', path: '文献盒/另一个.md', score: 0.6, chunk: 'c' },
    ];
    // 池只放 2 条：命中数最高的「泛泛」+ 片段 1 的最优「巴纳姆」（另一个被裁掉）
    expect(aggregatePool(hits, { limit: 2 }).map((p) => p.path)).toEqual(['文献盒/泛泛.md', '主题盒/巴纳姆效应.md']);
    // 池够大时按「命中次数 → 最高分」排
    expect(aggregatePool(hits, { limit: 10 }).map((p) => p.path)).toEqual([
      '文献盒/泛泛.md',
      '主题盒/巴纳姆效应.md',
      '文献盒/另一个.md',
    ]);
  });
});

describe('locateInText（三级回定位）与标题校验降级', () => {
  it('① 精确 → ② 去空白/markdown → ③ 段落兜底；全失败返回 null', () => {
    const text = '**巴纳姆效应**是指人们倾向于认为模糊的人格描述精准地对应自己。\n\n下一段完全不相关的文字内容。';
    // ① 精确
    expect(locateInText(text, '是指人们倾向于认为模糊的人格描述精准地对应自己')).toMatchObject({ level: 1 });
    // ② 去 `**` 加粗（模型常把加粗去掉）
    const lvl2 = locateInText(text, '巴纳姆效应是指人们倾向于认为模糊的人格描述精准地对应自己');
    expect(lvl2?.level).toBe(2);
    // ③ 段落兜底（整句改写：只留下若干关键词 → 命中该段取原文）
    const lvl3 = locateInText(text, '巴纳姆效应 模糊 人格描述 对应自己');
    expect(lvl3?.level).toBe(3);
    expect(text.slice(lvl3!.at, lvl3!.at + lvl3!.len)).toContain('巴纳姆效应');
    expect(locateInText(text, '完全不在这篇里的一段话')).toBeNull();
    expect(locateInText(text, '')).toBeNull();
  });

  it('表格行被规范化成空格分隔也能回定位到该行', () => {
    const text = '| 维度 | 说明 |\n| --- | --- |\n| 证实偏差 | 只看见支持自己的证据 |\n\n另起一段。';
    const hit = locateInText(text, '证实偏差 只看见支持自己的证据');
    expect(hit).not.toBeNull();
    expect(text.slice(hit!.at, hit!.at + hit!.len)).toContain('证实偏差');
  });

  it('findHeadingText：标题不存在返回 null（落 `[[路径#标题]]` 前必须校验）', () => {
    const md = '# 总则\n\n正文。\n\n## 巴纳姆效应\n\n小节正文。\n\n## 其它\n\n其它。';
    expect(findHeadingText(md, '巴纳姆效应')).toBe('巴纳姆效应');
    expect(findHeadingText(md, '## 巴纳姆效应')).toBe('巴纳姆效应'); // 模型带井号也认
    expect(findHeadingText(md, '并不存在的标题')).toBeNull();
    expect(findHeadingText(md, '')).toBeNull();
  });
});

describe('sliceUnitText（幽灵节点正文：整篇 / 小节 / 摘录所在块）', () => {
  const md = '---\ntitle: 忽略我\n---\n\n# 总则\n\n总述一段。\n\n## 巴纳姆效应\n\n人们倾向于认为模糊描述精准对应自己，这是关键段落。\n\n## 其它\n\n其它内容。';

  it('整篇 = 完整正文（不另做预览上限）；标题 = 该小节；段落 = 摘录所在块', () => {
    const whole = sliceUnitText(md, { unit: 'whole' });
    expect(whole).not.toContain('---');
    expect(whole).toContain('# 总则');
    expect(whole).toContain('其它内容。');
    expect(sliceUnitText(md, { unit: 'heading', heading: '巴纳姆效应' })).toBe(
      '## 巴纳姆效应\n\n人们倾向于认为模糊描述精准对应自己，这是关键段落。'
    );
    expect(sliceUnitText(md, { unit: 'paragraph', quote: '人们倾向于认为模糊描述精准对应自己' })).toBe(
      '人们倾向于认为模糊描述精准对应自己，这是关键段落。'
    );
  });

  it('证据失效（标题不存在 / 摘录找不到）→ 降级整篇，绝不写瞎链接', () => {
    expect(sliceUnitText(md, { unit: 'heading', heading: '没有这个标题' })).toBe(sliceUnitText(md, { unit: 'whole' }));
    expect(sliceUnitText(md, { unit: 'paragraph', quote: '完全不存在的摘录' })).toBe(sliceUnitText(md, { unit: 'whole' }));
  });

  it('suggestionUnitMarkdown：理由 + 现读单元原文；目标已删只剩理由', async () => {
    vault.files.set(T1, md);
    const out = await suggestionUnitMarkdown(ctx.app, { target: T1, reason: '同一主题', unit: 'heading', heading: '巴纳姆效应' });
    expect(out.startsWith('> 同一主题')).toBe(true);
    expect(out).toContain('人们倾向于认为模糊描述精准对应自己');
    const missing = await suggestionUnitMarkdown(ctx.app, { target: '文献盒/不存在.md', reason: '理由' });
    expect(missing).toBe('> 理由');
  });
});

describe('suggestionLink（三形态落链接）与 blockIdFor / ensureSuggestionBlockId（幂等）', () => {
  it('整篇 `[[路径]]` / 标题 `[[路径#标题]]` / 段落 `[[路径#^块id]]`；缺证据降级整篇', () => {
    expect(suggestionLink({ target: T1, unit: 'whole' })).toBe(`[[${T1.replace(/\.md$/, '')}]]`);
    expect(suggestionLink({ target: T1, unit: 'heading', subpath: '巴纳姆效应' })).toBe('[[文献盒/目标一#巴纳姆效应]]');
    expect(suggestionLink({ target: T1, unit: 'paragraph', subpath: 'bz-1a2b3c4' })).toBe('[[文献盒/目标一#^bz-1a2b3c4]]');
    expect(suggestionLink({ target: T1, unit: 'heading', subpath: '' })).toBe('[[文献盒/目标一]]'); // 标题校验失败 → 整篇
    expect(suggestionLink({ target: T1, unit: 'paragraph', subpath: '' })).toBe('[[文献盒/目标一]]'); // 段落没定位到 → 整篇
  });

  it('块 id 确定性（`bz-` + 路径与段落文本哈希 8 位）', () => {
    const a = blockIdFor(T1, '同一段落文本');
    const b = blockIdFor(T1, '同一段落文本');
    expect(a).toBe(b);
    expect(a).toMatch(/^bz-[0-9a-z]{1,8}$/);
    expect(blockIdFor(T1, '另一段')).not.toBe(a);
    expect(blockIdFor(T2, '同一段落文本')).not.toBe(a);
  });

  it('补写块 id：挂在段落尾、幂等（第二次调用不再写）', async () => {
    vault.files.set(T1, '开头一段。\n\n这是要被锚定的目标段落，内容足够长。\n\n结尾一段。');
    const quote = '这是要被锚定的目标段落，内容足够长。';
    const first = await ensureSuggestionBlockId(ctx.app, T1, quote);
    expect(first.ok).toBe(true);
    const after = vault.files.get(T1)!;
    expect(after).toContain(`^${first.blockId}`);
    expect(after).toContain(`这是要被锚定的目标段落，内容足够长。 ^${first.blockId}`);
    expect(after).toContain('结尾一段。'); // 其余内容不动

    // 幂等：同段落再来一次 → 同一个 id，文件不再变化
    const before = after;
    const second = await ensureSuggestionBlockId(ctx.app, T1, quote);
    expect(second).toEqual(first);
    expect(vault.files.get(T1)).toBe(before);
    // 摘录带 `**` 噪声（非逐字）也能定位到同一段
    const third = await ensureSuggestionBlockId(ctx.app, T1, '这是要被**锚定的目标段落**，内容足够长。');
    expect(third.blockId).toBe(first.blockId);
  });

  it('目标不存在 / 摘录找不到 → ok=false（调用方按整篇降级）', async () => {
    expect(await ensureSuggestionBlockId(ctx.app, '文献盒/不存在.md', '某段')).toEqual({ blockId: '', ok: false });
    vault.files.set(T1, '只有一段完全无关的文字。');
    expect(await ensureSuggestionBlockId(ctx.app, T1, '完全不存在的摘录')).toEqual({ blockId: '', ok: false });
  });
});

describe('锚点别名套句：原地换成 `[[目标|原句]]`（不做句中追加）', () => {
  it('原词原地换成 `[[目标|原词]]`；带子路径也认；已是双链则原样（幂等）', () => {
    const body = '这里谈到证实偏差的危害。';
    expect(replaceAnchorWithAlias(body, { from: 4, to: 8, text: '证实偏差' }, T1)).toBe(
      `这里谈到[[${T1.replace(/\.md$/, '')}|证实偏差]]的危害。`
    );
    expect(replaceAnchorWithAlias(body, { from: 4, to: 8, text: '证实偏差' }, T1, '^bz-abc')).toBe(
      '这里谈到[[文献盒/目标一#^bz-abc|证实偏差]]的危害。'
    );
    expect(replaceAnchorWithAlias(`已链过 [[${T1.replace(/\.md$/, '')}]] 了，证实偏差`, { from: 0, to: 4, text: '证实偏差' }, T1)).toContain(
      `[[${T1.replace(/\.md$/, '')}]]`
    );
    expect(replaceAnchorWithAlias(body, { from: 0, to: 4, text: '不存在的词' }, T1)).toBeNull();
  });

  it('2026-09-15 口径扩到**整句**：长句锚点也原地套住（句读留在链接外）', () => {
    const sentence = '人们在算命时倾向于认为模糊的人格描述精准对应自己';
    const body = `${sentence}。后面还有别的句子。`;
    expect(replaceAnchorWithAlias(body, { from: 0, to: sentence.length, text: sentence }, T1)).toBe(
      `[[${T1.replace(/\.md$/, '')}|${sentence}]]。后面还有别的句子。`
    );
  });

  it('锚点句里含双链：不套（否则整段被吞成一条链接），返回 null 退回句中追加', () => {
    // 锚点文本是**清洗后**的（双链已变显示文本），正文里仍是 `[[…]]`：
    // ② 级（去空白/markdown）因 `flattenForMatch` 保留方括号而对不上 → 落到 ③ 级段落兜底，
    // 命中区间是整段——原地替换会把三条列表项压成一条链接（2026-09-15 审查发现）。
    const body = ['## 分期', '', '- N1/N2 是浅睡，[[睡眠纺锤波]] 出现在 N2', '- N3 又叫慢波睡眠', ''].join('\n');
    expect(replaceAnchorWithAlias(body, { from: 0, to: 23, text: 'N1/N2 是浅睡，睡眠纺锤波 出现在 N2' }, T1)).toBeNull();
    expect(body).toContain('- N3 又叫慢波睡眠'); // 原样未动（纯函数不改入参，这里只是把意图写清）
  });

  it('锚点里的单个方括号不拦（`[1] 脚注` 这类照套）；只有 `[[`/`]]` 才退', () => {
    const body = '结论见 [1] 脚注那一条。';
    expect(replaceAnchorWithAlias(body, { from: 0, to: 6, text: '结论见 [1] 脚注' }, T1)).toContain(`[[${T1.replace(/\.md$/, '')}|结论见 [1] 脚注]]`);
  });
});

describe('suggestKey / suggestionId（单元粒度）', () => {
  it('suggestKey：同文本不同偏移同键；目标归一；**单元不同则键不同**', () => {
    const a = { anchor: { from: 0, to: 8, text: '机器学习是人工智能的分支' }, target: '文献盒/某笔记.md' };
    const b = { anchor: { from: 120, to: 128, text: ' 机器学习是人工智能的分支 ' }, target: '文献盒\\某笔记' };
    expect(suggestKey(a)).toBe(suggestKey(b));
    expect(suggestKey({ anchor: a.anchor, target: '文献盒/另一篇.md' })).not.toBe(suggestKey(a));
    expect(suggestKey({ anchor: a.anchor, target: '文献盒/某笔记.md', unit: 'whole' })).toBe(suggestKey(a));
    // 同一笔记的「整篇」与「某一段」不是同一条建议
    expect(suggestKey({ anchor: a.anchor, target: '文献盒/某笔记.md', quote: '段落摘录一' })).not.toBe(
      suggestKey({ anchor: a.anchor, target: '文献盒/某笔记.md', quote: '段落摘录二' })
    );
  });

  it('suggestionId：整篇 = `ai:<路径>`；同笔记的标题/段落各一个 id（不再互相顶掉）', () => {
    const anchor = { from: 0, to: 4, text: '锚点文本' };
    const whole = suggestionId({ target: T1, anchor });
    expect(whole).toBe(`ai:${T1}`);
    const h1 = suggestionId({ target: T1, subpath: '巴纳姆效应' });
    const h2 = suggestionId({ target: T1, subpath: '其它小节' });
    const p1 = suggestionId({ target: T1, quote: '段落摘录一' });
    const p2 = suggestionId({ target: T1, quote: '段落摘录二' });
    expect(new Set([whole, h1, h2, p1, p2]).size).toBe(5);
    expect(h1.startsWith(`ai:${T1}#`)).toBe(true);
    expect(suggestionId({ target: T1, subpath: '巴纳姆效应' })).toBe(h1); // 确定性
  });
});

describe('collectExistingTargets（(path, subpath) 粒度判重）', () => {
  it('保留 `#子路径`；已有 `[[x#A]]` 不该杀掉 `x#B` 的建议', () => {
    const body = '看 [[文献盒/甲#第一节]] 与 [[文献盒/甲#第二节|别名]] 还有 [[卡片盒/乙]]。';
    expect(collectExistingTargets(body)).toEqual(['文献盒/甲#第一节', '文献盒/甲#第二节', '卡片盒/乙']);
    // 已链过**子路径** ≠ 已链整篇：整篇建议照样推（只有整篇链才封死该笔记）
    expect(
      filterSuggestions([mk('锚点文本内容足够长', '文献盒/甲.md')], {
        dismissed: [],
        existing: collectExistingTargets(body),
      })
    ).toHaveLength(1);
  });

  it('已链整篇 → 该笔记一切单元都不推；已链同一单元 → 只挡这一条', () => {
    const anchor = { from: 0, to: 8, text: '锚点文本内容' };
    const para = (quote: string): MountSuggestion => ({
      anchor,
      target: '文献盒/甲.md',
      kind: 'para',
      reason: 'r',
      score: 0.9,
      state: 'pending',
      unit: 'paragraph',
      quote,
    });
    const onlyA = filterSuggestions([para('摘录甲'), para('摘录乙')], { dismissed: [], existing: ['文献盒/甲#^块甲'] });
    expect(onlyA).toHaveLength(2); // 只挡同 subpath 的，缓存片里 subpath 为空 → 两条都留
    const withSub = (quote: string, subpath: string): MountSuggestion => ({ ...para(quote), subpath });
    expect(filterSuggestions([withSub('摘录甲', '^块甲'), withSub('摘录乙', '^块乙')], { dismissed: [], existing: ['文献盒/甲#^块甲'] })).toHaveLength(1);
    expect(filterSuggestions([withSub('摘录甲', '^块甲')], { dismissed: [], existing: ['文献盒/甲'] })).toHaveLength(0);
  });
});

describe('inRecallScope（召回范围闸：只排除归档 / 网页剪藏）', () => {
  it('卡片盒 / 文献盒 / 主题盒都在范围内；归档与网页剪藏不在', () => {
    expect(inRecallScope(`${CARDBOX}/A.md`)).toBe(true);
    expect(inRecallScope(`${LIT}/某篇.md`)).toBe(true);
    expect(inRecallScope('主题盒/巴纳姆效应.md')).toBe(true);
    expect(inRecallScope('归档/网页剪藏/噪声.md')).toBe(false);
    expect(inRecallScope('归档/旧物.md')).toBe(false);
    expect(inRecallScope('网页剪藏/某.md')).toBe(false);
    expect(inRecallScope('')).toBe(false);
  });
});

describe('进度契约（onProgress / 阶段文案）', () => {
  it('阶段文案与百分比按阶段推进', () => {
    expect(suggestProgressLabel({ stage: 'query', label: '' })).toBe('查询官：为正文片段生成检索查询');
    expect(suggestProgressLabel({ stage: 'recall', label: '', done: 3, total: 8 })).toBe('检索：召回候选笔记（3/8）');
    expect(suggestProgressPercent({ stage: 'query', label: '' })).toBe(15);
    expect(suggestProgressPercent({ stage: 'recall', label: '', done: 4, total: 8 })).toBeGreaterThan(15);
    expect(suggestProgressPercent({ stage: 'recall', label: '', done: 8, total: 8 })).toBe(40);
    expect(suggestProgressPercent({ stage: 'save', label: '' })).toBe(100);
  });
});

describe('generateSuggestions（三段式 + 缓存 + 逐卡失效）', () => {
  beforeEach(() => {
    vault.files.set(`${CARDBOX}/A.md`, BODY_A);
    vault.files.set(`${CARDBOX}/B.md`, BODY_B);
    mocks.search.mockResolvedValue([{ path: T1, chunk: '目标一的一段', score: 0.9 }]);
  });

  it('首跑 fresh 并落缓存；二跑 cached 不重复检索；改哪张卡只失效那张', async () => {
    aiPass(adoptRaw([{ seg: 1, path: T1, reason: '同一主题' }]));
    const run1 = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run1.status).toBe('fresh');
    expect(run1.suggestions).toHaveLength(1);
    expect(run1.suggestions[0]).toMatchObject({
      target: T1,
      kind: 'note', // 文献盒整篇 = note（321 起不再一律判 para）
      score: 0.9,
      reason: '同一主题',
      state: 'pending',
      unit: 'whole', // 定位官没给可用回答 → 整篇兜底
    });
    expect(run1.suggestions[0].anchor.text).toBe(ANCHOR_A1);
    const callsAfterA = mocks.search.mock.calls.length;

    const run2 = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run2.status).toBe('cached');
    expect(run2.suggestions).toHaveLength(1);
    expect(run2.generatedAt).toBe(run1.generatedAt);
    expect(mocks.search.mock.calls.length).toBe(callsAfterA); // 命中缓存不重跑

    aiPass(adoptRaw([{ seg: 1, path: T1, reason: '同一主题' }]));
    const runB = await generateSuggestions(`${CARDBOX}/B.md`, ctx);
    expect(runB.status).toBe('fresh');

    // 改 A 的正文（多一句）→ A 过期重跑，B 仍命中
    vault.files.set(`${CARDBOX}/A.md`, `${BODY_A}这是新增的一句足够长的话。`);
    aiPass(adoptRaw([{ seg: 1, path: T1, reason: '同一主题' }]));
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).status).toBe('fresh');
    expect((await generateSuggestions(`${CARDBOX}/B.md`, ctx)).status).toBe('cached');

    const cache = await readSuggestCache();
    expect(Object.keys(cache.cards).sort()).toEqual([`${CARDBOX}/A.md`, `${CARDBOX}/B.md`]);
    const entryB = cache.cards[`${CARDBOX}/B.md`];
    expect(cacheValid(entryB, entryB.bodyHash)).toBe(true);
    expect(cacheValid(entryB, String(hash31(BODY_A)))).toBe(false);
    expect(cacheValid(undefined, entryB.bodyHash)).toBe(false);
  });

  it('卡片盒内目标 → card 形态；主卡读不到 → fresh 空结果且不落缓存', async () => {
    vault.files.set(`${CARDBOX}/C.md`, '丙卡正文');
    mocks.search.mockResolvedValue([{ path: `${CARDBOX}/C.md`, chunk: '丙卡的一段', score: 0.9 }]);
    aiPass(adoptRaw([{ seg: 1, path: `${CARDBOX}/C.md` }]));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.suggestions[0].kind).toBe('card');

    const missing = await generateSuggestions(`${CARDBOX}/不存在.md`, ctx);
    expect(missing).toEqual({ status: 'fresh', suggestions: [] });
    expect((await readSuggestCache()).cards[`${CARDBOX}/不存在.md`]).toBeUndefined();
  });

  it('标题形态：标题校验通过落 `#标题`；标题不存在 → 降级整篇（绝不写 `[[x#]]`）', async () => {
    vault.files.set(T1, '# 总则\n\n总述。\n\n## 巴纳姆效应\n\n人们倾向于认为模糊描述精准对应自己。');
    // ① 标题真实存在
    aiPass(
      adoptRaw([{ seg: 1, path: T1 }]),
      JSON.stringify([{ n: 1, unit: 'heading', heading: '巴纳姆效应', anchor: ANCHOR_A1, reason: '小节相关' }])
    );
    const ok = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(ok.suggestions).toHaveLength(1);
    expect(ok.suggestions[0]).toMatchObject({ unit: 'heading', heading: '巴纳姆效应', subpath: '巴纳姆效应', kind: 'head' });
    expect(suggestionLink(ok.suggestions[0])).toBe('[[文献盒/目标一#巴纳姆效应]]');

    // ② 标题不存在 → 降级整篇
    aiPass(
      adoptRaw([{ seg: 1, path: T1 }]),
      JSON.stringify([{ n: 1, unit: 'heading', heading: '并不存在的小节', anchor: ANCHOR_A1, reason: '小节相关' }])
    );
    const degraded = await generateSuggestions(`${CARDBOX}/A.md`, ctx, { force: true });
    expect(degraded.suggestions[0]).toMatchObject({ unit: 'whole', heading: '', subpath: '' });
    expect(suggestionLink(degraded.suggestions[0])).toBe('[[文献盒/目标一]]');
  });

  it('段落形态：摘录能回定位就留证据（块 id 固定时才写）；定位不到 → 降级整篇', async () => {
    vault.files.set(T1, '开头一段。\n\n人们倾向于认为模糊描述精准对应自己，这是关键句。\n\n结尾。');
    aiPass(
      adoptRaw([{ seg: 1, path: T1 }]),
      JSON.stringify([
        { n: 1, unit: 'paragraph', quote: '人们倾向于认为模糊描述精准对应自己', anchor: ANCHOR_A1, reason: '段落相关' },
      ])
    );
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.suggestions[0]).toMatchObject({ unit: 'paragraph', kind: 'para', subpath: '' });
    expect(run.suggestions[0].quote).toBe('人们倾向于认为模糊描述精准对应自己');
    expect(vault.files.get(T1)).not.toContain('^bz-'); // 生成阶段**不写**目标文件

    aiPass(
      adoptRaw([{ seg: 1, path: T1 }]),
      JSON.stringify([{ n: 1, unit: 'paragraph', quote: '这篇里根本没有的摘录', anchor: ANCHOR_A1, reason: '段落相关' }])
    );
    const degraded = await generateSuggestions(`${CARDBOX}/A.md`, ctx, { force: true });
    expect(degraded.suggestions[0]).toMatchObject({ unit: 'whole', quote: '' });
  });

  it('定位官 skip → 该条不生成；全部 skip → 空结果仍落缓存', async () => {
    aiPass(
      adoptRaw([{ seg: 1, path: T1 }]),
      JSON.stringify([{ n: 1, skip: true, reason: '泛泛相关，否决' }])
    );
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('fresh');
    expect(run.suggestions).toEqual([]);
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).status).toBe('cached');
  });

  it('查询官给的双查询都送检索（召回面更宽）；查询官不可用 → 机械分句兜底不硬失败', async () => {
    aiPass(
      adoptRaw([{ seg: 1, path: T1 }]),
      null,
      JSON.stringify([{ seg: 1, sentence: '卡片盒是思考的组织核心与统计方法重叠', keywords: '卡片盒 统计 重叠' }])
    );
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.suggestions).toHaveLength(1);
    const queries = mocks.search.mock.calls.map((c) => String(c[0]));
    expect(queries).toContain('卡片盒是思考的组织核心与统计方法重叠');
    expect(queries).toContain('卡片盒 统计 重叠');

    // 查询官空回答：仍用锚点原文当查询走完链路
    mocks.search.mockClear();
    mocks.answers.length = 0;
    aiPass(adoptRaw([{ seg: 1, path: T1 }]), null, '抱歉，我无法判断。');
    const fallback = await generateSuggestions(`${CARDBOX}/B.md`, ctx);
    expect(fallback.suggestions).toHaveLength(1);
    expect(mocks.search.mock.calls.map((c) => String(c[0]))).toContain('乙卡正文：这是唯一一段足够长的锚点句子');
  });

  it('已存在的双链目标 / 失效目标不送采纳官（只跑到查询官）', async () => {
    vault.files.set(`${CARDBOX}/A.md`, `甲卡正文：这是第一段足够长的锚点句子，参见 [[目标一]]。这是第二段足够长的锚点句子。`);
    mocks.search.mockResolvedValue([
      { path: T1, chunk: '一', score: 0.9 },
      { path: '文献盒/已删除.md', chunk: '二', score: 0.8 },
    ]);
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('fresh');
    expect(run.suggestions).toEqual([]);
    expect(mocks.judge).toHaveBeenCalledTimes(1); // 只有查询官；候选池空 → 不再叫采纳官
  });

  it('采纳官回答不可用（散文 / 空串 / 认不出）→ no-answer 且不落缓存；下次重开仍重跑', async () => {
    aiPass('抱歉，我无法判断。');
    expect(await generateSuggestions(`${CARDBOX}/A.md`, ctx)).toEqual({ status: 'no-answer', suggestions: [] });
    expect((await readSuggestCache()).cards).toEqual({});

    aiPass('');
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).status).toBe('no-answer');

    aiPass(JSON.stringify([{ a: 'x', b: 'y' }])); // 有数组但整批认不出
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).status).toBe('no-answer');
    expect((await readSuggestCache()).cards).toEqual({});

    // 采纳官调用失败（通道不可用）→ no-ai，同样不落缓存
    mocks.answers.length = 0;
    mocks.judge.mockReset();
    mocks.judge.mockResolvedValueOnce('[]').mockRejectedValue(new Error('网络不可达'));
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).status).toBe('no-ai');
    expect(mocks.judge).toHaveBeenCalledTimes(2); // 查询官 + 失败的采纳官
    expect((await readSuggestCache()).cards).toEqual({});
  });

  it('采纳官 a1 标签作答 + json_object 包壳 → 照样认出来（318 实机回归）', async () => {
    mocks.search.mockResolvedValue([
      { path: T1, chunk: '一', score: 0.9 },
      { path: T2, chunk: '二', score: 0.85 },
    ]);
    aiPass(JSON.stringify([{ seg: 'a1', path: T2, score: 0.9, reason: '同一主题' }]));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('fresh');
    expect(run.suggestions.map((s) => s.target)).toEqual([T2]);

    aiPass(JSON.stringify({ type: 'json_object', content: JSON.stringify([{ seg: 1, path: T1, score: 0.9, reason: '同主题' }]) }));
    const run2 = await generateSuggestions(`${CARDBOX}/A.md`, ctx, { force: true });
    expect(run2.status).toBe('fresh');
    expect(run2.suggestions.map((s) => s.target)).toEqual([T1]);
  });

  it('AI 调用：走 prompt 纯文本通道（不带 json_object）+ low 思考档 + 预算 131072', async () => {
    aiPass(adoptRaw([{ seg: 1, path: T1 }]));
    await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(mocks.jsonForced).not.toHaveBeenCalled(); // 哨兵：不得改用 json()（实测会吐空壳 → 零建议）
    const opts = mocks.judge.mock.calls[0][2] as { modelOptions: Record<string, unknown> }; // prompt(input, model, options)
    expect(opts.modelOptions.max_tokens).toBe(SUGGEST_JUDGE_MAX_TOKENS);
    expect(opts.modelOptions.max_tokens).toBeGreaterThanOrEqual(131072);
    expect(opts.modelOptions.reasoning_effort).toBe(SUGGEST_REASONING_EFFORT); // low：默认档 143s → 7s
    expect(opts.modelOptions.thinking).toBeUndefined(); // 绝不关思考（关了会退回 a1/t2 标签式作答）
  });

  it('onProgress 按阶段推进（query → recall → adopt → locate → save）', async () => {
    aiPass(adoptRaw([{ seg: 1, path: T1 }]));
    const seen: SuggestProgress[] = [];
    await generateSuggestions(`${CARDBOX}/A.md`, ctx, { onProgress: (p) => seen.push(p) });
    // 两个片段 × 机械分句的单查询 = 2 次检索 tick
    expect(seen.map((p) => p.stage)).toEqual(['query', 'query', 'recall', 'recall', 'adopt', 'locate', 'locate', 'save']);
    expect(seen[0].total).toBe(2); // 两个片段
    expect(seen.every((p) => !!p.label)).toBe(true);
  });

  it('缓存版本不符（旧口径的零候选片）→ 视为失效重跑，不靠用户手清', async () => {
    const body = vault.files.get(`${CARDBOX}/A.md`)!;
    // 手工造一条 v2 旧片：bodyHash 对得上但版本不符（= 321 前的零候选片）
    const oldEntry = { bodyHash: String(hash31(body)), generatedAt: 1, suggestions: [], ver: SUGGEST_CACHE_VERSION - 1 };
    expect(cacheValid(oldEntry as never, String(hash31(body)))).toBe(false);
    expect(cacheValid({ ...oldEntry, ver: SUGGEST_CACHE_VERSION } as never, String(hash31(body)))).toBe(true);
    vault.files.set(`CONFIG/STORAGE/${SUGGEST_CACHE_FILE}`, JSON.stringify({ cards: { [`${CARDBOX}/A.md`]: oldEntry } }));

    aiPass(adoptRaw([{ seg: 1, path: T1, reason: '重跑出来' }]));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('fresh'); // 不是 cached——旧片不认
    expect(run.suggestions).toHaveLength(1);
    const cache = await readSuggestCache();
    expect(cache.cards[`${CARDBOX}/A.md`].ver).toBe(SUGGEST_CACHE_VERSION);
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).status).toBe('cached');
  });

  it('向量检索抛错 → no-index 且不落缓存（瞬时故障不污染缓存）', async () => {
    mocks.search.mockRejectedValue(new Error('embedding 服务不可达'));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('no-index');
    expect((await readSuggestCache()).cards).toEqual({});
  });

  it('分句结果为空（纯符号正文）→ fresh 空结果并落缓存', async () => {
    vault.files.set(`${CARDBOX}/D.md`, '***\n---\n###\n');
    const run = await generateSuggestions(`${CARDBOX}/D.md`, ctx);
    expect(run.status).toBe('fresh');
    expect(run.suggestions).toEqual([]);
    expect(mocks.search).not.toHaveBeenCalled();
    expect((await generateSuggestions(`${CARDBOX}/D.md`, ctx)).status).toBe('cached');
  });
});

describe('markSuggestion（固定/取消都留档，取消进否决表）', () => {
  beforeEach(() => {
    vault.files.set(`${CARDBOX}/A.md`, BODY_ONE); // 单锚点正文：配对过滤的断言才干净
    vault.files.set(`${CARDBOX}/B.md`, BODY_ONE); // 同锚点文本：验证否决跨卡生效
    mocks.search.mockResolvedValue([
      { path: T1, chunk: '一', score: 0.9 },
      { path: T2, chunk: '二', score: 0.85 },
    ]);
  });

  it('取消 → 永不再推（含跨编辑/跨卡）；固定 → 留档且不重复推', async () => {
    aiPass(adoptRaw([
      { seg: 1, path: T1, reason: '理由一' },
      { seg: 1, path: T2, reason: '理由二' },
    ]));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.suggestions).toHaveLength(2);
    const [s1, s2] = run.suggestions;
    await markSuggestion(`${CARDBOX}/A.md`, s1, 'dismissed', ctx);
    await markSuggestion(`${CARDBOX}/A.md`, s2, 'fixed', ctx);

    const cache = await readSuggestCache();
    const states = cache.cards[`${CARDBOX}/A.md`].suggestions.map((s) => [s.target, s.state]);
    expect(states).toContainEqual([T1, 'dismissed']);
    expect(states).toContainEqual([T2, 'fixed']);

    // 强制重跑：两条配对都被挡在采纳之后（否决 + 已固定），处置留档仍在
    aiPass(adoptRaw([
      { seg: 1, path: T1, reason: '理由一' },
      { seg: 1, path: T2, reason: '理由二' },
    ]));
    const rerun = await generateSuggestions(`${CARDBOX}/A.md`, ctx, { force: true });
    expect(rerun.status).toBe('fresh');
    expect(rerun.suggestions).toEqual([]);
    const after = await readSuggestCache();
    expect(after.cards[`${CARDBOX}/A.md`].suggestions.filter((s) => s.state !== 'pending')).toHaveLength(2);

    // 正文追加一句（锚点文本不变）：否决键不吃偏移，仍被挡掉
    vault.files.set(`${CARDBOX}/A.md`, `${BODY_ONE}追加的一句足够长的话。`);
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).suggestions).toEqual([]);

    // 另一张卡出现同一「锚点 → 目标」：否决跨卡生效（目标一不推）；固定只在本卡留档 → 只推目标二
    aiPass(adoptRaw([
      { seg: 1, path: T1, reason: '理由一' },
      { seg: 1, path: T2, reason: '理由二' },
    ]));
    const runB = await generateSuggestions(`${CARDBOX}/B.md`, ctx);
    expect(runB.suggestions.map((s) => s.target)).toEqual([T2]);
  });

  it('无缓存片时处置也留档（建无效片，下次生成照常重跑）', async () => {
    await markSuggestion(`${CARDBOX}/A.md`, mk(ANCHOR_A1, T1), 'dismissed', ctx);
    const cache = await readSuggestCache();
    expect(cache.cards[`${CARDBOX}/A.md`].bodyHash).toBe('');
    expect(cacheValid(cache.cards[`${CARDBOX}/A.md`], String(hash31(BODY_ONE)))).toBe(false);
    aiPass(adoptRaw([
      { seg: 1, path: T1, reason: '理由一' },
      { seg: 1, path: T2, reason: '理由二' },
    ]));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('fresh');
    expect(run.suggestions.map((s) => s.target)).toEqual([T2]);
    expect(mocks.judge).toHaveBeenCalledTimes(3); // 查询官 + 采纳官 + 定位官
  });
});

describe('降级与设置开关', () => {
  beforeEach(() => {
    vault.files.set(`${CARDBOX}/A.md`, BODY_A);
    mocks.search.mockResolvedValue([{ path: T1, chunk: '一', score: 0.9 }]);
  });

  it('无向量索引（未注册/未就绪）→ no-index，空候选，不检索不落缓存', async () => {
    setVectorSearchSource(null); // 未注册（第二大脑未初始化/已卸载）
    expect(await generateSuggestions(`${CARDBOX}/A.md`, ctx)).toEqual({ status: 'no-index', suggestions: [] });
    setVectorSearchSource({ isIndexReady: () => false, search: mocks.search }); // 已注册但未就绪
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('no-index');
    expect(run.suggestions).toEqual([]);
    expect(mocks.search).not.toHaveBeenCalled();
    expect((await readSuggestCache()).cards).toEqual({});
  });

  it('移动端 → no-index（索引就绪也不跑）', async () => {
    (Platform as any).isMobile = true;
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run).toEqual({ status: 'no-index', suggestions: [] });
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it('无可用 AI 通道 → no-ai，空候选，不检索不落缓存', async () => {
    mocks.aiOk = false;
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run).toEqual({ status: 'no-ai', suggestions: [] });
    expect(mocks.search).not.toHaveBeenCalled();
    expect((await readSuggestCache()).cards).toEqual({});
  });

  it('knowledgeMountAutoSuggest 关闭：被调用时返回 off（不冒充已缓存）；显式 force 才继续', async () => {
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', knowledgeMountAutoSuggest: false }) as any);
    const off = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(off).toEqual({ status: 'off', suggestions: [] });
    expect(mocks.search).not.toHaveBeenCalled();
    aiPass(adoptRaw([{ seg: 1, path: T1 }]));
    const forced = await generateSuggestions(`${CARDBOX}/A.md`, ctx, { force: true });
    expect(forced.status).toBe('fresh');
    expect(forced.suggestions).toHaveLength(1);
  });
});

describe('mergeSuggestions（幽灵节点 + 虚线边）与 clearSuggestCache', () => {
  it('未在树中的目标补幽灵节点与虚线边；同目标同单元去重；已在树中/根自身不画；不改原树', () => {
    const tree: MountTree = {
      root: 'r',
      direction: 'downstream',
      nodes: [
        { id: 'r', path: `${CARDBOX}/A.md`, title: 'A', kind: 'card', source: 'self', depth: 0, anchor: null, missing: false, suggested: false, attached: false, body: '正文', parent: null },
        { id: 'n1', path: T1, title: '目标一', kind: 'note', source: 'link', depth: 1, anchor: null, missing: false, suggested: false, attached: false, body: null, parent: 'r' },
      ],
      edges: [{ from: 'r', to: 'n1', suggested: false }],
    };
    const run: SuggestRun = {
      status: 'fresh',
      suggestions: [
        { anchor: { from: 0, to: 3, text: '锚点甲' }, target: T2, kind: 'note', reason: 'r', score: 0.9, state: 'pending' },
        { anchor: { from: 4, to: 7, text: '锚点乙' }, target: T2, kind: 'note', reason: 'r', score: 0.8, state: 'pending' },
        { anchor: { from: 8, to: 11, text: '锚点丙' }, target: T1, kind: 'note', reason: 'r', score: 0.8, state: 'pending' },
        { anchor: { from: 12, to: 15, text: '锚点丁' }, target: `${CARDBOX}/A.md`, kind: 'card', reason: 'r', score: 0.8, state: 'pending' },
      ],
    };
    const merged = mergeSuggestions(tree, run);
    expect(tree.nodes).toHaveLength(2); // 原树未被改动
    expect(tree.edges).toHaveLength(1);
    expect(merged.nodes).toHaveLength(3); // 目标一已在树中 → 不画；根自身 → 不画；目标二两条整篇建议同 id → 只画一个
    expect(merged.edges).toHaveLength(2);
    const ghost = merged.nodes[2];
    expect(ghost).toMatchObject({
      id: `ai:${T2}`,
      path: T2,
      title: '目标二',
      kind: 'note',
      source: 'ai',
      depth: 1,
      suggested: true,
      attached: false,
      missing: false,
      body: null,
    });
    expect(ghost.anchor).toEqual({ from: 0, to: 3, text: '锚点甲' });
    expect(merged.edges[1]).toEqual({ from: 'r', to: `ai:${T2}`, suggested: true });
    expect(merged.root).toBe('r');
    expect(merged.direction).toBe('downstream');
    expect(mergeSuggestions(tree, { status: 'cached', suggestions: [] }).nodes).toHaveLength(2);
  });

  it('同一笔记的两个段落建议 → 两个幽灵节点（单元不同不再互相顶掉）', () => {
    const tree: MountTree = { root: 'r', direction: 'downstream', nodes: [], edges: [] };
    const run: SuggestRun = {
      status: 'fresh',
      suggestions: [
        { anchor: { from: 0, to: 3, text: '锚点甲' }, target: T1, kind: 'para', reason: 'r', score: 0.9, state: 'pending', unit: 'paragraph', quote: '段落摘录一' },
        { anchor: { from: 4, to: 7, text: '锚点乙' }, target: T1, kind: 'para', reason: 'r', score: 0.85, state: 'pending', unit: 'paragraph', quote: '段落摘录二' },
        { anchor: { from: 8, to: 11, text: '锚点丙' }, target: T1, kind: 'head', reason: 'r', score: 0.8, state: 'pending', unit: 'heading', heading: '某小节', subpath: '某小节' },
      ],
    };
    const merged = mergeSuggestions(tree, run);
    expect(merged.nodes).toHaveLength(3);
    expect(new Set(merged.nodes.map((n) => n.id)).size).toBe(3);
    expect(merged.nodes[0].title).toBe('段落摘录一'); // 段落：摘录作标题
    expect(merged.nodes[2].title).toBe('某小节'); // 标题：小节名作标题
  });

  it('clearSuggestCache：只清候选与生成时间，fixed/dismissed 留档保留 → 同一条不再出现', async () => {
    vault.files.set(`${CARDBOX}/A.md`, BODY_ONE);
    mocks.search.mockResolvedValue([{ path: T1, chunk: '一', score: 0.9 }]);
    aiPass(adoptRaw([{ seg: 1, path: T1, reason: '理由' }]));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    await markSuggestion(`${CARDBOX}/A.md`, run.suggestions[0], 'dismissed', ctx);

    await clearSuggestCache();
    const entry = (await readSuggestCache()).cards[`${CARDBOX}/A.md`];
    expect(entry.bodyHash).toBe(''); // 片失效 → 下次必然重算
    expect(entry.generatedAt).toBe(0);
    expect(entry.suggestions.map((s) => s.state)).toEqual(['dismissed']); // 留档保留

    // 重算：候选被否决表挡掉 → 同一条「锚点 → 目标」不再出现（ADR-0139 §3 永久不再推）
    aiPass(adoptRaw([{ seg: 1, path: T1, reason: '理由' }]));
    const again = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(again.status).toBe('fresh');
    expect(again.suggestions).toEqual([]);

    // 无任何留档的片整片删除（纯 pending 缓存被清干净）
    vault.files.set(`${CARDBOX}/B.md`, BODY_B);
    aiPass(adoptRaw([{ seg: 1, path: T1, reason: '理由' }]));
    expect((await generateSuggestions(`${CARDBOX}/B.md`, ctx)).suggestions).toHaveLength(1);
    await clearSuggestCache();
    const after = await readSuggestCache();
    expect(after.cards[`${CARDBOX}/B.md`]).toBeUndefined();
    expect(after.cards[`${CARDBOX}/A.md`].suggestions).toHaveLength(1);
  });
});
