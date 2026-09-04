/**
 * 今日回顾（recap 域）UI：独立 overlay 面板（方向一 R2）+ 一键总结写日记（R3）。
 *
 * 形态（对齐各域面板：home/cinema 同构）：
 *  - 桌面：居中面板（头行「今日回顾 + 日期」+「生成今日总结」+ 摘要行 + 痕迹时间轴），
 *          点遮罩/ESC 关闭（桌面无关闭钮）
 *  - 移动：≤768px 真全屏 + 右上关闭钮 + 底部安全区
 * 组件库纪律（铁律 6）：空态/按钮走 src/core/ui 工厂与 --bz-* token；
 * 域图标一律 core/domain-icons.ts 单一事实源（与命令/磁贴一致）。
 * 打开即采集一次（各源独立容错；不做常驻轮询，重开面板即得新数据）。
 * R3：头行按钮点击 → 生成中 spinner（防重复点击）→ AI 总结自动写入当天日记（同日替换不叠条）；
 *     AI 未配置/失败 → 降级数字模板，弹通知给「写入日记/复制」动作；同日已写过按钮变「重新生成」。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { uiIcon, uiBtn, uiBtnRow, uiEmpty } from '../core/ui';
import { notify, notifyActionError, notifySaveError } from '../core/notice';
import { topifyZ } from '../core/dom';
import { DOMAIN_ICONS } from '../core/domain-icons';
import { H } from './state';
import { collectRecap } from './aggregate';
import type { RecapData, RecapDomain, RecapItem, RecapSummary } from './aggregate';
import {
  entryTextWithoutMarker,
  generateRecapContent,
  hasRecapEntry,
  recapDiaryFilePath,
  writeRecapEntry,
} from './summarize';

/* ---------- lucide 占位 + 挂载（home/ui.ts 同款手法） ---------- */

function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}

function mountIcons(container: HTMLElement): void {
  container.querySelectorAll('i[data-lucide]').forEach((el) => {
    const fresh = uiIcon(el.getAttribute('data-lucide') || '', '');
    const cls = el.className;
    if (cls && cls !== 'bz-ic') fresh.className = cls;
    el.replaceWith(fresh);
  });
}

/* ---------- 域展示元数据（图标走 DOMAIN_ICONS 单一事实源） ---------- */

const DOMAIN_LABEL: Record<RecapDomain, string> = {
  diary: '日记',
  cinema: '影视',
  bookshelf: '读书',
  todo: '待办',
  pomodoro: '番茄',
};

function iconOf(domain: RecapDomain): string {
  return DOMAIN_ICONS[domain] ?? 'circle';
}

function dateText(now: number): string {
  const d = new Date(now);
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${wd}`;
}

/* ---------- 面板骨架 ---------- */

export function createOverlay(app: App): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-recap-overlay';
  overlay.innerHTML = `
    <div class="bz-recap-panel bz-panel-mtop">
      <div class="bz-recap-head">
        <div class="bz-recap-head-l">
          <span class="bz-recap-title">今日回顾</span>
          <span class="bz-recap-date" data-recap-date></span>
        </div>
        <div class="bz-recap-head-r">
          <button type="button" class="bz-btn bz-recap-ai" data-recap-ai disabled>生成今日总结</button>
          <button type="button" class="bz-icon-btn bz-icon-btn--lg bz-recap-close" data-recap-close title="关闭" aria-label="关闭">${iconSpan('x')}</button>
        </div>
      </div>
      <div class="bz-recap-body" data-recap-body>
        <div class="bz-recap-loading" data-recap-loading><span class="bz-spinner bz-spinner--lg"></span></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号（后开面板可压过先开面板）
  H.currentOverlay = overlay;
  mountIcons(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });
  overlay.querySelector('[data-recap-close]')?.addEventListener('click', () => closeOverlay());
  overlay.querySelector('[data-recap-ai]')?.addEventListener('click', () => void onGenerateClick(app));

  void refreshAndRender(app);
}

/** 采集当天痕迹并渲染（打开时调用一次；失败域摘要 N/A 不炸面板） */
export async function refreshAndRender(app: App): Promise<void> {
  const overlay = H.currentOverlay;
  if (!overlay) return;
  let data: RecapData;
  try {
    data = await collectRecap(H.appRef ?? app);
  } catch {
    data = { summary: { diary: 0, movies: 0, books: 0, todoDone: 0, pomodoros: 0, pomodoroMinutes: 0 }, items: [], failed: ['diary', 'cinema', 'bookshelf', 'todo', 'pomodoro'] };
  }
  if (!H.currentOverlay) return; // 采集期间已关闭
  renderAll(data, app);
  void syncAiButton(app);
}

/* ---------- R3：生成今日总结（AI → 写入日记；失败降级模板） ---------- */

function aiButton(): HTMLButtonElement | null {
  return (H.currentOverlay?.querySelector('[data-recap-ai]') as HTMLButtonElement | null) ?? null;
}

/** 按钮态同步（只读探测当天是否已有回顾条目）：
 *  生成中（H.generating）保持现状（disabled），等 onGenerateClick 收口再 sync；
 *  生成中面板被关掉重开时，新面板按钮由完成后的 sync 接管启用，不会卡死在 disabled。 */
async function syncAiButton(app: App): Promise<void> {
  const aiBtn = aiButton();
  if (!aiBtn) return;
  const written = await hasRecapEntry(H.appRef ?? app);
  if (!H.currentOverlay || H.generating) return; // 已关闭 / 生成中（按钮态由生成流程收口）
  setAiButton(aiBtn, written ? '重新生成' : '生成今日总结', false);
}

function setAiButton(btn: HTMLButtonElement, label: string, loading: boolean): void {
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = `<span class="bz-spinner bz-spinner--sm"></span>生成中…`;
    btn.title = '';
  } else {
    btn.textContent = label;
    btn.title = label === '重新生成' ? '替换今天已有的「今日回顾」条目' : '把今天的痕迹写成一段总结，写进日记';
  }
}

/** 成功通知：写入成功 + 「查看」打开当天日记（对齐既有通知动作范式） */
function notifyWritten(app: App): void {
  notify('今日总结已写入日记', {
    type: 'success',
    action: {
      label: '查看',
      onClick: () => {
        try {
          void (H.appRef ?? app).workspace.openLinkText(recapDiaryFilePath(Date.now()), '', false, { active: true });
        } catch {
          /* 打开失败静默：日记内容已写好 */
        }
      },
    },
  });
}

/** 降级模板通知：「写入日记/复制」双动作（不自动写盘，用户拍板去向） */
function notifyTemplateFallback(app: App, reason: string, content: string): void {
  notify(reason, {
    type: 'warning',
    duration: 10000,
    actions: [
      {
        label: '写入日记',
        onClick: () => {
          writeRecapEntry(H.appRef ?? app, content)
            .then(() => {
              notifyWritten(H.appRef ?? app);
              void syncAiButton(H.appRef ?? app); // 写入成功 → 按钮变「重新生成」
            })
            .catch((e) => notifySaveError(e, '写入日记'));
        },
      },
      {
        label: '复制',
        onClick: () => {
          navigator.clipboard
            .writeText(entryTextWithoutMarker(content))
            .then(() => notify('已复制今日总结', { type: 'success' }))
            .catch((e) => notifyActionError(e, '复制'));
        },
      },
    ],
  });
}

/** 生成按钮点击：loading 防重复 → AI 总结自动写入；未配置/失败 → 模板 + 通知动作 */
async function onGenerateClick(app: App): Promise<void> {
  if (H.generating) return; // 防重复点击（AI 请求+写盘期间忽略再点）
  const btn = aiButton();
  if (!btn) return;
  const data = H.lastData;
  if (!data) {
    notify('今天的数据还没准备好，稍后再试', { type: 'warning' });
    return;
  }
  H.generating = true;
  setAiButton(btn, '', true);
  try {
    const result = await generateRecapContent(data);
    if (!result.ok) {
      notify(result.degradeReason || '暂时生成不了今日总结，请稍后再试', { type: 'warning' });
      return;
    }
    if (result.mode === 'ai') {
      await writeRecapEntry(H.appRef ?? app, result.content);
      notifyWritten(H.appRef ?? app);
    } else {
      // 降级：模板不自动写盘，弹通知给「写入日记/复制」
      notifyTemplateFallback(H.appRef ?? app, result.degradeReason || '已生成数字模板总结', result.content);
    }
  } catch (e) {
    notifyActionError(e, '生成今日总结');
  } finally {
    H.generating = false;
    void syncAiButton(app); // 统一收口：按最新探测结果恢复/刷新按钮（面板已关则 no-op）
  }
}

/* ---------- 渲染 ---------- */

/** 摘要格（N/A = 该域读取失败；值文案对齐 R2 摘要行口径） */
function statHtml(value: string, label: string): string {
  return `<div class="bz-recap-stat"><span class="bz-recap-stat-v">${value}</span><span class="bz-recap-stat-k">${label}</span></div>`;
}

function summaryHtml(s: RecapSummary, failed: RecapDomain[]): string {
  const val = (domain: RecapDomain, v: string): string => (failed.includes(domain) ? 'N/A' : v);
  const pom = failed.includes('pomodoro')
    ? 'N/A'
    : `${s.pomodoros} 个 · ${s.pomodoroMinutes} 分钟`;
  return (
    statHtml(val('diary', `${s.diary} 条`), '日记')
    + statHtml(val('cinema', `${s.movies}`), '影视')
    + statHtml(val('bookshelf', `${s.books}`), '读书')
    + statHtml(val('todo', `${s.todoDone}`), '待办完成')
    + statHtml(pom, '番茄')
  );
}

function rowHtml(item: RecapItem): string {
  return `<div class="bz-recap-row">
    <span class="bz-recap-time">${item.timeLabel}</span>
    <span class="bz-recap-row-ic">${iconSpan(iconOf(item.domain))}</span>
    <span class="bz-recap-text"><em class="bz-recap-dom">${DOMAIN_LABEL[item.domain]}</em>${item.text}</span>
  </div>`;
}

/** 空态元素（读失败=重试；空天=写日记引导）。appendChild 挂载保按钮回调存活 */
function emptyEl(data: RecapData, app: App): HTMLDivElement {
  if (data.failed.length) {
    const empty = uiEmpty({
      icon: iconOf('diary'),
      title: '暂时读不到今天的记录',
      desc: '部分数据源读取失败，稍后再试一次。',
      actions: uiBtnRow([uiBtn({ label: '重试', onClick: () => void refreshAndRender(app) })], { center: true }),
    });
    empty.classList.add('bz-recap-empty');
    return empty;
  }
  const empty = uiEmpty({
    icon: 'calendar-heart',
    title: '今天还没有记录',
    desc: '写几句日记、看一部片、专注一次，都会落进这条时间线。',
    actions: uiBtnRow(
      [
        uiBtn({
          label: '写日记',
          tone: 'primary',
          onClick: () => {
            closeOverlay();
            try {
              void (app as any).commands.executeCommandById('bz-diary-write');
            } catch {
              /* 命令不可用（日记本未就绪等）：面板已关，静默即可 */
            }
          },
        }),
      ],
      { center: true }
    ),
  });
  empty.classList.add('bz-recap-empty');
  return empty;
}

function renderAll(data: RecapData, app: App): void {
  const overlay = H.currentOverlay;
  if (!overlay) return;
  H.lastData = data; // R3：「生成今日总结」的输入
  const date = overlay.querySelector('[data-recap-date]');
  if (date) date.textContent = dateText(Date.now());
  const body = overlay.querySelector('[data-recap-body]') as HTMLElement | null;
  if (!body) return;
  body.innerHTML = '';
  const summary = document.createElement('div');
  summary.className = 'bz-recap-summary';
  summary.innerHTML = summaryHtml(data.summary, data.failed);
  body.appendChild(summary);
  if (data.items.length) {
    const timeline = document.createElement('div');
    timeline.className = 'bz-recap-timeline';
    timeline.innerHTML = data.items.map(rowHtml).join('');
    body.appendChild(timeline);
  } else {
    body.appendChild(emptyEl(data, app));
  }
  mountIcons(body);
}

/* ---------- 关闭 / ESC（home 同款注册-注销对） ---------- */

export function closeOverlay(): void {
  if (!H.currentOverlay) return;
  H.currentOverlay.remove();
  H.currentOverlay = null;
}

let escRegistered = false;
let escHandle: { unregister: () => void } | null = null;

export function registerEscapeHandler(): void {
  if (escRegistered) return;
  escRegistered = true;
  escHandle = escManager.register('bz-recap', {
    isVisible: () => !!H.currentOverlay,
    close: closeOverlay,
  });
}

/** 注销 ESC 层（卸载时调用；escManager 层不随插件卸载自动清理） */
export function unregisterEscapeHandler(): void {
  if (!escRegistered) return;
  escRegistered = false;
  escHandle?.unregister();
  escHandle = null;
}
