/* ============================================================
 * bz 组件库 · 解锁屏（src/core/ui/lock-screen.ts）
 * 三域共用骨架（ADR-0002：core 不反向依赖任何域，故共享壳只能落 core）：
 *   印章徽 + 标题 + 副题 + 统计卡 + 主密码输入 + 主按钮 + 安全提示行。
 * 组件只给结构与槽位：
 *   - 文案 / 统计数字由调用域注入（各域口径不同）；
 *   - 视觉由各域 styles.css 按 .bz-lockscreen--<kind> 作用域风格化；
 *   - 校验、节流、首设流程等语义一律留在域内（组件不碰密码）。
 * ============================================================ */
import { uiIcon } from './icon';
import type { BzIconName } from './types';

/** 一张统计卡：数字 + 标签（数字未知时传 '—'） */
export interface LockScreenStat {
  num: string;
  label: string;
}

/** 域标识：决定作用域类与注入的统计口径 */
export type LockScreenKind = 'vault' | 'password-vault' | 'diary';

export interface LockScreenOpts {
  kind: LockScreenKind;
  /** 印章徽内的 lucide 图标（缺省 lock） */
  icon?: BzIconName;
  title: string;
  sub?: string;
  /** 统计卡（建议 3 张；不传则不渲染统计行） */
  stats?: LockScreenStat[];
  placeholder?: string;
  /** 主按钮文案 */
  action: string;
  /** 底部安全提示行（体检/完整性口径） */
  secText?: string;
  secTone?: 'ok' | 'warn' | 'bad';
  hint?: string;
  /** 首设模式：双输入 + 风险告知 + 勾选确认 */
  firstSetup?: boolean;
  warningHtml?: string;
  ackText?: string;
  /**
   * inline=true：不创建全屏遮罩，只返回内容盒（供域内覆盖层复用，如密码本 desk/mob 双实例）；
   * 缺省返回全屏遮罩（挂 document.body）。
   */
  inline?: boolean;
}

export interface LockScreenHandle {
  /** 根元素（遮罩 或 inline 内容盒） */
  el: HTMLDivElement;
  input: HTMLInputElement;
  input2: HTMLInputElement;
  ackBox: HTMLInputElement | null;
  actionBtn: HTMLButtonElement;
  setTitle(text: string): void;
  setMessage(text: string): void;
  setError(text: string): void;
  setStats(stats: LockScreenStat[]): void;
  setSec(text: string, tone?: 'ok' | 'warn' | 'bad'): void;
  setBusy(busy: boolean): void;
  /** 首设第二遍确认输入的显隐（功能性显隐） */
  showSecondInput(show: boolean): void;
  focus(): void;
  close(): void;
}

/** 生成解锁屏（结构同源，三域各自注入内容与风格） */
export function uiLockScreen(opts: LockScreenOpts): LockScreenHandle {
  const el = document.createElement('div');
  el.className = `bz-lockscreen bz-lockscreen--${opts.kind}` + (opts.inline ? ' bz-lockscreen--inline' : ' bz-lockscreen--mask');
  el.dataset.ls = opts.inline ? 'box' : 'mask';

  const box = document.createElement('div');
  box.className = 'bz-lockscreen-box';
  box.dataset.ls = 'box';

  // 印章徽
  const seal = document.createElement('div');
  seal.className = 'bz-lockscreen-seal';
  seal.dataset.ls = 'seal';
  seal.appendChild(uiIcon(opts.icon || 'lock', 'bz-lockscreen-seal-ic'));
  box.appendChild(seal);

  // 标题 / 副题
  const title = document.createElement('h4');
  title.className = 'bz-lockscreen-title';
  title.dataset.ls = 'title';
  title.textContent = opts.title;
  box.appendChild(title);

  const sub = document.createElement('p');
  sub.className = 'bz-lockscreen-sub';
  sub.dataset.ls = 'sub';
  sub.textContent = opts.sub || '';
  box.appendChild(sub);

  // 统计卡（三张横排；各域口径不同）
  const statsWrap = document.createElement('div');
  statsWrap.className = 'bz-lockscreen-stats';
  statsWrap.dataset.ls = 'stats';
  const setStats = (list: LockScreenStat[]) => {
    statsWrap.innerHTML = '';
    (list || []).forEach((s) => {
      const card = document.createElement('div');
      card.className = 'bz-lockscreen-stat';
      const num = document.createElement('b');
      num.className = 'bz-lockscreen-num';
      num.textContent = s.num;
      const lab = document.createElement('span');
      lab.className = 'bz-lockscreen-label';
      lab.textContent = s.label;
      card.appendChild(num);
      card.appendChild(lab);
      statsWrap.appendChild(card);
    });
    statsWrap.style.display = (list && list.length) ? '' : 'none';
  };
  setStats(opts.stats || []);
  box.appendChild(statsWrap);

  // 首设风险告知（仅首设显示）
  const warning = document.createElement('div');
  warning.className = 'bz-lockscreen-warning';
  warning.dataset.ls = 'warning';
  warning.innerHTML = opts.warningHtml || '';
  warning.style.display = opts.firstSetup ? '' : 'none';
  box.appendChild(warning);

  // 首设勾选确认
  const ack = document.createElement('label');
  ack.className = 'bz-lockscreen-ack';
  ack.dataset.ls = 'ack';
  const ackBox = document.createElement('input');
  ackBox.type = 'checkbox';
  ack.appendChild(ackBox);
  ack.appendChild(document.createTextNode(opts.ackText || '我已了解：主密码无法找回，遗忘将导致密文永久无法恢复'));
  ack.style.display = opts.firstSetup ? '' : 'none';
  box.appendChild(ack);

  // 输入 + 主按钮
  const row = document.createElement('div');
  row.className = 'bz-lockscreen-row';
  const input = document.createElement('input');
  input.type = 'password';
  input.className = 'bz-lockscreen-input';
  input.dataset.ls = 'p1';
  input.placeholder = opts.placeholder || '主密码';
  input.autocomplete = 'off';
  const input2 = document.createElement('input');
  input2.type = 'password';
  input2.className = 'bz-lockscreen-input';
  input2.dataset.ls = 'p2';
  input2.placeholder = '再次输入';
  input2.autocomplete = 'off';
  input2.style.display = opts.firstSetup ? '' : 'none';
  const actionBtn = document.createElement('button');
  actionBtn.className = 'bz-lockscreen-action';
  actionBtn.dataset.ls = 'go';
  actionBtn.textContent = opts.action;
  row.appendChild(input);
  row.appendChild(input2);
  row.appendChild(actionBtn);
  box.appendChild(row);

  // 错误行
  const err = document.createElement('div');
  err.className = 'bz-lockscreen-err';
  err.dataset.ls = 'err';
  box.appendChild(err);

  // 安全提示行（体检/完整性）
  const sec = document.createElement('div');
  sec.className = 'bz-lockscreen-sec';
  sec.dataset.ls = 'sec';
  const dot = document.createElement('span');
  dot.className = 'bz-lockscreen-dot';
  sec.appendChild(dot);
  const secText = document.createElement('span');
  secText.textContent = opts.secText || '';
  sec.appendChild(secText);
  if (opts.secTone) sec.classList.add(`bz-lockscreen-sec--${opts.secTone}`);
  sec.style.display = opts.secText ? '' : 'none';
  box.appendChild(sec);

  const hint = document.createElement('div');
  hint.className = 'bz-lockscreen-hint';
  hint.dataset.ls = 'hint';
  hint.textContent = opts.hint || '';
  hint.style.display = opts.hint ? '' : 'none';
  box.appendChild(hint);

  if (opts.inline) {
    el.appendChild(box);
  } else {
    el.appendChild(box);
    el.style.display = 'flex';
  }

  const focus = () => {
    try {
      input.focus({ preventScroll: true } as any);
    } catch (e) {
      input.focus();
    }
  };

  return {
    el,
    input,
    input2,
    ackBox,
    actionBtn,
    setTitle: (t) => { title.textContent = t; },
    setMessage: (t) => { sub.textContent = t; },
    setError: (t) => { err.textContent = t; },
    setStats,
    setSec: (t, tone) => {
      secText.textContent = t;
      sec.style.display = t ? '' : 'none';
      sec.classList.remove('bz-lockscreen-sec--ok', 'bz-lockscreen-sec--warn', 'bz-lockscreen-sec--bad');
      if (tone) sec.classList.add(`bz-lockscreen-sec--${tone}`);
    },
    setBusy: (busy) => {
      actionBtn.disabled = !!busy;
      input.disabled = !!busy;
      input2.disabled = !!busy;
      if (busy) actionBtn.dataset.busyText = actionBtn.textContent || '';
      actionBtn.textContent = busy ? '处理中…' : (actionBtn.dataset.busyText || opts.action);
    },
    showSecondInput: (show) => { input2.style.display = show ? '' : 'none'; },
    focus,
    close: () => { el.remove(); },
  };
}
