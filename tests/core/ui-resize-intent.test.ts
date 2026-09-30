/* ============================================================
 * 半屏挤压修复：意图尺寸 × 渲染尺寸分离（uiResizable / uiVSplitter）
 * 旧口径把「视口钳制后的渲染值」直接落盘 + 内联冻结——Obsidian 半屏下
 * 打开/拖拽会把挤压尺寸永久写进 settings，恢复全屏后回不去。
 * 本组锁定三条修复语义：
 *   1) 落盘口径 = 意图值（只钳 min/硬上限，不掺视口 92%）；
 *   2) 挂载渲染 = 意图值在当前视口的投影（窄视口钳小，不写死）；
 *   3) window resize 跟帧 = 视口变化即按意图值重新渲染（全屏自动复原）。
 * 附 panelSizePersist 工厂（core/settings-provider）读写口径。
 * ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiResizable, uiVSplitter } from '../../src/core/ui';
import { panelSizePersist, setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
// provider 签名是 () => BzSettings——测试桩须 cast 成真实设置类型（Record<string, never> 过不了 tsc）
import type BzSettings from '../../src/settings';

/** jsdom 无几何布局：mock rect 动态读 style（拖拽改 style 后即反映），口径同 ui.test.ts */
function makeBox(w = 720, h = 580): { el: HTMLElement } {
  const el = document.createElement('div');
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  document.body.appendChild(el);
  el.getBoundingClientRect = () => {
    const rw = parseInt(el.style.width) || w;
    const rh = parseInt(el.style.height) || h;
    return {
      left: 0, top: 0, right: rw, bottom: rh, x: 0, y: 0,
      width: rw, height: rh, toJSON: () => ({}),
    } as DOMRect;
  };
  return { el };
}

function fire(el: Element | Document | Window, type: string, x = 0, y = 0): void {
  if (type === 'resize') {
    (el as Window).dispatchEvent(new Event('resize'));
    return;
  }
  (el as Element | Document).dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
}

function mockViewport(w: number, h: number): void {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(w);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(h);
}

describe('uiResizable 意图尺寸 × 渲染尺寸分离（半屏挤压修复）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('窄视口挂载：渲染钳到视口 92%，视口放大（window resize）后自动恢复意图尺寸', () => {
    mockViewport(1000, 700); // cap = 920×644
    const { el } = makeBox(720, 580);
    const det = uiResizable(el, {
      minW: 720, minH: 520, maxW: 1280, maxH: 880,
      persist: { load: () => ({ w: 1280, h: 880 }) },
    });
    // 挤压投影：意图 1280×880 在窄视口渲染为 920×644（内联临时值，非存档）
    expect(el.style.width).toBe('920px');
    expect(el.style.height).toBe('644px');
    // 半屏 → 全屏：视口跟帧按意图值重新渲染
    mockViewport(2000, 1500);
    fire(window, 'resize');
    expect(el.style.width).toBe('1280px');
    expect(el.style.height).toBe('880px');
    det.detach();
  });

  it('窄视口拖大：落盘意图值（硬上限口径）而非被视口钳制的渲染值', () => {
    vi.useFakeTimers();
    try {
      mockViewport(1000, 700); // cap 920，硬上限 1280
      const { el } = makeBox(720, 580);
      const save = vi.fn();
      const det = uiResizable(el, {
        minW: 720, minH: 520, maxW: 1280, maxH: 880,
        persist: { save },
      });
      fire(el, 'mousedown', 719, 300);
      fire(document, 'mousemove', 4000, 300); // raw 4001 → 意图钳 1280，渲染只到视口 920
      fire(document, 'mouseup', 4000, 300);
      expect(el.style.width).toBe('920px'); // 所见即所得：渲染仍受视口钳制
      vi.advanceTimersByTime(300);
      expect(save).toHaveBeenCalledWith(1280, 580); // 存档是意图值——全屏后能恢复
      det.detach();
    } finally {
      vi.useRealTimers();
    }
  });

  it('视口跟帧不写盘：纯视口变化不触发 save（挤压恢复不污染记忆）', () => {
    vi.useFakeTimers();
    try {
      mockViewport(1000, 700);
      const { el } = makeBox(720, 580);
      const save = vi.fn();
      const det = uiResizable(el, {
        minW: 720, minH: 520, maxW: 1280, maxH: 880,
        persist: { load: () => ({ w: 1280, h: 880 }), save },
      });
      mockViewport(2000, 1500);
      fire(window, 'resize');
      expect(el.style.width).toBe('1280px');
      vi.advanceTimersByTime(1000);
      expect(save).not.toHaveBeenCalled();
      det.detach();
    } finally {
      vi.useRealTimers();
    }
  });

  it('无记忆首拖一轴：另一轴固化 CSS 默认基线（renderSize 两轴齐备才写内联）', () => {
    mockViewport(2000, 1500);
    const { el } = makeBox(720, 580);
    const det = uiResizable(el, { minW: 720, minH: 520, maxW: 1280, maxH: 880 });
    fire(el, 'mousedown', 360, 579); // 底缘按下（y 内偏 1px）
    fire(document, 'mousemove', 360, 700);
    fire(document, 'mouseup', 360, 700);
    expect(el.style.width).toBe('720px'); // 宽轴未拖，固化基线原样
    expect(el.style.height).toBe('701px');
    det.detach();
  });

  it('detach 摘除视口跟帧：detach 后 window resize 不再改内联尺寸', () => {
    mockViewport(1000, 700);
    const { el } = makeBox(720, 580);
    const det = uiResizable(el, {
      minW: 720, minH: 520, maxW: 1280, maxH: 880,
      persist: { load: () => ({ w: 1280, h: 880 }) },
    });
    det.detach();
    mockViewport(2000, 1500);
    fire(window, 'resize');
    expect(el.style.width).toBe('920px'); // 停留在 detach 前的渲染值
  });
});

describe('uiVSplitter 意图宽 × 渲染宽分离（半屏挤压修复）', () => {
  function makePanes(cw = 1000) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const left = document.createElement('div');
    const right = document.createElement('div');
    container.appendChild(left);
    container.appendChild(right);
    vi.spyOn(container, 'clientWidth', 'get').mockReturnValue(cw);
    left.getBoundingClientRect = () => {
      const w = parseInt(left.style.width) || 0;
      return { left: 0, top: 0, right: w, bottom: 0, x: 0, y: 0, width: w, height: 0, toJSON: () => ({}) } as DOMRect;
    };
    return { container, left, right };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('拖到容器上限：落盘原始拖拽意图宽，渲染照旧按容器钳制', () => {
    vi.useFakeTimers();
    try {
      const { left } = makePanes(1000); // 可用 1000（jsdom offsetWidth=0），max = 1000-320 = 680
      const save = vi.fn();
      const split = uiVSplitter({ left, right: document.createElement('div'), minLeft: 220, minRight: 320, persist: { save } });
      document.body.appendChild(split.el);
      split.el.dispatchEvent(new MouseEvent('mousedown', { clientX: 500, clientY: 12, bubbles: true, button: 0 }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1500, clientY: 12, bubbles: true })); // raw 1000
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 1500, clientY: 12, bubbles: true, button: 0 }));
      expect(left.style.width).toBe('680px'); // 渲染受容器钳制（右栏保底）
      vi.advanceTimersByTime(300);
      expect(save).toHaveBeenCalledWith(1000); // 存档是原始意图宽
      split.detach();
    } finally {
      vi.useRealTimers();
    }
  });

  it('触顶后继续拖：意图宽追上最终拖拽值，不被渲染短路卡在首次触顶帧', () => {
    vi.useFakeTimers();
    try {
      const { left } = makePanes(1000); // 容器上限 680
      const save = vi.fn();
      const split = uiVSplitter({ left, right: document.createElement('div'), minLeft: 220, minRight: 320, persist: { save } });
      document.body.appendChild(split.el);
      split.el.dispatchEvent(new MouseEvent('mousedown', { clientX: 500, clientY: 12, bubbles: true, button: 0 }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1180, clientY: 12, bubbles: true })); // raw 680 恰触顶
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1400, clientY: 12, bubbles: true })); // 触顶后继续拖 raw 900
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 1400, clientY: 12, bubbles: true, button: 0 }));
      vi.advanceTimersByTime(300);
      expect(save).toHaveBeenLastCalledWith(900); // 落最终意图宽而非首次触顶帧的 680
      split.detach();
    } finally {
      vi.useRealTimers();
    }
  });

  it('restore：窄容器下记忆宽渲染钳制，意图值只兜下限不掺容器宽', () => {
    const { left } = makePanes(1000);
    const split = uiVSplitter({
      left, right: document.createElement('div'), minLeft: 220, minRight: 320,
      persist: { load: () => 900, save: () => {} },
    });
    document.body.appendChild(split.el);
    split.restore();
    expect(left.style.width).toBe('680px'); // clamp(900) → 容器上限
    split.detach();
  });
});

describe('panelSizePersist 工厂（core/settings-provider）', () => {
  beforeEach(() => {
    setSettingsProvider(() => ({ diaryPanelWidth: 0, diaryPanelHeight: 0 }) as unknown as BzSettings);
    setSettingsSaver(vi.fn().mockResolvedValue(undefined));
  });

  afterEach(() => {
    // 还原为空提供者（等价未注入语义：tryGetSettings 空对象）
    setSettingsProvider(() => ({}) as unknown as BzSettings);
    setSettingsSaver(() => Promise.resolve());
  });

  it('load：键值齐备返回 {w,h}；低于 min 回 null（走 CSS 默认）', () => {
    const persist = panelSizePersist('diaryPanelWidth', 'diaryPanelHeight', 720, 520);
    expect(persist.load!()).toBeNull(); // 0 = 未拖过
    setSettingsProvider(() => ({ diaryPanelWidth: 900, diaryPanelHeight: 600 }) as unknown as BzSettings);
    expect(persist.load!()).toEqual({ w: 900, h: 600 });
    setSettingsProvider(() => ({ diaryPanelWidth: 100, diaryPanelHeight: 600 }) as unknown as BzSettings);
    expect(persist.load!()).toBeNull(); // 宽低于 min
  });

  it('save：写回设置对象并触发落盘', async () => {
    const store = { diaryPanelWidth: 0, diaryPanelHeight: 0 };
    const saver = vi.fn().mockResolvedValue(undefined);
    setSettingsProvider(() => store as unknown as BzSettings);
    setSettingsSaver(saver);
    const persist = panelSizePersist('diaryPanelWidth', 'diaryPanelHeight', 720, 520);
    persist.save!(980, 640);
    expect(store.diaryPanelWidth).toBe(980);
    expect(store.diaryPanelHeight).toBe(640);
    await Promise.resolve();
    expect(saver).toHaveBeenCalledTimes(1);
  });
});
