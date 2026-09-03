/**
 * 影院（cinema）海报抓取状态监听（poster-watch）测试（ADR-0087 自旧 movie/poster-watch 迁入）：
 * 创建笔记后轮询「海报」frontmatter 字段，非空 → 原地更新 progress 通知为已完成（不弹第二条）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { notify } from '../../src/core/notice';
import { watchPosterFetch, POSTER_POLL_MS, POSTER_POLL_MAX } from '../../src/cinema/poster-watch';

function visibleNotices(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.bz-notice')) as HTMLElement[];
}

describe('cinema watchPosterFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetObsidianMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('海报字段为空 → 保持「正在获取」progress；外部填充 → 原地更新为已完成（不弹第二条）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《片》.md', '---\ntags: [电影]\n评分: 4\n海报: \n---\n');
    const app = mockAppWithVault(vault);
    const file = vault.file('我的/影视/《片》.md');
    const h = notify('正在获取海报和豆瓣信息…', { type: 'progress' });
    watchPosterFetch(app, file, h);

    // 初始：空海报 → progress 常驻
    expect(visibleNotices()[0].textContent).toContain('正在获取海报和豆瓣信息');
    expect(visibleNotices()[0].classList.contains('bz-notice--progress')).toBe(true);

    // 模拟外部 douban-poster watcher 写入海报字段
    vault.files.set('我的/影视/《片》.md', '---\ntags: [电影]\n评分: 4\n海报: 我的/影视/海报/片.png\n---\n');
    await vi.advanceTimersByTimeAsync(POSTER_POLL_MS);

    const el = visibleNotices()[0];
    expect(el.textContent).toContain('海报和豆瓣信息获取完成');
    expect(el.classList.contains('bz-notice--success')).toBe(true);
    expect(el.classList.contains('bz-notice--progress')).toBe(false);
    // 原地更新：不弹第二条通知
    expect(visibleNotices()).toHaveLength(1);
  });

  it('创建即已带海报 → 立即完成', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《片》.md', '---\ntags: [电影]\n海报: x.png\n---\n');
    const app = mockAppWithVault(vault);
    const file = vault.file('我的/影视/《片》.md');
    const h = notify('正在获取海报和豆瓣信息…', { type: 'progress' });
    watchPosterFetch(app, file, h);
    await vi.advanceTimersByTimeAsync(0);
    expect(visibleNotices()[0].textContent).toContain('海报和豆瓣信息获取完成');
    expect(visibleNotices()[0].classList.contains('bz-notice--success')).toBe(true);
  });

  it('超时（POSTER_POLL_MAX 次）后停止轮询：通知原地更新为明确失败（error），自动收尾不再永久挂「获取中」', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《片》.md', '---\ntags: [电影]\n海报: \n---\n');
    const app = mockAppWithVault(vault);
    const file = vault.file('我的/影视/《片》.md');
    const h = notify('正在获取海报和豆瓣信息…', { type: 'progress' });
    watchPosterFetch(app, file, h);
    await vi.advanceTimersByTimeAsync(POSTER_POLL_MS * (POSTER_POLL_MAX + 1));

    const el = visibleNotices()[0];
    expect(el.textContent).toContain('海报获取超时：请确认海报守护进程已运行');
    expect(el.classList.contains('bz-notice--error')).toBe(true);
    expect(el.classList.contains('bz-notice--progress')).toBe(false);

    // 轮询已停止：失败通知按 error 类型默认时长自动收尾（不永久挂「获取中」）；
    // 之后再写入海报也不产生新通知
    vault.files.set('我的/影视/《片》.md', '---\ntags: [电影]\n海报: y.png\n---\n');
    await vi.advanceTimersByTimeAsync(POSTER_POLL_MS * 2);
    expect(el.isConnected).toBe(false); // 失败通知已自动消失
    expect(visibleNotices()).toHaveLength(0);
  });
});
