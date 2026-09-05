/**
 * 卡片视觉单选组测试（src/core/ui/cardpick.ts，issue 210）：
 * 结构（预览区+名称，无编号无描述）/ 初始选中态 / 点击切换回调与选中态 /
 * setValue 程序化切换 / radiogroup 可访问性。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { uiCardChoice } from '../../src/core/ui';

describe('uiCardChoice 卡片视觉单选组', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function build(value: 'default' | 'paper' | 'editorial' = 'default', onChange = vi.fn()) {
    const pick = uiCardChoice<'default' | 'paper' | 'editorial'>({
      value,
      label: '面板皮肤',
      options: [
        { value: 'default', label: '默认', prevClass: 'bz-skinprev-default' },
        { value: 'paper', label: '纸感手账', prevClass: 'bz-skinprev-paper' },
        { value: 'editorial', label: '编辑部', prevClass: 'bz-skinprev-editorial' },
      ],
      onChange,
    });
    document.body.appendChild(pick.el);
    return { pick, onChange };
  }

  it('结构：radiogroup + 三卡（预览区变体类 + 名称），无编号无描述节点', () => {
    const { pick } = build();
    expect(pick.el.getAttribute('role')).toBe('radiogroup');
    expect(pick.el.getAttribute('aria-label')).toBe('面板皮肤');
    const cards = pick.el.querySelectorAll('.bz-cardpick-card');
    expect(cards.length).toBe(3);
    expect(pick.el.querySelector('.bz-cardpick-name')!.textContent).toBe('默认');
    // 预览变体类透传（视觉由域样式提供）
    expect(cards[1].querySelector('.bz-cardpick-prev')!.classList.contains('bz-skinprev-paper')).toBe(true);
    // 拍板形态：卡片内只有预览 + 名称
    expect(cards[0].children.length).toBe(2);
  });

  it('初始选中态 + 点击切换：回调携带新值、选中类与 aria 同步', () => {
    const { pick, onChange } = build('paper');
    const cards = pick.el.querySelectorAll('.bz-cardpick-card');
    expect(cards[1].classList.contains('is-on')).toBe(true);
    expect(cards[1].getAttribute('aria-checked')).toBe('true');
    (cards[2] as HTMLElement).click();
    expect(onChange).toHaveBeenCalledWith('editorial');
    expect(cards[2].classList.contains('is-on')).toBe(true);
    expect(cards[1].classList.contains('is-on')).toBe(false);
    expect(cards[2].getAttribute('aria-checked')).toBe('true');
    expect(cards[1].getAttribute('aria-checked')).toBe('false');
  });

  it('重复点击当前选中项不触发回调', () => {
    const { pick, onChange } = build('default');
    (pick.el.querySelector('.bz-cardpick-card') as HTMLElement).click();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('setValue 程序化切换选中态（不触发回调）', () => {
    const { pick, onChange } = build('default');
    pick.setValue('editorial');
    const cards = pick.el.querySelectorAll('.bz-cardpick-card');
    expect(cards[2].classList.contains('is-on')).toBe(true);
    expect(cards[0].classList.contains('is-on')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});
