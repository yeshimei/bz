/* ============================================================
 * bz · 赞赏弹窗（core/reward-dialog.ts）
 *
 * 设置 → 关于 → 「支持作者」按钮打开的独立弹窗：一张微信赞赏码 + 一份留名名单。
 * 版式一比一来自 `.scratch/reward/empty.html` 定稿（2026-10-30 用户逐轮确认：
 * 米白纸、金色、衬线题赠、信笺横线空态、底部金弧），**样式值不随设计 token 改**——
 * 这里不是通用组件，是一张「纸」，明暗主题下都保持纸的样子。
 *
 * 名单 2026-11-11 起是**在线数据**（主仓 docs/patrons.json，见 core/patron-list）：
 * 这一窗先按缓存画，拉到新名单只换名单区；拉失败给一枚重试，不把「网络故障」
 * 画成「还没有人打赏」。关窗要退订，否则每开一次多挂一个订阅者。
 *
 * 赞赏码为什么内置：图固定不变、68KB，走 downloads/ 远端要等一次网络往返，
 * 且清单层只支持单文件文本与 tar.gz 目录包，为此单开一条二进制通道不划算。
 * 走 esbuild 的 dataurl loader（esbuild.config.mjs），源码里就是一行 import。
 *
 * 渲染（名单列表 / 空态信笺 / 弹窗骨架）在本文件；
 * 取数与校验在 patron-list.ts；类型与日期在 reward-names.ts。
 * ============================================================ */
import { uiModal } from './ui/modal';
import { escapeHtml, openExternalUrl } from './utils';
import { getApp } from './app';
import { REPO_SLUG } from './remote-base';
import { formatRewardDate, type RewardName } from './reward-names';
import {
  currentPatrons,
  onPatronsChange,
  patronsStatus,
  refreshPatrons,
  type PatronsStatus,
} from './patron-list';
import { SUPPORT_PITCH, SUPPORT_PITCH_REST } from './support-prompt';
import rewardCodeUrl from './assets/reward-code.png';

/** 赞助商店（2026-11-10 用户给）：不走赞赏码的那条路——在店里买东西也算支持。
 *  码下面那行出口的左半边「成为赞助人」，点开系统浏览器。 */
export const SPONSOR_URL = 'https://wzyp.cn/shop/IFCEI5I3';

/** 本仓库（2026-11-10 加、2026-11-11 与赞助并成一行）：不花钱的另一种支持——
 *  打开仓库页，Star 在页面右上角。slug 单源在 core/remote-base，与「关于」组同一处。 */
export const REPO_URL = `https://github.com/${REPO_SLUG}`;

// 日期格式化的门面留在原处：外部一直是从 reward-dialog 拿这一样的。
export { formatRewardDate };
export type { RewardName };

/** 名单列表（序号倒排：最新一位是最大号） */
export function renderRewardList(names: readonly RewardName[]): HTMLOListElement {
  const ol = document.createElement('ol');
  ol.className = 'bz-rw-names';
  const total = names.length;
  ol.innerHTML = names
    .map((it, i) => {
      const no = String(total - i).padStart(2, '0');
      const msg = it.message
        ? `<p class="bz-rw-msg">${escapeHtml(it.message)}</p>`
        : '';
      // 金额位两种写法：数字补 ¥ 后缀不铺小数；'patron' 是不走赞赏码的那条路
      // （在线 JSON 里也写 "patron"，界面才跟语言无关）
      const amt = typeof it.amount === 'number'
        ? `<span class="bz-rw-amt"><i>¥</i>${it.amount}</span>`
        : '<span class="bz-rw-amt bz-rw-amt-text">赞助人</span>';
      return `<li>
        <div class="bz-rw-no">${no}</div>
        <div>
          <div class="bz-rw-who-row">
            <div class="bz-rw-who">${escapeHtml(it.name)}</div>
            <div class="bz-rw-meta">
              ${amt}
              <span class="bz-rw-when">${escapeHtml(formatRewardDate(it.date))}</span>
            </div>
          </div>
          ${msg}
        </div>
      </li>`;
    })
    .join('');
  return ol;
}

/** 一段说明（加载中 / 拉失败）+ 可选的重试钮 */
function renderRewardNote(text: string, retry = false): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'bz-rw-empty';
  el.innerHTML = '<div class="bz-rw-mark"></div>';
  const p = document.createElement('p');
  p.textContent = text;
  el.appendChild(p);
  if (retry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-rw-retry';
    btn.setAttribute('data-role', 'rwretry');
    btn.textContent = '重试';
    el.appendChild(btn);
  }
  return el;
}

/** 空态：一张还没写过字的信笺（横线 + 金菱形 + 一行小字） */
export function renderRewardEmpty(): HTMLDivElement {
  return renderRewardNote('还没有人打赏。');
}

/**
 * 名单区（列表 / 加载中 / 拉失败 / 空信笺）。
 *
 * 三种空态分开画：网络故障写成「还没有人打赏」是在替失败撒谎；加载中
 * 也要先占住位置，别让弹窗先闪一下空的再变。
 */
export function renderRewardListArea(
  names: readonly RewardName[],
  status: PatronsStatus = 'ready',
): HTMLElement {
  if (names.length) return renderRewardList(names);
  if (status === 'loading') return renderRewardNote('名单加载中…');
  if (status === 'failed') return renderRewardNote('名单没加载出来', true);
  return renderRewardEmpty();
}

/** 一个出口（码下面那行里的一段）：长得像链接，点起来走 openExternalUrl——
 *  裸 `<a>` 在 Obsidian 里会被阅读视图接管、移动端常常点了没反应。 */
function exitLink(text: string, url: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'bz-rw-sponsor-link';
  a.href = url;
  a.rel = 'noopener noreferrer';
  a.textContent = text;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openExternalUrl(getApp(), url);
  });
  return a;
}

/** 底部金弧（原型同款：一道上凸的浅金边 + 一条淡金描边） */
const FOOT_ARC =
  '<svg viewBox="0 0 520 64" preserveAspectRatio="none" aria-hidden="true">' +
  '<path d="M0,27 C140,0 380,0 520,27 L520,64 L0,64 Z" fill="#f3e8cf"/>' +
  '<path d="M0,27 C140,0 380,0 520,27" fill="none" stroke="rgba(189,148,64,.3)" stroke-width="0.7"/>' +
  '</svg>';

/** 弹窗正文（整块纸）。`onClose` 由关闭钮调用——移动端全屏时遮罩被纸盖满，没有这枚钮就只能靠 ESC */
export function buildRewardBody(
  names: readonly RewardName[],
  onClose: () => void = () => undefined,
  status: PatronsStatus = 'ready',
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'bz-rw';

  const close = document.createElement('button');
  close.className = 'bz-rw-close';
  close.type = 'button';
  close.setAttribute('aria-label', '关闭');
  close.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" ' +
    'stroke-width="1.3" stroke-linecap="round"><path d="M1 1l11 11M12 1L1 12"/></svg>';
  close.addEventListener('click', () => onClose());
  root.appendChild(close);

  const head = document.createElement('div');
  head.className = 'bz-rw-head';
  head.innerHTML =
    '<div class="bz-rw-kicker">题赠</div>' +
    `<p class="bz-rw-lead">${SUPPORT_PITCH}<br>${SUPPORT_PITCH_REST}</p>`;
  root.appendChild(head);

  const code = document.createElement('div');
  code.className = 'bz-rw-code';
  const box = document.createElement('div');
  box.className = 'bz-rw-code-box';
  const img = document.createElement('img');
  img.src = rewardCodeUrl;
  img.alt = '微信赞赏码';
  box.appendChild(img);
  code.appendChild(box);
  const ways = document.createElement('p');
  ways.className = 'bz-rw-ways';
  ways.textContent = '微信扫码';
  code.appendChild(ways);

  // 码下面一行出口（2026-11-11 用户拍板把原来两行并成一行）：
  //  「成为赞助人」——不想扫码、或想顺带买点东西的走这里；
  //  「给个 Star」——不花钱的另一种支持，打开 GitHub 仓库。
  // 连读成一句话（「微信扫码 / 成为赞助人 · 给个 Star」），三种支持方式在同一行里并列；
  // 中点只是分隔符，不可点——两个入口各自可点、各去各的地址。
  // 长得像链接，点起来不走 `<a>` 的默认跳转——Obsidian 里裸链会被阅读视图接管、
  // 移动端常常点了没反应，统一交给 core 的 openExternalUrl 兜底链（失败有人说人话）。
  const exits = document.createElement('p');
  exits.className = 'bz-rw-exits';
  const sep = document.createElement('span');
  sep.className = 'bz-rw-exit-sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = '·';
  exits.appendChild(exitLink('成为赞助人', SPONSOR_URL));
  exits.appendChild(sep);
  exits.appendChild(exitLink('给个 Star', REPO_URL));
  code.appendChild(exits);

  root.appendChild(code);

  const list = document.createElement('div');
  list.className = 'bz-rw-list';
  list.setAttribute('data-role', 'rwlist');
  list.appendChild(renderRewardListArea(names, status));
  root.appendChild(list);
  const foot = document.createElement('div');
  foot.className = 'bz-rw-foot';
  foot.innerHTML = FOOT_ARC;
  root.appendChild(foot);

  return root;
}

/** 打开赞赏弹窗（设置「关于」组 → 「支持作者」）。
 *  关闭钮要拿 close 句柄，而 content 在 open 之前就得建好——先建 body、占位一个闭包，
 *  open 返回后再把句柄填进去（点击发生在返回之后，闭包读到的一定是真句柄）。 */
export function openRewardDialog(): void {
  let handle: { close: () => void } | null = null;
  let off: () => void = () => undefined;

  const body = buildRewardBody(currentPatrons(), () => handle?.close(), patronsStatus());
  const listEl = body.querySelector<HTMLElement>('[data-role="rwlist"]');

  const modal = uiModal({
    content: body,
    maxWidth: 520,
    className: 'bz-rw-modal',
    autofocus: false,
    onClose: () => off(),
  });
  handle = modal;

  const render = (): void => {
    if (!listEl) return;
    listEl.replaceChildren(renderRewardListArea(currentPatrons(), patronsStatus()));
  };
  off = onPatronsChange(render);

  /* 名单区的事件只挂一次：重试钮在每次重画后是新的，但都冒泡到 body */
  body.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest) return;
    if (target.closest('[data-role="rwretry"]')) {
      if (!currentPatrons().length && listEl) {
        listEl.replaceChildren(renderRewardListArea([], 'loading'));
      }
      void refreshPatrons({ force: true }).then(() => render());
    }
  });

  /* 先起请求：状态同步变成 loading，首帧画的就是「加载中」，不会先闪空态 */
  const first = refreshPatrons();
  if (!currentPatrons().length) render();
  void first.then(() => render());
}
