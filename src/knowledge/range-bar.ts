/**
 * 双把手范围条（ADR-0133）：自绘轨道 + 两枚把手，pointer 拖拽选择 [start, end] 秒区间。
 * - 量程 [0, totalSec]：两把手最小间隔 1 秒（互相钳制）；全选 = 整片（调用方按 start=0/end=total 判定）
 * - 触屏仲裁：仅把手接管手势（touch-action:none 的明确可拖目标），轨道本体不接管——不与页面滚动抢
 *   （范式随 home/entry-editor 的「不抢 touch-action」结论：可拖目标限定为把手本身）
 * - 键盘：把手聚焦后 ←/→ ±1 秒、Shift ±10 秒（与时间框 ↑/↓ 口径一致）
 * - onChange 拖拽/键盘过程中实时回调（调用方同步时间框与状态）；set 只重绘不回调
 */

export interface RangeBarOptions {
  /** 拖拽/键盘调整后实时回调（秒，整数） */
  onChange: (startSec: number, endSec: number) => void;
}

export class RangeBar {
  readonly el: HTMLElement;
  private track: HTMLElement;
  private fill: HTMLElement;
  private hStart: HTMLElement;
  private hEnd: HTMLElement;
  private total = 0;
  private start = 0;
  private end = 0;
  private readonly onChange: (startSec: number, endSec: number) => void;

  constructor(opts: RangeBarOptions) {
    this.onChange = opts.onChange;
    this.el = document.createElement('div');
    this.el.className = 'bz-lit-rb';
    this.track = document.createElement('div');
    this.track.className = 'bz-lit-rb-track';
    this.fill = document.createElement('div');
    this.fill.className = 'bz-lit-rb-fill';
    this.hStart = this._makeHandle('start', '开始把手');
    this.hEnd = this._makeHandle('end', '结束把手');
    this.track.appendChild(this.fill);
    this.track.appendChild(this.hStart);
    this.track.appendChild(this.hEnd);
    this.el.appendChild(this.track);
  }

  private _makeHandle(which: 'start' | 'end', label: string): HTMLElement {
    const h = document.createElement('div');
    h.className = `bz-lit-rb-handle bz-lit-rb-${which === 'start' ? 'hs' : 'he'}`;
    h.setAttribute('role', 'slider');
    h.setAttribute('aria-label', label);
    h.tabIndex = 0;
    h.addEventListener('pointerdown', (e) => this._beginDrag(e, which));
    h.addEventListener('keydown', (e) => this._onKey(e, which));
    return h;
  }

  /** 重设量程与值（秒；整数化 + 钳制），只重绘不回调 */
  set(totalSec: number, startSec: number, endSec: number): void {
    this.total = Math.max(0, Math.round(totalSec) || 0);
    let s = Math.max(0, Math.min(Math.round(startSec) || 0, this.total));
    let e = Math.max(0, Math.min(Math.round(endSec) || 0, this.total));
    if (this.total >= 2) {
      s = Math.min(s, this.total - 1); // 末端把手可落在 total，开始把手至少留 1 秒间隙
      e = Math.max(e, Math.min(this.total, s + 1));
    }
    this.start = s;
    this.end = e;
    this._paint();
  }

  /** 拖拽中更新（内部用，立即回调） */
  private _apply(s: number, e: number): void {
    this.start = s;
    this.end = e;
    this._paint();
    this.onChange(s, e);
  }

  private _paint(): void {
    const T = this.total || 1;
    const sp = this.total > 0 ? (this.start / T) * 100 : 0;
    const ep = this.total > 0 ? (this.end / T) * 100 : 100;
    this.hStart.style.left = `${sp}%`;
    this.hEnd.style.left = `${ep}%`;
    this.fill.style.left = `${sp}%`;
    this.fill.style.width = `${Math.max(0, ep - sp)}%`;
    for (const [h, v] of [[this.hStart, this.start], [this.hEnd, this.end]] as const) {
      h.setAttribute('aria-valuemin', '0');
      h.setAttribute('aria-valuemax', String(this.total));
      h.setAttribute('aria-valuenow', String(v));
    }
    this.el.classList.toggle('is-disabled', this.total < 2);
  }

  private _beginDrag(e: PointerEvent, which: 'start' | 'end'): void {
    if (this.total < 2 || e.button !== 0) return; // 仅主键/主触点（右键不起拖）
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    try { handle.setPointerCapture(e.pointerId); } catch { /* 非致命：无捕获也可用 */ }
    // 抓取偏移（review 306）：按下点与把手中心的差——长视频里避免按下瞬间把手跳到指针处
    const rect0 = this.track.getBoundingClientRect();
    const grabSec = which === 'start' ? this.start : this.end;
    const grabX = rect0.left + (rect0.width > 0 ? (grabSec / this.total) * rect0.width : 0);
    const offset = e.clientX - grabX;
    const move = (ev: PointerEvent): void => {
      const rect = this.track.getBoundingClientRect();
      const ratio = rect.width > 0 ? (ev.clientX - offset - rect.left) / rect.width : 0;
      const sec = Math.round(Math.max(0, Math.min(1, ratio)) * this.total);
      if (which === 'start') this._apply(Math.max(0, Math.min(sec, this.end - 1)), this.end);
      else this._apply(this.start, Math.min(this.total, Math.max(sec, this.start + 1)));
    };
    const up = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  private _onKey(e: KeyboardEvent, which: 'start' | 'end'): void {
    if (this.total < 2) return;
    const step = e.shiftKey ? 10 : 1;
    let delta = 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
    else return;
    e.preventDefault();
    if (which === 'start') this._apply(Math.max(0, Math.min(this.start + delta, this.end - 1)), this.end);
    else this._apply(this.start, Math.min(this.total, Math.max(this.end + delta, this.start + 1)));
  }
}
