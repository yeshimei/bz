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
