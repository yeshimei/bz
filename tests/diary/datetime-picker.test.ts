/**
 * 写日记弹窗日期控件（P1 审查修复：弹窗日期脱同步）。
 * - resetDateTimeControl：openAddDialog 打开时同步重置控件内部 currentMoment；
 * - 回归：重置后打开滚轮直接点「确定」，不再把日期写回控件创建时刻。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { moment } from 'obsidian';
import { setApp } from '../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { createDateTimeControl, resetDateTimeControl } from '../../src/diary/ui/datetime-picker';
import { createAddDialog, openAddDialog } from '../../src/diary/ui/dialogs';

beforeEach(() => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  setApp({ workspace: {} } as any);
  vi.useRealTimers();
});

function hiddenValue(): string {
  return (document.getElementById('add-diary-datetime') as HTMLInputElement)?.value ?? '';
}

/** 单击显示区打开滚轮选择器（200ms 单击延迟），返回选择器遮罩 */
function openWheel(displayArea: HTMLElement): HTMLElement {
  displayArea.click();
  vi.advanceTimersByTime(250);
  const mask = document.getElementById('unified-datetime-picker-mask');
  expect(mask).toBeTruthy();
  return mask!;
}

/** 点滚轮弹窗的「确定」 */
function confirmWheel(mask: HTMLElement) {
  const okBtn = Array.from(mask.querySelectorAll('button')).find((b) => b.textContent === '确定')!;
  expect(okBtn).toBeTruthy();
  okBtn.click();
}

describe('写日记弹窗日期控件同步（P1 审查修复）', () => {
  it('resetDateTimeControl 同步显示与内部时刻（hiddenInput 更新）', () => {
    const el = createDateTimeControl();
    document.body.appendChild(el);
    resetDateTimeControl(moment('2020-03-04 05:06', 'YYYY-MM-DD HH:mm', true));
    expect(hiddenValue()).toBe('2020-03-04 05:06');
    expect(el.querySelector('#datetime-display-area')!.textContent).toContain('2020');
  });

  it('resetDateTimeControl 忽略无效时刻', () => {
    const el = createDateTimeControl();
    document.body.appendChild(el);
    resetDateTimeControl(moment('2020-03-04 05:06', 'YYYY-MM-DD HH:mm', true));
    resetDateTimeControl(moment('not-a-date', 'YYYY-MM-DD HH:mm', true));
    expect(hiddenValue()).toBe('2020-03-04 05:06');
  });

  it('回归：重置后滚轮直接点「确定」保持重置时刻，不写回控件创建时刻', () => {
    vi.useFakeTimers();
    const el = createDateTimeControl();
    document.body.appendChild(el);
    resetDateTimeControl(moment('2020-03-04 05:06', 'YYYY-MM-DD HH:mm', true));
    // 滚轮起点年份 = 重置时刻年份（选中项字重 900）
    const mask = openWheel(el.querySelector('#datetime-display-area') as HTMLElement);
    const selectedYears = Array.from(mask.querySelectorAll<HTMLElement>('.datetime-number-item'))
      .filter((i) => i.style.fontWeight === '900')
      .map((i) => i.textContent);
    expect(selectedYears).toContain('2020');
    // 不动滚轮直接确定：确认值必须仍是重置时刻（修复前会是控件创建时的「现在」）
    confirmWheel(mask);
    expect(hiddenValue()).toBe('2020-03-04 05:06');
  });

  it('回归：openAddDialog 打开时重置内部时刻，隔天复用弹窗不再写回旧日期', () => {
    vi.useFakeTimers();
    createAddDialog();
    // 模拟控件创建后跨天：内部时刻残留在旧日期
    resetDateTimeControl(moment('2019-01-01 00:00', 'YYYY-MM-DD HH:mm', true));
    openAddDialog();
    const before = hiddenValue();
    expect(before).not.toBe('2019-01-01 00:00'); // 显示值已是打开时刻的默认值
    const displayArea = document.querySelector('#add-diary-popup #datetime-display-area') as HTMLElement;
    const mask = openWheel(displayArea);
    confirmWheel(mask);
    // 修复前：确认会把内部残留的 2019-01-01 写回显示；修复后保持打开时的默认值
    expect(hiddenValue()).toBe(before);
  });
});
