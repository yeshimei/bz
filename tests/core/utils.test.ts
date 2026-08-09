// @vitest-environment node
/**
 * core 工具层测试（ticket 02）：纯函数逐字对照 Q3 行为。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateId,
  extractUrlAndDisplay,
  formatFileSize,
  formatRelativeTime,
  getPlatformName,
  DEFAULT_PLATFORM_MAP,
} from '../../src/core/utils';
import { setApp } from '../../src/core/app';
import { requestUrl } from '../mock-obsidian-entry';
import { fetchPageTitle } from '../../src/core/utils';

const now = new Date(2025, 5, 15, 12, 0, 0); // 2025-06-15 12:00

describe('generateId', () => {
  it('格式为 prefix-时间戳-随机6位', () => {
    const id = generateId('bz');
    expect(id.startsWith('bz-')).toBe(true);
    const parts = id.split('-');
    expect(parts.length).toBe(3);
    expect(parts[2].length).toBe(6);
    expect(Number(parts[1])).toBeGreaterThan(0);
  });

  it('缺省 prefix 为 item', () => {
    expect(generateId().startsWith('item-')).toBe(true);
  });

  it('同一毫秒内多次调用仍唯一（随机段）', () => {
    const a = generateId('x');
    const b = generateId('x');
    expect(a).not.toBe(b);
  });
});

describe('extractUrlAndDisplay', () => {
  it('markdown 链接 [显示](url)', () => {
    expect(extractUrlAndDisplay('[我的博客](https://example.com/a)')).toEqual({
      url: 'https://example.com/a',
      display: '我的博客',
    });
  });

  it('裸 URL（前后有文字时去掉 URL 作显示名，保留两侧空格）', () => {
    expect(extractUrlAndDisplay('看看这个 https://example.com/page 不错')).toEqual({
      url: 'https://example.com/page',
      display: '看看这个  不错',
    });
  });

  it('纯 URL → display 即 URL', () => {
    expect(extractUrlAndDisplay('https://example.com')).toEqual({
      url: 'https://example.com',
      display: 'https://example.com',
    });
  });

  it('无 URL → {url: null, display: 原文}', () => {
    expect(extractUrlAndDisplay('普通文字')).toEqual({ url: null, display: '普通文字' });
  });
});

describe('formatFileSize', () => {
  it('K 显示（<1024KB）', () => {
    expect(formatFileSize(20480)).toBe('20K');
  });
  it('M 显示（≥1024KB，两位小数）', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00M');
  });
  it('0/空返回 null', () => {
    expect(formatFileSize(0)).toBeNull();
    expect(formatFileSize(null)).toBeNull();
  });
});

describe('formatRelativeTime', () => {
  it('无效日期', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('无效日期');
  });

  it('未来时间 → YYYY-MM-DD HH:mm', () => {
    expect(formatRelativeTime('2025-06-20 08:30', now)).toBe('2025-06-20 08:30');
  });

  it('未来纯日期（无时间）→ YYYY-MM-DD', () => {
    expect(formatRelativeTime('2025-06-20', now)).toBe('2025-06-20');
  });

  it('1 分钟内 → 刚刚', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 30 * 1000), now)).toBe('刚刚');
  });

  it('1 小时内 → N分钟前', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000), now)).toBe('5分钟前');
  });

  it('今天内 → N小时前', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 3600 * 1000), now)).toBe('3小时前');
  });

  it('昨天 → 昨天 HH:mm（有时间）', () => {
    expect(formatRelativeTime('2025-06-14 10:00', now)).toBe('昨天 10:00');
  });

  it('昨天纯日期 → 昨天', () => {
    expect(formatRelativeTime('2025-06-14', now)).toBe('昨天');
  });

  it('前天 → 前天', () => {
    expect(formatRelativeTime('2025-06-13', now)).toBe('前天');
  });

  it('当年内 → MM-DD', () => {
    expect(formatRelativeTime('2025-05-01', now)).toBe('05-01');
  });

  it('跨年 → YYYY-MM-DD', () => {
    expect(formatRelativeTime('2024-12-31', now)).toBe('2024-12-31');
  });
});

describe('getPlatformName / DEFAULT_PLATFORM_MAP', () => {
  it('默认映射 7 项', () => {
    expect(DEFAULT_PLATFORM_MAP.map((p) => p.name)).toEqual([
      '知乎日报', '知乎专栏', '知乎', '果壳', '小黑盒', '豆瓣', '微信公众号',
    ]);
  });

  it('精确 host 匹配', () => {
    expect(getPlatformName('https://zhihu.com/question/1')).toBe('知乎');
  });

  it('子域后缀匹配（daily.zhihu.com → 知乎日报 优先）', () => {
    expect(getPlatformName('https://daily.zhihu.com/story/1')).toBe('知乎日报');
  });

  it('自定义映射（keyword 匹配）', () => {
    const map = [{ keyword: 'example', name: '示例站' }];
    expect(getPlatformName('https://a.example.com/x', map)).toBe('示例站');
  });

  it('无效 URL / 空 → null', () => {
    expect(getPlatformName('')).toBeNull();
    expect(getPlatformName(null)).toBeNull();
    expect(getPlatformName('not a url')).toBeNull();
  });
});

describe('fetchPageTitle', () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  it('请求成功且含 <title> → 返回标题', async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: '<html><head><title>  测试标题  </title></head></html>',
    });
    expect(await fetchPageTitle('https://example.com')).toBe('测试标题');
    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com', method: 'GET' })
    );
  });

  it('请求失败/无 title → null', async () => {
    vi.mocked(requestUrl).mockRejectedValue(new Error('网络错误'));
    expect(await fetchPageTitle('https://example.com')).toBeNull();

    vi.mocked(requestUrl).mockResolvedValue({ status: 404, text: '<html></html>' });
    expect(await fetchPageTitle('https://example.com')).toBeNull();
  });
});
