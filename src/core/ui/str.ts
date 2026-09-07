/* ============================================================
 * bz 组件库 · 字符串小工具（src/core/ui/str.ts）
 *
 * 域渲染纯层（render.ts 范式，ADR-0104）共用的零依赖字符串工具。
 * 刻意不 import 任何模块（含 moment/obsidian/组件库 barrel）：
 * 本文件会被 esbuild 打进各域 prototype-render.js（评审壳预览包，
 * 双击原型即加载），import 图必须绝对干净——纯度由
 * tests/core/render-purity.test.ts 守卫。域 render.ts 引用本文件
 * 必须走直连路径（../core/ui/str），禁止经 barrel（会拖入 obsidian）。
 * ============================================================ */

const ESC_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** HTML 转义（同 core/utils escapeHtml 语义；此处独立实现以保零依赖） */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/** 未知值 → 转义串（?? '' 兜底 null/undefined） */
export function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}

/** 本地时间戳 YYYY-MM-DD HH:mm:ss（created/archivedAt 等写入格式；零依赖故居此，favorites/cinema 共用） */
export function localNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** lucide 图标占位串（`<i data-lucide>`）：渲染入 DOM 后由 mountIcons 兑现成 SVG——
 *  插件 = core/ui icons.ts mountIcons（setIcon），评审壳 = prototype-icons.js 内联 SVG（壳层差异表） */
export function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}
