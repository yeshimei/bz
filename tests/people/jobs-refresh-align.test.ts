// @vitest-environment node
/**
 * refresh 重切批的断点对齐（D 组拍板）：任务自身合并升级素材（refresh）后整体重切批次时，
 * 旧已完成批按首末日期对齐复用——新切批次中 from/to 与某条旧已完成批完全匹配的保留断点，
 * 从第一个不匹配批起清断点（batchesDone 截到匹配前缀、results 截断），后续批重跑。
 * 修复前：batchesDone / results 原样保留、从新布局的第 batchesDone 批续跑——
 * 新布局头部增量素材漏提炼、重叠段重复烧钱。
 */
import { describe, it, expect } from 'vitest';
import { alignRefreshedBatches } from '../../src/people/jobs';
import type { ChunkMeta } from '../../src/people/digest';

const meta = (from: string, to: string, count = 1): ChunkMeta => ({ from, to, count });

describe('alignRefreshedBatches（refresh 断点对齐）', () => {
  it('旧 3 批已完成、refresh 后前 2 批边界不变：保留 2 批断点（results 由调用方截到 2 条）', () => {
    const oldDone = [meta('2024-05-01', '2024-05-02'), meta('2024-05-03', '2024-05-04'), meta('2024-05-05', '2024-05-06')];
    const fresh = [meta('2024-05-01', '2024-05-02'), meta('2024-05-03', '2024-05-04'), meta('2024-05-05', '2024-05-07'), meta('2024-05-08', '2024-05-09')];
    expect(alignRefreshedBatches(oldDone, fresh)).toBe(2);
  });

  it('边界全变：从第一批起清零重跑', () => {
    const oldDone = [meta('2024-05-01', '2024-05-02'), meta('2024-05-03', '2024-05-04'), meta('2024-05-05', '2024-05-06')];
    const fresh = [meta('2024-05-01', '2024-05-01'), meta('2024-05-02', '2024-05-03'), meta('2024-05-04', '2024-05-06')];
    expect(alignRefreshedBatches(oldDone, fresh)).toBe(0);
  });

  it('中间断开即止：前缀匹配（宁多烧不漏炼），不跳着复用', () => {
    const oldDone = [meta('2024-05-01', '2024-05-02'), meta('2024-05-03', '2024-05-04'), meta('2024-05-05', '2024-05-06')];
    const fresh = [meta('2024-05-01', '2024-05-02'), meta('2024-05-06', '2024-05-06'), meta('2024-05-03', '2024-05-04')];
    expect(alignRefreshedBatches(oldDone, fresh)).toBe(1);
  });

  it('新切批比旧已完成批还少 / 旧断点为 0：按短边收敛，0 对 0', () => {
    const oldDone = [meta('2024-05-01', '2024-05-02'), meta('2024-05-03', '2024-05-04')];
    expect(alignRefreshedBatches(oldDone, [meta('2024-05-01', '2024-05-02')])).toBe(1);
    expect(alignRefreshedBatches([], [meta('2024-05-01', '2024-05-02')])).toBe(0);
    expect(alignRefreshedBatches(oldDone, [])).toBe(0);
  });
});
