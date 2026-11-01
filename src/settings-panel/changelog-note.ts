/* ============================================================
 * bz · 更新提示小窗（settings-panel/changelog-note.ts）
 *
 * 2026-11-02 用户拍板：升级后的提示不再弹「整页更新日志」，只弹这一张小窗，
 * 且**只在第一次打开 bz 任意界面时**弹一次。
 *
 * 同日二次拍板（替代「按 seen 掐区间」的写法）：日志既然已经内置，就别猜用户跨了几版——
 * **把内置的版本全列出来**，最新那版直接展开；更早的收在**一整块**折叠里，
 * 点开是连续的文本流（每版一个小标题），用户自己滚着往下看（2026-11-02 三次拍板：
 * 不要一版一个折叠行）。数据量（当前 32 版）对包体没压力。
 *
 * 与 settings-panel/changelog.ts（设置面板里的全量日志弹窗）是两件事：
 * 那个走 iframe srcdoc 内嵌远端整页；这个吃内置的 CHANGELOG_RELEASES，自己排版。
 *
 * 版式（2026-11-02 定稿，1:1 复刻 .scratch/changelog-note/note-b.html）：
 * 顶部 2px accent 渐变细条 → v 徽标 / 日期 / 改动数 → 「本次更新」→
 * 三段（accent 竖线只给「新功能」，其余普通线）→ 更早版本整块折叠 → 页脚主动作 + 四个外部入口。
 * 正文能滚但不显示滚动条（本域统一口径），底部 24px 渐隐只在「还有且没到底」时亮。
 *
 * 移动端（≤768px）改为底部升起：不改 mask，靠 popup 自身
 * `position: fixed; bottom: 0` 贴底——遮罩此时点不到，所以右上必须有实体关闭钮。
 * ============================================================ */
import { uiModal } from '../core/ui/modal';
import { escapeHtml } from '../core/utils';
import { normalizeVersion } from '../core/version';
import { releaseEntryCount, type ChangelogEntry, type ChangelogRelease } from '../core/changelog-data';
import { bindChangelogLinks, changelogLinksHtml } from './changelog-links';

/** 三段定义：新功能用 accent 竖线，体验优化与问题修复用普通线 */
const SECTIONS: { key: 'added' | 'improved' | 'fixed'; label: string; primary: boolean }[] = [
  { key: 'added', label: '新功能', primary: true },
  { key: 'improved', label: '体验优化', primary: false },
  { key: 'fixed', label: '问题修复', primary: false },
];

/** 一条条目：域名固定 54px 左列 + 正文（可带一行更淡的副行） */
function itemHtml(entry: ChangelogEntry): string {
  const sub = entry.sub ? `<span class="bz-chg-sub">${escapeHtml(entry.sub)}</span>` : '';
  return (
    '<div class="bz-chg-item">' +
    `<span class="bz-chg-dom">${escapeHtml(entry.domain || '')}</span>` +
    `<div class="bz-chg-txt"><p>${escapeHtml(entry.text || '')}</p>${sub}</div>` +
    '</div>'
  );
}

/** 三段正文（空段不渲染） */
function sectionsHtml(release: ChangelogRelease): string {
  return SECTIONS.map((sec) => {
    const list = release[sec.key] || [];
    if (!list.length) return '';
    return (
      `<section class="bz-chg-sec${sec.primary ? ' pri' : ''}"><div class="bz-chg-rail">` +
      `<div class="bz-chg-sec-h">${sec.label}</div>` +
      list.map(itemHtml).join('') +
      '</div></section>'
    );
  }).join('');
}

/**
 * 更早的版本：**一整块**折叠（2026-11-02 用户拍板：不要一版一个折叠行）。
 * 收起时只有一行「更早的版本 · N 版」，点开以后所有旧版本按新→旧连续铺下来，
 * 每版一个小标题 + 正文，用户直接往下滚着看——像读一条长日志，而不是逐行点 31 次。
 */
function oldVersionsHtml(older: readonly ChangelogRelease[]): string {
  if (!older.length) return '';
  const body = older
    .map((release) => {
      const count = releaseEntryCount(release);
      const date = release.date ? `<span class="bz-chg-date">${escapeHtml(release.date)}</span>` : '';
      const countHtml = count ? `<span class="bz-chg-count">${count} 处改动</span>` : '';
      return (
        '<section class="bz-chg-oldrel">' +
        '<div class="bz-chg-oldrel-h">' +
        `<span class="bz-chg-oldrel-v">v${escapeHtml(release.version)}</span>${date}${countHtml}` +
        '</div>' +
        sectionsHtml(release) +
        '</section>'
      );
    })
    .join('');
  return (
    '<div class="bz-chg-old">' +
    '<button class="bz-chg-old-h" type="button" aria-expanded="false">' +
    `<span class="bz-chg-old-t">更早的版本 · ${older.length} 版</span>` +
    '<svg class="bz-chg-chev" viewBox="0 0 24 24" width="13" height="13" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="m6 9 6 6 6-6"/></svg>' +
    '</button>' +
    `<div class="bz-chg-old-body">${body}</div>` +
    '</div>'
  );
}

export interface ChangelogNoteHandle {
  close: () => void;
}

/**
 * 弹出「本次更新」小窗：`releases` 按**新→旧**给（内置数据本就是这个顺序）。
 * 最新那版直接展开，更早的版本收在**一整块**折叠里，点开是连续文本流。
 *
 * `expectVersion`：本次要提示的版本。给了就按它定位「最新一版」——调用方
 * （main.ts）已经用 `pickReleaseFor` 验过它在数据里，这里再按它取一次，
 * 是为了让「验的版本」和「渲染的版本」是同一个值；不给则默认数组第一条。
 *
 * 返回关闭句柄（插件卸载 / 测试收口用；正常交互走按钮、遮罩、ESC）。
 * 空数组 = 没有可展示的内容，调用方本就不该调到这里，此时直接不弹。
 */
export function openChangelogNote(
  releases: readonly ChangelogRelease[],
  expectVersion?: string,
): ChangelogNoteHandle {
  const list = releases.filter((r) => releaseEntryCount(r) > 0);
  if (!list.length) return { close: () => {} };

  const target = expectVersion ? normalizeVersion(expectVersion) : '';
  const at = target ? list.findIndex((r) => normalizeVersion(r.version) === target) : 0;
  const start = at >= 0 ? at : 0;
  const newest = list[start];
  const older = list.slice(start + 1);
  const count = releaseEntryCount(newest);
  const date = newest.date ? `<span class="bz-chg-date">${escapeHtml(newest.date)}</span>` : '';
  const countHtml = count ? `<span class="bz-chg-count">${count} 处改动</span>` : '';
  const olderHtml = oldVersionsHtml(older);

  const content =
    '<div class="bz-chg-strip"></div>' +
    '<div class="bz-chg-grab"></div>' +
    '<div class="bz-chg-head">' +
    '<div class="bz-chg-headmain">' +
    `<div class="bz-chg-tags"><span class="bz-chg-badge">v${escapeHtml(newest.version)}</span>${date}${countHtml}</div>` +
    '<h2 class="bz-chg-title">本次更新</h2>' +
    '</div>' +
    '<button class="bz-chg-close" type="button" aria-label="关闭更新提示" title="关闭">' +
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
    '</button>' +
    '</div>' +
    '<div class="bz-chg-scrollwrap">' +
    `<div class="bz-chg-scroll">${sectionsHtml(newest)}${olderHtml}</div>` +
    '<div class="bz-chg-fade"></div>' +
    '</div>' +
    '<div class="bz-chg-foot">' +
    '<button class="bz-chg-ok" type="button">知道了</button>' +
    '<span class="bz-chg-grow"></span>' +
    `<span class="bz-chg-links">${changelogLinksHtml()}</span>` +
    '</div>';

  // bz-sp-skin 不能省：本窗的配色全部吃 --sp-* 令牌，而令牌只定义在 .bz-sp-skin 作用域里。
  // 少了它，--sp-* 全部取不到值 → padding/圆角还在、底色与文字色全空，看着就是「没样式」。
  const modal = uiModal({ content, className: 'bz-chg-note bz-sp-skin', title: '本次更新' });
  const popup = modal.popup;
  popup.querySelector('.bz-chg-ok')?.addEventListener('click', () => modal.close());
  popup.querySelector('.bz-chg-close')?.addEventListener('click', () => modal.close());
  bindChangelogLinks(popup);

  // 溢出且还没到底才亮底部渐隐：没超时不该出现（像「下面还有」的假提示），
  // 已经滚到底也别亮——渐隐会一直压住最后一行的下半截。
  const scroll = popup.querySelector<HTMLElement>('.bz-chg-scroll');
  const wrap = popup.querySelector<HTMLElement>('.bz-chg-scrollwrap');
  const syncFade = (): void => {
    // 窗已经关了（点了「知道了」/×/遮罩/ESC 都会绕过 handle.close）就顺手把监听摘掉——
    // 否则每关一次留一个 resize 监听，之后每次改窗口大小都对摘掉的节点跑一遍。
    if (!scroll || !wrap || !scroll.isConnected) {
      window.removeEventListener('resize', syncFade);
      return;
    }
    const overflow = scroll.scrollHeight - scroll.clientHeight > 2;
    const atBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2;
    wrap.classList.toggle('more', overflow && !atBottom);
  };

  // 更早的版本：一整块折叠开关。内容已经在 DOM 里（收起时 display:none 不参与排版），
  // 点开就是一条连续的文本流，往下滚就行——不用一版一点。
  const oldBlock = popup.querySelector<HTMLElement>('.bz-chg-old');
  const oldHead = oldBlock?.querySelector<HTMLElement>('.bz-chg-old-h');
  oldHead?.addEventListener('click', () => {
    const open = !oldBlock!.classList.contains('open');
    oldBlock!.classList.toggle('open', open);
    oldHead.setAttribute('aria-expanded', open ? 'true' : 'false');
    syncFade();
  });

  scroll?.addEventListener('scroll', syncFade, { passive: true });
  window.addEventListener('resize', syncFade);
  // 首帧：等排版落定再量（同一帧内量会拿到 0）
  requestAnimationFrame(syncFade);

  return {
    close: () => {
      window.removeEventListener('resize', syncFade);
      modal.close();
    },
  };
}
