// @vitest-environment node
/**
 * 回忆墙目录接线回归（P2 审查修复）：applyDiarySettingsToRuntime 同步应用
 * diary-wall 的目录常量（此前 applyDirectories 无任何调用点，改目录后回忆墙
 * 仍读硬编码默认值）。
 */
import { describe, expect, it, afterEach } from 'vitest';
import { applyDiarySettingsToRuntime } from '../../src/main';
import { DIARY_DIRECTORY, MOVIE_DIRECTORY, LETTER_DIRECTORY, BOOK_DIRECTORY, applyDirectories as resetWallDirectories } from '../../src/diary-wall/config';

afterEach(() => {
  // 恢复默认，防污染其它用例
  resetWallDirectories({});
});

describe('diary-wall applyDirectories 接线（P2 审查修复）', () => {
  it('应用日记本设置时同步回忆墙四类目录常量', () => {
    applyDiarySettingsToRuntime({
      diaryDirectory: '日记/新家',
      movieDirectory: '日记/影院',
      letterDirectory: '日记/信箱',
    } as any);
    expect(DIARY_DIRECTORY).toBe('日记/新家');
    expect(MOVIE_DIRECTORY).toBe('日记/影院');
    expect(LETTER_DIRECTORY).toBe('日记/信箱');
    // 书库无设置键：回落默认值
    expect(BOOK_DIRECTORY).toBe('书库');
  });

  it('空值回落默认目录', () => {
    applyDiarySettingsToRuntime({ diaryDirectory: '', movieDirectory: '', letterDirectory: '' } as any);
    expect(DIARY_DIRECTORY).toBe('我的/日记');
    expect(MOVIE_DIRECTORY).toBe('我的/影视');
    expect(LETTER_DIRECTORY).toBe('我的/信');
  });
});
