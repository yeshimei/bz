/**
 * 挂载树·列表侧（issue 320；ADR-0138 §5 同包四项）UI 测试：
 * - 卡片行**引用计数徽标**：只数用户双链（正文 wikilink + related + mounted；自链不算），0 不显示；
 * - **孤儿卡**筛选开关 + 行标记 + 空态文案 + 扫描失败降级（置灰「未统计」，不给假状态）；
 * - **整库扫描每轮 refresh 只走一遍**：`refCounts` 结果传给 `orphanCards(ctx, counts)` 复用；
 *   这里用 MockVault 的 `getMarkdownFiles` / `cachedRead` **调用差值**实测（不只看外层 spy 计数）。
 * 数据层口径见 tests/knowledge/mount-data.test.ts（节点/边/计数/孤儿判定），这里只验列表接线。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIManager } from '../../src/knowledge/ui';
import { KnowledgeData } from '../../src/knowledge/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices, resetObsidianMocks } from '../mock-obsidian-entry';

/** 挂载数据层调用计数（每轮 refresh 只算一次）+ 扫描失败开关（降级用例） */
const scan = vi.hoisted(() => ({
  mountCtx: 0,
  refCounts: 0,
  refCountsDone: 0,
  orphanCards: 0,
  orphanCardsDone: 0,
  fail: false,
}));

vi.mock('../../src/knowledge/mount-data', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/knowledge/mount-data')>();
  return {
    ...real,
    mountCtx: (...a: any[]) => { scan.mountCtx++; return (real.mountCtx as any)(...a); },
    refCounts: async (...a: any[]) => {
      scan.refCounts++;
      if (scan.fail) throw new Error('mount-index-boom');
      const r = await (real.refCounts as any)(...a);
      scan.refCountsDone++;
      return r;
    },
    orphanCards: async (...a: any[]) => {
      scan.orphanCards++;
      const r = await (real.orphanCards as any)(...a);
      scan.orphanCardsDone++;
      return r;
    },
  };
});

// 主窗打开会跑一次旧笔记补全：与 ui.test.ts 同路子打桩，避免真 AI 通道
vi.mock('../../src/knowledge/note-gen', () => ({
  backfillNotes: vi.fn(async () => ({ scanned: 0, filled: 0, aiSkipped: false })),
  generateTermNote: vi.fn(),
  generateTermDraft: vi.fn(),
  generatePassageNote: vi.fn(),
  generatePassageDraft: vi.fn(),
  generateImageNote: vi.fn(),
  generateImageDraft: vi.fn(),
  resolveImageDir: vi.fn(() => '文献盒/assets'),
  summarizeTermSummary: vi.fn(),
}));

const BASE_SETTINGS: Record<string, any> = {
  knowledgeDirectory: '文献盒',
  knowledgeCardboxDirectory: '卡片盒',
  knowledgeTopicDirectory: '主题盒',
};

/**
 * 四张卡：
 * - 甲卡：被乙卡正文双链 + 丙卡 related 指到 → 被引 2（不是孤儿）
 * - 乙卡：被丙卡 mounted 指到 → 被引 1（不是孤儿）
 * - 丙卡：自身有挂载项（related + mounted）→ 不是孤儿，但无人指它（无徽标）
 * - 孤卡：既无入链也无挂载 → 唯一孤儿
 */
function cardFixtures(vault: MockVault): void {
  vault.files.set('卡片盒/甲卡.md', '甲卡正文。');
  vault.files.set('卡片盒/乙卡.md', '乙卡正文 [[甲卡]]。');
  vault.files.set('卡片盒/丙卡.md', [
    '---',
    'related:',
    '  - "[[卡片盒/甲卡|甲]]"',
    'mounted:',
    '  - "[[乙卡]]"',
    '---',
    '',
    '丙卡正文。',
  ].join('\n'));
  vault.files.set('卡片盒/孤卡.md', '孤卡正文：既没挂谁，也没人挂它。');
}

describe('挂载树·列表侧（issue 320）', () => {
  let vault: MockVault;
  let app: any;
  let ui: UIManager;
  let settings: Record<string, any>;

  /** 滚动区 / 孤儿筛选芯片 / 行元素（按路径定位，避免列表顺序干扰） */
  const sc = () => document.querySelector('.bz-kb-sc') as HTMLElement;
  const chip = () => document.querySelector('[data-kb-act=cards-orphan]') as HTMLButtonElement;
  function row(path: string): HTMLElement {
    return document.querySelector(`.bz-kb-lexrow[data-path="${path}"]`) as HTMLElement;
  }
  /** 开主窗 → 切部贰 → 等 expectRows 行上齐（只等行；索引落地另用 waitIndex） */
  async function openCards(expectRows = 4): Promise<void> {
    ui.showMain();
    (document.querySelector('[data-part=z2]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(expectRows));
  }
  /** 等引用索引落地（芯片出「· N」计数 = 扫描完成并补渲染） */
  async function waitIndex(): Promise<void> {
    await vi.waitFor(() => expect(chip().textContent).toMatch(/孤 儿 · \d+/));
  }
  const badgeCount = () => document.querySelectorAll('.bz-kb-refbadge').length;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    cardFixtures(vault);
    app = mockAppWithVault(vault);
    setApp(app);
    KnowledgeData.init({ storagePath: 'CONFIG/STORAGE' });
    clearNotices();
    settings = { ...BASE_SETTINGS };
    setSettingsProvider(() => settings as any);
    scan.mountCtx = 0;
    scan.refCounts = 0;
    scan.refCountsDone = 0;
    scan.orphanCards = 0;
    scan.orphanCardsDone = 0;
    scan.fail = false;
    ui = new UIManager(app);
  });

  afterEach(() => {
    ui.destroy();
    document.body.innerHTML = '';
  });

  it('引用计数徽标：只数用户双链（正文 + related + mounted），0 不出徽标', async () => {
    await openCards();
    await waitIndex();
    expect(row('卡片盒/甲卡.md').querySelector('.bz-kb-refbadge')!.textContent).toBe('被引 2');
    expect(row('卡片盒/乙卡.md').querySelector('.bz-kb-refbadge')!.textContent).toBe('被引 1');
    expect(row('卡片盒/丙卡.md').querySelector('.bz-kb-refbadge')).toBeNull(); // 0 不显示
    expect(row('卡片盒/孤卡.md').querySelector('.bz-kb-refbadge')).toBeNull();
    // 同名文献不计数、不解除孤儿（本用例无同名文献，徽标数即纯用户双链口径）
    expect(badgeCount()).toBe(2);
  });

  it('孤儿行标记：只标既无入链也无挂载的卡（有出向挂载就不是孤儿）', async () => {
    await openCards();
    await waitIndex();
    expect(row('卡片盒/孤卡.md').querySelector('.bz-kb-orphan')!.textContent).toBe('孤 儿');
    expect(row('卡片盒/丙卡.md').querySelector('.bz-kb-orphan')).toBeNull();
    expect(row('卡片盒/甲卡.md').querySelector('.bz-kb-orphan')).toBeNull();
    expect(document.querySelectorAll('.bz-kb-orphan').length).toBe(1);
  });

  it('孤儿筛选开关：开启只列孤儿卡（芯片点亮），关闭恢复全量', async () => {
    await openCards();
    await waitIndex();
    expect(chip().textContent).toContain('孤 儿 · 1');
    chip().click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(1));
    expect(chip().classList.contains('is-on')).toBe(true);
    expect((document.querySelector('.bz-kb-lexrow') as HTMLElement).getAttribute('data-path')).toBe('卡片盒/孤卡.md');
    chip().click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(4));
    expect(chip().classList.contains('is-on')).toBe(false);
  });

  it('孤儿筛选空态：没有孤儿卡时不空列表，给一句文案', async () => {
    vault.files.delete('卡片盒/孤卡.md'); // 剩 3 张都有人挂或挂着谁
    await openCards(3);
    await waitIndex();
    expect(chip().textContent).toContain('孤 儿 · 0');
    chip().click();
    await vi.waitFor(() => expect(sc().textContent).toContain('没有孤儿卡——每张卡都有人挂或挂着谁。'));
    expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(0);
    expect(chip().classList.contains('is-on')).toBe(true);
  });

  it('issue 323 增量渲染：滚动加载只追加新行，已渲染的行不被重建', async () => {
    for (let i = 0; i < 100; i++) vault.files.set(`卡片盒/卡${String(i).padStart(3, '0')}.md`, `卡${i}正文。`);
    await openCards(80); // 首屏仍是 80 行
    await waitIndex();
    const firstRow = row('卡片盒/甲卡.md');
    const more = () => document.querySelector('[data-kb-act=cards-more]') as HTMLElement;
    expect(more().textContent).toContain('还有 24 张'); // 104 - 80

    // 滚动到底 → 只追加新行（旧口径会整表 innerHTML 重建，已渲染行全换成新节点）
    sc().dispatchEvent(new Event('scroll'));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(104));
    expect(row('卡片盒/甲卡.md')).toBe(firstRow); // 同一个 DOM 节点：没被重建
    expect(more().style.display).toBe('none'); // 页脚原地收起
    // 徽标落地后不丢（增量追加的行也带徽标）
    expect(row('卡片盒/甲卡.md').querySelector('.bz-kb-refbadge')!.textContent).toBe('被引 2');
  });

  it('扫描失败降级：芯片置灰显「未统计」，列表照常渲染、不出徽标不筛', async () => {
    scan.fail = true;
    await openCards(4);
    await vi.waitFor(() => expect(chip().textContent).toContain('未统计'));
    expect(chip().disabled).toBe(true);
    expect(chip().getAttribute('title')).toContain('未统计');
    expect(badgeCount()).toBe(0);
    expect(document.querySelectorAll('.bz-kb-orphan').length).toBe(0);
    chip().click(); // 置灰点击无效果：仍是全量四行
    expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(4);
    expect(chip().classList.contains('is-on')).toBe(false);
  });

  it('issue 323 挂载索引会话缓存：切部来回不重扫整库（切换卡顿的根因已修）', async () => {
    await openCards();
    await waitIndex();
    expect(scan.refCounts).toBe(1);
    expect(scan.orphanCards).toBe(1);

    // 切到部壹再切回部贰：命中会话缓存，整库一次都不扫（旧口径每轮 refresh 都重扫 1500+ 文件）
    const md = vi.spyOn(vault, 'getMarkdownFiles');
    const read = vi.spyOn(vault, 'cachedRead');
    (document.querySelector('[data-part=z1]') as HTMLElement).click();
    (document.querySelector('[data-part=z2]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(4));
    expect(scan.refCounts).toBe(1);
    expect(scan.orphanCards).toBe(1);
    expect(md.mock.calls.length).toBe(0);
    expect(read.mock.calls.length).toBe(0);
    // 会话缓存渲染：徽标照常在（不是重新扫出来的）
    expect(row('卡片盒/甲卡.md').querySelector('.bz-kb-refbadge')!.textContent).toBe('被引 2');

    // 重渲染（筛选切换来回）也复用缓存，不再有任何读取
    chip().click();
    chip().click();
    expect(md.mock.calls.length).toBe(0);
    expect(read.mock.calls.length).toBe(0);
  });

  it('落卡后索引只重算一次：新卡即时带徽标（源文献互链已计入）', async () => {
    await openCards();
    await waitIndex();
    // 源文献带 frontmatter（appendRelatedLine 只认 frontmatter；无 frontmatter 不写）
    vault.files.set('文献盒/来源.md', ['---', 'title: "来源"', '---', '', '来源正文。'].join('\n'));
    const ref0 = scan.refCounts;
    const orph0 = scan.orphanCards;
    (ui as any).editor = {
      source: { file: null, path: '文献盒/来源.md', title: '来源', domain: '心理' },
      pick: '卡片盒/甲卡.md',
      why: '整理为显式连接',
      title: '新卡',
    };
    await (ui as any).saveCard();
    expect(scan.refCounts - ref0).toBe(1);
    expect(scan.orphanCards - orph0).toBe(1);
    expect(row('卡片盒/新卡.md')).toBeTruthy();
    // 源文献 related 互链指向新卡 → 新卡被引 1（重算已反映这次写入）；有入链即非孤儿
    expect(row('卡片盒/新卡.md').querySelector('.bz-kb-refbadge')!.textContent).toBe('被引 1');
    expect(row('卡片盒/新卡.md').querySelector('.bz-kb-orphan')).toBeNull();
  });

  it('孤儿筛选 × 分页：分页按筛选后的池子算，加载更多只加孤儿', async () => {
    for (let i = 1; i <= 81; i++) vault.files.set(`卡片盒/批${String(i).padStart(2, '0')}.md`, '批量孤立卡。');
    ui.showMain();
    (document.querySelector('[data-part=z2]') as HTMLElement).click();
    await vi.waitFor(() => expect(sc().textContent).toContain('全部 85 张'));
    await waitIndex();
    expect(chip().textContent).toContain('孤 儿 · 82'); // 81 批卡 + 孤卡
    chip().click();
    await vi.waitFor(() => expect(sc().textContent).toContain('↓ 还有 2 张，滚动或点此加载'));
    expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(80); // 首屏 80，池子 = 82
    // 加载更多走滚动路径（`cards-more` 行的点击未接线，是既有缺口，见报告）
    sc().dispatchEvent(new Event('scroll'));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(82));
    expect(sc().textContent).not.toContain('还有');
    expect(document.querySelectorAll('.bz-kb-orphan').length).toBe(82);
  });
});
