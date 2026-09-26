/**
 * 使用手册弹窗（issue 473）：设置面板侧栏 footer 入口 → Obsidian 内独立弹窗
 * 内嵌渲染手册（iframe srcdoc——327KB 单文件自包含，不走 file://，无系统开程序
 * 与路径转义坑链）。与面板同皮（frame 挂 .bz-sp-skin 得亮/暗 --sp-* 令牌），
 * 壳走样式库 .bz-panel-overlay/.bz-panel-frame（components.css A 段）；
 * hide 型常驻层范式随 changelog：重开抬顶（ADR-0067 topifyZ）、ESC 栈序随显示序
 * 重放注册、插件卸载经 unloadSettingsPanel → unloadManualViewer 收口。
 * 关闭即清空 srcdoc 释放内存（327KB 文本 + 渲染树不值得常驻）。
 *
 * 移动端（≤768px）真全屏（用户拍板）：frame 挂 core .bz-panel-mtop 得 44px 顶部避让
 * （避 Obsidian 移动端头部 + 刘海），右上 44px 见方关闭钮落在这条避让带里——
 * 全屏后遮罩点不到了，关闭只剩这一个出口（ESC 在手机上不可靠）。
 * 桌面端形态不变：居中弹窗、无头行、钮不出现（点遮罩 / ESC 关闭）。
 */
import { topifyZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';

const OVERLAY_ID = 'bz-manual-overlay';
const FRAME_ID = 'bz-manual-popup';

let overlay: HTMLElement | null = null;
let escHandle: ReturnType<typeof escManager.register> | null = null;

function isVisible(): boolean {
  return !!overlay && overlay.style.display === 'flex';
}

function hide(): void {
  if (!overlay) return;
  overlay.style.display = 'none';
  // 释放渲染树：内容随 srcdoc 清空，重开由调用方再喂
  const frame = overlay.querySelector<HTMLIFrameElement>(`#${FRAME_ID} iframe`);
  if (frame) frame.srcdoc = '';
}

/** 插件卸载清理：拆弹窗、注销 ESC 层（unloadSettingsPanel 调用，幂等） */
export function unloadManualViewer(): void {
  escHandle?.unregister();
  escHandle = null;
  overlay?.remove();
  overlay = null;
}

/** 打开手册弹窗（html = 手册完整 HTML 文本；重复打开 = 抬顶 + 换内容） */
export function openManualViewer(html: string): void {
  if (!overlay) build();
  topifyZ(overlay!); // ADR-0067：显示即发号（重开抬顶，谁后显示谁在上）
  overlay!.style.display = 'flex';
  trapPanelFocus(overlay!.querySelector<HTMLElement>(`#${FRAME_ID}`) ?? overlay!);
  // ESC 栈序与 z 序重同步（changelog 同刀）：hide 型常驻层重开只抬 z 不抬 ESC 栈会失配
  escHandle?.unregister();
  escHandle = escManager.register('bz-manual-viewer', { isVisible, close: hide });
  const frame = overlay!.querySelector<HTMLIFrameElement>(`#${FRAME_ID} iframe`)!;
  frame.srcdoc = html;
}

function build(): void {
  const ov = document.createElement('div');
  ov.id = OVERLAY_ID;
  ov.className = 'bz-panel-overlay';
  const frame = document.createElement('div');
  frame.id = FRAME_ID;
  frame.className = 'bz-panel-frame bz-sp-skin bz-panel-mtop bz-manv-popup';
  frame.innerHTML = shellHtml();
  frame.querySelector<HTMLElement>('.bz-manv-close')?.addEventListener('click', hide);
  ov.appendChild(frame);
  ov.addEventListener('click', (e) => {
    if (e.target === ov) hide();
  });
  document.body.appendChild(ov);
  overlay = ov;
}

/** ✕ 关闭钮（仅移动端可见：全屏后遮罩点不到，关闭得有实体出口；桌面走遮罩 / ESC） */
const CLOSE_BTN = `<button class="bz-manv-close" type="button" aria-label="关闭使用手册" title="关闭">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
</button>`;

/** 弹窗骨架（无头行——用户拍板：外壳不留标题，手册自带的内容已够自明；
 *  主体 = iframe 内嵌手册，零留白贴边，滚动全交 iframe 内文档） */
function shellHtml(): string {
  return `${CLOSE_BTN}<div class="bz-manv-body"><iframe class="bz-manv-frame" title="使用手册"></iframe></div>`;
}
