/**
 * bz 组件库测试（src/core/ui/）：uiBtn/uiIconBtn/uiBtnRow/uiChip/
 * uiField/uiInput/uiEmpty/uiSegmented/uiDialogActions/uiIcon/lightbox——
 * jsdom 环境断言 DOM 结构、类名、事件行为（样式库规格由 CSS 保证，
 * 此处测工厂产出的结构/类/交互）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  uiBtn, uiIcon, uiIconBtn, uiBtnRow, uiChip, uiField, uiInput,
  uiEmpty, uiSegmented, uiDialogActions, uiRange,
} from '../../src/core/ui';
import { openLightbox, closeLightbox } from '../../src/core/ui';
import { uiModal } from '../../src/core/ui';

describe('bz ui 组件库', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('uiBtn 按钮', () => {
    it('默认：bz-btn + 文字', () => {
      const b = uiBtn({ label: '保存' });
      expect(b.tagName).toBe('BUTTON');
      expect(b.classList.contains('bz-btn')).toBe(true);
      expect(b.textContent).toBe('保存');
      expect(b.type).toBe('button');
    });

    it('tone/size/icon/title/disabled 正确映射类与属性', () => {
      const b = uiBtn({ label: '删', tone: 'danger', size: 'sm', icon: 'trash-2', title: '删除', disabled: true });
      expect(b.classList.contains('bz-btn--danger')).toBe(true);
      expect(b.classList.contains('bz-btn--sm')).toBe(true);
      expect(b.title).toBe('删除');
      expect(b.disabled).toBe(true);
      const ic = b.querySelector('.bz-ic');
      expect(ic).not.toBeNull();
      expect(ic!.getAttribute('data-icon')).toBe('trash-2');
      expect(ic!.classList.contains('bz-ic')).toBe(true);
    });

    it('click 触发 onClick', () => {
      const fn = vi.fn();
      const b = uiBtn({ label: '点', onClick: fn });
      b.click();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('primary 默认 tone 不带后缀', () => {
      const b = uiBtn({ label: 'x', tone: 'primary' });
      expect(b.classList.contains('bz-btn--primary')).toBe(true);
    });
  });

  describe('uiIconBtn 图标按钮', () => {
    it('基础：bz-icon-btn + 图标', () => {
      const b = uiIconBtn({ icon: 'settings', title: '设置' });
      expect(b.classList.contains('bz-icon-btn')).toBe(true);
      expect(b.querySelector('.bz-ic[data-icon="settings"]')).not.toBeNull();
      expect(b.title).toBe('设置');
    });
    it('on/lg/close/danger 修饰类', () => {
      const b = uiIconBtn({ icon: 'x', close: true, on: true, danger: true });
      expect(b.classList.contains('bz-icon-btn--close')).toBe(true);
      expect(b.classList.contains('bz-icon-btn--on')).toBe(true);
      expect(b.hasAttribute('data-danger')).toBe(true);
    });
    it('click 触发', () => {
      const fn = vi.fn();
      uiIconBtn({ icon: 'x', onClick: fn }).click();
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('uiBtnRow / uiDialogActions', () => {
    it('按钮行：flex 容器装按钮 + center 修饰', () => {
      const row = uiBtnRow([uiBtn({ label: 'a' }), uiBtn({ label: 'b' })], { center: true });
      expect(row.classList.contains('bz-btn-row')).toBe(true);
      expect(row.classList.contains('bz-btn-row--center')).toBe(true);
      expect(row.querySelectorAll('.bz-btn')).toHaveLength(2);
    });
    it('对话框主/次对：取消+主按钮', () => {
      const ok = vi.fn(), cancel = vi.fn();
      const { row, okBtn, cancelBtn } = uiDialogActions({ okText: '保存', onOk: ok, onCancel: cancel });
      expect(row.querySelectorAll('.bz-btn')).toHaveLength(2);
      expect(okBtn.classList.contains('bz-btn--primary')).toBe(true);
      okBtn.click();
      expect(ok).toHaveBeenCalled();
      cancelBtn.click();
      expect(cancel).toHaveBeenCalled();
    });
  });

  describe('uiChip', () => {
    it('基础标签：文字', () => {
      const c = uiChip({ label: '日记' });
      expect(c.classList.contains('bz-chip')).toBe(true);
      expect(c.textContent).toContain('日记');
    });
    it('selected → --on；count 徽标', () => {
      const c = uiChip({ label: '日记', selected: true, count: 12 });
      expect(c.classList.contains('bz-chip--on')).toBe(true);
      expect(c.querySelector('.bz-chip-cnt')!.textContent).toBe('12');
    });
    it('removable → 内嵌 ✕，点击 onRemove 且不冒泡触发 onClick', () => {
      const rm = vi.fn(), clk = vi.fn();
      const c = uiChip({ label: '小说', removable: true, onRemove: rm, onClick: clk });
      expect(c.classList.contains('bz-chip--sel')).toBe(true);
      const x = c.querySelector('.bz-chip-x');
      expect(x).not.toBeNull();
      x!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(rm).toHaveBeenCalledTimes(1);
      expect(clk).not.toHaveBeenCalled();
    });
    it('locked 禁止点击（--locked + 无 onClick）', () => {
      const c = uiChip({ label: '加密', locked: true });
      expect(c.classList.contains('bz-chip--locked')).toBe(true);
    });
  });

  describe('uiField / uiInput', () => {
    it('label + 控件 + desc', () => {
      const input = uiInput({ placeholder: '平台名' });
      const f = uiField({ label: '平台', desc: '选填', control: input });
      expect(f.querySelector('.bz-field-label')!.textContent).toBe('平台');
      expect(f.querySelector('.bz-field-desc')!.textContent).toBe('选填');
      expect(f.querySelector('input.bz-input')).not.toBeNull();
    });
    it('error → 控件加错误类 + 错误文字', () => {
      const input = uiInput({ placeholder: 'x' });
      uiField({ label: '密码', error: '不能为空', control: input });
      expect(input.classList.contains('bz-input--error')).toBe(true);
    });
    it('onInput 回传值', () => {
      const fn = vi.fn();
      const inp = uiInput({ onInput: fn });
      inp.value = 'abc';
      inp.dispatchEvent(new Event('input'));
      expect(fn).toHaveBeenCalledWith('abc');
    });
  });

  describe('uiEmpty', () => {
    it('标题 + 图标 + CTA 按钮行', () => {
      const btn = uiBtn({ label: '去添加', tone: 'primary' });
      const e = uiEmpty({ icon: 'inbox', title: '这里还没有日记', desc: '写几句', actions: uiBtnRow([btn]) });
      expect(e.classList.contains('bz-empty')).toBe(true);
      expect(e.querySelector('.bz-empty-title')!.textContent).toContain('还没有日记');
      expect(e.querySelector('.bz-ic[data-icon="inbox"]')).not.toBeNull();
      expect(e.querySelector('.bz-btn--primary')!.textContent).toContain('去添加');
    });
  });

  describe('uiSegmented', () => {
    it('渲染选项 + 当前选中 is-on', () => {
      const { el } = uiSegmented({
        options: [{ value: 'a', label: '全部' }, { value: 'b', label: '日记' }],
        value: 'b',
        onChange: () => {},
      });
      const btns = el.querySelectorAll('.bz-segmented-btn');
      expect(btns).toHaveLength(2);
      expect(btns[1].classList.contains('is-on')).toBe(true);
      expect(btns[0].classList.contains('is-on')).toBe(false);
    });
    it('点击切换选中 + onChange', () => {
      const fn = vi.fn();
      const { el } = uiSegmented({
        options: [{ value: 'a', label: '全部' }, { value: 'b', label: '日记' }],
        value: 'a',
        onChange: fn,
      });
      const btns = el.querySelectorAll('.bz-segmented-btn');
      (btns[1] as HTMLButtonElement).click();
      expect(fn).toHaveBeenCalledWith('b');
      expect(btns[1].classList.contains('is-on')).toBe(true);
      expect(btns[0].classList.contains('is-on')).toBe(false);
    });
  });

  describe('uiIcon', () => {
    it('生成 setIcon 容器（span.bz-ic + dataset.icon）', () => {
      const i = uiIcon('star', 'bz-ic--star');
      expect(i.tagName).toBe('SPAN');
      expect(i.classList.contains('bz-ic')).toBe(true);
      expect(i.classList.contains('bz-ic--star')).toBe(true);
      expect(i.getAttribute('data-icon')).toBe('star');
    });
  });

  describe('uiRange 滑条', () => {
    it('生成 .bz-range + 属性 + onChange 事件', () => {
      const fn = vi.fn();
      const r = uiRange({ min: 1, max: 10, step: 0.1, value: 5, onChange: fn });
      expect(r.type).toBe('range');
      expect(r.classList.contains('bz-range')).toBe(true);
      expect(r.min).toBe('1');
      expect(r.max).toBe('10');
      expect(r.step).toBe('0.1');
      expect(r.value).toBe('5');
      r.value = '7.5';
      r.dispatchEvent(new Event('change'));
      expect(fn).toHaveBeenCalledWith(7.5);
    });
    it('className 附加 + disabled', () => {
      const r = uiRange({ className: 'bz-range--lg', disabled: true });
      expect(r.classList.contains('bz-range--lg')).toBe(true);
      expect(r.disabled).toBe(true);
    });
    it('onInput 实时回调', () => {
      const fn = vi.fn();
      const r = uiRange({ onInput: fn });
      r.value = '3';
      r.dispatchEvent(new Event('input'));
      expect(fn).toHaveBeenCalledWith(3);
    });
  });

  describe('uiModal 居中模态', () => {
    it('openModal 渲染遮罩+弹窗+内容；点遮罩关闭', () => {
      const onClose = vi.fn();
      const { mask, popup } = uiModal({ content: '<div class="x">内容</div>', onClose });
      expect(document.querySelector('.bz-overlay-mask')).not.toBeNull();
      expect(popup.classList.contains('bz-overlay-popup')).toBe(true);
      expect(popup.querySelector('.x')!.textContent).toBe('内容');
      mask.click();
      expect(document.querySelector('.bz-overlay-mask')).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('head 模式：标题 + ✕ 关闭钮', () => {
      const { popup } = uiModal({ content: 'hi', head: true, title: '标题' });
      expect(popup.querySelector('.bz-dialog-title')!.textContent).toBe('标题');
      const x = popup.querySelector('.bz-icon-btn') as HTMLButtonElement;
      expect(x).not.toBeNull();
      x.click();
      expect(document.querySelector('.bz-overlay-mask')).toBeNull();
    });
    it('ESC 关闭（escManager）', () => {
      uiModal({ content: 'hi' });
      expect(document.querySelector('.bz-overlay-mask')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.querySelector('.bz-overlay-mask')).toBeNull();
    });
    it('maxWidth 内联到弹窗', () => {
      const { popup } = uiModal({ content: 'hi', maxWidth: 520 });
      expect(popup.style.maxWidth).toContain('520');
    });
  });

  describe('lightbox', () => {
    it('openLightbox 渲染遮罩+媒体+关闭', () => {
      openLightbox({ src: 'x.png', title: '图' });
      expect(document.querySelector('.bz-lightbox')).not.toBeNull();
      expect(document.querySelector('.bz-lightbox img')).not.toBeNull();
      expect(document.querySelector('.bz-lightbox-title')!.textContent).toBe('图');
      closeLightbox();
      expect(document.querySelector('.bz-lightbox')).toBeNull();
    });
    it('关闭按钮点击关闭', () => {
      openLightbox({ src: 'x.png' });
      const btn = document.querySelector('.bz-lightbox-close') as HTMLButtonElement;
      btn.click();
      expect(document.querySelector('.bz-lightbox')).toBeNull();
    });
    it('Esc 键关闭', () => {
      openLightbox({ src: 'x.png' });
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.querySelector('.bz-lightbox')).toBeNull();
    });
    it('video 类型渲染 video[controls]', () => {
      openLightbox({ src: 'a.mp4', type: 'video' });
      const v = document.querySelector('.bz-lightbox video');
      expect(v).not.toBeNull();
      expect(v!.getAttribute('controls')).not.toBeNull();
      closeLightbox();
    });
  });
});
