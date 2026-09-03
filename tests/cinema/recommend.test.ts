/**
 * 影院（cinema）AI 荐片测试：画像/提示词/解析/加入想看/页内化真实调用链路（不弹窗）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import {
  buildTasteProfile, buildRecommendPrompt, quickAddWant, parseRecommendJson, runAIRecommend,
  runSimilarRecommend, buildSimilarPrompt,
} from '../../src/cinema/recommend';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setApp } from '../../src/core/app';

function seedProfile(vault: MockVault) {
  vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n评分: 5\n观影日期: 2025-06-01T10:00:00\n类型: 剧情/悬疑\n导演: 诺兰\n主演: A/B\n---');
  vault.files.set('我的/影视/《B》.md', '---\ntags: [电影]\n评分: 4\n观影日期: 2025-05-01T10:00:00\n类型: 科幻\n导演: 诺兰\n---');
  vault.files.set('我的/影视/《C》.md', '---\ntags: [美剧]\n评分: -1\n---');
}

describe('cinema buildTasteProfile / prompt / parse', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seedProfile(vault);
    rebuildItems(mockAppWithVault(vault));
  });

  it('画像：只看已看且评分>0；加权 top10；recent 最近10部', () => {
    const p = buildTasteProfile();
    expect(p.total).toBe(2);
    expect(p.groups).toContain('电影×9.0');
    expect(p.directors).toContain('诺兰×9.0');
    expect(p.genres).toContain('剧情×5.0');
    expect(p.recent.length).toBe(2);
    expect(p.recent[0]).toContain('A');
  });

  it('提示词：包含画像与排除清单', () => {
    const p = buildTasteProfile();
    const prompt = buildRecommendPrompt(p, p.recent, ['A', 'B', 'C']);
    expect(prompt).toContain('资深影视推荐官');
    expect(prompt).toContain('诺兰×9.0');
    expect(prompt).toContain('排除清单');
    expect(prompt).toContain('"recommendations"');
  });

  it('解析：裸数组 / recommendations 键 / 代码块 / 非法返回 null', () => {
    expect(parseRecommendJson('[{"title":"X"}]')?.length).toBe(1);
    expect(parseRecommendJson('{"recommendations":[{"title":"X"}]}')?.length).toBe(1);
    expect(parseRecommendJson('```json\n{"similar":[{"title":"Y"}]}\n```')?.length).toBe(1);
    expect(parseRecommendJson('not json')).toBeNull();
    expect(parseRecommendJson('{"foo":[]}')).toBeNull();
  });
});

describe('cinema quickAddWant', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seedProfile(vault);
    M.appRef = mockAppWithVault(vault);
    rebuildItems(M.appRef as any);
  });

  it('加入想看：建笔记（评分 -1）；重复名提示不建', async () => {
    const app = M.appRef as any;
    await quickAddWant(app, '新片', '电影');
    const created = (app.vault as any).files.get('我的/影视/《新片》.md');
    expect(created).toContain('评分: -1');
    expect(created).toContain('- 电影');
    // 重复
    const before = (app.vault as any).files.size;
    await quickAddWant(app, '新片', '电影');
    expect((app.vault as any).files.size).toBe(before);
  });
});

describe('cinema runAIRecommend（页内化：等待 → 结果列表 / 失败，不弹窗）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seedProfile(vault);
    M.appRef = mockAppWithVault(vault);
    M.renderFn = vi.fn();
    rebuildItems(M.appRef as any);
  });

  it('AI 成功 → 页内运行态 → aiResult 就绪（不弹窗/无通知）', async () => {
    const raw = '{"recommendations":[{"title":"星际穿越","year":"2014","director":"诺兰","type":"电影","reason":"你偏爱诺兰导演的科幻风格"}]}';
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: raw } }] }) });

    // 触发后同步应处于运行中且切到 ai 视图
    const promise = runAIRecommend(M.appRef as any);
    expect(M.aiRunning).toBe(true);
    expect(M.view).toBe('ai');
    expect(M.aiWaitMsg).toContain('已分析 2 部观影历史');
    expect(M.renderFn).toHaveBeenCalled();
    await promise;
    expect(M.aiRunning).toBe(false);
    expect(M.aiResult?.length).toBe(1);
    expect(M.aiResult?.[0].title).toBe('星际穿越');
    expect(M.aiError).toBeNull();
    // 无任何弹窗/通知
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
    expect(document.querySelector('.bz-notice--progress')).toBeNull();
  });

  it('AI 失败 → aiError 就绪（无结果、无弹窗）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: 'not json' } }] }) });
    await runAIRecommend(M.appRef as any);
    expect(M.aiRunning).toBe(false);
    expect(M.aiResult).toBeNull();
    expect(M.aiError).toContain('AI 分析失败');
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
  });

  it('重入防护：运行中再次触发 runAIRecommend → 直接 return（AI 只调一次，结果不被并发覆盖）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockClear(); // 前面用例的调用计数清零
    let release!: (v: any) => void;
    const gate = new Promise<any>((r) => { release = r; }); // 第一轮 AI 挂起
    (requestUrl as any).mockReturnValue(gate);

    const p1 = runAIRecommend(M.appRef as any);
    expect(M.aiRunning).toBe(true);
    // 运行中重复点击（工具钮/开始按钮）→ 重入直接 return，不发第二发 AI 请求
    await runAIRecommend(M.appRef as any);
    expect(M.aiRunning).toBe(true); // 仍由第一轮占用
    release({ status: 200, text: JSON.stringify({ choices: [{ message: { content: '{"recommendations":[{"title":"星际穿越"}]}' } }] }) });
    await p1;
    expect(requestUrl).toHaveBeenCalledTimes(1);
    expect(M.aiRunning).toBe(false);
    expect(M.aiResult?.length).toBe(1);
  });

  it('重入防护：AI 运行中触发找同类 → 直接 return（共用 aiRunning 状态机，不发请求）', async () => {
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockClear();
    M.aiRunning = true; // 模拟荐片进行中
    const base = M.items.find((i) => i.name === 'A')!;
    await runSimilarRecommend(base, M.appRef as any);
    expect(requestUrl).not.toHaveBeenCalled();
    expect(M.aiTitle).toBe('AI 荐片'); // 未被找同类改写
  });
});

describe('cinema 找同类（ADR-0087 迁入 runSimilarRecommend/buildSimilarPrompt）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seedProfile(vault);
    M.appRef = mockAppWithVault(vault);
    M.renderFn = vi.fn();
    rebuildItems(M.appRef as any);
  });

  it('提示词：以基准影片 + 已看清单为输入，要求 JSON 输出', () => {
    const base = M.items.find((i) => i.name === 'A')!;
    const watched = M.items.filter((i) => i.status === 2 && i.name !== 'A'); // B 已看
    const prompt = buildSimilarPrompt(base, watched);
    expect(prompt).toContain('基准影片');
    expect(prompt).toContain('《A》');
    expect(prompt).toContain('B');
    expect(prompt).toContain('"recommendations"');
    expect(prompt).toContain('资深影视推荐官');
  });

  it('AI 成功 → 页内 aiResult 就绪，标题为「找同类 ·《A》」（不弹窗）', async () => {
    const base = M.items.find((i) => i.name === 'A')!;
    const raw = '{"recommendations":[{"title":"禁闭岛","year":"2010","director":"马丁","type":"电影","reason":"同导演悬疑风格"}]}';
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: raw } }] }) });

    const promise = runSimilarRecommend(base, M.appRef as any);
    expect(M.aiRunning).toBe(true);
    expect(M.aiTitle).toContain('找同类');
    expect(M.aiTitle).toContain('A');
    expect(M.view).toBe('ai');
    await promise;
    expect(M.aiRunning).toBe(false);
    expect(M.aiResult?.length).toBe(1);
    expect(M.aiResult?.[0].title).toBe('禁闭岛');
    expect(M.aiError).toBeNull();
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
  });

  it('AI 失败 → aiError（无结果）', async () => {
    const base = M.items.find((i) => i.name === 'A')!;
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: 'nope' } }] }) });
    await runSimilarRecommend(base, M.appRef as any);
    expect(M.aiRunning).toBe(false);
    expect(M.aiResult).toBeNull();
    expect(M.aiError).toContain('AI 分析失败');
  });
});
