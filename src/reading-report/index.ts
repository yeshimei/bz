/**
 * 阅读数据分析报告入口（ticket 13）
 * 命令（show-reading-report）由 main.ts 裸注册；此处提供回调 + 幂等初始化。
 */
import type { App } from 'obsidian';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { getAllBookNotes, calculateReadingStats, getEpubBookNotes } from './stats';
import { generateFullStatsReport } from './report';

let initialized = false;

/** 幂等初始化（懒加载） */
export function ensureReadingReport(app: App): void {
  if (initialized) return;
  initialized = true;
}

/** 生成完整报告并弹窗展示（show-reading-report 命令回调） */
export function showReadingReport(app: App): void {
  ensureReadingReport(app);
  generateEnhancedReadingReport(app);
}

/** 生成完整的统计报告 */
async function generateEnhancedReadingReport(app: any) {
  const bookNotes = getAllBookNotes(app);
  // EPUB 书条目（ADR-0013 扩展）：从 weave-data.json 并入，缺字段按报告口径补全。
  const epubEntries = await getEpubBookNotes(app);
  const allNotes = epubEntries.length > 0 ? [...bookNotes, ...epubEntries] : bookNotes;
  const stats = calculateReadingStats(allNotes);
  const statsContent = generateFullStatsReport(stats, allNotes);
  const isDarkMode = document.body.classList.contains('theme-dark');
  showReportInPopup(statsContent, isDarkMode);
}

/** 报告弹窗（z-index 9999，ESC/背景点击关闭） */
export function showReportInPopup(htmlContent: string, isDarkMode: boolean) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: ${isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)'};
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: ${isDarkMode ? '#1e1e1e' : 'white'};
    border-radius: 12px;
    width: 100%;
    max-width: 600px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    position: relative;
  `;

  const header = document.createElement('div');
  header.className = 'bz-win-head';
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    flex-shrink: 0;
    background: ${isDarkMode ? '#1e1e1e' : 'white'};
    z-index: 5;
  `;

  const titleSpan = document.createElement('span');
  titleSpan.textContent = '🧮 阅读数据分析报告';
  titleSpan.style.cssText = `
    font-size: 1.1rem;
    font-weight: 600;
    color: ${isDarkMode ? '#e0e0e0' : '#2c3e50'};
  `;

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '❌';
  closeButton.title = '关闭';
  closeButton.className = 'bz-win-close';
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 16px;
    width: 24px;
    height: 28px;
    border-radius: 4px;
    color: ${isDarkMode ? '#b0b0b0' : '#666'};
    cursor: pointer;
    padding: 0;
    box-shadow: none;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeButton.onmouseover = () => (closeButton.style.background = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');
  closeButton.onmouseout = () => (closeButton.style.background = 'none');

  const closeModal = () => {
    document.body.removeChild(modal);
    document.removeEventListener('keydown', handleKeydown);
  };

  closeButton.addEventListener('click', closeModal);

  header.appendChild(titleSpan);
  header.appendChild(closeButton);

  const scrollable = document.createElement('div');
  scrollable.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  `;
  scrollable.innerHTML = htmlContent;

  content.appendChild(header);
  content.appendChild(scrollable);
  modal.appendChild(content);
  // 移动端默认全屏跟随书库（用户拍板：阅读报告不设独立开关，与书库同键 libraryMobileDefaultFullscreen）；
  // 窗口内容根元素挂类（每次重建天然重挂）
  applyMobileWindowFullscreen(content, tryGetSettings().libraryMobileDefaultFullscreen === true);
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', handleKeydown);
}
