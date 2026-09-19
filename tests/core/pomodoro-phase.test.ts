// @vitest-environment node
/**
 * core/pomodoro-phase 布尔口径单源直测（深审建-1）：isFocusingPhase 曾两处独立推导会漂移，
 * 现统一从 PomodoroPhase 推导（相位的唯一产出方 = pomodoro/ui::menuPhase，消费 = toggleFocus /
 * home 彩点）——把「单源判定的语义」钉在产出侧（4 相位 × 期望值），不再只靠消费侧间接覆盖。
 */
import { describe, it, expect } from 'vitest';
import { isFocusingPhase } from '../../src/core/pomodoro-phase';

describe('isFocusingPhase（布尔口径单源直测）', () => {
  it('4 相位互斥判定：focusing/paused 为真，idle/break 为假', () => {
    expect(isFocusingPhase('focusing')).toBe(true);
    expect(isFocusingPhase('paused')).toBe(true);
    expect(isFocusingPhase('idle')).toBe(false);
    expect(isFocusingPhase('break')).toBe(false);
  });
});
