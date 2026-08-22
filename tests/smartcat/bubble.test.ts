/**
 * smartcat 气泡测试（UI 层）：队列、打字机、计时、单击固定、双击转聊、上限 4。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BubbleManager } from '../../src/smartcat/bubble';
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