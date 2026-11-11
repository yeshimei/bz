/* ============================================================
 * bz · 更新日志弹窗（settings-panel/changelog-note.ts）
 *
 * 一个弹窗，两个门面（2026-11-02 用户拍板「两者就是一个」）：
 *  - 升级后第一次打开 bz 任何界面时自动弹（main.ts showChangelogNote）；
 *  - 设置页左侧「文档 → 更新日志」打开它。
 * 内容全部吃内置数据（core/changelog-data），不下载、不联网、不读远端 html。
 *
 * 版式 1:1 复刻原型 .scratch/proto-changelog/unified-log.html：
 *  桌面（>768px） 214px 版本时间轴（细线串点，当前版实心点）+ 右侧单版正文
 *                （眉标 / 大号等宽版本号 / 改动统计 → 三段 → 右下入口图标）；
 *  移动（≤768px） 不设版本栏：顶栏（标题 + 关闭）+ 全部版本按新→旧铺成一篇文档流
 *                + 右下浮动入口条（手机上一滚页脚就没了，浮条才是长文档的归属）。
 *
 * 两端共用一份 DOM，靠 CSS 媒体查询切换——不在 JS 里判断宽度，改窗口大小也不会错位。
 * 正文滚动条两端都藏掉，靠上下渐隐提示「还有内容」。
 *
 * 关窗先问一句（2026-11-09 用户拍板）：点 × / 点遮罩 / ESC 都不直接关，先叠一张
 * 「支持作者」提醒（core/support-prompt）——选「支持作者」进赞赏扫码窗，选「以后再说」
 * 两个窗一起收。三条关闭路径共用一个出口，不存在「点遮罩能偷偷关掉」这种事。
 * ============================================================ */
import { uiModal } from '../core/ui/modal';
import { escapeHtml } from '../core/utils';
import { normalizeVersion } from '../core/version';
import { releaseEntryCount, type ChangelogEntry, type ChangelogRelease } from '../core/changelog-data';
import { openSupportPrompt } from '../core/support-prompt';
import { bindChangelogLinks, changelogLinksHtml } from './changelog-links';
import { refreshPatrons } from '../core/patron-list';

/** 三段定义（顺序即渲染顺序；标签与线上日志文档同一套措辞） */
const SECTIONS: { key: 'added' | 'improved' | 'fixed'; label: string; cls: string }[] = [
  { key: 'added', label: '新功能', cls: 'bz-chgn-g-add' },
  { key: 'improved', label: '体验优化', cls: 'bz-chgn-g-imp' },
  { key: 'fixed', label: '修复', cls: 'bz-chgn-g-fix' },
];

/** 2026-11-02 → 2026.11.02（等宽数字里点比短横线安静） */
function fmtDate(date?: string): string {
  return escapeHtml((date || '').replace(/-/g, '.'));
}

function countText(n: number): string {
  return `${n} 处改动`;
}

/* ── 右栏正文（桌面） ─────────────────────────────── */

function rowsHtml(list: readonly ChangelogEntry[]): string {
  return list
    .map(
      (e) =>
        '<div class="bz-chgn-row">' +
        `<span class="bz-chgn-k">${escapeHtml(e.domain || '')}</span>` +
        `<span class="bz-chgn-t">${escapeHtml(e.text || '')}</span>` +
        '</div>',
    )
    .join('');
}

function groupsHtml(release: ChangelogRelease): string {
  const out = SECTIONS.map((sec) => {
    const list = release[sec.key] || [];
    if (!list.length) return '';
    return (
      '<section class="bz-chgn-grp">' +
      `<div class="bz-chgn-grp-hd"><i class="${sec.cls}"></i>${sec.label}` +
      `<span class="bz-chgn-grp-cnt">${list.length}</span></div>` +
      rowsHtml(list) +
      '</section>'
    );
  }).join('');
  return out || '<div class="bz-chgn-empty">这一版没有记录。</div>';
}

/** 右栏头部：眉标 + 版本号 + 统计（选中项变了只换这一块和正文） */
function headHtml(release: ChangelogRelease, isNewest: boolean): string {
  const total = releaseEntryCount(release);
  const parts = SECTIONS.filter((s) => (release[s.key] || []).length).map(
    (s) => `${s.label} ${(release[s.key] || []).length}`,
  );
  const meta = [`共 ${total} 处改动`, ...parts].join('<span class="bz-chgn-sep"></span>');
  return (
    `<div class="bz-chgn-eyebrow">${isNewest ? '本次更新' : '历史版本'}</div>` +
    `<h1 class="bz-chgn-ver">v${escapeHtml(release.version)}` +
    `<small>${fmtDate(release.date)}</small></h1>` +
    `<div class="bz-chgn-meta">${meta}</div>`
  );
}

/* ── 移动端正文（整篇文档流） ─────────────────────── */

function mobBlocksHtml(release: ChangelogRelease): string {
  return SECTIONS.map((sec) => {
    const list = release[sec.key] || [];
    if (!list.length) return '';
    return (
      '<div class="bz-chgn-mblk">' +
      `<div class="bz-chgn-mblk-t"><i class="${sec.cls}"></i>${sec.label}` +
      `<span class="bz-chgn-mcnt">${list.length}</span></div>` +
      list
        .map(
          (e) =>
            '<div class="bz-chgn-mit">' +
            `<span class="bz-chgn-mdom">${escapeHtml(e.domain || '')}</span>` +
            `<span class="bz-chgn-mtxt">${escapeHtml(e.text || '')}</span>` +
            '</div>',
        )
        .join('') +
      '</div>'
    );
  }).join('');
}

function mobPageHtml(list: readonly ChangelogRelease[]): string {
  return list
    .map(
      (r, i) =>
        '<section class="bz-chgn-mrel">' +
        '<div class="bz-chgn-mrel-hd">' +
        `<span class="bz-chgn-mver">v${escapeHtml(r.version)}</span>` +
        (i === 0 ? '<span class="bz-chgn-mcur">当前</span>' : '') +
        `<span class="bz-chgn-mdate">${fmtDate(r.date)}</span>` +
        '</div>' +
        mobBlocksHtml(r) +
        '</section>',
    )
    .join('');
}

/* ── 左栏版本时间轴（桌面） ───────────────────────── */

function railHtml(list: readonly ChangelogRelease[], active: number): string {
  const items = list
    .map(
      (r, i) =>
        `<button class="bz-chgn-v${i === active ? ' on' : ''}" type="button" data-i="${i}"` +
        `${i === active ? ' aria-current="true"' : ''}>` +
        `<span class="v">v${escapeHtml(r.version)}</span>` +
        `<span class="d">${fmtDate(r.date)}</span>` +
        `<span class="n">${countText(releaseEntryCount(r))}</span>` +
        '</button>',
    )
    .join('');
  return (
    '<div class="bz-chgn-rail-hd"><b>版本历史</b>' +
    `<span>${list.length} 版</span></div>` +
    `<div class="bz-chgn-rail-list">${items}</div>`
  );
}

const CLOSE_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

const CLOCK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>' +
  '<path d="M12 7v5l3 2"/></svg>';

export interface ChangelogNoteHandle {
  close: () => void;
}

/**
 * 打开更新日志弹窗。`releases` 按**新→旧**给（内置数据本就是）。
 *
 * `expectVersion`：本次要提示的版本（main.ts 已用 `pickReleaseFor` 验过它在数据里）。
 * 桌面端据此把时间轴停在那一版；不给则停在最新一版。移动端是整篇文档流，用不到它。
 *
 * 返回关闭句柄（插件卸载 / 测试收口用）；正常交互走右上 × 、点遮罩、ESC。
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

  const links = changelogLinksHtml();
  const content =
    // 桌面：时间轴 + 单版正文 + 页脚（关闭钮与页脚留在固定层，切版本不重建，省得反复绑事件）
    '<div class="bz-chgn">' +
    '<aside class="bz-chgn-rail"></aside>' +
    '<main class="bz-chgn-pane">' +
    '<div class="bz-chgn-hd"></div>' +
    '<div class="bz-chgn-wrap">' +
    '<div class="bz-chgn-fade-top"></div>' +
    '<div class="bz-chgn-body"></div>' +
    '<div class="bz-chgn-fade-bot"></div>' +
    '</div>' +
    '</main>' +
    `<footer class="bz-chgn-ft"><span class="bz-chgn-grow"></span>${links}</footer>` +
    `<button class="bz-chgn-close" type="button" aria-label="关闭更新日志" title="关闭">${CLOSE_SVG}</button>` +
    '</div>' +
    // 移动端：整篇文档流（同一份数据再排一遍，≤768px 由 CSS 切过来）
    '<div class="bz-chgn-m">' +
    `<div class="bz-chgn-mbar"><div class="bz-chgn-mtitle">${CLOCK_SVG}更新日志</div>` +
    `<button class="bz-chgn-close" type="button" aria-label="关闭更新日志" title="关闭">${CLOSE_SVG}</button>` +
    '</div>' +
    `<div class="bz-chgn-mpage">${mobPageHtml(list)}</div>` +
    `<div class="bz-chgn-mtools">${links}</div>` +
    '</div>';

  // bz-sp-skin 不能省：本窗配色全吃 --sp-* 令牌，而令牌只定义在 .bz-sp-skin 作用域里。
  // onClose 摘 resize 监听：遮罩 / ESC / × 关窗都不经过下面返回的句柄，只挂在句柄上
  // 得等下一次窗口 resize 才自清。（syncFade 是函数声明，此处引用已在提升范围内。）
  //
  // requestClose（2026-11-09）：关窗先问一句要不要支持作者。×、点遮罩、ESC 三条路
  // 都交给它，日志窗停在提醒窗之下不动——选「以后再说」才一起收。
  const modal = uiModal({
    content,
    className: 'bz-chg-note bz-sp-skin',
    title: '更新日志',
    onClose: () => window.removeEventListener('resize', syncFade),
    requestClose: () => closeWithPrompt(),
  });
  const popup = modal.popup;

  /* 名单订阅的退订句柄：正常关闭（点 × / 遮罩 / ESC 都会走 closeWithPrompt）
     与卸载 / 测试收口（返回的 close）都退掉——不然反复开关弹窗会在
     core/patron-list 的监听集合里留一堆已关闭的弹窗。 */
  let offLinks: () => void = () => {};

  /** 关窗前的最后一问（2026-11-09 用户拍板）。
   *  - 「支持作者」→ 两窗收掉，打开赞赏扫码窗（core/reward-dialog）；
   *  - 「以后再说」/ 遮罩 / ESC → 提醒窗与日志窗一起收掉。
   *  `asking` 是单飞闸：提醒窗已经开着时再点遮罩/ESC，不叠第二个提醒窗。 */
  let asking = false;
  function closeWithPrompt(): void {
    if (asking) return;
    asking = true;
    void openSupportPrompt().then((choice) => {
      asking = false;
      offLinks();
      modal.close();
      if (choice === 'support') {
        // 赞赏码 68KB，动态引入——只为真的点下去的人付这份体积
        void import('../core/reward-dialog').then((m) => m.openRewardDialog());
      }
    });
  }

  const rail = popup.querySelector<HTMLElement>('.bz-chgn-rail');
  const hd = popup.querySelector<HTMLElement>('.bz-chgn-hd');
  const body = popup.querySelector<HTMLElement>('.bz-chgn-body');
  const fadeTop = popup.querySelector<HTMLElement>('.bz-chgn-fade-top');
  const fadeBot = popup.querySelector<HTMLElement>('.bz-chgn-fade-bot');

  // 上下渐隐：有溢出才提示，已经到头/到底就撤——别拿假的「还有内容」骗人
  function syncFade(): void {
    if (!body || !body.isConnected) {
      window.removeEventListener('resize', syncFade);
      return;
    }
    const more = body.scrollHeight - body.clientHeight > 2;
    fadeTop?.classList.toggle('show', more && body.scrollTop > 4);
    fadeBot?.classList.toggle('show', more && body.scrollTop + body.clientHeight < body.scrollHeight - 4);
  }

  let cur = start;
  const select = (i: number): void => {
    cur = i;
    const r = list[i];
    if (hd) hd.innerHTML = headHtml(r, i === 0);
    if (body) {
      body.innerHTML = groupsHtml(r);
      body.scrollTop = 0;
    }
    rail?.querySelectorAll<HTMLElement>('.bz-chgn-v').forEach((el) => {
      const on = Number(el.dataset.i) === i;
      el.classList.toggle('on', on);
      if (on) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
    requestAnimationFrame(syncFade);
  };

  if (rail) rail.innerHTML = railHtml(list, start);
  rail?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.bz-chgn-v');
    if (!btn) return;
    select(Number(btn.dataset.i) || 0);
  });
  select(start);

  body?.addEventListener('scroll', syncFade, { passive: true });
  window.addEventListener('resize', syncFade);
  // wrap 高度随排版落定才准，首帧量一次会拿到 0
  requestAnimationFrame(syncFade);

  popup.querySelectorAll<HTMLElement>('.bz-chgn-close').forEach((btn) => {
    btn.addEventListener('click', () => closeWithPrompt());
  });
  /* 名单是在线拉的：先按缓存画出人数，拉到后 bindChangelogLinks 的订阅原地补；
     打开时顺手拉一次（60 秒节流在 core/patron-list）。 */
  offLinks = bindChangelogLinks(popup);
  void refreshPatrons();

  return {
    close: () => {
      // 卸载 / 测试收口走这条路：**不弹**提醒（插件正在消失，问一句没有意义）
      window.removeEventListener('resize', syncFade);
      offLinks();
      modal.close();
    },
  };
}
