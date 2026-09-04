// @vitest-environment node
/**
 * 今日回顾（recap 域）聚合层测试（方向一 R2）：
 * 纯函数口径（当天窗口跨 0 点边界、空数据、各域独立、时间正序、番茄区间标签）
 * + collectRecap 只读采集集成（MockVault：混合数据、坏 json 该域 N/A、不建文件）。
 * 锚点：2026-09-04（周五），当天窗 = 2026-09-04 0 点 ~ 2026-09-05 0 点，本地时区。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import {
  todayRange, parseLocalDateTime, fmtHM, buildRecap, collectRecap,
  EMPTY_SUMMARY, EMPTY_SOURCES,
} from '../../src/recap/aggregate';
import type { RecapSources } from '../../src/recap/aggregate';

const DAY0 = new Date(2026, 8, 4).getTime(); // 当天 0 点
const NEXT0 = new Date(2026, 8, 5).getTime(); // 次日 0 点
const NOON = new Date(2026, 8, 4, 12, 0).getTime(); // 当天中午
const AT = (h: number, m: number) => new Date(2026, 8, 4, h, m).getTime();

/** 带数字 stat 的 vault（MockVault 默认 stat 是 Promise，测 mtime/ctime 痕迹时刻用） */
class StatVault extends MockVault {
  stats = new Map<string, { ctime: number; mtime: number }>();
  file(path: string): any {
    const f = super.file(path);
    const s = this.stats.get(path);
    if (s) f.stat = s;
    return f;
  }
}

describe('todayRange（本地 0 点窗）', () => {
  it('中午锚点：start=当天 0 点，end=次日 0 点，恰 24h', () => {
    const r = todayRange(NOON);
    expect(r.start).toBe(DAY0);
    expect(r.end).toBe(NEXT0);
    expect(r.end - r.start).toBe(86400000);
  });

  it('跨 0 点边界：当天 0 点整含、23:59:59.999 含、次日 0 点不含', () => {
    expect(todayRange(DAY0).start).toBe(DAY0);
    const r = todayRange(NEXT0 - 1);
    expect(r.start).toBe(DAY0);
    expect(NEXT0 - 1 >= r.start && NEXT0 - 1 < r.end).toBe(true);
    expect(NEXT0 >= r.start && NEXT0 < r.end).toBe(false);
  });
});

describe('parseLocalDateTime（日期串 → 本地毫秒）', () => {
  it('纯日期取 0 点；带时间到秒；单位数月日可解析', () => {
    expect(parseLocalDateTime('2026-09-04')).toBe(DAY0);
    expect(parseLocalDateTime('2026-09-04 09:02:00')).toBe(AT(9, 2));
    expect(parseLocalDateTime('2026-9-4 9:02')).toBe(AT(9, 2));
    expect(parseLocalDateTime('2026-09-04T21:00:00')).toBe(AT(21, 0));
  });

  it('非法输入不抛错返回 null（月日越界/时间越界/垃圾串）', () => {
    expect(parseLocalDateTime('')).toBeNull();
    expect(parseLocalDateTime('not-a-date')).toBeNull();
    expect(parseLocalDateTime('2026-13-40')).toBeNull();
    expect(parseLocalDateTime('2026-09-04 24:00')).toBeNull();
    expect(parseLocalDateTime(null)).toBeNull();
  });
});

describe('fmtHM', () => {
  it('本地时刻两位补零', () => {
    expect(fmtHM(AT(9, 2))).toBe('09:02');
    expect(fmtHM(AT(23, 14))).toBe('23:14');
  });
});

describe('buildRecap（聚合纯函数）', () => {
  const range = todayRange(NOON);

  it('空数据：摘要全 0、时间轴空', () => {
    const { summary, items } = buildRecap(EMPTY_SOURCES, range);
    expect(summary).toEqual(EMPTY_SUMMARY);
    expect(items).toEqual([]);
  });

  it('日记聚合一行「新增 N 条」，时刻=当天最后一条', () => {
    const sources: RecapSources = { ...EMPTY_SOURCES, diaryTimes: ['09:00', '23:10'] };
    const { summary, items } = buildRecap(sources, range);
    expect(summary.diary).toBe(2);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ domain: 'diary', ts: AT(23, 10), timeLabel: '23:10', text: '新增 2 条' });
  });

  it('影视：已看带星级（评分制同影院），想看条目计「加入片单」且不进摘要', () => {
    const sources: RecapSources = {
      ...EMPTY_SOURCES,
      movies: [
        { name: '星际穿越', watched: true, rating: 9, ts: AT(23, 14) },
        { name: '未评分一部', watched: true, rating: null, ts: AT(10, 0) },
        { name: '想看一部', watched: false, rating: null, ts: AT(11, 0) },
      ],
    };
    const { summary, items } = buildRecap(sources, range);
    expect(summary.movies).toBe(2); // 只计已看
    expect(items[2].text).toBe('标记《星际穿越》已看 · ★★★★☆'); // 9 分 = 4.5 星
    expect(items[0].text).toBe('标记《未评分一部》已看');
    expect(items[1].text).toBe('《想看一部》加入片单');
  });

  it('读书：读完与进度痕迹并存，同一本只计一次；进度文案带百分数', () => {
    const sources: RecapSources = {
      ...EMPTY_SOURCES,
      books: [
        { title: '同日读完的书', finished: true, progress: null, ts: AT(21, 0) },
        { title: '同日读完的书', finished: false, progress: 80, ts: AT(9, 30) },
        { title: '在读一本', finished: false, progress: 45, ts: AT(19, 30) },
      ],
    };
    const { summary, items } = buildRecap(sources, range);
    expect(summary.books).toBe(2);
    expect(items.map((i) => i.text)).toEqual([
      '《同日读完的书》读到 80%',
      '《在读一本》读到 45%',
      '读完《同日读完的书》',
    ]);
  });

  it('待办：完成计数并入摘要，新增不计完成', () => {
    const sources: RecapSources = {
      ...EMPTY_SOURCES,
      todos: [
        { title: '买菜', done: true, ts: AT(9, 2) },
        { title: '写周报', done: false, ts: AT(8, 0) },
      ],
    };
    const { summary, items } = buildRecap(sources, range);
    expect(summary.todoDone).toBe(1);
    expect(items[0]).toMatchObject({ domain: 'todo', timeLabel: '08:00', text: '新增待办『写周报』' });
    expect(items[1]).toMatchObject({ domain: 'todo', timeLabel: '09:02', text: '完成『买菜』' });
  });

  it('番茄：区间标签 [ts-duration, ts] + 归属任务名 + 分钟折算；零时长回落单时刻', () => {
    const sources: RecapSources = {
      ...EMPTY_SOURCES,
      pomodoros: [
        { task: '写周报', duration: 1500, ts: AT(21, 25) },
        { task: null, duration: 0, ts: AT(10, 0) },
      ],
    };
    const { summary, items } = buildRecap(sources, range);
    expect(summary.pomodoros).toBe(2);
    expect(summary.pomodoroMinutes).toBe(25);
    expect(items[1]).toMatchObject({ domain: 'pomodoro', timeLabel: '21:00–21:25', text: '专注《写周报》 · 25 分钟' });
    expect(items[0].timeLabel).toBe('10:00'); // 零时长回落单时刻
  });

  it('混合五域：时间轴按时刻正序；0 点无时刻痕迹沉底', () => {
    const sources: RecapSources = {
      diaryTimes: ['20:10'],
      movies: [{ name: '夜片', watched: true, rating: 8, ts: AT(23, 0) }],
      books: [{ title: '小说', finished: false, progress: 45, ts: AT(19, 30) }],
      todos: [{ title: '晨跑', done: true, ts: AT(7, 0) }],
      pomodoros: [{ task: null, duration: 1500, ts: AT(21, 25) }],
    };
    const { summary, items } = buildRecap(sources, range);
    expect(summary).toEqual({ diary: 1, movies: 1, books: 1, todoDone: 1, pomodoros: 1, pomodoroMinutes: 25 });
    expect(items.map((i) => i.timeLabel)).toEqual(['07:00', '19:30', '20:10', '21:00–21:25', '23:00']);
    // 无时刻可考的痕迹落当天 0 点（排序沉底为最早）
    const sunk = buildRecap({ ...EMPTY_SOURCES, books: [{ title: 'X', finished: true, progress: null, ts: DAY0 - 5000 }] }, range);
    expect(sunk.items[0].ts).toBe(DAY0);
  });
});

/* ---------- collectRecap 采集集成（MockVault，只读契约） ---------- */

/** 本地时区今天日期串与时刻（collectRecap 缺省 now=Date.now()，用例数据全部动态锚定今天） */
function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const TODAY0 = new Date().setHours(0, 0, 0, 0); // 今天本地 0 点毫秒
const AT_TODAY = (h: number, m: number) => TODAY0 + h * 3600000 + m * 60000;

describe('collectRecap（只读采集集成）', () => {
  let vault: StatVault;

  beforeEach(() => {
    vault = new StatVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
  });

  it('空库：摘要全 0、无痕迹、无失败域，且不创建任何文件（只读契约）', async () => {
    const filesBefore = new Set(vault.files.keys());
    const data = await collectRecap(mockAppWithVault(vault) as any);
    expect(data.summary).toEqual(EMPTY_SUMMARY);
    expect(data.items).toEqual([]);
    expect(data.failed).toEqual([]);
    const created = [...vault.files.keys()].filter((p) => !filesBefore.has(p));
    expect(created).toEqual([]);
  });

  it('混合数据：五域痕迹齐全、时间正序、摘要同口径（含 mtime 痕迹时刻与归属任务名）', async () => {
    const t = todayStr();
    const y = todayStr(-1);
    // 日记：当天 2 条可见（09:00 / 23:10）+ 1 条加密（内容含 🔐，同日记本口径不可见不计数）
    vault.files.set(`我的/日记/${t}.md`, [
      '# 📖 09:00', '', '早读了一会儿', '',
      '# 📖 12:00', '', '🔐这条加密了', '',
      '# 📖 23:10', '', '睡前记一笔', '',
    ].join('\n'));
    vault.files.set(`我的/日记/${y}.md`, '# 📖 08:00\n\n昨天的');
    // 影视：1 部今天标记已看（mtime 今天 23:14）+ 1 部今天创建的想看 + 1 部昨天已看
    vault.files.set('我的/影视/《夜片》.md', '---\ntags:\n- 电影\n观影日期: ' + t + '\n评分: 9\n---\n');
    vault.files.set('我的/影视/《新片单》.md', '---\ntags:\n- 电影\n评分: -1\n---\n');
    vault.files.set('我的/影视/《旧片》.md', '---\ntags:\n- 电影\n观影日期: ' + y + '\n评分: 7\n---\n');
    vault.stats.set('我的/影视/《夜片》.md', { ctime: AT_TODAY(10, 0), mtime: AT_TODAY(23, 14) });
    vault.stats.set('我的/影视/《新片单》.md', { ctime: AT_TODAY(11, 0), mtime: AT_TODAY(11, 0) });
    // 书：1 本今天读完（mtime 21:00）+ 1 本在读今天有进度（mtime 19:30）+ 1 本昨天读完
    vault.files.set('书库/读完的书.md', '---\ntags:\n- book\nreadingDate: 2026-08-01\ncompletionDate: ' + t + '\n---\n');
    vault.files.set('书库/在读的书.md', '---\ntags:\n- book\nreadingDate: 2026-08-01\nreadingProgress: 45\n---\n');
    vault.files.set('书库/昨天读完.md', '---\ntags:\n- book\nreadingDate: 2026-08-01\ncompletionDate: ' + y + '\n---\n');
    vault.stats.set('书库/读完的书.md', { ctime: AT_TODAY(9, 0), mtime: AT_TODAY(21, 0) });
    vault.stats.set('书库/在读的书.md', { ctime: AT_TODAY(9, 0), mtime: AT_TODAY(19, 30) });
    // 待办：今天完成 1（昨天创建）+ 今天新增 1（未完成）
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { title: '晨跑', created: `${y} 08:00:00`, completed: `${t} 09:02:00` },
      { title: '写周报', created: `${t} 08:00:00`, completed: null },
    ]));
    // 番茄：今天 1 个 25 分钟（归属任务）+ 昨天 1 个
    vault.files.set('CONFIG/STORAGE/pomodoro.json', JSON.stringify({
      version: 1,
      state: {},
      history: [
        { ts: AT_TODAY(21, 25), duration: 1500, task: '写周报' },
        { ts: AT_TODAY(21, 25) - 86400000, duration: 600 },
      ],
    }));

    const data = await collectRecap(mockAppWithVault(vault) as any);
    expect(data.failed).toEqual([]);
    expect(data.summary).toEqual({ diary: 2, movies: 1, books: 2, todoDone: 1, pomodoros: 1, pomodoroMinutes: 25 });
    const texts = data.items.map((i) => `${i.timeLabel} ${i.domain} ${i.text}`);
    expect(texts).toEqual([
      '08:00 todo 新增待办『写周报』',
      '09:02 todo 完成『晨跑』',
      '11:00 cinema 《新片单》加入片单',
      '19:30 bookshelf 《在读的书》读到 45%',
      '21:00 bookshelf 读完《读完的书》',
      '21:00–21:25 pomodoro 专注《写周报》 · 25 分钟',
      '23:10 diary 新增 2 条',
      '23:14 cinema 标记《夜片》已看 · ★★★★☆',
    ]);
  });

  it('坏数据容错：memo.json / pomodoro.json 解析失败 → 该域记 failed（摘要 N/A 的依据），其余域不受牵连', async () => {
    vault.files.set('CONFIG/STORAGE/memo.json', '{{{bad json');
    vault.files.set('CONFIG/STORAGE/pomodoro.json', 'not-json-at-all');
    vault.files.set(`我的/日记/${todayStr()}.md`, '# 📖 09:00\n\n还活着');
    const data = await collectRecap(mockAppWithVault(vault) as any);
    expect(data.failed.sort()).toEqual(['pomodoro', 'todo']);
    expect(data.summary.diary).toBe(1);
    expect(data.items).toHaveLength(1);
  });
});
