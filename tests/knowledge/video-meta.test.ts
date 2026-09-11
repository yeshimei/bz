// @vitest-environment node
/**
 * 视频录入元信息抓取测试（src/knowledge/video-meta.ts，issue 278）：
 * parseBvid 各形态、view API 成功/风控/网络异常/超时、页面标题兜底（剔 B 站尾巴）、
 * 双失败 null、非 B 站 URL 只标题、非 URL 文本零请求。mock requestUrl 走共用 obsidian 替身。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { parseBvid, fetchVideoMeta } from '../../src/knowledge/video-meta';

// 宽松 mock 类型（先例随 tests/clipbook/rss-ui.test.ts）：罐头只补 status/text，免 RequestUrlResponse 形状体操
const reqMock = requestUrl as ReturnType<typeof vi.fn>;

/** requestUrl 罐头（issue 278）：补齐 RequestUrlResponse 形状（测试只消费 status/text；any 免类型体操） */
function httpResp(status: number, text: string): any {
  return {
    status,
    text,
    headers: {},
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
    json: async () => JSON.parse(text),
  };
}
/** view API 罐头 */
function viewResp(code: number, data?: unknown): any {
  return httpResp(200, JSON.stringify({ code, message: 'x', data }));
}
/** 页面 HTML 罐头（fetchPageTitle 取 <title>） */
function pageResp(title: string): any {
  return httpResp(200, `<html><head><title>${title}</title></head></html>`);
}

describe('parseBvid', () => {
  it('完整链接 / 裸 BV 号 → 10 位 bvid', () => {
    expect(parseBvid('https://www.bilibili.com/video/BV1awbg6XELn/?spm_id_from=333')).toBe('BV1awbg6XELn');
    expect(parseBvid('https://www.bilibili.com/video/BV1xx411c7mD')).toBe('BV1xx411c7mD');
    expect(parseBvid('BV1xx411c7mD')).toBe('BV1xx411c7mD');
  });
  it('非 10 位 / 短链 / 空文本 → null', () => {
    expect(parseBvid('BV123')).toBeNull(); // 非 10 位
    expect(parseBvid('https://b23.tv/jL9bKaX')).toBeNull(); // 短链无 BV 字样
    expect(parseBvid('随便一段话')).toBeNull();
    expect(parseBvid('')).toBeNull();
  });
});

describe('fetchVideoMeta', () => {
  beforeEach(() => {
    reqMock.mockReset();
    reqMock.mockImplementation(async () => httpResp(200, ''));
  });

  it('view API 成功（完整链接与裸号同路）→ {title, uploader}，请求只发 view API', async () => {
    reqMock.mockImplementationOnce(async () =>
      viewResp(0, { title: '演示视频标题', owner: { mid: 42, name: '演示UP' } }));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/?spm_id_from=333')).toEqual({
      title: '演示视频标题', uploader: '演示UP',
    });
    expect(reqMock).toHaveBeenCalledTimes(1);
    expect(reqMock.mock.calls[0][0]).toMatchObject({ url: 'https://api.bilibili.com/x/web-interface/view?bvid=BV1awbg6XELn' });
    reqMock.mockImplementationOnce(async () =>
      viewResp(0, { title: '裸号视频', owner: { mid: 1, name: 'UP甲' } }));
    expect(await fetchVideoMeta('BV1xx411c7mD')).toEqual({ title: '裸号视频', uploader: 'UP甲' });
  });

  it('风控（code!==0）/ 非 2xx / 网络异常 → 回退页面标题（剔 B 站尾巴、uploader 留空）', async () => {
    reqMock.mockImplementationOnce(async () => viewResp(-412, null));
    reqMock.mockImplementationOnce(async () => pageResp('某视频 _哔哩哔哩_bilibili'));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toEqual({ title: '某视频' });
    expect(reqMock).toHaveBeenCalledTimes(2);

    reqMock.mockImplementationOnce(async () => ({ status: 502, text: '' }));
    reqMock.mockImplementationOnce(async () => pageResp('另一视频-bilibili'));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toEqual({ title: '另一视频' });

    reqMock.mockRejectedValueOnce(new Error('网络炸了'));
    reqMock.mockImplementationOnce(async () => pageResp('第三个视频'));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toEqual({ title: '第三个视频' });
  });

  it('双失败（view 失败 + 页面无 title）→ null；裸 BV 号 view 失败无页面可兜底 → null 且只请求一次', async () => {
    reqMock.mockImplementationOnce(async () => viewResp(-352));
    reqMock.mockImplementationOnce(async () => pageResp('')); // 页面无 <title>
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toBeNull();
    expect(reqMock).toHaveBeenCalledTimes(2);

    reqMock.mockReset();
    reqMock.mockImplementationOnce(async () => viewResp(-412));
    expect(await fetchVideoMeta('BV1xx411c7mD')).toBeNull();
    expect(reqMock).toHaveBeenCalledTimes(1);
  });

  it('10s 超时：view API 挂起 → 兜底页面标题（http 链接）', async () => {
    vi.useFakeTimers();
    try {
      reqMock.mockImplementationOnce(() => new Promise(() => { /* 永不 resolve */ }));
      reqMock.mockImplementationOnce(async () => pageResp('超时兜底标题'));
      const p = fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/');
      await vi.advanceTimersByTimeAsync(10000);
      expect(await p).toEqual({ title: '超时兜底标题' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('非 B 站 URL（含 b23.tv）→ 只标题兜底、不调 view API', async () => {
    reqMock.mockImplementationOnce(async () => pageResp('什么是心流 - 知乎'));
    expect(await fetchVideoMeta('https://zhuanlan.zhihu.com/p/123')).toEqual({ title: '什么是心流' });
    expect(reqMock).toHaveBeenCalledTimes(1);
    expect(String((reqMock.mock.calls[0][0] as any).url)).toBe('https://zhuanlan.zhihu.com/p/123');

    reqMock.mockImplementationOnce(async () => pageResp('短链页标题'));
    expect(await fetchVideoMeta('https://b23.tv/jL9bKaX')).toEqual({ title: '短链页标题' });
    expect(reqMock).toHaveBeenCalledTimes(2);
  });

  it('非 URL 文本 → null 且零网络请求', async () => {
    expect(await fetchVideoMeta('随便一段话不是链接')).toBeNull();
    expect(await fetchVideoMeta('')).toBeNull();
    expect(await fetchVideoMeta('BV123')).toBeNull(); // 位数不够且非 URL
    expect(reqMock).not.toHaveBeenCalled();
  });

  it('view 成功但 data 残缺（无 owner）→ 只 title；title/owner 全空 → 走兜底', async () => {
    reqMock.mockImplementationOnce(async () => viewResp(0, { title: '只有标题' }));
    expect(await fetchVideoMeta('BV1xx411c7mD')).toEqual({ title: '只有标题' });

    reqMock.mockImplementationOnce(async () => viewResp(0, { title: '', owner: { mid: 1, name: '' } }));
    reqMock.mockImplementationOnce(async () => pageResp('残缺兜底'));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toEqual({ title: '残缺兜底' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
