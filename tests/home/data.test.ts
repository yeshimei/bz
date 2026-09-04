// @vitest-environment node
/**
 * 内容首页（home 域）数据层测试：home.json 读写、归一、默认钉选。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { loadHomeData, saveHomeData, defaultHomeData, homeFilePath, DEFAULT_PINNED, movePinnedInList } from '../../src/home/data';

describe('home 数据层', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
  });

  it('默认数据：version 1 + 默认钉选四域', () => {
    const d = defaultHomeData();
    expect(d.version).toBe(1);
    expect(d.pinned).toEqual(DEFAULT_PINNED);
  });

  it('homeFilePath 跟随 storagePath（尾斜杠去除）', () => {
    expect(homeFilePath()).toBe('CONFIG/STORAGE/home.json');
  });

  it('文件缺失 → 懒建并返回默认钉选', async () => {
    const data = await loadHomeData();
    expect(data.pinned).toEqual(DEFAULT_PINNED);
    // 文件已建
    expect(vault.files.has('CONFIG/STORAGE/home.json')).toBe(true);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/home.json')!).version).toBe(1);
  });

  it('saveHomeData 写回钉选清单（version 恒 1）', async () => {
    await saveHomeData({ version: 1, pinned: ['diary', 'pomodoro', 'settings'] });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/home.json')!);
    expect(raw.pinned).toEqual(['diary', 'pomodoro', 'settings']);
    expect(raw.version).toBe(1);
    // 读回
    const data = await loadHomeData();
    expect(data.pinned).toEqual(['diary', 'pomodoro', 'settings']);
  });

  it('损坏文件 → 重建默认（改名留档）', async () => {
    vault.files.set('CONFIG/STORAGE/home.json', '{{{not json');
    const data = await loadHomeData();
    expect(data.pinned).toEqual(DEFAULT_PINNED);
    const corrupt = [...vault.files.keys()].find((p) => p.includes('.corrupt-'));
    expect(corrupt).toBeTruthy();
  });

  it('归一：非数组 pinned / 非法元素过滤 / 空 pinned 回退默认', async () => {
    vault.files.set('CONFIG/STORAGE/home.json', JSON.stringify({ version: 1, pinned: 'nope' }));
    expect((await loadHomeData()).pinned).toEqual(DEFAULT_PINNED);

    vault.files.set('CONFIG/STORAGE/home.json', JSON.stringify({ version: 1, pinned: ['diary', 42, '', null] }));
    expect((await loadHomeData()).pinned).toEqual(['diary']);

    vault.files.set('CONFIG/STORAGE/home.json', JSON.stringify({ version: 1, pinned: [] }));
    expect((await loadHomeData()).pinned).toEqual(DEFAULT_PINNED);
  });

  it('未知域 id 保留读入（由 UI 层过滤渲染）', async () => {
    vault.files.set('CONFIG/STORAGE/home.json', JSON.stringify({ version: 1, pinned: ['diary', 'ghost-domain'] }));
    expect((await loadHomeData()).pinned).toEqual(['diary', 'ghost-domain']);
  });
});

describe('movePinnedInList（钉选排序纯函数，UI 编辑模式 ←/→ 用）', () => {
  it('右移/左移：与相邻位换位', () => {
    expect(movePinnedInList(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
    expect(movePinnedInList(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(movePinnedInList(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
  });

  it('越界（首卡左移/尾卡右移）原样返回：引用相等 = 无变化，调用方可跳过落盘', () => {
    const l = ['a', 'b'];
    expect(movePinnedInList(l, 'a', -1)).toBe(l);
    expect(movePinnedInList(l, 'b', 1)).toBe(l);
    expect(movePinnedInList(l, 'a', 0)).toBe(l);
  });

  it('找不到 id 原样返回', () => {
    const l = ['a', 'b'];
    expect(movePinnedInList(l, 'zz', 1)).toBe(l);
  });

  it('非法域 id（已退役 ghost 域）占位不动，排序只在合法域视图内换位', () => {
    const l = ['a', 'ghost', 'b', 'c'];
    const out = movePinnedInList(l, 'c', -1, (x) => x !== 'ghost');
    expect(out).toEqual(['a', 'ghost', 'c', 'b']);
    const out2 = movePinnedInList(l, 'a', 1, (x) => x !== 'ghost');
    expect(out2).toEqual(['b', 'ghost', 'a', 'c']);
  });
});
