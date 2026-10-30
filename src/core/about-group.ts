/* ============================================================
 * bz · 设置面板「关于」组（core/about-group.ts）
 *
 * 通用页**最上面**那一组（2026-10-28 对外分发）：版本 / 自动更新 / 环境自检 / 反馈 /
 * GitHub 主页 / 使用教程 / 赞赏。分工与边界：
 *
 *  - **版本**（info 行 + 动作钮）：运行中版本为真值；磁盘比运行中新时补一句
 *    「已下载 vX，重载后生效」——不补的话用户会看到「更新完了但版本号没变」。
 *    动作钮 = 「检查并更新」：人点了就装（等价于显式同意），与 autoUpdate 开关无关。
 *  - **自动更新**（toggle）：启动时会不会自己装，缺省开（2026-10-30 用户拍板）；
 *    管的是「插件本体 + 在线资源 + 外部工具包」一整套——只换本体的话，索引与工具包
 *    还停在旧版，表现成「更新了却还是不好用」（见 core/auto-assets.ts）。
 *    关着也仍会检查——面板照样能看见「有新版」。
 *  - **反馈**：直接开 GitHub issues（仓库地址单源在 core/remote-base.ts 的 REPO_SLUG）。
 *  - **赞赏**：暂时只有一个禁用的「暂无」按钮（2026-10-29 用户改口径：去掉描述、右列摆按钮）。
 *    禁用态比空 button 诚实——位置在、写着「暂无」、也点不出没反应的东西。将来放微信/支付宝
 *    收款码时就地改成可点的 button 行 + 弹窗，收款码图片走在线资源下发（不塞进 main.js）。
 *
 * 为什么是组而不是页头：页头是影院式整宽头行、只放标题（ADR-0104 markup 单源），
 * 往里塞版本号要动两侧壳；而组卡片是现成的、跟通用页其余部分同一套视觉。
 * ============================================================ */
import { getApp } from './app';
import { notify } from './notice';
import { openExternalUrl } from './utils';
import { REPO_SLUG } from './remote-base';
import { checkSelfUpdate, selfUpdateState, type SelfUpdateState } from './self-update';
import { openRewardDialog } from './reward-dialog';
import type { GroupDecl, SettingsRow, SettingsRowContext } from './settings-schema';

/** 反馈渠道（GitHub issues；仓库 slug 与下载通道同一事实源） */
export const FEEDBACK_URL = `https://github.com/${REPO_SLUG}/issues`;

/** 项目主页（GitHub 仓库首页；与反馈、下载通道同一 slug，不另立字面量） */
export const REPO_URL = `https://github.com/${REPO_SLUG}`;

/** 视频版使用教程（B 站，2026-10-29 用户给定）。改地址只改这一处，文案与测试都从这里取 */
export const VIDEO_URL = 'https://www.bilibili.com/video/BV1vNsZ6pE7i';

/** 版本行的描述文案（一句自然句，无符号花样——设置项文案规范） */
export function versionDesc(st: SelfUpdateState): string {
  const base = st.running ? `v${st.running}` : '版本未知';
  if (st.pending) return `${base}，已下载 v${st.pending}，重载后生效`;
  if (st.available) return `${base}，有新版本 v${st.available.version}`;
  if (st.error) return `${base}，上次检查更新失败`;
  return base;
}

/**
 * 「关于」组（通用页首组）。异步是因为版本行要读磁盘 manifest + 上次检查结果
 * （与在线资源组同款：行文案来自本地事实，不联网）。
 */
export async function aboutGroup(): Promise<GroupDecl> {
  const app = getApp();
  const st = await selfUpdateState(app);

  const versionRow: SettingsRow = {
    type: 'info',
    name: '版本',
    desc: versionDesc(st),
    // 右列那枚「版本」小字去掉（2026-10-29 用户要求）：左列已经写着「版本」，
    // 右列再挂一枚同名词只是噪声，还挤窄了「检查并更新」的落位。
    hideBadge: true,
    help:
      '「检查并更新」会立刻去仓库取最新发布：有新版本就装下来，重载插件后生效。' +
      '装之前会把当前版本备份进插件目录的 downloads/.backup 里。',
    actions: [
      {
        // 人在场点的，一律按「同意装」处理：与 autoUpdate 开关无关
        text: '检查并更新',
        stateful: true,
        // 成功态文案自己说：这个钮查的是版本，不是连通性（缺省那句「已连通」会读成另一个意思）
        okText: '已是最新',
        onClick: (_v, ctx) => runCheckAndUpdate(ctx),
      },
    ],
  };

  const autoUpdateRow: SettingsRow = {
    type: 'toggle',
    name: '自动更新',
    desc: '启动时自动更新插件、外部工具与在线资源',
    help:
      '关闭时只在打开这个面板时提示有没有新版本，不会动插件文件。' +
      '开启后每次启动会在后台静默检查一次（24 小时内不重复）：插件本体有新版本直接安装；' +
      '皮肤、索引数据表与三个外部工具包（知识盒 / 工具坞 / 脸谱）缺的或过期的也会一并下好。',
    binding: { key: 'autoUpdate' },
  };

  const feedbackRow: SettingsRow = {
    type: 'button',
    name: '反馈',
    desc: '有问题或建议，去 GitHub 提 issue',
    buttonText: '打开',
    onClick: () => openExternalUrl(getApp(), FEEDBACK_URL),
  };

  // 项目主页与使用教程（2026-10-29 用户要求）：关于组原本只回答「有问题去哪说」，
  // 补上「东西在哪、怎么上手」——三行都是外链，读下来是一条链接清单，不比原来绕。
  const repoRow: SettingsRow = {
    type: 'button',
    name: 'GitHub 主页',
    desc: '源码和更新说明都在这里',
    buttonText: '打开',
    onClick: () => openExternalUrl(getApp(), REPO_URL),
  };

  const videoRow: SettingsRow = {
    type: 'button',
    name: '使用教程',
    desc: '视频版教程，边看边用',
    buttonText: '观看',
    // 地址是常量（VIDEO_URL）；哪天视频下架把常量清空，这里降级成一句提示，别开一张空页
    onClick: () => {
      if (!VIDEO_URL) {
        notify('使用教程还没发布，发布后这里会直连');
        return;
      }
      openExternalUrl(getApp(), VIDEO_URL);
    },
  };

  // 环境自检（2026-10-28 对外分发）：把「这台机器上缺什么」一次说清。
  // 放在关于组而不是在线资源组：它回答的是「我这台机器能不能用」，与「下什么」是两件事。
  const envRow: SettingsRow = {
    type: 'button',
    name: '环境自检',
    desc: '查 Node、工具、数据目录是否就绪',
    buttonText: '检查',
    onClick: () => void import('./setup-wizard').then((m) => m.openEnvironmentCheck(getApp())),
  };

  // 赞赏（2026-10-30 落地）：按钮文案叫「留言」而不是「打赏/赞赏」——用户点进来是想说两句，
  // 赞赏是顺带的（用户拍板）。弹窗见 core/reward-dialog.ts：微信赞赏码内置（esbuild dataurl，
  // 68KB 图不走远端资产通道），下面挂留名名单，名单空时显示信笺空态。
  // 收款码不塞 main.js 的旧口径据此作废：固定不变的小图走远端要多一条二进制通道，不值。
  const rewardRow: SettingsRow = {
    type: 'button',
    name: '赞赏',
    buttonText: '留言',
    onClick: () => openRewardDialog(),
  };

  return {
    name: '关于',
    icon: 'info',
    rows: [versionRow, autoUpdateRow, envRow, feedbackRow, repoRow, videoRow, rewardRow],
  };
}

/**
 * 检查并更新（版本行的动作）。
 *
 * **全过程都要说话**：与启动巡检相反——那是后台自动动作，失败弹脸是骚扰；这里是用户
 * 亲手点的，几十秒什么都不发生才叫 bug（2026-10-28 用户实测：点了没反应、没提示）。
 * 所以：点下去立刻起一条常驻通知（跑马灯），结束时原地改成结果；按钮同时走 busy → ✓/✕。
 *
 * 失败仍然抛出去：渲染器据此把按钮画成红✕ + 简短原因（「网络不通」这种）。
 */
export async function runCheckAndUpdate(ctx?: SettingsRowContext): Promise<void> {
  const app = getApp();
  // 常驻 + 不确定态进度：至少让人看见「在跑」，而不是一个不动的按钮
  const h = notify('正在检查更新…', { type: 'progress', duration: 0, dedupeKey: 'bz-selfupdate-check' });
  try {
    const result = await checkSelfUpdate(app, { throttle: false, apply: true, silent: true });
    const st = await selfUpdateState(app);
    paintVersionDesc(ctx, st);
    if (result === 'installed') {
      const ver = st.pending || st.onDisk || '';
      h.setType('success');
      h.setMessage(ver ? `已更新到 v${ver}：重载插件（或重启 Obsidian）后生效` : '已更新：重载插件后生效');
      return;
    }
    if (result === 'available') {
      // 只有 apply=false 才会走到这里（面板恒 apply=true），留着是为了口径完整
      h.setType('info');
      h.setMessage(`发现新版本${st.available?.version ? ` v${st.available.version}` : ''}，请点「检查并更新」安装`);
      return;
    }
    h.setType('success');
    h.setMessage(st.running ? `已是最新版本 v${st.running}` : '已是最新版本');
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    h.setType('error');
    h.setMessage(`检查更新失败：${msg}`);
    const st = await selfUpdateState(app).catch(() => null);
    if (st) paintVersionDesc(ctx, st);
    throw e; // 渲染器接住 → 按钮红✕ + 短原因
  }
}

/**
 * 把最新的版本描述就地写回行内（不重建面板）。
 *
 * 为什么不用 refresh 重建：行对象上的 `desc` 是字符串，重建读到的还是同一份旧文案；
 * 而「检查完版本号/有新版本」正是这一刻唯一想看的东西。两个渲染器的描述节点类名不同，
 * 各认一个（面板自绘 / Obsidian 原生 Setting）。
 */
export function paintVersionDesc(ctx: SettingsRowContext | undefined, st: SelfUpdateState): void {
  const el = ctx?.rowEl;
  if (!el) return;
  const node =
    el.querySelector<HTMLElement>('.bz-sp-set-desc') || el.querySelector<HTMLElement>('.setting-item-description');
  if (node) node.textContent = versionDesc(st);
}
