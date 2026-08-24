/**
 * 影视分析报告模块级状态（ADR-0048 独立域）
 * 与 movie 域解耦：仅持本域所需的目录解析结果；
 * TS 对 `export let` 的导入绑定只读，故收敛为函数式访问。
 */

let folderPath = '我的/影视';

/** 分析数据根目录（ensure 时自设置 movieFolderPath 解析一次） */
export function getReportFolderPath(): string {
  return folderPath;
}

/** 初始化/测试用：设置分析数据根目录 */
export function setReportFolderPath(p: string): void {
  folderPath = p;
}

/** 测试/重建用：整体重置模块状态 */
export function resetMovieReportState(): void {
  folderPath = '我的/影视';
}
