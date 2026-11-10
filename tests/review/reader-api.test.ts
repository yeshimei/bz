/**
 * 复习计划对外门面（review/reader-api.ts）。
 *
 * 门面是插件实例上挂给外部的那一层：bz-reader 只能靠 typeof 探测判断
 * 「这台 bz 有没有这个能力」，所以注册/撤销必须显式、且撤销后取到 null——
 * 插件禁用再启用时旧门面不能留在内存里。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getReviewPlanApi, setReviewPlanApi, type ReviewPlanApi } from '../../src/review/reader-api';

function fakeApi(): ReviewPlanApi {
  return {
    isReady: () => true,
    hasNote: async () => false,
    addNote: async () => ({ added: true }),
    addNotes: async () => ({ added: 0, exists: 0, notFound: 0 }),
    removeNote: async () => false,
    statusOf: async () => [],
  };
}

describe('复习计划门面注册', () => {
  beforeEach(() => setReviewPlanApi(null));
  afterEach(() => setReviewPlanApi(null));

  it('未注册时取到 null', () => {
    expect(getReviewPlanApi()).toBeNull();
  });

  it('注册后取到同一份', () => {
    const api = fakeApi();
    setReviewPlanApi(api);
    expect(getReviewPlanApi()).toBe(api);
  });

  it('撤销后重新取到 null', () => {
    setReviewPlanApi(fakeApi());
    setReviewPlanApi(null);
    expect(getReviewPlanApi()).toBeNull();
  });
});
