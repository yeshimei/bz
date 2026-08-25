// @vitest-environment node
/**
 * MobileBuffer 覆盖率补测（.vec 头部固定用本类）：
 * alloc 零填充、writeUInt32LE 小端写入、concat 的两种入参
 * （MobileBuffer 实例 / 裸 Uint8Array）与跨段拼接正确性。
 */
import { describe, it, expect } from 'vitest';
import { MobileBuffer } from '../../src/flash/binary';

describe('MobileBuffer', () => {
  it('alloc：指定长度全零缓冲，writeUInt32LE 按小端写入', () => {
    const mb = MobileBuffer.alloc(4);
    expect(mb._data.length).toBe(4);
    expect([...mb._data]).toEqual([0, 0, 0, 0]);
    mb.writeUInt32LE(2, 0); // .vec 头部 dim=2 的真实写法
    expect([...mb._data]).toEqual([2, 0, 0, 0]);
    mb.writeUInt32LE(0x11223344, 0);
    expect([...mb._data]).toEqual([0x44, 0x33, 0x22, 0x11]); // 小端字节序
  });

  it('concat：MobileBuffer 与裸 Uint8Array 混拼（instanceof 两分支），字节序保持', () => {
    const header = MobileBuffer.alloc(4);
    header.writeUInt32LE(3, 0);
    const payload = new Uint8Array([9, 8, 7, 6, 5, 4]); // 裸 Uint8Array 分支
    const out = MobileBuffer.concat([header, payload, header]); // 再次传实例分支
    expect(out._data.length).toBe(14);
    expect([...out._data.slice(0, 4)]).toEqual([3, 0, 0, 0]);
    expect([...out._data.slice(4, 10)]).toEqual([9, 8, 7, 6, 5, 4]);
    expect([...out._data.slice(10, 14)]).toEqual([3, 0, 0, 0]);
    // 返回值仍是 MobileBuffer，可继续按小端读
    const dim = new DataView(out._data.buffer, out._data.byteOffset, 4).getUint32(0, true);
    expect(dim).toBe(3);
  });

  it('concat：空数组拼接得零长度缓冲；带 byteOffset 的子数组按逻辑内容拼接', () => {
    expect(MobileBuffer.concat([])._data.length).toBe(0);
    const parent = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const sub = parent.subarray(2, 6); // byteOffset=2，只应拷贝逻辑内容 3..6
    const out = MobileBuffer.concat([sub]);
    expect([...out._data]).toEqual([3, 4, 5, 6]);
  });

  it('writeUInt32LE：基于带偏移的视图写入落在本元素内（不污染底层共享 buffer 前段）', () => {
    const parent = new Uint8Array(8);
    const sub = parent.subarray(4);
    const mb = new MobileBuffer(sub);
    mb.writeUInt32LE(1, 0);
    expect([...parent.slice(0, 4)]).toEqual([0, 0, 0, 0]); // 前段不受影响
    expect(parent[4]).toBe(1);
  });
});
