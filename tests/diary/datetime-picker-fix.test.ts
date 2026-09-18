/**
 * diary 修复批 B 回归：滚轮日期时间控件（datetime-picker）。
 * - D2'：年/月滚轮溢出漂移（1月31日点2月→3月；闰 2/29 切非闰年→3月1日）钳制回归；
 * - 效率#4：「此刻/昨天」常驻 chip、单击立即开滚轮、滚轮内「手输」切换钮、
 *   直开写日记（宿主未注入年份范围）的最早年份探测；
 * - D-UI10：displayArea 键盘可达（tabindex/Enter/Space）、数值项 button 化 + ↑/↓ 步进、
 *   打开聚焦选中项、ESC 关滚轮；
 * - D-UI16：手输聚焦 .keyboard-up 上移档挂到写日记弹窗；
 * - 一致#2/#3/#6：role=dialog、阴影 --dw-shadow-lg 三档、内联 scrollbar 声明已删、
 *   选中项字重 700 + 背景族 token、placeholder 空格。
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { moment } from 'obsidian';
import { setApp } from '../../src/core/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import {
  createDateTimeControl,
  resetDateTimeControl,
  resetDateTimeYearProbe,
  showDateTimePicker,
} from '../../src/diary/ui/datetime-picker';
import { MockVault, mockAppWithVault } from '../mock-vault';

beforeEach(() => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  setApp({ workspace: {} } as any); // 默认无 vault：探测静默回落 1900 默认范围
  resetDateTimeYearProbe();
});

/** 打开滚轮并点「确定」，返回确认回调收到的时刻文本 */
function confirmAfter(dateStr: string, pick: (mask: HTMLElement) => void): string {
  let confirmed = '';
  const mask = showDateTimePicker(moment(dateStr), (m) => {
    confirmed = m.format('YYYY-MM-DD HH:mm');
  });
  pick(mask);
  const okBtn = Array.from(mask.querySelectorAll('button')).find((b) => b.textContent === '确定')!;
  okBtn.click();
  return confirmed;
}

function wheelCols(mask: HTMLElement): NodeListOf<HTMLElement> {
  return mask.querySelectorAll('.diary-datetime-scroll-container');
}

function itemOf(col: Element, value: number): HTMLElement {
  const el = col.querySelector(`.datetime-number-item[data-value="${value}"]`) as HTMLElement;
  expect(el, `列中应存在数值项 ${value}`).toBeTruthy();
  return el;
}

function selectedItem(col: Element): HTMLElement | null {
  return [...col.querySelectorAll<HTMLElement>('.datetime-number-item')].find(
    (el) => el.style.color === 'var(--text-on-accent)'
  ) ?? null;
}

/** 挂载日期时间控件；inPopup=true 时包在 #add-diary-popup 内（D-UI16 的类挂载目标） */
function mountControl(inPopup: boolean): HTMLElement {
  const ctrl = createDateTimeControl();
  const wrapper = document.createElement('div');
  if (inPopup) wrapper.id = 'add-diary-popup';
  wrapper.appendChild(ctrl);
  document.body.appendChild(wrapper);
  return ctrl;
}

describe("D2' 年/月滚轮溢出漂移钳制", () => {
  it('1月31日切2月（平年）→ 停在 2月28日，不漂进3月', () => {
    const out = confirmAfter('2023-01-31 10:00', (mask) => itemOf(wheelCols(mask)[1], 2).click());
    expect(out).toBe('2023-02-28 10:00');
  });

  it('1月31日切2月（闰年）→ 停在 2月29日', () => {
    const out = confirmAfter('2024-01-31 10:00', (mask) => itemOf(wheelCols(mask)[1], 2).click());
    expect(out).toBe('2024-02-29 10:00');
  });

  it('1月31日切4月 → 停在 4月30日（修复前溢出到 5月、天数列读到 5月钳制失效）', () => {
    const out = confirmAfter('2024-01-31 10:00', (mask) => itemOf(wheelCols(mask)[1], 4).click());
    expect(out).toBe('2024-04-30 10:00');
  });

  it('闰日 2024-02-29 切非闰年 2025 → 停在 2025-02-28，不漂成 3月1日', () => {
    const out = confirmAfter('2024-02-29 08:30', (mask) => itemOf(wheelCols(mask)[0], 2025).click());
    expect(out).toBe('2025-02-28 08:30');
  });

  it('闰日 2024-02-29 切 2023（非闰年）→ 2023-02-28；日列收缩到 28 且选中 28', () => {
    let out = '';
    const mask = showDateTimePicker(moment('2024-02-29 08:30'), (m) => {
      out = m.format('YYYY-MM-DD HH:mm');
    });
    itemOf(wheelCols(mask)[0], 2023).click();
    const cols = wheelCols(mask);
    expect(cols[2].querySelectorAll('.datetime-number-item').length).toBe(28);
    expect(selectedItem(cols[2])!.dataset.value).toBe('28');
    (Array.from(mask.querySelectorAll('button')).find((b) => b.textContent === '确定') as HTMLElement).click();
    expect(out).toBe('2023-02-28 08:30');
  });
});

describe('效率#4 补写昨晚路径', () => {
  it('日期行常驻「此刻 / 昨天」chip：昨天 = now 减一天且时刻保留', () => {
    const ctrl = mountControl(true);
    resetDateTimeControl(moment('2020-01-02 03:04', 'YYYY-MM-DD HH:mm', true));
    const chips = [...ctrl.querySelectorAll<HTMLElement>('.dt-quick-chip')];
    expect(chips.map((c) => c.textContent)).toEqual(['此刻', '昨天']);
    chips[1].click();
    const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(hidden.value).toBe(moment().subtract(1, 'day').format('YYYY-MM-DD HH:mm'));
    chips[0].click();
    expect(hidden.value).toBe(moment().format('YYYY-MM-DD HH:mm'));
  });

  it('手输模式下点快捷 chip：先退手输回到显示区，再应用 chip 时刻', () => {
    const ctrl = mountControl(true);
    const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
    display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const manual = ctrl.querySelector('input[placeholder*="YYYY-MM-DD"]') as HTMLInputElement;
    expect(manual.style.display).toBe('block');
    (ctrl.querySelectorAll('.dt-quick-chip')[1] as HTMLElement).click();
    expect(manual.style.display).toBe('none');
    expect(display.style.display).toBe('flex');
    const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(hidden.value).toBe(moment().subtract(1, 'day').format('YYYY-MM-DD HH:mm'));
  });

  it('单击显示区立即开滚轮（原 200ms 延迟已去），滚轮内有「手输」切换钮', () => {
    const ctrl = mountControl(true);
    const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
    display.click();
    const mask = document.getElementById('unified-datetime-picker-mask');
    expect(mask).toBeTruthy(); // 同步打开，无需计时器
    const manualBtn = Array.from(mask!.querySelectorAll('button')).find((b) => b.textContent === '手输');
    expect(manualBtn).toBeTruthy();
    manualBtn!.click();
    expect(mask!.isConnected).toBe(false); // 滚轮收起
    const manual = ctrl.querySelector('input[placeholder*="YYYY-MM-DD"]') as HTMLInputElement;
    expect(manual.style.display).toBe('block'); // 手输框展开
    expect(document.activeElement).toBe(manual); // 且焦点落入（键盘链路闭环）
  });

  it('placeholder 显性提示手输（一致#7：「1 分钟前」带空格）', () => {
    const ctrl = mountControl(true);
    const manual = ctrl.querySelector('input[placeholder*="YYYY-MM-DD"]') as HTMLInputElement;
    expect(manual.placeholder).toBe('YYYY-MM-DD HH:mm 或 1 分钟前');
  });

  it('直开写日记（宿主未注入年份范围）：滚轮年份下限 = 日记数据最早年份（含子目录），非 1900', () => {
    const vault = new MockVault();
    vault.files.set('我的/日记/2601010000.md', 'x');
    vault.files.set('我的/日记/2022/2205011200.md', 'x'); // 子目录递归口径
    vault.files.set('别的目录/2101010000.md', 'x'); // 域外不计入
    vault.files.set('我的/日记/readme.md', 'x'); // 非条目命名不计入
    setApp(mockAppWithVault(vault));
    const ctrl = mountControl(true);
    (ctrl.querySelector('#datetime-display-area') as HTMLElement).click();
    const mask = document.getElementById('unified-datetime-picker-mask')!;
    const yearCol = wheelCols(mask)[0];
    const first = yearCol.querySelector('.datetime-number-item') as HTMLElement;
    expect(first.dataset.value).toBe('2022');
    expect(yearCol.querySelectorAll('.datetime-number-item').length).toBe(
      new Date().getFullYear() + 1 - 2022 + 1
    );
    mask.remove();
  });

  it('无数据/vault 不可用：回落 1900 默认范围；探测会话级缓存一次', () => {
    const ctrl = mountControl(true);
    (ctrl.querySelector('#datetime-display-area') as HTMLElement).click();
    const mask = document.getElementById('unified-datetime-picker-mask')!;
    const first = wheelCols(mask)[0].querySelector('.datetime-number-item') as HTMLElement;
    expect(first.dataset.value).toBe('1900');
    mask.remove();

    // 缓存生效：之后换上带数据的 vault，不重置缓存仍取旧结果
    const vault = new MockVault();
    vault.files.set('我的/日记/0101010000.md', 'x'); // yy=01 → 2001 年
    setApp(mockAppWithVault(vault));
    (ctrl.querySelector('#datetime-display-area') as HTMLElement).click();
    const mask2 = document.getElementById('unified-datetime-picker-mask')!;
    const first2 = wheelCols(mask2)[0].querySelector('.datetime-number-item') as HTMLElement;
    expect(first2.dataset.value).toBe('1900');
    mask2.remove();

    // 重置缓存后重新探测 → 取到新数据最早年份
    resetDateTimeYearProbe();
    (ctrl.querySelector('#datetime-display-area') as HTMLElement).click();
    const mask3 = document.getElementById('unified-datetime-picker-mask')!;
    const first3 = wheelCols(mask3)[0].querySelector('.datetime-number-item') as HTMLElement;
    expect(first3.dataset.value).toBe('2001');
    mask3.remove();
  });
});

describe('D-UI10 键盘可达', () => {
  it('displayArea tabindex=0 + role=button；Enter / Space 打开滚轮', () => {
    const ctrl = mountControl(true);
    const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
    expect(display.tabIndex).toBe(0);
    expect(display.getAttribute('role')).toBe('button');
    display.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(document.getElementById('unified-datetime-picker-mask')).toBeTruthy();
    document.getElementById('unified-datetime-picker-mask')!.remove();

    display.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(document.getElementById('unified-datetime-picker-mask')).toBeTruthy();
    document.getElementById('unified-datetime-picker-mask')!.remove();
  });

  it('滚轮数值项 button 化；打开即聚焦选中项；↑/↓ 步进选值且焦点跟随', () => {
    const mask = showDateTimePicker(moment('2024-06-15 14:30'), () => {});
    const cols = wheelCols(mask);
    expect((itemOf(cols[3], 14) as HTMLElement).tagName).toBe('BUTTON');
    // 打开即聚焦选中项（当前实现聚焦第一列选中年份）
    expect((document.activeElement as HTMLElement)?.dataset?.value).toBe('2024');
    // 时分项聚焦 + ArrowDown → 选中 15 且焦点跟随
    itemOf(cols[3], 14).focus();
    itemOf(cols[3], 14).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    );
    expect(selectedItem(cols[3])!.dataset.value).toBe('15');
    expect((document.activeElement as HTMLElement)?.dataset?.value).toBe('15');
    // ArrowUp 回退；边界（分钟选中 0 再 ↑）不越界
    itemOf(cols[4], 0).click(); // 先选中 0（方向键按选中值步进，非焦点项值）
    itemOf(cols[4], 0).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
    );
    expect(selectedItem(cols[4])!.dataset.value).toBe('0');
    mask.remove();
  });

  it('ESC 经 escManager 层关闭滚轮（层 id 已对齐 bz- 前缀口径）', () => {
    showDateTimePicker(moment('2024-06-15 14:30'), () => {});
    expect(document.getElementById('unified-datetime-picker-mask')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('unified-datetime-picker-mask')).toBeNull();
  });
});

describe('D-UI16 手输软键盘遮挡档', () => {
  it('manualInput focus → #add-diary-popup 挂 .keyboard-up；blur → 移除', () => {
    const ctrl = mountControl(true);
    const popup = document.getElementById('add-diary-popup')!;
    const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
    const manual = ctrl.querySelector('input[placeholder*="YYYY-MM-DD"]') as HTMLInputElement;

    display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); // 进手输
    // enterManualMode 内 manualInput.focus() 即触发 focus 监听 → 档位立即生效
    expect(popup.classList.contains('keyboard-up')).toBe(true);
    manual.dispatchEvent(new Event('blur'));
    expect(popup.classList.contains('keyboard-up')).toBe(false);
  });
});

describe('一致#2/#3 档位对齐', () => {
  it('滚轮壳 role=dialog + aria-modal；阴影走 --dw-shadow-lg 三档；内联 scrollbar 声明已删', () => {
    const mask = showDateTimePicker(moment('2024-06-15 14:30'), () => {});
    const popup = mask.lastElementChild as HTMLElement;
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-modal')).toBe('true');
    expect(popup.getAttribute('aria-label')).toBe('选择日期时间');
    expect(popup.getAttribute('style') || '').toContain('var(--dw-shadow-lg)');
    const sc = mask.querySelector('.diary-datetime-scroll-container') as HTMLElement;
    expect(sc.getAttribute('style') || '').not.toContain('scrollbar-width');
    expect(sc.getAttribute('style') || '').not.toContain('-ms-overflow-style');
    mask.remove();
  });
});
