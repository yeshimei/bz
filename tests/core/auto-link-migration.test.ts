// @vitest-environment node
/**
 * ADR-0141 onload 一次性迁移测试（migrateAutoLinkSettings，src/settings.ts）：
 * - `linkAgentScopes` 键退役（删旧值，不平移）；
 * - `secondBrainAllowPaths` 里的三盒条目剔除（三盒已恒含索引，留着会被当成「额外检索目录」）；
 * - 幂等：无旧键 / 无冗余条目即不改动（调用方据此决定是否落盘，C16 口径同 memo 迁移）。
 */
import { describe, it, expect } from 'vitest';
import { migrateAutoLinkSettings } from '../../src/settings';

const boxes = { knowledgeDirectory: '文献盒', knowledgeCardboxDirectory: '卡片盒', knowledgeTopicDirectory: '主题盒' };

describe('migrateAutoLinkSettings', () => {
  it('linkAgentScopes 退役：删键且不产生新键（旧值「文献盒」直接丢，范围恒为三盒）', () => {
    const raw: Record<string, unknown> = { ...boxes, linkAgentScopes: '文献盒' };
    expect(migrateAutoLinkSettings(raw)).toBe(true);
    expect('linkAgentScopes' in raw).toBe(false);
    expect(raw.linkAgentScopes).toBeUndefined();
  });

  it('白名单里的三盒条目剔除，额外目录保留（顺序保持）', () => {
    const raw: Record<string, unknown> = { ...boxes, secondBrainAllowPaths: '文献盒,卡片盒,主题盒,归档/网页剪藏' };
    expect(migrateAutoLinkSettings(raw)).toBe(true);
    expect(raw.secondBrainAllowPaths).toBe('归档/网页剪藏');
  });

  it('白名单全是三盒条目 → 清成空串（不是删键：键语义还在，只是没有额外目录）', () => {
    const raw: Record<string, unknown> = { ...boxes, secondBrainAllowPaths: '文献盒' };
    expect(migrateAutoLinkSettings(raw)).toBe(true);
    expect(raw.secondBrainAllowPaths).toBe('');
  });

  it('白名单无三盒条目 → 不动（含空串与纯额外目录）', () => {
    const a: Record<string, unknown> = { ...boxes, secondBrainAllowPaths: '' };
    const b: Record<string, unknown> = { ...boxes, secondBrainAllowPaths: '归档/网页剪藏' };
    expect(migrateAutoLinkSettings(a)).toBe(false);
    expect(a.secondBrainAllowPaths).toBe('');
    expect(migrateAutoLinkSettings(b)).toBe(false);
    expect(b.secondBrainAllowPaths).toBe('归档/网页剪藏');
  });

  it('盒子目录改了：新盒名才被剔除（旧的盒名条目当额外目录保留，不悄悄丢用户配置）', () => {
    const raw: Record<string, unknown> = {
      ...boxes,
      knowledgeCardboxDirectory: '卡片盒2',
      secondBrainAllowPaths: '卡片盒2,卡片盒',
    };
    expect(migrateAutoLinkSettings(raw)).toBe(true);
    expect(raw.secondBrainAllowPaths).toBe('卡片盒');
  });

  it('幂等：跑第二遍不再改动（返回 false，调用方无需重复落盘）', () => {
    const raw: Record<string, unknown> = { ...boxes, linkAgentScopes: '文献盒', secondBrainAllowPaths: '文献盒,归档/网页剪藏' };
    expect(migrateAutoLinkSettings(raw)).toBe(true);
    const snapshot = JSON.stringify(raw);
    expect(migrateAutoLinkSettings(raw)).toBe(false);
    expect(JSON.stringify(raw)).toBe(snapshot);
    expect(raw.secondBrainAllowPaths).toBe('归档/网页剪藏');
  });

  it('两个键都不存在 / 非对象入参：不改动、不抛错', () => {
    expect(migrateAutoLinkSettings({ ...boxes })).toBe(false);
    expect(migrateAutoLinkSettings(null)).toBe(false);
    expect(migrateAutoLinkSettings(undefined)).toBe(false);
    expect(migrateAutoLinkSettings('字符串')).toBe(false);
  });
});
