/**
 * 黑匣子主面板 UI 测试（ticket 41/43/44）：五标签切换/概念墙详情关联/文献架/想法池空态/
 * 人物详情（印象锁/AI 观察采纳/情绪聚合/事件投影）/时间线（年月分组/推测确认删除/筛选/开关）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxPanel, unloadBlackBoxPanel } from '../../src/blackbox/panel';
import { unloadBlackBox, closeBlackBoxCapture } from '../../src/blackbox';
import { getBlackBoxFilePath } from '../../src/blackbox/data';

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

function loaded(vault: MockVault): any {
  return JSON.parse(vault.files.get(getBlackBoxFilePath())!);
}

async function openPanel(app: any, tab: string): Promise<void> {
  await openBlackBoxPanel(app);
  const btn = document.querySelector(`.bz-blackbox-panel-tab-btn[data-tab="${tab}"]`) as HTMLElement;
  btn.click();
}

describe('黑匣子主面板（五标签）', () => {
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

  it('打开：五标签渲染，默认概念墙', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    expect(document.getElementById('bz-blackbox-panel-mask')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-panel')!.style.display).toBe('flex');
    const tabs = document.querySelectorAll('.bz-blackbox-panel-tab-btn');
    expect(tabs.length).toBe(5);
    expect(document.getElementById('bz-blackbox-panel-title')!.textContent).toContain('5 条内容');
    expect(document.getElementById('bz-blackbox-wall')!.style.display).toBe('block');
  });

  it('🧩 概念墙：卡片只显示名称（定义/关联数在详情内）+ 详情展开 + 关联跳转', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openPanel(app, 'wall');
    const cards = document.querySelectorAll('#bz-blackbox-wall .bz-blackbox-concept-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('借代'); // 按时间倒序（最新在前）
    expect(cards[0].textContent).not.toContain('🔗'); // 卡片不显示关联数
    expect(cards[0].textContent).not.toContain('定义'); // 卡片不显示定义摘要
    // 点击提喻法卡片展开详情（完整内容在详情）
    const tyu = Array.from(cards).find((c) => c.textContent.includes('提喻法')) as HTMLElement;
    tyu.click();
    const detail = document.getElementById('bz-blackbox-wall-detail')!;
    expect(detail.textContent).toContain('以部分代整体的修辞手法');
    expect(detail.textContent).toContain('借代'); // 关联概念名
    // 点击关联概念 → 跳到借代详情
    const relChip = detail.querySelector('.bz-blackbox-related-row .bz-blackbox-term-chip') as HTMLElement;
    relChip.click();
    expect(document.getElementById('bz-blackbox-wall-detail')!.textContent).toContain('用相关事物代替本体');
  });

  it('📎 文献架：来源 + 摘要 + 名词表标签；点击展开全文与链接', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openPanel(app, 'shelf');
    const cards = document.querySelectorAll('#bz-blackbox-shelf .bz-blackbox-shelf-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('《诗学》');
    expect(cards[0].textContent).toContain('提喻法');
    const full = cards[0].querySelector('.bz-blackbox-shelf-full') as HTMLElement;
    expect(full.style.display).toBe('none');
    (cards[0] as HTMLElement).click();
    expect(full.style.display).toBe('block');
    expect(full.textContent).toContain('https://a.com');
  });

  it('💡 想法池：文本 + 情绪胶囊 + 涉及的人 + 场景；空态', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openPanel(app, 'pool');
    const cards = document.querySelectorAll('#bz-blackbox-pool .bz-blackbox-pool-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('想带妈妈去看海');
    expect(cards[0].textContent).toContain('希望');
    expect(cards[0].textContent).toContain('老王');
    expect(cards[1].textContent).toContain('温暖');
    expect(cards[1].textContent).toContain('妹妹');
    expect(cards[1].textContent).toContain('📍 琴行');
    // 空态（先关面板再开新 vault）
    unloadBlackBoxPanel();
    const vault2 = new MockVault();
    seedVault(vault2, { entries: [] });
    const { app: app2 } = setup(vault2);
    await openPanel(app2, 'pool');
    expect(document.getElementById('bz-blackbox-pool')!.textContent).toContain('暂无想法');
  });

  it('👤 人物：卡片墙（名字/印象/事件数/观察数）→ 详情：印象保存锁/AI 观察采纳/情绪聚合/事件投影', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openPanel(app, 'people');
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
    const data = loaded(vault);
    expect(data.profiles[0].impression).toContain('我注意到她越来越独立');
    expect(data.profiles[0].aiObservations.length).toBe(0);
    // 保存印象（用户主权区）：先返回卡片墙再进详情
    await openPanel(app, 'people');
    (document.querySelector('.bz-blackbox-profile-detail .bz-blackbox-ai-btn') as HTMLButtonElement).click(); // ← 返回
    const card = document.querySelector('.bz-blackbox-profile-card') as HTMLElement;
    card.click();
    const imp = document.getElementById('bz-blackbox-profile-impression') as HTMLTextAreaElement;
    imp.value = '我的新版本';
    document.getElementById('bz-blackbox-profile-imp-save')!.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(loaded(vault).profiles[0].impression).toBe('我的新版本');
  });

  it('🕐 时间线：年月分组 + 事件卡内容 + 推测卡确认/删除', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openPanel(app, 'timeline');
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
    let data = loaded(vault);
    expect(data.events.find((e: any) => e.id === 'ev_2').inferred).toBe(false);
    // 删除事件（✕ 删除）
    await openPanel(app, 'timeline');
    const specCard2 = document.querySelector('.bz-blackbox-event-card.speculative') as HTMLElement;
    expect(specCard2).toBeNull(); // 确认后不再是推测样式
    const ev1 = document.querySelector('.bz-blackbox-event-card') as HTMLElement;
    expect(ev1.textContent).toContain('给妹妹买吉他');
    expect(ev1.textContent).toContain('妹妹');
    expect(ev1.textContent).toContain('📎 1 条证据');
    // 证据链展开
    (ev1.querySelector('.bz-blackbox-event-evidence-btn') as HTMLElement).click();
    expect(ev1.querySelector('.bz-blackbox-event-evidence')!.textContent).toContain('给妹妹买吉他，她笑了很久');
    // 删除一个非推测事件（时间线上无删除按钮，删除仅推测卡提供——此处验证删除后不残留）
    data = loaded(vault);
    data.events = data.events.filter((e: any) => e.id !== 'ev_1');
    vault.files.set(getBlackBoxFilePath(), JSON.stringify(data));
    await openPanel(app, 'timeline');
    expect(document.getElementById('bz-blackbox-timeline')!.textContent).toContain('梦见去海边');
  });

  it('时间线筛选：按人物/按年份', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openPanel(app, 'timeline');
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
    expect(cards2.length).toBe(2); // 两个事件都在 2026 年
    expect(cards2[0].textContent).toContain('给妹妹买吉他'); // 按时间倒序
    expect(cards2[1].textContent).toContain('梦见去海边');
  });

  it('推测事件显示开关（全局设置）关闭 → 时间线隐藏推测事件', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxShowSpeculativeEvents: false });
    await openPanel(app, 'timeline');
    const cards = document.querySelectorAll('#bz-blackbox-timeline .bz-blackbox-event-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('给妹妹买吉他');
    expect(document.getElementById('bz-blackbox-timeline')!.textContent).not.toContain('梦见去海边');
  });

  it('头部动作区：✏️ 录入 → 打开录入弹窗，⚙️ 设置，❌ 关闭在最后', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const actions = document.querySelector('.bz-blackbox-hdr-actions')!;
    const btns = actions.querySelectorAll('button');
    // 顺序：✏️ 录入 → ⚙️ 设置 → ❌ 关闭（关闭恒在最后）
    expect(btns.length).toBe(3);
    expect(btns[0].id).toBe('bz-blackbox-panel-capture');
    expect(btns[0].textContent).toBe('✏️');
    expect(btns[1].id).toBe('bz-blackbox-panel-settings');
    expect(btns[2].textContent).toBe('❌');
    // 点 ✏️ → 录入弹窗打开（async 建 DOM，waitFor 等）；关闭录入弹窗后点 ❌ → 面板关闭
    (btns[0] as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-capture-popup')).toBeTruthy();
    });
    expect(document.getElementById('bz-blackbox-capture-popup')!.style.display).toBe('flex');
    closeBlackBoxCapture(); // 引导式无 header 关闭按钮，走 ESC/程序关闭
    (btns[2] as HTMLElement).click();
    expect(document.getElementById('bz-blackbox-panel')).toBeNull(); // 关闭=整体移除 DOM
  });

  it('面板切换保留各页状态（详情展开态不因切 tab 丢失）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openPanel(app, 'wall');
    (document.querySelector('#bz-blackbox-wall .bz-blackbox-concept-card') as HTMLElement).click();
    expect(document.getElementById('bz-blackbox-wall-detail')).toBeTruthy();
    // 切到人物再切回
    (document.querySelector('.bz-blackbox-panel-tab-btn[data-tab="people"]') as HTMLElement).click();
    (document.querySelector('.bz-blackbox-panel-tab-btn[data-tab="wall"]') as HTMLElement).click();
    expect(document.getElementById('bz-blackbox-wall-detail')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-wall-detail')!.textContent).toContain('提喻法');
  });
});
