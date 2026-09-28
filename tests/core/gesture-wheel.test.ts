/**
 * 滚轮翻页「先让给原生滚动」的判定（issue 507 补）：
 * 滚轮常常压在 `<svg>` 上（lucide 图标、印环、图标化的字），而 SVGElement **不是** HTMLElement——
 * 早先那一版起跳写死 `node instanceof HTMLElement ? node : null`，压在图标上会当场落空，
 * 本该让给原生的块（详情正文 / 数据源列表）被误判成「点里没有可滚块」而把摊翻过去。
 *
 * 这里直接对 {@link bindWheelTurn} 下手（不经过任何域的壳），把三个边界钉死：
 * 压在 svg 上 → 块还能滚就让；块到底了 → 让出来翻；起点是普通元素时口径一致。
 */
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { bindWheelTurn } from '../../src/core/gesture';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 造一个「溢出可滚 + 内容超出」的块：jsdom 没有布局，三个量得手工钉住 */
function scrollBox(scrollHeight: number, clientHeight: number): HTMLElement {
  const box = document.createElement('div');
  box.style.overflowY = 'auto';
  let top = 0;
  Object.defineProperty(box, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(box, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(box, 'scrollTop', {
    get: () => top,
    set: (v: number) => { top = v; },
    configurable: true,
  });
  document.body.appendChild(box);
  return box;
}

/** 一个块 + 里面压着一个 svg 图标（滚轮的真实落点） */
function boxWithIcon(scrollHeight: number, clientHeight: number): { box: HTMLElement; icon: Element } {
  const box = scrollBox(scrollHeight, clientHeight);
  const svg = document.createElementNS(SVG_NS, 'svg'); // svg 与其子节点都是 SVGElement，不是 HTMLElement
  const icon = document.createElementNS(SVG_NS, 'path');
  svg.appendChild(icon);
  box.appendChild(svg);
  return { box, icon };
}

function roll(target: Element, deltaY: number): WheelEvent {
  const e = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('滚轮翻摊：点里能滚的块优先让给原生（svg 落点也要认得出）', () => {
  it('滚轮压在 svg 图标上、块还能往下滚 → 让给原生（不拦默认、不翻摊）', () => {
    const { icon } = boxWithIcon(400, 100);
    let turned = 0;
    const off = bindWheelTurn(document.body, () => { turned++; });

    const e = roll(icon, 120);
    expect(e.defaultPrevented).toBe(false);
    expect(turned).toBe(0);
    off();
  });

  it('块已经滚到底 → 让出来翻摊（压在 svg 上同理，一格不差）', () => {
    const { box, icon } = boxWithIcon(400, 100);
    box.scrollTop = 300; // 400 - 100 = 300：到底了，再往下就该翻
    let turned = 0;
    const off = bindWheelTurn(document.body, () => { turned++; });

    const e = roll(icon, 120);
    expect(e.defaultPrevented).toBe(true);
    expect(turned).toBe(1);
    off();
  });

  it('起点是普通元素（非 svg）时口径一致：还能滚就让、滚到底才翻', () => {
    const box = scrollBox(400, 100);
    const plain = document.createElement('span');
    box.appendChild(plain);
    let turned = 0;
    const off = bindWheelTurn(document.body, () => { turned++; });

    expect(roll(plain, 120).defaultPrevented).toBe(false);
    expect(turned).toBe(0);
    box.scrollTop = 300;
    expect(roll(plain, 120).defaultPrevented).toBe(true);
    expect(turned).toBe(1);
    off();
  });

  it('块外面（点里根本没有可滚的块）照旧翻摊', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    let turned = 0;
    const off = bindWheelTurn(document.body, () => { turned++; });

    expect(roll(outside, 120).defaultPrevented).toBe(true);
    expect(turned).toBe(1);
    off();
  });
});
