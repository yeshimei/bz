/**
 * 首页时间线设置纯层契约（issue 287，2026-09-11 用户点名六项；issue 305 痕迹源替换）：
 *  - timelineKind：**旧形态**（无 kind）痕迹 → 类别，按文案前缀判；行为流事件由映射时直带
 *    kind（eventKind 优先取它），本函数只剩手搓数据/存档回落用途。
 *  - filterEvents / eventVisible：按勾选剔除整条（四类：产出 / 状态推进 / 点评 / 已跳过）。
 *  - timelineRangeDays：范围档 → 天数。
 *  - flowHtml：过滤后空态要给「被挡掉了」的专属文案，不能让用户以为数据丢了；
 *    时刻列开关 / 字号档要落到 data 属性上（样式在 CSS 里）。
 *  - nextHtml：关掉返回空串（ui 层据此连第三栏一起收敛）。
 */
import { describe, it, expect } from 'vitest';
import {
  timelineKind, filterEvents, eventKind, timelineRangeDays,
  DEFAULT_TIMELINE_FILTER, EMPTY_COUNTS,
} from '../../src/home/shared';
import type { RiverData, RiverEvent, TimelineFilter } from '../../src/home/shared';
import { flowHtml, nextHtml } from '../../src/home/render';

const F = (over: Partial<TimelineFilter> = {}): TimelineFilter => ({ ...DEFAULT_TIMELINE_FILTER, ...over });

/** 一条痕迹的最小形状（timeLabel + text 是渲染真吃的两个字段；kind 缺省 = 旧形态回落判类） */
const ev = (text: string, timeLabel = '11:03', kind?: RiverEvent['kind']): RiverEvent =>
  ({ domain: 'memo', ts: 0, timeLabel, text, ...(kind ? { kind } : {}) });

function river(events: Array<{ text: string }>): RiverData {
  const day = {
    dateStr: '2026-09-11',
    events: events as RiverData['today']['events'],
    summary: { diary: 0, movies: 0, books: 0, memoDone: 0, memoCreated: 0, pomodoros: 0, pomodoroMinutes: 0 },
    firstTs: null,
  };
  return {
    today: day, yesterday: { ...day, dateStr: '2026-09-10' },
    days: Array.from({ length: 7 }, (_, i) => ({ ...day, dateStr: `2026-09-${11 - i}` })),
    week: Array.from({ length: 7 }, (_, i) => ({ dateStr: `2026-09-${11 - i}`, label: '', dayOfMonth: 0, weekday: '', hit: false })),
    streak: { diaryStreak: 0, diaryWrittenToday: false },
    counts: { ...EMPTY_COUNTS },
    pomodoroFocusing: false,
  };
}

describe('首页时间线设置（issue 287）', () => {
  it('timelineKind：产出 vs 状态推进，按文案前缀判（与 recap buildRecap 文案一一对应）', () => {
    // 产出
    expect(timelineKind('新增 3 条')).toBe('produce');
    expect(timelineKind('标记《流浪地球2》已看 · ★★★★☆')).toBe('produce');
    expect(timelineKind('读完《三体》')).toBe('produce');
    expect(timelineKind('完成『买牛奶』')).toBe('produce');
    expect(timelineKind('专注《写方案》 · 25 分钟')).toBe('produce');
    // 状态推进
    expect(timelineKind('新增备忘录『买牛奶』')).toBe('progress');
    expect(timelineKind('《沙丘》加入片单')).toBe('progress');
    expect(timelineKind('《三体》读到 40%')).toBe('progress');
  });

  it('timelineKind：默认全勾时一条都不掉（改版前观感不变）', () => {
    const all = ['新增 3 条', '新增备忘录『甲』', '《乙》加入片单', '《丙》读到 40%', '读完《丁》'];
    expect(filterEvents(all.map((t) => ev(t)), F()).length).toBe(all.length);
  });

  it('filterEvents：关「状态推进」只掉推进、关「产出」只掉产出', () => {
    const evs = [ev('新增 3 条'), ev('新增备忘录『甲』'), ev('读完《丁》')];
    expect(filterEvents(evs, F({ progress: false })).map((e) => e.text)).toEqual(['新增 3 条', '读完《丁》']);
    expect(filterEvents(evs, F({ produce: false })).map((e) => e.text)).toEqual(['新增备忘录『甲』']);
    expect(filterEvents(evs, F({ produce: false, progress: false }))).toEqual([]);
  });

  it('timelineRangeDays：today/3d/week → 1/3/7；未知值回落当天', () => {
    expect(timelineRangeDays('today')).toBe(1);
    expect(timelineRangeDays('3d')).toBe(3);
    expect(timelineRangeDays('week')).toBe(7);
    expect(timelineRangeDays('乱写')).toBe(1);
    expect(timelineRangeDays(undefined)).toBe(1);
  });

  it('DEFAULT_SETTINGS：时间范围默认「本周」（2026-09-11 用户拍板）', async () => {
    const { DEFAULT_SETTINGS } = await import('../../src/settings');
    expect(DEFAULT_SETTINGS.homeTimelineRange).toBe('week');
  });

  it('「已跳过」回归第四类（issue 305 / ADR-0132）：开关默认关、打开才显示', () => {
    expect(Object.keys(DEFAULT_TIMELINE_FILTER).sort()).toEqual(['notes', 'produce', 'progress', 'skipped']);
    expect(DEFAULT_TIMELINE_FILTER.skipped).toBe(false);
    const evs = [ev('收藏文章『某篇』', '11:03', 'produce'), ev('已跳过『某篇』', '11:04', 'skipped')];
    // 默认关：跳过痕迹不出（聚合讯跳过量级大）
    expect(filterEvents(evs, F()).map((e) => e.text)).toEqual(['收藏文章『某篇』']);
    expect(filterEvents(evs, F({ skipped: true })).map((e) => e.text)).toEqual(['收藏文章『某篇』', '已跳过『某篇』']);
  });

  it('kind 直判优先（行为流事件）：文案像「状态推进」但 kind=produce 也按 produce 走', () => {
    // 旧回落判类会把它判成 progress（「新增备忘录」前缀）；行为流直带 kind 后以 kind 为准
    const e = ev('新增备忘录『甲』', '11:03', 'produce');
    expect(eventKind(e)).toBe('produce');
    expect(filterEvents([e], F({ progress: false })).length).toBe(1);
    expect(filterEvents([e], F({ produce: false })).length).toBe(0);
  });

  it('点评类含星级评价（movie:rated）：关「小橘点评」整条评价不显示', () => {
    const rated = ev('评价《沙丘》 ★4', '21:30', 'note');
    expect(eventKind(rated)).toBe('note');
    expect(filterEvents([rated], F()).length).toBe(1);
    expect(filterEvents([rated], F({ notes: false })).length).toBe(0);
  });

  it('flowHtml：只被「已跳过」过滤光的一天 → 专属空态（不是「还没有留下痕迹」）', () => {
    const html = flowHtml(river([ev('已跳过『某篇』', '11:04', 'skipped')]), '2026-09-11', { filter: F() });
    expect(html).toContain('内容过滤');
    expect(html).not.toContain('这一天还没有留下痕迹');
    // 打开「已跳过」→ 痕迹上河
    const on = flowHtml(river([ev('已跳过『某篇』', '11:04', 'skipped')]), '2026-09-11', { filter: F({ skipped: true }) });
    expect(on).toContain('已跳过『某篇』');
  });

  it('flowHtml：痕迹被过滤光 → 专属空态（明确告知「东西在，只是没显示」）', () => {
    const html = flowHtml(river([ev('新增备忘录『甲』')]), '2026-09-11', { filter: F({ progress: false }) });
    expect(html).toContain('bz-home-flow-empty');
    expect(html).toContain('内容过滤');
    expect(html).toContain('设置');
  });

  it('flowHtml：本来就没痕迹 → 原来的空态（不说「被过滤了」）', () => {
    const html = flowHtml(river([]), '2026-09-11', { filter: F() });
    expect(html).toContain('这一天还没有留下痕迹');
    expect(html).not.toContain('被「内容过滤」挡掉');
  });

  it('flowHtml：时刻列开关与字号档落到 data 属性；关掉不渲染时刻文本', () => {
    const day = river([ev('新增 3 条', '11:03')]);
    const on = flowHtml(day, '2026-09-11', { filter: F(), showTime: true, size: 'loose' });
    expect(on).toContain('data-tl-time="1"');
    expect(on).toContain('data-tl-size="loose"');
    expect(on).toContain('11:03');
    // 时刻列关掉：列整个不渲染（不是靠 CSS 藏——藏了也还在 DOM 里被读屏念出来）
    const off = flowHtml(day, '2026-09-11', { filter: F(), showTime: false, size: 'compact' });
    expect(off).toContain('data-tl-time="0"');
    expect(off).toContain('data-tl-size="compact"');
    expect(off).not.toContain('11:03');
  });

  it('flowHtml：关「点评 ✦」→ 整条点评不出现（痕迹本身还在）', () => {
    // buildNotes 要点：今天有痕迹 + 昨天有痕迹 → 首条挂「动手早晚」点评
    const data = river([ev('新增 3 条')]);
    data.today.firstTs = new Date(2026, 8, 11, 9, 0).getTime();
    data.yesterday.firstTs = new Date(2026, 8, 10, 8, 0).getTime();
    const on = flowHtml(data, '2026-09-11', { filter: F({ notes: true }) });
    expect(on).toContain('bz-home-ev-note');
    const off = flowHtml(data, '2026-09-11', { filter: F({ notes: false }) });
    expect(off).not.toContain('bz-home-ev-note');
    expect(off).toContain('bz-home-ev'); // 行还在
  });

  it('nextHtml：开关关掉返回空串（ui 层据此把第三栏整个 display:none）', () => {
    const data = river([]);
    expect(nextHtml(data, true)).toContain('明 天 预 告');
    expect(nextHtml(data, false)).toBe('');
  });
});
