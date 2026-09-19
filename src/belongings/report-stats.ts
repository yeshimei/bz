/**
 * 归物本年度资产报告 · 统计纯层（issue 356）
 *
 * 数据全由 belongings.json 的 items 派生（只读，不改数据文件）；10 字段含可选
 * exit_date/sold_price，旧数据无字段照常可读（未出离/未记售价 = 0 口径）。
 * 纯函数契约：items 与 year 显式入参，now 可注入（测试固定「今天」）；无 DOM、
 * 无设置读取、无模块级可变状态。金额口径沿用 shared.ts（ADR-0089）：
 *   - 购入金额 = Σ原价（当年 purchase_date）；
 *   - 回血 = Σ转卖售价（当年 exit_date 且 current_status=已转卖 且 sold_price>0，丢弃不计）；
 *   - 陪伴天数 = 购入日 →（出离日 | 截止日）的日历日；无效/倒挂日期 = 0 天不参与。
 */
import type { BelongingsItem } from './types';
import { catNameOf, parseLocalDay, exitDayTsOf, recoveredOf, exitedStatus } from './shared';

/** 陪伴最久榜条数（Top N；issue 356 拍板 Top 5） */
export const COMPANION_TOP_N = 5;

/** 月份固定档标签（走势图 12 列共用） */
export function monthLabel(m: number): string {
  return `${m}月`;
}

// ---------- 日期解析（func P3-5/深审批A：单源收编 shared.parseLocalDay——
// 严格分量校验版，「2026-13-45」不再被归一化漂移到次年；无效 = null 与面板口径一致） ----------

/** 日期串 → 当日零点本地时间戳；无效 = null（缺字段/残串/越界分量照常跳过） */
function parseDayTs(raw: string | null | undefined): number | null {
  return parseLocalDay(raw)?.getTime() ?? null;
}

/** 年份四字串（'2025-06-01…' → '2025'；无效 = ''） */
function yearOf(raw: string | null | undefined): string {
  const s = String(raw || '').slice(0, 4);
  return /^\d{4}$/.test(s) ? s : '';
}

const DAY_MS = 864e5;

// 出离封口时间戳与转卖回血（cons P3-7 收编 shared 单源：exitDayTsOf / recoveredOf，
// 出离态判定/状态串不再本地重写——头注「与 shared 同语义」的平行实现由此退役）

/** 价格数值容错（缺字段/非数字 = 0） */
function priceOf(it: BelongingsItem): number {
  return Number(it.purchase_price) || 0;
}

// ---------- 年份清单与解析 ----------

/** 报告可切换年份（购入年 ∪ 出离年，降序） */
export function reportYears(items: BelongingsItem[]): string[] {
  const set = new Set<string>();
  for (const it of items) {
    const py = yearOf(it.purchase_date);
    if (py) set.add(py);
    const ey = yearOf(it.exit_date);
    if (ey && exitedStatus(it.current_status)) set.add(ey);
  }
  return [...set].sort().reverse();
}

/** 选中年份解析：合法即用；悬空/缺省回落最近有记录的一年；全空 = '' */
export function resolveReportYear(items: BelongingsItem[], year: string): string {
  const years = reportYears(items);
  return years.includes(year) ? year : years[0] || '';
}

// ---------- 年度统计 ----------

/** 月度花销列（label + 当月购入金额/件数） */
export interface MonthSpendCol {
  label: string;
  amount: number;
  count: number;
}

/** 分类占比行（金额降序；name = 去 emoji 前缀的纯文字分类） */
export interface CategoryShareRow {
  name: string;
  count: number;
  amount: number;
  /** 占当年购入金额百分比（0-100，一位小数） */
  pct: number;
}

/** 日均成本走势列（各月末时点的全库日均成本；future = 该月末尚未到来） */
export interface DailyCostCol {
  label: string;
  value: number;
  future: boolean;
}

/** 陪伴最久榜行（截至所选年末/今天；出离条目封口在出离日） */
export interface CompanionRow {
  item: BelongingsItem;
  days: number;
}

export interface YearReportStats {
  year: string;
  /** 当年购入 */
  purchasedCount: number;
  purchasedAmount: number;
  /** 当年离场（exit_date 落在当年）与转卖回血 */
  exitedCount: number;
  recoveredAmount: number;
  /** 月度花销走势（固定 12 列，缺月补零） */
  monthlySpend: MonthSpendCol[];
  /** 分类占比（当年购入；金额降序） */
  categoryShare: CategoryShareRow[];
  /** 日均成本走势（固定 12 列） */
  dailyCostTrend: DailyCostCol[];
  /** 陪伴最久榜（截至所选年末与今天取早；Top N） */
  companions: CompanionRow[];
  /** 陪伴榜截止口径（审查修复批，issue 356）：'today' = 当年截至今日；'yearEnd' = 往年截至年末 */
  companionAsOf: 'today' | 'yearEnd';
  /** 当年是否有任何购入/离场记录（空年空态判定） */
  hasYearData: boolean;
}

/**
 * 时点日均成本（issue 356 新增口径）：截至 cutoffTs 的全库日均成本——
 * （Σ原价 − Σ已落地的转卖回本）/ Σ累计持有天数；与 shared.avgDailyCost（「今天」版）
 * 同一条 ADR-0089 公式的截止日参数化，供月末走势逐点复算。走势只在报告层用，
 * 不回写 shared（避免动既有 KPI 单源）。
 */
export function avgDailyCostAsOf(items: BelongingsItem[], cutoffTs: number): number {
  let cost = 0;
  let days = 0;
  for (const it of items) {
    const p = parseDayTs(it.purchase_date);
    if (p == null || p >= cutoffTs) continue;
    cost += priceOf(it);
    const ex = exitDayTsOf(it);
    const capped = ex != null && ex < cutoffTs;
    if (capped) cost -= recoveredOf(it);
    days += Math.max(0, Math.floor(((capped ? ex : cutoffTs) - p) / DAY_MS));
  }
  return days ? cost / days : 0;
}

/** 年度资产报告统计（items 全量入参；now 缺省 = 今天，测试注入固定值） */
export function computeYearReport(
  items: BelongingsItem[],
  year: string,
  now: Date = new Date(),
): YearReportStats {
  const y = Number(year);
  const yearStart = new Date(y, 0, 1).getTime();
  const yearEnd = new Date(y + 1, 0, 1).getTime();
  const nowTs = now.getTime();

  const purchased = items.filter((it) => {
    const p = parseDayTs(it.purchase_date);
    return p != null && p >= yearStart && p < yearEnd;
  });
  const exitedInYear = items.filter((it) => {
    const ex = parseDayTs(it.exit_date);
    return ex != null && ex >= yearStart && ex < yearEnd && exitedStatus(it.current_status);
  });

  // 月度花销（当年购入按月桶；固定 12 列）
  const monthlySpend: MonthSpendCol[] = Array.from({ length: 12 }, (_, i) => ({
    label: monthLabel(i + 1),
    amount: 0,
    count: 0,
  }));
  for (const it of purchased) {
    const p = parseDayTs(it.purchase_date) as number;
    const m = new Date(p).getMonth();
    monthlySpend[m].amount += priceOf(it);
    monthlySpend[m].count += 1;
  }

  // 分类占比（当年购入按分类聚合，金额降序）
  const catMap = new Map<string, { count: number; amount: number }>();
  for (const it of purchased) {
    const name = catNameOf(it.category).trim() || '未分类';
    const cur = catMap.get(name) || { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += priceOf(it);
    catMap.set(name, cur);
  }
  const purchasedAmount = purchased.reduce((s, i) => s + priceOf(i), 0);
  const categoryShare: CategoryShareRow[] = [...catMap.entries()]
    .map(([name, v]) => ({
      name,
      count: v.count,
      amount: v.amount,
      pct: purchasedAmount > 0 ? Math.round((v.amount / purchasedAmount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count || a.name.localeCompare(b.name, 'zh'));

  // 日均成本走势（各月末时点；未来月标 future 且值恒 0——未实现的月份无成本语义）
  const dailyCostTrend: DailyCostCol[] = Array.from({ length: 12 }, (_, i) => {
    const cutoff = new Date(y, i + 1, 1).getTime();
    const future = cutoff > nowTs;
    return {
      label: monthLabel(i + 1),
      value: future ? 0 : avgDailyCostAsOf(items, cutoff),
      future,
    };
  });

  // 陪伴最久榜（截至所选年末与今天取早；出离条目封口出离日；无效日期不参与）
  const companionCutoff = Math.min(yearEnd, nowTs);
  const companions: CompanionRow[] = items
    .map((it) => {
      const p = parseDayTs(it.purchase_date);
      if (p == null || p >= companionCutoff) return null;
      const ex = exitDayTsOf(it);
      const end = ex != null && ex < companionCutoff ? ex : companionCutoff;
      return { item: it, days: Math.max(0, Math.floor((end - p) / DAY_MS)) };
    })
    .filter((r): r is CompanionRow => r != null)
    .sort(
      (a, b) =>
        b.days - a.days ||
        String(a.item.purchase_date || '').localeCompare(String(b.item.purchase_date || '')) ||
        String(a.item.name || '').localeCompare(String(b.item.name || ''), 'zh'),
    )
    .slice(0, COMPANION_TOP_N);

  return {
    year,
    purchasedCount: purchased.length,
    purchasedAmount,
    exitedCount: exitedInYear.length,
    recoveredAmount: exitedInYear.reduce((s, i) => s + recoveredOf(i), 0),
    monthlySpend,
    categoryShare,
    dailyCostTrend,
    companions,
    // 审查修复批（issue 356）：段注口径随真实截止点走——当年（now 未到年末）陪伴榜实际截至今日，
    // 旧文案写死「截至年末」与数据不符；往年 cutoff = yearEnd 才是「年末」
    companionAsOf: companionCutoff < yearEnd ? 'today' : 'yearEnd',
    hasYearData: purchased.length > 0 || exitedInYear.length > 0,
  };
}
