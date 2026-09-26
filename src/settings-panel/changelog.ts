/**
 * 更新日志弹窗（issue 472 v2）：设置面板侧栏底部入口 → 独立子弹窗，与面板同皮（frame 挂 .bz-sp-skin
 * 即得亮/暗两套 --sp-* 令牌）。壳走样式库 .bz-panel-overlay/.bz-panel-frame（components.css A 段），
 * hide 型常驻层范式随 checkup：重开抬顶（ADR-0067 topifyZ），ESC 栈序随显示序重放注册，
 * 插件卸载经 unloadSettingsPanel → unloadChangelog 收口。
 * 内容 = scripts/_gen-changelog.mjs 从 git 提交历史生成的 changelog-data.ts：
 * 以版本为纲（最新版回写 manifest），块内分「新功能 / 问题修复 / 体验优化」三段主次，
 * 条目 = 域标签 + 主题句 + 弱化副行——写给人看，不写实现细节。
 */
import { topifyZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { uiIcon } from '../core/ui';
import { esc } from '../core/ui/str';
import { mountIcons } from '../core/ui/icons';
import { CHANGELOG_RELEASES, CHANGELOG_META, CHANGELOG_DOMAIN_NAMES } from './changelog-data';
import type { ChangelogRelease, ChangelogItem } from './changelog-data';

const OVERLAY_ID = 'bz-changelog-overlay';
const FRAME_ID = 'bz-changelog-popup';

type SectionKey = 'added' | 'fixed' | 'improved';
const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: 'added', label: '新功能' },
  { key: 'fixed', label: '问题修复' },
  { key: 'improved', label: '体验优化' },
];

let overlay: HTMLElement | null = null;
let escHandle: ReturnType<typeof escManager.register> | null = null;
let activeVersion: string | null = null;

function isVisible(): boolean {
  return !!overlay && overlay.style.display === 'flex';
}

function hide(): void {
  if (overlay) overlay.style.display = 'none';
}

/** 插件卸载清理：拆弹窗、注销 ESC 层（unloadSettingsPanel 调用，幂等） */
export function unloadChangelog(): void {
  escHandle?.unregister();
  escHandle = null;
  overlay?.remove();
  overlay = null;
  activeVersion = null;
}

/** 打开更新日志弹窗（重复打开 = 抬顶 + 恢复上次所在版本） */
export function openChangelogModal(): void {
  if (!CHANGELOG_RELEASES.length) return;
  if (!overlay) build();
  topifyZ(overlay!); // ADR-0067：显示即发号（重开抬顶，谁后显示谁在上）
  overlay!.style.display = 'flex';
  trapPanelFocus(overlay!.querySelector<HTMLElement>(`#${FRAME_ID}`) ?? overlay!);
  // ESC 栈序与 z 序重同步（checkup 同刀）：hide 型常驻层重开只抬 z 不抬 ESC 栈会失配
  escHandle?.unregister();
  escHandle = escManager.register('bz-changelog', { isVisible, close: hide });
  render();
}

function build(): void {
  const ov = document.createElement('div');
  ov.id = OVERLAY_ID;
  ov.className = 'bz-panel-overlay';
  const frame = document.createElement('div');
  frame.id = FRAME_ID;
  frame.className = 'bz-panel-frame bz-sp-skin bz-chg-popup';
  frame.innerHTML = shellHtml();
  mountIcons(frame);
  ov.appendChild(frame);
  ov.addEventListener('click', (e) => {
    if (e.target === ov) hide();
  });
  document.body.appendChild(ov);
  overlay = ov;
}

/** 弹窗骨架（头行复用 .bz-panel-head；主体 = 左版本栏 + 右版本内容） */
function shellHtml(): string {
  return `<div class="bz-panel-head">` +
    `<div class="bz-panel-brand">${uiIcon('history')}</div>` +
    `<span class="bz-panel-title">更新日志</span>` +
    `<span class="bz-panel-head-pipe"></span>` +
    `<span class="bz-panel-head-sub">v${CHANGELOG_META.current} · ${CHANGELOG_META.releases} 个版本 · ${CHANGELOG_META.generatedAt} 生成</span>` +
    `<span class="bz-panel-head-sp"></span></div>` +
    `<div class="bz-chg-body"><nav class="bz-chg-side"></nav><div class="bz-chg-main"></div></div>`;
}

function render(): void {
  if (!overlay) return;
  if (!activeVersion || !CHANGELOG_RELEASES.some((r) => r.version === activeVersion)) {
    activeVersion = CHANGELOG_RELEASES[CHANGELOG_RELEASES.length - 1].version; // 默认最新
  }
  renderRail();
  renderRelease();
}

function renderRail(): void {
  const side = overlay!.querySelector('.bz-chg-side') as HTMLElement;
  // 新版本在上（更新日志惯例：最新在前）
  side.innerHTML = [...CHANGELOG_RELEASES].reverse().map((r) => navItemHtml(r, r.version === activeVersion)).join('');
  side.querySelectorAll<HTMLElement>('[data-chg-version]').forEach((b) => {
    b.addEventListener('click', () => {
      activeVersion = b.dataset.chgVersion!;
      render();
    });
  });
}

function navItemHtml(r: ChangelogRelease, on: boolean): string {
  const date = r.date.slice(5); // MM-DD（完整日期在右栏版本头）
  return `<button type="button" class="bz-chg-nav-item${on ? ' on' : ''}${r.current ? ' cur' : ''}" data-chg-version="${esc(r.version)}">` +
    `<span class="bz-chg-nav-ver">v${esc(r.version)}</span>` +
    (r.current ? `<span class="bz-chg-nav-cur">当前</span>` : '') +
    `<span class="bz-chg-nav-date">${esc(date)}</span></button>`;
}

function renderRelease(): void {
  const main = overlay!.querySelector('.bz-chg-main') as HTMLElement;
  const rel = CHANGELOG_RELEASES.find((x) => x.version === activeVersion);
  main.innerHTML = rel ? releaseHtml(rel) : '';
  main.scrollTop = 0;
}

function releaseHtml(r: ChangelogRelease): string {
  return `<div class="bz-chg-rel-head">` +
    `<span class="bz-chg-rel-ver">v${esc(r.version)}</span>` +
    (r.current ? `<span class="bz-chg-rel-cur">当前版本</span>` : '') +
    `<span class="bz-chg-rel-date">${esc(r.date)}</span></div>` +
    SECTIONS.filter((s) => r[s.key].length)
      .map((s) => sectionHtml(s.key, s.label, r[s.key]))
      .join('');
}

function sectionHtml(key: SectionKey, label: string, items: ChangelogItem[]): string {
  const tier = key === 'added' ? 'pri' : 'sec';
  return `<div class="bz-chg-sec"><div class="bz-chg-sec-t bz-chg-sec-t--${tier}">${label}</div>` +
    items.map((it) => itemHtml(it, tier)).join('') +
    `</div>`;
}

function itemHtml(it: ChangelogItem, tier: 'pri' | 'sec'): string {
  const dom = CHANGELOG_DOMAIN_NAMES[it.domain] ?? '其他';
  return `<div class="bz-chg-item bz-chg-item--${tier}">` +
    `<span class="bz-chg-dom">${esc(dom)}</span>` +
    `<div class="bz-chg-entry"><div class="bz-chg-text">${esc(it.text)}</div>` +
    (it.sub ? `<div class="bz-chg-sub">${esc(it.sub)}</div>` : '') +
    `</div></div>`;
}
