// @vitest-environment node
/**
 * home 首页番茄钟菜单 label「暂停专注」回归（PM2 残款/呈报#63 半边，全域深审拍板后修复批
 * Wave1 补充条目）：focusing 相位菜单项原 label「停止专注」与 commandId bz-pomodoro-pause
 * （暂停/继续共用）语义相撞，且与 pomodoro 命令侧「开始/重置专注」定稿不一致——对齐为
 * 「暂停专注」。命令 ID 不动。
 */
import { describe, it, expect } from 'vitest';
import { pomodoroMenuAction } from '../../src/home/shared';

describe('PM2 残款：focusing 相位菜单 = 暂停专注（呈报#63 半边）', () => {
  it('修复前必红：focusing label=「暂停专注」且 commandId=bz-pomodoro-pause、icon=pause', () => {
    const a = pomodoroMenuAction('focusing');
    expect(a.label).toBe('暂停专注');
    expect(a.commandId).toBe('bz-pomodoro-pause');
    expect(a.icon).toBe('pause');
  });

  it('其余三相不动：idle=开始专注 / paused=继续专注 / break=跳过休息；②③ 仍共用 pause', () => {
    expect(pomodoroMenuAction('idle')).toMatchObject({ label: '开始专注', commandId: 'bz-pomodoro-focus-toggle' });
    expect(pomodoroMenuAction('paused')).toMatchObject({ label: '继续专注', commandId: 'bz-pomodoro-pause' });
    expect(pomodoroMenuAction('break')).toMatchObject({ label: '跳过休息', commandId: 'bz-pomodoro-skip' });
    // 四相位 label 互异（互斥单动作不回退成并列）
    const labels = (['idle', 'focusing', 'paused', 'break'] as const).map((p) => pomodoroMenuAction(p).label);
    expect(new Set(labels).size).toBe(4);
  });
});
