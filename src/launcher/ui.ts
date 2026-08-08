/**
 * 入口页 UI（ticket 23）：自建 DOM 弹窗（项目模式，不用 Obsidian Modal 类）。
 * 单例：已打开则复用聚焦。长按 0.5s 进编辑模式（iOS 式）；pointer 拖拽 + 推挤落位；
 * 右下角手柄调档位；左上角 × 删除；工具栏 + 添加（命令选择器）/ 完成退出。
 */
import { setIcon, Notice } from 'obsidian';
import { getApp } from '../core/app';
import { getSettings } from '../core/settings-provider';
import { escManager } from '../core/esc-manager';
import { generateId } from '../core/utils';
import { createIconBtn } from '../core/dom';
import {
  LauncherTile, LauncherData, LAUNCHER_PATH,
  loadLauncherData, saveLauncherData, placeAtEnd, pushMove, canPlace,
} from './data';
import { filterIcons } from './icons';

/** 长按进入编辑模式的时长 */
export const EDIT_LONG_PRESS_MS = 500;
/** 网格单元基准尺寸（拖拽目标格换算；实际渲染由 CSS 决定） */
const CELL_W = 110;
const CELL_H = 110;
/** 拖拽移动超过该距离取消长按 */
const MOVE_CANCEL = 10;

const OVERLAY_ID = 'launcher-overlay';
const MODAL_ID = 'launcher-modal';
const GRID_ID = 'launcher-grid';
const EMPTY_ID = 'launcher-empty';
const CMD_MASK_ID = 'launcher-cmd-mask';
const CMD_POPUP_ID = 'launcher-cmd-popup';
const ICON_MASK_ID = 'launcher-icon-mask';
const ICON_POPUP_ID = 'launcher-icon-popup';

interface CommandMeta {
  id: string;
  name: string;
  icon?: string;
}

/** 清空子节点（jsdom 无 Obsidian 扩展 empty） */
function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** 枚举全部可用命令（含其他插件；mock/异常环境返回空） */
function listCommands(): CommandMeta[] {
  try {
    const app = getApp() as any;
    if (!app || typeof app.commands?.listCommands !== 'function') return [];
    return app.commands
      .listCommands()
      .map((c: any) => ({ id: c.id, name: c.name || c.id, icon: c.icon }));
  } catch (e) {
    return [];
  }
}

export class LauncherModal {
  static instance: LauncherModal | null = null;

  private overlay: HTMLDivElement;
  private modal: HTMLDivElement;
  private grid: HTMLDivElement;
  private toolbar: HTMLDivElement;
  private doneBtn: HTMLButtonElement | null = null;
  private addBtn: HTMLButtonElement | null = null;

  private data: LauncherData = { version: 1, tiles: [] };
  private validIds = new Set<string>();
  private commands: CommandMeta[] = [];
  private editing = false;
  private escHandle: { unregister: () => void } | null = null;
  private suppressClick = false;

  constructor(private app: any) {
    this.overlay = document.createElement('div');
    this.overlay.id = OVERLAY_ID;
    this.modal = document.createElement('div');
    this.modal.id = MODAL_ID;
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'launcher-toolbar';
    this.grid = document.createElement('div');
    this.grid.id = GRID_ID;
  }

  /** 单例入口：已打开 → 复用聚焦；否则创建 */
  static open(app: any): void {
    if (LauncherModal.instance) {
      LauncherModal.instance.overlay.style.display = 'flex';
      return;
    }
    const m = new LauncherModal(app);
    LauncherModal.instance = m;
    m.open();
  }

  async open(): Promise<void> {
    this.commands = listCommands();
    this.validIds = new Set(this.commands.map((c) => c.id));
    this.data = await loadLauncherData(this.app);

    // 遮罩 + 弹窗骨架
    this.overlay.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);' +
      'z-index:10100;display:flex;align-items:center;justify-content:center;';
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.body.appendChild(this.overlay);

    this.modal.style.cssText =
      'background:var(--background-primary);color:var(--text-normal);border-radius:14px;' +
      'width:92%;max-width:800px;max-height:88vh;display:flex;flex-direction:column;' +
      'box-shadow:0 12px 44px rgba(0,0,0,0.35);border:1px solid var(--background-modifier-border);' +
      'overflow:hidden;';
    this.overlay.appendChild(this.modal);

    this.buildToolbar();
    this.modal.appendChild(this.toolbar);

    this.grid.style.cssText =
      'overflow-y:auto;padding:16px 18px 20px;display:grid;gap:12px;' +
      'grid-auto-rows:110px;grid-auto-flow:row;align-content:start;position:relative;';
    this.applyColumns();
    this.modal.appendChild(this.grid);

    // ESC 关闭
    this.escHandle = escManager.register('launcher', {
      isVisible: () => this.overlay.isConnected && this.overlay.style.display !== 'none',
      close: () => this.close(),
    });

    this.render();
  }

  private applyColumns(): void {
    const cols = this.columns();
    this.grid.style.gridTemplateColumns = `repeat(${cols}, minmax(96px, 1fr))`;
  }

  /** 列数：设置项 launcherColumns（3-8，默认 6） */
  columns(): number {
    try {
      const v = parseInt((getSettings() as any).launcherColumns ?? '6', 10);
      return v >= 3 && v <= 8 ? v : 6;
    } catch (e) {
      return 6;
    }
  }

  private buildToolbar(): void {
    this.toolbar.className = 'launcher-toolbar';
    this.toolbar.style.cssText =
      'display:flex;align-items:center;gap:8px;padding:10px 14px;' +
      'border-bottom:1px solid var(--background-modifier-border);flex-shrink:0;';
    const title = document.createElement('span');
    title.className = 'launcher-title';
    title.textContent = '🧩 BZ 命令入口';
    title.style.cssText = 'font-weight:600;font-size:15px;flex:1;';
    this.toolbar.appendChild(title);

    this.addBtn = createIconBtn('＋', '添加命令', () => this.openCommandDialog(), 'font-size:15px;width:26px;height:26px;');
    this.toolbar.appendChild(this.addBtn);

    this.doneBtn = createIconBtn('✓ 完成', '退出编辑模式', () => this.exitEdit(), 'font-size:13px;width:52px;height:26px;');
    this.doneBtn.style.display = 'none';
    this.toolbar.appendChild(this.doneBtn);

    const closeBtn = createIconBtn('❌', '关闭', () => this.close());
    this.toolbar.appendChild(closeBtn);
  }

  close(): void {
    if (this.escHandle) {
      this.escHandle.unregister();
      this.escHandle = null;
    }
    // 清理可能残留的子选择器
    for (const id of [CMD_MASK_ID, ICON_MASK_ID]) {
      const m = document.getElementById(id);
      if (m) m.remove();
    }
    this.overlay.remove();
    if (LauncherModal.instance === this) LauncherModal.instance = null;
  }

  // ===== 渲染 =====

  private render(): void {
    clearChildren(this.grid);
    this.applyColumns();
    if (this.data.tiles.length === 0) {
      const empty = document.createElement('div');
      empty.id = EMPTY_ID;
      empty.textContent = '入口页还是空的——点击右上角「＋」添加命令磁贴';
      empty.style.cssText =
        'grid-column:1/-1;text-align:center;color:var(--text-muted);padding:48px 0;font-size:13px;';
      this.grid.appendChild(empty);
    }
    for (const tile of this.data.tiles) {
      this.grid.appendChild(this.buildTile(tile));
    }
    if (this.doneBtn) this.doneBtn.style.display = this.editing ? 'inline-flex' : 'none';
  }

  private commandOf(tile: LauncherTile): CommandMeta | undefined {
    return this.commands.find((c) => c.id === tile.commandId);
  }

  private buildTile(tile: LauncherTile): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'launcher-tile' + (this.editing ? ' editing' : '');
    el.dataset.tileId = tile.id;
    el.dataset.commandId = tile.commandId;

    const isGhost = !this.validIds.has(tile.commandId);
    if (isGhost) el.classList.add('ghost');

    const area = tile.w * tile.h;
    const iconSize = area >= 4 ? 44 : area === 2 ? 34 : 24;
    el.style.gridColumn = `${tile.x + 1} / span ${tile.w}`;
    el.style.gridRow = `${tile.y + 1} / span ${tile.h}`;

    const iconEl = document.createElement('div');
    iconEl.className = 'launcher-icon';
    iconEl.style.cssText = `width:${iconSize}px;height:${iconSize}px;display:flex;align-items:center;justify-content:center;`;
    iconEl.dataset.iconSize = String(iconSize);
    if (this.editing) {
      // 编辑模式：点图标可自定义（图标选择器）
      iconEl.addEventListener('pointerdown', (e) => e.stopPropagation());
      iconEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openIconDialog(tile.id, (icon) => {
          if (icon === null) delete tile.icon;
          else tile.icon = icon;
          this.save();
          this.render();
        });
      });
    }
    const cmd = this.commandOf(tile);
    const iconName = tile.icon || cmd?.icon;
    try {
      setIcon(iconEl, iconName || 'command');
    } catch (e) {
      /* 图标名无效时兜底 */
    }
    el.appendChild(iconEl);

    const nameEl = document.createElement('div');
    nameEl.className = 'launcher-name';
    nameEl.textContent = isGhost ? tile.commandId : cmd ? cmd.name : tile.commandId;
    nameEl.style.cssText =
      'font-size:' + (tile.w >= 2 ? 14 : 12) + 'px;color:var(--text-normal);text-align:center;' +
      'line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;' +
      'word-break:break-all;';
    el.appendChild(nameEl);

    // 编辑模式：删除按钮 + 档位手柄
    if (this.editing) {
      const del = document.createElement('button');
      del.className = 'launcher-del';
      del.title = '删除';
      del.textContent = '×';
      del.style.cssText =
        'position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;border:none;' +
        'background:var(--background-modifier-error);color:#fff;font-size:13px;line-height:1;' +
        'cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;';
      del.addEventListener('pointerdown', (e) => e.stopPropagation());
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTile(tile.id);
      });
      el.appendChild(del);

      const resize = document.createElement('div');
      resize.className = 'launcher-resize';
      resize.title = '调整尺寸';
      resize.textContent = '⤡';
      resize.style.cssText =
        'position:absolute;right:4px;bottom:4px;width:18px;height:18px;border-radius:4px;' +
        'color:var(--text-muted);font-size:12px;line-height:1;cursor:se-resize;' +
        'display:flex;align-items:center;justify-content:center;user-select:none;';
      resize.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.startResize(tile, e);
      });
      el.appendChild(resize);
    }

    // 常态：点击执行命令并关闭
    if (!this.editing) {
      el.addEventListener('click', () => this.onTileClick(tile, isGhost));
    }

    // 长按进入编辑模式（常态）；编辑模式下拖主体移动
    this.bindDrag(el, tile);
    return el;
  }

  private onTileClick(tile: LauncherTile, isGhost: boolean): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (isGhost) {
      new Notice(`命令不存在：${tile.commandId}`, 3000);
      return;
    }
    const cmd = this.commandOf(tile);
    if (!cmd) return;
    // 先关入口页，再执行（入口语义：点完自动关闭）
    this.close();
    try {
      this.app.commands.executeCommandById(tile.commandId);
    } catch (e) {
      new Notice(`命令执行失败：${tile.commandId}`, 3000);
    }
  }

  // ===== 编辑模式 =====

  private enterEdit(): void {
    this.editing = true;
    this.suppressClick = true;
    this.render();
  }

  private exitEdit(): void {
    this.editing = false;
    this.render();
  }

  /** 长按检测：pointerdown 计时，移动超阈值/提前松开取消；触发后抑制随后的 click */
  private bindDrag(el: HTMLElement, tile: LauncherTile): void {
    let timer: number | null = null;
    let sx = 0;
    let sy = 0;

    const cancel = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    el.addEventListener('pointerdown', (e) => {
      if (this.editing) return; // 编辑模式：拖拽由 startDrag 处理
      sx = (e as PointerEvent).clientX;
      sy = (e as PointerEvent).clientY;
      timer = window.setTimeout(() => {
        timer = null;
        this.enterEdit();
      }, EDIT_LONG_PRESS_MS);
    });

    el.addEventListener('pointermove', (e) => {
      if (timer === null) return;
      const dx = (e as PointerEvent).clientX - sx;
      const dy = (e as PointerEvent).clientY - sy;
      if (Math.abs(dx) > MOVE_CANCEL || Math.abs(dy) > MOVE_CANCEL) cancel();
    });

    const end = () => cancel();
    el.addEventListener('pointerup', end);
    el.addEventListener('pointerleave', end);
    el.addEventListener('pointercancel', end);

    // 编辑模式：拖主体移动
    el.addEventListener('pointerdown', (e) => {
      if (!this.editing) return;
      this.startDrag(tile, e as PointerEvent);
    });
  }

  // ===== 拖拽移动（推挤落位）=====

  private startDrag(tile: LauncherTile, e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const gridRect = this.grid.getBoundingClientRect();

    const el = this.grid.querySelector<HTMLElement>(`.launcher-tile[data-tile-id="${tile.id}"]`);
    if (!el) return;
    el.classList.add('dragging');
    el.style.position = 'fixed';
    el.style.zIndex = '9999';
    // 磁贴随 pointer 移动，保持抓取偏移（中心对齐）
    const offX = e.clientX - (gridRect.left + tile.x * CELL_W + (tile.w * CELL_W) / 2);
    const offY = e.clientY - (gridRect.top + tile.y * CELL_H + (tile.h * CELL_H) / 2);
    el.dataset.grabOffX = String(offX);
    el.dataset.grabOffY = String(offY);
    el.style.left = e.clientX - offX + 'px';
    el.style.top = e.clientY - offY + 'px';

    // 占位框
    const ph = document.createElement('div');
    ph.className = 'launcher-placeholder';
    ph.style.cssText = 'border:2px dashed var(--text-muted);border-radius:12px;opacity:0.6;';
    this.placePlaceholder(ph, tile, tile.x, tile.y);
    this.grid.appendChild(ph);

    const move = (ev: PointerEvent) => {
      el.style.left = ev.clientX - parseFloat(el.dataset.grabOffX || '0') + 'px';
      el.style.top = ev.clientY - parseFloat(el.dataset.grabOffY || '0') + 'px';
      const left = ev.clientX - parseFloat(el.dataset.grabOffX || '0') - gridRect.left;
      const top = ev.clientY - parseFloat(el.dataset.grabOffY || '0') - gridRect.top;
      const cx = Math.max(0, Math.min(this.columns() - tile.w, Math.floor(left / CELL_W)));
      const cy = Math.max(0, Math.floor(top / CELL_H));
      this.placePlaceholder(ph, tile, cx, cy);
      ph.dataset.cx = String(cx);
      ph.dataset.cy = String(cy);
    };

    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      el.classList.remove('dragging');
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.zIndex = '';
      ph.remove();
      const left = ev.clientX - parseFloat(el.dataset.grabOffX || '0') - gridRect.left;
      const top = ev.clientY - parseFloat(el.dataset.grabOffY || '0') - gridRect.top;
      const cx = Math.max(0, Math.min(this.columns() - tile.w, Math.floor(left / CELL_W)));
      const cy = Math.max(0, Math.floor(top / CELL_H));
      const result = pushMove(this.data.tiles, tile.id, cx, cy, this.columns());
      if (result) {
        this.data.tiles = result;
        this.save();
      }
      this.render();
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  private placePlaceholder(ph: HTMLElement, tile: LauncherTile, cx: number, cy: number): void {
    ph.style.gridColumn = `${cx + 1} / span ${tile.w}`;
    ph.style.gridRow = `${cy + 1} / span ${tile.h}`;
  }

  // ===== 档位手柄 =====

  private startResize(tile: LauncherTile, e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const gridRect = this.grid.getBoundingClientRect();
    const el = this.grid.querySelector<HTMLElement>(`.launcher-tile[data-tile-id="${tile.id}"]`);
    if (!el) return;
    el.classList.add('resizing');

    const move = (ev: PointerEvent) => {
      const left = ev.clientX - gridRect.left - tile.x * CELL_W;
      const top = ev.clientY - gridRect.top - tile.y * CELL_H;
      const w = Math.max(1, Math.min(2, Math.round(left / CELL_W)));
      const h = Math.max(1, Math.min(2, Math.round(top / CELL_H)));
      el.style.gridColumn = `${tile.x + 1} / span ${w}`;
      el.style.gridRow = `${tile.y + 1} / span ${h}`;
      el.dataset.previewW = String(w);
      el.dataset.previewH = String(h);
    };

    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      el.classList.remove('resizing');
      const w = parseInt(el.dataset.previewW || String(tile.w), 10);
      const h = parseInt(el.dataset.previewH || String(tile.h), 10);
      const others = this.data.tiles.filter((t) => t.id !== tile.id);
      if (canPlace(others, tile.x, tile.y, w, h, undefined, this.columns())) {
        tile.w = w;
        tile.h = h;
        this.save();
      }
      this.render();
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  // ===== 增删 =====

  private removeTile(id: string): void {
    this.data.tiles = this.data.tiles.filter((t) => t.id !== id);
    this.save();
    this.render();
  }

  /** 添加命令：选中后 1×1 落末尾第一个空位，并进入编辑模式便于摆放 */
  private addTile(commandId: string): void {
    const tile: LauncherTile = {
      id: generateId('lt-'),
      commandId,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };
    this.data.tiles = placeAtEnd(this.data.tiles, tile, this.columns());
    this.save();
    this.enterEdit();
  }

  private save(): void {
    void saveLauncherData(this.app, { version: 1, tiles: this.data.tiles }).catch((e) => {
      new Notice(`入口页保存失败：${LAUNCHER_PATH}`, 3000);
    });
  }

  // ===== 命令选择器 =====

  private openCommandDialog(): void {
    const { mask, popup } = this.buildPicker(CMD_MASK_ID, CMD_POPUP_ID, '添加命令');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '搜索命令…';
    input.className = 'launcher-picker-input';
    input.style.cssText =
      'width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--background-modifier-border);' +
      'background:var(--background-secondary);color:var(--text-normal);font-size:13px;box-sizing:border-box;margin-bottom:10px;';
    popup.appendChild(input);

    const list = document.createElement('div');
    list.className = 'launcher-picker-list';
    list.style.cssText = 'overflow-y:auto;max-height:340px;display:flex;flex-direction:column;gap:2px;';
    popup.appendChild(list);

    const renderList = (query: string) => {
      list.empty();
      const q = (query || '').trim().toLowerCase();
      const items = this.commands.filter(
        (c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      );
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = '无匹配命令';
        empty.style.cssText = 'color:var(--text-muted);text-align:center;padding:16px;font-size:12px;';
        list.appendChild(empty);
        return;
      }
      for (const c of items) {
        const row = document.createElement('div');
        row.className = 'launcher-picker-item';
        row.dataset.commandId = c.id;
        row.style.cssText =
          'display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;cursor:pointer;' +
          'font-size:13px;';
        row.addEventListener('mouseenter', () => (row.style.background = 'var(--background-modifier-hover)'));
        row.addEventListener('mouseleave', () => (row.style.background = ''));
        const ic = document.createElement('span');
        ic.style.cssText = 'width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;color:var(--text-muted);flex-shrink:0;';
        try {
          setIcon(ic, c.icon || 'command');
        } catch (e) {
          /* 忽略 */
        }
        row.appendChild(ic);
        const txt = document.createElement('span');
        txt.textContent = c.name;
        txt.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        row.appendChild(txt);
        const sub = document.createElement('span');
        sub.textContent = c.id;
        sub.style.cssText = 'color:var(--text-faint);font-size:11px;';
        row.appendChild(sub);
        row.addEventListener('click', () => {
          this.closePicker(mask);
          this.addTile(c.id);
        });
        list.appendChild(row);
      }
    };

    renderList('');
    input.addEventListener('input', () => renderList(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closePicker(mask);
      if (e.key === 'Enter') {
        const q = (input.value || '').trim().toLowerCase();
        const hit = this.commands.find(
          (c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
        );
        if (hit) {
          this.closePicker(mask);
          this.addTile(hit.id);
        }
      }
    });
    setTimeout(() => input.focus(), 0);
  }

  // ===== 图标选择器 =====

  /** 打开图标选择器；onPick(iconName | null)：null = 恢复默认 */
  openIconDialog(tileId: string, onPick: (icon: string | null) => void): void {
    void tileId;
    const { mask, popup } = this.buildPicker(ICON_MASK_ID, ICON_POPUP_ID, '选择图标');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '搜索图标…';
    input.className = 'launcher-picker-input';
    input.style.cssText =
      'width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--background-modifier-border);' +
      'background:var(--background-secondary);color:var(--text-normal);font-size:13px;box-sizing:border-box;margin-bottom:10px;';
    popup.appendChild(input);

    const list = document.createElement('div');
    list.className = 'launcher-icon-list';
    list.style.cssText =
      'overflow-y:auto;max-height:340px;display:grid;grid-template-columns:repeat(8,1fr);gap:4px;';
    popup.appendChild(list);

    const renderList = (query: string) => {
      list.empty();
      for (const name of filterIcons(query)) {
        const cell = document.createElement('div');
        cell.className = 'launcher-icon-cell';
        cell.dataset.icon = name;
        cell.title = name;
        cell.style.cssText =
          'display:flex;align-items:center;justify-content:center;height:38px;border-radius:8px;cursor:pointer;';
        cell.addEventListener('mouseenter', () => (cell.style.background = 'var(--background-modifier-hover)'));
        cell.addEventListener('mouseleave', () => (cell.style.background = ''));
        try {
          setIcon(cell, name);
        } catch (e) {
          /* 忽略 */
        }
        cell.addEventListener('click', () => {
          this.closePicker(mask);
          onPick(name);
        });
        list.appendChild(cell);
      }
    };

    const resetBtn = createIconBtn('恢复默认', '清除自定义图标', () => {
      this.closePicker(mask);
      onPick(null);
    });
    resetBtn.style.cssText += 'font-size:12px;margin-top:10px;';
    popup.appendChild(resetBtn);

    renderList('');
    input.addEventListener('input', () => renderList(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closePicker(mask);
    });
    setTimeout(() => input.focus(), 0);
  }

  // ===== 选择器弹窗骨架 =====

  private buildPicker(maskId: string, popupId: string, titleText: string): { mask: HTMLDivElement; popup: HTMLDivElement } {
    const mask = document.createElement('div');
    mask.id = maskId;
    mask.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10200;' +
      'display:flex;align-items:center;justify-content:center;';
    mask.addEventListener('mousedown', (e) => {
      if (e.target === mask) this.closePicker(mask);
    });
    const popup = document.createElement('div');
    popup.id = popupId;
    popup.style.cssText =
      'background:var(--background-primary);color:var(--text-normal);border-radius:12px;' +
      'width:400px;max-width:90vw;max-height:70vh;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,0.35);' +
      'border:1px solid var(--background-modifier-border);display:flex;flex-direction:column;';
    const title = document.createElement('div');
    title.textContent = titleText;
    title.style.cssText = 'font-weight:600;font-size:14px;margin-bottom:10px;';
    popup.appendChild(title);
    mask.appendChild(popup);
    document.body.appendChild(mask);
    return { mask, popup };
  }

  private closePicker(mask: HTMLElement): void {
    mask.remove();
  }
}

/** 命令入口（main.ts 裸注册回调）：单例打开 */
export function openLauncher(app: any): void {
  LauncherModal.open(app);
}

/** 卸载清理（main.ts onunload）：关闭残留弹窗 */
export function unloadLauncher(): void {
  if (LauncherModal.instance) LauncherModal.instance.close();
}
