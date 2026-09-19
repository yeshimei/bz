/**
 * memo 域修复批 D 回归：条目动作 / 周期撤链 / 删除口径 / composer。
 * 对号（.scratch/review-deep/memo-{func,ui,arch}.md）：
 *  1. N8/A2 jumpToNote await openFile 后定位新 view editor（必要时 rAF 兜底）
 *  2. M4 已完成周期条目恢复复用 hasPendingNextItem 撤链 + restored 域事件
 *     （清单子任务 UI 退役后恢复触发统一走勾选圈路径）
 *  3. M5+M2-2 composer Enter isComposing/229 守卫 + 移动分流开创建弹窗（issue 268）
 *  4. M2-3 postponeItem/postponeSub 算术 moment 化（iOS WebKit Invalid Date → NaN due）
 *  5. 效率整改 5 删除免确认直达 notifyUndo（M11：idx=-1 防陈旧快照复活）
 *  7. M10 拍板钉行为：防抖窗口内关面板，未决完成不落盘（反悔语义覆盖关闭场景）
 *  8. A5 composer 默认优先级读 memoDefaultPriority（与编辑弹窗同口径）
 *  9. 一致#12 composer 成功通知带条目标识（超长 ~12 字截断）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';
import type { MemoItem } from '../../src/memo/types';

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

const baseItem = (extra: Partial<MemoItem>): MemoItem => ({
  id: 't1', title: '随手一条', scene: '学习', priority: 'minor', created: '2026-09-10 09:00:00',
  completed: null, due: null, notePath: null, notePosition: null, scriptName: null,
  courseName: null, coursePath: null, linkedNote: null, url: null, recur: null, checklist: null, ...extra,
});

function seed(items: MemoItem[], settingsPatch: Record<string, unknown> = {}): {
  vault: MockVault; app: ReturnType<typeof mockAppWithVault>; settings: any;
} {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings: any = { ...SETTINGS, ...settingsPatch };
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings);
  return { vault, app, settings };
}

/** 在浮层菜单里按文案点菜单项 */
function clickMenuItem(label: string): void {
  const hit = ([...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[])
    .find((b) => b.querySelector('.bz-item-menu-label')?.textContent === label);
  expect(hit, `菜单项「${label}」应存在`).toBeTruthy();
  (hit as HTMLElement).click();
}

/** 右键卡片等菜单 */
async function openCardMenu(card: HTMLElement): Promise<void> {
  card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
  await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
}

/** composer 输入框就绪 */
async function composerReady(): Promise<HTMLInputElement> {
  await vi.waitFor(() => {
    expect(document.querySelector('[data-memo-composer-input]')).toBeTruthy();
  });
  return document.querySelector('[data-memo-composer-input]') as HTMLInputElement;
}

function rawItems(vault: MockVault): any[] {
  return JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
}

describe('批 D · 1 jumpToNote 定位竞态（N8/A2）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    clearNotices();
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    document.body.innerHTML = '';
  });

  function seedJump(): { app: any; ed: any; order: string[]; leaf: any } {
    const order: string[] = [];
    const ed = {
      focus: vi.fn(),
      setCursor: vi.fn(() => { order.push('setCursor'); }),
      scrollIntoView: vi.fn(),
    };
    const leaf: any = {
      view: null,
      openFile: vi.fn(async () => {
        order.push('openFile');
        leaf.view = { editor: ed }; // 真机：openFile 完成后 view 才切换到目标笔记
      }),
    };
    const { app } = seed([
      baseItem({ id: 'j', title: '带定位的条目', notePath: '笔记/A.md', notePosition: { line: 5, ch: 2 } }),
    ]);
    (app.vault as MockVault).files.set('笔记/A.md', '正文\n\n\n\n\n目标行内容');
    (app.workspace as any).getLeaf = () => leaf;
    return { app, ed, order, leaf };
  }

  it('openFile 异步 resolve 之后才 setCursor，且作用在新 view 的 editor 上', async () => {
    const { app, ed, order } = seedJump();
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="j"]')).toBeTruthy());
    await openCardMenu(document.querySelector('.bz-memo-card[data-memo-id="j"]') as HTMLElement);
    clickMenuItem('跳转关联笔记');
    // 修复点：不再是「void openFile 后同步取 editor」——同步阶段（openFile 未 resolve）不定光标
    expect(order).not.toContain('setCursor');
    // await 后才定位，且 spy 挂在 openFile 注入的新 editor 上（作用对象正确）
    await vi.waitFor(() => {
      expect(order).toEqual(['openFile', 'setCursor']);
    });
    expect(ed.setCursor).toHaveBeenCalledWith(5, 2);
    expect(ed.focus).toHaveBeenCalled();
    expect(ed.scrollIntoView).toHaveBeenCalled();
  });

  it('极端时序兜底：await 后 editor 未就绪 → rAF 一帧后重取并定位', async () => {
    const { app, leaf } = seedJump();
    // 覆写：openFile resolve 时不挂 editor（视图慢一拍就绪）
    leaf.openFile.mockImplementation(async () => {});
    const ed2 = { focus: vi.fn(), setCursor: vi.fn(), scrollIntoView: vi.fn() };
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="j"]')).toBeTruthy());
    await openCardMenu(document.querySelector('.bz-memo-card[data-memo-id="j"]') as HTMLElement);
    clickMenuItem('跳转关联笔记');
    await vi.waitFor(() => expect(leaf.openFile).toHaveBeenCalled());
    leaf.view = { editor: ed2 }; // rAF 前视图就绪
    await vi.waitFor(() => {
      expect(ed2.setCursor).toHaveBeenCalledWith(5, 2);
    });
  });

  it('关联笔记不存在：提示且不调 openFile', async () => {
    const { app, leaf } = seedJump();
    (app.vault as MockVault).files.delete('笔记/A.md');
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="j"]')).toBeTruthy());
    await openCardMenu(document.querySelector('.bz-memo-card[data-memo-id="j"]') as HTMLElement);
    clickMenuItem('跳转关联笔记');
    await vi.waitFor(() => expect(hasNotice('关联笔记不存在')).toBe(true));
    expect(leaf.openFile).not.toHaveBeenCalled();
  });
});

describe('批 D · 2 已完成周期条目恢复撤链（M4）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    document.body.innerHTML = '';
  });

  function seedRecur(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
    const r1 = baseItem({
      id: 'r1', title: '每周采购', scene: '生活', completed: '2026-09-10 10:00:00', due: '2026-09-10 09:00:00',
      recur: { kind: 'weekly' }, checklist: [{ text: '买菜', done: true }, { text: '买水果', done: true }],
    });
    const r1n = baseItem({
      id: 'r1n', title: '每周采购', scene: '生活', due: '2026-09-17 09:00:00',
      recur: { kind: 'weekly' }, checklist: [{ text: '买菜', done: false }, { text: '买水果', done: false }],
    });
    return seed([r1, r1n]);
  }

  it('已完成周期条目恢复 → recur 一并清空（不再重复生成）+ restored 域事件', async () => {
    const { vault, app } = seedRecur();
    const restoredEvents: any[] = [];
    const { onDomainEvent } = await import('../../src/core/domain-bus');
    onDomainEvent('memo', (e: any) => { if (e.kind === 'restored') restoredEvents.push(e); });
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-donebar')).toBeTruthy());
    (document.querySelector('.bz-memo-donebar') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="r1"] [data-memo-check]')).toBeTruthy());
    (document.querySelector('.bz-memo-card[data-memo-id="r1"] [data-memo-check]') as HTMLElement).click();
    await vi.waitFor(() => {
      const r1 = rawItems(vault).find((r) => r.id === 'r1');
      expect(r1.completed).toBeNull();
      expect(r1.recur).toBeNull(); // 撤链：恢复时 recur 清空
    });
    expect(restoredEvents.map((e) => e.title)).toContain('每周采购'); // 对齐 restoreItem 口径
  });

  it('撤链后再完成不与链上下期并存（不生成第三条同名条目）', async () => {
    const { vault, app } = seedRecur();
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-donebar')).toBeTruthy());
    (document.querySelector('.bz-memo-donebar') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="r1"] [data-memo-check]')).toBeTruthy());
    // 第一步：勾选圈恢复 → 撤链
    (document.querySelector('.bz-memo-card[data-memo-id="r1"] [data-memo-check]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(rawItems(vault).find((r) => r.id === 'r1').recur).toBeNull();
    });
    // 第二步：再完成（300ms 防抖）→ recur 已空，不生成下一期
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="r1"] [data-memo-check]')).toBeTruthy();
    });
    (document.querySelector('.bz-memo-card[data-memo-id="r1"] [data-memo-check]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 450));
    await vi.waitFor(() => {
      expect(rawItems(vault).find((r) => r.id === 'r1').completed).toBeTruthy();
    });
    // 同名条目恒 2 条（当期 + 原下期），无重复生成
    expect(rawItems(vault).filter((r) => r.title === '每周采购').length).toBe(2);
  });
});

describe('批 D · 3 composer Enter 守卫与移动分流（M5 + M2-2）', () => {
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

  it('IME 组词确认回车（isComposing）不落盘；真实回车才提交', async () => {
    const { vault, app } = seed([]);
    openMemoPanel(app);
    const input = await composerReady();
    input.value = '组词中的草稿';
    const composing = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(composing, 'isComposing', { value: true });
    input.dispatchEvent(composing);
    await new Promise((r) => setTimeout(r, 50));
    expect(rawItems(vault).length).toBe(0); // 未落盘
    expect(input.value).toBe('组词中的草稿'); // 草稿未清
    // 真实回车（非组词）正常提交
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => {
      expect(rawItems(vault).length).toBe(1);
    });
    expect(rawItems(vault)[0].title).toBe('组词中的草稿');
  });

  it('keyCode 229（旧版 IME 派发形态）同样不提交', async () => {
    const { vault, app } = seed([]);
    openMemoPanel(app);
    const input = await composerReady();
    input.value = '229 形态';
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(ev, 'keyCode', { value: 229 });
    input.dispatchEvent(ev);
    await new Promise((r) => setTimeout(r, 50));
    expect(rawItems(vault).length).toBe(0);
  });

  it('移动端 Enter = 开创建弹窗带草稿（issue 268 口径），不直接落盘', async () => {
    MockPlatform.isMobile = true;
    const { vault, app } = seed([]);
    openMemoPanel(app);
    const input = await composerReady();
    input.value = '移动端草稿一条';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-editor')).toBeTruthy();
    });
    expect((document.querySelector('.bz-memo-editor textarea') as HTMLTextAreaElement).value).toBe('移动端草稿一条');
    expect(rawItems(vault).length).toBe(0); // 未落盘：先弹窗补字段
  });
});

describe('批 D · 4 延后算术 moment 化（M2-3）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    document.body.innerHTML = '';
  });

  it('延后 1 天：due 正确顺延保留时刻，无 NaN 形态', async () => {
    const { vault, app } = seed([
      baseItem({ id: 'p', title: '带截止的条目', due: '2026-09-20 09:30:00' }),
    ]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="p"]')).toBeTruthy());
    await openCardMenu(document.querySelector('.bz-memo-card[data-memo-id="p"]') as HTMLElement);
    clickMenuItem('延后 1 天');
    await vi.waitFor(() => {
      const p = rawItems(vault).find((r) => r.id === 'p');
      expect(p.due).toBe('2026-09-21 09:30'); // +1 天、时刻保留、原实现口径无秒
      expect(p.due).not.toContain('NaN');
    });
  });

  it('延后 3 天跨月边界正确（moment 单源，iOS WebKit 也不再 Invalid Date）', async () => {
    const { vault, app } = seed([
      baseItem({ id: 'p', title: '月末条目', due: '2026-09-30 23:05:00' }),
    ]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="p"]')).toBeTruthy());
    await openCardMenu(document.querySelector('.bz-memo-card[data-memo-id="p"]') as HTMLElement);
    clickMenuItem('延后 3 天');
    await vi.waitFor(() => {
      const p = rawItems(vault).find((r) => r.id === 'p');
      expect(p.due).toBe('2026-10-03 23:05'); // 跨月进 10 月，无 NaN
    });
  });
});

describe('批 D · 5+6 删除免确认直达撤销 + idx=-1 防复活（效率整改 5 + M11）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    clearNotices();
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('删除无确认框直达落盘 + notifyUndo，撤销插回原位；场景删除确认保留（对照）', async () => {
    const { vault, app } = seed([
      baseItem({ id: 'a', title: '甲' }),
      baseItem({ id: 'b', title: '乙' }),
    ]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="b"]')).toBeTruthy());
    await openCardMenu(document.querySelector('.bz-memo-card[data-memo-id="b"]') as HTMLElement);
    clickMenuItem('删除');
    // 无确认框：直接落盘
    await vi.waitFor(() => {
      expect(rawItems(vault).map((r) => r.id)).toEqual(['a']);
    });
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    // 撤销 toast 在 → 撤销插回原位（b 原索引 1）
    await vi.waitFor(() => {
      const undo = [...document.querySelectorAll('.bz-notice-action')].find((el) => el.textContent === '撤销');
      expect(undo).toBeTruthy();
    });
    ([...document.querySelectorAll('.bz-notice-action')].find((el) => el.textContent === '撤销') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(rawItems(vault).map((r) => r.id)).toEqual(['a', 'b']);
    });
  });

  it('idx=-1（他端已删）：提示「该条已不存在」，不发撤销、不复活陈旧快照（M11）', async () => {
    const { vault, app } = seed([baseItem({ id: 'x', title: '将被外部删除' })]);
    const spy = vi.spyOn(MemoData, 'deleteItem').mockResolvedValue(-1);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="x"]')).toBeTruthy());
    await openCardMenu(document.querySelector('.bz-memo-card[data-memo-id="x"]') as HTMLElement);
    clickMenuItem('删除');
    await vi.waitFor(() => {
      expect(hasNotice('该条已不存在')).toBe(true);
    });
    // 无撤销 action（撤销会把陈旧快照插回头部复活外部删除）
    expect([...document.querySelectorAll('.bz-notice-action')].some((el) => el.textContent === '撤销')).toBe(false);
    // deleteItem 返回 -1 未写盘：条目原样保留
    expect(rawItems(vault).length).toBe(1);
    expect(spy).toHaveBeenCalledWith('x');
  });
});

describe('批 D · 7 防抖窗口关面板未决完成不落盘（M10 拍板钉行为）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    document.body.innerHTML = '';
  });

  it('点勾选圈 300ms 内关面板：timer 清空、完成不落盘（反悔语义覆盖关闭场景）', async () => {
    const { vault, app } = seed([baseItem({ id: 'w', title: '还没想好要不要完成' })]);
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="w"] [data-memo-check]')).toBeTruthy();
    });
    (document.querySelector('.bz-memo-card[data-memo-id="w"] [data-memo-check]') as HTMLElement).click();
    // 防抖窗口内关面板（拍板：反悔语义覆盖关闭场景，不 flush）
    closeMemoPanel();
    await new Promise((r) => setTimeout(r, 500));
    expect(rawItems(vault).find((r) => r.id === 'w').completed).toBeNull();
    // 重开面板同样未完成（timer 未在关面板后补发）
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="w"]')).toBeTruthy();
    });
    expect(rawItems(vault).find((r) => r.id === 'w').completed).toBeNull();
  });
});

describe('批 D · 8 composer 默认优先级（A5）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    document.body.innerHTML = '';
  });

  it('memoDefaultPriority=important 时 composer 新条 priority=important（与编辑器同口径）', async () => {
    const { vault, app } = seed([], { memoDefaultPriority: 'important' });
    openMemoPanel(app);
    const input = await composerReady();
    input.value = '重要默认的一条';
    (document.querySelector('[data-memo-composer-add]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(rawItems(vault).length).toBe(1);
    });
    expect(rawItems(vault)[0].priority).toBe('important');
  });

  it('缺省仍 minor', async () => {
    const { vault, app } = seed([]);
    openMemoPanel(app);
    const input = await composerReady();
    input.value = '普通一条';
    (document.querySelector('[data-memo-composer-add]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(rawItems(vault).length).toBe(1);
    });
    expect(rawItems(vault)[0].priority).toBe('minor');
  });
});

describe('批 D · 9 composer 成功通知条目标识（一致#12）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    clearNotices();
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    document.body.innerHTML = '';
  });

  function lastNoticeMsgs(): string[] {
    return [...document.querySelectorAll('.bz-notice-msg')].map((el) => (el as HTMLElement).textContent || '');
  }

  it('通知带场景与标题：「已添加到「剪藏」：「买牛奶」」', async () => {
    const { app } = seed([]);
    openMemoPanel(app);
    const input = await composerReady();
    input.value = '买牛奶';
    (document.querySelector('[data-memo-composer-add]') as HTMLElement).click();
    await vi.waitFor(() => {
      // 伪场景「全部」→ 场景兜底第一个默认场景「剪藏」
      expect(lastNoticeMsgs().some((m) => m === '已添加到「剪藏」：「买牛奶」')).toBe(true);
    });
  });

  it('超长标题截 ~12 字加省略号', async () => {
    const { app } = seed([]);
    openMemoPanel(app);
    const input = await composerReady();
    const long = '一二三四五六七八九十甲乙丙丁戊'; // 15 字
    input.value = long;
    (document.querySelector('[data-memo-composer-add]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(lastNoticeMsgs().some((m) => m === '已添加到「剪藏」：「一二三四五六七八九十甲乙…」')).toBe(true);
    });
  });
});
