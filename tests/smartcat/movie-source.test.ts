/**
 * 影视动作观察文案层（ticket 074，方法监听修订）：文案构造纯函数全覆盖——
 * 创建三态/状态六向流转/评分改分/影评写改删/删除/事件映射。
 */
import { describe, it, expect } from 'vitest';
import {
  movieCreatedText, movieStatusChangeText, movieRatedText, movieReviewText,
  movieDeletedText, buildMovieActionText,
} from '../../src/smartcat/movie-source';

describe('movieCreatedText（创建影视）', () => {
  it('想看 / 在看', () => {
    expect(movieCreatedText('美丽人生', 'want', -1, null)).toBe('你把《美丽人生》加入想看');
    expect(movieCreatedText('美丽人生', 'watching', 0, null)).toBe('你开始看《美丽人生》');
  });
  it('已看：无评分只记看完；有评分附分；有影评附摘要（≤80 截断）', () => {
    expect(movieCreatedText('美丽人生', 'watched', null, null)).toBe('你看完了《美丽人生》');
    expect(movieCreatedText('美丽人生', 'watched', 5, null)).toBe('你看完了《美丽人生》，给了 5 分');
    expect(movieCreatedText('美丽人生', 'watched', 5, '经典')).toBe('你看完了《美丽人生》，给了 5 分，写了影评：经典');
    const long = '评'.repeat(100);
    expect(movieCreatedText('美丽人生', 'watched', 5, long)).toContain(long.slice(0, 80));
  });
});

describe('movieStatusChangeText（状态流转）', () => {
  it('六向流转文案', () => {
    expect(movieStatusChangeText('美丽人生', 'want', 'watching')).toBe('你把《美丽人生》从想看改为在看');
    expect(movieStatusChangeText('美丽人生', 'want', 'watched')).toBe('你看完了《美丽人生》');
    expect(movieStatusChangeText('美丽人生', 'watching', 'watched')).toBe('你看完了《美丽人生》');
    expect(movieStatusChangeText('美丽人生', 'watched', 'want')).toBe('你把《美丽人生》改回想看');
    expect(movieStatusChangeText('美丽人生', 'watching', 'want')).toBe('你把《美丽人生》从在看改为想看');
    expect(movieStatusChangeText('美丽人生', 'watched', 'watching')).toBe('你把《美丽人生》从已看改为在看');
  });
});

describe('movieRatedText（评分/改分，小数完整）', () => {
  it('改前无分 → 首次评分；改前有分 → 改分', () => {
    expect(movieRatedText('美丽人生', null, 4.5)).toBe('你给《美丽人生》评了 4.5 分');
    expect(movieRatedText('美丽人生', 0, 4.5)).toBe('你给《美丽人生》评了 4.5 分');
    expect(movieRatedText('美丽人生', 3.5, 4.5)).toBe('你把《美丽人生》的评分从 3.5 改为 4.5');
  });
});

describe('movieReviewText（影评 写/改/删；空串视为无）', () => {
  it('写 / 改 / 删 / 无变化', () => {
    expect(movieReviewText('美丽人生', null, '经典')).toBe('你写了《美丽人生》的影评：经典');
    expect(movieReviewText('美丽人生', '', '经典')).toBe('你写了《美丽人生》的影评：经典'); // 空字段视为无
    expect(movieReviewText('美丽人生', '经典', '神作')).toBe('你改了《美丽人生》的影评：神作');
    expect(movieReviewText('美丽人生', '经典', null)).toBe('你删掉了《美丽人生》的影评');
    expect(movieReviewText('美丽人生', '经典', '')).toBe('你删掉了《美丽人生》的影评');
    expect(movieReviewText('美丽人生', null, null)).toBeNull();
    expect(movieReviewText('美丽人生', '经典', '经典')).toBeNull();
  });
});

describe('movieDeletedText（删除影视）', () => {
  it('删除观察文案', () => {
    expect(movieDeletedText('美丽人生')).toBe('你删除了《美丽人生》的影视记录');
  });
});

describe('buildMovieActionText（事件 → 观察文本）', () => {
  it('全动作映射', () => {
    expect(buildMovieActionText({ kind: 'created', name: '美丽人生', status: 'want', rating: -1, review: null })).toBe('你把《美丽人生》加入想看');
    expect(buildMovieActionText({ kind: 'status', name: '美丽人生', from: 'want', to: 'watching' })).toBe('你把《美丽人生》从想看改为在看');
    expect(buildMovieActionText({ kind: 'rated', name: '美丽人生', fromRating: 3.5, toRating: 4.5 })).toBe('你把《美丽人生》的评分从 3.5 改为 4.5');
    expect(buildMovieActionText({ kind: 'review', name: '美丽人生', fromReview: null, toReview: '经典' })).toBe('你写了《美丽人生》的影评：经典');
    expect(buildMovieActionText({ kind: 'deleted', name: '美丽人生' })).toBe('你删除了《美丽人生》的影视记录');
  });
  it('无变化（影评前后同）→ null', () => {
    expect(buildMovieActionText({ kind: 'review', name: '美丽人生', fromReview: '经典', toReview: '经典' })).toBeNull();
  });
});