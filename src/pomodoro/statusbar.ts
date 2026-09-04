/**
 * 番茄钟状态栏（ticket 29）：Obsidian 原生 lucide 图标（timer）+ mm:ss，空闲灰态，点击打开弹窗。
 * 图标 mount 时渲染一次（setIcon），sync 仅更新文本；样式自注入（幂等）。
 * 由 ui.ts render 驱动刷新（syncPomodoroStatusBar）；mount 挂到 Obsidian 状态栏容器（main.ts addStatusBarItem）。
 */
import { setIcon } from 'obsidian';
import { pad2 } from '../core/utils';
import type { App } from 'obsidian';
import type { PomodoroState } from './state';

let statusEl: HTMLElement | null = null;
let textSpan: HTMLElement | null = null;

export function mountPomodoroStatusBar(container: HTMLElement, app: App): void {
  if (statusEl) return;
  statusEl = document.createElement('span');
  statusEl.className = 'pomodoro-statusbar pomodoro-statusbar-idle';
  statusEl.title = '番茄钟';
  const iconEl = document.createElement('span');
  iconEl.className = 'pomodoro-statusbar-icon';
  setIcon(iconEl, 'timer'); // Obsidian 原生 lucide 图标（与命令 icon 一致）
  statusEl.appendChild(iconEl);
  textSpan = document.createElement('span');
  textSpan.className = 'pomodoro-statusbar-text';
  statusEl.appendChild(textSpan);
  statusEl.addEventListener('click', () => {
    // 函数体内延迟 import（ui.ts 顶层依赖本模块，避免循环引用环）
    void import('./ui').then((m) => m.openPomodoro(app));
  });
  container.appendChild(statusEl);
}

export function unmountPomodoroStatusBar(): void {
  if (statusEl) {
    statusEl.remove();
    statusEl = null;
    textSpan = null;
  }
}

/**
 * ui.ts render 每 1s 调用：
 * 主番茄钟运行中：mm:ss；暂停（含后台自动暂停）：显示「已暂停」标签（.pomodoro-statusbar-paused 醒目标识）；
 * 空闲：空文本灰态（.pomodoro-statusbar-idle）。自动暂停/恢复只在此处体现，不加 toast（x6）。
 * 增强包：hover 反馈走 styles.css（对齐组件库交互基线）；专注归属任务名挂 title 悬停展示（状态栏空间宝贵，文本位留给倒计时）。
 */
export function syncPomodoroStatusBar(state: PomodoroState, remainSec: number): void {
  if (!statusEl) return;
  const running = state.endTime !== null;
  const paused = !running && state.paused;
  statusEl.classList.toggle('pomodoro-statusbar-idle', !running && !paused);
  statusEl.classList.toggle('pomodoro-statusbar-paused', paused);
  statusEl.title = state.task ? `番茄钟：${state.task}` : '番茄钟';
  if (textSpan) {
    if (running) {
      const m = Math.floor(remainSec / 60);
      const s = remainSec % 60;
      textSpan.textContent = `${pad2(m)}:${pad2(s)}`;
    } else if (paused) {
      textSpan.textContent = '已暂停';
    } else {
      textSpan.textContent = '';
    }
  }
}
