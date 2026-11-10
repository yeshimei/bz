/* ============================================================
 * bz · 支持作者提醒（core/support-prompt.ts）
 *
 * 关更新日志时问一句「要不要支持作者」（2026-11-09 用户拍板）：
 *  - 入口只有一处：更新日志窗的关闭动作。×、点遮罩、ESC 三条路走同一个出口，
 *    所以不存在「点遮罩能偷偷关掉、点 × 才被问」这种三套行为；
 *  - 两个答案两个去处：「支持作者」开赞赏扫码窗（core/reward-dialog），
 *    「以后再说」什么都不开，连同日志窗一起收掉；
 *  - 按钮下面再挂一行「或者给个 Star」（2026-11-10）：不花钱的另一种支持，
 *    点开本仓库；点它不关窗，人回来还能接着选；
 *  - 版式与配色见 core/support-prompt.css：纸色 + 金色 + 衬线，跟赞赏窗同一族——
 *    用户点「支持作者」之后落到的就是那张纸，中途不换材质。
 *
 * 那句「作者处境」的话是本文件导出的常量：reward-dialog 的引言引用的也是它。
 * 同一句话只说一份（此前 reward-dialog、README、这次的新窗各存一份，改文案得满仓找）。
 * README 是文档、不进构建，那边仍需手动同步。
 * ============================================================ */
import { uiModal } from './ui/modal';
import { getApp } from './app';
import { openExternalUrl } from './utils';
import { REPO_SLUG } from './remote-base';

/** 本仓库（收藏入口用）：slug 单源在 core/remote-base，与「关于」组同一处。
 *  不从 reward-dialog 转引——那边反过来引了本文件的 SUPPORT_PITCH，会成环。 */
const REPO_URL = `https://github.com/${REPO_SLUG}`;

/** 正文第一行（「作者一个人」那半句。标记里的断行就落在它后面） */
export const SUPPORT_PITCH = '插件的开发维护和教程视频制作都是作者一个人，';

/** 正文第二行 */
export const SUPPORT_PITCH_REST = '完全免费、无广告，也没有任何其他渠道的收益。';

/** 正文下方那行小字：打赏的后果说在扫码之前，不画饼 */
export const SUPPORT_NOTE = '打赏后会出现在支持者名单中';

/** 用户的选择：「支持作者」= 去扫码窗；「以后再说」= 收掉 */
export type SupportChoice = 'support' | 'dismiss';

/**
 * 打开提醒窗并等用户选一个。
 *
 * 遮罩点击与 ESC 与「以后再说」等价（都返回 dismiss）：关窗就是拒绝，
 * 不该因为用的是哪个手势就得出不同结论。
 *
 * 返回的 Promise 一定 settle——`settle` 先落结论再关窗，关窗回调里的那次
 * dismiss 被 `settled` 挡成空操作（否则点「支持作者」会先被写成 dismiss）。
 */
export function openSupportPrompt(): Promise<SupportChoice> {
  return new Promise<SupportChoice>((resolve) => {
    let settled = false;
    let handle: { close: () => void } | null = null;

    const settle = (choice: SupportChoice): void => {
      if (settled) return;
      settled = true;
      handle?.close();
      resolve(choice);
    };

    const root = document.createElement('div');
    root.className = 'bz-sup';

    const kicker = document.createElement('div');
    kicker.className = 'bz-sup-kicker';
    kicker.textContent = '支持作者';
    root.appendChild(kicker);

    // 两句话分两行：这句是「作者处境」+「没有别的收入」，中间断在逗号后最自然，
    // 交给浏览器按宽度切会把「完全免费」劈成两半（窄屏实测）。
    const lead = document.createElement('p');
    lead.className = 'bz-sup-lead';
    lead.append(
      document.createTextNode(SUPPORT_PITCH),
      document.createElement('br'),
      document.createTextNode(SUPPORT_PITCH_REST),
    );
    root.appendChild(lead);

    const note = document.createElement('p');
    note.className = 'bz-sup-note';
    note.textContent = SUPPORT_NOTE;
    root.appendChild(note);

    const acts = document.createElement('div');
    acts.className = 'bz-sup-acts';

    // 次序（2026-11-09 用户拍板）：「以后再说」在左、「支持作者」在右——
    // 主按钮落在阅读动线的末端，也是 iOS 弹窗里确认键的位置。
    const later = document.createElement('button');
    later.className = 'bz-sup-btn bz-sup-later';
    later.type = 'button';
    later.textContent = '以后再说';
    later.addEventListener('click', () => settle('dismiss'));
    acts.appendChild(later);

    const go = document.createElement('button');
    go.className = 'bz-sup-btn bz-sup-go';
    go.type = 'button';
    go.textContent = '支持作者';
    go.addEventListener('click', () => settle('support'));
    acts.appendChild(go);

    root.appendChild(acts);

    // 收藏入口（2026-11-10）：不花钱的另一种支持。放在两个按钮下面——
    // 它是「不想打赏也有别的支持方式」的补充，不该和二选一并列抢注意力。
    // 点它不关窗：人可能去仓库点完 star 回来接着选「以后再说」。
    const star = document.createElement('p');
    star.className = 'bz-sup-star';
    const starLink = document.createElement('a');
    starLink.className = 'bz-sup-star-link';
    starLink.href = REPO_URL;
    starLink.rel = 'noopener noreferrer';
    starLink.textContent = '或者给个 Star';
    starLink.addEventListener('click', (e) => {
      e.preventDefault();
      openExternalUrl(getApp(), REPO_URL);
    });
    star.appendChild(starLink);
    root.appendChild(star);

    // 模态就该接管焦点：不接管时 Tab 会跑到它后面那扇窗（更新日志）里，键盘用户
    // 等于在两层窗之间乱窜（2026-11-10 发版 review #4）。uiModal 缺省即
    // autofocus=true = 打开落焦首个按钮 + Tab 圈闭 + 关闭还原焦点到触发元素。
    handle = uiModal({
      content: root,
      maxWidth: 430,
      className: 'bz-sup-modal',
      onClose: () => settle('dismiss'),
    });
  });
}
