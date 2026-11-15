/**
 * 内容首页 · 首屏壳（2026-11-15，用户报「首次启动第一次打开还是加载很久」）。
 *
 * 病因：首开 `showOverlay/createOverlay` 出的是空骨架，要等一整轮 `collectRiver`
 *（7 天 recap + 12 域时间线 + 十几个计数，约 20 轮全库遍历）回来才见得到左右两栏。
 * 上一轮做的会话缓存只治「重开」，启动后立刻首开仍要等整轮。
 *
 * 解法：打开命令的**同步段**先用本模块造一份纯算 `RiverData` 壳把左右 / 周历 / 瓦片铺出来，
 * 中间时间线继续挂「正在汇入…」；`collectRiver` 那一轮照旧在后台跑，回来后由
 * `ui.renderSlowData()` 局部补画中间列并就地换数字（不整屏重建）。
 *
 * 契约（ADR-0300 同款）：纯函数、零 IO、不读 vault、不读设置、不建 DOM、不写盘；
 * `pending: true` 让 `riverCountText` 回落域副题，避开「0 条待办」这类假结论。
 * 日期口径与 `collectRiver` 完全一致（本地日历日、index 0 = 今天、周历倒排 7 格）。
 */
import {
  EMPTY_COUNTS, EMPTY_SUMMARY, dateStrOf,
  type RiverData, type RiverDay, type RiverWeekDay,
} from './shared';

const DAY_MS = 86400000;
const WD = ['日', '一', '二', '三', '四', '五', '六'];

/** 造一份「只有日期窗口可信」的活动河壳；now 注入只为测试可固定 */
export function makeRiverShell(now: number = Date.now()): RiverData {
  const days: RiverDay[] = Array.from({ length: 7 }, (_, i) => ({
    dateStr: dateStrOf(now - i * DAY_MS),
    events: [],
    summary: { ...EMPTY_SUMMARY },
    firstTs: null,
  }));
  const week: RiverWeekDay[] = days.map((d) => {
    const dt = new Date(d.dateStr + ' 12:00:00');
    return { dateStr: d.dateStr, label: d.dateStr.slice(5), dayOfMonth: dt.getDate(), weekday: WD[dt.getDay()], hit: false };
  });
  return {
    today: days[0],
    yesterday: days[1],
    days,
    week,
    streak: { diaryStreak: 0, diaryWrittenToday: false },
    counts: { ...EMPTY_COUNTS },
    pomodoroFocusing: false,
    pending: true,
  };
}
