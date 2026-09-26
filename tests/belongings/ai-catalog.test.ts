// @vitest-environment node
/**
 * ai.ts 对外行为（issue 478 阶段 B）：aiSuggestCategory 签名不变，有表走表内编排、
 * 无表仍走旧 LLM 自由生成（AI_ICON_MENU 校验仍生效）、有表失败原样上抛。
 * mock core/app（getApp）/ core/ai（createAI）/ 本域 catalog-suggest。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiSuggestCategory } from '../../src/belongings/ai';
import * as appMod from '../../src/core/app';
import * as aiMod from '../../src/core/ai';
import * as catalogSuggest from '../../src/belongings/catalog-suggest';

vi.mock('../../src/core/app', () => ({
  getApp: vi.fn(),
  setApp: vi.fn(),
}));
vi.mock('../../src/core/ai', () => ({
  createAI: vi.fn(),
}));
vi.mock('../../src/belongings/catalog-suggest', () => ({
  suggestCategoryByCatalog: vi.fn(),
}));

const getApp = vi.mocked(appMod.getApp);
const createAI = vi.mocked(aiMod.createAI);
const suggestCategoryByCatalog = vi.mocked(catalogSuggest.suggestCategoryByCatalog);
const jsonMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getApp.mockReturnValue({} as any);
  createAI.mockReturnValue({ json: jsonMock } as any);
});

describe('aiSuggestCategory（阶段 B 接入）', () => {
  it('有表 → 走表内编排，直接采用其返回值', async () => {
    suggestCategoryByCatalog.mockResolvedValue({ category: '手机', icon: 'smartphone' });
    const r = await aiSuggestCategory('x', []);
    expect(r).toEqual({ category: '手机', icon: 'smartphone' });
    expect(suggestCategoryByCatalog).toHaveBeenCalledTimes(1);
  });

  it('无表（编排返回 null）→ 仍走旧 LLM 自由生成，AI_ICON_MENU 校验仍生效', async () => {
    suggestCategoryByCatalog.mockResolvedValue(null);
    // 图标非法（不在菜单）→ 应回落到 AI_FALLBACK_ICON，证明 AI_ICON_MENU 校验仍跑
    jsonMock.mockResolvedValue(JSON.stringify({ category: '书', icon: 'not-a-real-icon' }));
    const r = await aiSuggestCategory('书', []);
    expect(r.category).toBe('书');
    expect(r.icon).toBe('package'); // AI_FALLBACK_ICON
    expect(suggestCategoryByCatalog).toHaveBeenCalledTimes(1);
  });

  it('无表且 LLM 给了合法图标 → 原样保留', async () => {
    suggestCategoryByCatalog.mockResolvedValue(null);
    jsonMock.mockResolvedValue(JSON.stringify({ category: '书', icon: 'book' }));
    const r = await aiSuggestCategory('书', []);
    expect(r).toEqual({ category: '书', icon: 'book' });
  });

  it('有表但这轮失败（编排抛错）→ 原样向上抛', async () => {
    suggestCategoryByCatalog.mockRejectedValue(new Error('Jev 崩了'));
    await expect(aiSuggestCategory('x', [])).rejects.toThrow('Jev 崩了');
  });
});
