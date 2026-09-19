/**
 * memo 弹窗族修复批 A 回归（review-deep memo 五报告拍板条目，防撞并行代理独立命名）：
 *  1 脏表单拦截（一致#1/issue 144 通病 3）  2 anchorDay 未触碰门控（M1）
 *  3 编辑器保存防重入（M2-1）              4 bindFormSubmit 三弹窗接入（A4）
 *  5 清除链接出口（M8）                    6 场景两段写补偿（M12）
 *  7 移动聚焦分流（M3-4）
 *  9 截止快捷档 chip（效率#3）             10 场景 hint 文案（一致#9）
 *  11 placeholder 常量 + dataset 状态位（一致#10）
 *  12 core uiModal 存活登记表 closeAllModals（M13/A1，全域收口）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, openEditor } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';
import { closeAllModals } from '../../src/core/ui/modal';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  memoAutoArchive: true,
  cinemaFolderPath: '我的/影视',
};

function item(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'a',
    title: '待编辑条目',
    scene: '学习',
    priority: 'minor',
    created: '2026-09-01 10:00:00',
    completed: null,
    due: null,
    ...extra,
  };
}

function seed(items: Record<string, unknown>[], settingsOverride: Record<string, unknown> = {}): {
  vault: MockVault; app: ReturnType<typeof mockAppWithVault>; settings: any; saveSpy: ReturnType<typeof vi.fn>;
} {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings: any = { ...SETTINGS, ...settingsOverride };
  const saveSpy = vi.fn(async () => {});
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(saveSpy);
  MemoData.init(settings);
  return { vault, app, settings, saveSpy };
}

/** 开面板 + 等数据装载（openEditor 依赖 M.items 就绪） */
async function openPanelAndWait(app: ReturnType<typeof mockAppWithVault>): Promise<void> {
  openMemoPanel(app);
  await vi.waitFor(() => {
    expect(M.items.length).toBeGreaterThan(0);
  });
}

/** 编辑器弹窗骨架（.bz-memo-editor 挂在 uiModal 的 .bz-overlay-popup 下） */
function editorEl(): HTMLElement {
  return document.querySelector('.bz-memo-editor') as HTMLElement;
}
function editorTextarea(): HTMLTextAreaElement {
  return editorEl().querySelector('textarea') as HTMLTextAreaElement;
}
function saveBtnEl(): HTMLElement {
  return editorEl().querySelector('.bz-memo-form-actions .bz-btn--primary') as HTMLElement;
}
/** 在浮层菜单里按文案点菜单项 */
function clickMenuItem(label: string): void {
  const hit = ([...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[])
    .find((b) => b.querySelector('.bz-item-menu-label')?.textContent === label);
  expect(hit, `菜单项「${label}」应存在`).toBeTruthy();
  (hit as HTMLElement).click();
}

describe('memo 弹窗族修复批 A', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    vi.restoreAllMocks(); // 防 spy 泄漏毒化后续用例（mock 掉 updateItem 会挂起整条写链）
    closeMemoPanel();
    closeAllModals(); // 弹窗登记表收口，防用例间遮罩残留串场
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  // ---------- #12 core uiModal 存活登记表 ----------

  it('closeAllModals：开编辑弹窗 → 调用 → body 无 .bz-overlay-mask；重复调用幂等', async () => {
    const { app } = seed([item()]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    expect(document.querySelector('.bz-overlay-mask')).toBeTruthy();
    closeAllModals();
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
    closeAllModals(); // 幂等：已清空再调不抛错不复活
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
  });

  // ---------- #1 编辑弹窗脏表单拦截 ----------

  it('脏表单拦截：改动内容后点遮罩 → confirmDiscard 拦截，点「放弃」才关', async () => {
    const { app } = seed([item()]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    editorTextarea().value = '改过的内容';
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy();
    });
    expect(editorEl()).toBeTruthy(); // 弹窗未被直接关掉（拦截生效）
    // 放弃 = 确认框安全位对侧（ok 位是「继续编辑」）
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await vi.waitFor(() => expect(editorEl()).toBeFalsy());
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
  });

  it('未脏直收：开壳未动点遮罩直接关，不弹确认；桌面开壳聚焦内容框', async () => {
    const { app } = seed([item()]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    expect(document.activeElement).toBe(editorTextarea()); // M3-4 桌面侧：强制聚焦内容框
    (document.querySelector('.bz-overlay-mask') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editorEl()).toBeFalsy();
    expect(document.getElementById('__shared_confirm_popup__')).toBeFalsy();
  });

  // ---------- #2 anchorDay 未触碰门控（M1） ----------

  it('M1：monthly anchorDay 条目只改标题保存，recur 整体保留（anchorDay 不剥）', async () => {
    const { vault, app } = seed([
      item({ id: 'm1', title: '旧标题', recur: { kind: 'monthly', anchorDay: 31 }, due: '2026-02-28 09:00:00' }),
    ]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    editorTextarea().value = '新标题';
    saveBtnEl().click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.id === 'm1').title).toBe('新标题');
    });
    const recur = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!).find((r: any) => r.id === 'm1').recur;
    expect(recur).toEqual({ kind: 'monthly', anchorDay: 31 });
  });

  it('M1 门控不误伤主动改期：点了「每周」再保存按所选落盘（无 anchorDay 残留）', async () => {
    const { vault, app } = seed([
      item({ id: 'm2', title: '条目', recur: { kind: 'monthly', anchorDay: 31 } }),
    ]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    const weekly = ([...editorEl().querySelectorAll('.bz-choice-btn')] as HTMLElement[])
      .find((b) => b.textContent?.trim() === '每周');
    expect(weekly).toBeTruthy();
    (weekly as HTMLElement).click();
    saveBtnEl().click();
    await vi.waitFor(() => {
      const recur = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!).find((r: any) => r.id === 'm2').recur;
      expect(recur).toEqual({ kind: 'weekly' });
    });
  });

  // ---------- #3 编辑器保存防重入（M2-1） ----------

  it('保存防重入：落盘窗口期第二次点击被忽略（updateItem 仅一次），finally 复位按钮', async () => {
    const { app } = seed([item()]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const spy = vi.spyOn(MemoData, 'updateItem').mockImplementation(() => gate);
    editorTextarea().value = '只此一笔';
    const btn = saveBtnEl() as HTMLButtonElement; // 先持引用：保存成功弹窗收起后按钮已脱离 DOM
    btn.click(); // 按钮提交：落盘窗口期按钮进入「保存中…」禁用态
    expect(spy).toHaveBeenCalledTimes(1);
    expect(btn.disabled).toBe(true);
    // 窗口期回车再提交（bindFormSubmit 直调 doSave，绕过按钮禁用）：busy 旗标兜底防双条目
    const popup = editorEl().closest('.bz-overlay-popup') as HTMLElement;
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(spy).toHaveBeenCalledTimes(1); // 仍是一次
    release();
    // updateItem 被 mock（真实写盘被旁路），落盘断言改为 UI 侧：保存成功 → 弹窗收起 + 按钮复位
    await vi.waitFor(() => {
      expect(editorEl()).toBeFalsy();
    });
    expect(btn.disabled).toBe(false);
  });

  // ---------- #4 bindFormSubmit 三弹窗接入（A4） ----------

  it('添加场景弹窗：纯 Enter 经基元提交（手写 keydown 已退役）', async () => {
    const { app, settings, saveSpy } = seed([item()], { memoScenarios: '剪藏,工作,学习,生活,代码,公开课' });
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-addscene]')).toBeTruthy());
    (document.querySelector('[data-memo-addscene]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-addscene')).toBeTruthy());
    const wrap = document.querySelector('.bz-memo-addscene') as HTMLElement;
    const input = wrap.querySelector('.bz-input') as HTMLInputElement;
    input.value = '健身';
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(saveSpy).toHaveBeenCalled());
    expect(settings.memoScenarios).toContain('健身');
  });

  it('重命名场景弹窗：纯 Enter 经基元提交', async () => {
    const { app } = seed([
      item({ id: 'g', title: '副业条目', scene: '副业' }),
    ], { memoScenarios: '剪藏,工作,学习,生活,代码,公开课,副业' });
    await openPanelAndWait(app);
    const navBtn = document.querySelector('[data-memo-nav] [data-memo-scene="副业"]') as HTMLElement;
    navBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    clickMenuItem('重命名');
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-addscene')).toBeTruthy());
    const wrap = document.querySelector('.bz-memo-addscene') as HTMLElement;
    const input = wrap.querySelector('.bz-input') as HTMLInputElement;
    input.value = '兼职';
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    // 提交成功：弹窗收起 + 条目 scene 批量迁移（refresh 重载后 M.items 可见）
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-addscene')).toBeFalsy();
    });
    await vi.waitFor(() => {
      expect(M.items.find((i) => i.id === 'g')?.scene).toBe('兼职');
    });
  });

  it('编辑器：Ctrl+Enter 经 keydown 段提交保存', async () => {
    const { vault, app } = seed([item()]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    editorTextarea().value = '快捷键落盘';
    const popup = editorEl().closest('.bz-overlay-popup') as HTMLElement;
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.id === 'a').title).toBe('快捷键落盘');
    });
  });

  // ---------- #5 清除链接出口（M8） ----------

  it('M8：编辑带 url 条目出现「清除链接」钮，点击保存后 url 落 null', async () => {
    const { vault, app } = seed([item({ url: 'https://example.com/x' })]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    const linkBtn = ([...editorEl().querySelectorAll('.bz-btn')] as HTMLElement[])
      .find((b) => b.textContent?.includes('清除链接'));
    expect(linkBtn).toBeTruthy();
    editorTextarea().value = '正文没带链接';
    (linkBtn as HTMLElement).click();
    saveBtnEl().click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.id === 'a').title).toBe('正文没带链接');
    });
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!).find((r: any) => r.id === 'a');
    expect(saved.url).toBeNull(); // 显式哨兵：清除出口生效
  });

  it('M8：不点清除钮保存，原 url 保留（剪藏兜底语义不破坏）', async () => {
    const { vault, app } = seed([item({ url: 'https://example.com/x' })]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    editorTextarea().value = '只改标题';
    saveBtnEl().click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.id === 'a').title).toBe('只改标题');
    });
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!).find((r: any) => r.id === 'a');
    expect(saved.url).toBe('https://example.com/x');
  });

  // ---------- #6 场景重命名两段写补偿（M12） ----------

  it('M12：重命名第二段设置串写盘失败 → 条目 scene 反向迁回原场景', async () => {
    const { vault, app } = seed([
      item({ id: 'g', title: '副业条目', scene: '副业' }),
    ], { memoScenarios: '剪藏,工作,学习,生活,代码,公开课,副业' });
    await openPanelAndWait(app);
    setSettingsSaver(vi.fn(async () => { throw new Error('disk full'); })); // 第二段写盘必败
    const navBtn = document.querySelector('[data-memo-nav] [data-memo-scene="副业"]') as HTMLElement;
    navBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    clickMenuItem('重命名');
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-addscene')).toBeTruthy());
    const wrap = document.querySelector('.bz-memo-addscene') as HTMLElement;
    const input = wrap.querySelector('.bz-input') as HTMLInputElement;
    input.value = '兼职';
    (wrap.querySelector('.bz-btn--primary') as HTMLElement).click();
    // 补偿生效：条目场景回到「副业」，不再挂列表外场景
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.id === 'g').scene).toBe('副业');
    });
  });

  it('M12：删除场景第二段写盘失败 → 已迁走条目反向迁回原场景', async () => {
    const { vault, app } = seed([
      item({ id: 'g', title: '副业条目', scene: '副业' }),
    ], { memoScenarios: '剪藏,工作,学习,生活,代码,公开课,副业', memoDefaultScene: '工作' });
    await openPanelAndWait(app);
    setSettingsSaver(vi.fn(async () => { throw new Error('disk full'); }));
    const navBtn = document.querySelector('[data-memo-nav] [data-memo-scene="副业"]') as HTMLElement;
    navBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    clickMenuItem('删除场景');
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click(); // 确认删除
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.id === 'g').scene).toBe('副业'); // 补偿迁回
    });
  });

  // ---------- #7 移动聚焦分流（M3-4） ----------

  it('M3-4：移动端打开编辑弹窗不强制聚焦内容框（防软键盘遮挡）', async () => {
    const { app } = seed([item()]);
    await openPanelAndWait(app);
    MockPlatform.isMobile = true;
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    expect(document.activeElement).not.toBe(editorTextarea());
  });

  // ---------- #9 截止快捷档 chip（效率#3） ----------

  it('效率#3：快捷 chip 默认档「今天 18:00 / 明天 09:00」一键填入并带出清除钮', async () => {
    const { app } = seed([item()]);
    await openPanelAndWait(app);
    openEditor(null);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    const chips = [...editorEl().querySelectorAll('.bz-memo-due-quick .bz-btn')] as HTMLElement[];
    expect(chips.map((b) => b.textContent?.trim())).toEqual(['今天 18:00', '明天 09:00']);
    chips[1].click();
    const dueInput = editorEl().querySelector('.bz-memo-due-row input') as HTMLInputElement;
    expect(dueInput.value).toBe(`${moment().add(1, 'day').format('YYYY-MM-DD')}T09:00`);
    const clearBtn = editorEl().querySelector('.bz-memo-due-row .bz-icon-btn') as HTMLElement;
    expect(clearBtn.style.display).toBe('inline-flex'); // 填值后清除钮带出
  });

  it('效率#3：编辑条目原时刻沿用（延后保时刻，与数据层链式同语义）', async () => {
    const { app } = seed([item({ due: '2026-01-01 21:30:00' })]);
    await openPanelAndWait(app);
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    const chips = [...editorEl().querySelectorAll('.bz-memo-due-quick .bz-btn')] as HTMLElement[];
    expect(chips.map((b) => b.textContent?.trim())).toEqual(['今天 21:30', '明天 21:30']);
    chips[0].click();
    const dueInput = editorEl().querySelector('.bz-memo-due-row input') as HTMLInputElement;
    expect(dueInput.value).toBe(`${moment().format('YYYY-MM-DD')}T21:30`);
  });

  // ---------- #10 场景 hint 文案（一致#9） ----------

  it('一致#9：添加场景 hint 不再「与备忘录共用」，改「与设置面板同键」', async () => {
    const { app } = seed([item()]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-addscene]')).toBeTruthy());
    (document.querySelector('[data-memo-addscene]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-addscene')).toBeTruthy());
    const hint = document.querySelector('.bz-memo-addscene-hint') as HTMLElement;
    expect(hint.textContent).toContain('与设置面板同键');
    expect(hint.textContent).not.toContain('与备忘录共用');
  });

  // ---------- #11 placeholder 常量 + dataset 状态位（一致#10） ----------

  it('一致#10：占位串全角三点；dataset.clipPrefilled 兜底取代字面串比对', async () => {
    const { vault, app } = seed([item()]);
    await openPanelAndWait(app);
    openEditor(null);
    await vi.waitFor(() => expect(editorEl()).toBeTruthy());
    const textarea = editorTextarea();
    expect(textarea.placeholder).toBe('输入备忘录内容…'); // 半角三点退役
    // 模拟剪藏预填态（tryEditorClipPrefill 落下的状态位 + 占位符即内容）
    textarea.dataset.clipPrefilled = '1';
    textarea.placeholder = 'https://example.com/page';
    saveBtnEl().click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.length).toBe(2);
    });
    const created = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)[0]; // addItem unshift 新条目在首位
    expect(created.title).toBe('https://example.com/page'); // 兜底取走预填 URL
  });
});
