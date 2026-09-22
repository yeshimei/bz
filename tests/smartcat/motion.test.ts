/**
 * smartcat 动效层测试（motion.ts）：jsdom 无 WAAPI 是常态宿主——
 * ① 无 animate：全部场景零崩溃、零 DOM 写入、退场同步收口（时序与今天一致）；
 * ② stub animate：编排关键帧/延时/循环句柄按台账落地；
 * ③ ?rm=1：全部静默直达终态；
 * ④ 关→开竞态：epoch 守卫——退场收口不得藏掉复用节点的新入场。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  motionMarkBoot, motionCatArrival, motionCatRecall, motionCatSlink, motionCatRecoat,
  motionCatLift, motionPetBurst, motionThinkingPing,
  motionBubbleIn, motionBubblePin,
  motionChatIn, motionChatOut, motionChatMessage,
  motionDashIn, motionDashOut, motionDashRendered, motionDashTab, motionDashBatch, motionDashFilter,
  motionTeardown,
} from '../../src/smartcat/motion';

interface Recorded { el: HTMLElement; frames: Keyframe[]; opts: KeyframeAnimationOptions }

/** animate 桩：记录调用；deferred 模式下手控 finished（竞态测试用） */
function installAnimate(opts?: { deferred?: boolean }): {
  calls: Recorded[];
  fakes: { cancel: ReturnType<typeof vi.fn>; resolve: () => void; reject: () => void }[];
} {
  const calls: Recorded[] = [];
  const fakes: { cancel: ReturnType<typeof vi.fn>; resolve: () => void; reject: () => void }[] = [];
  (HTMLElement.prototype as unknown as Record<string, unknown>).animate = function (
    this: HTMLElement, frames: Keyframe[], o: KeyframeAnimationOptions,
  ) {
    calls.push({ el: this, frames, opts: o });
    let res = (): void => {}; let rej = (): void => {};
    const finished = new Promise<void>((r, j) => { res = r; rej = j; });
    const fake = {
      cancel: vi.fn(() => rej()),
      resolve: () => res(),
      reject: () => rej(),
    };
    fakes.push(fake);
    if (!opts?.deferred) res();
    return { cancel: fake.cancel, finished } as unknown as Animation;
  };
  return { calls, fakes };
}

function uninstallAnimate(): void {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).animate;
}

/** 搭一个猫容器（与 ui.ts CAT_HTML 同构） */
function mountCat(): HTMLElement {
  const c = document.createElement('div');
  c.id = 'smart-companion-cat';
  c.innerHTML = '<div class="thinking-indicator" id="thinking-indicator"></div>'
    + '<div class="cat-bubbles-container" id="cat-bubbles-container"></div>'
    + '<div class="cat-body" id="cat-body"><div class="cat-ear cat-ear-left"></div>'
    + '<div class="cat-ear cat-ear-right"></div><div class="cat-tail"></div></div>';
  document.body.appendChild(c);
  return c;
}

/** 搭一个聊天壳 */
function mountChat(): { mask: HTMLElement; popup: HTMLElement } {
  const mask = document.createElement('div');
  const popup = document.createElement('div');
  popup.innerHTML = '<div class="chat-messages">'
    + '<div class="message cat-message">你好</div><div class="message user-message">嗨</div></div>'
    + '<div class="chat-input-area"><textarea class="chat-input"></textarea></div>';
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  return { mask, popup };
}

/** 搭一个数据面板 pane（总览形貌的极简版） */
function mountPane(): HTMLElement {
  const pane = document.createElement('div');
  pane.innerHTML = '<div class="bz-sc-dash-card"><span class="bz-sc-dash-hero-emoji">😺</span></div>'
    + '<div class="bz-sc-dash-card"><div class="bz-sc-dash-row"><div class="bz-sc-dash-row-fill"></div></div></div>'
    + '<div class="bz-sc-dash-stats"><div class="bz-sc-dash-stat-num">1226</div></div>';
  document.body.appendChild(pane);
  return pane;
}

beforeEach(() => {
  document.body.innerHTML = '';
  uninstallAnimate();
});

afterEach(() => {
  motionTeardown();
  uninstallAnimate();
});

describe('无 WAAPI 宿主（jsdom 常态）', () => {
  it('全部场景零崩溃、零 animate 调用、退场同步收口', () => {
    const c = mountCat();
    const { mask, popup } = mountChat();
    let slinkDone = false;
    let chatDone = false;
    let dashDone = false;
    motionCatArrival(c);
    motionCatRecall(c);
    motionCatSlink(c, () => { slinkDone = true; });
    motionCatRecoat(c);
    motionCatLift(c, true);
    motionCatLift(c, false);
    motionPetBurst(c);
    motionThinkingPing(c.querySelector('#thinking-indicator'));
    motionBubbleIn(document.createElement('div'));
    motionBubblePin(document.createElement('div'));
    motionChatIn(mask, popup);
    motionChatOut(mask, popup, () => { chatDone = true; });
    motionChatMessage(document.createElement('div'), 'cat');
    motionDashIn(mask, popup);
    motionDashOut(mask, popup, () => { dashDone = true; });
    motionDashRendered(mountPane(), true);
    motionDashTab(mountPane());
    motionDashBatch([document.createElement('div')]);
    motionDashFilter(mountPane());
    motionTeardown();
    expect(slinkDone).toBe(true); // 同步收口：隐藏时序与今天一致
    expect(chatDone).toBe(true);
    expect(dashDone).toBe(true);
    expect(document.querySelectorAll('[data-bz-sc-motion]').length).toBe(0); // 零注入
  });

  it('boot 消费：markBoot 前 arrival 也安全（短版），teardown 复位标志', () => {
    const c = mountCat();
    expect(() => motionCatArrival(c)).not.toThrow();
    motionMarkBoot();
    motionTeardown();
    expect(() => motionCatArrival(c)).not.toThrow();
  });
});

describe('stub animate（真编排路径）', () => {
  it('boot 登场 = 完整版 620ms；未 markBoot = 短版 400ms（消费即熄）', () => {
    const { calls } = installAnimate();
    const c = mountCat();
    motionMarkBoot();
    motionCatArrival(c);
    const entry = calls.find((r) => r.el === c);
    expect(entry).toBeDefined();
    expect(entry!.opts.duration).toBe(620);
    expect(calls.length).toBeGreaterThan(1); // 尾巴/爪印编排同场
    motionMarkBoot();
    motionTeardown();
    const calls2 = installAnimate().calls;
    motionCatArrival(c);
    const entry2 = calls2.find((r) => r.el === c);
    expect(entry2!.opts.duration).toBe(400); // boot 已被上一场消费
  });

  it('登场/气泡位移帧携带容器基础 transform: translateX(-50%)（几何不改写）', () => {
    const { calls } = installAnimate();
    const c = mountCat();
    motionMarkBoot();
    motionCatArrival(c);
    const entry = calls.find((r) => r.el === c)!;
    for (const f of entry.frames) {
      expect(String((f as Keyframe).transform)).toContain('translateX(-50%)');
    }
    const bubble = document.createElement('div');
    motionBubbleIn(bubble);
    const bub = calls.filter((r) => r.el === bubble);
    expect(bub.length).toBe(1);
    for (const f of bub[0].frames) {
      expect(String((f as Keyframe).transform)).toContain('var(--bz-sc-shift');
    }
  });

  it('档案台首屏编排：条生长带 transform-origin 收尾清、数字滚动不写 animate、英雄呼吸入循环档', () => {
    const { calls } = installAnimate();
    const pane = mountPane();
    motionDashRendered(pane, true);
    const fill = pane.querySelector<HTMLElement>('.bz-sc-dash-row-fill')!;
    const fillCall = calls.find((r) => r.el === fill);
    expect(fillCall).toBeDefined();
    expect(fillCall!.frames[0].transform).toBe('scaleX(0)');
    expect(fill.style.transformOrigin).toContain('left');
    const hero = pane.querySelector<HTMLElement>('.bz-sc-dash-hero-emoji')!;
    const heroCall = calls.find((r) => r.el === hero);
    expect(heroCall!.opts.iterations).toBe(Infinity); // 常驻循环
    // 数字滚动走 tween（rAF），不进 animate：animate 调用里没有 stat-num
    const num = pane.querySelector<HTMLElement>('.bz-sc-dash-stat-num')!;
    expect(calls.some((r) => r.el === num)).toBe(false);
    expect(num.textContent).toBe('1226'); // 渲染层终态不被同步改写
  });

  it('非 boot（静默自动刷新）不重播编排', () => {
    const { calls } = installAnimate();
    motionDashRendered(mountPane(), false);
    expect(calls.length).toBe(0);
  });

  it('行为流新批：接力延时代码落在 opts.delay（cap 20）', () => {
    const { calls } = installAnimate();
    const items = Array.from({ length: 25 }, () => document.createElement('div'));
    motionDashBatch(items);
    expect(calls.length).toBe(20);
    expect(calls[0].opts.delay).toBe(0);
    expect(calls[19].opts.delay).toBe(19 * 24);
  });

  it('拎起挂起态 fill:forwards 入池，放下必收（cancel 调用）', async () => {
    const { calls, fakes } = installAnimate();
    const c = mountCat();
    expect(motionCatLift(c, true)).toBe(true);
    expect(calls.filter((r) => r.opts.fill === 'forwards').length).toBe(3); // 双耳 + 尾巴
    expect(motionCatLift(c, true)).toBe(false); // 已拎起：不重复
    expect(motionCatLift(c, false)).toBe(true);
    expect(fakes.filter((f) => f.cancel.mock.calls.length > 0).length).toBe(3); // 挂起态全撤
    expect(motionCatLift(c, false)).toBe(false); // 空抖毛守卫
  });

  it('rm=1：全部静默直达终态（零 animate、零内联写入）', () => {
    window.history.replaceState(null, '', '/?rm=1');
    const { calls } = installAnimate();
    const c = mountCat();
    const { mask, popup } = mountChat();
    let slinkDone = false;
    motionCatSlink(c, () => { slinkDone = true; });
    motionChatIn(mask, popup);
    motionCatArrival(c);
    motionPetBurst(c);
    expect(slinkDone).toBe(true);
    expect(calls.length).toBe(0);
    expect(popup.getAttribute('style')).toBeNull();
    expect(c.querySelector('[data-bz-sc-motion]')).toBeNull();
    window.history.replaceState(null, '', '/');
  });

  it('关→开竞态（epoch 守卫）：退场收口不得藏掉复用壳的新入场', async () => {
    const { fakes } = installAnimate({ deferred: true });
    const { mask, popup } = mountChat();
    popup.style.display = 'flex';
    let chatDone = false;
    motionChatOut(mask, popup, () => { chatDone = true; }); // 关：退场在飞
    motionChatIn(mask, popup); // 立刻重开（代数 +1，入场接管）
    fakes[0].resolve(); // 退场动画迟到收口
    await Promise.resolve();
    await Promise.resolve();
    expect(chatDone).toBe(false); // 不抢新入场的显示权
    expect(popup.style.display).toBe('flex');
  });

  it('溜走→召回竞态：退场收口不得摘掉复用的猫容器', async () => {
    const { fakes } = installAnimate({ deferred: true });
    const c = mountCat();
    let slinkDone = false;
    motionCatSlink(c, () => { slinkDone = true; });
    motionCatRecall(c); // 召回（代数 +1，容器复用）
    fakes[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(slinkDone).toBe(false);
    expect(c.isConnected).toBe(true);
  });

  it('motionTeardown：注入件残渣全收', () => {
    vi.useFakeTimers();
    installAnimate();
    const c = mountCat();
    motionPetBurst(c);
    vi.advanceTimersByTime(350); // 三枚爪印的注入调度全部到期
    expect(c.querySelectorAll('[data-bz-sc-motion]').length).toBe(3);
    motionTeardown();
    expect(document.querySelectorAll('[data-bz-sc-motion]').length).toBe(0);
    vi.useRealTimers();
  });
});
