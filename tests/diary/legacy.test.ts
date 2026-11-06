// @vitest-environment node
import { describe, expect, it, beforeEach } from 'vitest';
import { applyDiaryTypes, LEGACY_DIARY_TYPES } from '../../src/diary/config';
import { diaryFallbackTime, parseDayFileForRead, parseLegacyDayFile, serializeLegacyBlock, tagsFromEmojiSeq } from '../../src/diary/legacy';

beforeEach(() => {
  applyDiaryTypes(LEGACY_DIARY_TYPES);
});

describe('parseLegacyDayFile（一天一文件多块）', () => {
  it('按 # emoji HH:mm 切块：时间/标签/正文/行号范围', () => {
    const content = ['# 📖 08:00', '', '第一段', '', '# 🌙 23:10', '', '第二段', ''].join('\n');
    const day = parseLegacyDayFile(content, '我的/日记/2026-06-13.md')!;
    expect(day.date).toBe('2026-06-13');
    expect(day.unparsed).toBe(0);
    expect(day.blocks).toHaveLength(2);
    expect(day.blocks[0]).toMatchObject({ time: '08:00', tags: ['日记'], body: '第一段', line: 0, endLine: 3 });
    expect(day.blocks[1]).toMatchObject({ time: '23:10', tags: ['梦'], body: '第二段', line: 4, endLine: 7 });
  });

  it('组合 emoji 按 grapheme 切（✍️ 随笔 / 🧑‍🎨 艺术）', () => {
    expect(tagsFromEmojiSeq('✍️🧑‍🎨')).toEqual(['随笔', '艺术']);
  });

  it('首块前的游离正文计入 unparsed（转换时整份跳过，不静默丢）', () => {
    const day = parseLegacyDayFile('前言\n# 📖 08:00\n\n正文\n', '2026-06-13.md')!;
    expect(day.unparsed).toBe(1);
    expect(day.blocks).toHaveLength(1);
    expect(day.blocks[0].body).toBe('正文');
  });

  it('时间越界的头行不算条目，其下正文也成游离行（unparsed 计 2）', () => {
    const day = parseLegacyDayFile('# 📖 24:00\n\n正文\n', '2026-06-13.md')!;
    expect(day.blocks).toHaveLength(0);
    expect(day.unparsed).toBe(2); // 坏头行 + 它下面的正文
    expect(day.empty).toBe(false);
  });

  it('空文件：blocks 空、unparsed 0、empty true', () => {
    const day = parseLegacyDayFile('\n\n', '2026-06-13.md')!;
    expect(day.blocks).toEqual([]);
    expect(day.empty).toBe(true);
  });

  it('非 YYYY-MM-DD.md 文件名 → null', () => {
    expect(parseLegacyDayFile('# 📖 08:00\n正文', '随手记.md')).toBeNull();
    expect(parseLegacyDayFile('# 📖 08:00\n正文', '我的/日记/2606130800.md')).toBeNull();
  });

  it('用户删掉某个分类后，旧 emoji 仍能从旧表还原（读历史文件不丢标签）', () => {
    applyDiaryTypes([{ tag: '日记', emoji: '📖' }]); // 当前表没有「诗/梦」
    expect(tagsFromEmojiSeq('🌟')).toEqual(['诗']);
    expect(tagsFromEmojiSeq('🌙')).toEqual(['梦']);
  });

  it('同一天同刻两块靠 line 区分（写层删改不会串）', () => {
    const day = parseLegacyDayFile('# 📖 08:00\nA\n\n# 📖 08:00\nB\n', '2026-06-13.md')!;
    expect(day.blocks).toHaveLength(2);
    expect(day.blocks[0].line).not.toBe(day.blocks[1].line);
    expect(day.blocks.map((b) => b.body)).toEqual(['A', 'B']);
  });
});

describe('diaryFallbackTime（无头行文件的兜底时分）', () => {
  /** 本地时间构造：避免测试机时区影响（ctime 是 epoch 毫秒，取的是本地时分） */
  const at = (y: number, mo: number, d: number, h: number, mi: number): number =>
    new Date(y, mo - 1, d, h, mi).getTime();

  it('创建时间落在文件名那天：取它的 HH:mm', () => {
    expect(diaryFallbackTime(at(2026, 6, 13, 14, 7), '2026-06-13')).toBe('14:07');
    expect(diaryFallbackTime(at(2026, 6, 13, 0, 0), '2026-06-13')).toBe('00:00');
  });

  it('创建时间不在那天（拷贝 / 同步）：记 00:00，不编假时分', () => {
    expect(diaryFallbackTime(at(2026, 6, 14, 14, 7), '2026-06-13')).toBe('00:00');
    expect(diaryFallbackTime(at(2025, 6, 13, 14, 7), '2026-06-13')).toBe('00:00');
  });

  it('没有 ctime / 非法值：记 00:00', () => {
    expect(diaryFallbackTime(undefined, '2026-06-13')).toBe('00:00');
    expect(diaryFallbackTime(null, '2026-06-13')).toBe('00:00');
    expect(diaryFallbackTime(0, '2026-06-13')).toBe('00:00');
    expect(diaryFallbackTime(Number.NaN, '2026-06-13')).toBe('00:00');
  });
});

describe('parseDayFileForRead（整篇无头行降级）', () => {
  const at = (y: number, mo: number, d: number, h: number, mi: number): number =>
    new Date(y, mo - 1, d, h, mi).getTime();

  it('纯正文（Obsidian 原生日记）：整篇算一条，标签「日记」', () => {
    const content = '今天下雨了。\n\n在家写了一下午代码。\n';
    const day = parseDayFileForRead(content, '我的/日记/2026-06-13.md', '2026-06-13', at(2026, 6, 13, 14, 7))!;
    expect(day.whole).toBe(true);
    expect(day.unparsed).toBe(0);
    expect(day.empty).toBe(false);
    expect(day.blocks).toHaveLength(1);
    expect(day.blocks[0]).toMatchObject({
      time: '14:07',
      tags: ['日记'],
      body: '今天下雨了。\n\n在家写了一下午代码。',
      line: 0,
      endLine: 2,
    });
  });

  it('ctime 不在当天：时分记 00:00，内容照转', () => {
    const day = parseDayFileForRead('只有一段正文\n', '2026-06-13.md', '2026-06-13', at(2026, 6, 15, 9, 30))!;
    expect(day.whole).toBe(true);
    expect(day.blocks[0].time).toBe('00:00');
    expect(day.blocks[0].body).toBe('只有一段正文');
  });

  it('有头行的文件原样返回：不设 whole、时分支取头行', () => {
    const day = parseDayFileForRead('# 📖 08:00\n\n正文\n', '2026-06-13.md', '2026-06-13', at(2026, 6, 13, 14, 7))!;
    expect(day.whole).toBeUndefined();
    expect(day.blocks).toHaveLength(1);
    expect(day.blocks[0].time).toBe('08:00');
  });

  it('坏头行（时间越界）不降级：仍计入 unparsed，留给跳过报告', () => {
    const day = parseDayFileForRead('# 📖 24:00\n\n正文\n', '2026-06-13.md', '2026-06-13', at(2026, 6, 13, 14, 7))!;
    expect(day.whole).toBeUndefined();
    expect(day.blocks).toHaveLength(0);
    expect(day.unparsed).toBe(2);
  });

  it('带 bz 条目属性却用日期命名：不降级（是被改名的分片，frontmatter 不能当正文）', () => {
    const content = '---\ndate: 2026-06-13 08:00\ntype: 日记\n---\n\n正文\n';
    const day = parseDayFileForRead(content, '2026-06-13.md', '2026-06-13', at(2026, 6, 13, 14, 7))!;
    expect(day.whole).toBeUndefined();
    expect(day.blocks).toHaveLength(0);
  });

  it('全空白：仍是空文件，不合成空条目', () => {
    const day = parseDayFileForRead('\n\n  \n', '2026-06-13.md', '2026-06-13', at(2026, 6, 13, 14, 7))!;
    expect(day.empty).toBe(true);
    expect(day.blocks).toEqual([]);
  });

  it('CRLF 正文：先归一，行号范围覆盖首末非空行', () => {
    const day = parseDayFileForRead('\r\n第一行\r\n\r\n第二行\r\n', '2026-06-13.md', '2026-06-13', at(2026, 6, 13, 14, 7))!;
    expect(day.blocks[0].body).toBe('第一行\n\n第二行');
    expect(day.blocks[0].line).toBe(1);
    expect(day.blocks[0].endLine).toBe(3);
  });
});

describe('serializeLegacyBlock', () => {
  it('头行 = # emoji序列 HH:mm + 空行 + 正文 + 尾换行', () => {
    expect(serializeLegacyBlock(['日记'], '08:00', '正文')).toBe('# 📖 08:00\n\n正文\n');
  });

  it('多个平级分类的 emoji 直接相连（旧格式头行写法）', () => {
    expect(serializeLegacyBlock(['日记', '随笔'], '08:00', '正文')).toBe('# 📖✍️ 08:00\n\n正文\n');
  });

  it('当前表没有的分类用旧表 emoji 兜底，保证转换保真', () => {
    applyDiaryTypes([{ tag: '日记', emoji: '📖' }]);
    expect(serializeLegacyBlock(['诗'], '08:00', '正文')).toBe('# 🌟 08:00\n\n正文\n');
  });
});
