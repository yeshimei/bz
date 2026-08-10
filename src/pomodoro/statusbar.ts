/**
 * 番茄钟状态栏（ticket 29）：常驻「🍅 mm:ss」，空闲灰态 🍅，点击打开弹窗。
 * 由 ui.ts render 驱动刷新（syncPomodoroStatusBar）；mount 挂到 Obsidian 状态栏容器（main.ts addStatusBarItem）。
 */
import type { App } from 'obsidian';
import type { PomodoroState } from './state';

let statusEl: HTMLElement | null = null;

export function mountPomodoroStatusBar(container: HTMLElement, app: App): void {
  if (statusEl) return;
  statusEl = document.createElement('span');
  statusEl.className = 'pomodoro-statusbar pomodoro-statusbar-idle';
  statusEl.textContent = '🍅';
  statusEl.title = '番茄钟';
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
  }
}

/** ui.ts render 每 1s 调用：运行中 🍅 mm:ss；停止/暂停灰态 🍅 */
export function syncPomodoroStatusBar(state: PomodoroState, remainSec: number): void {
  if (!statusEl) return;
  if (state.endTime !== null) {
    const m = Math.floor(remainSec / 60);
    const s = remainSec % 60;
    statusEl.textContent = `🍅 ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    statusEl.classList.remove('pomodoro-statusbar-idle');
  } else {
    statusEl.textContent = '🍅';
    statusEl.classList.add('pomodoro-statusbar-idle');
  }
}
