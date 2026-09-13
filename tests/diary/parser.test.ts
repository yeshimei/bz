// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { buildTagMaps } from '../../src/diary/config';
import { parseEntryFile, parseMovieFile, parseLetterFile, parseNaturalTime, isEncryptedEntry } from '../../src/diary/parser';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';

/** 构造测试用 mock app（同时挂到 core/app 供域内 getApp 路径使用，并返回实例供解析函数显式传入） */
let app: any;
function mockApp(files: Record<string, string>, frontmatters: Record<string, any>) {
  app = {
    metadataCache: {
      getFileCache: (f: any) => ({ frontmatter: frontmatters[f.path] }),
    },
    vault: {
      read: async (f: any) => files[f.path] ?? '',
    },
  };
  setApp(app as any);
  return app;
}

function makeFile(path: string, ctime: number, basename?: string) {
  return {
    path,
    basename: basename ?? path.split('/').pop()!.replace(/\.md$/, ''),
    stat: Promise.resolve({ ctime, birthtime: ctime }),
  };
}

/** 条目文件全文便捷构造（走契约序列化，保证测试夹具即生产格式） */
function entryFile(date: string, time: string, tags: string[], body: string): string {
  return serializeDiaryEntryFile({ date, time }, tags, body);
}

beforeEach(() => {
  buildTagMaps();
});

describe('parseEntryFile（ADR-0131 一目一文件）', () => {
  it('解析标准条目文件：题目+frontmatter date/type，正文原样', () => {
    const content = entryFile('2024-01-01', '14:30', ['日记'], '今天天气不错');
    const e = parseEntryFile(content, '我的/日记/2401011430.md');
    expect(e).toMatchObject({
      date: '2024-01-01',
      time: '14:30',
      timeValue: 1430,
      tags: ['日记'],
      emoji: '📖',
      filename: '我的/日记/2401011430.md',
      filePath: '我的/日记/2401011430.md',
      lineNumber: 0,
    });
    expect(e!.content).toBe('今天天气不错');
  });

  it('多类型列表逐项解析，emoji 由标签派生', () => {
    const e = parseEntryFile(entryFile('2024-01-01', '09:00', ['日记', '诗'], '诗一首'), '我的/日记/2401010900.md');
    expect(e!.tags).toEqual(['日记', '诗']);
    expect(e!.emoji).toBe('📖🌟');
  });

  it('类型空缺回退「日记」', () => {
    const content = '---\ndate: 2024-01-01 09:00\ntype:\n---\n\nx';
    const e = parseEntryFile(content, '我的/日记/2401010900.md');
    expect(e!.tags).toEqual(['日记']);
  });

  it('降级：frontmatter 日期损坏 → 从题目取日期时间，类型保留', () => {
    const content = '---\ndate: 2024-13-45 99:99\ntype:\n  - 日记\n---\n\n正文';
    const e = parseEntryFile(content, '我的/日记/2401010900.md');
    // v3：属性损坏不再返回 null，日期与时间都从题目（YYMMDDHHmm）还原
    expect(e).not.toBeNull();
    expect(e!.date).toBe('2024-01-01');
    expect(e!.time).toBe('09:00');
    expect(e!.tags).toEqual(['日记']);
  });

  it('旧中文键（日期/类型）按属性不可信处理，走题目降级', () => {
    const content = '---\n日期: 2024-01-01 09:00\n类型:\n  - 日记\n---\n\n正文';
    const e = parseEntryFile(content, '我的/日记/2401010900.md');
    expect(e).not.toBeNull(); // v3：只认英文键，中文键文件按题目降级加载
    expect(e!.date).toBe('2024-01-01');
    expect(e!.time).toBe('09:00');
    expect(e!.tags).toEqual(['日记']); // 类型不可信 → 回退「日记」
  });

  it('同刻序号题目（-2）正常解析', () => {
    const e = parseEntryFile(entryFile('2024-08-22', '00:00', ['日记'], '第二条'), '我的/日记/2408220000-2.md');
    expect(e!.date).toBe('2024-08-22');
    expect(e!.time).toBe('00:00');
  });

  it('frontmatter 与题目都不可信 → null（守卫拒写依据）', () => {
    expect(parseEntryFile('---\ndate: bad\ntype:\n  - 日记\n---\n\nx', '我的/日记/随手记.md')).toBeNull();
  });

  it('旧格式日期文件名 + 无 frontmatter → null（迁移残留不解析，ADR-0131 无旧格式兼容）', () => {
    expect(parseEntryFile('# 📖 08:00\n旧格式正文\n', '我的/日记/2024-01-01.md')).toBeNull();
  });

  it('正文含一级标题行/分隔线等 markdown 原样保留（正文不参与格式解析）', () => {
    const body = '# 大标题\n\n---\n\n正文继续';
    const e = parseEntryFile(entryFile('2024-01-01', '08:00', ['日记'], body), '我的/日记/2401010800.md');
    expect(e!.content).toBe(body);
  });

  it('isEncryptedEntry 检测 🔐', () => {
    const e = parseEntryFile(entryFile('2024-01-01', '08:00', ['日记'], '🔐secret🔐'), '我的/日记/2401010800.md')!;
    expect(isEncryptedEntry(e)).toBe(true);
  });
});

describe('parseMovieFile', () => {
  it('正常解析影视条目', async () => {
    const fm = { 影评: '很好看', 观影日期: '2024-02-03', 海报: 'poster.png', tags: ['电影'] };
    mockApp({}, { '我的/影视/xxx.md': fm });
    const entry = await parseMovieFile(makeFile('我的/影视/xxx.md', Date.UTC(2024, 0, 3, 21, 30)), app);
    expect(entry).toMatchObject({
      date: '2024-02-03',
      tags: ['电影'],
      filename: '我的/影视/xxx.md',
    });
    expect(entry!.content).toContain('很好看');
    expect(entry!.content).toContain('#xxx');
    expect(entry!.id).toContain('movie-');
  });

  it('无影评返回 null', async () => {
    mockApp({}, { 'a.md': { 观影日期: '2024-02-03' } });
    expect(await parseMovieFile(makeFile('a.md', 0), app)).toBeNull();
  });

  it('无效观影日期返回 null', async () => {
    mockApp({}, { 'a.md': { 影评: 'x', 观影日期: 'not-a-date' } });
    expect(await parseMovieFile(makeFile('a.md', 0), app)).toBeNull();
  });

  it('tags 字符串形式解析主标签', async () => {
    mockApp({}, { 'a.md': { 影评: 'x', 观影日期: '2024-02-03', tags: '纪录片' } });
    const entry = await parseMovieFile(makeFile('a.md', 0), app);
    expect(entry!.tags).toEqual(['纪录片']);
  });

  it('以 剧/漫 结尾的 rawTag 归类', async () => {
    mockApp({}, { 'a.md': { 影评: 'x', 观影日期: '2024-02-03', tags: ['日剧'] } });
    const entry = await parseMovieFile(makeFile('a.md', 0), app);
    expect(entry!.tags).toEqual(['电视剧']);
  });

  it('D12 回归：无海报（frontmatter 缺字段/空白）不拼 ![[...]]，不出幽灵媒体格', async () => {
    mockApp(
      {},
      {
        '我的/影视/无海报.md': { 影评: '没海报', 观影日期: '2024-02-03', tags: ['电影'] },
        '我的/影视/空海报.md': { 影评: '海报是空白', 观影日期: '2024-02-03', tags: ['电影'], 海报: '  ' },
      }
    );
    const noPoster = await parseMovieFile(makeFile('我的/影视/无海报.md', 0), app);
    expect(noPoster!.content).not.toContain('![[');
    expect(noPoster!.content).toContain('没海报');
    expect(noPoster!.content).toContain('#无海报');
    const blankPoster = await parseMovieFile(makeFile('我的/影视/空海报.md', 0), app);
    expect(blankPoster!.content).not.toContain('![[');
    expect(JSON.stringify(blankPoster)).not.toContain('undefined');
  });
});

describe('parseLetterFile', () => {
  it('正常解析信件', async () => {
    const fm = { date: '2024-03-04 20:00' };
    mockApp({ '我的/信/给未来的我.md': '---\ndate: 2024-03-04 20:00\n---\n你好，未来的我\n' }, { '我的/信/给未来的我.md': fm });
    const entry = await parseLetterFile(makeFile('我的/信/给未来的我.md', Date.UTC(2024, 2, 4, 20, 0)), app);
    expect(entry).toMatchObject({
      date: '2024-03-04',
      tags: ['信'],
      filename: '我的/信/给未来的我.md',
    });
    expect(entry!.content).toContain('**给未来的我**');
    expect(entry!.content).toContain('你好，未来的我');
  });

  it('readonly 信件忽略', async () => {
    mockApp({}, { 'a.md': { date: '2024-03-04', readonly: true } });
    expect(await parseLetterFile(makeFile('a.md', 0), app)).toBeNull();
  });

  it('无 date 返回 null', async () => {
    mockApp({}, { 'a.md': { readonly: false } });
    expect(await parseLetterFile(makeFile('a.md', 0), app)).toBeNull();
  });
});

describe('parseNaturalTime', () => {
  it('N分钟前', () => {
    const m = parseNaturalTime('5分钟前');
    expect(m.isValid()).toBe(true);
    const diff = Math.round((Date.now() - m.valueOf()) / 60000);
    expect(diff).toBe(5);
  });

  it('N小时前 / N天前 / N秒前', () => {
    expect(Math.round((Date.now() - parseNaturalTime('2小时前').valueOf()) / 3600000)).toBe(2);
    expect(Math.round((Date.now() - parseNaturalTime('1天前').valueOf()) / 86400000)).toBe(1);
    expect(Math.round((Date.now() - parseNaturalTime('30秒前').valueOf()) / 1000)).toBe(30);
  });

  it('昨天 HH:mm', () => {
    const m = parseNaturalTime('昨天 23:00');
    expect(m.isValid()).toBe(true);
    const yesterday = new Date(Date.now() - 86400000);
    expect(m.format('YYYY-MM-DD')).toBe(
      `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    );
    expect(m.format('HH:mm')).toBe('23:00');
  });

  it('前天 HH:mm', () => {
    const m = parseNaturalTime('前天 21:30');
    expect(m.isValid()).toBe(true);
    expect(m.format('HH:mm')).toBe('21:30');
  });

  it('标准格式', () => {
    const m = parseNaturalTime('2024-01-02 03:04');
    expect(m.isValid()).toBe(true);
    expect(m.format('YYYY-MM-DD HH:mm')).toBe('2024-01-02 03:04');
  });

  it('非法输入返回 null', () => {
    expect(parseNaturalTime('胡说八道')).toBeNull();
    expect(parseNaturalTime('')).toBeNull();
  });
});
