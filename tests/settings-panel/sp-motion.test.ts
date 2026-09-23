/**
 * 设置面板动效层回归（sp-motion，2026-09-23 动效批）：
 * - ?rm=1 直达终态：全链挂点（入场/翻层/拨杆/入槽/卡簧弹回/萤标/灯下尘）不抛、零注入、零编排；
 * - 无 WAAPI 宿主（jsdom）经 waapi 落最后一帧：域内 markup 契约（行数/data-key/aria）零破坏；
 * - teardown 幂等：连调两次不抛，萤标注入件被摘除后可重建；
 * - 萤标 sync：选中项落位 + is-on；搜索态无选中项渐隐不抛。
 * jsdom 无 canvas 2d 上下文——灯下尘在此宿主为「干净退出」路径，一并验证零注入。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  motionPanelIn, motionRendered, motionMobList, motionNavSynced,
  motionSwitchFlip, motionSelectPick, motionCardChoose,
  motionInputSaved, motionInputReject, motionInputAdjust,
  motionEnsureDust, motionSleep, motionTeardown,
} from '../../src/settings-panel/motion';
import { renderPanelSchema } from '../../src/settings-panel/renderer';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';

/** 建 popup 壳（桌面形态：PanelIn 桌面分支需要非 bz-sp-mobile 类） */
function fakePopup(): HTMLElement {
  const popup = document.createElement('div');
  popup.className = 'bz-sp-desk';
  popup.innerHTML =
    '<aside class="bz-sp-desk-side"><div class="bz-sp-nav">' +
    '<button type="button" class="bz-sp-nav-item on" data-sp-domain="global">通用</button>' +
    '<button type="button" class="bz-sp-nav-item" data-sp-domain="memo">备忘录</button>' +
    '</div></aside>' +
    '<main class="bz-sp-desk-main"><div class="bz-sp-pane"></div></main>';
  document.body.appendChild(popup);
  return popup;
}

/** 渲染一组真实 schema（toggle/select/number/choiceCards 各一枚）并返回 pane */
function renderFixture(): HTMLElement {
  const pane = document.querySelector('.bz-sp-pane') as HTMLElement;
  renderPanelSchema(pane, {
    groups: [
      {
        icon: 'sliders-horizontal',
        name: '测试组',
        rows: [
          { type: 'toggle', name: '开关行', binding: { get: () => true, set: () => {}, save: () => {} } },
          { type: 'number', name: '数字行', min: 1, max: 10, binding: { get: () => 5, set: () => {}, save: () => {} } },
        ],
      },
    ],
  });
  return pane;
}

describe('设置面板动效层（sp-motion）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as never);
    // 逐用例还原 search（前一个用例可能设了 ?rm=1；replaceState 回同路径即清参数）
    try { window.history.replaceState(null, '', location.pathname); } catch { /* 宿主不支持则跳过 */ }
    expect(location.search.includes('rm=1'), 'search 还原失败会污染后续用例').toBe(false);
  });

  it('?rm=1 直达终态：全链挂点不抛、零注入件、零编排污染', () => {
    window.history.replaceState(null, '', '?rm=1');
    const popup = fakePopup();
    const pane = renderFixture();
    const beforeHtml = pane.innerHTML;
    const rowsBefore = pane.querySelectorAll('.bz-sp-set-row').length;

    expect(() => {
      motionPanelIn(popup, null);
      motionRendered(pane);
      motionMobList(pane);
      motionSwitchFlip(popup.querySelector('.bz-sw') as HTMLElement, false);
      motionSelectPick(popup.querySelector('.bz-select') as HTMLElement);
      motionCardChoose(popup.querySelector('.bz-sp-cardpick-card') as HTMLElement);
      motionInputSaved(pane.querySelector('.bz-input') as HTMLElement);
      motionInputReject(pane.querySelector('.bz-input') as HTMLElement);
      motionInputAdjust(pane.querySelector('.bz-input') as HTMLElement);
      motionEnsureDust(popup);
      motionNavSynced(popup.querySelector('.bz-sp-nav') as HTMLElement);
      motionSleep();
      motionTeardown();
    }).not.toThrow();

    // 零编排：内容 DOM 一字未动（reduced 路径不写内联、不注组件）
    expect(pane.innerHTML).toBe(beforeHtml);
    expect(pane.querySelectorAll('.bz-sp-set-row').length).toBe(rowsBefore);
    // 零注入件：无萤标、无尘光画布
    expect(popup.querySelector('.bz-spm-cursor')).toBeNull();
    expect(popup.querySelector('.bz-spm-dust')).toBeNull();
    // 卡簧弹回类未挂（reduced 直接 return）
    expect(pane.querySelector('.bz-input.bz-spm-reject')).toBeNull();
  });

  it('无 WAAPI 宿主经 waapi 落最后一帧：入场/翻层后 markup 契约零破坏', () => {
    const popup = fakePopup();
    const mask = document.createElement('div');
    const pane = renderFixture();
    const rows = [...pane.querySelectorAll<HTMLElement>('.bz-sp-set-row')];
    const keysBefore = rows.map((r) => r.dataset.key ?? '');

    expect(() => {
      motionPanelIn(popup, mask);
      motionRendered(pane);
    }).not.toThrow();

    // 落终态：popup 内联收在 opacity 1（末帧），无残影
    expect(popup.style.opacity).toBe('1');
    // markup 契约零破坏：行数、data-key 定位契约、开关 role/aria 全部原样
    expect(pane.querySelectorAll('.bz-sp-set-row').length).toBe(2);
    expect(rows.map((r) => r.dataset.key ?? '')).toEqual(keysBefore);
    expect(pane.querySelector('.bz-sw')?.getAttribute('role')).toBe('switch');
    expect(pane.querySelector('.bz-sw')?.getAttribute('aria-checked')).toBe('true');
    expect(pane.querySelectorAll('.bz-sp-group').length).toBe(1);
  });

  it('teardown 幂等：连调两次不抛；萤标注入件被摘除后可重建', () => {
    const popup = fakePopup();
    const nav = popup.querySelector('.bz-sp-nav') as HTMLElement;
    // 非 RM：萤标应自建注入件
    motionNavSynced(nav);
    const cursor = nav.parentElement?.querySelector('.bz-spm-cursor');
    expect(cursor, '非 RM 路径应挂萤标注入件').not.toBeNull();
    expect(cursor?.classList.contains('is-on')).toBe(true);

    motionTeardown();
    expect(() => motionTeardown()).not.toThrow(); // 幂等：二次调用不抛
    expect(nav.parentElement?.querySelector('.bz-spm-cursor')).toBeNull();

    // 重建：同一 nav 再 sync 仍能重挂（面板重开路径）
    motionNavSynced(nav);
    expect(nav.parentElement?.querySelector('.bz-spm-cursor')).not.toBeNull();
    motionTeardown();
  });

  it('萤标 sync：搜索态无选中项时渐隐（摘 is-on）不抛；重建导航后跟随新选中项', () => {
    const popup = fakePopup();
    const nav = popup.querySelector('.bz-sp-nav') as HTMLElement;
    motionNavSynced(nav);
    const cursor = nav.parentElement?.querySelector('.bz-spm-cursor') as HTMLElement;
    expect(cursor.classList.contains('is-on')).toBe(true);

    // 搜索态：导航重绘后无 .on 项 → 萤标渐隐（不抛）
    nav.querySelectorAll('.bz-sp-nav-item.on').forEach((el) => el.classList.remove('on'));
    expect(() => motionNavSynced(nav)).not.toThrow();
    expect(cursor.classList.contains('is-on')).toBe(false);

    // 选中另一项 → 萤标点亮（跟随新目标）
    nav.querySelector('[data-sp-domain="memo"]')?.classList.add('on');
    expect(() => motionNavSynced(nav)).not.toThrow();
    expect(cursor.classList.contains('is-on')).toBe(true);
    motionTeardown();
  });
});
