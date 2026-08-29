/**
 * core 键控卡片列表增量 patch 测试（ticket 139）：
 * 空容器插入 / 未变化复用（changedKeys 空 = 全复用）/ changedKeys 命中重建替换 / 渲染相同不替换 /
 * 移除消失 key / 调序移动节点 / 首卡前非键控装饰原位保留 / render 返回 null 保留旧卡。
 * 碰 DOM → 不加 node 环境标注。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { patchKeyedCards } from '../../src/core/list-patch';

function card(key: string, text = key): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.path = key;
  el.textContent = text;
  return el;
}

function keyed(container: HTMLElement): string[] {
  return Array.from(container.children)
    .filter((el) => el.hasAttribute('data-path'))
    .map((el) => (el as HTMLElement).dataset.path!);
}

describe('patchKeyedCards（ticket 139 卡片级增量刷新）', () => {
  let box: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    box = document.createElement('div');
    document.body.appendChild(box);
  });

  it('空容器插入全部目标卡片（按 keys 顺序）', () => {
    const st = patchKeyedCards({ container: box, keyAttr: 'path', keys: ['a', 'b'], render: (k) => card(k) });
    expect(st.added).toBe(2);
    expect(keyed(box)).toEqual(['a', 'b']);
  });

  it('changedKeys 为空集：同序卡片全部复用原节点，不重建不替换', () => {
    const a = card('a');
    const b = card('b');
    box.append(a, b);
    const st = patchKeyedCards({
      container: box, keyAttr: 'path', keys: ['a', 'b'],
      render: (k) => card(k, k + '新'), changedKeys: new Set<string>(),
    });
    expect(st.added).toBe(0);
    expect(st.updated).toBe(0);
    expect(box.children[0]).toBe(a);
    expect(box.children[1]).toBe(b);
    expect(b.textContent).toBe('b');
  });

  it('changedKeys 命中 → 重建并替换节点', () => {
    const a = card('a');
    box.append(a);
    const st = patchKeyedCards({
      container: box, keyAttr: 'path', keys: ['a'],
      render: (k) => card(k, '新版'), changedKeys: new Set(['a']),
    });
    expect(st.updated).toBe(1);
    expect(box.children[0]).not.toBe(a);
    expect((box.children[0] as HTMLElement).textContent).toBe('新版');
  });

  it('重建结果与旧卡相同 → 不替换（保住事件绑定）', () => {
    const a = card('a');
    box.append(a);
    const st = patchKeyedCards({
      container: box, keyAttr: 'path', keys: ['a'],
      render: (k) => card(k), changedKeys: new Set(['a']),
    });
    expect(st.updated).toBe(0);
    expect(box.children[0]).toBe(a);
  });

  it('目标 keys 中消失的 key → 卡片移除', () => {
    box.append(card('a'), card('b'), card('c'));
    const st = patchKeyedCards({
      container: box, keyAttr: 'path', keys: ['a', 'c'],
      render: (k) => card(k), changedKeys: new Set<string>(),
    });
    expect(st.removed).toBe(1);
    expect(keyed(box)).toEqual(['a', 'c']);
  });

  it('调序：节点复用只移动位置', () => {
    const a = card('a');
    const b = card('b');
    const c = card('c');
    box.append(a, b, c);
    const st = patchKeyedCards({
      container: box, keyAttr: 'path', keys: ['c', 'a', 'b'],
      render: (k) => card(k), changedKeys: new Set<string>(),
    });
    expect(keyed(box)).toEqual(['c', 'a', 'b']);
    expect(box.children[0]).toBe(c);
    expect(box.children[1]).toBe(a);
    expect(st.moved).toBeGreaterThan(0);
    expect(st.added).toBe(0);
  });

  it('首卡前的非键控装饰原位保留（不被越过）', () => {
    const banner = document.createElement('div');
    banner.className = 'hint';
    box.appendChild(banner);
    box.appendChild(card('a'));
    patchKeyedCards({
      container: box, keyAttr: 'path', keys: ['a', 'b'],
      render: (k) => card(k), changedKeys: new Set<string>(),
    });
    expect(box.children[0]).toBe(banner);
    expect(keyed(box)).toEqual(['a', 'b']);
  });

  it('render 返回 null：新 key 跳过插入，既有 key 保留旧卡', () => {
    box.append(card('a'));
    const st = patchKeyedCards({
      container: box, keyAttr: 'path', keys: ['a', 'gone'],
      render: (k) => (k === 'gone' ? null : card(k)), changedKeys: new Set(['a']),
    });
    expect(keyed(box)).toEqual(['a']);
    expect(st.added).toBe(0);
    expect(st.removed).toBe(0);
  });
});
