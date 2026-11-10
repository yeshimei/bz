/* ============================================================
 * bz · 赞赏弹窗（core/reward-dialog.ts）
 *
 * 设置 → 关于 → 「支持作者」按钮打开的独立弹窗：一张微信赞赏码 + 一份留名名单。
 * 版式一比一来自 `.scratch/reward/empty.html` 定稿（2026-10-30 用户逐轮确认：
 * 米白纸、金色、衬线题赠、信笺横线空态、底部金弧），**样式值不随设计 token 改**——
 * 这里不是通用组件，是一张「纸」，明暗主题下都保持纸的样子。
 *
 * 入口文案：2026-10-30 先挂「留言」，同日用户改口径为「支持作者」（点进来是为了支持作者，
 * 留言是顺带的）。按钮文案跟口径走；本版未注册命令，真要挂命令时走 `bz-core-reward` 口径。
 * 同日二轮收紧：码下那句「请务必留下一句话」删掉（不再逼人留言）、底部金弧上的落款字
 * （「谁来过，我记得」+ `bz`）也删只留弧、空态改「还没有人打赏」、关于组行名「赞赏」改「打赏」。
 * 引言句换稿：原客套话（先说声谢谢）删掉，换成作者处境的实话说白——开发维护与教程视频
 * 都是作者一个人、完全免费、无广告、无其他渠道收益（2026-10-30 用户定稿）。
 * 2026-11-09 起这句话从 `core/support-prompt` 取（关日志时的提醒窗说的是同一句），
 * 改文案只改那一处；README 是文档、不进构建，那边仍需手动同步。
 *
 * 赞赏码为什么内置：图固定不变、68KB，走 downloads/ 远端要等一次网络往返，
 * 且清单层只支持单文件文本与 tar.gz 目录包，为此单开一条二进制通道不划算。
 * 走 esbuild 的 dataurl loader（esbuild.config.mjs），源码里就是一行 import。
 *
 * 名单为什么是常量：微信赞赏码没有可查的接口，谁给了、写了什么只有作者看得到，
 * 只能手动维护。名单与日期格式化 2026-11-08 拆去 core/reward-names（更新日志页脚的
 * 「支持作者」按钮要读人数，不该为这个 length 把 68KB 赞赏码拉进主包）；
 * 本文件只留渲染，`REWARD_NAMES` 照旧从这里转出，调用方不用改 import。
 * 顺序仍是**时间倒序**（最新的在前），序号由 `names.length` 倒推（最新一位是最大号）。
 * 将来人多到懒得手改，再搬去 downloads/ 的 json（走 core/download-manifest 的 doc
 * 通道），渲染层不用动。
 * ============================================================ */
import { uiModal } from './ui/modal';
import { escapeHtml, openExternalUrl } from './utils';
import { getApp } from './app';
import { REWARD_NAMES, formatRewardDate, type RewardName } from './reward-names';
import { SUPPORT_PITCH, SUPPORT_PITCH_REST } from './support-prompt';
import rewardCodeUrl from './assets/reward-code.png';

/** 赞助商店（2026-11-10 用户给）：不走赞赏码的那条路——在店里买东西也算支持。
 *  码下面挂一行「成为赞助人」，点开系统浏览器。 */
export const SPONSOR_URL = 'https://wzyp.cn/shop/IFCEI5I3';

// 名单与日期格式化的门面留在原处：外部一直是从 reward-dialog 拿这两样的。
export { REWARD_NAMES, formatRewardDate };
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
      // 金额位两种写法：数字补 ¥ 后缀不铺小数；字符串原样（「赞助人」这类不走赞赏码的）
      const amt = typeof it.amount === 'number'
        ? `<span class="bz-rw-amt"><i>¥</i>${it.amount}</span>`
        : `<span class="bz-rw-amt bz-rw-amt-text">${escapeHtml(String(it.amount))}</span>`;
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

/** 空态：一张还没写过字的信笺（横线 + 金菱形 + 一行小字） */
export function renderRewardEmpty(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'bz-rw-empty';
  el.innerHTML = '<div class="bz-rw-mark"></div><p>还没有人打赏。</p>';
  return el;
}

/** 底部金弧（原型同款：一道上凸的浅金边 + 一条淡金描边） */
const FOOT_ARC =
  '<svg viewBox="0 0 520 64" preserveAspectRatio="none" aria-hidden="true">' +
  '<path d="M0,27 C140,0 380,0 520,27 L520,64 L0,64 Z" fill="#f3e8cf"/>' +
  '<path d="M0,27 C140,0 380,0 520,27" fill="none" stroke="rgba(189,148,64,.3)" stroke-width="0.7"/>' +
  '</svg>';

/** 弹窗正文（整块纸）。`onClose` 由关闭钮调用——移动端全屏时遮罩被纸盖满，没有这枚钮就只能靠 ESC */
export function buildRewardBody(names: readonly RewardName[], onClose: () => void = () => undefined): HTMLElement {
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

  // 赞助入口（2026-11-10）：不想扫码、或想顺带买点东西的走这里。
  // 长得像链接，点起来不走 `<a>` 的默认跳转——Obsidian 里裸链会被阅读视图接管、
  // 移动端常常点了没反应，统一交给 core 的 openExternalUrl 兜底链（失败有人说人话）。
  const sponsor = document.createElement('p');
  sponsor.className = 'bz-rw-sponsor';
  const sponsorLink = document.createElement('a');
  sponsorLink.className = 'bz-rw-sponsor-link';
  sponsorLink.href = SPONSOR_URL;
  sponsorLink.rel = 'noopener noreferrer';
  sponsorLink.textContent = '成为赞助人';
  sponsorLink.addEventListener('click', (e) => {
    e.preventDefault();
    openExternalUrl(getApp(), SPONSOR_URL);
  });
  sponsor.appendChild(sponsorLink);
  code.appendChild(sponsor);

  root.appendChild(code);

  const list = document.createElement('div');
  list.className = 'bz-rw-list';
  list.appendChild(names.length ? renderRewardList(names) : renderRewardEmpty());
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
  const body = buildRewardBody(REWARD_NAMES, () => handle?.close());
  handle = uiModal({
    content: body,
    maxWidth: 520,
    className: 'bz-rw-modal',
    autofocus: false,
  });
}
