/**
 * 番茄钟「界面相位」——跨域共享的**类型单源**（pomodoro 产出、home 消费）。
 *
 * 为什么放 core：home 不能静态依赖 pomodoro 域（ADR-0002），两侧各写一份字面量联合必然漂移
 * （相位是字符串，写错不报错、只表现为菜单文案不对）。本文件只出类型、零运行时依赖，
 * 两侧 `import type` 即可。
 *
 * 语义（2026-09-11 用户拍板 —— 首页入口菜单的番茄钟项是**相位敏感的单个动作**，四个互斥）：
 *  - idle     没开始任何专注（含停止/重置后）  → 菜单「开始专注」
 *  - focusing 专注计时中                        → 菜单「停止专注」（= 暂停，之后可继续）
 *  - paused   专注暂停中（即「停止专注」之后）  → 菜单「继续专注」
 *  - break    休息阶段（短/长休，计时或暂停）    → 菜单「跳过休息」
 * 判定实现见 pomodoro/ui.ts::menuPhase（唯一产出方），消费见 home/shared.pomodoroMenuAction。
 */
export type PomodoroPhase = 'idle' | 'focusing' | 'paused' | 'break';
