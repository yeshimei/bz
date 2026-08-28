// @vitest-environment node
/**
 * 声明式设置 schema 数据层测试（ticket 131，ADR-0064）：主设置页 schema 结构与 visibleWhen 口径 /
 * 存储路径 onCommit 文案冻结 / 通用组预设（移动端默认全屏）结构与 isMobileEnv 联动 /
 * 数字钳制纯函数 / SettingsKeyOfType 键收窄样例。node 环境（不触 DOM）。
 */
import { describe, it, expect } from 'vitest';
import { Platform } from '../mock-obsidian-entry';
import { mainSettingsSchema, STORAGE_PATH_COMMIT_NOTICE } from '../../src/core/settings-main-schema';
import {
  mobileFullscreenGroup,
  mobileFullscreenRow,
  MOBILE_FULLSCREEN_DESC,
} from '../../src/core/settings-common';
import { parseClampedNumber } from '../../src/core/settings-schema';
import type { SettingsSchema, SettingsSnapshot, SettingsKeyOfType } from '../../src/core/settings-schema';

/** 合成快照（只取 visibleWhen 用到的字段，免造全量设置） */
function snapOf(partial: Partial<SettingsSnapshot>): SettingsSnapshot {
  return partial as SettingsSnapshot;
}

describe('mainSettingsSchema：主设置页两区块', () => {
  const schema = mainSettingsSchema();

  it('两区块均为无 icon 分组（区块标题平铺形态），标题 DOM 契约保持', () => {
    expect(schema.groups.map((g) => g.name)).toEqual(['🤖 AI', '📂 数据存储路径']);
    expect(schema.groups.every((g) => g.icon === undefined)).toBe(true);
  });

  it('AI 区块：服务商下拉（键直绑）+ 两个密钥行（visibleWhen 互斥显隐）', () => {
    const rows = schema.groups[0].rows;
    expect(rows.map((r) => r.type)).toEqual(['select', 'text', 'text']);
    expect(rows.map((r) => (r as { name: string }).name)).toEqual(['AI 服务商', 'DeepSeek 密钥', 'OpenCode 密钥']);
    const [provider, deepseek, opencode] = rows as Array<{
      binding?: { key: string };
      visibleWhen?: (s: SettingsSnapshot) => boolean;
    }>;
    expect(provider.binding).toEqual({ key: 'aiProvider' });
    expect(deepseek.binding).toEqual({ key: 'deepseekApiKey' });
    expect(opencode.binding).toEqual({ key: 'opencodeGoApiKey' });
    // 与原 main.ts refreshKeys 口径等价：deepseek 显示 DeepSeek 行，其余显示 OpenCode 行
    const dv = deepseek.visibleWhen!;
    const ov = opencode.visibleWhen!;
    expect(dv(snapOf({ aiProvider: 'deepseek' }))).toBe(true);
    expect(ov(snapOf({ aiProvider: 'deepseek' }))).toBe(false);
    expect(dv(snapOf({ aiProvider: 'opencode-go' }))).toBe(false);
    expect(ov(snapOf({ aiProvider: 'opencode-go' }))).toBe(true);
    expect(ov(snapOf({ aiProvider: '其他值' }))).toBe(true); // 非 deepseek 一律 OpenCode 行（原口径）
  });

  it('数据存储路径区块：path 单选行（键直绑）+ onCommit 提示文案逐字冻结', () => {
    const row = schema.groups[1].rows[0] as {
      type: string;
      mode: string;
      name: string;
      binding: { key: string };
      onCommit?: () => void;
    };
    expect(row.type).toBe('path');
    expect(row.mode).toBe('single');
    expect(row.name).toBe('数据存储路径');
    expect(row.binding).toEqual({ key: 'storagePath' });
    expect(typeof row.onCommit).toBe('function');
    expect(STORAGE_PATH_COMMIT_NOTICE).toBe(
      '存储路径已修改：仅改路径，文件不会自动迁移，旧数据需自行迁移；重载插件后生效。'
    );
  });
});

describe('settings-common：移动端默认全屏预设', () => {
  it('行结构：toggle + 键直绑 + 名称冻结；缺省描述 = 13 处手写块多数派逐字文案', () => {
    const row = mobileFullscreenRow('diaryMobileDefaultFullscreen') as unknown as Record<string, unknown>;
    expect(row.type).toBe('toggle');
    expect(row.name).toBe('移动端默认全屏');
    expect(row.binding).toEqual({ key: 'diaryMobileDefaultFullscreen' });
    expect(row.desc).toBe(MOBILE_FULLSCREEN_DESC);
    expect(MOBILE_FULLSCREEN_DESC).toBe('移动端打开主窗口时默认全屏，关闭则显示常规卡片');
  });

  it('visibleWhen：桌面端隐藏、移动端显示（Platform.isMobile 口径）', () => {
    const row = mobileFullscreenRow('memoMobileDefaultFullscreen') as {
      visibleWhen: (s: SettingsSnapshot) => boolean;
    };
    const prev = Platform.isMobile;
    try {
      Platform.isMobile = false;
      expect(row.visibleWhen(snapOf({}))).toBe(false);
      Platform.isMobile = true;
      expect(row.visibleWhen(snapOf({}))).toBe(true);
    } finally {
      Platform.isMobile = prev;
    }
  });

  it('desc 覆盖：现网变体逐字对齐；空串 = 无描述（secondbrain 现状）', () => {
    const overridden = mobileFullscreenRow('belongingsMobileDefaultFullscreen', {
      desc: '移动端打开主窗口时默认全屏显示（≤768px；关=常规卡）',
    }) as { desc?: string };
    expect(overridden.desc).toBe('移动端打开主窗口时默认全屏显示（≤768px；关=常规卡）');
    const none = mobileFullscreenRow('secondBrainMobileDefaultFullscreen', { desc: '' }) as { desc?: string };
    expect(none.desc).toBeUndefined();
  });

  it('组预设：移动端卡片（icon smartphone），内挂单行；组级门控 = 仅移动端整组可见', () => {
    const g = mobileFullscreenGroup('pomodoroMobileDefaultFullscreen');
    expect(g.icon).toBe('smartphone');
    expect(g.name).toBe('移动端');
    expect(g.rows.length).toBe(1);
    expect((g.rows[0] as { name: string }).name).toBe('移动端默认全屏');
    const gv = g.visibleWhen as (s: SettingsSnapshot) => boolean;
    const prev = Platform.isMobile;
    try {
      Platform.isMobile = false;
      expect(gv(snapOf({}))).toBe(false);
      Platform.isMobile = true;
      expect(gv(snapOf({}))).toBe(true);
    } finally {
      Platform.isMobile = prev;
    }
  });

  it('SettingsKeyOfType 收窄：布尔行接受布尔键（类型层样例，运行时核对键名）', () => {
    const boolKey: SettingsKeyOfType<boolean> = 'encryptMobileDefaultFullscreen';
    const strKey: SettingsKeyOfType<string> = 'bookTag';
    const numKey: SettingsKeyOfType<number> = 'reviewDailyLimit';
    const listKey: SettingsKeyOfType<string[]> = 'reviewWatchedFolders';
    expect([boolKey, strKey, numKey, listKey]).toEqual([
      'encryptMobileDefaultFullscreen',
      'bookTag',
      'reviewDailyLimit',
      'reviewWatchedFolders',
    ]);
  });
});

describe('parseClampedNumber：数字解析与钳制', () => {
  it('常规解析、min/max 钳制、脏值拒绝', () => {
    expect(parseClampedNumber('5')).toBe(5);
    expect(parseClampedNumber('3.5')).toBe(3.5);
    expect(parseClampedNumber(' 8 ')).toBe(8);
    expect(parseClampedNumber('999', 0, 100)).toBe(100);
    expect(parseClampedNumber('-5', 0)).toBe(0);
    expect(parseClampedNumber('200', 0, 100)).toBe(100);
    expect(parseClampedNumber('abc')).toBeNull();
    expect(parseClampedNumber('')).toBeNull();
    expect(parseClampedNumber('   ')).toBeNull();
    expect(parseClampedNumber('Infinity')).toBeNull();
  });
});

describe('空 schema 与未知绑定形态', () => {
  it('groups 为空的 schema 结构合法（渲染层行为由 UI 测试覆盖）', () => {
    const schema: SettingsSchema = { groups: [] };
    expect(schema.groups.length).toBe(0);
  });
});
