/**
 * clipbook 阅读报告弹层（issue 358「我读了什么」）：独立 overlay 面板。
 *
 * 数据 = clipbook.json 侧写 readLog（flow.ts 阅读会话封存入账）+ news.json 真实库
 * （2026-09-23 重做新增「报库盘点」段：建库以来口径，读失败整段省略不碍阅读分析），
 * 与书库「阅读分析报告」（bz-reading-report-open，书架墙面板内视图）并列不深链。
 * 范式仿 reading-report/index.ts：骨架占位 → progress toast → 分片渲染（逐段让出主线程，
 * 在途渲染可作废）→ 错误人话化（技术详情留 console）。
 * 入口：剪藏本 rail 脚注「我读了什么」/ 移动头行「报告」/ 命令 bz-clipbook-report。
 */
import type { App } from 'obsidian';
import { notify } from '../core/notice';
import { mountIcons, uiEmpty, uiBtn, uiBtnRow } from '../core/ui';
import { topifyZ } from '../core/dom';
import { getApp } from '../core/app';
import { yieldToMainThread } from '../core/utils';
import { escManager } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { readClipbookData, type ClipReadLogEntry } from './data';
import { readNewsData } from './news-data';
import { articleKeyOf } from './constants';
import { M } from './state';
import { flushReadingSession } from './flow';
import { buildClipReport, buildLibraryStats, busiestDay, type ClipLibraryStats, type ClipReportData, type ReportPeriod } from './report-stats';
import {
  clipReportShellHtml, clipReportSkeletonHtml, buildClipReportSections,
} from './render';
import { motionReportIn, motionReportSection, motionLoadingPulse } from './motion';
import { openClipbook } from './index';
import { revealArticleByKey } from './ui';

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
/** 打开时记下的 app（空态「去剪藏本读几篇」动作跳转用；命令直开亦有 app） */
let reportApp: App | null = null;

const YIELD_MS = 50;

/** 统计 toast 判据（审查修复批 体验⑪；reading-report 侧 2026-09-20 已改 QUIET_TOAST_MIN_BOOKS=500 静默档，两侧阈值口径独立不再互指）：
 *  readLog 不足该条数时聚合毫秒级完成，progress/完成双 toast 徒增噪音——弹层内骨架已给反馈。 */
const QUIET_TOAST_MIN_ENTRIES = 500;

/** 骨架期错误人话模板（不展示原始异常；技术详情留 console） */
const ERROR_HTML = `<div class="bz-clp-rep-error">
  <div class="bz-clp-rep-error-t">统计失败</div>
  <div>读取阅读记录时出错，请重新打开；若反复出现请查看控制台</div>
</div>`;

function bodyEl(): HTMLElement | null {
  return overlayEl ? overlayEl.querySelector('[data-clp-rep-body]') as HTMLElement | null : null;
}

/** Top5 可点回看的可定位 key 集（效率#20）：面板装载面（M.articles id ∪ clip 面派生键）
 *  ∪ news.json 现读（报告不依赖主面板装载态——命令直开也能定位 news 条目）。
 *  读盘失败按已收集部分返回（失隐条目诚实不挂「打开」钮，不承诺定位不到的条目）。 */
async function collectAvailableKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const a of M.articles || []) keys.add(a.id);
  for (const n of M.clipNotes || []) {
    if (n && n.path) keys.add('clip:' + String(n.path));
  }
  try {
    const res = await readNewsData();
    if (res.ok && !res.missing) {
      for (const raw of ((res.data && res.data.articles) || []) as any[]) keys.add(articleKeyOf(raw));
    }
  } catch (e) { /* 读盘失败按空补充——已有集合仍可用 */ }
  return keys;
}

/** 打开报告弹层（幂等：已开则重读数据重渲）。app 参数与各域 open 入口同形。
 *  审查修复批 P2③：重入先 releaseProgress——上次渲染在途时旧「正在统计…」常驻 toast
 *  因 activeProgress 易主而 finishAbort 不回收，此处先收掉（对照 reading-report
 *  renderReadingReport 开头的 cancelReadingReport）。
 *  审查修复批 P3⑤：flush 暴露 promise，await 落盘后再读侧写——刚读的段本次打开即可见。 */
export async function openClipbookReport(_app?: App): Promise<void> {
  reportApp = _app || null;
  // 面板开着时先把当前阅读会话入账（读到一半开报告也要看到刚才那段）
  await flushReadingSession();
  releaseProgress(); // 重入防 toast 泄漏（上一轮在途渲染醒来后 finishAbort 不再误持旧 toast）
  if (!overlayEl) buildDom();
  syncPeriodSeg(); // 周期跨开保留：重开时 seg 高亮对齐真实 period（骨架是静态「本周」高亮）
  overlayEl!.style.display = 'flex';
  // 显示即发号（ADR-0067）：本弹层是独立 overlay，剪藏本主面板开着时（rail 脚注入口常是这种场景）
  // 主面板经 topifyZ 已持号——不发号则本层 z-index:auto 恒在其下，报告「被主弹窗遮挡」。
  // 每次打开抬顶（含重开），与「后显示恒在上」一致。
  topifyZ(overlayEl);
  // 打开即入焦 + Tab 圈闭（呈报#13 F3+H3 全域范式，core trapPanelFocus 单源）
  trapPanelFocus(overlayEl!.querySelector<HTMLElement>('.bz-clip-report-frame') ?? overlayEl!);
  motionReportIn(overlayEl!); // 动效：弹层升帘（遮罩快淡入 + 框体浮起）
  await renderBody(true);
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

/** 卸载清理（clipbook index unloadClipbook 链；main.ts 不另挂）：摘 DOM + 注销 ESC。
 *  卸载 = 全新会话：复位 period（「周期跨开保留」仅指关弹层再开的用户路径）。 */
export function unloadClipbookReport(): void {
  closeClipbookReport();
  period = 'week';
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
    if (segBtn) { setPeriod((segBtn.dataset.period || 'week') as ReportPeriod); return; }
    // Top5 回看（效率#20）：收报告弹层后按 key 定位选中（面板开着 selectArticle / 未开走装载链）
    const openBtn = t.closest('[data-clip-rep-open]') as HTMLElement | null;
    if (openBtn) {
      const row = openBtn.closest('[data-clip-rep-key]') as HTMLElement | null;
      const key = row ? row.getAttribute('data-clip-rep-key') || '' : '';
      if (key) { closeClipbookReport(); revealArticleByKey(key); }
    }
  });
  // 关闭钮键盘可达（Enter/Space）；Top5「打开」钮同款（效率#20）
  overlayEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-clp-rep-close]')) { e.preventDefault(); closeClipbookReport(); return; }
    const openBtn = t.closest('[data-clip-rep-open]') as HTMLElement | null;
    if (openBtn) {
      const row = openBtn.closest('[data-clip-rep-key]') as HTMLElement | null;
      const key = row ? row.getAttribute('data-clip-rep-key') || '' : '';
      if (key) { e.preventDefault(); closeClipbookReport(); revealArticleByKey(key); }
    }
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

/** 空态（审查修复批 ⑨⑩）：改 core uiEmpty 标准件 + 动作（手册 §8.3——自造 empty 正是
 *  上次图标失控根因）。两态人话区分（⑨）：
 *  - never：readLog 全空 = 还没在剪藏本里读过 → 引导去读（关报告 + 开剪藏本面板）；
 *  - period：有记录但本期窗口没读过/全零分钟段 → 文案带周期上下文，另一期有记录时
 *    给「切到 X 看看」直达（switchTo = 另一期；两期都空不给按钮）。 */
function buildClipReportEmpty(kind: 'never' | 'period', switchTo?: ReportPeriod): HTMLElement {
  if (kind === 'period') {
    const curLabel = period === 'week' ? '本周' : '本月';
    const otherLabel = switchTo === 'week' ? '本周' : switchTo === 'month' ? '本月' : '';
    return uiEmpty({
      icon: 'book-open',
      title: `${curLabel}还没读过`,
      desc: otherLabel ? '阅读记录还在，换个周期看看' : '阅读记录还不在这两个周期里',
      actions: otherLabel
        ? uiBtnRow([uiBtn({ label: `切到${otherLabel}看看`, icon: 'calendar', onClick: () => setPeriod(switchTo!) })], { center: true })
        : undefined,
    });
  }
  return uiEmpty({
    icon: 'book-open',
    title: '还没有阅读记录',
    desc: '在剪藏本里打开文章阅读，停留满一分钟就会自动记到这里',
    actions: uiBtnRow([uiBtn({
      label: '去剪藏本读几篇',
      icon: 'scissors',
      tone: 'primary',
      onClick: () => { closeClipbookReport(); openClipbook(reportApp || getApp()); },
    })], { center: true }),
  });
}

/** 空态装配（uiEmpty 产出 DOM 元素；图标经 mountIcons 兑现） */
function renderEmptyState(body: HTMLElement, empty: HTMLElement): void {
  body.innerHTML = '';
  body.appendChild(empty);
  mountIcons(body);
}

/**
 * 渲染报告体：骨架 →（首开）读侧写 → 空态 / 分段填充（逐段让出主线程）。
 * alive 守卫：渲染中途关闭/重开 → 立即中止，不写已摘除的 DOM。
 * 统计 toast（体验⑪）：创建点在数据快照到手后——小数据量（< QUIET_TOAST_MIN_ENTRIES 条）
 * 毫秒级聚合直接跳过 toast（骨架已给反馈）；读取阶段由骨架顶着，不为它多弹一帧。
 */
async function renderBody(withToast: boolean): Promise<void> {
  const body = bodyEl();
  if (!body) return;
  const seq = ++renderSeq;
  const alive = (): boolean => seq === renderSeq && !!overlayEl && overlayEl!.style.display !== 'none' && body.isConnected;

  body.innerHTML = clipReportSkeletonHtml();
  motionLoadingPulse(body.firstElementChild as HTMLElement | null); // 功能性呼吸指示（不入台账）

  try {
    if (!logCache) {
      await yieldToMainThread(YIELD_MS);
      if (!alive()) return;
      const sidecar = await readClipbookData();
      if (!alive()) return;
      logCache = sidecar.readLog || [];
    }

    const progress = withToast && logCache.length >= QUIET_TOAST_MIN_ENTRIES
      ? notify('正在统计剪藏阅读数据…', { type: 'progress', duration: 0, dedupeKey: `bz-clipbook-report-progress-${++progressToastSeq}` })
      : null;
    if (progress) activeProgress = progress;
    const finishAbort = (): void => {
      if (progress && activeProgress === progress) { progress.hide(); activeProgress = null; }
    };

    // 空态人话·首次：还没有任何阅读记录（openClipbookReport 已先 flush，能记的都在了）
    if (!logCache.length) {
      renderEmptyState(body, buildClipReportEmpty('never'));
      motionReportSection(body.firstElementChild, 0); // 动效：空态轻浮出
      if (progress && activeProgress === progress) { progress.hide(); activeProgress = null; }
      return;
    }

    progress?.setMessage('正在计算统计数据…');
    await yieldToMainThread(YIELD_MS);
    if (!alive()) return finishAbort();
    const data: ClipReportData = buildClipReport(logCache, period, new Date());
    // Top5 可点回看（效率#20）：现查库内可定位条目，命中行才挂「打开」钮
    const availKeys = await collectAvailableKeys();
    if (!alive()) return finishAbort();
    // 报库盘点（2026-09-23 重做）：news.json 真实家底（建库以来口径，与周期无关）；
    // 读盘失败/缺失 → library null，报库段整段省略，阅读分析不受影响
    let library: ClipLibraryStats | null = null;
    try {
      const res = await readNewsData();
      if (res.ok && !res.missing) library = buildLibraryStats((res.data && res.data.articles) as never, new Date());
    } catch (e) { library = null; }
    if (!alive()) return finishAbort();
    const busiest = busiestDay(logCache, period, new Date());

    // 本期空态（⑨）：readLog 有记录但本期窗口（本周/本月）没读过，或记录全是零分钟段——
    // 整页只显空态，不渲染零值统计段（issue 358 真机回归「没有阅读记录时统计有误」）。
    // 另一期有记录 → 给「切到 X 看看」直达；两期都空 → 纯文案。
    // 首次渲染 / 周期切换 / 分段懒生成三路都经 renderBody，本短路在分段循环前统一收口。
    if (!data.articles && !data.totalMinutes) {
      const other: ReportPeriod = period === 'week' ? 'month' : 'week';
      const otherData = buildClipReport(logCache, other, new Date());
      const switchTo = otherData.articles || otherData.totalMinutes ? other : undefined;
      renderEmptyState(body, buildClipReportEmpty('period', switchTo));
      motionReportSection(body.firstElementChild, 0); // 动效：空态也走一段轻浮出
      if (progress && activeProgress === progress) { progress.hide(); activeProgress = null; }
      return;
    }

    body.innerHTML = ''; // 骨架 → 报告区（分段渐进填充）
    let secIdx = 0;
    for (const section of buildClipReportSections(data, { availableKeys: availKeys, library, busiest })) {
      if (!alive()) return finishAbort();
      await yieldToMainThread(YIELD_MS);
      // 二次校验：让出期间弹层可能已被关闭 → 不把本段写进已隐藏的 DOM
      if (!alive()) return finishAbort();
      body.insertAdjacentHTML('beforeend', section.generate());
      motionReportSection(body.lastElementChild, secIdx++); // 动效：逐段落版（段内件接力）
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
