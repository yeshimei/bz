// @vitest-environment node
/**
 * 术语来源纯函数测试（src/knowledge/source.ts，ADR-0116）：
 * isUrlLikeSourceText（宽松域名判定）/ cleanUrlText / noteSourceName / serializeTermSource（落键唯一入口）。
 * 纯数据层：无 DOM，node 环境直跑。
 */
import { describe, it, expect } from 'vitest';
import {
  isUrlLikeSourceText,
  cleanUrlText,
  normalizeSourceUrl,
  cleanSourceTitle,
  noteSourceName,
  serializeTermSource,
} from '../../src/knowledge/source';

describe('isUrlLikeSourceText（整串无空白 + URL/域名样式 → 外部链接；其余归笔记搜索）', () => {
  it('http(s) 前缀 → 外部（含查询串/路径）', () => {
    expect(isUrlLikeSourceText('https://b23.tv/abcDEF')).toBe(true);
    expect(isUrlLikeSourceText('https://www.bilibili.com/video/BV1xx411c7mD?p=2')).toBe(true);
    expect(isUrlLikeSourceText('http://example.cn/x')).toBe(true);
  });

  it('无协议但形如域名 → 外部（宽松域名字样：b23.tv 单标签+TLD、www 开头、多级域名）', () => {
    expect(isUrlLikeSourceText('b23.tv/abcDEF')).toBe(true);
    expect(isUrlLikeSourceText('www.bilibili.com/video/BV1xx')).toBe(true);
    expect(isUrlLikeSourceText('zhuanlan.zhihu.com/p/123456')).toBe(true);
    expect(isUrlLikeSourceText('blog.example.com.cn/archives/1')).toBe(true);
  });

  it('非 URL → 笔记搜索方向（BV 号不做平台特判、中文、含空白的文本、纯单标）', () => {
    expect(isUrlLikeSourceText('BV1xx411c7mD')).toBe(false); // 无域名字样，拍板不做 B 站特判
    expect(isUrlLikeSourceText('认知心理学')).toBe(false);
    expect(isUrlLikeSourceText('A股 术语 是什么')).toBe(false); // 含空白整串保护
    expect(isUrlLikeSourceText('localhost:8080')).toBe(false); // 无域名 TLD
    expect(isUrlLikeSourceText('')).toBe(false);
    expect(isUrlLikeSourceText('   ')).toBe(false);
  });
});

describe('cleanUrlText（落库前净化：剥尾随中英文标点）', () => {
  it('剥中文/英文句尾标点，保留路径内字符', () => {
    expect(cleanUrlText('https://b23.tv/abcDEF，')).toBe('https://b23.tv/abcDEF');
    expect(cleanUrlText('https://x.com/a?b=1。')).toBe('https://x.com/a?b=1');
    expect(cleanUrlText('  https://x.com/a  ')).toBe('https://x.com/a');
    expect(cleanUrlText('https://x.com/a?q=1,2')).toBe('https://x.com/a?q=1,2'); // 逗号在参数中不剥
  });
});

describe('noteSourceName（内部笔记展示名：显式 name 优先，缺省取文件名）', () => {
  it('路径取去目录去 .md 的文件名；显式名优先；反斜杠兼容', () => {
    expect(noteSourceName('我的/日记/心流体验.md')).toBe('心流体验');
    expect(noteSourceName('我的/日记/心流体验.md', '体验心流')).toBe('体验心流');
    expect(noteSourceName('CONFIG\\APPENDIX\\v2.md')).toBe('v2');
    expect(noteSourceName('', '标题甲')).toBe('标题甲');
  });
});

describe('serializeTermSource（frontmatter 键值唯一入口）', () => {
  it('内部笔记 → source=[[路径|名]]', () => {
    expect(serializeTermSource({ kind: 'note', path: '我的/日记/心流体验.md' }))
      .toEqual({ source: '[[我的/日记/心流体验.md|心流体验]]' });
    expect(serializeTermSource({ kind: 'note', path: 'a/b.md', name: 'B' }))
      .toEqual({ source: '[[a/b.md|B]]' });
  });

  it('外部链接 → source=URL 原文（净化尾标点）；带标题 → 追加 sourceTitle', () => {
    expect(serializeTermSource({ kind: 'external', url: 'https://b23.tv/abc，' }))
      .toEqual({ source: 'https://b23.tv/abc' });
    expect(serializeTermSource({ kind: 'external', url: 'https://zhuanlan.zhihu.com/p/1', title: '标题' }))
      .toEqual({ source: 'https://zhuanlan.zhihu.com/p/1', sourceTitle: '标题' });
    expect(serializeTermSource({ kind: 'external', url: 'https://x.com', title: '  ' }))
      .toEqual({ source: 'https://x.com' }); // 空白标题不落键
  });

  it('无来源 / 空值 → null（不写键）', () => {
    expect(serializeTermSource(null)).toBeNull();
    expect(serializeTermSource(undefined)).toBeNull();
    expect(serializeTermSource({ kind: 'note', path: '  ' })).toBeNull();
    expect(serializeTermSource({ kind: 'external', url: '' })).toBeNull();
  });

  it('落库统一走净化：追踪参数剥除 + 标题尾巴剥除（issue 257 补记）', () => {
    const withParams = serializeTermSource({ kind: 'external', url: 'https://www.bilibili.com/video/BV1x?spm_id_from=1&p=2' });
    expect(withParams?.source).toBe('https://www.bilibili.com/video/BV1x?p=2');
    expect(serializeTermSource({ kind: 'external', url: 'https://b23.tv/x', title: '标题 _哔哩哔哩_bilibili' }))
      .toEqual({ source: 'https://b23.tv/x', sourceTitle: '标题' });
  });
});

describe('normalizeSourceUrl（追踪参数剥除，issue 257 补记：保持简洁可读）', () => {
  it('B 站视频页：spm_id_from/vd_source 等追踪全剥，只留 p（分P）/t（时间点）内容性参数', () => {
    expect(normalizeSourceUrl('https://www.bilibili.com/video/BV1awbg6XELn/?spm_id_from=333.1391.0.0&vd_source=15205b8944be621a94fb0bf0efdb81f3'))
      .toBe('https://www.bilibili.com/video/BV1awbg6XELn/');
    expect(normalizeSourceUrl('https://www.bilibili.com/video/BV1x?p=2&t=30&spm_id_from=1'))
      .toBe('https://www.bilibili.com/video/BV1x?p=2&t=30');
  });

  it('b23.tv 短链：query 全是分享追踪 → 整段剥掉', () => {
    expect(normalizeSourceUrl('https://b23.tv/abcDEF?share_token=x&spm_id_from=y')).toBe('https://b23.tv/abcDEF');
  });

  it('其余站点：剥 utm_*/spm_* 前缀与黑名单键；功能性参数与 hash 保留', () => {
    expect(normalizeSourceUrl('https://zhuanlan.zhihu.com/p/123?utm_source=wechat')).toBe('https://zhuanlan.zhihu.com/p/123');
    expect(normalizeSourceUrl('https://x.com/a?keep=1&utm_term=2&vd_source=z#sec')).toBe('https://x.com/a?keep=1#sec');
    expect(normalizeSourceUrl('https://x.com/a')).toBe('https://x.com/a');
  });

  it('非 http(s) 文本原样返回；净化幂等', () => {
    expect(normalizeSourceUrl('BV1xx411c7mD')).toBe('BV1xx411c7mD');
    const once = normalizeSourceUrl('https://www.bilibili.com/video/BV1x?p=3&vd_source=z');
    expect(normalizeSourceUrl(once)).toBe(once);
  });
});

describe('cleanSourceTitle（站点尾巴剥除 + 实体解码，issue 257 补记）', () => {
  it('B 站 `_哔哩哔哩_bilibili` / `-bilibili` 尾巴剥除（用户实例）', () => {
    expect(cleanSourceTitle('对话汉斯·季默！如何用一段旋律创造一个电影宇宙？ _哔哩哔哩_bilibili'))
      .toBe('对话汉斯·季默！如何用一段旋律创造一个电影宇宙？');
    expect(cleanSourceTitle('某视频-bilibili')).toBe('某视频');
  });

  it('知乎系尾巴剥除；无尾巴标题原样', () => {
    expect(cleanSourceTitle('如何早睡 - 知乎')).toBe('如何早睡');
    expect(cleanSourceTitle('文章 - 知乎专栏')).toBe('文章');
    expect(cleanSourceTitle('问答 - 知乎日报')).toBe('问答');
    expect(cleanSourceTitle('普通标题')).toBe('普通标题');
  });

  it('实体解码 + 空白折叠', () => {
    expect(cleanSourceTitle('A &amp; B&quot;C&quot;&nbsp; D')).toBe('A & B"C" D');
  });
});
