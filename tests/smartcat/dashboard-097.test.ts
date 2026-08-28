/**
 * 小橘数据面板 097 升级测试：A1 归因徽标/引用原文 / A2 安静陪伴 chip / A3 标注覆盖率小字 /
 * B1 感情卡惰性视图口径统一 / B2 洞察行 theme·推翻·固定视觉态 / C1 自动刷新
 * （modify 命中防抖 3s 静默刷新·保持页签·零 toast；防抖合并；非目标路径不触发；
 *   close 后监听全清 + 幂等重开无泄漏；刷新失败保旧画面静默）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import {
  buildGrowthTrail,
  describeEmotionCoverage,
  computeDashboardStats,
  openSmartcatDashboard,
  closeSmartcatDashboard,
} from '../../src/smartcat/dashboard';
import { getSmartcatFilePath, defaultSmartCatData, DAY_MS } from '../../src/smartcat/data';
import { lazyAttachment } from '../../src/smartcat/absence';
import type { SmartCatData, MemoryStreamEntry } from '../../src/smartcat/types';

/** 基础夹具（PAD 好档 + 3 条观察：happy/sad/无标注） */
function fixtureData(): SmartCatData {
  const d = defaultSmartCatData();
  d.mood.pad = { pleasure: 70, arousal: 62, dominance: 55 };
  d.mood.currentEmotion = 'happy';
  d.mood.lastUpdate = Date.now() - 5 * 60 * 1000;
  const iso = (agoMin: number) => new Date(Date.now() - agoMin * 60 * 1000).toISOString();
  d.memory.memoryStream = [
    { id: 'm1', created: iso(10), lastAccessed: iso(10), description: '用户说：今天完成了复习计划，很开心', importance: 0.8, type: 'observation', source: 'chat', emotion: 'happy' },
    { id: 'm2', created: iso(30), lastAccessed: iso(30), description: '你写了日记：最近有点低落', importance: 0.6, type: 'observation', source: 'diary', emotion: 'sad' },
    { id: 'm3', created: iso(20), lastAccessed: iso(20), description: '无情绪标注的观察', importance: 0.4, type: 'observation', source: 'flash' },
  ];
  return d;
}

function makeApp(fixture: SmartCatData) {
  const vault = new MockVault();
  vault.create(getSmartcatFilePath(), JSON.stringify(fixture));
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false }) as any);
  return { app, vault };
}

/** 记忆页按描述片段定位记忆行 */
function findMemoryRow(pane: HTMLElement, substr: string): HTMLElement {
  return [...pane.querySelectorAll('.bz-sc-dash-memory')].find((r) => (r.textContent || '').includes(substr)) as HTMLElement;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  closeSmartcatDashboard();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------- A1 成长轨迹归因 ----------------

describe('097 A1 buildGrowthTrail 归因扩展字段', () => {
  it('llm 带 quote / lexical 无 quote / 缺 attribution 兼容旧数据 / 枚举外 mode 丢弃', () => {
    const t = (agoMin: number) => Date.now() - agoMin * 60 * 1000;
    const history = [
      { timestamp: t(1), source: 'reflection', insights: ['a'], attribution: { mode: 'llm', quote: '用户连续三晚熬夜到两点才睡' } },
      { timestamp: t(2), source: 'reflection', insights: ['b'], attribution: { mode: 'lexical' } },
      { timestamp: t(3), source: 'reflection', insights: ['c'], attribution: {} },
      { timestamp: t(4), source: 'interaction', interactionType: 'pet' }, // 旧数据无 attribution
      { timestamp: t(5), source: 'reflection', insights: ['d'], attribution: { mode: 'weird', quote: 'x' } },
      { timestamp: NaN, source: 'bad' },
    ];
    const trail = buildGrowthTrail(history, 10);
    expect(trail.length).toBe(5); // NaN 时间过滤
    expect(trail[0].mode).toBe('llm');
    expect(trail[0].quote).toBe('用户连续三晚熬夜到两点才睡');
    expect(trail[1].mode).toBe('lexical');
    expect(trail[1].quote).toBeUndefined(); // 词法推断一律无解释文案
    expect(trail[2].mode).toBeUndefined();
    expect(trail[2].quote).toBeUndefined();
    expect(trail[3].mode).toBeUndefined(); // 旧数据缺 attribution
    expect(trail[4].mode).toBeUndefined(); // 枚举外 mode 丢弃
  });

  it('UI：llm 行显「LLM 归因」徽标 + 引用原文截 30 字；lexical 行只显「词法推断」无引用', async () => {
    const d = fixtureData();
    d.personalityGrowth.growthHistory = [
      { timestamp: Date.now() - 60 * 1000, source: 'reflection', insights: ['洞察甲'], attribution: { mode: 'llm', quote: '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十' } }, // 50 字
      { timestamp: Date.now() - 120 * 1000, source: 'reflection', insights: ['洞察乙'], attribution: { mode: 'lexical' } },
    ];
    const { app } = makeApp(d);
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="personality"]') as HTMLElement).click();
    const pane = popup.querySelector('[data-pane="personality"]') as HTMLElement;
    expect(pane.textContent).toContain('LLM 归因');
    expect(pane.textContent).toContain('词法推断');
    const quotes = [...pane.querySelectorAll('.bz-sc-dash-tl-quote')];
    expect(quotes.length).toBe(1); // 仅 llm 行有引用原文
    expect(quotes[0].textContent!.length).toBe(31); // 30 字 + 省略号
    expect(quotes[0].textContent!.endsWith('…')).toBe(true);
    closeSmartcatDashboard();
  });
});

// ---------------- A2 安静陪伴 chip ----------------

describe('097 A2 安静陪伴 chip', () => {
  it('quietMode.on=true 渲染「安静陪伴中」chip；非 quiet 态不渲染该元素', async () => {
    const on = fixtureData();
    on.editingData = { quietMode: { on: true, since: Date.now() - 3600 * 1000 } };
    const { app } = makeApp(on);
    await openSmartcatDashboard(app as any);
    let overview = document.querySelector('[data-pane="overview"]') as HTMLElement;
    expect(overview.querySelectorAll('.bz-sc-dash-chip-quiet').length).toBe(1);
    expect(overview.textContent).toContain('安静陪伴中');
    closeSmartcatDashboard();

    const off = fixtureData(); // editingData null（非 quiet 态）
    const app2 = makeApp(off).app;
    await openSmartcatDashboard(app2 as any);
    overview = document.querySelector('[data-pane="overview"]') as HTMLElement;
    expect(overview.querySelectorAll('.bz-sc-dash-chip-quiet').length).toBe(0);
    expect(overview.textContent).not.toContain('安静陪伴中'); // 不留占位
    closeSmartcatDashboard();
  });
});

// ---------------- A3 标注覆盖率小字 ----------------

describe('097 A3 情绪标注覆盖率小字', () => {
  /** 构造 n 条观察，其中前 annotated 条带情绪、前 nonCalm 条为非 calm */
  function mk(n: number, annotated: number, nonCalm: number): MemoryStreamEntry[] {
    const out: MemoryStreamEntry[] = [];
    const iso = new Date().toISOString();
    for (let i = 0; i < n; i++) {
      out.push({
        id: `o${i}`, created: iso, lastAccessed: iso, description: `观察${i}`, importance: 0.5, type: 'observation',
        ...(i < annotated ? { emotion: i < nonCalm ? 'sad' : 'calm' } : {}),
      } as MemoryStreamEntry);
    }
    return out;
  }

  it('纯函数：样本 ≥5 显百分比；<5 只显条数不显百分比', () => {
    // 6 条观察 / 4 已标注 / 3 非 calm → 覆盖 67%、非 calm 占比 50%
    expect(describeEmotionCoverage(mk(6, 4, 3))).toBe('情绪标注覆盖 67%（非 calm 占比 50%）');
    expect(describeEmotionCoverage(mk(3, 1, 1))).toBe('情绪标注：样本 3 条，已标注 1 条（非 calm 1 条）');
    expect(describeEmotionCoverage([])).toBe('情绪标注：样本 0 条，已标注 0 条（非 calm 0 条）');
  });

  it('UI：情绪趋势卡 meta 下方出现覆盖率行（两个分支）', async () => {
    const { app } = makeApp(fixtureData()); // 3 条观察 <5 → 条数分支
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="emotion"]') as HTMLElement).click();
    let pane = popup.querySelector('[data-pane="emotion"]') as HTMLElement;
    expect(pane.textContent).toContain('波动度');
    expect(pane.textContent).toContain('情绪标注：样本 3 条');
    closeSmartcatDashboard();

    const big = fixtureData();
    const iso = new Date().toISOString();
    for (let i = 0; i < 3; i++) {
      big.memory.memoryStream.push({ id: `x${i}`, created: iso, lastAccessed: iso, description: `补充观察${i}`, importance: 0.5, type: 'observation', source: 'chat', emotion: 'happy' });
    }
    const app2 = makeApp(big).app; // 6 观察全标注且非 calm → 覆盖 83% 分支
    await openSmartcatDashboard(app2 as any);
    pane = document.querySelector('[data-pane="emotion"]') as HTMLElement;
    (pane.closest('#smartcat-dashboard-panel')!.querySelector('[data-tab="emotion"]') as HTMLElement).click();
    expect(pane.textContent).toContain('情绪标注覆盖 83%（非 calm 占比 83%）');
    closeSmartcatDashboard();
  });
});

// ---------------- B1 感情卡惰性视图口径 ----------------

describe('097 B1 感情卡惰性视图口径', () => {
  it('依恋行与 computeDashboardStats 的 lazyAttachment 视图一致；hint 含衰减说明', async () => {
    const d = fixtureData();
    d.personalityGrowth.relationship.trust = 0.72;
    d.personalityGrowth.relationship.attachment = 0.61;
    d.editingData = { lastPresenceAt: Date.now() - 20 * DAY_MS }; // 缺席 20 天 → 明显衰减
    const { app } = makeApp(d);
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="personality"]') as HTMLElement).click();
    const pane = popup.querySelector('[data-pane="personality"]') as HTMLElement;
    const relCard = [...pane.querySelectorAll('.bz-sc-dash-card')].find((c) => (c.querySelector('.bz-sc-dash-card-title')?.textContent || '').includes('感情（关系张量）')) as HTMLElement;
    const attachRow = [...relCard.querySelectorAll('.bz-sc-dash-row')].find((r) => r.querySelector('.bz-sc-dash-row-name')?.textContent === '依恋') as HTMLElement;
    const shown = Number(attachRow.querySelector('.bz-sc-dash-row-val')!.textContent);
    expect(shown).toBe(Math.round(lazyAttachment(0.61, d.editingData.lastPresenceAt, Date.now()) * 100));
    expect(shown).toBe(Math.round(computeDashboardStats(d).attachment * 100)); // 与总览口径一致
    expect(shown).not.toBe(61); // 确实经过分离衰减而非直读基线
    expect(relCard.textContent).toContain('已按缺席分离衰减（读侧视图，不写盘）');
    closeSmartcatDashboard();
  });
});

// ---------------- B2 洞察行 theme / 推翻 / 固定视觉态 ----------------

describe('097 B2 洞察行 theme·推翻·固定视觉态', () => {
  function b2Fixture(): SmartCatData {
    const d = fixtureData();
    const iso = new Date().toISOString();
    const ins = (id: string, desc: string, extra: Partial<MemoryStreamEntry>): MemoryStreamEntry =>
      ({ id, created: iso, lastAccessed: iso, description: desc, importance: 0.7, type: 'insight', source: 'reflection', ...extra });
    d.memory.memoryStream.push(
      ins('b-i1', '主题洞察：工作节奏稳定', { theme: '工作' }),
      ins('b-i2', '被推翻的旧结论', { supersededBy: 'b-i1' }),
      ins('b-i3', '人工固定的结论', { pinned: true }),
      ins('b-i4', '既固定又被推翻的结论', { pinned: true, supersededBy: 'b-i1' }),
      ins('b-i5', '脏主题不入枚举', { theme: '乱写的主题' }),
    );
    return d;
  }

  it('theme chip / 已被推翻行态 / 并存时 pinned 优先；操作按钮行为不变', async () => {
    const { app } = makeApp(b2Fixture());
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="memory"]') as HTMLElement).click();
    const pane = popup.querySelector('[data-pane="memory"]') as HTMLElement;

    const rowTheme = findMemoryRow(pane, '工作节奏稳定');
    expect(rowTheme.querySelector('.bz-sc-dash-badge-theme')!.textContent).toBe('工作'); // 行首主题 chip

    const rowSuper = findMemoryRow(pane, '被推翻的旧结论');
    expect(rowSuper.classList.contains('bz-sc-dash-memory--superseded')).toBe(true); // 整行降透明度态（视觉由样式类承接）
    expect(rowSuper.querySelector('.bz-sc-dash-badge-superseded')!.textContent).toBe('已被推翻');

    const rowPinned = findMemoryRow(pane, '人工固定');
    expect(rowPinned.querySelector('.bz-sc-dash-badge-pinned')!.textContent).toBe('已固定');
    expect(rowPinned.classList.contains('bz-sc-dash-memory--superseded')).toBe(false);

    // 并存：pinned 优先——只显「已固定」，无推翻徽标与行降级态
    const rowBoth = findMemoryRow(pane, '既固定又被推翻');
    expect(rowBoth.querySelector('.bz-sc-dash-badge-pinned')!.textContent).toBe('已固定');
    expect(rowBoth.querySelector('.bz-sc-dash-badge-superseded')).toBeNull();
    expect(rowBoth.classList.contains('bz-sc-dash-memory--superseded')).toBe(false);

    // 脏 theme（枚举外）不显示主题 chip
    expect(findMemoryRow(pane, '脏主题不入枚举').querySelector('.bz-sc-dash-badge-theme')).toBeNull();

    // 操作按钮行为不变：固定行提供「取消固定」；被推翻行不再提供「废弃」
    expect([...rowPinned.querySelectorAll('.bz-sc-dash-mini-btn')].some((b) => b.textContent === '取消固定')).toBe(true);
    expect([...rowSuper.querySelectorAll('.bz-sc-dash-mini-btn')].some((b) => b.textContent === '废弃')).toBe(false);
    closeSmartcatDashboard();
  });
});

// ---------------- C1 自动刷新 ----------------

describe('097 C1 事件驱动静默刷新', () => {
  it('modify 命中 smartcat.json → 防抖 3s 静默重读渲染；保持当前页签；零 toast', async () => {
    const { app, vault } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="emotion"]') as HTMLElement).click();

    vi.useFakeTimers();
    const next = fixtureData();
    next.mood.currentEmotion = 'sad'; // 数据变化应反映到总览英雄区
    vault.files.set(getSmartcatFilePath(), JSON.stringify(next));
    vault.emit('modify', { path: getSmartcatFilePath() });
    await vi.advanceTimersByTimeAsync(3000);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0)); // 冲刷渲染微任务

    // 保持当前页签（emotion 可见、总览隐藏），但总览内容已按新数据重渲染
    const overview = popup.querySelector('[data-pane="overview"]') as HTMLElement;
    const emotion = popup.querySelector('[data-pane="emotion"]') as HTMLElement;
    expect(emotion.style.display).not.toBe('none');
    expect(overview.style.display).toBe('none');
    expect(overview.textContent).toContain('瞬时情绪：难过');
    expect(getNoticeMessages()).toEqual([]); // 不弹任何 toast
    expect(document.getElementById('bz-notice-container')).toBeNull();
  }, 15000);

  it('防抖合并：窗口内再次 modify 重置计时器，合并为一次刷新', async () => {
    const { app, vault } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    vi.useFakeTimers();
    // 第一次命中后只走 2500ms（<3000，尚未刷新）
    const v2 = fixtureData();
    v2.mood.currentEmotion = 'sad';
    vault.files.set(getSmartcatFilePath(), JSON.stringify(v2));
    vault.emit('modify', { path: getSmartcatFilePath() });
    await vi.advanceTimersByTimeAsync(2500);
    let overview = document.querySelector('[data-pane="overview"]') as HTMLElement;
    expect(overview.textContent).toContain('瞬时情绪：开心'); // 未刷新
    // 第二次命中重置防抖：再走 2500ms 仍未刷新
    const v3 = fixtureData();
    v3.mood.currentEmotion = 'sad';
    vault.files.set(getSmartcatFilePath(), JSON.stringify(v3));
    vault.emit('modify', { path: getSmartcatFilePath() });
    await vi.advanceTimersByTimeAsync(2500);
    overview = document.querySelector('[data-pane="overview"]') as HTMLElement;
    expect(overview.textContent).toContain('瞬时情绪：开心'); // 仍为旧值（计时器已被重置）
    // 最后 600ms 到点 → 恰一次刷新生效
    await vi.advanceTimersByTimeAsync(600);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));
    overview = document.querySelector('[data-pane="overview"]') as HTMLElement;
    expect(overview.textContent).toContain('瞬时情绪：难过');
  }, 15000);

  it('非目标路径 modify 不触发刷新', async () => {
    const { app, vault } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    vi.useFakeTimers();
    const next = fixtureData();
    next.mood.currentEmotion = 'sad';
    vault.files.set(getSmartcatFilePath(), JSON.stringify(next));
    vault.emit('modify', { path: '我的/日记/2026-08-24.md' }); // 非监听路径
    vault.emit('modify', { path: 'CONFIG/STORAGE/belongings.json' });
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));
    const overview = document.querySelector('[data-pane="overview"]') as HTMLElement;
    expect(overview.textContent).toContain('瞬时情绪：开心'); // 未刷新
  }, 15000);

  it('close 后监听全量清理；幂等重开无泄漏（监听数恒为 1）；close 后 modify 不动作', async () => {
    const { app, vault } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    expect(vault.listeners['modify']?.length ?? 0).toBe(1);
    closeSmartcatDashboard();
    expect(vault.listeners['modify']?.length ?? 0).toBe(0);

    await openSmartcatDashboard(app as any);
    await openSmartcatDashboard(app as any); // 幂等重开：close 先行清理，不叠加旧监听
    expect(vault.listeners['modify']?.length ?? 0).toBe(1);

    closeSmartcatDashboard();
    expect(document.getElementById('smartcat-dashboard-panel')).toBeNull();
    vi.useFakeTimers();
    vault.emit('modify', { path: getSmartcatFilePath() }); // 关闭后事件不引发任何动作
    await vi.advanceTimersByTimeAsync(4000);
    vi.useRealTimers();
    expect(document.getElementById('smartcat-dashboard-panel')).toBeNull();
  }, 15000);

  it('刷新失败保持旧画面静默（读取抛错也不 toast、不丢画面）', async () => {
    const { app, vault } = makeApp(fixtureData());
    await openSmartcatDashboard(app as any);
    // getAbstractFileByPath 在 loadSmartCatData 的 try 之外——让它抛错模拟真实读失败
    const orig = vault.getAbstractFileByPath.bind(vault);
    vi.spyOn(vault, 'getAbstractFileByPath').mockImplementation((p: string) => {
      if (p === getSmartcatFilePath()) throw new Error('adapter io error');
      return orig(p);
    });
    vi.useFakeTimers();
    vault.emit('modify', { path: getSmartcatFilePath() });
    await vi.advanceTimersByTimeAsync(3500);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));

    const popup = document.getElementById('smartcat-dashboard-panel')!;
    expect(popup).not.toBeNull();
    expect(popup.querySelector('[data-pane="overview"]')!.textContent).toContain('心情好'); // 旧画面保留
    expect(getNoticeMessages()).toEqual([]); // 连续失败也不打扰
    expect(document.getElementById('bz-notice-container')).toBeNull();
  }, 15000);
});
// ---------------- 最近记忆展开详情（点击正文行读全文；引用型当场读 vault） ----------------

describe('最近记忆点击展开详情', () => {
  it('普通条目展开显完整 description，再点收起', async () => {
    const d = fixtureData();
    const long = '一段很长的描述'.repeat(30); // > 80 字，行内截断
    d.memory.memoryStream = [
      { id: 'm1', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: long, importance: 0.8, type: 'observation', source: 'chat' },
    ];
    const { app } = makeApp(d);
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="memory"]') as HTMLElement).click();
    const pane = popup.querySelector('[data-pane="memory"]') as HTMLElement;
    const text = pane.querySelector('.bz-sc-dash-memory-text--expandable') as HTMLElement;
    expect(text).toBeTruthy();
    expect(text.textContent!.length).toBeLessThan(long.length); // 行内截断
    text.click(); // 展开
    await new Promise((r) => setTimeout(r, 0));
    const detail = pane.querySelector('.bz-sc-dash-memory-detail-text') as HTMLElement;
    expect(detail).toBeTruthy();
    expect(detail.textContent).toBe(long); // 详情 = 完整内容
    text.click(); // 收起
    await new Promise((r) => setTimeout(r, 0));
    expect(pane.querySelector('.bz-sc-dash-memory-detail')).toBeNull();
    closeSmartcatDashboard();
  });

  it('引用型条目（日记段）展开当场读 vault 正文（按定位符拆段）；文件失效显降级文案', async () => {
    const d = fixtureData();
    d.memory.memoryStream = [
      { id: 'm1', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '我的/日记/2026-08-29.md#09:30', importance: 0.8, type: 'observation', source: 'diary', ref: { path: '我的/日记/2026-08-29.md', locator: '09:30' } },
      { id: 'm2', created: new Date().toISOString(), lastAccessed: new Date().toISOString(), description: '归档/旧笔记.md', importance: 0.5, type: 'observation', source: 'note', ref: { path: '归档/已删除.md' } },
    ];
    const { app, vault } = makeApp(d);
    vault.create('我的/日记/2026-08-29.md', '# 🐱 09:30\n早上去跑了五公里，神清气爽。\n\n# 🌙 23:00\n睡前读了半小时书。');
    await openSmartcatDashboard(app as any);
    const popup = document.getElementById('smartcat-dashboard-panel')!;
    (popup.querySelector('[data-tab="memory"]') as HTMLElement).click();
    const pane = popup.querySelector('[data-pane="memory"]') as HTMLElement;
    const rows = [...pane.querySelectorAll('.bz-sc-dash-memory')];
    const diaryRow = rows.find((r) => (r.textContent || '').includes('#09:30'))!;
    (diaryRow.querySelector('.bz-sc-dash-memory-text--expandable') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(diaryRow.querySelector('.bz-sc-dash-memory-detail-text')!.textContent).toBe('早上去跑了五公里，神清气爽。');
    const staleRow = rows.find((r) => (r.textContent || '').includes('旧笔记'))!;
    (staleRow.querySelector('.bz-sc-dash-memory-text--expandable') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(staleRow.querySelector('.bz-sc-dash-memory-detail-text')!.textContent).toContain('读取失败');
    closeSmartcatDashboard();
  });
});
