import { describe, it, expect } from 'vitest';
import { feedbackItemHtml, feedbackRowsHtml, rmTabCounts } from '../../src/settings-panel/changelog-note';
import type { BzrData, BzrFeedback } from '../../src/core/bzr-data';

const item = (o: Partial<BzrFeedback> = {}): BzrFeedback => ({
  id: 'x', source: 'bili-dm', summary: 's', title: '标题', desc: '描述', href: '',
  submittedAt: '2026-11-15 23:55', doneAt: '', ...o,
});

describe('反馈按插件隔离：bz 只显示自己的', () => {
  const mixed = {
    roadmap: [],
    feedback: [{ key: 'bug', items: [
      item({ id: 'b1', plugin: 'bz', title: '只属于 BZ 的反馈' }),
      item({ id: 'r1', plugin: 'bz-reader', title: '只属于 Reader 的反馈' }),
    ] }],
  } as unknown as BzrData;

  it('列表只渲染 bz 条目', () => {
    const s = feedbackRowsHtml(mixed, 'bug');
    expect(s).toContain('只属于 BZ 的反馈');
    expect(s).not.toContain('只属于 Reader 的反馈');
  });

  it('角标只数 bz 条目', () => {
    expect(rmTabCounts(mixed).bug).toBe(1);
  });
});

describe('反馈卡片：插件归属、核查结论、发布版本', () => {
  it('bz 条目的插件徽标带功能域', () => {
    const s = feedbackItemHtml(item({ plugin: 'bz', domain: '日记本' }));
    expect(s).toContain('bzs-chgn-fbplugin');
    expect(s).toContain('bz · 日记本');
  });

  it('bz reader 条目只显示插件名，不显示功能域', () => {
    const s = feedbackItemHtml(item({ plugin: 'bz-reader', domain: '字体' }));
    expect(s).toContain('bz reader');
    expect(s).not.toContain('字体');
  });

  it('核查结论以小字显示', () => {
    const s = feedbackItemHtml(item({ verify: '核查结论文本' }));
    expect(s).toContain('bzs-chgn-fbverify');
    expect(s).toContain('核查结论文本');
  });

  it('已完成的条目显示发布版本号', () => {
    const s = feedbackItemHtml(item({
      state: 'done', doneAt: '2026-11-16 00:45', releaseVersion: '1.44.5',
    }));
    expect(s).toContain('bzs-chgn-fbrelease');
    expect(s).toContain('1.44.5');
  });

  it('作者回复摘要只给 QQ 帖子用，不进界面', () => {
    expect(feedbackItemHtml(item({ replyDigest: 'DIGEST-ONLY-TEXT' }))).not.toContain('DIGEST-ONLY-TEXT');
  });
});
