// @vitest-environment node
/**
 * 内容首页（home 域）活动河数据层测试（issue 232；issue 305 时间线痕迹源替换）：
 * 规则纯函数（buildNotes/buildPreviews/buildDots/riverCountText）+ collectRiver
 * 只读采集集成（MockVault；时间线吃小橘行为流、计数各源容错、日记连击、不建文件）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { diaryEntryPath } from '../../src/core/diary-format';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import {
  collectRiver, buildNotes, buildPreviews, buildDots, riverCountText,
  EMPTY_COUNTS, dateStrOf,
} from '../../src/home/river';
import type { RiverData } from '../../src/home/river';

const NOW = new Date(2026, 8, 7, 21, 36).getTime(); // 2026-09-07 周一晚
const DAY = 86400000;

/** 行为流原始条目（issue 305：时间线痕迹源） */
function beh(source: string, type: string, name: string, dt: Date, extra: Record<string, unknown> = {}) {
  return {
    id: `beh_${dt.getTime()}`,
    timestamp: dt.toISOString(),
    type,
    source,
    description: `${source}:${type} ${name}`,
    metadata: { entityType: source, action: type, name, ...extra },
  };
}

/** 写行为流侧车文件（vault 内存 mock） */
function writeBehavior(vault: MockVault, items: unknown[]): void {
  vault.files.set('CONFIG/STORAGE/smartcat-behavior.json', JSON.stringify({ version: 1, items }));
}

function emptyRiver(): RiverData {
  const emptyDay = (ds: string) => ({ dateStr: ds, events: [], summary: { diary: 0, movies: 0, books: 0, memoDone: 0, memoCreated: 0, pomodoros: 0, pomodoroMinutes: 0 }, firstTs: null });
  const emptyWeek = (ds: string) => ({ dateStr: ds, label: ds.slice(5), dayOfMonth: Number(ds.slice(8)), weekday: '', hit: false });
  return {
    today: emptyDay(dateStrOf(NOW)),
    yesterday: emptyDay(dateStrOf(NOW - DAY)),
    days: Array.from({ length: 7 }, (_, i) => emptyDay(dateStrOf(NOW - i * DAY))),
    week: Array.from({ length: 7 }, (_, i) => emptyWeek(dateStrOf(NOW - i * DAY))),
    streak: { diaryStreak: 0, diaryWrittenToday: false },
    counts: { ...EMPTY_COUNTS },
    pomodoroFocusing: false,
  };
}

describe('buildNotes（时间线规则点评）', () => {
  it('空河：无点评', () => {
    expect(buildNotes(emptyRiver())).toEqual([]);
  });

  it('首条动静 vs 昨天首条：晚 N 分钟 / 早 N 分钟 / 持平三态', () => {
    const d = emptyRiver();
    const y9 = new Date(NOW); y9.setHours(9, 0, 0, 0);
    const t10 = y9.getTime() + 60 * 60000;
    d.yesterday.firstTs = y9.getTime();
    d.today.firstTs = t10;
    d.today.events = [{ domain: 'diary', ts: t10, timeLabel: '10:00', text: 'x' }];
    expect(buildNotes(d)[0].text).toContain('晚了 60 分钟');
    d.today.events[0].ts = y9.getTime() - 30 * 60000;
    d.today.firstTs = d.today.events[0].ts;
    expect(buildNotes(d)[0].text).toContain('早了 30 分钟');
    d.today.events[0].ts = y9.getTime();
    d.today.firstTs = y9.getTime();
    expect(buildNotes(d)[0].text).toContain('同一时间');
  });

  it('跨天：昨天首动 09:00 / 今天首动 07:42 → 早了 78 分钟（回归锁）', () => {
    // 真实数据的 firstTs 是绝对时间戳（今天 07:42 vs 昨天 09:00，跨天差 ~22.7h）——
    // 曾直接相减 → 显示「晚了 1362 分钟」（2026-09-10 原型自检抓到并修复）
    const d = emptyRiver();
    const t = new Date(NOW); t.setHours(7, 42, 0, 0);
    const y = new Date(NOW - DAY); y.setHours(9, 0, 0, 0);
    d.today.firstTs = t.getTime();
    d.today.events = [{ domain: 'diary', ts: t.getTime(), timeLabel: '07:42', text: 'x' }];
    d.yesterday.firstTs = y.getTime();
    expect(buildNotes(d)[0].text).toContain('早了 78 分钟');
  });

  it('昨天无痕迹：报今天首动时刻', () => {
    const d = emptyRiver();
    const t = new Date(NOW); t.setHours(8, 5, 0, 0);
    d.today.firstTs = t.getTime();
    d.today.events = [{ domain: 'diary', ts: t.getTime(), timeLabel: '08:05', text: 'x' }];
    expect(buildNotes(d)[0].text).toContain('08:05');
  });

  it('晚间动静 + 日记空 + 连击中 → 末条挂连击提醒；已写日记不提醒', () => {
    const d = emptyRiver();
    const ev = new Date(NOW); ev.setHours(20, 0, 0, 0);
    d.today.events = [{ domain: 'pomodoro', ts: ev.getTime(), timeLabel: '20:00', text: '专注 25 分钟' }];
    d.streak = { diaryStreak: 5, diaryWrittenToday: false };
    const notes = buildNotes(d);
    expect(notes.some((n) => n.text.includes('×5'))).toBe(true);
    d.streak = { diaryStreak: 5, diaryWrittenToday: true };
    expect(buildNotes(d).some((n) => n.text.includes('×5'))).toBe(false);
    // 白天动静不提醒
    const am = new Date(NOW); am.setHours(10, 0, 0, 0);
    d.streak = { diaryStreak: 5, diaryWrittenToday: false };
    d.today.events = [{ domain: 'pomodoro', ts: am.getTime(), timeLabel: '10:00', text: '专注 25 分钟' }];
    expect(buildNotes(d).some((n) => n.text.includes('连击'))).toBe(false);
  });
});

describe('buildPreviews（明天预告三张卡）', () => {
  it('复习明天到期 > 逾期 > 番茄三档；剪藏有货/清空两态；日记连击三态', () => {
    const d = emptyRiver();
    d.counts.reviewDueTomorrow = 3;
    d.counts.clippingUnread = 7;
    d.streak = { diaryStreak: 2, diaryWrittenToday: false };
    const p1 = buildPreviews(d);
    expect(p1[0].h).toContain('复习将到期 3 张');
    expect(p1[1].h).toContain('剪藏还压 7 篇');
    expect(p1[2].h).toContain('日记连击 ×2');

    d.counts.reviewDueTomorrow = 0;
    d.counts.reviewOverdue = 1;
    expect(buildPreviews(d)[0].h).toContain('1 张逾期卡');

    d.counts.reviewOverdue = 0;
    expect(buildPreviews(d)[0].h).toBe('番茄引擎待命');

    d.counts.clippingUnread = 0;
    expect(buildPreviews(d)[1].h).toBe('剪藏库已清空');

    d.streak = { diaryStreak: 0, diaryWrittenToday: true };
    expect(buildPreviews(d)[2].h).toContain('今日日记已写');
    d.streak = { diaryStreak: 0, diaryWrittenToday: false };
    expect(buildPreviews(d)[2].h).toBe('给明天留一句话');
  });
});

describe('buildDots / riverCountText（入口行彩点与计数文案）', () => {
  it('彩点：日记 ok/连击 warn、复习逾期 hot、备忘录/番茄/影视/书库有动静 ok、剪藏未读恒基线、其余 off', () => {
    const d = emptyRiver();
    d.today.summary.diary = 3;
    d.counts.reviewOverdue = 1;
    d.today.summary.memoDone = 2;
    d.today.events = [
      { domain: 'cinema', ts: NOW, timeLabel: '21:00', text: 'x' },
      { domain: 'bookshelf', ts: NOW, timeLabel: '21:00', text: 'x' },
    ];
    const dots = buildDots(d);
    expect(dots.diary).toBe('ok');
    expect(dots.review).toBe('hot');
    expect(dots.memo).toBe('ok');
    expect(dots.cinema).toBe('ok');
    expect(dots.bookshelf).toBe('ok');
    expect(dots.pomodoro).toBe('off');
    expect(dots.clipping).toBe('off'); // 无未读 → 灭
    expect(dots.favorites).toBeUndefined(); // 规则外域由 UI 层回落 off
    d.today.summary.diary = 0;
    d.streak = { diaryStreak: 4, diaryWrittenToday: false };
    expect(buildDots(d).diary).toBe('warn');
  });

  it('彩点五条件各自点亮（item-1789106079981）：剪藏未读/专注中/影院在看 warn、重要备忘/复习逾期 hot，warn>ok 取高', () => {
    const d = emptyRiver();
    // 剪藏本：未读 > 0 → warn
    d.counts.clippingUnread = 2;
    expect(buildDots(d).clipping).toBe('warn');
    d.counts.clippingUnread = 0;
    // 番茄钟：正在专注 → warn（即使今日零轮）；今日轮数 > 0 且未专注 → ok；专注压过 ok
    d.pomodoroFocusing = true;
    expect(buildDots(d).pomodoro).toBe('warn');
    d.pomodoroFocusing = false;
    d.today.summary.pomodoros = 2;
    expect(buildDots(d).pomodoro).toBe('ok');
    d.pomodoroFocusing = true;
    expect(buildDots(d).pomodoro).toBe('warn');
    d.pomodoroFocusing = false;
    d.today.summary.pomodoros = 0;
    // 影院：在看 > 0 → warn（压过今日痕迹 ok）
    d.counts.cinemaWatching = 1;
    expect(buildDots(d).cinema).toBe('warn');
    d.counts.cinemaWatching = 0;
    d.today.events = [{ domain: 'cinema', ts: NOW, timeLabel: '21:00', text: 'x' }];
    expect(buildDots(d).cinema).toBe('ok');
    d.today.events = [];
    // 书库（2026-09-11 用户要求）：在读 > 0 → warn（与影院在看同口径，压过今日痕迹 ok）；
    // 没在读时回落「今日有动静 ok」；两者皆无 → 灭
    d.counts.bookshelfReading = 2;
    expect(buildDots(d).bookshelf).toBe('warn');
    d.counts.bookshelfReading = 0;
    d.today.events = [{ domain: 'bookshelf', ts: NOW, timeLabel: '21:00', text: 'x' }];
    expect(buildDots(d).bookshelf).toBe('ok');
    d.today.events = [];
    // 备忘录：重要未完成 > 0 → hot（压过今日动静 ok）
    d.counts.memoUrgentOpen = 1;
    expect(buildDots(d).memo).toBe('hot');
    d.today.summary.memoDone = 2;
    expect(buildDots(d).memo).toBe('hot'); // 重要未完成仍在，hot 不降级
    d.counts.memoUrgentOpen = 0;
    expect(buildDots(d).memo).toBe('ok'); // 只剩今日动静 → ok
    d.today.summary.memoDone = 0;
    // 复习：逾期 > 0 → hot（既有规则不动）
    d.counts.reviewOverdue = 1;
    expect(buildDots(d).review).toBe('hot');
    d.counts.reviewOverdue = 0;
    expect(buildDots(d).review).toBe('off');
  });

  it('计数文案：各域口径与未接数域回落 null（UI 用域副题）', () => {
    const d = emptyRiver();
    d.counts.diaryTotal = 522;
    d.streak.diaryWrittenToday = true;
    d.counts.reviewTotal = 9;
    d.counts.reviewOverdue = 1;
    d.counts.cinemaWant = 25;
    d.counts.cinemaWatching = 4;
    d.counts.bookshelfReading = 9;
    d.counts.bookshelfFinished = 151;
    d.counts.clippingUnread = 55;
    d.counts.favoritesTotal = 48;
    d.counts.belongingsTotal = 65;
    expect(riverCountText('diary', d)).toBe('522 篇 · 今日已写');
    expect(riverCountText('review', d)).toBe('9 张 · 逾期 1');
    d.counts.reviewOverdue = 0;
    expect(riverCountText('review', d)).toBe('9 张在册');
    expect(riverCountText('cinema', d)).toBe('想看 25 · 在看 4');
    expect(riverCountText('bookshelf', d)).toBe('在读 9 · 读完 151');
    expect(riverCountText('clipping', d)).toBe('未读 55 篇');
    expect(riverCountText('favorites', d)).toBe('48 条');
    expect(riverCountText('belongings', d)).toBe('登记 65 件');
    // 2026-09-18 用户点名四项：游戏库（款数+总时长）/ 知识盒（三盒各自）/ 第二大脑（存储占用）/ 番茄（累计轮数）
    d.counts.gameshelfTotal = 42;
    d.counts.gameshelfMinutes = 5430; // 90.5h → 四舍五入 91
    expect(riverCountText('gameshelf', d)).toBe('42 款 · 91 小时');
    d.counts.knowledgeLit = 528;
    d.counts.knowledgeCards = 96;
    d.counts.knowledgeTopics = 12;
    expect(riverCountText('knowledge', d)).toBe('文献 528 · 卡片 96 · 主题 12');
    d.counts.secondbrainBytes = 2621440;
    expect(riverCountText('secondbrain', d)).toBe('2.5 MB');
    d.counts.pomodoroTotal = 317;
    expect(riverCountText('pomodoro', d)).toBe('累计 317 轮');
    // 缺数据回落 0 口径（不 NaN）
    expect(riverCountText('gameshelf', emptyRiver())).toBe('0 款 · 0 小时');
    expect(riverCountText('knowledge', emptyRiver())).toBe('文献 0 · 卡片 0 · 主题 0');
    expect(riverCountText('secondbrain', emptyRiver())).toBe('0 B');
    expect(riverCountText('pomodoro', emptyRiver())).toBe('累计 0 轮');
    // ADR-0115：回忆墙磁贴随升格并入日记本，'wall' id 退役 → 回落 null（与未接数域同口径）
    expect(riverCountText('wall', d)).toBeNull();
    expect(riverCountText('settings', d)).toBeNull();
  });
});

/* ---------- collectRiver 采集集成（MockVault，只读契约） ---------- */

describe('collectRiver（只读采集集成）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
  });

  it('空库：今天/昨天空河、计数全 0、连击 0，且不创建任何文件', async () => {
    const filesBefore = new Set(vault.files.keys());
    const d = await collectRiver(mockAppWithVault(vault) as any, NOW);
    expect(d.today.events).toEqual([]);
    expect(d.today.firstTs).toBeNull();
    expect(d.yesterday.events).toEqual([]);
    expect(d.counts).toEqual(EMPTY_COUNTS);
    expect(d.streak).toEqual({ diaryStreak: 0, diaryWrittenToday: false });
    // 专注态：番茄钟未初始化（只读裸相位，不 ensure 不恢复）→ 回落 false（item-1789106079981）
    expect(d.pomodoroFocusing).toBe(false);
    const created = [...vault.files.keys()].filter((p) => !filesBefore.has(p));
    expect(created).toEqual([]);
  });

  it('日记连击：今天未写从昨天往回数（不断签）；今天已写含今天', () => {
    const d0 = dateStrOf(NOW);
    const d1 = dateStrOf(NOW - DAY);
    const d2 = dateStrOf(NOW - 2 * DAY);
    // v3 题目（YYMMDDHHmm）经契约 helper 生成，保证夹具即生产格式
    vault.files.set(diaryEntryPath('我的/日记', d1, '08:30'), '昨天');
    vault.files.set(diaryEntryPath('我的/日记', d2, '21:05'), '前天');
    let r = collectRiver(mockAppWithVault(vault) as any, NOW);
    // 连击计算在 collectDiary（同步路径），Promise 包装后仍可断言
    return r.then((data) => {
      expect(data.streak).toEqual({ diaryStreak: 2, diaryWrittenToday: false });
      vault.files.set(diaryEntryPath('我的/日记', d0, '23:02'), '今天');
      return collectRiver(mockAppWithVault(vault) as any, NOW);
    }).then((data) => {
      expect(data.streak).toEqual({ diaryStreak: 3, diaryWrittenToday: true });
      expect(data.counts.diaryTotal).toBe(3);
    });
  });

  it('计数接通：影院评分三分 / 书库状态三分 / news 未读 / 坏 JSON 容错', async () => {
    vault.files.set('我的/影视/《想看》.md', '---\ntags:\n- 电影\n评分: -1\n---\n');
    vault.files.set('我的/影视/《在看》.md', '---\ntags:\n- 电影\n评分: 0\n---\n');
    vault.files.set('书库/在读一本.md', '---\ntags:\n- book\nreadingDate: 2026-09-01\ncompletionDate: \n---\n');
    vault.files.set('书库/读完一本.md', '---\ntags:\n- book\nreadingDate: 2026-08-01\ncompletionDate: 2026-09-01\n---\n');
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({ articles: [{ read: false }, { read: false }, { read: true }] }));
    vault.files.set('CONFIG/STORAGE/memo.json', '{{{bad json'); // 坏数据不拖垮
    const data = await collectRiver(mockAppWithVault(vault) as any, NOW);
    expect(data.counts.cinemaWant).toBe(1);
    expect(data.counts.cinemaWatching).toBe(1);
    expect(data.counts.bookshelfReading).toBe(1);
    expect(data.counts.bookshelfFinished).toBe(1);
    expect(data.counts.clippingUnread).toBe(2);
    expect(data.counts.diaryTotal).toBe(0);
  });

  it('周历 7 天窗口：今天在前、hit=当天有动静、label=MM-DD', async () => {
    writeBehavior(vault, [beh('memo', 'added', '甲', new Date(2026, 8, 6, 9, 0))]);
    const data = await collectRiver(mockAppWithVault(vault) as any, NOW);
    expect(data.days.length).toBe(7);
    expect(data.days[0].dateStr).toBe(dateStrOf(NOW));
    expect(data.days[6].dateStr).toBe(dateStrOf(NOW - 6 * DAY));
    expect(data.week[0].dateStr).toBe(dateStrOf(NOW));
    expect(data.week[0].label).toBe('09-07');
    expect(data.week[0].hit).toBe(false); // 今天无动静
    expect(data.week[1].hit).toBe(true); // 昨天（09-06）行为流有新增备忘录
    expect(data.week.map((w) => w.dayOfMonth)).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });

  it('时间线接通：行为流动作进时间线 + memoCreated 由「新增备忘录」前缀派生（issue 305）', async () => {
    writeBehavior(vault, [
      beh('memo', 'added', '甲', new Date(2026, 8, 7, 9, 0)),
      beh('memo', 'completed', '甲', new Date(2026, 8, 7, 10, 0)),
      beh('memo', 'added', '乙', new Date(2026, 8, 7, 11, 0)),
      beh('movie', 'watched', '沙丘', new Date(2026, 8, 7, 20, 0), { rating: 8 }),
      beh('movie', 'deleted', '噪音', new Date(2026, 8, 7, 20, 30)), // 删除动作不进时间线
      beh('news', 'skipped', '某篇', new Date(2026, 8, 7, 12, 0)),
    ]);
    // recap 侧继续供摘要数字（完成 1 条 → memoDone；文件统计口径不受影响）
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { title: '甲', created: '2026-09-07 09:00:00', completed: '2026-09-07 10:00:00' },
      { title: '乙', created: '2026-09-07 11:00:00', completed: null },
    ]));
    const data = await collectRiver(mockAppWithVault(vault) as any, NOW);
    expect(data.today.events.map((e) => e.text)).toEqual([
      '新增备忘录『甲』', '完成『甲』', '新增备忘录『乙』', '已跳过『某篇』', '标记《沙丘》已看',
    ]);
    expect(data.today.events.map((e) => e.kind)).toEqual(['progress', 'produce', 'progress', 'skipped', 'produce']);
    // 域归口：行为流 source → 首页域 id（渲染徽标/彩点 hasEvent 认这个）
    expect([...new Set(data.today.events.map((e) => e.domain))]).toEqual(['memo', 'clipping', 'cinema']);
    expect(data.today.summary.memoDone).toBe(1);
    expect(data.today.summary.memoCreated).toBe(2);
    expect(data.today.firstTs).toBe(new Date(2026, 8, 7, 9, 0).getTime());
  });

  it('影院批量回填免疫（issue 305 事故回归）：外部改笔记不进时间线，摘要口径照旧', async () => {
    // 观影日期=今天 + 已看 → recap 摘要 movies 仍计 1（文件统计职责保留），但时间线条目为零
    vault.files.set('我的/影视/《批量回填》.md', `---\ntags:\n- 电影\n评分: 8\n观影日期: ${dateStrOf(NOW)}\n---\n`);
    const data = await collectRiver(mockAppWithVault(vault) as any, NOW);
    expect(data.today.summary.movies).toBe(1);
    expect(data.today.events).toEqual([]);
    expect(data.week[0].hit).toBe(false);
  });

  it('备忘录重要筛选（item-1789106079981）：memoUrgentOpen 只数未完成的重要条，memoOpen 保持全量口径', async () => {
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      // 重要 + 未完成 → 计 urgent
      { title: ' urgent open', created: '2026-09-01 09:00:00', completed: null, priority: 'important' },
      // 普通 + 未完成 → 只进 memoOpen
      { title: '普通待办', created: '2026-09-01 10:00:00', completed: null },
      // 重要 + 已完成 → 两边都不计
      { title: 'urgent done', created: '2026-09-01 11:00:00', completed: '2026-09-02 08:00:00', priority: 'important' },
      // 非 important 字面量（如 normal/high）不算重要
      { title: '高优待办', created: '2026-09-01 12:00:00', completed: null, priority: 'high' },
    ]));
    const data = await collectRiver(mockAppWithVault(vault) as any, NOW);
    expect(data.counts.memoOpen).toBe(3); // 未完成全量（urgent open + 普通待办 + 高优待办）
    expect(data.counts.memoUrgentOpen).toBe(1); // 只剩重要且未完成
  });

  it('计数接通（2026-09-18 四项）：游戏库款数+时长 / 知识盒三盒 / 第二大脑字节 / 番茄累计', async () => {
    vault.files.set('我的/游戏/艾尔登法环.md', '---\nAppID: 1245620\n游玩分钟: 5400\n---\n');
    vault.files.set('我的/游戏/星露谷物语.md', '---\nAppID: 1245622\n游玩分钟: 600\n---\n');
    vault.files.set('我的/游戏/无主笔记.md', '没有 AppID 的普通笔记（不数）\n');
    vault.files.set('文献盒/间隔重复.md', 'x');
    vault.files.set('文献盒/主动回忆.md', 'x');
    vault.files.set('卡片盒/渐进总结.md', 'x');
    vault.files.set('主题盒/学习科学.md', 'x');
    vault.files.set('CONFIG/STORAGE/pomodoro.json', JSON.stringify({
      version: 1,
      state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
      history: [{ ts: 1, duration: 1500 }, { ts: 2, duration: 1500 }],
      // 明细 + 周归档相加 = 累计（trimWithArchive 落账口径：按日恒不交，不双计）
      archived: [{ week: '2026-08-03', count: 5, minutes: 125 }],
    }));
    vault.files.set('CONFIG/STORAGE/secondbrain.json', JSON.stringify({ version: 9, meta: { notes: {} } }));
    const data = await collectRiver(mockAppWithVault(vault) as any, NOW);
    expect(data.counts.gameshelfTotal).toBe(2);
    expect(data.counts.gameshelfMinutes).toBe(6000);
    expect(data.counts.knowledgeLit).toBe(2);
    expect(data.counts.knowledgeCards).toBe(1);
    expect(data.counts.knowledgeTopics).toBe(1);
    expect(data.counts.pomodoroTotal).toBe(7);
    expect(data.counts.secondbrainBytes).toBeGreaterThan(0);
  });

  it('四项计数的空/坏数据容错：文件缺失或 JSON 坏掉回落 0，不拖垮整面板', async () => {
    vault.files.set('CONFIG/STORAGE/pomodoro.json', '{{{bad json');
    const data = await collectRiver(mockAppWithVault(vault) as any, NOW);
    expect(data.counts.gameshelfTotal).toBe(0);
    expect(data.counts.knowledgeLit).toBe(0);
    expect(data.counts.secondbrainBytes).toBe(0);
    expect(data.counts.pomodoroTotal).toBe(0);
  });
});
