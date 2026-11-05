// @vitest-environment node
/**
 * core/daily-notes.ts：读 Obsidian 核心「日记」插件的目录与日期格式（2026-11-05）。
 *
 * 需求：bz 的日记目录留空时跟随 Obsidian 日记的「新日记存放位置」；日期格式跟随它的
 * `format`（day 格式的文件名、设置卡片示例都用它）。两边都没有 → 空串（走未配置引导）。
 */
import { describe, expect, it } from 'vitest';
import { setApp } from '../../src/core/app';
import {
  OBSIDIAN_DAILY_NOTES_DEFAULT_FORMAT,
  obsidianDailyNotesFolder,
  obsidianDailyNotesFormat,
} from '../../src/core/daily-notes';

interface HostOpts {
  folder?: unknown;
  format?: unknown;
  /** Obsidian 全局「新笔记的存放位置」：root / current / folder */
  newFileLocation?: string;
  newFileFolderPath?: string;
  /** 模拟日记核心插件未启用 */
  disabled?: boolean;
}

function setHost(opts: HostOpts): void {
  setApp({
    internalPlugins: {
      getPluginById: (id: string) =>
        id === 'daily-notes' && !opts.disabled
          ? { instance: { options: { folder: opts.folder, format: opts.format } } }
          : null,
    },
    vault: {
      getConfig: (key: string) =>
        key === 'newFileLocation'
          ? opts.newFileLocation
          : key === 'newFileFolderPath'
            ? opts.newFileFolderPath
            : undefined,
    },
  } as never);
}

describe('obsidianDailyNotesFolder', () => {
  it('未初始化 app（getApp 抛错）→ 空串，不炸调用方', () => {
    // 本用例必须排在最前：setApp 之后无法复位成「未初始化」
    expect(obsidianDailyNotesFolder()).toBe('');
    expect(obsidianDailyNotesFormat()).toBe(OBSIDIAN_DAILY_NOTES_DEFAULT_FORMAT);
  });

  it('日记插件自己的 folder 优先', () => {
    setHost({ folder: '我的/日记', newFileLocation: 'folder', newFileFolderPath: '别处' });
    expect(obsidianDailyNotesFolder()).toBe('我的/日记');
  });

  it('folder 带反斜杠/首尾斜杠 → 归一成 vault 相对路径', () => {
    setHost({ folder: '\\我的\\日记\\' });
    expect(obsidianDailyNotesFolder()).toBe('我的/日记');
  });

  it('folder 空 + 全局新笔记位置 = 指定文件夹 → 跟随它', () => {
    setHost({ folder: '', newFileLocation: 'folder', newFileFolderPath: '日记本' });
    expect(obsidianDailyNotesFolder()).toBe('日记本');
  });

  it('folder 空 + 全局新笔记位置 = 根目录/当前文件夹 → 空串（库根）', () => {
    setHost({ folder: '', newFileLocation: 'root', newFileFolderPath: '不该用' });
    expect(obsidianDailyNotesFolder()).toBe('');
    setHost({ folder: '', newFileLocation: 'current', newFileFolderPath: '不该用' });
    expect(obsidianDailyNotesFolder()).toBe('');
  });

  it('日记插件未启用 → 只看全局设置；全局也没有 → 空串', () => {
    setHost({ disabled: true, newFileLocation: 'folder', newFileFolderPath: '日记本' });
    expect(obsidianDailyNotesFolder()).toBe('日记本');
    setHost({ disabled: true });
    expect(obsidianDailyNotesFolder()).toBe('');
  });
});

describe('obsidianDailyNotesFormat', () => {
  it('没设 / 空串 → Obsidian 缺省 YYYY-MM-DD', () => {
    setHost({});
    expect(obsidianDailyNotesFormat()).toBe(OBSIDIAN_DAILY_NOTES_DEFAULT_FORMAT);
    setHost({ format: '   ' });
    expect(obsidianDailyNotesFormat()).toBe(OBSIDIAN_DAILY_NOTES_DEFAULT_FORMAT);
  });

  it('自定义格式原样返回（含 / 的子目录格式也照收）', () => {
    setHost({ format: 'YYYY/MM/DD' });
    expect(obsidianDailyNotesFormat()).toBe('YYYY/MM/DD');
    setHost({ format: 'YYYY-MM-DD-dddd' });
    expect(obsidianDailyNotesFormat()).toBe('YYYY-MM-DD-dddd');
  });
});
