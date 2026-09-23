/**
 * 知识盒动效层测试（motion.ts）：
 * - jsdom / 无 WAAPI 宿主零感知：所有编排函数直通，不抛错、不写内联残留、退场同步收口；
 * - ?rm=1（评审模拟 RM）直通终态；
 * - 退场簿记：closing 标志防重复关闭、收口清标志、重开作废在途退场；
 * - boot 消费语义由 ui.ts 持有 motionCue，这里只验 motion 层对 cue 的响应（silent 零动作）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  motionMainIn, motionMainOut, motionClosing, motionLitReveal, motionCardsAppended,
  motionStampBadge, motionSheetIn, motionSheetOut, motionVideoIn, motionVideoOut, motionVideoRows,
  motionAddIn, motionAddReveal, motionEntryIn, motionEntryOut, motionEntryPenOn, motionPenOff,
  motionPreviewBody, motionTreeIn, motionTreeOut, motionTreeCards, motionTreeEdges, motionTreeMenu,
  motionTeardown,
} from '../../src/knowledge/motion';

function win(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bz-kb-window kb';
  el.innerHTML = `
    <div class="bz-kb-head"><div class="bz-kb-brand"><span class="bz-kb-top">T</span><span class="bz-kb-title">题</span></div></div>
    <button class="bz-kb-part">部壹</button><button class="bz-kb-part">部贰</button>
    <div class="bz-kb-sc"></div>`;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  motionTeardown();
});

describe('无 WAAPI 宿主（jsdom）：零感知直通', () => {
  it('motionMainIn 不抛错、不写内联样式、标题无 clip 残留', () => {
    const w = win();
    expect(() => motionMainIn(w)).not.toThrow();
    expect(w.style.opacity).toBe('');
    const title = w.querySelector<HTMLElement>('.bz-kb-title')!;
    expect(title.style.clipPath).toBe('');
    // 注入件（双细线）在无 WAAPI 宿主立即撤除：终态与静态版一致
    expect(w.querySelector('.bz-kb-headline')).toBeNull();
  });

  it('motionMainOut 同步收口（done 立即调用，display:none 不晚到）', () => {
    const w = win();
    let closed = false;
    motionMainOut(w, () => { closed = true; });
    expect(closed).toBe(true);
    expect(motionClosing(w)).toBe(false);
  });

  it('closing 簿记：无 WAAPI 收口为同步（done 幂等可重入）；teardown 后标志清零', () => {
    const w = win();
    let calls = 0;
    motionMainOut(w, () => { calls++; });
    // 无 WAAPI：退场同步收口（done 立即、标志即清）——重复关闭再进来也安全幂等
    motionMainOut(w, () => { calls++; });
    expect(calls).toBe(2);
    expect(motionClosing(w)).toBe(false);
    motionTeardown();
    expect(motionClosing(w)).toBe(false);
  });

  it('内容揭出对 silent 直通、对 boot/part 直通（无 WAAPI 无副作用）', () => {
    const sc = document.createElement('div');
    sc.innerHTML = '<div class="bz-kb-lexrow">a</div><div class="bz-kb-lexrow">b</div><div class="bz-kb-empty">空</div>';
    expect(() => motionLitReveal(sc, 'silent')).not.toThrow();
    expect(() => motionLitReveal(sc, 'boot')).not.toThrow();
    expect(() => motionLitReveal(sc, 'part')).not.toThrow();
    const rows = document.createElement('div');
    rows.innerHTML = '<div>x</div><div>y</div>';
    expect(() => motionCardsAppended(rows, 1, 'part')).not.toThrow();
    expect(() => motionCardsAppended(rows, 0, 'silent')).not.toThrow(); // 后台重建静默
  });

  it('盖章 / 预览 / 显影 / 展开释义等一次性编排直通不抛', () => {
    const badge = document.createElement('span');
    expect(() => motionStampBadge(badge)).not.toThrow();
    const ovl = document.createElement('div');
    ovl.className = 'bz-kb-ovl';
    ovl.innerHTML = '<div class="bz-kb-sheet"><div class="bz-kb-sheet-head"></div><div id="bz-kb-preview-body"><p>a</p></div><span class="bz-kb-cite">r</span></div>';
    expect(() => motionSheetIn(ovl)).not.toThrow();
    expect(() => motionPreviewBody(ovl)).not.toThrow();
    let removed = false;
    motionSheetOut(ovl, () => { removed = true; });
    expect(removed).toBe(true);
    const vp = win();
    expect(() => motionVideoIn(vp)).not.toThrow();
    expect(() => motionVideoRows(vp, 'part')).not.toThrow();
    let vClosed = false;
    motionVideoOut(vp, () => { vClosed = true; });
    expect(vClosed).toBe(true);
    expect(() => motionAddIn(vp)).not.toThrow();
    const more = document.createElement('div');
    more.innerHTML = '<div class="bz-lit-term-row"></div>';
    expect(() => motionAddReveal(more)).not.toThrow();
    expect(() => motionEntryIn(vp)).not.toThrow();
    let tClosed = false;
    motionEntryOut(vp, () => { tClosed = true; });
    expect(tClosed).toBe(true);
  });

  it('挂载树编排直通：上墙 / 描线（jsdom 无 getTotalLength 不抛）/ 菜单 / 升板收板', () => {
    const world = document.createElement('div');
    world.innerHTML = '<div class="bz-kb-mt-node is-root" data-mt-id="root"></div><div class="bz-kb-mt-node is-ghost" data-mt-id="g1"></div>';
    expect(() => motionTreeCards(world, { fresh: true, rootId: 'root' })).not.toThrow();
    expect(() => motionTreeCards(world, { fresh: false, rootId: 'root' })).not.toThrow();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = '<path class="bz-kb-mt-edge" d="M0 0 L10 10"></path><path class="bz-kb-mt-edge is-sug" d="M0 0 L10 10"></path>';
    expect(() => motionTreeEdges(svg)).not.toThrow();
    const menu = document.createElement('div');
    expect(() => motionTreeMenu(menu)).not.toThrow();
    const tw = win();
    motionTreeIn(tw, true);
    motionTreeIn(tw, false); // 抬层重入不重播（直通）
    let treeClosed = false;
    motionTreeOut(tw, () => { treeClosed = true; });
    expect(treeClosed).toBe(true);
  });

  it('墨滴句柄池：起笔注入 + 收笔移除，无永动孤儿', () => {
    const card = document.createElement('div');
    card.className = 'bz-lit-term-card';
    document.body.appendChild(card);
    motionEntryPenOn(card);
    expect(card.querySelector('.bz-kb-pen')).not.toBeNull();
    motionPenOff();
    expect(card.querySelector('.bz-kb-pen')).toBeNull();
    motionEntryPenOn(card);
    motionEntryOut(document.createElement('div'), () => {}); // 退场路径内置收笔
    motionPenOff();
    expect(document.querySelectorAll('.bz-kb-pen').length).toBe(0);
  });
});
