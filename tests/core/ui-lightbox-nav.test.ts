// @vitest-environment jsdom
/**
 * core 灯箱翻图导航（D 组拍板）：openLightbox 增加可选 items + index 多图模式——
 * ←→ 键与两侧箭头翻页、首末位箭头禁用（不循环，边界一眼可见）、描述逐张原位换；
 * 只传 src 的旧调用方零改动：不出箭头、不挂键监听，行为与改前逐项一致。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openLightbox, closeLightbox } from '../../src/core/ui/lightbox';

function pressKey(key: string, target: EventTarget = document.body): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

const items = [
  { src: 'a.png', caption: '第一张' },
  { src: 'b.png', caption: '第二张' },
  { src: 'c.png', caption: '第三张' },
];

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  closeLightbox();
});

describe('openLightbox 多图模式（items + index）', () => {
  it('渲染箭头与起始张：index 定位首帧，caption 上底部说明', () => {
    openLightbox({ title: '留影', items, index: 1 });
    expect(document.querySelector('.bz-lightbox')).not.toBeNull();
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('b.png');
    expect(document.querySelector('.bz-lightbox-foot')!.textContent).toBe('第二张');
    expect(document.querySelector('.bz-lightbox-prev')).not.toBeNull();
    expect(document.querySelector('.bz-lightbox-next')).not.toBeNull();
  });

  it('箭头翻页：下一张换媒体与说明；首末位箭头禁用（不循环）', () => {
    openLightbox({ items, index: 0 });
    const prev = document.querySelector<HTMLButtonElement>('.bz-lightbox-prev')!;
    const next = document.querySelector<HTMLButtonElement>('.bz-lightbox-next')!;
    expect(prev.disabled).toBe(true); // 首位：上一张禁用
    next.click();
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('b.png');
    expect(document.querySelector('.bz-lightbox-foot')!.textContent).toBe('第二张');
    expect(prev.disabled).toBe(false);
    next.click();
    next.click();
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('c.png');
    expect(next.disabled).toBe(true); // 末位：下一张禁用
    expect(prev.disabled).toBe(false);
    prev.click();
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('b.png');
  });

  it('←→ 键翻页；焦点在输入框里时不抢（输入框内移动光标不受影响）', () => {
    openLightbox({ items, index: 0 });
    pressKey('ArrowRight');
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('b.png');
    pressKey('ArrowLeft');
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('a.png');

    const inp = document.createElement('input');
    document.body.appendChild(inp);
    inp.focus();
    pressKey('ArrowRight', inp); // 焦点在输入框：不翻页
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('a.png');
  });

  it('srcOf 惰性取图（issue 519）：翻到哪张才取哪张，大组不在打开时全量拉字节', () => {
    const calls: number[] = [];
    const lazyItems = [
      { src: '', srcOf: () => { calls.push(0); return 'lazy-a.png'; } },
      { src: '', srcOf: () => { calls.push(1); return 'lazy-b.png'; } },
      { src: 'static-c.png' }, // 混用：静态 src 照旧
    ];
    openLightbox({ items: lazyItems, index: 0 });
    expect(calls).toEqual([0]); // 开页只取首张
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('lazy-a.png');
    document.querySelector<HTMLButtonElement>('.bz-lightbox-next')!.click();
    expect(calls).toEqual([0, 1]); // 翻页才取第二张，且不重复取第一张
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('lazy-b.png');
    document.querySelector<HTMLButtonElement>('.bz-lightbox-next')!.click();
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('static-c.png');
  });

  it('点箭头不触发「点背景关闭」；点背景照旧关闭；Esc 照旧关闭', () => {
    openLightbox({ items, index: 0 });
    document.querySelector<HTMLButtonElement>('.bz-lightbox-next')!.click();
    expect(document.querySelector('.bz-lightbox')).not.toBeNull(); // 箭头不算背景
    (document.querySelector('.bz-lightbox') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-lightbox')).toBeNull(); // 背景点击关闭

    openLightbox({ items, index: 0 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-lightbox')).toBeNull();
  });

  it('越界 index 收敛到末张；两张以内不出的箭头不出（单张 items 等价旧口径）', () => {
    openLightbox({ items, index: 99 });
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('c.png');
    closeLightbox();
    openLightbox({ items: [{ src: 'only.png' }] });
    expect(document.querySelector('.bz-lightbox-prev')).toBeNull();
    expect(document.querySelector('.bz-lightbox-next')).toBeNull();
    pressKey('ArrowRight'); // 无箭头也不挂键监听：不出错、不换页
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('only.png');
  });
});

describe('openLightbox 单图模式（旧调用方零改动）', () => {
  it('只传 src：不出箭头、不挂 ←→ 监听，Esc / 关闭钮照旧', () => {
    openLightbox({ src: 'x.png', title: '图' });
    expect(document.querySelector('.bz-lightbox-prev')).toBeNull();
    expect(document.querySelector('.bz-lightbox-next')).toBeNull();
    expect(document.querySelector('.bz-lightbox-title')!.textContent).toBe('图');
    pressKey('ArrowRight');
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('x.png');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-lightbox')).toBeNull();
  });

  it('单例口径不变：多图开着再开一个，旧的连键监听一并清掉', () => {
    openLightbox({ items, index: 0 });
    openLightbox({ items, index: 2 });
    expect(document.querySelectorAll('.bz-lightbox')).toHaveLength(1);
    pressKey('ArrowRight');
    // 仍收敛在末张（新会话自己的边界），说明旧监听没残留叠发
    expect((document.querySelector('.bz-lightbox-media img') as HTMLImageElement).src).toContain('c.png');
  });
});
