// @vitest-environment node
import { describe, expect, it, beforeEach } from 'vitest';
import { applyDiaryTypes, LEGACY_DIARY_TYPES } from '../../src/diary/config';
import { parseLegacyDayFile, serializeLegacyBlock, tagsFromEmojiSeq } from '../../src/diary/legacy';

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
