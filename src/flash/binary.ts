/**
 * 闪念二进制工具（ticket 18，源码 MobileBuffer L36-75 逐字）
 */
export const HAS_BUFFER = typeof Buffer !== 'undefined';

/** 移动端 Buffer 回退（无 node Buffer） */
export class MobileBuffer {
  _data: Uint8Array;
  _view: DataView;

  constructor(data: Uint8Array) {
    this._data = data;
    this._view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  static alloc(size: number): MobileBuffer {
    return new MobileBuffer(new Uint8Array(size));
  }

  static from(arr: number[] | Uint8Array | string): MobileBuffer {
    if (typeof arr === 'string') {
      return new MobileBuffer(new TextEncoder().encode(arr));
    }
    return new MobileBuffer(arr instanceof Uint8Array ? arr : new Uint8Array(arr));
  }

  static concat(parts: (Uint8Array | MobileBuffer)[]): MobileBuffer {
    const arrays = parts.map((p) => (p instanceof MobileBuffer ? p._data : p));
    const total = arrays.reduce((s, a) => s + a.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
      out.set(a, offset);
      offset += a.byteLength;
    }
    return new MobileBuffer(out);
  }

  get byteLength(): number {
    return this._data.byteLength;
  }

  get buffer(): ArrayBuffer {
    return this._data.buffer.slice(this._data.byteOffset, this._data.byteOffset + this._data.byteLength) as ArrayBuffer;
  }

  get byteOffset(): number {
    return this._data.byteOffset;
  }

  readUInt32LE(offset: number): number {
    return this._view.getUint32(offset, true);
  }

  writeUInt32LE(value: number, offset: number): void {
    this._view.setUint32(offset, value, true);
  }
}

/** 安全 Buffer：有 node Buffer 用 Buffer，否则 MobileBuffer */
export const SafeBuffer: typeof Buffer | typeof MobileBuffer = HAS_BUFFER ? Buffer : MobileBuffer;
