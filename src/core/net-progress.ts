/* ============================================================
 * bz · 带进度的字节下载（core/net-progress.ts）
 *
 * 为什么另起一条：`requestUrl` 只给「下载完了」这一个时刻，没有中间态。36MB 的便携 Node
 * 在慢网下要几分钟，界面只能显示一个不动的小圈——用户以为卡死了，去点第二次。
 *
 * 走 `fetch` + `ReadableStream` 就够：GitHub raw 这类源发 `access-control-allow-origin: *`，
 * 浏览器里能直接读（Electron 渲染进程等于 Chromium）。拿不到流（别的源 / 老环境 / 被拦）就整块读，
 * 至少还能给「开始/结束」两态。
 *
 * **失败一律返回 null，不抛**：调用方回落到 `requestUrl`（它绕 CORS、走 Electron 网络栈，
 * 是「一定能通」的那条备用路）。这里只是「能显示进度就显示」，不能变成新的故障点。
 * ============================================================ */

/** 单次下载的字节上限（防被一个无限流拖死；正常归档都不超过 200MB） */
const MAX_BYTES = 300 * 1024 * 1024;

/**
 * 下载并回调进度。
 *
 * @param onProgress 已收字节、总字节（总字节未知 = 0；UI 自己决定显示「37%」还是「12.3 MB」）
 * @returns 完整字节；任何失败（含不支持流、非 2xx、超限）→ null
 */
export async function fetchBytesWithProgress(
  url: string,
  onProgress?: (received: number, total: number) => void,
): Promise<Uint8Array | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res?.ok) return null;
    const total = Number(res.headers?.get?.('content-length') || 0);

    const body = res.body as ReadableStream<Uint8Array> | null | undefined;
    if (!body || typeof (body as { getReader?: unknown }).getReader !== 'function') {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) return null;
      onProgress?.(buf.byteLength, total || buf.byteLength);
      return buf;
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      got += value.byteLength;
      if (got > MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          /* 取消失败无所谓，反正要丢掉 */
        }
        return null;
      }
      chunks.push(value);
      onProgress?.(got, total);
    }
    if (!got) return null;
    const out = new Uint8Array(got);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return out;
  } catch {
    // CORS 被拦 / DNS 不通 / 流中断 —— 交给 requestUrl
    return null;
  }
}
