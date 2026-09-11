/**
 * 番茄钟「界面相位」——跨域共享的**类型单源**（pomodoro 产出、home 消费）。
 *
 * 为什么放 core：home 不能静态依赖 pomodoro 域（ADR-0002），两侧各写一份字面量联合必然漂移
 * （相位是字符串，写错不报错、只表现为菜单文案不对）。本文件只出类型与纯判定函数、零依赖，
 * 类型两侧 `import type`，函数直接 import 即可。
 *
 * 语义（2026-09-11 用户拍板 —— 首页入口菜单的番茄钟项是**相位敏感的单个动作**，四个互斥）：
 *  - idle     没开始任何专注（含停止/重置后）  → 菜单「开始专注」
 *  - focusing 专注计时中                        → 菜单「停止专注」（= 暂停，之后可继续）
 *  - paused   专注暂停中（即「停止专注」之后）  → 菜单「继续专注」
 *  - break    休息阶段（短/长休，计时或暂停）    → 菜单「跳过休息」
 * 判定实现见 pomodoro/ui.ts::menuPhase（唯一产出方），消费见 home/shared.pomodoroMenuAction。
 */
export type PomodoroPhase = 'idle' | 'focusing' | 'paused' | 'break';

/**
 * 「专注进行中」（计时中或暂停中，休息阶段不算）——**布尔口径单源**。
 * 之前该判定有两处独立推导（pomodoro/ui.isFocusing 从原始 state 算、home/ui.ts 从相位反推），
 * 同步只靠注释，会漂移；现两侧统一从 PomodoroPhase 推导（相位的唯一产出方 = menuPhase）。
 */
export function isFocusingPhase(p: PomodoroPhase): boolean {
  return p === 'focusing' || p === 'paused';
}
