/* ============================================================
 * bz · 赞赏名单数据（core/reward-names.ts）
 *
 * 从 reward-dialog 拆出来的一小块：名单常量 + 日期格式化。
 * 拆的原因（2026-11-08）：更新日志页脚的「支持作者」按钮要显示支持者人数，
 * 而 reward-dialog 静态 import 了 68KB 的赞赏码（esbuild dataurl）——
 * 只为读一个 length 就把整张图拉进 popup 主包，不值。
 *
 * 渲染（名单列表 / 空态信笺 / 弹窗骨架）仍在 reward-dialog.ts。
 * ============================================================ */

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
 * 空数组时弹窗显示那张空态信笺（`renderRewardEmpty`）。
 *
 * 2026-11-08 开张：微信赞赏码收到第一笔，12 元、留言照登。
 * 金额按接口约定存整数（12 元即 12），纸面上显示 ¥12，不铺两位小数。
 */
export const REWARD_NAMES: readonly RewardName[] = [
  { name: '执徐', amount: 12, date: '2026-11-08', message: '伟大无需多言！' },
];

/** `2026-10-21` → `10 月 21 日`（解析不了就原样返回，不猜） */
export function formatRewardDate(iso: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(iso || '').trim());
  if (!m) return iso;
  return `${Number(m[2])} 月 ${Number(m[3])} 日`;
}
