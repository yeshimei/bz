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
import { setSettingsProvider } from '../../src/core/settings-provider';
import type { SettingsSchema, SettingsRowContext } from '../../src/core/settings-schema';

const NO_CTX = {} as SettingsRowContext;

/** 取「目录」组下指定绑定键的 path 行（找不到直接 fail，不静默跳过） */
function directoryRow(bindingKey: string): { type: 'path'; onChange: (value: string, ctx: SettingsRowContext) => void } {
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

beforeEach(() => {
  // 运行时常量复位（跨用例隔离；config.ts 默认值 = 我的/日记 | 我的/信）
  applyDirectories({});
});

describe('目录设置行 → applyDirectories → 运行时常量（端到端接线）', () => {
  it('目录组含日记/信两行且 onChange 均已接线', () => {
    expect(() => directoryRow('diaryDirectory')).not.toThrow();
    expect(() => directoryRow('letterDirectory')).not.toThrow();
  });

  it('日记目录行 onChange 触发后 DIARY_DIRECTORY 更新为设置值', () => {
    setSettingsProvider(() => ({ diaryDirectory: '备份/日记本', letterDirectory: '我的/信' }) as never);
    // 基线先行：回调前常量仍是默认值（排除「模块加载即生效」的假阳性）
    expect(DIARY_DIRECTORY).toBe('我的/日记');
    // 模拟设置面板提交：行 onChange 回调内部自己走 applyDirectories(getSettings())
    directoryRow('diaryDirectory').onChange('备份/日记本', NO_CTX);
    expect(DIARY_DIRECTORY).toBe('备份/日记本');
  });

  it('同一回调把信件目录一并应用（applyDirectories 双键契约）', () => {
    setSettingsProvider(() => ({ diaryDirectory: '备份/日记本', letterDirectory: '存信/信箱' }) as never);
    directoryRow('diaryDirectory').onChange('备份/日记本', NO_CTX);
    expect(DIARY_DIRECTORY).toBe('备份/日记本');
    expect(LETTER_DIRECTORY).toBe('存信/信箱');
  });

  it('信件目录行 onChange 走同一链路', () => {
    setSettingsProvider(() => ({ diaryDirectory: '我的/日记', letterDirectory: '存信/信箱' }) as never);
    directoryRow('letterDirectory').onChange('存信/信箱', NO_CTX);
    expect(LETTER_DIRECTORY).toBe('存信/信箱');
  });

  it('设置值为空串/缺省时回落默认目录（不落空串）', () => {
    setSettingsProvider(() => ({}) as never);
    directoryRow('diaryDirectory').onChange('', NO_CTX);
    expect(DIARY_DIRECTORY).toBe('我的/日记');
    expect(LETTER_DIRECTORY).toBe('我的/信');
  });
});
