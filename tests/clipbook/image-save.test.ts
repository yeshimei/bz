// @vitest-environment node
/**
 * clipbook（issue 329 追加修订）：图片命名与全量本地化数据层测试。
 * 覆盖：imageNameFromUrl（URL 命中含中文/query 剥离/大小写兼容、无扩展名回落时间戳、
 * contentType 映射、非法字符清洗、畸形百分号不抛错）、extractImageUrls（去重保序/形态过滤）、
 * localizeArticleImages（下载落盘 + 全量映射、单张失败保留外链、savedImages 复用不重下、
 * 与划词 marks 共存经 applyBodyTransforms 同管线换链、进度回调计数）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { imageNameFromUrl, extractImageUrls, localizeArticleImages } from '../../src/clipbook/image-save';
import { applyBodyTransforms } from '../../src/clipbook/anchor';
import { requestUrl } from 'obsidian';

beforeEach(() => {
  resetObsidianMocks();
  setApp(mockAppWithVault(new MockVault()));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏', clipbookImageFolder: '' } as any));
  (requestUrl as ReturnType<typeof vi.fn>).mockReset();
});

/** 时间戳回落名的形态断言：clip-<8 位日>-<6 位时>-<seq>.<ext> */
const TS_SHAPE = (seq: number, ext: string) => new RegExp(`^clip-\\d{8}-\\d{6}-${seq}\\.${ext}$`);

describe('imageNameFromUrl（URL 命名，单图/全量两路统一）', () => {
  it('URL 命中：pathname 末段 + 扩展名，query 天然剥离', () => {
    expect(imageNameFromUrl('https://cdn.example.com/img/photo.png?x=1&t=2', 1)).toBe('photo.png');
    expect(imageNameFromUrl('https://cdn.example.com/a/b/c.PNG', 2)).toBe('c.png'); // 大小写兼容，归一小写
  });

  it('中文文件名（百分号编码解码后）命中', () => {
    const url = 'https://img.example.com/2026/' + encodeURIComponent('新闻配图') + '.jpg';
    expect(imageNameFromUrl(url, 1)).toBe('新闻配图.jpg');
  });

  it('jpeg 归一为 jpg；webp/svg/avif 原样', () => {
    expect(imageNameFromUrl('https://x.com/a.JPEG', 1)).toBe('a.jpg');
    expect(imageNameFromUrl('https://x.com/a.webp', 1)).toBe('a.webp');
    expect(imageNameFromUrl('https://x.com/a.svg', 1)).toBe('a.svg');
    expect(imageNameFromUrl('https://x.com/a.avif', 1)).toBe('a.avif');
  });

  it('无扩展名/非图片扩展名 → 时间戳回落 + contentType 映射扩展名', () => {
    expect(imageNameFromUrl('https://x.com/cover', 3)).toMatch(TS_SHAPE(3, 'jpg')); // 未知 contentType 默认 jpg
    expect(imageNameFromUrl('https://x.com/cover', 4, 'image/png')).toMatch(TS_SHAPE(4, 'png'));
    expect(imageNameFromUrl('https://x.com/cover', 5, 'image/gif')).toMatch(TS_SHAPE(5, 'gif'));
    expect(imageNameFromUrl('https://x.com/cover', 6, 'image/webp')).toMatch(TS_SHAPE(6, 'webp'));
    expect(imageNameFromUrl('https://x.com/cover', 7, 'image/jpeg')).toMatch(TS_SHAPE(7, 'jpg'));
    expect(imageNameFromUrl('https://x.com/page.php', 8, 'image/xyz')).toMatch(TS_SHAPE(8, 'jpg')); // 非图片扩展名不命中
  });

  it('非法字符清洗：空格/括号/百分号残留剥掉，保留中英文数字点横线下划线', () => {
    // decodeURIComponent('%20') → 空格、括号 → 全剥；点与扩展名保留 → 命中
    expect(imageNameFromUrl('https://x.com/my%20photo%20(1).png', 1)).toBe('myphoto1.png');
    // 下划线/横线/中文混排保留
    expect(imageNameFromUrl('https://x.com/图-床_名.png', 1)).toBe('图-床_名.png');
  });

  it('畸形百分号序列 decode 失败不抛错（原段清洗 + 命中判定）', () => {
    // %E4%BD 戛然而止 → decodeURIComponent 抛 URIError → 回落原段（含 % 剥掉）
    expect(imageNameFromUrl('https://x.com/%E4%BD.png', 1)).toBe('E4BD.png');
  });

  it('非 URL 形态 → 时间戳回落（不抛错）', () => {
    expect(imageNameFromUrl('not-a-url', 1)).toMatch(TS_SHAPE(1, 'jpg'));
  });
});

describe('extractImageUrls（正文外链图提取，去重保序）', () => {
  it('按出现序提取，重复 src 只留首处', () => {
    const body = '![a](https://x/1.png) 文字 ![b](https://x/2.png) 尾 ![c](https://x/1.png)';
    expect(extractImageUrls(body)).toEqual(['https://x/1.png', 'https://x/2.png']);
  });

  it('只收 http(s) 与协议相对地址；data:/相对路径不进下载流', () => {
    const body = [
      '![a](https://x/1.png)',
      '![b](//cdn.example.com/2.png)',
      '![c](data:image/png;base64,AAAA)',
      '![d](./local/3.png)',
      '![e](assets/4.png)',
      '普通[链接](https://x.com/page)不算图',
    ].join('\n');
    expect(extractImageUrls(body)).toEqual(['https://x/1.png', '//cdn.example.com/2.png']);
  });

  it('无图正文返回空数组；alt 含方括号内文字不干扰', () => {
    expect(extractImageUrls('纯文字正文。')).toEqual([]);
    expect(extractImageUrls('![含 **加粗** 的 alt](https://x/1.png)')).toEqual(['https://x/1.png']);
  });
});

describe('localizeArticleImages（全量本地化管线）', () => {
  /** requestUrl 按路径出假图：/bad/ 前缀 404，其余 200 png 二进制 */
  function mockFetch(): void {
    (requestUrl as ReturnType<typeof vi.fn>).mockImplementation(async (opts: any) => {
      if (String(opts.url).includes('/bad/')) return { status: 404, arrayBuffer: new ArrayBuffer(0) };
      return {
        status: 200,
        arrayBuffer: new TextEncoder().encode('bytes:' + String(opts.url)).buffer,
        headers: { 'content-type': 'image/png' },
      };
    });
  }

  it('全量下载落盘 + 组 src→local 映射；喂 imageSwaps 管线后正文全换本地嵌入', async () => {
    mockFetch();
    const body = '前 ![甲](https://a.example/x.png) 中 ![乙](https://b.example/新闻图.png) 后';
    const res = await localizeArticleImages({ body, existing: [] });
    expect(res.localized).toBe(2);
    expect(res.failed).toBe(0);
    expect(res.swaps).toEqual([
      { src: 'https://a.example/x.png', local: '归档/网页剪藏/assets/x.png' },
      { src: 'https://b.example/新闻图.png', local: '归档/网页剪藏/assets/新闻图.png' },
    ]);
    // 二进制真的落盘
    expect((getAppVault() as any).binaryFiles.has('归档/网页剪藏/assets/x.png')).toBe(true);
    expect((getAppVault() as any).binaryFiles.has('归档/网页剪藏/assets/新闻图.png')).toBe(true);
    // 与划词同一变换管线：外链全部消失
    const r = applyBodyTransforms(body, [], res.swaps);
    expect(r.body).toBe('前 ![[归档/网页剪藏/assets/x.png]] 中 ![[归档/网页剪藏/assets/新闻图.png]] 后');
    expect(r.body).not.toContain('https://');
  });

  it('单张失败保留外链不阻断：失败图不进映射，其余照常换链', async () => {
    mockFetch();
    const body = '![好图](https://a.example/ok.png) 和 ![坏图](https://a.example/bad/gone.png)';
    const res = await localizeArticleImages({ body, existing: [] });
    expect(res.localized).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.swaps).toEqual([{ src: 'https://a.example/ok.png', local: '归档/网页剪藏/assets/ok.png' }]);
    const r = applyBodyTransforms(body, [], res.swaps);
    expect(r.body).toContain('![[归档/网页剪藏/assets/ok.png]]');
    expect(r.body).toContain('![坏图](https://a.example/bad/gone.png)'); // 失败图保留原外链
  });

  it('侧写 savedImages 复用不重下：命中 src 直接用旧 local，requestUrl 不发起', async () => {
    mockFetch();
    const body = '![旧图](https://a.example/saved.png) ![新图](https://a.example/new.png)';
    const res = await localizeArticleImages({
      body,
      existing: [{ src: 'https://a.example/saved.png', local: '归档/网页剪藏/assets/旧图_2.png' }],
    });
    expect(res.swaps).toEqual([
      { src: 'https://a.example/saved.png', local: '归档/网页剪藏/assets/旧图_2.png' },
      { src: 'https://a.example/new.png', local: '归档/网页剪藏/assets/new.png' },
    ]);
    expect(res.localized).toBe(1); // 只有新图真下载
    const urls = (requestUrl as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => String(c[0].url));
    expect(urls.some((u: string) => u.includes('saved.png'))).toBe(false);
    expect(urls.some((u: string) => u.includes('new.png'))).toBe(true);
  });

  it('与划词 marks 共存：图片换链 + 别名双链同管线产出（先图后词顺序稳定）', async () => {
    mockFetch();
    const body = '![图](https://a.example/x.png) 里讲到了量子纠缠。';
    const res = await localizeArticleImages({ body, existing: [] });
    const r = applyBodyTransforms(body, [{ find: '量子纠缠', notePath: '文献盒/Q.md', kind: 'term' }], res.swaps);
    expect(r.body).toBe('![[归档/网页剪藏/assets/x.png]] 里讲到了[[Q|量子纠缠]]。');
    expect(r.marks).toHaveLength(1);
    expect(r.images).toEqual(res.swaps);
  });

  it('进度回调按张上报（done 从 1 计到 total，复用张也计入）', async () => {
    mockFetch();
    const progress: Array<[number, number]> = [];
    await localizeArticleImages({
      body: '![a](https://a.example/1.png) ![b](https://a.example/2.png)',
      existing: [{ src: 'https://a.example/1.png', local: '归档/网页剪藏/assets/1.png' }],
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(progress).toEqual([[1, 2], [2, 2]]);
  });

  it('无图正文零下载零请求', async () => {
    mockFetch();
    const res = await localizeArticleImages({ body: '纯文字。', existing: [] });
    expect(res.swaps).toEqual([]);
    expect(requestUrl).not.toHaveBeenCalled();
  });
});

/** 当前 app 的 vault（断言落盘用） */
function getAppVault(): MockVault {
  return getApp().vault as unknown as MockVault;
}
