/**
 * core 遮罩点击关闭判据（bindMaskDismiss）
 *
 * A 行为：只有「按下与抬起都落在遮罩本体、且本次手势没有拖动」才关闭——
 *   弹窗内选字划到遮罩上松手、遮罩上误按滑进弹窗、拖出去再拖回来，一律不算点击。
 * B 守卫：全仓禁止再手写裸判据（`e.target === mask` 那一族）与遮罩 `.onclick` 赋值。
 *   这两条是「选字误关」回流的唯一入口：新弹窗照抄旧弹窗就会带回来，靠测试卡住而不是靠记性。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { bindMaskDismiss } from '../../src/core/mask-dismiss';

function mount(): { mask: HTMLDivElement; popup: HTMLDivElement; calls: number[] } {
  document.body.innerHTML = '';
  const mask = document.createElement('div');
  mask.className = 'bz-overlay-mask';
  const popup = document.createElement('div');
  popup.className = 'bz-overlay-popup';
  mask.appendChild(popup);
  document.body.appendChild(mask);
  const calls: number[] = [];
  bindMaskDismiss(mask, () => calls.push(1));
  return { mask, popup, calls };
}

function fire(el: Element, type: string, x = 0, y = 0, button = 0): void {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button }));
}

describe('遮罩点击关闭 · 手势配对', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('明确点遮罩空白：关闭', () => {
    const { mask, calls } = mount();
    fire(mask, 'mousedown', 10, 10);
    fire(mask, 'mouseup', 10, 10);
    fire(mask, 'click', 10, 10);
    expect(calls).toHaveLength(1);
  });

  it('弹窗内选字、鼠标划到遮罩上松手：不关', () => {
    const { mask, popup, calls } = mount();
    fire(popup, 'mousedown', 100, 100);
    fire(popup, 'mousemove', 160, 40);
    fire(mask, 'mouseup', 300, 30);
    fire(mask, 'click', 300, 30); // 跨元素松手时 click 派发在共同祖先（遮罩）上
    expect(calls).toHaveLength(0);
  });

  it('遮罩上误按、滑进弹窗松手：不关', () => {
    const { mask, popup, calls } = mount();
    fire(mask, 'mousedown', 5, 5);
    fire(popup, 'mouseup', 120, 120);
    fire(mask, 'click', 120, 120);
    expect(calls).toHaveLength(0);
  });

  it('遮罩上按下、拖出去再拖回来松手：净位移归零也作废（靠轨迹不靠首尾）', () => {
    const { mask, popup, calls } = mount();
    fire(mask, 'mousedown', 10, 10);
    fire(popup, 'mousemove', 400, 400);
    fire(mask, 'mousemove', 12, 11);
    fire(mask, 'mouseup', 12, 11);
    fire(mask, 'click', 12, 11);
    expect(calls).toHaveLength(0);
  });

  it('拖拽作废只作用于那一次手势：下一次正常点击照关', () => {
    const { mask, popup, calls } = mount();
    fire(mask, 'mousedown', 10, 10);
    fire(popup, 'mousemove', 400, 400);
    fire(mask, 'mouseup', 400, 400);
    fire(mask, 'click', 400, 400);
    fire(mask, 'mousedown', 20, 20);
    fire(mask, 'mouseup', 20, 20);
    fire(mask, 'click', 20, 20);
    expect(calls).toHaveLength(1);
  });

  it('点弹窗内容：不关', () => {
    const { popup, calls } = mount();
    fire(popup, 'mousedown');
    fire(popup, 'mouseup');
    fire(popup, 'click');
    expect(calls).toHaveLength(0);
  });

  it('只派发 click（合成事件，无按下记录）：沿用旧判法放行', () => {
    const { mask, calls } = mount();
    fire(mask, 'click');
    expect(calls).toHaveLength(1);
  });

  it('触屏长按被系统接管（touchcancel）后补发 click：不关', () => {
    const { mask, calls } = mount();
    mask.dispatchEvent(new Event('touchstart', { bubbles: true }));
    mask.dispatchEvent(new Event('touchcancel', { bubbles: true }));
    fire(mask, 'click');
    expect(calls).toHaveLength(0);
  });

  it('非主键按下不武装：右键那一刻不产生关闭', () => {
    const { mask, calls } = mount();
    fire(mask, 'mousedown', 10, 10, 2);
    fire(mask, 'mouseup', 10, 10, 2);
    fire(mask, 'click', 10, 10);
    expect(calls).toHaveLength(1); // 右键本不派发 click；若派发则回落宽松分支，不做额外拦截
  });
});

/** 遮罩变量名族：这些名字在本仓专指遮罩/浮层容器 */
const MASK_VARS = 'addMask|statsMask|histMask|overlayEl|overlay|mask|ovl|ov';

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTs(p, out);
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('守卫：遮罩点击关闭必须走 bindMaskDismiss', () => {
  const srcDir = resolve(process.cwd(), 'src');
  const files = walkTs(srcDir).filter((p) => !p.endsWith('mask-dismiss.ts'));

  it('不得手写 e.target === <遮罩变量> 判据', () => {
    const re = new RegExp(`target\\s*===\\s*(?:${MASK_VARS})\\b`);
    const bad = files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(process.cwd(), f));
    expect(bad, '改用 bindMaskDismiss（src/core/mask-dismiss.ts）').toEqual([]);
  });

  it('不得给遮罩挂 .onclick 赋值', () => {
    const re = new RegExp(`\\b(?:${MASK_VARS})\\.onclick\\s*=`);
    const bad = files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(process.cwd(), f));
    expect(bad, '改用 bindMaskDismiss（src/core/mask-dismiss.ts）').toEqual([]);
  });
});
