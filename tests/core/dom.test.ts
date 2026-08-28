/**
 * core DOM 工具测试（ticket 02）：notice/injectStyles/longPress/createIconBtn/
 * createSiteIcon/createOverlay——jsdom 环境行为断言。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notice, longPress, createIconBtn, createSiteIcon, createOverlay } from '../../src/core/dom';
import { __resetZForTests, allocZ } from '../../src/core/z-order';
import { getNoticeMessages } from '../mock-obsidian-entry';

describe('notice', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('走自绘通知系统：DOM 渲染 + 显式类型（ticket 25）', () => {
    notice('测试提示');
    expect(getNoticeMessages()).toHaveLength(1);
    expect(getNoticeMessages()[0]).toBe('测试提示');
    expect(document.querySelector('.bz-notice--info')).not.toBeNull();
  });

  it('显式类型：success/error/warning 类名 + 消息不带 emoji', () => {
    notice('完成', 'success');
    notice('失败', 'error');
    notice('警告', 'warning');
    expect(document.querySelector('.bz-notice--success')).not.toBeNull();
    expect(document.querySelector('.bz-notice--error')).not.toBeNull();
    expect(document.querySelector('.bz-notice--warning')).not.toBeNull();
    // 消息文本不含 emoji（图标在类型样式上）
    expect(getNoticeMessages().join('')).not.toMatch(/[✅❌⚠️]/);
  });

  it('不再让路 smartCat（Q3 兼容分支已删除）', () => {
    (window as any).smartCat = { showBubble: vi.fn() };
    notice('气泡');
    expect(getNoticeMessages()).toHaveLength(1);
    delete (window as any).smartCat;
  });
});

describe('longPress', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('长按触发回调（mousedown 后超时）', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    const cb = vi.fn();
    longPress(el, cb, 300);

    el.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    vi.advanceTimersByTime(350);
    expect(cb).toHaveBeenCalledTimes(1);

    // mouseup 后不再触发
    el.dispatchEvent(new MouseEvent('mouseup'));
    vi.advanceTimersByTime(350);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('提前 mouseup 取消长按', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    const cb = vi.fn();
    longPress(el, cb, 300);

    el.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    el.dispatchEvent(new MouseEvent('mouseup'));
    vi.advanceTimersByTime(350);
    expect(cb).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('filter 返回 false 时忽略', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    const cb = vi.fn();
    longPress(el, cb, 300, () => false);

    el.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    vi.advanceTimersByTime(350);
    expect(cb).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('触屏短按（未到长按时长）→ 合成 click 正常派发，长按回调不触发', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    const cb = vi.fn();
    const onClick = vi.fn();
    el.addEventListener('click', onClick);
    longPress(el, cb, 300);

    // 模拟触屏（touchstart 被动监听不再 preventDefault，滚动不受影响；jsdom 不自动合成 click，手动派发）
    const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ts, 'touches', { value: [{ clientX: 10, clientY: 10 }] });
    el.dispatchEvent(ts);
    vi.advanceTimersByTime(100); // 未到 300ms
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(onClick).toHaveBeenCalledTimes(1); // 未长按不吞
    expect(cb).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('触屏长按 → 触发长按回调，浏览器补发的合成 click 被吞（防穿透内部链接/按钮）', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    const cb = vi.fn();
    const onClick = vi.fn();
    el.addEventListener('click', onClick);
    longPress(el, cb, 300);

    const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ts, 'touches', { value: [{ clientX: 10, clientY: 10 }] });
    el.dispatchEvent(ts);
    vi.advanceTimersByTime(350); // 长按触发
    expect(cb).toHaveBeenCalledTimes(1);
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(onClick).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('触屏移动超阈值（滑动取消长按）→ 未长按不吞 click，长按回调不触发', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    const cb = vi.fn();
    const onClick = vi.fn();
    el.addEventListener('click', onClick);
    longPress(el, cb, 300);

    const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ts, 'touches', { value: [{ clientX: 10, clientY: 10 }] });
    el.dispatchEvent(ts);
    const tm = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(tm, 'touches', { value: [{ clientX: 60, clientY: 10 }] });
    el.dispatchEvent(tm);
    vi.advanceTimersByTime(100);
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(cb).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1); // 滑动后浏览器本不派发合成 click；此处验证未长按时不吞
    vi.useRealTimers();
  });
});

describe('createIconBtn', () => {
  it('生成按钮：文本/标题/点击/样式', () => {
    const onClick = vi.fn();
    const btn = createIconBtn('📌', '置顶', onClick);
    expect(btn.textContent).toBe('📌');
    expect(btn.title).toBe('置顶');
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    // 视觉样式已收敛 styles.css（ticket 60），jsdom 只验证类名结构
    expect(btn.className).toContain('bz-icon-btn');
  });
});

describe('createSiteIcon', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('空 domain 返回 null', () => {
    expect(createSiteIcon('')).toBeNull();
    expect(createSiteIcon(null)).toBeNull();
  });

  it('生成 img 元素（yandex 源）', () => {
    const img = createSiteIcon('example.com', 16);
    expect(img).not.toBeNull();
    expect(img!.src).toContain('favicon.yandex.net/favicon/example.com');
    expect(img!.style.width).toBe('16px');
  });

  it('域名映射（daily.zhihu.com → zhihu.com）', () => {
    const img = createSiteIcon('daily.zhihu.com');
    expect(img!.src).toContain('favicon/zhihu.com');
  });

  it('localStorage 缓存命中直接使用缓存', () => {
    localStorage.setItem('favicon_example.com', 'data:image/png;base64,xxx');
    const img = createSiteIcon('example.com');
    expect(img!.src).toBe('data:image/png;base64,xxx');
  });
});

describe('createOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mask/popup 结构与动态 z-index（ADR-0067：创建即发号，遮罩在下、本体在上）', () => {
    __resetZForTests();
    const { mask, popup } = createOverlay({ maskId: 'm', popupId: 'p' });
    expect(mask.id).toBe('m');
    expect(popup.id).toBe('p');
    const mz = parseInt(mask.style.zIndex, 10);
    expect(Number.isFinite(mz)).toBe(true);
    expect(parseInt(popup.style.zIndex, 10)).toBe(mz + 1);
    expect(mask.style.display).toBe('none');
    expect(popup.style.display).toBe('none');
  });

  it('连续创建的 overlay z 单调递增（谁后创建谁在上）', () => {
    __resetZForTests();
    const z1 = allocZ();
    const z2 = allocZ();
    expect(z2).toBeGreaterThan(z1);
  });

  it('点击遮罩触发 onMaskClick，点击 popup 不触发', () => {
    const onMaskClick = vi.fn();
    const { mask, popup } = createOverlay({ maskId: 'm', popupId: 'p', onMaskClick });
    document.body.appendChild(mask);
    mask.appendChild(popup);

    mask.click();
    expect(onMaskClick).toHaveBeenCalledTimes(1);
    popup.click();
    expect(onMaskClick).toHaveBeenCalledTimes(1);
  });
});
