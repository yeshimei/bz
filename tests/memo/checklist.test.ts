/**
 * 备忘录清单型子任务（issue 354）回归：
 * - 数据层：composer 约定语法解析（parseComposerChecklist）、checklist 归一（零迁移）、
 *   周期条目下一期清单重置（与 353 正交兼容）；
 * - 纯层：清单行组 markup 口径、meta 进度标签位置；
 * - UI 层：composer 语法落盘、行内勾选进度、全勾完父项自动完成、取消勾选恢复父项、
 *   编辑弹窗改子任务。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { MemoData, normalizeChecklist, parseComposerChecklist } from '../../src/memo/data';
import { metaTagsHtml, cardHtml, checklistHtml } from '../../src/memo/render';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, openEditor } from '../../src/memo/ui';
import type { MemoItem } from '../../src/memo/types';

// ---------- 数据层 ----------

describe('issue 354 · composer 约定语法解析', () => {
  it('「筹备旅行 /订机票 /订酒店」→ 标题 + 两个未勾词条', () => {
    const { title, checklist } = parseComposerChecklist('筹备旅行 /订机票 /订酒店');
    expect(title).toBe('筹备旅行');
    expect(checklist).toEqual([
      { text: '订机票', done: false },
      { text: '订酒店', done: false },
    ]);
  });

  it('无词条 → 普通条目（checklist null）；普通文本原样', () => {
    expect(parseComposerChecklist('随手记一条').checklist).toBeNull();
    expect(parseComposerChecklist('随手记一条').title).toBe('随手记一条');
    // 路径型 token（无前导斜杠）不误收
    const p = parseComposerChecklist('看 24/7 值班表');
    expect(p.title).toBe('看 24/7 值班表');
    expect(p.checklist).toBeNull();
  });

  it('全部是词条 → 首词条升格为标题', () => {
    const { title, checklist } = parseComposerChecklist('/买菜 /做饭');
    expect(title).toBe('买菜');
    expect(checklist).toEqual([{ text: '做饭', done: false }]);
  });

  it('URL 不受语法影响（不以 / 起始）', () => {
    const { title, checklist } = parseComposerChecklist('https://example.com/a /看文章');
    expect(title).toBe('https://example.com/a');
    expect(checklist).toEqual([{ text: '看文章', done: false }]);
  });

  it('空串安全', () => {
    expect(parseComposerChecklist('')).toEqual({ title: '', checklist: null });
  });
});

describe('issue 354 · checklist 归一（零迁移）', () => {
  it('loadItems：无字段补 null；脏行（空 text）剔除', async () => {
    const vault = new MockVault();
    setApp({ vault, workspace: { getActiveFile: () => null }, metadataCache: { getFileCache: () => null } } as any);
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([
        { id: 'old', title: '旧条目', scene: '工作', priority: 'minor', created: '2026-01-01 00:00:00' },
        {
          id: 'cl', title: '筹备', scene: '生活', priority: 'minor', created: '2026-01-01 00:00:00',
          checklist: [{ text: '订机票', done: true }, { text: '   ' }, { text: '订酒店', done: false }],
        },
      ])
    );
    MemoData.init({ storagePath: 'CONFIG/STORAGE' });
    const items = await MemoData.loadItems();
    expect(items.find((i) => i.id === 'old')!.checklist).toBeNull();
    expect(items.find((i) => i.id === 'cl')!.checklist).toEqual([
      { text: '订机票', done: true },
      { text: '订酒店', done: false },
    ]);
  });

  it('normalizeChecklist：非数组/清洗后为空 → null', () => {
    expect(normalizeChecklist('x')).toBeNull();
    expect(normalizeChecklist([{ text: '  ' }])).toBeNull();
    expect(normalizeChecklist(null)).toBeNull();
  });
});

describe('issue 354 · 与 recur 正交兼容（下一期清单重置）', () => {
  it('周期条目完成后：下一期清单全未勾、与原条目数组不共享引用', async () => {
    const vault = new MockVault();
    setApp({ vault, workspace: { getActiveFile: () => null }, metadataCache: { getFileCache: () => null } } as any);
    MemoData.init({ storagePath: 'CONFIG/STORAGE' });
    const src: MemoItem = {
      id: 'r1', title: '每周采购', scene: '生活', priority: 'minor', created: '2026-09-01 09:00:00',
      completed: null, due: '2026-09-20 10:00:00', notePath: null, notePosition: null,
      scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
      recur: { kind: 'weekly' },
      checklist: [{ text: '买菜', done: true }, { text: '买水果', done: true }],
    };
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([src]));
    const { next } = await MemoData.completeItem('r1');
    expect(next).not.toBeNull();
    expect(next!.checklist).toEqual([
      { text: '买菜', done: false },
      { text: '买水果', done: false },
    ]);
    // 原条目保留当期勾选史
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    const old = raw.find((i: any) => i.id === 'r1');
    expect(old.checklist).toEqual([
      { text: '买菜', done: true },
      { text: '买水果', done: true },
    ]);
    // 不共享引用
    next!.checklist![0].text = '改动';
    expect(old.checklist[0].text).toBe('买菜');
  });
});

// ---------- 纯层 markup ----------

describe('issue 354 · 清单行组与进度标签（markup 口径）', () => {
  const base = (extra: Partial<MemoItem>): MemoItem => ({
    id: 't1', title: '筹备旅行', scene: '工作', priority: 'minor', created: '2026-09-10 09:00:00',
    completed: null, due: null, notePath: null, notePosition: null, scriptName: null,
    courseName: null, coursePath: null, linkedNote: null, url: null, recur: null, checklist: null, ...extra,
  });

  it('checklistHtml：行数/锚点/勾选态；无清单空串；父项完成整组淡显', () => {
    const cl = [{ text: '订机票', done: true }, { text: '订酒店', done: false }];
    const h = checklistHtml(base({ checklist: cl }));
    expect((h.match(/bz-memo-cl-row/g) || []).length).toBe(2);
    expect(h).toContain('data-memo-cl="t1:0"');
    expect(h).toContain('data-memo-cl="t1:1"');
    expect(h).toContain('bz-memo-cl-on');
    expect(h).toContain('is-done');
    expect(h).toContain('订机票');
    expect(checklistHtml(base({}))).toBe('');
    expect(checklistHtml(base({ completed: '2026-09-10 10:00:00', checklist: cl }))).toContain('bz-memo-cl-dim');
  });

  it('meta 进度标签位于重复之后、截止之前；无清单不出', () => {
    const it = base({ due: '2026-09-18 18:00:00', recur: { kind: 'weekly' }, checklist: [{ text: 'a', done: true }, { text: 'b', done: false }] });
    const h = metaTagsHtml(it, { status: 'future', text: '09/18 到期' }, '', '每周', '1/2');
    expect(h).toContain('bz-memo-tag-check');
    expect(h).toContain('data-lucide="list-checks"');
    expect(h).toContain('1/2');
    const atRecur = h.indexOf('bz-memo-tag-recur');
    const atCheck = h.indexOf('bz-memo-tag-check');
    const atDue = h.indexOf('bz-memo-tag-future');
    expect(atCheck).toBeGreaterThan(atRecur);
    expect(atCheck).toBeLessThan(atDue);
    expect(metaTagsHtml(base({}), null, '', '', '')).not.toContain('bz-memo-tag-check');
  });

  it('cardHtml 内嵌清单行组', () => {
    const h = cardHtml(base({ checklist: [{ text: '订机票', done: false }] }), null, '');
    expect(h).toContain('bz-memo-cl');
    expect(h).toContain('data-memo-cl="t1:0"');
  });
});

// ---------- UI 层 ----------

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '全部',
  memoDoneWindow: '30',
  cinemaFolderPath: '我的/影视',
};

describe('issue 354 · UI（composer 语法/行内勾选/自动完成/编辑器）', () => {
  let vault: MockVault;

  function seed(items: Record<string, unknown>[]): { app: ReturnType<typeof mockAppWithVault> } {
    vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items));
    const settings: Record<string, unknown> = { ...SETTINGS };
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => settings as any);
    setSettingsSaver(vi.fn(async () => {}));
    MemoData.init(settings as any);
    return { app };
  }

  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  it('composer 语法落盘：「筹备旅行 /订机票 /订酒店」→ 标题 + 两子任务，列表显示 0/2', async () => {
    seed([]);
    openMemoPanel(M.appRef!);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-composer-input]')).toBeTruthy();
    });
    const input = document.querySelector('[data-memo-composer-input]') as HTMLInputElement;
    input.value = '筹备旅行 /订机票 /订酒店';
    (document.querySelector('[data-memo-composer-add]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-cl-row').length).toBe(2);
    });
    expect(document.querySelector('.bz-memo-tag-check')?.textContent).toContain('0/2');
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].title).toBe('筹备旅行');
    expect(raw[0].checklist).toEqual([
      { text: '订机票', done: false },
      { text: '订酒店', done: false },
    ]);
  });

  function seedOne(extra: Record<string, unknown> = {}): { app: ReturnType<typeof mockAppWithVault> } {
    return seed([
      {
        id: 'c1', title: '筹备旅行', scene: '生活', priority: 'minor', created: '2026-09-01 09:00:00',
        completed: null,
        checklist: [
          { text: '订机票', done: false },
          { text: '订酒店', done: false },
        ],
        ...extra,
      },
    ]);
  }

  it('行内勾选：即时落盘进度 1/2', async () => {
    const { app } = seedOne();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-cl]')).toBeTruthy();
    });
    (document.querySelector('[data-memo-cl="c1:0"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-tag-check')?.textContent).toContain('1/2');
    });
    expect((document.querySelector('[data-memo-cl="c1:0"]') as HTMLElement).className).toContain('is-done');
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].checklist[0].done).toBe(true);
    expect(raw[0].completed).toBeNull(); // 未全勾：父项不完成
  });

  it('全勾完父项自动完成（入已完成折叠区，勾选史保留）', async () => {
    const { app } = seedOne();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-cl]')).toBeTruthy();
    });
    (document.querySelector('[data-memo-cl="c1:0"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-tag-check')?.textContent).toContain('1/2');
    });
    (document.querySelector('[data-memo-cl="c1:1"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 450)); // 全勾走父项完成链路（300ms 防抖）
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw[0].completed).toBeTruthy();
    });
    // 展开已完成折叠区可见父项
    (document.querySelector('[data-memo-donebar]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card.bz-memo-done')).toBeTruthy();
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].checklist.every((c: any) => c.done)).toBe(true);
  });

  it('已完成父项取消勾选 → 自动恢复未完成', async () => {
    const { app } = seedOne({ completed: '2026-09-10 10:00:00', checklist: [{ text: '订机票', done: true }, { text: '订酒店', done: true }] });
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-donebar]')).toBeTruthy();
    });
    (document.querySelector('[data-memo-donebar]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-cl="c1:0"]')).toBeTruthy();
    });
    (document.querySelector('[data-memo-cl="c1:0"]') as HTMLElement).click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw[0].completed).toBeNull();
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].checklist[0].done).toBe(false);
    expect(raw[0].checklist[1].done).toBe(true);
  });

  it('编辑器：子任务回填/改文案/加行，保存落盘', async () => {
    const { app } = seedOne();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(1);
    });
    openEditor(M.items[0]);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-cl-edit-row').length).toBe(2);
    });
    const inputs = [...document.querySelectorAll('.bz-memo-cl-edit-row input.bz-input')] as HTMLInputElement[];
    expect(inputs[0].value).toBe('订机票');
    expect(inputs[1].value).toBe('订酒店');
    // 改文案 + 加一行
    inputs[1].value = '订酒店（市区）';
    inputs[1].dispatchEvent(new Event('input'));
    (document.querySelector('.bz-memo-cl-addbtn') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-cl-edit-row').length).toBe(3);
    });
    const saveBtn = [...document.querySelectorAll('.bz-memo-editor .bz-btn')].find((b) => b.textContent!.includes('保存')) as HTMLElement;
    saveBtn.click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw[0].checklist).toEqual([
        { text: '订机票', done: false },
        { text: '订酒店（市区）', done: false },
        { text: '', done: false },
      ].filter((c: any) => c.text));
    });
  });
});
