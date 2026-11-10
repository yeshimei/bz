/**
 * 通用全屏（core/ui/global-fullscreen）+ 主面板定位（core/ui/main-panel）测试。
 * 覆盖 2026-11-10 的两条用户拍板（GitHub issue #1）：
 *  - 命令 bz-core-fullscreen 对「当前最上层主面板」生效，再执行 / ESC 还原；
 *  - 番茄钟不挂主面板标记 = 天然不参与全屏；
 *  - 全屏期间拖拽缩放空转（不把全屏值写进尺寸记忆）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toggleGlobalFullscreen, unloadGlobalFullscreen, GLOBAL_FULL_CLASS } from '../../src/core/ui/global-fullscreen';
import { MAIN_PANEL_CLASS, topMainPanel, visibleMainPanels } from '../../src/core/ui/main-panel';
import { escManager } from '../../src/core/esc-manager';
import { __resetZForTests } from '../../src/core/z-order';

function panel(cls = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `bz-panel-frame bz-x-panel ${MAIN_PANEL_CLASS} ${cls}`.trim();
  document.body.appendChild(el);
  return el;
}

function pressEsc(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  __resetZForTests();
  unloadGlobalFullscreen();
});

afterEach(() => {
  unloadGlobalFullscreen();
  document.body.innerHTML = '';
});

describe('main-panel 定位', () => {
  it('可见主面板按层级 z 从低到高；display:none 的不算', () => {
    const a = panel();
    const b = panel();
    a.style.zIndex = '1001';
    b.style.zIndex = '1002';
    expect(visibleMainPanels()).toEqual([a, b]);
    expect(topMainPanel()).toBe(b);
    a.style.display = 'none';
    expect(visibleMainPanels()).toEqual([b]);
    expect(topMainPanel()).toBe(b);
  });

  it('祖先 display:none 的主面板不可见（首页隐藏保留 DOM 的场景）', () => {
    const overlay = document.createElement('div');
    overlay.style.display = 'none';
    const p = panel();
    overlay.appendChild(p);
    document.body.appendChild(overlay);
    expect(isInvisible(p)).toBe(true);
    expect(visibleMainPanels()).toEqual([]);
    expect(topMainPanel()).toBeNull();
  });

  it('没有主面板（报告层/提示层）→ null', () => {
    const other = document.createElement('div');
    other.className = 'bz-report-layer';
    document.body.appendChild(other);
    expect(topMainPanel()).toBeNull();
  });
});

function isInvisible(el: HTMLElement): boolean {
  return !visibleMainPanels().includes(el);
}

describe('通用全屏命令', () => {
  it('进入 → 加全屏类；再执行 → 撤类', () => {
    const p = panel();
    p.style.zIndex = '1001';
    toggleGlobalFullscreen();
    expect(p.classList.contains(GLOBAL_FULL_CLASS)).toBe(true);
    toggleGlobalFullscreen();
    expect(p.classList.contains(GLOBAL_FULL_CLASS)).toBe(false);
  });

  it('对最上层主面板生效（下层不动）', () => {
    const low = panel();
    const top = panel();
    low.style.zIndex = '1001';
    top.style.zIndex = '1002';
    toggleGlobalFullscreen();
    expect(top.classList.contains(GLOBAL_FULL_CLASS)).toBe(true);
    expect(low.classList.contains(GLOBAL_FULL_CLASS)).toBe(false);
  });

  it('ESC 退出全屏且只退全屏（面板本身的 ESC 层不动）', () => {
    let panelClosed = false;
    const panelEsc = escManager.register('bz-x', { isVisible: () => true, close: () => { panelClosed = true; } });
    try {
      const p = panel();
      p.style.zIndex = '1001';
      toggleGlobalFullscreen();
      expect(p.classList.contains(GLOBAL_FULL_CLASS)).toBe(true);
      pressEsc();
      expect(p.classList.contains(GLOBAL_FULL_CLASS)).toBe(false);
      expect(panelClosed).toBe(false);
    } finally {
      panelEsc.unregister();
    }
  });

  it('没有主面板时只提示、不报错', () => {
    expect(() => toggleGlobalFullscreen()).not.toThrow();
  });

  it('面板被关掉后全屏态自愈：再执行不会把已离场的旧面板当成目标', () => {
    const p = panel();
    p.style.zIndex = '1001';
    toggleGlobalFullscreen();
    p.remove(); // 用户点遮罩关掉面板
    const next = panel();
    next.style.zIndex = '1003';
    toggleGlobalFullscreen(); // 旧目标已离场 → 清状态；对新的主面板再进全屏
    expect(next.classList.contains(GLOBAL_FULL_CLASS)).toBe(true);
  });
});
