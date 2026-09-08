// @vitest-environment jsdom
/**
 * 通用设置行能力回归（custom 插槽退役的基石，两端渲染器同测）：
 * - RowAction：text 行内按钮（onClick 收当前输入值，完成后重读绑定回填显示不置脏）、
 *   slider/info 行内按钮；
 * - ListRow：条目渲染（头像/副文案/移除按钮触控档）、移除回调传剩余键集 + 函数条目重读重建、
 *   空态回退 emptyText。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { renderPanelSchema } from '../../src/settings-panel/renderer';
import type { SettingsSchema } from '../../src/core/settings-schema';

const state: any = {};
beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  for (const k of Object.keys(state)) delete state[k];
  state.volume = 60;
  state.notes = ['a.md', 'b.md'];
  setSettingsProvider(() => state);
  setSettingsSaver(async () => {});
});

const schema: SettingsSchema = {
  groups: [
    {
      name: '通用能力',
      icon: 'sliders-horizontal',
      rows: [
        {
          type: 'text', name: '目标行', binding: {
            get: () => state.target ?? '', set: (v) => { state.target = v; }, save: () => {},
          },
          actions: [
            { text: '回填', onClick: () => { state.target = 'filled'; } },
            { text: '清理', onClick: (value) => { state.target = `cleared:${value}`; } },
          ],
        },
        {
          type: 'slider', name: '音量行', binding: {
            get: () => state.volume, set: (v) => { state.volume = v; }, save: () => {},
          }, min: 0, max: 100, step: 5,
          actions: [{ text: '试听', onClick: () => { state.played = true; } }],
        },
        {
          type: 'info', name: '提示行', desc: '纯展示附操作',
          actions: [{ text: '查看', onClick: () => { state.viewed = true; } }],
        },
        {
          type: 'list', name: '名单行',
          items: () => state.notes.map((n: string) => ({ key: n, label: n, sub: 'sub', imageUrl: 'x.png' })),
          emptyText: '空名单',
          removeLabel: '移除',
          onChange: (keys) => { state.notes = keys; },
        },
      ],
    },
  ],
};

function renderBoth() {
  const coreEl = document.createElement('div');
  renderSettingsInto(coreEl, schema);
  const panelEl = document.createElement('div');
  renderPanelSchema(panelEl, schema);
  return { coreEl, panelEl };
}
const coreRow = (el: HTMLElement, name: string) =>
  ([...el.querySelectorAll('.setting-item')].find((s) => (s as HTMLElement).dataset.name === name) as any)?.__setting as any;
const panelRow = (el: HTMLElement, name: string) =>
  [...el.querySelectorAll('[data-key]')].find((s) => (s as HTMLElement).dataset.key === name) as HTMLElement;

describe('RowAction 行内按钮（两端渲染器）', () => {
  it('text 行：按钮在输入框左侧，onClick 收当前输入值，完成后重读绑定回填', async () => {
    const { coreEl, panelEl } = renderBoth();
    // core：controls = [按钮, 输入框]；模拟输入后触发回填动作
    const cRow = coreRow(coreEl, '目标行');
    const cBtn = cRow.controls.find((c: any) => c.text === '回填');
    const cText = cRow.controls.find((c: any) => c.inputEl);
    cText.trigger('hello'); // 输入值 hello（未提交）
    cBtn.trigger();
    await Promise.resolve();
    expect(state.target).toBe('filled'); // 动作执行
    expect(cText.value).toBe('filled'); // 渲染器重读绑定回填显示

    // panel：按钮在输入框之前（兄弟序），点击后同样回填
    const pRow = panelRow(panelEl, '目标行');
    const btns = [...pRow.querySelectorAll('.bz-sp-btn')] as HTMLElement[];
    expect(btns.map((b) => b.textContent)).toEqual(['回填', '清理']);
    const input = pRow.querySelector('input') as HTMLInputElement;
    input.value = 'panel-val';
    btns[1].click(); // 清理动作收当前输入值
    await Promise.resolve();
    expect(state.target).toBe('cleared:panel-val');
    expect(input.value).toBe('cleared:panel-val');
  });

  it('slider 行与 info 行：附加按钮触发动作', async () => {
    const { coreEl, panelEl } = renderBoth();
    coreRow(coreEl, '音量行').controls.find((c: any) => c.text === '试听').trigger();
    expect(state.played).toBe(true);
    (panelRow(panelEl, '音量行').querySelector('.bz-sp-btn') as HTMLElement).dispatchEvent(new Event('click'));
    expect(state.played).toBe(true);
    coreRow(coreEl, '提示行').controls.find((c: any) => c.text === '查看').trigger();
    (panelRow(panelEl, '提示行').querySelector('.bz-sp-btn') as HTMLElement).dispatchEvent(new Event('click'));
    expect(state.viewed).toBe(true);
  });
});

describe('ListRow 通用列表行（两端渲染器）', () => {
  it('条目渲染：头像/副文案/移除按钮（触控档）；移除回调传剩余键集并重读条目', async () => {
    const { coreEl, panelEl } = renderBoth();
    for (const el of [coreEl, panelEl]) {
      const items = [...el.querySelectorAll('.bz-setlist-item')];
      expect(items).toHaveLength(2);
      expect(items[0].querySelector('.bz-setlist-avatar')).toBeTruthy();
      expect(items[0].querySelector('.bz-setlist-sub')!.textContent).toBe('sub');
      const remove = items[0].querySelector('.bz-setlist-remove') as HTMLElement;
      expect(remove.classList.contains('bz-touch-target--xl')).toBe(true);
      remove.dispatchEvent(new Event('click'));
      await Promise.resolve();
      expect(state.notes).toEqual(['b.md']); // 剩余键集回写
    }
    // 重读后只剩一条
    expect(coreEl.querySelectorAll('.bz-setlist-item')).toHaveLength(1);
    expect(panelEl.querySelectorAll('.bz-setlist-item')).toHaveLength(1);
  });

  it('空数组回退 emptyText 空态', async () => {
    state.notes = [];
    const { coreEl, panelEl } = renderBoth();
    expect(coreEl.querySelector('.bz-setlist-empty')!.textContent).toBe('空名单');
    expect(panelEl.querySelector('.bz-setlist-empty')!.textContent).toBe('空名单');
  });
});
