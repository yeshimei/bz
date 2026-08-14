/**
 * 黑匣子 v4 数据层测试（ticket 58）：
 * 纯函数缝——事件置信度分级 / mentions 门槛与合并 / 事件去重 / cursor 游标推进与过滤 / v4 清洗。
 * 数据层缝（blackbox.json v4 读写）见下方「数据层」describe。
 */
import { describe, it, expect } from 'vitest';
import {
  classifyEventConfidence,
  mergeMention,
  shouldBuildProfile,
  dedupeEvent,
  sanitizeMentions,
  filterNewEntries,
  cursorEntryIndex,
  advanceCursor,
  cursorForFile,
  buildEventReport,
  groupEventsByMonth,
  personLabel,
  sanitizeWords,
  sanitizeEmotions,
  DEFAULT_EMOTION_TAGS,
} from '../../src/blackbox/types';
import type { EventItem, Mention, DiarySourceEntry } from '../../src/blackbox/types';

// ===== 事件置信度分级（Q3：≥0.7 入线 / 0.5-0.7 推测 / <0.5 不入库） =====

describe('classifyEventConfidence', () => {
  it('0.85 → confirmed 直接入线', () => {
    expect(classifyEventConfidence(0.85)).toBe('confirmed');
  });
  it('0.7 边界 → confirmed', () => {
    expect(classifyEventConfidence(0.7)).toBe('confirmed');
  });
  it('0.6 → speculative 推测', () => {
    expect(classifyEventConfidence(0.6)).toBe('speculative');
  });
  it('0.5 边界 → speculative', () => {
    expect(classifyEventConfidence(0.5)).toBe('speculative');
  });
  it('0.4 → discard 不入库', () => {
    expect(classifyEventConfidence(0.4)).toBe('discard');
  });
  it('非法值（NaN/undefined）→ discard', () => {
    expect(classifyEventConfidence(NaN)).toBe('discard');
    expect(classifyEventConfidence(undefined as unknown as number)).toBe('discard');
  });
});

// ===== mentions 合并与画像门槛（Q12/Q13：≥2 次跨不同日期自动建画像） =====

describe('mergeMention', () => {
  it('新名字 → count 1 + 首末次同日期', () => {
    const out = mergeMention([], '老张', '2026-08-14');
    expect(out).toEqual([{ name: '老张', count: 1, firstSeen: '2026-08-14', lastSeen: '2026-08-14' }]);
  });
  it('已有名字同日 → count+1，首末次不变', () => {
    const before: Mention[] = [{ name: '老张', count: 1, firstSeen: '2026-08-14', lastSeen: '2026-08-14' }];
    const out = mergeMention(before, '老张', '2026-08-14');
    expect(out).toEqual([{ name: '老张', count: 2, firstSeen: '2026-08-14', lastSeen: '2026-08-14' }]);
  });
  it('已有名字新日期 → count+1，lastSeen 更新 firstSeen 保留', () => {
    const before: Mention[] = [{ name: '老张', count: 1, firstSeen: '2026-08-14', lastSeen: '2026-08-14' }];
    const out = mergeMention(before, '老张', '2026-08-16');
    expect(out).toEqual([{ name: '老张', count: 2, firstSeen: '2026-08-14', lastSeen: '2026-08-16' }]);
  });
  it('跨不同日期 ≥2 次 → shouldBuildProfile true', () => {
    const m1 = mergeMention([], '老张', '2026-08-14');
    const m2 = mergeMention(m1, '老张', '2026-08-16');
    expect(shouldBuildProfile(m2, '老张')).toBe(true);
  });
  it('同一天 2 次 → 不跨日期，shouldBuildProfile false', () => {
    const m1 = mergeMention([], '老张', '2026-08-14');
    const m2 = mergeMention(m1, '老张', '2026-08-14');
    expect(m2[0].count).toBe(2);
    expect(shouldBuildProfile(m2, '老张')).toBe(false);
  });
  it('单次出现 → 不建画像', () => {
    const m = mergeMention([], '老张', '2026-08-14');
    expect(shouldBuildProfile(m, '老张')).toBe(false);
  });
  it('sanitizeMentions 清洗：去空/去重/排序', () => {
    const raw = [
      { name: '  老张 ', count: 2, firstSeen: '2026-08-14', lastSeen: '2026-08-16' },
      { name: '老张', count: 3, firstSeen: '', lastSeen: '' },
      { name: '', count: 5, firstSeen: 'x', lastSeen: 'y' },
      null,
    ];
    const out = sanitizeMentions(raw);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('老张');
  });
});

// ===== 事件去重（标题 + 证据双重去重） =====

function makeEvent(over: Partial<EventItem>): EventItem {
  return {
    id: 'ev_1',
    title: '搬家完成',
    date: '2026-08-10T18:00:00',
    datePrecision: 'time',
    people: [],
    emotions: [],
    source: { path: '我的/日记/2026-08-10.md', lineNumber: 5, time: '18:00' },
    confidence: 0.85,
    status: 'confirmed',
    humanEdited: false,
    ...over,
  };
}

describe('dedupeEvent', () => {
  it('同标题同证据 → 去重 true', () => {
    const existing = [makeEvent({})];
    const candidate = makeEvent({ id: 'ev_2' });
    expect(dedupeEvent(existing, candidate)).toBe(true);
  });
  it('同标题不同证据（不同日记条目）→ 不去重', () => {
    const existing = [makeEvent({})];
    const candidate = makeEvent({ id: 'ev_2', source: { path: '我的/日记/2026-08-11.md', lineNumber: 3, time: '09:00' } });
    expect(dedupeEvent(existing, candidate)).toBe(false);
  });
  it('不同标题 → 不去重', () => {
    const existing = [makeEvent({})];
    const candidate = makeEvent({ id: 'ev_2', title: '开始新工作' });
    expect(dedupeEvent(existing, candidate)).toBe(false);
  });
});

// ===== cursor 游标（Q14：{file, entryIndex} 增量） =====

describe('cursor', () => {
  const entries: DiarySourceEntry[] = [
    { id: '2026-08-10-08-00-0', date: '2026-08-10', time: '08:00', content: '条目 A', filename: '2026-08-10', lineNumber: 1 },
    { id: '2026-08-10-09-00-1', date: '2026-08-10', time: '09:00', content: '条目 B', filename: '2026-08-10', lineNumber: 4 },
    { id: '2026-08-10-10-00-2', date: '2026-08-10', time: '10:00', content: '条目 C', filename: '2026-08-10', lineNumber: 7 },
  ];
  it('cursorEntryIndex：无 cursor → 0；匹配文件 → 游标值；其他文件 → 0', () => {
    expect(cursorEntryIndex(null, '2026-08-10.md')).toBe(0);
    expect(cursorEntryIndex({ file: '2026-08-10.md', entryIndex: 2 }, '2026-08-10.md')).toBe(2);
    expect(cursorEntryIndex({ file: '2026-08-10.md', entryIndex: 2 }, '2026-08-11.md')).toBe(0);
  });
  it('filterNewEntries：只返回游标之后的新条目（entryIndex=已处理条数）', () => {
    const cursor = { file: '2026-08-10.md', entryIndex: 1 };
    const out = filterNewEntries(entries, cursor);
    expect(out.map((e) => e.content)).toEqual(['条目 B', '条目 C']);
  });
  it('filterNewEntries：无 cursor → 全量', () => {
    const out = filterNewEntries(entries, null);
    expect(out).toHaveLength(3);
  });
  it('advanceCursor：推进到文件末尾 index；cursorForFile 归一', () => {
    const c = advanceCursor({ file: '2026-08-10.md', entryIndex: 1 }, '2026-08-10.md', entries.length);
    expect(c).toEqual({ file: '2026-08-10.md', entryIndex: 3 });
    expect(cursorForFile('2026-08-10.md', 0)).toEqual({ file: '2026-08-10.md', entryIndex: 0 });
  });
  it('重命名/删除日记文件 → cursor 失效回退（cursorEntryIndex 其他文件 → 0 全量）', () => {
    expect(cursorEntryIndex({ file: '2026-08-10.md', entryIndex: 2 }, '2026-08-10(1).md')).toBe(0);
  });
});

// ===== 保留既有纯函数（v2 沿用） =====

describe('v2 沿用纯函数', () => {
  it('buildEventReport：推测计数 >0 带括号', () => {
    expect(buildEventReport(5, 0)).toBe('这周我整理了 5 件新事件');
    expect(buildEventReport(5, 2)).toBe('这周我整理了 5 件新事件（其中 2 件推测）');
  });
  it('groupEventsByMonth：按年月降序分组', () => {
    const evs = [
      makeEvent({ date: '2026-08-10T18:00:00' }),
      makeEvent({ id: 'ev_2', date: '2026-07-01T09:00:00' }),
    ];
    const groups = groupEventsByMonth(evs);
    expect(groups.map((g) => g.key)).toEqual(['2026-08', '2026-07']);
  });
  it('personLabel：画像 id → 名，纯名字原样', () => {
    const profiles = [{ id: 'pf_1', name: '妈妈' } as any];
    expect(personLabel('pf_1', profiles)).toBe('妈妈');
    expect(personLabel('老张', profiles)).toBe('老张');
  });
  it('sanitizeWords/sanitizeEmotions 保留（24 词预置）', () => {
    expect(DEFAULT_EMOTION_TAGS).toHaveLength(24);
    expect(sanitizeWords([' 触动 ', '触动', '', '喜悦'])).toEqual(['触动', '喜悦']);
    expect(sanitizeEmotions(['难过', '难过', '愤怒', '焦虑'])).toEqual(['难过', '愤怒', '焦虑']);
  });
});

// ===== 数据层：blackbox.json v4 读写（ticket 58） =====

import { beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { BlackBoxDataManager, getBlackBoxFilePath, createProfile, createEvent } from '../../src/blackbox/data';
import { defaultBlackBoxData } from '../../src/blackbox/types';

function setupData() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  return { vault, app };
}

describe('blackbox.json v4 数据层', () => {
  beforeEach(() => {
    resetObsidianMocks();
  });

  it('load：文件不存在 → 默认空数据（懒创建）', async () => {
    const { vault } = setupData();
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.version).toBe(4);
    expect(data.profiles).toEqual([]);
    expect(data.mentions).toEqual([]);
    expect(data.events).toEqual([]);
    expect(data.cursor).toBeNull();
    expect(vault.files.has('CONFIG/STORAGE/blackbox.json')).toBe(false); // 未 save 不落盘
  });

  it('save → 读回 → 派生层数据一致（profiles/mentions/events/reviews/chat/cursor）', async () => {
    const { vault } = setupData();
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    data.profiles.push(createProfile('妈妈', '2026-08-14'));
    data.mentions.push({ name: '老张', count: 1, firstSeen: '2026-08-14', lastSeen: '2026-08-14' });
    data.events.push(
      createEvent('搬家完成', '2026-08-10T18:00:00', 0.85, { path: '我的/日记/2026-08-10.md', lineNumber: 5, time: '18:00' })
    );
    data.cursor = { file: '2026-08-10.md', entryIndex: 3 };
    await dm.save(data);

    const dm2 = new BlackBoxDataManager();
    const loaded = await dm2.load();
    expect(loaded.version).toBe(4);
    expect(loaded.profiles).toHaveLength(1);
    expect(loaded.profiles[0].name).toBe('妈妈');
    expect(loaded.profiles[0].humanEdited).toBe(false);
    expect(loaded.mentions).toEqual([{ name: '老张', count: 1, firstSeen: '2026-08-14', lastSeen: '2026-08-14' }]);
    expect(loaded.events).toHaveLength(1);
    expect(loaded.events[0].status).toBe('confirmed');
    expect(loaded.cursor).toEqual({ file: '2026-08-10.md', entryIndex: 3 });
  });

  it('load 缓存：重复 load 不重读文件（磁盘变更不影响缓存）', async () => {
    const { vault } = setupData();
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    data.mentions.push({ name: '老张', count: 1, firstSeen: '2026-08-14', lastSeen: '2026-08-14' });
    await dm.save(data);

    const dm2 = new BlackBoxDataManager();
    await dm2.load();
    // 外部直接改磁盘文件 → 缓存未失效前 load 命中旧缓存（不重读）
    const onDisk = JSON.parse(vault.files.get('CONFIG/STORAGE/blackbox.json')!);
    onDisk.mentions.push({ name: '小李', count: 2, firstSeen: '2026-08-15', lastSeen: '2026-08-16' });
    vault.files.set('CONFIG/STORAGE/blackbox.json', JSON.stringify(onDisk));
    const second = await dm2.load();
    expect(second.mentions).toHaveLength(1);
    // 失效缓存后 → 重读磁盘看到外部变更
    dm2.invalidate();
    const third = await dm2.load();
    expect(third.mentions).toHaveLength(2);
  });

  it('坏 JSON → 空库初始化 + 备份 .bak', async () => {
    const { vault } = setupData();
    vault.create('CONFIG/STORAGE/blackbox.json', '{broken json');
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.version).toBe(4);
    expect(vault.files.has('CONFIG/STORAGE/blackbox.json.bak')).toBe(true);
  });

  it('旧版本 v3 数据 → 空库初始化（无迁移链，v3 已删）', async () => {
    const { vault } = setupData();
    vault.create('CONFIG/STORAGE/blackbox.json', JSON.stringify({ version: 3, profiles: [], events: [] }));
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.version).toBe(4);
    expect(data.profiles).toEqual([]);
  });

  it('getBlackBoxFilePath：storagePath 优先', async () => {
    setupData();
    expect(getBlackBoxFilePath()).toBe('CONFIG/STORAGE/blackbox.json');
  });

  it('createProfile：id 前缀 pf_，humanEdited false', () => {
    const p = createProfile('妈妈', '2026-08-14');
    expect(p.id.startsWith('pf_')).toBe(true);
    expect(p.name).toBe('妈妈');
    expect(p.humanEdited).toBe(false);
    expect(p.mentionCount).toBe(0);
  });

  it('createEvent：置信度分级 → status；证据链落盘', () => {
    const e = createEvent('搬家完成', '2026-08-10T18:00:00', 0.6, {
      path: '我的/日记/2026-08-10.md',
      lineNumber: 5,
      time: '18:00',
    });
    expect(e.id.startsWith('ev_')).toBe(true);
    expect(e.status).toBe('speculative');
    expect(e.confidence).toBe(0.6);
    expect(e.source.lineNumber).toBe(5);
    expect(e.humanEdited).toBe(false);
  });
});
