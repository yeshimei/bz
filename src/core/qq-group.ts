/* ============================================================
 * bz · QQ 群（core/qq-group.ts）
 *
 * 更新提示小窗、更新日志弹窗、「关于」组三处都要能一键加群，
 * 群号与加群链只有这一份。
 *
 * 为什么走 `mqqapi://` 而不是网页链接：QQ 群的网页分享链
 * （`qun.qq.com/universal-share/share?authKey=…`、`jq.qq.com/?_wv=1027&k=…`）
 * 都带一段每群每人生成一次的 authKey，拿不到就永远失效；`mqqapi` 只用群号，
 * 系统把它交给本机 QQ 客户端直接弹加群卡。
 *
 * 2026-11-02 补的口子：这套协议**依赖本机 QQ 客户端**——没装、版本旧、
 * 注册表里协议被别的软件抢了，都会静默失败（openUrl 不报错）。所以现在
 * 每次唤起都先把群号写进剪贴板并弹一条通知：客户端没弹出来，用户手里
 * 已经有群号，去 QQ 里搜一下就行，不用回来问「刚才那个号是多少」。
 *
 * 同日实测定死（用户截图）：NT 版桌面 QQ（Electron 重写的那一版）**收到了**
 * 这条协议，但自己不认群卡片，弹「很抱歉，你的QQ版本不支持本功能」。也就是
 * 说失败不是静默的，是客户端当面拒绝——用户看到的是我们的按钮坏了。
 * 所以桌面端不再发协议：只复制群号 + 明说去哪粘，按钮文案也跟着改成
 * 「复制群号」（[qqJoinOneClick]），不承诺一件根本做不到的事。
 * 手机端（iOS / Android 的 QQ）这条路一直是通的，照旧发。
 * ============================================================ */
import { openExternalUrl } from './utils';
import { notice } from './notice';
import { isMobileEnv } from './mobile';

/** 包仔用户群（用户 2026-11-02 给号，README / 关于 / 更新提示都用它） */
export const QQ_GROUP_NUMBER = '1130883117';

/** QQ 图标：官方企鹅剪影（Simple Icons 的 `qq` path），颜色吃 currentColor。
 *  2026-11-02 两改：① 换掉自绘的「水滴形企鹅」——那只画歪了，认不出是企鹅；
 *  ② 去掉写死的品牌蓝——页脚四个入口是一组，单独一只亮蓝跳出来太扎眼，
 *  让它跟邻居同色，要靠颜色说话的地方（关于组的方块底）在 CSS 里另给。 */
export const QQ_GROUP_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">' +
  '<path d="M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673"/></svg>';

/** 加群链（自定义协议，交给系统里的 QQ 客户端处理） */
export function qqGroupUrl(): string {
  return (
    'mqqapi://card/show_pslcard?src_type=internal&version=1' +
    `&uin=${QQ_GROUP_NUMBER}&card_type=group&source=qrcode`
  );
}

/** 写剪贴板（带 textarea 兜底：非安全上下文 / 权限被拒时 clipboard API 会直接抛） */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    /* 落兜底 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e2) {
    return false;
  }
}

/**
 * 复制群号到剪贴板 + 弹一条通知（成功/失败都给一句，正文带群号）。
 * 「关于」组行尾那颗群号小字、以及下面每次唤起加群，都走这里。
 */
export async function copyQqNumber(): Promise<boolean> {
  const ok = await writeClipboard(QQ_GROUP_NUMBER);
  notice(
    ok ? `群号 ${QQ_GROUP_NUMBER} 已复制` : `复制失败，群号 ${QQ_GROUP_NUMBER}`,
    ok ? 'success' : 'error'
  );
  return ok;
}

/**
 * 这个环境能不能真的「一键加群」。
 *
 * 桌面端返回 false（见文件头 2026-11-02 的实测）：调用方据此把按钮文案从
 * 「加入」改成「复制群号」、把图标 title 补上「点击复制群号」——文案得先
 * 诚实，用户才不会把「QQ 拒绝了这个协议」记成「bz 的按钮坏了」。
 */
export function qqJoinOneClick(): boolean {
  return isMobileEnv();
}

/**
 * 唤起 QQ 加群。
 * 顺序：**先发起复制、再唤起**——唤起失败时没有任何回调，复制必须在它前面
 * 把群号交到用户手里。通知由 copyQqNumber 统一发。
 * openExternalUrl 是全局统一的外链兜底链（openUrl → electron → window.open），
 * 自定义协议一样能走；唤不起来时它给的提示对 mqqapi 没意义，所以这里不包一层。
 *
 * 桌面端（isMobileEnv 为 false）不发协议——NT QQ 会用「版本不支持本功能」
 * 把请求顶回来，比不响应更难看。直接复制群号，通知里写清下一步。
 */
export function openQqGroup(app: unknown): void {
  if (!isMobileEnv()) {
    void copyQqNumberForManualJoin();
    return;
  }
  void copyQqNumber();
  openExternalUrl(app, qqGroupUrl());
}

/** 桌面端的加群：复制群号 + 一句「去哪粘」，不发任何协议 */
async function copyQqNumberForManualJoin(): Promise<void> {
  const ok = await writeClipboard(QQ_GROUP_NUMBER);
  notice(
    ok
      ? `群号 ${QQ_GROUP_NUMBER} 已复制 · 到 QQ 里搜群号加入`
      : `复制失败，请在 QQ 里搜索群号 ${QQ_GROUP_NUMBER}`,
    ok ? 'success' : 'error'
  );
}
