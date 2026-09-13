// @vitest-environment node
/**
 * core/diary-format.ts 契约单源测试（issue 304 / ADR-0130）。
 * 覆盖：文件名正则/命名/路径、日期提取、真实日期校验（闰年/越界）、
 * 序列化↔解析往返（含 CRLF/引号/行内数组容错、损坏降级语义）。
 */
import { describe, it, expect } from 'vitest';
import {
  DIARY_ENTRY_FILE_RE,
  diaryEntryBaseName,
  diaryEntryPath,
  diaryDateFromEntryPath,
  isValidDiaryDate,
  isValidDiaryTime,
  serializeDiaryEntryFile,
  parseDiaryEntryFile,
} from '../../src/core/diary-format';

describe('diary-format 文件名契约', () => {
  it('RE 命中标准名与同刻序号名，捕获日期/时/分/序号', () => {
    expect(DIARY_ENTRY_FILE_RE.exec('2026-03-23 12-32.md')?.slice(1)).toEqual(['2026-03-23', '12', '32', undefined]);
    expect(DIARY_ENTRY_FILE_RE.exec('2026-03-23 12-32-2.md')?.slice(1)).toEqual(['2026-03-23', '12', '32', '2']);
    expect(DIARY_ENTRY_FILE_RE.test('2026-03-23.md')).toBe(false); // 旧日期文件不匹配
    expect(DIARY_ENTRY_FILE_RE.test('2026-03-23 12-32.txt')).toBe(false);
    expect(DIARY_ENTRY_FILE_RE.test('随手记.md')).toBe(false);
  });

  it('diaryEntryBaseName：无序号不加后缀，seq>1 加 -N', () => {
    expect(diaryEntryBaseName('2026-03-23', '12:32')).toBe('2026-03-23 12-32');
    expect(diaryEntryBaseName('2026-03-23', '09:05', 1)).toBe('2026-03-23 09-05');
    expect(diaryEntryBaseName('2026-03-23', '09:05', 2)).toBe('2026-03-23 09-05-2');
  });

  it('diaryEntryPath 拼目录', () => {
    expect(diaryEntryPath('我的/日记', '2026-03-23', '12:32')).toBe('我的/日记/2026-03-23 12-32.md');
    expect(diaryEntryPath('我的/日记', '2026-03-23', '12:32', 3)).toBe('我的/日记/2026-03-23 12-32-3.md');
  });

  it('diaryDateFromEntryPath：完整路径/basename 均可取日期，非条目名返回 null', () => {
    expect(diaryDateFromEntryPath('我的/日记/2026-03-23 12-32.md')).toBe('2026-03-23');
    expect(diaryDateFromEntryPath('2024-08-22 00-00-2.md')).toBe('2024-08-22');
    expect(diaryDateFromEntryPath('我的/日记/2026-03-23.md')).toBe(null);
    expect(diaryDateFromEntryPath('')).toBe(null);
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
  it('往返稳定：frontmatter + 正文原样', () => {
    const content = '今天去了海边。\n\n#人名 在一起真好。';
    const out = serializeDiaryEntryFile({ date: '2026-03-23', time: '12:32' }, ['旅游', '大理'], content);
    expect(out).toBe('---\n日期: 2026-03-23 12:32\n类型:\n  - 旅游\n  - 大理\n---\n\n' + content + '\n');
    const parsed = parseDiaryEntryFile(out);
    expect(parsed.meta).toEqual({ date: '2026-03-23', time: '12:32' });
    expect(parsed.tags).toEqual(['旅游', '大理']);
    expect(parsed.body).toBe(content + '\n'); // serialize 尾部补一个换行（往返文件级稳定）
  });

  it('空类型序列化为空键，解析回空数组', () => {
    const out = serializeDiaryEntryFile({ date: '2026-03-23', time: '08:00' }, [], '正文');
    expect(out).toBe('---\n日期: 2026-03-23 08:00\n类型:\n---\n\n正文\n');
    const parsed = parseDiaryEntryFile(out);
    expect(parsed.tags).toEqual([]);
    expect(parsed.body).toBe('正文\n');
  });

  it('容错：CRLF / 成对引号 / 行内数组', () => {
    const parsed = parseDiaryEntryFile('---\r\n日期: "2026-03-23 07:05"\r\n类型: [旅游, 大理]\r\n---\r\n\r\n正文\r\n');
    expect(parsed.meta).toEqual({ date: '2026-03-23', time: '07:05' });
    expect(parsed.tags).toEqual(['旅游', '大理']);
    expect(parsed.body).toBe('正文\n');
  });

  it('单行标量类型（迁移前的手写形态）', () => {
    const parsed = parseDiaryEntryFile('---\n日期: 2026-03-23 07:05\n类型: 日记\n---\n\n正文');
    expect(parsed.tags).toEqual(['日记']);
  });

  it('降级语义：日期损坏 → meta=null 但类型/正文照常返回', () => {
    const parsed = parseDiaryEntryFile('---\n日期: 2026-13-45 12:32\n类型:\n  - 日记\n---\n\n正文');
    expect(parsed.meta).toBe(null);
    expect(parsed.tags).toEqual(['日记']);
    expect(parsed.body).toBe('正文');
  });

  it('时间非法同样降级', () => {
    const parsed = parseDiaryEntryFile('---\n日期: 2026-03-23 24:00\n类型:\n  - 日记\n---\n\n正文');
    expect(parsed.meta).toBe(null);
    expect(parsed.tags).toEqual(['日记']);
  });

  it('无 frontmatter → meta=null、tags=[]、body=全文', () => {
    const parsed = parseDiaryEntryFile('# 随手写的普通笔记\n正文');
    expect(parsed.meta).toBe(null);
    expect(parsed.tags).toEqual([]);
    expect(parsed.body).toBe('# 随手写的普通笔记\n正文');
  });

  it('frontmatter 未闭合按无 frontmatter 处理', () => {
    const parsed = parseDiaryEntryFile('---\n日期: 2026-03-23 12:32\n类型:\n  - 日记\n');
    expect(parsed.meta).toBe(null);
    expect(parsed.tags).toEqual([]);
  });

  it('未知 frontmatter 键被忽略；类型里空项丢弃', () => {
    const parsed = parseDiaryEntryFile('---\n来源: 快捷输入\n日期: 2026-03-23 12:32\n类型:\n  - 日记\n  -\n---\n\n正文');
    expect(parsed.meta).toEqual({ date: '2026-03-23', time: '12:32' });
    expect(parsed.tags).toEqual(['日记']);
  });
});
