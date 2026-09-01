// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { buildTagMaps, resetTagsConfig } from '../../src/diary/config';
import {
  extractMedia,
  groupByMonth,
  loadWallEntries,
  mediaSrc,
  type WallEntry,
} from '../../src/diary-wall/data';

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
    const entries = await loadWallEntries(app, DIARY_DIR);
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
    const entries = await loadWallEntries(app, DIARY_DIR);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2024-01-01');
  });

  it('空目录安全返回空数组', async () => {
    const app = makeApp({});
    expect(await loadWallEntries(app, DIARY_DIR)).toEqual([]);
  });

  it('子目录中的日记文件也会被读取（递归收集）', async () => {
    const app = makeApp({
      '我的/日记/2024-01-01.md': '# 📖 08:00\n顶层\n',
      '我的/日记/子目录/2024-01-03.md': '# 📖 08:00\n子目录\n![[sub.png]]\n',
    });
    const entries = await loadWallEntries(app, DIARY_DIR);
    expect(entries.map((e) => e.date)).toEqual(['2024-01-03', '2024-01-01']);
    expect(entries[0].media).toEqual([{ name: 'sub.png', kind: 'img' }]);
  });

  it('无媒体条目的 content 保留原文（不因提取而改写）', async () => {
    const app = makeApp({
      '我的/日记/2024-01-05.md': '# 📖 12:00\n只有文字\n![[note.md]]\n',
    });
    const entries = await loadWallEntries(app, DIARY_DIR);
    expect(entries).toHaveLength(1);
    expect(entries[0].media).toEqual([]); // .md 内链不提取
    expect(entries[0].content).toBe('只有文字\n![[note.md]]');
  });

  it('多标签条目透传 tags/emoji', async () => {
    const app = makeApp({
      '我的/日记/2024-06-01.md': '# 📖🌟 09:00\n写诗一首\n',
    });
    const entries = await loadWallEntries(app, DIARY_DIR);
    expect(entries[0].tags).toEqual(['日记', '诗']);
    expect(entries[0].emoji).toBe('📖🌟');
  });
});

describe('groupByMonth', () => {
  function makeEntry(date: string, time: string): WallEntry {
    return { date, time, tags: ['日记'], emoji: '📖', content: 'x', media: [] };
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
