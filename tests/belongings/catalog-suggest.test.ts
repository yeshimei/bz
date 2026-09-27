// @vitest-environment node
/**
 * 归物本归类编排（src/belongings/catalog-suggest.ts，issue 478 阶段 B）：
 * 严格覆盖「null=无表回落 / 抛错=有表未成功」的语义分流，以及两次 Jev + 哨兵 + LLM 表内回落。
 * mock 掉 core/jev（askJev / isJevConfigured）与 core/ai（createAI），不真联网。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { suggestCategoryByCatalog, buildCatSuggest } from '../../src/belongings/catalog-suggest';
import * as jev from '../../src/core/jev';
import * as aiMod from '../../src/core/ai';
import * as categoryTable from '../../src/core/category-table';

// 部分 mock：保留真实 matchByAlias / groupMenu / itemMenu，只替换 loadCategoryTable
vi.mock('../../src/core/category-table', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/core/category-table')>();
  return { ...real, loadCategoryTable: vi.fn() };
});
vi.mock('../../src/core/jev', () => ({
  askJev: vi.fn(),
  isJevConfigured: vi.fn(),
}));
vi.mock('../../src/core/ai', () => ({
  createAI: vi.fn(),
}));

const askJev = vi.mocked(jev.askJev);
const isJevConfigured = vi.mocked(jev.isJevConfigured);
const createAI = vi.mocked(aiMod.createAI);
const loadCategoryTable = vi.mocked(categoryTable.loadCategoryTable);

const jsonMock = vi.fn();

const table = {
  version: '1',
  groups: [
    {
      id: 'g1',
      name: '数码',
      icon: 'smartphone',
      items: [
        { id: 'c1', name: '手机', icon: 'smartphone', aliases: ['电话', '移动电话'] },
        { id: 'c2', name: '电脑', icon: 'laptop', aliases: ['笔记本'] },
      ],
    },
    {
      id: 'g2',
      name: '家居',
      icon: 'sofa',
      items: [{ id: 'c3', name: '沙发', icon: 'sofa', aliases: [] }],
    },
  ],
};

const groupAns = (choice: string): any => ({
  model: 'm',
  answers: { group: { type: 'choice', choice, confidence: 1, probabilities: {} } },
});
const itemAns = (choice: string): any => ({
  model: 'm',
  answers: { item: { type: 'choice', choice, confidence: 1, probabilities: {} } },
});

beforeEach(() => {
  vi.clearAllMocks();
  isJevConfigured.mockReturnValue(true);
  loadCategoryTable.mockResolvedValue(table as any);
  createAI.mockReturnValue({ json: jsonMock } as any);
});

describe('suggestCategoryByCatalog', () => {
  it('1) 别名直配命中 → 返回表里那条且 askJev 零调用', async () => {
    const r = await suggestCategoryByCatalog({}, '电话', []);
    expect(r).toEqual({ category: '手机', icon: 'smartphone' });
    expect(askJev).not.toHaveBeenCalled();
  });

  it('2) 两次 choice 都命中 → 返回的是表里那条 name 与 icon（不是 id / 组名）', async () => {
    askJev
      .mockResolvedValueOnce(groupAns('g1'))
      .mockResolvedValueOnce(itemAns('c1'));
    const r = await suggestCategoryByCatalog({}, '一个叫不出名的东西', []);
    expect(r).toEqual({ category: '手机', icon: 'smartphone' });
    expect(askJev).toHaveBeenCalledTimes(2);
  });

  it('3) 第一次命中哨兵 → 转 LLM 回落，候选集是全表', async () => {
    askJev.mockResolvedValueOnce(groupAns('__other__'));
    jsonMock.mockResolvedValueOnce(JSON.stringify({ category: '沙发', icon: 'sofa' }));
    const r = await suggestCategoryByCatalog({}, '不明物体', []);
    expect(r).toEqual({ category: '沙发', icon: 'sofa' });
    const prompt = jsonMock.mock.calls[0][0] as string;
    expect(prompt).toContain('手机');
    expect(prompt).toContain('电脑');
    expect(prompt).toContain('沙发');
    expect(askJev).toHaveBeenCalledTimes(1);
  });

  it('4) 第二次命中哨兵 → 转 LLM 回落，候选集只含该组', async () => {
    askJev
      .mockResolvedValueOnce(groupAns('g1'))
      .mockResolvedValueOnce(itemAns('__other__'));
    jsonMock.mockResolvedValueOnce(JSON.stringify({ category: '电脑', icon: 'laptop' }));
    const r = await suggestCategoryByCatalog({}, '某个物件', []);
    expect(r).toEqual({ category: '电脑', icon: 'laptop' });
    const prompt = jsonMock.mock.calls[0][0] as string;
    expect(prompt).toContain('手机');
    expect(prompt).toContain('电脑');
    expect(prompt).not.toContain('沙发'); // 家居组的分类不应出现
    expect(prompt).not.toContain('家居');
  });

  it('5) Jev 未配置 → 直接 LLM 回落，askJev 零调用', async () => {
    isJevConfigured.mockReturnValue(false);
    jsonMock.mockResolvedValueOnce(JSON.stringify({ category: '手机', icon: 'smartphone' }));
    const r = await suggestCategoryByCatalog({}, 'x', []);
    expect(r).toEqual({ category: '手机', icon: 'smartphone' });
    expect(askJev).not.toHaveBeenCalled();
  });

  it('6) askJev 第一次抛错 → LLM 回落（不半途失败，只调了一次 Jev）', async () => {
    askJev.mockRejectedValueOnce(new Error('network down'));
    jsonMock.mockResolvedValueOnce(JSON.stringify({ category: '电脑', icon: 'laptop' }));
    const r = await suggestCategoryByCatalog({}, 'x', []);
    expect(r).toEqual({ category: '电脑', icon: 'laptop' });
    expect(askJev).toHaveBeenCalledTimes(1);
  });

  it('7) askJev 返回 criteria 外的畸形键 → LLM 回落', async () => {
    askJev.mockResolvedValueOnce(groupAns('zzz-out-of-range'));
    jsonMock.mockResolvedValueOnce(JSON.stringify({ category: '沙发', icon: 'sofa' }));
    const r = await suggestCategoryByCatalog({}, 'x', []);
    expect(r).toEqual({ category: '沙发', icon: 'sofa' });
    expect(askJev).toHaveBeenCalledTimes(1);
  });

  it('7b) 选类阶段返回畸形键 → 只回落该组', async () => {
    askJev
      .mockResolvedValueOnce(groupAns('g1'))
      .mockResolvedValueOnce(itemAns('zzz'));
    jsonMock.mockResolvedValueOnce(JSON.stringify({ category: '电脑', icon: 'laptop' }));
    const r = await suggestCategoryByCatalog({}, 'x', []);
    expect(r).toEqual({ category: '电脑', icon: 'laptop' });
    const prompt = jsonMock.mock.calls[0][0] as string;
    expect(prompt).not.toContain('沙发');
  });

  it('8) LLM 返回表外分类 → 抛错', async () => {
    askJev.mockResolvedValueOnce(groupAns('__other__'));
    jsonMock.mockResolvedValueOnce(JSON.stringify({ category: '火星基地', icon: 'rocket' }));
    await expect(suggestCategoryByCatalog({}, 'x', [])).rejects.toThrow();
  });

  it('9) 无表（loadCategoryTable 为 null）→ 返回 null 且不碰 Jev / LLM', async () => {
    loadCategoryTable.mockResolvedValue(null);
    const r = await suggestCategoryByCatalog({}, 'x', []);
    expect(r).toBeNull();
    expect(askJev).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
  });

  it('10) signal 已 aborted → 抛 AbortError 且不触发 LLM 回落', async () => {
    const ac = new AbortController();
    ac.abort();
    let err: any = null;
    try {
      await suggestCategoryByCatalog({}, 'x', [], { signal: ac.signal });
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeNull();
    expect(err.name).toBe('AbortError');
    expect(jsonMock).not.toHaveBeenCalled();
    expect(askJev).not.toHaveBeenCalled();
  });
});

// ═══════════ 联想源组装 buildCatSuggest（issue 488） ═══════════
// 纯函数：历史在前（频次序由调用方派生）、表内在后（组序=表序）、同名历史优先去重、
// 别名只作搜索关键词与副文本（不产生独立候选行）。
describe('buildCatSuggest 联想源', () => {
  const mkTable = {
    version: '0.1.0',
    groups: [
      {
        id: 'g1', name: '数码影音', icon: 'smartphone',
        items: [
          { id: 'c1', name: '移动电源', icon: 'battery-charging', aliases: ['充电宝'] },
          { id: 'c2', name: '智能手机', icon: 'smartphone', aliases: [] },
        ],
      },
      {
        id: 'g2', name: '工具五金', icon: 'wrench',
        items: [{ id: 'c3', name: '螺丝刀', icon: 'screwdriver-wrench', aliases: ['起子'] }],
      },
    ],
  } as any;

  it('历史在前 + 表内补齐；同名去重（历史优先）；图标历史 > 表', () => {
    const src = buildCatSuggest(
      ['自用电子', '移动电源'],
      (n) => (n === '移动电源' ? 'my-icon' : ''),
      mkTable,
    );
    expect(src.list).toEqual(['自用电子', '移动电源', '智能手机', '螺丝刀']); // 移动电源不重复；组序=表序
    expect(src.iconOf('移动电源')).toBe('my-icon'); // 历史记档优先
    expect(src.iconOf('螺丝刀')).toBe('screwdriver-wrench');
    expect(src.iconOf('自用电子')).toBe('');
    expect(src.hasTable).toBe(true);
  });

  it('别名 → keywordsOf / aliasHintOf；无别名候选为空', () => {
    const src = buildCatSuggest([], () => '', mkTable);
    expect(src.keywordsOf('移动电源')).toEqual(['充电宝']);
    expect(src.aliasHintOf('移动电源')).toBe('充电宝');
    expect(src.keywordsOf('智能手机')).toEqual([]);
    expect(src.aliasHintOf('智能手机')).toBe('');
  });

  it('未下载表（null）→ 纯历史模式，hasTable=false', () => {
    const src = buildCatSuggest(['手办'], () => '', null);
    expect(src.list).toEqual(['手办']);
    expect(src.hasTable).toBe(false);
  });
});

// ═══════ issue 489：历史条目图标继承表内（同名 > 别名直配 > 无命中留空） ═══════
describe('buildCatSuggest 历史条目图标继承（issue 489）', () => {
  const mkTable = {
    version: '0.1.0',
    groups: [
      {
        id: 'g1', name: '数码影音', icon: 'smartphone',
        items: [
          { id: 'c1', name: '移动电源', icon: 'battery-charging', aliases: ['充电宝'] },
        ],
      },
    ],
  } as any;

  it('历史记档缺失但命中表内同名 → 继承表图标；别名直配同样继承；无命中留空', () => {
    const src = buildCatSuggest(['移动电源', '充电宝', '手办'], () => '', mkTable);
    expect(src.iconOf('移动电源')).toBe('battery-charging'); // 同名
    expect(src.iconOf('充电宝')).toBe('battery-charging'); // 别名直配（值仍是「充电宝」，只补视觉）
    expect(src.iconOf('手办')).toBe(''); // 表内无命中 → 不造图标
  });

  it('历史记档优先于表内图标', () => {
    const src = buildCatSuggest(['移动电源'], () => 'my-icon', mkTable);
    expect(src.iconOf('移动电源')).toBe('my-icon');
  });
});

// ═══════ issue 491：历史条目展示兜底 tag 图标——每行都有图标可看，点选不落兜底值 ═══════
describe('buildCatSuggest 展示兜底图标（issue 491）', () => {
  it('无任何真实图标来源的历史条目 → displayIconOf 兜底 tag，iconOf 仍为空', () => {
    const src = buildCatSuggest(['手办', '镜头'], () => '', null);
    expect(src.displayIconOf('手办')).toBe('tag');
    expect(src.iconOf('手办')).toBe(''); // 点选落值不受兜底污染
    expect(src.displayIconOf('镜头')).toBe('tag'); // 历史条目一律兜底（表未下载同样适用）
  });

  it('有真实图标的候选（历史记档/表内/表外人工映射走 iconOf）→ displayIconOf 与 iconOf 一致', () => {
    const table = {
      version: '0.1.0',
      groups: [{ id: 'g1', name: '数码影音', icon: 'smartphone', items: [{ id: 'c1', name: '移动电源', icon: 'battery-charging', aliases: [] }] }],
    } as any;
    const src = buildCatSuggest(['移动电源'], () => '', table);
    expect(src.displayIconOf('移动电源')).toBe('battery-charging');
  });
});
