/**
 * 行内动作钮三态（issue 434）：busy 转圈 / ok 绿勾 / fail 红叉，短暂停留后复原为原文案。
 * 用户拍板（2026-09-25）：「显示一个转圈的 Loading，成功就改成绿色的以及对应的图标，失败就
 * 改成红色的以及对应的图标。不需要弹窗，也不需要显示详细信息」——状态长在按钮本体上，
 * 两个渲染器（core 原生 Setting 钮 / settings-panel 的 bz-sp-btn）同调本助手，原型壳同源生效。
 */
export const ROW_BTN_RESET_MS = 2000;

export type RowBtnState = 'busy' | 'ok' | 'fail' | 'idle';

const OK_GLYPH = '✓';
const FAIL_GLYPH = '✕';

/** 把状态写到按钮元素上（el 缺省安全——渲染器拿不到 buttonEl 时静默退化为无状态）。
 *  busy 期间禁点；ok / fail 用图标替换文案 + 语义色类；idle 恢复原文案。 */
export function setRowBtnState(el: HTMLElement | undefined, state: RowBtnState, label: string): void {
  if (!el) return;
  el.classList.remove('bz-rowbtn--busy', 'bz-rowbtn--ok', 'bz-rowbtn--fail');
  (el as HTMLButtonElement).disabled = state === 'busy';
  if (state === 'busy') {
    el.classList.add('bz-rowbtn--busy');
  } else if (state === 'ok') {
    el.classList.add('bz-rowbtn--ok');
    el.textContent = OK_GLYPH;
  } else if (state === 'fail') {
    el.classList.add('bz-rowbtn--fail');
    el.textContent = FAIL_GLYPH;
  } else {
    el.textContent = label;
  }
}
