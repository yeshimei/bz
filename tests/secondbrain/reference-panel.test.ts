/**
 * 参考面板长按/悬停状态机回归测试（刷新竞态修复）：
 * 根因——列表整页重建（renderResults innerHTML=''）时，卡片的未决长按 250ms /
 * 悬停预览 300ms 计时器不随之取消，在已摘除卡片上开火：
 *   - 长按态 + 浏览器对摘除元素补发的 mouseleave → floatCard() 取零矩形
 *     → position:fixed left/top=0、width=0 的「左上角幽灵卡」（无法抓握拖动）；
 *   - 悬停预览定时器 → 孤儿预览残留在屏幕顶部。
 * 修复语义：重建/关闭前清场未决态；已摘除卡片任何路径禁止浮出/出预览；
 * 关闭面板时漂浮卡片全部消失且 document 级监听兜底解绑。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReferencePanel } from '../../src/secondbrain/reference-panel';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';

const HIT_A = { path: '笔记A.md', score: 0.9, chunk: '甲卡片正文' };
const HIT_B = { path: '笔记B.md', score: 0.8, chunk: '乙卡片正文' };

function makeApp(): any {
  return {
    vault: { on: () => ({}), offref: () => {}, getAbstractFileByPath: () => null },
    workspace: { on: () => ({}), offref: () => {}, getActiveFile: () => null },
  };
}

function makePanel(hits: any[] = [HIT_A]): ReferencePanel {
  const store: any = { search: async () => hits };
  return new ReferencePanel(makeApp(), store as any);
}

function mouse(el: HTMLElement, type: string, x = 10, y = 10): void {
  el.dispatchEvent(new MouseEvent(type, { button: 0, clientX: x, clientY: y }));
}

function bodyFloats(): Element[] {
  return Array.from(document.body.querySelectorAll('.bz-sb-ref-card--float'));
}

describe('secondbrain/reference-panel 刷新竞态防护', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as BzSettings);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // 清掉 fake timer 吞掉的窄窗延迟移除等残留节点，避免跨测试污染
    document
      .querySelectorAll('.bz-sb-float-win, .bz-sb-ref-card, .bz-sb-ref-preview')
      .forEach((el) => el.remove());
  });

  it('长按中卡片被摘除：计时器到点不进入浮起态，补发 mouseleave 不产生幽灵浮卡', () => {
    const panel = makePanel();
    const card = panel.createResultCard(HIT_A as any);
    mouse(card, 'mousedown');
    card.remove(); // 模拟 renderResults 整页重建把卡片从 DOM 摘除
    vi.advanceTimersByTime(300); // 长 按 计 时 到 点
    mouse(card, 'mouseleave'); // 浏览器对摘除元素补发的边界事件
    expect(card.classList.contains('bz-sb-ref-card--float')).toBe(false);
    expect(card.style.position).toBe('');
    expect(bodyFloats()).toHaveLength(0);
    expect(panel.floatingCards.size).toBe(0);
    panel.close();
  });

  it('连接态长按 → mouseleave 正常浮出（既有功能保持）；关窗后浮卡全部消失', () => {
    const panel = makePanel();
    const card = panel.createResultCard(HIT_A as any);
    mouse(card, 'mousedown');
    vi.advanceTimersByTime(260); // 越过 250ms 长按阈值
    mouse(card, 'mouseleave'); // 快速甩出卡片
    expect(card.classList.contains('bz-sb-ref-card--float')).toBe(true);
    expect(panel.floatingCards.has(card)).toBe(true);
    expect(card.parentElement).toBe(document.body);
    panel.close(); // 用户验收点：关闭参考窗口，所有拖出的卡片全部消失
    expect(card.isConnected).toBe(false);
    expect(panel.floatingCards.size).toBe(0);
    expect(bodyFloats()).toHaveLength(0);
  });

  it('renderResults 整页重建前清场：未决长按不跨重建触发浮出', async () => {
    const panel = makePanel([HIT_B as any]);
    const oldCard = panel.createResultCard(HIT_A as any);
    mouse(oldCard, 'mousedown'); // 长按未决（250ms 未到）
    panel.renderResults([HIT_B as any]); // 刷新整页重建
    expect(oldCard.isConnected).toBe(false);
    vi.advanceTimersByTime(500); // 原长按计时早已越过阈值
    mouse(oldCard, 'mouseleave');
    expect(bodyFloats()).toHaveLength(0);
    expect(panel.floatingCards.size).toBe(0);
    // 新列表正常渲染
    expect(panel.resultsDiv.querySelectorAll('.bz-sb-ref-card')).toHaveLength(1);
    panel.close();
  });

  it('悬停预览：卡片摘除后定时器到点不产生孤儿预览；连接态照常显示', () => {
    const panel = makePanel();
    const dead = panel.createResultCard(HIT_A as any);
    mouse(dead, 'mouseenter');
    dead.remove(); // 摘除后 mouseleave 不会再来
    vi.advanceTimersByTime(400);
    expect(document.querySelectorAll('.bz-sb-ref-preview')).toHaveLength(0);

    const live = panel.createResultCard(HIT_B as any);
    mouse(live, 'mouseenter');
    vi.advanceTimersByTime(300);
    expect(document.querySelectorAll('.bz-sb-ref-preview')).toHaveLength(1);
    panel.close(); // destroyResources 兜底 hideHoverPreview
    expect(document.querySelectorAll('.bz-sb-ref-preview')).toHaveLength(0);
  });

  it('双击归位保持既有语义；归位后再关窗无残留', () => {
    const panel = makePanel();
    const card = panel.createResultCard(HIT_A as any);
    mouse(card, 'mousedown');
    vi.advanceTimersByTime(260);
    mouse(card, 'mouseleave');
    expect(panel.floatingCards.has(card)).toBe(true);
    card.dispatchEvent(new MouseEvent('dblclick')); // 浮卡态双击 = 归位
    expect(card.classList.contains('bz-sb-ref-card--float')).toBe(false);
    expect(panel.floatingCards.has(card)).toBe(false);
    expect(card.parentElement).toBe(panel.resultsDiv);
    expect((panel as any).floatDetachers.size).toBe(0);
    expect(card.style.position).toBe('');
    panel.close();
    vi.advanceTimersByTime(200); // 窄窗 el 延迟 150ms 移除，归位卡片随列表 DOM 一并消失
    expect(card.isConnected).toBe(false);
  });

  it('关闭面板时仍在漂浮的卡片：兜底解绑拖拽/缩放监听并清空登记', () => {
    const panel = makePanel();
    const card = panel.createResultCard(HIT_A as any);
    mouse(card, 'mousedown');
    vi.advanceTimersByTime(260);
    mouse(card, 'mouseleave');
    expect((panel as any).floatDetachers.size).toBe(1);
    panel.close();
    expect((panel as any).floatDetachers.size).toBe(0);
    expect((panel as any).cardTeardowns.size).toBe(0);
    expect(card.isConnected).toBe(false);
  });
});
