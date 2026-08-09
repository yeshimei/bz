/**
 * 入口页 UI（ticket 23）：自建 DOM 弹窗（项目模式，不用 Obsidian Modal 类）。
 * 单例：已打开则复用聚焦。长按 0.5s 进编辑模式（iOS 式）；pointer 拖拽 + 推挤落位；
 * 右下角手柄调档位；左上角 × 删除；工具栏 + 添加（命令选择器）/ 完成退出。
 */
import { getIcon, setIcon, Platform } from 'obsidian';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { getSettings } from '../core/settings-provider';
import { escManager } from '../core/esc-manager';
import { generateId } from '../core/utils';
import { createIconBtn } from '../core/dom';
import {
  LauncherTile, LauncherData, LauncherPlatformConfig, LAUNCHER_PATH,
  loadLauncherData, saveLauncherData, placeAtEnd, pushMove, canPlace,
} from './data';
import { filterIcons, LUCIDE_ICONS } from './icons';

/** 长按进入编辑模式的时长 */
export const EDIT_LONG_PRESS_MS = 500;
/** 网格单元最小尺寸（移动端比例缩小下限） */
const MIN_CELL = 44;
/** 网格单元最大尺寸 */
const MAX_CELL = 200;
/** 网格间距 */
const GAP = 14;
/** 网格左右内边距合计（18×2） */
const GRID_PAD = 36;
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
const RENAME_MASK_ID = 'launcher-rename-mask';
const RENAME_POPUP_ID = 'launcher-rename-popup';
const MENU_MASK_ID = 'launcher-menu-mask';
const MENU_POPUP_ID = 'launcher-menu-popup';

/**
 * 网格单元尺寸按容器宽度比例计算（移动端自适应）:
 * (容器宽 - 左右内边距 - 列间距) / 列数，并 clamp 到 [MIN_CELL, MAX_CELL]。
 */
export function calcCellSize(width: number, cols: number, gap = GAP, pad = GRID_PAD): number {
  const cell = (width - pad - gap * (cols - 1)) / cols;
  return Math.max(MIN_CELL, Math.min(MAX_CELL, cell));
}

interface CommandMeta {
  id: string;
  name: string;
  icon?: string;
}

/** 文字显隐写回通道：main.ts 注入（写插件设置 data.json 并保存）；未注入时静默，读仍走 getSettings */
let showTextSetter: ((v: boolean) => void) | null = null;
/** 手势选择写回通道：main.ts 注入（写设置 + syncGestures 重注册） */
let gestureSetter: ((v: string) => void) | null = null;

export function setLauncherShowTextSetter(fn: (v: boolean) => void): void {
  showTextSetter = fn;
}

export function applyLauncherShowText(v: boolean): void {
  if (showTextSetter) showTextSetter(v);
}

export function setLauncherGestureSetter(fn: (v: string) => void): void {
  gestureSetter = fn;
}

export function applyLauncherGesture(v: string): void {
  if (gestureSetter) gestureSetter(v);
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
  private doneBtn: HTMLButtonElement | null = null;
  private editControls: HTMLDivElement | null = null;
  private columnSel: HTMLSelectElement | null = null;
  private textToggleBtn: HTMLButtonElement | null = null;
  private syncTextToggle: (() => void) | null = null;
  private gestureSel: HTMLSelectElement | null = null;

  private data: LauncherData = {
    version: 3,
    desktop: { tiles: [], columns: 6 },
    mobile: { tiles: [], columns: 6 },
  };
  private validIds = new Set<string>();
  private commands: CommandMeta[] = [];
  private editing = false;
  private escHandle: { unregister: () => void } | null = null;
  private suppressClick = false;
  /** 窗口缩放 → 网格单元重算 + 磁贴内容缩放（箭头函数保证 removeEventListener 同引用） */
  private onResize = () => {
    this.applyColumns();
    this.render();
  };

  constructor(private app: any) {
    this.overlay = document.createElement('div');
    this.overlay.id = OVERLAY_ID;
    this.modal = document.createElement('div');
    this.modal.id = MODAL_ID;
    this.grid = document.createElement('div');
    this.grid.id = GRID_ID;
  }

  /** 当前运行环境是否为移动端（Obsidian 官方 Platform.isMobile，比 window.Capacitor 可靠）——移动端/桌面端配置互不影响 */
  static isMobileEnv(): boolean {
    return typeof Platform !== 'undefined' && !!Platform.isMobile;
  }

  /** 当前平台磁贴（引用） */
  private tiles(): LauncherTile[] {
    return LauncherModal.isMobileEnv() ? this.data.mobile.tiles : this.data.desktop.tiles;
  }

  /** 写回当前平台磁贴 */
  private setTiles(list: LauncherTile[]): void {
    if (LauncherModal.isMobileEnv()) this.data.mobile.tiles = list;
    else this.data.desktop.tiles = list;
  }

  /** 当前平台配置 */
  private platform(): LauncherPlatformConfig {
    return LauncherModal.isMobileEnv() ? this.data.mobile : this.data.desktop;
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

    // 遮罩 + 弹窗骨架（移动端：底部滑入贴底；桌面端：正常居中）
    const isMobile = LauncherModal.isMobileEnv();
    this.overlay.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);' +
      'z-index:10100;display:flex;align-items:' + (isMobile ? 'flex-end' : 'center') +
      ';justify-content:center;' + (isMobile ? 'animation:launcher-mask-in 0.2s ease-out;' : '');
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.body.appendChild(this.overlay);

    this.modal.style.cssText =
      'background:var(--background-primary);color:var(--text-normal);' +
      'border-radius:' + (isMobile ? '16px 16px 0 0' : '14px') + ';width:100%;max-width:800px;max-height:' +
      (isMobile ? '85vh' : '88vh') + ';' +
      'box-shadow:0 12px 44px rgba(0,0,0,0.3);' +
      'border:1px solid var(--background-modifier-border);' +
      (isMobile ? 'border-bottom:none;overflow:hidden;animation:launcher-slide-up 0.28s ease-out;' : 'overflow:hidden;animation:launcher-fade-in 0.15s ease;');
    this.overlay.appendChild(this.modal);

    this.grid.style.cssText =
      'overflow-y:auto;padding:16px 18px ' + (isMobile ? '48px' : '20px') + ';display:grid;gap:14px;' +
      'grid-auto-flow:row;align-content:start;position:relative;';
    this.applyColumns();
    this.modal.appendChild(this.grid);

    this.bindGridLongPress();

    // ESC 关闭
    this.escHandle = escManager.register('launcher', {
      isVisible: () => this.overlay.isConnected && this.overlay.style.display !== 'none',
      close: () => this.close(),
    });

    this.buildDoneButton();
    window.addEventListener('resize', this.onResize);
    this.render();
  }

  /** 当前网格单元尺寸（含容器宽度比例计算） */
  cellSize(): number {
    return calcCellSize(this.grid.clientWidth, this.columns());
  }

  /** 单格步长（单元 + 间距）：拖拽目标格换算用 */
  cellStep(): number {
    return this.cellSize() + GAP;
  }

  private applyColumns(): void {
    const cols = this.columns();
    this.grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    this.grid.style.gridAutoRows = this.cellSize() + 'px';
  }

  /** 列数：桌面/移动端各自配置（launcher.json 内，3-8；缺省桌面 6 / 移动 4） */
  columns(): number {
    return this.platform().columns;
  }

  /** 调整当前平台列数；越界磁贴按行优先顺序重排（reflow） */
  setColumns(cols: number): void {
    const cfg = this.platform();
    const c = Math.max(3, Math.min(8, cols));
    if (c === cfg.columns) return;
    let tiles = this.tiles();
    const anyOverflow = tiles.some((t) => t.x + t.w > c);
    if (anyOverflow) {
      // 越界 → 按 (y, x) 顺序重新流式排布
      const sorted = tiles.slice().sort((a, b) => a.y - b.y || a.x - b.x);
      let work: LauncherTile[] = [];
      for (const t of sorted) work = placeAtEnd(work, t, c);
      tiles = work;
    }
    cfg.columns = c;
    this.setTiles(tiles);
    this.save();
    this.render();
  }

  /** 编辑模式悬浮控件：文字显隐 + 手势选择 + 列数 + ✓ 完成（距顶部 34px） */
  private buildDoneButton(): void {
    const wrap = document.createElement('div');
    wrap.id = 'launcher-edit-controls';
    wrap.style.cssText =
      'position:fixed;top:34px;right:18px;z-index:10101;display:none;align-items:center;gap:8px;';

    // 文字显隐开关（写回插件设置，与设置页同字段）
    const textBtn = document.createElement('button');
    textBtn.id = 'launcher-text-toggle';
    textBtn.textContent = '文';
    textBtn.title = '显示/隐藏磁贴文字';
    textBtn.style.cssText =
      'width:30px;height:30px;border-radius:50%;border:1px solid var(--background-modifier-border);' +
      'background:var(--background-primary);color:var(--text-normal);font-size:13px;cursor:pointer;';
    const syncTextBtn = () => {
      const on = this.showText();
      textBtn.style.background = on ? 'var(--interactive-accent)' : 'var(--background-primary)';
      textBtn.style.color = on ? '#fff' : 'var(--text-muted)';
    };
    textBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    textBtn.addEventListener('click', () => {
      applyLauncherShowText(!this.showText());
      syncTextBtn();
      this.render();
    });
    wrap.appendChild(textBtn);
    this.textToggleBtn = textBtn;
    this.syncTextToggle = syncTextBtn;

    // 手势选择（写回插件设置 + 重注册监听）
    const gestureSel = document.createElement('select');
    gestureSel.id = 'launcher-gesture-sel';
    gestureSel.title = '打开入口页的手势';
    gestureSel.style.cssText =
      'background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);' +
      'border-radius:14px;padding:5px 8px;font-size:12px;cursor:pointer;';
    const gestureOptions: Array<[string, string]> = [
      ['off', '手势关闭'],
      ['double', '双击'],
      ['triple', '三击'],
      ['swipe', '双指下滑'],
    ];
    for (const [k, label] of gestureOptions) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = label;
      gestureSel.appendChild(opt);
    }
    gestureSel.value = this.gesture();
    gestureSel.addEventListener('change', () => {
      applyLauncherGesture(gestureSel.value);
    });
    wrap.appendChild(gestureSel);
    this.gestureSel = gestureSel;

    const sel = document.createElement('select');
    sel.id = 'launcher-columns-sel';
    sel.title = '网格列数（当前平台配置）';
    sel.style.cssText =
      'background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);' +
      'border-radius:14px;padding:5px 8px;font-size:12px;cursor:pointer;';
    for (let i = 3; i <= 8; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = i + ' 列';
      sel.appendChild(opt);
    }
    sel.value = String(this.columns());
    sel.addEventListener('change', () => this.setColumns(parseInt(sel.value, 10)));
    wrap.appendChild(sel);

    const btn = document.createElement('button');
    btn.id = 'launcher-done-btn';
    btn.textContent = '✓ 完成';
    btn.title = '退出编辑模式';
    btn.style.cssText =
      'padding:6px 14px;border-radius:16px;border:none;' +
      'background:var(--interactive-accent);color:#fff;font-size:13px;cursor:pointer;' +
      'box-shadow:0 4px 14px rgba(0,0,0,0.25);';
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.addEventListener('click', () => this.exitEdit());
    wrap.appendChild(btn);

    document.body.appendChild(wrap);
    this.editControls = wrap;
    this.doneBtn = btn;
    this.columnSel = sel;
  }

  /** 长按网格空白区域（非磁贴）进入编辑模式——空态无磁贴时的入口 */
  private bindGridLongPress(): void {
    let timer: number | null = null;
    let sx = 0;
    let sy = 0;
    const cancel = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
    this.grid.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      if ((e.target as HTMLElement).closest('.launcher-tile')) return; // 磁贴上由 bindDrag 处理
      sx = (e as PointerEvent).clientX;
      sy = (e as PointerEvent).clientY;
      timer = window.setTimeout(() => {
        timer = null;
        this.enterEdit();
      }, EDIT_LONG_PRESS_MS);
    });
    this.grid.addEventListener('pointermove', (e) => {
      if (timer === null) return;
      const dx = (e as PointerEvent).clientX - sx;
      const dy = (e as PointerEvent).clientY - sy;
      if (Math.abs(dx) > MOVE_CANCEL || Math.abs(dy) > MOVE_CANCEL) cancel();
    });
    this.grid.addEventListener('pointerup', cancel);
    this.grid.addEventListener('pointerleave', cancel);
  }

  close(): void {
    if (this.escHandle) {
      this.escHandle.unregister();
      this.escHandle = null;
    }
    // 清理可能残留的子选择器
    for (const id of [CMD_MASK_ID, ICON_MASK_ID, RENAME_MASK_ID, MENU_MASK_ID]) {
      const m = document.getElementById(id);
      if (m) m.remove();
    }
    if (this.editControls) {
      this.editControls.remove();
      this.editControls = null;
      this.doneBtn = null;
      this.columnSel = null;
      this.textToggleBtn = null;
      this.syncTextToggle = null;
      this.gestureSel = null;
    }
    this.overlay.remove();
    window.removeEventListener('resize', this.onResize);
    if (LauncherModal.instance === this) LauncherModal.instance = null;
  }

  // ===== 渲染 =====

  private render(): void {
    clearChildren(this.grid);
    this.applyColumns();
    const tiles = this.tiles();
    if (tiles.length === 0 && !this.editing) {
      const empty = document.createElement('div');
      empty.id = EMPTY_ID;
      empty.textContent = '入口页还是空的——长按空白处进入编辑模式，添加命令磁贴';
      empty.style.cssText =
        'grid-column:1/-1;text-align:center;color:var(--text-muted);padding:48px 0;font-size:13px;';
      this.grid.appendChild(empty);
    }
    for (const tile of tiles) {
      this.grid.appendChild(this.buildTile(tile));
    }
    // 编辑模式：空白单元格渲染「＋」（点击添加命令）
    if (this.editing) this.renderEmptyCells(tiles);
    if (this.doneBtn) this.doneBtn.style.display = this.editing ? 'inline-flex' : 'none';
    if (this.editControls) this.editControls.style.display = this.editing ? 'flex' : 'none';
    if (this.syncTextToggle) this.syncTextToggle();
    if (this.gestureSel) {
      const v = this.gesture();
      if (this.gestureSel.value !== v) this.gestureSel.value = v;
    }
    if (this.columnSel) {
      const v = String(this.columns());
      if (this.columnSel.value !== v) this.columnSel.value = v;
    }
  }

  /** 空白单元格「＋」占位（含末尾追加行——全满时也能继续添加） */
  private renderEmptyCells(tiles: LauncherTile[]): void {
    const cols = this.columns();
    const maxBottom = tiles.reduce((m, t) => Math.max(m, t.y + t.h), 0);
    const rows = Math.max(1, maxBottom + 2); // 多扫一行，保证永远有可添加的位置
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const occupied = tiles.some((t) => t.x < x + 1 && x < t.x + t.w && t.y < y + 1 && y < t.y + t.h);
        if (occupied) continue;
        const cell = document.createElement('div');
        cell.className = 'launcher-empty-cell';
        cell.dataset.cellX = String(x);
        cell.dataset.cellY = String(y);
        cell.textContent = '＋';
        cell.title = '添加命令';
        cell.style.cssText =
          `grid-column:${x + 1} / span 1;grid-row:${y + 1} / span 1;` +
          'display:flex;align-items:center;justify-content:center;color:var(--text-muted);' +
          'font-size:18px;cursor:pointer;border-radius:12px;user-select:none;transition:background 0.15s ease;';
        cell.addEventListener('mouseenter', () => (cell.style.background = 'var(--background-modifier-hover)'));
        cell.addEventListener('mouseleave', () => (cell.style.background = ''));
        cell.addEventListener('pointerdown', (e) => e.stopPropagation());
        cell.addEventListener('click', () => this.openCommandDialog());
        this.grid.appendChild(cell);
      }
    }
  }

  /** 是否显示磁贴文字（平台独立：移动端读 launcherShowTextMobile，未设置继承桌面端） */
  private showText(): boolean {
    try {
      const s = getSettings() as any;
      const v = LauncherModal.isMobileEnv()
        ? (s.launcherShowTextMobile ?? s.launcherShowText)
        : s.launcherShowText;
      return v !== false;
    } catch (e) {
      return true;
    }
  }

  /** 打开入口页的手势（平台独立：移动端读 launcherGestureMobile，未设置继承桌面端） */
  private gesture(): string {
    try {
      const s = getSettings() as any;
      const v = LauncherModal.isMobileEnv()
        ? (s.launcherGestureMobile ?? s.launcherGesture)
        : s.launcherGesture;
      return v === 'double' || v === 'triple' || v === 'swipe' ? v : 'off';
    } catch (e) {
      return 'off';
    }
  }

  private commandOf(tile: LauncherTile): CommandMeta | undefined {
    return this.commands.find((c) => c.id === tile.commandId);
  }

  /** 显示名：自定义 label 优先于命令名；幽灵磁贴无命令名时兜底 commandId */
  private displayName(tile: LauncherTile, isGhost: boolean): string {
    if (tile.label) return tile.label;
    if (isGhost) return tile.commandId;
    const cmd = this.commandOf(tile);
    return cmd ? cmd.name : tile.commandId;
  }

  private buildTile(tile: LauncherTile): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'launcher-tile' + (this.editing ? ' editing' : '');
    el.dataset.tileId = tile.id;
    el.dataset.commandId = tile.commandId;

    const isGhost = !this.validIds.has(tile.commandId);
    if (isGhost) el.classList.add('ghost');

    // 内容随网格单元尺寸按比例缩放（移动端自适应）
    const cell = this.cellSize();
    const area = tile.w * tile.h;
    const areaMul = area >= 4 ? 1.5 : area === 2 ? 1.2 : 1;
    const iconSize = Math.max(16, Math.min(48, Math.round(cell * 0.4 * areaMul)));
    // Windows 磁贴风格：文字很小
    const fontSize = Math.max(9, Math.min(12, Math.round(cell * 0.11)));
    el.style.gridColumn = `${tile.x + 1} / span ${tile.w}`;
    el.style.gridRow = `${tile.y + 1} / span ${tile.h}`;

    const iconEl = document.createElement('div');
    iconEl.className = 'launcher-icon';
    iconEl.style.cssText = `width:${iconSize}px;height:${iconSize}px;display:flex;align-items:center;justify-content:center;`;
    iconEl.dataset.iconSize = String(iconSize);
    const cmd = this.commandOf(tile);
    const iconName = tile.icon || cmd?.icon;
    // 图标渲染：Obsidian 内置图标（清单或 getIcon 有效）→ setIcon；emoji/字符 → 文本显示
    const isLucide = !!iconName && (LUCIDE_ICONS.includes(iconName) || !!getIcon(iconName));
    if (iconName && !isLucide) {
      iconEl.textContent = iconName;
      iconEl.style.fontSize = Math.round(iconSize * 0.85) + 'px';
      iconEl.style.lineHeight = '1';
    } else {
      try {
        setIcon(iconEl, iconName || 'command');
      } catch (e) {
        /* 图标名无效时兜底 */
      }
    }
    el.appendChild(iconEl);

    // 隐藏文字：仅显示图标（设置页统一开关）
    if (this.showText()) {
      const nameEl = document.createElement('div');
      nameEl.className = 'launcher-name';
      nameEl.textContent = this.displayName(tile, isGhost);
      nameEl.style.cssText =
        'font-size:' + fontSize + 'px;color:var(--text-muted);text-align:center;' +
        'line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;' +
        'word-break:break-all;';
      if (this.editing) {
        // 编辑模式：名字点击并入磁贴操作菜单
        nameEl.style.cursor = 'pointer';
      }
      el.appendChild(nameEl);
    }

    // 编辑模式：整磁贴点击 → 操作菜单（改名/图标/尺寸/删除）
    if (this.editing) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.suppressClick) {
          this.suppressClick = false;
          return;
        }
        this.openTileMenu(tile.id);
      });
    } else {
      // 常态：点击执行命令并关闭
      el.addEventListener('click', () => this.onTileClick(tile, isGhost));
    }

    // 长按进入编辑模式（常态）；编辑模式下拖主体移动（安卓式实时重排）
    this.bindDrag(el, tile);
    return el;
  }

  private onTileClick(tile: LauncherTile, isGhost: boolean): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (isGhost) {
      notice('命令不存在：' + tile.commandId, 'error');
      return;
    }
    const cmd = this.commandOf(tile);
    if (!cmd) return;
    // 先关入口页，再执行（入口语义：点完自动关闭）
    this.close();
    try {
      this.app.commands.executeCommandById(tile.commandId);
    } catch (e) {
      notice(`命令执行失败：${tile.commandId}`, 'error');
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

    // 编辑模式：拖主体移动（安卓式：先判定移动，超阈值才进入拖拽，避免点击闪烁）
    el.addEventListener('pointerdown', (e) => {
      if (!this.editing) return;
      this.prepDrag(tile, e as PointerEvent);
    });
  }

  /** 编辑模式点击预判：位移超阈值 → 进入拖拽；未移动 → 由 click 触发操作菜单 */
  private prepDrag(tile: LauncherTile, e: PointerEvent): void {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) <= MOVE_CANCEL && Math.abs(ev.clientY - startY) <= MOVE_CANCEL) return;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      this.startDrag(tile, ev, startX, startY);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  // ===== 安卓式拖拽（实时让位重排）=====

  private startDrag(tile: LauncherTile, e: PointerEvent, pressX?: number, pressY?: number): void {
    e.preventDefault();
    e.stopPropagation();
    const gridRect = this.grid.getBoundingClientRect();
    const step = this.cellStep();
    const cols = this.columns();
    // 抓取偏移（中心对齐）：以按下点为准（startDrag 的 ev 可能是移动后的位置）
    const px = pressX ?? e.clientX;
    const py = pressY ?? e.clientY;
    const offX = px - (gridRect.left + tile.x * step + (tile.w * step) / 2);
    const offY = py - (gridRect.top + tile.y * step + (tile.h * step) / 2);
    const original = this.tiles().slice();
    let work = original.slice();
    let cellX = tile.x;
    let cellY = tile.y;
    let lastX = e.clientX;
    let lastY = e.clientY;
    let dragMoved = false;

    // 占位框（实时目标格预览）
    const ph = document.createElement('div');
    ph.className = 'launcher-placeholder';
    ph.style.cssText = 'border:2px dashed var(--text-muted);border-radius:10px;opacity:0.6;';
    this.placePlaceholder(ph, tile, cellX, cellY);
    this.grid.appendChild(ph);

    /** 拖拽磁贴跟随手指（fixed 定位 + 放大；render 重建后重新应用） */
    const positionFloating = () => {
      const el = this.grid.querySelector<HTMLElement>(`.launcher-tile[data-tile-id="${tile.id}"]`);
      if (!el) return;
      el.classList.add('dragging');
      el.style.position = 'fixed';
      el.style.zIndex = '9999';
      el.style.width = tile.w * step - GAP + 'px';
      el.style.height = tile.h * step - GAP + 'px';
      el.style.left = lastX - offX + 'px';
      el.style.top = lastY - offY + 'px';
    };
    positionFloating();

    const move = (ev: PointerEvent) => {
      dragMoved = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      positionFloating();
      const left = lastX - offX - gridRect.left;
      const top = lastY - offY - gridRect.top;
      const cx = Math.max(0, Math.min(cols - tile.w, Math.floor(left / step)));
      const cy = Math.max(0, Math.floor(top / step));
      if (cx !== cellX || cy !== cellY) {
        const result = pushMove(work, tile.id, cx, cy, cols);
        if (result) {
          work = result;
          cellX = cx;
          cellY = cy;
          this.setTiles(work); // 实时应用到正式布局（不保存，松手才落盘）
          this.render(); // 其他磁贴实时让位（平滑动画由 CSS transition 提供）
          this.grid.appendChild(ph);
          this.placePlaceholder(ph, tile, cx, cy);
          positionFloating();
        }
      }
    };

    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      ph.remove();
      const left = ev.clientX - offX - gridRect.left;
      const top = ev.clientY - offY - gridRect.top;
      const cx = Math.max(0, Math.min(cols - tile.w, Math.floor(left / step)));
      const cy = Math.max(0, Math.floor(top / step));
      const result = pushMove(work, tile.id, cx, cy, cols);
      if (result && (cx !== tile.x || cy !== tile.y)) {
        this.setTiles(result);
        this.save();
        this.render();
      } else {
        // 回原位或未移动：恢复拖拽前的原始布局（撤销实时让位）
        this.setTiles(original);
        this.render();
      }
      // 真实拖拽过 → 抑制随后的 click（防误弹菜单）
      if (dragMoved) {
        this.suppressClick = true;
        setTimeout(() => {
          this.suppressClick = false;
        }, 0);
      }
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    // 立即处理当前指针位置（首个移动事件来自 prepDrag 转发）
    move(e);
  }

  private placePlaceholder(ph: HTMLElement, tile: LauncherTile, cx: number, cy: number): void {
    ph.style.gridColumn = `${cx + 1} / span ${tile.w}`;
    ph.style.gridRow = `${cy + 1} / span ${tile.h}`;
  }

  // ===== 磁贴操作菜单 =====

  /** 编辑模式点磁贴 → 操作菜单（改名/图标/尺寸/删除） */
  private openTileMenu(tileId: string): void {
    const tile = this.tiles().find((t) => t.id === tileId);
    if (!tile) return;
    const { mask, popup } = this.buildPicker(MENU_MASK_ID, MENU_POPUP_ID, '磁贴操作');
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    popup.appendChild(list);

    const addRow = (text: string, handler: () => void) => {
      const row = document.createElement('div');
      row.className = 'launcher-picker-item';
      row.textContent = text;
      row.style.cssText =
        'display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;' +
        'font-size:13px;';
      row.addEventListener('mouseenter', () => (row.style.background = 'var(--background-modifier-hover)'));
      row.addEventListener('mouseleave', () => (row.style.background = ''));
      row.addEventListener('click', handler);
      list.appendChild(row);
      return row;
    };

    const close = () => this.closePicker(mask);
    addRow('✏️ 修改名称', () => {
      close();
      this.openRenameDialog(tileId);
    });
    addRow('🎨 选择图标', () => {
      close();
      this.openIconDialog(tileId, (icon) => {
        if (icon === null) delete tile.icon;
        else tile.icon = icon;
        this.save();
        this.render();
      });
    });
    // 尺寸一键选择（替代拖拽手柄）：1×1 / 2×1 / 1×2 / 2×2
    const sizes: Array<[string, number, number]> = [
      ['1×1', 1, 1],
      ['2×1', 2, 1],
      ['1×2', 1, 2],
      ['2×2', 2, 2],
    ];
    for (const [label, w, h] of sizes) {
      const current = tile.w === w && tile.h === h;
      addRow(`${current ? '✅ ' : '📐 '}尺寸 ${label}`, () => {
        close();
        const others = this.tiles().filter((t) => t.id !== tile.id);
        if (!canPlace(others, tile.x, tile.y, w, h, undefined, this.columns())) {
          notice('当前位置放不下该尺寸', 'warning');
          return;
        }
        tile.w = w;
        tile.h = h;
        this.save();
        this.render();
      });
    }
    addRow('🗑 删除磁贴', () => {
      close();
      this.removeTile(tileId);
    });
  }

  // ===== 增删 =====

  private removeTile(id: string): void {
    this.setTiles(this.tiles().filter((t) => t.id !== id));
    this.save();
    this.render();
  }

  /** 添加命令：选中后 1×1 落末尾第一个空位，并进入编辑模式便于摆放；命令自带图标 → 默认使用 */
  private addTile(commandId: string): void {
    const cmd = this.commands.find((c) => c.id === commandId);
    const tile: LauncherTile = {
      id: generateId('lt-'),
      commandId,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      ...(cmd?.icon ? { icon: cmd.icon } : {}),
    };
    this.setTiles(placeAtEnd(this.tiles(), tile, this.columns()));
    this.save();
    this.enterEdit();
  }

  private save(): void {
    void saveLauncherData(this.app, {
      version: 3,
      desktop: this.data.desktop,
      mobile: this.data.mobile,
    }).catch((e) => {
      notice(`入口页保存失败：${LAUNCHER_PATH}`, 'error');
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
    input.placeholder = '搜索图标，或输入 emoji/字符直接使用';
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
      clearChildren(list);
      const q = query.trim();
      // emoji/任意字符：输入非空时提供「直接使用」入口（lucide 清单外的字符走文本渲染）
      if (q) {
        const emojiRow = document.createElement('div');
        emojiRow.className = 'launcher-icon-emoji';
        emojiRow.dataset.emoji = q;
        emojiRow.textContent = `使用「${q}」作为图标`;
        emojiRow.style.cssText =
          'grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;' +
          'cursor:pointer;font-size:13px;color:var(--text-accent);';
        emojiRow.addEventListener('mouseenter', () => (emojiRow.style.background = 'var(--background-modifier-hover)'));
        emojiRow.addEventListener('mouseleave', () => (emojiRow.style.background = ''));
        emojiRow.addEventListener('click', () => {
          this.closePicker(mask);
          onPick(q);
        });
        list.appendChild(emojiRow);
      }
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

  // ===== 改名弹窗 =====

  /** 修改磁贴显示名（label）；提交空串 → 删除 label 恢复默认名 */
  openRenameDialog(tileId: string): void {
    const tile = this.tiles().find((t) => t.id === tileId);
    if (!tile) return;
    const isGhost = !this.validIds.has(tile.commandId);
    const { mask, popup } = this.buildPicker(RENAME_MASK_ID, RENAME_POPUP_ID, '修改名称');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = tile.label || (isGhost ? tile.commandId : this.commandOf(tile)?.name || tile.commandId);
    input.placeholder = '输入显示名称（留空恢复默认）';
    input.className = 'launcher-picker-input';
    input.style.cssText =
      'width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--background-modifier-border);' +
      'background:var(--background-secondary);color:var(--text-normal);font-size:13px;box-sizing:border-box;margin-bottom:10px;';
    popup.appendChild(input);

    const submit = () => {
      const v = input.value.trim();
      if (v) tile.label = v;
      else delete tile.label;
      this.closePicker(mask);
      this.save();
      this.render();
    };

    const okBtn = createIconBtn('✓ 确定', '保存名称', submit, 'font-size:13px;width:64px;height:26px;margin-right:8px;');
    const cancelBtn = createIconBtn('✕ 取消', '取消', () => this.closePicker(mask), 'font-size:13px;width:64px;height:26px;');
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:flex-end;';
    row.appendChild(okBtn);
    row.appendChild(cancelBtn);
    popup.appendChild(row);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closePicker(mask);
      if (e.key === 'Enter') submit();
    });
    input.select();
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
