/**
 * smartcat 特质归因学习测试（ticket 091，方向六）：
 * mode 标记落 growthHistory（llm 带 quote/lexical 无 quote）、≤2 截断、digest 排除 existential、
 * existential ×0.5、none 不硬挑、LLM 失败回落词法、独立退避窗口内不再请求、H4 边界继承、
 * onReflect origin 元数据透传（reflect/digest）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PersonalityGrowth,
  parseLLMAttributions,
  planLexicalAttributions,
  MAX_ATTRIBUTIONS_PER_BATCH,
  EXISTENTIAL_TRAITS,
  TRAIT_ATTRIBUTION_BACKOFF_MS,
} from '../../src/smartcat/mood';
import { DEEP_DELTA_SCALE } from '../../src/smartcat/character';
import { USER_CONTENT_BOUNDARY, MemorySystem } from '../../src/smartcat/memory';
import { defaultSmartCatData } from '../../src/smartcat/data';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { requestUrl } from '../mock-obsidian-entry';
import type { SmartCatData } from '../../src/smartcat/types';

let data: SmartCatData;
let saver: ReturnType<typeof vi.fn<(d: SmartCatData) => Promise<void>>>;

function make(opts: { ai?: boolean } = {}): PersonalityGrowth {
  data = defaultSmartCatData();
  saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
  resetAIProviderCache();
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: opts.ai ? 'sk-test' : '' }));
  return new PersonalityGrowth(() => data, saver);
}

/** LLM 响应 mock（chat completions JSON 通道） */
function llmFetch(payload: any): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
  }));
}

beforeEach(() => {
  (globalThis as any).fetch = undefined;
  vi.mocked(requestUrl).mockReset();
});

afterEach(() => {
  delete (globalThis as any).fetch;
});

describe('mode 标记落 growthHistory（ticket 091 测试要求 1）', () => {
  it('llm 主路径：attribution={mode:llm, quote}，特质上涨，H4 边界声明进 system prompt', async () => {
    const pg = make({ ai: true });
    const fetchMock = llmFetch({ attributions: [{ index: 1, trait: 'creativity', quote: '好奇' }] });
    (globalThis as any).fetch = fetchMock;
    const before = data.personalityGrowth.traits.creativity;
    await pg.applyReflectionInsights([{ text: '用户对天文充满好奇，常读科普' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain(USER_CONTENT_BOUNDARY); // H4 继承
    expect(body.messages[1].content).toContain('用户对天文充满好奇');
    const h = data.personalityGrowth.growthHistory;
    expect(h.length).toBe(1);
    expect(h[0].source).toBe('reflection');
    expect(h[0].attribution).toEqual({ mode: 'llm', quote: '好奇' });
    expect(data.personalityGrowth.traits.creativity).toBeCloseTo(before + 0.005 * DEEP_DELTA_SCALE, 10);
  });

  it('词法兜底（AI 未配置）：attribution={mode:lexical} 无 quote（不产伪解释），词表行为回归不变', async () => {
    const pg = make({});
    const before = data.personalityGrowth.traits.exist_depth;
    await pg.applyReflectionInsights([{ text: '用户认识到自己是个喜欢深夜写作的人' }]);
    const h = data.personalityGrowth.growthHistory;
    expect(h.length).toBe(1);
    expect(h[0].attribution).toEqual({ mode: 'lexical' });
    expect(h[0].attribution.quote).toBeUndefined();
    expect(h[0].changes.exist_depth).toBeCloseTo(0.01 * 0.5 * DEEP_DELTA_SCALE, 10);
    expect(data.personalityGrowth.traits.exist_depth).toBeGreaterThan(before);
  });
});

describe('≤2 截断（按洞察顺序）', () => {
  it('llm：3 条归因只取洞察顺序前 2 条', async () => {
    const pg = make({ ai: true });
    (globalThis as any).fetch = llmFetch({
      attributions: [
        { index: 3, trait: 'concern', quote: '牵挂家人' },
        { index: 1, trait: 'oxytocin', quote: '温暖' },
        { index: 2, trait: 'creativity', quote: '探索' },
      ],
    });
    const bOxy = data.personalityGrowth.traits.oxytocin;
    const bCre = data.personalityGrowth.traits.creativity;
    const bCon = data.personalityGrowth.traits.concern;
    await pg.applyReflectionInsights([
      { text: '和小橘之间温暖的陪伴让关系更近了' },
      { text: '用户喜欢探索新的领域' },
      { text: '用户一直很牵挂家人' },
    ]);
    const h = data.personalityGrowth.growthHistory;
    expect(MAX_ATTRIBUTIONS_PER_BATCH).toBe(2);
    expect(h.length).toBe(2);
    // 第 1、2 条被归因；第 3 条（concern）被截断
    expect(data.personalityGrowth.traits.oxytocin).toBeGreaterThan(bOxy);
    expect(data.personalityGrowth.traits.creativity).toBeGreaterThan(bCre);
    expect(data.personalityGrowth.traits.concern).toBe(bCon);
    expect(h.every((x: any) => x.attribution.mode === 'llm')).toBe(true);
  });

  it('lexical：批量多洞察命中也只保留前 2 条归因', async () => {
    const pg = make({});
    const bOxy = data.personalityGrowth.traits.oxytocin;
    const bFam = data.personalityGrowth.traits.familiarity;
    const bCon = data.personalityGrowth.traits.concern;
    await pg.applyReflectionInsights([
      { text: '关系温暖而信任' },       // oxytocin
      { text: '用户习惯了早起' },        // familiarity
      { text: '用户很担心考试' },        // concern —— 被截断
    ]);
    const h = data.personalityGrowth.growthHistory;
    expect(h.length).toBe(2);
    expect(data.personalityGrowth.traits.oxytocin).toBeGreaterThan(bOxy);
    expect(data.personalityGrowth.traits.familiarity).toBeGreaterThan(bFam);
    expect(data.personalityGrowth.traits.concern).toBe(bCon);
  });
});

describe('来源约束：digest 排除 existential', () => {
  it('lexical：origin=digest 时 existential 词组全部失效，非 existential 照常', async () => {
    const pg = make({});
    const bSelf = data.personalityGrowth.traits.exist_depth;
    const bFam = data.personalityGrowth.traits.familiarity;
    const bCre = data.personalityGrowth.traits.creativity;
    await pg.applyReflectionInsights([{ text: '自己意识到习惯了重复的生活' }], { origin: 'digest' });
    // 全是 existential 命中 → 无归因无落盘
    expect(data.personalityGrowth.growthHistory.length).toBe(0);
    expect(saver).not.toHaveBeenCalled();
    expect(data.personalityGrowth.traits.exist_depth).toBe(bSelf);
    expect(data.personalityGrowth.traits.familiarity).toBe(bFam);
    await pg.applyReflectionInsights([{ text: '自己开始学习绘画' }], { origin: 'digest' });
    expect(data.personalityGrowth.growthHistory.length).toBe(1);
    expect(data.personalityGrowth.traits.creativity).toBeGreaterThan(bCre);
    expect(data.personalityGrowth.traits.exist_depth).toBe(bSelf);
  });

  it('llm：origin=digest 时 LLM 返回的 existential 归因被裁剪，prompt 注明约束', async () => {
    const pg = make({ ai: true });
    const fetchMock = llmFetch({
      attributions: [
        { index: 1, trait: 'exist_depth', quote: '重新认识自我' },
        { index: 2, trait: 'creativity', quote: '学习' },
      ],
    });
    (globalThis as any).fetch = fetchMock;
    const bSelf = data.personalityGrowth.traits.exist_depth;
    const bCre = data.personalityGrowth.traits.creativity;
    await pg.applyReflectionInsights(
      [{ text: '用户开始重新认识自我' }, { text: '用户在学习水彩画' }],
      { origin: 'digest' },
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1].content).toContain('日小结');
    const h = data.personalityGrowth.growthHistory;
    expect(h.length).toBe(1);
    expect(h[0].insights[0]).toContain('水彩');
    expect(h[0].attribution.mode).toBe('llm');
    expect(data.personalityGrowth.traits.exist_depth).toBe(bSelf);
    expect(data.personalityGrowth.traits.creativity).toBeGreaterThan(bCre);
  });

  it('reflection 来源不受限制：existential 照常归因', async () => {
    const pg = make({});
    const b = data.personalityGrowth.traits.familiarity;
    await pg.applyReflectionInsights([{ text: '用户习惯了睡前阅读' }]);
    expect(data.personalityGrowth.traits.familiarity).toBeGreaterThan(b);
  });
});

describe('existential ×0.5 降频与增益量级沿用现值', () => {
  it('群组定义：existential = exist_depth/familiarity/concern', () => {
    expect([...EXISTENTIAL_TRAITS]).toEqual(['exist_depth', 'familiarity', 'concern']);
  });

  it('exist_depth/familiarity/concern 单次增益 = 0.01×DEEP_DELTA_SCALE×0.5；creativity/oxytocin = 0.005×DEEP_DELTA_SCALE', async () => {
    const pg = make({});
    // existential 出生 0.0——先置非零基线验证精确增益；0 基线首跳受 0.001 下限钳制（既有钳制语义）
    data.personalityGrowth.traits.exist_depth = 0.5;
    const b0 = data.personalityGrowth.traits.exist_depth;
    await pg.applyReflectionInsights([{ text: '用户认识到自己的模式' }]);
    expect(data.personalityGrowth.traits.exist_depth - b0).toBeCloseTo(0.01 * 0.5 * DEEP_DELTA_SCALE, 10);
    data.personalityGrowth.traits.oxytocin = 0.5;
    const b1 = data.personalityGrowth.traits.oxytocin;
    await pg.applyReflectionInsights([{ text: '关系温暖而亲近' }]);
    expect(data.personalityGrowth.traits.oxytocin - b1).toBeCloseTo(0.005 * DEEP_DELTA_SCALE, 10);
  });

  it('existential 出生 0 基线：首跳增益（≈0.00042）低于 0.001 下限 → 钳到 0.001（既有钳制行为不变）', async () => {
    const pg = make({});
    await pg.applyReflectionInsights([{ text: '用户开始思考自己的方向' }]);
    expect(data.personalityGrowth.traits.exist_depth).toBeCloseTo(0.001, 10);
  });
});

describe('none 不硬挑（LLM 返回空归因）', () => {
  it('全部返回 none：不涨特质、不留历史、不落盘', async () => {
    const pg = make({ ai: true });
    (globalThis as any).fetch = llmFetch({ attributions: [{ index: 1, trait: 'none' }] });
    const snapBefore = JSON.parse(JSON.stringify(data.personalityGrowth));
    await pg.applyReflectionInsights([{ text: '用户今天去了海边' }]);
    expect(data.personalityGrowth).toEqual(snapBefore);
    expect(saver).not.toHaveBeenCalled();
  });

  it('部分 none：只有有效条目归因', async () => {
    const pg = make({ ai: true });
    (globalThis as any).fetch = llmFetch({
      attributions: [
        { index: 1, trait: 'none' },
        { index: 2, trait: 'oxytocin', quote: '信任' },
      ],
    });
    const bCon = data.personalityGrowth.traits.concern;
    const bOxy = data.personalityGrowth.traits.oxytocin;
    await pg.applyReflectionInsights([{ text: '用户担心项目进度' }, { text: '用户表达了对小橘的信任' }]);
    const h = data.personalityGrowth.growthHistory;
    expect(h.length).toBe(1);
    expect(h[0].insights[0]).toContain('信任');
    expect(data.personalityGrowth.traits.concern).toBe(bCon);
    expect(data.personalityGrowth.traits.oxytocin).toBeGreaterThan(bOxy);
  });
});

describe('LLM 失败回落词法 + 独立退避（editingData.traitAttribution）', () => {
  it('网络异常 → 整批回落词法（mode=lexical），退避戳写入 editingData 并落盘', async () => {
    const pg = make({ ai: true });
    (globalThis as any).fetch = vi.fn(async () => { throw new Error('network down'); });
    const before = data.personalityGrowth.traits.exist_depth;
    await pg.applyReflectionInsights([{ text: '用户自己喜欢深夜写作' }]);
    expect(data.personalityGrowth.growthHistory.length).toBe(1);
    expect(data.personalityGrowth.growthHistory[0].attribution).toEqual({ mode: 'lexical' });
    expect(data.personalityGrowth.traits.exist_depth).toBeGreaterThan(before);
    const ba = data.editingData.traitAttribution;
    expect(ba.backoffUntil).toBeGreaterThan(Date.now());
    expect(ba.backoffUntil).toBeLessThanOrEqual(Date.now() + TRAIT_ATTRIBUTION_BACKOFF_MS + 1000);
    expect(ba.backoffMs).toBe(TRAIT_ATTRIBUTION_BACKOFF_MS * 2); // 指数递增（5min→10min）
    expect(saver).toHaveBeenCalled(); // 失败也落盘退避戳
  });

  it('结构异常（响应缺 attributions 数组）→ 回落词法 + 进入退避', async () => {
    const pg = make({ ai: true });
    (globalThis as any).fetch = llmFetch({ result: 'ok' });
    await pg.applyReflectionInsights([{ text: '用户习惯了晨跑' }]);
    expect(data.personalityGrowth.growthHistory[0].attribution.mode).toBe('lexical');
    expect(data.editingData.traitAttribution.backoffUntil).toBeGreaterThan(Date.now());
  });

  it('退避窗口内直接走词法，不再发起请求', async () => {
    const pg = make({ ai: true });
    (globalThis as any).fetch = vi.fn(async () => { throw new Error('down'); });
    await pg.applyReflectionInsights([{ text: '用户自己喜欢深夜写作' }]);
    const firstUntil = data.editingData.traitAttribution.backoffUntil;
    expect(firstUntil).toBeGreaterThan(Date.now());
    // 第二批：仍在退避窗口内 → 零请求、直接词法
    const secondFetch = llmFetch({ attributions: [] });
    (globalThis as any).fetch = secondFetch;
    await pg.applyReflectionInsights([{ text: '用户自己又提到了写作节奏' }]);
    expect(secondFetch).not.toHaveBeenCalled();
    expect(data.editingData.traitAttribution.backoffUntil).toBe(firstUntil); // 不再改写退避戳
    expect(data.personalityGrowth.growthHistory[data.personalityGrowth.growthHistory.length - 1].attribution.mode).toBe('lexical');
  });

  it('成功后重置退避（backoffUntil 清零、步长回 5min）', async () => {
    const pg = make({ ai: true });
    data.editingData = { ...(data.editingData || {}), traitAttribution: { backoffUntil: Date.now() - 1, backoffMs: 30 * 60 * 1000 } };
    (globalThis as any).fetch = llmFetch({ attributions: [{ index: 1, trait: 'creativity', quote: '好奇' }] });
    await pg.applyReflectionInsights([{ text: '用户对植物很好奇' }]);
    expect(data.editingData.traitAttribution.backoffUntil).toBe(0);
    expect(data.editingData.traitAttribution.backoffMs).toBe(TRAIT_ATTRIBUTION_BACKOFF_MS);
  });

  it('独立于 reflectBackoffUntil：不读写 memory 反思退避字段', async () => {
    const pg = make({ ai: true });
    (globalThis as any).fetch = vi.fn(async () => { throw new Error('down'); });
    await pg.applyReflectionInsights([{ text: '用户自己喜欢深夜写作' }]);
    expect(data.editingData.traitAttribution.backoffUntil).toBeGreaterThan(Date.now());
    // memory.reflectBackoffUntil 是 MemorySystem 私有内存态，editingData 无该键——互不影响
    expect(Object.keys(data.editingData)).not.toContain('reflectBackoffUntil');
  });
});

describe('纯函数：parseLLMAttributions 校验契约', () => {
  const insights = [{ text: '用户对星空很好奇' }, { text: '用户珍惜陪伴时光' }];

  it('attributions 缺失/非数组 → null（整批回落信号）', () => {
    expect(parseLLMAttributions(null, insights, { allowExistential: true })).toBeNull();
    expect(parseLLMAttributions({}, insights, { allowExistential: true })).toBeNull();
    expect(parseLLMAttributions({ attributions: 'x' }, insights, { allowExistential: true })).toBeNull();
  });

  it('越权词表 / 越界 index / 非 none 但缺 quote 或 quote 非原文子串 → 逐条裁剪', () => {
    const r = parseLLMAttributions({
      attributions: [
        { index: 1, trait: 'warmth', quote: '星空' },          // 30 特质但在白名单外
        { index: 9, trait: 'creativity', quote: '星空' },       // 越界
        { index: 1, trait: 'creativity' },                      // 缺 quote
        { index: 1, trait: 'creativity', quote: '不存在的原话' }, // quote 非子串
        { index: 2, trait: 'oxytocin', quote: '陪伴时光' },
      ],
    }, insights, { allowExistential: true });
    expect(r).toEqual([{ index: 2, trait: 'oxytocin', quote: '陪伴时光' }]);
  });

  it('quote 匹配容忍空白差异；结果按洞察顺序排序；allowExistential=false 过滤群组', () => {
    // familiarity 本属 existential 群组——digest 约束下与 exist_depth 一并被过滤，非 existential 的 creativity 放行
    const r = parseLLMAttributions({
      attributions: [
        { index: 2, trait: 'creativity', quote: '惜陪 伴' },    // 空白归一后命中原文子串
        { index: 1, trait: 'exist_depth', quote: '星空' },
        { index: 2, trait: 'familiarity', quote: '时光' },      // existential × digest → 过滤
      ],
    }, insights, { allowExistential: false });
    expect(r).toEqual([{ index: 2, trait: 'creativity', quote: '惜陪 伴' }]);
    const r2 = parseLLMAttributions({
      attributions: [
        { index: 2, trait: 'familiarity', quote: '陪伴时光' },
        { index: 1, trait: 'exist_depth', quote: '星空' },
      ],
    }, insights, { allowExistential: true });
    expect(r2!.map((x) => x.index)).toEqual([1, 2]);
  });
});

describe('纯函数：planLexicalAttributions', () => {
  it('批次 ≤2 截断 + digest 排除 existential + 大小写不敏感', () => {
    const plan = planLexicalAttributions(
      [{ text: 'About ME 的成长' }, { text: '习惯了早起' }, { text: '担心考试' }],
      { allowExistential: true },
    );
    expect(plan).toEqual([
      { index: 1, trait: 'exist_depth' },
      { index: 2, trait: 'familiarity' },
    ]);
    const digestPlan = planLexicalAttributions([{ text: '自己习惯了重复' }], { allowExistential: false });
    expect(digestPlan).toEqual([]);
  });
});

describe('onReflect origin 元数据透传（memory → mood 链路）', () => {
  function makeMemory(opts: { ai?: boolean } = {}): MemorySystem {
    data = defaultSmartCatData();
    saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
    resetAIProviderCache();
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: opts.ai ? 'sk-test' : '' }));
    const m = new MemorySystem({ vault: { adapter: {} } } as any, () => data, saver);
    (m as any).ollamaAvailable = false;
    return m;
  }

  it('reflect → onReflect(insights, {origin:"reflection"})', async () => {
    const m = makeMemory({ ai: true });
    await m.addObservation('观察一', { importance: 0.9 });
    await m.addObservation('观察二', { importance: 0.9 });
    const seen: Array<{ n: number; origin?: string }> = [];
    m.onReflect = async (insights, meta) => { seen.push({ n: insights.length, origin: meta?.origin }); };
    (globalThis as any).fetch = llmFetch({ insights: [{ text: '用户规律作息', evidence: [1, 2] }] });
    await m.reflect();
    expect(seen).toEqual([{ n: 1, origin: 'reflection' }]);
  });

  it('digest → onReflect(digests, {origin:"digest"})', async () => {
    const m = makeMemory({ ai: true });
    data.memory.reflection.lastDigestAt = Date.now() - 20 * 60 * 60 * 1000;
    await m.addObservation('今日事一', { importance: 0.5, source: 'diary' });
    await m.addObservation('今日事二', { importance: 0.5, source: 'diary' });
    await m.addObservation('今日事三', { importance: 0.5, source: 'diary' });
    const seen: Array<{ n: number; origin?: string }> = [];
    m.onReflect = async (insights, meta) => { seen.push({ n: insights.length, origin: meta?.origin }); };
    (globalThis as any).fetch = llmFetch({ digests: [{ text: '平静的一天', evidence: [1] }] });
    await m.digest();
    expect(seen).toEqual([{ n: 1, origin: 'digest' }]);
  });
});