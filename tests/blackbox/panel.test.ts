/**
 * 黑匣子主面板 UI 测试（ticket 46，v3 流式）：打开/流式渲染排序/类型筛选/搜索防抖/批次滚动/
 * 空态/默认类型筛选/头部动作区/人物弹窗（印象锁/AI 观察采纳/情绪聚合/事件投影）/
 * 时间线弹窗（年月分组/推测确认删除/筛选/开关）。
 * v3 卡片纯展示：无单击/双击/长按交互（点击卡片不应出现任何详情展开）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxPanel, unloadBlackBoxPanel } from '../../src/blackbox/panel';
import { unloadBlackBox, closeBlackBoxCapture } from '../../src/blackbox';
import { BlackBoxDataManager, getBlackBoxFilePath } from '../../src/blackbox/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

/** 预置 v2 全量数据：概念/文献/想法/画像/事件（含推测事件） */
function seedVault(vault: MockVault, extra?: any): void {
  vault.files.set(
    getBlackBoxFilePath(),
    JSON.stringify({
      version: 2,
      settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动', '温暖', '想念', '难过'] },
      persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
      entries: [
        { id: 'bb_c1', type: 'concept', createdAt: '2026-08-01T00:00:00.000Z', name: '提喻法', definition: '以部分代整体的修辞手法', related: ['bb_c2'], emotions: [], people: [], scene: '', toward: '', links: [] },
        { id: 'bb_c2', type: 'concept', createdAt: '2026-08-02T00:00:00.000Z', name: '借代', definition: '用相关事物代替本体', related: ['bb_c1'], emotions: [], people: [], scene: '', toward: '', links: [] },
        { id: 'bb_l1', type: 'literature', createdAt: '2026-08-03T00:00:00.000Z', text: '修辞是语言的弹性，让有限词句装下无限情意。', source: '《诗学》', terms: ['bb_c1'], emotions: ['触动'], people: [], scene: '', toward: '', links: ['https://a.com'] },
        { id: 'bb_t1', type: 'thought', createdAt: '2026-08-04T00:00:00.000Z', text: '给妹妹买吉他，她笑了很久。', emotions: ['温暖', '想念'], people: ['pf_1'], scene: '琴行', toward: 'others', links: [] },
        { id: 'bb_t2', type: 'thought', createdAt: '2026-08-05T00:00:00.000Z', text: '想带妈妈去看海', emotions: ['希望'], people: ['老王'], scene: '', toward: '', links: [] },
      ],
      profiles: [
        { id: 'pf_1', name: '妹妹', relation: '家人', impression: '很要强', aiObservations: ['我注意到她越来越独立'], pinnedEvents: [], createdAt: 't' },
      ],
      events: [
        { id: 'ev_1', title: '给妹妹买吉他', time: '2026-08-01', inferred: false, summary: '挑了把入门琴', people: ['pf_1'], mainPerson: 'pf_1', evidence: ['bb_t1'], emotions: ['温暖'], edited: false },
        { id: 'ev_2', title: '梦见去海边', time: '2026-07-20', inferred: true, summary: '可能是想旅行的投射', people: ['老王'], mainPerson: '', evidence: ['bb_t2'], emotions: [], edited: false },
      ],
      reviews: [],
      chat: [],
      meta: { lastReviewAt: '', totalEntries: 5, totalEvents: 2 },
      ...extra,
    })
  );
}

async function loaded(app: any, vault: MockVault): Promise<any> {
  return new BlackBoxDataManager(app).load();
}

function streamCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll('#bz-blackbox-stream .bz-blackbox-stream-card')) as HTMLElement[];
}

describe('黑匣子主面板（v3 流式）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadBlackBox();
  });
  afterEach(() => {
    unloadBlackBoxPanel();
    unloadBlackBox();
  });

  it('打开：面板结构（header 5 按钮，关闭恒在最后）+ 标题条数 + 流渲染全部三类', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    expect(document.getElementById('bz-blackbox-panel-mask')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-panel')!.style.display).toBe('flex');
    expect(document.getElementById('bz-blackbox-panel-title')!.textContent).toBe('黑匣子'); // 无 emoji、无条数
    // header 动作区顺序：✏️ 录入 → 👤 人物 → 🕐 时间线 → 🔍 搜索 → ⚙️ 设置 → ❌ 关闭
    const btns = Array.from(document.querySelectorAll('.bz-blackbox-hdr-actions button'));
    expect(btns.map((b) => (b as HTMLElement).textContent)).toEqual(['✏️', '👤', '🕐', '🔍', '⚙️', '❌']);
    // 搜索框默认隐藏
    expect(document.getElementById('bz-blackbox-search-wrap')!.style.display).toBe('none');
    // 流：三类混排，无五标签容器
    expect(document.getElementById('bz-blackbox-wall')).toBeNull();
    const cards = streamCards();
    expect(cards.length).toBe(5);
    // 类型标签栏三胶囊
    expect(document.querySelectorAll('.bz-blackbox-type-btn').length).toBe(3);
  });

  it('时间流：按 createdAt 倒序（新在上）+ 日期分隔条分组', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const cards = streamCards();
    // 最新（08-05 想法）在最上，最旧（08-01 概念）在最下
    expect(cards[0].textContent).toContain('想带妈妈去看海');
    expect(cards[4].textContent).toContain('提喻法');
    // 日期分隔条：5 条各占一天（seed 数据每天一条）
    const seps = Array.from(document.querySelectorAll('#bz-blackbox-stream .bz-blackbox-stream-date'));
    expect(seps.length).toBe(5);
    expect(seps[0].textContent).toBe('2026-08-05');
    expect(seps[4].textContent).toBe('2026-08-01');
    // 卡片头部：类型 emoji + 时刻
    expect(cards[0].querySelector('.bz-blackbox-stream-card-emoji')!.textContent).toBe('💡');
    expect(cards[4].querySelector('.bz-blackbox-stream-card-emoji')!.textContent).toBe('🧩');
  });

  it('卡片三铺法纯展示：🧩 概念（名称+定义+关联 chips）｜📎 文献（来源+全文+名词表+链接）｜💡 想法（全文+情绪+人物+场景）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const cards = streamCards();
    // 概念卡：用头部 emoji 精确定位（文献卡的名词表也含「提喻法」）
    const concept = cards.find(
      (c) => c.querySelector('.bz-blackbox-stream-card-emoji')!.textContent === '🧩' && c.textContent.includes('以部分代整体')
    )!;
    expect(concept.textContent).toContain('以部分代整体的修辞手法');
    expect(concept.textContent).toContain('借代'); // 关联概念 chips
    const lit = cards.find((c) => c.textContent.includes('《诗学》'))!;
    expect(lit.textContent).toContain('修辞是语言的弹性');
    expect(lit.textContent).toContain('提喻法'); // 名词表
    expect(lit.textContent).toContain('https://a.com'); // 链接
    const thought = cards.find((c) => c.textContent.includes('给妹妹买吉他'))!;
    expect(thought.textContent).toContain('温暖');
    expect(thought.textContent).toContain('妹妹');
    expect(thought.textContent).toContain('📍 琴行');
    // 纯展示：点击卡片不产生任何详情/展开（无交互）
    const before = document.getElementById('bz-blackbox-stream')!.innerHTML;
    concept.click();
    lit.click();
    thought.click();
    expect(document.getElementById('bz-blackbox-stream')!.innerHTML).toBe(before);
    expect(document.getElementById('bz-blackbox-wall-detail')).toBeNull();
  });

  it('类型筛选：点击切换多选（并集），默认空集=全部；取消恢复', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const typeBtns = () => Array.from(document.querySelectorAll('.bz-blackbox-type-btn')) as HTMLElement[];
    // 默认全部
    expect(streamCards().length).toBe(5);
    // 只选概念
    typeBtns().find((b) => b.dataset.type === 'concept')!.click();
    expect(streamCards().length).toBe(2);
    expect(streamCards().every((c) => c.textContent.includes('提喻法') || c.textContent.includes('借代'))).toBe(true);
    // 加选想法（多选并集：概念 + 想法 = 4）
    typeBtns().find((b) => b.dataset.type === 'thought')!.click();
    expect(streamCards().length).toBe(4);
    // 取消概念 → 只剩想法 2 条
    typeBtns().find((b) => b.dataset.type === 'concept')!.click();
    expect(streamCards().length).toBe(2);
    expect(streamCards().every((c) => c.textContent.includes('想带妈妈') || c.textContent.includes('给妹妹'))).toBe(true);
    // 全部取消 → 全部
    typeBtns().find((b) => b.dataset.type === 'thought')!.click();
    expect(streamCards().length).toBe(5);
  });

  it('搜索：防抖 300ms 后过滤（内容/情绪/人物名可搜）', async () => {
    vi.useFakeTimers();
    try {
      const vault = new MockVault();
      seedVault(vault);
      const { app } = setup(vault);
      await openBlackBoxPanel(app);
      const input = document.getElementById('bz-blackbox-search-input') as HTMLInputElement;
      // 输入内容关键词（用唯一词「弹性」，避免命中概念定义的「修辞」）
      input.value = '弹性';
      input.dispatchEvent(new Event('input'));
      expect(streamCards().length).toBe(5); // 防抖期内未生效
      await vi.advanceTimersByTimeAsync(300);
      expect(streamCards().length).toBe(1);
      expect(streamCards()[0].textContent).toContain('《诗学》');
      // 情绪标签可搜
      input.value = '温暖';
      input.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(300);
      expect(streamCards().length).toBe(1);
      expect(streamCards()[0].textContent).toContain('给妹妹买吉他');
      // 人物显示名可搜（画像 id 匹配显示名）
      input.value = '妹妹';
      input.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(300);
      expect(streamCards().length).toBe(1);
      // 无匹配 → 空态
      input.value = '不存在的词';
      input.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(300);
      expect(streamCards().length).toBe(0);
      expect(document.getElementById('bz-blackbox-stream')!.textContent).toContain('没有找到匹配的内容');
    } finally {
      vi.useRealTimers();
    }
  });

  it('批次滚动：初始渲染 BATCH 条，滚到底加载下一批，全部显示后出现「已显示所有内容」', async () => {
    const vault = new MockVault();
    seedVault(vault);
    // 24 条想法（不同日期）
    const entries: any[] = [];
    for (let i = 0; i < 24; i++) {
      entries.push({
        id: `bb_b${String(i).padStart(2, '0')}`, type: 'thought', createdAt: `2026-08-${String((i % 28) + 1).padStart(2, '0')}T10:0${i % 10}:00.000Z`,
        text: `批量想法 ${i}`, emotions: [], people: [], scene: '', toward: '', links: [],
      });
    }
    vault.files.set(getBlackBoxFilePath(), JSON.stringify({
      version: 2, settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: [] },
      persona: { name: '包仔', seed: '', toneExample: '', selfViews: [] },
      entries, profiles: [], events: [], reviews: [], chat: [],
      meta: { lastReviewAt: '', totalEntries: 24, totalEvents: 0 },
    }));
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    expect(streamCards().length).toBe(20); // 第一批 BATCH
    expect(document.getElementById('bz-blackbox-stream')!.textContent).not.toContain('已显示所有内容');
    // 滚动到底 → 加载剩余 4 条 + 提示
    const stream = document.getElementById('bz-blackbox-stream')!;
    stream.scrollTop = 9999;
    stream.dispatchEvent(new Event('scroll'));
    expect(streamCards().length).toBe(24);
    expect(document.getElementById('bz-blackbox-stream')!.textContent).toContain('已显示所有内容');
  });

  it('空态：无任何条目 →「黑匣子还空着」', async () => {
    const vault = new MockVault();
    seedVault(vault, { entries: [] });
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    expect(document.getElementById('bz-blackbox-stream')!.textContent).toContain('黑匣子还空着');
  });

  it('默认类型筛选（设置 blackboxDefaultTypeFilter）消费：concept → 打开只显示概念', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxDefaultTypeFilter: 'concept' });
    await openBlackBoxPanel(app);
    const cards = streamCards();
    expect(cards.length).toBe(2);
    expect(cards.every((c) => c.textContent.includes('提喻法') || c.textContent.includes('借代'))).toBe(true);
    // 类型按钮高亮
    expect(document.querySelector('.bz-blackbox-type-btn[data-type="concept"]')!.classList.contains('bz-blackbox-type-btn-on')).toBe(true);
  });

  it('头部动作区：✏️ 录入打开录入弹窗；❌ 关闭面板（整体移除 DOM）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const btns = Array.from(document.querySelectorAll('.bz-blackbox-hdr-actions button'));
    // ✏️ → 录入弹窗
    (btns[0] as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-capture-popup')).toBeTruthy();
    });
    expect(document.getElementById('bz-blackbox-capture-popup')!.style.display).toBe('flex');
    closeBlackBoxCapture();
    // ❌（最后一个按钮）→ 面板关闭
    (btns[btns.length - 1] as HTMLElement).click();
    expect(document.getElementById('bz-blackbox-panel')).toBeNull();
  });

  it('幂等重开：面板已存在时不重建 DOM，刷新数据', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const stream1 = document.getElementById('bz-blackbox-stream');
    await openBlackBoxPanel(app);
    expect(document.getElementById('bz-blackbox-stream')).toBe(stream1);
    expect(streamCards().length).toBe(5);
  });

  // ---------------- 👤 人物弹窗 ----------------

  it('👤 人物弹窗：打开/关闭 + 卡墙 + 详情（印象保存锁/AI 观察采纳/情绪聚合/事件投影）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const peopleBtn = document.getElementById('bz-blackbox-panel-people') as HTMLElement;
    peopleBtn.click();
    expect(document.getElementById('bz-blackbox-people-mask')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-people-popup')!.style.display).toBe('flex');
    // 卡墙
    const cards = document.querySelectorAll('#bz-blackbox-people .bz-blackbox-profile-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('妹妹（家人）');
    expect(cards[0].textContent).toContain('🕐 1 事件');
    expect(cards[0].textContent).toContain('温暖×1');
    // 进详情
    (cards[0] as HTMLElement).click();
    const detail = document.getElementById('bz-blackbox-profile-detail')!;
    const impArea = document.getElementById('bz-blackbox-profile-impression') as HTMLTextAreaElement;
    expect(impArea.value).toBe('很要强');
    expect(detail.textContent).toContain('我注意到她越来越独立'); // AI 观察区
    expect(detail.textContent).toContain('温暖 ×1');
    expect(detail.textContent).toContain('给妹妹买吉他'); // 事件投影
    // 采纳 AI 观察 → 印象追加 + 观察移除
    const adopt = detail.querySelector('.bz-blackbox-observation-row .bz-blackbox-ai-btn') as HTMLButtonElement;
    adopt.click();
    await new Promise((r) => setTimeout(r, 50));
    const data = await loaded(app, vault);
    expect(data.profiles[0].impression).toContain('我注意到她越来越独立');
    expect(data.profiles[0].aiObservations.length).toBe(0);
    // 保存印象（用户主权区）：返回卡墙再进详情
    (document.querySelector('.bz-blackbox-profile-detail .bz-blackbox-ai-btn') as HTMLButtonElement).click(); // ← 返回
    const card = document.querySelector('.bz-blackbox-profile-card') as HTMLElement;
    card.click();
    const imp = document.getElementById('bz-blackbox-profile-impression') as HTMLTextAreaElement;
    imp.value = '我的新版本';
    document.getElementById('bz-blackbox-profile-imp-save')!.click();
    await new Promise((r) => setTimeout(r, 50));
    expect((await loaded(app, vault)).profiles[0].impression).toBe('我的新版本');
    // 关闭弹窗（❌）
    (document.querySelector('#bz-blackbox-people-popup .bz-blackbox-hdr-close') as HTMLElement).click();
    expect(document.getElementById('bz-blackbox-people-popup')).toBeNull();
    // 面板仍在
    expect(document.getElementById('bz-blackbox-panel')).toBeTruthy();
  });

  // ---------------- 🕐 时间线弹窗 ----------------

  it('🕐 时间线弹窗：打开/关闭 + 年月分组 + 推测卡确认/删除', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    document.getElementById('bz-blackbox-panel-timeline')!.click();
    expect(document.getElementById('bz-blackbox-timeline-mask')).toBeTruthy();
    const groups = document.querySelectorAll('#bz-blackbox-timeline .bz-blackbox-tl-group');
    expect(groups.length).toBe(2);
    expect(groups[0].textContent).toContain('2026 年 8 月');
    expect(groups[1].textContent).toContain('2026 年 7 月');
    const specCard = document.querySelector('.bz-blackbox-event-card.speculative') as HTMLElement;
    expect(specCard.textContent).toContain('梦见去海边');
    expect(specCard.textContent).toContain('❓ 推测');
    // 确认推测事件
    const confirm = specCard.querySelector('.bz-blackbox-btn-primary') as HTMLButtonElement;
    confirm.click();
    await new Promise((r) => setTimeout(r, 50));
    let data = await loaded(app, vault);
    expect(data.events.find((e: any) => e.id === 'ev_2').inferred).toBe(false);
    // 删除事件（✕ 删除）
    data.events = data.events.filter((e: any) => e.id !== 'ev_1');
    vault.files.set(getBlackBoxFilePath(), JSON.stringify(data));
    // 重开弹窗 → 内容刷新：先关弹窗，重开面板（幂等重载数据）后再开弹窗
    (document.querySelector('#bz-blackbox-timeline-popup .bz-blackbox-hdr-close') as HTMLElement).click();
    await openBlackBoxPanel(app);
    document.getElementById('bz-blackbox-panel-timeline')!.click();
    expect(document.querySelectorAll('#bz-blackbox-timeline .bz-blackbox-event-card').length).toBe(1);
    expect(document.getElementById('bz-blackbox-timeline')!.textContent).toContain('梦见去海边');
    // 关闭弹窗（❌）
    (document.querySelector('#bz-blackbox-timeline-popup .bz-blackbox-hdr-close') as HTMLElement).click();
    expect(document.getElementById('bz-blackbox-timeline-popup')).toBeNull();
  });

  it('时间线弹窗：推测事件确认后重渲染（虚线消失）+ 证据链展开', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    document.getElementById('bz-blackbox-panel-timeline')!.click();
    // 确认推测事件 → refreshAll 同步弹窗：推测卡消失
    const specCard = document.querySelector('.bz-blackbox-event-card.speculative') as HTMLElement;
    (specCard.querySelector('.bz-blackbox-btn-primary') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('.bz-blackbox-event-card.speculative')).toBeNull();
    // 证据链展开（非推测卡）
    const ev1 = document.querySelector('#bz-blackbox-timeline .bz-blackbox-event-card') as HTMLElement;
    expect(ev1.textContent).toContain('📎 1 条证据');
    (ev1.querySelector('.bz-blackbox-event-evidence-btn') as HTMLElement).click();
    expect(ev1.querySelector('.bz-blackbox-event-evidence')!.textContent).toContain('给妹妹买吉他，她笑了很久');
  });

  it('时间线弹窗：人物/年份筛选', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    document.getElementById('bz-blackbox-panel-timeline')!.click();
    // 按人物（妹妹）
    const personSel = document.getElementById('bz-blackbox-tl-person') as HTMLSelectElement;
    personSel.value = 'pf_1';
    personSel.dispatchEvent(new Event('change'));
    const cards = document.querySelectorAll('#bz-blackbox-timeline .bz-blackbox-event-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('给妹妹买吉他');
    // 按年份（2026-07）
    const yearSel = document.getElementById('bz-blackbox-tl-year') as HTMLSelectElement;
    personSel.value = '';
    personSel.dispatchEvent(new Event('change'));
    yearSel.value = '2026';
    yearSel.dispatchEvent(new Event('change'));
    const cards2 = document.querySelectorAll('#bz-blackbox-timeline .bz-blackbox-event-card');
    expect(cards2.length).toBe(2);
    expect(cards2[0].textContent).toContain('给妹妹买吉他');
    expect(cards2[1].textContent).toContain('梦见去海边');
  });

  it('推测事件显示开关（全局设置）关闭 → 时间线弹窗隐藏推测事件', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxShowSpeculativeEvents: false });
    await openBlackBoxPanel(app);
    document.getElementById('bz-blackbox-panel-timeline')!.click();
    const cards = document.querySelectorAll('#bz-blackbox-timeline .bz-blackbox-event-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('给妹妹买吉他');
    expect(document.getElementById('bz-blackbox-timeline')!.textContent).not.toContain('梦见去海边');
  });

  it('关闭面板连带关闭弹窗', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    document.getElementById('bz-blackbox-panel-people')!.click();
    document.getElementById('bz-blackbox-panel-timeline')!.click();
    expect(document.getElementById('bz-blackbox-people-popup')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-timeline-popup')).toBeTruthy();
    (document.querySelector('#bz-blackbox-panel .bz-blackbox-hdr-close') as HTMLElement).click();
    expect(document.getElementById('bz-blackbox-people-popup')).toBeNull();
    expect(document.getElementById('bz-blackbox-timeline-popup')).toBeNull();
  });

  it('概念删除入口已随五标签移除（纯浏览）：卡片无删除按钮', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    expect(document.querySelector('.bz-blackbox-del-btn')).toBeNull();
    expect(hasNotice(/已删除/)).toBe(false);
  });
});

describe('主面板搜索切换（ticket 04）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadBlackBox();
  });

  it('🔍 切换搜索框显隐：显示时高亮 + 宽度 100%；再次点击隐藏', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const searchBtn = document.getElementById('bz-blackbox-panel-search') as HTMLElement;
    const wrap = document.getElementById('bz-blackbox-search-wrap') as HTMLElement;
    expect(wrap.style.display).toBe('none'); // 默认隐藏
    expect(searchBtn.className).not.toContain('bz-blackbox-icon-on');
    searchBtn.click();
    expect(wrap.style.display).toBe('block'); // 显示
    expect(searchBtn.className).toContain('bz-blackbox-icon-on'); // 高亮
    searchBtn.click();
    expect(wrap.style.display).toBe('none'); // 再次点击隐藏
    expect(searchBtn.className).not.toContain('bz-blackbox-icon-on');
  });

  it('隐藏搜索框即清空已输入关键词并立即重渲染（防抖前也生效）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const searchBtn = document.getElementById('bz-blackbox-panel-search') as HTMLElement;
    searchBtn.click();
    const input = document.getElementById('bz-blackbox-search-input') as HTMLInputElement;
    // 输入关键词（防抖未触发）
    input.value = '不存在的关键词xyz';
    input.dispatchEvent(new Event('input'));
    // 立刻隐藏：清空 + 重渲染（无需等防抖）
    searchBtn.click();
    expect(input.value).toBe(''); // 清空已输入关键词
    const cards = streamCards();
    expect(cards.length).toBe(5); // 全量重渲染（关键词已清空）
    // 重开后仍是默认隐藏
    await openBlackBoxPanel(app);
    expect(document.getElementById('bz-blackbox-search-wrap')!.style.display).toBe('none');
  });

  it('搜索显示时防抖过滤照常（范围语义不变）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    (document.getElementById('bz-blackbox-panel-search') as HTMLElement).click();
    const input = document.getElementById('bz-blackbox-search-input') as HTMLInputElement;
    input.value = '给妹妹买吉他';
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      const cards = streamCards();
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('给妹妹买吉他');
    });
  });
});
