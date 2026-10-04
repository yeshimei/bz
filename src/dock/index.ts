/**
 * 工具坞域入口（dock）：外部工具的登记、启动、回显、留痕、**调度**。
 *
 * 命令注册都在 main.ts：`bz-dock-open` 在 COMMANDS 表；每个已登记工具的直达运行命令
 * （`bz-dock-run-<工具id>`）启动时按登记表各注册一条（域内不重复 addCommand）。
 *
 * 本域**有一个常驻后台任务**：调度器（spec D1 修订 / ADR-0236）—— Obsidian 就绪后按各工具
 * 声明的节奏触发它。它只在桌面端起，且每次 tick 都现查「自动运行」总闸，中途开关立刻生效。
 */
export { openDock, closeDock, unloadDock, ensureDock, runToolDirect } from './ui';
/** 直达运行命令的口径层：门槛判定（node 可直测，与面板/调度器同源）+ 命令名里的工具名 */
export { judgeDirectRun, dockToolLabel } from './command';
/** 调度器（D1 修订：bz 亲自调度自动化工具；关着 Obsidian 时不会跑） */
export { startDockScheduler, stopDockScheduler, kickDockScheduler } from './scheduler';
/** 执行依赖注入缝（评审壳/测试塞假 child_process；插件侧不调用） */
export { setDockRuntimeDeps } from './runner';
/** fs 注入缝（评审壳/测试塞假 fs —— 声明文件与参数值住在工具目录，是 vault 外的路径） */
export { setDockFs } from './declaration';
/** 登记表读取（main.ts 启动时按它注册直达运行命令） */
export { readToolEntries } from './data';
