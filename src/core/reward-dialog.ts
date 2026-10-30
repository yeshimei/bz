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
 *
 * 赞赏码为什么内置：图固定不变、68KB，走 downloads/ 远端要等一次网络往返，
 * 且清单层只支持单文件文本与 tar.gz 目录包，为此单开一条二进制通道不划算。
 * 走 esbuild 的 dataurl loader（esbuild.config.mjs），源码里就是一行 import。
 *
 * 名单为什么是常量：微信赞赏码没有可查的接口，谁给了、写了什么只有作者看得到，
 * 只能手动维护。`REWARD_NAMES` 按**时间倒序**排（最新的在前），序号由 `names.length`
 * 倒推（最新一位是最大号），与原型一致。将来人多到懒得手改，再搬去
 * downloads/ 的 json（走 core/download-manifest 的 doc 通道），渲染层不用动。
 * ============================================================ */
import { uiModal } from './ui/modal';
import { escapeHtml } from './utils';
import rewardCodeUrl from './assets/reward-code.png';

/** 一条留名记录（金额单位：元） */
export interface RewardName {
  /** 昵称（赞赏时填的，原样显示） */
  name: string;
  /** 金额（元，整数；不显示合计，只挂在单条右侧） */
  amount: number;
  /** 日期 `YYYY-MM-DD` */
  date: string;
  /** 留言（可空；空的就只显示名字那一行，不留占位文字） */
  message?: string;
}

/**
 * 留名名单（**时间倒序，最新在前**）。
 *
 * 维护方式：按日期插到数组头部；没有留言就省略 `message` 字段（别写空串占位）。
 * 目前为空——第一批赞赏还没发生。
 */
export const REWARD_NAMES: readonly RewardName[] = [];

/** `2026-10-21` → `10 月 21 日`（解析不了就原样返回，不猜） */
export function formatRewardDate(iso: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(iso || '').trim());
  if (!m) return iso;
  return `${Number(m[2])} 月 ${Number(m[3])} 日`;
}

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
      return `<li>
        <div class="bz-rw-no">${no}</div>
        <div>
          <div class="bz-rw-who-row">
            <div class="bz-rw-who">${escapeHtml(it.name)}</div>
            <div class="bz-rw-meta">
              <span class="bz-rw-amt"><i>¥</i>${Number(it.amount) || 0}</span>
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
    '<p class="bz-rw-lead">插件的开发维护和教程视频制作都是作者一个人，<br>完全免费、无广告，也没有任何其他渠道的收益。</p>';
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
