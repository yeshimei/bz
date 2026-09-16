/**
 * 海报路径 rename 联动测试（issue 337 审计#11）：
 * `海报` frontmatter 是纯路径非双链，Obsidian 改名海报文件不联动——
 * vault:md-renamed 消费：命中影院笔记 海报==oldPath → processFrontMatter 改写；
 * 不命中零写盘；防抖合并保序回放（A→B→C 连改名不丢中间态）；面板未开（M.items 空）也命中。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { M, resetCinemaState } from '../../src/cinema/state';
import { ensureCinema, unloadCinema } from '../../src/cinema';

const OLD = 'CONFIG/MOVIE POSTER/old.jpg';
const MID = 'CONFIG/MOVIE POSTER/mid.jpg';
const NEW = 'CONFIG/MOVIE POSTER/new.jpg';

function makeApp(vault: MockVault) {
  const app = mockAppWithVault(vault);
  setApp(app);
  return app;
}

/** emit rename 事件并跨过 300ms 防抖窗口（flushPosterRenames 为 async，advanceTimersByTimeAsync 连微任务一起跑完） */
async function renameAndFlush(oldPath: string, newPath: string): Promise<void> {
  emitDomainEvent('vault:md-renamed', { oldPath, newPath });
  await vi.advanceTimersByTimeAsync(300);
}

describe('影院海报 rename 联动（issue 337 审计#11）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    unloadCinema(); // 复位注册位，保证本用例 ensureCinema 全新注册
    clearNotices();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({ cinemaFolderPath: '我的/影视' } as any));
  });

  afterEach(() => {
    unloadCinema();
    clearDomainEvents();
    setSettingsProvider(() => ({} as any));
    vi.useRealTimers();
  });

  it('命中改写：海报==oldPath 的笔记更新为新路径，其余键不动，无通知', async () => {
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《甲》.md',
      '---\ntags:\n- 电影\n观影日期: 2026-01-01\n评分: 8\n海报: CONFIG/MOVIE POSTER/old.jpg\n影评: 好片\n---\n正文不动',
    );
    vault.files.set(
      '我的/影视/《乙》.md',
      '---\ntags: [电影]\n评分: 7\n海报: CONFIG/MOVIE POSTER/other.jpg\n---',
    );
    const app = makeApp(vault);
    ensureCinema(app);

    await renameAndFlush(OLD, NEW);

    const fm = parseFrontmatter(vault.files.get('我的/影视/《甲》.md') ?? '');
    expect(fm?.['海报']).toBe(NEW);
    expect(fm?.['评分']).toBe(8);
    expect(fm?.['影评']).toBe('好片');
    expect(fm?.['tags']).toEqual(['电影']);
    expect(vault.files.get('我的/影视/《甲》.md')).toContain('正文不动');
    // 不命中笔记零写盘
    expect(vault.files.get('我的/影视/《乙》.md')).toBe('---\ntags: [电影]\n评分: 7\n海报: CONFIG/MOVIE POSTER/other.jpg\n---');
    // 联动全程无通知
    expect(getNoticeMessages()).toEqual([]);
  });

  it('不命中零写盘：无笔记引用 oldPath 时文件内容逐字节不动', async () => {
    const vault = new MockVault();
    const before = '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/other.jpg\n---';
    vault.files.set('我的/影视/《丙》.md', before);
    const app = makeApp(vault);
    ensureCinema(app);

    await renameAndFlush('CONFIG/MOVIE POSTER/不存在.jpg', NEW);

    expect(vault.files.get('我的/影视/《丙》.md')).toBe(before);
  });

  it('防抖合并保序：A→B→C 连改名回放两条事件，终值 C（不丢中间态）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《丁》.md', `---\ntags: [电影]\n评分: 6\n海报: ${OLD}\n---`);
    const app = makeApp(vault);
    ensureCinema(app);

    // 同一防抖窗口内连发两条（模拟海报文件连续改名），不命中 B 之外的笔记
    emitDomainEvent('vault:md-renamed', { oldPath: OLD, newPath: MID });
    emitDomainEvent('vault:md-renamed', { oldPath: MID, newPath: NEW });
    await vi.advanceTimersByTimeAsync(300);

    expect(parseFrontmatter(vault.files.get('我的/影视/《丁》.md') ?? '')?.['海报']).toBe(NEW);
  });

  it('面板未开（M.items 空）同样命中：扫描走 metadataCache 不依赖条目列表', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《戊》.md', `---\ntags: [电影]\n评分: 5\n海报: ${OLD}\n---`);
    const app = makeApp(vault);
    ensureCinema(app);
    expect(M.items).toHaveLength(0); // 面板从未打开

    await renameAndFlush(OLD, NEW);

    expect(parseFrontmatter(vault.files.get('我的/影视/《戊》.md') ?? '')?.['海报']).toBe(NEW);
  });

  it('目录外 rename（oldPath 非海报值）不影响；unload + 总线清空（插件卸载时序）后不再处理', async () => {
    const vault = new MockVault();
    const before = `---\ntags: [电影]\n评分: 8\n海报: ${OLD}\n---`;
    vault.files.set('我的/影视/《己》.md', before);
    const app = makeApp(vault);
    ensureCinema(app);
    // 影院笔记自身改名：oldPath 是笔记路径，不等于任何海报值 → 零写盘
    await renameAndFlush('我的/影视/《旧名》.md', '我的/影视/《己》.md');
    expect(vault.files.get('我的/影视/《己》.md')).toBe(before);

    // 插件卸载时序（main.ts onunload）：unloadCinema + clearDomainEvents 后事件不再消费
    unloadCinema();
    clearDomainEvents();
    emitDomainEvent('vault:md-renamed', { oldPath: OLD, newPath: NEW });
    await vi.advanceTimersByTimeAsync(300);
    expect(vault.files.get('我的/影视/《己》.md')).toBe(before);
  });
});
