/**
 * 影视数据分析入口（ticket 15 修正版：对齐源码 openAnalysisModal 逐字）
 * 命令（movie-analysis-open）由 main.ts 裸注册。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { buildAnalysisData } from './analysis';
import { buildAnalysisHTML } from './charts';

let analysisOverlay: HTMLElement | null = null;
let initialized = false;
let escRegistered = false;

/** 幂等初始化（懒加载） */
export function ensureMovieAnalysis(app: App): void {
  if (initialized) return;
  initialized = true;
  registerAnalysisEscape();
}

/** 关闭分析弹窗 */
export function closeAnalysis(): void {
  if (analysisOverlay) {
    analysisOverlay.remove();
    analysisOverlay = null;
  }
}

/** 打开观影数据分析弹窗（源码 L468-528 逐字） */
export function openMovieAnalysis(app: App): void {
  ensureMovieAnalysis(app);
  if (analysisOverlay) {
    closeAnalysis();
    return;
  }
  const data = buildAnalysisData(app);

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 1200;
    display: flex; align-items: center; justify-content: center;
  `;
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); color: var(--text-normal);
    border-radius: 12px; width: 100%; max-width: 600px; height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  `;
  if (window.innerWidth <= 768) {
    modal.style.height = '100vh';
    modal.style.borderRadius = '0';
    modal.style.maxWidth = '100%';
    modal.style.paddingTop = '24px';
  }

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 26px; flex-shrink: 0;
  `;
  const titleEl = document.createElement('p');
  titleEl.textContent = '📊 观影数据分析';
  titleEl.style.cssText = 'font-size:.9rem;font-weight:600;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '❌';
  closeBtn.title = '关闭';
  closeBtn.style.cssText = `
    background: none; border: none; font-size: 0.55rem;
    cursor: pointer; color: var(--text-muted); box-shadow: none;
    padding: 0; margin-left: 15px;
  `;
  closeBtn.addEventListener('click', closeAnalysis);
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px 16px 16px;';
  content.innerHTML = buildAnalysisHTML(data);

  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  analysisOverlay = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAnalysis();
  });
}

/** ESC 注册（源码 L531-533） */
function registerAnalysisEscape(): void {
  if (escRegistered) return;
  escRegistered = true;
  escManager.register('analysis', {
    isVisible: () => !!analysisOverlay,
    close: () => closeAnalysis(),
  });
}
