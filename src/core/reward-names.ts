/* ============================================================
 * bz · 赞赏名单的类型与日期格式化（core/reward-names.ts）
 *
 * 2026-11-11 起名单**不在这个文件里**：它被搬去主仓 `docs/patrons.json`，
 * 由 `core/patron-list.ts` 在运行期取（两个地址并发、本机缓存）。
 * 这个文件只留两样不进网络的东西：条目形状 `RewardName` 与日期格式化。
 *
 * 为什么当年从 reward-dialog 拆出来（2026-11-08）：更新日志页脚的「支持作者」
 * 按钮要显示人数，而 reward-dialog 静态 import 了 68KB 的赞赏码（esbuild
 * dataurl）——只为读一个 length 就把整张图拉进主包，不值。现在这个理由变成
 * 「解析层不该依赖渲染层」，同一件事。
 *
 * 渲染（名单列表 / 空态信笺 / 弹窗骨架）仍在 reward-dialog.ts；
 * 取数与校验在 patron-list.ts；格式说明在 docs/patrons.md。
 * ============================================================ */

/** 一条留名记录 */
export interface RewardName {
  /** 昵称（赞赏时填的，原样显示） */
  name: string;
  /**
   * 金额位。
   *  - 数字：微信赞赏码收到的金额（元，按实际收到的记，整数就写整数、3.14 就写 3.14）；
   *  - `'patron'`：不在赞赏码这条路（在赞助商店买了东西），界面显示「赞助人」。
   *    在线 JSON 里也写 `"patron"`，两个插件各自翻成自己的话。
   */
  amount: number | 'patron';
  /** 日期 `YYYY-MM-DD` */
  date: string;
  /** 留言（可空；空的就只显示名字那一行，不留占位文字） */
  message?: string;
}

/** `2026-10-21` → `10 月 21 日`（解析不了就原样返回，不猜） */
export function formatRewardDate(iso: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(iso || '').trim());
  if (!m) return iso;
  return `${Number(m[2])} 月 ${Number(m[3])} 日`;
}
