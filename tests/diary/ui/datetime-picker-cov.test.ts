/**
 * 覆盖率补测：滚轮日期时间选择器（datetime-picker）。
 * 覆盖滚轮数值项点击、年/月变更的天数重建（收缩/钳制/增长）、滚轮与触摸滚动、
 * 「此刻」「确定」按钮、遮罩关闭、手动模式拦截、syncDateTime 防御分支。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { moment } from 'obsidian';
import { createDateTimeControl, showDateTimePicker, syncDateTime } from '../../../src/diary/ui/datetime-picker';
import { resetObsidianMocks, clearNotices, hasNotice } from '../../mock-obsidian-entry';

beforeEach(() => {
  document.body.innerHTML = '';
  resetObsidianMocks();
  clearNotices();
  vi.useRealTimers();
});

/** 打开滚轮选择器并返回遮罩 */
function openPicker(dateStr: string, onConfirm?: (m: any) => void): HTMLElement {
  return showDateTimePicker(moment(dateStr), onConfirm ?? (() => {}));
}

/** 五列滚轮容器（年/月/日/时/分） */
function wheelCols(mask: HTMLElement): NodeListOf<HTMLElement> {
  return mask.querySelectorAll('.diary-datetime-scroll-container');
}

/** 某列中指定数值的数值项 */
function itemOf(col: Element, value: number): HTMLElement {
  const el = col.querySelector(`.datetime-number-item[data-value="${value}"]`) as HTMLElement;
  expect(el, `列中应存在数值项 ${value}`).toBeTruthy();
  return el;
}

/** 某列当前高亮项（选中态颜色） */
function selectedItem(col: Element): HTMLElement | null {
  return [...col.querySelectorAll<HTMLElement>('.datetime-number-item')].find(
    (el) => el.style.color === 'var(--text-on-accent)'
  ) ?? null;
}

/** 挂载日期时间控件；inPopup=true 时包在 #add-diary-popup 内 */
function mountControl(inPopup: boolean): HTMLElement {
  const ctrl = createDateTimeControl();
  const wrapper = document.createElement('div');
  if (inPopup) wrapper.id = 'add-diary-popup';
  wrapper.appendChild(ctrl);
  document.body.appendChild(wrapper);
  return ctrl;
}

describe('滚轮数值项点击', () => {
  it('点击时分项更新选中态；点击同值项不重复处理', () => {
    const mask = openPicker('2024-06-15 14:30');
    const cols = wheelCols(mask);
    expect(cols.length).toBe(5);
    const hourCol = cols[3];
    // 初始选中 14
    expect(selectedItem(hourCol)!.dataset.value).toBe('14');
    // 点 8 → 高亮切换到 8，原 14 恢复普通态
    itemOf(hourCol, 8).click();
    expect(selectedItem(hourCol)!.dataset.value).toBe('8');
    const it8 = itemOf(hourCol, 8);
    expect(it8.style.color).toBe('var(--text-on-accent)');
    expect(it8.style.fontWeight).toBe('900');
    const it14 = itemOf(hourCol, 14);
    expect(it14.style.color).toBe('var(--text-muted)');
    expect(it14.style.fontWeight).toBe('400');
    // 再点同值 8 → newVal === current → 直接返回（无异常、选中不变）
    expect(() => it8.click()).not.toThrow();
    expect(selectedItem(hourCol)!.dataset.value).toBe('8');
    mask.remove();
  });

  it('月份变更触发天数收缩与钳制：2024-01-31 切到 4 月 → 30 天且日钳到 30', () => {
    const mask = openPicker('2024-01-31');
    const cols = wheelCols(mask);
    expect(colItemCount(cols[2])).toBe(31);
    itemOf(cols[1], 4).click(); // 4 月只有 30 天
    expect(colItemCount(cols[2])).toBe(30); // 天数列收缩
    expect(selectedItem(cols[2])!.dataset.value).toBe('30'); // 31 > 30 钳制
    mask.remove();
  });

  it('天数增长路径 + 再生数值项可点击：2023-02-01 切到 3 月 → 31 天并可选 31', () => {
    const mask = openPicker('2023-02-01');
    const cols = wheelCols(mask);
    expect(colItemCount(cols[2])).toBe(28);
    itemOf(cols[1], 3).click(); // 3 月 31 天 → 补建 29/30/31 项
    expect(colItemCount(cols[2])).toBe(31);
    // 新建的再生项带有点击处理器：点 31 生效
    itemOf(cols[2], 31).click();
    expect(selectedItem(cols[2])!.dataset.value).toBe('31');
    // 同值再点 → 早退
    expect(() => itemOf(cols[2], 31).click()).not.toThrow();
    // 年份变更同样走天数重建：2024 闰年 3 月仍 31 天
    itemOf(cols[0], 2024).click();
    expect(colItemCount(cols[2])).toBe(31);
    mask.remove();
  });
});

function colItemCount(col: Element): number {
  return col.querySelectorAll('.datetime-number-item').length;
}

describe('滚轮与触摸滚动', () => {
  it('wheel 事件阻止默认并按比例滚动容器', () => {
    const mask = openPicker('2024-06-15 14:30');
    const sc = wheelCols(mask)[4]; // 分钟列
    const ev: any = new Event('wheel', { cancelable: true, bubbles: true });
    ev.deltaY = 120;
    const pd = vi.spyOn(ev, 'preventDefault');
    sc.dispatchEvent(ev);
    expect(pd).toHaveBeenCalledTimes(1);
    mask.remove();
  });

  it('触摸拖动更新滚动位置；多指/未开始触摸的 move 被忽略', () => {
    const mask = openPicker('2024-06-15 14:30');
    const sc = wheelCols(mask)[0];
    const mkTouch = (type: string, ys: number[]): Event => {
      const ev = new Event(type, { cancelable: true, bubbles: true }) as any;
      ev.touches = ys.map((y) => ({ clientY: y }));
      return ev;
    };
    const pdSpy = vi.spyOn(Event.prototype, 'preventDefault');
    try {
      // 多指 touchstart → 忽略；后续 move 不滚动
      sc.dispatchEvent(mkTouch('touchstart', [200, 210]));
      sc.dispatchEvent(mkTouch('touchmove', [150]));
      // 正常单指：start 记录起点 → move 计算 delta 并 preventDefault
      sc.dispatchEvent(mkTouch('touchstart', [200]));
      sc.dispatchEvent(mkTouch('touchmove', [150]));
      // 多指 move → 忽略
      sc.dispatchEvent(mkTouch('touchmove', [100, 100]));
      // end 结束后再 move → isScrolling=false 早退
      sc.dispatchEvent(new Event('touchend', { cancelable: true, bubbles: true }));
      sc.dispatchEvent(mkTouch('touchmove', [90]));
      // 单指滚动恰好 preventDefault 一次（其余早退分支不调用）
      expect(pdSpy).toHaveBeenCalledTimes(1);
    } finally {
      pdSpy.mockRestore();
    }
    mask.remove();
  });
});

describe('边界与按钮', () => {
  it('初始时刻超出列范围（2035 年）→ 安全渲染无高亮', () => {
    const mask = openPicker('2035-05-05 10:30');
    const cols = wheelCols(mask);
    // 年列动态范围（UX-34）：无数据时下限放宽至 1900，max = 当前年份+1
    const yearCount = new Date().getFullYear() + 1 - 1900 + 1;
    expect(colItemCount(cols[0])).toBe(yearCount);
    expect(selectedItem(cols[0])).toBeNull(); // 2035 无对应项，scrollToSelected 越界安全
    mask.remove();
  });

  it('「此刻」重置为当前时间并全列刷新定位', () => {
    const mask = openPicker('2020-01-01 00:00');
    const btns = [...mask.querySelectorAll('button')];
    (btns.find((b) => b.textContent === '此刻') as HTMLElement).click();
    const nowYear = String(new Date().getFullYear());
    const yearCol = wheelCols(mask)[0];
    expect(selectedItem(yearCol)!.dataset.value).toBe(nowYear);
    mask.remove();
  });

  it('「确定」回调返回克隆时刻并移除遮罩；onConfirm 为空也安全', () => {
    const cb = vi.fn();
    const m = moment('2024-06-15 14:30');
    const mask = showDateTimePicker(m, cb);
    ( [...mask.querySelectorAll('button')].find((b) => b.textContent === '确定') as HTMLElement).click();
    expect(cb).toHaveBeenCalledTimes(1);
    const arg = cb.mock.calls[0][0];
    expect(arg.format('YYYY-MM-DD HH:mm')).toBe('2024-06-15 14:30');
    expect(arg).not.toBe(m); // 克隆而非原引用
    expect(mask.isConnected).toBe(false);

    // 无回调：仅关闭，不抛错
    const mask2 = showDateTimePicker(moment('2024-01-01 00:00'), null as any);
    ([...mask2.querySelectorAll('button')].find((b) => b.textContent === '确定') as HTMLElement).click();
    expect(mask2.isConnected).toBe(false);
  });

  it('点击遮罩空白处关闭；点击弹窗内部不关闭；重复打开先移除旧遮罩', () => {
    const mask = openPicker('2024-06-15 14:30');
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mask.isConnected).toBe(false);

    const mask2 = openPicker('2024-06-15 14:30');
    // 点击弹窗内部（target 非 mask）→ 不关闭
    const popup = mask2.lastElementChild as HTMLElement;
    popup.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mask2.isConnected).toBe(true);

    // 再次打开 → 旧遮罩被移除，全局唯一
    openPicker('2024-06-15 14:30');
    expect(document.querySelectorAll('#unified-datetime-picker-mask').length).toBe(1);
    document.getElementById('unified-datetime-picker-mask')!.remove();
  });
});

describe('日期时间控件（createDateTimeControl）手动模式', () => {
  it('手动模式下重复双击被忽略；单击延迟打开被拦截；blur 提交后单击可正常打开滚轮', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const ctrl = mountControl(true);
      const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
      const manual = ctrl.querySelector('input[placeholder*="YYYY-MM-DD"]') as HTMLInputElement;

      // 双击进入手动模式；再次双击 → isManualMode 早退（无副作用）
      display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(manual.style.display).toBe('block');
      display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(manual.style.display).toBe('block');

      // 手动模式下单击 displayArea：200ms 后 openUnifiedPicker 因手动模式早退
      display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(260);
      expect(document.getElementById('unified-datetime-picker-mask')).toBeNull();

      // blur 提交（值合法）退出手动模式
      manual.dispatchEvent(new Event('blur'));
      expect(manual.style.display).toBe('none');
      expect(display.style.display).toBe('flex');

      // 现在单击延迟后正常打开滚轮选择器
      display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(260);
      expect(document.getElementById('unified-datetime-picker-mask')).toBeTruthy();
      document.getElementById('unified-datetime-picker-mask')!.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it('syncDateTime：无输入/无效值/非弹窗容器均安全返回；有效值同步各段显示', () => {
    // 无隐藏输入
    syncDateTime();
    // 控件不在 #add-diary-popup 内
    const ctrl = mountControl(false);
    const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement;
    hidden.value = 'garbage-input';
    syncDateTime(); // 无效格式早退
    let year = ctrl.querySelector('[data-part="year"]') as HTMLElement;
    const before = year.textContent;
    expect(before).toMatch(/^\d{4}$/); // 保持创建时的当前时间显示
    hidden.value = '2024-06-15 14:30';
    syncDateTime(); // 容器不是 #add-diary-popup → 早退
    year = ctrl.querySelector('[data-part="year"]') as HTMLElement;
    expect(year.textContent).toBe(before);

    // 清掉前一个控件（同 id 隐藏输入只能存在一个，getElementById 取第一个）
    document.body.innerHTML = '';
    // 包在 #add-diary-popup 内 → 同步生效
    const ctrl2 = mountControl(true);
    (document.getElementById('add-diary-datetime') as HTMLInputElement).value = '2024-06-15 14:30';
    syncDateTime();
    expect((ctrl2.querySelector('[data-part="year"]') as HTMLElement).textContent).toBe('2024');
    expect((ctrl2.querySelector('[data-part="month"]') as HTMLElement).textContent).toBe('06');
    expect((ctrl2.querySelector('[data-part="day"]') as HTMLElement).textContent).toBe('15');
    expect((ctrl2.querySelector('[data-part="hour"]') as HTMLElement).textContent).toBe('14');
    expect((ctrl2.querySelector('[data-part="minute"]') as HTMLElement).textContent).toBe('30');

    // 移除输入后再调 → 早退不抛错
    document.getElementById('add-diary-datetime')!.remove();
    expect(() => syncDateTime()).not.toThrow();
  });

  it('手动输入无效内容 blur → 提示并恢复', () => {
    const ctrl = mountControl(true);
    const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
    display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const manual = ctrl.querySelector('input[placeholder*="YYYY-MM-DD"]') as HTMLInputElement;
    manual.value = '完全不是日期';
    manual.dispatchEvent(new Event('blur'));
    expect(hasNotice('日期时间格式无效，已恢复')).toBe(true);
  });
});
