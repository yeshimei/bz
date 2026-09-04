/**
 * bz 组件库测试（src/core/ui/）：uiBtn/uiIconBtn/uiBtnRow/uiChip/
 * uiField/uiInput/uiEmpty/uiSegmented/uiDialogActions/uiIcon/lightbox——
 * jsdom 环境断言 DOM 结构、类名、事件行为（样式库规格由 CSS 保证，
 * 此处测工厂产出的结构/类/交互）。
 * 扩充批次（ADR-0094）：uiIconSpan/mountIcons/uiSearch/uiMainHead/
 * uiRail/uiMobStrip/uiStat/uiProgress/uiPopover + uiResizable.persist。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  uiBtn, uiIcon, uiIconBtn, uiBtnRow, uiChip, uiField, uiInput,
  uiEmpty, uiSegmented, uiChoice, uiDialogActions, uiRange, uiSwitch, uiSelect,
  uiIconSpan, mountIcons, uiSearch, uiMainHead, uiRail, uiMobStrip,
  uiStat, uiProgress, uiPopover,
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
    it('宽度兜底：选项文本溢出时撑开 minWidth，无溢出则不写（宿主钳宽时保选项完整）', () => {
      // jsdom 无布局：只 mock scrollWidth（clientWidth 走真实 0），
      // 断言行为不变量——溢出即撑开为正值，无溢出不写；具体像素由 headless 几何实测背书
      const proto = HTMLElement.prototype as unknown as Record<string, PropertyDescriptor>;
      const orig = Object.getOwnPropertyDescriptor(proto, 'scrollWidth');
      Object.defineProperty(proto, 'scrollWidth', { value: 139, configurable: true });
      try {
        const { el } = uiSelect({ options: selOpts, value: 'a', onChange: () => {} });
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const menu = el.querySelector('.bz-select-menu') as HTMLElement;
        expect(parseFloat(menu.style.minWidth)).toBeGreaterThan(0);
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        // 文本无溢出（scrollWidth 0 ≤ clientWidth）时不写 minWidth
        Object.defineProperty(proto, 'scrollWidth', { value: 0, configurable: true });
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const menu2 = el.querySelector('.bz-select-menu') as HTMLElement;
        expect(menu2.style.minWidth).toBe('');
      } finally {
        if (orig) Object.defineProperty(proto, 'scrollWidth', orig); else delete (proto as any).scrollWidth;
      }
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

  describe('uiIconSpan / mountIcons 图标挂载', () => {
    it('uiIconSpan：span.bz-ic + setIcon 记录 data-icon + 附加类', () => {
      const i = uiIconSpan('search', 'bz-ic--sm');
      expect(i.tagName).toBe('SPAN');
      expect(i.classList.contains('bz-ic')).toBe(true);
      expect(i.classList.contains('bz-ic--sm')).toBe(true);
      expect(i.getAttribute('data-icon')).toBe('search');
    });

    it('mountIcons：[data-lucide] 占位替换为 setIcon 渲染元素，class 保留', () => {
      const wrap = document.createElement('div');
      wrap.innerHTML = '<i data-lucide="inbox" class="bz-ic"></i><i data-lucide="star" class="bz-ic bz-x"></i>';
      mountIcons(wrap);
      // 占位清零（替换后的元素只带 data-icon，不再带 data-lucide）
      expect(wrap.querySelectorAll('[data-lucide]')).toHaveLength(0);
      expect(wrap.querySelector('.bz-ic[data-icon="inbox"]')).not.toBeNull();
      const starred = wrap.querySelector('[data-icon="star"]') as HTMLElement;
      expect(starred).not.toBeNull();
      expect(starred.classList.contains('bz-x')).toBe(true); // class 修饰原样保留
      expect(starred.classList.contains('bz-ic')).toBe(true);
    });

    it('mountIcons：无类占位回落 bz-ic；空名占位跳过', () => {
      const wrap = document.createElement('div');
      wrap.innerHTML = '<span data-lucide="check"></span><i data-lucide=""></i>';
      mountIcons(wrap);
      expect(wrap.querySelector('[data-icon="check"]')!.classList.contains('bz-ic')).toBe(true);
      expect(wrap.querySelectorAll('[data-lucide]')).toHaveLength(1); // 空名占位原样保留
    });
  });

  describe('uiSearch 搜索框', () => {
    it('结构：bz-search + 前缀 search 图标 + input.bz-input', () => {
      const { el, input } = uiSearch({ placeholder: '搜索', value: '初值' });
      expect(el.classList.contains('bz-search')).toBe(true);
      expect(el.querySelector('.bz-ic[data-icon="search"]')).not.toBeNull();
      expect(input.classList.contains('bz-input')).toBe(true);
      expect(input.placeholder).toBe('搜索');
      expect(input.value).toBe('初值');
    });
    it('onInput 实时回传输入值', () => {
      const fn = vi.fn();
      const { input } = uiSearch({ onInput: fn });
      input.value = 'abc';
      input.dispatchEvent(new Event('input'));
      expect(fn).toHaveBeenCalledWith('abc');
    });
    it('setValue 程序化置值（不触发 onInput）', () => {
      const fn = vi.fn();
      const { input, setValue } = uiSearch({ onInput: fn });
      setValue('xyz');
      expect(input.value).toBe('xyz');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('uiMainHead 主头行', () => {
    it('结构：标题 + spacer；无 count 时计数位隐藏', () => {
      const { el } = uiMainHead({ title: '全部' });
      expect(el.classList.contains('bz-main-head')).toBe(true);
      expect(el.querySelector('.bz-main-title')!.textContent).toBe('全部');
      expect(el.querySelector('.bz-main-spacer')).not.toBeNull();
      const count = el.querySelector('.bz-main-count') as HTMLElement;
      expect(count.style.display).toBe('none');
    });
    it('有 count 显示计数；setTitle/setCount 更新', () => {
      const { el, setTitle, setCount } = uiMainHead({ title: '全部', count: '12 项' });
      const count = el.querySelector('.bz-main-count') as HTMLElement;
      expect(count.style.display).toBe('');
      expect(count.textContent).toBe('12 项');
      setTitle('重要');
      expect(el.querySelector('.bz-main-title')!.textContent).toBe('重要');
      setCount('');
      expect(count.style.display).toBe('none');
      setCount('3 项');
      expect(count.textContent).toBe('3 项');
    });
    it('action 渲染主按钮（bz-btn--primary + 30px 中档）并回调', () => {
      const fn = vi.fn();
      const { el } = uiMainHead({ title: '全部', action: { label: '新建', icon: 'plus', onClick: fn } });
      const btn = el.querySelector('button.bz-btn.bz-btn--primary.bz-btn--md') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('新建');
      expect(btn.querySelector('.bz-ic[data-icon="plus"]')).not.toBeNull();
      btn.click();
      expect(fn).toHaveBeenCalledTimes(1);
    });
    it('无 action 不渲染按钮', () => {
      const { el } = uiMainHead({ title: '全部' });
      expect(el.querySelector('button')).toBeNull();
    });
  });

  describe('uiRail 状态侧栏', () => {
    // 前两组 + 子列表 + foot 的固定样本
    function build(opts?: { onSelect?: (id: string) => void; foot?: HTMLElement }) {
      return uiRail({
        groups: [
          {
            label: '视图',
            items: [
              { id: 'all', name: '全部', icon: 'inbox', count: 12 },
              {
                id: 'src', name: '来源', dot: '#e6951d', count: 3, pill: true, unread: 5,
                children: [
                  { id: 's1', name: '子一', count: '1' },
                  { id: 's2', name: '子二' },
                ],
              },
            ],
          },
          {
            items: [
              { id: 'tag', name: 'GitHub', boxedIcon: 'github' },
              { id: 'b1', name: 'B站', badge: { t: 'B', label: 'B站来源', tint: '#fb7299' } },
            ],
          },
        ],
        activeId: 'all',
        onSelect: opts?.onSelect,
        foot: opts?.foot,
      });
    }

    it('结构：rail + scroll + 分组 label + 行数；初始 active 行 .on', () => {
      const { el } = build();
      expect(el.classList.contains('bz-rail')).toBe(true);
      expect(el.querySelector('.bz-rail-scroll')).not.toBeNull();
      expect(el.querySelectorAll('.bz-rail-label')).toHaveLength(1);
      expect(el.querySelector('.bz-rail-label')!.textContent).toBe('视图');
      const items = el.querySelectorAll('.bz-rail-item');
      expect(items).toHaveLength(6); // 3 叶 + 1 父 + 2 子
      expect(el.querySelector('[data-id="all"]')!.classList.contains('on')).toBe(true);
    });

    it('前缀槽：icon / boxedIcon / badge(tint) / dot(tint) 各归其位', () => {
      const { el } = build();
      const all = el.querySelector('[data-id="all"]')!;
      expect(all.querySelector('.bz-ic[data-icon="inbox"]')).not.toBeNull();
      const tag = el.querySelector('[data-id="tag"]')!;
      const box = tag.querySelector('.bz-rail-ic');
      expect(box).not.toBeNull();
      expect(box!.querySelector('[data-icon="github"]')).not.toBeNull();
      const b1 = el.querySelector('[data-id="b1"]')!;
      const badge = b1.querySelector('.bz-rail-badge') as HTMLElement;
      expect(badge.textContent).toBe('B');
      expect(badge.getAttribute('aria-label')).toBe('B站来源');
      expect(badge.style.getPropertyValue('--bz-rail-tint')).toBe('#fb7299');
      const src = el.querySelector('[data-id="src"]')!;
      expect((src.querySelector('.bz-rail-dot') as HTMLElement).style.getPropertyValue('--bz-rail-tint')).toBe('#e6951d');
    });

    it('计数两档 + 未读气泡 + 名称 textContent', () => {
      const { el } = build();
      const all = el.querySelector('[data-id="all"]')!;
      expect(all.querySelector('.bz-rail-count')!.textContent).toBe('12');
      expect(all.querySelector('.bz-rail-count--pill')).toBeNull();
      const src = el.querySelector('[data-id="src"]')!;
      expect(src.querySelector('.bz-rail-count--pill')!.textContent).toBe('3');
      expect(src.querySelector('.bz-rail-unread')!.textContent).toBe('5');
      expect(src.querySelector('.bz-rail-name')!.textContent).toBe('来源');
    });

    it('叶子点击：组内单选（.on 迁移）+ onSelect 回调', () => {
      const onSelect = vi.fn();
      const { el } = build({ onSelect });
      const all = el.querySelector('[data-id="all"]') as HTMLButtonElement;
      const tag = el.querySelector('[data-id="tag"]') as HTMLButtonElement;
      tag.click();
      expect(onSelect).toHaveBeenCalledWith('tag');
      expect(tag.classList.contains('on')).toBe(true);
      expect(all.classList.contains('on')).toBe(false);
    });

    it('setActive 程序化单选（不触发 onSelect）', () => {
      const onSelect = vi.fn();
      const { el, setActive } = build({ onSelect });
      setActive('b1');
      expect(el.querySelector('[data-id="b1"]')!.classList.contains('on')).toBe(true);
      expect(el.querySelectorAll('.bz-rail-item.on')).toHaveLength(1);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('子列表：父项 has-sub + caret；点父只展收不选；点子单选并回调', () => {
      const onSelect = vi.fn();
      const { el } = build({ onSelect });
      const parent = el.querySelector('[data-id="src"]') as HTMLButtonElement;
      expect(parent.classList.contains('has-sub')).toBe(true);
      expect(parent.querySelector('.bz-rail-caret')).not.toBeNull();
      const sub = parent.nextElementSibling as HTMLElement;
      expect(sub.classList.contains('bz-rail-sub')).toBe(true);
      expect(sub.classList.contains('open')).toBe(false);
      // 点父 = 展开收起，不触发 onSelect
      parent.click();
      expect(sub.classList.contains('open')).toBe(true);
      expect(parent.classList.contains('sub-open')).toBe(true);
      expect(onSelect).not.toHaveBeenCalled();
      parent.click();
      expect(sub.classList.contains('open')).toBe(false);
      expect(parent.classList.contains('sub-open')).toBe(false);
      // 点子 = 单选 + 回调
      const s1 = el.querySelector('[data-id="s1"]') as HTMLButtonElement;
      s1.click();
      expect(onSelect).toHaveBeenCalledWith('s1');
      expect(s1.classList.contains('on')).toBe(true);
      expect(el.querySelector('[data-id="all"]')!.classList.contains('on')).toBe(false);
    });

    it('foot 直挂 .bz-rail-foot', () => {
      const btn = uiBtn({ label: '设置' });
      const { el } = build({ foot: btn });
      const foot = el.querySelector('.bz-rail-foot');
      expect(foot).not.toBeNull();
      expect(foot!.contains(btn)).toBe(true);
    });
  });

  describe('uiMobStrip 移动横滑条', () => {
    it('结构：chips + 初始 is-on + dot 色点', () => {
      const { el } = uiMobStrip({
        items: [
          { id: 'a', label: '全部' },
          { id: 'b', label: '电影', dot: '#e6951d' },
        ],
        value: 'b',
        onChange: () => {},
      });
      expect(el.classList.contains('bz-mobstrip')).toBe(true);
      const chips = el.querySelectorAll('.bz-mobstrip-chip');
      expect(chips).toHaveLength(2);
      expect(chips[1].classList.contains('is-on')).toBe(true);
      expect(chips[1].textContent).toContain('电影');
      expect(chips[0].querySelector('.bz-mobstrip-dot')).toBeNull();
      expect((chips[1].querySelector('.bz-mobstrip-dot') as HTMLElement).style.getPropertyValue('--bz-rail-tint')).toBe('#e6951d');
    });
    it('点击切换 is-on + onChange；setValue 程序化不回调', () => {
      const fn = vi.fn();
      const { el, setValue } = uiMobStrip({
        items: [{ id: 'a', label: '全部' }, { id: 'b', label: '电影' }],
        value: 'a',
        onChange: fn,
      });
      const chips = el.querySelectorAll('.bz-mobstrip-chip');
      (chips[1] as HTMLElement).click();
      expect(fn).toHaveBeenCalledWith('b');
      expect(chips[1].classList.contains('is-on')).toBe(true);
      expect(chips[0].classList.contains('is-on')).toBe(false);
      setValue('a');
      expect(chips[0].classList.contains('is-on')).toBe(true);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('uiStat 统计卡', () => {
    it('默认结构：label（含图标）+ num；无 hint 不渲染', () => {
      const el = uiStat({ label: '在读', num: 7, icon: 'book-open' });
      expect(el.classList.contains('bz-stat')).toBe(true);
      expect(el.querySelector('.bz-stat-label')!.textContent).toContain('在读');
      expect(el.querySelector('.bz-stat-label .bz-ic[data-icon="book-open"]')).not.toBeNull();
      expect(el.querySelector('.bz-stat-num')!.textContent).toBe('7');
      expect(el.querySelector('.bz-stat-hint')).toBeNull();
    });
    it('hint + tone 语义档 + click 档与回调', () => {
      const fn = vi.fn();
      const el = uiStat({ label: '总资产', num: '¥1,234', hint: '在用 + 闲置', tone: 'main', click: true, onClick: fn });
      expect(el.classList.contains('bz-stat--main')).toBe(true);
      expect(el.classList.contains('bz-stat--click')).toBe(true);
      expect(el.querySelector('.bz-stat-hint')!.textContent).toBe('在用 + 闲置');
      expect(el.querySelector('.bz-stat-num')!.textContent).toBe('¥1,234');
      el.click();
      expect(fn).toHaveBeenCalledTimes(1);
    });
    it('tone 其余档类名映射', () => {
      expect(uiStat({ label: 'x', num: 1, tone: 'ok' }).classList.contains('bz-stat--ok')).toBe(true);
      expect(uiStat({ label: 'x', num: 1, tone: 'warn' }).classList.contains('bz-stat--warn')).toBe(true);
      expect(uiStat({ label: 'x', num: 1, tone: 'danger' }).classList.contains('bz-stat--danger')).toBe(true);
      expect(uiStat({ label: 'x', num: 1, tone: 'text' }).classList.contains('bz-stat--text')).toBe(true);
    });
  });

  describe('uiProgress 进度条', () => {
    it('结构：track + i 填充；初始 value 写宽度', () => {
      const { el, setValue } = uiProgress({ value: 40 });
      expect(el.classList.contains('bz-progress')).toBe(true);
      const fill = el.querySelector('i') as HTMLElement;
      expect(fill).not.toBeNull();
      expect(fill.style.width).toBe('40%');
      setValue(75);
      expect(fill.style.width).toBe('75%');
    });
    it('setValue 越界钳制 0-100', () => {
      const { el, setValue } = uiProgress({});
      setValue(150);
      expect((el.querySelector('i') as HTMLElement).style.width).toBe('100%');
      setValue(-5);
      expect((el.querySelector('i') as HTMLElement).style.width).toBe('0%');
      setValue(NaN);
      expect((el.querySelector('i') as HTMLElement).style.width).toBe('0%');
    });
    it('tone / thin 修饰类', () => {
      const { el } = uiProgress({ tone: 'ok', thin: true });
      expect(el.classList.contains('bz-progress--ok')).toBe(true);
      expect(el.classList.contains('bz-progress--thin')).toBe(true);
    });
  });

  describe('uiPopover 候选浮层', () => {
    const opts = [
      { id: 'a', label: '甲', icon: 'folder' },
      { id: 'b', label: '乙' },
      { id: 'c', label: '丙' },
    ];
    /** relative 容器 + 锚点（仿 input 在 .bz-search 壳内） */
    function build(pick?: (id: string) => void) {
      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      const anchor = document.createElement('button');
      anchor.type = 'button';
      wrap.appendChild(anchor);
      document.body.appendChild(wrap);
      const pop = uiPopover({ anchor, options: opts, value: 'a', onPick: pick, emptyText: '无候选' });
      return { wrap, anchor, pop };
    }

    it('open：浮层挂 anchor 父元素（relative 容器），行渲染 + is-on + 图标', () => {
      const { wrap, pop } = build();
      pop.open();
      const layer = wrap.querySelector('.bz-popover');
      expect(layer).not.toBeNull();
      const items = layer!.querySelectorAll('.bz-popover-item');
      expect(items).toHaveLength(3);
      expect(items[0].classList.contains('is-on')).toBe(true);
      expect(items[0].querySelector('.bz-ic[data-icon="folder"]')).not.toBeNull();
      expect(items[1].textContent).toContain('乙');
      pop.close();
      expect(wrap.querySelector('.bz-popover')).toBeNull();
    });

    it('anchor 点击开合', () => {
      const { wrap, anchor, pop } = build();
      anchor.click();
      expect(wrap.querySelector('.bz-popover')).not.toBeNull();
      anchor.click();
      expect(wrap.querySelector('.bz-popover')).toBeNull();
      // open/close 句柄同样可用
      pop.open();
      expect(wrap.querySelector('.bz-popover')).not.toBeNull();
      pop.close();
    });

    it('选项点击：onPick + 选中态更新 + 浮层关闭', () => {
      const pick = vi.fn();
      const { wrap, anchor, pop } = build(pick);
      pop.open();
      const items = wrap.querySelectorAll('.bz-popover-item');
      (items[2] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(pick).toHaveBeenCalledWith('c');
      expect(wrap.querySelector('.bz-popover')).toBeNull();
      // 再开：选中态跟随新值
      anchor.click();
      const on = wrap.querySelector('.bz-popover-item.is-on') as HTMLElement;
      expect(on.dataset.id).toBe('c');
    });

    it('外部点击 / Esc 关闭', () => {
      const { wrap, pop } = build();
      pop.open();
      expect(wrap.querySelector('.bz-popover')).not.toBeNull();
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(wrap.querySelector('.bz-popover')).toBeNull();
      pop.open();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(wrap.querySelector('.bz-popover')).toBeNull();
    });

    it('setValue 关着时只记值，开着时 is-on 跟随', () => {
      const { wrap, pop } = build();
      pop.setValue('b');
      pop.open();
      const on = wrap.querySelector('.bz-popover-item.is-on') as HTMLElement;
      expect(on.dataset.id).toBe('b');
      pop.setValue('c');
      expect(wrap.querySelector('.bz-popover-item.is-on')!.getAttribute('data-id')).toBe('c');
      expect(wrap.querySelectorAll('.bz-popover-item.is-on')).toHaveLength(1);
    });

    it('setOptions 原位重建（开着时）与替换（关着时）', () => {
      const { wrap, pop } = build();
      pop.open();
      pop.setOptions([{ id: 'x', label: '新' }]);
      const items = wrap.querySelectorAll('.bz-popover-item');
      expect(items).toHaveLength(1);
      expect(items[0].textContent).toContain('新');
      pop.close();
      pop.setOptions([{ id: 'y', label: '另' }, { id: 'z', label: '再' }]);
      pop.open();
      expect(wrap.querySelectorAll('.bz-popover-item')).toHaveLength(2);
    });

    it('空选项渲染空态文案', () => {
      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      const anchor = document.createElement('button');
      wrap.appendChild(anchor);
      document.body.appendChild(wrap);
      const pop = uiPopover({ anchor, options: [], emptyText: '无候选' });
      pop.open();
      expect(wrap.querySelector('.bz-popover-empty')!.textContent).toBe('无候选');
    });
  });

  describe('uiResizable persist 尺寸记忆（ADR-0094）', () => {
    // 同 uiResizable 基础组：jsdom 无几何布局，mock rect 动态读 style
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

    it('load 有值：挂载即恢复尺寸（钳到 min/max 口径）', () => {
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(2000);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1500);
      const { el } = makeBox(720, 580);
      const det = uiResizable(el, {
        minW: 720, minH: 520, maxW: 1280, maxH: 880,
        persist: { load: () => ({ w: 900, h: 600 }) },
      });
      expect(el.style.width).toBe('900px');
      expect(el.style.height).toBe('600px');
      det.detach();
      vi.restoreAllMocks();
    });

    it('load 越界值钳制（超大/过小都不越口径）', () => {
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(2000);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1500);
      const { el } = makeBox(720, 580);
      const det = uiResizable(el, {
        minW: 720, minH: 520, maxW: 1280, maxH: 880,
        persist: { load: () => ({ w: 5000, h: 100 }) },
      });
      expect(el.style.width).toBe('1280px');
      expect(el.style.height).toBe('520px');
      det.detach();
      vi.restoreAllMocks();
    });

    it('load null / 不传 persist：不写内联尺寸（向后兼容）', () => {
      const a = makeBox();
      const detA = uiResizable(a.el, { persist: { load: () => null } });
      expect(a.el.style.width).toBe('720px'); // 初始值未被改
      detA.detach();
      const b = makeBox();
      const detB = uiResizable(b.el, {});
      expect(b.el.style.width).toBe('720px');
      detB.detach();
    });

    it('拖拽后 save 防抖 300ms 落最后一次；期间不逐帧写', () => {
      vi.useFakeTimers();
      try {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(2000);
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1500);
        const { el } = makeBox(720, 580);
        const save = vi.fn();
        const det = uiResizable(el, { minW: 720, minH: 520, maxW: 1280, maxH: 880, persist: { save } });
        fire(el, 'mousedown', 719, 300);
        fire(document, 'mousemove', 800, 300);
        fire(document, 'mousemove', 900, 300);
        fire(document, 'mouseup', 900, 300);
        expect(save).not.toHaveBeenCalled(); // 防抖期内未落
        vi.advanceTimersByTime(300);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith(901, 580);
        det.detach();
      } finally {
        vi.useRealTimers();
        vi.restoreAllMocks();
      }
    });

    it('detach 时防抖未落的尾值立即 flush 防丢', () => {
      vi.useFakeTimers();
      try {
        const { el } = makeBox(720, 580);
        const save = vi.fn();
        const det = uiResizable(el, { minW: 720, minH: 520, persist: { save } });
        fire(el, 'mousedown', 719, 579);
        fire(document, 'mousemove', 800, 650);
        fire(document, 'mouseup', 800, 650);
        det.detach(); // 300ms 内 detach
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith(801, 651);
        vi.advanceTimersByTime(300);
        expect(save).toHaveBeenCalledTimes(1); // 不双写
      } finally {
        vi.useRealTimers();
        vi.restoreAllMocks();
      }
    });
  });
});
