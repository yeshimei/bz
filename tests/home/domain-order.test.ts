/**
 * 首页入口顺序纯函数（shared.applyOrder / visibleDomains / reorderTo）。
 *
 * 2026-09-17 用户点名：「设置面板和首页放到正确的位置，而不是最后」——新增域（游戏库）
 * 当时被排到「设置」后面（持久化顺序里没有它 → 旧口径一律丢到末尾）。现口径：**未列出的域
 * 插到它在 DOMAINS 里声明的前驱之后**。本文件是那条口径的回归守卫（含真实 vault 的现场快照）。
 */
import { describe, it, expect } from 'vitest';
import { applyOrder, reorderTo, visibleDomains, DOMAINS, type HomeDomain } from '../../src/home/shared';

const d = (id: string): HomeDomain => ({ id, commandId: `c-${id}`, name: id, sub: '', icon: 'x' });
const ids = (list: HomeDomain[]): string[] => list.map((x) => x.id);

describe('applyOrder：新域按声明位置落位（不落末尾）', () => {
  const domains = [d('a'), d('b'), d('c'), d('d')];

  it('空序 / null → DOMAINS 声明顺序', () => {
    expect(ids(applyOrder([], domains))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(applyOrder(null, domains))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('已列出的域严格按持久化顺序（用户自己排的次序零改动）', () => {
    expect(ids(applyOrder(['d', 'b', 'a', 'c'], domains))).toEqual(['d', 'b', 'a', 'c']);
  });

  it('新域（声明在 b 之后）插到 b 之后，而不是末尾', () => {
    expect(ids(applyOrder(['d', 'b', 'a'], domains))).toEqual(['d', 'b', 'c', 'a']);
  });

  it('多个新域按声明序链式落位（前驱允许是刚插入的新域）', () => {
    expect(ids(applyOrder(['a'], [d('a'), d('b'), d('c')]))).toEqual(['a', 'b', 'c']);
    // c 与 d 都缺：c 认 b 作锚、d 认 c 作锚 → 顺序不乱
    expect(ids(applyOrder(['e', 'a'], [d('a'), d('b'), d('c'), d('d'), d('e')]))).toEqual(['e', 'a', 'b', 'c', 'd']);
  });

  it('新域声明在首位（前面没有前驱）→ 落最前', () => {
    expect(ids(applyOrder(['b', 'c'], [d('z'), d('b'), d('c')]))).toEqual(['z', 'b', 'c']);
  });

  it('已退役 / 未知 id 被忽略，不占位', () => {
    expect(ids(applyOrder(['old', 'b', 'a'], [d('a'), d('b')]))).toEqual(['b', 'a']);
  });
});

describe('真实域清单 + 真实 vault 顺序快照（2026-09-17 报的现场）', () => {
  // E:\Obsidian\叫我包仔\CONFIG\STORAGE\home.json 的 desk（游戏库建域前落盘，14 项无 gameshelf）
  const DESK = [
    'diary', 'memo', 'cinema', 'bookshelf', 'review', 'clipping', 'favorites',
    'belongings', 'knowledge', 'secondbrain', 'pomodoro', 'encrypt', 'vault', 'settings',
  ];

  it('游戏库落在书库之后（不是末尾），末尾仍是设置', () => {
    const list = ids(applyOrder(DESK));
    expect(list.indexOf('gameshelf')).toBe(list.indexOf('bookshelf') + 1);
    expect(list[list.length - 1]).toBe('settings');
    expect(list).toHaveLength(DOMAINS.length);
  });

  it('已列出域的先后完全保持（用户的桌面/移动顺序不被新域挤动）', () => {
    expect(ids(applyOrder(DESK)).filter((id) => DESK.includes(id))).toEqual(DESK);
  });
});

describe('visibleDomains / reorderTo 与新域插位共存', () => {
  it('隐藏游戏库 → 不出现在可见序列里；已列出域仍按给的先后', () => {
    const list = ids(visibleDomains(['diary', 'cinema', 'bookshelf', 'settings'], ['gameshelf']));
    expect(list).not.toContain('gameshelf');
    expect(list).toHaveLength(DOMAINS.length - 1);
    expect(list.filter((id) => ['diary', 'cinema', 'bookshelf', 'settings'].includes(id)))
      .toEqual(['diary', 'cinema', 'bookshelf', 'settings']);
  });

  it('reorderTo 归一化成完整顺序（拖一次落盘含新域，D 口径）', () => {
    const all = reorderTo([], 'diary', 3);
    expect(all).toHaveLength(DOMAINS.length);
    expect(all).toContain('gameshelf');
    expect(all.indexOf('diary')).toBe(3);
  });
});
