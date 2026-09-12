// @vitest-environment jsdom
/**
 * 通用组件 uiSetlist（.bz-setlist）契约回归：
 * - 缺省 = chips 流式胶囊（2026-09-12 拍板）+ 四变体修饰类（rows/grid/chips/dense）；
 * - 条目结构：data-key / 头像可选 / 主副文案 / 移除钮（触控档）/ 副文案 title 悬停提示；
 * - 空态：emptyText 出 .bz-setlist-empty；无文案时空容器（:empty 不占位）；
 * - 移除回调收 key；
 * - **两渲染器同构锁**：同一 ListRow 经 core 设置渲染器与设置面板渲染器产出的
 *   .bz-setlist 结构必须逐字一致（此前两端各持一份实现，结构漂移即面板布局事故）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { uiSetlist } from '../../src/core/ui';
import { renderPanelSchema } from '../../src/settings-panel/renderer';
import type { SettingsSchema } from '../../src/core/settings-schema';

describe('uiSetlist 组件契约', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });

  const items = [
    { key: 'u1', label: 'UP 甲', sub: 'UID 1', imageUrl: 'a.png' },
    { key: 'u2', label: 'UP 乙' },
  ];

  it('缺省 chips 胶囊；rows/grid/dense 变体修饰类', () => {
    expect(uiSetlist({ items }).className).toBe('bz-setlist bz-setlist--chips');
    for (const v of ['rows', 'grid', 'chips', 'dense'] as const) {
      expect(uiSetlist({ items, variant: v }).classList.contains(`bz-setlist--${v}`)).toBe(true);
    }
    expect(uiSetlist({ items, className: 'x' }).classList.contains('x')).toBe(true);
  });

  it('条目结构：data-key/头像可选/主副文案/移除钮触控档/副文案 title 悬停', () => {
    const box = uiSetlist({ items, removeLabel: '删掉' });
    const els = [...box.querySelectorAll<HTMLElement>('.bz-setlist-item')];
    expect(els.map((e) => e.dataset.key)).toEqual(['u1', 'u2']);
    expect(els[0].querySelector('.bz-setlist-avatar')).toBeTruthy();
    expect(els[1].querySelector('.bz-setlist-avatar')).toBeNull(); // 无头像不占位
    expect(els[0].querySelector('.bz-setlist-name')!.textContent).toBe('UP 甲');
    expect(els[0].querySelector('.bz-setlist-sub')!.textContent).toBe('UID 1');
    expect(els[0].title).toBe('UID 1'); // chips 不展示 sub → title 保信息可达
    expect(els[1].title).toBe('');
    const remove = els[0].querySelector('.bz-setlist-remove') as HTMLElement;
    expect(remove.textContent).toBe('删掉');
    expect(remove.classList.contains('bz-touch-target--xl')).toBe(true);
  });

  it('移除回调收 key；空态/空容器', () => {
    const hit: string[] = [];
    const box = uiSetlist({ items, onRemove: (k) => hit.push(k) });
    (box.querySelectorAll('.bz-setlist-remove')[1] as HTMLElement).click();
    expect(hit).toEqual(['u2']);
    expect(uiSetlist({ items: [], emptyText: '暂无名单' }).querySelector('.bz-setlist-empty')!.textContent).toBe('暂无名单');
    expect(uiSetlist({ items: [] }).childElementCount).toBe(0);
  });
});

describe('两渲染器同构锁（core / 面板同调 uiSetlist）', () => {
  const state: any = {};
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    state.notes = ['a.md', 'b.md'];
    setSettingsProvider(() => state);
    setSettingsSaver(async () => {});
  });

  it('同一 ListRow 的 .bz-setlist 结构逐字一致（含空态）', () => {
    const schema: SettingsSchema = {
      groups: [{
        name: '组', rows: [{
          type: 'list', name: '名单',
          items: () => state.notes.map((n: string) => ({ key: n, label: n, sub: 'sub', imageUrl: 'x.png' })),
          emptyText: '空名单',
          onChange: (keys) => { state.notes = keys; },
        }],
      }],
    };
    const coreEl = document.createElement('div');
    renderSettingsInto(coreEl, schema);
    const panelEl = document.createElement('div');
    renderPanelSchema(panelEl, schema);
    expect(coreEl.querySelector('.bz-setlist')!.outerHTML).toBe(panelEl.querySelector('.bz-setlist')!.outerHTML);

    state.notes = [];
    const coreEmpty = document.createElement('div');
    renderSettingsInto(coreEmpty, schema);
    const panelEmpty = document.createElement('div');
    renderPanelSchema(panelEmpty, schema);
    expect(coreEmpty.querySelector('.bz-setlist')!.outerHTML).toBe(panelEmpty.querySelector('.bz-setlist')!.outerHTML);
    expect(coreEmpty.querySelector('.bz-setlist-empty')!.textContent).toBe('空名单');
  });
});

describe('列表行动态更新（增删后即时重建，无需重开弹窗）', () => {
  const state: any = {};
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    state.list = ['a'];
    setSettingsProvider(() => state);
    setSettingsSaver(async () => {});
  });

  const schema = (): SettingsSchema => ({
    groups: [{
      name: '组',
      rows: [
        {
          type: 'text', name: '添加行', binding: { get: () => '', set: () => {}, save: () => {} },
          actions: [{ text: '添加', onClick: (v) => { state.list = [...state.list, String(v)]; } }],
        },
        {
          type: 'list', name: '名单',
          items: () => state.list.map((k: string) => ({ key: k, label: k })),
          emptyText: '空名单',
          onChange: (keys) => { state.list = keys; },
        },
      ],
    }],
  });

  it('面板渲染器：点「添加」后新条目即时出现；点移除即时消失', async () => {
    const panelEl = document.createElement('div');
    renderPanelSchema(panelEl, schema());
    expect(panelEl.querySelectorAll('.bz-setlist-item')).toHaveLength(1);
    (panelEl.querySelector('input') as HTMLInputElement).value = 'b';
    (panelEl.querySelector('.bz-sp-btn') as HTMLElement).click();
    await vi.waitFor(() => expect(panelEl.querySelectorAll('.bz-setlist-item')).toHaveLength(2));
    (panelEl.querySelector('.bz-setlist-remove') as HTMLElement).click();
    await vi.waitFor(() => expect(panelEl.querySelectorAll('.bz-setlist-item')).toHaveLength(1));
  });

  it('core 渲染器：行内按钮添加后新条目即时出现', async () => {
    const coreEl = document.createElement('div');
    renderSettingsInto(coreEl, schema());
    expect(coreEl.querySelectorAll('.bz-setlist-item')).toHaveLength(1);
    const setting = ([...coreEl.querySelectorAll('.setting-item')] as any[])
      .find((s) => s.dataset.name === '添加行').__setting;
    setting.controls.find((c: any) => c.inputEl).trigger('c');
    setting.controls.find((c: any) => c.text === '添加').trigger();
    await vi.waitFor(() => expect(coreEl.querySelectorAll('.bz-setlist-item')).toHaveLength(2));
  });
});
