/**
 * 动态目录分类测试：默认目录六域命中/未命中/边界（我的/日记.md 不算）、反斜杠归一、
 * settings 注入自定义目录生效与实时切换、movie 双键任一命中、日期解析正反例。
 * settings 注入方式对齐 tests/smartcat/context-source.test.ts（setSettingsProvider + afterEach 还原）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { classifyFilePath, diaryDateFromPath } from '../../src/core/path-classify';
import { setSettingsProvider } from '../../src/core/settings-provider';

afterEach(() => {
  setSettingsProvider(() => ({} as any)); // 还原空设置：分类回退内置默认目录
});

describe('classifyFilePath（默认目录）', () => {
  it('默认目录命中六域', () => {
    expect(classifyFilePath('我的/日记/2026-08-23.md')).toBe('diary');
    expect(classifyFilePath('卡片盒/TDD.md')).toBe('flash');
    expect(classifyFilePath('归档/网页剪藏/某文章.md')).toBe('clipping');
    expect(classifyFilePath('我的/影视/《楚门的世界》观后感.md')).toBe('movie');
    expect(classifyFilePath('我的/现代诗/夜航.md')).toBe('poem');
    expect(classifyFilePath('我的/信/给未来的自己.md')).toBe('letter');
  });

  it('子目录递归命中（isUnderFolder 语义）', () => {
    expect(classifyFilePath('我的/日记/2024/旧篇.md')).toBe('diary');
    expect(classifyFilePath('归档/网页剪藏/科技/深度报道.md')).toBe('clipping');
  });

  it('未命中返回 null；非 md 不识别', () => {
    expect(classifyFilePath('随手记/x.md')).toBeNull();
    expect(classifyFilePath('CONFIG/STORAGE/memo.json')).toBeNull();
    expect(classifyFilePath('卡片盒/note.txt')).toBeNull(); // 只认 .md
    expect(classifyFilePath(null)).toBeNull();
    expect(classifyFilePath(undefined)).toBeNull();
    expect(classifyFilePath('')).toBeNull();
  });

  it('边界不误判：恰为目录名/前缀相近的文件与目录都不算', () => {
    expect(classifyFilePath('我的/日记.md')).toBeNull(); // 「我的/日记.md」不是日记域文件
    expect(classifyFilePath('我的/日记本/a.md')).toBeNull(); // 前缀相近目录不算
    expect(classifyFilePath('卡片盒.md')).toBeNull(); // 根下同名文件不算
    expect(classifyFilePath('我的/影视笔记.md')).toBeNull();
  });
});

describe('classifyFilePath（反斜杠归一）', () => {
  it('反斜杠路径归一为正斜杠后再匹配', () => {
    expect(classifyFilePath('我的\\日记\\2026-08-23.md')).toBe('diary');
    expect(classifyFilePath('归档\\网页剪藏\\a.md')).toBe('clipping');
    expect(classifyFilePath('我的\\现代诗\\a.md')).toBe('poem');
  });

  it('设置值含尾斜杠/反斜杠也能匹配', () => {
    setSettingsProvider(() => ({ diaryDirectory: 'Journal\\' } as any));
    expect(classifyFilePath('Journal/a.md')).toBe('diary');
    expect(classifyFilePath('Journal\\b.md')).toBe('diary');
  });
});

describe('classifyFilePath（settings 注入自定义目录）', () => {
  it('自定义目录生效，旧默认不再命中', () => {
    setSettingsProvider(() => ({
      diaryDirectory: 'Journal',
      letterDirectory: 'Letters',
      articleDirectory: 'Clips',
      movieFolderPath: 'Films',
    } as any));
    expect(classifyFilePath('Journal/2026-08-23.md')).toBe('diary');
    expect(classifyFilePath('Letters/a.md')).toBe('letter');
    expect(classifyFilePath('Clips/a.md')).toBe('clipping');
    expect(classifyFilePath('Films/a.md')).toBe('movie');
    // 旧默认目录不再命中
    expect(classifyFilePath('我的/日记/x.md')).toBeNull();
    expect(classifyFilePath('我的/信/x.md')).toBeNull();
  });

  it('每次调用实时读设置：两次调用之间改 provider，同一路径结果即时翻转', () => {
    expect(classifyFilePath('我的/日记/a.md')).toBe('diary');
    setSettingsProvider(() => ({ diaryDirectory: 'Elsewhere' } as any));
    expect(classifyFilePath('我的/日记/a.md')).toBeNull();
    setSettingsProvider(() => ({ diaryDirectory: '我的/日记' } as any));
    expect(classifyFilePath('我的/日记/a.md')).toBe('diary');
  });

  it('movie 双键（movieFolderPath / movieDirectory）任一命中即算影视域', () => {
    setSettingsProvider(() => ({ movieFolderPath: 'F1' } as any));
    expect(classifyFilePath('F1/a.md')).toBe('movie');
    setSettingsProvider(() => ({ movieDirectory: 'F2' } as any));
    expect(classifyFilePath('F2/b.md')).toBe('movie');
    // 两键都缺 → 回退默认 '我的/影视'
    setSettingsProvider(() => ({}) as any);
    expect(classifyFilePath('我的/影视/c.md')).toBe('movie');
  });

  it('cinema 分支：仅显式配置 cinemaFolderPath 才生效（缺省不抢占 movie 默认目录）', () => {
    // 缺省：我的/影视 仍归 movie（cinema 不抢占）
    setSettingsProvider(() => ({} as any));
    expect(classifyFilePath('我的/影视/c.md')).toBe('movie');
    // 显式配置 cinemaFolderPath → 该目录归 cinema（在 movie 之前判定）
    setSettingsProvider(() => ({ cinemaFolderPath: '我的/影视' } as any));
    expect(classifyFilePath('我的/影视/c.md')).toBe('cinema');
    // 配置到别处 → 两域独立
    setSettingsProvider(() => ({ cinemaFolderPath: '我的/影院', movieFolderPath: '我的/影视' } as any));
    expect(classifyFilePath('我的/影院/c.md')).toBe('cinema');
    expect(classifyFilePath('我的/影视/c.md')).toBe('movie');
    // 空白值 → 不生效（回退 movie）
    setSettingsProvider(() => ({ cinemaFolderPath: '   ' } as any));
    expect(classifyFilePath('我的/影视/c.md')).toBe('movie');
  });

  it('settings 值为空白字符串时回退默认目录（对齐现有 || 兜底习惯）', () => {
    setSettingsProvider(() => ({ diaryDirectory: '   ' } as any));
    expect(classifyFilePath('我的/日记/a.md')).toBe('diary');
  });
});

describe('diaryDateFromPath', () => {
  it('正例：basename 形如 YYYY-MM-DD.md 取出日期', () => {
    expect(diaryDateFromPath('我的/日记/2026-08-23.md')).toBe('2026-08-23');
    expect(diaryDateFromPath('2026-01-02.md')).toBe('2026-01-02'); // 无目录裸 basename
    expect(diaryDateFromPath('我的\\日记\\2024-12-31.md')).toBe('2024-12-31'); // 反斜杠
  });

  it('反例：非日期命名/错误格式/非 md 返回 null', () => {
    expect(diaryDateFromPath('我的/日记/随笔.md')).toBeNull();
    expect(diaryDateFromPath('我的/日记/2026-8-23.md')).toBeNull(); // 月/日未补零
    expect(diaryDateFromPath('我的/日记/20260823.md')).toBeNull(); // 无连字符
    expect(diaryDateFromPath('我的/日记/2026-08-23 备份.md')).toBeNull(); // basename 多段
    expect(diaryDateFromPath('我的/日记/2026-08-23.txt')).toBeNull(); // 非 md 后缀
    expect(diaryDateFromPath('')).toBeNull();
  });
});
