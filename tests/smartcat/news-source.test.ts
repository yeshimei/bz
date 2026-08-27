// @vitest-environment node
/**
 * 聚合讯观察文案层（ticket 076）：buildNewsReadText 三态文案 + buildNewsSavedFullText 摘要/标签拼接——
 * 阅读带分钟/跳过无时长/保存立即形态；补全形态：摘要+标签 / 只摘要 / 只标签 / 都缺省略。
 * P2b：buildNewsReadStructured / buildNewsSavedStructured 结构化元数据映射。
 */
import { describe, it, expect } from 'vitest';
import { buildNewsReadText, buildNewsSavedFullText, buildNewsReadStructured, buildNewsSavedStructured } from '../../src/smartcat/news-source';

describe('buildNewsReadText（逐篇三态文案，用户拍板）', () => {
  it('阅读：标题 + 平台 + 读了 N 分钟', () => {
    expect(buildNewsReadText('read', '黑洞照片刷新认知', '果壳', 5)).toBe('你阅读了《黑洞照片刷新认知》（果壳·读了 5 分钟）');
  });
  it('跳过：标题 + 平台，不带时长（即使传入分钟数）', () => {
    expect(buildNewsReadText('skipped', '黑洞照片刷新认知', '知乎日报', 1)).toBe('你跳过了《黑洞照片刷新认知》（知乎日报）');
  });
  it('保存（立即形态）：标题 + 平台 + 读了 N 分钟', () => {
    expect(buildNewsReadText('saved', '黑洞照片刷新认知', '知乎热榜', 3)).toBe('你保存了《黑洞照片刷新认知》（知乎热榜·读了 3 分钟）');
  });
});

describe('buildNewsSavedFullText（保存完整形态：摘要/标签拼接，缺省省略）', () => {
  it('摘要 + 标签 → 读：摘要 #标签…', () => {
    expect(buildNewsSavedFullText('黑洞照片刷新认知', '果壳', 5, '首张黑洞照片公布，视觉中国被质疑滥用版权。', ['科学', 'AI']))
      .toBe('你保存了《黑洞照片刷新认知》（果壳·读了 5 分钟）：首张黑洞照片公布，视觉中国被质疑滥用版权。 #科学 #AI');
  });
  it('只摘要无标签 → 省略标签段', () => {
    expect(buildNewsSavedFullText('A', '果壳', 2, '只有摘要', null)).toBe('你保存了《A》（果壳·读了 2 分钟）：只有摘要');
    expect(buildNewsSavedFullText('A', '果壳', 2, '只有摘要', [])).toBe('你保存了《A》（果壳·读了 2 分钟）：只有摘要');
  });
  it('只标签无摘要 → 省略摘要段', () => {
    expect(buildNewsSavedFullText('A', '果壳', 2, null, ['AI'])).toBe('你保存了《A》（果壳·读了 2 分钟） #AI');
  });
  it('摘要标签都缺 → 落回立即形态', () => {
    expect(buildNewsSavedFullText('A', '果壳', 2, null, null)).toBe('你保存了《A》（果壳·读了 2 分钟）');
  });
});

// ==================== P2b StructuredMeta 映射测试 ====================

describe('buildNewsReadStructured（阅读事件 → StructuredMeta，行为流）', () => {
  it('read：entityType=news, action=read, extras 含 platform/durationMin', () => {
    const s = buildNewsReadStructured({ title: '黑洞照片', platform: '果壳', state: 'read', durationMin: 5 });
    expect(s).toEqual({ entityType: 'news', action: 'read', name: '黑洞照片', extras: { platform: '果壳', durationMin: 5 } });
  });
  it('skipped：action=skipped', () => {
    const s = buildNewsReadStructured({ title: '文章', platform: '知乎', state: 'skipped', durationMin: 1 });
    expect(s.action).toBe('skipped');
    expect(s.name).toBe('文章');
  });
  it('saved：action=saved', () => {
    const s = buildNewsReadStructured({ title: '文章', platform: '知乎', state: 'saved', durationMin: 3 });
    expect(s.action).toBe('saved');
  });
});

describe('buildNewsSavedStructured（保存完整观察 → StructuredMeta，行为流）', () => {
  it('有摘要+标签 → extras 含 summary/tags', () => {
    const s = buildNewsSavedStructured('黑洞照片', '果壳', 5, '首张黑洞照片公布', ['科学', 'AI']);
    expect(s).toEqual({ entityType: 'news', action: 'saved', name: '黑洞照片', extras: { platform: '果壳', durationMin: 5, summary: '首张黑洞照片公布', tags: ['科学', 'AI'] } });
  });
  it('无摘要无标签 → extras summary/tags 为 undefined', () => {
    const s = buildNewsSavedStructured('文章', '知乎', 2, null, null);
    expect(s.extras!.summary).toBeUndefined();
    expect(s.extras!.tags).toBeUndefined();
  });
});