/**
 * 更新日志数据契约测试（issue 472 v2，纯数据层）
 * 被测对象 = scripts/_gen-changelog.mjs 的生成产物 changelog-data.ts：
 * 生成器本身不进插件包，这里钉住产物的形状契约——版本严格递增、首版 1.0.0、
 * 最新版与 manifest.json 一致（单一版本事实源）、唯一 current 标记、
 * 条目为用户视角表达（无 emoji / 无 issue 号 / 长度有界）。
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHANGELOG_RELEASES,
  CHANGELOG_META,
  CHANGELOG_DOMAIN_NAMES,
} from '../../src/settings-panel/changelog-data';

const ROOT = join(__dirname, '../..');

function verCmp(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  return (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]);
}

describe('更新日志数据（changelog-data 生成产物契约 v2）', () => {
  it('版本严格递增、首版 1.0.0、唯一 current 且在末位', () => {
    expect(CHANGELOG_RELEASES.length).toBeGreaterThan(10);
    expect(CHANGELOG_RELEASES[0].version).toBe('1.0.0');
    for (let i = 1; i < CHANGELOG_RELEASES.length; i++) {
      expect(verCmp(CHANGELOG_RELEASES[i].version, CHANGELOG_RELEASES[i - 1].version)).toBeGreaterThan(0);
    }
    const curs = CHANGELOG_RELEASES.filter((r) => r.current);
    expect(curs.length).toBe(1);
    expect(curs[0]).toBe(CHANGELOG_RELEASES[CHANGELOG_RELEASES.length - 1]);
  });

  it('最新版本与 manifest.json 一致（单一版本事实源）', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
    expect(CHANGELOG_META.current).toBe(manifest.version);
    expect(CHANGELOG_RELEASES[CHANGELOG_RELEASES.length - 1].version).toBe(manifest.version);
  });

  it('版本块三段齐备：日期格式合法，区块按新功能→问题修复→体验优化为序由 UI 保证，此处钉字段存在', () => {
    for (const r of CHANGELOG_RELEASES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const sec of ['added', 'fixed', 'improved'] as const) expect(Array.isArray(r[sec])).toBe(true);
    }
  });

  it('条目为用户视角表达：域合法、无 emoji、无 issue/ticket 号、无测试计数、长度有界', () => {
    const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    // 用户要求：一句话表达，分隔只用逗号——加号/箭头/斜杠/间隔点/竖线/顿号不得出现
    const SYMBOL_RE = /[+＋→←↔⇄\/／·•｜|、]/;
    for (const r of CHANGELOG_RELEASES) {
      for (const sec of ['added', 'fixed', 'improved'] as const) {
        for (const it of r[sec]) {
          expect(CHANGELOG_DOMAIN_NAMES[it.domain]).toBeTruthy();
          expect(it.text).not.toMatch(EMOJI_RE);
          expect(it.text).not.toMatch(SYMBOL_RE);
          expect(it.text).not.toMatch(/(issue|ticket)\s*\d+/i);
          expect(it.text.length).toBeGreaterThanOrEqual(4);
          expect(it.text.length).toBeLessThanOrEqual(42);
          if (it.sub !== undefined) {
            expect(it.sub.length).toBeLessThanOrEqual(78);
            expect(it.sub).not.toMatch(EMOJI_RE);
            expect(it.sub).not.toMatch(SYMBOL_RE);
            expect(it.sub).not.toMatch(/\d+\s*新?测试|测试全绿|测试全过/);
          }
        }
      }
    }
  });

  it('META 一致性：current 指向最新版、releases 数与数组等长', () => {
    expect(CHANGELOG_META.current).toBe(CHANGELOG_RELEASES[CHANGELOG_RELEASES.length - 1].version);
    expect(CHANGELOG_META.releases).toBe(CHANGELOG_RELEASES.length);
  });
});
