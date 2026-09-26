/**
 * 更新日志弹窗（issue 472 立；issue 474 改为在线下载 + iframe srcdoc 内嵌）：
 * 设置面板侧栏 footer 入口 → 独立子弹窗，与面板同皮（frame 挂 .bz-sp-skin
 * 即得亮/暗两套 --sp-* 令牌）。壳走样式库 .bz-panel-overlay/.bz-panel-frame
 * （components.css A 段），hide 型常驻层范式随 checkup：重开抬顶（ADR-0067
 * topifyZ），ESC 栈序随显示序重放注册，插件卸载经 unloadSettingsPanel →
 * unloadChangelog 收口。
 *
 * 无头行（与使用手册弹窗同形态，用户拍板）：外壳不出标题，日志文档自带的内容
 * 即全部信息；iframe 满铺零留白，滚动全交 iframe 内文档。
 *
 * 内容（issue 474 拍板）= 现场从 GitHub 下载的 manual/bz-changelog.html
 * （单文件自包含：样式 + 版本数据 + 版本栏脚本全内联），用 iframe srcdoc
 * 直灌——与使用手册（manual-viewer）同一套范式，版本栏/三段主次/主题记忆
 * 都随 HTML 走，主包不再内嵌日志数据。关闭即清 srcdoc 释放内存。
 */
import { topifyZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';

const OVERLAY_ID = 'bz-changelog-overlay';
const FRAME_ID = 'bz-changelog-popup';

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
export function unloadChangelog(): void {
  escHandle?.unregister();
  escHandle = null;
  overlay?.remove();
  overlay = null;
}

/** 打开更新日志弹窗（html = 更新日志完整 HTML 文本；重复打开 = 抬顶 + 换内容） */
export function openChangelogModal(html: string): void {
  if (!overlay) build();
  topifyZ(overlay!); // ADR-0067：显示即发号（重开抬顶，谁后显示谁在上）
  overlay!.style.display = 'flex';
  trapPanelFocus(overlay!.querySelector<HTMLElement>(`#${FRAME_ID}`) ?? overlay!);
  // ESC 栈序与 z 序重同步（checkup/manual-viewer 同刀）：hide 型常驻层重开只抬 z 不抬 ESC 栈会失配
  escHandle?.unregister();
  escHandle = escManager.register('bz-changelog', { isVisible, close: hide });
  const frame = overlay!.querySelector<HTMLIFrameElement>(`#${FRAME_ID} iframe`)!;
  frame.srcdoc = html;
}

function build(): void {
  const ov = document.createElement('div');
  ov.id = OVERLAY_ID;
  ov.className = 'bz-panel-overlay';
  const frame = document.createElement('div');
  frame.id = FRAME_ID;
  frame.className = 'bz-panel-frame bz-sp-skin bz-chg-popup';
  frame.innerHTML = shellHtml();
  ov.appendChild(frame);
  ov.addEventListener('click', (e) => {
    if (e.target === ov) hide();
  });
  document.body.appendChild(ov);
  overlay = ov;
}

/** 弹窗骨架（无头行——与手册弹窗同形态，用户拍板：外壳不出标题，零留白贴边） */
function shellHtml(): string {
  return `<div class="bz-chg-body"><iframe class="bz-chg-frame" title="更新日志"></iframe></div>`;
}
