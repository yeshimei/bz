/**
 * 影院类型判定（issue 395）：豆瓣字段 → Jev Choice → 闭合词表选一。
 *
 * 覆盖面（上一版 393 踩过的坑，本票必须用断言守住）：
 * - `criteria` 必须是**对象**——写成数组会被 Jev API 直接 422；
 * - 候选 = `ALL_TAGS` 单源去掉「公开课」（2026-09-21 拍板：公开课不参与自动分类，手选仍可用）+ 显式哨兵；
 * - 哨兵命中 / 置信度不足 / 答案不在清单 → 一律 `null`（不允许逃逸，宁缺勿滥）；
 * - state 只压非空字段（Jev 官方：塞太多无关内容掉精度）；
 * - 未配置即抛错、失败上抛——本链不回落 LLM。
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
} from '../../src/cinema/type-decide';
import { ALL_TAGS } from '../../src/cinema/constants';

function jevSettings(over: Record<string, unknown> = {}): any {
  return {
    ...DEFAULT_SETTINGS,
    jevEnabled: true,
    jevEndpoint: 'https://api.typesafe.ai/v1/systemone',
    jevApiKey: 'test-key',
    jevModel: 'jev-1.13.0',
    jevTimeoutMs: 10000,
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
});

describe('decideCinemaType：编排', () => {
  it('Jev 未启用 → 抛错（本链不静默、不回落 LLM）', async () => {
    setSettingsProvider(() => jevSettings({ jevEnabled: false }));
    await expect(decideCinemaType({ title: 'X' })).rejects.toThrow(/未配置/);
  });

  it('正常链：state + choice 题单发给 Jev，criteria 是对象，命中即返回 tag', async () => {
    setSettingsProvider(() => jevSettings());
    const spy = vi.spyOn(jev, 'askJev').mockResolvedValue(choiceResult('日漫', 0.93));
    const got = await decideCinemaType({ title: '千与千寻', isTv: false, area: '日本', genre: '动画' });
    expect(got).toBe('日漫');
    expect(spy).toHaveBeenCalledTimes(1);
    const [state, questions] = spy.mock.calls[0] as unknown as [string, Record<string, { type: string; criteria: unknown }>];
    expect(state).toContain('片名：千与千寻');
    expect(state).toContain('是否剧集：否');
    const q = questions['type'];
    expect(q.type).toBe('choice');
    expect(Array.isArray(q.criteria)).toBe(false); // 422 tripwire
    expect(Object.keys(q.criteria as Record<string, string>)).toContain(TYPE_SENTINEL);
  });

  it('Jev 选了哨兵 → 返回 null（不抛错：调用方据此保持现值交人工）', async () => {
    setSettingsProvider(() => jevSettings());
    vi.spyOn(jev, 'askJev').mockResolvedValue(choiceResult(TYPE_SENTINEL, 0.88));
    await expect(decideCinemaType({ title: 'X', isTv: true })).resolves.toBeNull();
  });

  it('Jev 抛错（超时/网络/畸形响应）→ 原样上抛，不回落', async () => {
    setSettingsProvider(() => jevSettings());
    vi.spyOn(jev, 'askJev').mockRejectedValue(new Error('jev timeout'));
    await expect(decideCinemaType({ title: 'X' })).rejects.toThrow('jev timeout');
  });

  it('answers 缺题单键（畸形响应）→ 抛错而非静默 null', async () => {
    setSettingsProvider(() => jevSettings());
    vi.spyOn(jev, 'askJev').mockResolvedValue({ model: 'jev-test', answers: {} } as unknown as JevResult);
    await expect(decideCinemaType({ title: 'X' })).rejects.toThrow(/choice/);
  });
});
