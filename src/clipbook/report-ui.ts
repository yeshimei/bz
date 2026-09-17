/**
 * clipbook 阅读报告弹层（issue 358「我读了什么」）：独立 overlay 面板。
 *
 * 数据 = clipbook.json 侧写 readLog（flow.ts 阅读会话封存入账），与书库「阅读分析报告」
 * （bz-reading-report-open，书架墙面板内视图）并列不深链——本弹层只读侧写，不依赖
 * news.json 与剪藏本主面板装载态（命令直开亦可用）。
 * 范式仿 reading-report/index.ts：骨架占位 → progress toast → 分片渲染（逐段让出主线程，
 * 在途渲染可作废）→ 错误人话化（技术详情留 console）。
 * 入口：剪藏本 rail 脚注「我读了什么」/ 移动头行「报告」/ 命令 bz-clipbook-report。
 */
import type { App } from 'obsidian';
import { notify } from '../core/notice';
import { mountIcons } from '../core/ui';
import { yieldToMainThread } from '../core/utils';
import { escManager } from '../core/esc-manager';
import { readClipbookData, type ClipReadLogEntry } from './data';
import { flushReadingSession } from './flow';
import { buildClipReport, type ClipReportData, type ReportPeriod } from './report-stats';
import {
  clipReportShellHtml, clipReportSkeletonHtml, clipReportEmptyHtml, buildClipReportSections,
} from './render';

let overlayEl: HTMLElement | null = null;
let escHandle: { unregister(): void } | null = null;
/** 当前统计周期（弹层重开保留上次选择；数据每次打开重读） */
let period: ReportPeriod = 'week';
/** 本次打开期间的数据快照（打开时读一次；期间新入账的会话下次打开可见） */
let logCache: ClipReadLogEntry[] | null = null;
/** 在途渲染序号：关闭/重开使旧渲染作废（分片循环逐段检查） */
let renderSeq = 0;
let progressToastSeq = 0;
let activeProgress: ReturnType<typeof notify> | null = null;

const YIELD_MS = 50;

/** 骨架期错误人话模板（不展示原始异常；技术详情留 console） */
const ERROR_HTML = `<div class="bz-clp-rep-error">
  <div class="bz-clp-rep-error-t">统计失败</div>
  <div>读取阅读记录时出错，请重新打开；若反复出现请查看控制台</div>
</div>`;

function bodyEl(): HTMLElement | null {
  return overlayEl ? overlayEl.querySelector('[data-clp-rep-body]') as HTMLElement | null : null;
}

/** 打开报告弹层（幂等：已开则重读数据重渲）。app 参数与各域 open 入口同形。 */
export function openClipbookReport(_app?: App): void {
  // 面板开着时先把当前阅读会话入账（读到一半开报告也要看到刚才那段）
  flushReadingSession();
  if (!overlayEl) buildDom();
  syncPeriodSeg(); // 周期跨开保留：重开时 seg 高亮对齐真实 period（骨架是静态「本周」高亮）
  overlayEl!.style.display = 'flex';
  void renderBody(true);
}

/** 周期 seg 高亮 ↔ period 同步（openClipbookReport 与 setPeriod 共用） */
function syncPeriodSeg(): void {
  const seg = overlayEl?.querySelector('[data-clp-rep-period]');
  if (!seg) return;
  seg.querySelectorAll('[data-period]').forEach((b) => {
    b.classList.toggle('on', (b as HTMLElement).dataset.period === period);
  });
}

/** 关闭弹层（隐藏 + 作废在途渲染 + 清数据快照；DOM 保留供重开复用） */
export function closeClipbookReport(): void {
  renderSeq++;
  releaseProgress();
  if (overlayEl) overlayEl.style.display = 'none';
  logCache = null;
}

/** 卸载清理（clipbook index unloadClipbook 链；main.ts 不另挂）：摘 DOM + 注销 ESC */
export function unloadClipbookReport(): void {
  closeClipbookReport();
  if (escHandle) {
    try { escHandle.unregister(); } catch (e) { /* 幂等 */ }
    escHandle = null;
  }
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

function releaseProgress(): void {
  if (activeProgress) {
    activeProgress.hide();
    activeProgress = null;
  }
}

function buildDom(): void {
  overlayEl = document.createElement('div');
  overlayEl.className = 'bz-panel-overlay bz-clip-report-overlay';
  overlayEl.innerHTML = clipReportShellHtml();
  document.body.appendChild(overlayEl);
  mountIcons(overlayEl);

  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) { closeClipbookReport(); return; }
    const t = e.target as HTMLElement;
    if (t.closest('[data-clp-rep-close]')) { closeClipbookReport(); return; }
    const segBtn = t.closest('[data-period]') as HTMLElement | null;
    if (segBtn) setPeriod((segBtn.dataset.period || 'week') as ReportPeriod);
  });
  // 关闭钮键盘可达（Enter/Space）
  overlayEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-clp-rep-close]')) { e.preventDefault(); closeClipbookReport(); }
  });

  escHandle = escManager.register('bz-clipbook-report', {
    isVisible: () => !!overlayEl && overlayEl.style.display !== 'none',
    close: closeClipbookReport,
  });
}

/** 周期切换（本周/本月）：seg 高亮 + 数据快照在内存 → 纯重算重渲，不重读侧写 */
function setPeriod(next: ReportPeriod): void {
  if (next === period) return;
  period = next;
  syncPeriodSeg();
  void renderBody(false);
}

/**
 * 渲染报告体：骨架 →（首开）读侧写 → 空态 / 分段填充（逐段让出主线程）。
 * alive 守卫：渲染中途关闭/重开 → 立即中止，不写已摘除的 DOM。
 */
async function renderBody(withToast: boolean): Promise<void> {
  const body = bodyEl();
  if (!body) return;
  const seq = ++renderSeq;
  const alive = (): boolean => seq === renderSeq && !!overlayEl && overlayEl!.style.display !== 'none' && body.isConnected;

  body.innerHTML = clipReportSkeletonHtml();

  const progress = withToast
    ? notify('正在统计剪藏阅读数据…', { type: 'progress', duration: 0, dedupeKey: `bz-clipbook-report-progress-${++progressToastSeq}` })
    : null;
  if (progress) activeProgress = progress;
  const finishAbort = (): void => {
    if (progress && activeProgress === progress) { progress.hide(); activeProgress = null; }
  };

  try {
    if (!logCache) {
      progress?.setMessage('正在读取阅读记录…');
      await yieldToMainThread(YIELD_MS);
      if (!alive()) return finishAbort();
      const sidecar = await readClipbookData();
      if (!alive()) return finishAbort();
      logCache = sidecar.readLog || [];
    }

    // 空态人话：还没有任何阅读记录（openClipbookReport 已先 flush，能记的都在了）
    if (!logCache.length) {
      body.innerHTML = clipReportEmptyHtml();
      mountIcons(body);
      if (progress && activeProgress === progress) { progress.hide(); activeProgress = null; }
      return;
    }

    progress?.setMessage('正在计算统计数据…');
    await yieldToMainThread(YIELD_MS);
    if (!alive()) return finishAbort();
    const data: ClipReportData = buildClipReport(logCache, period, new Date());

    // 本期空态：readLog 有记录但本期窗口（本周/本月）没读过，或记录全是零分钟段——
    // 整页只显空态，不渲染零值统计段（issue 358 真机回归「没有阅读记录时统计有误」）。
    // 首次渲染 / 周期切换 / 分段懒生成三路都经 renderBody，本短路在分段循环前统一收口。
    if (!data.articles && !data.totalMinutes) {
      body.innerHTML = clipReportEmptyHtml();
      mountIcons(body);
      if (progress && activeProgress === progress) { progress.hide(); activeProgress = null; }
      return;
    }

    body.innerHTML = ''; // 骨架 → 报告区（分段渐进填充）
    for (const section of buildClipReportSections(data)) {
      if (!alive()) return finishAbort();
      await yieldToMainThread(YIELD_MS);
      // 二次校验：让出期间弹层可能已被关闭 → 不把本段写进已隐藏的 DOM
      if (!alive()) return finishAbort();
      body.insertAdjacentHTML('beforeend', section.generate());
      progress?.setMessage(`正在生成${section.label}…`);
    }
    if (alive()) {
      mountIcons(body);
      if (progress && activeProgress === progress) {
        activeProgress = null;
        // 完成转 success：notice 内部按新类型自动重排消失计时（UX 整改 16），无需手动 hide
        progress.setType('success');
        progress.setMessage('剪藏阅读统计完成');
      }
    } else {
      finishAbort();
    }
  } catch (error) {
    // 错误人话化：用户面只见模板，技术详情留 console
    console.error('[剪藏本] 阅读报告生成失败', error);
    releaseProgress();
    if (alive()) body.innerHTML = ERROR_HTML;
  }
}

/** 域外入口便捷形（main.ts 命令表回调同构：与各域 open(app) 一形） */
export function openClipbookReportCommand(app?: App): void {
  openClipbookReport(app);
}
