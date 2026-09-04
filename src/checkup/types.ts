/**
 * 数据体检（checkup 域，D4）：类型契约。
 *
 * 体检是全插件只读巡检（除「一键修复」的定点清理外不改数据）：
 * - 一次体检 = 四类检查（json 可解析 / 字段漂移 / 孤儿条目 / 同源一致性）；
 * - 每类检查产出一个 CheckSection（结论 + 问题清单）；
 * - 问题分三档：error（红，必须处理）/ warn（黄，建议处理）/ info（提示，仅供参考）；
 * - 可修复项带 fixGroup + fixKey（run.ts 的 fixOrphans 按组定点清理，撤销链见 notifyUndo）。
 */

/** 问题严重度：error=红 / warn=黄 / info=提示（黄组内弱化展示） */
export type CheckSeverity = 'error' | 'warn' | 'info';

/** 体检发现的单个问题 */
export interface CheckIssue {
  severity: CheckSeverity;
  /** 一句话人话描述（列表主文案） */
  title: string;
  /** 详情（路径/说明；展示在「查看详情」展开区） */
  detail?: string;
  /** 可修复项所属修复组（'favorites' | 'clipbook'）；缺省 = 只报告不可修 */
  fixGroup?: string;
  /** 修复项唯一 key（同组内定位条目； favorites=条目 id / clipbook=归档 url） */
  fixKey?: string;
  /** 修复动作的展示名（按钮/确认框文案；缺省「清除」） */
  fixLabel?: string;
}

/** 单类检查结果 */
export interface CheckSection {
  /** 检查项 id：json / drift / orphan / consistency */
  id: 'json' | 'drift' | 'orphan' | 'consistency';
  /** 检查项名（人话） */
  name: string;
  /** 跑完的一句话结论 */
  summary: string;
  /** 发现的问题（空 = 该项通过） */
  issues: CheckIssue[];
  /** 扫描对象数（结论句用） */
  scanned: number;
}

/** 一次体检的完整报告 */
export interface CheckupReport {
  sections: CheckSection[];
  /** 完成时刻（toLocaleString，展示用） */
  finishedAt: string;
}

/** 检查函数可选参数：分片让出主线程 + 取消（纯数据层测试可不传） */
export interface CheckOpts {
  /** 每处理一批调用一次（UI 层借它让出主线程并刷新进度） */
  tick?: (current: string) => Promise<void> | void;
  /** 返回 true = 已取消，检查尽快返回 null */
  isCancelled?: () => boolean;
}

/** 取消哨兵：检查函数被取消时返回 null（区别于「跑完无问题」） */
export type CheckResult = CheckSection | null;
