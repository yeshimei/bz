/**
 * 归物本分类选择器 UI 层测试（issue 478 阶段 C）：以 path-picker-ui 为模板。
 * 覆盖：非搜索态分组头数 = 表组数 + 图标占位；搜索命中分类名 / 命中别名；
 * 超 300 条截断 + 提示；点选返回 {category, icon}；ESC/遮罩取消返回空；
 * 空态（表为 null）不抛错渲染「尚未下载分类表」；resolveIconName 兜底分支。
 * jsdom 环境。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { openCatPicker, closeCatPicker, resolveIconName } from '../../src/core/ui/catpicker';
import type { CategoryTable, CategoryItem } from '../../src/core/category-table';

// getIconIds 在测试 mock 中不存在 → 用可变闭包变量模拟「存在/不存在/抛错」三种分支
let iconIdsImpl: (() => Set<string> | string[]) | undefined = undefined;
vi.mock('obsidian', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  const out: Record<string, unknown> = { ...mod };
  Object.defineProperty(out, 'getIconIds', {
    configurable: true,
    get: () => iconIdsImpl,
  });
  return out;
});

const ROW = '.bz-catpick-row';
const GROUP = '.bz-catpick-group';

function sampleTable(): CategoryTable {
  return {
    version: '1.0',
    groups: [
      {
        id: 'g001',
        name: '数码影音',
        icon: 'smartphone',
        items: [
          { id: 'c0001', name: '智能手机', icon: 'smartphone', aliases: ['手机'] },
          { id: 'c0002', name: '移动电源', icon: 'battery-charging', aliases: ['充电宝', '充电', 'PowerBank'] },
        ],
      },
      {
        id: 'g002',
        name: '家居',
        icon: 'home',
        items: [{ id: 'c0003', name: '椅子', icon: 'armchair', aliases: ['凳子'] }],
      },
    ],
  };
}

function openAndWait(opts: Parameters<typeof openCatPicker>[0]): HTMLElement {
  openCatPicker(opts);
  const popup = document.getElementById('bz-catpick-popup')!;
  expect(popup).toBeTruthy();
  return popup;
}

beforeEach(() => {
  resetObsidianMocks();
  closeCatPicker();
  document.body.innerHTML = '';
  iconIdsImpl = undefined; // 默认：getIconIds 不存在（图标名原样使用）
});

afterEach(() => {
  closeCatPicker();
  document.body.innerHTML = '';
});

describe('非搜索态：分组头数 = 表组数，条目含图标占位', () => {
  it('分组头数 = 表组数；每行含图标占位且 data-icon 与表中一致；含别名小字', () => {
    const popup = openAndWait({ table: sampleTable(), onConfirm: () => {} });
    expect(popup.querySelectorAll(GROUP).length).toBe(2);
    const rows = [...popup.querySelectorAll<HTMLElement>(ROW)];
    expect(rows.length).toBe(3);
    // 图标占位：行内 .bz-catpick-ic 存在且 data-icon 等于表中该条 icon
    const phoneRow = rows.find((r) => r.dataset.cat === '智能手机')!;
    const ic = phoneRow.querySelector('.bz-catpick-ic') as HTMLElement;
    expect(ic).toBeTruthy();
    expect(ic.dataset.icon).toBe('smartphone');
    // 别名小字（移动电源 含别名「充电宝」）
    const powerRow = rows.find((r) => r.dataset.cat === '移动电源')!;
    expect(powerRow.querySelector('.bz-catpick-alias')!.textContent).toContain('充电宝');
    // 分组头含组图标 + 组名 + 条数
    const g0 = popup.querySelectorAll(GROUP)[0];
    expect(g0.querySelector('.bz-catpick-group-name')!.textContent).toBe('数码影音');
    expect(g0.querySelector('.bz-catpick-group-count')!.textContent).toBe('2');
  });
});

describe('搜索过滤（命中分类名 / 命中别名，大小写不敏感）', () => {
  function search(popup: HTMLElement, q: string): void {
    const s = popup.querySelector('.bz-catpick-search') as HTMLInputElement;
    s.value = q;
    s.dispatchEvent(new Event('input'));
  }

  it('命中分类名「智能手机」→ 只留含它的组与条', () => {
    const popup = openAndWait({ table: sampleTable(), onConfirm: () => {} });
    search(popup, '智能手机');
    const rows = [...popup.querySelectorAll<HTMLElement>(ROW)];
    expect(rows.length).toBe(1);
    expect(rows[0].dataset.cat).toBe('智能手机');
    // 只显示有命中的组（数码影音，含命中条数 1）
    expect(popup.querySelectorAll(GROUP).length).toBe(1);
    expect(popup.querySelector('.bz-catpick-group-count')!.textContent).toBe('1');
  });

  it('命中别名「充电宝」→ 命中「移动电源」', () => {
    const popup = openAndWait({ table: sampleTable(), onConfirm: () => {} });
    search(popup, '充电宝');
    const rows = [...popup.querySelectorAll<HTMLElement>(ROW)];
    expect(rows.length).toBe(1);
    expect(rows[0].dataset.cat).toBe('移动电源');
    expect(popup.querySelectorAll(GROUP).length).toBe(1);
  });

  it('大小写不敏感：搜「POWERBANK」（大写）仍命中别名含 PowerBank 的「移动电源」', () => {
    const popup = openAndWait({ table: sampleTable(), onConfirm: () => {} });
    search(popup, 'POWERBANK');
    const rows = [...popup.querySelectorAll<HTMLElement>(ROW)];
    expect(rows.length).toBe(1);
    expect(rows[0].dataset.cat).toBe('移动电源');
  });

  it('无匹配 → 空态「没有匹配的分类」', () => {
    const popup = openAndWait({ table: sampleTable(), onConfirm: () => {} });
    search(popup, '不存在xyz');
    expect(popup.querySelector(ROW)).toBeNull();
    expect(popup.querySelector('.bz-catpick-empty')!.textContent).toBe('没有匹配的分类');
  });
});

describe('渲染上限 300 条（照 path-picker LIMIT=300）', () => {
  it('超过 300 条只渲染前 300 行 + 提示「输入关键词缩小范围」', () => {
    const items: CategoryItem[] = [];
    for (let i = 0; i < 400; i++) {
      items.push({ id: `c${i}`, name: `物品${i}`, icon: 'package', aliases: [] });
    }
    const big: CategoryTable = {
      version: '1',
      groups: [{ id: 'g1', name: '大组', icon: 'package', items }],
    };
    const popup = openAndWait({ table: big, onConfirm: () => {} });
    expect(popup.querySelectorAll(ROW).length).toBe(300);
    const hint = popup.querySelector('.bz-catpick-empty');
    expect(hint?.textContent).toContain('输入关键词缩小范围');
    // 搜索缩小后提示消失
    const s = popup.querySelector('.bz-catpick-search') as HTMLInputElement;
    s.value = '物品39';
    s.dispatchEvent(new Event('input'));
    expect(popup.querySelectorAll(ROW).length).toBeLessThan(300);
    expect(popup.querySelector('.bz-catpick-empty')).toBeNull();
  });
});

describe('点选返回 {category, icon} 且与表中一致', () => {
  it('点选「移动电源」行 → onConfirm 收到 {category, icon} 且该条一致', () => {
    let picked: { category: string; icon: string } | null = null;
    const popup = openAndWait({
      table: sampleTable(),
      onConfirm: (sel) => {
        picked = sel;
      },
    });
    const row = [...popup.querySelectorAll<HTMLElement>(ROW)].find((r) => r.dataset.cat === '移动电源')!;
    row.click();
    expect(picked).toEqual({ category: '移动电源', icon: 'battery-charging' });
    expect(document.getElementById('bz-catpick-popup')).toBeNull(); // 选中即关
  });

  it('搜索后点选首行经回车直选', () => {
    let picked: { category: string; icon: string } | null = null;
    const popup = openAndWait({
      table: sampleTable(),
      onConfirm: (sel) => {
        picked = sel;
      },
    });
    const s = popup.querySelector('.bz-catpick-search') as HTMLInputElement;
    s.value = '手机';
    s.dispatchEvent(new Event('input'));
    s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(picked).toEqual({ category: '智能手机', icon: 'smartphone' });
    expect(document.getElementById('bz-catpick-popup')).toBeNull();
  });
});

describe('取消语义：ESC / 遮罩关闭 → 返回空（null），不抛错', () => {
  it('ESC 关闭 → onConfirm(null) 且弹窗移除', () => {
    const onConfirm = vi.fn();
    openAndWait({ table: sampleTable(), onConfirm });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onConfirm).toHaveBeenCalledWith(null);
    expect(document.getElementById('bz-catpick-popup')).toBeNull();
  });

  it('遮罩点击关闭 → onConfirm(null)', () => {
    const onConfirm = vi.fn();
    const popup = openAndWait({ table: sampleTable(), onConfirm });
    const mask = document.getElementById('bz-catpick-mask')!;
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onConfirm).toHaveBeenCalledWith(null);
    expect(document.getElementById('bz-catpick-popup')).toBeNull();
    expect(popup.querySelector(ROW)).toBeTruthy(); // 关闭前确有内容（幂等双关不冲突）
  });
});

describe('空态：表为 null → 渲染「尚未下载分类表」且不抛错', () => {
  it('文案出现、含去下载按钮、不抛错、未触发 onConfirm', () => {
    const onConfirm = vi.fn();
    let threw = false;
    try {
      openAndWait({ table: null, onConfirm });
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
    const popup = document.getElementById('bz-catpick-popup')!;
    expect(popup.textContent).toContain('尚未下载分类表');
    expect(popup.textContent).toContain('设置');
    expect(popup.querySelector('.bz-catpick-empty .bz-btn')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    // 无搜索框（空态不渲染搜索）
    expect(popup.querySelector('.bz-catpick-search')).toBeNull();
  });
});

describe('resolveIconName 图标兜底', () => {
  it('getIconIds 不存在 → 原样返回 name', () => {
    iconIdsImpl = undefined;
    expect(resolveIconName('my-icon', 'package')).toBe('my-icon');
  });
  it('getIconIds 抛错 → 原样返回 name', () => {
    iconIdsImpl = () => {
      throw new Error('boom');
    };
    expect(resolveIconName('my-icon', 'package')).toBe('my-icon');
  });
  it('name 不在集合内 → 返回 fallback', () => {
    iconIdsImpl = () => new Set(['home', 'package']);
    expect(resolveIconName('my-icon', 'package')).toBe('package');
  });
  it('name 在集合内 → 返回 name', () => {
    iconIdsImpl = () => new Set(['my-icon', 'home']);
    expect(resolveIconName('my-icon', 'package')).toBe('my-icon');
  });
  it('空名 → 返回 fallback', () => {
    iconIdsImpl = () => new Set(['home']);
    expect(resolveIconName('', 'package')).toBe('package');
  });
  it('数组形态 getIconIds 同样生效（不在 → fallback，在 → name）', () => {
    iconIdsImpl = () => ['home', 'package'];
    expect(resolveIconName('x', 'package')).toBe('package');
    iconIdsImpl = () => ['x', 'home'];
    expect(resolveIconName('x', 'package')).toBe('x');
  });
});
