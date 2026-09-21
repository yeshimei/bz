/**
 * 影院类型自动判定（issue 393 / ADR-0174）测试：
 * - 候选来自 ALL_TAGS 单源、criteria 是对象（写成数组会被 API 422 拒，必须有断言守住）；
 * - 哨兵 → 零写入、confidence < 0.5 → 零写入、已有 tag → 零 Jev 调用、Jev 抛错 → 零写入；
 * - 补出的 tag 必能经 getGroupSafe 命中已知组（回归守卫：不可能产出「其他」之外的游离值）。
 * askJev / isJevConfigured 全部 mock，命令层零写入策略靠其抛错/返回值语义断言。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { ALL_TAGS, getGroupSafe } from '../../src/cinema/constants';
import {
  buildTypeCriteria,
  buildTypeState,
  judgeTypeChoice,
  decideCinemaType,
  decideTypeForActiveFile,
  TYPE_SENTINEL,
} from '../../src/cinema/type-decide';

// mock core/jev：控制 askJev / isJevConfigured（命令层零写入策略依赖其抛错语义）
import { askJev, isJevConfigured } from '../../src/core/jev';
vi.mock('../../src/core/jev', () => ({
  askJev: vi.fn(),
  isJevConfigured: vi.fn(() => true),
}));
const askJevMock = vi.mocked(askJev);
const isJevConfiguredMock = vi.mocked(isJevConfigured);

// ---------- 辅助 ----------

function choiceAnswer(choice: string, confidence: number): any {
  return {
    type: 'choice',
    choice,
    confidence,
    probabilities: { [choice]: confidence },
  };
}

function resultWith(answer: any): any {
  return { model: 'jev-1.13.0', answers: { type: answer } };
}

/** 构造 mock app + 活动笔记（frontmatter 由 fm 给定；basename 默认《未分类片》） */
function makeCinemaApp(fm: Record<string, unknown>, basename = '《未分类片》') {
  const vault = new MockVault();
  const fmText =
    '---\n' +
    Object.entries(fm)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? '[' + (v as unknown[]).join(', ') + ']' : v}`)
      .join('\n') +
    '\n---\n正文\n';
  const path = `我的/影视/${basename}.md`;
  vault.files.set(path, fmText);
  const app = mockAppWithVault(vault);
  const file = { path, basename, name: `${basename}.md` };
  app.workspace.getActiveFile = () => file as any;
  return { vault, app, file, path };
}

// ---------- 纯逻辑 ----------

describe('cinema/type-decide 纯逻辑', () => {
  beforeEach(() => {
    askJevMock.mockReset();
    isJevConfiguredMock.mockReturnValue(true);
  });

  it('buildTypeCriteria：键 = ALL_TAGS ∪ {哨兵}，且是对象（非数组，否则 API 422）', () => {
    const criteria = buildTypeCriteria();
    expect(Array.isArray(criteria)).toBe(false);
    const keys = Object.keys(criteria).sort();
    const expected = [...ALL_TAGS, TYPE_SENTINEL].sort();
    expect(keys).toEqual(expected);
    // 每个 ALL_TAGS 的值都是其组名（非空串，组名当说明）
    for (const tag of ALL_TAGS) {
      expect(typeof criteria[tag]).toBe('string');
      expect(criteria[tag].length).toBeGreaterThan(0);
    }
    expect(criteria[TYPE_SENTINEL]).toBe('以上候选都不匹配');
  });

  it('judgeTypeChoice：命中哨兵「以上都不是」→ null', () => {
    const criteria = buildTypeCriteria();
    expect(judgeTypeChoice(choiceAnswer(TYPE_SENTINEL, 0.99), criteria)).toBeNull();
  });

  it('judgeTypeChoice：命中具体项但 confidence < 0.5 → null（置信度兜底；边界 0.5 命中）', () => {
    const criteria = buildTypeCriteria();
    const tag = ALL_TAGS[0];
    expect(judgeTypeChoice(choiceAnswer(tag, 0.49), criteria)).toBeNull();
    expect(judgeTypeChoice(choiceAnswer(tag, 0.5), criteria)).toBe(tag);
  });

  it('judgeTypeChoice：命中具体项且置信度足够 → 返回该 tag', () => {
    const criteria = buildTypeCriteria();
    const tag = ALL_TAGS[5];
    expect(judgeTypeChoice(choiceAnswer(tag, 0.9), criteria)).toBe(tag);
  });

  it('judgeTypeChoice：choice 不在 criteria（接口异常）→ null', () => {
    const criteria = buildTypeCriteria();
    expect(judgeTypeChoice(choiceAnswer('游离值', 0.99), criteria)).toBeNull();
  });

  it('buildTypeState：只压关键字段、跳过空值（不灌正文）', () => {
    const s = buildTypeState({ title: '星际穿越', genre: '科幻', director: null, year: '2014', synopsis: '' });
    expect(s).toContain('标题：星际穿越');
    expect(s).toContain('豆瓣类型：科幻');
    expect(s).toContain('年份：2014');
    expect(s).not.toContain('导演'); // null 跳过
    expect(s).not.toContain('简介'); // 空串跳过
  });

  it('decideCinemaType：送进 askJev 的 choice.criteria 是对象、键集合 = ALL_TAGS ∪ 哨兵，并返回判定 tag', async () => {
    const tag = ALL_TAGS[3];
    askJevMock.mockResolvedValue(resultWith(choiceAnswer(tag, 0.95)));
    const got = await decideCinemaType({ title: 'X', genre: '剧情' });
    expect(got).toBe(tag);
    expect(askJevMock).toHaveBeenCalledTimes(1);
    const questions = askJevMock.mock.calls[0][1] as Record<string, any>;
    const q = questions.type;
    expect(q.type).toBe('choice');
    expect(Array.isArray(q.criteria)).toBe(false); // 字典形态
    expect(Object.keys(q.criteria).sort()).toEqual([...ALL_TAGS, TYPE_SENTINEL].sort());
  });

  it('decideCinemaType：isJevConfigured 为 false → 抛错且零 Jev 调用', async () => {
    isJevConfiguredMock.mockReturnValue(false);
    await expect(decideCinemaType({ title: 'X' })).rejects.toThrow(/未配置/);
    expect(askJevMock).not.toHaveBeenCalled();
  });

  it('decideCinemaType：askJev 抛错 → 上抛（不静默返空）', async () => {
    askJevMock.mockRejectedValue(new Error('Jev API 500'));
    await expect(decideCinemaType({ title: 'X' })).rejects.toThrow(/500/);
  });

  it('回归守卫：每个 ALL_TAGS 项都能经 getGroupSafe 命中已知组（非「其他」）', () => {
    for (const tag of ALL_TAGS) {
      expect(getGroupSafe(tag)).not.toBe('其他');
    }
  });

  it('decideCinemaType 返回的有效 tag（非哨兵、置信度够）必在 ALL_TAGS 内 → getGroupSafe 命中已知组', async () => {
    for (const tag of ALL_TAGS) {
      askJevMock.mockResolvedValueOnce(resultWith(choiceAnswer(tag, 0.9)));
      const got = await decideCinemaType({ title: 'X' });
      expect(got).toBe(tag);
      expect(getGroupSafe(got as string)).not.toBe('其他');
    }
  });
});

// ---------- 命令入口（零写入策略） ----------

describe('cinema/type-decide 命令 bz-cinema-type-decide', () => {
  beforeEach(() => {
    askJevMock.mockReset();
    isJevConfiguredMock.mockReturnValue(true);
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
  });

  it('已有命中 ALL_TAGS 的 tag → 跳过、零 Jev 调用、提示「已有分类」', async () => {
    const { app } = makeCinemaApp({ tags: ['电影'] });
    await decideTypeForActiveFile(app as any);
    expect(askJevMock).not.toHaveBeenCalled();
    expect(hasNotice(/已有分类/)).toBe(true);
  });

  it('已有非类型 tag（未命中 ALL_TAGS）→ 视为未分类、允许判定（会调 Jev）', async () => {
    const { app } = makeCinemaApp({ tags: ['随手记'] });
    askJevMock.mockResolvedValue(resultWith(choiceAnswer(ALL_TAGS[0], 0.9)));
    await decideTypeForActiveFile(app as any);
    expect(askJevMock).toHaveBeenCalledTimes(1);
  });

  it('哨兵被选中 → 零写入（文件不变）、提示未能确定', async () => {
    const { vault, app, path } = makeCinemaApp({});
    const before = vault.files.get(path);
    askJevMock.mockResolvedValue(resultWith(choiceAnswer(TYPE_SENTINEL, 0.99)));
    await decideTypeForActiveFile(app as any);
    expect(vault.files.get(path)).toBe(before); // 原样
    expect(hasNotice(/未能确定类型/)).toBe(true);
  });

  it('confidence < 0.5 → 零写入（文件不变）', async () => {
    const { vault, app, path } = makeCinemaApp({});
    const before = vault.files.get(path);
    askJevMock.mockResolvedValue(resultWith(choiceAnswer(ALL_TAGS[0], 0.3)));
    await decideTypeForActiveFile(app as any);
    expect(vault.files.get(path)).toBe(before);
  });

  it('Jev 抛错 → 笔记不动、无通知风暴（提示失败）', async () => {
    const { vault, app, path } = makeCinemaApp({});
    const before = vault.files.get(path);
    askJevMock.mockRejectedValue(new Error('Jev API 503'));
    await decideTypeForActiveFile(app as any);
    expect(vault.files.get(path)).toBe(before);
    expect(hasNotice(/类型判定失败/)).toBe(true);
  });

  it('正常判定 → 写入 frontmatter tags（保持影院域写法）、提示成功', async () => {
    const tag = ALL_TAGS[2];
    const { vault, app, path } = makeCinemaApp({});
    askJevMock.mockResolvedValue(resultWith(choiceAnswer(tag, 0.92)));
    await decideTypeForActiveFile(app as any);
    const fm = parseFrontmatter(vault.files.get(path) ?? '') ?? {};
    const tags = Array.isArray(fm['tags']) ? (fm['tags'] as unknown[]).map(String) : [];
    expect(tags).toContain(tag);
    expect(hasNotice(/已判定类型/)).toBe(true);
  });

  it('无活动笔记 → 提示警告、零 Jev 调用', async () => {
    const { vault, app, path } = makeCinemaApp({});
    app.workspace.getActiveFile = () => null;
    const before = vault.files.get(path);
    await decideTypeForActiveFile(app as any);
    expect(askJevMock).not.toHaveBeenCalled();
    expect(vault.files.get(path)).toBe(before);
    expect(hasNotice(/没有正在打开的笔记/)).toBe(true);
  });

  it('活动笔记不在影视目录内 → 零 Jev 调用 + 零写入（不污染非影视笔记的原生 tags）', async () => {
    // 目录守卫用默认「我的/影视」；把活动笔记指向其它目录（文献盒）模拟误触发命令
    const vault = new MockVault();
    const outsidePath = '我的/文献/《某文献》.md';
    const fmText = '---\ntags: [随手记]\n---\n正文\n';
    vault.files.set(outsidePath, fmText);
    const app = mockAppWithVault(vault);
    app.workspace.getActiveFile = () => ({ path: outsidePath, basename: '《某文献》', name: '《某文献》.md' }) as any;
    await decideTypeForActiveFile(app as any);
    expect(askJevMock).not.toHaveBeenCalled();
    expect(vault.files.get(outsidePath)).toBe(fmText); // 原样未写
    expect(hasNotice(/这不是影视笔记/)).toBe(true);
  });
});
