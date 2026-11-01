// @vitest-environment node
/**
 * 内置更新日志数据（core/changelog-data.ts，2026-11-02）
 *
 * 口径：升级提示小窗的数据不再下载远端日志，而是内置进包。这里钉三件事：
 *  - 匹配是**全等**（v 前缀归一），找不到就返回 null——绝不「就近取一条」；
 *  - 内置数据**新在前、最多 50 版、版本不重**（小窗全列，靠这个顺序排版）；
 *  - 内置数据里必须有 manifest.json 那个版本（发版时漏加 = 这版不弹提示）；
 *  - 三段的条目数按 added/improved/fixed 求和。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHANGELOG_RELEASES,
  pickReleaseFor,
  releaseEntryCount,
  type ChangelogRelease,
} from '../../src/core/changelog-data';
import { compareVersions, normalizeVersion } from '../../src/core/version';

const rel = (over: Partial<ChangelogRelease> = {}): ChangelogRelease => ({
  version: '1.2.3',
  ...over,
});

describe('pickReleaseFor：只认完全相等的那一条', () => {
  const list = [rel({ version: '1.2.3' }), rel({ version: '1.2.2' }), rel({ version: '1.1.0' })];

  it('版本号相等就取到', () => {
    expect(pickReleaseFor(list, '1.2.3')?.version).toBe('1.2.3');
  });

  it('带不带前导 v 都算同一个版本', () => {
    expect(pickReleaseFor(list, 'v1.2.3')?.version).toBe('1.2.3');
    expect(pickReleaseFor([rel({ version: 'v1.2.3' })], '1.2.3')?.version).toBe('v1.2.3');
  });

  it('找不到就给 null，不就近取「最新那条」（这是「弹上一版内容」的老坑）', () => {
    expect(pickReleaseFor(list, '1.2.4')).toBeNull();
    expect(pickReleaseFor(list, '0.9.0')).toBeNull();
  });

  it('空版本号给 null', () => {
    expect(pickReleaseFor(list, '')).toBeNull();
    expect(pickReleaseFor(list, '   ')).toBeNull();
  });
});

describe('releaseEntryCount', () => {
  it('三段求和', () => {
    expect(
      releaseEntryCount(
        rel({ added: [{ domain: 'a', text: 'x' }], improved: [{ domain: 'b', text: 'y' }], fixed: [] }),
      ),
    ).toBe(2);
  });

  it('缺段按 0', () => {
    expect(releaseEntryCount(rel())).toBe(0);
  });
});

describe('版本比较（core/version）', () => {
  it('归一去掉前导 v 与空白', () => {
    expect(normalizeVersion(' v1.39.1 ')).toBe('1.39.1');
  });

  it('逐段比大小；段数不同时缺段按 0', () => {
    expect(compareVersions('1.39.1', '1.39.0')).toBe(1);
    expect(compareVersions('1.39.0', '1.39.1')).toBe(-1);
    expect(compareVersions('1.40', '1.39.9')).toBe(1);
    expect(compareVersions('1.39', '1.39.0')).toBe(0);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1); // 按数字比，不是按字典序
  });
});

describe('内置数据的形状（小窗直接按数组顺序全列）', () => {
  it('新的在前：版本号严格递减', () => {
    for (let i = 1; i < CHANGELOG_RELEASES.length; i++) {
      expect(
        compareVersions(CHANGELOG_RELEASES[i - 1].version, CHANGELOG_RELEASES[i].version),
        `第 ${i + 1} 条 v${CHANGELOG_RELEASES[i].version} 不该排在 v${CHANGELOG_RELEASES[i - 1].version} 后面`,
      ).toBe(1);
    }
  });

  it('最多保留 50 版（再多也放得下，但包体要有个上限）', () => {
    expect(CHANGELOG_RELEASES.length).toBeLessThanOrEqual(50);
    expect(CHANGELOG_RELEASES.length).toBeGreaterThan(1);
  });

  it('版本不重复（重复会让折叠行出现两行同一个版本）', () => {
    const seen = new Set(CHANGELOG_RELEASES.map((r) => r.version));
    expect(seen.size).toBe(CHANGELOG_RELEASES.length);
  });

  it('每一版都有日期与至少一条改动（空版本会让折叠行写着「0 处改动」）', () => {
    for (const release of CHANGELOG_RELEASES) {
      expect(release.date, `v${release.version} 缺日期`).toBeTruthy();
      expect(releaseEntryCount(release), `v${release.version} 没有条目`).toBeGreaterThan(0);
    }
  });
});

describe('内置数据与 manifest 对得上', () => {
  it('CHANGELOG_RELEASES 里有 manifest.json 的当前版本（发版漏加会在门禁里红）', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(__dirname, '../../manifest.json'), 'utf8'),
    ) as { version: string };
    const hit = pickReleaseFor(CHANGELOG_RELEASES, manifest.version);
    expect(hit, `内置日志缺 v${manifest.version}：发版时忘了在 core/changelog-data 里加这一版`).not.toBeNull();
    expect(releaseEntryCount(hit!)).toBeGreaterThan(0);
  });

  it('内置条目都有域名与正文（空条目会让小窗出现空白行）', () => {
    for (const release of CHANGELOG_RELEASES) {
      for (const list of [release.added, release.improved, release.fixed]) {
        for (const entry of list ?? []) {
          expect(entry.domain.trim()).not.toBe('');
          expect(entry.text.trim()).not.toBe('');
        }
      }
    }
  });
});
