// @vitest-environment node
/**
 * 分类表源完整性断言（防回归的关键测试）：表以后被人手改时它会红。
 * 直接读 **表源 JSON** 做完整性断言，逐条对应出版脚本 `scripts/build-catalog.mjs`
 * 的校验项 + 图标池成员校验。
 *
 * 为什么放 node 环境：纯数据层，不引 obsidian，不需要 DOM。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CAT = resolve(here, '../../src/belongings/catalog/categories.json');
const POOL = resolve(here, '../../src/belongings/catalog/icon-pool.json');

const cat = JSON.parse(readFileSync(CAT, 'utf8'));
const pool = new Set<string>(JSON.parse(readFileSync(POOL, 'utf8')).names);

const isHan = (s: string) => /^[\u4e00-\u9fff]+$/.test(s);

describe('分类表源 · 顶层结构', () => {
  it('版本号为 0.1.0', () => {
    expect(cat.version).toBe('0.1.0');
  });
  it('26 组 / 515 条（与设计定稿一致）', () => {
    expect(cat.groups.length).toBe(26);
    const total = cat.groups.reduce((a: number, g: any) => a + g.items.length, 0);
    expect(total).toBe(515);
  });
});

describe('分类表源 · 容量上限', () => {
  it('组数 ≤ 255', () => {
    expect(cat.groups.length).toBeLessThanOrEqual(255);
  });
  it('每组条目 ≤ 255', () => {
    for (const g of cat.groups) expect(g.items.length).toBeLessThanOrEqual(255);
  });
});

describe('分类表源 · id 唯一性', () => {
  it('组 id 全表唯一', () => {
    const ids = cat.groups.map((g: any) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('分类 id 全表唯一', () => {
    const ids: string[] = [];
    for (const g of cat.groups) for (const it of g.items) ids.push(it.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('分类表源 · 名称', () => {
  it('分类名全表唯一', () => {
    const names: string[] = [];
    for (const g of cat.groups) for (const it of g.items) names.push(it.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it('分类名为 2–8 个汉字', () => {
    for (const g of cat.groups) {
      for (const it of g.items) {
        expect(isHan(it.name), `「${it.name}」(${it.id}) 须为 2–8 个汉字`).toBe(true);
        expect(it.name.length).toBeGreaterThanOrEqual(2);
        expect(it.name.length).toBeLessThanOrEqual(8);
      }
    }
  });
});

describe('分类表源 · 图标 ∈ 图标池', () => {
  it('每个组图标都在池内', () => {
    for (const g of cat.groups) expect(pool.has(g.icon), `组「${g.id}」图标 ${g.icon} 不在池内`).toBe(true);
  });
  it('每个分类图标都在池内', () => {
    for (const g of cat.groups) {
      for (const it of g.items) expect(pool.has(it.icon), `分类「${it.id}」图标 ${it.icon} 不在池内`).toBe(true);
    }
  });
});

describe('分类表源 · 别名', () => {
  it('别名不含自身名字', () => {
    for (const g of cat.groups) {
      for (const it of g.items) {
        for (const a of it.aliases) expect(a === it.name, `分类「${it.id}」别名等于自身名：${a}`).toBe(false);
      }
    }
  });
  it('别名全表不得跨分类重复', () => {
    const owners = new Map<string, string>();
    for (const g of cat.groups) {
      for (const it of g.items) {
        for (const a of it.aliases) {
          const prev = owners.get(a);
          expect(prev === undefined, `别名「${a}」跨分类重复：${prev} 与 ${it.id}`).toBe(true);
          owners.set(a, it.id);
        }
      }
    }
  });
});

// ═══════ 出版产物 ⇄ 表源 ⇄ 运行时校验器 的一致性（交付前核验时补） ═══════
// 盯的是「发布链路与运行时会不会悄悄漂移」：出版脚本写出一个运行时 `validateCategoryTable`
// 不认的东西（或清单里的 sha256 与产物不符），插件端就是「下载成功但表不可用」——
// 且因为失败发生在用户机器上，构建期不查就没人查。
describe('出版产物一致性（manual/ ⇄ 表源 ⇄ 运行时校验器）', () => {
  const PUB = resolve(here, '../../manual/belongings-categories.json');
  const PUBIDX = resolve(here, '../../manual/belongings-categories.index.json');
  const pubText = readFileSync(PUB, 'utf8');

  it('产物经运行时 validateCategoryTable 通过，且与表源同构（26 组 / 515 条）', async () => {
    const { validateCategoryTable } = await import('../../src/core/category-table');
    const t = validateCategoryTable(JSON.parse(pubText));
    expect(t).not.toBeNull();
    expect(t!.groups.length).toBe(cat.groups.length);
    expect(t!.groups.reduce((n, g) => n + g.items.length, 0)).toBe(515);
    expect(t!.version).toBe(cat.version);
  });

  it('清单 sha256（换行归一后）与产物一致，count/groups/version 对得上', async () => {
    const { parseCategoryIndex } = await import('../../src/core/category-table');
    const { createHash } = await import('node:crypto');
    const idx = parseCategoryIndex(readFileSync(PUBIDX, 'utf8'));
    expect(idx).not.toBeNull();
    const sha = createHash('sha256').update(pubText.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
    expect(sha).toBe(idx!.sha256);
    expect(idx!.count).toBe(515);
    expect(idx!.groups).toBe(26);
    expect(idx!.version).toBe(cat.version);
  });

  it('产物里的图标同样 ∈ 图标池（产出侧也守一遍）', async () => {
    const { validateCategoryTable } = await import('../../src/core/category-table');
    const t = validateCategoryTable(JSON.parse(pubText))!;
    const bad: string[] = [];
    for (const g of t.groups) {
      if (!pool.has(g.icon)) bad.push(`组 ${g.id} → ${g.icon}`);
      for (const it of g.items) if (!pool.has(it.icon)) bad.push(`${it.id} ${it.name} → ${it.icon}`);
    }
    expect(bad).toEqual([]);
  });
});
