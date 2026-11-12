/**
 * 书库引导页（0 本时）markup：纯层产出，断言用户能看到的那几行字。
 *
 * 覆盖 2026-11-12 发版 review 的三条：
 *  - 引导页不再写死下载量（写死的数字几周就对不上真实值）；
 *  - 本机有按笔记收录的旧书时，要有「这版起不再上墙」的说明（否则老用户以为书单丢了）；
 *  - 已装/未装两态的主按钮文案不同。
 */
import { describe, it, expect } from 'vitest';
import { readerGuideHtml } from '../../src/bookshelf/layouts/wall/render';

const BASE = { installed: false, broken: false, version: '', installing: false, stage: '' };

describe('书库引导页 markup', () => {
  it('不出现写死的下载量（统计数字不进源码）', () => {
    const html = readerGuideHtml({ ...BASE, installed: true, version: '0.2.0' });
    expect(html).not.toMatch(/次下载/);
    expect(html).toContain('已上架 Obsidian 社区插件市场');
  });

  it('旧 md 书 > 0 时补一句去向说明；为 0 时不出现', () => {
    const withLegacy = readerGuideHtml({ ...BASE, legacyCount: 12 });
    expect(withLegacy).toContain('本机还有 12 本按笔记收录的旧书');
    const none = readerGuideHtml({ ...BASE, legacyCount: 0 });
    expect(none).not.toContain('按笔记收录的旧书');
  });

  it('未装 → 安装按钮；已装 → 打开书架导入', () => {
    expect(readerGuideHtml(BASE)).toContain('data-bs-reader-install');
    const installed = readerGuideHtml({ ...BASE, installed: true, version: '0.2.0' });
    expect(installed).toContain('data-bs-reader-open');
    expect(installed).not.toContain('data-bs-reader-install');
    expect(installed).toContain('0.2.0');
  });

  it('半装（目录在但 manifest 坏）→ 文案是「重新安装」', () => {
    expect(readerGuideHtml({ ...BASE, broken: true })).toContain('重新安装 bz Reader');
  });
});
