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
import { parseClampedNumber } from '../../src/core/settings-schema';
import type { SettingsSchema, SettingsSnapshot, SettingsKeyOfType } from '../../src/core/settings-schema';

/** 合成快照（只取 visibleWhen 用到的字段，免造全量设置） */
function snapOf(partial: Partial<SettingsSnapshot>): SettingsSnapshot {
  return partial as SettingsSnapshot;
}

describe('mainSettingsSchema：主设置页区块（issue 331 起 AI 页拆三组）', () => {
  const schema = mainSettingsSchema();

  it('issue 331：五个分组卡片（带 icon）——服务商/模型配置/数据源凭据 + 数据存储路径 + 通知', () => {
    expect(schema.groups.map((g) => g.name)).toEqual(['服务商', '模型配置', '数据源凭据', '数据存储路径', '通知']);
    expect(schema.groups.map((g) => g.icon)).toEqual(['plug-zap', 'cpu', 'key-round', 'folder-open', 'bell']);
  });

  it('服务商组：服务商下拉 + 每家注册表提供商密钥行 + 自定义两行（ticket 171；issue 187 删自定义模型行；visibleWhen 随 aiProvider）', () => {
    const rows = schema.groups[0].rows;
    // 行序 = 服务商下拉 + 注册表非 custom 提供商密钥行（每行 text）+ 自定义端点/密钥（text×2）
    const nonCustom = AI_PROVIDER_REGISTRY.filter((p) => p.id !== 'custom');
    const types = ['select', ...nonCustom.map(() => 'text'), 'text', 'text'];
    expect(rows.map((r) => r.type)).toEqual(types);
    // 密钥行标题来自注册表 apiKeyLabel（顺序与注册表一致）
    const names = rows.map((r) => (r as { name: string }).name);
    const keyNames = nonCustom.map((p) => p.apiKeyLabel);
    expect(names).toEqual([
      'AI 服务商', ...keyNames,
      '自定义 API 地址', '自定义 API 密钥',
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

  it('模型配置组（issue 331 拆组）：模型名称 text（三函数绑定 + 获取模型名按钮）+ 上下文/最大输出 token number（ticket 172）+ 思考档位 select（issue 330）', () => {
    const rows = schema.groups[1].rows as Array<{
      name: string;
      type: string;
      binding?: { key: string } | { get: () => unknown; set: (v: unknown) => void; save: () => unknown };
      visibleWhen?: (s: SettingsSnapshot) => boolean;
      refreshKey?: unknown;
    }>;
    expect(rows.map((r) => r.name)).toEqual(['模型名称', '上下文窗口', '最大输出 token', '思考 reasoning']);
    expect(rows.map((r) => r.type)).toEqual(['text', 'number', 'number', 'select']);
    // 前三行随服务商切换的联动走 refreshKey，跨组生效（issue 331）；思考档位无 refreshKey
    rows.slice(0, 3).forEach((r) => {
      expect(r.visibleWhen).toBeUndefined();
      expect(typeof r.refreshKey).toBe('function');
      expect('key' in r.binding!).toBe(false);
      expect('get' in r.binding!).toBe(true);
    });
    // 模型行内嵌「获取模型名」按钮
    expect((rows[0] as any).actions?.map((a: { text: string }) => a.text)).toEqual(['获取模型名']);
    // 思考档位（issue 330）：key 直绑 aiThinking，五档 options，全局常显
    const thinkingRow = rows[3] as unknown as {
      binding: { key: string };
      visibleWhen?: unknown;
      refreshKey?: unknown;
      options: Array<{ value: string }>;
    };
    expect(thinkingRow.binding).toEqual({ key: 'aiThinking' });
    expect(thinkingRow.visibleWhen).toBeUndefined();
    expect(thinkingRow.refreshKey).toBeUndefined();
    expect(thinkingRow.options.map((o) => o.value)).toEqual(['auto', 'off', 'low', 'medium', 'high']);
  });

  it('数据源凭据组（issue 331 拆组）：B站 Cookie/豆瓣 Cookie 换 textarea，ApiZero Key 保持单行；桌面端 B站行带「从 CLI 导入」', () => {
    const rows = schema.groups[2].rows;
    expect(rows.map((r) => r.type)).toEqual(['textarea', 'text', 'textarea']);
    const [bili, apizero, douban] = rows as Array<{
      name: string;
      binding?: { key: string };
      actions?: Array<{ text: string }>;
      placeholder?: string;
    }>;
    expect([bili.name, apizero.name, douban.name]).toEqual(['B站 Cookie', 'ApiZero Key', '豆瓣 Cookie']);
    expect(bili.binding).toEqual({ key: 'bilibiliCookie' });
    expect(apizero.binding).toEqual({ key: 'cinemaApizeroKey' });
    expect(douban.binding).toEqual({ key: 'cinemaDoubanCookie' });
    // 非桌面（node 环境无 window.require）：CLI 导入按钮不渲染（ADR-0133 零依赖判定口径）
    expect(bili.actions).toEqual([]);
    // 桌面端：按钮在场（textarea 行 actions 与 text 行同口径，issue 331）
    (globalThis as unknown as { window: unknown }).window = { require: () => ({}) };
    try {
      const desktopRows = mainSettingsSchema().groups[2].rows as Array<{ actions?: Array<{ text: string }> }>;
      expect(desktopRows[0].actions?.map((a) => a.text)).toEqual(['从 CLI 导入']);
    } finally {
      delete (globalThis as unknown as { window?: unknown }).window;
    }
  });

  it('数据存储路径区块：path 单选行（键直绑）+ onCommit 提示文案逐字冻结', () => {
    const row = schema.groups[3].rows[0] as {
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

describe('SettingsKeyOfType 键收窄样例', () => {
  it('布尔行接受布尔键（类型层样例，运行时核对键名）', () => {
    const boolKey: SettingsKeyOfType<boolean> = 'useFileDateTime';
    const strKey: SettingsKeyOfType<string> = 'bookshelfFolderPath';
    const numKey: SettingsKeyOfType<number> = 'reviewDailyLimit';
    const listKey: SettingsKeyOfType<string[]> = 'reviewWatchedFolders';
    expect([boolKey, strKey, numKey, listKey]).toEqual([
      'useFileDateTime',
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
