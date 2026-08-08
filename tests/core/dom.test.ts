/**
 * core DOM 工具测试（ticket 02）：notice/injectStyles/longPress/createIconBtn/
 * createSiteIcon/createOverlay——jsdom 环境行为断言。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notice, injectStyles, longPress, createIconBtn, createSiteIcon, createOverlay } from '../../src/core/dom';
import { getNoticeMessages } from '../mock-obsidian-entry';

describe('notice', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('走自绘通知系统：DOM 渲染 + 自动语义归类（ticket 25）', () => {
    notice('测试提示');
    expect(getNoticeMessages()).toHaveLength(1);
    expect(getNoticeMessages()[0]).toBe('测试提示');
    expect(document.querySelector('.bz-notice--info')).not.toBeNull();
  });

  it('自动归类：✅ → success、❌ → error、⚠️ → warning', () => {
    notice('✅ 完成');
    notice('❌ 失败');
    notice('⚠️ 警告');
    expect(document.querySelector('.bz-notice--success')).not.toBeNull();
    expect(document.querySelector('.bz-notice--error')).not.toBeNull();
    expect(document.querySelector('.bz-notice--warning')).not.toBeNull();
  });

  it('不再让路 smartCat（Q3 兼容分支已删除）', () => {
    (window as any).smartCat = { showBubble: vi.fn() };
    notice('气泡');
    expect(getNoticeMessages()).toHaveLength(1);
    delete (window as any).smartCat;
  });
});

describe('injectStyles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('幂等注入（data-shared-style 标记）', () => {
    injectStyles('test-id', 'body{color:red}');
    injectStyles('test-id', 'body{color:red}');
    expect(document.head.querySelectorAll('style[data-shared-style="test-id"]').length).toBe(1);
    expect(document.head.querySelector('style[data-shared-style="test-id"]')!.textContent).toBe('body{color:red}');
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
});

describe('createIconBtn', () => {
  it('生成按钮：文本/标题/点击/样式', () => {
    const onClick = vi.fn();
    const btn = createIconBtn('📌', '置顶', onClick);
    expect(btn.textContent).toBe('📌');
    expect(btn.title).toBe('置顶');
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    // jsdom 丢弃 background shorthand，hover 行为验证即可
    btn.dispatchEvent(new MouseEvent('mouseover'));
    expect(btn.style.background).toBe('var(--background-secondary)');
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

  it('mask/popup 结构与 z-index', () => {
    const { mask, popup } = createOverlay({ maskId: 'm', popupId: 'p', zIndex: 9999 });
    expect(mask.id).toBe('m');
    expect(popup.id).toBe('p');
    expect(mask.style.zIndex).toBe('9999');
    expect(popup.style.zIndex).toBe('10000');
    expect(mask.style.display).toBe('none');
    expect(popup.style.display).toBe('none');
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
