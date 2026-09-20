// @vitest-environment node
/**
 * memo 拍板执行批回归 · 呈报#6（6A）搜索命中词高亮（纯层）。
 * render.ts 新增 hitTextHtml：settings-panel SP2（bz-sp-mark）先例口径——小写归一
 * indexOf 切片重建、不做动态 regex（无注入面）；cardHtml/metaTagsHtml 挂可选 kw 参数
 * （缺省 '' = 原行为，原型/抽屉头等既有消费方零波及）。
 * 修复前必红：hitTextHtml 不存在、cardHtml 不收 kw（标题无 mark）。
 */
import { describe, it, expect } from 'vitest';
import { panelShellHtml, hitTextHtml, cardHtml, metaTagsHtml } from '../../src/memo/render';
import type { MemoItem } from '../../src/memo/types';

const item = (extra: Partial<MemoItem> = {}): MemoItem => ({
  id: 't1', title: '写周报', scene: '工作', priority: 'minor', created: '2026-09-10 09:00:00',
  completed: null, due: null, notePath: null, notePosition: null, scriptName: null,
  courseName: null, coursePath: null, linkedNote: null, url: null, ...extra,
});

describe('呈报#6（6A）：hitTextHtml 切片重建口径', () => {
  it('基础：命中片段包 mark.bz-memo-hit，前后文原样', () => {
    expect(hitTextHtml('完成阅读报告', '阅读')).toBe('完成<mark class="bz-memo-hit">阅读</mark>报告');
  });

  it('大小写归一命中，mark 内保留原文大小写（SP2 同款）', () => {
    expect(hitTextHtml('TODO Check 立项', 'todo')).toBe('<mark class="bz-memo-hit">TODO</mark> Check 立项');
  });

  it('多处命中全标', () => {
    expect(hitTextHtml('abcabc', 'ab')).toBe(
      '<mark class="bz-memo-hit">ab</mark>c<mark class="bz-memo-hit">ab</mark>c',
    );
  });

  it('kw 空 / 未命中 / 空文本 → 纯 esc(text)，无 mark', () => {
    expect(hitTextHtml('写周报', '')).toBe('写周报');
    expect(hitTextHtml('写周报', '   ')).toBe('写周报');
    expect(hitTextHtml('写周报', '不存在')).toBe('写周报');
    expect(hitTextHtml('', 'x')).toBe('');
  });

  it('注入安全：html 片段逐段转义，mark 只包命中的转义文本', () => {
    const out = hitTextHtml('<img src=x onerror=alert(1)>', 'img');
    expect(out).toBe('&lt;<mark class="bz-memo-hit">img</mark> src=x onerror=alert(1)&gt;');
  });

  it('kw 含正则元字符按字面匹配（不做动态 regex）', () => {
    expect(hitTextHtml('a.c & axc', 'a.c')).toBe('<mark class="bz-memo-hit">a.c</mark> &amp; axc');
  });
});

describe('呈报#6（6A）：cardHtml / metaTagsHtml kw 参数', () => {
  it('kw 缺省 = 原行为（原型/抽屉头既有消费方零波及）', () => {
    const html = cardHtml(item({ title: '完成阅读报告' }), null, '');
    expect(html).toContain('完成阅读报告');
    expect(html).not.toContain('<mark');
  });

  it('kw 命中标题：纯文本与链接两形态都包 mark', () => {
    const plain = cardHtml(item({ title: '完成阅读报告' }), null, '', '阅读');
    expect(plain).toContain('<div class="bz-memo-card-title">完成<mark class="bz-memo-hit">阅读</mark>报告</div>');
    const linked = cardHtml(item({ title: '完成阅读报告', url: 'https://example.com' }), null, '', '阅读');
    expect(linked).toContain('data-memo-openitem');
    expect(linked).toContain('<mark class="bz-memo-hit">阅读</mark>');
  });

  it('kw 命中 meta 可见文本（场景 tag）；未命中字段不受影响', () => {
    const html = metaTagsHtml(item({ scene: '工作' }), null, '', '工作');
    expect(html).toContain('#<mark class="bz-memo-hit">工作</mark>');
    const none = metaTagsHtml(item({ scene: '工作' }), null, '', '剪藏');
    expect(none).toContain('#工作');
    expect(none).not.toContain('<mark');
  });

  it('6A（markup 契约）：面板壳搜索壳带 ✕ 清词锚点（初始 hidden）', () => {
    const shell = panelShellHtml();
    expect(shell).toContain('data-memo-search-clear');
    expect(shell).toMatch(/data-memo-search-clear[^>]*hidden/);
    expect(shell).toContain('清除搜索');
  });
});
