/**
 * 每周知识动态 · UI/通知/调度层（issue 360）
 *
 * - 调度：启动后延迟 WEEKLY_SCHEDULE_DELAY_MS 静默聚合一次（等索引装载完成再跑），
 *   周界判定在数据层 runWeeklyDigest（lastRunAt 滚动 7 天）；未到期/空轮全程零打扰；
 * - 通知入口：有实质内容才弹一条（挂「查看详情」动作——带动作的通知不受通知级别静默，
 *   核心通知规范：正文不带 emoji，语义用 info 类型）；点击动作打开详情弹层；
 * - 详情弹层：概要（AI 人话总结或计数总览）+ 新增笔记列表 / 新增关联列表 / 撞车提示卡，
 *   每条可跳转笔记（workspace.openFile；文件已删给人话提示）；ESC/遮罩/✕ 关闭；
 * - 命令入口（bz-secondbrain-weekly 本周知识动态）：打开弹层同时强制重聚一轮（不等周界），
 *   聚合期间弹层先垫聚合中态，完成后原位刷新；
 * - 主面板入口卡：panel.ts 在 loadSummaryAndLinks 里调 renderPanelWeeklyCard 回填，
 *   点击同样打开详情弹层（面板结构最小侵入——右栏 AI 摘要卡下方一枚只读卡）；
 *   另有头行图标钮 bz-sb-weekly-open（issue 360，panel.createUI 绑定，只读不动面板结构）。
 */
import type { App, TFile } from 'obsidian';
import { createOverlay, topifyZ } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { mountIcons } from '../core/ui';
import { notice, notify } from '../core/notice';
import { formatRelativeTime } from '../core/utils';
import { loadStore, type WeeklyDigest } from './store-file';
import { runWeeklyDigest, formatDigestRange, WEEKLY_MAX_COLLISIONS, type WeeklyRunOptions, type WeeklyStoreLike } from './weekly';
import { unsharpenScore } from './vector-math';
import {
  weeklyShellHtml,
  weeklySummaryHtml,
  weeklyStatsHtml,
  weeklySectionHtml,
  weeklyNoteRowHtml,
  weeklyCollisionRowHtml,
  weeklyEmptyHtml,
  weeklyLoadingHtml,
} from './render';
import { AI } from './ai';
import { motionWeeklyShellIn, motionWeeklyContent, motionWeeklyOut, motionSummaryIn, motionTeardown } from './motion';

/** 启动后延迟调度（ms）：错开启动队列消费与存量补链；测试可收紧 */
export let WEEKLY_SCHEDULE_DELAY_MS = 90_000;
export function __setWeeklyScheduleDelayMsForTests(ms: number): void {
  WEEKLY_SCHEDULE_DELAY_MS = ms;
}

/** 通知 dedupeKey：周报一条语义，重复触发合并单框 */
export const WEEKLY_NOTICE_KEY = 'bz-sb-weekly-digest';

/**
 * 撞车行显示的整数百分比（issue 425/ADR-0185）：`scale` 缺失的存量摘要里，**向量通道**分数是
 * 旧锐化尺（`cos^0.35`），显示前换算回原始余弦；**TF-IDF 通道**分数是覆盖率（本就有绝对标尺）
 * 不换算。新摘要带 `scale: 'cos'`，直接按分数渲染。
 */
export function collisionPctOf(c: { score: number; mode: 'vector' | 'tfidf' }, digest: WeeklyDigest): number {
  const legacyVector = c.mode === 'vector' && digest.scale !== 'cos';
  return Math.round((legacyVector ? unsharpenScore(c.score) : c.score) * 100);
}

let scheduleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 卸载代际（P3 审查修复）：unloadWeeklyDigest 即自增——在途 runWeeklyIfDue 的完成回调
 * 比对代际，不同则静默丢弃（卸载后聚合结果不再弹通知打扰）。
 */
let weeklyRunGeneration = 0;

/**
 * 启动后延迟调度（index.ensureSecondBrain 调用）：等索引装载完成再聚合——
 * 新增差分读 store.meta（装载/刷新后的内存态），不等会拿空库当快照。
 * 重复调用幂等（只保留最早的定时器）； unload 经 cancelWeeklySchedule 清理。
 */
export function scheduleWeeklyDigest(
  app: App,
  store: WeeklyStoreLike,
  initialLoad: Promise<void> | null
): void {
  cancelWeeklySchedule();
  scheduleTimer = setTimeout(() => {
    scheduleTimer = null;
    void (async () => {
      try {
        if (initialLoad) await initialLoad.catch(() => undefined);
        await runWeeklyIfDue(app, store);
      } catch (e) {
        console.warn('[secondbrain] 每周动态聚合失败', e);
      }
    })();
  }, WEEKLY_SCHEDULE_DELAY_MS);
}

/** 卸载清理（index.unloadSecondBrain 调用）：摘定时器 + 关闭弹层 */
export function cancelWeeklySchedule(): void {
  if (scheduleTimer) {
    clearTimeout(scheduleTimer);
    scheduleTimer = null;
  }
  closeWeeklyDigest();
}

/** 启动调度路径：到周界才聚，有实质内容才通知（无新内容静默零打扰）。
 *  opts 透传 runWeeklyDigest（测试注入 probe/askAI 免真实网络与 AI 配置）。 */
export async function runWeeklyIfDue(app: App, store: WeeklyStoreLike, opts: WeeklyRunOptions = {}): Promise<void> {
  appRef = app; // 通知「查看详情」动作的无参出口依赖它（用户可能从未手动打开过弹层）
  const gen = weeklyRunGeneration;
  const result = await runWeeklyDigest(store, {
    askAI: (p) => AI.ask(p),
    ...opts,
  });
  if (gen !== weeklyRunGeneration) return; // 聚合在途时发生卸载：本轮结果静默丢弃，不再弹通知
  if (result.status === 'done' && result.digest) notifyWeeklyDigest(result.digest);
}

/** 命令路径（bz-secondbrain-weekly）：打开弹层 + 强制重聚一轮 + 原位刷新（手动触发不弹通知） */
export async function runWeeklyManual(app: App, store: WeeklyStoreLike, opts: WeeklyRunOptions = {}): Promise<void> {
  ensureModal(app);
  showWeeklyModal(null, { loading: true });
  try {
    const result = await runWeeklyDigest(store, {
      force: true,
      askAI: (p) => AI.ask(p),
      ...opts,
    });
    if (overlayEl && overlayEl.style.display !== 'none') showWeeklyModal(result.digest);
  } catch (e) {
    console.warn('[secondbrain] 每周动态手动聚合失败', e);
    if (overlayEl && overlayEl.style.display !== 'none') showWeeklyModal(null, { loadFailed: true });
  }
}

/** 有实质内容的完成态通知：一句自然句（CONTEXT.md 通知文案规范③，不用「·」拼符号串），「查看详情」打开弹层 */
export function notifyWeeklyDigest(digest: WeeklyDigest): void {
  const parts = [`新增笔记 ${digest.newNotes.length} 篇`, `新增关联 ${digest.newLinks.length} 条`];
  if (digest.collisions.length > 0) parts.push(`${digest.collisions.length} 篇与既有内容高度重合`);
  notify(`本周${parts.join('，')}。`, {
    type: 'info',
    title: '本周知识动态',
    duration: 8000,
    dedupeKey: WEEKLY_NOTICE_KEY,
    action: { label: '查看详情', onClick: () => openWeeklyDigestFromApp() },
  });
}

// ---------------- 详情弹层 ----------------

let overlayEl: HTMLElement | null = null;
let maskEl: HTMLElement | null = null;
let escHandle: { unregister(): void } | null = null;
/** 弹层持有 app（跳转笔记用；由 open 入口注入） */
let appRef: App | null = null;
/** 打开时的 lastRunAt 快照：聚合期间防旧渲染覆盖新结果（seq 同法 clipbook 报告页） */
let renderSeq = 0;
/** 动效层：开/关代次——退场期间被重开时，迟到的退场收口不得收回新显示位 */
let motionSeq = 0;

function ensureModal(app: App): void {
  appRef = app;
  if (!overlayEl) {
    const { mask, popup } = createOverlay({
      maskId: 'bz-sb-weekly-mask',
      popupId: 'bz-sb-weekly-panel',
      onMaskClick: () => closeWeeklyDigest(),
      width: '560px',
      maxWidth: 560,
    });
    // bz-panel-mtop（issue 360 真机回归）：移动端真全屏 + 44px 顶部避让（panel.ts:311 同范式，桌面不生效）
    popup.classList.add('bz-sb-weekly-modal', 'bz-panel-mtop');
    popup.innerHTML = weeklyShellHtml('');
    overlayEl = popup;
    maskEl = mask;
    document.body.appendChild(mask);
    document.body.appendChild(popup);

    popup.querySelector('#bz-sb-weekly-close')?.addEventListener('click', () => closeWeeklyDigest());

    // 行跳转委托：新增笔记 / 新增关联行点任意处跳；撞车行仅两段名字段各跳各的
    //（行容器不带 data-path——点行其余处不跳，closest 取最内层 data-path）
    const body = popup.querySelector('#bz-sb-weekly-body') as HTMLElement | null;
    const jump = (path: string): void => {
      const f = appRef?.vault.getAbstractFileByPath(path);
      if (f) void appRef!.workspace.getLeaf(false).openFile(f as TFile);
      else notice('文件不存在或已被移动', 'info');
    };
    body?.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-path]') as HTMLElement | null;
      if (el?.dataset.path) jump(el.dataset.path);
    });
    body?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = (e.target as HTMLElement).closest('[data-path]') as HTMLElement | null;
      if (el?.dataset.path) {
        e.preventDefault();
        jump(el.dataset.path);
      }
    });

    escHandle = escManager.register('bz-sb-weekly-modal', {
      isVisible: () => !!overlayEl && overlayEl.style.display === 'flex' && overlayEl.isConnected,
      close: () => closeWeeklyDigest(),
    });
  }
  // 首开与复用统一「显示 + 发号」（P1 审查修复）：遮罩随弹层显隐（chat-panel.ts show/close 同范式），
  // 「遮罩点击关闭」才真实可达；topifyZ 每次显示重发号（ADR-0067）——主面板每次 open 都重发号，
  // 弹层复用重开必须跟着重发，否则后开的面板盖住弹层「点了没反应」、ESC 先关面板才露出。
  topifyZ(maskEl, overlayEl);
  if (maskEl) maskEl.style.display = 'block';
  overlayEl!.style.display = 'flex';
  motionSeq++; // 新代次：在途退场收口作废
  motionWeeklyShellIn(overlayEl); // 动效层：弹层壳唤醒（撤退场残留，重开快档由内容编排接力）
}

/**
 * 打开详情弹层（幂等重开重渲）：读盘最近一份非空摘要（无 → 空态）。
 * 面板入口卡 / 通知「查看详情」走这里；命令入口走 runWeeklyManual（强制重聚后回填）。
 */
export function openWeeklyDigest(app: App): void {
  void (async () => {
    try {
      const store = await loadStore(app);
      ensureModal(app);
      showWeeklyModal(store.weekly?.digest ?? null);
    } catch (e) {
      console.warn('[secondbrain] 每周动态读取失败', e);
      ensureModal(app);
      showWeeklyModal(null, { loadFailed: true });
    }
  })();
}

/** 通知动作的无参形：弹层是单例，动作用最近一次打开注入的 app */
function openWeeklyDigestFromApp(): void {
  if (!appRef) return;
  openWeeklyDigest(appRef);
}

function closeWeeklyDigest(): void {
  renderSeq++;
  // 动效层：先演退场再收 display（常驻单例，收口 cancel 钉帧；无 WAAPI 宿主同步收口）；
  // 退场期间被重开由 motionSeq 守卫（ensureModal 已自增代次，迟到收口不抢显示位）
  const seq = motionSeq;
  motionWeeklyOut(overlayEl, () => {
    if (seq !== motionSeq) return;
    if (overlayEl) overlayEl.style.display = 'none';
    if (maskEl) maskEl.style.display = 'none';
  });
}

/** 卸载清理（index.unloadSecondBrain 经 cancelWeeklySchedule 间接调用亦可；此处供显式摘除 DOM） */
export function unloadWeeklyDigest(): void {
  weeklyRunGeneration++; // 在途 runWeeklyIfDue 完成回调比对代际后静默丢弃（卸载后不再弹通知）
  cancelWeeklySchedule();
  motionTeardown(); // 动效层：循环/延时总清场
  if (escHandle) {
    try {
      escHandle.unregister();
    } catch {
      /* 幂等 */
    }
    escHandle = null;
  }
  overlayEl?.remove();
  overlayEl = null;
  maskEl?.remove();
  maskEl = null;
  appRef = null;
}

/** 弹层列表展示上限（数据层落盘上限 WEEKLY_MAX_LIST=200，展示取最近 N 条，超出补脚注） */
const WEEKLY_UI_LIST_CAP = 30;

/**
 * 渲染弹层内容：头行区间 + 概要（AI 文案或计数总览）+ 三段列表（撞车节置顶提醒）。
 * digest=null：loading（聚合中）/ loadFailed（读取失败）/ 空态三分支。
 */
function showWeeklyModal(digest: WeeklyDigest | null, opts?: { loading?: boolean; loadFailed?: boolean }): void {
  if (!overlayEl) return;
  const seq = ++renderSeq;
  const rangeHead = overlayEl.querySelector('#bz-sb-weekly-range-head') as HTMLElement | null;
  const body = overlayEl.querySelector('#bz-sb-weekly-body') as HTMLElement | null;
  if (!body) return;

  if (!digest) {
    if (rangeHead) rangeHead.textContent = '';
    body.innerHTML = opts?.loading
      ? weeklyLoadingHtml()
      : opts?.loadFailed
        ? '<div class="bz-sb-weekly-empty bz-sb-weekly-empty--page">读取动态数据失败，请稍后重开。</div>'
        : weeklyEmptyHtml();
    mountIcons(body);
    motionWeeklyContent(body); // 动效层：空态/聚合中轻浮现
    return;
  }
  if (seq !== renderSeq) return; // 聚合已完成而本次是旧渲染：弃写

  if (rangeHead) rangeHead.textContent = formatDigestRange(digest.since, digest.until);

  const nameOf = (path: string): string => path.split('/').pop() || path;
  // 概要：AI 人话总结（有则展示）> 计数总览
  const summary = digest.aiSummary
    ? weeklySummaryHtml(true)
    : weeklySummaryHtml(false);
  const sections: string[] = [];
  sections.push(
    `<div class="bz-sb-weekly-section bz-sb-weekly-summary-wrap">${summary}</div>`
  );
  // 撞车提示卡置顶（最值得看的信号）
  if (digest.collisions.length > 0) {
    const rows = digest.collisions
      .map((c) =>
        weeklyCollisionRowHtml(c.path, nameOf(c.path), c.targetPath, nameOf(c.targetPath), collisionPctOf(c, digest))
      )
      .join('');
    sections.push(weeklySectionHtml('bz-sb-weekly-hits', 'copy', '主题撞车提示', digest.collisions.length, rows));
  }
  if (digest.newNotes.length > 0) {
    const rows = digest.newNotes
      .slice(0, WEEKLY_UI_LIST_CAP)
      .map((n) => weeklyNoteRowHtml(n.path, nameOf(n.path), formatRelativeTime(n.mtime)))
      .join('');
    sections.push(weeklySectionHtml('bz-sb-weekly-notes', 'file-plus', '新增笔记', digest.newNotes.length, rows));
    if (digest.newNotes.length > WEEKLY_UI_LIST_CAP) {
      sections.push(`<div class="bz-sb-weekly-empty">新增笔记较多，仅显示最近 ${WEEKLY_UI_LIST_CAP} 条。</div>`);
    }
  }
  if (digest.newLinks.length > 0) {
    const rows = digest.newLinks
      .slice(0, WEEKLY_UI_LIST_CAP)
      .map((l) => weeklyNoteRowHtml(l.path, nameOf(l.path), formatRelativeTime(l.linkedAt)))
      .join('');
    sections.push(weeklySectionHtml('bz-sb-weekly-links', 'link', '新增关联', digest.newLinks.length, rows));
    if (digest.newLinks.length > WEEKLY_UI_LIST_CAP) {
      sections.push(`<div class="bz-sb-weekly-empty">新增关联较多，仅显示最近 ${WEEKLY_UI_LIST_CAP} 条。</div>`);
    }
  }
  if (digest.newNotes.length + digest.newLinks.length + digest.collisions.length === 0) {
    sections.push(weeklyEmptyHtml());
  }

  body.innerHTML = sections.join('');
  // 计数总览在概要壳内回填（AI 文案则 textContent 填总结文本）
  if (digest.aiSummary) {
    const txt = body.querySelector('#bz-sb-weekly-summary-text') as HTMLElement | null;
    if (txt) txt.textContent = digest.aiSummary;
  } else {
    const stats = body.querySelector('#bz-sb-weekly-stats') as HTMLElement | null;
    if (stats) stats.innerHTML = weeklyStatsHtml(digest.newNotes.length, digest.newLinks.length, digest.collisions.length);
  }
  if (digest.collisions.length >= WEEKLY_MAX_COLLISIONS) {
    // 达到截断上限时给人话脚注（列表按分数取前 N，并非全部）
    body.insertAdjacentHTML(
      'beforeend',
      `<div class="bz-sb-weekly-empty">撞车提示较多，仅显示相似度最高的 ${WEEKLY_MAX_COLLISIONS} 条。</div>`
    );
  }
  mountIcons(body);
  motionWeeklyContent(body); // 动效层：分节星图接力 + 行涟漪 + 撞车联想连线
}

// ---------------- 主面板入口卡 ----------------

/**
 * 主面板「近期动态」入口卡回填（panel.loadSummaryAndLinks 调用，最小侵入）：
 * 有非空摘要才显示（无摘要整卡隐藏）；文案 = 计数一行，点击 = 打开详情弹层。
 */
export function renderPanelWeeklyCard(popup: HTMLElement, app: App, digest: WeeklyDigest | null): void {
  const card = popup.querySelector('#bz-sb-weekly-card') as HTMLElement | null;
  if (!card) return;
  if (!digest) {
    card.style.display = 'none';
    return;
  }
  const range = popup.querySelector('#bz-sb-weekly-range') as HTMLElement | null;
  const txt = popup.querySelector('#bz-sb-weekly-card-txt') as HTMLElement | null;
  // 「最近一份」前缀（审查修复）：空轮后入口卡回放的是上一份非空摘要，不冒充当周动态
  if (range) range.textContent = `最近一份（${formatDigestRange(digest.since, digest.until)}）`;
  if (txt) {
    const parts = [`${digest.newNotes.length} 篇新增`, `${digest.newLinks.length} 条关联`];
    if (digest.collisions.length > 0) parts.push(`${digest.collisions.length} 处撞车`);
    txt.textContent = parts.join(' · ');
  }
  card.style.display = '';
  motionSummaryIn(card); // 动效层：入口卡异步回填浮现
  if (!card.dataset.bound) {
    card.dataset.bound = '1';
    const open = () => openWeeklyDigest(app);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  }
}
