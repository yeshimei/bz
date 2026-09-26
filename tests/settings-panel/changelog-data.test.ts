/**
 * 更新日志数据契约测试（issue 472，纯数据层）
 * 被测对象 = scripts/_gen-changelog.mjs 的生成产物 changelog-data.ts：
 * 生成器本身不进插件包，这里钉住产物的形状契约——域唯一非空、日期倒序、
 * 类型枚举、issue/ticket 号前缀已剥、META.total 与条目总数一致。
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CHANGELOG_DOMAINS, CHANGELOG_META } from '../../src/settings-panel/changelog-data';

describe('更新日志数据（changelog-data 生成产物契约）', () => {
  it('域唯一且非空，域内条目按日期倒序', () => {
    expect(CHANGELOG_DOMAINS.length).toBeGreaterThan(20);
    const ids = CHANGELOG_DOMAINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of CHANGELOG_DOMAINS) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.entries.length).toBeGreaterThan(0);
      for (let i = 1; i < d.entries.length; i++) {
        expect(d.entries[i - 1].date >= d.entries[i].date).toBe(true);
      }
    }
  });

  it('条目字段契约：日期格式 / 类型枚举 / 文本非空且已剥 issue 号前缀', () => {
    const types = new Set(['feat', 'fix', 'perf']);
    for (const d of CHANGELOG_DOMAINS) {
      for (const e of d.entries) {
        expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(types.has(e.type)).toBe(true);
        expect(e.text.length).toBeGreaterThanOrEqual(8);
        expect(e.text).not.toMatch(/^(issue|ticket)\s*\d+/i);
      }
    }
  });

  it('META.total 与各域条目总数一致', () => {
    expect(CHANGELOG_META.total).toBe(CHANGELOG_DOMAINS.reduce((n, d) => n + d.entries.length, 0));
  });
});
