/**
 * 影视动作感知观察（ticket 074）：parse/strip/diff 纯函数全覆盖——
 * 状态六向流转、评分/改分、影评写改删、正文剥海报双链、create/delete、无变化 null。
 */
import { describe, it, expect } from 'vitest';
import {
  stripPosterLink, parseMovieFileContent, movieStatusOf, movieNameOf,
  movieCreatedObservation, movieChangedObservation, movieDeletedObservation,
} from '../../src/smartcat/movie-source';
import type { MovieSnapshot } from '../../src/smartcat/movie-source';

const snap = (over: Partial<MovieSnapshot> = {}): MovieSnapshot => ({
  path: '我的/影视/《美丽人生》.md',
  name: '美丽人生',
  rating: null,
  review: '',
  watchDate: null,
  body: '',
  ...over,
});

describe('movieNameOf（影视名提取）', () => {
  it('书名号去壳 / 后缀剥离 / 无书名号原样', () => {
    expect(movieNameOf('《美丽人生》')).toBe('美丽人生');
    expect(movieNameOf('《楚门的世界》观后感')).toBe('楚门的世界');
    expect(movieNameOf('某笔记')).toBe('某笔记');
    expect(movieNameOf('')).toBe('');
  });
});

describe('movieStatusOf（评分三值语义，对齐 movie/data.ts）', () => {
  it('-1 想看 / 0 在看 / >0 或缺失 已看', () => {
    expect(movieStatusOf(-1)).toBe('want');
    expect(movieStatusOf(0)).toBe('watching');
    expect(movieStatusOf(2.5)).toBe('watched');
    expect(movieStatusOf(null)).toBe('watched');
  });
});

describe('stripPosterLink（剥海报展示双链）', () => {
  it('首行海报双链剥除', () => {
    expect(stripPosterLink('![[CONFIG/MOVIE POSTER/x.png]]\n今天二刷，依然感动')).toBe('今天二刷，依然感动');
  });
  it('纯文字行保留；行内双链（非纯嵌入行）保留', () => {
    expect(stripPosterLink('今天二刷')).toBe('今天二刷');
    expect(stripPosterLink('看 ![[附件.png]] 的截图')).toBe('看 ![[附件.png]] 的截图');
  });
  it('仅有海报行的正文剥空', () => {
    expect(stripPosterLink('![[CONFIG/MOVIE POSTER/美丽人生_1.jpg]]')).toBe('');
  });
  it('多行海报全剥（同一规则）', () => {
    expect(stripPosterLink('![[A.png]]\n![[B.jpg]]\n正文')).toBe('正文');
  });
});

describe('parseMovieFileContent（frontmatter + 剥海报正文）', () => {
  it('评分小数/负值/零/缺失', () => {
    expect(parseMovieFileContent('---\n评分: 4.5\n---\n正文').rating).toBe(4.5);
    expect(parseMovieFileContent('---\n评分: -1\n---\n正文').rating).toBe(-1);
    expect(parseMovieFileContent('---\n评分: 0\n---\n正文').rating).toBe(0);
    expect(parseMovieFileContent('---\n类型: 电影\n---\n正文').rating).toBeNull();
  });
  it('影评字段（含空值）与观影日期；豆瓣评分不误读', () => {
    const p = parseMovieFileContent('---\n评分: 5\n豆瓣评分: 7.8\n影评: 经典\n观影日期: 2026-08-23\n---\n正文');
    expect(p.rating).toBe(5);
    expect(p.review).toBe('经典');
    expect(p.watchDate).toBe('2026-08-23');
    expect(parseMovieFileContent('---\n影评:\n---\n正文').review).toBe('');
  });
  it('正文剥 frontmatter 且剥海报双链；无 frontmatter 纯正文', () => {
    expect(parseMovieFileContent('---\n评分: 5\n---\n![[CONFIG/MOVIE POSTER/x.png]]\n二刷记录').body).toBe('二刷记录');
    expect(parseMovieFileContent('无头正文内容').body).toBe('无头正文内容');
  });
});

describe('movieCreatedObservation（新增影视）', () => {
  it('想看 / 在看', () => {
    expect(movieCreatedObservation(snap({ rating: -1 }))).toBe('你把《美丽人生》加入想看');
    expect(movieCreatedObservation(snap({ rating: 0 }))).toBe('你开始看《美丽人生》');
  });
  it('已看：无评分只记看完；有评分附分；有影评附摘要（≤80 截断）', () => {
    expect(movieCreatedObservation(snap({ rating: null }))).toBe('你看完了《美丽人生》');
    expect(movieCreatedObservation(snap({ rating: 5 }))).toBe('你看完了《美丽人生》，给了 5 分');
    expect(movieCreatedObservation(snap({ rating: 5, review: '经典' }))).toBe('你看完了《美丽人生》，给了 5 分，写了影评：经典');
    const long = '评'.repeat(100);
    expect(movieCreatedObservation(snap({ rating: 5, review: long }))).toContain(long.slice(0, 80));
  });
});

describe('movieChangedObservation（状态/评分/影评/正文 diff）', () => {
  it('状态六向流转文案', () => {
    expect(movieChangedObservation(snap({ rating: -1 }), snap({ rating: 0 }))!.text).toBe('你把《美丽人生》从想看改为在看');
    expect(movieChangedObservation(snap({ rating: -1 }), snap({ rating: 5 }))!.text).toBe('你看完了《美丽人生》');
    expect(movieChangedObservation(snap({ rating: 0 }), snap({ rating: 3.5 }))!.text).toBe('你看完了《美丽人生》');
    expect(movieChangedObservation(snap({ rating: 5 }), snap({ rating: -1 }))!.text).toBe('你把《美丽人生》改回想看');
    expect(movieChangedObservation(snap({ rating: 0 }), snap({ rating: -1 }))!.text).toBe('你把《美丽人生》从在看改为想看');
    expect(movieChangedObservation(snap({ rating: 5 }), snap({ rating: 0 }))!.text).toBe('你把《美丽人生》从已看改为在看');
  });
  it('评分（首次>0）与改分（小数完整保留）', () => {
    expect(movieChangedObservation(snap({ rating: null }), snap({ rating: 4.5 }))!.text).toBe('你给《美丽人生》评了 4.5 分');
    expect(movieChangedObservation(snap({ rating: 3.5 }), snap({ rating: 4.5 }))!.text).toBe('你把《美丽人生》的评分从 3.5 改为 4.5');
  });
  it('影评写/改/删（frontmatter 字段）', () => {
    expect(movieChangedObservation(snap({}), snap({ review: '经典' }))!.text).toBe('你写了《美丽人生》的影评：经典');
    expect(movieChangedObservation(snap({ review: '经典' }), snap({ review: '神作' }))!.text).toBe('你改了《美丽人生》的影评：神作');
    expect(movieChangedObservation(snap({ review: '经典' }), snap({ review: '' }))!.text).toBe('你删掉了《美丽人生》的影评');
  });
  it('正文变化：带 body 标记（调用方节流），剥海报后无内容不观察', () => {
    const obs = movieChangedObservation(snap({}), snap({ body: '今天二刷' }));
    expect(obs!.text).toBe('你在《美丽人生》的笔记里写了：今天二刷');
    expect(obs!.body).toBe(true);
    expect(movieChangedObservation(snap({ body: '昨天看过' }), snap({ body: '' }))).toBeNull();
  });
  it('无相关变化（仅观影日期变）→ null；正文为空且未变 → null', () => {
    const a = snap({ rating: 5, review: '经典', body: '内容' });
    expect(movieChangedObservation(a, { ...a, watchDate: '2026-09-01' })).toBeNull();
    expect(movieChangedObservation(snap({}), snap({}))).toBeNull();
  });
  it('状态变化优先：流转同时改评分/影评 → 只取状态文案（一次一条）', () => {
    const obs = movieChangedObservation(snap({ rating: 0, review: '' }), snap({ rating: 5, review: '哇' }));
    expect(obs!.text).toBe('你看完了《美丽人生》');
  });
});

describe('movieDeletedObservation（删除影视）', () => {
  it('有快照的删除产生删除观察', () => {
    expect(movieDeletedObservation(snap({ name: '美丽人生' }))).toBe('你删除了《美丽人生》的影视记录');
  });
});