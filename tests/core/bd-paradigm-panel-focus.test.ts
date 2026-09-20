// @vitest-environment jsdom
/**
 * 呈报#13（F3+H3，拍板★A 按先例全域推广）大面板入焦 + Tab 圈闭 · 回归测试
 *
 * - 行为面（core 单源 trapPanelFocus）：打开即把焦点放进面板容器本体（tabindex=-1，
 *   不落输入框——移动端防软键盘），Tab/Shift+Tab 圈闭在面板内；容器本体持焦时
 *   Tab 去首项、Shift+Tab 绕尾项（不入圈外）；解绑后恢复原生行为。
 * - 接线面（契约）：全域大面板逐域在册（打开/show 路径各一行接线），memo 豁免
 *   （随队尾重审统一处理）；settings-panel 保持 E-3 首个可交互元素入焦口径、只补圈闭。
 * 接线断言读源文件文本（jsdom 无法逐域真开面板；文本契约先例 ui-scrollbar.test.ts）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { trapPanelFocus, trapFocus, PANEL_FOCUS_CLASS } from '../../src/core/ui/focus-trap';

const repo = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

function pressTab(target: Element, shift = false): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

describe('trapPanelFocus（core 单源）行为面', () => {
  it('打开即入焦：焦点落容器本体（tabindex=-1 + 焦点壳类），不落容器内输入框', () => {
    const panel = document.createElement('div');
    const input = document.createElement('input');
    const btn = document.createElement('button');
    btn.textContent = '动作';
    panel.append(input, btn);
    document.body.appendChild(panel);

    const release = trapPanelFocus(panel);
    expect(panel.getAttribute('tabindex')).toBe('-1');
    expect(panel.classList.contains(PANEL_FOCUS_CLASS)).toBe(true);
    expect(document.activeElement).toBe(panel); // 容器本体，不是 input
    release();
    panel.remove();
  });

  it('Tab 圈闭：末项按 Tab 回首项并吞掉默认行为', () => {
    const panel = document.createElement('div');
    const [a, b, c] = ['a', 'b', 'c'].map((t) => {
      const el = document.createElement('button');
      el.textContent = t;
      return el;
    });
    panel.append(a, b, c);
    document.body.appendChild(panel);
    const release = trapPanelFocus(panel);

    c.focus();
    const e = pressTab(panel);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);

    release();
    panel.remove();
  });

  it('Shift+Tab 反向：首项绕回末项', () => {
    const panel = document.createElement('div');
    const [a, b, c] = ['a', 'b', 'c'].map((t) => {
      const el = document.createElement('button');
      el.textContent = t;
      return el;
    });
    panel.append(a, b, c);
    document.body.appendChild(panel);
    const release = trapPanelFocus(panel);

    a.focus();
    pressTab(panel, true);
    expect(document.activeElement).toBe(c);

    release();
    panel.remove();
  });

  it('容器本体持焦：Tab 去首项、Shift+Tab 绕尾项（焦点不出圈）', () => {
    const panel = document.createElement('div');
    const [a, b] = ['a', 'b'].map((t) => {
      const el = document.createElement('button');
      el.textContent = t;
      return el;
    });
    panel.append(a, b);
    document.body.appendChild(panel);
    const release = trapPanelFocus(panel);

    panel.focus(); // 入焦后的常态
    pressTab(panel); // Tab → 首项
    expect(document.activeElement).toBe(a);
    panel.focus();
    pressTab(panel, true); // Shift+Tab → 尾项
    expect(document.activeElement).toBe(b);

    release();
    panel.remove();
  });

  it('解绑后不再钳制：Tab 默认行为放行', () => {
    const panel = document.createElement('div');
    const [a, b] = ['a', 'b'].map((t) => {
      const el = document.createElement('button');
      el.textContent = t;
      return el;
    });
    panel.append(a, b);
    document.body.appendChild(panel);
    const release = trapPanelFocus(panel);
    release();

    a.focus();
    const e = pressTab(panel);
    expect(e.defaultPrevented).toBe(false);
    panel.remove();
  });

  it('trapFocus（容器外焦点拉回首项的既有口径不回退）：焦点被挪到圈外时 Tab 拉回', () => {
    const panel = document.createElement('div');
    const [a, b] = ['a', 'b'].map((t) => {
      const el = document.createElement('button');
      el.textContent = t;
      return el;
    });
    const outside = document.createElement('button');
    panel.append(a, b, outside);
    document.body.appendChild(panel);
    const release = trapFocus(panel);

    outside.focus(); // 程序化挪走
    pressTab(panel);
    expect(panel.contains(document.activeElement)).toBe(true);

    release();
    panel.remove();
  });
});

/** 接线清单：域文件 → 面板容器锚（断言 trapPanelFocus 调用在位） */
const WIRING: Array<[string, string]> = [
  ['src/favorites/ui.ts', ".querySelector<HTMLElement>('.bz-fav-panel') ?? overlay"],
  ['src/belongings/ui.ts', ".querySelector<HTMLElement>('.bz-bel-panel') ?? overlay"],
  ['src/cinema/ui.ts', 'trapPanelFocus(root);'],
  ['src/bookshelf/ui.ts', ".querySelector<HTMLElement>('.bz-bs-panel') ?? overlay"],
  ['src/home/ui.ts', 'trapPanelFocus(overlay);'],
  ['src/gameshelf/ui.ts', 'trapPanelFocus(frame);'],
  ['src/clipbook/ui.ts', ".querySelector<HTMLElement>('.bz-clip-frame') ?? overlayEl!"],
  ['src/clipbook/report-ui.ts', ".querySelector<HTMLElement>('.bz-clip-report-frame') ?? overlayEl!"],
  ['src/review/ui.ts', 'trapPanelFocus(this.popup);'],
  ['src/review/quiz-panel.ts', 'trapPanelFocus(this.popup);'],
  ['src/encrypt/ui.ts', 'trapPanelFocus(this.popup!);'],
  ['src/pomodoro/ui.ts', 'trapPanelFocus(panel);'],
  ['src/checkup/ui.ts', 'trapPanelFocus'],
];

describe('呈报#13 接线契约：全域大面板逐域在册', () => {
  it('十三个面板接线在位（打开/show 路径各一行，core trapPanelFocus 单源）', () => {
    for (const [file, anchor] of WIRING) {
      const src = repo(file);
      expect(src.includes('trapPanelFocus(') || file === 'src/settings-panel/ui.ts', `${file} 缺 trapPanelFocus 接线`).toBe(true);
      expect(src.includes(anchor), `${file} 缺面板容器锚：${anchor}`).toBe(true);
    }
  });

  it('settings-panel 保持 E-3 入焦口径，只补 Tab 圈闭（不夺焦）', () => {
    const src = repo('src/settings-panel/ui.ts');
    expect(src).toContain('firstFocusable(popup)?.focus();'); // E-3 既有口径不动
    expect(src).toContain('trapFocus(popup);');
    expect(src).not.toContain('trapPanelFocus('); // 不改用容器入焦
  });

  it('memo 豁免在册：不动 memo（同型面板随队尾重审统一处理）', () => {
    const src = repo('src/memo/ui.ts');
    expect(src.includes('trapPanelFocus(')).toBe(false);
  });
});
