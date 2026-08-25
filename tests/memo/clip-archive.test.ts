/**
 * 剪藏 AI 匹配归档测试（自 ai-agent 拆分的 memo 域实现）：
 * URL 精确匹配直接归档（含 P1-25 url 回传断言）、AI 匹配弹窗批准流、
 * AI 失败跳过、enableAIClipMatch 关跳过 AI（URL 精确仍生效）、
 * watchedFolders 门与剪藏目录外不触发。
 * stub 手法照抄 tests/ai-agent/ai-agent.test.ts（MockVault / metadataCache 伪对象 /
 * mock fetch SSE / 语义通道 clipping:file-created 经总线 emitDomainEvent 派发；
 * 弹窗涉及 DOM，不加 node 环境标注）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { ensureMemoFileSync, unloadMemoFileSync } from '../../src/memo';
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
});
