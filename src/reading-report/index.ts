/**
 * 阅读数据分析报告（reading-report 域）：嵌入书架墙面板的视图渲染器。
 * 独立弹窗退役（用户拍板「读书报告内嵌化」：书的报告与影视报告一样写进面板）——
 * 本模块只负责报告内容区的产出：分片渲染（ticket 40 不卡死）+ progress toast + 错误人话化（m1b）
 * + 视图内交互（热力图 ‹ › 翻月、年卡展开收起）；挂载点、返回导航、同面板筛选由 bookshelf 面板提供
 * （书架墙左栏「阅读分析报告」入口与命令 bz-reading-report-open 都指向面板内报告视图）。
 *
 * 保留的既有机制：l3 先渲染骨架占位、s1 用户字段生成点转义（innerHTML 均静态模板/已转义内容）、
 * 渲染中途取消不写已摘除 DOM（容器卸载/视图切走/面板关闭经 cancelReadingReport 作废在途渲染）。
 */
import type { App } from 'obsidian';
import { notify } from '../core/notice';
import { uiIcon, uiEmpty, uiBtn, uiBtnRow } from '../core/ui';
import { resolveFolderPath } from '../bookshelf/data';
import {
  getAllBookNotes,
  calculateReadingStats,
  getEpubBookNotes,
  getHeatmapMonthKeys,
  processHeatmapData,
} from './stats';
import { buildReportSections, generateHeatmapGrid, heatmapMonthTitle } from './report';

/** 在途渲染序号：cancelReadingReport/新渲染使旧渲染全部作废（分片循环逐段检查） */
let renderSeq = 0;

/** progress toast 序号：dedupeKey 每次调用唯一化——避免 notice.ts 30s 抑制窗口吞掉快速重开的新 toast */
let progressToastSeq = 0;

/** 在途 progress toast 句柄（cancel 时收起，不留常驻残留） */
let activeProgress: ReturnType<typeof notify> | null = null;

/** 热力图翻月状态（每次渲染重置；‹ › 在全部月份间移动，只重渲染热力图主体） */
let lastHeatmap: { data: any; keys: string[]; cursor: string } | null = null;

/** 骨架占位（l3：计算完成前先见「统计中…」；文案无 emoji） */
const SKELETON_HTML =
  '<div style="text-align: center; padding: 48px 0; color: var(--text-muted);">统计中…</div>';

/** 统计失败人话模板（m1b：不展示原始异常，技术详情留 console） */
const ERROR_HTML = `<div style="padding: 24px 0; text-align: center; color: var(--text-muted);">
  <div style="font-size: 1.2em; margin-bottom: 8px; color: var(--text-normal);">统计失败</div>
  <div>读取书库时出错，请查看控制台获取详情</div>
</div>`;

/** 报告渲染选项：同面板筛选与返回书架的回调（bookshelf 面板注入） */
export interface ReportRenderOptions {
  /** 报告作者/分类行点击 → 同面板切回书架列表并预填筛选（原深链作废） */
  onFilter?: (kind: 'author' | 'category', value: string) => void;
  /** 空态主按钮 → 切回书架视图收录 */
  onBack?: () => void;
}

/** 容器内 data-lucide 占位替换为 setIcon 渲染的真图标（保持 class 修饰） */
function mountIcons(container: HTMLElement): void {
  container.querySelectorAll('i[data-lucide]').forEach((el) => {
    const name = el.getAttribute('data-lucide') || '';
    const cls = el.className;
    const fresh = uiIcon(name, '');
    if (cls && cls !== 'bz-ic') fresh.className = cls;
    el.replaceWith(fresh);
  });
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

/** 作废在途渲染 + 收起在途 progress toast（视图切走/面板关闭/卸载共用；幂等） */
export function cancelReadingReport(): void {
  renderSeq++;
  if (activeProgress) {
    activeProgress.hide();
    activeProgress = null;
  }
}

/** 卸载清理（main.ts onunload 调用）：作废在途渲染 + 复位模块状态 */
export function unloadReadingReport(): void {
  cancelReadingReport();
  lastHeatmap = null;
}

/** 空库空态（空态带动作拍板）：主按钮引导回书架收录（面板 onBack 切回书架列表） */
function buildEmptyState(opts: ReportRenderOptions, folderPath: string): HTMLElement {
  const actions = uiBtnRow(
    [
      uiBtn({
        label: '去书架墙添加',
        icon: 'book-open',
        tone: 'primary',
        onClick: () => opts.onBack?.(),
      }),
    ],
    { center: true },
  );
  const empty = uiEmpty({
    icon: 'library-big',
    title: '书库还没有可统计的书',
    desc: `把书籍笔记放进「${folderPath}」文件夹并在 frontmatter 加 book 标签，收录后这里自动生成阅读报告`,
    actions,
  });
  return empty;
}

/**
 * 渲染报告到书架墙面板的内容区（视图挂载点由 bookshelf 提供）。
 * 流程：作废在途渲染 → 骨架占位 → progress toast → 分片计算渲染（逐段让出主线程）→ 图标挂载。
 * 渲染期间容器被移除/视图切走/面板关闭 → 立即中止，不写已摘除的 DOM。
 */
export function renderReadingReport(container: HTMLElement, app: App, opts: ReportRenderOptions = {}): void {
  cancelReadingReport();
  const seq = renderSeq;
  const alive = () => seq === renderSeq && container.isConnected;

  // l3：先渲染骨架占位（计算完成前即可见「统计中…」，不再「像没点」）
  container.innerHTML = SKELETON_HTML;

  // ticket 40：progress toast 先弹（常驻帧随阶段更新；完成转 success，失败转 error）
  // dedupeKey 唯一化：30s 内快速重开时新一轮有独立 toast，不被去重抑制窗口静默
  const progress = notify('正在统计阅读数据…', {
    type: 'progress',
    duration: 0,
    dedupeKey: `bz-reading-report-progress-${++progressToastSeq}`,
  });
  activeProgress = progress;

  /** 渲染被中止：收起 toast，不写 DOM */
  const finishAbort = (): void => {
    progress.hide();
    if (activeProgress === progress) activeProgress = null;
  };

  /** 渲染完成：空库静默收尾（无统计可报），否则转 success 反馈 */
  const finishDone = (isEmpty: boolean): void => {
    if (activeProgress === progress) activeProgress = null;
    if (isEmpty) {
      progress.hide();
    } else {
      progress.setType('success');
      progress.setMessage('阅读统计完成');
    }
  };

  const step = async (): Promise<void> => {
    progress.setMessage('正在读取书库…');
    await yieldToMainThread();
    if (!alive()) return finishAbort();
    const bookNotes = getAllBookNotes(app);

    progress.setMessage('正在读取 EPUB 书目…');
    await yieldToMainThread();
    if (!alive()) return finishAbort();
    const epubEntries = await getEpubBookNotes(app);
    if (!alive()) return finishAbort();
    const allNotes = epubEntries.length > 0 ? [...bookNotes, ...epubEntries] : bookNotes;

    // 空库空态（空态带动作拍板）：无任何书目 → 引导回书架收录，不渲染空报告
    if (allNotes.length === 0) {
      container.innerHTML = '';
      container.appendChild(buildEmptyState(opts, resolveFolderPath()));
      mountIcons(container);
      return finishDone(true);
    }

    progress.setMessage('正在计算统计数据…');
    await yieldToMainThread();
    if (!alive()) return finishAbort();
    const stats = calculateReadingStats(allNotes);

    // 热力图翻月状态：段生成前初始化（游标 = 最近有阅读的月份；‹ › 经 handleReportInteraction 移动）
    const hmData = processHeatmapData(stats.readingSessions);
    const hmKeys = getHeatmapMonthKeys(hmData);
    lastHeatmap = { data: hmData, keys: hmKeys, cursor: hmKeys[hmKeys.length - 1] || '' };

    // HTML 分片渲染：每段一个宏任务（requestIdleCallback/setTimeout），让出主线程并可逐步绘制
    const sections = buildReportSections(stats, allNotes);
    container.innerHTML = ''; // 骨架占位 → 报告区（分片渐进填充）
    for (const section of sections) {
      if (!alive()) return finishAbort();
      await yieldToMainThread();
      // 二次校验：await 让出期间容器可能已被摘除 → 不把本段写进已移除的 DOM
      if (!alive()) return finishAbort();
      container.insertAdjacentHTML('beforeend', section.generate());
      progress.setMessage(`正在生成${section.label}…`);
    }

    if (alive()) {
      mountIcons(container);
      finishDone(false);
    } else {
      finishAbort();
    }
  };

  void step().catch((error) => {
    // m1b：用户面人话模板，技术详情留 console
    console.error('读取阅读统计报告失败:', error);
    if (activeProgress === progress) activeProgress = null;
    if (alive()) {
      progress.setType('error');
      progress.setMessage('统计失败：读取书库时出错，请重试；若反复出现请重新打开面板');
      container.innerHTML = ERROR_HTML;
    } else {
      progress.hide();
    }
  });
}

/**
 * 报告视图内交互（bookshelf 面板事件委托转调；返回是否命中报告交互）：
 * - 热力图段头 ‹ ›：移动翻月游标，只重渲染热力图主体与段头标题；
 * - 年卡：切换该年 12 月柱展开体（.open 类，纯 CSS 显隐）。
 */
export function handleReportInteraction(container: HTMLElement, target: HTMLElement): boolean {
  const prevBtn = target.closest('[data-rr-hm-prev]') as HTMLElement | null;
  const nextBtn = target.closest('[data-rr-hm-next]') as HTMLElement | null;
  if (prevBtn || nextBtn) {
    navHeatmap(container, nextBtn ? 1 : -1);
    return true;
  }

  const yearCard = target.closest('[data-rr-year]') as HTMLElement | null;
  if (yearCard) {
    const year = yearCard.getAttribute('data-rr-year') || '';
    const body = container.querySelector(`[data-rr-year-body="${year}"]`);
    if (body) {
      body.classList.toggle('open');
      yearCard.classList.toggle('open');
    }
    return true;
  }

  return false;
}

/** 热力图翻月（‹ 上一月 / › 下一月；边界月按钮 disabled，越界为空操作） */
function navHeatmap(container: HTMLElement, dir: number): void {
  if (!lastHeatmap || lastHeatmap.keys.length === 0) return;
  const idx = lastHeatmap.keys.indexOf(lastHeatmap.cursor);
  const nextIdx = Math.min(lastHeatmap.keys.length - 1, Math.max(0, idx + dir));
  if (nextIdx === idx) return;
  lastHeatmap.cursor = lastHeatmap.keys[nextIdx];

  const body = container.querySelector('[data-rr-hm-body]') as HTMLElement | null;
  if (body) {
    body.innerHTML = generateHeatmapGrid(lastHeatmap.data, lastHeatmap.cursor);
    mountIcons(body);
  }
  const title = container.querySelector('[data-rr-hm-title]') as HTMLElement | null;
  if (title) title.textContent = heatmapMonthTitle(lastHeatmap.cursor);
}
