/* ============================================================
 * bz · 版本号比较（core/version.ts）
 *
 * 零依赖的纯函数：插件自身版本（manifest）、日志里的版本号、设置里记的
 * 「上次提示过的版本」三处要互相比大小，谁都不该为了比个版本号去拉整个
 * core/changelog（那边连着远端资产链）。
 * ============================================================ */

/** 版本号归一：去空白、去前导 v（`v1.39.1` 与 `1.39.1` 视为同一个） */
export function normalizeVersion(version: string): string {
  return String(version || '').trim().replace(/^[vV]/, '');
}

/** 按段比版本号：a 大于 b → 1，相等 → 0，小于 → -1（缺段按 0，非数字段按 0） */
export function compareVersions(a: string, b: string): number {
  const pa = normalizeVersion(a).split('.');
  const pb = normalizeVersion(b).split('.');
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = parseInt(pa[i] || '0', 10) || 0;
    const y = parseInt(pb[i] || '0', 10) || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}
