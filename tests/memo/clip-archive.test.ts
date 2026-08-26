/**
 * 剪藏 AI 匹配归档测试（自 ai-agent 拆分的 memo 域实现）：
 * URL 精确匹配直接归档（含 P1-25 url 回传断言）、AI 匹配弹窗批准流、
 * AI 失败跳过、enableAIClipMatch 关跳过 AI（URL 精确仍生效）、
 * watchedFolders 门与剪藏目录外不触发。
 * n2：归档成功通知合并窗口（批量剪藏归档合并一条、单篇原文案、30s 同键去重防刷屏）。
 * stub 手法照抄 tests/ai-agent/ai-agent.test.ts（MockVault / metadataCache 伪对象 /
 * mock fetch SSE / 语义通道 clipping:file-created 经总线 emitDomainEvent 派发；
 * 弹窗涉及 DOM，不加 node 环境标注）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { __resetNoticeForTests } from '../../src/core/notice';
import { getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { ensureMemoFileSync, unloadMemoFileSync } from '../../src/memo';
import { __setClipArchiveNotifyMergeMsForTests } from '../../src/memo/clip-archive';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';

/** 事件可触发的 mock app（metadataCache 从 vault 内容解析简易 frontmatter） */
function makeEventedApp(vault: MockVault) {
  const app = {
    vault: vault as any,
    workspace: {
      on: () => ({ ref: 'ws-mock' }),
      offref: () => {},
    },
    metadataCache: {
      getFileCache: (file: any) => {
        const content = vault.files.get(file.path) || '';
        const m = content.match(/^---\n([\s\S]*?)\n---/);
        const fm: Record<string, any> = {};
        if (m) {
          for (const line of m[1].split('\n')) {
            const kv = line.match(/^(\w+):\s*(.*)$/);
            if (kv) fm[kv[1]] = kv[2].replace(/^"|"$/g, '');
          }
        }
        return { frontmatter: fm };
      },
    },
    fileManager: { processFrontMatter: vi.fn() },
  };
  return { app };
}

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
};

async function setup() {
  unloadMemoFileSync(); // 复合入口卸载：同时重置引用同步与剪藏归档
  clearDomainEvents(); // 总线为模块级单例：清掉跨测试残留订阅
  const vault = new MockVault();
  const { app } = makeEventedApp(vault);
  setApp(app as any);
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  resetAIProviderCache();
  await ensureMemoFileSync(app as any); // 装订阅 + ensureBz（DataManager 归档写路径依赖）
  return { vault };
}

/** 等待队列清空（fake timers 下用 advanceTimersByTimeAsync） */
async function flushQueue() {
  if (vi.isFakeTimers()) {
    await vi.advanceTimersByTimeAsync(400); // 覆盖去抖窗口
    await vi.advanceTimersByTimeAsync(60);
    await vi.advanceTimersByTimeAsync(0);
  } else {
    await new Promise((r) => setTimeout(r, 400));
    await new Promise((r) => setTimeout(r, 30));
    await new Promise((r) => setTimeout(r, 0));
  }
}

function sseBody(content: string) {
  const encoder = new TextEncoder();
  const chunks = [`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`, 'data: [DONE]\n'];
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

const CLIP_MD = '---\nurl: "https://example.com/article-1"\ncreated: "2025-06-01"\n---\n正文';

function seedMemo(vault: MockVault, url: string) {
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
    { id: 'm1', title: '某篇文章', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url, linkedNote: null },
  ], null, 2));
}

describe('剪藏 AI 匹配归档', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // n2：通知去重记录为模块单例——跨用例清理防 30s 同键窗口误吞；合并窗口注入短值加速断言
    __resetNoticeForTests();
    __setClipArchiveNotifyMergeMsForTests(80);
  });

  it('URL 精确匹配 → 直接归档（无弹窗、静默；P1-25 url 不被抹掉）', async () => {
    vi.useFakeTimers();
    const { vault } = await setup();
    seedMemo(vault, 'https://example.com/article-1');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);

    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/文章1.md' });
    await vi.advanceTimersByTimeAsync(50);
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0]).toMatchObject({ title: '文章1', linkedNote: '归档/网页剪藏/文章1.md' });
    expect(bz[0].completed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/); // 已归档
    // P1-25：显式回传 url——原网址不被 title 自动提取抹成 null
    expect(bz[0].url).toBe('https://example.com/article-1');
    expect(document.getElementById('clip-ok')).toBeNull(); // 无弹窗
    vi.useRealTimers();
  });

  it('URL 不中 → AI 判断命中 → 弹窗批准 → 归档（P1-25 url 同样保留）', async () => {
    vi.useFakeTimers();
    const { vault } = await setup();
    seedMemo(vault, 'https://old.example.com/x');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody('{"match": true, "itemId": "m1"}'),
    });

    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/文章1.md' });
    await vi.advanceTimersByTimeAsync(1000); // 800ms AI 延迟
    await flushQueue();

    // 弹窗出现
    const okBtn = document.getElementById('clip-ok') as HTMLButtonElement | null;
    expect(okBtn).not.toBeNull();
    expect(document.body.textContent).toContain('AI 剪藏匹配');
    expect(document.body.textContent).toContain('某篇文章');

    // 批准 → 归档
    okBtn!.click();
    await vi.advanceTimersByTimeAsync(100);
    await flushQueue();
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0]).toMatchObject({ title: '文章1', linkedNote: '归档/网页剪藏/文章1.md' });
    expect(bz[0].completed).not.toBeNull();
    // P1-25：AI 匹配路径归档同样保留原 url（未被 title 提取抹成 null）
    expect(bz[0].url).toBe('https://old.example.com/x');
    vi.useRealTimers();
  });

  it('AI 请求失败 → 静默跳过（console.error，无弹窗无改动）', async () => {
    vi.useFakeTimers();
    const { vault } = await setup();
    seedMemo(vault, 'https://old.example.com/x');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);

    (global as any).fetch = vi.fn().mockRejectedValue(new Error('网络错误'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/文章1.md' });
    await vi.advanceTimersByTimeAsync(1000);
    await flushQueue();

    expect(document.getElementById('clip-ok')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].completed).toBeNull();
    vi.useRealTimers();
  });

  it('enableAIClipMatch=false → 跳过 AI 步骤（不请求 AI、无弹窗无改动）', async () => {
    vi.useFakeTimers();
    const { vault } = await setup();
    setSettingsProvider(() => ({ ...SETTINGS, enableAIClipMatch: false } as any));
    seedMemo(vault, 'https://old.example.com/x');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, body: sseBody('{"match": true, "itemId": "m1"}') });
    (global as any).fetch = fetchSpy;

    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/文章1.md' });
    await vi.advanceTimersByTimeAsync(1000);
    await flushQueue();
    expect(document.getElementById('clip-ok')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled(); // AI 请求未发出
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].completed).toBeNull();
    vi.useRealTimers();
  });

  it('enableAIClipMatch=false 时 URL 精确匹配仍生效（直接归档）', async () => {
    vi.useFakeTimers();
    const { vault } = await setup();
    setSettingsProvider(() => ({ ...SETTINGS, enableAIClipMatch: false } as any));
    seedMemo(vault, 'https://example.com/article-1');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, body: sseBody('{"match": true, "itemId": "m1"}') });
    (global as any).fetch = fetchSpy;

    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/文章1.md' });
    await vi.advanceTimersByTimeAsync(50);
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0]).toMatchObject({ title: '文章1', linkedNote: '归档/网页剪藏/文章1.md' });
    expect(bz[0].completed).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled(); // 全程未走 AI
    vi.useRealTimers();
  });

  it('watchedFolders 门：剪藏目录被移出监听范围后语义事件不再触发', async () => {
    vi.useFakeTimers();
    const { vault } = await setup();
    setSettingsProvider(() => ({ ...SETTINGS, aiAgentWatchedFolders: '我的/其他' } as any));
    seedMemo(vault, 'https://example.com/article-1'); // URL 与剪藏相同，若误处理会直接归档
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);

    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/文章1.md' });
    await vi.advanceTimersByTimeAsync(1000);
    await flushQueue();
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].completed).toBeNull(); // 未处理
    expect(document.getElementById('clip-ok')).toBeNull();
    vi.useRealTimers();
  });

  it('n2：归档成功通知合并——窗口内两篇合并一条通知（不再逐条弹屏）', async () => {
    vi.useFakeTimers();
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '文章A', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://example.com/a', linkedNote: null },
      { id: 'm2', title: '文章B', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://example.com/b', linkedNote: null },
    ], null, 2));
    vault.files.set('归档/网页剪藏/文章A.md', '---\nurl: "https://example.com/a"\n---\n正文');
    vault.files.set('归档/网页剪藏/文章B.md', '---\nurl: "https://example.com/b"\n---\n正文');

    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/文章A.md' });
    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/文章B.md' });
    await vi.advanceTimersByTimeAsync(60); // 队列处理：两条均已归档
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz.every((b: any) => b.completed !== null)).toBe(true);
    // 合并窗口未到 → 一条都不弹（逐条弹屏已消除）
    expect(getNoticeMessages()).toEqual([]);

    // 越过合并窗口 → 只弹一条合并通知（名单 = 窗口内全部剪藏）
    await vi.advanceTimersByTimeAsync(100);
    const msgs = getNoticeMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toBe('已归档到备忘录：文章A、文章B');
    vi.useRealTimers();
  });

  it('n2：超过 3 条合并 → 名单前三 + 等 N 条', async () => {
    vi.useFakeTimers();
    const { vault } = await setup();
    const clips: [string, string, string][] = [
      ['a', '文章甲', 'https://example.com/1'],
      ['b', '文章乙', 'https://example.com/2'],
      ['c', '文章丙', 'https://example.com/3'],
      ['d', '文章丁', 'https://example.com/4'],
    ];
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(
      clips.map(([id, title, url]) => ({
        id, title, scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url, linkedNote: null,
      })),
      null,
      2
    ));
    for (const [, title, url] of clips) {
      vault.files.set(`归档/网页剪藏/${title}.md`, `---\nurl: "${url}"\n---\n正文`);
    }
    for (const [, title] of clips) {
      emitDomainEvent('clipping:file-created', { path: `归档/网页剪藏/${title}.md` });
    }
    await vi.advanceTimersByTimeAsync(60);
    await vi.advanceTimersByTimeAsync(100);
    const msgs = getNoticeMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toBe('已归档到备忘录：文章甲、文章乙、文章丙 等 1 条');
    vi.useRealTimers();
  });

  it('n2：单篇归档 → 单条原文案；同键去重窗口（30s）内再归档不重复弹', async () => {
    vi.useFakeTimers();
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm3', title: '单篇', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://example.com/s', linkedNote: null },
    ], null, 2));
    vault.files.set('归档/网页剪藏/单篇.md', '---\nurl: "https://example.com/s"\n---\n正文');
    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/单篇.md' });
    await vi.advanceTimersByTimeAsync(60);
    await vi.advanceTimersByTimeAsync(100); // 越过合并窗口
    expect(getNoticeMessages()).toEqual(['已归档到备忘录：单篇']);

    // 去重窗口内再归档另一篇：清掉已显示通知 DOM，同 dedupeKey 不再新弹（防连续剪藏刷屏）
    clearNotices();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm3', title: '单篇', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://example.com/s', linkedNote: null },
      { id: 'm4', title: '再一篇', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://example.com/t', linkedNote: null },
    ], null, 2));
    vault.files.set('归档/网页剪藏/再一篇.md', '---\nurl: "https://example.com/t"\n---\n正文');
    emitDomainEvent('clipping:file-created', { path: '归档/网页剪藏/再一篇.md' });
    await vi.advanceTimersByTimeAsync(60);
    await vi.advanceTimersByTimeAsync(100);
    expect(getNoticeMessages()).toEqual([]); // 30s 同键窗口内不重复弹
    vi.useRealTimers();
  });
});
