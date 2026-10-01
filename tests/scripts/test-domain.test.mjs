// @vitest-environment node
/**
 * scripts/test-domain.mjs —— 域 → 测试文件 映射回归测试。
 *
 * 这块映射是「开发循环只跑本域」的地基：漏归一个文件，本域跑绿了但全量门禁才红，
 * 等于把 bug 推给门禁；把文件重复归两个域，又会白跑一遍 jsdom。所以主断言是
 * **每个测试文件恰好归属一个域**（不重不漏），再加两条具体归属规则。
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMap, walkTests } from '../../scripts/test-domain.mjs';

const all = walkTests(path.join(process.cwd(), 'tests')).map((p) =>
  path.relative(process.cwd(), p).split(path.sep).join('/'),
);

describe('buildMap', () => {
  it('每个测试文件恰好归入一个域（不重不漏）', () => {
    const grouped = [...buildMap().values()].flat();
    expect(grouped.slice().sort()).toEqual(all.slice().sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('tests/<域>/ 下的文件归该域目录（不看 import）', () => {
    const map = buildMap();
    for (const f of all) {
      const seg = f.split('/');
      if (seg.length > 2) expect(map.get(seg[1])).toContain(f);
    }
  });

  it('顶层散落文件按 src import 归属（clip/设置系列是历史批次文件）', () => {
    const map = buildMap();
    expect(map.get('clipbook')).toContain('tests/review-fix-clip2-ui1.test.ts');
    expect(map.get('settings-panel')).toContain('tests/sp-search-state.test.ts');
  });

  it('没有任何域被折叠成 undefined 键', () => {
    for (const k of buildMap().keys()) expect(typeof k).toBe('string');
    expect([...buildMap().keys()]).not.toContain('undefined');
  });
});
