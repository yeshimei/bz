/**
 * 影院（cinema）AI 荐片测试：画像/提示词/解析/加入想看/真实调用链路/结果窗
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import {
  buildTasteProfile, buildRecommendPrompt, quickAddWant, parseRecommendJson, runAIRecommend, showResultWindow,
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

describe('cinema quickAddWant / showResultWindow', () => {
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

  it('结果窗：渲染推荐卡片 + 加入想看按钮 + 遮罩关闭', async () => {
    const app = M.appRef as any;
    showResultWindow(app, '🤖 AI 荐片', [{ title: '星际穿越', year: '2014', director: '诺兰', type: '电影', reason: '你偏爱诺兰' }]);
    const mask = document.querySelector('.bz-cinema-mask') as HTMLElement;
    expect(mask).toBeTruthy();
    expect(mask.textContent).toContain('星际穿越');
    expect(mask.textContent).toContain('诺兰');
    // 点加入想看
    (mask.querySelector('[data-rec-name]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect((app.vault as any).files.get('我的/影视/《星际穿越》.md')).toContain('评分: -1');
    // 遮罩关闭
    mask.click();
    expect(document.querySelector('.bz-cinema-mask')).toBeNull();
  });
});

describe('cinema runAIRecommend（动态通知模式）', () => {
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

  it('AI 成功 → 进度通知 → 成功 + 结果窗弹出', async () => {
    const raw = '{"recommendations":[{"title":"星际穿越","year":"2014","director":"诺兰","type":"电影","reason":"你偏爱诺兰导演的科幻风格"}]}';
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: raw } }] }) });

    const promise = runAIRecommend(M.appRef as any);
    const progressEl = document.querySelector('.bz-notice--progress') as HTMLElement;
    expect(progressEl).not.toBeNull();
    await promise;
    expect(document.querySelector('.bz-notice--progress')).toBeNull();
    expect((document.querySelector('.bz-notice--success') as HTMLElement).textContent).toContain('AI 分析完成');
    const mask = document.querySelector('.bz-cinema-mask') as HTMLElement;
    expect(mask.textContent).toContain('AI 荐片');
    expect(mask.textContent).toContain('星际穿越');
  });

  it('AI 失败 → 通知错误，不弹结果窗', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: 'not json' } }] }) });
    await runAIRecommend(M.appRef as any);
    expect((document.querySelector('.bz-notice--error') as HTMLElement).textContent).toContain('AI 分析失败');
    expect(document.querySelector('.bz-cinema-mask')).toBeNull();
  });
});
