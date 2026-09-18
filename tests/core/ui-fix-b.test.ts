/**
 * core 组件库修复批 B 回归（review-deep core-ui R2/R4/R5/R10/R11 + core-efficiency 12）：
 * - R2 触控热区修饰类自带热区（--sm/--lg/--xl 可脱离基类独立使用，死类用法全站复活）；
 * - R4 .bz-field 基类补 position:relative（手册「anchor 须在 relative 容器内」自洽）；
 * - R5 uiSelect/uiPopover 菜单下方剩余空间不足时向上翻（弹窗壳 overflow 剪裁不再吃菜单）；
 * - R10 uiResizable/uiVSplitter document 级监听宿主离场自摘（C12 同款自愈）；
 * - R11 uiStat 可点统计卡键盘可达（role=button + Enter/Space）；
 * - 效率12 uiSuggest 无 is-on 高亮项时放行 Enter（不吞表单提交）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { uiSelect } from '../../src/core/ui/select';
import { uiPopover } from '../../src/core/ui/popover';
import { uiResizable } from '../../src/core/ui/resize';
import { uiVSplitter } from '../../src/core/ui/splitter';
import { uiStat } from '../../src/core/ui/stat';
import { uiSuggest } from '../../src/core/ui/suggest';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const css = () => readFileSync(join(process.cwd(), 'src/core/ui/components.css'), 'utf8');

function makeRect(over: Partial<DOMRect>): DOMRect {
  const base = { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0 };
  const r = { ...base, ...over } as DOMRect;
  r.toJSON = () => r;
  return r;
}

describe('样式回归（R2 触控热区修饰类自带热区 / R4 .bz-field relative）', () => {
  it('R2：--sm/--lg/--xl 修饰类各自生成 ::after 热区（不挂基类也生效）', () => {
    const c = css();
    for (const mod of ['sm', 'lg', 'xl']) {
      expect(c).toContain(`.bz-touch-target--${mod}::after`);
      expect(c).toContain(`.bz-touch-target--${mod} { --bz-touch-outset:`);
    }
    // 修饰类进 position:relative 选择器列表（\s 容忍 CRLF；基类独立规则保留兼容）
    expect(c).toMatch(/\.bz-touch-target--sm,\s*\.bz-touch-target--lg,\s*\.bz-touch-target--xl \{ position: relative; \}/);
  });

  it('R4：.bz-field 基类补 position:relative（浮层锚定不再依赖域 CSS 自补）', () => {
    expect(css()).toMatch(/\.bz-field \{[^}]*position: relative/);
  });
});

describe('R5：uiSelect 菜单下方空间不足向上翻', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).innerHeight;
    document.body.innerHTML = '';
  });

  function spyRects(menuRect: DOMRect) {
    return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('bz-select-menu') || this.classList.contains('bz-popover')) return menuRect;
      return makeRect({ top: 0, bottom: 40, height: 40, left: 0, right: 200, width: 200 });
    });
  }

  it('下方剩余空间不足且上方更宽裕 → 菜单挂 is-flip-up（bottom 定位向上翻）', () => {
    spyRects(makeRect({ top: 60, bottom: 200, height: 140, left: 0, right: 200, width: 200 }));
    Object.defineProperty(window, 'innerHeight', { value: 240, configurable: true });
    const comp = uiSelect({ value: 'a', options: [{ value: 'a', label: 'A' }], onChange: () => {} });
    document.body.appendChild(comp.el);
    comp.el.click();
    const menu = document.querySelector('.bz-select-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.classList.contains('is-flip-up')).toBe(true);
  });

  it('下方空间充足 → 不翻转（默认向下展开）', () => {
    spyRects(makeRect({ top: 60, bottom: 200, height: 140, left: 0, right: 200, width: 200 }));
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
    const comp = uiSelect({ value: 'a', options: [{ value: 'a', label: 'A' }], onChange: () => {} });
    document.body.appendChild(comp.el);
    comp.el.click();
    const menu = document.querySelector('.bz-select-menu') as HTMLElement;
    expect(menu.classList.contains('is-flip-up')).toBe(false);
  });

  it('uiPopover 同款：下方不足向上翻', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('bz-popover')) return makeRect({ top: 500, bottom: 700, height: 200, left: 0, right: 200, width: 200 });
      return makeRect({ top: 400, bottom: 440, height: 40, left: 0, right: 200, width: 200 });
    });
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    const anchor = document.createElement('button');
    wrap.appendChild(anchor);
    document.body.appendChild(wrap);
    const pop = uiPopover({ anchor, options: [{ id: 'a', label: 'A' }], onPick: () => {} });
    pop.open();
    const layer = wrap.querySelector('.bz-popover') as HTMLElement;
    expect(layer).not.toBeNull();
    expect(layer.classList.contains('is-flip-up')).toBe(true);
    pop.close();
  });
});

describe('R10：document 级拖拽监听宿主离场自摘（C12 同款）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false }), configurable: true, writable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).innerHeight;
    document.body.innerHTML = '';
  });

  it('uiResizable：el 离场后下一次 document mousemove 自摘监听', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const h = uiResizable(el);
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    el.remove();
    document.dispatchEvent(new MouseEvent('mousemove'));
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    h.detach(); // 幂等收尾不抛错
  });

  it('uiVSplitter：左栏离场后下一次 document mousemove 自摘监听', () => {
    const left = document.createElement('div');
    const right = document.createElement('div');
    const host = document.createElement('div');
    host.append(left, right);
    document.body.appendChild(host);
    const split = uiVSplitter({ left, right });
    host.appendChild(split.el);
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    host.remove();
    document.dispatchEvent(new MouseEvent('mousemove'));
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    split.detach();
  });
});

describe('R11：uiStat 可点统计卡键盘可达', () => {
  it('有 onClick：role=button + tabIndex + Enter/Space 复用回调；无 onClick 不挂键盘语义', () => {
    const onClick = vi.fn();
    const clickable = uiStat({ num: 3, label: '待办', onClick });
    expect(clickable.getAttribute('role')).toBe('button');
    expect(clickable.tabIndex).toBe(0);
    clickable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    clickable.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(2);
    const plain = uiStat({ num: 1, label: '静态' });
    expect(plain.getAttribute('role')).toBeNull();
    expect(plain.getAttribute('tabindex')).toBeNull(); // 未显式挂焦点属性（div.tabIndex 默认值恒 0，不可断言数值）
  });
});

describe('效率12：uiSuggest 无 is-on 高亮项时放行 Enter', () => {
  function build(source: () => string[]) {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    const input = document.createElement('input');
    wrap.appendChild(input);
    document.body.appendChild(wrap);
    const sug = uiSuggest({ anchor: input, source });
    return { wrap, input, sug };
  }

  it('层开着但无高亮项：Enter 不 preventDefault、不 pick（交还表单提交）', () => {
    const { input, sug } = build(() => ['甲甲', '乙乙']);
    input.dispatchEvent(new Event('focus')); // 开层（现值空 → 无 is-on）
    expect(document.querySelector('.bz-popover')).not.toBeNull();
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false); // 放行
    expect(input.value).toBe(''); // 未 pick
    sug.close();
  });

  it('有高亮项：Enter 照旧 pick + preventDefault（原行为不变）', () => {
    const { input, sug } = build(() => ['甲甲']);
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // 出现 is-on
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(input.value).toBe('甲甲');
    sug.close();
  });
});
