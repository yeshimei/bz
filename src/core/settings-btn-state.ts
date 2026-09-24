/**
 * 行内动作钮三态（issue 434）：busy 转圈 / ok 绿底「成功」/ fail 红底「失败」，短暂停留后复原。
 * 用户拍板（2026-09-25）：失败显示失败的文案 + 红色按钮，成功显示成功的文案 + 绿色按钮；
 * 不弹窗、不显详情——状态长在按钮本体上，两个渲染器（core 原生 Setting 钮 /
 * settings-panel 的 bz-sp-btn）同调本助手，原型壳同源生效。
 */
export const ROW_BTN_RESET_MS = 2000;

export type RowBtnState = 'busy' | 'ok' | 'fail' | 'idle';

/** 结果文案（绿底/红底上的按钮字） */
export const ROW_BTN_OK_TEXT = '成功';
export const ROW_BTN_FAIL_TEXT = '失败';

/** 把状态写到按钮元素上（el 缺省安全——渲染器拿不到 buttonEl 时静默退化为无状态）。
 *  busy 期间禁点、文案让位转圈；ok / fail 换结果文案 + 整钮填色；idle 恢复原文案（如「测试」）。 */
export function setRowBtnState(el: HTMLElement | undefined, state: RowBtnState, label: string): void {
  if (!el) return;
  el.classList.remove('bz-rowbtn--busy', 'bz-rowbtn--ok', 'bz-rowbtn--fail');
  (el as HTMLButtonElement).disabled = state === 'busy';
  if (state === 'busy') {
    el.classList.add('bz-rowbtn--busy');
  } else if (state === 'ok') {
    el.classList.add('bz-rowbtn--ok');
    el.textContent = ROW_BTN_OK_TEXT;
  } else if (state === 'fail') {
    el.classList.add('bz-rowbtn--fail');
    el.textContent = ROW_BTN_FAIL_TEXT;
  } else {
    el.textContent = label;
  }
}
