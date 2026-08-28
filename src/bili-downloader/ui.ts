/**
 * 文献盒面板（视频转文献，bili-downloader 域；正名「文献盒」，ADR-0066）
 * 主窗口：列表展示任务行（状态徽标 + 行内进度：详细模式=步骤时间线+百分比+耗时），
 * 桌面端头部功能区「➕ 添加 / ⬇️ 下载 / ▶️ 处理 / ⏹ 中止 / 🧹 清空 → ⚙️ → ✕」；
 * 移动端仅暂存录入（无处理/下载按钮）。
 * 点击按状态分流：成功→打开文献笔记 / 失败→查看原因 / 待处理→编辑。
 * 域事件分发（ADR-0066）：添加任务 → 'bili-tasks' {kind:'added'}；单条终态 → {kind:'converted'|'failed'}。
 */
import type { App } from 'obsidian';
import type { SettingsSchema } from '../core/settings-schema';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { openFlowDialog } from '../core/flow-dialog';
import { notice } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { getApp } from '../core/app';
import { TasksData, isValidTime } from './data';
import type { BiliTask } from './types';
import { BatchRunner, type BatchEvents, type BiliProgress } from './processor';

interface StatusMeta { label: string; cls: string; }
const STATUS_META: Record<BiliTask['status'], StatusMeta> = {
  pending: { label: '待处理', cls: 'bz-bili-pending' },
  processing: { label: '处理中', cls: 'bz-bili-processing' },
  success: { label: '成功', cls: 'bz-bili-success' },
  failed: { label: '失败', cls: 'bz-bili-failed' },
};

function q<T extends HTMLElement>(root: HTMLElement, sel: string): T | null {
  return root.querySelector(sel) as T | null;
}

/** HTML 转义（进度文案来自外部进程 stdout，统一转义防注入） */
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** 运行中行内进度态（内存瞬态，不落库；刷新面板重读 storage 时由步骤文案兜底） */
interface RowRunState {
  steps: string[];
  phase: string | null;
  pct: number | null;
  startAt: number;
}

const fmtElapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};

export function biliTasksSettingsSchema(): SettingsSchema {
  return {
    groups: [
      mobileFullscreenGroup('biliTasksMobileDefaultFullscreen'),
      {
        icon: 'settings-2',
        name: '文献盒处理',
        rows: [
          { type: 'toggle', name: '详细进度提示', desc: '处理中显示当前步骤、耗时、百分比与步骤时间线；关闭则仅显示步骤徽章', binding: { key: 'biliProgressDetail' } },
          { type: 'toggle', name: '保留视频原件', desc: '转文献完成后保留视频文件；关闭则只生成文献笔记', binding: { key: 'biliKeepVideo' } },
          { type: 'select', name: '下载清晰度', desc: '以视频源可用档位为准，低档优先命中缓存', binding: { key: 'biliQuality' }, options: [{ value: 'highest', label: '最高（默认）' }, { value: '1080', label: '1080P' }, { value: '720', label: '720P' }] },
          { type: 'toggle', name: '遇错即停', desc: '单条失败后停止处理剩余任务；关闭则失败后继续', binding: { key: 'biliStopOnFailure' } },
          { type: 'text', name: '输出目录', desc: '视频文件落地目录；留空跟随工具配置', binding: { key: 'biliOutputDir' }, placeholder: '如 D:/videos' },
        ],
      },
    ],
  };
}

export interface UIManagerHooks {
  /** ⬇️ 下载按钮：打开原有 B站下载弹窗（bz-bili-open 单条流程，ADR-0066） */
  onDownload?: () => void;
}

export class UIManager {
  app: App;
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  list: HTMLElement | null = null;
  addPopup: HTMLElement | null = null;
  private editingId: string | null = null;
  private onKeydown: (e: KeyboardEvent) => void = () => {};
  private hooks: UIManagerHooks = {};
  /** 当前视图：任务列表 / 历史（ADR-0067：成功自动归档后主列表只含待处理/失败） */
  private mode: 'tasks' | 'history' = 'tasks';
  /** 运行中行内进度态（task.id → 时间线/百分比/启动时刻） */
  private runState = new Map<string, RowRunState>();
  /** 耗时秒针（整批期间每秒刷新处理中行的耗时） */
  private runTimer: ReturnType<typeof setInterval> | null = null;

  constructor(app: App, hooks?: UIManagerHooks) {
    this.app = app;
    this.hooks = hooks ?? {};
    this.createMainUI();
    this.createAddDialog();
    this.onKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (this.addPopup && this.addPopup.style.display === 'flex') this.hideAddDialog();
      else this.hideMain();
    };
    document.addEventListener('keydown', this.onKeydown);
  }

  createMainUI(): void {
    const mask = document.createElement('div');
    mask.id = 'bili-tasks-mask';
    Object.assign(mask.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.45)', zIndex: '100000', display: 'none' });
    mask.onclick = () => this.hideMain();
    const popup = document.createElement('div');
    popup.id = 'bili-tasks-popup';
    Object.assign(popup.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: 'min(720px, 94vw)', maxHeight: '86vh', display: 'none',
      flexDirection: 'column', background: 'var(--background-primary)', color: 'var(--text-normal)',
      borderRadius: '10px', boxShadow: '0 8px 40px rgba(0,0,0,.35)', zIndex: '100001',
    });
    const header = document.createElement('div');
    header.className = 'bz-win-head';
    header.innerHTML = `
      <h3 style="margin:0;font-size:15px;font-weight:600;">文献盒</h3>
      <div style="display:flex;gap:6px;align-items:center;">
        <button id="bili-btn-add" title="添加转文献任务" style="width:30px;height:30px;">➕</button>
        <button id="bili-btn-download" title="下载并转文献（单条，桌面端）" style="width:30px;height:30px;">⬇️</button>
        <button id="bili-btn-run" title="批量处理（桌面端）" style="width:30px;height:30px;">▶️</button>
        <button id="bili-btn-abort" title="中止整批" style="width:30px;height:30px;display:none;">⏹</button>
        <button id="bili-btn-history" title="历史 / 任务列表" style="width:30px;height:30px;">🕘</button>
        <button id="bili-btn-settings" title="设置" style="width:30px;height:30px;">⚙️</button>
        <button id="bili-btn-close" class="bz-win-close" style="width:30px;height:30px;">✕</button>
      </div>`;
    const list = document.createElement('div');
    list.id = 'bili-tasks-list';
    list.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px;min-height:220px;';
    popup.appendChild(header);
    popup.appendChild(list);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.mask = mask;
    this.popup = popup;
    this.list = list;
    this._bindHeaderEvents();
    // 移动端仅暂存录入：处理/下载/中止按钮隐藏（功能按钮区只留 ➕ 🕘 ⚙️ ✕；历史只读可看）
    if (isMobileEnv()) {
      const run = q<HTMLButtonElement>(popup, '#bili-btn-run');
      const download = q<HTMLButtonElement>(popup, '#bili-btn-download');
      const abort = q<HTMLButtonElement>(popup, '#bili-btn-abort');
      if (run) run.style.display = 'none';
      if (download) download.style.display = 'none';
      if (abort) abort.style.display = 'none';
    }
  }

  private _bindHeaderEvents(): void {
    const p = this.popup;
    if (!p) return;
    q<HTMLButtonElement>(p, '#bili-btn-add')!.onclick = () => this.showAddDialog();
    q<HTMLButtonElement>(p, '#bili-btn-download')!.onclick = () => {
      if (this.hooks.onDownload) this.hooks.onDownload();
      else notice('B站下载入口未就绪', 'error');
    };
    q<HTMLButtonElement>(p, '#bili-btn-run')!.onclick = () => void this.onRunBatch();
    q<HTMLButtonElement>(p, '#bili-btn-abort')!.onclick = () => void this.onAbortBatch();
    q<HTMLButtonElement>(p, '#bili-btn-history')!.onclick = () => void this.toggleMode();
    q<HTMLButtonElement>(p, '#bili-btn-settings')!.onclick = () =>
      openSettingsModal({ title: '文献盒设置', maxWidth: 560, schema: biliTasksSettingsSchema() });
    q<HTMLButtonElement>(p, '#bili-btn-close')!.onclick = () => this.hideMain();
  }

  createAddDialog(): void {
    const popup = document.createElement('div');
    popup.id = 'bili-add-popup';
    Object.assign(popup.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: 'min(520px, 92vw)', background: 'var(--background-primary)', color: 'var(--text-normal)',
      borderRadius: '10px', boxShadow: '0 8px 40px rgba(0,0,0,.35)', zIndex: '100002', display: 'none',
      padding: '16px 18px', flexDirection: 'column', gap: '10px',
    });
    popup.innerHTML = `
      <h4 style="margin:0;font-size:14px;font-weight:600;" id="bili-add-title">添加转文献任务</h4>
      <label style="font-size:12px;color:var(--text-muted);">视频链接 / BV 号</label>
      <input id="bili-add-url" type="text" placeholder="https://www.bilibili.com/video/BV… 或 BV1xx411c7mD" style="width:100%;">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">开始时间（留空 = 整片）</label>
          <input id="bili-add-start" type="text" placeholder="mm:ss 或 hh:mm:ss(.S)"></div>
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">结束时间</label>
          <input id="bili-add-end" type="text" placeholder="与开始成对填写"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">下载清晰度（留空 = 跟随全局设置）</label>
          <select id="bili-add-quality" style="width:100%;">
            <option value="">跟随全局设置</option>
            <option value="highest">最高</option>
            <option value="1080">1080P</option>
            <option value="720">720P</option>
          </select></div>
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">分P（留空 = 第 1 P）</label>
          <input id="bili-add-page" type="number" min="1" step="1" placeholder="如 2"></div>
      </div>
      <label style="font-size:12px;color:var(--text-muted);">备注（可选）</label>
      <input id="bili-add-remark" type="text" placeholder="为什么转这篇">
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
        <button id="bili-add-cancel">取消</button>
        <button id="bili-add-save" style="background:var(--interactive-accent);color:var(--text-on-accent);">保存</button>
      </div>`;
    document.body.appendChild(popup);
    this.addPopup = popup;
    q<HTMLButtonElement>(popup, '#bili-add-cancel')!.onclick = () => this.hideAddDialog();
    q<HTMLButtonElement>(popup, '#bili-add-save')!.onclick = () => void this._handleAddSave();
  }

  showMain(): void {
    if (!this.popup || !this.mask) return;
    applyMobileWindowFullscreen(this.popup, tryGetSettings().biliTasksMobileDefaultFullscreen === true);
    // 重开面板回到任务列表视图（历史视图不记忆）
    if (this.mode !== 'tasks') this.toggleMode();
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    void this.refreshPanel();
  }

  hideMain(): void {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  showAddDialog(editItem?: BiliTask): void {
    if (!this.addPopup) return;
    this.editingId = editItem?.id ?? null;
    q<HTMLElement>(this.addPopup, '#bili-add-title')!.textContent = editItem ? '编辑转文献任务' : '添加转文献任务';
    (q<HTMLInputElement>(this.addPopup, '#bili-add-url')!).value = editItem?.url ?? '';
    (q<HTMLInputElement>(this.addPopup, '#bili-add-start')!).value = editItem?.start ?? '';
    (q<HTMLInputElement>(this.addPopup, '#bili-add-end')!).value = editItem?.end ?? '';
    (q<HTMLSelectElement>(this.addPopup, '#bili-add-quality')!).value = editItem?.quality ?? '';
    (q<HTMLInputElement>(this.addPopup, '#bili-add-page')!).value = editItem?.page ? String(editItem.page) : '';
    (q<HTMLInputElement>(this.addPopup, '#bili-add-remark')!).value = editItem?.remark ?? '';
    this.addPopup.style.display = 'flex';
  }

  hideAddDialog(): void {
    if (this.addPopup) this.addPopup.style.display = 'none';
    this.editingId = null;
  }

  private async _handleAddSave(): Promise<void> {
    if (!this.addPopup) return;
    const url = (q<HTMLInputElement>(this.addPopup, '#bili-add-url')?.value ?? '').trim();
    const start = (q<HTMLInputElement>(this.addPopup, '#bili-add-start')?.value ?? '').trim();
    const end = (q<HTMLInputElement>(this.addPopup, '#bili-add-end')?.value ?? '').trim();
    const remark = (q<HTMLInputElement>(this.addPopup, '#bili-add-remark')?.value ?? '').trim();
    const quality = (q<HTMLSelectElement>(this.addPopup, '#bili-add-quality')?.value ?? '').trim() || null;
    const pageRaw = (q<HTMLInputElement>(this.addPopup, '#bili-add-page')?.value ?? '').trim();
    if (!url) { notice('请填写视频链接或 BV 号', 'error'); return; }
    if (!isValidTime(start) || !isValidTime(end)) { notice('时间格式应为 mm:ss 或 hh:mm:ss(.S)', 'error'); return; }
    if ((!start && end) || (start && !end)) { notice('开始与结束时间需成对填写（都留空 = 整片）', 'error'); return; }
    let page: number | null = null;
    if (pageRaw) {
      const n = Number(pageRaw);
      if (!Number.isInteger(n) || n < 1) { notice('分P 应为正整数（留空 = 第 1 P）', 'error'); return; }
      page = n;
    }
    try {
      const patch = { url, start: start || null, end: end || null, remark: remark || null, quality, page };
      if (this.editingId) {
        await TasksData.updateTask(this.editingId, patch);
        emitDomainEvent('bili-tasks', { kind: 'edited', id: this.editingId });
      } else {
        await TasksData.addTask(patch);
        emitDomainEvent('bili-tasks', { kind: 'added', url });
      }
      notice('已保存');
      this.hideAddDialog();
      await this.refreshPanel();
    } catch (e: any) {
      notice('保存失败：' + (e?.message ?? String(e)), 'error');
    }
  }

  async refreshPanel(): Promise<void> {
    const tasks = await TasksData.loadTasks();
    if (!this.list) return; // await 期间面板被销毁（unload/测试清理）→ 放弃渲染
    this.list.innerHTML = '';
    // 历史视图：只列 archived（成功自动归档，ADR-0067）；任务视图：不含归档项
    if (this.mode === 'history') {
      this._renderHistory(tasks.filter((t) => t.archived));
      return;
    }
    const active = tasks.filter((t) => !t.archived);
    const running = BatchRunner.running;
    // 运行中的批次横幅：处理到第几部
    if (running) {
      const idx = active.findIndex((t) => t.status === 'processing');
      const banner = document.createElement('div');
      banner.className = 'bz-bili-banner';
      banner.textContent = idx >= 0 ? `⏳ 正在处理 第 ${idx + 1}/${active.length} 部…` : '⏳ 正在准备处理…';
      this.list.appendChild(banner);
    }
    if (active.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-bili-empty';
      empty.textContent = '暂无转文献任务。点击 ➕ 添加视频链接与起止时间，回到桌面端即可批量处理。';
      this.list.appendChild(empty);
      this._syncRunButton(active);
      return;
    }
    for (const t of active) this.list.appendChild(this.renderRow(t));
    this._syncRunButton(active);
  }

  /** 任务/历史视图切换（ADR-0067；showMain 重开面板时回到任务视图） */
  private toggleMode(): void {
    this.mode = this.mode === 'tasks' ? 'history' : 'tasks';
    if (this.popup) {
      const h3 = q<HTMLElement>(this.popup, '.bz-win-head h3');
      if (h3) h3.textContent = this.mode === 'history' ? '文献盒 · 历史' : '文献盒';
      const btn = q<HTMLButtonElement>(this.popup, '#bili-btn-history');
      if (btn) btn.classList.toggle('bz-bili-mode-active', this.mode === 'history');
    }
    void this.refreshPanel();
  }

  /** 历史列表：顶部计数 + 清空历史入口；行 = 成功徽标 + 标题链接 + 笔记路径 + 完成时间 */
  private _renderHistory(rows: BiliTask[]): void {
    if (!this.list) return;
    const strip = document.createElement('div');
    strip.className = 'bz-bili-hstrip';
    strip.innerHTML = `<span>历史 · ${rows.length} 条</span><button id="bili-btn-clear-history">清空历史</button>`;
    this.list.appendChild(strip);
    q<HTMLButtonElement>(strip, '#bili-btn-clear-history')!.onclick = () => void this.onClearHistory();
    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-bili-empty';
      empty.textContent = '暂无历史记录。成功的任务完成时会自动归档到这里。';
      this.list.appendChild(empty);
      return;
    }
    const sorted = [...rows].sort((a, b) => String(b.processedAt || b.created).localeCompare(String(a.processedAt || a.created)));
    for (const t of sorted) this.list.appendChild(this.renderHistoryRow(t));
  }

  private renderHistoryRow(task: BiliTask): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bz-bili-task-card';
    card.dataset.id = task.id;
    const href = task.url ? `href="${esc(task.url)}"` : '';
    card.innerHTML = `
      <div class="bz-bili-row">
        <span class="bz-bili-status bz-bili-success">成功</span>
        ${task.title
          ? `<a class="bz-bili-title" ${href} title="${esc(task.url || '')}">${esc(task.title)}</a>`
          : `<span class="bz-bili-url" title="${esc(task.url || '')}">${esc(task.url || '')}</span>`}
      </div>
      <div class="bz-bili-meta">${task.notePath ? `📄 ${esc(task.notePath)} · ` : ''}⏱ ${esc(task.processedAt || task.created || '')}</div>`;
    const actions: ItemAction[] = [];
    if (task.notePath) actions.push({ icon: 'book-open', label: '打开文献笔记', onClick: () => this.openNote(task.notePath!) });
    if (task.url) actions.push({ icon: 'external-link', label: '打开B站链接', onClick: () => this._openExternal(task.url!) });
    if (task.videoPath) actions.push({ icon: 'copy', label: '复制视频路径', onClick: () => void this.copyText(task.videoPath!) });
    actions.push({ icon: 'trash-2', label: '移出历史', kind: 'danger', onClick: () => void this.confirmDelete(task) });
    attachItemActions(card, actions);
    const link = q<HTMLAnchorElement>(card, '.bz-bili-title');
    if (link) link.onclick = (e) => { e.stopPropagation(); this._openExternal(link.href || task.url); };
    card.addEventListener('click', () => { if (task.notePath) this.openNote(task.notePath); });
    return card;
  }

  /** 外部浏览器打开（app.openUrl 优先，Electron shell 兜底，与收藏本同路径） */
  private _openExternal(url: string): void {
    const app = getApp();
    try {
      (app as any).openUrl(url);
    } catch {
      const w = window as any;
      const electron = w.require && w.require('electron');
      if (electron && electron.shell) electron.shell.openExternal(url);
    }
  }

  private _syncRunButton(tasks: BiliTask[]): void {
    if (!this.popup) return;
    const run = q<HTMLButtonElement>(this.popup, '#bili-btn-run');
    const abort = q<HTMLButtonElement>(this.popup, '#bili-btn-abort');
    if (!run) return;
    const hasWork = tasks.some((t) => t.status === 'pending' || t.status === 'failed');
    run.disabled = BatchRunner.running || !hasWork;
    if (abort) abort.style.display = BatchRunner.running && !isMobileEnv() ? '' : 'none';
  }

  private renderRow(task: BiliTask): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bz-bili-task-card';
    card.dataset.id = task.id;
    const meta = STATUS_META[task.status] ?? STATUS_META.pending;
    const timeText = task.start && task.end ? `${task.start} ~ ${task.end}` : '整片';
    // ADR-0067：解析到信息后（title 非空）链接行改「文字 + 链接」——标题即入口，点击浏览器打开；未解析仍显原始链接
    const linkLine = task.title
      ? `<a class="bz-bili-title" href="${esc(task.url)}" title="${esc(task.url)}">${esc(task.title)}</a>`
      : `<span class="bz-bili-url" title="${esc(task.url)}">${esc(task.url)}</span>`;
    const upText = task.uploader ? ` · UP主 ${esc(task.uploader)}` : '';
    card.innerHTML = `
      <div class="bz-bili-row">
        <span class="bz-bili-status ${meta.cls}">${meta.label}</span>
        ${linkLine}
      </div>
      <div class="bz-bili-meta">${timeText}${upText}${task.remark ? ' · ' + esc(task.remark) : ''}</div>
      ${task.status === 'processing' ? (this.runState.has(task.id) ? '<div class="bz-bili-progress-box"></div>' : (task.reason ? `<div class="bz-bili-progress">${esc(task.reason)}</div>` : '')) : ''}
      ${task.status === 'failed' && task.reason ? `<div class="bz-bili-progress bz-bili-progress-error">${esc(task.reason)}</div>` : ''}
      ${task.status === 'failed' ? '<button class="bz-bili-retry-btn">重试</button>' : ''}
      ${task.status === 'success' && task.notePath ? `<div class="bz-bili-note">📄 ${esc(task.notePath)}</div>` : ''}`;
    const actions = this.buildCardActions(task);
    if (actions.length) attachItemActions(card, actions);
    // 标题链接：浏览器打开（不停泡点击分流的冒泡）
    const titleLink = q<HTMLAnchorElement>(card, '.bz-bili-title');
    if (titleLink) titleLink.onclick = (e) => { e.stopPropagation(); this._openExternal(titleLink.href || task.url); };
    // 失败行：行内可见「重试」按钮（除悬浮菜单外的直达入口，ADR-0067）
    const retryBtn = q<HTMLButtonElement>(card, '.bz-bili-retry-btn');
    if (retryBtn) retryBtn.onclick = (e) => { e.stopPropagation(); void this.retryTask(task); };
    // 点击分流：成功→文献笔记；失败→原因；待处理→编辑（处理中不响应）
    card.addEventListener('click', () => {
      if (task.status === 'success' && task.notePath) this.openNote(task.notePath);
      else if (task.status === 'failed') void this.showReason(task);
      else if (task.status === 'pending') this.showAddDialog(task);
    });
    return card;
  }

  private buildCardActions(task: BiliTask): ItemAction[] {
    const actions: ItemAction[] = [];
    if (task.status === 'success') {
      if (task.notePath) actions.push({ icon: 'book-open', label: '打开文献笔记', onClick: () => this.openNote(task.notePath!) });
      if (task.videoPath) actions.push({ icon: 'copy', label: '复制视频路径', onClick: () => void this.copyText(task.videoPath!) });
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    } else if (task.status === 'failed') {
      actions.push({ icon: 'rotate-ccw', label: '重试', onClick: () => void this.retryTask(task) });
      actions.push({ icon: 'info', label: '查看原因', onClick: () => void this.showReason(task) });
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    } else if (task.status === 'pending') {
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    }
    actions.push({ icon: 'trash-2', label: '删除', kind: 'danger', onClick: () => void this.confirmDelete(task) });
    return actions;
  }

  private async retryTask(task: BiliTask): Promise<void> {
    await TasksData.retryTask(task.id);
    await this.refreshPanel();
  }

  private async confirmDelete(task: BiliTask): Promise<void> {
    const v = await openFlowDialog({
      title: '删除这条转文献任务？',
      message: '仅从列表移除记录，已生成的文献笔记与视频不受影响。',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '删除', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    await TasksData.deleteTask(task.id);
    await this.refreshPanel();
  }

  private async showReason(task: BiliTask): Promise<void> {
    await openFlowDialog({
      title: '处理失败',
      message: task.reason || '未知原因',
      actions: [{ label: '知道了', value: 'ok', cta: true }],
    });
  }

  /** 行内进度定点更新（不等 storage 落库——[bz-step]/[bz-p] 一到立即刷 DOM，修「UI 滞后于 JSON」） */
  private updateRowProgress(id: string): void {
    if (!this.list) return;
    const st = this.runState.get(id);
    const card = q<HTMLElement>(this.list, `.bz-bili-task-card[data-id="${id}"]`);
    if (!card || !st) return;
    let box = q<HTMLElement>(card, '.bz-bili-progress-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'bz-bili-progress-box';
      const meta = q<HTMLElement>(card, '.bz-bili-meta');
      if (meta) meta.after(box);
      else card.appendChild(box);
    }
    // 简要模式（设置 biliProgressDetail=false 显式关闭）：仅当前步骤文本（对齐旧行为）；
    // 缺省/未注入（=undefined）走详细模式——默认值即详细
    if (tryGetSettings().biliProgressDetail === false) {
      const cur = st.steps[st.steps.length - 1] || '处理中…';
      box.innerHTML = `<div class="bz-bili-progress">${esc(cur)}</div>`;
      return;
    }
    // 详细模式：✓ 已完成步骤时间线 → 当前步骤 + 耗时；百分比/进度条**仅「下载中」显示**
    // （ADR-0067 拍板：除下载外其余阶段不显示百分比，避免无意义数字跳动）
    const segs = st.steps.map((s, i) =>
      i === st.steps.length - 1
        ? `<span class="bz-bili-step-cur">${esc(s)}</span>`
        : `<span class="bz-bili-step-done">✓ ${esc(s)}</span>`
    );
    const pct = st.phase === 'download' ? st.pct : null;
    const bar = pct != null
      ? `<div class="bz-bili-progress-track"><div class="bz-bili-progress-fill" style="width:${Math.min(100, Math.max(0, pct))}%"></div></div>`
      : '';
    box.innerHTML = `
      <div class="bz-bili-steps">${segs.join('<span class="bz-bili-step-arrow">→</span>')}${pct != null ? ` <span class="bz-bili-step-pct">${Math.round(pct)}%</span>` : ''}</div>
      ${bar}
      <div class="bz-bili-elapsed">⌛ ${fmtElapsed(Date.now() - st.startAt)}</div>`;
  }

  /** 整批耗时秒针：每秒刷新处理中行的耗时显示（步骤事件间隙也能看到时间在走） */
  private startRunTimer(): void {
    this.clearRunTimer();
    this.runTimer = setInterval(() => {
      for (const id of Array.from(this.runState.keys())) this.updateRowProgress(id);
    }, 1000);
  }

  private clearRunTimer(): void {
    if (this.runTimer !== null) { clearInterval(this.runTimer); this.runTimer = null; }
  }

  private async onRunBatch(): Promise<void> {
    if (!BatchRunner.available()) {
      notice('仅桌面端可用：批量处理需要 Node.js 外部进程', 'error');
      return;
    }
    if (BatchRunner.running) return;
    const tasks = await TasksData.loadTasks();
    // ADR-0067 断点续跑：待处理 + 失败 项一起处理（失败项从出错步骤继续，成功项已归档不重跑）
    const work = tasks.filter((t) => !t.archived && (t.status === 'pending' || t.status === 'failed'));
    if (work.length === 0) { notice('没有待处理或失败的任务', 'info'); return; }
    const ui = this;
    ui.startRunTimer();
    const events: BatchEvents = {
      // 步骤/进度事件：更新内存态 + 行内定点刷新（不整表重读，UI 与工具输出同步）
      onTaskProgress: (t, stepText, progress) => {
        let st = ui.runState.get(t.id);
        if (!st) { st = { steps: [], phase: null, pct: null, startAt: Date.now() }; ui.runState.set(t.id, st); }
        // 「启动中…」是占位文案不是工具步骤，不进时间线（真实第一步是「解析中」）
        if (stepText && stepText !== '启动中…' && !st.steps.includes(stepText)) st.steps.push(stepText);
        if (progress) {
          if (progress.phase) st.phase = progress.phase;
          if (progress.pct != null) st.pct = progress.pct;
        }
        ui.updateRowProgress(t.id);
      },
      // 解析信息落库（ADR-0067）：标题/UP主 就位 → 整表刷新，行内切换为「文字+链接」形态
      onTaskInfo: (t) => { void ui.refreshPanel(); },
      onTaskDone: (t) => {
        ui.runState.delete(t.id);
        // 域事件分发（ADR-0066）：成功 = 单条转文献完成（小橘行为流订阅），载荷带 notePath 供标题提取
        emitDomainEvent('bili-tasks', { kind: t.status === 'success' ? 'converted' : 'failed', id: t.id, url: t.url, notePath: t.notePath ?? null });
        void ui.refreshPanel();
      },
      onBatchDone: (summary) => {
        ui.clearRunTimer();
        ui.runState.clear();
        const head = `处理完成：成功 ${summary.success} 部`;
        const tail = summary.failed ? `，失败 ${summary.failed} 部` : '';
        const end = summary.aborted ? '（已中止）' : summary.stopped ? '（遇错即停）' : '';
        notice(head + tail + end, summary.failed || summary.aborted || summary.stopped ? 'warning' : 'success');
        void ui.refreshPanel();
      },
    };
    await BatchRunner.runAll(work, events);
  }

  private async onAbortBatch(): Promise<void> {
    if (!BatchRunner.running) return;
    const v = await openFlowDialog({
      title: '中止批量处理？',
      message: '当前正在处理的视频将停止，已成功的保留在列表；未开始的项保持待处理，可稍后继续。',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '中止', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    BatchRunner.abort();
    await this.refreshPanel();
  }

  private async onClearHistory(): Promise<void> {
    const v = await openFlowDialog({
      title: '清空历史？',
      message: '将移除全部「成功」归档记录；文献笔记与视频文件保留在 vault 中。',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '清空', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    await TasksData.clearHistory();
    await this.refreshPanel();
  }

  private openNote(path: string): void {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(path);
    if (file) void app.workspace.getLeaf(false).openFile(file as any);
    else notice('文献笔记不存在：' + path, 'error');
  }

  private async copyText(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); notice('已复制：' + text); }
    catch { notice('复制失败', 'error'); }
  }

  destroy(): void {
    this.clearRunTimer();
    this.runState.clear();
    document.removeEventListener('keydown', this.onKeydown);
    this.mask?.remove();
    this.popup?.remove();
    this.addPopup?.remove();
    this.mask = null;
    this.popup = null;
    this.list = null;
    this.addPopup = null;
  }
}