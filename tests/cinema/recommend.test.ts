/**
 * 影院（cinema）AI 荐片测试：画像/提示词/解析/加入想看/页内化真实调用链路（不弹窗）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import {
  buildTasteProfile, buildRecommendPrompt, buildFollowupPrompt, quickAddWant, parseRecommendJson, runAIRecommend,
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

  it('提示词（方案 A）：画像 + 要 20 部按匹配度排序，不再打包全量排除清单', () => {
    const p = buildTasteProfile();
    const prompt = buildRecommendPrompt(p, p.recent);
    expect(prompt).toContain('资深影视推荐官');
    expect(prompt).toContain('诺兰×9.0');
    expect(prompt).toContain('20 部');
    expect(prompt).toContain('从高到低');
    expect(prompt).not.toContain('排除清单');
    expect(prompt).toContain('"recommendations"');
  });

  it('补问提示词：带已推荐名单（不要重复）+ 再要 10 部', () => {
    const p = buildTasteProfile();
    const prompt = buildFollowupPrompt(p, p.recent, ['X1', 'X2']);
    expect(prompt).toContain('不要重复推荐');
    expect(prompt).toContain('X1、X2');
    expect(prompt).toContain('10 部');
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
    // 首轮直接给满 5 部库外新片 → 不触发补问（requestUrl 恰好 1 次）
    release({ status: 200, text: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ recommendations: [1, 2, 3, 4, 5].map((i) => ({ title: `新片${i}` })) }) } }] }) });
    await p1;
    expect(requestUrl).toHaveBeenCalledTimes(1);
    expect(M.aiRunning).toBe(false);
    expect(M.aiResult?.length).toBe(5);
  });

  it('重入防护：AI 运行中触发找同类 → 直接 return（共用 aiRunning 状态机，不发请求）', async () => {
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockClear();
    M.aiRunning = true; // 模拟荐片进行中
    const base = M.items.find((i) => i.name === 'A')!;
    await runSimilarRecommend(base, M.appRef as any);
    expect(requestUrl).not.toHaveBeenCalled();
  });

  it('增强包（换一批）：找同类记录基准影片 aiBase；荐片清空基准（按模式重跑）', async () => {
    const base = M.items.find((i) => i.name === 'A')!;
    // 找同类（无 provider → aiError，但基准影片在进入 try 前已记录）
    await runSimilarRecommend(base, M.appRef as any);
    expect(M.aiBase?.name).toBe('A');
    // 荐片重跑：清空基准 → 「换一批」回到荐片模式
    await runAIRecommend(M.appRef as any);
    expect(M.aiBase).toBeNull();
  });

  it('方案 A：在库/重复候选本地去重取前 5；不足 5 部自动补问一轮凑齐（相关性序保留）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockClear(); // 此前用例的累计调用清零
    // 库内片 = A/B/C。首轮 5 条：A 在库（弃）+ N1~N4（拾 4，不足 5 → 补问）
    // 补问 4 条：N1 重复、A 在库（皆弃）+ N5、N6 → 共 6 取前 5
    (requestUrl as any)
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ recommendations: [{ title: 'A' }, { title: 'N1' }, { title: 'N2' }, { title: 'N3' }, { title: 'N4' }] }) } }] }) })
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ recommendations: [{ title: 'N1' }, { title: 'A' }, { title: 'N5' }, { title: 'N6' }] }) } }] }) });

    await runAIRecommend(M.appRef as any);

    expect(M.aiError).toBeNull();
    expect(M.aiResult?.map((r: any) => r.title)).toEqual(['N1', 'N2', 'N3', 'N4', 'N5']);
    expect(requestUrl).toHaveBeenCalledTimes(2);
    // 补问 prompt 带已见名单（含在库的 A 与首轮 N1~N4），不含全量库清单
    const followupBody = String((requestUrl as any).mock.calls[1][0].body);
    expect(followupBody).toContain('不要重复推荐');
    expect(followupBody).toContain('N4');
    expect(followupBody).toContain('A');
  });

  it('方案 A：补问失败保留首轮去重结果（不落 aiError）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any)
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ choices: [{ message: { content: '{"recommendations":[{"title":"M1"},{"title":"M2"}]}' } }] }) })
      .mockRejectedValueOnce(new Error('boom'));

    await runAIRecommend(M.appRef as any);

    expect(M.aiRunning).toBe(false);
    expect(M.aiError).toBeNull();
    expect(M.aiResult?.map((r: any) => r.title)).toEqual(['M1', 'M2']);
  });

  it('方案 A：两轮候选全在库/重复 → 空 结果落兜底文案（不展示空列表）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any)
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ choices: [{ message: { content: '{"recommendations":[{"title":"A"},{"title":"B"}]}' } }] }) })
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ choices: [{ message: { content: '{"recommendations":[{"title":"C"}]}' } }] }) });

    await runAIRecommend(M.appRef as any);

    expect(M.aiRunning).toBe(false);
    expect(M.aiResult).toBeNull();
    expect(M.aiError).toContain('没有凑齐');
  });

  it('补扫 B 回归：补问往返期间 aiRunning 保持 true（不回落待机、重入守卫拦第二次 AI、结果不被覆盖）', async () => {
    // 旧实现首轮解析完就翻 aiRunning=false 再 await refine——补问往返落在
    // 「running=false/result=null/error=null」三空态：AI 页整页回落 guide、「开始」可点、
    // 重入守卫失效可触发第二次并发 AI（双倍 token）、两轮结果互相覆盖
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(M.appRef as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockClear();
    // 首轮只给 1 条库外新片（不足 5 → 必进补问轮）；补问轮请求挂起在 gate 上
    (requestUrl as any)
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ choices: [{ message: { content: '{"recommendations":[{"title":"N1"}]}' } }] }) });
    let releaseFollowup!: (v: any) => void;
    const gate = new Promise<any>((r) => { releaseFollowup = r; });
    (requestUrl as any).mockReturnValueOnce(gate);

    const p = runAIRecommend(M.appRef as any);
    // 等补问轮发起（refine 已置补充等待文案）
    await vi.waitFor(() => expect(M.aiWaitMsg).toContain('补充推荐'));
    // 补问往返期间：仍在运行态（AI 页等待分支继续渲染，不回落待机 guide）
    expect(M.aiRunning).toBe(true);
    expect(M.aiResult).toBeNull();
    expect(M.aiError).toBeNull();
    // 重入守卫仍生效：此时再点「开始推荐」直接 return，不发第三发 AI 请求
    await runAIRecommend(M.appRef as any);
    expect(requestUrl).toHaveBeenCalledTimes(2);

    releaseFollowup({ status: 200, text: JSON.stringify({ choices: [{ message: { content: '{"recommendations":[{"title":"N5"}]}' } }] }) });
    await p;
    expect(M.aiRunning).toBe(false);
    expect(M.aiResult?.map((r: any) => r.title)).toEqual(['N1', 'N5']);
    expect(M.aiError).toBeNull();
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
