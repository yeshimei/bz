/**
 * bz 组件库测试（src/core/ui/）：uiBtn/uiIconBtn/uiBtnRow/uiChip/
 * uiField/uiInput/uiEmpty/uiSegmented/uiDialogActions/uiIcon/lightbox——
 * jsdom 环境断言 DOM 结构、类名、事件行为（样式库规格由 CSS 保证，
 * 此处测工厂产出的结构/类/交互）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  uiBtn, uiIcon, uiIconBtn, uiBtnRow, uiChip, uiField, uiInput,
  uiEmpty, uiSegmented, uiChoice, uiDialogActions, uiRange, uiSwitch, uiSelect,
} from '../../src/core/ui';
import { openLightbox, closeLightbox } from '../../src/core/ui';
import { uiModal } from '../../src/core/ui';
import { uiResizable } from '../../src/core/ui';

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
    it('removable → 内嵌 ✕，点击 onRemove 且不冒泡触发 onClick（removable 不暗示选中态）', () => {
      const rm = vi.fn(), clk = vi.fn();
      const c = uiChip({ label: '小说', removable: true, onRemove: rm, onClick: clk });
      expect(c.classList.contains('bz-chip--sel')).toBe(false); // L3：可删 ≠ 选中
      const x = c.querySelector('.bz-chip-x');
      expect(x).not.toBeNull();
      expect(x!.getAttribute('role')).toBe('button'); // L11：span[role=button]，非嵌套 button
      x!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(rm).toHaveBeenCalledTimes(1);
      expect(clk).not.toHaveBeenCalled();
    });
    it('selectedSoft → 软底选中态 --sel', () => {
      const c = uiChip({ label: '路径', selectedSoft: true, removable: true });
      expect(c.classList.contains('bz-chip--sel')).toBe(true);
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

  describe('uiChoice 平铺单选组', () => {
    it('渲染选项 + 当前选中 is-on + data-value', () => {
      const { el } = uiChoice({
        options: [{ value: '电影', label: '电影' }, { value: '剧集', label: '剧集' }],
        value: '剧集',
        onChange: () => {},
      });
      const btns = el.querySelectorAll('.bz-choice-btn');
      expect(btns).toHaveLength(2);
      expect(el.classList.contains('bz-choice')).toBe(true);
      expect(btns[1].classList.contains('is-on')).toBe(true);
      expect(btns[0].classList.contains('is-on')).toBe(false);
      expect((btns[0] as HTMLButtonElement).dataset.value).toBe('电影');
    });
    it('点击切换选中 + onChange 回传值', () => {
      const fn = vi.fn();
      const { el } = uiChoice({
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        value: 'a',
        onChange: fn,
      });
      const btns = el.querySelectorAll('.bz-choice-btn');
      (btns[1] as HTMLButtonElement).click();
      expect(fn).toHaveBeenCalledWith('b');
      expect(btns[1].classList.contains('is-on')).toBe(true);
      expect(btns[0].classList.contains('is-on')).toBe(false);
    });
    it('dot 前置色点 + setValue 句柄', () => {
      const { el, setValue } = uiChoice({
        options: [{ value: 'a', label: 'A', dot: '#e6951d' }, { value: 'b', label: 'B' }],
        value: 'a',
        onChange: () => {},
      });
      const dot = el.querySelector('.bz-choice-dot') as HTMLElement;
      expect(dot).not.toBeNull();
      expect(dot.style.backgroundColor).toBe('rgb(230, 149, 29)');
      setValue('b');
      expect(el.querySelectorAll('.is-on')).toHaveLength(1);
      expect((el.querySelector('.bz-choice-btn.is-on') as HTMLElement).dataset.value).toBe('b');
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

  describe('uiSwitch 开关', () => {
    it('结构：bz-sw + role=switch + aria-checked，checked 初始 on', () => {
      const { el } = uiSwitch({ checked: true });
      expect(el.classList.contains('bz-sw')).toBe(true);
      expect(el.classList.contains('on')).toBe(true);
      expect(el.getAttribute('role')).toBe('switch');
      expect(el.getAttribute('aria-checked')).toBe('true');
    });
    it('点击切换 on 态并回调（默认关）', () => {
      const fn = vi.fn();
      const { el } = uiSwitch({ onChange: fn });
      expect(el.classList.contains('on')).toBe(false);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(el.classList.contains('on')).toBe(true);
      expect(el.getAttribute('aria-checked')).toBe('true');
      expect(fn).toHaveBeenCalledWith(true);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(fn).toHaveBeenLastCalledWith(false);
    });
    it('Space/Enter 键盘开合', () => {
      const { el } = uiSwitch({});
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      expect(el.classList.contains('on')).toBe(true);
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(el.classList.contains('on')).toBe(false);
    });
    it('setChecked 句柄强制状态', () => {
      const { el, setChecked } = uiSwitch({});
      setChecked(true);
      expect(el.classList.contains('on')).toBe(true);
      expect(el.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('uiSelect 下拉', () => {
    const selOpts = [
      { value: 'a', label: '甲' },
      { value: 'b', label: '乙' },
      { value: 'c', label: '丙' },
    ];
    it('结构：bz-select + 当前值 + chevron 图标', () => {
      const { el } = uiSelect({ options: selOpts, value: 'b', onChange: () => {} });
      expect(el.classList.contains('bz-select')).toBe(true);
      expect(el.querySelector('.bz-select-val')!.textContent).toBe('乙');
      expect(el.querySelector('.bz-select-car')).not.toBeNull();
    });
    it('点击展开菜单（item 列表），再点关闭', () => {
      const { el } = uiSelect({ options: selOpts, value: 'a', onChange: () => {} });
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(el.classList.contains('open')).toBe(true);
      expect(el.querySelectorAll('.bz-select-item').length).toBe(3);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(el.querySelector('.bz-select-menu')).toBeNull();
    });
    it('选中项回调 + 更新显示值 + 菜单关闭 + is-on 跟随', () => {
      const fn = vi.fn();
      const { el } = uiSelect({ options: selOpts, value: 'a', onChange: fn });
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const items = el.querySelectorAll('.bz-select-item');
      expect(items[0].classList.contains('is-on')).toBe(true);
      (items[1] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(fn).toHaveBeenCalledWith('b');
      expect(el.querySelector('.bz-select-val')!.textContent).toBe('乙');
      expect(el.querySelector('.bz-select-menu')).toBeNull();
      expect(el.classList.contains('open')).toBe(false);
    });
    it('外部点击关闭菜单', () => {
      const { el } = uiSelect({ options: selOpts, value: 'a', onChange: () => {} });
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(el.querySelector('.bz-select-menu')).not.toBeNull();
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(el.querySelector('.bz-select-menu')).toBeNull();
    });
    it('onOpenChange 开合回调', () => {
      const fn = vi.fn();
      const { el } = uiSelect({ options: selOpts, value: 'a', onChange: () => {}, onOpenChange: fn });
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(fn).toHaveBeenLastCalledWith(true);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(fn).toHaveBeenLastCalledWith(false);
    });
    it('未匹配值显示 placeholder', () => {
      const { el } = uiSelect({ options: selOpts, value: 'z', placeholder: '请选择', onChange: () => {} });
      expect(el.querySelector('.bz-select-val')!.textContent).toBe('请选择');
    });
  });

  describe('uiResizable 边缘拖动缩放', () => {
    // jsdom 无几何布局：mock getBoundingClientRect 动态读 style（拖拽改 style 后即反映）
    function makeBox(w = 720, h = 580): { el: HTMLElement } {
      const el = document.createElement('div');
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      document.body.appendChild(el);
      el.getBoundingClientRect = () => {
        const rw = parseInt(el.style.width) || w;
        const rh = parseInt(el.style.height) || h;
        return {
          left: 0, top: 0, right: rw, bottom: rh, x: 0, y: 0,
          width: rw, height: rh, toJSON: () => ({}),
        } as DOMRect;
      };
      return { el };
    }
    function fire(el: Element | Document, type: string, x: number, y: number) {
      el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
    }

    it('hover 右缘/底缘/右下角分别给 ew/ns/nwse 光标；内部区不给', () => {
      const { el } = makeBox();
      const det = uiResizable(el, {});
      fire(el, 'mousemove', 719, 300); // 右缘 8px 内
      expect(el.style.cursor).toBe('ew-resize');
      fire(el, 'mousemove', 360, 579); // 底缘
      expect(el.style.cursor).toBe('ns-resize');
      fire(el, 'mousemove', 719, 579); // 右下角
      expect(el.style.cursor).toBe('nwse-resize');
      fire(el, 'mousemove', 300, 300); // 内部
      expect(el.style.cursor).toBe('');
      det.detach();
    });

    it('拖右缘放大并钳制到 min/max；onChange 收到钳制后尺寸', () => {
      // 大视口：92% > 硬上限 1280，硬上限生效
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(2000);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1500);
      const { el } = makeBox(720, 580);
      const onCh = vi.fn();
      const det = uiResizable(el, { minW: 720, minH: 520, maxW: 1280, maxH: 880, onChange: onCh });
      fire(el, 'mousedown', 719, 300); // 右缘按下（右缘在 720，内偏 1px）
      fire(document, 'mousemove', 900, 300); // 拖到 900 → 宽 901（保持 1px 内偏）
      fire(document, 'mousemove', 2000, 300); // 超出硬上限 → 钳制 1280
      fire(document, 'mouseup', 2000, 300);
      expect(el.style.width).toBe('1280px');
      expect(el.style.height).toBe('580px'); // 纯右缘不动高
      expect(onCh).toHaveBeenLastCalledWith(1280, 580);
      fire(el, 'mousedown', 1279, 300);
      fire(document, 'mousemove', 100, 300); // 左拖 → 缩到 minW
      fire(document, 'mouseup', 100, 300);
      expect(el.style.width).toBe('720px');
      det.detach();
      vi.restoreAllMocks();
    });

    it('拖右下角同变宽高；下限钳制', () => {
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(2000);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1500);
      const { el } = makeBox(720, 580);
      const onCh = vi.fn();
      const det = uiResizable(el, { minW: 720, minH: 520, maxW: 1280, maxH: 880, onChange: onCh });
      fire(el, 'mousedown', 719, 579); // 右下角内侧 1px 按下（右缘在 720，底缘在 580）
      fire(document, 'mousemove', 900, 700);
      fire(document, 'mouseup', 900, 700);
      // 右缘/底缘跟随鼠标并保持按下点的 1px 内偏 → 901×701
      expect(el.style.width).toBe('901px');
      expect(el.style.height).toBe('701px');
      expect(onCh).toHaveBeenLastCalledWith(901, 701);
      fire(el, 'mousedown', 899, 699); // 从新边缘内侧按下
      fire(document, 'mousemove', 100, 100);
      fire(document, 'mouseup', 100, 100);
      expect(el.style.width).toBe('720px');
      expect(el.style.height).toBe('520px');
      det.detach();
      vi.restoreAllMocks();
    });

    it('视口 92% 上限：窗口窄时以视口为限', () => {
      const { el } = makeBox(720, 580);
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(700);
      const det = uiResizable(el, { minW: 720, minH: 520, maxW: 1280, maxH: 880 });
      fire(el, 'mousedown', 719, 579);
      fire(document, 'mousemove', 5000, 5000); // 远超硬上限，视口 92% = 920×644
      fire(document, 'mouseup', 5000, 5000);
      expect(el.style.width).toBe('920px');
      expect(el.style.height).toBe('644px');
      det.detach();
      vi.restoreAllMocks();
    });

    it('热区外 mousedown 不启动拖拽（内容区点击不受影响）', () => {
      const { el } = makeBox();
      const onCh = vi.fn();
      const det = uiResizable(el, { onChange: onCh });
      fire(el, 'mousedown', 300, 300); // 内部
      fire(document, 'mousemove', 900, 900);
      fire(document, 'mouseup', 900, 900);
      expect(el.style.width).toBe('720px');
      expect(onCh).not.toHaveBeenCalled();
      det.detach();
    });

    it('detach 后不再响应拖拽/光标', () => {
      const { el } = makeBox();
      const det = uiResizable(el, {});
      det.detach();
      fire(el, 'mousemove', 719, 300);
      expect(el.style.cursor).toBe('');
      fire(el, 'mousedown', 719, 300);
      fire(document, 'mousemove', 900, 300);
      fire(document, 'mouseup', 900, 300);
      expect(el.style.width).toBe('720px');
    });
  });
});
