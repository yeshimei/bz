/**
 * 番茄钟动作观察文案层（ticket 080，对齐影视/备忘录/聚合讯方法监听样板）：
 * pomodoro 域 UI applyAction 在专注自然完成时直接调 smartcat.notifyPomodoroAction(事件)，
 * 文案构造集中本模块（纯函数可测）。
 * 用户 2026-08-24 拍板——观察集：只观察「专注完成」——focus 阶段 tick 自然完成
 * （即写 history 的路径）。开始/暂停/继续/跳过/重置/休息完成一律不观察
 * （skip 与休息完成无 historyEntry，天然排除）。
 * 文案：X = 当前配置的工作分钟数（durations().workMin，设置预设/自定义；默认 25）。
 * 数据语义零改动：不碰 pomodoro.json 格式/状态机/UI 结构/命令/文案（兼容冻结）。
 */
export type PomodoroActionEvent =
  | { kind: 'focus-done'; minutes: number };

/** 专注完成观察文案（minutes = 当前配置工作时长） */
export function pomodoroFocusDoneText(minutes: number): string {
  return `你用番茄钟完成了 ${minutes} 分钟专注`;
}

/** 事件 → 观察文本（smartcat.notifyPomodoroAction 调用；本域唯一事件恒产出） */
export function buildPomodoroActionText(evt: PomodoroActionEvent): string | null {
  switch (evt.kind) {
    case 'focus-done':
      return pomodoroFocusDoneText(evt.minutes);
  }
}