// @vitest-environment node
/**
 * 内容首页（home 域）本周聚合测试（R1 生活周报轻卡）：
 * 纯函数口径（跨周边界——周一 0 点前后、空数据、各指标独立）+ collectWeeklyStat /
 * collectHomeSnapshot 只读采集集成（MockVault；空库全 0、不建文件）。
 * 锚点：2026-09-02 为周三，本周 = 2026-08-31（周一）0 点 ~ 2026-09-07（周一）0 点，本地时区。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import {
  currentWeekRange, parseLocalDay, countMoviesThisWeek, countBooksFinished,
  sumPomodoroWeek, todoWeekStats, countDiaryThisWeek, collectWeeklyStat, EMPTY_WEEKLY,
} from '../../src/home/weekly';
import { collectHomeSnapshot } from '../../src/home/snapshot';

const MON = new Date(2026, 7, 31).getTime(); // 本周一 0 点（2026-08-31）
const NEXT_MON = new Date(2026, 8, 7).getTime(); // 下周一 0 点（2026-09-07）
const WED = new Date(2026, 8, 2, 12, 0).getTime(); // 本周三中午
const LAST_SUN = new Date(2026, 7, 30, 15, 0).getTime(); // 上周日下午
const THIS_SUN = new Date(2026, 8, 6, 23, 0).getTime(); // 本周日晚上

describe('currentWeekRange（周一为一周起点，本地时区）', () => {
  it('周三锚点：start=本周一 0 点，end=下周一 0 点，恰 7 天', () => {
    const r = currentWeekRange(WED);
    expect(r.start).toBe(MON);
    expect(r.end).toBe(NEXT_MON);
    expect(r.end - r.start).toBe(7 * 86400000);
    expect(new Date(r.start).getDay()).toBe(1); // 周一
  });

  it('周一 0 点锚：自身即窗口起点；含起点、不含终点', () => {
    const r = currentWeekRange(MON);
    expect(r.start).toBe(MON);
    expect(r.end).toBe(NEXT_MON);
  });

  it('周边界：周日 23:59:59.999（周一 0 点前 1ms）已属下一周', () => {
    const prev = currentWeekRange(MON - 1);
    expect(prev.start).toBe(MON - 7 * 86400000);
    const sunday = currentWeekRange(THIS_SUN);
    expect(sunday.start).toBe(MON); // 本周日仍属本周
  });
});

describe('parseLocalDay（日期串前缀 → 本地 0 点）', () => {
  it('标准日期 / 带时间后缀 / 单位数均可解析，且为本地时区当日 0 点', () => {
    const day = new Date(2026, 8, 2).getTime();
    expect(parseLocalDay('2026-09-02')).toBe(day);
    expect(parseLocalDay('2026-09-02 13:00:00')).toBe(day);
    expect(parseLocalDay('2026-9-2')).toBe(day);
  });

  it('非法输入返回 null（不抛错）', () => {
    expect(parseLocalDay('')).toBeNull();
    expect(parseLocalDay('not-a-date')).toBeNull();
    expect(parseLocalDay(null)).toBeNull();
    expect(parseLocalDay(undefined)).toBeNull();
    expect(parseLocalDay('2026-13-40')).toBeNull(); // 月/日越界
  });
});

describe('本周影视（countMoviesThisWeek）', () => {
  const mk = (watchDate: string | null, ctime: number, watched = true) => ({ watchDate, ctime, watched });

  it('观影日期落本周计 1：周一 0 点起、周日内均计入', () => {
    const items = [mk('2026-09-02', 0), mk('2026-08-31', 0), mk('2026-09-06', 0)];
    expect(countMoviesThisWeek(items, currentWeekRange(WED))).toBe(3);
  });

  it('观影日期上周 / 下周不计', () => {
    const items = [mk('2026-08-30', 0), mk('2026-09-07', 0)];
    expect(countMoviesThisWeek(items, currentWeekRange(WED))).toBe(0);
  });

  it('无观影日期回退创建时间：ctime 本周计、上周不计', () => {
    const items = [mk(null, WED), mk(null, LAST_SUN)];
    expect(countMoviesThisWeek(items, currentWeekRange(WED))).toBe(1);
  });

  it('观影日期优先：有日期时不再看创建时间（上周日期 + 本周创建 → 不计）', () => {
    expect(countMoviesThisWeek([mk('2026-08-30', WED)], currentWeekRange(WED))).toBe(0);
  });

  it('想看/在看（watched=false）不计，各条独立', () => {
    const items = [mk('2026-09-02', 0, false), mk('2026-09-03', 0)];
    expect(countMoviesThisWeek(items, currentWeekRange(WED))).toBe(1);
  });

  it('空数据 → 0', () => {
    expect(countMoviesThisWeek([], currentWeekRange(WED))).toBe(0);
  });
});

describe('本周读完（countBooksFinished）', () => {
  it('completionDate 落本周计数，上周/null 不计，指标独立', () => {
    const items = [
      { completionDate: '2026-09-01' },
      { completionDate: '2026-08-29' }, // 上周
      { completionDate: null },
      { completionDate: '2026-09-06' },
    ];
    expect(countBooksFinished(items, currentWeekRange(WED))).toBe(2);
    expect(countBooksFinished([], currentWeekRange(WED))).toBe(0);
  });
});

describe('本周番茄（sumPomodoroWeek）', () => {
  it('本周条目计数 + duration 秒求和折分钟；上周不计', () => {
    const history = [
      { ts: WED, duration: 1500 }, // 25 分钟
      { ts: MON, duration: 600 }, // 10 分钟（周一 0 点整，含）
      { ts: LAST_SUN, duration: 3600 }, // 上周
    ];
    const s = sumPomodoroWeek(history, currentWeekRange(WED));
    expect(s.count).toBe(2);
    expect(s.minutes).toBe(35);
  });

  it('周边界：终点（下周一 0 点）不含，终点前 1ms 含', () => {
    const history = [
      { ts: NEXT_MON, duration: 60 },
      { ts: NEXT_MON - 1, duration: 60 },
    ];
    const s = sumPomodoroWeek(history, currentWeekRange(WED));
    expect(s.count).toBe(1);
    expect(s.minutes).toBe(1);
  });

  it('空数据 → 0 个 0 分钟', () => {
    expect(sumPomodoroWeek([], currentWeekRange(WED))).toEqual({ count: 0, minutes: 0 });
  });
});

describe('本周待办（todoWeekStats：完成/创建两项独立）', () => {
  it('上周创建本周完成：计完成不计创建；本周创建未完成：只计创建', () => {
    const items = [
      { created: '2026-08-29 10:00:00', completed: '2026-09-02 11:00:00' },
      { created: '2026-09-01 09:00:00', completed: null },
      { created: '2026-09-02 08:00:00', completed: '2026-09-03 20:00:00' },
      { created: '2026-08-20 08:00:00', completed: '2026-08-25 20:00:00' }, // 上周创建上周完成
    ];
    const s = todoWeekStats(items, currentWeekRange(WED));
    expect(s.done).toBe(2);
    expect(s.created).toBe(2);
  });

  it('空数据 → 完成创建双 0（UI 侧创建 0 不显示百分号的数据基础）', () => {
    expect(todoWeekStats([], currentWeekRange(WED))).toEqual({ done: 0, created: 0 });
    expect(todoWeekStats([{ created: null, completed: null }], currentWeekRange(WED))).toEqual({ done: 0, created: 0 });
  });
});

describe('本周日记（countDiaryThisWeek）', () => {
  it('文件名 YYYY-MM-DD 落本周计数；上周日/非日期名忽略', () => {
    const names = ['2026-09-02', '2026-08-31', '2026-08-30', '2026-09-06', '杂记'];
    expect(countDiaryThisWeek(names, currentWeekRange(WED))).toBe(3);
    expect(countDiaryThisWeek([], currentWeekRange(WED))).toBe(0);
  });
});

/* ---------- 采集集成（MockVault，只读契约） ---------- */

function cinemaMd(rating: number | null, watchDate: string | null): string {
  return `---\ntags:\n- 电影\n观影日期: ${watchDate ?? ''}\n评分: ${rating ?? ''}\n---\n`;
}

function bookMd(completionDate: string | null): string {
  return `---\ntags:\n- book\nreadingDate: 2026-08-01\ncompletionDate: ${completionDate ?? ''}\n---\n`;
}

/** 本地时区日期串（相对今天偏移 N 天；collectHomeSnapshot 用 Date.now() 定周窗的用例专用） */
function localDayStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

describe('collectWeeklyStat（只读采集集成）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
  });

  it('空库：五项全 0（不抛错），且不创建任何文件（只读契约）', async () => {
    const filesBefore = new Set(vault.files.keys());
    const stat = await collectWeeklyStat(mockAppWithVault(vault) as any, WED);
    expect(stat).toEqual(EMPTY_WEEKLY);
    const created = [...vault.files.keys()].filter((p) => !filesBefore.has(p));
    expect(created).toEqual([]);
  });

  it('混合数据：各指标独立聚合（影视/读完/番茄/待办/日记）', async () => {
    // 影视：1 部本周已看 + 1 部上周已看 + 1 部本周想看（不计）
    vault.files.set('我的/影视/《周中一场》.md', cinemaMd(8, '2026-09-02'));
    vault.files.set('我的/影视/《上周一场》.md', cinemaMd(7, '2026-08-29'));
    vault.files.set('我的/影视/《想看一部》.md', cinemaMd(-1, null));
    // 读完：本周 1 本 + 上周 1 本
    vault.files.set('书库/本周读完的书.md', bookMd('2026-09-01'));
    vault.files.set('书库/上周读完的书.md', bookMd('2026-08-29'));
    // 番茄：本周 2 个共 35 分钟 + 上周 1 个
    vault.files.set('CONFIG/STORAGE/pomodoro.json', JSON.stringify({
      version: 1,
      state: {},
      history: [
        { ts: WED, duration: 1500 },
        { ts: MON, duration: 600 },
        { ts: LAST_SUN, duration: 1800 },
      ],
    }));
    // 待办：本周创建 2（其中 1 条本周完成）+ 上周创建本周完成 1 → done 2 / created 2
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { created: '2026-09-01 09:00:00', completed: null },
      { created: '2026-09-02 08:00:00', completed: '2026-09-03 20:00:00' },
      { created: '2026-08-29 10:00:00', completed: '2026-09-02 11:00:00' },
    ]));
    // 日记：本周 2 条 + 上周日 1 条
    vault.files.set('我的/日记/2026-09-01.md', '周一');
    vault.files.set('我的/日记/2026-09-02.md', '周三');
    vault.files.set('我的/日记/2026-08-30.md', '上周日');

    const stat = await collectWeeklyStat(mockAppWithVault(vault) as any, WED);
    expect(stat.movies).toBe(1);
    expect(stat.booksFinished).toBe(1);
    expect(stat.pomodoros).toBe(2);
    expect(stat.pomodoroMinutes).toBe(35);
    expect(stat.todoDone).toBe(2);
    expect(stat.todoCreated).toBe(2);
    expect(stat.diary).toBe(2);
  });

  it('坏数据容错：memo.json / pomodoro.json 非法 JSON、影院目录缺失 → 该项回落 0 不抛错', async () => {
    vault.files.set('CONFIG/STORAGE/memo.json', '{{{bad json');
    vault.files.set('CONFIG/STORAGE/pomodoro.json', 'not-json-at-all');
    const stat = await collectWeeklyStat(mockAppWithVault(vault) as any, WED);
    expect(stat).toEqual(EMPTY_WEEKLY);
  });
});

describe('collectHomeSnapshot 扩展 weekly 字段', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
  });

  it('空库快照：weekly 存在且全 0（可选字段向后兼容旧消费方）', async () => {
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.ok).toBe(true);
    expect(snap.weekly).toEqual(EMPTY_WEEKLY);
  });

  it('有数据快照：weekly 与 collectWeeklyStat 同口径', async () => {
    // collectHomeSnapshot 内部以 Date.now() 定周窗，测试数据用「今天」动态构造（今天必属本周）
    vault.files.set(`我的/日记/${localDayStr(0)}.md`, '日记');
    vault.files.set(`我的/影视/《一场》.md`, cinemaMd(9, localDayStr(0)));
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.weekly!.movies).toBe(1);
    expect(snap.weekly!.diary).toBe(1);
    expect(snap.weekly!.pomodoros).toBe(0);
  });
});
