/**
 * 数据体检面板（checkup 域 UI，D4）：overlay 范式（对齐 settings-panel/各域面板）。
 *
 * - 交互仿保险库体检：跑一次缓存结果、可点直达、清理后自动重新体检收敛报告；
 * - 「开始体检」逐项跑（runCheckup 分片让出主线程），顶部实时进度，体检中可取消；
 * - 结果页绿/黄/红三态分组：红=必须处理（坏 json/结构异常）、黄=建议处理（漂移/孤儿，含可修复项）、
 *   绿=通过项；可修复项给「一键修复」（确认框 → 定点清理 → notifyUndo 撤销链）；
 *   不可修复项给「查看详情」展开说明与路径；
 * - 重开面板显示上次结果 + 提示可重跑（内存级缓存）。
 * 视觉走样式库/组件库（铁律 6）：布局自有 styles.css，按钮/图标/空态消费 core/ui。
 */
import type { App } from 'obsidian';
import { createOverlay } from '../core/dom';
import { topifyZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { notice, notifyUndo, notifySaveError, notifyActionError } from '../core/notice';
import { uiBtn, uiIcon, uiIconBtn, uiEmpty } from '../core/ui';
import { openFlowDialog } from '../core/flow-dialog';
import type { CheckIssue, CheckupReport } from './types';
import { getLastCheckupReport, runCheckup, fixOrphanIssues } from './run';

let mask: HTMLElement | null = null;
let popup: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
/** 在途体检序号：取消/重开/卸载使旧 run 全部作废（分片循环逐段检查） */
let runSeq = 0;
/** 当前正在跑（面板重建时恢复运行态视图） */
let running = false;
/** 宿主 app（命令注入；卸载后置 null） */
let hostApp: App | null = null;

const MASK_ID = 'bz-checkup-mask';
const POPUP_ID = 'bz-checkup-popup';

/** 打开数据体检面板（重复打开 = 抬顶；运行态/缓存态照常恢复显示） */
export function openDataCheckup(app: App): void {
  hostApp = app;
  if (mask && popup) {
    topifyZ(mask, popup);
    mask.style.display = 'flex';
    renderBody();
    return;
  }
  build(app);
  mask!.style.display = 'flex';
  renderBody();
}

/** 插件卸载清理：作废在途体检、拆面板、注销 ESC 层 */
export function unloadDataCheckup(): void {
  runSeq += 1;
  running = false;
  hostApp = null;
  escHandle?.unregister();
  escHandle = null;
  mask?.remove();
  popup?.remove();
  mask = null;
  popup = null;
}

function build(app: App): void {
  const overlay = createOverlay({
    maskId: MASK_ID,
    popupId: POPUP_ID,
    maxWidth: 620,
    onMaskClick: () => hide(),
  });
  mask = overlay.mask;
  popup = overlay.popup;
  popup.classList.add('bz-checkup-popup');

  const head = document.createElement('div');
  head.className = 'bz-checkup-head';
  const ic = uiIcon('stethoscope');
  ic.classList.add('bz-checkup-head-ic');
  const title = document.createElement('div');
  title.className = 'bz-checkup-title';
  title.textContent = '数据体检';
  const close = uiIconBtn({ icon: 'x', lg: true, title: '关闭', onClick: () => hide() });
  head.append(ic, title, close);

  const body = document.createElement('div');
  body.className = 'bz-checkup-body';

  const foot = document.createElement('div');
  foot.className = 'bz-checkup-foot';

  popup.append(head, body, foot);
  document.body.appendChild(mask);
  document.body.appendChild(popup);

  escHandle = escManager.register('bz-checkup', {
    isVisible: () => !!mask && mask.style.display === 'flex',
    close: () => hide(),
  });
  void app;
}

function hide(): void {
  if (mask) mask.style.display = 'none';
}

function bodyEl(): HTMLElement {
  return popup!.querySelector('.bz-checkup-body') as HTMLElement;
}

function footEl(): HTMLElement {
  return popup!.querySelector('.bz-checkup-foot') as HTMLElement;
}

/** 按当前状态渲染主体：运行态 > 上次报告 > 空态 */
function renderBody(): void {
  if (!popup) return;
  if (running) {
    renderRunning();
    return;
  }
  const last = getLastCheckupReport();
  if (last) renderReport(last, true);
  else renderIdle();
}

/** 空态：还没体检过 */
function renderIdle(): void {
  const body = bodyEl();
  body.innerHTML = '';
  const actions = document.createElement('div');
  actions.className = 'bz-btn-row bz-btn-row--center';
  actions.appendChild(uiBtn({ label: '开始体检', icon: 'stethoscope', tone: 'primary', onClick: () => void startRun() }));
  body.appendChild(
    uiEmpty({
      icon: 'stethoscope',
      title: '还没体检过',
      desc: '体检会检查各域数据文件能否解析、字段是否漂移、条目指向是否失效，全程只读不改数据',
      actions,
    })
  );
  renderFoot();
}

/** 底部按钮：空闲=开始/重新体检；运行=取消体检 */
function renderFoot(): void {
  const foot = footEl();
  foot.innerHTML = '';
  if (running) {
    foot.appendChild(uiBtn({ label: '取消体检', onClick: () => cancelRun() }));
    return;
  }
  const last = getLastCheckupReport();
  foot.appendChild(
    uiBtn({ label: last ? '重新体检' : '开始体检', icon: 'stethoscope', tone: 'primary', onClick: () => void startRun() })
  );
}

/** 开始体检（再跑覆盖上次；先作废在途序号） */
async function startRun(): Promise<void> {
  if (!hostApp || running) return;
  running = true;
  const seq = ++runSeq;
  renderRunning();
  try {
    const report = await runCheckup(hostApp, {
      isCancelled: () => seq !== runSeq,
      onProgress: (p) => {
        if (seq !== runSeq) return;
        updateProgress(p.index, p.total, p.label);
      },
    });
    if (seq !== runSeq) return; // 已被取消/重开取代：不渲染
    running = false;
    if (report) renderReport(report, false);
    else renderBody();
  } catch (e) {
    running = false;
    if (seq !== runSeq) return;
    notice('体检失败：' + (e instanceof Error ? e.message : String(e)), 'error');
    renderBody();
  }
}

/** 取消体检：作废在途 run，回到上次结果/空态 */
function cancelRun(): void {
  runSeq += 1;
  running = false;
  renderBody();
}

/** 运行态视图：进度条 + 四项检查清单（等待/进行/完成） */
function renderRunning(): void {
  renderFoot();
  const body = bodyEl();
  body.innerHTML = '';
  const progress = document.createElement('div');
  progress.className = 'bz-checkup-progress';
  progress.textContent = '体检中…';
  const bar = document.createElement('div');
  bar.className = 'bz-checkup-bar';
  const fill = document.createElement('i');
  bar.appendChild(fill);
  body.append(progress, bar);

  const list = document.createElement('div');
  list.className = 'bz-checkup-steps';
  for (let i = 0; i < 4; i++) {
    const row = document.createElement('div');
    row.className = 'bz-checkup-step';
    row.dataset.step = String(i);
    const mark = document.createElement('span');
    mark.className = 'bz-checkup-step-mark';
    const name = document.createElement('span');
    name.className = 'bz-checkup-step-name';
    name.textContent = ['数据文件可解析', '字段漂移', '孤儿条目', '同源一致性'][i];
    row.append(mark, name);
    list.appendChild(row);
  }
  body.appendChild(list);
}

/** 运行中进度刷新（step 状态 + 进度条；宽度为功能性动态计算） */
function updateProgress(index: number, total: number, label: string): void {
  if (!popup) return;
  const progress = popup.querySelector('.bz-checkup-progress') as HTMLElement | null;
  const fill = popup.querySelector('.bz-checkup-bar i') as HTMLElement | null;
  if (progress) progress.textContent = `体检中（${index + 1}/${total}）：${label}`;
  if (fill) fill.style.width = Math.round((index / total) * 100) + '%';
  popup.querySelectorAll<HTMLElement>('.bz-checkup-step').forEach((row) => {
    const i = Number(row.dataset.step);
    row.classList.toggle('is-done', i < index);
    row.classList.toggle('is-current', i === index);
  });
}

/** 严重度统计 */
function severityCounts(report: CheckupReport): { error: number; warn: number; info: number } {
  const c = { error: 0, warn: 0, info: 0 };
  for (const s of report.sections) for (const i of s.issues) c[i.severity] += 1;
  return c;
}

/** 结果页：缓存提示 + 三态分组 + 逐项操作 */
function renderReport(report: CheckupReport, stale: boolean): void {
  renderFoot();
  const body = bodyEl();
  body.innerHTML = '';

  if (stale) {
    const hint = document.createElement('div');
    hint.className = 'bz-checkup-stale';
    hint.textContent = `上次体检：${report.finishedAt} · 数据可能已变化，可重新体检`;
    body.appendChild(hint);
  }

  const counts = severityCounts(report);
  const summary = document.createElement('div');
  summary.className = 'bz-checkup-summary' + (counts.error ? ' bz-checkup-summary--bad' : counts.warn ? ' bz-checkup-summary--warn' : ' bz-checkup-summary--ok');
  summary.textContent = counts.error
    ? `体检完成：${counts.error} 个问题需要处理`
    : counts.warn
      ? `体检完成：${counts.warn} 处建议处理`
      : '体检完成：全部通过';
  body.appendChild(summary);

  const allIssues = report.sections.flatMap((s) => s.issues);
  const errors = allIssues.filter((i) => i.severity === 'error');
  const warns = allIssues.filter((i) => i.severity === 'warn' || i.severity === 'info');
  const cleanSections = report.sections.filter((s) => !s.issues.length);

  if (errors.length) appendIssueGroup(body, '需要处理', 'bad', errors);
  if (warns.length) {
    const fixable = warns.filter((i) => i.fixGroup && i.fixKey);
    appendIssueGroup(body, '建议处理', 'warn', warns, fixable.length ? { issues: fixable } : undefined);
  }
  appendCleanGroup(body, report, cleanSections);
}

/** 问题分组（红/黄）：组头 + 逐项（可修复带修复钮，全部带查看详情） */
function appendIssueGroup(
  body: HTMLElement,
  title: string,
  tone: 'bad' | 'warn',
  issues: CheckIssue[],
  fixAll?: { issues: CheckIssue[] }
): void {
  const sec = document.createElement('div');
  sec.className = 'bz-checkup-group bz-checkup-group--' + tone;
  const head = document.createElement('div');
  head.className = 'bz-checkup-group-head';
  const t = document.createElement('span');
  t.className = 'bz-checkup-group-title';
  t.textContent = `${title}（${issues.length}）`;
  head.appendChild(t);
  if (fixAll) {
    head.appendChild(
      uiBtn({
        label: `一键修复（${fixAll.issues.length}）`,
        onClick: () => void confirmFix(fixAll.issues, '一键修复'),
      })
    );
  }
  sec.appendChild(head);
  for (const issue of issues) sec.appendChild(issueRow(issue));
  body.appendChild(sec);
}

/** 绿组：无问题检查项的通过说明 */
function appendCleanGroup(body: HTMLElement, report: CheckupReport, cleanSections: typeof report.sections): void {
  const sec = document.createElement('div');
  sec.className = 'bz-checkup-group bz-checkup-group--ok';
  const head = document.createElement('div');
  head.className = 'bz-checkup-group-head';
  const t = document.createElement('span');
  t.className = 'bz-checkup-group-title';
  t.textContent = `通过（${cleanSections.length}）`;
  head.appendChild(t);
  sec.appendChild(head);
  if (!cleanSections.length) {
    const none = document.createElement('div');
    none.className = 'bz-checkup-clean-line';
    none.textContent = '没有完全通过的检查项';
    sec.appendChild(none);
  }
  for (const s of cleanSections) {
    const line = document.createElement('div');
    line.className = 'bz-checkup-clean-line';
    line.textContent = `${s.name}：${s.summary}`;
    sec.appendChild(line);
  }
  body.appendChild(sec);
}

/** 单个问题行：色点 + 文案 + 修复钮 + 查看详情 */
function issueRow(issue: CheckIssue): HTMLElement {
  const row = document.createElement('div');
  row.className = 'bz-checkup-issue';
  const dot = document.createElement('span');
  dot.className = 'bz-checkup-dot bz-checkup-dot--' + issue.severity;
  const main = document.createElement('div');
  main.className = 'bz-checkup-issue-main';
  const title = document.createElement('div');
  title.className = 'bz-checkup-issue-title';
  title.textContent = issue.title;
  main.appendChild(title);
  if (issue.detail) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'bz-checkup-detail-toggle';
    toggle.textContent = '查看详情';
    const detail = document.createElement('pre');
    detail.className = 'bz-checkup-detail';
    detail.textContent = issue.detail;
    detail.style.display = 'none';
    toggle.addEventListener('click', () => {
      const open = detail.style.display !== 'none';
      detail.style.display = open ? 'none' : 'block';
      toggle.textContent = open ? '查看详情' : '收起详情';
    });
    main.appendChild(toggle);
    main.appendChild(detail);
  }
  row.append(dot, main);
  if (issue.fixGroup && issue.fixKey) {
    row.appendChild(
      uiBtn({
        label: issue.fixLabel || '修复',
        onClick: () => void confirmFix([issue], issue.fixLabel || '修复'),
      })
    );
  }
  return row;
}

/** 修复确认（写明清除数量与可撤销）→ 执行 → notifyUndo → 自动重新体检收敛报告 */
async function confirmFix(issues: CheckIssue[], what: string): Promise<void> {
  if (!hostApp) return;
  void what;
  const fixable = issues.filter((i) => i.fixGroup && i.fixKey);
  if (!fixable.length) return;
  const v = await openFlowDialog({
    title: '修复确认',
    message: `将清除 ${fixable.length} 项失效引用（数据文件里的关联/残留，不动你的笔记），清除后可在通知里撤销`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '清除', value: 'ok', cta: true },
    ],
  });
  if (v !== 'ok') return;
  try {
    const outcomes = await fixOrphanIssues(hostApp, fixable);
    let any = false;
    for (const o of outcomes) {
      if (!o.fixed) continue;
      any = true;
      notifyUndo(o.label, () => {
        o.undo().catch((e) => notifySaveError(e, '撤销清除'));
      });
    }
    if (!any) notice('没有需要清除的项（数据已变化）');
  } catch (e) {
    notifyActionError(e, '清除失效引用');
    return;
  }
  // 清理后自动重新体检，报告收敛（仿保险库体检）
  await startRun();
}
