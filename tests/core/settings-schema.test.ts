// @vitest-environment node
/**
 * 声明式设置 schema 数据层测试（ticket 131，ADR-0064）：主设置页 schema 结构与 visibleWhen 口径 /
 * 存储路径 onCommit 文案冻结 / 通用组预设（移动端默认全屏）结构与 isMobileEnv 联动 /
 * 数字钳制纯函数 / SettingsKeyOfType 键收窄样例。node 环境（不触 DOM）。
 */
import { describe, it, expect } from 'vitest';
import { Platform } from '../mock-obsidian-entry';
import { mainSettingsSchema, STORAGE_PATH_COMMIT_NOTICE } from '../../src/core/settings-main-schema';
import { AI_PROVIDER_REGISTRY } from '../../src/core/ai';
import {
  mobileFullscreenGroup,
  mobileFullscreenRow,
} from '../../src/core/settings-common';
import { parseClampedNumber } from '../../src/core/settings-schema';
import type { SettingsSchema, SettingsSnapshot, SettingsKeyOfType } from '../../src/core/settings-schema';

/** 合成快照（只取 visibleWhen 用到的字段，免造全量设置） */
function snapOf(partial: Partial<SettingsSnapshot>): SettingsSnapshot {
  return partial as SettingsSnapshot;
}

describe('mainSettingsSchema：主设置页两区块', () => {
  const schema = mainSettingsSchema();

  it('ticket 170：两区块升级为分组卡片（带 icon），标题不带 emoji 前缀（emoji 由分组卡图标呈现，防两遍）', () => {
    expect(schema.groups.map((g) => g.name)).toEqual(['AI', '采样参数', '数据存储路径']);
    expect(schema.groups.map((g) => g.icon)).toEqual(['sparkles', 'sliders-horizontal', 'folder-open']);
  });

  it('AI 区块：服务商下拉 + 每家注册表提供商密钥行 + 自定义两行 + per-provider 配置三行（ticket 171/172；issue 187 删自定义模型行）', () => {
    const rows = schema.groups[0].rows;
    // 行序 = 服务商下拉 + 注册表非 custom 提供商密钥行（每行 text）+ 自定义端点/密钥（text×2）
    //         + per-provider 配置三行（模型 custom；上下文/最大输出 token 标准 number）
    const nonCustom = AI_PROVIDER_REGISTRY.filter((p) => p.id !== 'custom');
    const types = ['select', ...nonCustom.map(() => 'text'), 'text', 'text', 'custom', 'number', 'number'];
    expect(rows.map((r) => r.type)).toEqual(types);
    // 密钥行标题来自注册表 apiKeyLabel（含 deepseek/opencode-go，顺序与注册表一致）
    const names = rows.map((r) => (r as { name: string }).name);
    const keyNames = nonCustom.map((p) => p.apiKeyLabel);
    expect(names).toEqual([
      'AI 服务商', ...keyNames,
      '自定义 API 地址', '自定义 API 密钥',
      '模型名称', '上下文窗口', '最大输出 token',
    ]);
    const [provider, ...rest] = rows as Array<{
      binding?: { key: string };
      visibleWhen?: (s: SettingsSnapshot) => boolean;
    }>;
    expect(provider.binding).toEqual({ key: 'aiProvider' });
    // 注册表每家的密钥行：键直绑 apiKeyKey + visibleWhen 跟随 aiProvider
    nonCustom.forEach((p, i) => {
      expect(rest[i].binding).toEqual({ key: p.apiKeyKey });
      expect(rest[i].visibleWhen!(snapOf({ aiProvider: p.id }))).toBe(true);
      expect(rest[i].visibleWhen!(snapOf({ aiProvider: 'custom' }))).toBe(false);
    });
    // 自定义两行（端点/密钥；issue 187 起模型统一走「模型名称」行）
    const [customEndpoint, customKey] = rest.slice(nonCustom.length) as Array<{
      binding?: { key: string };
      visibleWhen?: (s: SettingsSnapshot) => boolean;
    }>;
    expect(customEndpoint.binding).toEqual({ key: 'aiCustomEndpoint' });
    expect(customKey.binding).toEqual({ key: 'aiCustomApiKey' });
    // per-provider 配置三行：模型行 custom（无 key 直绑，常显）；上下文/最大输出 token 标准 number 行
    const [modelRow, ctxRow, maxTokensRow] = rest.slice(nonCustom.length + 2) as Array<{
      name: string;
      type: string;
      binding?: { key: string } | { get: () => unknown; set: (v: unknown) => void; save: () => unknown };
      visibleWhen?: (s: SettingsSnapshot) => boolean;
    }>;
    expect([modelRow.name, ctxRow.name, maxTokensRow.name]).toEqual(['模型名称', '上下文窗口', '最大输出 token']);
    expect([modelRow.type, ctxRow.type, maxTokensRow.type]).toEqual(['custom', 'number', 'number']);
    expect(modelRow.visibleWhen!(snapOf({ aiProvider: 'deepseek' }))).toBe(true); // 常显
    // 标准 number 行：三函数 binding（读写当前 provider 覆盖）+ 无 key 直绑
    expect('key' in ctxRow.binding!).toBe(false);
    expect('get' in ctxRow.binding!).toBe(true);
    expect(ctxRow.visibleWhen).toBeUndefined();
    // 显隐（ticket 170/171）：deepseek 显示 DeepSeek 行；opencode-go 显示 OpenCode 行；custom 显示自定义两行
    const findKey = (key: string) => {
      const idx = nonCustom.findIndex((p) => p.apiKeyKey === key);
      return rest[idx].visibleWhen!;
    };
    const dv = findKey('deepseekApiKey');
    const ov = findKey('opencodeGoApiKey');
    const cev = customEndpoint.visibleWhen!;
    expect(dv(snapOf({ aiProvider: 'deepseek' }))).toBe(true);
    expect(ov(snapOf({ aiProvider: 'deepseek' }))).toBe(false);
    expect(cev(snapOf({ aiProvider: 'deepseek' }))).toBe(false);
    expect(dv(snapOf({ aiProvider: 'opencode-go' }))).toBe(false);
    expect(ov(snapOf({ aiProvider: 'opencode-go' }))).toBe(true);
    expect(cev(snapOf({ aiProvider: 'opencode-go' }))).toBe(false);
    expect(dv(snapOf({ aiProvider: 'custom' }))).toBe(false);
    expect(ov(snapOf({ aiProvider: 'custom' }))).toBe(false);
    expect(cev(snapOf({ aiProvider: 'custom' }))).toBe(true);
    // 每家提供商密钥行互斥显隐（选 A 不显示 B）
    const openaiVw = findKey('openaiApiKey');
    expect(openaiVw(snapOf({ aiProvider: 'openai' }))).toBe(true);
    expect(openaiVw(snapOf({ aiProvider: 'deepseek' }))).toBe(false);
  });

  it('数据存储路径区块：path 单选行（键直绑）+ onCommit 提示文案逐字冻结', () => {
    const row = schema.groups[2].rows[0] as {
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
  it('行结构：toggle + 键直绑 + 名称冻结；ticket 170 起所有域统一无描述', () => {
    const row = mobileFullscreenRow('diaryMobileDefaultFullscreen') as unknown as Record<string, unknown>;
    expect(row.type).toBe('toggle');
    expect(row.name).toBe('移动端默认全屏');
    expect(row.binding).toEqual({ key: 'diaryMobileDefaultFullscreen' });
    expect(row.desc).toBeUndefined();
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

  it('desc 覆盖：传非空字符串 = 覆盖；传空串或不传 = 无描述（ticket 170 全域统一）', () => {
    const overridden = mobileFullscreenRow('belongingsMobileDefaultFullscreen', {
      desc: '移动端打开主窗口时默认全屏显示（≤768px；关=常规卡）',
    }) as { desc?: string };
    expect(overridden.desc).toBe('移动端打开主窗口时默认全屏显示（≤768px；关=常规卡）');
    const empty = mobileFullscreenRow('secondBrainMobileDefaultFullscreen', { desc: '' }) as { desc?: string };
    expect(empty.desc).toBeUndefined();
    const none = mobileFullscreenRow('memoMobileDefaultFullscreen') as { desc?: string };
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
    const strKey: SettingsKeyOfType<string> = 'bookshelfFolderPath';
    const numKey: SettingsKeyOfType<number> = 'reviewDailyLimit';
    const listKey: SettingsKeyOfType<string[]> = 'reviewWatchedFolders';
    expect([boolKey, strKey, numKey, listKey]).toEqual([
      'encryptMobileDefaultFullscreen',
      'bookshelfFolderPath',
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
