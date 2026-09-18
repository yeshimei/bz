/**
 * core bindFormSubmit 基元（效率#2，diary 写链路为首个消费方）回归：
 * - Ctrl/⌘+Enter 恒提交（textarea/按钮聚焦也在内）；
 * - 纯 Enter 仅单行 input 聚焦时提交；textarea 不拦；非 input 聚焦不提交；
 * - 域内已消费（defaultPrevented）的放行不重复提交——keydown 消费（浏览器不再派发
 *   keypress）与 keypress 消费（diary 手输日期 commitManualEdit 形态，冒泡可见）两路；
 * - data-bz-no-form-submit 豁免（弹窗内过滤/搜索框）。
 */
import { describe, expect, it, vi } from 'vitest';
import { bindFormSubmit } from '../../src/core/ui/modal';

function press(el: EventTarget, type: 'keydown' | 'keypress', init: KeyboardEventInit = {}): boolean {
  return el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', bubbles: true, cancelable: true, ...init }));
}

function setup(): { popup: HTMLElement; input: HTMLInputElement; textarea: HTMLTextAreaElement; btn: HTMLButtonElement; onSubmit: ReturnType<typeof vi.fn> } {
  const popup = document.createElement('div');
  const input = document.createElement('input');
  const textarea = document.createElement('textarea');
  const btn = document.createElement('button');
  popup.append(input, textarea, btn);
  document.body.appendChild(popup);
  const onSubmit = vi.fn();
  bindFormSubmit(popup, onSubmit);
  return { popup, input, textarea, btn, onSubmit };
}

describe('bindFormSubmit', () => {
  it('Ctrl+Enter 恒提交：input/textarea/按钮聚焦都在内，且 keypress 段不重复提交', () => {
    const { popup, input, textarea, btn, onSubmit } = setup();
    press(input, 'keydown', { ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Firefox 等会为组合键补发 keypress：不得二次提交
    press(input, 'keypress', { ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    press(textarea, 'keydown', { metaKey: true });
    press(btn, 'keydown', { ctrlKey: true });
    press(popup, 'keydown', { ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(4);
    popup.remove();
  });

  it('纯 Enter：单行 input 聚焦时提交（keypress 段），keydown 段不重复', () => {
    const { input, onSubmit } = setup();
    press(input, 'keydown'); // 非 Ctrl：keydown 段放行
    expect(onSubmit).not.toHaveBeenCalled();
    press(input, 'keypress'); // 输入框消费在 keypress 提交
    expect(onSubmit).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it('纯 Enter：textarea 不拦（回车换行）、非 input 聚焦不提交', () => {
    const { popup, textarea, onSubmit } = setup();
    press(textarea, 'keypress');
    expect(onSubmit).not.toHaveBeenCalled();
    press(popup, 'keypress'); // 无输入聚焦
    expect(onSubmit).not.toHaveBeenCalled();
    textarea.remove();
  });

  it('keydown 段被消费（uiSuggest 接管回填形态）：浏览器不再派发 keypress，不提交', () => {
    const { input, onSubmit } = setup();
    // 模拟 uiSuggest 在 target 阶段 keydown preventDefault（高亮项回填先于本层冒泡）
    input.addEventListener('keydown', (e) => e.preventDefault());
    press(input, 'keydown'); // bindFormSubmit 见 defaultPrevented → 不提交
    expect(onSubmit).not.toHaveBeenCalled();
    // 浏览器在 keydown preventDefault 后不再派发 keypress —— 以不派发模拟，无提交
    expect(onSubmit).not.toHaveBeenCalled();
    input.remove();
  });

  it('keypress 段被消费（diary 手输日期 commitManualEdit 形态）：defaultPrevented 冒泡可见，不提交', () => {
    const { input, onSubmit } = setup();
    // 模拟 datetime-picker 在 target 阶段 keypress preventDefault（先于本层冒泡）
    input.addEventListener('keypress', (e) => e.preventDefault());
    press(input, 'keypress');
    expect(onSubmit).not.toHaveBeenCalled();
    input.remove();
  });

  it('data-bz-no-form-submit 豁免：过滤/搜索框回车只筛不提交', () => {
    const { popup, onSubmit } = setup();
    const filter = document.createElement('input');
    filter.dataset.bzNoFormSubmit = '';
    popup.appendChild(filter);
    press(filter, 'keypress');
    expect(onSubmit).not.toHaveBeenCalled();
    filter.remove();
  });

  it('defaultPrevented 的 Ctrl+Enter（域内已消费）不重复提交', () => {
    const { popup, input, onSubmit } = setup();
    input.addEventListener('keydown', (e) => {
      if (e.ctrlKey) e.preventDefault(); // 域内输入框已消费组合键
    });
    press(input, 'keydown', { ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    input.remove();
  });
});
