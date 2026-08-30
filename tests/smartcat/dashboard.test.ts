/**
 * 小橘数据面板测试（ticket 071）：纯函数层（统计/情绪时间线/分布/成长轨迹/周报收集/标签表完整性）
 * + UI 层（jsdom：五页签渲染、页签切换、报告页签、关闭/遮罩、幂等重开、只读不写盘）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import {
  computeDashboardStats,
  buildEmotionTimeline,
  buildEmotionDistribution,
  buildSourceDistribution,
  resolveTrackedDirLabel,
  distributionRows,
  buildGrowthTrail,
  buildWeeklyReports,
  emotionLabel,
  truncateText,
  OCEAN_LABELS,
  TRAIT_LABELS,
  TRAIT_GROUP_LABELS,
  openSmartcatDashboard,
  closeSmartcatDashboard,
  registerInsightPatchChannel,
} from '../../src/smartcat/dashboard';
import { DEFAULT_TRAITS } from '../../src/smartcat/character';
import { moodLevelFromPad, MOOD_MAP } from '../../src/smartcat/mood';
import { getSmartcatFilePath, defaultSmartCatData, applyInsightPatch, saveSmartCatData } from '../../src/smartcat/data';
import type { SmartCatData } from '../../src/smartcat/types';

/** 构造面板夹具（PAD 心情好档原型点 + 2 观察 1 洞察 + 成长轨迹两条） */
function fixtureData(): SmartCatData {
  const d = defaultSmartCatData();
  d.mood.pad = { pleasure: 70, arousal: 62, dominance: 55 };
  d.mood.currentEmotion = 'happy';
  d.mood.lastUpdate = Date.now() - 5 * 60 * 1000;
  d.personalityGrowth.relationship.trust = 0.72;
  d.personalityGrowth.relationship.attachment = 0.61;
  d.personalityGrowth.behaviorStats.interactionCount = 12;
  d.personalityGrowth.behaviorStats.emotionalTone = 0.25;
  d.personalityGrowth.growthHistory = [
    { timestamp: Date.now() - 3600 * 1000, source: 'interaction', interactionType: 'pet', intensity: 1 },
    { timestamp: Date.now() - 7200 * 1000, source: 'reflection', insights: [{ text: 'a' }, { text: 'b' }] },
    { timestamp: NaN, source: 'bad' }, // 非法时间应被过滤
  ];
  d.memory.reflection.count = 3;
  d.memory.reflection.digestCount = 2;
  d.memory.reflection.lastReflectAt = Date.now() - 60 * 1000;
  const iso = (agoMin: number) => new Date(Date.now() - agoMin * 60 * 1000).toISOString();
  d.memory.memoryStream = [
    { id: 'm1', created: iso(10), lastAccessed: iso(10), description: '用户说：今天完成了复习计划，很开心', importance: 0.8, type: 'observation', source: 'chat', emotion: 'happy' },
    { id: 'm2', created: iso(30), lastAccessed: iso(30), description: '你写了日记：最近有点低落', importance: 0.6, type: 'observation', source: 'diary', emotion: 'sad' },
    { id: 'i1', created: iso(5), lastAccessed: iso(5), description: '【洞察】用户坚持复习', importance: 0.75, type: 'insight', source: 'reflection', evidenceIds: ['m1'] },
    { id: 'm3', created: iso(20), lastAccessed: iso(20), description: '无情绪标注的观察', importance: 0.4, type: 'observation', source: 'flash' },
  ];
  return d;
}

function makeApp(fixture: SmartCatData) {
  const vault = new MockVault();
  vault.create(getSmartcatFilePath(), JSON.stringify(fixture));
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({
    storagePath: 'CONFIG/STORAGE',
    smartcatEnabled: true,
    // 2026-08-23 合并一套：数据面板跟随聊天/设置面板共用的开关（原 dashboard 独立键已删）
    smartcatMobileDefaultFullscreen: false,
  }) as any);
  return { app, vault };
}

describe('dashboard 纯函数', () => {
  it('computeDashboardStats 聚合各段统计（观察/洞察分计 + 关系张量兜底）', () => {
    const st = computeDashboardStats(fixtureData());
    expect(st.streamCount).toBe(4);
    expect(st.observationCount).toBe(3);
    expect(st.insightCount).toBe(1);
    expect(st.reflectionCount).toBe(3);
    expect(st.digestCount).toBe(2);
    expect(st.interactionCount).toBe(12);
    expect(st.trust).toBeCloseTo(0.72);
    expect(st.attachment).toBeCloseTo(0.61);
    // 空数据兜底
    const empty = computeDashboardStats(defaultSmartCatData());
    expect(empty.streamCount).toBe(0);
    expect(empty.trust).toBeCloseTo(0.5);
  });

  it('moodLevelFromPad 原型最近邻判档（中性点→平常心，好档原型→心情好）', () => {
    expect(moodLevelFromPad({ pleasure: 50, arousal: 50, dominance: 50 })).toBe('neutral');
    expect(moodLevelFromPad({ pleasure: 70, arousal: 62, dominance: 55 })).toBe('good');
    expect(MOOD_MAP.good.state).toBe('心情好');
  });

  it('buildEmotionTimeline 仅带情绪条目、新→旧排序、截断 limit', () => {
    const d = fixtureData();
    const tl = buildEmotionTimeline(d.memory.memoryStream, 20);
    expect(tl.length).toBe(2); // m1 happy / m2 sad（m3 无情绪、i1 无情绪）
    expect(tl[0].emotion).toBe('happy');
    expect(tl[1].emotion).toBe('sad');
    expect(tl[0].time).toBeGreaterThanOrEqual(tl[1].time);
    expect(buildEmotionTimeline(d.memory.memoryStream, 1).length).toBe(1);
  });

  it('buildEmotionDistribution 只计观察；buildSourceDistribution 中文归并', () => {
    const d = fixtureData();
    expect(buildEmotionDistribution(d.memory.memoryStream)).toEqual({ happy: 1, sad: 1 });
    const rows = distributionRows(buildSourceDistribution(d.memory.memoryStream));
    const labels = rows.map((r) => r.label);
    expect(labels).toContain('聊天');
    expect(labels).toContain('日记');
    expect(labels).toContain('闪念');
    expect(rows[0].count).toBeGreaterThanOrEqual(rows[rows.length - 1].count); // 降序
  });

  it('buildSourceDistribution（ticket 163）：洞察按「洞察」单列一行；行为小结保留「行为小结」行', () => {
    const d = fixtureData();
    // 加一条行为小结（observation + source=digest）与一条周报洞察
    d.memory.memoryStream.push(
      { id: 'dg1', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '行为小结文案', importance: 0.6, type: 'observation', source: 'digest' },
      { id: 'wr1', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '周报洞察', importance: 0.8, type: 'insight', source: 'weekly-report' },
    );
    const dist = buildSourceDistribution(d.memory.memoryStream);
    expect(dist['洞察']).toBe(2); // i1 reflection + wr1 weekly-report
    expect(dist['行为小结']).toBe(1);
    expect(dist['日记']).toBe(1);
    expect(dist['聊天']).toBe(1);
  });

  it('resolveTrackedDirLabel + buildSourceDistribution（ticket 163）：note 引用条目按追查目录分行；未命中回退「记忆目录」', () => {
    const note = (path: string, extra: Record<string, any> = {}): any => ({
      id: 'n1', created: new Date().toISOString(), lastAccessed: new Date().toISOString(),
      description: path, importance: 0.5, type: 'observation', source: 'note', ref: { path, locator: undefined }, ...extra,
    });
    const dirs = ['我的/日记', '我的/信'];
    // 我的/信 命中 → 标签为该配置目录
    expect(resolveTrackedDirLabel(note('我的/信/第1封信.md'), dirs)).toBe('我的/信');
    // 子目录前缀命中；反斜杠归一
    expect(resolveTrackedDirLabel(note('我的/信/子目录/a.md'), dirs)).toBe('我的/信');
    expect(resolveTrackedDirLabel(note('我的\\信\\a.md'), dirs)).toBe('我的/信');
    // 不在配置目录 → null（回退旧标签）
    expect(resolveTrackedDirLabel(note('归档/网页剪藏/x.md'), dirs)).toBeNull();
    // 无 dirs / 非 note → null
    expect(resolveTrackedDirLabel(note('我的/信/a.md'))).toBeNull();
    expect(resolveTrackedDirLabel({ ...note('我的/信/a.md'), source: 'diary' } as any, dirs)).toBeNull();
    // 无 ref 时从 description 取路径段
    expect(resolveTrackedDirLabel({ ...note('我的/信/a.md'), ref: undefined } as any, dirs)).toBe('我的/信');
    // 分布聚合：note 按目录分行
    const stream = [
      note('我的/信/第1封信.md'),
      note('我的/信/第2封信.md'),
      note('归档/网页剪藏/x.md'), // 不在配置 → 记忆目录
      { id: 'd1', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '日记段', importance: 0.8, type: 'observation', source: 'diary' },
    ];
    const dist = buildSourceDistribution(stream, dirs);
    expect(dist['我的/信']).toBe(2);
    expect(dist['记忆目录']).toBe(1);
    expect(dist['日记']).toBe(1);
    // 未传 dirs → 全部 note 归「记忆目录」（旧口径兼容）
    const distNoDirs = buildSourceDistribution(stream);
    expect(distNoDirs['记忆目录']).toBe(3);
  });

  it('buildGrowthTrail 时间倒序、来源中文化、非法时间过滤、详情摘要', () => {
    const trail = buildGrowthTrail(fixtureData().personalityGrowth.growthHistory, 10);
    expect(trail.length).toBe(2); // NaN 时间被过滤
    expect(trail[0].sourceText).toBe('互动微移');
    expect(trail[0].detail).toBe('pet');
    expect(trail[1].sourceText).toBe('反思成长');
    expect(trail[1].detail).toBe('2 条洞察');
    expect(trail[0].time).toBeGreaterThanOrEqual(trail[1].time);
  });

  it('标签表完整性：TRAIT_LABELS 与 30 特质一一对应；OCEAN 五轴；群组九个', () => {
    expect(Object.keys(TRAIT_LABELS).sort()).toEqual(Object.keys(DEFAULT_TRAITS).sort());
    expect(Object.keys(OCEAN_LABELS).length).toBe(5);
    expect(Object.keys(TRAIT_GROUP_LABELS).length).toBe(9);
  });

  it('buildWeeklyReports 收集 weekly-report 洞察：新→旧、去前缀、过滤非法与空文本', () => {
    const iso = (agoH: number) => new Date(Date.now() - agoH * 3600 * 1000).toISOString();
    const stream = [
      { id: 'w1', created: iso(1), lastAccessed: iso(1), description: '【本周懂你报告】这周你写了三篇日记。', importance: 0.8, type: 'insight', source: 'weekly-report' },
      { id: 'r1', created: iso(2), lastAccessed: iso(2), description: '【洞察】反思产物不算报告', importance: 0.7, type: 'insight', source: 'reflection' },
      { id: 'w2', created: iso(24 * 8), lastAccessed: iso(24 * 8), description: '上周你专注复习。', importance: 0.8, type: 'insight', source: 'weekly-report' },
      { id: 'w3', created: iso(3), lastAccessed: iso(3), description: '', importance: 0.8, type: 'insight', source: 'weekly-report' }, // 空文本过滤
      { id: 'o1', created: iso(4), lastAccessed: iso(4), description: '普通观察', importance: 0.5, type: 'observation', source: 'chat' },
    ] as any[];
    const rows = buildWeeklyReports(stream);
    expect(rows.length).toBe(2);
    expect(rows[0].text).toBe('这周你写了三篇日记。'); // 新的在前 + 前缀已剥
    expect(rows[1].text).toBe('上周你专注复习。');
    expect(rows[0].time).toBeGreaterThanOrEqual(rows[1].time);
    // 空流/缺段兜底
    expect(buildWeeklyReports([])).toEqual([]);
  });

  it('emotionLabel 已知词中文化、未知词回显；truncateText 截断加省略号', () => {
    expect(emotionLabel('happy')).toBe('开心');
    expect(emotionLabel('mysterious')).toBe('mysterious');
    expect(truncateText('一二三四五', 3)).toBe('一二三…');
    expect(truncateText('abc', 5)).toBe('abc');
  });
});

describe('openSmartcatDashboard UI', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    closeSmartcatDashboard();
  });

  it('打开渲染头行 + 五页签 + 总览英雄区（当前心情与瞬时情绪）', async () => {
    const { app } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel');
    expect(popup).not.toBeNull();
    expect(document.getElementById('smartcat-dashboard-mask')).not.toBeNull();
    expect(popup!.querySelector('.bz-win-head')).not.toBeNull();
    expect(popup!.querySelector('#smartcat-dash-close')).not.toBeNull();
    expect(popup!.querySelector('#smartcat-dash-refresh')).toBeNull(); // 097 C1：手动刷新按钮已删
    expect(popup!.querySelectorAll('.bz-sc-dash-tab').length).toBe(6); // P3: 新增行为页签
    const overview = popup!.querySelector('[data-pane="overview"]') as HTMLElement;
    expect(overview.style.display).not.toBe('none');
    expect(overview.textContent).toContain('心情好');
    expect(overview.textContent).toContain('瞬时情绪：开心');
    // PAD 条与相处统计
    expect(overview.textContent).toContain('愉悦');
    expect(overview.textContent).toContain('信任');
  }, 15000);

  it('页签切换：记忆页显示记忆列表（观察/洞察徽章），总览隐藏', async () => {
    const { app } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    const memTab = popup.querySelector('[data-tab="memory"]') as HTMLElement;
    memTab.click();
    const memPane = popup.querySelector('[data-pane="memory"]') as HTMLElement;
    const overviewPane = popup.querySelector('[data-pane="overview"]') as HTMLElement;
    expect(memPane.style.display).not.toBe('none');
    expect(overviewPane.style.display).toBe('none');
    expect(memPane.querySelectorAll('.bz-sc-dash-memory').length).toBe(4);
    expect(memPane.querySelectorAll('.bz-sc-dash-badge.insight').length).toBe(1);
    expect(memPane.textContent).toContain('聊天');
  }, 15000);

  it('记忆页签来源分布（ticket 163）：配置记忆目录时 note 条目按追查目录分行；最近记忆列表同口径', async () => {
    const d = fixtureData();
    d.memory.memoryStream.push(
      { id: 'n1', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '我的/信/第1封信.md', importance: 0.5, type: 'observation', source: 'note', ref: { path: '我的/信/第1封信.md', locator: undefined } },
      { id: 'n2', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '我的/信/第2封信.md', importance: 0.5, type: 'observation', source: 'note', ref: { path: '我的/信/第2封信.md', locator: undefined } },
    );
    const vault = new MockVault();
    vault.create(getSmartcatFilePath(), JSON.stringify(d));
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({
      storagePath: 'CONFIG/STORAGE',
      smartcatEnabled: true,
      smartcatMobileDefaultFullscreen: false,
      memoryDirectories: ['我的/日记', '我的/信'],
    }) as any);
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="memory"]') as HTMLElement).click();
    const memPane = popup.querySelector('[data-pane="memory"]') as HTMLElement;
    // 来源分布卡：我的/信 独立分行；洞察行计入（fixture i1）
    expect(memPane.textContent).toContain('记忆来源分布');
    expect(memPane.textContent).toContain('我的/信');
    expect(memPane.textContent).toContain('洞察');
    expect(memPane.textContent).not.toContain('记忆目录');
    // 最近记忆列表：note 行标签同样显示 我的/信
    expect(memPane.querySelectorAll('.bz-sc-dash-memory').length).toBe(6);
  }, 15000);

  it('P1-29：固定按钮经常驻实例通道落盘——常驻侧任意保存后 pinned 保持 true（不被副本回滚）', async () => {
    const { app, vault } = makeApp(fixtureData());
    // 模拟常驻实例通道（与 index ensureSmartCat 注册的 apply 同构）：改内存对象 + 统一 dataSaver
    const resident = fixtureData();
    registerInsightPatchChannel({
      apply: async (id, patch) => {
        if (!applyInsightPatch(resident, id, patch)) return false;
        await saveSmartCatData(app as any, resident);
        return true;
      },
    });
    try {
      await openSmartcatDashboard(app as any);
      const popup = document.getElementById('smartcat-dashboard-panel')!;
      (popup.querySelector('[data-tab="memory"]') as HTMLElement).click();
      const pinBtn = popup.querySelector('[data-pane="memory"] .bz-sc-dash-insight-actions .bz-sc-dash-mini-btn') as HTMLButtonElement;
      expect(pinBtn).not.toBeNull();
      expect(pinBtn.textContent).toBe('固定');
      pinBtn.click();
      await new Promise((r) => setTimeout(r, 20)); // 异步写盘 + 重渲染
      // 磁盘已写入 pinned=true
      let onDisk = JSON.parse(vault.files.get(getSmartcatFilePath())!);
      expect(onDisk.memory.memoryStream.find((m: any) => m.id === 'i1').pinned).toBe(true);
      // 常驻侧触发任意保存（如心情衰减/观察落盘）
      resident.mood.pad.pleasure = 61;
      await saveSmartCatData(app as any, resident);
      onDisk = JSON.parse(vault.files.get(getSmartcatFilePath())!);
      expect(onDisk.memory.memoryStream.find((m: any) => m.id === 'i1').pinned).toBe(true); // 修正未被回滚
      // 面板重渲染后按钮态翻转
      const btn2 = document.querySelector('[data-pane="memory"] .bz-sc-dash-insight-actions .bz-sc-dash-mini-btn') as HTMLButtonElement;
      expect(btn2.textContent).toBe('取消固定');
    } finally {
      registerInsightPatchChannel(null);
    }
  }, 15000);

  it('人格页签：OCEAN + 特质分组 + 成长轨迹渲染', async () => {
    const { app } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="personality"]') as HTMLElement).click();
    const pane = popup.querySelector('[data-pane="personality"]') as HTMLElement;
    expect(pane.textContent).toContain('开放性');
    expect(pane.textContent).toContain('依恋（Bowlby）');
    expect(pane.textContent).toContain('存在感（Yalom');
    expect(pane.querySelectorAll('.bz-sc-dash-trail-row').length).toBe(2);
    expect(pane.textContent).toContain('互动微移');
  }, 15000);

  it('情绪页签：趋势文本 + 时间线圆点行', async () => {
    const { app } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="emotion"]') as HTMLElement).click();
    const pane = popup.querySelector('[data-pane="emotion"]') as HTMLElement;
    expect(pane.textContent).toContain('情绪趋势');
    expect(pane.querySelectorAll('.bz-sc-dash-tl-item').length).toBe(2);
    expect(pane.querySelectorAll('.bz-sc-dash-tl-item.pos').length).toBe(1);
    expect(pane.querySelectorAll('.bz-sc-dash-tl-item.neg').length).toBe(1);
  }, 15000);

  /** 带两期周报的夹具（报告页签专用；不动共享 fixtureData 以免影响既有计数断言） */
  function fixtureWithReports(): SmartCatData {
    const d = fixtureData();
    d.memory.memoryStream.push(
      { id: 'wr1', created: new Date(Date.now() - 3600 * 1000).toISOString(), lastAccessed: new Date(Date.now() - 3600 * 1000).toISOString(), description: '【本周懂你报告】这周你写了三篇日记，心情整体向上。', importance: 0.8, type: 'insight', source: 'weekly-report' },
      { id: 'wr2', created: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), lastAccessed: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), description: '【本周懂你报告】上周你的主题是复习计划。', importance: 0.8, type: 'insight', source: 'weekly-report' },
    );
    return d;
  }

  it('报告页签（2026-08-23 周报移入）：最新一期全文 + 历史报告列表', async () => {
    const { app } = makeApp(fixtureWithReports());
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="report"]') as HTMLElement).click();
    const pane = popup.querySelector('[data-pane="report"]') as HTMLElement;
    // 最新一期全文（去前缀）
    expect(pane.textContent).toContain('本周懂你报告');
    expect(pane.textContent).toContain('这周你写了三篇日记，心情整体向上。');
    // 历史：第二期在列
    expect(pane.textContent).toContain('上周你的主题是复习计划。');
    expect(pane.querySelectorAll('.bz-sc-dash-memory').length).toBe(1);
  }, 15000);

  it('报告页签空态：无周报时给生成时机提示不抛错', async () => {
    const { app } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="report"]') as HTMLElement).click();
    const pane = popup.querySelector('[data-pane="report"]') as HTMLElement;
    expect(pane.textContent).toContain('本周报告还没生成');
  }, 15000);

  it('关闭按钮移除 DOM；遮罩点击关闭；重复打开幂等（仅一实例）', async () => {
    const { app } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    let popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('#smartcat-dash-close') as HTMLElement).click();
    expect(document.getElementById('smartcat-dashboard-panel')).toBeNull();
    expect(document.getElementById('smartcat-dashboard-mask')).toBeNull();

    // 遮罩点击关闭
    await openSmartcatDashboard(app as any);
    const mask = document.getElementById('smartcat-dashboard-mask')!;
    mask.click(); // e.target === mask
    expect(document.getElementById('smartcat-dashboard-panel')).toBeNull();

    // 幂等重开
    await openSmartcatDashboard(app as any);
    await openSmartcatDashboard(app as any);
    expect(document.querySelectorAll('#smartcat-dashboard-panel').length).toBe(1);
  }, 15000);

  it('头行只剩标题与关闭按钮（097 C1：手动刷新已删，改 vault modify 防抖静默刷新）', async () => {
    const { app, vault } = makeApp(fixtureData());
    const writesBefore = vault.modifiedPaths.length;
    await openSmartcatDashboard(app as any);
    expect(vault.modifiedPaths.length).toBe(writesBefore); // 打开不写盘
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    const headBtns = popup.querySelector('.bz-win-head div') as HTMLElement;
    expect(headBtns.querySelectorAll('button').length).toBe(1); // 仅 ❌ 关闭
    expect(headBtns.textContent).toBe('❌');
  }, 15000);

  it('空数据（无 smartcat.json）：默认数据渲染空态文案不抛错', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', smartcatMobileDefaultFullscreen: false }) as any);
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    expect(popup.textContent).toContain('平常心'); // 默认 PAD 50/50/50 → 中性档
    (popup.querySelector('[data-tab="memory"]') as HTMLElement).click();
    const memPane = popup.querySelector('[data-pane="memory"]') as HTMLElement;
    expect(memPane.textContent).toContain('还没有记忆');
  }, 15000);
});