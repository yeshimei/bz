// @vitest-environment jsdom
/**
 * 分类表运行时（issue 478 阶段 A）测试：覆盖
 *  - validateCategoryTable 合法 / 各类畸形（返回 null，不抛）；
 *  - matchByAlias 精确命中 / 最长别名优先 / 多义确定性 / 未命中；
 *  - groupMenu / itemMenu 形状与条数；
 *  - iconOf；
 *  - downloadCategoryTable 的 sha256 不符抛错（mock，不真联网）+ 成功落盘路径；
 *  - refreshCategoryTable 静默（无变化返回 false）。
 *
 * 钉死一件关键事：下载链路 sha256 与构建脚本同口径（对归一换行后的文本取值）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { textSha256 } from '../../src/core/sha256';
import {
  CATEGORY_INDEX_FILE,
  CATEGORY_TABLE_FILE,
  downloadCategoryTable,
  groupMenu,
  iconOf,
  itemMenu,
  matchByAlias,
  parseCategoryIndex,
  refreshCategoryTable,
  resetCategoryTableCache,
  validateCategoryTable,
  type CategoryTable,
} from '../../src/core/category-table';

const appOf = (vault: MockVault) => ({ vault }) as any;
const TABLE_PATH = `.obsidian/plugins/bz/${CATEGORY_TABLE_FILE}`;
const INDEX_PATH = `.obsidian/plugins/bz/${CATEGORY_INDEX_FILE}`;

/** 小表（用于单元断言，不引 515 行真源） */
function smallTable(): CategoryTable {
  return {
    version: '0.1.0',
    groups: [
      {
        id: 'g001',
        name: '数码影音',
        icon: 'smartphone',
        items: [
          { id: 'c0001', name: '智能手机', icon: 'smartphone', aliases: ['手机', 'phone'] },
          { id: 'c0002', name: '平板电脑', icon: 'tablet', aliases: ['平板', 'ipad'] },
        ],
      },
      {
        id: 'g002',
        name: '工具五金',
        icon: 'wrench',
        items: [
          { id: 'c0003', name: '螺丝刀', icon: 'wrench', aliases: ['起子'] },
          { id: 'c0004', name: '锤子', icon: 'hammer', aliases: ['榔头'] },
        ],
      },
    ],
  };
}

/** requestUrl 桩：按 URL 是否含 .index.json 分发到 index / data 文本 */
function routeFetch(indexText: string, dataText: string): void {
  vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
    const url = req.url;
    const body = url.includes('.index.json') ? indexText : url.includes('belongings-categories.json') ? dataText : null;
    if (body === null) throw new Error('unmocked url: ' + url);
    return { status: 200, text: body } as any;
  }) as any);
}

beforeEach(() => {
  resetObsidianMocks();
  resetCategoryTableCache();
  vi.mocked(requestUrl).mockReset();
});

describe('validateCategoryTable', () => {
  it('合法表 → 非 null 且结构还原', () => {
    const t = validateCategoryTable(smallTable());
    expect(t).not.toBeNull();
    expect(t!.groups.length).toBe(2);
    expect(t!.groups[0].items.length).toBe(2);
  });

  it('真源表也通过（与出版脚本同口径）', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const real = JSON.parse(readFileSync(resolve(here, '../../src/belongings/catalog/categories.json'), 'utf8'));
    expect(validateCategoryTable(real)).not.toBeNull();
  });

  it('缺 groups → null', () => {
    expect(validateCategoryTable({ version: '0.1.0' })).toBeNull();
  });
  it('groups 非数组 → null', () => {
    expect(validateCategoryTable({ version: '0.1.0', groups: 'x' })).toBeNull();
  });
  it('组 id 重复 → null', () => {
    const t = smallTable();
    t.groups[1].id = 'g001';
    expect(validateCategoryTable(t)).toBeNull();
  });
  it('分类 id 全表重复 → null', () => {
    const t = smallTable();
    t.groups[1].items[0].id = 'c0001';
    expect(validateCategoryTable(t)).toBeNull();
  });
  it('分类名全表重复 → null', () => {
    const t = smallTable();
    t.groups[1].items[0].name = '智能手机';
    expect(validateCategoryTable(t)).toBeNull();
  });
  it('items 非数组 → null', () => {
    const t = smallTable();
    (t.groups[0] as any).items = 'x';
    expect(validateCategoryTable(t)).toBeNull();
  });
  it('aliases 非数组 → null', () => {
    const t = smallTable();
    (t.groups[0].items[0] as any).aliases = 'x';
    expect(validateCategoryTable(t)).toBeNull();
  });
  it('非对象输入 → null（绝不抛）', () => {
    expect(validateCategoryTable(null)).toBeNull();
    expect(validateCategoryTable('garbage')).toBeNull();
    expect(validateCategoryTable(42)).toBeNull();
  });
});

describe('matchByAlias', () => {
  const t = smallTable();
  it('精确命中分类名优先', () => {
    expect(matchByAlias('平板电脑', t)).toEqual({ category: '平板电脑', icon: 'tablet' });
  });
  it('别名包含匹配（输入含别名即命中）', () => {
    expect(matchByAlias('我刚买的手机丢了', t)).toEqual({ category: '智能手机', icon: 'smartphone' });
  });
  it('最长别名优先', () => {
    const t2: CategoryTable = {
      version: '0.1.0',
      groups: [
        {
          id: 'g001',
          name: '组',
          icon: 'x',
          items: [
            { id: 'c0001', name: '智能手机', icon: 'smartphone', aliases: ['手机'] },
            { id: 'c0002', name: '手机壳', icon: 'shield', aliases: ['手机保护壳'] },
          ],
        },
      ],
    };
    // 「手机保护壳」(6) > 「手机」(2) → 命中手机壳
    expect(matchByAlias('买了个手机保护壳', t2)).toEqual({ category: '手机壳', icon: 'shield' });
  });
  it('多义时按最长别名取胜、并列按 id 升序（确定性）', () => {
    const t3: CategoryTable = {
      version: '0.1.0',
      groups: [
        {
          id: 'g001',
          name: '组',
          icon: 'x',
          items: [
            { id: 'c0009', name: '老年机', icon: 'a', aliases: ['手机'] },
            { id: 'c0001', name: '智能手机', icon: 'smartphone', aliases: ['手机'] },
          ],
        },
      ],
    };
    // 两命中别名长度相同（2）→ id 升序取 c0001
    expect(matchByAlias('这是手机', t3)).toEqual({ category: '智能手机', icon: 'smartphone' });
  });
  it('未命中 → null', () => {
    expect(matchByAlias('和物品无关的字符串xyz', t)).toBeNull();
    expect(matchByAlias('', t)).toBeNull();
  });
});

describe('groupMenu / itemMenu / iconOf', () => {
  const t = smallTable();
  it('groupMenu：键 g001 / 值中文名，条数 = 组数', () => {
    const m = groupMenu(t);
    expect(Object.keys(m).length).toBe(2);
    expect(m['g001']).toBe('数码影音');
    expect(m['g002']).toBe('工具五金');
  });
  it('itemMenu：键 c0001 / 值中文名，仅取该组', () => {
    const m = itemMenu(t, 'g001');
    expect(Object.keys(m).length).toBe(2);
    expect(m['c0001']).toBe('智能手机');
    expect(m['c0002']).toBe('平板电脑');
    expect(itemMenu(t, 'g002')['c0003']).toBe('螺丝刀');
  });
  it('itemMenu：不存在的组 → 空对象', () => {
    expect(itemMenu(t, 'g999')).toEqual({});
  });
  it('iconOf：按分类名取图标', () => {
    expect(iconOf(t, '锤子')).toBe('hammer');
    expect(iconOf(t, '不存在')).toBeNull();
  });
});

describe('downloadCategoryTable', () => {
  it('sha256 不符 → 抛错（不静默返回空表）', async () => {
    const dataText = JSON.stringify(smallTable(), null, 2);
    const badIndex = JSON.stringify(
      { version: '0.1.0', file: CATEGORY_TABLE_FILE, sha256: '0'.repeat(64), count: 4, groups: 2 },
      null,
      2,
    );
    routeFetch(badIndex, dataText);
    const app = appOf(new MockVault());
    await expect(downloadCategoryTable(app)).rejects.toThrow();
  });

  it('sha256 匹配 → 落盘 + 返回已校验表 + 写入缓存', async () => {
    const dataText = JSON.stringify(smallTable(), null, 2);
    const sha = textSha256(dataText);
    const index = JSON.stringify(
      { version: '0.1.0', file: CATEGORY_TABLE_FILE, sha256: sha, count: 4, groups: 2 },
      null,
      2,
    );
    routeFetch(index, dataText);
    const vault = new MockVault();
    const app = appOf(vault);
    const t = await downloadCategoryTable(app);
    expect(t.groups.length).toBe(2);
    // 落盘
    expect(vault.files.get(TABLE_PATH)).toBe(dataText);
    // 缓存命中：二次读取不重下（requestUrl 仍被 index 命中，但数据从盘读）
    const again = await (await import('../../src/core/category-table')).loadCategoryTable(app);
    expect(again).not.toBeNull();
    expect(again!.groups[1].items[0].name).toBe('螺丝刀');
  });
});

describe('refreshCategoryTable', () => {
  it('远端与本地一致 → 返回 false（不落盘、不抛）', async () => {
    const dataText = JSON.stringify(smallTable(), null, 2);
    const sha = textSha256(dataText);
    const index = JSON.stringify(
      { version: '0.1.0', file: CATEGORY_TABLE_FILE, sha256: sha, count: 4, groups: 2 },
      null,
      2,
    );
    const vault = new MockVault();
    vault.files.set(TABLE_PATH, dataText);
    vault.files.set(INDEX_PATH, index);
    routeFetch(index, dataText);
    const app = appOf(vault);
    const updated = await refreshCategoryTable(app);
    expect(updated).toBe(false);
  });
});

describe('parseCategoryIndex', () => {
  it('合法清单解析', () => {
    const idx = parseCategoryIndex(
      JSON.stringify({ version: '0.1.0', file: CATEGORY_TABLE_FILE, sha256: 'a'.repeat(64), count: 4, groups: 2 }),
    );
    expect(idx).not.toBeNull();
    expect(idx!.sha256).toBe('a'.repeat(64));
  });
  it('坏 sha 形状 / 坏 JSON → null', () => {
    expect(parseCategoryIndex('not json')).toBeNull();
    expect(parseCategoryIndex(JSON.stringify({ version: '0.1.0', file: 'x', sha256: 'zzz', count: 1, groups: 1 }))).toBeNull();
    expect(parseCategoryIndex(null)).toBeNull();
  });
});
