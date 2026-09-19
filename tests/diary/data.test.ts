// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { buildTagMaps, resetTagsConfig } from '../../src/diary/config';
import {
  extractMedia,
  extractSegments,
  groupByMonth,
  loadWallEntries,
  invalidateWallCache,
  resetWallCache,
  mediaSrc,
  pickOnThisDay,
  stripMediaLinks,
  type WallEntry,
} from '../../src/diary/data';
import { emitDomainEvent } from '../../src/core/domain-bus';
import { parseBookFile, parseLetterFile, parseMovieFile } from '../../src/diary/parser';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';

const DIARY_DIR = '我的/日记';

/** 条目文件全文便捷构造（走契约序列化，保证测试夹具即生产格式） */
function entry(date: string, time: string, tags: string[], body: string): string {
  return serializeDiaryEntryFile({ date, time }, tags, body);
}

/**
 * 构造一个 mock app（MockVault + mockAppWithVault，与 tests/diary 域同款用法）。
 * 共享 mock 未实现 Obsidian 链接解析（getFirstLinkpathDest）与资源路径（getResourcePath），
 * 在测试内补丁最小实现：链接名全局解析（basename 匹配）+ 资源路径返回可断言字符串。
 */
function makeApp(files: Record<string, string>) {
  const vault = new MockVault();
  for (const [p, c] of Object.entries(files)) vault.files.set(p, c);
  const app = mockAppWithVault(vault);
  // Obsidian 链接解析：精确路径优先，否则按链接名（basename）全局匹配
  (app.metadataCache as any).getFirstLinkpathDest = (link: string, _src: string) => {
    const exact = vault.getAbstractFileByPath(link);
    if (exact && !exact.children) return exact;
    const name = link.split('/').pop()!.toLowerCase();
    return vault.getFiles().find((f: any) => (f.name || '').toLowerCase() === name) ?? null;
  };
  // 资源路径：mock vault 直接暴露 vault 内路径（真实环境是 app:// 资源 URL）
  (vault as any).getResourcePath = (f: any) => `app://local/${f.path}`;
  return app;
}

beforeEach(() => {
  resetTagsConfig();
  buildTagMaps();
  resetWallCache(); // ②：每例清缓存与域事件订阅，防跨例泄漏（模块级单例缓存）
});

afterEach(() => {
  resetWallCache();
});

describe('extractSegments（issue 213：按原文顺序分段）', () => {
  it('文字段/媒体段交错保留，原文序不压平', () => {
    const segs = extractSegments('前文一段\n![[a.jpg]]\n中段文字\n![[b.mp4]]\n后文');
    expect(segs).toEqual([
      { kind: 'text', text: '前文一段' },
      { kind: 'media', media: { name: 'a.jpg', kind: 'img' } },
      { kind: 'text', text: '中段文字' },
      { kind: 'media', media: { name: 'b.mp4', kind: 'video' } },
      { kind: 'text', text: '后文' },
    ]);
  });

  it('非媒体内链保留为文字段；纯媒体返回单媒体段；空串返回空数组', () => {
    expect(extractSegments('记\n![[笔记.md]]\n录')).toEqual([
      { kind: 'text', text: '记' },
      { kind: 'text', text: '![[笔记.md]]' },
      { kind: 'text', text: '录' },
    ]);
    expect(extractSegments('![[a.png|400]]')).toEqual([
      { kind: 'media', media: { name: 'a.png', kind: 'img' } },
    ]);
    expect(extractSegments('')).toEqual([]);
  });

  it('toWallEntry 派生 segments 字段', async () => {
    const vault = new MockVault();
    vault.files.set('我的/日记/2406010900.md', entry('2024-06-01', '09:00', ['日记'], '前文\n![[a.jpg]]\n后文'));
    const app = mockAppWithVault(vault);
    const entries = await loadWallEntries(app);
    expect(entries[0].segments).toEqual([
      { kind: 'text', text: '前文' },
      { kind: 'media', media: { name: 'a.jpg', kind: 'img' } },
      { kind: 'text', text: '后文' },
    ]);
  });
});

describe('extractMedia', () => {
  it('提取图片/视频/音频内链', () => {
    const content = [
      '# 📖 08:00',
      '今天拍了照片',
      '![[photo.jpg]]',
      '![[clip.mp4]]',
      '![[voice.m4a]]',
      '',
    ].join('\n');
    expect(extractMedia(content, DIARY_DIR)).toEqual([
      { name: 'photo.jpg', kind: 'img' },
      { name: 'clip.mp4', kind: 'video' },
      { name: 'voice.m4a', kind: 'audio' },
    ]);
  });

  it('去重：同一引用多次只保留一个', () => {
    const content = '![[a.png]]\n![[a.png]]\n![[a.png|200]]\n';
    expect(extractMedia(content, DIARY_DIR)).toEqual([{ name: 'a.png', kind: 'img' }]);
  });

  it('带尺寸参数：去掉 | 后缀', () => {
    expect(extractMedia('![[pic.jpg|400]]', DIARY_DIR)).toEqual([{ name: 'pic.jpg', kind: 'img' }]);
  });

  it('路径内链：保留完整引用路径', () => {
    expect(extractMedia('![[attachments/sub/demo.mp4]]', DIARY_DIR)).toEqual([
      { name: 'attachments/sub/demo.mp4', kind: 'video' },
    ]);
    expect(extractMedia('![[图片/旅行/风景.webp|300]]', DIARY_DIR)).toEqual([
      { name: '图片/旅行/风景.webp', kind: 'img' },
    ]);
  });

  it('忽略 .md 内链与非媒体扩展名', () => {
    const content = '![[note.md]]\n![[data.json]]\n![[script.js]]\n![[readme]]\n';
    expect(extractMedia(content, DIARY_DIR)).toEqual([]);
  });

  it('扩展名大小写不敏感', () => {
    expect(extractMedia('![[PHOTO.JPG]]', DIARY_DIR)).toEqual([{ name: 'PHOTO.JPG', kind: 'img' }]);
  });

  it('无内链返回空数组', () => {
    expect(extractMedia('今天没有媒体\n普通文本 [[link.md]]', DIARY_DIR)).toEqual([]);
  });
});

describe('loadWallEntries', () => {
  it('读取多个条目文件（一目一文件），解析条目并提取媒体', async () => {
    const app = makeApp({
      '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], '第一天\n![[day1.jpg]]'),
      '我的/日记/2401010930.md': entry('2024-01-01', '09:30', ['随笔'], '下午记录'),
      '我的/日记/2401022200.md': entry('2024-01-02', '22:00', ['日记'], '第二天\n![[night.mp4]]'),
    });
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(3);
    // 排序：日期降序、时间降序
    expect(entries.map((e) => `${e.date} ${e.time}`)).toEqual([
      '2024-01-02 22:00',
      '2024-01-01 09:30',
      '2024-01-01 08:00',
    ]);
    // 媒体提取
    expect(entries[0].media).toEqual([{ name: 'night.mp4', kind: 'video' }]);
    expect(entries[1].media).toEqual([]);
    expect(entries[2].media).toEqual([{ name: 'day1.jpg', kind: 'img' }]);
    // 核心字段透传 + content 保留原文
    expect(entries[2]).toMatchObject({
      date: '2024-01-01',
      time: '08:00',
      tags: ['日记'],
      emoji: '📖',
      content: '第一天\n![[day1.jpg]]',
    });
  });

  it('非条目命名/非法日历/旧格式日期文件跳过（ADR-0131 无旧格式兼容）', async () => {
    const app = makeApp({
      '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], '正常'),
      '我的/日记/2024-01-01.md': entry('2024-01-01', '08:00', ['日记'], '旧格式残留'),
      '我的/日记/README.md': entry('2024-01-01', '08:00', ['日记'], '说明文件'),
      '我的/日记/2413450800.md': entry('2024-13-45', '08:00', ['日记'], '非法日期'),
      '我的/日记/随机笔记.md': entry('2024-01-01', '08:00', ['日记'], '非日期命名'),
    });
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2024-01-01');
  });

  it('空目录安全返回空数组', async () => {
    const app = makeApp({});
    expect(await loadWallEntries(app)).toEqual([]);
  });

  it('子目录中的条目文件也会被读取（递归收集）', async () => {
    const app = makeApp({
      '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], '顶层'),
      '我的/日记/子目录/2401030800.md': entry('2024-01-03', '08:00', ['日记'], '子目录\n![[sub.png]]'),
    });
    const entries = await loadWallEntries(app);
    expect(entries.map((e) => e.date)).toEqual(['2024-01-03', '2024-01-01']);
    expect(entries[0].media).toEqual([{ name: 'sub.png', kind: 'img' }]);
  });

  it('无媒体条目的 content 保留原文（不因提取而改写）', async () => {
    const app = makeApp({
      '我的/日记/2401051200.md': entry('2024-01-05', '12:00', ['日记'], '只有文字\n![[note.md]]'),
    });
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(1);
    expect(entries[0].media).toEqual([]); // .md 内链不提取
    expect(entries[0].content).toBe('只有文字\n![[note.md]]');
  });

  it('多标签条目透传 tags/emoji（emoji 由标签派生）', async () => {
    const app = makeApp({
      '我的/日记/2406010900.md': entry('2024-06-01', '09:00', ['日记', '诗'], '写诗一首'),
    });
    const entries = await loadWallEntries(app);
    expect(entries[0].tags).toEqual(['日记', '诗']);
    expect(entries[0].emoji).toBe('📖🌟');
  });

  it("D5' 回归：批量读中一个文件 reject 只跳过该文件，其余正常上墙", async () => {
    const app = makeApp({
      '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], '健康甲'),
      '我的/日记/2401010930.md': entry('2024-01-01', '09:30', ['日记'], '健康乙'),
      '我的/日记/2401022200.md': entry('2024-01-02', '22:00', ['日记'], '坏文件'),
    });
    // 单文件读失败（坏盘/同步冲突）：旧 Promise.all 链路整墙空，修复后只跳该文件
    const realRead = app.vault.read.bind(app.vault);
    vi.spyOn(app.vault, 'read').mockImplementation(async (f: any) => {
      if (f.path === '我的/日记/2401022200.md') throw new Error('读取失败');
      return realRead(f);
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entries = await loadWallEntries(app);
    expect(new Set(entries.map((e) => e.content))).toEqual(new Set(['健康甲', '健康乙']));
    expect(entries.some((e) => e.date === '2024-01-02')).toBe(false); // 坏文件不在墙内
    warnSpy.mockRestore();
  });

  it("D5' 回归：信批量读单文件失败不空整墙（特殊条目同口径；影视/书不读盘走 parse 内部容错）", async () => {
    const app = makeApp({
      '我的/信/好信.md': '---\ndate: 2024-03-09 09:00\n---\n好信正文\n',
      '我的/信/坏信.md': '---\ndate: 2024-03-09 10:00\n---\n坏信正文\n',
    });
    const realRead = app.vault.read.bind(app.vault);
    vi.spyOn(app.vault, 'read').mockImplementation(async (f: any) => {
      if (f.path === '我的/信/坏信.md') throw new Error('读取失败');
      return realRead(f);
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('letter');
    expect(entries[0].content).toContain('好信正文');
    warnSpy.mockRestore();
  });
});

describe('groupByMonth', () => {
  function makeEntry(date: string, time: string): WallEntry {
    return {
      date,
      time,
      tags: ['日记'],
      emoji: '📖',
      content: 'x',
      text: 'x',
      media: [],
      segments: [],
      filename: date,
      lineNumber: 1,
      kind: 'diary',
    };
  }

  it('按 YYYY-MM 分组', () => {
    const entries = [
      makeEntry('2024-01-01', '08:00'),
      makeEntry('2024-01-15', '09:00'),
      makeEntry('2024-02-03', '10:00'),
      makeEntry('2023-12-31', '23:00'),
    ];
    const map = groupByMonth(entries);
    expect([...map.keys()]).toEqual(['2024-01', '2024-02', '2023-12']);
    expect(map.get('2024-01')).toHaveLength(2);
    expect(map.get('2024-02')).toHaveLength(1);
    expect(map.get('2023-12')).toHaveLength(1);
  });

  it('空数组返回空 Map', () => {
    expect(groupByMonth([]).size).toBe(0);
  });

  it('组内保持传入顺序（外部已按日期时间降序）', () => {
    const entries = [makeEntry('2024-01-02', '08:00'), makeEntry('2024-01-01', '22:00')];
    const map = groupByMonth(entries);
    expect(map.get('2024-01')!.map((e) => e.date)).toEqual(['2024-01-02', '2024-01-01']);
  });
});

describe('mediaSrc', () => {
  it('纯文件名引用：走 getFirstLinkpathDest 解析资源 URL', () => {
    const app = makeApp({
      '我的/日记/2401010800.md': '# 📖 08:00\nx\n',
      '附件/photo.jpg': 'binary',
    });
    const url = mediaSrc(app, 'photo.jpg');
    expect(url).toBe('app://local/附件/photo.jpg');
  });

  it('带路径引用：getAbstractFileByPath 解析', () => {
    const app = makeApp({ '附件/video.mp4': 'binary' });
    const url = mediaSrc(app, '附件/video.mp4');
    expect(url).toBe('app://local/附件/video.mp4');
  });

  it('找不到返回空字符串', () => {
    const app = makeApp({});
    expect(mediaSrc(app, 'missing.png')).toBe('');
    expect(mediaSrc(app, '')).toBe('');
  });

  it('命中目录（非文件）返回空字符串', () => {
    const app = makeApp({ '附件/photo.jpg': 'binary' });
    expect(mediaSrc(app, '附件')).toBe('');
  });
});

describe('stripMediaLinks', () => {
  it('删除图片/视频/音频内链（含 | 尺寸参数），保留普通文字', () => {
    const content = '今天拍了照片\n![[photo.jpg]]\n![[clip.mp4|400]]\n![[voice.m4a]]\n文字还在';
    expect(stripMediaLinks(content)).toBe('今天拍了照片\n\n\n\n文字还在');
  });

  it('删除带路径与尺寸参数的媒体引用', () => {
    expect(stripMediaLinks('![[图片/旅行/风景.webp|300]]\n后面')).toBe('后面');
  });

  it('保留非媒体内链（普通笔记 / 块引用）', () => {
    const content = '参考 [[其他笔记]] 与 [[书库/xx#^block]]\n![[note.md]]\n![[data.json]]\n![[readme]]';
    expect(stripMediaLinks(content)).toBe('参考 [[其他笔记]] 与 [[书库/xx#^block]]\n![[note.md]]\n![[data.json]]\n![[readme]]');
  });

  it('保留 markdown 语法：加粗/斜体/标题/列表/引用/链接（text 供 MarkdownRenderer 渲染）', () => {
    const content = [
      '## 小标题',
      '这是 **加粗** 和 *斜体* 文字',
      '- 列表项一',
      '- 列表项二',
      '> 引用块',
      '参考 [[书库/某书#^block]] 笔记',
      '还有 `行内代码` 与 [外部链接](https://example.com)',
      '![[photo.jpg|400]]', // 媒体嵌入应被删除
      '**加粗还在** [[普通笔记]]',
    ].join('\n');
    const out = stripMediaLinks(content);
    expect(out).toContain('## 小标题');
    expect(out).toContain('这是 **加粗** 和 *斜体* 文字');
    expect(out).toContain('- 列表项一');
    expect(out).toContain('> 引用块');
    expect(out).toContain('参考 [[书库/某书#^block]] 笔记');
    expect(out).toContain('`行内代码` 与 [外部链接](https://example.com)');
    expect(out).toContain('**加粗还在** [[普通笔记]]');
    expect(out).not.toContain('![[photo.jpg'); // 媒体嵌入整段删除
    expect(out).not.toContain('400');
  });

  it('纯媒体条目返回空串', () => {
    expect(stripMediaLinks('![[a.png]]\n![[b.mp4]]')).toBe('');
  });

  it('无媒体引用时原样返回（trim）', () => {
    expect(stripMediaLinks('  只有文字  ')).toBe('只有文字');
  });

  it('扩展名大小写不敏感', () => {
    expect(stripMediaLinks('![[PHOTO.JPG]]\n保留')).toBe('保留');
  });
});

describe('loadWallEntries 透传 diary 定位字段', () => {
  it('filename/filePath/lineNumber/id 随条目透传（ADR-0131：条目文件路径即锚点）', async () => {
    const app = makeApp({
      '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], '第一天\n![[day1.jpg]]'),
    });
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.filename).toBe('我的/日记/2401010800.md'); // filename = 完整路径（UI 跳转依据）
    expect(e.lineNumber).toBe(0); // 行号定位随条目文件化退场
    expect(e.id).toBeUndefined(); // 日记条目无生成 id（非影视/信/书）
    expect(e.noteId).toBeUndefined(); // 非加密条目无保险箱 id
    expect(e.kind).toBe('diary');
    // text 与 content 并存：content 保留原文（复制/跳转），text 供渲染
    expect(e.content).toBe('第一天\n![[day1.jpg]]');
    expect(e.text).toBe('第一天');
  });

  it('两个条目文件各自透传自身路径（单文件单条目，无跨文件串扰）', async () => {
    const app = makeApp({
      '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], '第一条'),
      '我的/日记/2401010930.md': entry('2024-01-01', '09:30', ['随笔'], '第二条'),
    });
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => `${e.time}:${e.filename}`)).toEqual([
      '09:30:我的/日记/2401010930.md',
      '08:00:我的/日记/2401010800.md',
    ]);
  });
});

describe('mediaSrc 带 sourcePath 解析', () => {
  it('传 sourcePath 时 getFirstLinkpathDest 收到该路径作基准（修复纯文件名全局解析失败）', () => {
    const app = makeApp({
      '我的/日记/2407080800.md': '# 📖 08:00\nx\n',
      '我的/日记/photo.jpg': 'binary', // 同目录文件：仅靠全局 basename 解析可能歧义/失败
    });
    const spy = vi.spyOn(app.metadataCache, 'getFirstLinkpathDest');
    const url = mediaSrc(app, 'photo.jpg', '我的/日记/2407080800.md');
    expect(spy).toHaveBeenCalledWith('photo.jpg', '我的/日记/2407080800.md');
    expect(url).toBe('app://local/我的/日记/photo.jpg');
    spy.mockRestore();
  });

  it("不传 sourcePath 保持向后兼容（空串全局解析）", () => {
    const app = makeApp({
      '附件/photo.jpg': 'binary',
    });
    const spy = vi.spyOn(app.metadataCache, 'getFirstLinkpathDest');
    const url = mediaSrc(app, 'photo.jpg');
    expect(spy).toHaveBeenCalledWith('photo.jpg', '');
    expect(url).toBe('app://local/附件/photo.jpg');
    spy.mockRestore();
  });

  it('sourcePath 解析不到时回退 getAbstractFileByPath（带路径引用）', () => {
    const app = makeApp({
      '附件/video.mp4': 'binary',
    });
    const spy = vi.spyOn(app.metadataCache, 'getFirstLinkpathDest').mockReturnValue(null);
    const url = mediaSrc(app, '附件/video.mp4', '我的/日记/2407080800.md');
    expect(spy).toHaveBeenCalledWith('附件/video.mp4', '我的/日记/2407080800.md');
    expect(url).toBe('app://local/附件/video.mp4');
    spy.mockRestore();
  });
});

describe('parseBookFile（书库 frontmatter 解析）', () => {
  /** 构造 TFile 形状（stat.ctime 固定，getFileTimeParts 依赖） */
  function bookFile(path: string, basename?: string) {
    const app0 = makeApp({});
    return { ...app0.vault.file(path), basename: basename ?? path.split('/').pop()!.replace(/\.md$/, '') };
  }

  it('completionDate 优先于 readingDate', async () => {
    const app = makeApp({
      '书库/来自新世界.md':
        '---\ntitle: 来自新世界\ncompletionDate: 2024-06-10\nreadingDate: 2024-05-01\nbookReview: 神作\ncover: CONFIG/BOOK/来自新世界/cover.jpeg\n---\n',
    });
    const file = bookFile('书库/来自新世界.md');
    const entry = await parseBookFile(file, app);
    expect(entry).toMatchObject({ date: '2024-06-10', tags: ['书'], emoji: '📕', filename: '书库/来自新世界.md' });
    // content = 《title》 + bookReview + ![[cover]]（cover 拼进 content 才能被 extractMedia 提取）
    expect(entry!.content).toContain('**《来自新世界》**');
    expect(entry!.content).toContain('神作');
    expect(entry!.content).toContain('![[CONFIG/BOOK/来自新世界/cover.jpeg]]');
    expect(entry!.id).toContain('book-');
    // 时间（A1）：不再取文件创建时间，回落固定 00:00（对端书库域补结构化时间前的过渡口径）
    expect(entry!.time).toBe('00:00');
  });

  it('无 completionDate 时用 readingDate', async () => {
    const app = makeApp({
      '书库/人类简史.md': '---\ntitle: 人类简史\nreadingDate: 2024-03-15\nbookReview: 好看\n---\n',
    });
    const entry = await parseBookFile(bookFile('书库/人类简史.md'), app);
    expect(entry).not.toBeNull();
    expect(entry!.date).toBe('2024-03-15');
    // 无 cover：content 不含 ![[
    expect(entry!.content).toBe('**《人类简史》**\n\n好看');
  });

  it('bookReview 缺失或空白 → 返回 null 跳过（用户要求：书只获取有书评的）', async () => {
    const app = makeApp({
      '书库/无评.md': '---\ntitle: 无评\ncompletionDate: 2024-02-02\n---\n',
      '书库/空评.md': '---\ntitle: 空评\ncompletionDate: 2024-02-03\nbookReview: ""\n---\n',
    });
    expect(await parseBookFile(bookFile('书库/无评.md'), app)).toBeNull();
    expect(await parseBookFile(bookFile('书库/空评.md'), app)).toBeNull();
  });

  it('completionDate 与 readingDate 都无（或非法）返回 null 跳过', async () => {
    const app = makeApp({
      '书库/未读.md': '---\ntitle: 未读\n---\n',
      '书库/坏日期.md': '---\ntitle: 坏日期\ncompletionDate: not-a-date\n---\n',
    });
    expect(await parseBookFile(bookFile('书库/未读.md'), app)).toBeNull();
    expect(await parseBookFile(bookFile('书库/坏日期.md'), app)).toBeNull();
  });
});

describe('parseMovieFile / parseLetterFile（影视/信 frontmatter 解析）', () => {
  /** 构造 TFile 形状（stat.ctime 固定 12:00，getFileTimeParts 依赖） */
  function srcFile(path: string, basename?: string) {
    const app0 = makeApp({});
    return { ...app0.vault.file(path), basename: basename ?? path.split('/').pop()!.replace(/\.md$/, '') };
  }

  it('影视：标签归类（电影/纪录片/电视剧），content 含海报 ![[poster]]', async () => {
    const app = makeApp({
      '我的/影视/海边的曼彻斯特.md': '---\ntags: [电影]\n影评: 很压抑但真实\n观影日期: 2024-03-11\n海报: poster.jpg\n---\n',
      '我的/影视/蓝色星球.md': '---\ntags: [纪录片]\n影评: 自然之美\n观影日期: 2024-01-05\n海报: sea.jpg\n---\n',
      '我的/影视/绝命毒师.md': '---\ntags: [电视剧]\n影评: 神剧\n观影日期: 2023-12-01\n海报: ww.jpg\n---\n',
    });
    const [m1, m2, m3] = await Promise.all([
      parseMovieFile(srcFile('我的/影视/海边的曼彻斯特.md'), app),
      parseMovieFile(srcFile('我的/影视/蓝色星球.md'), app),
      parseMovieFile(srcFile('我的/影视/绝命毒师.md'), app),
    ]);
    expect(m1).toMatchObject({ tags: ['电影'], date: '2024-03-11', filename: '我的/影视/海边的曼彻斯特.md' });
    expect(m1!.content).toContain('很压抑但真实');
    expect(m1!.content).toContain('![[poster.jpg]]'); // 海报内链进 content（数据层提取为媒体）
    expect(m2).toMatchObject({ tags: ['纪录片'] });
    expect(m3).toMatchObject({ tags: ['电视剧'] });
    // 时间（A1）：不再取文件创建时间，回落固定 00:00（对端影院域补结构化时间前的过渡口径）
    expect(m1!.time).toBe('00:00');
    expect(m1!.id).toContain('movie-');
  });

  it('影视：无影评 / 观影日期缺失或非法 → 返回 null 跳过', async () => {
    const app = makeApp({
      '我的/影视/无评.md': '---\ntags: [电影]\n观影日期: 2024-03-11\n---\n',
      '我的/影视/无日期.md': '---\ntags: [电影]\n影评: 有影评没日期\n---\n',
      '我的/影视/坏日期.md': '---\ntags: [电影]\n影评: x\n观影日期: not-a-date\n---\n',
      '我的/影视/无fm.md': '只有正文没有 frontmatter\n',
    });
    expect(await parseMovieFile(srcFile('我的/影视/无评.md'), app)).toBeNull();
    expect(await parseMovieFile(srcFile('我的/影视/无日期.md'), app)).toBeNull();
    expect(await parseMovieFile(srcFile('我的/影视/坏日期.md'), app)).toBeNull();
    expect(await parseMovieFile(srcFile('我的/影视/无fm.md'), app)).toBeNull();
  });

  it('信：正文去 frontmatter，tag=信，content 含标题 + 正文', async () => {
    const app = makeApp({
      '我的/信/给未来.md': '---\ndate: 2024-03-09 20:00\n---\n你好，未来的我\n第二行\n',
    });
    const entry = await parseLetterFile(srcFile('我的/信/给未来.md'), app);
    expect(entry).toMatchObject({ tags: ['信'], date: '2024-03-09', filename: '我的/信/给未来.md' });
    expect(entry!.content).toBe('**给未来**\n\n你好，未来的我\n第二行'); // 标题（无扩展名）+ 正文（frontmatter 已剥离）
    expect(entry!.id).toContain('letter-');
  });

  it('信：readonly=true 或缺少/非法 date → 返回 null 跳过', async () => {
    const app = makeApp({
      '我的/信/草稿.md': '---\ndate: 2024-03-08\nreadonly: true\n---\n不要\n',
      '我的/信/无日期.md': '---\nreadonly: false\n---\n没有日期\n',
      '我的/信/坏日期.md': '---\ndate: not-a-date\n---\n坏日期\n',
    });
    expect(await parseLetterFile(srcFile('我的/信/草稿.md'), app)).toBeNull();
    expect(await parseLetterFile(srcFile('我的/信/无日期.md'), app)).toBeNull();
    expect(await parseLetterFile(srcFile('我的/信/坏日期.md'), app)).toBeNull();
  });
});

describe('loadWallEntries 聚合四类（日记+影视+信+书）', () => {
  it('四类内容全部进入并统一按日期时间降序混排，kind 正确', async () => {
    const app = makeApp({
      // 日记（条目文件，一目一文件）
      '我的/日记/2403100800.md': entry('2024-03-10', '08:00', ['日记'], '春游\n![[day.jpg]]'),
      // 影视（frontmatter 影评+观影日期+海报）
      '我的/影视/海边的曼彻斯特.md':
        '---\ntags: [电影]\n影评: 很压抑但真实\n观影日期: 2024-03-11\n海报: poster.jpg\n---\n',
      // 信（frontmatter date；readonly 的信应跳过）
      '我的/信/给未来.md': '---\ndate: 2024-03-09 20:00\n---\n你好，未来的我\n',
      '我的/信/草稿.md': '---\ndate: 2024-03-08\nreadonly: true\n---\n不要\n',
      // 书（completionDate 优先）
      '书库/来自新世界.md':
        '---\ntitle: 来自新世界\ncompletionDate: 2024-03-12\nbookReview: 神作\ncover: CONFIG/BOOK/来自新世界/cover.jpeg\n---\n',
    });
    const entries = await loadWallEntries(app);
    // 日记 1 + 影视 1 + 信 1（草稿跳过）+ 书 1 = 4
    expect(entries).toHaveLength(4);
    // 统一 date 降序（同日再 time 降序）：书(03-12) > 影视(03-11) > 日记(03-10) > 信(03-09)
    // A1：书/影视时分回落固定 00:00；信取 frontmatter date 的时间半段 20:00
    expect(entries.map((e) => `${e.date} ${e.time} ${e.kind}`)).toEqual([
      '2024-03-12 00:00 book',
      '2024-03-11 00:00 movie',
      '2024-03-10 08:00 diary',
      '2024-03-09 20:00 letter',
    ]);
    // kind 透传
    expect(entries.map((e) => e.kind)).toEqual(['book', 'movie', 'diary', 'letter']);
    // 书：封面经 extractMedia 提取（content 里的 ![[CONFIG/BOOK/来自新世界/cover.jpeg]]）
    expect(entries[0]).toMatchObject({ tags: ['书'], emoji: '📕', filename: '书库/来自新世界.md' });
    expect(entries[0].media).toEqual([{ name: 'CONFIG/BOOK/来自新世界/cover.jpeg', kind: 'img' }]);
    expect(entries[0].text).toBe('**《来自新世界》**\n\n神作'); // text 去掉 ![[cover]]
    // 影视：海报提取 + filename 完整路径 + 影评保留
    expect(entries[1]).toMatchObject({ tags: ['电影'], kind: 'movie', filename: '我的/影视/海边的曼彻斯特.md' });
    expect(entries[1].media).toEqual([{ name: 'poster.jpg', kind: 'img' }]);
    expect(entries[1].content).toContain('很压抑但真实');
    // 信：readonly 草稿被跳过
    expect(entries[3]).toMatchObject({ tags: ['信'], kind: 'letter', filename: '我的/信/给未来.md' });
    // 日记：filename=完整路径（与影视/信/书一致——UI 跳转依据）
    expect(entries[2]).toMatchObject({
      kind: 'diary',
      filename: '我的/日记/2403100800.md',
      media: [{ name: 'day.jpg', kind: 'img' }],
    });
  });

  it('四类目录同时为空（或不存在）安全返回空数组', async () => {
    const app = makeApp({});
    expect(await loadWallEntries(app)).toEqual([]);
  });

  it('只放日记文件时聚合结果仅含日记（目录不存在安全跳过）', async () => {
    const app = makeApp({
      '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], 'x'),
      // 无书评的书不进回忆墙（与影视影评同口径）；有书评的书正常聚合
      '书库/无评.md': '---\ntitle: a\ncompletionDate: 2024-01-02\n---\n',
      '书库/有评.md': '---\ntitle: b\ncompletionDate: 2024-01-03\nbookReview: 好看\n---\n',
    });
    // 无影视/信文件：有书评的书库条目仍会聚合进来（验证四类目录各自独立读取），无书评的跳过
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ kind: 'book', date: '2024-01-03' });
    expect(entries[1]).toMatchObject({ kind: 'diary', date: '2024-01-01' });
  });
});

describe('② 墙数据缓存（预热用，按 app 键控 + domain-bus 事件失效）', () => {
  const spyRead = (app: any) => {
    let n = 0;
    const real = app.vault.read.bind(app.vault);
    vi.spyOn(app.vault, 'read').mockImplementation(async (f: any) => {
      n++;
      return real(f);
    });
    return () => n;
  };

  it('同一 app 连续调用命中缓存：不重复读盘', async () => {
    const app = makeApp({ '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], 'x') });
    const reads = spyRead(app);
    const a = await loadWallEntries(app);
    const b = await loadWallEntries(app);
    expect(reads()).toBe(1); // 第二次走缓存，无额外读盘
    expect(b).toBe(a); // 命中同一引用（未重新分配数组）
  });

  it('invalidateWallCache 后强制回源重读', async () => {
    const app = makeApp({ '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], 'x') });
    const reads = spyRead(app);
    await loadWallEntries(app);
    invalidateWallCache();
    await loadWallEntries(app);
    expect(reads()).toBe(2);
  });

  it('四目录内 md 变更（domain-bus 事件）自动作废缓存', async () => {
    const app = makeApp({ '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], 'x') });
    const reads = spyRead(app);
    await loadWallEntries(app);
    emitDomainEvent('diary:file-modified', { path: '我的/日记/2401010800.md' });
    await loadWallEntries(app);
    expect(reads()).toBe(2); // 事件已作废旧缓存 → 重新读盘
  });

  it('四目录外 md 变更不影响缓存', async () => {
    const app = makeApp({ '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], 'x') });
    const reads = spyRead(app);
    await loadWallEntries(app);
    emitDomainEvent('vault:md-modified', { path: '其他/笔记.md' });
    await loadWallEntries(app);
    expect(reads()).toBe(1); // 目录外事件：仍命中缓存
  });

  it('换 app 调用即失效（按 app 键控）', async () => {
    const app1 = makeApp({ '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], '一') });
    const app2 = makeApp({ '我的/日记/2401010800.md': entry('2024-01-01', '08:00', ['日记'], '二') });
    await loadWallEntries(app1);
    const e2 = await loadWallEntries(app2);
    expect(e2[0].content).toBe('二'); // app2 独立读盘，不复用 app1 缓存
  });

  it('① 四目录并行：各类目录聚合结果与串行版一致（并行不改变合并/排序）', async () => {
    const app = makeApp({
      '我的/日记/2403100800.md': entry('2024-03-10', '08:00', ['日记'], '春游'),
      '我的/影视/片子.md': '---\ntags: [电影]\n影评: 好\n观影日期: 2024-03-11\n---\n',
      '我的/信/信一.md': '---\ndate: 2024-03-09 20:00\n---\n正文\n',
      '书库/书一.md': '---\ntitle: 书一\ncompletionDate: 2024-03-12\nbookReview: 神作\n---\n',
    });
    const entries = await loadWallEntries(app);
    expect(entries.map((e) => e.kind)).toEqual(['book', 'movie', 'diary', 'letter']);
    expect(entries.map((e) => e.date)).toEqual(['2024-03-12', '2024-03-11', '2024-03-10', '2024-03-09']);
  });
});

describe('自包含：data.ts 不依赖 ../diary', () => {
  it('data.ts 源码无 from ../diary 引用（grep 断言）', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/diary/data.ts'), 'utf8');
    expect(src).not.toMatch(/from\s+['"]\.\.\/diary/);
    // parser.ts / config.ts / types.ts 同样自包含
    for (const f of ['parser.ts', 'config.ts', 'types.ts']) {
      const s = fs.readFileSync(path.resolve(process.cwd(), `src/diary/${f}`), 'utf8');
      expect(s).not.toMatch(/from\s+['"]\.\.\/diary/);
    }
  });
});

describe('pickOnThisDay（那年今天，增强 #5 数据口径）', () => {
  const mk = (date: string): WallEntry => ({
    date,
    time: '08:00',
    tags: ['日记'],
    emoji: '📖',
    content: '内容',
    filename: date,
    lineNumber: 0,
    kind: 'diary',
    media: [],
    text: '内容',
    segments: [],
  });

  it('mmdd 命中：往年同月日条目全部命中（跨多年）', () => {
    const entries = [mk('2023-09-04'), mk('2024-09-04'), mk('2025-09-04'), mk('2025-12-01'), mk('2026-01-09')];
    const hit = pickOnThisDay(entries, '2026-09-04');
    expect(hit.map((e) => e.date)).toEqual(['2023-09-04', '2024-09-04', '2025-09-04']);
  });

  it('排除当年：today 当年的条目不算「那年」（避免与今日内容重复）', () => {
    const entries = [mk('2026-09-04'), mk('2025-09-04')];
    const hit = pickOnThisDay(entries, '2026-09-04');
    expect(hit.map((e) => e.date)).toEqual(['2025-09-04']);
  });

  it('today 非 YYYY-MM-DD 形状（空串/残缺）返回空数组', () => {
    const entries = [mk('2025-09-04')];
    expect(pickOnThisDay(entries, '')).toEqual([]);
    expect(pickOnThisDay(entries, '2026-9')).toEqual([]);
  });

  it('issue 352：口径放开——纯文字条目（无媒体）与媒体条目一并命中（不在此层筛媒体）', () => {
    const withMedia: WallEntry = { ...mk('2024-09-04'), media: [{ name: 'a.jpg', kind: 'img' }] };
    const textOnly = mk('2025-09-04');
    const hit = pickOnThisDay([withMedia, textOnly], '2026-09-04');
    expect(hit).toEqual([withMedia, textOnly]);
  });

  it('空条目集返回空数组', () => {
    expect(pickOnThisDay([], '2026-09-04')).toEqual([]);
  });
});
