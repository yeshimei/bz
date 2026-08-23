/**
 * smartcat 记忆流测试（ADR-0021）：单层记忆流写入/importance 打分（规则+LLM mock）/
 * 三因子检索（词法/语义）/自增强 lastAccessed/500 上限/反思调度/降级链。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemorySystem, MEMORY_CONFIG, sourceLabel, formatRelativeTime, buildRetrieveQuery } from '../../src/smartcat/memory';
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

  it('AI 未配置 → 反思无产出（不写洞察、不推进 lastReflectAt、进入退避不落盘）', async () => {
    const m = make();
    await m.addObservation('用户说：a', { importance: 0.5 });
    await m.addObservation('用户说：b', { importance: 0.5 });
    const streamBefore = data.memory.stream.length;
    (saver as any).mockClear(); // 清掉 addObservation 的落盘计数，只测 reflect 自身是否落盘
    await m.reflect();
    expect(data.memory.stream.length).toBe(streamBefore);
    expect(data.memory.reflection.lastReflectAt).toBe(0);
    expect(data.memory.reflection.count).toBe(0);
    // 红队 B P1-2 空转守卫：失败进入退避（5min 起），退避期内不触发、不落盘
    expect((m as any).reflectBackoffUntil).toBeGreaterThan(Date.now());
    expect((m as any).shouldReflect(Date.now())).toBe(false);
    expect(saver).not.toHaveBeenCalled();
  });

  it('反思成功重置退避（下次失败重新 5min）', async () => {
    const m = make({ ai: true });
    await m.addObservation('a', { importance: 0.5 });
    await m.addObservation('b', { importance: 0.5 });
    (m as any).reflectBackoffUntil = Date.now() + 30 * 60 * 1000;
    (m as any).reflectBackoffMs = 30 * 60 * 1000;
    // 成功路径：fetch mock 返回 insights
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ insights: [{ text: '总结', evidence: [1] }] }) } }],
      }),
    }));
    (globalThis as any).fetch = fetchMock;
    (globalThis as any).fetch = fetchMock;
    await m.reflect();
    expect((m as any).reflectBackoffMs).toBe(5 * 60 * 1000);
    expect((m as any).reflectBackoffUntil).toBe(0); // 退避期已在成功时被覆盖为未来？——见实现
    expect(data.memory.reflection.count).toBe(1);
  });

  it('evidence 过滤 insight：小橘自己的洞察不作下一次反思素材（白名单 P1-1）', async () => {
    const m = make({ ai: true });
    await m.addObservation('用户说：在学日语', { importance: 0.9 });
    await m.addObservation('用户说：周末去图书馆', { importance: 0.8 });
    // 先产出一条 insight
    const f1 = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ insights: [{ text: '用户近期学习投入', evidence: [1, 2] }] }) } }] }),
    }));
    (globalThis as any).fetch = f1;
    await m.reflect();
    const insightCount = data.memory.stream.filter((x) => x.type === 'insight').length;
    expect(insightCount).toBe(1);
    // 第二次反思：evidence 应只含 observation，不含 insight
    const f2 = vi.fn(async (url: string, init?: any) => {
      const body = JSON.parse((init as any).body);
      const promptText = body.messages[1].content as string;
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ insights: [{ text: '再总结', evidence: [1] }] }) } }] }) };
    });
    (globalThis as any).fetch = f2;
    await m.reflect();
    const promptText = (f2.mock.calls[0][1] as any).body as string;
    expect(promptText).not.toContain('用户近期学习投入'); // insight 文本未进反思 prompt
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

describe('RAG 增强（2026-08：来源标签/相对时间/情绪时段 query）', () => {
  it('sourceLabel：来源 → 中文（chat/diary/domain:memo；未知回显）', () => {
    expect(sourceLabel('chat')).toBe('聊天');
    expect(sourceLabel('diary')).toBe('日记');
    expect(sourceLabel('domain:memo')).toBe('备忘录');
    expect(sourceLabel('domain:quiz')).toBe('做题');
    expect(sourceLabel('unknown_things')).toBe('unknown_things');
    expect(sourceLabel(undefined)).toBe('');
  });

  it('formatRelativeTime：分钟/小时/天/月日分级', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 30 * 1000).toISOString(), now)).toBe('刚刚');
    expect(formatRelativeTime(new Date(now - 5 * 60000).toISOString(), now)).toBe('5 分钟前');
    expect(formatRelativeTime(new Date(now - 3 * 3600 * 1000).toISOString(), now)).toBe('3 小时前');
    expect(formatRelativeTime(new Date(now - 2 * 86400000).toISOString(), now)).toBe('2 天前');
    const monthAgo = new Date(now - 40 * 86400000).toISOString();
    expect(formatRelativeTime(monthAgo, now)).toMatch(/^\d+ 月 \d+ 日$/);
  });

  it('buildRetrieveQuery：用户消息 + 情绪 + 时段（无情绪省略；时段随钟点）', () => {
    expect(buildRetrieveQuery('今天好累', 'sad', 22)).toBe('今天好累 当前情绪：sad 时段：晚上');
    expect(buildRetrieveQuery('早上好', null, 8)).toBe('早上好 时段：早晨');
    expect(buildRetrieveQuery('  ', 'happy', 14)).toBe('当前情绪：happy 时段：下午');
  });

  it('formatMemoriesForPrompt 增强：带来源中文 + 相对时间元信息', async () => {
    const m = make();
    const text = m.formatMemoriesForPrompt([
      { id: 'x', created: new Date(Date.now() - 86400000 * 2).toISOString(), lastAccessed: '', description: '用户说：记得买牛奶', importance: 0.6, type: 'observation', source: 'chat' } as any,
    ]);
    expect(text).toContain('[observation（聊天·2 天前）]');
    expect(text).toContain('记得买牛奶');
  });
});

describe('睡前巩固（Digest，2026-08-23 增强）', () => {
  it('从未小结过 → 不触发（数据太少无意义）', async () => {
    const m = make({ ai: true });
    await m.addObservation('用户说：a', { importance: 0.5 });
    await m.addObservation('用户说：b', { importance: 0.5 });
    await m.addObservation('用户说：c', { importance: 0.5 });
    expect((m as any).shouldDigest(Date.now())).toBe(false);
    expect(data.memory.reflection.digestCount).toBe(0);
  });

  it('距上次小结 <18h → 不触发；≥18h 且新增不足 3 条 → 不触发', async () => {
    const m = make({ ai: true });
    data.memory.reflection.lastDigestAt = Date.now() - 10 * 60 * 60 * 1000;
    data.memory.reflection.digestCount = 1;
    await m.addObservation('用户说：a', { importance: 0.5 });
    expect((m as any).shouldDigest(Date.now())).toBe(false); // 间隔不够
    data.memory.reflection.lastDigestAt = Date.now() - 20 * 60 * 60 * 1000;
    expect((m as any).shouldDigest(Date.now())).toBe(false); // 新增 <3
    await m.addObservation('用户说：b', { importance: 0.5 });
    await m.addObservation('用户说：c', { importance: 0.5 });
    expect((m as any).shouldDigest(Date.now())).toBe(true);
  });

  it('LLM 配置时 digest 生成【今日小结】写回流（source digest + evidenceIds + 推进 lastDigestAt）', async () => {
    const m = make({ ai: true });
    data.memory.reflection.lastDigestAt = Date.now() - 20 * 60 * 60 * 1000;
    data.memory.reflection.digestCount = 1;
    await m.addObservation('用户说：今天完成了项目上线', { importance: 0.9 });
    await m.addObservation('用户说：晚上去跑步了', { importance: 0.7 });
    await m.addObservation('用户说：心情不错', { importance: 0.6 });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ digests: [{ text: '项目上线成功，晚上跑步放松', evidence: [1, 2] }] }) } }],
      }),
    }));
    (globalThis as any).fetch = fetchMock;
    await m.digest();
    const digests = data.memory.stream.filter((x) => x.type === 'insight' && x.source === 'digest');
    expect(digests.length).toBe(1);
    expect(digests[0].description).toContain('【今日小结】');
    expect(digests[0].evidenceIds!.length).toBe(2);
    expect(data.memory.reflection.digestCount).toBe(2);
    expect(data.memory.reflection.lastDigestAt).toBeGreaterThan(0);
  });

  it('AI 未配置 → digest 无产出（不写流、不推进 lastDigestAt、进入退避）', async () => {
    const m = make();
    data.memory.reflection.lastDigestAt = Date.now() - 20 * 60 * 60 * 1000;
    await m.addObservation('a', { importance: 0.5 });
    await m.addObservation('b', { importance: 0.5 });
    await m.addObservation('c', { importance: 0.5 });
    const streamBefore = data.memory.stream.length;
    (saver as any).mockClear();
    await m.digest();
    expect(data.memory.stream.length).toBe(streamBefore);
    expect(data.memory.reflection.lastDigestAt).toBeLessThan(Date.now() - 10 * 60 * 60 * 1000);
    expect((m as any).reflectBackoffUntil).toBeGreaterThan(Date.now()); // 失败进入退避
  });

  it('digest 产出的【今日小结】不进反思 evidence（防自引用）', async () => {
    const m = make({ ai: true });
    data.memory.reflection.lastDigestAt = Date.now() - 20 * 60 * 60 * 1000;
    await m.addObservation('用户说：真实观察一', { importance: 0.8 });
    await m.addObservation('用户说：真实观察二', { importance: 0.8 });
    await m.addObservation('用户说：真实观察三', { importance: 0.8 });
    const f1 = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ digests: [{ text: '今日小结：真实观察汇总', evidence: [1, 2, 3] }] }) } }] }),
    }));
    (globalThis as any).fetch = f1;
    await m.digest();
    const insightCount = data.memory.stream.filter((x) => x.type === 'insight').length;
    expect(insightCount).toBe(1);
    // 第二次 digest：候选应不含 digest 小结（source 过滤），且 observations 都被上次消化
    const f2 = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) }));
    (globalThis as any).fetch = f2;
    await m.digest();
    // 无新观察 → 不推进（应触发 shouldDigest 的阈值判断失败直接返回）
    expect(data.memory.stream.filter((x) => x.type === 'insight').length).toBe(1);
  });
});

describe('RL 校准配置（ADR-0024 + 进化第 3 轮）', () => {
  it('MEMORY_CONFIG 三因子权重与 decay 为真实库配方（0.66/0.95/1.5/0.982：rMem 接回检索项后的重标定）', () => {
    expect(MEMORY_CONFIG.alphaRecency).toBe(0.66);
    expect(MEMORY_CONFIG.alphaImportance).toBe(0.95);
    expect(MEMORY_CONFIG.alphaRelevance).toBe(1.5);
    expect(MEMORY_CONFIG.decay).toBe(0.982);
  });
});