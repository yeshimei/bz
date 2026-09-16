// @vitest-environment node
/**
 * core/ui/str 零依赖字符串工具测试（issue 347 机械项清扫）：
 * pad2（两位补零单源）/ emptyHtmlStr（空态字符串版，与 core/ui/empty uiEmpty 同 markup 口径）。
 * 纯函数无 DOM 依赖，node 环境直跑。
 */
import { describe, it, expect } from 'vitest';
import { emptyHtmlStr, pad2 } from '../../src/core/ui/str';

describe('pad2（两位补零单源）', () => {
  it('个位数补零、两位原样、字符串数字同型', () => {
    expect(pad2(3)).toBe('03');
    expect(pad2(0)).toBe('00');
    expect(pad2(12)).toBe('12');
    expect(pad2('7')).toBe('07');
  });
});

describe('emptyHtmlStr（空态字符串版）', () => {
  it('icon + title + desc 全量：bz-empty / bz-empty-ic / bz-empty-title / bz-empty-desc', () => {
    expect(emptyHtmlStr('book', '书库还是空的', '先放几本书')).toBe(
      '<div class="bz-empty"><i data-lucide="book" class="bz-ic bz-empty-ic"></i>' +
      '<div class="bz-empty-title">书库还是空的</div>' +
      '<div class="bz-empty-desc">先放几本书</div></div>'
    );
  });

  it('icon 传空串跳过图标节点（对齐 DOM 版 if (opts.icon)）', () => {
    expect(emptyHtmlStr('', '队列完毕')).toBe(
      '<div class="bz-empty"><div class="bz-empty-title">队列完毕</div></div>'
    );
  });

  it('desc 缺省跳过描述节点（对齐 DOM 版 if (opts.desc)）', () => {
    expect(emptyHtmlStr('loader', '正在整理书架…', '')).toBe(
      '<div class="bz-empty"><i data-lucide="loader" class="bz-ic bz-empty-ic"></i>' +
      '<div class="bz-empty-title">正在整理书架…</div></div>'
    );
  });

  it('title/desc 经 HTML 转义（icon 为受信 lucide 名不转义）', () => {
    const html = emptyHtmlStr('search', '没有找到 "<b>" 相关', '试试 <i>关键词</i> & 其他');
    expect(html).toContain('<div class="bz-empty-title">没有找到 &quot;&lt;b&gt;&quot; 相关</div>');
    expect(html).toContain('<div class="bz-empty-desc">试试 &lt;i&gt;关键词&lt;/i&gt; &amp; 其他</div>');
    expect(html).toContain('data-lucide="search"');
  });
});
