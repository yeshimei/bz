/**
 * 统一路径选择器 UI 层测试（ticket 128，ADR-0061；ticket 133 增补）：弹窗结构/单选高亮提交/多选勾选清空/
 * 搜索过滤（含恰好相等显示全量）/库根目录/遮罩与 ESC 取消/已选 chips ✕ 移除/设置行助手
 * （空态紧凑按钮 + 已选态 chip 点击重开选择器）/移动端两行式挂类（markSettingSplitRows）/
 * 列表排序（已选置顶 → 库根 → 其余整体反转）。jsdom 环境。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, Setting } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import {
  openPathPicker,
  closePathPicker,
  renderPathChips,
  renderPathSettingRow,
  PATH_PICKER_Z_MASK,
} from '../../src/core/path-picker';
import { markSettingSplitRows } from '../../src/core/settings-modal';

function makeAppAndSeed(files: string[]): any {
  const vault = new MockVault();
  for (const f of files) void vault.create(f, 'x');
  const app = mockAppWithVault(vault) as any;
  setApp(app as any);
  return app;
}

async function openAndWait(opts: Parameters<typeof openPathPicker>[0]) {
  openPathPicker(opts);
  const popup = document.getElementById('bz-path-picker-popup')!;
  expect(popup).toBeTruthy();
  // 等目录聚合完成（data-ready：adapter 补齐合并后挂载）——比「等首行」更稳：
  // 快速首渲染下 rows 立即出现，但空目录/点前缀目录要等补齐
  await vi.waitFor(() => expect(popup.dataset.ready).toBe('1'));
  await vi.waitFor(() =>
    expect(popup.querySelectorAll('.bz-path-picker-row').length).toBeGreaterThan(0)
  );
  return popup;
}

function pickerMask(): HTMLElement | null {
  return document.getElementById('bz-path-picker-mask');
}

const ROW_SEL = '.bz-path-picker-row';

beforeEach(() => {
  resetObsidianMocks();
  closePathPicker();
  document.body.innerHTML = '';
});

afterEach(() => {
  closePathPicker();
});

describe('openPathPicker 弹窗结构与层级', () => {
  it('卡片结构：标题头 + 搜索框 + 目录列表 + 底部；无关闭按钮；z-index 11200/11201（companion 档）', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md']);
    const popup = await openAndWait({ title: '选择测试目录', mode: 'multi', selected: [], onConfirm: () => {} });
    expect(popup.querySelector('.bz-path-picker-title')!.textContent).toBe('选择测试目录');
    expect(popup.querySelector('.bz-path-picker-search')).toBeTruthy();
    expect(popup.querySelectorAll(ROW_SEL).length).toBeGreaterThan(0);
    expect(popup.querySelector('.bz-path-picker-foot')).toBeTruthy();
    // 主窗口规范：无右上角关闭按钮
    expect(popup.querySelector('.bz-win-close')).toBeNull();
    expect(pickerMask()!.style.zIndex).toBe(String(PATH_PICKER_Z_MASK));
    expect(popup.style.zIndex).toBe(String(PATH_PICKER_Z_MASK + 1));
  });

  it('数据源 = vault 全部文件夹：含库根（（库根目录））与排序', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md', '归档/b.md']);
    const popup = await openAndWait({ mode: 'multi', selected: [], onConfirm: () => {} });
    const names = [...popup.querySelectorAll(`${ROW_SEL} .bz-path-picker-name`)].map((el) => el.textContent);
    expect(names[0]).toBe('（库根目录）');
    expect(names).toContain('卡片盒');
    expect(names).toContain('我的');
    expect(names).toContain('我的/日记');
    expect(names).toContain('归档');
  });
});

describe('单选：点选高亮 + 确定提交；初始已选高亮', () => {
  it('点选行高亮，确定回调 [path]；再点另一行替换选择', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md']);
    let picked: string[] | null = null;
    const popup = await openAndWait({ mode: 'single', selected: [], onConfirm: (l) => (picked = l) });
    const rowOf = (path: string) =>
      [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].find((r) => r.dataset.path === path)!;
    rowOf('卡片盒').click();
    // 点击后列表重绘，重新取值断言高亮
    expect(rowOf('卡片盒').classList.contains('bz-path-picker-row--sel')).toBe(true);
    // 点另一行 → 高亮替换（单选）
    rowOf('我的').click();
    expect(rowOf('卡片盒').classList.contains('bz-path-picker-row--sel')).toBe(false);
    expect(rowOf('我的').classList.contains('bz-path-picker-row--sel')).toBe(true);
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
    expect(picked).toEqual(['我的']);
    expect(pickerMask()).toBeNull();
  });

  it('初始 selected 高亮 + selinfo 显示已选项', async () => {
    makeAppAndSeed(['卡片盒/A.md']);
    const popup = await openAndWait({ mode: 'single', selected: ['卡片盒'], onConfirm: () => {} });
    expect(popup.querySelector('.bz-path-picker-selinfo')!.textContent).toContain('卡片盒');
    const row = [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].find((r) => r.dataset.path === '卡片盒')!;
    expect(row.classList.contains('bz-path-picker-row--sel')).toBe(true);
  });

  it('库根目录可选：点（库根目录）确定 → [""]（附件搬移根目录语义）', async () => {
    makeAppAndSeed(['a.md']);
    let picked: string[] | null = null;
    const popup = await openAndWait({ mode: 'single', selected: [], onConfirm: (l) => (picked = l) });
    const rootRow = [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].find((r) => r.dataset.path === '')!;
    expect(rootRow.querySelector('.bz-path-picker-name')!.textContent).toBe('（库根目录）');
    rootRow.click();
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
    expect(picked).toEqual(['']);
  });

  it('不点选直接确定 → []（未选择）', async () => {
    makeAppAndSeed(['卡片盒/A.md']);
    let picked: string[] | null = null;
    const popup = await openAndWait({ mode: 'single', selected: [], onConfirm: (l) => (picked = l) });
    expect(popup.querySelector('.bz-path-picker-selinfo')!.textContent).toBe('未选择');
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
    expect(picked).toEqual([]);
  });
});

describe('多选：勾选累加 + 清空 + 全量回调', () => {
  it('点击切换勾选；selinfo 计数；确定回调全量，顺序 = 点击顺序', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md']);
    let picked: string[] | null = null;
    const popup = await openAndWait({ mode: 'multi', selected: [], onConfirm: (l) => (picked = l) });
    const clickRow = (path: string) => {
      const r = [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].find((x) => x.dataset.path === path)!;
      r.click();
    };
    clickRow('我的');
    clickRow('卡片盒');
    expect(popup.querySelector('.bz-path-picker-selinfo')!.textContent).toBe('已选 2 项');
    // 再点取消
    clickRow('我的');
    expect(popup.querySelector('.bz-path-picker-selinfo')!.textContent).toBe('已选 1 项');
    clickRow('我的');
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
    // 多选 Set 按点击次序迭代：卡片盒先入集，我的 移除后重加落尾
    expect(picked).toEqual(['卡片盒', '我的']);
  });

  it('清空按钮（仅多选）清空选择 → 确定回调 []', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md']);
    let picked: string[] | null = null;
    const popup = await openAndWait({ mode: 'multi', selected: ['卡片盒'], onConfirm: (l) => (picked = l) });
    const clearBtn = [...popup.querySelectorAll('.bz-path-picker-btn')].find((b) => b.textContent === '清空') as HTMLElement;
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
    expect(popup.querySelector('.bz-path-picker-selinfo')!.textContent).toBe('已选 0 项');
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
    expect(picked).toEqual([]);
  });

  it('单选模式无清空按钮', async () => {
    makeAppAndSeed(['卡片盒/A.md']);
    const popup = await openAndWait({ mode: 'single', selected: [], onConfirm: () => {} });
    expect([...popup.querySelectorAll('.bz-path-picker-btn')].some((b) => b.textContent === '清空')).toBe(false);
  });
});

describe('搜索即时过滤（包含匹配；恰好相等显示全量）', () => {
  it('输入过滤只留包含匹配行；输入恰好等于某目录时例外显示全量', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md', '归档/b.md']);
    const popup = await openAndWait({ mode: 'multi', selected: [], onConfirm: () => {} });
    const search = popup.querySelector('.bz-path-picker-search') as HTMLInputElement;
    const visible = () =>
      [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].map((r) => r.dataset.path);
    // 部分命中（非恰好相等）：只留包含匹配行
    search.value = '档';
    search.dispatchEvent(new Event('input'));
    expect(visible()).toEqual(['归档']);
    search.value = '卡';
    search.dispatchEvent(new Event('input'));
    expect(visible()).toEqual(['卡片盒']);
    // 恰好等于某目录（'我的'）→ 显示完整列表（ticket 133 排序：无已选 → 库根 → 其余整体反转）
    search.value = '我的';
    search.dispatchEvent(new Event('input'));
    expect(visible()).toEqual(['', '我的/日记', '我的', '归档', '卡片盒']);
    // 清空恢复全量
    search.value = '';
    search.dispatchEvent(new Event('input'));
    expect(visible()).toContain('归档');
  });

  it('输入恰好等于某目录 → 显示完整列表（预填/精确命中不把列表滤掉）', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md', '归档/b.md']);
    const popup = await openAndWait({ mode: 'multi', selected: ['我的'], onConfirm: () => {} });
    const search = popup.querySelector('.bz-path-picker-search') as HTMLInputElement;
    search.value = '我的';
    search.dispatchEvent(new Event('input'));
    // 完整列表（ticket 133 排序：已选「我的」置顶 → 库根 → 其余反转）
    const visible = [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].map((r) => r.dataset.path);
    expect(visible).toEqual(['我的', '', '我的/日记', '归档', '卡片盒']);
  });

  it('无匹配 → 空态「没有匹配的目录」', async () => {
    makeAppAndSeed(['卡片盒/A.md']);
    const popup = await openAndWait({ mode: 'multi', selected: [], onConfirm: () => {} });
    const search = popup.querySelector('.bz-path-picker-search') as HTMLInputElement;
    search.value = '不存在的目录xyz';
    search.dispatchEvent(new Event('input'));
    expect(popup.querySelector('.bz-path-picker-row')).toBeNull();
    expect(popup.querySelector('.bz-path-picker-empty')!.textContent).toBe('没有匹配的目录');
  });
});

describe('取消语义：遮罩点击 / ESC 关闭且不回调', () => {
  it('遮罩点击关闭，onConfirm 不被调用；二次打开幂等（旧弹窗先关）', async () => {
    makeAppAndSeed(['卡片盒/A.md']);
    const onConfirm = vi.fn();
    await openAndWait({ mode: 'single', selected: [], onConfirm });
    pickerMask()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(pickerMask()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ESC 关闭且不回调（esc-manager 层级）', async () => {
    makeAppAndSeed(['卡片盒/A.md']);
    const onConfirm = vi.fn();
    await openAndWait({ mode: 'single', selected: [], onConfirm });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(pickerMask()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('renderPathChips：已选 chips 渲染与 ✕ 移除', () => {
  it('渲染逐条 chips（✕ 带 aria-label）；空列表显示空态', () => {
    const wrap = document.createElement('div');
    const onChange = vi.fn();
    renderPathChips(wrap, ['卡片盒', '我的'], onChange);
    const chips = [...wrap.querySelectorAll('.bz-path-picker-chip')];
    expect(chips.map((c) => c.querySelector('.bz-path-picker-chip-name')!.textContent)).toEqual(['卡片盒', '我的']);
    (chips[0].querySelector('.bz-path-picker-chip-x') as HTMLButtonElement).click();
    expect(onChange).toHaveBeenCalledWith(['我的']);

    renderPathChips(wrap, [], onChange);
    expect(wrap.querySelector('.bz-path-picker-chips-empty')).toBeTruthy();
  });

  it('onChipClick 提供时 chip 文本可点回调；✕ 不触发 onChipClick；emptyText 传空串不渲染空态占位', () => {
    const wrap = document.createElement('div');
    const onChange = vi.fn();
    const onChipClick = vi.fn();
    renderPathChips(wrap, ['卡片盒'], onChange, '未选择', onChipClick);
    const chip = wrap.querySelector('.bz-path-picker-chip') as HTMLElement;
    expect(chip.classList.contains('bz-path-picker-chip--click')).toBe(true);
    (chip.querySelector('.bz-path-picker-chip-name') as HTMLElement).click();
    expect(onChipClick).toHaveBeenCalledWith('卡片盒');
    (chip.querySelector('.bz-path-picker-chip-x') as HTMLButtonElement).click();
    expect(onChange).toHaveBeenCalledWith([]);
    expect(onChipClick).toHaveBeenCalledTimes(1); // ✕ 不冒泡触发重开
    renderPathChips(wrap, [], onChange, '');
    expect(wrap.querySelector('.bz-path-picker-chips-empty')).toBeNull();
  });
});

describe('renderPathSettingRow：设置行助手（chips + 选择按钮，无手输输入框）', () => {
  it('单值行：已选态 chips 展示当前值（按钮移出 DOM）；✕ 清除回空态（按钮恢复、无灰字）；点按钮开选择器确定后回传', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md']);
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const onChange = vi.fn();
    const { settingEl } = renderPathSettingRow({
      parent,
      name: '剪藏目录',
      desc: '存放剪藏文章的文件夹',
      mode: 'single',
      value: '卡片盒',
      onChange,
    });
    expect(settingEl.dataset.name).toBe('剪藏目录');
    // 行挂移动端单行兜底类（ticket 133 修订：CSS 层保证同行，不依赖子元素计数）
    expect(settingEl.classList.contains('bz-path-picker-setting-row')).toBe(true);
    // chips 在控件区内；已选态「选择…」按钮移出 DOM（控件区仅 chips，chip 内 ✕ 按钮不算）
    const control = settingEl.querySelector('.setting-item-control')!;
    expect(control.querySelectorAll('.bz-path-picker-chip-name').length).toBe(1);
    expect(control.querySelector('.bz-path-picker-btn--slim')).toBeNull();
    expect(control.querySelector('.bz-path-picker-chips--setting')).toBeTruthy();
    // chips ✕ 清除 → onChange [] 并恢复空态：按钮回来、无「未选择」灰字（ticket 133）
    (control.querySelector('.bz-path-picker-chip-x') as HTMLButtonElement).click();
    expect(onChange).toHaveBeenCalledWith([]);
    expect(control.querySelector('.bz-path-picker-chips-empty')).toBeNull();
    expect(control.querySelector('.bz-path-picker-btn--slim')).toBeTruthy();

    // 点按钮 → 打开选择器（单选框初始已清空）；选目录后确定 → onChange(['我的/日记'])
    ((settingEl as any).__setting.controls.find((c: any) => typeof c.trigger === 'function') as any).trigger();
    const popup = document.getElementById('bz-path-picker-popup')!;
    await vi.waitFor(() => expect(popup.querySelectorAll(ROW_SEL).length).toBeGreaterThan(0));
    const row = [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].find((r) => r.dataset.path === '我的/日记')!;
    row.click();
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
    expect(onChange).toHaveBeenLastCalledWith(['我的/日记']);
    expect(control.querySelector('.bz-path-picker-chip-name')!.textContent).toBe('我的/日记');
    // 再次已选态：「选择…」按钮移出 DOM
    expect(control.querySelector('.bz-path-picker-btn--slim')).toBeNull();
  });

  it('单值行：chip 文本点击重开选择器（初始已选高亮 + 置顶；✕ 不触发重开）', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md']);
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const { settingEl } = renderPathSettingRow({
      parent,
      name: '剪藏目录',
      mode: 'single',
      value: '卡片盒',
      onChange: () => {},
    });
    const control = settingEl.querySelector('.setting-item-control')!;
    const nameEl = control.querySelector('.bz-path-picker-chip-name') as HTMLElement;
    expect(control.querySelector('.bz-path-picker-chip')!.classList.contains('bz-path-picker-chip--click')).toBe(true);
    nameEl.click();
    const popup = document.getElementById('bz-path-picker-popup')!;
    await vi.waitFor(() => expect(popup.querySelectorAll(ROW_SEL).length).toBeGreaterThan(0));
    // 初始已选「卡片盒」置顶第一行 + 高亮
    const paths = [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].map((r) => r.dataset.path);
    expect(paths[0]).toBe('卡片盒');
    const selRow = [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].find((r) => r.dataset.path === '卡片盒')!;
    expect(selRow.classList.contains('bz-path-picker-row--sel')).toBe(true);
    closePathPicker();
    // ✕ 点击不重开选择器（事件不冒泡到文本点击）
    (control.querySelector('.bz-path-picker-chip-x') as HTMLButtonElement).click();
    expect(document.getElementById('bz-path-picker-popup')).toBeNull();
  });

  it('多值行：chips 逐条；✕ 移除回传剩余列表', async () => {
    makeAppAndSeed([]);
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const onChange = vi.fn();
    renderPathSettingRow({
      parent,
      name: '白名单目录',
      mode: 'multi',
      value: ['卡片盒', '我的'],
      buttonText: '📁 选择',
      onChange,
    });
    const control = parent.querySelector('.setting-item-control')!;
    const xs = [...control.querySelectorAll('.bz-path-picker-chip-x')];
    expect(xs.length).toBe(2);
    expect(control.querySelector('.bz-path-picker-btn--slim')).toBeNull(); // 已选态：「添加…」按钮移出 DOM（ticket 133 多选同套）
    (xs[0] as HTMLButtonElement).click();
    expect(onChange).toHaveBeenCalledWith(['我的']);
  });

  it('多值行按钮文案：添加…（可自定义 buttonText）', () => {
    makeAppAndSeed([]);
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    renderPathSettingRow({ parent, name: '监听目录', mode: 'multi', value: [], onChange: () => {} });
    const btn = parent.querySelector('.setting-item-control button') as HTMLButtonElement;
    expect(btn.textContent).toBe('添加…');
  });
});

describe('ticket 133 列表排序：已选置顶（打开时定格）→ 库根 → 其余整体反转', () => {
  it('已选置顶、库根第二梯队、其余反转（中文在前、英文在后）', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md', '归档/b.md', 'books/c.md']);
    const popup = await openAndWait({ mode: 'single', selected: ['归档'], onConfirm: () => {} });
    const paths = [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].map((r) => r.dataset.path);
    // 已选「归档」置顶 → 库根 '' → 其余反转（原码点升序 books/卡片盒/我的/我的/日记 逆排）
    expect(paths).toEqual(['归档', '', '我的/日记', '我的', '卡片盒', 'books']);
  });

  it('点击勾选不重排（仅打开时置顶一次）：勾选后已选行仍在原列表位置', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md', '归档/b.md']);
    const popup = await openAndWait({ mode: 'multi', selected: [], onConfirm: () => {} });
    const paths = () => [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].map((r) => r.dataset.path);
    // 初始：库根 → 反转（我的/日记 我的 归档 卡片盒）
    expect(paths()).toEqual(['', '我的/日记', '我的', '归档', '卡片盒']);
    const rowOf = (p: string) =>
      [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].find((r) => r.dataset.path === p)!;
    rowOf('卡片盒').click(); // 勾选但不应置顶
    expect(paths()).toEqual(['', '我的/日记', '我的', '归档', '卡片盒']);
    expect(paths().indexOf('卡片盒')).toBe(4);
  });

  it('搜索时置顶仅对命中项生效：未命中的已选不出现；命中的已选在过滤结果最前', async () => {
    makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md', '归档/b.md']);
    const popup = await openAndWait({ mode: 'single', selected: ['我的'], onConfirm: () => {} });
    const search = popup.querySelector('.bz-path-picker-search') as HTMLInputElement;
    const visible = () =>
      [...popup.querySelectorAll<HTMLElement>(ROW_SEL)].map((r) => r.dataset.path);
    // 搜「日记」：命中 我的/日记（已选「我的」未命中 → 被滤掉，不出现在顶部）
    search.value = '日记';
    search.dispatchEvent(new Event('input'));
    expect(visible()).toEqual(['我的/日记']);
    // 搜「我的」恰好相等 → 全量列表，已选「我的」仍置顶第一行
    search.value = '我的';
    search.dispatchEvent(new Event('input'));
    expect(visible()[0]).toBe('我的');
    expect(visible()).toContain('');
  });
});

describe('markSettingSplitRows：移动端两行式挂类', () => {
  it('路径设置行（空态/已选态）控件区恒 1 子元素 → 不挂 .bz-setting-split（移动端单行由兜底类保证）', () => {
    const container = document.createElement('div');
    // 已选态：控件区仅 chips 容器
    renderPathSettingRow({ parent: container, name: '目录A', mode: 'single', value: '卡片盒', onChange: () => {} });
    // 空态：控件区仅按钮
    renderPathSettingRow({ parent: container, name: '目录B', mode: 'multi', value: [], onChange: () => {} });
    markSettingSplitRows(container);
    const rows = [...container.querySelectorAll<HTMLElement>('.setting-item')];
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.classList.contains('bz-setting-split')).toBe(false);
      expect(row.classList.contains('bz-path-picker-setting-row')).toBe(true);
    }
  });

  it('控件区 ≥2 子元素 → 挂 .bz-setting-split；单控件行不挂；幂等可重调', () => {
    const container = document.createElement('div');
    // 单控件行（一个按钮）
    const single = new Setting(container).addButton((b) => b.setButtonText('A'));
    // 多控件行（按钮 + chips 容器——模拟统一路径选择器行）
    const multi = new Setting(container).addButton((b) => b.setButtonText('选择…'));
    multi.controlEl.appendChild(document.createElement('div'));
    markSettingSplitRows(container);
    expect(single.settingEl.classList.contains('bz-setting-split')).toBe(false);
    expect(multi.settingEl.classList.contains('bz-setting-split')).toBe(true);
    // 幂等：移除一个子元素后重调 → 摘类
    multi.controlEl.lastChild!.remove();
    markSettingSplitRows(container);
    expect(multi.settingEl.classList.contains('bz-setting-split')).toBe(false);
  });
});

describe('大 vault 性能（ticket 128 性能修复：剪枝 + 快速首渲染 + 渲染上限）', () => {
  it('快速首渲染：adapter 迟迟不响应时，打开即显示文件聚合目录（不等补齐）', () => {
    const app = makeAppAndSeed(['卡片盒/A.md', '我的/日记/a.md']);
    // adapter.list 永不 resolve：模拟大 vault 的慢速递归补齐
    (app.vault as any).adapter = { list: () => new Promise(() => {}) };
    openPathPicker({ mode: 'single', selected: [], onConfirm: () => {} });
    // 同步断言：文件聚合已在打开瞬间渲染，无需等待 adapter
    const popup = document.getElementById('bz-path-picker-popup')!;
    const names = [...popup.querySelectorAll(`${ROW_SEL} .bz-path-picker-name`)].map((el) => el.textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain('卡片盒');
    expect(names).toContain('我的/日记');
  });

  it('环境目录剪枝：node_modules/.obsidian 下的文件不产生可选目录', () => {
    makeAppAndSeed([
      '卡片盒/A.md',
      'CODE/x/node_modules/.store/@img+sharp/README.md',
      '.obsidian/plugins/bz/README.md',
    ]);
    openPathPicker({ mode: 'multi', selected: [], onConfirm: () => {} });
    const popup = document.getElementById('bz-path-picker-popup')!;
    const names = [...popup.querySelectorAll(`${ROW_SEL} .bz-path-picker-name`)].map((el) => el.textContent);
    expect(names).toContain('卡片盒');
    expect(names.some((n) => (n || '').includes('node_modules'))).toBe(false);
    expect(names.some((n) => (n || '').startsWith('.obsidian'))).toBe(false);
  });

  it('渲染上限：目录超过 300 只渲染前 300 行 + 「请输入关键词缩小范围」提示', () => {
    const files: string[] = [];
    for (let i = 0; i < 400; i++) files.push(`目录${String(i).padStart(3, '0')}/a.md`);
    makeAppAndSeed(files);
    openPathPicker({ mode: 'multi', selected: [], onConfirm: () => {} });
    const popup = document.getElementById('bz-path-picker-popup')!;
    // 400 目录（+库根）> 300 上限 → 恰 300 行 + 提示行
    expect(popup.querySelectorAll(ROW_SEL).length).toBe(300);
    const hint = popup.querySelector('.bz-path-picker-list .bz-path-picker-empty');
    expect(hint?.textContent).toContain('请输入关键词缩小范围');
    // 搜索过滤后低于上限 → 提示消失，全部显示（用非完整目录名的词——「恰好相等」语义会显示全量）
    const search = popup.querySelector('.bz-path-picker-search') as HTMLInputElement;
    search.value = '目录39';
    search.dispatchEvent(new Event('input'));
    const names = [...popup.querySelectorAll(`${ROW_SEL} .bz-path-picker-name`)].map((el) => el.textContent);
    // ticket 133 反转排：000→399 码点升序逆排 → 399 在前
    expect(names).toEqual(['目录399', '目录398', '目录397', '目录396', '目录395', '目录394', '目录393', '目录392', '目录391', '目录390']);
    expect(popup.querySelector('.bz-path-picker-list .bz-path-picker-empty')).toBeNull();
  });
});