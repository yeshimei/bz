/**
 * 教程视频弹窗（共享结构）：各域只传皮肤类与文案，DOM 与交互在这里一份。
 *
 * 为什么放 core：日记本那套票根弹窗是域内孤本（`.bz-diary-tutorial-popup`），
 * 知识盒与第二大脑要同一种「看视频教程」弹窗，再抄两份就是三份并行维护。
 * 结构（票根 / 说明 / 两个按钮）与本文件无关业务；**颜色与字体不在这里定**——
 * 各域传 `className` 并在自己的 styles.css 里挂皮（硬约束：弹窗必须穿本域皮）。
 *
 * 未发布口径（与日记本一致）：`url` 为空 = 视频还没上线——票根写「B 站 · 即将上线」，
 * 点击只给一句人话，不把人送去 404；上线后各域只改自己那个常量。
 */
import { getApp } from '../app';
import { notice } from '../notice';
import { openExternalUrl } from '../utils';
import { uiBtn } from './button';
import { uiModal } from './modal';

export interface TutorialModalOpts {
  /** 域皮肤类（在域 styles.css 里定义 `.bz-overlay-popup.<类>` 的材质） */
  className: string;
  /** 票根上的大标题，如「三分钟看懂知识盒」 */
  title: string;
  /** 标题下的一句说明（弹窗正文） */
  desc: string;
  /** 视频地址；空串 = 未发布 */
  url: string;
  /** 主动作（默认「看视频教程」） */
  cta?: string;
  /** 次动作（默认「先自己转转」） */
  dismiss?: string;
  /** 关闭回调（调用方用它清「当前开着的那一个」） */
  onClose?: () => void;
}

export interface TutorialModalHandle {
  close: () => void;
}

/** 打开教程弹窗；同一时刻由调用方保证只留一个（本函数不查重） */
export function showTutorialModal(opts: TutorialModalOpts): TutorialModalHandle {
  const url = String(opts.url || '').trim();

  const content = document.createElement('div');
  content.className = 'bz-tut';

  /** 去 B 站；未发布只提示不关窗——用户还能点「先自己转转」 */
  const watch = (): void => {
    if (!url) {
      notice('教程视频还没发');
      return;
    }
    openExternalUrl(getApp(), url);
    ui.close();
  };

  // 票根：整张可点（回车默认落在这里），有地址去 B 站、没地址给一句人话
  const cover = document.createElement('button');
  cover.type = 'button';
  cover.className = 'bz-tut-cover';
  cover.setAttribute('aria-label', url ? `去 B 站看${opts.title}` : '教程视频还没发布');
  cover.addEventListener('click', watch);

  const play = document.createElement('span');
  play.className = 'bz-tut-play';
  play.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'bz-tut-cover-text';
  const kicker = document.createElement('span');
  kicker.className = 'bz-tut-kicker';
  kicker.textContent = url ? 'B 站 · 视频教程' : 'B 站 · 即将上线';
  const name = document.createElement('span');
  name.className = 'bz-tut-name';
  name.textContent = opts.title;
  text.append(kicker, name);
  cover.append(play, text);

  const desc = document.createElement('p');
  desc.className = 'bz-tut-desc';
  desc.textContent = opts.desc;

  const foot = document.createElement('div');
  foot.className = 'bz-tut-foot';
  const dismiss = uiBtn({
    label: opts.dismiss || '先自己转转',
    className: 'bz-tut-dismiss',
    onClick: () => ui.close(),
  });
  const go = uiBtn({
    label: opts.cta || '看视频教程',
    tone: 'primary',
    className: 'bz-tut-go',
    onClick: watch,
  });
  foot.append(dismiss, go);

  content.append(cover, desc, foot);

  const ui = uiModal({
    content,
    maxWidth: 360,
    // 无标题头（字少）：title 只落成 aria-label，读屏仍知道这个框是什么
    title: '视频教程',
    className: opts.className,
    onClose: () => opts.onClose?.(),
  });
  return { close: () => ui.close() };
}
