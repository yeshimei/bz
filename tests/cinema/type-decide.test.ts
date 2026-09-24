/**
 * 影院类型判定（issue 395；ADR-0181 补 LLM 回落）：豆瓣字段 → Jev Choice → 闭合词表选一；
 * Jev 不可用回落 LLM（题面同样给闭合词表 + 回执严格校验）。
 *
 * 覆盖面（上一版 393 踩过的坑，本票必须用断言守住）：
 * - `criteria` 必须是**对象**——写成数组会被 Jev API 直接 422；
 * - 候选 = `ALL_TAGS` 单源去掉「公开课」+ 显式哨兵；
 * - 哨兵命中 / 置信度不足 / 答案不在清单 → 一律 `null`（不允许逃逸，宁缺勿滥）；
 * - **弃权不是失败**：Jev 选哨兵或置信度不足不触发回落（回落等于绕过校准概率）；
 * - Jev 未配置 / 请求失败 / 答案畸形（题型不符、**取值越界**）→ 回落 LLM；
 * - abort → 抛出且不回落（LLM 零调用）；
 * - 两道都不可用 → 抛错，由调用方留空手点；
 * - state 只压非空字段（Jev 官方：塞太多无关内容掉精度）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import * as jev from '../../src/core/jev';
import type { JevResult } from '../../src/core/jev';
import {
  TYPE_SENTINEL, CONFIDENCE_FLOOR,
  buildTypeCriteria, buildTypeState, judgeTypeChoice, decideCinemaType,
  buildTypeLlmPrompt, parseTypeLlmOutput,
} from '../../src/cinema/type-decide';
import { ALL_TAGS } from '../../src/cinema/constants';

// LLM 回落打桩（createAI().json）：回落链不碰真实 core/ai
const aiStub = vi.hoisted(() => ({
  json: vi.fn(async (_prompt: string, _opts?: unknown): Promise<string> => '{"type":"日漫"}'),
}));
vi.mock('../../src/core/ai', async (importOriginal) => {
  // 必须 spread actual——settings.ts 在模块级取 DEFAULT_AI_PROVIDER，整体替换会让其变 undefined
  const actual = await importOriginal<typeof import('../../src/core/ai')>();
  return { ...actual, createAI: () => ({ json: aiStub.json }) };
});

function jevSettings(over: Record<string, unknown> = {}): any {
  return {
    ...DEFAULT_SETTINGS,
    jevProvider: 'typesafe',
    jevApiKey: 'test-key',
    jevModel: 'jev-latest',
    ...over,
  };
}

function choiceResult(choice: string, confidence: number): JevResult {
  return {
    model: 'jev-test',
    answers: {
      type: { type: 'choice', choice, confidence, probabilities: { [choice]: confidence } },
    } as JevResult['answers'],
  };
}

beforeEach(() => {
  resetObsidianMocks();
  // 同文件内 vi.spyOn(jev,'askJev') 复用同一 mock——不还原会带着上一用例的调用记录
  vi.restoreAllMocks();
  aiStub.json.mockReset();
  aiStub.json.mockResolvedValue('{"type":"日漫"}');
});

describe('buildTypeCriteria：候选清单构造', () => {
  it('criteria 是对象而非数组（写成数组会被 Jev API 422——issue 393 实测过的坑）', () => {
    const c = buildTypeCriteria();
    expect(Array.isArray(c)).toBe(false);
    expect(typeof c).toBe('object');
  });

  it('候选 = ALL_TAGS 去掉「公开课」+ 末尾显式哨兵', () => {
    const c = buildTypeCriteria();
    const keys = Object.keys(c);
    expect(keys).toContain(TYPE_SENTINEL);
    expect(keys[keys.length - 1]).toBe(TYPE_SENTINEL); // 哨兵在末尾
    expect(keys.filter((k) => k !== TYPE_SENTINEL).sort()).toEqual(
      ALL_TAGS.filter((t) => t !== '公开课').sort(),
    );
  });

  it('「公开课」不进自动判定候选（用户手选仍可用，不受此限）', () => {
    expect(buildTypeCriteria()).not.toHaveProperty('公开课');
  });

  it('每个候选的值是其所属组名（作为题面说明喂给 Jev）', () => {
    const c = buildTypeCriteria();
    expect(c['电影']).toBe('电影');
    expect(c['美剧']).toBe('剧集');
    expect(c[TYPE_SENTINEL]).toBeTruthy();
  });
});

describe('buildTypeState：字段压缩', () => {
  it('只压非空字段，空值整行跳过（Jev：塞太多无关内容掉精度）', () => {
    const s = buildTypeState({ title: '三体', isTv: true, area: '中国大陆', genre: '剧情, 科幻', year: '2023' });
    expect(s).toContain('片名：三体');
    expect(s).toContain('是否剧集：是');
    expect(s).toContain('制片国家/地区：中国大陆');
    expect(s).toContain('豆瓣类型：剧情, 科幻');
    expect(s).toContain('年份：2023');
  });

  it('isTv=false 也写（区分电影与剧种的唯一依据，不能当空值跳过）', () => {
    expect(buildTypeState({ title: 'A计划', isTv: false })).toContain('是否剧集：否');
  });

  it('isTv=null / 空串字段整行缺省', () => {
    const s = buildTypeState({ title: 'X', isTv: null, area: '', genre: null });
    expect(s).toBe('片名：X');
    expect(s).not.toContain('是否剧集');
    expect(s).not.toContain('制片国家');
  });
});

describe('judgeTypeChoice：判据（纯函数）', () => {
  const criteria = buildTypeCriteria();

  it('命中具体项且置信度达标 → 返回该 tag', () => {
    expect(judgeTypeChoice({ type: 'choice', choice: '日漫', confidence: 0.93, probabilities: {} }, criteria)).toBe('日漫');
  });

  it('置信度恰在阈值上 → 采信（边界）', () => {
    expect(judgeTypeChoice({ type: 'choice', choice: '美剧', confidence: CONFIDENCE_FLOOR, probabilities: {} }, criteria)).toBe('美剧');
  });

  it('置信度不足 → null（第二道闸，宁缺勿滥）', () => {
    expect(judgeTypeChoice({ type: 'choice', choice: '美剧', confidence: CONFIDENCE_FLOOR - 0.01, probabilities: {} }, criteria)).toBeNull();
  });

  it('命中哨兵 → null（不允许逃逸：闭合词表容不下生成值）', () => {
    expect(judgeTypeChoice({ type: 'choice', choice: TYPE_SENTINEL, confidence: 0.99, probabilities: {} }, criteria)).toBeNull();
  });

  it('答案不在候选清单（接口异常形态）→ null', () => {
    expect(judgeTypeChoice({ type: 'choice', choice: '自行编造的分类', confidence: 0.99, probabilities: {} }, criteria)).toBeNull();
  });

  it('原型链键（toString / constructor 等）不算命中候选（`in` 会把它们认成合法 tag）', () => {
    for (const key of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
      expect(judgeTypeChoice({ type: 'choice', choice: key, confidence: 0.99, probabilities: {} }, criteria)).toBeNull();
    }
  });
});

describe('LLM 回落：题面与回执', () => {
  const criteria = buildTypeCriteria();

  it('题面把闭合词表原样拷进去（含哨兵）且带 state', () => {
    const p = buildTypeLlmPrompt({ title: '千与千寻', isTv: false }, criteria);
    expect(p).toContain('日漫（动漫）');
    expect(p).toContain(TYPE_SENTINEL);
    expect(p).toContain('{"type":"候选分类之一"}');
    expect(p).toContain('片名：千与千寻');
    expect(p).toContain('是否剧集：否');
    expect(p).not.toContain('公开课');
  });

  it('回执合法 → tag；带 codefence 也能剥', () => {
    expect(parseTypeLlmOutput('{"type":"美剧"}', criteria)).toBe('美剧');
    expect(parseTypeLlmOutput('```json\n{"type":"韩剧"}\n```', criteria)).toBe('韩剧');
  });

  it('回执不在清单 / 哨兵 / 非 JSON / 缺字段 → null（弃权，不写值）', () => {
    expect(parseTypeLlmOutput('{"type":"自创分类"}', criteria)).toBeNull();
    expect(parseTypeLlmOutput('{"type":"constructor"}', criteria)).toBeNull(); // 原型链键不算候选
    expect(parseTypeLlmOutput(`{"type":"${TYPE_SENTINEL}"}`, criteria)).toBeNull();
    expect(parseTypeLlmOutput('不是 JSON', criteria)).toBeNull();
    expect(parseTypeLlmOutput('{"kind":"美剧"}', criteria)).toBeNull();
  });
});

describe('decideCinemaType：编排（Jev 优先，不可用回落 LLM）', () => {
  it('Jev 正常链：state + choice 题单发给 Jev，criteria 是对象，命中即返回 tag（LLM 零调用）', async () => {
    setSettingsProvider(() => jevSettings());
    const spy = vi.spyOn(jev, 'askJev').mockResolvedValue(choiceResult('日漫', 0.93));
    const got = await decideCinemaType({ title: '千与千寻', isTv: false, area: '日本', genre: '动画' });
    expect(got).toBe('日漫');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(aiStub.json).not.toHaveBeenCalled();
    const [state, questions] = spy.mock.calls[0] as unknown as [string, Record<string, { type: string; criteria: unknown }>];
    expect(state).toContain('片名：千与千寻');
    expect(state).toContain('是否剧集：否');
    const q = questions['type'];
    expect(q.type).toBe('choice');
    expect(Array.isArray(q.criteria)).toBe(false); // 422 tripwire
    expect(Object.keys(q.criteria as Record<string, string>)).toContain(TYPE_SENTINEL);
  });

  it('Jev 弃权（哨兵 / 置信度不足）→ null 且**不回落**（有效判定，不是失败）', async () => {
    setSettingsProvider(() => jevSettings());
    const spy = vi.spyOn(jev, 'askJev').mockResolvedValue(choiceResult(TYPE_SENTINEL, 0.88));
    await expect(decideCinemaType({ title: 'X', isTv: true })).resolves.toBeNull();
    spy.mockResolvedValue(choiceResult('美剧', CONFIDENCE_FLOOR - 0.01));
    await expect(decideCinemaType({ title: 'X', isTv: true })).resolves.toBeNull();
    expect(aiStub.json).not.toHaveBeenCalled();
  });

  it('Jev 未配置（无密钥）→ 回落 LLM（题面闭合词表，回执校验后采信）', async () => {
    setSettingsProvider(() => jevSettings({ jevApiKey: '' }));
    const spy = vi.spyOn(jev, 'askJev');
    const got = await decideCinemaType({ title: '千与千寻', isTv: false, area: '日本', genre: '动画' });
    expect(got).toBe('日漫');
    expect(spy).not.toHaveBeenCalled(); // 未就绪不发请求
    expect(aiStub.json).toHaveBeenCalledTimes(1);
    expect(String(aiStub.json.mock.calls[0][0])).toContain('电影（电影）');
  });

  it('Jev 请求失败（超时/网络/畸形响应）→ 回落 LLM', async () => {
    setSettingsProvider(() => jevSettings());
    vi.spyOn(jev, 'askJev').mockRejectedValue(new Error('jev timeout'));
    await expect(decideCinemaType({ title: 'X' })).resolves.toBe('日漫');
    expect(aiStub.json).toHaveBeenCalledTimes(1);
  });

  it('answers 缺题单键（畸形响应）→ 回落 LLM', async () => {
    setSettingsProvider(() => jevSettings());
    vi.spyOn(jev, 'askJev').mockResolvedValue({ model: 'jev-test', answers: {} } as unknown as JevResult);
    await expect(decideCinemaType({ title: 'X' })).resolves.toBe('日漫');
    expect(aiStub.json).toHaveBeenCalledTimes(1);
  });

  it('答案题型不符（回 score 而非 choice）→ 回落 LLM', async () => {
    setSettingsProvider(() => jevSettings());
    vi.spyOn(jev, 'askJev').mockResolvedValue({
      model: 'jev-test',
      answers: { type: { type: 'score', score: 3, probabilities: {} } },
    } as unknown as JevResult);
    await expect(decideCinemaType({ title: 'X' })).resolves.toBe('日漫');
    expect(aiStub.json).toHaveBeenCalledTimes(1);
  });

  it('答案越界（Jev 吐清单外的词）→ 回落 LLM（与哨兵弃权不同路）', async () => {
    setSettingsProvider(() => jevSettings());
    vi.spyOn(jev, 'askJev').mockResolvedValue(choiceResult('自行编造的分类', 0.99));
    await expect(decideCinemaType({ title: 'X' })).resolves.toBe('日漫');
    expect(aiStub.json).toHaveBeenCalledTimes(1);
  });

  it('LLM 回执非法 → null（弃权，不写值）', async () => {
    setSettingsProvider(() => jevSettings({ jevApiKey: '' }));
    aiStub.json.mockResolvedValue('{"type":"自创分类"}');
    await expect(decideCinemaType({ title: 'X' })).resolves.toBeNull();
  });

  it('回落请求带调用方的 signal（在途取消能传导进 LLM 通道）', async () => {
    setSettingsProvider(() => jevSettings({ jevApiKey: '' }));
    const ctrl = new AbortController();
    await decideCinemaType({ title: 'X' }, { signal: ctrl.signal });
    expect(aiStub.json.mock.calls[0][1]).toMatchObject({ signal: ctrl.signal });
  });

  it('abort → 抛 AbortError 且 LLM 零调用', async () => {
    setSettingsProvider(() => jevSettings());
    const spy = vi.spyOn(jev, 'askJev');
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(decideCinemaType({ title: 'X' }, { signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(spy).not.toHaveBeenCalled();
    expect(aiStub.json).not.toHaveBeenCalled();
  });

  it('两道都不可用（Jev 挂 + LLM 也挂）→ 抛错，由调用方留空手点', async () => {
    setSettingsProvider(() => jevSettings());
    vi.spyOn(jev, 'askJev').mockRejectedValue(new Error('jev timeout'));
    aiStub.json.mockRejectedValue(new Error('未配置 DeepSeek API Key'));
    await expect(decideCinemaType({ title: 'X' })).rejects.toThrow('未配置 DeepSeek API Key');
  });
});
