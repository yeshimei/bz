/**
 * 移动竖屏软横屏（2026-09-24 口径，观影分析真机验证后推及各域分析层）：
 * 手机不旋屏、宿主面板照常竖着，分析层打开时把层框宽高对调并转 90°——
 * 用户侧转手机横看内容（同全屏视频的横屏呈现）。
 *
 * 旋转态给层框加 `is-rot90` 类；各域 CSS 用 `--rot` 变量承接 transform，
 * 该框上一切带 transform 的动画（is-nudge 晃动等）都要同乘 `--rot`，
 * 否则动画帧会把 90° 洗回 0°（闪竖版）。
 *
 * 坐标系铁律：布局（offsetWidth/offsetTop）与画布位图是**逻辑**值，
 * getBoundingClientRect / clientX-Y 是**视觉**值——旋转态下两者差一个 90°，
 * 混用会把靶点 / 墙体 / 指针落到框外（真机翻车根因）。换算用 boxLogicalPoint。
 */

export interface RotBoxFit { rot: boolean; w: number; h: number }

/** 层框几何 = 面板矩形（ADR-0175 口径），移动竖屏时宽高对调并加 `is-rot90`。
 *  返回对调后的逻辑宽高（基字号按它派生）；面板没几何（测试环境/兜底）返回 null，
 *  调用方走自己的 CSS 兜底。桌面 / 真机横屏（面板本来就宽>高）不转。 */
export function fitRotatedBox(box: HTMLElement, panel: HTMLElement | null, mobile: boolean): RotBoxFit | null {
  const r = panel?.getBoundingClientRect();
  if (!panel || !r || r.width < 40 || r.height < 40) return null;
  const rot = mobile && r.height > r.width;
  box.classList.toggle('is-rot90', rot);
  const w = rot ? r.height : r.width;
  const h = rot ? r.width : r.height;
  box.style.left = `${Math.round(r.left + (r.width - w) / 2)}px`;
  box.style.top = `${Math.round(r.top + (r.height - h) / 2)}px`;
  box.style.width = `${Math.round(w)}px`;
  box.style.height = `${Math.round(h)}px`;
  return { rot, w, h };
}

/** 视口点 → 层框逻辑点（画布位图 / 布局坐标系）。两种态的返回值都以**层框左上角**为原点：
 *  消费方（开卷幕字靶 / 盒壁）把它直接当画布坐标用，而画布满铺在层框内——
 *  非旋转态若原样返回视口值，层框不贴窗口左上角（桌面常态）时整面偏移 (box.left, box.top)。 */
export function boxLogicalPoint(box: HTMLElement, x: number, y: number): { x: number; y: number } {
  const vr = box.getBoundingClientRect();
  if (!box.classList.contains('is-rot90')) return { x: x - vr.left, y: y - vr.top };
  const bw = box.offsetWidth || 1, bh = box.offsetHeight || 1;
  const cx = vr.left + vr.width / 2, cy = vr.top + vr.height / 2;
  // rotate(90deg) 顺时针：视觉相对中心 = (−ly, lx)，逆映射即 (vy, −vx)
  return { x: bw / 2 + (y - cy), y: bh / 2 - (x - cx) };
}

/** 视口矩形 → 层框逻辑矩形（旋转态下宽高互换，取包围盒）。 */
export function boxLogicalRect(
  box: HTMLElement, left: number, top: number, right: number, bottom: number,
): { left: number; top: number; right: number; bottom: number } {
  const p0 = boxLogicalPoint(box, left, top);
  const p1 = boxLogicalPoint(box, right, bottom);
  return {
    left: Math.min(p0.x, p1.x), right: Math.max(p0.x, p1.x),
    top: Math.min(p0.y, p1.y), bottom: Math.max(p0.y, p1.y),
  };
}

/** 客户端点 → 宿主内的**逻辑**像素坐标（软横屏安全版）。
 *  宿主处在旋转层（`.is-rot90` 最近祖先）内时，宿主矩形与指针点都先换算到层框逻辑系
 *  再作差——直接拿视觉 rect 作差会把命中点转到错误象限；未旋转退化为普通 rect 作差。
 *  消费方：画布位图命中（clipbook 特刊雨滴斥力）、宿主内比例坐标（review 灯谱 spots）。 */
export function hostLocalPx(host: HTMLElement, cx: number, cy: number): { x: number; y: number } | null {
  const box = host.closest<HTMLElement>('.is-rot90');
  if (!box) {
    const r = host.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return { x: cx - r.left, y: cy - r.top };
  }
  const vr = host.getBoundingClientRect();
  const hr = boxLogicalRect(box, vr.left, vr.top, vr.right, vr.bottom);
  if (hr.right - hr.left < 1 || hr.bottom - hr.top < 1) return null;
  const p = boxLogicalPoint(box, cx, cy);
  return { x: p.x - hr.left, y: p.y - hr.top };
}
