/**
 * 阅读数据分析报告入口（ticket 13）
 * 命令（show-reading-report）由 main.ts 裸注册；此处提供回调 + 幂等初始化。
 */
import type { App } from 'obsidian';
import { getAllBookNotes, calculateReadingStats } from './stats';
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
  const stats = calculateReadingStats(bookNotes);
  const statsContent = generateFullStatsReport(stats, bookNotes);
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

  if (window.innerWidth <= 768) {
    content.style.height = '100vh';
    content.style.borderRadius = '0';
    content.style.maxWidth = '100%';
  }

  const header = document.createElement('div');
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
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 0.8rem;
    color: ${isDarkMode ? '#b0b0b0' : '#666'};
    cursor: pointer;
    padding: 0;
    box-shadow: none;
  `;

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
