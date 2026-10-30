/* ============================================================
 * bz 组件库 · 首次设置主密码屏（src/core/ui/setup-screen.ts）
 *
 * 三域共用：保险库 / 加密日记 / 密码本 的「第一次设密码」走同一个面板，一字不差。
 * 与解锁屏（lock-screen.ts）分工：
 *   - 解锁 = 验证一把已有的密码，各域各穿各的皮（金印 / 纸感 / 素面）；
 *   - 首设 = 定一把还存在的密码，四域是同一件事，所以不分皮。
 *
 * 组件负责：结构、实时一致性、通用校验（空 / 不一致 / 未勾选）、busy、遮罩与 ESC 收场。
 * 域负责：真正把密码设下去（SafeManager.unlock 的首设路径）、成功后的通知与后续流程。
 * 组件不碰密码学，也不替域决定「设完之后去哪」。
 * ============================================================ */
import { bindMaskDismiss } from '../mask-dismiss';
import { escManager } from '../esc-manager';
import { uiIcon } from './icon';
import type { BzIconName } from './types';

export interface SetupScreenOpts {
  /** 标题（缺省「设置主密码」） */
  title?: string;
  /** 副题覆盖（纯文本；缺省用内置的「三域共用一把密码」说明） */
  sub?: string;
  /** 主按钮文案（缺省「设置并解锁」） */
  action?: string;
  /** 次按钮文案（缺省「暂不设置」） */
  cancel?: string;
  /** 徽内图标（缺省 key-round） */
  icon?: BzIconName;
  /** 内联进域内覆盖层（密码本锁层），不建全屏遮罩、不接管 ESC */
  inline?: boolean;
  /** 提交：组件已完成通用校验并置 busy。抛错 → 错误行显示 message */
  onSubmit(pw: string): Promise<void> | void;
  /** 次按钮 / 点遮罩 / ESC（inline 模式只有次按钮） */
  onCancel?(): void;
}

export interface SetupScreenHandle {
  /** 根元素（遮罩 或 inline 内容盒） */
  el: HTMLDivElement;
  input: HTMLInputElement;
  input2: HTMLInputElement;
  ackBox: HTMLInputElement;
  actionBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  setError(text: string): void;
  setBusy(busy: boolean): void;
  focus(): void;
  close(): void;
}

/**
 * 副题：这里是唯一一处告诉用户「一把密码管三处」的地方——
 * 从日记或密码本触发时，用户并不知道自己正在设的是全局主密码。
 */
const DEFAULT_SUB = '只设这一次。<b>保险库</b>、<b>加密日记</b>、<b>密码本</b>、<b>脸谱</b>共用这一把密码。';
const WARN_TEXT = '密码<b>不会保存</b>，也无法找回。忘记它，加密的笔记、日记、口令与脸谱将永久打不开。';
let SEQ = 0;

export function uiSetupScreen(opts: SetupScreenOpts): SetupScreenHandle {
  const el = document.createElement('div');
  el.className = 'bz-su' + (opts.inline ? ' bz-su--inline' : ' bz-su--mask');
  el.dataset.su = opts.inline ? 'box' : 'mask';

  const box = document.createElement('div');
  box.className = 'bz-su-box';
  box.dataset.su = 'box';

  // ── 头部：小徽 + 标题 + 覆盖范围 ────────────────────────────
  const head = document.createElement('div');
  head.className = 'bz-su-head';
  const badge = document.createElement('div');
  badge.className = 'bz-su-badge';
  badge.dataset.su = 'badge';
  badge.appendChild(uiIcon(opts.icon || 'key-round', 'bz-su-badge-ic'));
  head.appendChild(badge);

  const headText = document.createElement('div');
  const title = document.createElement('h4');
  title.className = 'bz-su-title';
  title.dataset.su = 'title';
  title.textContent = opts.title || '设置主密码';
  const sub = document.createElement('p');
  sub.className = 'bz-su-sub';
  sub.dataset.su = 'sub';
  if (opts.sub) sub.textContent = opts.sub;
  else sub.innerHTML = DEFAULT_SUB;
  headText.appendChild(title);
  headText.appendChild(sub);
  head.appendChild(headText);
  box.appendChild(head);

  // ── 两遍输入（明文、上下排）──────────────────────────────────
  // 首设没有可对照的正确值：掩码下输错只能等提交才报「不一致」，故两遍都明文，
  // 并顺手关掉拼写纠正与首字母大写，免得输入法把密码改写掉。
  const makeInput = (id: string, placeholder: string): HTMLInputElement => {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'bz-su-input';
    inp.dataset.su = id;
    inp.placeholder = placeholder;
    inp.spellcheck = false;
    inp.setAttribute('autocapitalize', 'off');
    inp.setAttribute('autocorrect', 'off');
    inp.autocomplete = 'new-password';
    return inp;
  };

  const field1 = document.createElement('div');
  field1.className = 'bz-su-field';
  const label1 = document.createElement('label');
  label1.className = 'bz-su-label';
  label1.textContent = '主密码';
  // id 逐实例唯一：密码本桌面/移动两份内联屏同存时，重名会让 label 的 htmlFor 指到先建的那份
  const uid = 'bz-su-' + ++SEQ + '-';
  const input = makeInput('p1', '输入要设置的主密码');
  label1.htmlFor = input.id = uid + 'p1';
  field1.appendChild(label1);
  field1.appendChild(input);
  box.appendChild(field1);

  const field2 = document.createElement('div');
  field2.className = 'bz-su-field';
  const label2 = document.createElement('label');
  label2.className = 'bz-su-label';
  label2.textContent = '再输一遍';
  const wrap2 = document.createElement('div');
  wrap2.className = 'bz-su-control';
  const input2 = makeInput('p2', '重复输入，确认没有打错');
  label2.htmlFor = input2.id = uid + 'p2';
  const mark = document.createElement('span');
  mark.className = 'bz-su-mark';
  mark.dataset.su = 'mark';
  wrap2.appendChild(input2);
  wrap2.appendChild(mark);
  field2.appendChild(label2);
  field2.appendChild(wrap2);
  box.appendChild(field2);

  // ── 风险告知（首次唯一一次，不重复念叨）──────────────────────
  const warn = document.createElement('div');
  warn.className = 'bz-su-warn';
  warn.dataset.su = 'warn';
  warn.appendChild(uiIcon('triangle-alert', 'bz-su-warn-ic'));
  const warnText = document.createElement('p');
  warnText.innerHTML = WARN_TEXT;
  warn.appendChild(warnText);
  box.appendChild(warn);

  // ── 勾选确认 ────────────────────────────────────────────────
  const ack = document.createElement('label');
  ack.className = 'bz-su-ack';
  ack.dataset.su = 'ack';
  const ackBox = document.createElement('input');
  ackBox.type = 'checkbox';
  const ackText = document.createElement('span');
  ackText.textContent = '我已牢记这个密码';
  ack.appendChild(ackBox);
  ack.appendChild(ackText);
  box.appendChild(ack);

  // ── 错误行 ──────────────────────────────────────────────────
  const err = document.createElement('div');
  err.className = 'bz-su-err';
  err.dataset.su = 'err';
  box.appendChild(err);

  // ── 动作 ────────────────────────────────────────────────────
  const actionBtn = document.createElement('button');
  actionBtn.className = 'bz-su-go';
  actionBtn.dataset.su = 'go';
  actionBtn.type = 'button';
  actionBtn.textContent = opts.action || '设置并解锁';
  box.appendChild(actionBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'bz-su-later';
  cancelBtn.dataset.su = 'cancel';
  cancelBtn.type = 'button';
  cancelBtn.textContent = opts.cancel || '暂不设置';
  box.appendChild(cancelBtn);

  el.appendChild(box);

  // ── 状态 ────────────────────────────────────────────────────
  let busy = false;
  let closed = false;

  const setErr = (m: string) => {
    err.textContent = m;
    err.classList.toggle('is-shown', !!m);
  };

  const setMark = (state: 'none' | 'ok' | 'bad') => {
    mark.textContent = '';
    mark.classList.remove('is-shown', 'bz-su-mark--ok', 'bz-su-mark--bad');
    wrap2.classList.remove('is-bad');
    if (state === 'none') return;
    mark.appendChild(uiIcon(state === 'ok' ? 'check' : 'x', 'bz-su-mark-ic'));
    const t = document.createElement('span');
    t.textContent = state === 'ok' ? '一致' : '不一致';
    mark.appendChild(t);
    mark.classList.add('is-shown', state === 'ok' ? 'bz-su-mark--ok' : 'bz-su-mark--bad');
    if (state === 'bad') wrap2.classList.add('is-bad');
  };

  /** 实时反馈：明文的价值就在于「打错当场看见」，不用等提交 */
  const sync = () => {
    const v1 = input.value;
    const v2 = input2.value;
    if (!v2) setMark('none');
    else setMark(v2 === v1 ? 'ok' : 'bad');
    if (err.classList.contains('is-shown')) setErr('');
  };

  const setBusy = (b: boolean) => {
    busy = !!b;
    actionBtn.disabled = !!b;
    input.disabled = !!b;
    input2.disabled = !!b;
    ackBox.disabled = !!b;
    cancelBtn.disabled = !!b; // 提交窗口内不给退出（同主按钮）
    actionBtn.textContent = b ? '处理中…' : (opts.action || '设置并解锁');
  };

  const focus = () => {
    try {
      input.focus({ preventScroll: true } as any);
    } catch (e) {
      input.focus();
    }
  };

  const close = () => {
    if (closed) return;
    closed = true;
    if (!opts.inline) {
      unDismiss();
      esc?.unregister();
    }
    el.remove();
  };

  const cancel = () => {
    if (busy || closed) return;
    close();
    opts.onCancel?.();
  };

  const submit = async () => {
    if (busy) return;
    const v1 = input.value;
    const v2 = input2.value;
    if (!v1) { setErr('请输入主密码'); focus(); return; }
    if (v1 !== v2) { setErr('两次输入不一致'); input2.focus(); return; }
    if (!ackBox.checked) { setErr('请先勾选确认'); return; }
    setErr('');
    setBusy(true);
    try {
      await opts.onSubmit(v1);
      // 成功路径由域收场（关屏 + 通知）——这里不复位 busy：
      // 域在 await 之后才关屏时，按钮若提前活过来，用户能再点一次重复设密。
    } catch (e: any) {
      setBusy(false);
      setErr(e?.message || '设置失败');
    }
  };

  input.addEventListener('input', sync);
  input2.addEventListener('input', sync);
  ackBox.addEventListener('change', () => {
    ack.classList.toggle('is-on', ackBox.checked);
    if (err.classList.contains('is-shown')) setErr('');
  });
  // Enter 恒等价点主按钮（两个框都是）；busy 期按钮 disabled，天然防重
  for (const inp of [input, input2]) {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); void submit(); }
    });
  }
  actionBtn.addEventListener('click', () => { void submit(); });
  cancelBtn.addEventListener('click', cancel);

  // 全屏实例：点空白 / ESC 与「暂不设置」同一条收场路
  let esc: { unregister(): void } | null = null;
  let unDismiss: () => void = () => {};
  if (!opts.inline) {
    unDismiss = bindMaskDismiss(el, cancel);
    esc = escManager.register('bz-su-screen', {
      isVisible: () => el.isConnected,
      close: cancel,
    });
  }

  return {
    el,
    input,
    input2,
    ackBox,
    actionBtn,
    cancelBtn,
    setError: setErr,
    setBusy,
    focus,
    close,
  };
}
