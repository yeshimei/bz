/**
 * 阅读数据分析报告入口（ticket 13）
 * 命令（show-reading-report）由 main.ts 裸注册；此处提供回调 + 幂等初始化。
 *
 * UX 整改（ux-reading）：ticket 40 统计不卡死（先建窗占位 + progress toast + 分片渲染让出主线程）、
 * l3 打开先建窗（不再「像没点」）、l1 unload 支持（unloadReadingReport，需 main.ts onunload 接线）、
 * s1 用户字段转义（report.ts 生成点转义，index.ts innerHTML 均静态模板/已转义内容）、
 * m1b 错误人话化（用户面人话模板，技术详情留 console）。
 */
import type { App } from 'obsidian';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { notify } from '../core/notice';
import { allocZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { getAllBookNotes, calculateReadingStats, getEpubBookNotes } from './stats';
import { buildReportSections } from './report';

let initialized = false;

/** 当前报告弹窗 overlay（openReportPopup 置位；closeReportPopup/unloadReadingReport 清理） */
let reportOverlay: HTMLElement | null = null;

/** 报告 ESC 层句柄（audit E：走 escManager 立约，不再私挂 document keydown） */
let reportEscHandle: { unregister: () => void } | null = null;

/** progress toast 序号：dedupeKey 每次调用唯一化——避免 notice.ts 30s 抑制窗口吞掉快速重开/连点两轮的新 toast */
let progressToastSeq = 0;

/** 骨架占位（l3：计算完成前先见「统计中…」；新增文案无 emoji） */
const SKELETON_HTML =
  '<div style="text-align: center; padding: 48px 0; color: var(--text-muted);">统计中…</div>';

/** 统计失败人话模板（m1b：不展示原始异常，技术详情留 console） */
const ERROR_HTML = `<div style="padding: 24px 0; text-align: center; color: var(--text-muted);">
  <div style="font-size: 1.2em; margin-bottom: 8px; color: var(--text-normal);">统计失败</div>
  <div>读取书库时出错，请查看控制台获取详情</div>
</div>`;

/** 幂等初始化（懒加载） */
export function ensureReadingReport(app: App): void {
  if (initialized) return;
  initialized = true;
}

/** 生成完整报告并弹窗展示（show-reading-report 命令回调；返回 Promise 便于测试等待完成） */
export function showReadingReport(app: App): Promise<void> {
  ensureReadingReport(app);
  return generateEnhancedReadingReport(app);
}

/**
 * 让出主线程（ticket 40）：分片渲染/大数据步骤之间插帧，大库不再数秒冻结。
 * requestIdleCallback 优先（带超时兜底），不可用时退化为 setTimeout(0)。
 */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(() => resolve(), { timeout: 50 });
    } else {
      window.setTimeout(resolve, 0);
    }
  });
}

/** 关闭报告弹窗（幂等；ESC/遮罩/关闭按钮/unload 共用） */
function closeReportPopup(): void {
  if (reportOverlay) {
    reportOverlay.remove();
    reportOverlay = null;
  }
  if (reportEscHandle) {
    reportEscHandle.unregister();
    reportEscHandle = null;
  }
}

/** 打开报告弹窗（已开则先关——幂等；返回句柄供分片渲染与中止检查） */
function openReportPopup(): { overlay: HTMLElement; body: HTMLElement } {
  closeReportPopup();
  const isDarkMode = document.body.classList.contains('theme-dark');

  const overlay = document.createElement('div');
  overlay.className = 'bz-reading-report-overlay'; // 标识钩子（层级已动态发号 ADR-0067）
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: ${isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)'};
    display: flex;
    justify-content: center;
    align-items: center;
  `;
  overlay.style.zIndex = String(allocZ()); // ADR-0067：一次性报告浮层，创建即显示即发号（content 为子节点随动）

  const content = document.createElement('div');
  // p1 主题适配：面板/文字用主题变量，暗色主题可读（不再硬编码 white/#1e1e1e）
  content.style.cssText = `
    background: var(--background-primary);
    color: var(--text-normal);
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

  const titleSpan = document.createElement('span');
  titleSpan.textContent = '🧮 阅读数据分析报告';
  titleSpan.style.cssText = 'font-size: 1.1rem; font-weight: 600;';

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '❌';
  closeButton.title = '关闭';
  closeButton.className = 'bz-win-close';

  const scrollable = document.createElement('div');
  scrollable.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  `;

  closeButton.addEventListener('click', closeReportPopup);

  header.appendChild(titleSpan);
  header.appendChild(closeButton);

  content.appendChild(header);
  content.appendChild(scrollable);
  overlay.appendChild(content);

  // 移动端默认全屏跟随书架墙（用户拍板：阅读报告不设独立开关；旧 library 域退役后同键切换
  // libraryMobileDefaultFullscreen → bookshelfMobileDefaultFullscreen）；
  // 窗口内容根元素挂类（每次重建天然重挂）
  applyMobileWindowFullscreen(content, tryGetSettings().bookshelfMobileDefaultFullscreen === true);
  document.body.appendChild(overlay);
  reportOverlay = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeReportPopup();
  });

  // audit E：ESC 收编 escManager 层级（core/esc-manager 立约）——报告开着时按 ESC，
  // 命中最上可见层；不再私挂 document keydown 越过下层可见面板抢关
  reportEscHandle?.unregister();
  reportEscHandle = escManager.register('bz-reading-report', {
    isVisible: () => !!reportOverlay && reportOverlay.isConnected,
    close: () => closeReportPopup(),
  });

  return { overlay, body: scrollable };
}

/** 卸载清理（l1：需 main.ts onunload 调用接线——由 ux-core 组统一收尾；此处仅提供能力） */
export function unloadReadingReport(): void {
  initialized = false;
  closeReportPopup();
}

/** 兼容入口：整段 HTML 一次渲染（测试/旧调用面；isDarkMode 仅决定遮罩深浅） */
export function showReportInPopup(htmlContent: string, isDarkMode: boolean): void {
  void isDarkMode;
  const popup = openReportPopup();
  // s1：htmlContent 产自 report.ts（用户字段已在生成点 escapeHtml 转义），无未转义用户数据
  popup.body.innerHTML = htmlContent;
}

/** 生成完整的统计报告（l3 先建窗 → 分片计算渲染，全程不阻塞主线程超出单段窗口） */
async function generateEnhancedReadingReport(app: any): Promise<void> {
  // l3：先建窗占位（计算完成前即可见「统计中…」骨架，不再「像没点」）
  const popup = openReportPopup();
  popup.body.innerHTML = SKELETON_HTML;

  // ticket 40：progress toast 先弹（常驻帧随阶段更新；完成转 success，失败转 error）
  // dedupeKey 唯一化：30s 内快速重开/连点两次时第二轮各有独立 toast，不被去重抑制窗口静默
  const progress = notify('正在统计阅读数据…', {
    type: 'progress',
    duration: 0,
    dedupeKey: `bz-reading-report-progress-${++progressToastSeq}`,
  });

  try {
    progress.setMessage('正在读取书库…');
    await yieldToMainThread();
    const bookNotes = getAllBookNotes(app);

    progress.setMessage('正在读取 EPUB 书目…');
    await yieldToMainThread();
    const epubEntries = await getEpubBookNotes(app);
    const allNotes = epubEntries.length > 0 ? [...bookNotes, ...epubEntries] : bookNotes;

    progress.setMessage('正在计算统计数据…');
    await yieldToMainThread();
    const stats = calculateReadingStats(allNotes);

    // HTML 分片渲染：每段一个宏任务（requestIdleCallback/setTimeout），让出主线程并可逐步绘制
    const sections = buildReportSections(stats, allNotes);
    popup.body.innerHTML = ''; // 骨架占位 → 报告区（分片渐进填充）
    for (const section of sections) {
      // 弹窗已被关闭/重建 → 中止本段渲染（分片渲染时序：不写已移除的 DOM）
      if (reportOverlay !== popup.overlay || !reportOverlay.isConnected) {
        progress.hide();
        return;
      }
      await yieldToMainThread();
      // 二次校验：await 让出期间用户已关闭/重建 → 不把本段写进已摘除的 DOM
      if (reportOverlay !== popup.overlay || !reportOverlay.isConnected) {
        progress.hide();
        return;
      }
      popup.body.insertAdjacentHTML('beforeend', section.generate());
      progress.setMessage(`正在生成${section.label}…`);
    }

    if (reportOverlay === popup.overlay && reportOverlay.isConnected) {
      progress.setType('success');
      progress.setMessage('阅读统计完成');
    } else {
      // 渲染期间用户已关闭/重建弹窗 → 收起 progress toast，不留常驻残留
      progress.hide();
    }
  } catch (error) {
    // m1b：用户面人话模板，技术详情留 console
    console.error('读取阅读统计报告失败:', error);
    if (reportOverlay === popup.overlay) {
      progress.setType('error');
      progress.setMessage('统计失败：读取书库时出错，请查看控制台');
      popup.body.innerHTML = ERROR_HTML;
    } else if (progress.el.isConnected) {
      progress.hide();
    }
  }
}