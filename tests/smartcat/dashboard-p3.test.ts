/**
 * 行为页签 UI 测试（ticket 123；ticket 129 升级：时间线式 + 来源筛选 + 滚动加载 + 去提升按钮）
 * 覆盖：
 * - 页签显隐（showBehaviorLog 开关）；
 * - 时间线渲染 + 人类文案（无事件名）+ type 徽标文案化 + 无「提升为记忆」按钮；
 * - 来源统计块点击筛选闭环（点来源筛选 / 点「行为总数」还原 / 再点已选还原）；
 * - 滚动加载（首屏 50 → 按钮追加 50 → 全部加载后按钮隐藏）；
 * - 统计数字全量口径（不受分页影响）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock settings-provider
const mockSettings: Record<string, any> = {
  showBehaviorLog: true,
  behaviorMaxDays: 30,
  behaviorMaxCount: 2000,
  enableAutoLinking: true,
  linkWindowDays: 7,
  smartcatMobileDefaultFullscreen: false,
};
vi.mock('../../src/core/settings-provider', () => ({
  tryGetSettings: () => mockSettings,
}));

// mock data module (仅替换 loadSmartCatData 返回值；其余导出透传)
const mocks = vi.hoisted(() => ({
  loadData: vi.fn(),
}));
vi.mock('../../src/smartcat/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/smartcat/data')>();
  return {
    ...actual,
    loadSmartCatData: mocks.loadData,
  };
});

// mock mobile / esc-manager / notice
vi.mock('../../src/core/mobile', () => ({
  applyMobileWindowFullscreen: vi.fn(),
  isMobileEnv: () => false,
}));
vi.mock('../../src/core/esc-manager', () => ({
  escManager: { register: () => ({ unregister: vi.fn() }) },
}));
vi.mock('../../src/core/notice', () => ({
  notice: vi.fn(),
}));

import { defaultSmartCatData } from '../../src/smartcat/data';
import { openSmartcatDashboard, closeSmartcatDashboard } from '../../src/smartcat/dashboard';
import type { SmartCatData } from '../../src/smartcat/types';

/** 行为条目夹具（带 structured metadata；tsAgoMin 控制排序——数值越大越旧） */
function behItem(source: string, type: string, meta: Record<string, any>, tsAgoMin = 1): any {
  return {
    id: `beh_${Math.random().toString(36).substr(2, 8)}`,
    timestamp: new Date(Date.now() - tsAgoMin * 60000).toISOString(),
    type,
    source,
    description: `${source}:${type}${meta?.name ? ` ${meta.name}` : ''}`,
    metadata: meta,
  };
}

const SAVED_NEWS = behItem('news', 'saved', { entityType: 'news', action: 'saved', name: '好文', extras: { platform: '聚合讯', durationMin: 5 } }, 1);
const WATCHED_MOVIE = behItem('movie', 'watched', { entityType: 'movie', action: 'watched', name: '肖申克的救赎' }, 2);
const COMPLETED_MEMO = behItem('memo', 'completed', { entityType: 'task', action: 'completed', name: '买菜' }, 3);
const READ_DIARY = behItem('diary', 'created', { entityType: 'diary_entry', action: 'created', name: '2026-08-25 11:00' }, 4);

function makeData(behavior: any[] = [], memory: any[] = []): SmartCatData {
  const d = defaultSmartCatData();
  d.memory.behaviorStream = behavior as any;
  d.memory.memoryStream = memory as any;
  return d;
}

const mockApp = {
  vault: {
    adapter: { read: vi.fn().mockResolvedValue('{}'), readBinary: vi.fn().mockRejectedValue(new Error('no file')) },
    on: vi.fn(),
    offref: vi.fn(),
    getAbstractFileByPath: vi.fn(),
  },
  workspace: { on: vi.fn() },
  metadataCache: { on: vi.fn() },
};

/** 打开面板并切到行为页签 */
async function openBehaviorTab(): Promise<void> {
  await openSmartcatDashboard(mockApp as any);
  const behaviorTab = Array.from(document.querySelectorAll('.bz-sc-dash-tab')).find((t) => t.textContent === '行为');
  expect(behaviorTab).toBeDefined();
  (behaviorTab as HTMLElement).click();
}

describe('行为页签（ticket 129：时间线 + 筛选 + 滚动加载）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    mockSettings.showBehaviorLog = true;
    mocks.loadData.mockReset();
  });

  afterEach(() => {
    closeSmartcatDashboard();
    document.body.innerHTML = '';
  });

  it('showBehaviorLog=true 时渲染行为页签；false 时隐藏', async () => {
    mocks.loadData.mockResolvedValue(makeData([SAVED_NEWS]));
    await openSmartcatDashboard(mockApp as any);
    let tabTexts = Array.from(document.querySelectorAll('.bz-sc-dash-tab')).map((t) => t.textContent);
    expect(tabTexts).toContain('行为');

    closeSmartcatDashboard();
    mockSettings.showBehaviorLog = false;
    mocks.loadData.mockResolvedValue(makeData([]));
    await openSmartcatDashboard(mockApp as any);
    tabTexts = Array.from(document.querySelectorAll('.bz-sc-dash-tab')).map((t) => t.textContent);
    expect(tabTexts).not.toContain('行为');
  });

  it('时间线式列表：人类文案渲染、无事件名、无提升按钮、type 徽标文案化', async () => {
    mocks.loadData.mockResolvedValue(makeData([SAVED_NEWS, WATCHED_MOVIE, COMPLETED_MEMO, READ_DIARY]));
    await openBehaviorTab();

    // 时间线容器 + 条目
    const tl = document.querySelector('.bz-sc-dash-behavior-tl');
    expect(tl).not.toBeNull();
    const items = document.querySelectorAll('.bz-sc-dash-behavior-item');
    expect(items.length).toBe(4);

    // 人类文案（渲染时模板）：news 时长入文案、movie/memo/diary 各自句式
    const tlText = tl!.textContent || '';
    expect(tlText).toContain('你保存了《好文》（聚合讯·读了 5 分钟）');
    expect(tlText).toContain('你看完了《肖申克的救赎》');
    expect(tlText).toContain('你完成了备忘录「买菜」');
    expect(tlText).toContain('你写了一篇日记（2026-08-25 11:00）');
    // 不显示事件名（news:saved 式）
    expect(tlText).not.toContain('news:');
    expect(tlText).not.toContain(':saved');
    expect(tlText).not.toContain('news:saved');
    // type 徽标文案化（saved → 保存）
    const firstBadge = document.querySelector('.bz-sc-dash-behavior-type');
    expect(firstBadge!.textContent).toBe('保存');
    // 无「提升为记忆」按钮
    expect(document.querySelectorAll('.bz-sc-dash-promote-btn').length).toBe(0);
    expect(tlText).not.toContain('提升为记忆');
    // 无 structured 的旧式兜底在行为面板不出现事件名（此处全部有 structured，兜底用例见数据层测试）
  });

  it('来源统计块点击筛选闭环：点「聚合讯」只显 news → 再点还原 → 点「行为总数」还原', async () => {
    const newsItems = Array.from({ length: 3 }, (_, i) => behItem('news', 'read', { entityType: 'news', action: 'read', name: `文章${i}`, extras: { platform: '聚合讯', durationMin: 1 } }, 10 + i));
    mocks.loadData.mockResolvedValue(makeData([...newsItems, WATCHED_MOVIE, COMPLETED_MEMO, READ_DIARY]));
    await openBehaviorTab();

    // 统计块全量口径：行为总数 6、聚合讯 3、影视 1、备忘录 1、日记 1
    const statNum = (label: string): string | null => {
      const block = Array.from(document.querySelectorAll<HTMLElement>('.bz-sc-dash-stat')).find((s) => (s.querySelector('.bz-sc-dash-stat-label') as HTMLElement)?.textContent === label);
      return block ? (block.querySelector('.bz-sc-dash-stat-num') as HTMLElement).textContent : null;
    };
    expect(statNum('行为总数')).toBe('6');
    expect(statNum('聚合讯')).toBe('3');

    // 点聚合讯块 → 只剩 news 条目
    const newsBlock = document.querySelector<HTMLElement>('.bz-sc-dash-stat-click[data-source="news"]');
    expect(newsBlock).not.toBeNull();
    newsBlock!.click();
    let tlText = document.querySelector('.bz-sc-dash-behavior-tl')!.textContent || '';
    expect(tlText).toContain('你阅读了《文章2》');
    expect(tlText).not.toContain('你看完了《肖申克的救赎》');
    expect(tlText).not.toContain('你完成了备忘录「买菜」');
    // active 高亮跟随筛选（重渲染后需重新取引用）
    expect(document.querySelector<HTMLElement>('.bz-sc-dash-stat-click[data-source="news"]')!.classList.contains('active')).toBe(true);
    // 统计仍全量（行为总数 6）
    expect(statNum('行为总数')).toBe('6');

    // 再点已选来源 → 还原全部（语义闭环）
    document.querySelector<HTMLElement>('.bz-sc-dash-stat-click[data-source="news"]')!.click();
    tlText = document.querySelector('.bz-sc-dash-behavior-tl')!.textContent || '';
    expect(tlText).toContain('你看完了《肖申克的救赎》');
    expect(tlText).toContain('你完成了备忘录「买菜」');

    // 点「行为总数」（全部块）→ 还原
    document.querySelector<HTMLElement>('.bz-sc-dash-stat-click[data-source="news"]')!.click(); // 先筛选
    document.querySelector<HTMLElement>('.bz-sc-dash-stat-click[data-source=""]')!.click(); // 还原
    tlText = document.querySelector('.bz-sc-dash-behavior-tl')!.textContent || '';
    expect(tlText).toContain('你看完了《肖申克的救赎》');
    expect(document.querySelector<HTMLElement>('.bz-sc-dash-stat-click[data-source=""]')!.classList.contains('active')).toBe(true);
  });

  it('滚动加载：首屏 50 条，加载更多按钮按 50 追加，全部加载后按钮隐藏', async () => {
    const many: any[] = [];
    for (let i = 0; i < 130; i++) {
      many.push(i % 2 === 0
        ? behItem('news', 'read', { entityType: 'news', action: 'read', name: `新闻${i}`, extras: { platform: '聚合讯', durationMin: 2 } }, 100 + i)
        : behItem('memo', 'completed', { entityType: 'task', action: 'completed', name: `备忘${i}` }, 100 + i));
    }
    mocks.loadData.mockResolvedValue(makeData(many));
    await openBehaviorTab();

    // 统计全量（130）
    const totalBlock = Array.from(document.querySelectorAll<HTMLElement>('.bz-sc-dash-stat'))
      .find((s) => (s.querySelector('.bz-sc-dash-stat-label') as HTMLElement)?.textContent === '行为总数');
    expect((totalBlock!.querySelector('.bz-sc-dash-stat-num') as HTMLElement).textContent).toBe('130');

    // 首屏 50
    expect(document.querySelectorAll('.bz-sc-dash-behavior-item').length).toBe(50);
    let loadMore = document.querySelector<HTMLElement>('.bz-sc-dash-load-more');
    expect(loadMore).not.toBeNull();

    // 追加 50 → 100
    loadMore!.click();
    expect(document.querySelectorAll('.bz-sc-dash-behavior-item').length).toBe(100);
    // 再追加 → 130，按钮隐藏（display:none）
    loadMore = document.querySelector<HTMLElement>('.bz-sc-dash-load-more');
    loadMore!.click();
    expect(document.querySelectorAll('.bz-sc-dash-behavior-item').length).toBe(130);
    loadMore = document.querySelector<HTMLElement>('.bz-sc-dash-load-more');
    expect(loadMore).not.toBeNull();
    expect(loadMore!.style.display).toBe('none');
  });

  it('筛选态下滚动加载的「剩余条数」以筛选后的条目为准', async () => {
    const newsItems = Array.from({ length: 120 }, (_, i) => behItem('news', 'read', { entityType: 'news', action: 'read', name: `文章${i}`, extras: { platform: '聚合讯', durationMin: 1 } }, 200 + i));
    const memos = Array.from({ length: 20 }, (_, i) => behItem('memo', 'completed', { entityType: 'task', action: 'completed', name: `备忘${i}` }, 200 + i));
    mocks.loadData.mockResolvedValue(makeData([...newsItems, ...memos]));
    await openBehaviorTab();

    // 行为总数 140；首屏 50
    expect(document.querySelectorAll('.bz-sc-dash-behavior-item').length).toBe(50);
    // 筛选聚合讯（120 条）→ 重渲染回到首批 50（news 前 50）
    document.querySelector<HTMLElement>('.bz-sc-dash-stat-click[data-source="news"]')!.click();
    expect(document.querySelectorAll('.bz-sc-dash-behavior-item').length).toBe(50);
    // 追两次 → 100 → 120，按钮隐藏
    let loadMore = document.querySelector<HTMLElement>('.bz-sc-dash-load-more');
    loadMore!.click();
    loadMore = document.querySelector<HTMLElement>('.bz-sc-dash-load-more');
    loadMore!.click();
    expect(document.querySelectorAll('.bz-sc-dash-behavior-item').length).toBe(120);
    expect(document.querySelector<HTMLElement>('.bz-sc-dash-load-more')!.style.display).toBe('none');
    // 列表只含 news 文案
    const tlText = document.querySelector('.bz-sc-dash-behavior-tl')!.textContent || '';
    expect(tlText).not.toContain('你完成了备忘录');
  });
});