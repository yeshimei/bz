/**
 * 挂载树·列表侧（issue 320；ADR-0138 §5 同包四项）UI 测试：
 * - 卡片行**引用计数徽标**：只数用户双链（正文 wikilink + related + mounted），0 不显示；
 * - **孤儿卡**筛选开关 + 行标记：孤儿 = 既无入链也无挂载（同名文献不解除孤儿）；
 * - **整库扫描缓存**：`refCounts` / `orphanCards` 每轮 refresh 只算一次并缓存到面板对象上，
 *   供徽标、筛选、行标记共用——渲染多少行都只扫一遍（本文件用 spy 计数断言）。
 * 数据层口径见 tests/knowledge/mount-data.test.ts（节点/边/计数/孤儿判定），这里只验列表接线。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIManager } from '../../src/knowledge/ui';
import { KnowledgeData } from '../../src/knowledge/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices, resetObsidianMocks } from '../mock-obsidian-entry';

/** 整库扫描调用计数（issue 320：每轮 refresh 只算一次，行渲染不再各算一次） */
const scan = vi.hoisted(() => ({ mountCtx: 0, refCounts: 0, orphanCards: 0 }));

vi.mock('../../src/knowledge/mount-data', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/knowledge/mount-data')>();
  return {
    ...real,
    mountCtx: (...a: any[]) => { scan.mountCtx++; return (real.mountCtx as any)(...a); },
    refCounts: (...a: any[]) => { scan.refCounts++; return (real.refCounts as any)(...a); },
    orphanCards: (...a: any[]) => { scan.orphanCards++; return (real.orphanCards as any)(...a); },
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

  /** 行元素（按路径定位，避免列表顺序干扰） */
  function row(path: string): HTMLElement {
    return document.querySelector(`.bz-kb-lexrow[data-path="${path}"]`) as HTMLElement;
  }
  /** 开主窗 → 切部贰 → 等四张卡上齐 + 引用索引落地（徽标出现） */
  async function openCards(): Promise<void> {
    ui.showMain();
    (document.querySelector('[data-part=z2]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(4));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-refbadge').length).toBe(2));
  }

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
    scan.orphanCards = 0;
    ui = new UIManager(app);
  });

  afterEach(() => {
    ui.destroy();
    document.body.innerHTML = '';
  });

  it('引用计数徽标：只数用户双链（正文 + related + mounted），0 不出徽标', async () => {
    await openCards();
    expect(row('卡片盒/甲卡.md').querySelector('.bz-kb-refbadge')!.textContent).toBe('被引 2');
    expect(row('卡片盒/乙卡.md').querySelector('.bz-kb-refbadge')!.textContent).toBe('被引 1');
    expect(row('卡片盒/丙卡.md').querySelector('.bz-kb-refbadge')).toBeNull(); // 0 不显示
    expect(row('卡片盒/孤卡.md').querySelector('.bz-kb-refbadge')).toBeNull();
    // 同名文献不计数、不解除孤儿（本用例无同名文献，徽标数即纯用户双链口径）
    expect(document.querySelectorAll('.bz-kb-refbadge').length).toBe(2);
  });

  it('孤儿行标记：只标既无入链也无挂载的卡（有出向挂载就不是孤儿）', async () => {
    await openCards();
    expect(row('卡片盒/孤卡.md').querySelector('.bz-kb-orphan')!.textContent).toBe('孤 儿');
    expect(row('卡片盒/丙卡.md').querySelector('.bz-kb-orphan')).toBeNull();
    expect(row('卡片盒/甲卡.md').querySelector('.bz-kb-orphan')).toBeNull();
    expect(document.querySelectorAll('.bz-kb-orphan').length).toBe(1);
  });

  it('孤儿筛选开关：开启只列孤儿卡（芯片点亮），关闭恢复全量', async () => {
    await openCards();
    const chip = () => document.querySelector('[data-kb-act=cards-orphan]') as HTMLElement;
    expect(chip().textContent).toContain('孤 儿 · 1');
    chip().click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(1));
    expect(chip().classList.contains('is-on')).toBe(true);
    expect((document.querySelector('.bz-kb-lexrow') as HTMLElement).getAttribute('data-path')).toBe('卡片盒/孤卡.md');
    chip().click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(4));
    expect(chip().classList.contains('is-on')).toBe(false);
  });

  it('整库扫描每轮 refresh 只算一次并缓存：行渲染与筛选切换都不重扫', async () => {
    await openCards(); // 四张卡、四行渲染
    expect(scan).toEqual({ mountCtx: 1, refCounts: 1, orphanCards: 1 });
    (document.querySelector('[data-kb-act=cards-orphan]') as HTMLElement).click();
    (document.querySelector('[data-kb-act=cards-orphan]') as HTMLElement).click();
    expect(scan.refCounts).toBe(1); // 重渲染不重扫（缓存挂在面板对象上）
    expect(scan.orphanCards).toBe(1);
    // 换部再回来 = 新一轮 refresh → 再算一次（每轮一次，不是每行一次）
    (document.querySelector('[data-part=z1]') as HTMLElement).click();
    (document.querySelector('[data-part=z2]') as HTMLElement).click();
    await vi.waitFor(() => expect(scan.refCounts).toBe(2));
    expect(scan.orphanCards).toBe(2);
  });
});
