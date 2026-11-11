/* ============================================================
 * bz · 更新日志的外部入口（settings-panel/changelog-links.ts）
 *
 * 两个门面共用同一组按钮：更新提示小窗（changelog-note.ts）桌面端的页脚、
 * 移动端右下角的浮动条。图标与点击行为只有这一份，免得两边各画一个企鹅、
 * 各写一遍跳法。
 *
 * （2026-11-02 之前还有第三个门面——iframed 的全量日志弹窗 settings-panel/changelog.ts，
 *  那一版连同它一起删了：更新日志现在走内置数据，两个入口开的是同一个窗。）
 *
 * 顺序固定：GitHub → QQ 群 → B 站视频 → 支持作者（最后一个带文案，是这组里
 * 唯一有底色的一个——它要人看见，其余三个不抢视线）。
 *
 * 「支持作者」右上角那枚角标（2026-11-08 用户拍板：位置选角标，文案写「+人数」）：
 * 数字取赞赏名单的人数，从 core/reward-names 读（不是 reward-dialog——那边静态挂着
 * 68KB 赞赏码，读个 length 不值得把图拉进主包）。名单为空时不渲染角标。
 * 两位数自己撑成小胶囊；三位数会把角标拖成一条贴纸，所以超过 99 封顶成「99+」。
 * ============================================================ */
import { getApp } from '../core/app';
import { openExternalUrl } from '../core/utils';
import { REPO_URL } from '../core/about-group';
import { QQ_GROUP_ICON, QQ_GROUP_NUMBER, openQqGroup, qqJoinOneClick } from '../core/qq-group';
import { currentPatrons, onPatronsChange } from '../core/patron-list';

/** 视频教程第 1P（与「关于」组同一集）。分集链接按 about-group 的口径不共享常量：
 *  三处入口各指一集，抽公共常量反而要再加一层「这是自己那集」的注释。 */
const VIDEO_URL = 'https://www.bilibili.com/video/BV1vNsZ6pE7i/';

/* 三个品牌图标一律取 Simple Icons 的官方 path（github / bilibili / qq），
 * 颜色全部吃 currentColor——页脚这一组是一排同等重要的出口，谁单独带品牌色
 * 都会把视线抢过去（2026-11-02 用户：QQ 那只亮蓝太扎眼）。要颜色在别处给：
 * 关于组的行图标有自己的淡色方块底。 */
const ICON_GITHUB =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">' +
  '<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>';
/* B 站：官方小电视（Simple Icons 的 `bilibili` path）。2026-11-02 换掉自绘的
 * 「圆角矩形 + 两根弯天线」——天线方向反了，看着像只兔子。这一版是外框 + 两只
 * 眼睛的挖空轮廓，16px 下仍然认得出来。 */
const ICON_BILI =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">' +
  '<path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z"/></svg>';
/* QQ：实心企鹅剪影 + 挖眼，品牌蓝。图形与群号同源（core/qq-group），
 * 关于组的行图标也用它——两处看到的是同一只企鹅。 */
const ICON_QQ = QQ_GROUP_ICON;
const ICON_HEART =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

/** 按钮的行为键。绑定时按 `data-bz-act` 查，**不按 DOM 顺序**——
 *  同一份标记会同时插进桌面页脚和手机浮动条两处（≤768px 由 CSS 切），
 *  全局索引查表时第二组拿到的是 actions[4..7]，全是 undefined，
 *  点了静默无事（2026-11-02 真机反馈「移动端四个图标全哑」就是这么来的）。 */
export type ChangelogLinkAction = 'repo' | 'qq' | 'video' | 'donate';

/** 四个入口的按钮 HTML（类名 bz-chg-link；容器负责摆放，样式在 settings-panel/styles.css）。
 *  顺序（2026-11-02 用户拍板）：GitHub → QQ 群 → B 站 → 支持作者。 */
export function changelogLinksHtml(): string {
  // 桌面端点下去只复制群号（NT QQ 不认 mqqapi 群卡片，见 core/qq-group 文件头），
  // 悬停提示得跟着说实话——不然用户还以为是「加入」。
  const qqHint =
    `QQ 交流群 ${QQ_GROUP_NUMBER}` + (qqJoinOneClick() ? '' : ' · 点击复制群号');
  // 支持者角标：+人数。0 位时不画（别留一个孤零零的「+0」）。
  // 名单是在线拉的（2026-11-11）：先按缓存画，拉到后 bindChangelogLinks 里的
  // 订阅会原地补数字，不重开弹窗。
  const count = currentPatrons().length;
  const badge = count > 0
    ? `<span class="bz-chg-count" aria-hidden="true">${count > 99 ? '99+' : `+${count}`}</span>`
    : '';
  // 读屏与悬停读得懂「+1」是人数，不是未读：连着按钮一起念。
  const donateLabel = count > 0 ? `支持作者（已有 ${count} 位）` : '支持作者';
  return (
    '<button class="bz-chg-link" type="button" data-bz-act="repo" ' +
    `title="GitHub 仓库" aria-label="GitHub 仓库">${ICON_GITHUB}</button>` +
    `<button class="bz-chg-link" type="button" data-bz-act="qq" title="${qqHint}" aria-label="${qqHint}">` +
    `${ICON_QQ}</button>` +
    '<button class="bz-chg-link" type="button" data-bz-act="video" ' +
    `title="B 站视频教程" aria-label="B 站视频教程">${ICON_BILI}</button>` +
    '<button class="bz-chg-link donate" type="button" data-bz-act="donate" ' +
    `title="${donateLabel}" aria-label="${donateLabel}">${ICON_HEART}<span>支持作者</span>${badge}</button>`
  );
}

/** 行为表：键与标记里的 data-bz-act 一一对应 */
const ACTIONS: Record<ChangelogLinkAction, () => void> = {
  repo: () => openExternalUrl(getApp(), REPO_URL),
  qq: () => openQqGroup(getApp()),
  video: () => openExternalUrl(getApp(), VIDEO_URL),
  // 打赏弹窗带 68KB 赞赏码图，动态引入——只为点它的人付这份体积
  donate: () => void import('../core/reward-dialog').then((m) => m.openRewardDialog()),
};

/** 给 root 里所有 `.bz-chg-link` 绑行为（桌面页脚、手机浮动条各一套，各自都绑）。
 *
 *  返回值是**退订函数**：名单是在线拉的，这里订阅它的变化把「+人数」原地补上；
 *  弹窗关掉不退订，每开一次就多挂一个订阅者（bz 的更新日志可以反复开关）。
 */
export function bindChangelogLinks(root: HTMLElement): () => void {
  root.querySelectorAll<HTMLButtonElement>('.bz-chg-link').forEach((btn) => {
    const act = btn.getAttribute('data-bz-act') as ChangelogLinkAction | null;
    const fn = act ? ACTIONS[act] : undefined;
    if (fn) btn.addEventListener('click', fn);
  });

  const sync = (): void => {
    const count = currentPatrons().length;
    const label = count > 0 ? `支持作者（已有 ${count} 位）` : '支持作者';
    root.querySelectorAll<HTMLElement>('[data-bz-act="donate"]').forEach((btn) => {
      btn.title = label;
      btn.setAttribute('aria-label', label);
      const old = btn.querySelector('.bz-chg-count');
      if (count > 0) {
        const text = count > 99 ? '99+' : `+${count}`;
        if (old) old.textContent = text;
        else {
          const span = document.createElement('span');
          span.className = 'bz-chg-count';
          span.setAttribute('aria-hidden', 'true');
          span.textContent = text;
          btn.appendChild(span);
        }
      } else {
        old?.remove();
      }
    });
  };

  sync();
  return onPatronsChange(sync);
}
