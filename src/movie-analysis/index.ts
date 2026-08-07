/**
 * 影视数据分析入口（ticket 15：ensureMovieAnalysis/openMovieAnalysis）
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

/** 打开观影数据分析弹窗 */
export function openMovieAnalysis(app: App): void {
  ensureMovieAnalysis(app);
  if (analysisOverlay) closeAnalysis();

  const data = buildAnalysisData(app);
  const html = buildAnalysisHTML(data);

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
    z-index: 1200;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); border-radius: 12px;
    width: 100%; max-width: 600px; height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  `;

  if (window.innerWidth <= 768) {
    modal.style.height = '100vh';
    modal.style.borderRadius = '0';
    modal.style.maxWidth = '100%';
  }

  // 头部
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 20px;flex-shrink:0;border-bottom:1px solid var(--background-modifier-border);';
  const title = document.createElement('span');
  title.textContent = '📊 观影数据分析';
  title.style.cssText = 'font-size:1.1rem;font-weight:600;color:#2c3e50;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '❌';
  closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:.8rem;box-shadow:none;color:var(--text-muted);';
  closeBtn.addEventListener('click', closeAnalysis);
  header.appendChild(title);
  header.appendChild(closeBtn);

  // 滚动内容
  const scrollable = document.createElement('div');
  scrollable.style.cssText = 'flex:1;overflow-y:auto;padding:16px 20px;';
  scrollable.innerHTML = html;

  modal.appendChild(header);
  modal.appendChild(scrollable);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  analysisOverlay = overlay;

  // 点遮罩空白关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAnalysis();
  });
}

/** ESC 注册 */
function registerAnalysisEscape(): void {
  if (escRegistered) return;
  escRegistered = true;
  escManager.register('analysis', {
    isVisible: () => !!analysisOverlay,
    close: () => closeAnalysis(),
  });
}
