/**
 * smartcat 记忆流测试（ADR-0021）：单层记忆流写入/importance 打分（规则+LLM mock）/
 * 三因子检索（词法/语义）/自增强 lastAccessed/500 上限/反思调度/降级链。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemorySystem, MEMORY_CONFIG } from '../../src/smartcat/memory';
import { defaultSmartCatData } from '../../src/smartcat/data';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { requestUrl } from '../mock-obsidian-entry';
import type { SmartCatData } from '../../src/smartcat/types';

let data: SmartCatData;
let saver: ReturnType<typeof vi.fn<(d: SmartCatData) => Promise<void>>>;

function make(opts: { ai?: boolean } = {}): MemorySystem {
  data = defaultSmartCatData();
  saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
  resetAIProviderCache();
  if (opts.ai) setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  else setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }));
  const m = new MemorySystem({ vault: { adapter: {} } } as any, () => data, saver);
  (m as any).ollamaAvailable = false; // 测试默认词法模式（不探测网络）
  return m;
}

beforeEach(() => {
  (globalThis as any).fetch = undefined;
  vi.mocked(requestUrl).mockReset();
});

afterEach(() => {
  delete (globalThis as any).fetch;
});

describe('addObservation 写入', () => {
  it('追加 observation 到 stream + importance（AI 未配置 → 规则分）+ 落盘', async () => {
    const m = make();
    const mem = await m.addObservation('用户说：今天开始学 TypeScript', { source: 'chat' });
    expect(mem.id).toMatch(/^memory_/);
    expect(mem.type).toBe('observation');
    expect(mem.source).toBe('chat');
    expect(data.memory.stream.length).toBe(1);
    expect(mem.importance).toBeGreaterThan(0);
    expect(saver).toHaveBeenCalled();
  });

  it('显式 importance 优先（跳过 LLM/规则打分）', async () => {
    const m = make();
    const mem = await m.addObservation('x', { importance: 0.9 });
    expect(mem.importance).toBe(0.9);
  });
});

describe('importance 打分', () => {
  it('ruleImportance：词数/情感强度/手动标记（原 calculateImportance 语义）', () => {
    const m = make();
    const base = m.ruleImportance('短', {});
    expect(base).toBeCloseTo(0.502, 3);
    const withEmotion = m.ruleImportance('我非常开心今天', {});
    expect(withEmotion).toBeGreaterThan(0.5);
    const manual = m.ruleImportance('x', { manuallyMarked: true });
    expect(manual).toBeGreaterThanOrEqual(0.8);
  });

  it('AI 配置时打分走 LLM（mock fetch {score, emotion}）→ 0-10 归一 + 情绪标注', async () => {
    const m = make({ ai: true });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"score": 8, "emotion": "happy"}' } }] }),
    }));
    (globalThis as any).fetch = fetchMock;
    const r = await m.scoreImportanceAndEmotion('用户说：考上了理想学校');
    expect(r.importance).toBeCloseTo(0.8, 5);
    expect(r.emotion).toBe('happy');
  });

  it('LLM 打分失败 → 规则分兜底 + 词法情绪（降级链）', async () => {
    const m = make({ ai: true });
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));
    (globalThis as any).fetch = fetchMock;
    const r = await m.scoreImportanceAndEmotion('短', {});
    expect(r.importance).toBeCloseTo(0.502, 3);
    expect(r.emotion).toBeDefined(); // 词法兜底有值
  });

  it('词法情绪检测：中文关键词命中', () => {
    const m = make();
    expect(m.detectEmotion('今天好开心呀')).toBe('happy');
    expect(m.detectEmotion('感觉好难过')).toBe('sad');
    expect(m.detectEmotion('随便聊聊')).toBe('calm');
  });

  it('addObservation 写入 emotion 字段（显式传）', async () => {
    const m = make();
    const mem = await m.addObservation('用户说：周末去爬山', { importance: 0.5, emotion: 'happy', source: 'chat' });
    expect(mem.emotion).toBe('happy');
    expect(data.memory.stream[0].emotion).toBe('happy');
  });
});

describe('三因子检索（词法模式）', () => {
  async function seed(m: MemorySystem, entries: { desc: string; importance: number }[]): Promise<void> {
    for (const e of entries) await m.addObservation(e.desc, { importance: e.importance, source: 'chat' });
  }

  it('相关度高 → 返回 top N（默认 10 内）', async () => {
    const m = make();
    await seed(m, [{ desc: '用户说：我喜欢 TypeScript 类型系统', importance: 0.8 }]);
    const results = await m.retrieve('TypeScript');
    expect(results.length).toBe(1);
    expect(results[0].description).toContain('TypeScript');
  });

  it('无相关关键词 → GA 无阈值：仍返回（recency/importance 支撑）且相关度为 0', async () => {
    const m = make();
    await seed(m, [{ desc: '无关内容 AAAA BBBB', importance: 0.9 }]);
    const results = await m.retrieve('完全不存在关键词xyz');
    expect(results.length).toBe(1); // GA 语义：无相关过滤，取 top N
    expect(m.lexicalRelevance(results[0], '完全不存在关键词xyz')).toBe(0);
  });

  it('importance 参与加权：同相关性下高分优先', async () => {
    const m = make();
    await seed(m, [
      { desc: '用户说：TypeScript 项目上线了', importance: 0.3 },
      { desc: '用户说：TypeScript 类型系统非常棒', importance: 0.95 },
    ]);
    const results = await m.retrieve('TypeScript');
    expect(results.length).toBe(2);
    expect(results[0].importance).toBe(0.95);
  });

  it('relevance 参与加权：关键词命中多的优先（同 importance）', async () => {
    const m = make();
    await seed(m, [
      { desc: '用户说：今天天气很好', importance: 0.5 },
      { desc: '用户说：TypeScript 和 TypeScript 的类型', importance: 0.5 },
    ]);
    const results = await m.retrieve('TypeScript');
    expect(results[0].description).toContain('TypeScript 和');
  });

  it('检索更新 lastAccessed（自增强）', async () => {
    const m = make();
    await seed(m, [{ desc: '用户说：记得买牛奶', importance: 0.6 }]);
    const before = data.memory.stream[0].lastAccessed;
    await m.retrieve('牛奶');
    const after = data.memory.stream[0].lastAccessed;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });
});

describe('三因子检索（语义模式）', () => {
  function semanticMake(): MemorySystem {
    const m = make();
    (m as any).ollamaAvailable = true;
    (m as any).dim = 2;
    const v = new Float64Array([1, 0, 0, 1]); // id1=[1,0] id2=[0,1]
    (m as any).vectors = v;
    (m as any).vectorIndexMap = new Map([['m1', 0], ['m2', 1]]);
    return m;
  }

  it('余弦相关度：query 向量方向一致优先', async () => {
    const m = semanticMake();
    data.memory.stream.push(
      { id: 'm1', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '用户说：喜欢咖啡', importance: 0.5, type: 'observation' },
      { id: 'm2', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '用户说：喜欢跑步', importance: 0.5, type: 'observation' },
    );
    // mock query embedding → [1,0]（与 m1 语义一致）
    const queryVec = [1, 0];
    const s1 = m.semanticRelevance('m1', queryVec);
    const s2 = m.semanticRelevance('m2', queryVec);
    expect(s1).toBeGreaterThan(s2);
    expect(s1).toBeCloseTo(1, 5);
    expect(s2).toBeCloseTo(0, 5);
  });
});

describe('上限与淘汰', () => {
  it('超 500 条淘汰 importance 最低', async () => {
    const m = make();
    for (let i = 0; i < MEMORY_CONFIG.maxStream + 20; i++) {
      data.memory.stream.push({
        id: `mem${i}`,
        created: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        description: `内容${i}`,
        importance: i === 0 ? 0.05 : 0.5,
        type: 'observation',
      });
    }
    data.memory.stream.length = MEMORY_CONFIG.maxStream + 20;
    // 触发淘汰（走 addObservation 推一条）
    await m.addObservation('新记忆', { importance: 0.9 });
    expect(data.memory.stream.length).toBe(MEMORY_CONFIG.maxStream);
    expect(data.memory.stream.some((x) => x.id === 'mem0')).toBe(false);
  });
});

describe('反思（Reflection）', () => {
  it('记忆太少（<2 条）不反思', async () => {
    const m = make({ ai: true });
    await m.addObservation('只有一条', { importance: 0.5 });
    await m.reflect();
    expect(data.memory.stream.length).toBe(1);
    expect(data.memory.reflection.lastReflectAt).toBe(0);
  });

  it('AI 配置时反思生成洞察写回流（带 evidenceIds）', async () => {
    const m = make({ ai: true });
    await m.addObservation('用户说：这周要考六级', { importance: 0.9 });
    await m.addObservation('用户说：项目下周上线', { importance: 0.8 });
    await m.addObservation('用户说：在背单词', { importance: 0.7 });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ insights: [{ text: '用户最近压力很大', evidence: [1, 2] }] }) } }],
      }),
    }));
    (globalThis as any).fetch = fetchMock;
    await m.reflect();
    const insights = data.memory.stream.filter((x) => x.type === 'insight');
    expect(insights.length).toBe(1);
    expect(insights[0].description).toBe('用户最近压力很大');
    expect(insights[0].evidenceIds!.length).toBe(2);
    expect(data.memory.reflection.count).toBe(1);
  });

  it('AI 未配置 → 反思无产出（不写洞察、不推进 lastReflectAt）', async () => {
    const m = make();
    await m.addObservation('用户说：a', { importance: 0.5 });
    await m.addObservation('用户说：b', { importance: 0.5 });
    const streamBefore = data.memory.stream.length;
    await m.reflect();
    expect(data.memory.stream.length).toBe(streamBefore);
    expect(data.memory.reflection.lastReflectAt).toBe(0);
    expect(data.memory.reflection.count).toBe(0);
  });

  it('shouldReflect：新增 ≥20 条触发（pendingSinceReflect）', async () => {
    const m = make();
    const before = data.memory.reflection.lastReflectAt;
    for (let i = 0; i < MEMORY_CONFIG.reflectionMinNew; i++) {
      await m.addObservation(`消息 ${i}`, { importance: 0.3 });
    }
    expect((m as any).pendingSinceReflect).toBe(MEMORY_CONFIG.reflectionMinNew);
    expect((m as any).shouldReflect(Date.now())).toBe(true);
    // 复盘：不满 20 条且距上次未超 24h → false
    const m2 = make();
    await m2.addObservation('一条', { importance: 0.3 });
    expect((m2 as any).shouldReflect(Date.now())).toBe(false);
    const _ = before; // 保留引用避免 lint
  });
});

describe('状态与格式化', () => {
  it('getSystemStatus 计数正确', async () => {
    const m = make();
    await m.addObservation('abc', { importance: 0.5 });
    const s = m.getSystemStatus();
    expect(s.streamCount).toBe(1);
    expect(s.insightCount).toBe(0);
    expect(s.reflectionCount).toBe(0);
    expect(s.semanticMode).toBe(false);
  });

  it('formatMemoriesForPrompt 带 [type] 前缀与 200 字符截断', async () => {
    const m = make();
    const text = m.formatMemoriesForPrompt([{ id: 'x', created: '', lastAccessed: '', description: 'hello world'.repeat(50), importance: 0.5, type: 'observation' } as any]);
    expect(text).toContain('[observation]');
    expect(text.length).toBeLessThan(300);
  });
});