/**
 * 深审残款清偿：core uiChip 缺省 aria-pressed（review-deep-bugs.md gameshelf 段登记）
 *
 * 契约（与类名逻辑同序）：
 * - 显式声明选中态（selected / selectedSoft）即「可按压切换」chip → 挂 aria-pressed，
 *   值随选中态落 true/false；两态都声明时 selected 优先（对齐 bz-chip--on / --sel 的 if/else 序）。
 * - 未声明选中态 = 纯静态标签 / 动作 / 锁定型 chip → 不强加 aria-pressed
 *   （动作按钮不该伪装成 toggle；settings-panel 路径 chips、gameshelf 档位 chips 各随其形）。
 * - uiChip 是工厂（非活组件）：状态更新走消费方重渲/重建，新实例属性自动跟随。
 *
 * 消费方审计（本批不改，防回归锚点）：
 * - gameshelf/ui.ts 档位 chips：selectedSoft 显式声明 → core 缺省即带 aria-pressed，
 *   其 syncChipState 点击后自补同值，不冲突。
 * - settings-panel/renderer.ts 路径 chips：未声明选中态 → 不受影响。
 */
import { describe, it, expect } from 'vitest';
import { uiChip } from '../../src/core/ui';

describe('uiChip 缺省 aria-pressed（深审残款）', () => {
  it('selected: true → aria-pressed="true"（读屏器首屏即拿到按压态）', () => {
    const c = uiChip({ label: '日记', selected: true });
    expect(c.getAttribute('aria-pressed')).toBe('true');
    expect(c.classList.contains('bz-chip--on')).toBe(true);
  });

  it('selected: false → aria-pressed="false"（显式声明的切换 chip 落「未按」态）', () => {
    const c = uiChip({ label: '日记', selected: false });
    expect(c.getAttribute('aria-pressed')).toBe('false');
    expect(c.classList.contains('bz-chip--on')).toBe(false);
  });

  it('selectedSoft: true/false → aria-pressed 跟随软选中态', () => {
    expect(uiChip({ label: '全部', selectedSoft: true }).getAttribute('aria-pressed')).toBe('true');
    expect(uiChip({ label: '全部', selectedSoft: false }).getAttribute('aria-pressed')).toBe('false');
  });

  it('两态都声明 → selected 优先（对齐 --on/--sel 类名的 if/else 序）', () => {
    const on = uiChip({ label: 'A', selected: true, selectedSoft: false });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(on.classList.contains('bz-chip--on')).toBe(true);
    const off = uiChip({ label: 'B', selected: false, selectedSoft: true });
    expect(off.getAttribute('aria-pressed')).toBe('false');
    expect(off.classList.contains('bz-chip--sel')).toBe(true);
  });

  it('未声明选中态的静态/动作/锁定 chip → 不强加 aria-pressed', () => {
    expect(uiChip({ label: '标签' }).hasAttribute('aria-pressed')).toBe(false);
    // settings-panel 路径 chip 形态：removable + onClick，无选中态
    const path = uiChip({ label: '附件', removable: true, onRemove: () => {}, onClick: () => {} });
    expect(path.hasAttribute('aria-pressed')).toBe(false);
    // settings-panel 回落 chip 形态：locked + onClick
    const locked = uiChip({ label: '库根目录', locked: true, onClick: () => {} });
    expect(locked.hasAttribute('aria-pressed')).toBe(false);
  });

  it('工厂语义：状态翻转后重建实例，aria-pressed 随态更新', () => {
    const on = uiChip({ label: '在玩', selectedSoft: true });
    const off = uiChip({ label: '在玩', selectedSoft: false });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(off.getAttribute('aria-pressed')).toBe('false');
  });
});
