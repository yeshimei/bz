/**
 * 通用设置组预设（ticket 131，ADR-0064 决策 5）：跨域同构项 core 定义一次、域一行挂载。
 *
 * 首批：「移动端默认全屏」组（现 13 个域设置弹窗手写块收敛）。
 *
 * TODO(后续域迁移票)——批次数数字行 / 排序、默认筛选下拉暂不抽预设，各域文案不同构：
 * - 批次数：diary 与 clipping 完全一致（「每批加载数量」「滚动加载时每批显示的条目数」），
 *   movie 不同（「每页加载数量」「列表首次加载和滚动加载时显示的条数」）——三域统一文案后
 *   再抽 batchSizeRow(key) 预设。
 * - 排序/默认筛选：diary 标签排序（fixed/count）、memo 默认排序（priority/due/created）、
 *   movie 默认排序（六选项）/状态筛选/类型筛选——选项集与文案全不同构，无可收敛公约数；
 *   待各域迁移时逐域声明，出现同构后再抽。
 */
import { isMobileEnv } from './mobile';
import type { GroupDecl, SettingsKeyOfType, SettingsRow, SettingsSnapshot } from './settings-schema';

/**
 * 「移动端默认全屏」行文案缺省值：现 13 处手写块的多数派逐字文案
 * （diary/memo/clipping/library/movie/password/pomodoro/encrypt 八处同文）。
 */
export const MOBILE_FULLSCREEN_DESC = '移动端打开主窗口时默认全屏，关闭则显示常规卡片';

export interface MobileFullscreenRowOptions {
  /**
   * 描述文案覆盖：现网另有四处与多数派不同，迁移时传此参逐字对齐——
   * belongings/favorites「移动端打开主窗口时默认全屏显示（≤768px；关=常规卡）」、
   * review「移动端打开复习窗口时默认全屏显示」、
   * smartcat「移动端打开小橘窗口时默认全屏，关闭则显示常规卡片」、
   * secondbrain 无描述（传 ''）。
   */
  desc?: string;
}

/** 「移动端默认全屏」toggle 行（仅 isMobileEnv() 显示；键直绑自动读值落盘） */
export function mobileFullscreenRow(
  key: SettingsKeyOfType<boolean>,
  opts?: MobileFullscreenRowOptions
): SettingsRow {
  // desc 缺省 = 多数派逐字文案；opts.desc 传 '' = 无描述（secondbrain 现状）
  const desc = opts?.desc !== undefined ? opts.desc || undefined : MOBILE_FULLSCREEN_DESC;
  return {
    type: 'toggle',
    name: '移动端默认全屏',
    desc,
    binding: { key },
    visibleWhen: (_snapshot: SettingsSnapshot) => isMobileEnv(),
  };
}

/** 「移动端」分组卡片（icon smartphone；仅移动端显示）：内挂「移动端默认全屏」行 */
export function mobileFullscreenGroup(
  key: SettingsKeyOfType<boolean>,
  opts?: MobileFullscreenRowOptions
): GroupDecl {
  return {
    icon: 'smartphone',
    name: '移动端',
    rows: [mobileFullscreenRow(key, opts)],
  };
}
