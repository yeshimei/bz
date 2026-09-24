/**
 * core/landscape · 软横屏几何换算单源
 *
 * 桌面偏移回归（issue 431）：boxLogicalPoint/Rect 的返回值消费方（开卷幕字靶/盒壁）
 * 直接当**画布坐标**用，而画布满铺层框内——非旋转态必须同样以层框左上角为原点，
 * 否则桌面面板不贴窗口左上角时整面偏移 (box.left, box.top)（移动端面板满屏看不出来）。
 * 旋转态（is-rot90）口径有真机验证背书，这里一并锁住防回归。
 */
import { describe, it, expect } from 'vitest';
import { fitRotatedBox, boxLogicalPoint, boxLogicalRect, hostLocalPx } from '../../src/core/landscape';

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ x: left, y: top, width, height, left, top, right: left + width, bottom: top + height, toJSON() { return this; } } as DOMRect);

function stubRect(el: HTMLElement, r: DOMRect): void {
  el.getBoundingClientRect = () => r;
}
function stubOffset(el: HTMLElement, w: number, h: number): void {
  Object.defineProperty(el, 'offsetWidth', { value: w, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: h, configurable: true });
}

describe('boxLogicalPoint（视口点 → 层框逻辑点）', () => {
  it('非旋转态：减层框左上角——桌面层框不贴窗口原点也不偏（issue 431 回归）', () => {
    const box = document.createElement('div');
    stubRect(box, rect(300, 120, 800, 600));
    // 层框正中：视口 (700,400) − 原点 (300,120) = 画布 (400,280)
    expect(boxLogicalPoint(box, 700, 400)).toEqual({ x: 400, y: 280 });
    // 层框左上角自身 → 原点
    expect(boxLogicalPoint(box, 300, 120)).toEqual({ x: 0, y: 0 });
  });

  it('旋转态：换轴反向，仍以层框左上角为原点（真机口径回归锁）', () => {
    const box = document.createElement('div');
    box.classList.add('is-rot90');
    stubRect(box, rect(0, 0, 412, 915)); // 视觉竖框
    stubOffset(box, 915, 412);           // 布局横框（fitRotatedBox 转置后）
    expect(boxLogicalPoint(box, 206, 457.5)).toEqual({ x: 457.5, y: 206 }); // 视觉正中 = 逻辑正中
    expect(boxLogicalPoint(box, 0, 0)).toEqual({ x: 0, y: 412 });           // 视觉左上 = 逻辑左下
  });
});

describe('boxLogicalRect（视口矩形 → 层框逻辑矩形）', () => {
  it('非旋转态：平移到层框系，宽高不变（issue 431 回归）', () => {
    const box = document.createElement('div');
    stubRect(box, rect(300, 120, 800, 600));
    expect(boxLogicalRect(box, 300, 120, 1100, 720)).toEqual({ left: 0, top: 0, right: 800, bottom: 600 });
    expect(boxLogicalRect(box, 500, 220, 600, 320)).toEqual({ left: 200, top: 100, right: 300, bottom: 200 });
  });

  it('旋转态：宽高互换取包围盒', () => {
    const box = document.createElement('div');
    box.classList.add('is-rot90');
    stubRect(box, rect(0, 0, 412, 915));
    stubOffset(box, 915, 412);
    expect(boxLogicalRect(box, 0, 0, 412, 915)).toEqual({ left: 0, top: 0, right: 915, bottom: 412 });
  });
});

describe('hostLocalPx（客户端点 → 宿主内逻辑像素）', () => {
  it('无旋转层：宿主矩形直接作差（既有口径）', () => {
    const host = document.createElement('div');
    stubRect(host, rect(100, 100, 400, 200));
    expect(hostLocalPx(host, 150, 130)).toEqual({ x: 50, y: 30 });
  });

  it('旋转层内：宿主与指针都先换算到层框逻辑系再作差', () => {
    const box = document.createElement('div');
    box.classList.add('is-rot90');
    stubRect(box, rect(0, 0, 412, 915));
    stubOffset(box, 915, 412);
    const host = document.createElement('div');
    box.appendChild(host);
    stubRect(host, rect(0, 0, 412, 915)); // 宿主满铺层框
    expect(hostLocalPx(host, 100, 200)).toEqual({ x: 200, y: 312 });
  });
});

describe('fitRotatedBox（层框几何 = 面板矩形）', () => {
  it('桌面（mobile=false）：不转，层框矩形 = 面板矩形', () => {
    const box = document.createElement('div');
    const panel = document.createElement('div');
    stubRect(panel, rect(100, 50, 800, 600));
    expect(fitRotatedBox(box, panel, false)).toEqual({ rot: false, w: 800, h: 600 });
    expect(box.classList.contains('is-rot90')).toBe(false);
    expect(box.style.left).toBe('100px');
    expect(box.style.top).toBe('50px');
    expect(box.style.width).toBe('800px');
    expect(box.style.height).toBe('600px');
  });

  it('移动竖屏：宽高对调 + is-rot90 + 居中', () => {
    const box = document.createElement('div');
    const panel = document.createElement('div');
    stubRect(panel, rect(10, 20, 412, 915));
    expect(fitRotatedBox(box, panel, true)).toEqual({ rot: true, w: 915, h: 412 });
    expect(box.classList.contains('is-rot90')).toBe(true);
    expect(box.style.left).toBe('-241px'); // 10 + (412−915)/2
    expect(box.style.top).toBe('272px');   // 20 + (915−412)/2
    expect(box.style.width).toBe('915px');
    expect(box.style.height).toBe('412px');
  });

  it('移动横屏（面板本就宽>高）：不转', () => {
    const box = document.createElement('div');
    const panel = document.createElement('div');
    stubRect(panel, rect(0, 0, 915, 412));
    expect(fitRotatedBox(box, panel, true)).toEqual({ rot: false, w: 915, h: 412 });
    expect(box.classList.contains('is-rot90')).toBe(false);
  });

  it('面板没几何（null / 过小）：返回 null 走调用方 CSS 兜底', () => {
    const box = document.createElement('div');
    expect(fitRotatedBox(box, null, true)).toBeNull();
    const panel = document.createElement('div');
    stubRect(panel, rect(0, 0, 30, 30));
    expect(fitRotatedBox(box, panel, true)).toBeNull();
  });
});
