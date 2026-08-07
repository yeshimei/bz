/**
 * 通用工具函数（原脚本内联工具，独立成模块供各功能域复用）
 */

/** HTML 转义 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

/** 生成随机块 ID */
export function generateBlockId(): string {
  return Math.random().toString(36).substr(2, 6);
}

/** 睡眠 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
