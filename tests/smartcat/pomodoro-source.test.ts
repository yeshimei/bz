// @vitest-environment node
/**
 * 番茄钟动作观察文案纯函数（ticket 080 方法监听）：buildPomodoroActionText 事件 → 文本；
 * minutes 注入：默认 25 / 自定义如 50 / 边缘 1。
 */
import { describe, it, expect } from 'vitest';
import { buildPomodoroActionText, pomodoroFocusDoneText } from '../../src/smartcat/pomodoro-source';

describe('buildPomodoroActionText（番茄钟专注完成观察文案）', () => {
  it('focus-done：默认 25 分钟', () => {
    expect(buildPomodoroActionText({ kind: 'focus-done', minutes: 25 })).toBe('你用番茄钟完成了 25 分钟专注');
  });

  it('focus-done：自定义 50 分钟（跟随 durations().workMin）', () => {
    expect(buildPomodoroActionText({ kind: 'focus-done', minutes: 50 })).toBe('你用番茄钟完成了 50 分钟专注');
    expect(pomodoroFocusDoneText(50)).toBe('你用番茄钟完成了 50 分钟专注');
  });

  it('focus-done：边缘 1 分钟', () => {
    expect(buildPomodoroActionText({ kind: 'focus-done', minutes: 1 })).toBe('你用番茄钟完成了 1 分钟专注');
  });
});