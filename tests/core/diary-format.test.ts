// @vitest-environment node
/**
 * core/diary-format.ts 契约单源测试（issue 304 / 305 / ADR-0130 / ADR-0131）。
 * 覆盖：文件名（题目）正则/命名/路径、日期时间提取与降级、真实日期校验（闰年/越界）、
 * 序列化↔解析往返（含 CRLF/引号/行内数组容错、属性损坏降级语义、只认英文键）。
 */
import { describe, it, expect } from 'vitest';
import {
  DIARY_DATE_KEY,
  DIARY_TYPE_KEY,
  DIARY_ENTRY_FILE_RE,
  DIARY_LEGACY_FILE_RE,
  diaryDateFromEntryPath,
  diaryDateFromLegacyPath,
  diaryEntryBaseName,
  diaryEntryPath,
  diaryMetaFromEntryPath,
  diaryStampText,
  isValidDiaryDate,
  isValidDiaryTime,
  parseDiaryEntryFile,
  parseDiaryStamp,
  readDiaryFrontmatterFieldRaw,
  resolveDiaryEntryMeta,
  serializeDiaryEntryFile,
} from '../../src/core/diary-format';

describe('diary-format 文件名（题目）契约', () => {
  it('RE 命中标准名与同刻序号名，捕获 年月日时分/序号', () => {
    expect(DIARY_ENTRY_FILE_RE.exec('2603231232.md')?.slice(1)).toEqual(['26', '03', '23', '12', '32', undefined]);
    expect(DIARY_ENTRY_FILE_RE.exec('2603231232-2.md')?.slice(1)).toEqual(['26', '03', '23', '12', '32', '2']);
    expect(DIARY_ENTRY_FILE_RE.test('2026-03-23.md')).toBe(false); // 旧日期文件不匹配（归 DIARY_LEGACY_FILE_RE）
    expect(DIARY_ENTRY_FILE_RE.test('2603231232.txt')).toBe(false);
    expect(DIARY_ENTRY_FILE_RE.test('随手记.md')).toBe(false);
  });

  it('DIARY_LEGACY_FILE_RE 只命中旧日期文件名', () => {
    expect(DIARY_LEGACY_FILE_RE.test('2026-03-23.md')).toBe(true);
    expect(DIARY_LEGACY_FILE_RE.test('2603231232.md')).toBe(false);
    expect(DIARY_LEGACY_FILE_RE.test('随手记.md')).toBe(false);
  });

  it('diaryEntryBaseName：无序号不加后缀，seq>1 加 -N', () => {
    expect(diaryEntryBaseName('2026-03-23', '12:32')).toBe('2603231232');
    expect(diaryEntryBaseName('2026-03-23', '09:05', 1)).toBe('2603230905');
    expect(diaryEntryBaseName('2026-03-23', '09:05', 2)).toBe('2603230905-2');
  });

  it('diaryEntryPath 拼目录', () => {
    expect(diaryEntryPath('我的/日记', '2026-03-23', '12:32')).toBe('我的/日记/2603231232.md');
    expect(diaryEntryPath('我的/日记', '2026-03-23', '12:32', 3)).toBe('我的/日记/2603231232-3.md');
  });

  it('diaryMetaFromEntryPath / diaryDateFromEntryPath：完整路径/basename 均可还原，非条目名或日历非法返回 null', () => {
    expect(diaryMetaFromEntryPath('我的/日记/2603231232.md')).toEqual({ date: '2026-03-23', time: '12:32' });
    expect(diaryMetaFromEntryPath('2408220000-2.md')).toEqual({ date: '2024-08-22', time: '00:00', seq: 2 });
    expect(diaryMetaFromEntryPath('2602311200.md')).toBe(null); // 2 月 31 日：日历非法
    expect(diaryMetaFromEntryPath('我的/日记/2026-03-23.md')).toBe(null); // 旧日期文件不是条目名
    expect(diaryMetaFromEntryPath('')).toBe(null);
    expect(diaryDateFromEntryPath('我的/日记/2603231232.md')).toBe('2026-03-23');
  });

  it('diaryDateFromLegacyPath：旧日期文件名还原完整日期，非该形状/日历非法返回 null', () => {
    expect(diaryDateFromLegacyPath('我的/日记/2026-08-23.md')).toBe('2026-08-23');
    expect(diaryDateFromLegacyPath('2026-08-23.md')).toBe('2026-08-23');
    expect(diaryDateFromLegacyPath('我的/日记/2608230800.md')).toBe(null); // 新题目不是 legacy
    expect(diaryDateFromLegacyPath('2026-02-30.md')).toBe(null); // 日历非法
    expect(diaryDateFromLegacyPath('')).toBe(null);
  });

  it('resolveDiaryEntryMeta：属性可信用属性；属性损坏从题目降级；两处都不可信 → null', () => {
    const good = parseDiaryEntryFile('---\ndate: 2026-03-23 12:32\ntype:\n---\n\n正文');
    expect(resolveDiaryEntryMeta('我的/日记/2603231232.md', good)).toEqual({ date: '2026-03-23', time: '12:32' });
    const broken = parseDiaryEntryFile('---\ndate: 坏\ntype:\n---\n\n正文');
    // v3：属性损坏按题目降级，不再返回 null
    expect(resolveDiaryEntryMeta('我的/日记/2603231232.md', broken)).toEqual({ date: '2026-03-23', time: '12:32' });
    expect(resolveDiaryEntryMeta('随手记.md', broken)).toBe(null);
  });

  it('readDiaryFrontmatterFieldRaw：区分键缺失与值损坏', () => {
    const fm = '---\ndate: 2026-03-23 12:32\ntype:\n---\n\n正文';
    expect(readDiaryFrontmatterFieldRaw(fm, DIARY_DATE_KEY)).toBe('2026-03-23 12:32');
    expect(readDiaryFrontmatterFieldRaw('---\ntype:\n---\n\n正文', DIARY_DATE_KEY)).toBe(null); // 键缺失
    expect(readDiaryFrontmatterFieldRaw('无 frontmatter', DIARY_DATE_KEY)).toBe(null);
  });

  it('diaryStampText / parseDiaryStamp：可读时间戳往返，形状/日历/时刻非法返回 null', () => {
    expect(diaryStampText('2026-03-23', '12:32')).toBe('2026-03-23 12:32');
    expect(parseDiaryStamp(' 2026-03-23 12:32 ')).toEqual({ date: '2026-03-23', time: '12:32' });
    expect(parseDiaryStamp('2026-02-30 12:32')).toBe(null);
    expect(parseDiaryStamp('2026-03-23 24:00')).toBe(null);
    expect(parseDiaryStamp('2026-03-23 12-32')).toBe(null);
  });
});

describe('diary-format 日历校验', () => {
  it('isValidDiaryDate：闰年/平年/越界', () => {
    expect(isValidDiaryDate('2024-02-29')).toBe(true);
    expect(isValidDiaryDate('2023-02-29')).toBe(false);
    expect(isValidDiaryDate('2026-13-01')).toBe(false);
    expect(isValidDiaryDate('2026-04-31')).toBe(false);
    expect(isValidDiaryDate('2026-00-10')).toBe(false);
    expect(isValidDiaryDate('26-03-23')).toBe(false);
    expect(isValidDiaryDate('')).toBe(false);
  });

  it('isValidDiaryTime：00:00-23:59 边界', () => {
    expect(isValidDiaryTime('00:00')).toBe(true);
    expect(isValidDiaryTime('23:59')).toBe(true);
    expect(isValidDiaryTime('24:00')).toBe(false);
    expect(isValidDiaryTime('12:60')).toBe(false);
    expect(isValidDiaryTime('9:33')).toBe(false);
  });
});

describe('diary-format 序列化 ↔ 解析', () => {
  it('往返稳定：frontmatter（date/type 英文键） + 正文原样', () => {
    const content = '今天去了海边。\n\n#人名 在一起真好。';
    const out = serializeDiaryEntryFile({ date: '2026-03-23', time: '12:32' }, ['旅游', '大理'], content);
    expect(out).toBe('---\ndate: 2026-03-23 12:32\ntype:\n  - 旅游\n  - 大理\n---\n\n' + content + '\n');
    expect(DIARY_DATE_KEY).toBe('date');
    expect(DIARY_TYPE_KEY).toBe('type');
    const parsed = parseDiaryEntryFile(out);
    expect(parsed.meta).toEqual({ date: '2026-03-23', time: '12:32' });
    expect(parsed.tags).toEqual(['旅游', '大理']);
    expect(parsed.body).toBe(content + '\n'); // serialize 尾部补一个换行（往返文件级稳定）
  });

  it('空类型序列化为空键，解析回空数组', () => {
    const out = serializeDiaryEntryFile({ date: '2026-03-23', time: '08:00' }, [], '正文');
    expect(out).toBe('---\ndate: 2026-03-23 08:00\ntype:\n---\n\n正文\n');
    const parsed = parseDiaryEntryFile(out);
    expect(parsed.tags).toEqual([]);
    expect(parsed.body).toBe('正文\n');
  });

  it('容错：CRLF / 成对引号 / 行内数组', () => {
    const parsed = parseDiaryEntryFile('---\r\ndate: "2026-03-23 07:05"\r\ntype: [旅游, 大理]\r\n---\r\n\r\n正文\r\n');
    expect(parsed.meta).toEqual({ date: '2026-03-23', time: '07:05' });
    expect(parsed.tags).toEqual(['旅游', '大理']);
    expect(parsed.body).toBe('正文\n');
  });

  it('单行标量类型（迁移前的手写形态）', () => {
    const parsed = parseDiaryEntryFile('---\ndate: 2026-03-23 07:05\ntype: 日记\n---\n\n正文');
    expect(parsed.tags).toEqual(['日记']);
  });

  it('降级语义：日期损坏 → meta=null 但类型/正文照常返回', () => {
    const parsed = parseDiaryEntryFile('---\ndate: 2026-13-45 12:32\ntype:\n  - 日记\n---\n\n正文');
    expect(parsed.meta).toBe(null);
    expect(parsed.tags).toEqual(['日记']);
    expect(parsed.body).toBe('正文');
  });

  it('时间非法同样降级', () => {
    const parsed = parseDiaryEntryFile('---\ndate: 2026-03-23 24:00\ntype:\n  - 日记\n---\n\n正文');
    expect(parsed.meta).toBe(null);
    expect(parsed.tags).toEqual(['日记']);
  });

  it('只认英文键：旧中文键文件按属性不可信，resolveDiaryEntryMeta 从题目降级', () => {
    const parsed = parseDiaryEntryFile('---\n日期: 2026-03-23 12:32\n类型:\n  - 日记\n---\n\n正文');
    expect(parsed.meta).toBe(null); // v3：中文键不被识别（体检按 legacy/不可信上报）
    expect(parsed.tags).toEqual([]);
    expect(resolveDiaryEntryMeta('我的/日记/2603231232.md', parsed)).toEqual({ date: '2026-03-23', time: '12:32' });
  });

  it('无 frontmatter → meta=null、tags=[]、body=全文', () => {
    const parsed = parseDiaryEntryFile('# 随手写的普通笔记\n正文');
    expect(parsed.meta).toBe(null);
    expect(parsed.tags).toEqual([]);
    expect(parsed.body).toBe('# 随手写的普通笔记\n正文');
  });

  it('frontmatter 未闭合按无 frontmatter 处理', () => {
    const parsed = parseDiaryEntryFile('---\ndate: 2026-03-23 12:32\ntype:\n  - 日记\n');
    expect(parsed.meta).toBe(null);
    expect(parsed.tags).toEqual([]);
  });

  it('未知 frontmatter 键被忽略；类型里空项丢弃', () => {
    const parsed = parseDiaryEntryFile('---\n来源: 快捷输入\ndate: 2026-03-23 12:32\ntype:\n  - 日记\n  -\n---\n\n正文');
    expect(parsed.meta).toEqual({ date: '2026-03-23', time: '12:32' });
    expect(parsed.tags).toEqual(['日记']);
  });
});
