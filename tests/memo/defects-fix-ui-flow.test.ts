/**
 * memo 重审缺陷修复批 · UI 定位/延后/提交链回归（tests/memo/defects-fix-ui-flow.test.ts，防撞命名）
 * 覆盖（来源标注于各用例）：
 *  - memo2-func #3 / memo2-arch A2（T8）：jumpToNote 未 await openFile 定位从不生效——
 *    修复后 setCursor 作用于 openFile resolve 后的新视图。
 *  - 呈报#15（15A 拍板，memo2-ui MR2-5）：openItem/jumpToNote 目标不存在时不关面板。
 *  - memo2-func #4（memo2-ui M2-3）：延后算术走 moment 单源，iOS 不再落 NaN 脏 due。
 *  - memo2-func #5 / memo2-arch A3（T6）：openForNote 已开分支重置场景过滤。
 *  - memo2-func #14 / memo2-arch A5（T7）：composer 读 memoDefaultPriority。
 *  - memo2-func #6 / memo2-ui M2-2：移动 composer 回车开弹窗（issue 268 口径对齐）+ 占位符分形态。
 *  - memo2-func #8：三处 Enter 提交的 isComposing 守卫。
 *  - memo2-func #1 / memo2-ui M2-1：编辑器保存防重入（双击单条目）。
 *  - memo2-ui M3-11 / memo2-arch A4（呈报#1 完整口径）：编辑器 bindFormSubmit——
 *    单行框回车即存、正文 Ctrl/⌘+Enter 提交；场景弹窗手写回车/ESC 收编。
 * 一切以自造 fixture 验证，不读用户真实数据。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, addMemo, unloadMemo } from '../../src/memo/ui';
import { ensureMemoReminders } from '../../src/memo';
import { MemoData } from '../../src/memo/data';

const PATH = 'CONFIG/STORAGE/memo.json';
const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  autoPopupOnStart: false,
  openNoteReminder: true,
  cinemaFolderPath: '我的/影视',
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'x', title: '条目', scene: '工作', priority: 'minor', created: at(-1, '10:00'),
    completed: null, due: null, notePath: null, notePosition: null,
    scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    ...overrides,
  };
}

interface Ctx {
  vault: MockVault;
  app: any;
  settings: any;
  saveSpy: ReturnType<typeof vi.fn>;
}

function seed(vaultItems: Record<string, unknown>[], settingsOverride: Record<string, unknown> = {}): Ctx {
  const vault = new MockVault();
  if (vaultItems.length) vault.files.set(PATH, JSON.stringify(vaultItems, null, 2));
  const settings = { ...SETTINGS, ...settingsOverride };
  const saveSpy = vi.fn(async () => {});
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(saveSpy);
  MemoData.init(settings as any);
  return { vault, app, settings, saveSpy };
}

beforeEach(() => {
  resetObsidianMocks();
  resetMemoState();
  document.body.innerHTML = '';
  MockPlatform.isMobile = false;
});

afterEach(() => {
  closeMemoPanel();
  unloadMemo();
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
});

/** 在浮层菜单中按文案点菜单项 */
function clickMenuItem(label: string): void {
  const hit = ([...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[])
    .find((b) => b.querySelector('.bz-item-menu-label')?.textContent === label);
  expect(hit, `菜单项「${label}」应存在`).toBeTruthy();
  (hit as HTMLElement).click();
}

describe('memo2-func #3 / memo2-arch A2（T8）+ 呈报#15：jumpToNote 定位与失败不关面板', () => {
  it('修复前必红形态：setCursor 在 openFile resolve 之后、作用于新视图的 editor', async () => {
    const calls: string[] = [];
    const oldEditor = { setCursor: vi.fn(() => calls.push('old.setCursor')) };
    const newEditor = { setCursor: vi.fn(() => calls.push('new.setCursor')), scrollIntoView: vi.fn(), focus: vi.fn() };
    const leaf: any = {
      view: { editor: oldEditor }, // 打开前 leaf 停留上一篇（旧视图）
      openFile: async () => {
        await new Promise((r) => setTimeout(r, 20));
        leaf.view = { editor: newEditor }; // openFile 完成后视图才切换
        calls.push('openFile');
      },
    };
    const { app, vault } = seed([item({ id: 'p1', notePath: '笔记/B.md', notePosition: { line: 3, ch: 2 } })]);
    vault.files.set('笔记/B.md', '目标笔记'); // 关联文件必须真实存在（15A：不存在则不跳）
    (app as any).workspace.getLeaf = () => leaf;
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="p1"]')).toBeTruthy());
    // 点卡片 meta 的「位置」tag
    (document.querySelector('[data-memo-pos="p1"]') as HTMLElement).click();
    await vi.waitFor(() => expect(newEditor.setCursor).toHaveBeenCalledWith(3, 2));
    // 旧视图不挨打 + 时序：openFile 先于 setCursor
    expect(oldEditor.setCursor).not.toHaveBeenCalled();
    expect(calls.indexOf('openFile')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('openFile')).toBeLessThan(calls.indexOf('new.setCursor'));
    expect(newEditor.scrollIntoView).toHaveBeenCalled();
  });

  it('15A：关联笔记不存在时点「位置」——面板保留 + 提示（不再先关面板再报错）', async () => {
    const { app } = seed([item({ id: 'p2', notePath: '笔记/已删.md' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="p2"]')).toBeTruthy());
    (document.querySelector('[data-memo-pos="p2"]') as HTMLElement).click();
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy(); // 面板没关
    await vi.waitFor(() => {
      const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
      expect(msgs.some((m) => m === '关联笔记不存在')).toBe(true);
    });
  });

  it('15A：链接条目「打开」目标笔记缺失时面板保留（openItem 同口径）', async () => {
    const { app } = seed([item({ id: 'p3', linkedNote: '笔记/没了.md' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="p3"]')).toBeTruthy());
    (document.querySelector('[data-memo-openitem="p3"]') as HTMLElement).click();
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
    await vi.waitFor(() => {
      const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
      expect(msgs.some((m) => m === '关联笔记不存在')).toBe(true);
    });
  });
});

describe('memo2-func #4（M2-3）：延后算术 moment 单源', () => {
  it('延后 1 天：due = 原日期 +1 天、时刻沿用，不产 NaN 串', async () => {
    const { app, vault } = seed([item({ id: 'd1', due: at(0, '09:00') })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="d1"]')).toBeTruthy());
    (document.querySelector('.bz-memo-card[data-memo-id="d1"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    clickMenuItem('延后 1 天');
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get(PATH)!);
      // 时刻沿用原 due 的 HH:mm（延后整天语义）；moment 口径不再有 NaN 形态
      const expected = moment().add(1, 'days').format('YYYY-MM-DD') + ' 09:00';
      expect(raw.find((r: any) => r.id === 'd1').due).toBe(expected);
    });
  });
});

describe('memo2-func #10/#11/#12 + 旧-2：删除/场景/完成收尾链', () => {
  it('func#11：删除已不存在的条目——不挂撤销、不复活陈旧快照，提示并刷新', async () => {
    const { app, vault } = seed([
      item({ id: 'b', title: '外部已删的条目' }),
      item({ id: 'c', title: '别动我' }),
    ]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="b"]')).toBeTruthy());
    // 模拟外部写方（双端同库）已删 b，面板未刷新——UI 仍持陈旧卡片
    vault.files.set(PATH, JSON.stringify([item({ id: 'c', title: '别动我' })]));
    const card = document.querySelector('.bz-memo-card[data-memo-id="b"]') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    clickMenuItem('删除');
    await vi.waitFor(() => {
      const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
      expect(msgs.some((m) => m?.includes('已不存在'))).toBe(true);
    });
    // 无撤销通知（防陈旧快照复活）；盘上无变化；列表刷新后 b 卡消失
    expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(false);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="b"]')).toBeNull();
    });
    expect(JSON.parse(vault.files.get(PATH)!).map((r: any) => r.id)).toEqual(['c']);
  });

  it('func#10：完成防抖 300ms 窗口内关面板——挂起完成 flush 落盘（不再静默丢失）', async () => {
    const { app, vault } = seed([item({ id: 'a', title: '要完成的条目' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-check')).toBeTruthy());
    (document.querySelector('.bz-memo-check') as HTMLElement).click();
    // 300ms 窗口内立刻关面板
    closeMemoPanel();
    await vi.waitFor(() => {
      const a = JSON.parse(vault.files.get(PATH)!).find((r: any) => r.id === 'a');
      expect(a.completed).toBeTruthy(); // 完成意图不丢
    });
  });

  it('func#12：场景重命名两段写失败——反向迁移补偿，条目不挂进不可达场景', async () => {
    const { app, vault } = seed([item({ id: 'g', title: '副业条目', scene: '副业' })], {
      memoScenarios: '剪藏,工作,学习,生活,代码,公开课,副业',
    });
    setSettingsSaver(vi.fn(async () => { throw new Error('磁盘满'); })); // 设置串写失败
    const bulkSpy = vi.spyOn(MemoData, 'updateSceneBulk');
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-nav] [data-memo-scene="副业"]')).toBeTruthy());
    (document.querySelector('[data-memo-nav] [data-memo-scene="副业"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    clickMenuItem('重命名');
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-addscene')).toBeTruthy());
    const input = (document.querySelector('.bz-memo-addscene .bz-input') as HTMLInputElement);
    input.value = '兼职';
    (document.querySelector('.bz-memo-addscene .bz-btn--primary') as HTMLElement).click();
    // 失败通知（notifySaveError 口径：保存失败（重命名场景）：…）
    await vi.waitFor(() => {
      const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
      expect(msgs.some((m) => m?.includes('保存失败（重命名场景）'))).toBe(true);
    });
    // 补偿：正反两次批量迁移
    expect(bulkSpy).toHaveBeenCalledTimes(2);
    expect(bulkSpy.mock.calls[0]).toEqual(['副业', '兼职']);
    expect(bulkSpy.mock.calls[1]).toEqual(['兼职', '副业']);
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get(PATH)!);
      expect(raw.find((r: any) => r.id === 'g').scene).toBe('副业'); // 条目回到可达场景
    });
    bulkSpy.mockRestore();
  });
});

describe('memo2-func #7 / memo2-arch A9（T9）：读盘失败错误面', () => {
  it('修复前必红形态：loadItems 拒绝 → 面板出错误空态 + 失败通知，不再静默空白；重试可恢复', async () => {
    const { app } = seed([item({ id: 'a' })]);
    const spy = vi.spyOn(MemoData, 'loadItems').mockRejectedValueOnce(new Error('磁盘被同步盘锁住'));
    openMemoPanel(app);
    await vi.waitFor(() => {
      const empty = document.querySelector('.bz-empty') as HTMLElement | null;
      expect(empty?.querySelector('.bz-empty-title')?.textContent).toBe('备忘录读取失败');
    });
    await vi.waitFor(() => {
      const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
      expect(msgs.some((m) => m?.includes('读取备忘录失败'))).toBe(true);
    });
    spy.mockRestore();
    // 重试恢复：点错误空态的「重试」→ 数据到达、正常列表渲染
    const retry = ([...document.querySelectorAll('.bz-empty .bz-btn')] as HTMLElement[]).find((b) => b.textContent?.includes('重试'));
    expect(retry).toBeTruthy();
    retry!.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeTruthy();
    });
  });
});

describe('memo2-func #5 / memo2-arch A3（T6）：openForNote 已开分支重置场景', () => {
  function makeCaptureApp(vault: MockVault) {
    const app = mockAppWithVault(vault) as any;
    const handlers: Record<string, Function[]> = {};
    app.workspace = {
      ...app.workspace,
      on: (ev: string, cb: any) => {
        (handlers[ev] ||= []).push(cb);
        return { event: ev, cb };
      },
      offref: (ref: any) => {
        if (!ref || !ref.event) return;
        const arr = handlers[ref.event] || [];
        const idx = arr.indexOf(ref.cb);
        if (idx >= 0) arr.splice(idx, 1);
      },
      emit: (ev: string, ...args: any[]) => {
        for (const cb of handlers[ev] || []) cb(...args);
      },
    };
    return app;
  }

  it('修复前必红形态：面板停在具体场景时触发 file-open 提醒 → 场景重置「全部」且目标条目可见', async () => {
    const vault = new MockVault();
    vault.files.set(PATH, JSON.stringify([
      item({ id: 'tgt', title: 'A 笔记的关联备忘录', scene: '生活', priority: 'important', notePath: '笔记/A.md' }),
      item({ id: 'other', title: '工作场景的条目', scene: '工作' }),
    ], null, 2));
    const settings = { ...SETTINGS };
    const app = makeCaptureApp(vault);
    setApp(app);
    setSettingsProvider(() => settings as any);
    setSettingsSaver(vi.fn(async () => {}));
    MemoData.init(settings as any);
    ensureMemoReminders(app);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="other"]')).toBeTruthy());
    // 面板切到「工作」（目标条目在「生活」，被场景过滤挡掉）
    (document.querySelector('[data-memo-scene="工作"]') as HTMLElement).click();
    await vi.waitFor(() => {
      const cards = [...document.querySelectorAll('.bz-memo-card')];
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('工作场景的条目');
    });
    // 打开目标笔记 → 提醒定位
    (app as any).workspace.emit('file-open', { path: '笔记/A.md' });
    await vi.waitFor(() => {
      expect((document.querySelector('[data-memo-search]') as HTMLInputElement).value).toBe('笔记/A.md');
    });
    await vi.waitFor(() => {
      const cards = [...document.querySelectorAll('.bz-memo-card')];
      expect(cards.some((c) => c.textContent?.includes('A 笔记的关联备忘录'))).toBe(true);
    });
    expect(M.activeScene).toBe('全部');
  });
});

describe('memo2-func #1 / #6 / #8 / #14 + 呈报#1/#2：composer 与编辑器提交链', () => {
  it('T7（A5）：composer 读「新条目默认优先级」设置（此前恒 minor）', async () => {
    const { app, vault } = seed([item({ id: 'a' })], { memoDefaultPriority: 'important' });
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-composer-input]')).toBeTruthy());
    const input = document.querySelector('[data-memo-composer-input]') as HTMLInputElement;
    input.value = '重要优先的快速录入';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get(PATH)!);
      expect(raw.find((r: any) => r.title === '重要优先的快速录入').priority).toBe('important');
    });
  });

  it('M2-2：移动端 composer 回车 = 打开创建弹窗带草稿（不直落盘）；占位符分形态', async () => {
    MockPlatform.isMobile = true;
    const { app, vault } = seed([item({ id: 'a' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-composer-input]')).toBeTruthy());
    const input = document.querySelector('[data-memo-composer-input]') as HTMLInputElement;
    expect(input.placeholder).toContain('点「添加」'); // 占位符不再许诺 Enter 保存
    input.value = '移动端回车草稿';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    expect(JSON.parse(vault.files.get(PATH)!).length).toBe(1); // 未落盘
    expect((document.querySelector('.bz-memo-editor textarea') as HTMLTextAreaElement).value).toBe('移动端回车草稿');
  });

  it('func#8：composer 输入 isComposing=true 的回车不提交（IME 组词确认）', async () => {
    const { app, vault } = seed([item({ id: 'a' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-composer-input]')).toBeTruthy());
    const input = document.querySelector('[data-memo-composer-input]') as HTMLInputElement;
    input.value = '组词中的半截';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true } as KeyboardEventInit));
    await new Promise((r) => setTimeout(r, 60));
    expect(JSON.parse(vault.files.get(PATH)!).length).toBe(1); // 未提交
    expect(input.value).toBe('组词中的半截');
  });

  it('M2-1（呈报#2）：编辑器保存进行中二次点击无效——双击只落一条', async () => {
    const { app, vault } = seed([item({ id: 'a' })]);
    const slow = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    vi.spyOn(MemoData, 'addItem').mockImplementation(slow);
    try {
      addMemo(app);
      await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
      const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
      (editor.querySelector('textarea') as HTMLTextAreaElement).value = '双击防重入条目';
      const saveBtn = [...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('添加')) as HTMLElement;
      saveBtn.click();
      saveBtn.click(); // 落盘窗口期内二次点击
      await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeNull());
      expect(slow).toHaveBeenCalledTimes(1); // 双击只走一次 addItem
      const raw = JSON.parse(vault.files.get(PATH)!);
      expect(raw).toHaveLength(1); // 盘上只有种子条目（mock 未写盘），无双条目形态
    } finally {
      (MemoData.addItem as any).mockRestore?.();
    }
  });

  it('M3-11（呈报#1）：编辑器单行框回车即存；正文 Ctrl+Enter 提交；正文纯 Enter 换行不拦', async () => {
    const { app, vault } = seed([item({ id: 'a' })]);
    addMemo(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
    const content = editor.querySelector('textarea') as HTMLTextAreaElement;
    // 正文纯 Enter：不提交（textarea 换行）
    content.value = '正文草稿';
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(document.querySelector('.bz-memo-editor')).toBeTruthy(); // 弹窗还在
    expect(JSON.parse(vault.files.get(PATH)!).length).toBe(1);
    // 正文 Ctrl+Enter：提交
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(JSON.parse(vault.files.get(PATH)!).some((r: any) => r.title === '正文草稿')).toBe(true);
    });
    expect(document.querySelector('.bz-memo-editor')).toBeNull();

    // 单行框回车：新建第二条，聚焦场景弹窗的单行输入不可行（编辑器无独立单行框）——
    // 以剪藏标题框验证：切剪藏场景后标题框回车即存
    addMemo(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    const editor2 = document.querySelector('.bz-memo-editor') as HTMLElement;
    (editor2.querySelector('textarea') as HTMLTextAreaElement).value = '单行回车提交条目';
    const clipBtn = [...editor2.querySelectorAll('.bz-choice-btn')].find((b) => b.textContent === '剪藏') as HTMLElement;
    clipBtn.click();
    const titleInput = editor2.querySelectorAll('.bz-memo-extra')[0].querySelector('input') as HTMLInputElement;
    titleInput.value = '剪藏标题';
    titleInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get(PATH)!);
      const hit = raw.find((r: any) => r.title === '剪藏标题');
      expect(hit).toBeTruthy();
    });
  });

  it('旧-3 收编：添加场景弹窗 bindFormSubmit 回车保存 + Escape 走 escManager 关闭', async () => {
    const { app, settings, saveSpy } = seed([item({ id: 'a' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-addscene]')).toBeTruthy());
    (document.querySelector('[data-memo-addscene]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-addscene')).toBeTruthy());
    const wrap = document.querySelector('.bz-memo-addscene') as HTMLElement;
    const input = wrap.querySelector('.bz-input') as HTMLInputElement;
    // isComposing 回车不提交
    input.value = '键盘场景';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true } as KeyboardEventInit));
    await new Promise((r) => setTimeout(r, 40));
    expect(saveSpy).not.toHaveBeenCalled();
    // 普通回车（keypress 路径）提交
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(saveSpy).toHaveBeenCalled());
    expect(settings.memoScenarios).toContain('键盘场景');
    // 再开一个：Escape 经 escManager 关闭（手写 Escape 已删）
    (document.querySelector('[data-memo-addscene]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-addscene')).toBeTruthy());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-memo-addscene')).toBeNull();
  });
});
