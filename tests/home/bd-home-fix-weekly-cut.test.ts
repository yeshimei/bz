// @vitest-environment node
/**
 * home 周报死代码裁剪回归（H2/呈报#53，全域深审拍板后修复批 Wave1）：
 * 「R1 生活周报」（src/home/weekly.ts）从未接入任何 UI（活动河改版 issue 232 后摘要走
 * recap collectRecap），整文件为死代码——本轮裁掉（git 历史可找回）。
 *
 * 本文件守护裁剪后的三件事：
 * 1. weekly.ts（连同其专属测试）确实不在了，不借尸还魂；
 * 2. 曾随 weekly.ts re-export 的 parseLocalDay 单源仍在 core/utils（A1 解环成果），
 *    原weekly.test.ts 里这两条 core 覆盖用例随裁剪迁入此处，不丢；
 * 3. recap 采集（river 依赖的活链路）不受裁剪影响（parseLocalDay/settingDir 三件套仍可用）。
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLocalDay } from '../../src/core/utils';
import { collectRecap } from '../../src/recap/aggregate';

const ROOT = resolve(process.cwd(), 'src');

describe('H2：weekly.ts 死代码裁剪（呈报#53）', () => {
  it('src/home/weekly.ts 已删除（其专属测试文件一并移除）', () => {
    expect(existsSync(resolve(ROOT, 'home', 'weekly.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'tests', 'home', 'weekly.test.ts'))).toBe(false);
  });

  it('src/home/** 零处再引用周报符号（collectWeeklyStat 系不还魂）', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const p = resolve(dir, name.name);
        if (name.isDirectory()) walk(p);
        else if (name.name.endsWith('.ts') && name.name !== 'weekly.ts') files.push(p);
      }
    };
    walk(resolve(ROOT, 'home'));
    const hits = files.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return /collectWeeklyStat|EMPTY_WEEKLY|WeeklyStat|countMoviesThisWeek/.test(text);
    });
    expect(hits, '周报符号不得再出现在 src/home/**').toEqual([]);
  });

  it('parseLocalDay 单源仍在 core/utils（A1 解环成果不随裁剪回退）', async () => {
    const { readFileSync } = await import('node:fs');
    const utils = readFileSync(resolve(ROOT, 'core', 'utils.ts'), 'utf8');
    expect(utils).toContain('export function parseLocalDay');
  });
});

describe('parseLocalDay（core/utils 单源；原 weekly.test.ts 覆盖迁入）', () => {
  it('标准日期 / 带时间后缀 / 单位数均可解析，且为本地时区当日 0 点', () => {
    const day = new Date(2026, 8, 2).getTime();
    expect(parseLocalDay('2026-09-02')).toBe(day);
    expect(parseLocalDay('2026-09-02 13:00:00')).toBe(day);
    expect(parseLocalDay('2026-9-2')).toBe(day);
  });

  it('非法输入返回 null（不抛错）', () => {
    expect(parseLocalDay('')).toBeNull();
    expect(parseLocalDay('not-a-date')).toBeNull();
    expect(parseLocalDay(null)).toBeNull();
    expect(parseLocalDay(undefined)).toBeNull();
    expect(parseLocalDay('2026-13-40')).toBeNull(); // 月/日越界
  });
});

describe('recap 活链路不受裁剪影响', () => {
  it('collectRecap（river 依赖）仍可调用：空库空快照，不抛错', async () => {
    const { MockVault, mockAppWithVault } = await import('../mock-vault');
    const vault = new MockVault();
    const snap = await collectRecap(mockAppWithVault(vault), Date.now());
    expect(snap).toBeTruthy();
    expect(typeof snap.summary.movies).toBe('number');
    expect(Array.isArray(snap.items)).toBe(true);
  });
});
