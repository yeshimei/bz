/**
 * 番茄钟域测试清理夹具（深审 PA-4）：域 = 模块级单例 + 状态栏单例 + 通知容器常驻，
 * 清理三件套（unloadPomodoro / unmountPomodoroStatusBar / body 清空）+ 通知清空缺一即产生
 * 跨用例污染（mount 早退、双遮罩、notice 串场），且污染症状与真实 bug 难分辨——收敛为单一入口。
 * 采纳口径（渐进）：新用例 / 新文件 beforeEach 一行调用本夹具；存量 describe 不强改。
 */
import { unloadPomodoro } from '../../src/pomodoro';
import { unmountPomodoroStatusBar } from '../../src/pomodoro/statusbar';
import { clearNotices } from '../mock-obsidian-entry';

export function resetPomodoroFixture(): void {
  unloadPomodoro();
  unmountPomodoroStatusBar();
  document.body.innerHTML = '';
  clearNotices();
}
