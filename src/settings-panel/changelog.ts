/**
 * 更新日志弹窗（issue 472）：设置面板侧栏底部入口 → 独立子弹窗，与面板同皮（frame 挂 .bz-sp-skin
 * 即得亮/暗两套 --sp-* 令牌）。壳走样式库 .bz-panel-overlay/.bz-panel-frame（components.css A 段），
 * hide 型常驻层范式随 checkup：重开抬顶（ADR-0067 topifyZ），ESC 栈序随显示序重放注册，
 * 插件卸载经 unloadSettingsPanel → unloadChangelog 收口。内容 = scripts/_gen-changelog.mjs
 * 从 git 提交历史生成的 changelog-data.ts（以域为纲，域内日期倒序）。
 */
import { topifyZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { uiIcon } from '../core/ui';
import { iconSpan, esc } from '../core/ui/str';
import { mountIcons } from '../core/ui/icons';
import { DOMAIN_ICONS } from '../core/domain-icons';
import { CHANGELOG_DOMAINS, CHANGELOG_META } from './changelog-data';
import type { ChangelogDomainData, ChangelogEntry, ChangelogType } from './changelog-data';

const OVERLAY_ID = 'bz-changelog-overlay';
const FRAME_ID = 'bz-changelog-popup';

/** 域图标：功能域复用 DOMAIN_ICONS（与设置导航同源），横切组就地补缺 */
const CHANGELOG_ICONS: Readonly<Record<string, string>> = {
  ...DOMAIN_ICONS,
  'settings-panel': DOMAIN_ICONS.global,
  core: 'waypoints',
  ui: 'monitor',
  checkup: 'activity',
  other: 'inbox',
};

const TYPE_LABEL: Readonly<Record<ChangelogType, string>> = { feat: '新增', fix: '修复', perf: '优化' };

let overlay: HTMLElement | null = null;
let escHandle: ReturnType<typeof escManager.register> | null = null;
let activeId: string | null = null;

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
  activeId = null;
}

/** 打开更新日志弹窗（重复打开 = 抬顶 + 恢复上次所在域） */
export function openChangelogModal(): void {
  if (!CHANGELOG_DOMAINS.length) return;
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

/** 弹窗骨架（头行复用 .bz-panel-head；主体 = 左域栏 + 右条目列表） */
function shellHtml(): string {
  return `<div class="bz-panel-head">` +
    `<div class="bz-panel-brand">${uiIcon('history')}</div>` +
    `<span class="bz-panel-title">更新日志</span>` +
    `<span class="bz-panel-head-pipe"></span>` +
    `<span class="bz-panel-head-sub">共 ${CHANGELOG_META.total} 条 · ${CHANGELOG_META.generatedAt} 自提交历史生成</span>` +
    `<span class="bz-panel-head-sp"></span></div>` +
    `<div class="bz-chg-body"><nav class="bz-chg-side"></nav><div class="bz-chg-main"></div></div>`;
}

function render(): void {
  if (!overlay) return;
  if (!activeId || !CHANGELOG_DOMAINS.some((d) => d.id === activeId)) {
    activeId = CHANGELOG_DOMAINS[0].id;
  }
  renderRail();
  renderList();
}

function renderRail(): void {
  const side = overlay!.querySelector('.bz-chg-side') as HTMLElement;
  side.innerHTML = CHANGELOG_DOMAINS.map((d) => navItemHtml(d, d.id === activeId)).join('');
  mountIcons(side);
  side.querySelectorAll<HTMLElement>('[data-chg-domain]').forEach((b) => {
    b.addEventListener('click', () => {
      activeId = b.dataset.chgDomain!;
      render();
    });
  });
}

function navItemHtml(d: ChangelogDomainData, on: boolean): string {
  return `<button type="button" class="bz-chg-nav-item${on ? ' on' : ''}" data-chg-domain="${esc(d.id)}">` +
    `${iconSpan(CHANGELOG_ICONS[d.id] ?? 'inbox', 'bz-ic bz-chg-nav-ic')}` +
    `<span class="bz-chg-nav-name">${esc(d.name)}</span>` +
    `<span class="bz-chg-nav-count">${d.entries.length}</span></button>`;
}

function renderList(): void {
  const main = overlay!.querySelector('.bz-chg-main') as HTMLElement;
  const d = CHANGELOG_DOMAINS.find((x) => x.id === activeId);
  main.innerHTML = d ? listHtml(d) : '';
  main.scrollTop = 0;
}

function listHtml(d: ChangelogDomainData): string {
  return `<div class="bz-chg-list-head"><span class="bz-chg-list-name">${esc(d.name)}</span>` +
    `<span class="bz-chg-list-count">${d.entries.length} 条</span></div>` +
    d.entries.map(itemHtml).join('');
}

function itemHtml(e: ChangelogEntry): string {
  return `<div class="bz-chg-item">` +
    `<span class="bz-chg-date">${e.date}</span>` +
    `<span class="bz-chg-badge bz-chg-badge--${e.type}">${TYPE_LABEL[e.type]}</span>` +
    `<span class="bz-chg-text">${esc(e.text)}</span></div>`;
}
