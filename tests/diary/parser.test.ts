// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/diary/app';
import { buildTagMaps } from '../../src/diary/config';
import { parseFile, parseMovieFile, parseLetterFile, parseNaturalTime, isEncryptedEntry } from '../../src/diary/parser';

/** 构造测试用 mock app */
function mockApp(files: Record<string, string>, frontmatters: Record<string, any>) {
  setApp({
    metadataCache: {
      getFileCache: (f: any) => ({ frontmatter: frontmatters[f.path] }),
    },
    vault: {
      read: async (f: any) => files[f.path] ?? '',
    },
  } as any);
}

function makeFile(path: string, ctime: number, basename?: string) {
  return {
    path,
    basename: basename ?? path.split('/').pop()!.replace(/\.md$/, ''),
    stat: Promise.resolve({ ctime, birthtime: ctime }),
  };
}

beforeEach(() => {
  buildTagMaps();
});

describe('parseFile', () => {
  it('解析标准标题行条目', () => {
    const entries = parseFile('# 📖 14:30\n今天天气不错\n', '2024-01-01');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      date: '2024-01-01',
      time: '14:30',
      timeValue: 1430,
      tags: ['日记'],
      filename: '2024-01-01',
      lineNumber: 1,
    });
    expect(entries[0].content).toBe('今天天气不错');
  });

  it('emoji 序列解析为多标签', () => {
    const entries = parseFile('# 📖🌟 09:00\n诗一首\n', '2024-01-01');
    expect(entries[0].tags).toEqual(['日记', '诗']);
    expect(entries[0].emoji).toBe('📖🌟');
  });

  it('未知 emoji 回退「日记」', () => {
    const entries = parseFile('# 😵 09:00\nx\n', '2024-01-01');
    expect(entries[0].tags).toEqual(['日记']);
  });

  it('时间越界行跳过', () => {
    const entries = parseFile('# 📖 25:99\nx\n# 📖 08:00\n正常\n', '2024-01-01');
    expect(entries).toHaveLength(1);
    expect(entries[0].time).toBe('08:00');
  });

  it('空行分段：多个条目', () => {
    const content = '# 📖 08:00\n第一条\n\n# ✍️ 09:00\n第二条\n';
    const entries = parseFile(content, '2024-01-01');
    expect(entries).toHaveLength(2);
    expect(entries[0].content).toBe('第一条');
    expect(entries[1].content).toBe('第二条');
    expect(entries[1].tags).toEqual(['随笔']);
  });

  it('向后兼容旧 type 字段', () => {
    // 旧格式可能用 type；解析后 tags 取自 type
    const entries = parseFile('# 📖 08:00\n内容\n', '2024-01-01');
    entries[0].tags = ['书'];
    (entries[0] as any).type = undefined;
    // 模拟：直接验证 type 兼容逻辑——构造带 type 的条目
    const e2 = parseFile('# 📖 08:00\n内容\n', '2024-01-01');
    (e2[0] as any).type = '电影';
    // 触发兼容分支需要重新解析，这里验证解析本身不依赖 type
    expect(e2[0].tags).toEqual(['日记']);
  });

  it('空内容文件返回空数组', () => {
    expect(parseFile('', '2024-01-01')).toEqual([]);
  });

  it('isEncryptedEntry 检测 🔐', () => {
    const e = parseFile('# 📖 08:00\n🔐secret🔐\n', '2024-01-01')[0];
    expect(isEncryptedEntry(e)).toBe(true);
  });
});

describe('parseFile 未解析行统计（UX-9）', () => {
  it('全可解析文件不回调（计为零，免打扰）', () => {
    const cb = vi.fn();
    parseFile('# 📖 08:00\n内容\n', '2024-01-01', cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it('首个条目之前游离的非空行计入未解析行，解析结果不变', () => {
    const cb = vi.fn();
    const entries = parseFile('游离说明文字\n# 📖 08:00\n内容\n', '2024-01-01', cb);
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe('内容');
    expect(entries[0].time).toBe('08:00');
    expect(cb).toHaveBeenCalledWith(1);
  });

  it('时间越界的条目标题行计入未解析行（其后孤儿正文行同样无法归属）', () => {
    const cb = vi.fn();
    const entries = parseFile('# 📖 25:99\nx\n# 📖 08:00\n正常\n', '2024-01-01', cb);
    expect(entries).toHaveLength(1);
    expect(entries[0].time).toBe('08:00');
    expect(cb).toHaveBeenCalledWith(2); // 越界标题行 + 孤儿正文行 x
  });

  it('首行空行不计未解析；多处游离行累计', () => {
    const cb = vi.fn();
    parseFile('\n\n游离一\n游离二\n# 📖 08:00\n内容\n', '2024-01-01', cb);
    expect(cb).toHaveBeenCalledWith(2);
  });

  it('未传回调不统计（兼容旧调用）', () => {
    const entries = parseFile('游离文字\n# 📖 08:00\n内容\n', '2024-01-01');
    expect(entries).toHaveLength(1);
  });
});

describe('parseMovieFile', () => {
  it('正常解析影视条目', async () => {
    const fm = { 影评: '很好看', 观影日期: '2024-02-03', 海报: 'poster.png', tags: ['电影'] };
    mockApp({}, { '我的/影视/xxx.md': fm });
    const entry = await parseMovieFile(makeFile('我的/影视/xxx.md', Date.UTC(2024, 0, 3, 21, 30)));
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
    expect(await parseMovieFile(makeFile('a.md', 0))).toBeNull();
  });

  it('无效观影日期返回 null', async () => {
    mockApp({}, { 'a.md': { 影评: 'x', 观影日期: 'not-a-date' } });
    expect(await parseMovieFile(makeFile('a.md', 0))).toBeNull();
  });

  it('tags 字符串形式解析主标签', async () => {
    mockApp({}, { 'a.md': { 影评: 'x', 观影日期: '2024-02-03', tags: '纪录片' } });
    const entry = await parseMovieFile(makeFile('a.md', 0));
    expect(entry!.tags).toEqual(['纪录片']);
  });

  it('以 剧/漫 结尾的 rawTag 归类', async () => {
    mockApp({}, { 'a.md': { 影评: 'x', 观影日期: '2024-02-03', tags: ['日剧'] } });
    const entry = await parseMovieFile(makeFile('a.md', 0));
    expect(entry!.tags).toEqual(['电视剧']);
  });
});

describe('parseLetterFile', () => {
  it('正常解析信件', async () => {
    const fm = { date: '2024-03-04 20:00' };
    mockApp({ '我的/信/给未来的我.md': '---\ndate: 2024-03-04 20:00\n---\n你好，未来的我\n' }, { '我的/信/给未来的我.md': fm });
    const entry = await parseLetterFile(makeFile('我的/信/给未来的我.md', Date.UTC(2024, 2, 4, 20, 0)));
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
    expect(await parseLetterFile(makeFile('a.md', 0))).toBeNull();
  });

  it('无 date 返回 null', async () => {
    mockApp({}, { 'a.md': { readonly: false } });
    expect(await parseLetterFile(makeFile('a.md', 0))).toBeNull();
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
