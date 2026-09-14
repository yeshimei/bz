// @vitest-environment node
/**
 * 视频录入元信息抓取测试（src/knowledge/video-meta.ts，issue 278 / ADR-0133）：
 * parseBvid 各形态、view API 成功/风控/网络异常/超时、页面标题兜底（剔 B 站尾巴）、
 * 双失败 null、非 B 站 URL 零请求（联网范围仅限 B 站域，b23.tv 短链命中）、非 URL 文本零请求；
 * ADR-0133 扩展：pages/duration 净化、cookie 登录态校验（nav）、实测档位（playurl）、resolveVideo 组合。
 * ADR-0134 扩展：b23.tv 短链 → 落地页 og:url/__INITIAL_STATE__ 补全（桌面 videoData / 手机 video.viewInfo）、
 * meta.bvid 回传、页面 state 优先于 <title> 的具体降级次序。
 * mock requestUrl 走共用 obsidian 替身。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { parseBvid, parseBvidFromHtml, fetchVideoMeta, isCookieLoggedIn, fetchVideoQualities, resolveVideo } from '../../src/knowledge/video-meta';

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
/** 页面 HTML 罐头（只有 <title>：state/og:url 都没有的最薄页面） */
function pageResp(title: string): any {
  return httpResp(200, `<html><head><title>${title}</title></head></html>`);
}

/* ==================== ADR-0134：落地页 HTML 罐头 ==================== */

/** 桌面页罐头：og:url + `__INITIAL_STATE__`（videoData 形态，字段与 view API data 同名） */
function deskPage(bvid: string, data: Record<string, unknown>, title = '演示落地页 _哔哩哔哩_bilibili'): any {
  return httpResp(200, `<html><head><title>${title}</title><meta property="og:url" content="https://www.bilibili.com/video/${bvid}/"></head>`
    + `<body><script>window.__INITIAL_STATE__=${JSON.stringify({ videoData: { bvid, ...data } })};(function(){var a={b:1};})();</script></body></html>`);
}
/** 手机页罐头：og:url + `__INITIAL_STATE__`（video.viewInfo 形态，字段同名） */
function mobPage(bvid: string, data: Record<string, unknown>): any {
  return httpResp(200, `<html><head><title>手机落地页</title><meta property="og:url" content="https://www.bilibili.com/video/${bvid}/"></head>`
    + `<body><script>window.__INITIAL_STATE__=${JSON.stringify({ video: { viewInfo: { bvid, ...data } } })};</script></body></html>`);
}
/** 页面无 state、只有 og:url（拿得出 bvid，其他靠 view API） */
function ogOnlyPage(bvid: string): any {
  return httpResp(200, `<html><head><meta property="og:url" content="https://www.bilibili.com/video/${bvid}/"><title>只有 og 的页面</title></head></html>`);
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

  it('view API 成功（完整链接与裸号同路）→ {title, uploader, bvid}，请求只发 view API', async () => {
    reqMock.mockImplementationOnce(async () =>
      viewResp(0, { bvid: 'BV1awbg6XELn', title: '演示视频标题', owner: { mid: 42, name: '演示UP' } }));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/?spm_id_from=333')).toEqual({
      title: '演示视频标题', uploader: '演示UP', bvid: 'BV1awbg6XELn',
    });
    expect(reqMock).toHaveBeenCalledTimes(1);
    expect(reqMock.mock.calls[0][0]).toMatchObject({ url: 'https://api.bilibili.com/x/web-interface/view?bvid=BV1awbg6XELn' });
    reqMock.mockImplementationOnce(async () =>
      viewResp(0, { title: '裸号视频', owner: { mid: 1, name: 'UP甲' } }));
    // API data 没带 bvid（残缺回包）→ 输入里解析出的 bvid 兜底
    expect(await fetchVideoMeta('BV1xx411c7mD')).toEqual({ title: '裸号视频', uploader: 'UP甲', bvid: 'BV1xx411c7mD' });
  });

  it('风控（code!==0）/ 非 2xx / 网络异常 → 回退页面标题（剔 B 站尾巴、uploader 留空）', async () => {
    reqMock.mockImplementationOnce(async () => viewResp(-412, null));
    reqMock.mockImplementationOnce(async () => pageResp('某视频 _哔哩哔哩_bilibili'));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toEqual({ title: '某视频', bvid: 'BV1awbg6XELn' });
    expect(reqMock).toHaveBeenCalledTimes(2);

    reqMock.mockImplementationOnce(async () => ({ status: 502, text: '' }));
    reqMock.mockImplementationOnce(async () => pageResp('另一视频-bilibili'));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toEqual({ title: '另一视频', bvid: 'BV1awbg6XELn' });

    reqMock.mockRejectedValueOnce(new Error('网络炸了'));
    reqMock.mockImplementationOnce(async () => pageResp('第三个视频'));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toEqual({ title: '第三个视频', bvid: 'BV1awbg6XELn' });
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
      expect(await p).toEqual({ title: '超时兜底标题', bvid: 'BV1awbg6XELn' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('非 B 站 URL → null 且零请求（Q4 拍板：只净化不联网）；b23.tv 短链属 B 站 → 标题兜底', async () => {
    expect(await fetchVideoMeta('https://zhuanlan.zhihu.com/p/123')).toBeNull();
    expect(await fetchVideoMeta('https://github.com/jwbz/bz?utm_source=x')).toBeNull();
    expect(reqMock).not.toHaveBeenCalled();

    reqMock.mockImplementationOnce(async () => pageResp('短链页标题'));
    expect(await fetchVideoMeta('https://b23.tv/jL9bKaX')).toEqual({ title: '短链页标题' });
    expect(String((reqMock.mock.calls[0][0] as any).url)).toBe('https://b23.tv/jL9bKaX');
  });

  it('非 URL 文本 → null 且零网络请求', async () => {
    expect(await fetchVideoMeta('随便一段话不是链接')).toBeNull();
    expect(await fetchVideoMeta('')).toBeNull();
    expect(await fetchVideoMeta('BV123')).toBeNull(); // 位数不够且非 URL
    expect(reqMock).not.toHaveBeenCalled();
  });

  it('view 成功但 data 残缺（无 owner）→ 只 title；title/owner 全空 → 走兜底', async () => {
    reqMock.mockImplementationOnce(async () => viewResp(0, { title: '只有标题' }));
    expect(await fetchVideoMeta('BV1xx411c7mD')).toEqual({ title: '只有标题', bvid: 'BV1xx411c7mD' });

    reqMock.mockImplementationOnce(async () => viewResp(0, { title: '', owner: { mid: 1, name: '' } }));
    reqMock.mockImplementationOnce(async () => pageResp('残缺兜底'));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toEqual({ title: '残缺兜底', bvid: 'BV1awbg6XELn' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe('b23.tv 短链与落地页 state（ADR-0134）', () => {
  beforeEach(() => {
    reqMock.mockReset();
    reqMock.mockImplementation(async () => httpResp(200, ''));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('parseBvidFromHtml：og:url 优先 / state 的 bvid 字段兜底 / 都没有 → null', () => {
    expect(parseBvidFromHtml('<meta property="og:url" content="https://www.bilibili.com/video/BV1awbg6XELn/">')).toBe('BV1awbg6XELn');
    expect(parseBvidFromHtml('window.__INITIAL_STATE__={"bvid":"BV1xx411c7mD"}')).toBe('BV1xx411c7mD');
    expect(parseBvidFromHtml('<html><head><title>无 BV 的页面</title></head></html>')).toBeNull();
  });

  it('短链：先抓落地页拿 bvid，再走 view API（顺序断言）；API 命中即用 API 的元信息', async () => {
    reqMock.mockImplementationOnce(async () => deskPage('BV1awbg6XELn', { title: '落地页标题', owner: { name: '落地页UP' } }));
    reqMock.mockImplementationOnce(async () => viewResp(0, {
      bvid: 'BV1awbg6XELn', title: 'API 标题', owner: { name: 'API UP' }, duration: 199,
      pages: [{ cid: 7, page: 1, part: '正片', duration: 199 }],
    }));
    expect(await fetchVideoMeta('https://b23.tv/AtDgBVH')).toEqual({
      bvid: 'BV1awbg6XELn', title: 'API 标题', uploader: 'API UP', duration: 199,
      pages: [{ page: 1, part: '正片', duration: 199, cid: 7 }],
    });
    expect(String((reqMock.mock.calls[0][0] as any).url)).toBe('https://b23.tv/AtDgBVH'); // 第一枪抓短链（跟随重定向）
    expect(String((reqMock.mock.calls[1][0] as any).url)).toContain('web-interface/view?bvid=BV1awbg6XELn');
    expect(reqMock).toHaveBeenCalledTimes(2);
  });

  it('短链 + view API 不可用（风控/超时）→ 落地页 videoData 顶上：标题/UP主/分P/时长全给', async () => {
    reqMock.mockImplementationOnce(async () => deskPage('BV1awbg6XELn', {
      title: '落地页标题', owner: { name: '央视频' }, duration: 1015,
      pages: [
        { cid: 101, page: 1, part: '上', duration: 253 },
        { cid: 102, page: 2, part: '下', duration: 254 },
      ],
    }));
    reqMock.mockImplementationOnce(async () => viewResp(-412));
    expect(await fetchVideoMeta('https://b23.tv/AtDgBVH')).toEqual({
      bvid: 'BV1awbg6XELn', title: '落地页标题', uploader: '央视频', duration: 1015,
      pages: [
        { page: 1, part: '上', duration: 253, cid: 101 },
        { page: 2, part: '下', duration: 254, cid: 102 },
      ],
    });
  });

  it('手机落地页（video.viewInfo）同口径解析；JSON 后紧跟别的语句也截得准', async () => {
    reqMock.mockImplementationOnce(async () => mobPage('BV1xx411c7mD', {
      title: '手机页标题', owner: { name: '手机UP' }, duration: 300,
      pages: [{ cid: 5, page: 1, part: '', duration: 300 }],
    }));
    reqMock.mockImplementationOnce(async () => viewResp(-352));
    expect(await fetchVideoMeta('https://b23.tv/xyz7890')).toEqual({
      bvid: 'BV1xx411c7mD', title: '手机页标题', uploader: '手机UP', duration: 300,
      pages: [{ page: 1, part: '', duration: 300, cid: 5 }],
    });
  });

  it('state JSON 坏掉（截断/非法）→ 退回 <title> 清洗，不抛异常', async () => {
    reqMock.mockImplementationOnce(async () => httpResp(200,
      '<html><head><title>坏页 _哔哩哔哩_bilibili</title><meta property="og:url" content="https://www.bilibili.com/video/BV1awbg6XELn/"></head>'
      + '<body><script>window.__INITIAL_STATE__={"videoData":{"title":"坏</script></body></html>'));
    reqMock.mockImplementationOnce(async () => viewResp(-412));
    expect(await fetchVideoMeta('https://b23.tv/AtDgBVH')).toEqual({ title: '坏页', bvid: 'BV1awbg6XELn' });
  });

  it('短链落地页既无 og:url/state 也无可用标题 → null（失败态口径不变）', async () => {
    reqMock.mockImplementationOnce(async () => httpResp(200, '<html><body>拦截页</body></html>'));
    expect(await fetchVideoMeta('https://b23.tv/AtDgBVH')).toBeNull();
    expect(reqMock).toHaveBeenCalledTimes(1); // 无 bvid → 不发 API
  });

  it('短链页面无 state、只有 og:url → bvid 仍可用，元信息走 view API', async () => {
    reqMock.mockImplementationOnce(async () => ogOnlyPage('BV1awbg6XELn'));
    reqMock.mockImplementationOnce(async () => viewResp(0, { title: 'API 标题', owner: { name: 'API UP' } }));
    expect(await fetchVideoMeta('https://b23.tv/AtDgBVH')).toEqual({
      bvid: 'BV1awbg6XELn', title: 'API 标题', uploader: 'API UP',
    });
  });

  it('完整链接 + view API 失败 → 落地页 state 补齐 UP主/分P（不再只给标题）', async () => {
    reqMock.mockImplementationOnce(async () => viewResp(-412, null));
    reqMock.mockImplementationOnce(async () => deskPage('BV1awbg6XELn', {
      title: '页面标题', owner: { name: '页面UP' }, duration: 300,
      pages: [{ cid: 9, page: 1, part: '', duration: 300 }],
    }));
    expect(await fetchVideoMeta('https://www.bilibili.com/video/BV1awbg6XELn/')).toEqual({
      bvid: 'BV1awbg6XELn', title: '页面标题', uploader: '页面UP', duration: 300,
      pages: [{ page: 1, part: '', duration: 300, cid: 9 }],
    });
  });

  it('resolveVideo：短链也能查档位（bvid 由 meta 补出，不再依赖输入里的 BV 字样）', async () => {
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.startsWith('https://b23.tv/')) {
        return deskPage('BV1awbg6XELn', { title: 'T', owner: { name: 'U' }, duration: 100, pages: [{ cid: 5, page: 1, part: '', duration: 100 }] });
      }
      if (url.includes('web-interface/nav')) return httpResp(200, JSON.stringify({ code: 0, data: { isLogin: true } }));
      if (url.includes('player/playurl')) return httpResp(200, JSON.stringify({ code: 0, data: { dash: { video: [{ height: 1080 }, { height: 480 }] } } }));
      return httpResp(404, '');
    });
    const r = await resolveVideo('https://b23.tv/AtDgBVH', 'SESSDATA=x');
    expect(r!.meta.bvid).toBe('BV1awbg6XELn');
    expect(r!.qualities).toEqual([1080, 480]);
    const last = reqMock.mock.calls[reqMock.mock.calls.length - 1][0] as any;
    expect(String(last.url)).toContain('playurl?bvid=BV1awbg6XELn&cid=5');
  });
});

describe('view API 扩展解析（ADR-0133：pages 与 duration）', () => {
  beforeEach(() => {
    reqMock.mockReset();
    reqMock.mockImplementation(async () => httpResp(200, ''));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pages 净化：page 缺省按序补 / part 缺省空串 / duration 缺省回落总时长 / 无 cid 剔除', async () => {
    reqMock.mockImplementationOnce(async () => viewResp(0, {
      title: '多P视频', owner: { name: 'UP' }, duration: 300,
      pages: [
        { cid: 11, page: 1, part: '第一集', duration: 120 },
        { cid: 12, part: '第二集' },
        { page: 3, part: '缺cid' },
      ],
    }));
    expect(await fetchVideoMeta('BV1xx411c7mD')).toEqual({
      title: '多P视频',
      uploader: 'UP',
      bvid: 'BV1xx411c7mD',
      duration: 300,
      pages: [
        { page: 1, part: '第一集', duration: 120, cid: 11 },
        { page: 2, part: '第二集', duration: 300, cid: 12 },
      ],
    });
    expect(reqMock).toHaveBeenCalledTimes(1);
  });

  it('单 P 视频：pages 单项照常返回；非数 duration 不落 key', async () => {
    reqMock.mockImplementationOnce(async () => viewResp(0, {
      title: '单P', owner: { name: 'UP' }, duration: 'abc',
      pages: [{ cid: 7, page: 1, part: '', duration: 0 }],
    }));
    const meta = await fetchVideoMeta('BV1xx411c7mD');
    expect(meta!.duration).toBeUndefined();
    expect(meta!.pages).toEqual([{ page: 1, part: '', duration: 0, cid: 7 }]);
  });

  it('pages 全无效（无 cid）→ 不落 pages；title/owner 仍在 → 整体成功', async () => {
    reqMock.mockImplementationOnce(async () => viewResp(0, { title: 'T', owner: { name: 'U' }, pages: [{ part: 'x' }] }));
    const meta = await fetchVideoMeta('BV1xx411c7mD');
    expect(meta!.pages).toBeUndefined();
    expect(meta!.title).toBe('T');
  });
});

describe('cookie 登录态与实测档位（ADR-0133）', () => {
  beforeEach(() => {
    reqMock.mockReset();
    reqMock.mockImplementation(async () => httpResp(200, ''));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('isCookieLoggedIn：空 cookie 零请求；isLogin=true → true；false / 异常 → false', async () => {
    expect(await isCookieLoggedIn('')).toBe(false);
    expect(await isCookieLoggedIn('   ')).toBe(false);
    expect(reqMock).not.toHaveBeenCalled();

    reqMock.mockImplementationOnce(async () => httpResp(200, JSON.stringify({ code: 0, data: { isLogin: true } })));
    expect(await isCookieLoggedIn('SESSDATA=x')).toBe(true);
    expect(String((reqMock.mock.calls[0][0] as any).url)).toBe('https://api.bilibili.com/x/web-interface/nav');
    expect((reqMock.mock.calls[0][0] as any).headers).toEqual({ Cookie: 'SESSDATA=x' });

    reqMock.mockImplementationOnce(async () => httpResp(200, JSON.stringify({ code: 0, data: { isLogin: false } })));
    expect(await isCookieLoggedIn('SESSDATA=x')).toBe(false);

    reqMock.mockRejectedValueOnce(new Error('炸'));
    expect(await isCookieLoggedIn('SESSDATA=x')).toBe(false);
  });

  it('fetchVideoQualities：dash.video → height 降序去重；无 cookie / 无 dash / 空集 → null', async () => {
    expect(await fetchVideoQualities('BV1xx411c7mD', 1, '')).toBeNull();
    expect(await fetchVideoQualities('BV1xx411c7mD', 0, 'SESSDATA=x')).toBeNull();
    expect(reqMock).not.toHaveBeenCalled();

    reqMock.mockImplementationOnce(async () => httpResp(200, JSON.stringify({
      code: 0,
      data: { dash: { video: [{ height: 720 }, { height: 1080 }, { height: 720, codecs: 'hevc' }, { height: 360 }] } },
    })));
    expect(await fetchVideoQualities('BV1xx411c7mD', 137, 'SESSDATA=x')).toEqual([1080, 720, 360]);
    expect(String((reqMock.mock.calls[0][0] as any).url)).toContain('/x/player/playurl?bvid=BV1xx411c7mD&cid=137');

    reqMock.mockImplementationOnce(async () => httpResp(200, JSON.stringify({ code: 0, data: {} })));
    expect(await fetchVideoQualities('BV1xx411c7mD', 137, 'SESSDATA=x')).toBeNull();

    reqMock.mockImplementationOnce(async () => viewResp(-403));
    expect(await fetchVideoQualities('BV1xx411c7mD', 137, 'SESSDATA=x')).toBeNull();
  });

  it('resolveVideo：meta 双失败 → null（不发档位请求）；无 cookie → qualities null；登录态有效 → 按选中 P 的 cid 查询', async () => {
    // meta 双失败（view 404 + 页面 404）
    reqMock.mockImplementation(async () => httpResp(404, ''));
    expect(await resolveVideo('https://www.bilibili.com/video/BV1awbg6XELn/', 'SESSDATA=x')).toBeNull();
    expect(reqMock).toHaveBeenCalledTimes(2);

    // 无 cookie：只发 view 一次请求
    reqMock.mockReset();
    reqMock.mockImplementationOnce(async () => viewResp(0, { title: 'T', owner: { name: 'U' }, duration: 300, pages: [{ cid: 1, page: 1, part: '', duration: 100 }, { cid: 2, page: 2, part: '', duration: 200 }] }));
    const r1 = await resolveVideo('BV1xx411c7mD', '');
    expect(r1!.meta.title).toBe('T');
    expect(r1!.qualities).toBeNull();
    expect(reqMock).toHaveBeenCalledTimes(1);

    // 有 cookie + 登录有效：view → nav → playurl（pageIndex=1 → 用 P2 的 cid=2）
    reqMock.mockReset();
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return viewResp(0, { title: 'T', owner: { name: 'U' }, duration: 300, pages: [{ cid: 1, page: 1, part: '', duration: 100 }, { cid: 2, page: 2, part: '', duration: 200 }] });
      if (url.includes('web-interface/nav')) return httpResp(200, JSON.stringify({ code: 0, data: { isLogin: true } }));
      if (url.includes('player/playurl')) return httpResp(200, JSON.stringify({ code: 0, data: { dash: { video: [{ height: 1080 }, { height: 480 }] } } }));
      return httpResp(404, '');
    });
    const r2 = await resolveVideo('BV1xx411c7mD', 'SESSDATA=x', 1);
    expect(r2!.qualities).toEqual([1080, 480]);
    expect(String((reqMock.mock.calls[2][0] as any).url)).toContain('cid=2');

    // cookie 未登录：nav 判否 → 不发 playurl，qualities null
    reqMock.mockReset();
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return viewResp(0, { title: 'T', owner: { name: 'U' }, duration: 10, pages: [{ cid: 9, page: 1, part: '', duration: 10 }] });
      if (url.includes('web-interface/nav')) return httpResp(200, JSON.stringify({ code: 0, data: { isLogin: false } }));
      return httpResp(404, '');
    });
    const r3 = await resolveVideo('BV1xx411c7mD', 'expired');
    expect(r3!.qualities).toBeNull();
    expect(reqMock).toHaveBeenCalledTimes(2); // view + nav，无 playurl
  });
});
