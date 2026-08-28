/**
 * 待转文献面板（视频转文献，bili-downloader 域升级）
 * 主窗口：列表展示任务行（状态徽标 + 行内进度文案），桌面端头部功能区
 * 「➕ 添加 / ▶️ 处理 / ⏹ 中止 / 🧹 清空 → ⚙️ → ✕」；移动端仅暂存录入（无处理按钮）。
 * 点击按状态分流：成功→打开文献笔记 / 失败→查看原因 / 待处理→编辑。
 */
import type { App } from 'obsidian';
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
import { BatchRunner } from './processor';

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

export function biliTasksSettingsSchema() {
  return {
    groups: [mobileFullscreenGroup('biliTasksMobileDefaultFullscreen')],
  };
}

export class UIManager {
  app: App;
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  list: HTMLElement | null = null;
  addPopup: HTMLElement | null = null;
  private editingId: string | null = null;
  private onKeydown: (e: KeyboardEvent) => void = () => {};

  constructor(app: App) {
    this.app = app;
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
      <h3 style="margin:0;font-size:15px;font-weight:600;">待转文献</h3>
      <div style="display:flex;gap:6px;align-items:center;">
        <button id="bili-btn-add" title="添加待转文献" style="width:30px;height:30px;">➕</button>
        <button id="bili-btn-run" title="批量处理（桌面端）" style="width:30px;height:30px;">▶️</button>
        <button id="bili-btn-abort" title="中止整批" style="width:30px;height:30px;display:none;">⏹</button>
        <button id="bili-btn-clear" title="清空已完成" style="width:30px;height:30px;">🧹</button>
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
    // 移动端仅暂存录入：处理/中止/清空按钮隐藏（功能按钮区只留 ➕⚙️✕）
    if (isMobileEnv()) {
      const run = q<HTMLButtonElement>(popup, '#bili-btn-run');
      const abort = q<HTMLButtonElement>(popup, '#bili-btn-abort');
      const clear = q<HTMLButtonElement>(popup, '#bili-btn-clear');
      if (run) run.style.display = 'none';
      if (abort) abort.style.display = 'none';
      if (clear) clear.style.display = 'none';
    }
  }

  private _bindHeaderEvents(): void {
    const p = this.popup;
    if (!p) return;
    q<HTMLButtonElement>(p, '#bili-btn-add')!.onclick = () => this.showAddDialog();
    q<HTMLButtonElement>(p, '#bili-btn-run')!.onclick = () => void this.onRunBatch();
    q<HTMLButtonElement>(p, '#bili-btn-abort')!.onclick = () => void this.onAbortBatch();
    q<HTMLButtonElement>(p, '#bili-btn-clear')!.onclick = () => void this.onClearFinished();
    q<HTMLButtonElement>(p, '#bili-btn-settings')!.onclick = () =>
      openSettingsModal({ title: '待转文献设置', maxWidth: 560, schema: biliTasksSettingsSchema() });
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
      <h4 style="margin:0;font-size:14px;font-weight:600;" id="bili-add-title">添加待转文献</h4>
      <label style="font-size:12px;color:var(--text-muted);">视频链接 / BV 号</label>
      <input id="bili-add-url" type="text" placeholder="https://www.bilibili.com/video/BV… 或 BV1xx411c7mD" style="width:100%;">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">开始时间（留空 = 整片）</label>
          <input id="bili-add-start" type="text" placeholder="mm:ss 或 hh:mm:ss(.S)"></div>
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">结束时间</label>
          <input id="bili-add-end" type="text" placeholder="与开始成对填写"></div>
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
    q<HTMLElement>(this.addPopup, '#bili-add-title')!.textContent = editItem ? '编辑待转文献' : '添加待转文献';
    (q<HTMLInputElement>(this.addPopup, '#bili-add-url')!).value = editItem?.url ?? '';
    (q<HTMLInputElement>(this.addPopup, '#bili-add-start')!).value = editItem?.start ?? '';
    (q<HTMLInputElement>(this.addPopup, '#bili-add-end')!).value = editItem?.end ?? '';
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
    if (!url) { notice('请填写视频链接或 BV 号', 'error'); return; }
    if (!isValidTime(start) || !isValidTime(end)) { notice('时间格式应为 mm:ss 或 hh:mm:ss(.S)', 'error'); return; }
    if ((!start && end) || (start && !end)) { notice('开始与结束时间需成对填写（都留空 = 整片）', 'error'); return; }
    try {
      if (this.editingId) {
        await TasksData.updateTask(this.editingId, { url, start: start || null, end: end || null, remark: remark || null });
        emitDomainEvent('bili-tasks', { kind: 'edited', id: this.editingId });
      } else {
        await TasksData.addTask({ url, start: start || null, end: end || null, remark: remark || null });
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
    if (!this.list) return;
    const tasks = await TasksData.loadTasks();
    this.list.innerHTML = '';
    const running = BatchRunner.running;
    // 运行中的批次横幅：处理到第几部
    if (running) {
      const idx = tasks.findIndex((t) => t.status === 'processing');
      const banner = document.createElement('div');
      banner.className = 'bz-bili-banner';
      banner.textContent = idx >= 0 ? `⏳ 正在处理 第 ${idx + 1}/${tasks.length} 部…` : '⏳ 正在准备处理…';
      this.list.appendChild(banner);
    }
    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-bili-empty';
      empty.textContent = '暂无待转文献。点击 ➕ 添加视频链接与起止时间，回到桌面端即可批量处理。';
      this.list.appendChild(empty);
      this._syncRunButton(tasks);
      return;
    }
    for (const t of tasks) this.list.appendChild(this.renderRow(t));
    this._syncRunButton(tasks);
  }

  private _syncRunButton(tasks: BiliTask[]): void {
    if (!this.popup) return;
    const run = q<HTMLButtonElement>(this.popup, '#bili-btn-run');
    const abort = q<HTMLButtonElement>(this.popup, '#bili-btn-abort');
    if (!run) return;
    const hasPending = tasks.some((t) => t.status === 'pending');
    run.disabled = BatchRunner.running || !hasPending;
    if (abort) abort.style.display = BatchRunner.running && !isMobileEnv() ? '' : 'none';
  }

  private renderRow(task: BiliTask): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bz-bili-task-card';
    card.dataset.id = task.id;
    const meta = STATUS_META[task.status] ?? STATUS_META.pending;
    const timeText = task.start && task.end ? `${task.start} ~ ${task.end}` : '整片';
    card.innerHTML = `
      <div class="bz-bili-row">
        <span class="bz-bili-status ${meta.cls}">${meta.label}</span>
        <span class="bz-bili-url" title="${task.url}">${task.url}</span>
      </div>
      <div class="bz-bili-meta">${timeText}${task.remark ? ' · ' + task.remark : ''}</div>
      ${task.status === 'processing' && task.reason ? `<div class="bz-bili-progress">${task.reason}</div>` : ''}
      ${task.status === 'failed' && task.reason ? `<div class="bz-bili-progress bz-bili-progress-error">${task.reason}</div>` : ''}
      ${task.status === 'success' && task.notePath ? `<div class="bz-bili-note">📄 ${task.notePath}</div>` : ''}`;
    const actions = this.buildCardActions(task);
    if (actions.length) attachItemActions(card, actions);
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
      title: '删除这条待转文献？',
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

  private async onRunBatch(): Promise<void> {
    if (!BatchRunner.available()) {
      notice('仅桌面端可用：批量处理需要 Node.js 外部进程', 'error');
      return;
    }
    if (BatchRunner.running) return;
    const tasks = await TasksData.loadTasks();
    const pending = tasks.filter((t) => t.status === 'pending');
    if (pending.length === 0) { notice('没有待处理的任务', 'info'); return; }
    const ui = this;
    await BatchRunner.runAll(pending, {
      onTaskProgress: () => { void ui.refreshPanel(); },
      onTaskDone: (t) => {
        emitDomainEvent('bili-tasks', { kind: t.status === 'success' ? 'converted' : 'failed', id: t.id, url: t.url });
        void ui.refreshPanel();
      },
      onBatchDone: (summary) => {
        const head = `处理完成：成功 ${summary.success} 部`;
        const tail = summary.failed ? `，失败 ${summary.failed} 部` : '';
        const end = summary.aborted ? '（已中止）' : '';
        notice(head + tail + end, summary.failed || summary.aborted ? 'warning' : 'success');
        void ui.refreshPanel();
      },
    });
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

  private async onClearFinished(): Promise<void> {
    const v = await openFlowDialog({
      title: '清空已完成？',
      message: '将从列表移除全部「成功」记录；文献笔记与视频文件保留在 vault 中。',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '清空', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    await TasksData.clearFinished();
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