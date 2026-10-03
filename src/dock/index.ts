/**
 * 工具坞域入口（dock）：外部工具的登记、启动、回显、留痕。
 *
 * 命令 `bz-dock-open` 在 main.ts 的 COMMANDS 表注册（域内不重复 addCommand）。
 * 本域**不常驻**：无事件订阅、无后台任务（调度本就不归 bz —— spec D1）。
 */
export { openDock, closeDock, unloadDock, ensureDock } from './ui';
/** 执行依赖注入缝（评审壳/测试塞假 child_process；插件侧不调用） */
export { setDockRuntimeDeps } from './runner';
/** fs 注入缝（评审壳/测试塞假 fs —— 声明文件与参数值住在工具目录，是 vault 外的路径） */
export { setDockFs } from './declaration';
