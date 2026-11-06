// @vitest-environment node
/**
 * 日记本（diary）· 设置联动端到端（review-deep diary-arch 测试缺口 3）
 *
 * 链路：diarySettingsSchema 目录行 onChange → applyDirectories(getSettings()) →
 * DIARY_DIRECTORY / LETTER_DIRECTORY 运行时可变常量更新（src/diary/config.ts export let）。
 * 此前只有 applyDirectories 直测（tests/diary/config.test.ts）与 schema 键存在性检查
 * （tests/settings-panel.test.ts），「接线本身」无断言——有人把目录行 onChange 删空或改错
 * 通道时无测试报警，本文件钉死接线。
 *
 * 环境 node：settings.ts 依赖链（core/settings-schema 声明面）无 DOM 执行
 * （同 tests/core/settings-copy-lint-a.test.ts 已验）。
 * 注意：ESM export let 为活绑定，直接 import 常量断言即为「运行时值」，与 config.test.ts 同款。
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { diarySettingsSchema } from '../../src/diary/settings';
import { applyDirectories, DIARY_DIRECTORY, LETTER_DIRECTORY } from '../../src/diary/config';
import { invalidateWallCache, loadWallEntries, wallCacheFresh } from '../../src/diary/data';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import type { SettingsSchema, SettingsRowContext } from '../../src/core/settings-schema';
import { MockVault, mockAppWithVault } from '../mock-vault';

const NO_CTX = {} as SettingsRowContext;

/** 取「目录」组下指定绑定键的 path 行（找不到直接 fail，不静默跳过） */
function directoryRow(bindingKey: string): {
  type: 'path';
  onChange: (value: string, ctx: SettingsRowContext) => void;
  fallbackValue?: () => string;
} {
  const schema: SettingsSchema = diarySettingsSchema();
  const group = schema.groups.find((g) => g.name === '目录');
  if (!group) throw new Error('diarySettingsSchema 缺少「目录」组——设置结构漂移');
  const row = group.rows.find((r) => (r as { type?: string }).type === 'path' && (r as { binding?: { key?: string } }).binding?.key === bindingKey) as
    | { type: 'path'; onChange?: (value: string, ctx: SettingsRowContext) => void }
    | undefined;
  if (!row) throw new Error(`diarySettingsSchema「目录」组缺少绑定键 ${bindingKey} 的 path 行`);
  if (typeof row.onChange !== 'function') throw new Error(`目录行 ${bindingKey} 的 onChange 未接线`);
  return row as { type: 'path'; onChange: (value: string, ctx: SettingsRowContext) => void };
}

/** 取「显示」组下指定绑定键的 toggle 行（找不到 / 没接 onChange 直接 fail） */
function displayToggleRow(bindingKey: string): {
  type: 'toggle';
  onChange: (value: boolean, ctx: SettingsRowContext) => void;
} {
  const group = diarySettingsSchema().groups.find((g) => g.name === '显示');
  if (!group) throw new Error('diarySettingsSchema 缺少「显示」组——设置结构漂移');
  const row = group.rows.find(
    (r) => (r as { type?: string }).type === 'toggle' && (r as { binding?: { key?: string } }).binding?.key === bindingKey
  ) as { type: 'toggle'; onChange?: (value: boolean, ctx: SettingsRowContext) => void } | undefined;
  if (!row) throw new Error(`diarySettingsSchema「显示」组缺少绑定键 ${bindingKey} 的 toggle 行`);
  if (typeof row.onChange !== 'function') throw new Error(`toggle 行 ${bindingKey} 的 onChange 未接线`);
  return row as { type: 'toggle'; onChange: (value: boolean, ctx: SettingsRowContext) => void };
}

beforeEach(() => {
  // 运行时常量复位（跨用例隔离；config.ts 默认值 = 我的/日记 | 我的/信）
  applyDirectories({ diaryEntryFormat: 'entry' });
});

describe('目录设置行 → applyDirectories → 运行时常量（端到端接线）', () => {
  it('目录组只有日记文件夹一行，信件文件夹行已隐藏', () => {
    expect(() => directoryRow('diaryDirectory')).not.toThrow();
    const group = diarySettingsSchema().groups.find((g) => g.name === '目录')!;
    const keys = group.rows
      .filter((r) => (r as { type?: string }).type === 'path')
      .map((r) => (r as { binding?: { key?: string } }).binding?.key);
    expect(keys).toEqual(['diaryDirectory']);
  });

  it('日记目录行 onChange 触发后 DIARY_DIRECTORY 更新为设置值', () => {
    setSettingsProvider(() => ({ diaryDirectory: '备份/日记本', letterDirectory: '我的/信' }) as never);
    // 基线先行：回调前常量仍是默认值（排除「模块加载即生效」的假阳性）
    expect(DIARY_DIRECTORY).toBe('我的/日记');
    // 模拟设置面板提交：行 onChange 回调内部自己走 applyDirectories(getSettings())
    directoryRow('diaryDirectory').onChange('备份/日记本', NO_CTX);
    expect(DIARY_DIRECTORY).toBe('备份/日记本');
  });

  it('信件行隐藏但键仍生效：日记行回调把 letterDirectory 一并应用（applyDirectories 双键契约）', () => {
    setSettingsProvider(() => ({ diaryDirectory: '备份/日记本', letterDirectory: '存信/信箱' }) as never);
    directoryRow('diaryDirectory').onChange('备份/日记本', NO_CTX);
    expect(DIARY_DIRECTORY).toBe('备份/日记本');
    expect(LETTER_DIRECTORY).toBe('存信/信箱');
  });

  it('设置值为空串/缺省时回落默认目录（不落空串）', () => {
    setSettingsProvider(() => ({}) as never);
    directoryRow('diaryDirectory').onChange('', NO_CTX);
    expect(DIARY_DIRECTORY).toBe('我的/日记');
    expect(LETTER_DIRECTORY).toBe('我的/信');
  });

  /* 2026-11-05 用户重装后报「设置里空着，看不出到底跟到了哪个文件夹」：
     空值时行内要挂一枚锁定 chip，显示 Obsidian 日记的实际目录（只展示、不落盘）。 */
  it('留空时 fallbackValue 指向 Obsidian 日记目录（设置行显示「跟随到哪」）', () => {
    const app = mockAppWithVault(new MockVault());
    (app as any).internalPlugins.getPluginById = (id: string) =>
      id === 'daily-notes' ? { instance: { options: { folder: '日记' } } } : null;
    setApp(app as never);
    const row = directoryRow('diaryDirectory');
    expect(typeof row.fallbackValue).toBe('function');
    expect(row.fallbackValue?.()).toBe('日记');
  });
});

describe('「收录影院/收录书库」开关 → 墙缓存失效（不依赖日记本 UI 订阅）', () => {
  it('两个 toggle 的 onChange 都立即作废 wallCache：日记本关着改设置，下次开册也不会命中旧聚合', async () => {
    const vault = new MockVault();
    vault.files.set(
      '我的/日记/2401010800.md',
      serializeDiaryEntryFile({ date: '2024-01-01', time: '08:00' }, ['日记'], '一条日记')
    );
    const app = mockAppWithVault(vault);
    setApp(app as never);
    applyDirectories({ diaryDirectory: '我的/日记', diaryEntryFormat: 'entry' });
    setSettingsProvider(() => ({ diaryPageSize: 20 }) as never);
    try {
      await loadWallEntries(app as never);
      expect(wallCacheFresh(app as never)).toBe(true);

      // 影院开关：onChange 同步作废（不等 150ms 的合并广播）
      displayToggleRow('diaryShowCinema').onChange(false, NO_CTX);
      expect(wallCacheFresh(app as never)).toBe(false);

      // 书库开关同样：重新读盘建立缓存后再切，仍立即失效
      await loadWallEntries(app as never);
      expect(wallCacheFresh(app as never)).toBe(true);
      displayToggleRow('diaryShowBookshelf').onChange(false, NO_CTX);
      expect(wallCacheFresh(app as never)).toBe(false);
    } finally {
      invalidateWallCache();
      setSettingsProvider(() => ({}) as never);
    }
  });
});
