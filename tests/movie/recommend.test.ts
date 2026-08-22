/**
 * 影视 AI 推荐测试（ticket 14）：画像/提示词/解析/一键想看/弹窗链路
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { M, resetMovieState } from '../../src/movie/state';
import { rebuildItems } from '../../src/movie/data';
import {
  buildTasteProfile, buildRecommendPrompt, quickAddWant, parseRecommendJson, runAIRecommend, renderRecommendList,
} from '../../src/movie/recommend';
import { STATUS_WATCHED } from '../../src/movie/constants';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setApp } from '../../src/core/app';

function seedProfile(vault: MockVault) {
  vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n评分: 5\n观影日期: 2025-06-01T10:00:00\n类型: 剧情/悬疑\n导演: 诺兰\n主演: A/B\n---');
  vault.files.set('我的/影视/《B》.md', '---\ntags: [电影]\n评分: 4\n观影日期: 2025-05-01T10:00:00\n类型: 科幻\n导演: 诺兰\n---');
  vault.files.set('我的/影视/《C》.md', '---\ntags: [美剧]\n评分: -1\n---');
}

describe('buildTasteProfile', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seedProfile(vault);
    rebuildItems(mockAppWithVault(vault));
  });

  it('只看已看且评分>0；加权统计 top10；recent 最近10部', () => {
    const p = buildTasteProfile();
    expect(p.total).toBe(2);
    expect(p.groups).toContain('电影×9.0');
    expect(p.directors).toContain('诺兰×9.0');
    expect(p.genres).toContain('剧情×5.0');
    expect(p.recent.length).toBe(2);
    expect(p.recent[0]).toContain('A');
  });

  it('主演 slash 拆分加权', () => {
    const p = buildTasteProfile();
    expect(p.actors).toContain('A×5.0');
    expect(p.actors).toContain('B×5.0');
  });
});

describe('buildRecommendPrompt', () => {
  it('逐字模板：画像/排除清单/JSON 要求', () => {
    const prompt = buildRecommendPrompt(
      { total: 2, groups: ['电影×9.0'], genres: ['剧情×5.0'], directors: ['诺兰×9.0'], actors: ['A×5.0'], regions: [] },
      ['A(电影,评分5)'],
      ['A', 'B']
    );
    expect(prompt).toContain('你是资深影视推荐官。用户已看 2 部影视');
    expect(prompt).toContain('品类分布：电影×9.0');
    expect(prompt).toContain('排除清单（不要推荐这些）：A、B');
    expect(prompt).toContain('严格输出 JSON（不要输出其他内容）');
    expect(prompt).toContain('"recommendations"');
  });
});

describe('parseRecommendJson', () => {
  it('裸对象 / code block / 数组 三种形态', () => {
    expect(parseRecommendJson('{"recommendations":[{"title":"X"}]}')!.length).toBe(1);
    expect(parseRecommendJson('```json\n{"recommendations":[{"title":"Y"}]}\n```')![0].title).toBe('Y');
    expect(parseRecommendJson('[{"title":"Z"}]')![0].title).toBe('Z');
  });

  it('非法 JSON → null', () => {
    expect(parseRecommendJson('不是 JSON')).toBeNull();
    expect(parseRecommendJson('{"foo":1}')).toBeNull();
  });
});

describe('quickAddWant', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
  });

  it('建《名》.md：tags/评分-1/海报，刷新视图', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    await quickAddWant(app, '新片', '剧集');
    const content = vault.files.get('我的/影视/《新片》.md');
    expect(content).toBeDefined();
    expect(content).toContain('- 国产剧');
    expect(content).toContain('评分: -1');
    expect(content).toContain('海报: ');
  });

  it('重名 → Notice 已在库中，不建', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n---');
    const app = mockAppWithVault(vault);
    await quickAddWant(app, 'A', '电影');
    expect(vault.files.size).toBe(1);
  });

  it('创建后弹常驻 progress 通知「正在获取海报和豆瓣信息」→ 海报填充后原地更新完成', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    await quickAddWant(app, '新片2', '电影');
    await vi.advanceTimersByTimeAsync(0);
    const el = document.querySelector('.bz-notice--progress')!;
    expect(el).not.toBeNull();
    expect(el.textContent).toContain('正在获取海报和豆瓣信息');
    // 外部 watcher 写入海报 → 原地更新为已完成
    vault.files.set('我的/影视/《新片2》.md', '---\ntags: [电影]\n评分: -1\n海报: p.png\n---\n');
    await vi.advanceTimersByTimeAsync(2000);
    expect(el.textContent).toContain('海报和豆瓣信息获取完成');
    expect(el.classList.contains('bz-notice--success')).toBe(true);
    vi.useRealTimers();
  });
});

describe('runAIRecommend（动态通知模式）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seedProfile(vault);
    M.appRef = mockAppWithVault(vault);
    rebuildItems(M.appRef as any);
  });

  it('AI 成功 → 先发进度通知（不弹窗），完成后更新为成功并弹出结果界面', async () => {
    const raw = '{"recommendations":[{"title":"星际穿越","year":"2014","director":"诺兰","type":"电影","reason":"你偏爱诺兰导演的科幻风格"}]}';
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: raw } }] }) });

    const promise = runAIRecommend(M.appRef as any);
    // 未完成：不弹窗，仅见进度通知（自绘 toast）
    expect(M.recommendOverlay).toBeNull();
    const progressEl = document.querySelector('.bz-notice--progress') as HTMLElement;
    expect(progressEl).not.toBeNull();
    expect(progressEl.textContent).toContain('推荐'); // 进度通知（文本已进入分析阶段）
    await promise;
    // 完成：通知更新为成功 + 结果界面自动弹出
    expect(document.querySelector('.bz-notice--progress')).toBeNull();
    expect((document.querySelector('.bz-notice--success') as HTMLElement).textContent).toContain('AI 荐片完成');
    const modal = [...document.querySelectorAll('div')].find((d) => d.textContent?.includes('🤖 AI 荐片'));
    expect(modal).toBeDefined();
    const list = document.querySelector('.recommend-list') as HTMLElement;
    expect(list.textContent).toContain('星际穿越');
    expect(list.textContent).toContain('导演：诺兰');
    expect(list.textContent).toContain('💡 你偏爱诺兰导演');
    expect(list.textContent).toContain('加入想看');
  });

  it('AI 失败 → 通知更新为错误，不弹结果界面', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockRejectedValue(new Error('网络错误'));
    await runAIRecommend(M.appRef as any);
    expect((document.querySelector('.bz-notice--error') as HTMLElement).textContent).toContain('AI 荐片失败');
    expect(M.recommendOverlay).toBeNull();
  });

  it('格式无法解析 → 通知错误提示', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: '不是 JSON' } }] }) });
    await runAIRecommend(M.appRef as any);
    expect((document.querySelector('.bz-notice--error') as HTMLElement).textContent).toContain('AI 荐片失败');
    expect(M.recommendOverlay).toBeNull();
  });

  it('renderRecommendList：加入想看按钮触发 quickAddWant', async () => {
    const container = document.createElement('div');
    renderRecommendList(container, [{ title: '盗梦空间', year: '2010', director: '诺兰', type: '电影', reason: '好片' }]);
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === '加入想看')!;
    btn.click();
    // appRef 有值 → quickAddWant 建笔记
    await new Promise((r) => setTimeout(r, 10));
    expect((M.appRef as any).vault.files.has('我的/影视/《盗梦空间》.md')).toBe(true);
  });
});
