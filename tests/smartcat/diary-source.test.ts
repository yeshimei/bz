// @vitest-environment node
/**
 * 日记观察文案/解析/判定纯函数层（ticket 077，ADR-0030；ADR-0130 一目一文件）：
 * 解析（frontmatter 类型/正文全量/损坏降级 null）、判定（首落有字门/空正文不落/累计 >50 更新/≤50 不生成）、
 * 文案（首次/更新带分类变化/删除/文件级删除兜底）。集成链路见 diary-action.test.ts。
 */
import { describe, it, expect } from 'vitest';
import {
  parseDiaryEntry, decideDiarySettle, diaryFirstText, diaryUpdateText,
  diaryDeleteText, diaryDeleteFileText, diaryCharCount, DIARY_UPDATE_THRESHOLD,
  type DiarySettleState,
} from '../../src/smartcat/diary-source';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';

const entry = (time: string, tags: string[], body: string, date = '2026-08-24') =>
  serializeDiaryEntryFile({ date, time }, tags, body);

describe('parseDiaryEntry（解析条目文件）', () => {
  it('单条目：frontmatter 时间+类型，正文全量', () => {
    expect(parseDiaryEntry(entry('14:30', ['日记'], '今天天气不错'))).toEqual({
      time: '14:30',
      tags: ['日记'],
      body: '今天天气不错',
    });
  });

  it('多类型列表逐项解析（主/二级都列）', () => {
    expect(parseDiaryEntry(entry('23:05', ['日记', '猫'], '写了猫'))!.tags).toEqual(['日记', '猫']);
    expect(parseDiaryEntry(entry('09:00', ['收藏', '咪咪'], '收藏'))!.tags).toEqual(['收藏', '咪咪']);
  });

  it('类型空缺回退「日记」', () => {
    const content = '---\n日期: 2026-08-24 09:00\n类型:\n---\n\nx';
    expect(parseDiaryEntry(content)!.tags).toEqual(['日记']);
  });

  it('正文全量不截断（多行/多段保留，仅去首尾空白）', () => {
    const body = '第一行\n\n第二行\n# 非标题行（无时间）也算正文\n末尾';
    const parsed = parseDiaryEntry(entry('08:00', ['日记'], body));
    expect(parsed!.body).toBe(body);
  });

  it('只有 frontmatter（正文空）→ body 空串；frontmatter 日期损坏 → null；无 frontmatter → null', () => {
    expect(parseDiaryEntry(entry('08:00', ['日记'], ''))!.body).toBe('');
    expect(parseDiaryEntry('')).toBeNull();
    expect(parseDiaryEntry('---\n日期: 2026-13-45 99:99\n类型:\n  - 日记\n---\n\n正文')).toBeNull();
    expect(parseDiaryEntry('随便几行没有 frontmatter\n')).toBeNull();
  });
});

describe('decideDiarySettle（结算判定纯函数）', () => {
  const base: DiarySettleState = { generated: false, baseline: '', baselineTags: [], accum: 0 };

  it('首落有字 → 新增观察（next 记已见 + 基线 = 当前正文）', () => {
    const r = decideDiarySettle({ time: '23:05', tags: ['日记', '猫'], body: '今天陪猫玩' }, '2026-08-24', base);
    expect(r.kind).toBe('first');
    if (r.kind !== 'first') return;
    expect(r.text).toBe('你在 2026-08-24 23:05 写了一篇日记（分类：日记、猫）：今天陪猫玩');
    expect(r.next).toEqual({ generated: true, baseline: '今天陪猫玩', baselineTags: ['日记', '猫'], accum: 0 });
  });

  it('空标题不落：只有标题（正文空）→ 不生成，仍记未已见（补正文后走首落）', () => {
    const r = decideDiarySettle({ time: '08:00', tags: ['日记'], body: '' }, '2026-08-24', base);
    expect(r).toEqual({ kind: 'none', text: null, next: base });
    // 补正文后再结算 → 首落（不是「你更新了日记」）
    const r2 = decideDiarySettle({ time: '08:00', tags: ['日记'], body: '写了点东西' }, '2026-08-24', base);
    expect(r2.kind).toBe('first');
  });

  it('已有观察：累计 ≤50 不生成（本次补写不进记忆，但计入累计）——对齐 ticket「60→75 累计 +15」', () => {
    const state: DiarySettleState = { generated: true, baseline: '早'.repeat(60), baselineTags: ['日记'], accum: 0 };
    const r = decideDiarySettle({ time: '23:05', tags: ['日记'], body: '早'.repeat(75) }, '2026-08-24', state);
    expect(r.kind).toBe('none');
    if (r.kind !== 'none') return;
    expect(r.text).toBeNull();
    expect(r.next.accum).toBe(15);
    expect(r.next.baseline).toBe('早'.repeat(60)); // 基线不动，累计推进
  });

  it('已有观察：累计 >50 更新（含前次累计）——对齐 ticket「大改到 130 累计 +85 >50 → 更新」', () => {
    const state: DiarySettleState = { generated: true, baseline: '早'.repeat(60), baselineTags: ['日记'], accum: 15 };
    const r = decideDiarySettle({ time: '23:05', tags: ['日记'], body: '早'.repeat(130) }, '2026-08-24', state);
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.text).toBe('你更新了日记（2026-08-24 23:05）：' + '早'.repeat(130));
    expect(r.next).toEqual({ generated: true, baseline: '早'.repeat(130), baselineTags: ['日记'], accum: 0 });
  });

  it('累计恰为 50 不更新（阈值是严格大于 >50）', () => {
    const state: DiarySettleState = { generated: true, baseline: '早'.repeat(60), baselineTags: ['日记'], accum: 0 };
    const r = decideDiarySettle({ time: '23:05', tags: ['日记'], body: '早'.repeat(110) }, '2026-08-24', state);
    expect(r.kind).toBe('none');
    if (r.kind !== 'none') return;
    expect(r.next.accum).toBe(DIARY_UPDATE_THRESHOLD);
  });

  it('更新观察：分类有变化也更新进括号', () => {
    const state: DiarySettleState = { generated: true, baseline: '早'.repeat(60), baselineTags: ['日记'], accum: 0 };
    const r = decideDiarySettle({ time: '23:05', tags: ['日记', '猫'], body: '早'.repeat(120) }, '2026-08-24', state);
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.text).toBe('你更新了日记（2026-08-24 23:05，分类：日记、猫）：' + '早'.repeat(120));
  });
});

describe('观察文案（ticket 077 用户拍板措辞）', () => {
  it('首次 / 更新 / 更新含分类 / 删除 / 文件级删除兜底', () => {
    expect(diaryFirstText('2026-08-24', '23:05', ['日记', '猫'], '正文')).toBe('你在 2026-08-24 23:05 写了一篇日记（分类：日记、猫）：正文');
    expect(diaryUpdateText('2026-08-24', '23:05', ['日记'], '新正文', false)).toBe('你更新了日记（2026-08-24 23:05）：新正文');
    expect(diaryUpdateText('2026-08-24', '23:05', ['日记', '猫'], '新正文', true)).toBe('你更新了日记（2026-08-24 23:05，分类：日记、猫）：新正文');
    expect(diaryDeleteText('2026-08-24', '23:05')).toBe('你删除了 2026-08-24 23:05 的日记');
    expect(diaryDeleteFileText('2026-08-24')).toBe('你删除了 2026-08-24 的日记');
  });

  it('diaryCharCount：中文按字符数；代理对 emoji 记 1 字', () => {
    expect(diaryCharCount('今天好')).toBe(3);
    expect(diaryCharCount('📖')).toBe(1);
    expect(diaryCharCount('')).toBe(0);
  });
});