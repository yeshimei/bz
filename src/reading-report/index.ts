/**
 * 阅读数据分析报告（reading-report 域）：嵌入书架墙面板的视图渲染器。
 * 独立弹窗退役（用户拍板「读书报告内嵌化」：书的报告与影视报告一样写进面板）——
 * 本模块只负责报告内容区的产出：分片渲染（ticket 40 不卡死）+ progress toast + 错误人话化（m1b）
 * + 视图内交互（热力图 ‹ › 翻月、年卡展开收起、键盘激活）；挂载点与同面板筛选由 bookshelf 面板提供
 * （返回书库 = 报告头行返回钮 data-rr-goto-shelf，桌面/移动恒可见；入口 = 命令 bz-reading-report-open）。
 *
 * 保留的既有机制：l3 先渲染骨架占位、s1 用户字段生成点转义（innerHTML 均静态模板/已转义内容）、
 * 渲染中途取消不写已摘除 DOM（容器卸载/视图切走/面板关闭经 cancelReadingReport 作废在途渲染）。
 *
 * 渲染档位（深审 RR-A2）：ReportRenderOptions 扩两维——
 * - silent：自动刷新降档（宿主 refreshReportView 传入）——不弹 progress/success toast、
 *   保留翻月游标/年卡展开/滚位（RR-F2/RR-UX1）；失败 toast 恒保留。
 * - dataSignature：数据签名——签名命中且容器仍有报告内容时零重算零 toast 直接返回（EFF-4 ①档）。
 * 交互状态单容器归宿（RR-A4）：翻月游标存 container.dataset.rrCursor（渲染器为单实例设计，
 * 与宿主 M.currentOverlay 单例同构）。
 */
import { yieldToMainThread as yieldToMainThreadCore } from '../core/utils';
import type { App } from 'obsidian';
import { notify } from '../core/notice';
import { mountIcons, uiEmpty, uiBtn, uiBtnRow } from '../core/ui';
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

/** 在途 progress toast 句柄（cancel 时收起，不留常驻残留） */
let activeProgress: ReturnType<typeof notify> | null = null;

/** 热力图翻月数据缓存（每次渲染重置；‹ › 在全部月份间移动，只重渲染热力图主体；游标存容器 dataset） */
let lastHeatmap: { data: any; keys: string[] } | null = null;

/** 上次成功渲染的数据签名（EFF-4：dataSignature 命中即短路；卸载复位） */
let lastAcceptedSignature: string | null = null;

/** 骨架占位（l3：计算完成前先见「统计中…」；样式收编域 styles.css——C-2/RR-U10） */
const SKELETON_HTML = '<div class="bz-rr-skeleton">统计中…</div>';

/** 统计失败人话模板（m1b：不展示原始异常，技术详情留 console；C-5：与 toast 同口径去「控制台」引导） */
const ERROR_HTML = `<div class="bz-rr-error">
  <div class="bz-rr-error-title">统计失败</div>
  <div>读取书库时出错，请重试或重新打开面板</div>
</div>`;

/** 报告渲染选项：同面板筛选与返回书架的回调（bookshelf 面板注入）+ 渲染档位（RR-A2） */
export interface ReportRenderOptions {
  /** 报告作者/分类行点击 → 同面板切回书架列表并预填筛选（原深链作废） */
  onFilter?: (kind: 'author' | 'category', value: string) => void;
  /** 空态主按钮 → 切回书架视图收录 */
  onBack?: () => void;
  /** 静默档（自动刷新用）：跳过 progress/success toast，保留翻月/展开/滚位（失败 toast 恒保留） */
  silent?: boolean;
  /** 数据签名（EFF-4）：与上次成功渲染签名相同且容器仍有报告内容 → 跳过重算直接返回 */
  dataSignature?: string;
}

/**
 * 小库静默档阈值（深审 EFF-7，判据移植自 clipbook QUIET_TOAST_MIN_ENTRIES 同语义）：
 * 书目数低于该值时统计毫秒级完成，progress/success 双 toast 徒增噪音——骨架即反馈。
 * （clipbook report-ui.ts 头部注释声称两侧「同口径」在落地前系失实描述，主线程登记纠偏。）
 */
export const QUIET_TOAST_MIN_BOOKS = 500;

/** requestIdleCallback 超时兜底（防止长空闲期饿死分片渲染） */
const IDLE_CALLBACK_TIMEOUT_MS = 50;

/**
 * 让出主线程（ticket 40）：分片渲染/大数据步骤之间插帧，大库不再数秒冻结。
 * requestIdleCallback 优先（带超时兜底），不可用时退化为 setTimeout(0)。
 */
function yieldToMainThread(): Promise<void> {
  return yieldToMainThreadCore(IDLE_CALLBACK_TIMEOUT_MS);
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
  lastAcceptedSignature = null;
}

/** 容器是否仍持有已渲染的报告内容（骨架/空态不算——签名短路的前提是「报告在屏」） */
function hasReportContent(container: HTMLElement): boolean {
  return !container.querySelector('.bz-rr-skeleton') &&
    (container.querySelector('.bz-rr-card, .bz-rr-panel, .bz-rr-hero, .bz-empty') !== null);
}

/**
 * 键盘激活（深审 EFF-2/RR-U2）：年卡/作者卡/分类行为 role="button" + tabindex 的 div，
 * Enter/Space 合成 click——域内交互（年卡）直接走 handleReportInteraction，作者/分类
 * 预填依赖宿主委托（applyReportFilter），合成 click 冒泡复用整条宿主委托路径。
 * 翻月钮是原生 button，Enter/Space 天然触发 click，不在此列。
 */
function bindKeyboardActivation(container: HTMLElement): void {
  container.onkeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target as HTMLElement | null;
    if (!target || target === container) return;
    const activate = target.closest('[data-rr-year], [data-rr-author], [data-rr-cat]') as HTMLElement | null;
    if (!activate) return;
    e.preventDefault();
    if (activate.hasAttribute('data-rr-author') || activate.hasAttribute('data-rr-cat')) {
      activate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } else {
      handleReportInteraction(container, activate);
    }
  };
}

/** 空库空态（空态带动作拍板）：主按钮引导回书架收录（面板 onBack 切回书架列表） */
function buildEmptyState(opts: ReportRenderOptions, folderPath: string): HTMLElement {
  const actions = uiBtnRow(
    [
      uiBtn({
        label: '去书库添加',
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
 * 流程：签名短路（EFF-4）→ 作废在途渲染 → 骨架占位（silent 档跳过防闪空）→
 * 采集书目 → 大库弹 progress toast（EFF-7 小库静默；RR-F2 silent 全跳）→
 * 分片计算渲染（逐段让出主线程，C-3 先报再做）→ 图标挂载。
 * 渲染期间容器被移除/视图切走/面板关闭 → 立即中止，不写已摘除的 DOM。
 */
export function renderReadingReport(container: HTMLElement, app: App, opts: ReportRenderOptions = {}): void {
  // EFF-4 ①档：同签名且报告仍在屏 → 零重算零 toast（不动在途渲染）
  if (opts.dataSignature !== undefined
    && lastAcceptedSignature === opts.dataSignature
    && hasReportContent(container)) {
    return;
  }

  cancelReadingReport();
  const seq = renderSeq;
  const alive = () => seq === renderSeq && container.isConnected;

  // 新一轮渲染不带签名 → 旧签名记账作废（防「无签名重算后同签名误命中」）
  if (opts.dataSignature === undefined) lastAcceptedSignature = null;

  bindKeyboardActivation(container);

  // RR-F2/RR-UX1：silent 重算前快照交互状态——年卡展开（按 data-rr-year 值）与滚位；
  // 翻月游标单容器归宿（dataset.rrCursor），段生成时透传
  const snapshot = opts.silent
    ? {
        openYears: Array.from(container.querySelectorAll('[data-rr-year].open'))
          .map((el) => el.getAttribute('data-rr-year') || '')
          .filter(Boolean),
        scrollTop: container.scrollTop,
      }
    : null;
  if (!opts.silent) delete container.dataset.rrCursor; // 手动重渲 = 回默认视图（语义不变）

  // l3：先渲染骨架占位（计算完成前即可见「统计中…」，不再「像没点」）；
  // silent 档保留旧内容不闪骨架（RR-A2）
  if (!opts.silent) container.innerHTML = SKELETON_HTML;

  // progress 句柄挂外层作用域：catch 路径复用同一句柄原地转 error（不另弹帧）
  let progress: ReturnType<typeof notify> | null = null;

  const step = async (): Promise<void> => {
    // progress 句柄与静默判定在采集完成后才确定（计数前不弹 toast）——
    // finishAbort/finishDone 以 let 绑定闭合，提前返回路径读到的是 null/false
    let quiet = false;

    // 采集阶段（书库扫描 + weave 读取均为毫秒级快速步骤；计数前不弹 toast——
    // EFF-7 与 clipbook 同序：骨架已给反馈，小库全程静默）
    await yieldToMainThread();
    if (!alive()) return finishAbort();
    const bookNotes = getAllBookNotes(app);

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

    // EFF-7 小库静默档 + RR-A2 silent 维度：quiet = 小库；silent = 自动刷新降档。
    // 两者都只压 progress/success toast——失败 toast 恒保留（m1b 通道不因档位失声）
    quiet = opts.silent || allNotes.length < QUIET_TOAST_MIN_BOOKS;
    progress = quiet
      ? null
      : notify('正在统计阅读数据…', { type: 'progress', duration: 0 });
    if (progress) activeProgress = progress;
    const setStage = (msg: string): void => {
      if (progress) progress.setMessage(msg);
    };

    setStage('正在计算统计数据…');
    await yieldToMainThread();
    if (!alive()) return finishAbort();
    const stats = calculateReadingStats(allNotes);

    // 热力图翻月状态：段生成前初始化（游标 = 容器快照或最近有阅读的月份）
    const hmData = processHeatmapData(stats.readingSessions);
    const hmKeys = getHeatmapMonthKeys(hmData);
    lastHeatmap = { data: hmData, keys: hmKeys };
    const restoredCursor = container.dataset.rrCursor && hmKeys.includes(container.dataset.rrCursor)
      ? container.dataset.rrCursor
      : hmKeys[hmKeys.length - 1] || '';
    container.dataset.rrCursor = restoredCursor;

    // HTML 分片渲染：每段一个宏任务（requestIdleCallback/setTimeout），让出主线程并可逐步绘制。
    // C-3 先报再做（checkup/run.ts 蓝本 announce-then-do）：消息先于本段生成，进度不再滞后一拍
    const sections = buildReportSections(stats, allNotes, { heatmapCursor: restoredCursor });
    container.innerHTML = ''; // 骨架占位 → 报告区（分片渐进填充）
    for (const section of sections) {
      if (!alive()) return finishAbort();
      await yieldToMainThread();
      // 二次校验：await 让出期间容器可能已被摘除 → 不把本段写进已移除的 DOM
      if (!alive()) return finishAbort();
      setStage(`正在生成${section.label}…`);
      container.insertAdjacentHTML('beforeend', section.generate());
    }

    if (alive()) {
      // RR-F2/RR-UX1：silent 重算恢复年卡展开与滚位（游标已随 dataset 经段生成保留）
      if (snapshot) {
        for (const year of snapshot.openYears) {
          container.querySelector(`[data-rr-year="${year}"]`)?.classList.add('open');
          container.querySelector(`[data-rr-year-body="${year}"]`)?.classList.add('open');
        }
        container.scrollTop = snapshot.scrollTop;
      }
      mountIcons(container);
      finishDone(false);
    } else {
      finishAbort();
    }

    /** 渲染被中止：收起 toast，不写 DOM */
    function finishAbort(): void {
      if (progress) {
        progress.hide();
        if (activeProgress === progress) activeProgress = null;
      }
    }

    /** 渲染完成：quiet/silent 静默收尾，否则转 success 反馈；成功才记账数据签名（EFF-4） */
    function finishDone(isEmpty: boolean): void {
      if (progress && activeProgress === progress) activeProgress = null;
      if (!quiet && !isEmpty && progress) {
        progress.setType('success');
        progress.setMessage('阅读统计完成');
      } else if (progress) {
        progress.hide();
      }
      if (!isEmpty && opts.dataSignature !== undefined) {
        lastAcceptedSignature = opts.dataSignature;
      }
    }
  };

  void step().catch((error) => {
    // m1b：用户面人话模板，技术详情留 console
    console.error('读取阅读统计报告失败:', error);
    if (progress && activeProgress === progress) activeProgress = null;
    // EFF-6：文案说「请重试」就给出路——error toast 挂「重试」action
    //（notifyActionError 范式的复用句柄版：progress 原地转 error 不另弹帧；
    // 不透传原始异常串，守 m1b 不泄露技术详情口径）
    const retryAction = alive()
      ? { label: '重试', onClick: () => renderReadingReport(container, app, opts) }
      : undefined;
    const message = '统计失败：读取书库时出错，请重试；若反复出现请重新打开面板';
    if (alive()) {
      container.innerHTML = ERROR_HTML;
    }
    if (progress) {
      progress.setType('error');
      progress.setMessage(message);
      if (retryAction) progress.setAction(retryAction);
    } else if (alive()) {
      // quiet/silent 档失败：无 progress 句柄可转 → 新弹 error toast（默认时长档）
      notify(message, { type: 'error', action: retryAction });
    }
  });
}

/**
 * 报告视图内交互（bookshelf 面板事件委托转调；返回是否命中报告交互）：
 * - 热力图段头 ‹ ›：移动翻月游标，只重渲染热力图主体与段头标题；
 * - 年卡：切换该年 12 月柱展开体（.open 类，纯 CSS 显隐；aria-expanded 同步——EFF-2）。
 * 翻月游标单容器归宿（RR-A4）：读写 container.dataset.rrCursor。
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
      const open = body.classList.toggle('open');
      yearCard.classList.toggle('open', open);
      yearCard.setAttribute('aria-expanded', String(open));
    }
    return true;
  }

  return false;
}

/** 热力图翻月（‹ 上一月 / › 下一月；边界月按钮 disabled，越界为空操作） */
function navHeatmap(container: HTMLElement, dir: number): void {
  if (!lastHeatmap || lastHeatmap.keys.length === 0) return;
  const keys = lastHeatmap.keys;
  const cursor = container.dataset.rrCursor && keys.includes(container.dataset.rrCursor)
    ? container.dataset.rrCursor
    : keys[keys.length - 1];
  const idx = keys.indexOf(cursor);
  const nextIdx = Math.min(keys.length - 1, Math.max(0, idx + dir));
  if (nextIdx === idx) return;
  const nextCursor = keys[nextIdx];
  container.dataset.rrCursor = nextCursor;

  const body = container.querySelector('[data-rr-hm-body]') as HTMLElement | null;
  if (body) {
    body.innerHTML = generateHeatmapGrid(lastHeatmap.data, nextCursor);
    mountIcons(body);
  }
  const title = container.querySelector('[data-rr-hm-title]') as HTMLElement | null;
  if (title) title.textContent = heatmapMonthTitle(nextCursor);
  // G10：翻月边界同步——两按钮 disabled 按初始游标一次性渲染，navHeatmap 不同步则
  // 点一次 ‹ 后 › 永久失效回不去（越界点击本身已空操作，这里只刷禁用态）
  const prevBtnEl = container.querySelector('[data-rr-hm-prev]') as HTMLButtonElement | null;
  const nextBtnEl = container.querySelector('[data-rr-hm-next]') as HTMLButtonElement | null;
  if (prevBtnEl) prevBtnEl.disabled = nextIdx <= 0;
  if (nextBtnEl) nextBtnEl.disabled = nextIdx >= keys.length - 1;
}
