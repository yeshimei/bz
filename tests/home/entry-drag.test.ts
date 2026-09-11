/**
 * 首页入口内联编辑器的拖拽契约（2026-09-11 用户报两个 bug 后重写，本文件是回归守卫）：
 *
 * 用户原话：「桌面端上拖拽的时候，没有其他元素往上移动的动态效果。移动端长按拖拽没有效果。」
 * 两条都不是视觉细节，是拖拽实现本身缺件，故各钉一条断言：
 *  - **让位**：被拖行从 index 0 拖到 2，途中的 1/2 两行必须带 .bz-home-ent-shift 且反向位移一格
 *    （此前只写被拖行自己的 transform，邻居纹丝不动 → 用户看到的「没有动态效果」）；
 *  - **触屏长按**：按住窗口（250ms）内不激活拖拽，过窗口后一次移动即起拖；
 *    滚动归属由非 passive touchmove 仲裁（补扫 E）：pointerdown **不再**抢 touch-action
 *    （手势进行中改它不生效，「短滑交还滚动」不可达 → 死手势），未 armed 放行原生滚动、
 *    armed 后 preventDefault 拦滚动独占手势。
 *  - **blur 兜底**（补扫 D）：拖拽中切窗口 → 兜底收尾；监听挂 AbortController 信号，
 *    设置面板重渲染重建编辑器时 abort 旧的，window 上不叠加。
 *
 * 这里只测「DOM 层是否按契约动手」——jQuery 级的像素观感留给评审壳。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { mountHomeEntryEditor } from '../../src/home/entry-editor';

/** 可拖行数（可见域 = DOMAINS 全长，本测试不隐藏任何域） */
const N = 14;

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

function pe(type: string, y: number): PointerEvent {
  const e = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperty(e, 'clientY', { value: y });
  Object.defineProperty(e, 'clientX', { value: 10 });
  Object.defineProperty(e, 'button', { value: 0 });
  return e;
}

/** jsdom 没有布局：行高/步长全 0，故手工喂 offsetHeight/offsetTop 让 step 算得出来 */
function stubLayout(rows: HTMLElement[], rowH = 40): void {
  rows.forEach((el, i) => {
    Object.defineProperty(el, 'offsetHeight', { value: rowH, configurable: true });
    Object.defineProperty(el, 'offsetTop', { value: i * (rowH + 6), configurable: true });
  });
}

async function mountMobile(host: HTMLElement): Promise<HTMLElement[]> {
  vi.resetModules();
  vi.doMock('../../src/core/mobile', () => ({ isMobileEnv: () => true }));
  const { mountHomeEntryEditor: mount } = await import('../../src/home/entry-editor');
  mount(host, mockAppWithVault(new MockVault()) as any);
  await new Promise((r) => setTimeout(r, 20));
  return Array.from(host.querySelectorAll<HTMLElement>('[data-ent-row]'));
}

describe('首页入口拖拽（2026-09-11 用户报 bug 重写）', () => {
  beforeEach(() => {
    setApp(mockAppWithVault(new MockVault()) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
  });

  afterEach(() => {
    vi.doUnmock('../../src/core/mobile');
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('列表渲染出全部可见行，且拖柄只在可见行上', async () => {
    const host = makeHost();
    mountHomeEntryEditor(host, mockAppWithVault(new MockVault()) as any);
    await new Promise((r) => setTimeout(r, 20));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-ent-row]'));
    expect(rows.length).toBe(N);
    expect(rows[0].querySelector('.bz-home-ent-grip')).toBeTruthy();
  });

  it('桌面端：拖动首行向下两格 → 被跨过的两行反向位移一格（让位动画）', async () => {
    const host = makeHost();
    mountHomeEntryEditor(host, mockAppWithVault(new MockVault()) as any);
    await new Promise((r) => setTimeout(r, 20));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-ent-row]'));
    stubLayout(rows);
    const step = rows[1].offsetTop - rows[0].offsetTop; // 46

    rows[0].dispatchEvent(pe('pointerdown', 100));
    window.dispatchEvent(pe('pointermove', 100 + 5)); // 未过阈值：还没起拖
    expect(document.querySelector('.bz-home-ent-drag')).toBeNull();

    window.dispatchEvent(pe('pointermove', 100 + step * 2 + 4)); // 越过两格
    expect(rows[0].classList.contains('bz-home-ent-drag')).toBe(true);
    // 被拖行跟手：位移两格
    expect(rows[0].style.transform).toBe(`translateY(${step * 2}px)`);
    // 让位：第 1、2 行各上移一格；第 3 行及以后不动
    expect(rows[1].classList.contains('bz-home-ent-shift')).toBe(true);
    expect(rows[1].style.transform).toBe(`translateY(${-step}px)`);
    expect(rows[2].classList.contains('bz-home-ent-shift')).toBe(true);
    expect(rows[2].style.transform).toBe(`translateY(${-step}px)`);
    expect(rows[3].classList.contains('bz-home-ent-shift')).toBe(false);
    expect(rows[3].style.transform).toBe('');

    window.dispatchEvent(pe('pointerup', 100 + step * 2 + 4));
    await new Promise((r) => setTimeout(r, 20));
    // 落盘后重排：原第 1 行成了第 1 个
    const after = Array.from(host.querySelectorAll<HTMLElement>('[data-ent-row]'));
    expect(after[0].dataset.entRow).toBe(rows[1].dataset.entRow);
    expect(after.every((el) => el.style.transform === '')).toBe(true);
  });

  it('桌面端：往回拖时邻居向下让位（负向区间同样成立）', async () => {
    const host = makeHost();
    mountHomeEntryEditor(host, mockAppWithVault(new MockVault()) as any);
    await new Promise((r) => setTimeout(r, 20));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-ent-row]'));
    stubLayout(rows);
    const step = rows[1].offsetTop - rows[0].offsetTop;

    rows[3].dispatchEvent(pe('pointerdown', 400));
    window.dispatchEvent(pe('pointermove', 400 - step * 2));
    expect(rows[3].classList.contains('bz-home-ent-drag')).toBe(true);
    // 被跨过的是 1、2 行 → 各下移一格
    expect(rows[1].style.transform).toBe(`translateY(${step}px)`);
    expect(rows[2].style.transform).toBe(`translateY(${step}px)`);
    expect(rows[0].style.transform).toBe('');
    window.dispatchEvent(pe('pointerup', 400 - step * 2));
  });

  it('触屏：pointerdown 不再抢 touch-action（E：手势进行中改它不生效，短滑「交还」不可达）', async () => {
    const host = makeHost();
    const rows = await mountMobile(host);
    stubLayout(rows);

    rows[0].dispatchEvent(pe('pointerdown', 100));
    expect(rows[0].style.touchAction).toBe(''); // 不动 touch-action：滚动归属交给 touchmove 仲裁
    expect(document.querySelector('.bz-home-ent-drag')).toBeNull(); // 还没到长按窗口

    // 按住窗口内小幅抖动：不算滚动，不取消长按
    window.dispatchEvent(pe('pointermove', 104));
    expect(rows[0].style.touchAction).toBe('');
    window.dispatchEvent(pe('pointerup', 104));
  });

  it('触屏：按住窗口内短滑 → touchmove 不拦（原生滚动照常），不进拖拽', async () => {
    const host = makeHost();
    const rows = await mountMobile(host);
    stubLayout(rows);

    rows[0].dispatchEvent(pe('pointerdown', 100));
    // 短滑期间仲裁未 armed：不 preventDefault，浏览器原生滚动照常
    //（旧实现此处 touch-action 已被锁 none，滚动进不来=既不拖也不滚的死手势）
    const scrollEvt = new Event('touchmove', { cancelable: true });
    window.dispatchEvent(scrollEvt);
    expect(scrollEvt.defaultPrevented).toBe(false);

    window.dispatchEvent(pe('pointermove', 140)); // 40px > 8px slop：用户要滚 → 收掉候选拖拽
    expect(document.querySelector('.bz-home-ent-drag')).toBeNull();
    expect(rows[1].classList.contains('bz-home-ent-shift')).toBe(false);
    // 收尾后仲裁监听已摘：继续不拦滚动
    const lateEvt = new Event('touchmove', { cancelable: true });
    window.dispatchEvent(lateEvt);
    expect(lateEvt.defaultPrevented).toBe(false);
    window.dispatchEvent(pe('pointerup', 220));
  });

  it('触屏：armed 后 touchmove 被 preventDefault 拦滚动（拖拽独占手势），松手收尾后放行', async () => {
    const host = makeHost();
    const rows = await mountMobile(host);
    stubLayout(rows);

    rows[0].dispatchEvent(pe('pointerdown', 100));
    await new Promise((r) => setTimeout(r, 300)); // 过 TOUCH_ARM_MS → armed
    // armed 后 touchmove 一律拦下：浏览器不起滚动、不发 pointercancel，pointermove 流保持
    const blocked = new Event('touchmove', { cancelable: true });
    window.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);

    window.dispatchEvent(pe('pointerup', 100));
    await new Promise((r) => setTimeout(r, 20));
    // 松手收尾：仲裁监听摘除，滚动放行
    const after = new Event('touchmove', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('触屏：按住满窗口后第一次移动即起拖，并带动邻居让位', async () => {
    // 不用 fake timers：await mountMobile 内部要等一次真实 tick（20ms），假时钟会把那个 sleep 一起冻住
    const host = makeHost();
    const rows = await mountMobile(host);
    stubLayout(rows);
    const step = rows[1].offsetTop - rows[0].offsetTop;

    rows[0].dispatchEvent(pe('pointerdown', 100));
    await new Promise((r) => setTimeout(r, 300)); // 过 TOUCH_ARM_MS
    window.dispatchEvent(pe('pointermove', 100 + step)); // 起拖 + 落第二格
    expect(rows[0].classList.contains('bz-home-ent-drag')).toBe(true);
    expect(rows[1].classList.contains('bz-home-ent-shift')).toBe(true);
    expect(rows[1].style.transform).toBe(`translateY(${-step}px)`);

    window.dispatchEvent(pe('pointerup', 100 + step));
    await new Promise((r) => setTimeout(r, 20));
    const after = Array.from(host.querySelectorAll<HTMLElement>('[data-ent-row]'));
    expect(after[0].dataset.entRow).toBe(rows[1].dataset.entRow);
  });

  it('补扫 D 回归：blur 兜底监听挂 AbortController——重建 mount 时 abort 旧的，兜底仍工作', async () => {
    const host1 = makeHost();
    const spy = vi.spyOn(window, 'addEventListener');
    mountHomeEntryEditor(host1, mockAppWithVault(new MockVault()) as any);
    await new Promise((r) => setTimeout(r, 20));
    const firstCalls = spy.mock.calls.filter(([type]) => type === 'blur');
    expect(firstCalls.length).toBe(1);
    const firstSignal = (firstCalls[0][2] as AddEventListenerOptions | undefined)?.signal;
    expect(firstSignal).toBeInstanceOf(AbortSignal);

    // 设置面板重渲染 → 重新 mount：旧 mount 的 blur 监听随 abort 摘除（不再叠加）
    const host2 = makeHost();
    mountHomeEntryEditor(host2, mockAppWithVault(new MockVault()) as any);
    await new Promise((r) => setTimeout(r, 20));
    expect(firstSignal!.aborted).toBe(true);
    const allCalls = spy.mock.calls.filter(([type]) => type === 'blur');
    expect(allCalls.length).toBe(2); // 每次 mount 恰好一份，不累积
    const secondSignal = (allCalls[1][2] as AddEventListenerOptions | undefined)?.signal;
    expect(secondSignal?.aborted).toBe(false);
    spy.mockRestore();

    // 最新 mount 的 blur 兜底仍工作：拖拽中切窗口 → 收尾（浮起类/位移清除）
    const rows = Array.from(host2.querySelectorAll<HTMLElement>('[data-ent-row]'));
    stubLayout(rows);
    rows[0].dispatchEvent(pe('pointerdown', 100));
    window.dispatchEvent(pe('pointermove', 160)); // 起拖
    expect(rows[0].classList.contains('bz-home-ent-drag')).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(rows[0].classList.contains('bz-home-ent-drag')).toBe(false);
    expect(rows[0].style.transform).toBe('');
  });
});
