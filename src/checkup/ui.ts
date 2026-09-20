/**
 * 数据体检面板（checkup 域 UI，D4）：overlay 范式（对齐各域面板）。
 *
 * - 交互仿保险库体检：跑一次缓存结果、可点直达、清理后自动重新体检收敛报告；
 * - 「开始体检」逐项跑（runCheckup 分片让出主线程），顶部实时进度（检查项内
 *   子任务插值，eff P2-1——大库体检中段不再静止），体检中可取消；
 * - 结果页绿/黄/红三态分组：红=必须处理（坏 json/结构异常）、黄=建议处理（漂移/孤儿，含可修复项）、
 *   绿=通过项；可修复项给「一键修复」（确认框 → 定点清理 → 聚合撤销通知）；
 *   不可修复项给「查看详情」展开说明与路径；
 * - 重开面板显示上次结果 + 按数据指纹动态提示缓存可信度（eff P3-6）。
 * 视觉走样式库/组件库（铁律 6）：面板壳/头行走样式库共享类
 * （.bz-panel-overlay/.bz-panel-frame + .bz-panel-head 族），布局自有 styles.css，
 * 按钮/图标/空态/进度条消费 core/ui。
 */
import type { App } from 'obsidian';
import { topifyZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { notice, notify, notifyUndo, notifySaveError, notifyActionError } from '../core/notice';
import { uiBtn, uiIcon, uiEmpty, uiProgress } from '../core/ui';
import { openFlowDialog } from '../core/flow-dialog';
import type { CheckIssue, CheckupReport } from './types';
import { getLastCheckupReport, runCheckup, fixOrphanIssues, CHECK_LABELS, cacheFreshness } from './run';

let overlay: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
/** 在途体检序号：取消/重开/卸载使旧 run 全部作废（分片循环逐段检查） */
let runSeq = 0;
/** 当前正在跑（面板重建时恢复运行态视图） */
let running = false;
/** 修复执行期忙碌态（eff P3-2）：写盘窗口内禁用面板全部按钮，防误触双确认 */
let fixing = false;
/** 进度条组件句柄（ui P3-4：保留 setValue，进度条不再绕开单源手写宽度） */
let progressCtl: { el: HTMLElement; setValue: (n: number) => void } | null = null;
/** 宿主 app（命令注入；卸载后置 null） */
let hostApp: App | null = null;

/** DOM 句柄 id（沿用旧壳命名：遮罩根/面板本体，测试与设置面板直达按此寻址） */
const OVERLAY_ID = 'bz-checkup-mask';
const FRAME_ID = 'bz-checkup-popup';

/** 面板当前是否可见（hide 型常驻层：display:none 只藏不拆） */
function isPanelVisible(): boolean {
  return !!overlay && overlay.style.display === 'flex';
}

/** 打开数据体检面板（重复打开 = 抬顶；运行态/缓存态照常恢复显示） */
export function openDataCheckup(app: App): void {
  hostApp = app;
  if (!overlay) build(app);
  topifyZ(overlay!); // ADR-0067：显示即发号（重开抬顶，谁后显示谁在上）
  overlay!.style.display = 'flex';
  // 打开即入焦 + Tab 圈闭（呈报#13 F3+H3 全域范式，core trapPanelFocus 单源；重开幂等）
  trapPanelFocus(overlay!.querySelector<HTMLElement>(`#${FRAME_ID}`) ?? overlay!);
  // ESC 栈序与 z 序重同步（深审 ui P2-1）：hide 型常驻层重开只抬 z 不抬 ESC 栈会失配
  //（z 序正确、ESC 却先关底下被盖住的面板）。显示路径重放注册——register 内 splice
  // 掉不可见同 id 旧层再 push 尾（esc-manager 自愈语义），注册序自此跟随显示序。
  // 注：registerPanelEsc 幂等样板「已注册即跳过」不解决重开抬栈，故此处保留手写注册。
  escHandle?.unregister();
  escHandle = escManager.register('bz-checkup', {
    isVisible: isPanelVisible,
    close: () => hide(),
  });
  renderBody();
}

/** 插件卸载清理：作废在途体检、拆面板、注销 ESC 层 */
export function unloadDataCheckup(): void {
  runSeq += 1;
  running = false;
  fixing = false;
  hostApp = null;
  escHandle?.unregister();
  escHandle = null;
  progressCtl = null;
  overlay?.remove();
  overlay = null;
}

function build(app: App): void {
  // 面板壳走样式库 .bz-panel-overlay/.bz-panel-frame（components.css A 段）；
  // 旧 core/dom createOverlay 双元素壳（mask+popup 分体）退役，dom.ts 本身冻结不动
  const ov = document.createElement('div');
  ov.id = OVERLAY_ID;
  ov.className = 'bz-panel-overlay';
  const frame = document.createElement('div');
  frame.id = FRAME_ID;
  frame.className = 'bz-panel-frame bz-checkup-popup';

  const head = document.createElement('div');
  head.className = 'bz-panel-head';
  const brand = document.createElement('div');
  brand.className = 'bz-panel-brand';
  brand.appendChild(uiIcon('stethoscope'));
  const title = document.createElement('div');
  title.className = 'bz-panel-title';
  title.textContent = '数据体检';
  const sp = document.createElement('div');
  sp.className = 'bz-panel-head-sp';
  head.append(brand, title, sp);

  const body = document.createElement('div');
  body.className = 'bz-checkup-body';

  const foot = document.createElement('div');
  foot.className = 'bz-checkup-foot';

  frame.append(head, body, foot);
  ov.appendChild(frame);
  ov.addEventListener('click', (e) => {
    if (e.target === ov) hide();
  });
  document.body.appendChild(ov);
  overlay = ov;
  void app;
}

function hide(): void {
  if (overlay) overlay.style.display = 'none';
}

function bodyEl(): HTMLElement {
  return overlay!.querySelector('.bz-checkup-body') as HTMLElement;
}

function footEl(): HTMLElement {
  return overlay!.querySelector('.bz-checkup-foot') as HTMLElement;
}

/** 按当前状态渲染主体：运行态 > 上次报告 > 空态 */
function renderBody(): void {
  if (!overlay) return;
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

/** 底部按钮：空闲=重新体检；运行=取消体检；空态（还没体检过）留白——
 *  「开始体检」由空态 CTA 承担，不再同屏双钮（呈报#28/CK5，深审 ui UX-2） */
function renderFoot(): void {
  const foot = footEl();
  foot.innerHTML = '';
  if (running || fixing) {
    foot.appendChild(uiBtn({ label: fixing ? '修复中…' : '取消体检', onClick: () => cancelRun(), disabled: fixing }));
    return;
  }
  if (!getLastCheckupReport()) return; // 空态：入口唯一（uiEmpty 的 CTA）
  foot.appendChild(
    uiBtn({ label: '重新体检', icon: 'stethoscope', tone: 'primary', onClick: () => void startRun() })
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
        updateProgress(p.index, p.total, p.label, p.subDone, p.subTotal);
      },
    });
    if (seq !== runSeq) return; // 已被取消/重开取代：不渲染
    running = false;
    if (report) {
      progressCtl?.setValue(100);
      renderReport(report, false);
      // 后台完成反馈（eff P3-5）：面板已关时体检静默跑完也要出声——带计数 + 「查看」直达
      if (!isPanelVisible()) {
        const counts = severityCounts(report);
        const text = counts.error
          ? `体检完成：${counts.error} 个问题需要处理`
          : counts.warn + counts.info
            ? `体检完成：${counts.warn + counts.info} 处建议处理`
            : '体检完成：未发现问题';
        notify(text, { action: { label: '查看', onClick: () => hostApp && openDataCheckup(hostApp) } });
      }
    } else renderBody();
  } catch (e) {
    running = false;
    if (seq !== runSeq) return;
    // 失败重试出口（eff P3-3）：notifyActionError 挂「重试」action（startRun 有 running/hostApp 守卫，重入安全）
    notifyActionError(e, '体检', { onRetry: () => void startRun() });
    renderBody();
  }
}

/** 取消体检：作废在途 run，回到上次结果/空态 */
function cancelRun(): void {
  if (fixing) return; // 修复写盘窗口不可取消（eff P3-2）
  runSeq += 1;
  running = false;
  renderBody();
}

/** 运行态视图：进度条 + 检查项清单（等待/进行/完成）。步骤名走 run.ts CHECK_LABELS 单源（ui P3-4） */
function renderRunning(): void {
  renderFoot();
  const body = bodyEl();
  body.innerHTML = '';
  const progress = document.createElement('div');
  progress.className = 'bz-checkup-progress';
  // 首帧直接用第一项名（不再写会被立即覆盖的死文案）
  progress.textContent = `体检中（1/${CHECK_LABELS.length}）：${CHECK_LABELS[0]}`;
  progressCtl = uiProgress();
  body.append(progress, progressCtl.el);

  const list = document.createElement('div');
  list.className = 'bz-checkup-steps';
  for (let i = 0; i < CHECK_LABELS.length; i++) {
    const row = document.createElement('div');
    row.className = 'bz-checkup-step';
    row.dataset.step = String(i);
    const mark = document.createElement('span');
    mark.className = 'bz-checkup-step-mark';
    const name = document.createElement('span');
    name.className = 'bz-checkup-step-name';
    name.textContent = CHECK_LABELS[i];
    row.append(mark, name);
    list.appendChild(row);
  }
  body.appendChild(list);
}

/** 运行中进度刷新（step 状态 + 进度条走 uiProgress.setValue 单源）。
 *  宽度 = (已完成检查项 + 段内子任务进度) / 总项数（eff P2-1：大库体检中段插值推进） */
function updateProgress(index: number, total: number, label: string, subDone?: number, subTotal?: number): void {
  if (!overlay) return;
  const progress = overlay.querySelector('.bz-checkup-progress') as HTMLElement | null;
  if (progress) progress.textContent = `体检中（${index + 1}/${total}）：${label}`;
  const sub = subTotal && subTotal > 0 ? Math.min(1, Math.max(0, subDone || 0) / subTotal) : 0;
  progressCtl?.setValue(((index + sub) / total) * 100);
  overlay.querySelectorAll<HTMLElement>('.bz-checkup-step').forEach((row) => {
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
    // 缓存失效动态口径（eff P3-6）：数据指纹（mtime）全未变 → 「此后数据未变化」；
    // 有变化/无法判定 → 维持「数据可能已变化」促重跑口径，并就地挂「重新体检」行动钮
    //（呈报#30/CK8：提示即可行动，不必再到 foot 找入口）
    if (hostApp && cacheFreshness(hostApp) === 'clean') {
      hint.textContent = `上次体检：${report.finishedAt} · 此后数据未变化`;
    } else {
      hint.classList.add('bz-checkup-stale--actionable');
      const txt = document.createElement('span');
      txt.textContent = `上次体检：${report.finishedAt} · 数据可能已变化，`;
      hint.append(txt, uiBtn({ label: '重新体检', size: 'sm', onClick: () => void startRun() }));
    }
    body.appendChild(hint);
  }

  const counts = severityCounts(report);
  // 「全部通过」判定并入 info（func P3-9）：纯 info 报告也是「有待处理提示」，
  // 与下方黄组「建议处理（N）」呈现保持一致，不再自相矛盾
  const warnsCount = counts.warn + counts.info;
  const summary = document.createElement('div');
  summary.className = 'bz-checkup-summary' + (counts.error ? ' bz-checkup-summary--bad' : warnsCount ? ' bz-checkup-summary--warn' : ' bz-checkup-summary--ok');
  summary.textContent = counts.error
    ? `体检完成：${counts.error} 个问题需要处理`
    : warnsCount
      ? `体检完成：${warnsCount} 处建议处理`
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

/**
 * 修复组 → 域归并（呈报#51/CK7 按域分组修复中间档）：fixGroup 数据层五组语义不动，
 * UI 层归并为三个域档——「剪藏本」合并残留/标注/待回写来源三组（同文件，run.ts 批内一次读写）。
 */
const FIX_DOMAINS: Array<{ label: string; groups: string[] }> = [
  { label: '收藏本', groups: ['favorites'] },
  { label: '剪藏本', groups: ['clipbook', 'clipbook-marks', 'clipbook-source'] },
  { label: '知识盒', groups: ['knowledge'] },
];

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
  if (fixAll) {
    // 按域分组修复（呈报#51/CK7）：「全域一键」与「逐条」之间的中间档。只有单一域
    // 有可修项时不重复出档（此时一键修复即该域）；域内多项共享确认框一次过。
    const domainRows = FIX_DOMAINS.map((d) => ({
      label: d.label,
      issues: fixAll.issues.filter((i) => d.groups.includes(i.fixGroup || '')),
    })).filter((d) => d.issues.length > 0);
    if (domainRows.length >= 2) {
      const row = document.createElement('div');
      row.className = 'bz-checkup-fixdomains';
      for (const d of domainRows) {
        row.appendChild(
          uiBtn({
            label: `修${d.label}（${d.issues.length}）`,
            size: 'sm',
            onClick: () => void confirmFix(d.issues, `修复${d.label}`),
          })
        );
      }
      sec.appendChild(row);
    }
  }
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
    // bz-touch-target--lg（core components.css 修饰类，可独立挂）：小字链触屏热区外扩——
    // 用 --lg（-8px）保守档：问题行行距紧凑，--xl（-12px）外扩会盖住相邻行命中（ui P3-3）
    toggle.className = 'bz-checkup-detail-toggle bz-touch-target--lg';
    toggle.textContent = '查看详情';
    toggle.setAttribute('aria-expanded', 'false');
    const detail = document.createElement('pre');
    detail.className = 'bz-checkup-detail';
    detail.style.display = 'none';
    let filled = false; // eff P3-4：隐藏详情不全量进 DOM，首次展开才填充
    toggle.addEventListener('click', () => {
      const open = detail.style.display !== 'none';
      if (!filled) {
        detail.textContent = issue.detail || '';
        filled = true;
      }
      detail.style.display = open ? 'none' : 'block';
      toggle.textContent = open ? '查看详情' : '收起详情';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
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

/** 修复执行期忙碌态（eff P3-2）：禁用面板全部按钮；修复期间 foot 显「修复中…」 */
function setFixing(on: boolean): void {
  fixing = on;
  if (!overlay) return;
  overlay.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.disabled = on;
  });
  renderFoot();
}

/**
 * 修复执行（写明清除数量与可撤销）→ 聚合撤销通知 → 自动重新体检收敛报告。
 *
 * 确认口径（呈报#10/CK2 拍板，效率整改 5「免确认+可撤销」全域定稿）：
 * - 单条修复免确认直达——五组修复面（收藏关联/剪藏残留/剪藏标注/剪藏待回写来源/知识盒引用）
 *   全部带 notifyUndo 撤销链（run.ts undo 闭包）+ 修复后自动重跑体检收敛，双重兜底在位；
 * - 批量（一键修复/按域分组）保留确认框：写明清除数量的知情确认有 clipbook
 *   markAllUnreadRead 跨域批量先例背书（checkup-consistency P3-6 对表裁定批量通过）。
 */
async function confirmFix(issues: CheckIssue[], what: string): Promise<void> {
  if (!hostApp || fixing) return;
  const fixable = issues.filter((i) => i.fixGroup && i.fixKey);
  if (!fixable.length) return;
  if (fixable.length > 1) {
    const v = await openFlowDialog({
      // 动作名入题（cons UX-1：消费 what 形参，批量确认语境有区分）
      title: what === '一键修复' ? '修复确认' : `${what}确认`,
      message: `将清除 ${fixable.length} 项失效引用（数据文件里的关联/残留，不动你的笔记），清除后可在通知里撤销`,
      actions: [
        { label: '取消', value: 'cancel' },
        // danger（issue 291 评审补）：清除会从数据文件里删掉失效引用/残留（可撤销但仍是删除类
        // 主动作，与 belongings/favorites/memo 的可撤销删除同口径）→ 主钮不高亮（手册 §9/§10）
        { label: '清除', value: 'ok', cta: true, danger: true },
      ],
    });
    if (v !== 'ok') return;
  }
  setFixing(true);
  let failures: string[] = [];
  try {
    const result = await fixOrphanIssues(hostApp, fixable);
    failures = result.failures;
    // 聚合撤销通知（eff P3-1）：一组一条改成单条汇总（总数 + 分组计数）——撤销出口
    // 不再被通知挤兑拆散；undo 顺序回滚各组，任一失败提示并继续其余
    const hit = result.outcomes.filter((o) => o.fixed > 0);
    if (hit.length) {
      const total = hit.reduce((a, o) => a + o.fixed, 0);
      const detail = hit.map((o) => `${o.group} ${o.fixed}`).join('、');
      notifyUndo(`已清除 ${total} 项失效引用：${detail}`, () => {
        (async () => {
          for (const o of hit) await o.undo();
        })()
          .then(() => {
            // 撤销后报告收敛（ui P3-1）：数据回到失效态，报告必须跟着回去
            return startRun();
          })
          .catch((e) => notifySaveError(e, '撤销清除'));
      });
    } else if (!failures.length) {
      notice('没有需要清除的项（数据已变化）');
    }
    if (failures.length) {
      // 部分组失败（ui P3-2）：已落盘组的撤销链照常在，失败组单独提示 + 重试出口
      notifyActionError(new Error('未完成：' + failures.join('、')), '清除失效引用', {
        onRetry: () => void confirmFix(issues, what),
      });
    }
  } catch (e) {
    setFixing(false);
    notifyActionError(e, '清除失效引用', { onRetry: () => void confirmFix(issues, what) });
    return;
  }
  setFixing(false);
  // 清理后自动重新体检，报告收敛（仿保险库体检）
  await startRun();
}
