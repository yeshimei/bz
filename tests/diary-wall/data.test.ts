// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { buildTagMaps, resetTagsConfig } from '../../src/diary-wall/config';
import {
  extractMedia,
  groupByMonth,
  loadWallEntries,
  mediaSrc,
  pickOnThisDay,
  stripMediaLinks,
  type WallEntry,
} from '../../src/diary-wall/data';
import { parseBookFile, parseLetterFile, parseMovieFile } from '../../src/diary-wall/parser';

const DIARY_DIR = '我的/日记';

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
  it('读取多天文件，解析条目并提取媒体', async () => {
    const app = makeApp({
      '我的/日记/2024-01-01.md': '# 📖 08:00\n第一天\n![[day1.jpg]]\n\n# ✍️ 09:30\n下午记录\n',
      '我的/日记/2024-01-02.md': '# 🌙 22:00\n第二天\n![[night.mp4]]\n',
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

  it('非 YYYY-MM-DD 命名与非法日期的文件跳过', async () => {
    const app = makeApp({
      '我的/日记/2024-01-01.md': '# 📖 08:00\n正常\n',
      '我的/日记/README.md': '# 📖 08:00\n说明文件\n',
      '我的/日记/2024-13-45.md': '# 📖 08:00\n非法日期\n',
      '我的/日记/随机笔记.md': '# 📖 08:00\n非日期命名\n',
    });
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2024-01-01');
  });

  it('空目录安全返回空数组', async () => {
    const app = makeApp({});
    expect(await loadWallEntries(app)).toEqual([]);
  });

  it('子目录中的日记文件也会被读取（递归收集）', async () => {
    const app = makeApp({
      '我的/日记/2024-01-01.md': '# 📖 08:00\n顶层\n',
      '我的/日记/子目录/2024-01-03.md': '# 📖 08:00\n子目录\n![[sub.png]]\n',
    });
    const entries = await loadWallEntries(app);
    expect(entries.map((e) => e.date)).toEqual(['2024-01-03', '2024-01-01']);
    expect(entries[0].media).toEqual([{ name: 'sub.png', kind: 'img' }]);
  });

  it('无媒体条目的 content 保留原文（不因提取而改写）', async () => {
    const app = makeApp({
      '我的/日记/2024-01-05.md': '# 📖 12:00\n只有文字\n![[note.md]]\n',
    });
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(1);
    expect(entries[0].media).toEqual([]); // .md 内链不提取
    expect(entries[0].content).toBe('只有文字\n![[note.md]]');
  });

  it('多标签条目透传 tags/emoji', async () => {
    const app = makeApp({
      '我的/日记/2024-06-01.md': '# 📖🌟 09:00\n写诗一首\n',
    });
    const entries = await loadWallEntries(app);
    expect(entries[0].tags).toEqual(['日记', '诗']);
    expect(entries[0].emoji).toBe('📖🌟');
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
      '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n',
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
  it('filename/lineNumber/id 随条目透传（id 沿用 parseFile 生成逻辑，无则置空）', async () => {
    const app = makeApp({
      '我的/日记/2024-01-01.md': '# 📖 08:00\n第一天\n![[day1.jpg]]\n',
    });
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.filename).toBe('2024-01-01'); // parseFile 的 filename = dateStr
    expect(e.lineNumber).toBe(1); // # 标题行号
    expect(e.id).toBeUndefined(); // parseFile 未生成 id（非影视/信文件）
    expect(e.noteId).toBeUndefined(); // 非加密条目无保险箱 id（字段透传自 DiaryEntry，加密条目解密时用）
    expect(e.kind).toBe('diary'); // 日记条目来源类型
    // text 与 content 并存：content 保留原文（复制/跳转），text 供渲染
    expect(e.content).toBe('第一天\n![[day1.jpg]]');
    expect(e.text).toBe('第一天');
  });

  it('多条目各自透传正确行号', async () => {
    const app = makeApp({
      '我的/日记/2024-01-01.md': '# 📖 08:00\n第一条\n\n# ✍️ 09:30\n第二条\n',
    });
    const entries = await loadWallEntries(app);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => `${e.time}:${e.lineNumber}`)).toEqual(['09:30:4', '08:00:1']);
  });
});

describe('mediaSrc 带 sourcePath 解析', () => {
  it('传 sourcePath 时 getFirstLinkpathDest 收到该路径作基准（修复纯文件名全局解析失败）', () => {
    const app = makeApp({
      '我的/日记/2024-07-08.md': '# 📖 08:00\nx\n',
      '我的/日记/photo.jpg': 'binary', // 同目录文件：仅靠全局 basename 解析可能歧义/失败
    });
    const spy = vi.spyOn(app.metadataCache, 'getFirstLinkpathDest');
    const url = mediaSrc(app, 'photo.jpg', '我的/日记/2024-07-08.md');
    expect(spy).toHaveBeenCalledWith('photo.jpg', '我的/日记/2024-07-08.md');
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
    const url = mediaSrc(app, '附件/video.mp4', '我的/日记/2024-07-08.md');
    expect(spy).toHaveBeenCalledWith('附件/video.mp4', '我的/日记/2024-07-08.md');
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
    // 时间来自文件创建时间（mock stat = Date.UTC(2024,0,1,12,0)，本地时区格式化；中国时区 +8 → 20:00）
    expect(entry!.time).toBe('20:00');
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
    // 时间来自文件创建时间（mock stat = Date.UTC(2024,0,1,12,0)，本地时区格式化；中国时区 +8 → 20:00）
    expect(m1!.time).toBe('20:00');
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
      // 日记（每文件多条目）
      '我的/日记/2024-03-10.md': '# 📖 08:00\n春游\n![[day.jpg]]\n',
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
    expect(entries.map((e) => `${e.date} ${e.time} ${e.kind}`)).toEqual([
      '2024-03-12 20:00 book',
      '2024-03-11 20:00 movie',
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
    // 日记：filename=dateStr（与影视/信/书不同——UI 跳转依据）
    expect(entries[2]).toMatchObject({ kind: 'diary', filename: '2024-03-10', media: [{ name: 'day.jpg', kind: 'img' }] });
  });

  it('四类目录同时为空（或不存在）安全返回空数组', async () => {
    const app = makeApp({});
    expect(await loadWallEntries(app)).toEqual([]);
  });

  it('只放日记文件时聚合结果仅含日记（目录不存在安全跳过）', async () => {
    const app = makeApp({
      '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n',
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

describe('自包含：data.ts 不依赖 ../diary', () => {
  it('data.ts 源码无 from ../diary 引用（grep 断言）', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/diary-wall/data.ts'), 'utf8');
    expect(src).not.toMatch(/from\s+['"]\.\.\/diary/);
    // parser.ts / config.ts / types.ts 同样自包含
    for (const f of ['parser.ts', 'config.ts', 'types.ts']) {
      const s = fs.readFileSync(path.resolve(process.cwd(), `src/diary-wall/${f}`), 'utf8');
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

  it('空条目集返回空数组', () => {
    expect(pickOnThisDay([], '2026-09-04')).toEqual([]);
  });
});
