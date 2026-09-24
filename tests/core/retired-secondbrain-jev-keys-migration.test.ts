// @vitest-environment node
/**
 * 第二大脑 / Jev 设置键一次性迁移测试（src/settings.ts，issue 424/ADR-0184）：
 * - migrateRetiredSecondBrainKeys：四个参数键退役——段落最小长度 / 上下文限制（不再限制）、
 *   防抖延迟 / 光标轮询（固化常量）；
 * - migrateRetiredJevKeys：总开关键 + 端点键 + 超时键退役（常开 / 端点由服务商决定 / 超时固定），
 *   旧缺省模型名 jev-1.13.0 → jev-latest（用户自选的模型名保留）。
 * 两函数与 loadData 原始对象就地处理，随后才合并 DEFAULT_SETTINGS；C16 口径：
 * 有旧键（有脏值）即返回 true，调用方据此调度落盘，避免 data.json 残留 + 每次启动重复迁移。
 */
import { describe, it, expect } from 'vitest';
import { migrateRetiredSecondBrainKeys, migrateRetiredJevKeys } from '../../src/settings';

describe('migrateRetiredSecondBrainKeys · issue 424/ADR-0184（四参数键退役）', () => {
  it('四键存在 → 一并删除并返回 true；其余第二大脑键不动', () => {
    const raw: Record<string, unknown> = {
      secondBrainChunkMinLength: '50',
      secondBrainContextLimit: '600',
      secondBrainDebounceDelay: '300',
      secondBrainCursorPollInterval: '500',
      secondBrainAllowPaths: '我的/笔记',
      secondBrainMaxHistory: '10',
    };
    expect(migrateRetiredSecondBrainKeys(raw)).toBe(true);
    expect(Object.keys(raw)).toEqual(['secondBrainAllowPaths', 'secondBrainMaxHistory']);
  });

  it('无旧键 → 不改动返回 false（幂等，不重复落盘）', () => {
    expect(migrateRetiredSecondBrainKeys({ secondBrainMaxHistory: '10' })).toBe(false);
    expect(migrateRetiredSecondBrainKeys({})).toBe(false);
    expect(migrateRetiredSecondBrainKeys(null)).toBe(false);
    expect(migrateRetiredSecondBrainKeys(undefined)).toBe(false);
    expect(migrateRetiredSecondBrainKeys('字符串')).toBe(false);
  });

  it('幂等：迁移后的对象再跑一遍不改动', () => {
    const raw: Record<string, unknown> = { secondBrainContextLimit: '600', secondBrainTopK: '20' };
    expect(migrateRetiredSecondBrainKeys(raw)).toBe(true);
    const snapshot = JSON.parse(JSON.stringify(raw));
    expect(migrateRetiredSecondBrainKeys(raw)).toBe(false);
    expect(raw).toEqual(snapshot);
  });
});

describe('migrateRetiredJevKeys · issue 424/ADR-0184（Jev 常开 + 端点/超时退役）', () => {
  it('三键删除 + 旧缺省模型名改写为 jev-latest', () => {
    const raw: Record<string, unknown> = {
      jevEnabled: true,
      jevEndpoint: 'https://api.typesafe.ai/v1/systemone',
      jevTimeoutMs: 10000,
      jevApiKey: 'sk-x',
      jevModel: 'jev-1.13.0',
    };
    expect(migrateRetiredJevKeys(raw)).toBe(true);
    expect(Object.keys(raw).sort()).toEqual(['jevApiKey', 'jevModel']);
    expect(raw.jevModel).toBe('jev-latest');
  });

  it('用户自选的模型名保留（只改插件旧缺省那一枚）', () => {
    const raw: Record<string, unknown> = { jevModel: 'jev-preview' };
    expect(migrateRetiredJevKeys(raw)).toBe(false);
    expect(raw.jevModel).toBe('jev-preview');
  });

  it('无旧键 → 不改动返回 false（幂等）', () => {
    expect(migrateRetiredJevKeys({ jevApiKey: 'sk-x' })).toBe(false);
    expect(migrateRetiredJevKeys({ jevModel: 'jev-latest' })).toBe(false);
    expect(migrateRetiredJevKeys({})).toBe(false);
    expect(migrateRetiredJevKeys(null)).toBe(false);
    expect(migrateRetiredJevKeys(undefined)).toBe(false);
    expect(migrateRetiredJevKeys(42)).toBe(false);
  });

  it('幂等：迁移后的对象再跑一遍不改动', () => {
    const raw: Record<string, unknown> = { jevEnabled: false, jevModel: 'jev-1.13.0' };
    expect(migrateRetiredJevKeys(raw)).toBe(true);
    const snapshot = JSON.parse(JSON.stringify(raw));
    expect(migrateRetiredJevKeys(raw)).toBe(false);
    expect(raw).toEqual(snapshot);
  });
});
