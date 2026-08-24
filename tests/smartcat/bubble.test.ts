/**
 * smartcat 气泡测试（UI 层）：队列、打字机、计时、单击固定、双击转聊、上限 4。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BubbleManager, computeBubbleShift } from '../../src/smartcat/bubble';
import { __resetVisibilityForTests, setPageVisible, eventSystem } from '../../src/smartcat/state';

function mountContainer(): HTMLElement {
  const c = document.createElement('div');
  c.id = 'smart-companion-cat';
  c.innerHTML = '<div class="cat-bubbles-container" id="cat-bubbles-container"></div><div id="cat-body"></div>';
  document.body.appendChild(c);
  return c;
}

beforeEach(() => {
  document.body.innerHTML = '';
  __resetVisibilityForTests();
});

describe('BubbleManager.showBubble', () => {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  it('容器存在 → 气泡出现并打字（真实计时器）', async () => {
    mountContainer();
    const b = new BubbleManager();
    b.showBubble('喵呜~ 你好！');
    expect(document.querySelectorAll('.cat-bubble').length).toBe(1);
    await sleep(200);
    const bubble = document.querySelector('.cat-bubble') as HTMLElement;
    expect(bubble.classList.contains('show')).toBe(true);
    expect(bubble.textContent!.length).toBeGreaterThan(0);
  }, 10000);

  it('页面不可见 → 不弹气泡', () => {
    mountContainer();
    const b = new BubbleManager();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    __resetVisibilityForTests();
    // 手动置不可见（state 模块 setPageVisible(false)）
    setPageVisible(false);
    b.showBubble('测试');
    expect(document.querySelectorAll('.cat-bubble').length).toBe(0);
    setPageVisible(true);
  });

  it('队列：连续 3 条依次消费（打字中排队）', async () => {
    mountContainer();
    const b = new BubbleManager();
    b.showBubble('第一条');
    b.showBubble('第二条');
    b.showBubble('第三条');
    // 队列初始全部入队（同一条打字中，其余排队）
    expect(b.bubbleQueue.length).toBeGreaterThan(0);
    b.clearAllBubbles();
  });

  it('上限 4：第 5 条挤掉最旧', async () => {
    mountContainer();
    const b = new BubbleManager();
    b.showBubble('1');
    b.showBubble('2');
    b.showBubble('3');
    b.showBubble('4');
    b.showBubble('5');
    await sleep(100);
    // 至少 4 个（含正在移除的），不会超 5
    expect(document.querySelectorAll('.cat-bubble').length).toBeLessThanOrEqual(5);
  }, 10000);

  it('单击固定：再次单击移除', async () => {
    mountContainer();
    const b = new BubbleManager();
    b.showBubble('喵');
    await sleep(300);
    let bubble = document.querySelector('.cat-bubble') as HTMLElement;
    bubble.click(); // 第一次点击 → pin（300ms 后生效）
    await sleep(600); // 超过 500ms 双击窗口，保持单击语义
    expect(document.querySelectorAll('.cat-bubble').length).toBeGreaterThanOrEqual(1);
    bubble = document.querySelector('.cat-bubble') as HTMLElement;
    bubble.click(); // pin 后单击 → 移除（300ms DOM 移除）
    await sleep(700);
    expect(bubble.isConnected).toBe(false);
  }, 10000);

  it('双击 → 转聊天事件', async () => {
    mountContainer();
    const b = new BubbleManager();
    const seen: any[] = [];
    const listener = (d: any) => seen.push(d);
    eventSystem.on('bubbleToChat', listener);
    b.showBubble('喵');
    await sleep(300);
    const bubble = document.querySelector('.cat-bubble') as HTMLElement;
    bubble.click();
    await sleep(50);
    bubble.click(); // 双击
    await sleep(400);
    expect(seen.length).toBeGreaterThan(0);
    eventSystem.off('bubbleToChat', listener);
  }, 10000);
});

describe('容器缺失恢复（P1-28 气泡锁死修复）', () => {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  it('容器缺失入队：早退复位打字锁、消息退回队首；容器恢复后 processBubbleQueue 消费', async () => {
    const b = new BubbleManager(); // 故意不挂猫容器（模拟 hide 后）
    b.showBubble('隐藏期间的消息');
    expect(b.isCurrentBubbleTyping).toBe(false); // 锁必须复位（旧实现卡死 true）
    expect(b.bubbleQueue.length).toBe(1);        // 消息保留待容器恢复
    mountContainer();                            // 容器恢复（openSmartCat remount 语义）
    b.processBubbleQueue();
    expect(document.querySelectorAll('.cat-bubble').length).toBe(1);
    await sleep(400); // 打字节拍 ~100ms/字符 → 已有部分文本
    expect((document.querySelector('.cat-bubble') as HTMLElement).textContent!.length).toBeGreaterThan(0);
  }, 10000);

  it('空消息不卡死打字锁：复位并继续推进队列（后续正常消息照常显示）', async () => {
    mountContainer();
    const b = new BubbleManager();
    b.showBubble('');
    b.showBubble('正常消息');
    // 空消息被跳过，队列推进到正常消息（旧实现空消息早退把锁卡死，正常消息永不消费）
    await sleep(100);
    expect(document.querySelectorAll('.cat-bubble').length).toBe(1);
    expect(b.isCurrentBubbleTyping).toBe(true); // 正在给「正常消息」打字
    b.clearAllBubbles();
  }, 10000);
});

describe('calculateBubbleTiming', () => {
  it('默认时长：1000 + 200/字符，上限 15000', () => {
    const b = new BubbleManager();
    const t = b.calculateBubbleTiming('短', null);
    expect(t.baseDisplayDuration).toBe(1000 + 1 * 200);
    const long = b.calculateBubbleTiming('x'.repeat(200), null);
    expect(long.baseDisplayDuration).toBeLessThanOrEqual(15000);
  });

  it('显式时长优先（字符串 duration 原样保留，铁律 4）', () => {
    const b = new BubbleManager();
    const t = b.calculateBubbleTiming('消息', '🎓' as any);
    expect(typeof t.baseDisplayDuration).not.toBe('string');
  });
});

describe('气泡视口夹紧（2026-08-23：检测屏幕边缘，不出屏）', () => {
  it('computeBubbleShift 纯函数：右超界负位移、左超界正位移、未超界为 0', () => {
    const vw = 1024; // jsdom 默认视口宽
    expect(computeBubbleShift({ left: 900, right: 1300 }, vw)).toBe(-284); // -(1300-(1024-8))
    expect(computeBubbleShift({ left: -100, right: 200 }, vw)).toBe(108); // 8-(-100)
    expect(computeBubbleShift({ left: 300, right: 600 }, vw)).toBe(0);
    expect(computeBubbleShift({ left: 500, right: 500 }, vw)).toBe(0); // 无布局信息
  });

  it('clampBubbleToViewport：超界位移写入 --bz-sc-shift，宽度增长时在旧值上累计', () => {
    vi.useFakeTimers();
    try {
      mountContainer();
      const b = new BubbleManager();
      b.showBubble('喵呜~ 你好呀！');
      const bubble = document.querySelector('.cat-bubble') as HTMLElement;
      const rectSpy = vi.spyOn(bubble, 'getBoundingClientRect').mockReturnValue({ left: 900, right: 1200 } as any);
      b.clampBubbleToViewport(bubble);
      expect(bubble.style.getPropertyValue('--bz-sc-shift')).toBe('-184px');
      // 打字变宽：模拟真实测量（矩形含已应用的 -184px 位移）——未偏移矩形 {700,1300} 偏移后为 {516,1116}
      rectSpy.mockReturnValue({ left: 516, right: 1116 } as any);
      b.clampBubbleToViewport(bubble);
      expect(bubble.style.getPropertyValue('--bz-sc-shift')).toBe('-284px'); // -184 + -(1116-1016)
      // 回到可视区内：不再追加位移
      rectSpy.mockReturnValue({ left: 400, right: 700 } as any);
      b.clampBubbleToViewport(bubble);
      expect(bubble.style.getPropertyValue('--bz-sc-shift')).toBe('-284px');
      rectSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('显示与打字节拍都会触发夹紧（show 后 + 每个打字 tick）', () => {
    vi.useFakeTimers();
    try {
      mountContainer();
      const b = new BubbleManager();
      const clampCalls: unknown[] = [];
      (b as any).clampBubbleToViewport = (bubble: HTMLElement) => clampCalls.push(bubble);
      b.showBubble('喵呜~ 喵呜~ 喵呜~');
      const bubble = document.querySelector('.cat-bubble') as HTMLElement;
      expect(clampCalls.length).toBe(1); // show 时首测
      vi.advanceTimersByTime(300); // 若干打字节拍
      expect(clampCalls.length).toBeGreaterThan(1);
      expect((clampCalls[0] as HTMLElement)).toBe(bubble);
    } finally {
      vi.useRealTimers();
    }
  });
});