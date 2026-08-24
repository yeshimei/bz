// @vitest-environment node
/**
 * 记忆向量行对齐测试（P1-27 向量行错位修复）：
 * 两条 addObservation 受控交错（第一条 push 后在 embedding 处挂起、第二条整体完成），
 * vectorIndexMap 必须各自指向 stream 中的正确行——旧实现取 await 交错后的 length-1 会错指。
 * 向量模块 mock（getEmbedding/checkRemoteOllama），不碰网络。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmbedding } from '../../src/flash/ollama';
import { MemorySystem } from '../../src/smartcat/memory';
import { defaultSmartCatData } from '../../src/smartcat/data';
import type { SmartCatData } from '../../src/smartcat/types';

vi.mock('../../src/flash/ollama', () => ({
  getEmbedding: vi.fn(),
  checkRemoteOllama: vi.fn(async () => true),
}));

function make(): { m: MemorySystem; data: SmartCatData } {
  const data = defaultSmartCatData();
  const m = new MemorySystem({ vault: { adapter: {} } } as any, () => data, async () => {});
  (m as any).ollamaAvailable = true; // 跳过网络探测（appendVector 首关直接放行）
  return { m, data };
}

describe('appendVector 行号定位（P1-27）', () => {
  beforeEach(() => {
    vi.mocked(getEmbedding).mockReset();
  });

  it('受控交错：第一条 push 后挂起、第二条完成后，vectorIndexMap 各自指向正确行且向量行序对齐', async () => {
    const { m, data } = make();
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => { releaseA = resolve; });
    const descA = '用户说：先写入但后完成的记忆A';
    const descB = '用户说：后写入先完成的记忆B';
    vi.mocked(getEmbedding).mockImplementation(async (text: string) => {
      if (text === descA) {
        await gateA; // 第一条挂起（模拟 await 交错窗口）
        return [1, 1];
      }
      return [-2, 2]; // 第二条立即完成（与 A 正交，便于余弦断言区分）
    });

    const pA = m.addObservation(descA, { importance: 0.5 }); // push A → 挂起在 A 的 embedding
    const memB = (await m.addObservation(descB, { importance: 0.5 }))!; // B 整体完成
    releaseA(); // B 完成后再放行 A 的 embedding
    const memA = (await pA)!;

    expect(memA).not.toBeNull();
    const idxA = data.memory.stream.indexOf(memA!);
    const idxB = data.memory.stream.indexOf(memB);
    expect(idxA).toBe(0);
    expect(idxB).toBe(1);

    const map = (m as any).vectorIndexMap as Map<string, number>;
    expect(map.get(memA!.id)).toBe(0); // 旧实现 length-1 会错指 1
    expect(map.get(memB.id)).toBe(1);

    // 向量内容也按行对齐：row0 = A 的向量、row1 = B 的向量
    const vectors = (m as any).vectors as Float64Array;
    const dim = (m as any).dim as number;
    expect(dim).toBe(2);
    expect(Array.from(vectors.slice(0 * dim, 1 * dim))).toEqual([1, 1]);
    expect(Array.from(vectors.slice(1 * dim, 2 * dim))).toEqual([-2, 2]);
    // 检索侧经映射取行一致（semanticRelevance 走 vectorIndexMap）
    const relA = m.semanticRelevance(memA!.id, [1, 1]);
    const relB = m.semanticRelevance(memB.id, [1, 1]);
    expect(relA).toBeCloseTo(1, 5);
    expect(relB).toBeCloseTo(0, 5);
  });

  it('正常顺序追加仍保持旧行为（回归）：逐条 push 行号递增', async () => {
    const { m, data } = make();
    vi.mocked(getEmbedding).mockResolvedValue([3, 3]);
    const m1 = await m.addObservation('第一条', { importance: 0.5 });
    const m2 = await m.addObservation('第二条', { importance: 0.5 });
    const map = (m as any).vectorIndexMap as Map<string, number>;
    expect(map.get(m1!.id)).toBe(0);
    expect(map.get(m2!.id)).toBe(1);
    expect(data.memory.stream.length).toBe(2);
  });
});
