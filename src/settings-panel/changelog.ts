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
 *
 * 移动端（≤768px）真全屏（用户拍板，与手册弹窗同刀）：frame 挂 core .bz-panel-mtop
 * 得 44px 顶部避让，右上 44px 见方关闭钮落在这条避让带里——全屏后遮罩点不到，
 * 关闭只剩这一个出口（ESC 在手机上不可靠）。桌面端形态不变：居中弹窗、无头行、钮不出现。
 */
import { topifyZ } from '../core/z-order';
import { bindMaskDismiss } from '../core/mask-dismiss';
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

/** 弹窗是否正开着（issue 476：后台核对回来时判「还开着才热替换」） */
export function isChangelogOpen(): boolean {
  return isVisible();
}

/** 插件卸载清理：拆弹窗、注销 ESC 层（unloadSettingsPanel 调用，幂等） */
export function unloadChangelog(): void {
  escHandle?.unregister();
  escHandle = null;
  overlay?.remove();
  overlay = null;
}

/**
 * 打开更新日志弹窗（html = 更新日志完整 HTML 文本；重复打开 = 抬顶 + 换内容）。
 * initVersion = 启动自动弹（新版本检测）要落到的版本：日志页缺省显示 DATA.current，
 * 升级弹窗要让人看到的是**这一版**的内容——往 srcdoc 里补一段自选脚本，等版本栏
 * 渲染出来就替用户点一下对应那颗导航钮（对旧分发的日志 HTML 同样生效；找不到那颗钮
 * ——比如远端日志还没跟上——就停在缺省的「当前」版，不算错）。
 */
export function openChangelogModal(html: string, initVersion?: string): void {
  if (!overlay) build();
  topifyZ(overlay!); // ADR-0067：显示即发号（重开抬顶，谁后显示谁在上）
  overlay!.style.display = 'flex';
  trapPanelFocus(overlay!.querySelector<HTMLElement>(`#${FRAME_ID}`) ?? overlay!);
  // ESC 栈序与 z 序重同步（checkup/manual-viewer 同刀）：hide 型常驻层重开只抬 z 不抬 ESC 栈会失配
  escHandle?.unregister();
  escHandle = escManager.register('bz-changelog', { isVisible, close: hide });
  const frame = overlay!.querySelector<HTMLIFrameElement>(`#${FRAME_ID} iframe`)!;
  frame.srcdoc = initVersion ? injectVersionPick(html, initVersion) : html;
}

/* 版本自选脚本（拼进 srcdoc，随文档加载执行）：轮询等版本栏出现后点对应导航钮；
 * 40 次 ×100ms 还没有（旧 HTML / 该版本不在列表）就放弃，停在缺省「当前」版。 */
function injectVersionPick(html: string, version: string): string {
  const v = JSON.stringify(String(version));
  const snippet =
    '<script>(function(){var v=' + v + ',n=0;' +
    'var t=setInterval(function(){var b=document.querySelector(\'.cg-nav[data-v="\'+v+\'"]\');' +
    'if(b){clearInterval(t);b.click();return}if(++n>40)clearInterval(t)},100)})();</scr' + 'ipt>';
  return html.includes('</body>') ? html.replace('</body>', snippet + '</body>') : html + snippet;
}

function build(): void {
  const ov = document.createElement('div');
  ov.id = OVERLAY_ID;
  ov.className = 'bz-panel-overlay';
  const frame = document.createElement('div');
  frame.id = FRAME_ID;
  frame.className = 'bz-panel-frame bz-sp-skin bz-panel-mtop bz-chg-popup';
  frame.innerHTML = shellHtml();
  frame.querySelector<HTMLElement>('.bz-chg-close')?.addEventListener('click', hide);
  ov.appendChild(frame);
  // 点遮罩关闭：手势配对判据（core/mask-dismiss）——跨元素松手不算点击
  bindMaskDismiss(ov, hide);
  document.body.appendChild(ov);
  overlay = ov;
}

/** ✕ 关闭钮（仅移动端可见：全屏后遮罩点不到，关闭得有实体出口；桌面走遮罩 / ESC） */
const CLOSE_BTN = `<button class="bz-chg-close" type="button" aria-label="关闭更新日志" title="关闭">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
</button>`;

/** 弹窗骨架（无头行——与手册弹窗同形态，用户拍板：外壳不出标题，零留白贴边） */
function shellHtml(): string {
  return `${CLOSE_BTN}<div class="bz-chg-body"><iframe class="bz-chg-frame" title="更新日志"></iframe></div>`;
}
