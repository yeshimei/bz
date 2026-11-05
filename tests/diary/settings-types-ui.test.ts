/**
 * 日记设置「分类」组的 emoji 浮层（jsdom）：
 *
 * 2026-11-05 用户报「点击图标打开的窗口，被设置面遮挡了」——浮层 `appendChild` 到 body
 * 却从不发 z 号（`position:fixed` 只定位不抬层），设置面板走动态发号（ADR-0067，100000+），
 * 浮层永远落在它下面。这里钉死「显示即抬到当前最高档」，与全站 overlay 同一口径。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { applyDirectories } from '../../src/diary/config';
import { mountDiaryTypeEditor } from '../../src/diary/settings-types';
import { __resetZForTests, allocZ } from '../../src/core/z-order';
import { MockVault, mockAppWithVault } from '../mock-vault';

let body: HTMLElement;
let panel: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  __resetZForTests();
  applyDirectories({});
  setApp(mockAppWithVault(new MockVault()));
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as never);

  // 模拟已打开的设置面板：走同一条动态发号通道拿一层
  panel = document.createElement('div');
  panel.id = 'fake-settings-panel';
  panel.style.zIndex = String(allocZ());
  document.body.appendChild(panel);
  body = document.createElement('div');
  panel.appendChild(body);
  mountDiaryTypeEditor(body);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('分类 emoji 浮层', () => {
  it('打开后 z 号高于设置面板（不再被面板压住）', () => {
    (body.querySelector('.bz-diary-type-emoji') as HTMLElement).click();
    const pop = document.querySelector<HTMLElement>('.bz-diary-type-emoji-pop');
    expect(pop).toBeTruthy();
    expect(Number(pop!.style.zIndex)).toBeGreaterThan(Number(panel.style.zIndex));
  });

  it('选完 emoji 浮层收起并写回该行', () => {
    (body.querySelector('.bz-diary-type-emoji') as HTMLElement).click();
    const cell = [...document.querySelectorAll<HTMLElement>('.bz-diary-type-emoji-cell')].find(
      (b) => b.textContent === '🌙'
    );
    cell!.click();
    expect(document.querySelector('.bz-diary-type-emoji-pop')).toBeNull();
    expect(body.querySelector('.bz-diary-type-emoji')?.textContent).toBe('🌙');
  });
});
