/**
 * 第二大脑二进制工具（ticket 103；对齐 QA 闪念.js MobileBuffer L36-75）
 * 写 .vec 头部固定用本类（alloc 从 0 起，避免 Node Buffer 池偏移）。
 */
export class MobileBuffer {
  _data: Uint8Array;
  private _view: DataView;

  constructor(data: Uint8Array) {
    this._data = data;
    this._view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  static alloc(size: number): MobileBuffer {
    return new MobileBuffer(new Uint8Array(size));
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

  writeUInt32LE(value: number, offset: number): void {
    this._view.setUint32(offset, value, true);
  }
}
