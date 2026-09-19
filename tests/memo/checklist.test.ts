// @vitest-environment node
/**
 * 备忘录 checklist 字段数据层回归（issue 354 遗留字段）：
 * 清单子任务的 UI 侧（行组 markup / meta 进度标签 / composer 约定语法 / 行内勾选 /
 * 编辑弹窗子任务编辑）已退役，本文件只守住数据层兼容——
 * - checklist 归一（零迁移）：旧数据带字段照常载入，脏数据安全回落 null；
 * - 周期条目下一期清单重置（与 353 正交兼容）。
 */
import { describe, it, expect } from 'vitest';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { MemoData, normalizeChecklist } from '../../src/memo/data';
import type { MemoItem } from '../../src/memo/types';

describe('issue 354 · checklist 归一（零迁移）', () => {
  it('loadItems：无字段补 null；脏行（空 text）剔除', async () => {
    const vault = new MockVault();
    setApp({ vault, workspace: { getActiveFile: () => null }, metadataCache: { getFileCache: () => null } } as any);
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([
        { id: 'old', title: '旧条目', scene: '工作', priority: 'minor', created: '2026-01-01 00:00:00' },
        {
          id: 'cl', title: '筹备', scene: '生活', priority: 'minor', created: '2026-01-01 00:00:00',
          checklist: [{ text: '订机票', done: true }, { text: '   ' }, { text: '订酒店', done: false }],
        },
      ])
    );
    MemoData.init({ storagePath: 'CONFIG/STORAGE' });
    const items = await MemoData.loadItems();
    expect(items.find((i) => i.id === 'old')!.checklist).toBeNull();
    expect(items.find((i) => i.id === 'cl')!.checklist).toEqual([
      { text: '订机票', done: true },
      { text: '订酒店', done: false },
    ]);
  });

  it('normalizeChecklist：非数组/清洗后为空 → null', () => {
    expect(normalizeChecklist('x')).toBeNull();
    expect(normalizeChecklist([{ text: '  ' }])).toBeNull();
    expect(normalizeChecklist(null)).toBeNull();
  });
});

describe('issue 354 · 与 recur 正交兼容（下一期清单重置）', () => {
  it('周期条目完成后：下一期清单全未勾、与原条目数组不共享引用', async () => {
    const vault = new MockVault();
    setApp({ vault, workspace: { getActiveFile: () => null }, metadataCache: { getFileCache: () => null } } as any);
    MemoData.init({ storagePath: 'CONFIG/STORAGE' });
    const src: MemoItem = {
      id: 'r1', title: '每周采购', scene: '生活', priority: 'minor', created: '2026-09-01 09:00:00',
      completed: null, due: '2026-09-20 10:00:00', notePath: null, notePosition: null,
      scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
      recur: { kind: 'weekly' },
      checklist: [{ text: '买菜', done: true }, { text: '买水果', done: true }],
    };
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([src]));
    const { next } = await MemoData.completeItem('r1');
    expect(next).not.toBeNull();
    expect(next!.checklist).toEqual([
      { text: '买菜', done: false },
      { text: '买水果', done: false },
    ]);
    // 原条目保留当期勾选史
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    const old = raw.find((i: any) => i.id === 'r1');
    expect(old.checklist).toEqual([
      { text: '买菜', done: true },
      { text: '买水果', done: true },
    ]);
    // 不共享引用
    next!.checklist![0].text = '改动';
    expect(old.checklist[0].text).toBe('买菜');
  });
});
