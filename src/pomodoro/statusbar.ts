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

/** ui.ts render 每 1s 调用：运行中 mm:ss；停止/暂停灰态（图标保留） */
export function syncPomodoroStatusBar(state: PomodoroState, remainSec: number): void {
  if (!statusEl) return;
  if (state.endTime !== null) {
    const m = Math.floor(remainSec / 60);
    const s = remainSec % 60;
    if (textSpan) textSpan.textContent = `${pad2(m)}:${pad2(s)}`;
    statusEl.classList.remove('pomodoro-statusbar-idle');
  } else {
    if (textSpan) textSpan.textContent = '';
    statusEl.classList.add('pomodoro-statusbar-idle');
  }
}
