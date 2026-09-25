/**
 * 设置面板渲染器行为内核契约测试（ARCH-1）：core（renderSettingsInto）与面板
 * （renderPanelSchema）两渲染器同协议（bindValue/SettingsRow）双实现——本文件钉死
 * 「面板行为 = core 行为」的口径恒等，防 core 历轮加固不传导的漂移复发：
 * - persist 兜底（N5 / C-1 / E-1）：落盘 reject 人话提示不裸奔，两渲染器提示文案同构；
 * - number 钳制（R9）：非空非法输入不写入 + 回显生效旧值（NaN→0 写入退役）；
 * - commit 点显隐联动（C-2）：值驱动 visibleWhen 的子行跟随；
 * - 列表行移除容错（F-3 / core C10）：onChange 抛错 → 提示 + refresh 照跑；
 * - 初始渲染 visibleWhen 容错（F-4 / core H6）：单行异常保守可见不放大成整域失败。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks, hasNotice, clearNotices } from './mock-obsidian-entry';
import { setSettingsProvider, setSettingsSaver } from '../src/core/settings-provider';
import { setApp } from '../src/core/app';
import { MockVault } from './mock-vault';
import { renderPanelSchema } from '../src/settings-panel/renderer';
import { renderSettingsInto } from '../src/core/settings-schema';
import type { SettingsSchema } from '../src/core/settings-schema';

const flush = () => new Promise((r) => setTimeout(r, 5));

describe('ARCH-1 双渲染器行为内核契约（panel = core）', () => {
  let state: Record<string, unknown>;
  let saver: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    state = {};
    saver = vi.fn(async () => {});
    setSettingsProvider(() => state as any);
    setSettingsSaver(saver);
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  /** 面板侧渲染 */
  const renderPanel = (schema: SettingsSchema) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    return { host, handle: renderPanelSchema(host, schema) };
  };

  it('C-1/E-1：persist reject → safePersist 人话提示，文案与 core 同构（what = 行名）', async () => {
    saver.mockRejectedValue(new Error('disk full'));
    const schema = {
      groups: [{
        name: 'g',
        rows: [
          { type: 'toggle', name: '开关甲', binding: { key: 't1' } },
          { type: 'text', name: '文本乙', binding: { key: 's1' } },
          { type: 'number', name: '数字丙', binding: { key: 'n1' } },
          { type: 'select', name: '下拉丁', binding: { key: 'sel1' }, options: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }] },
          { type: 'slider', name: '滑条戊', binding: { key: 'n2' }, min: 0, max: 10 },
          { type: 'choiceCards', name: '卡片己', binding: { key: 'c1' }, options: [{ value: 'x', label: '甲', prevClass: 'p' }, { value: 'y', label: '乙', prevClass: 'q' }] },
        ],
      }],
    } as unknown as SettingsSchema;
    renderPanel(schema);
    // 逐类触发 + 逐个断言（同屏通知上限 5 条会驱逐最旧——不能攒够 6 条一次断言）
    (document.querySelector('.bz-sw') as HTMLElement).click();
    await flush();
    expect(hasNotice(/保存失败（开关甲）：disk full/)).toBe(true);
    expect(state.t1).toBe(true); // 先写后翻语义不变：内存已是新值
    const text = document.querySelector('input.bz-input:not([type="number"])') as HTMLInputElement;
    text.value = 'vv';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    text.dispatchEvent(new Event('blur'));
    await flush();
    expect(hasNotice(/保存失败（文本乙）：disk full/)).toBe(true);
    expect(state.s1).toBe('vv');
    const num = document.querySelector('input[type="number"].bz-input') as HTMLInputElement;
    num.value = '7';
    num.dispatchEvent(new Event('input', { bubbles: true }));
    num.dispatchEvent(new Event('blur'));
    await flush();
    expect(hasNotice(/保存失败（数字丙）：disk full/)).toBe(true);
    (document.querySelector('.bz-select') as HTMLElement).click();
    (document.querySelector('.bz-select-item') as HTMLElement).click();
    await flush();
    expect(hasNotice(/保存失败（下拉丁）：disk full/)).toBe(true);
    const range = document.querySelector('input[type="range"]') as HTMLInputElement;
    range.value = '4';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(hasNotice(/保存失败（滑条戊）：disk full/)).toBe(true);
    (document.querySelector('.bz-sp-cardpick-card') as HTMLElement).click();
    await flush();
    expect(hasNotice(/保存失败（卡片己）：disk full/)).toBe(true);
  });

  it('C-1 契约：同 schema core 渲染器同场景提示文案恒等（panel = core）', async () => {
    saver.mockRejectedValue(new Error('disk full'));
    const schema = {
      groups: [{ name: 'g', rows: [{ type: 'toggle', name: '开关甲', binding: { key: 't1' } }] }],
    } as unknown as SettingsSchema;
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, schema);
    const row = host.querySelector('.setting-item') as any;
    const toggle = row.__setting.controls.find((c: any) => typeof c.trigger === 'function');
    toggle.trigger(false);
    await flush();
    expect(hasNotice(/保存失败（开关甲）：disk full/)).toBe(true);
  });

  it('R9：number 非空非法输入不写入 + 回显生效旧值（不再 NaN→0 写入；两渲染器同口径）', async () => {
    state.n1 = 5;
    const schema = {
      groups: [{ name: 'g', rows: [{ type: 'number', name: '数字丙', binding: { key: 'n1' }, min: 1, max: 100 }] }],
    } as unknown as SettingsSchema;
    renderPanel(schema);
    const num = document.querySelector('input[type="number"].bz-input') as HTMLInputElement;
    // 非法输入 'abc'：commit 后不写入绑定，回显生效旧值 5
    //（jsdom 对 number 输入的非法赋值做 value 清洗 → 暂改 text 复现非法原文进 commit）
    num.type = 'text';
    num.value = 'abc';
    num.dispatchEvent(new Event('input', { bubbles: true }));
    num.dispatchEvent(new Event('blur'));
    expect(state.n1).toBe(5);
    expect(saver).not.toHaveBeenCalled();
    expect(num.value).toBe('5');
    // 钳制仍生效：超上界写入钳制值
    num.value = '99999';
    num.dispatchEvent(new Event('input', { bubbles: true }));
    num.dispatchEvent(new Event('blur'));
    expect(state.n1).toBe(100);
    expect(saver).toHaveBeenCalledTimes(1);
    // core 渲染器同夹具同口径（契约对照；mock trigger 直进 onChange，不经 value 清洗）
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, schema);
    const row = host.querySelector('.setting-item') as any;
    const ctrl = row.__setting.controls.find((c: any) => c.inputEl);
    ctrl.trigger('abc');
    ctrl.inputEl.dispatchEvent(new Event('blur'));
    expect(state.n1).toBe(100); // core 侧内存未被非法输入改写
    expect(ctrl.inputEl.value).toBe('100'); // core 侧回显生效旧值
  });

  it('C-2：text/number commit 点补 refresh——值驱动 visibleWhen 的子行跟随', async () => {
    state.s1 = '';
    const schema = {
      groups: [{
        name: 'g',
        rows: [
          { type: 'text', name: '文本乙', binding: { key: 's1' } },
          { type: 'info', name: '子行', visibleWhen: (s: any) => s.s1 === 'go' },
        ],
      }],
    } as unknown as SettingsSchema;
    const { handle } = renderPanel(schema);
    const rows = [...document.querySelectorAll('.bz-sp-set-row')] as HTMLElement[];
    expect(rows[1].style.display).toBe('none'); // 初值未命中 → 隐藏
    const text = document.querySelector('input.bz-input') as HTMLInputElement;
    text.value = 'go';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    text.dispatchEvent(new Event('blur'));
    expect(rows[1].style.display).toBe(''); // commit 点重求值 → 子行出现
    state.s1 = '';
    handle.refresh();
    expect(rows[1].style.display).toBe('none');
  });

  it('F-3：list 行移除回调抛错 → 人话提示 + refresh 照跑（与 core C10 同口径）', async () => {
    const items = [{ key: 'a', label: '甲' }, { key: 'b', label: '乙' }];
    const schema = {
      groups: [{
        name: 'g',
        rows: [{
          type: 'list', name: '名单', items: () => [...items], emptyText: '空',
          onChange: () => { throw new Error('boom'); },
        }],
      }],
    } as unknown as SettingsSchema;
    renderPanel(schema);
    const removeBtn = document.querySelector('.bz-setlist-remove') as HTMLElement;
    expect(removeBtn).toBeTruthy();
    expect(() => removeBtn.click()).not.toThrow();
    await flush();
    expect(hasNotice(/保存失败（名单）：boom/)).toBe(true);
    // refresh 照跑：列表按 items() 重读重建（不停在已删假象）
    expect(document.querySelectorAll('.bz-setlist-item').length).toBe(2);
  });

  it('F-4：初始渲染 visibleWhen 抛错 → 保守可见不中断（单行异常不放大成整域失败）', () => {
    let calls = 0;
    const schema = {
      groups: [
        { name: 'g1', rows: [{ type: 'info', name: '常规行' }] },
        { name: 'g2', visibleWhen: () => { calls++; if (calls === 1) throw new Error('vw boom'); return true; }, rows: [{ type: 'info', name: '组内行' }] },
      ],
    } as unknown as SettingsSchema;
    expect(() => renderPanel(schema)).not.toThrow();
    const groups = [...document.querySelectorAll('.bz-sp-group')] as HTMLElement[];
    expect(groups.length).toBe(2); // 两组卡均在 DOM（修复前整轮中断）
    expect(groups[1].style.display).toBe(''); // 抛错组保守可见（H6 同口径）
  });
});
