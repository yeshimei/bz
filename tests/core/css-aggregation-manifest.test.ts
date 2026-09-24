// @vitest-environment node
/**
 * 样式聚合清单完整性守卫（issue 437）
 *
 * 背景：根 styles.css 是 scripts/build-css.mjs 按**手工维护的 SOURCES 清单**拼接的产物
 * （域间级联顺序经审计，不做自动扫描）。新增域时忘登清单 → 域样式从未进产物，
 * 但界面不报错、测试全绿（守卫只扫产物，产物里根本没有该域段）——极难察觉。
 * 实例：people 域（issue 435/436）两轮构建样式均被静默跳过，用户实机看到「只有文字」。
 *
 * 做法：扫描 src/<域>/styles.css 的**实际存在文件**，逐一断言已登记进 SOURCES；
 * 反向断言清单里的 src/<域>/styles.css 项都存在（防清单悬指已删文件）。
 * 二级样式（src/<域>/<层>/styles.css，如 review/analysis）为域内显式聚合，不强制登记。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 从 build-css.mjs 源码提取 SOURCES 数组的字面量项 */
function readManifest(): string[] {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/build-css.mjs'), 'utf8');
  const m = src.match(/const SOURCES = \[([\s\S]*?)\];/);
  if (!m) throw new Error('build-css.mjs 里找不到 SOURCES 清单');
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe('样式聚合清单完整性', () => {
  const manifest = readManifest();

  it('src/<域>/styles.css 实际存在的文件必须全部登记进 SOURCES', () => {
    const existing = fs
      .readdirSync(path.join(ROOT, 'src'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `src/${d.name}/styles.css`)
      .filter((rel) => fs.existsSync(path.join(ROOT, rel)));
    const missing = existing.filter((rel) => !manifest.includes(rel));
    expect(missing, `以下域样式未登记进 scripts/build-css.mjs 的 SOURCES（样式不会进产物）：${missing.join('、')}`).toEqual([]);
  });

  it('SOURCES 里的样式项都指向真实存在的文件', () => {
    const cssItems = manifest.filter((rel) => rel.endsWith('.css'));
    const stale = cssItems.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
    expect(stale, `SOURCES 指向不存在的文件：${stale.join('、')}`).toEqual([]);
  });
});
