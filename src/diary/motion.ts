/**
 * 日记本动效层 · 写链路弹窗编排（ADR-0230 决策 8）。
 *
 * 回忆墙（含它那套「纸/墨/翻页/台历/显影」编排）已随 ADR-0230 退役，本层只剩一处职责：
 * **写日记 / 标签选择器弹窗内的入场编排**——字段行落纸接力 + 类型章签一枚枚摆上。
 * 壳归 core（uiModal），域内只编排骨内内容。
 *
 * 书页界面自己的动效不经本层：翻页交 StPageFlip（`ui.ts` 建书时配 `flippingTime`），
 * 碎纸/显影/长按菜单是 `ui.ts` 内的局部 WAAPI 与 CSS 类切换。
 *
 * 口径（对齐 cinema/home 台账，语义按日记本自己的出招）：
 * - 只动 `transform/opacity/filter`，几何从不改写；终态与无动效版逐像素一致。
 * - `?rm=1` 显式模拟 reduced-motion（直达终态）；jsdom / 无 WAAPI 环境同样直达终态，
 *   内容已由渲染层落定，域内测试零感知。
 * - 禁 import obsidian / core 服务（纯浏览器 API，评审壳同跑）。
 */

/* ================= 台账与口径 ================= */

const M = { fast: 160, move: 200, base: 280 } as const;
const STAG = 30;
const E = { out: 'cubic-bezier(.22,.82,.3,1)' } as const;

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径）。 */
function reduced(): boolean {
  try {
    return typeof location !== 'undefined' && location.search.includes('rm=1');
  } catch {
    return false;
  }
}

/** 安全 WAAPI：`?rm=1` / 宿主不支持时直达终态（落最后一帧） */
function waapi(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || reduced() || typeof el.animate !== 'function') {
    const last = frames[frames.length - 1];
    if (el && last) {
      for (const k of Object.keys(last)) {
        if (k === 'offset') continue;
        try {
          (el.style as unknown as Record<string, string>)[k] = String((last as Record<string, unknown>)[k]);
        } catch {
          /* 不可内联属性忽略 */
        }
      }
    }
    return null;
  }
  try {
    return el.animate(frames, opts);
  } catch {
    return null;
  }
}

/* ================= 弹窗内编排（写日记 / 标签选择器：字段落纸 + 章签摆上） ================= */

/** uiModal 壳归 core（域内不动）；只编排域内表单内容：字段行落纸接力 + 类型章签一枚枚摆上 */
export function motionSheetDialog(popup: HTMLElement): void {
  if (reduced()) return;
  const form = popup.querySelector<HTMLElement>('.bz-diary-form');
  if (!form) return;
  [...form.children].forEach((el, i) => {
    if (i >= 6) return;
    waapi(
      el as HTMLElement,
      [
        { opacity: 0, transform: 'translateY(7px)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      ],
      { duration: M.base, delay: 40 + i * 50, easing: E.out, fill: 'backwards' }
    );
  });
  popup.querySelectorAll<HTMLElement>('.diary-tag-selector-btn').forEach((el, i) => {
    if (i >= 14) return;
    waapi(
      el,
      [
        { opacity: 0, transform: 'translateY(4px) scale(.94)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: M.base, delay: 150 + i * 18, easing: E.out, fill: 'backwards' }
    );
  });
}
