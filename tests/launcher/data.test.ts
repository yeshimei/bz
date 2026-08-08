/**
 * 入口页数据层测试（ticket 23）：容错解析 / 越界重叠 / 追加 / 推挤。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import {
  normalizeData, loadLauncherData, saveLauncherData,
  canPlace, findFirstEmptySpot, placeAtEnd, pushMove, overlaps,
  LAUNCHER_PATH, LauncherTile,
} from '../../src/launcher/data';

function tile(partial: Partial<LauncherTile> & { id: string }): LauncherTile {
  return { commandId: 'cmd-' + partial.id, x: 0, y: 0, w: 1, h: 1, ...partial };
}

describe('launcher 数据层', () => {
  beforeEach(() => {
    setApp(null as any);
  });

  describe('normalizeData 容错', () => {
    it('null/非对象 → 空布局', () => {
      expect(normalizeData(null)).toEqual({ version: 1, tiles: [] });
      expect(normalizeData('x')).toEqual({ version: 1, tiles: [] });
      expect(normalizeData({})).toEqual({ version: 1, tiles: [] });
    });

    it('非法磁贴剔除、w/h 归一为 1|2、x/y 取整非负', () => {
      const raw = {
        version: 1,
        tiles: [
          { id: 'a', commandId: 'c1', x: 0, y: 0, w: 1, h: 1 },
          { id: 'bad' }, // 缺字段 → 剔除
          'nope', // 非对象 → 剔除
          { id: 'b', commandId: 'c2', x: -3, y: 2.7, w: 5, h: 2 }, // w=5 → 归一 2
        ],
      };
      const d = normalizeData(raw);
      expect(d.tiles.length).toBe(2);
      expect(d.tiles[0].id).toBe('a');
      expect(d.tiles[1]).toMatchObject({ id: 'b', x: 0, y: 2, w: 2, h: 2 });
    });

    it('icon 仅保留非空字符串', () => {
      const d = normalizeData({ tiles: [{ id: 'a', commandId: 'c', x: 0, y: 0, w: 1, h: 1, icon: 'star' }] });
      expect(d.tiles[0].icon).toBe('star');
      const d2 = normalizeData({ tiles: [{ id: 'a', commandId: 'c', x: 0, y: 0, w: 1, h: 1, icon: '' }] });
      expect(d2.tiles[0].icon).toBeUndefined();
    });

    it('label 保留 trim 后的非空值；空白 label 忽略', () => {
      const d = normalizeData({
        tiles: [{ id: 'a', commandId: 'c', x: 0, y: 0, w: 1, h: 1, label: '  我的入口  ' }],
      });
      expect(d.tiles[0].label).toBe('我的入口');
      const d2 = normalizeData({ tiles: [{ id: 'a', commandId: 'c', x: 0, y: 0, w: 1, h: 1, label: '   ' }] });
      expect(d2.tiles[0].label).toBeUndefined();
      const d3 = normalizeData({ tiles: [{ id: 'a', commandId: 'c', x: 0, y: 0, w: 1, h: 1 }] });
      expect(d3.tiles[0].label).toBeUndefined();
    });
  });

  describe('canPlace / overlaps / findFirstEmptySpot', () => {
    const A = tile({ id: 'a', x: 0, y: 0 });
    const B = tile({ id: 'b', x: 2, y: 0, w: 2, h: 1 });

    it('overlaps：相切不算重叠，相交算', () => {
      expect(overlaps(A, tile({ id: 'c', x: 1, y: 0 }))).toBe(false); // 右边相切
      expect(overlaps(A, tile({ id: 'c', x: 1, y: 1 }))).toBe(false); // 右下角相切
      expect(overlaps(A, tile({ id: 'c', x: 0, y: 0, w: 2, h: 2 }))).toBe(true); // 覆盖 A
      expect(overlaps(A, tile({ id: 'c', x: -1, y: 0, w: 2, h: 1 }))).toBe(true); // 左向越界相交
    });

    it('canPlace：越界（左右上下）拒绝', () => {
      expect(canPlace([], 5, 0, 2, 1, undefined, 6)).toBe(false); // x+w > cols
      expect(canPlace([], -1, 0, 1, 1, undefined, 6)).toBe(false);
      expect(canPlace([], 0, -1, 1, 1, undefined, 6)).toBe(false);
      expect(canPlace([], 0, 0, 2, 2, undefined, 6)).toBe(true);
    });

    it('canPlace：与现有磁贴重叠拒绝', () => {
      expect(canPlace([A, B], 0, 0, 1, 1, undefined, 6)).toBe(false);
      expect(canPlace([A, B], 1, 0, 1, 1, undefined, 6)).toBe(true); // A 与 B 之间空隙
      expect(canPlace([A, B], 2, 0, 2, 1, undefined, 6)).toBe(false); // 与 B 重叠
    });

    it('findFirstEmptySpot：行优先扫描 + 自动追加行', () => {
      const full = [0, 1, 2, 3, 4, 5].map((i) => tile({ id: 'f' + i, x: i, y: 0 }));
      const spot = findFirstEmptySpot(full, 6, 1, 1);
      expect(spot).toEqual({ x: 0, y: 1 }); // 第一行满 → 追加行
      const s2 = findFirstEmptySpot([tile({ id: 'a', x: 3, y: 0 })], 6, 2, 1);
      expect(s2).toEqual({ x: 0, y: 0 }); // 2×1 需要连续两格
    });
  });

  describe('placeAtEnd 追加', () => {
    it('追加到末尾第一个空位', () => {
      const a = tile({ id: 'a', x: 0, y: 0 });
      const b = tile({ id: 'b', x: 1, y: 0 });
      const c = tile({ id: 'c' });
      const out = placeAtEnd([a, b], c, 6);
      expect(out.length).toBe(3);
      expect(out[2]).toMatchObject({ id: 'c', x: 2, y: 0 });
    });

    it('空隙优先于末尾追加', () => {
      const a = tile({ id: 'a', x: 0, y: 0 });
      const b = tile({ id: 'b', x: 2, y: 0 });
      const c = tile({ id: 'c' });
      const out = placeAtEnd([a, b], c, 6);
      expect(out[2]).toMatchObject({ x: 1, y: 0 }); // 落在 a 与 b 之间的空隙
    });

    it('整行满 → 新起一行', () => {
      const row = [0, 1, 2, 3, 4, 5].map((i) => tile({ id: 'f' + i, x: i, y: 0 }));
      const out = placeAtEnd(row, tile({ id: 'c' }), 6);
      expect(out.length).toBe(7);
      expect(out[6]).toMatchObject({ x: 0, y: 1 });
    });
  });

  describe('pushMove 推挤', () => {
    it('目标空闲 → 直接落位', () => {
      const a = tile({ id: 'a', x: 0, y: 0 });
      const b = tile({ id: 'b', x: 1, y: 0 });
      const out = pushMove([a, b], 'a', 3, 0, 6);
      expect(out!.find((t) => t.id === 'a')).toMatchObject({ x: 3, y: 0 });
      expect(out!.find((t) => t.id === 'b')).toMatchObject({ x: 1, y: 0 }); // b 不动
    });

    it('目标被占 → 被占磁贴顺移腾位', () => {
      const a = tile({ id: 'a', x: 0, y: 0 });
      const b = tile({ id: 'b', x: 1, y: 0 });
      const out = pushMove([a, b], 'a', 1, 0, 6);
      expect(out).not.toBeNull();
      expect(out!.find((t) => t.id === 'a')).toMatchObject({ x: 1, y: 0 });
      expect(out!.find((t) => t.id === 'b')).toMatchObject({ x: 2, y: 0 }); // b 被挤到右侧
    });

    it('推挤链：被挤磁贴顺移到其后的空位', () => {
      // a(0,0) b(1,0) c(2,0)，d 落位 (1,0)：b 被挤 → b 的右侧被 c 占 → b 顺移到 c 后
      const a = tile({ id: 'a', x: 0, y: 0 });
      const b = tile({ id: 'b', x: 1, y: 0 });
      const c = tile({ id: 'c', x: 2, y: 0 });
      const d = tile({ id: 'd', x: 4, y: 0 });
      const out = pushMove([a, b, c, d], 'd', 1, 0, 6);
      expect(out).not.toBeNull();
      expect(out!.find((t) => t.id === 'd')).toMatchObject({ x: 1, y: 0 });
      expect(out!.find((t) => t.id === 'b')).toMatchObject({ x: 3, y: 0 });
      expect(out!.find((t) => t.id === 'c')).toMatchObject({ x: 2, y: 0 });
    });

    it('moving 不存在 → 返回原布局', () => {
      const a = tile({ id: 'a', x: 0, y: 0 });
      expect(pushMove([a], 'nope', 1, 0, 6)).toEqual([a]);
    });

    it('推挤永不失败：行扩展兜底总能找到空位', () => {
      // 3 列前三行全满，x 在深处 (0,5)：被挤磁贴顺移到追加行
      const full: LauncherTile[] = [];
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) full.push(tile({ id: `t${y}-${x}`, x, y }));
      }
      const x = tile({ id: 'x', x: 0, y: 5 });
      const out = pushMove([...full, x], 'x', 1, 0, 3);
      expect(out).not.toBeNull();
      expect(out!.find((t) => t.id === 'x')).toMatchObject({ x: 1, y: 0 });
      expect(out!.find((t) => t.id === 't0-1')).toMatchObject({ x: 0, y: 3 }); // 被挤到追加行
    });

    it('跨行推挤：行尾被挤 → 换行找空位', () => {
      // 4 列：第一行满 (0-3)，第二行 (0,1) 被占；d 落 (1,0) → r1(1,0) 被挤 → 第一行无空 → 换行
      const row = [0, 1, 2, 3].map((i) => tile({ id: 'r' + i, x: i, y: 0 }));
      const s = tile({ id: 's', x: 0, y: 1 });
      const d = tile({ id: 'd', x: 0, y: 4 });
      const out = pushMove([...row, s, d], 'd', 1, 0, 4);
      expect(out).not.toBeNull();
      expect(out!.find((t) => t.id === 'd')).toMatchObject({ x: 1, y: 0 });
      // r1 被挤：找 (1,0) 之后的空位：(2,0) 有 r2 → (3,0) 有 r3 → (4,0) 越界 → (0,1) 有 s → (1,1) 空 → r1 落 (1,1)
      expect(out!.find((t) => t.id === 'r1')).toMatchObject({ x: 1, y: 1 });
      expect(out!.find((t) => t.id === 'r2')).toMatchObject({ x: 2, y: 0 });
      expect(out!.find((t) => t.id === 'r3')).toMatchObject({ x: 3, y: 0 });
      expect(out!.find((t) => t.id === 's')).toMatchObject({ x: 0, y: 1 });
    });

    it('移动自身后原位空出，不影响推挤判定', () => {
      const a = tile({ id: 'a', x: 0, y: 0 });
      const b = tile({ id: 'b', x: 1, y: 0 });
      // a 移到 (1,0)：b 被挤到 (2,0)；a 原位 (0,0) 空
      const out = pushMove([a, b], 'a', 1, 0, 6);
      expect(out!.find((t) => t.id === 'a')).toMatchObject({ x: 1, y: 0 });
      expect(out!.find((t) => t.id === 'b')).toMatchObject({ x: 2, y: 0 });
    });
  });

  describe('load/save launcher.json', () => {
    it('不存在 → 空布局；save 建目录建文件；load 往返', async () => {
      const vault = new MockVault();
      setApp({ vault } as any);
      expect(await loadLauncherData(getApp())).toEqual({ version: 1, tiles: [] });
      await saveLauncherData(getApp(), {
        version: 1,
        tiles: [tile({ id: 'a', x: 2, y: 3, icon: 'star', label: '入口A' })],
      });
      expect(vault.files.has(LAUNCHER_PATH)).toBe(true);
      const d = await loadLauncherData(getApp());
      expect(d.tiles[0]).toMatchObject({ id: 'a', x: 2, y: 3, icon: 'star', label: '入口A' });
    });

    it('解析失败 → 空布局且不覆盖文件', async () => {
      const vault = new MockVault();
      await vault.create(LAUNCHER_PATH, '{broken');
      setApp({ vault } as any);
      const d = await loadLauncherData(getApp());
      expect(d).toEqual({ version: 1, tiles: [] });
      expect(vault.files.get(LAUNCHER_PATH)).toBe('{broken'); // 未覆盖
    });
  });
});
