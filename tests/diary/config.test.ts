// @vitest-environment node
import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyDiaryTypes,
  applyDirectories,
  bookDirectory,
  DIARY_ENTRY_FORMAT,
  DIARY_DIRECTORY,
  emojiToTagMap,
  LEGACY_DIARY_TYPES,
  LETTER_DIRECTORY,
  movieDirectory,
  getParentPrimaryTag,
  getSortedTagsForAddDialog,
  getSubTagsOfPrimary,
  getTagEmoji,
  isSubTag,
  migrateDiaryTypes,
  parseDiaryTypes,
  resetTagsConfig,
  serializedDiaryTypes,
  tagToEmojiMap,
} from '../../src/diary/config';

// 回归：模块加载时即构建 emoji 映射（不依赖设置应用流程）
// 此断言位于 beforeEach 之前，真实反映模块顶层状态
if (emojiToTagMap['📖'] !== '日记' || tagToEmojiMap['日记'] !== '📖') {
  throw new Error('config 模块加载后 emoji 映射未构建——缺少模块顶层 buildTagMaps() 调用');
}

beforeEach(() => {
  resetTagsConfig();
});

describe('默认分类（全部平级，只有 3 个示例）', () => {
  it('默认只有日记/随笔/生活三个', () => {
    expect(Object.keys(tagToEmojiMap).sort()).toEqual(['生活', '日记', '随笔'].sort());
    expect(getTagEmoji('日记')).toBe('📖');
    expect(getTagEmoji('随笔')).toBe('✍️');
    expect(getTagEmoji('生活')).toBe('🏠');
  });

  it('旧版 28 类不再进默认值', () => {
    expect(getTagEmoji('四川')).toBe('📖'); // 未知回退
    expect(getTagEmoji('艺术')).toBe('📖');
    expect(tagToEmojiMap['骑行']).toBeUndefined();
  });

  it('层级已退役：子标签辅助函数恒空/恒否', () => {
    expect(isSubTag('旅行')).toBe(false);
    expect(getParentPrimaryTag('旅行')).toBeNull();
    expect(getSubTagsOfPrimary('生活')).toBeNull();
  });

  it('写日记弹窗的分类顺序 = 配置顺序，全部平级', () => {
    expect(getSortedTagsForAddDialog()).toEqual(['日记', '随笔', '生活']);
  });

  it('组合 emoji 可作为键（🧑‍🎨 艺术）', () => {
    applyDiaryTypes([{ tag: '艺术', emoji: '🧑‍🎨' }]);
    expect(tagToEmojiMap['艺术']).toBe('🧑‍🎨');
    expect(emojiToTagMap['🧑‍🎨']).toBe('艺术');
  });
});

describe('分类表解析 / 迁移', () => {
  it('parseDiaryTypes：去重保序、空名跳过、emoji 缺失回退', () => {
    const out = parseDiaryTypes([
      { tag: '日记', emoji: '📖' },
      { tag: '日记', emoji: '📕' },
      { tag: '  ', emoji: '📝' },
      { tag: '随笔' },
    ]);
    expect(out.map((t) => t.tag)).toEqual(['日记', '随笔']);
    expect(out[1].emoji).toBe('📖');
  });

  it('旧层级配置自动拍平：子标签变成独立分类（升级不丢名字）', () => {
    const raw = JSON.stringify([
      { tag: '生活', emoji: '🏠', subTags: [{ tag: '旅行', emoji: '✈️' }, { tag: '美食', emoji: '🍜' }] },
    ]);
    expect(parseDiaryTypes(raw).map((t) => t.tag)).toEqual(['生活', '旅行', '美食']);
  });

  it('空/损坏的 JSON 回退 3 个示例', () => {
    expect(parseDiaryTypes('').map((t) => t.tag)).toEqual(['日记', '随笔', '生活']);
    expect(parseDiaryTypes('{坏').map((t) => t.tag)).toEqual(['日记', '随笔', '生活']);
    expect(parseDiaryTypes('[]').map((t) => t.tag)).toEqual(['日记', '随笔', '生活']);
  });

  it('旧版 28 类已拍平（四川/大理/咪咪 都成为平级分类）', () => {
    const tags = LEGACY_DIARY_TYPES.map((t) => t.tag);
    expect(tags).toContain('四川');
    expect(tags).toContain('大理');
    expect(tags).toContain('咪咪');
    expect(new Set(tags).size).toBe(tags.length); // 无重名
  });

  it('serializedDiaryTypes 只写 tag/emoji，不带层级', () => {
    const raw = serializedDiaryTypes([{ tag: '日记', emoji: '📖' }]);
    expect(JSON.parse(raw)).toEqual([{ tag: '日记', emoji: '📖' }]);
  });

  it('migrateDiaryTypes：老库（带日记键）写旧表；空对象/无日记键/已有新键不写', () => {
    const oldVault: Record<string, unknown> = { diaryDirectory: '' };
    expect(migrateDiaryTypes(oldVault)).toBe(true);
    expect(String(oldVault.diaryTypes)).toContain('四川');
    expect(migrateDiaryTypes({})).toBe(false);
    expect(migrateDiaryTypes({ storagePath: 'DATA/STORAGE' })).toBe(false);
    expect(migrateDiaryTypes({ diaryDirectory: '', diaryTypes: '[]' })).toBe(false);
    expect(migrateDiaryTypes(null)).toBe(false);
  });
});

describe('applyDirectories 设置应用', () => {
  it('diaryDirectory / letterDirectory 生效', () => {
    applyDirectories({ diaryDirectory: '日记2', letterDirectory: '信件2' });
    expect(DIARY_DIRECTORY).toBe('日记2');
    expect(LETTER_DIRECTORY).toBe('信件2');
  });

  it('缺省回退默认目录（设置空 + 无 Obsidian 日记设置 → 内部兜底「我的/日记」）', () => {
    applyDirectories({});
    expect(DIARY_DIRECTORY).toBe('我的/日记');
    expect(LETTER_DIRECTORY).toBe('我的/信');
  });

  it('diaryEntryFormat 只认 entry，其余回落 day（2026-11-05 新缺省）', () => {
    applyDirectories({ diaryEntryFormat: 'day' });
    expect(DIARY_ENTRY_FORMAT).toBe('day');
    applyDirectories({ diaryEntryFormat: 'xxx' });
    expect(DIARY_ENTRY_FORMAT).toBe('day');
    applyDirectories({ diaryEntryFormat: 'entry' });
    expect(DIARY_ENTRY_FORMAT).toBe('entry');
  });

  it('设置里的 diaryTypes 随 applyDirectories 生效', () => {
    applyDirectories({ diaryTypes: JSON.stringify([{ tag: '读书', emoji: '📚' }]) });
    expect(getTagEmoji('读书')).toBe('📚');
    expect(getSortedTagsForAddDialog()).toEqual(['读书']);
  });

  it('影视/书库目录跨域实时解析并回退默认（本域无独立设置键；D6：函数实时 resolve 非启动快照）', () => {
    applyDirectories({});
    expect(typeof movieDirectory()).toBe('string');
    expect(movieDirectory().length).toBeGreaterThan(0);
    expect(typeof bookDirectory()).toBe('string');
    expect(bookDirectory().length).toBeGreaterThan(0);
  });

  it('D6 回归：改影院目录设置后 movieDirectory 实时跟随（不再等重启/applyDirectories 快照）', async () => {
    applyDirectories({});
    const { setSettingsProvider } = await import('../../src/core/settings-provider');
    setSettingsProvider(() => ({ cinemaFolderPath: '影视新家', bookshelfFolderPath: '书架新家' }) as any);
    expect(movieDirectory()).toBe('影视新家');
    expect(bookDirectory()).toBe('书架新家');
    // 回落：空值/空白回默认目录
    setSettingsProvider(() => ({ cinemaFolderPath: '  ' }) as any);
    expect(movieDirectory()).toBe('我的/影视');
    setSettingsProvider(() => {
      throw new Error('设置未注入');
    });
    expect(bookDirectory()).toBe('书库');
    setSettingsProvider(() => ({}) as any);
  });

  it('N6 回归：目录配置带尾斜杠时 trim（与 data.ts collectMdPaths 同口径 normalize）', () => {
    applyDirectories({ diaryDirectory: '我的/日记/', letterDirectory: '我的/信//' });
    expect(DIARY_DIRECTORY).toBe('我的/日记'); // 双斜杠尾随一并清掉：监听侧 startsWith(dir+'/') 不再恒不命中
    expect(LETTER_DIRECTORY).toBe('我的/信');
    applyDirectories({ diaryDirectory: '  ' }); // 空白 = 没填 → 跟随 Obsidian；测试无 app → 兜底默认
    expect(DIARY_DIRECTORY).toBe('我的/日记');
    applyDirectories({});
  });
});
