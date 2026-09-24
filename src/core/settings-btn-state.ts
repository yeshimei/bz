/**
 * 行内动作钮三态（issue 434）：busy 转圈 / ok 绿边框「已连通」/ fail 红边框 + 简短失败原因，
 * 短暂停留后复原。用户拍板（2026-09-25）：成功加绿边框显示「已连通」，失败加红边框显示
 * 失败原因的简短描述；不弹窗、不显详情——状态长在按钮本体上，两个渲染器（core 原生
 * Setting 钮 / settings-panel 的 bz-sp-btn）同调本助手，原型壳同源生效。
 */
export const ROW_BTN_RESET_MS = 2000;

export type RowBtnState = 'busy' | 'ok' | 'fail' | 'idle';

export const ROW_BTN_OK_TEXT = '已连通';

/** 失败原因 → 按钮上的简短文案（几个字；按最明确的语义优先匹配） */
export function shortFailReason(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (/超时|Timeout/.test(msg)) return '超时';
  if (/取消|Abort/.test(msg)) return '已取消';
  if (/未配置.*密钥|密钥.*为空/.test(msg)) return '无密钥';
  if (/401|403|密钥|鉴权|invalid.*key|unauthorized/i.test(msg)) return '密钥无效';
  if (/5\d\d|服务|no healthy|upstream/i.test(msg)) return '服务异常';
  if (/网络|fetch|network|Failed to fetch/i.test(msg)) return '网络不通';
  if (/JSON|解析|answers|畸形|回复为空/.test(msg)) return '响应异常';
  return '请求失败';
}

/** 复原定时器按元素分账（issue 434 review）：结果态 2 秒窗口内再点一轮，先清上一轮的复原柄，
 *  否则旧柄会把新一轮 busy 中途拍回 idle，造成对计费接口的重复请求。 */
const resetTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function clearResetTimer(el: HTMLElement): void {
  const prev = resetTimers.get(el);
  if (prev !== undefined) {
    clearTimeout(prev);
    resetTimers.delete(el);
  }
}

/** 把状态写到按钮元素上（el 缺省安全——渲染器拿不到 buttonEl 时静默退化为无状态）。
 *  busy 期间禁点、文案隐形保宽只留转圈（并清掉未决的复原柄）；ok 换「已连通」、fail 换简短
 *  原因（failText），红绿由样式类承担；idle 恢复原文案（如「测试」）。 */
export function setRowBtnState(
  el: HTMLElement | undefined,
  state: RowBtnState,
  label: string,
  failText?: string
): void {
  if (!el) return;
  el.classList.remove('bz-rowbtn--busy', 'bz-rowbtn--ok', 'bz-rowbtn--fail');
  (el as HTMLButtonElement).disabled = state === 'busy';
  if (state === 'busy') {
    el.classList.add('bz-rowbtn--busy');
    clearResetTimer(el);
  } else if (state === 'ok') {
    el.classList.add('bz-rowbtn--ok');
    el.textContent = ROW_BTN_OK_TEXT;
  } else if (state === 'fail') {
    el.classList.add('bz-rowbtn--fail');
    el.textContent = (failText || '失败').slice(0, 6);
  } else {
    el.textContent = label;
  }
}

/** 结果态落定后安排复原（渲染器在 ok/fail 后调用一次；到点回原文案并重新可点） */
export function armRowBtnReset(el: HTMLElement | undefined, label: string): void {
  if (!el) return;
  const prev = resetTimers.get(el);
  if (prev !== undefined) clearTimeout(prev);
  const t = setTimeout(() => {
    resetTimers.delete(el);
    setRowBtnState(el, 'idle', label);
    (el as HTMLButtonElement).disabled = false;
  }, ROW_BTN_RESET_MS);
  resetTimers.set(el, t);
}
