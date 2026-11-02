/**
 * 文档显隐开关（core/doc-visibility.ts，2026-11-02）。
 *
 * 这里钉的是「隐藏」这件事本身的两个面：
 *  1. 默认值 = 关（更新日志已内置、使用手册已由视频教程取代，两者都不再下载、不再出行）；
 *  2. 功能没删——开关翻回 true，行为与隐藏前一模一样，代码/清单/弹窗都还在。
 * 每次改默认值都要同时改这里，免得以后有人把开关翻回去却没人知道该验什么。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { DOC_VISIBILITY, docListedInResources } from '../../src/core/doc-visibility';

const DEFAULTS = { ...DOC_VISIBILITY };

afterEach(() => {
  Object.assign(DOC_VISIBILITY, DEFAULTS);
});

describe('doc-visibility：默认值', () => {
  it('三处默认都是关：日志与手册不进在线资源 / 引导页 / 自动更新，手册也不挂文档组', () => {
    expect(DOC_VISIBILITY.changelogInResources).toBe(false);
    expect(DOC_VISIBILITY.manualInResources).toBe(false);
    expect(DOC_VISIBILITY.manualInDocNav).toBe(false);
  });

  it('默认：changelog / manual 不列进在线资源，其余条目照列', () => {
    expect(docListedInResources('changelog')).toBe(false);
    expect(docListedInResources('manual')).toBe(false);
    // 分类表 / 源库 / 索引 / 外部工具包不受这份开关管
    expect(docListedInResources('belongings-categories')).toBe(true);
    expect(docListedInResources('cinema-douban-index')).toBe(true);
    expect(docListedInResources('tool-dock-watch')).toBe(true);
  });
});

describe('doc-visibility：翻回 true 即恢复（隐藏不是删除）', () => {
  it('changelogInResources 翻开 → changelog 重新列进在线资源', () => {
    DOC_VISIBILITY.changelogInResources = true;
    expect(docListedInResources('changelog')).toBe(true);
    expect(docListedInResources('manual')).toBe(false); // 两个开关互不牵连
  });

  it('manualInResources 翻开 → manual 重新列进在线资源', () => {
    DOC_VISIBILITY.manualInResources = true;
    expect(docListedInResources('manual')).toBe(true);
  });
});
