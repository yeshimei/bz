/**
 * AI Agent 测试（ticket 19）：纯函数同步、事件触发（rename/delete/create/open）、
 * 队列顺序、AI 剪藏匹配（mock fetch：命中/不中/批准弹窗/URL 精确匹配直接归档）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { ensureAIAgent, unloadAIAgent } from '../../src/ai-agent';
import { syncRename, syncDelete, syncAutoLink, inWatchedFolders, loadJSON, saveJSON } from '../../src/ai-agent/sync';
import { MockVault } from '../mock-vault';

/** 事件可触发的 mock app（vault/workspace 记录 handler） */
function makeEventedApp(vault: MockVault) {
  const vaultHandlers: Record<string, Function[]> = {};
  const wsHandlers: Record<string, Function[]> = {};
  const vaultWithEvents: any = vault;
  vaultWithEvents.on = (ev: string, cb: Function) => {
    (vaultHandlers[ev] = vaultHandlers[ev] || []).push(cb);
    return { ref: `vault-${ev}-${vaultHandlers[ev].length}` };
  };
  vaultWithEvents.offref = () => {};
  const app = {
    vault: vaultWithEvents,
    workspace: {
      on: (ev: string, cb: Function) => {
        (wsHandlers[ev] = wsHandlers[ev] || []).push(cb);
        return { ref: `ws-${ev}` };
      },
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
  return { app, vaultHandlers, wsHandlers };
}

const SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  scenarios: '',
  platformMapping: '',
  showFileName: true,
  autoPopupOnStart: false,
  movieFolderPath: '我的/影视',
};

async function setup() {
  unloadAIAgent(); // 重置幂等守卫与监听（模块单例跨测试共享）
  const vault = new MockVault();
  const { app, vaultHandlers, wsHandlers } = makeEventedApp(vault);
  setApp(app as any);
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  resetAIProviderCache();
  await ensureAIAgent(app as any);
  return { vault, app, vaultHandlers, wsHandlers };
}

/** 等待队列清空（fake timers 下用 advanceTimersByTimeAsync） */
async function flushQueue() {
  if (vi.isFakeTimers()) {
    await vi.advanceTimersByTimeAsync(60);
    await vi.advanceTimersByTimeAsync(0);
  } else {
    await new Promise((r) => setTimeout(r, 30));
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('sync 纯函数', () => {
  it('syncRename：更新 linkedNote/title/notePath', () => {
    const items = [
      { linkedNote: '卡片盒/A.md', title: 'A', notePath: '卡片盒/A.md' },
      { linkedNote: '其他.md', title: 'B', notePath: null },
    ];
    const changed = syncRename(items, { oldPath: '卡片盒/A.md', newPath: '卡片盒/A2.md', oldTitle: 'A', newTitle: 'A2' });
    expect(changed).toBe(true);
    expect(items[0]).toMatchObject({ linkedNote: '卡片盒/A2.md', title: 'A2', notePath: '卡片盒/A2.md' });
    expect(items[1]).toMatchObject({ linkedNote: '其他.md', title: 'B' });
  });

  it('syncRename：无变化返回 false', () => {
    const items = [{ linkedNote: null, title: 'X' }];
    expect(syncRename(items, { oldPath: 'a', newPath: 'b', oldTitle: 'Y', newTitle: 'Z' })).toBe(false);
  });

  it('syncDelete：清空匹配的 linkedNote', () => {
    const items = [{ linkedNote: '卡片盒/A.md' }, { linkedNote: '卡片盒/B.md' }];
    expect(syncDelete(items, '卡片盒/A.md')).toBe(true);
    expect(items[0].linkedNote).toBeNull();
    expect(items[1].linkedNote).toBe('卡片盒/B.md');
  });

  it('syncAutoLink：同名未关联条目自动关联', () => {
    const items = [
      { title: '我的笔记', linkedNote: null },
      { title: '我的笔记', linkedNote: '已有.md' },
      { title: '别的', linkedNote: null },
    ];
    expect(syncAutoLink(items, '我的笔记', '卡片盒/我的笔记.md')).toBe(true);
    expect(items[0].linkedNote).toBe('卡片盒/我的笔记.md');
    expect(items[1].linkedNote).toBe('已有.md');
    expect(items[2].linkedNote).toBeNull();
  });

  it('inWatchedFolders：目录前缀边界判断', () => {
    expect(inWatchedFolders('卡片盒/A.md')).toBe(true);
    expect(inWatchedFolders('卡片盒')).toBe(true);
    expect(inWatchedFolders('卡片盒子目录/A.md')).toBe(false);
    expect(inWatchedFolders('归档/网页剪藏/x.md')).toBe(true);
    expect(inWatchedFolders('我的/日记/2024.md')).toBe(false);
  });
});

describe('事件同步（bz + favorites）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('rename 事件：memo.json 与 favorites.json 同步更新', async () => {
    const { vault, vaultHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '旧笔记', scene: '工作', linkedNote: '卡片盒/旧笔记.md', notePath: '卡片盒/旧笔记.md', url: null },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: '旧笔记', linkedNote: '卡片盒/旧笔记.md' },
    ], null, 2));

    vaultHandlers['rename'][0](
      { path: '卡片盒/新笔记.md', basename: '新笔记', extension: 'md' },
      '卡片盒/旧笔记.md'
    );
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0]).toMatchObject({ title: '新笔记', linkedNote: '卡片盒/新笔记.md', notePath: '卡片盒/新笔记.md' });
    const fav = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(fav[0]).toMatchObject({ title: '新笔记', linkedNote: '卡片盒/新笔记.md' });
  });

  it('rename 事件：监听范围外（我的/）不处理', async () => {
    const { vault, vaultHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: 'A', linkedNote: '我的/日记/2024.md' },
    ], null, 2));
    vaultHandlers['rename'][0](
      { path: '我的/日记/2025.md', basename: '2025', extension: 'md' },
      '我的/日记/2024.md'
    );
    await flushQueue();
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].linkedNote).toBe('我的/日记/2024.md'); // 未变
  });

  it('delete 事件：清空两个数据源的关联', async () => {
    const { vault, vaultHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: 'A', linkedNote: '卡片盒/A.md' },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: 'A', linkedNote: '卡片盒/A.md' },
    ], null, 2));

    vaultHandlers['delete'][0]({ path: '卡片盒/A.md', basename: 'A', extension: 'md' });
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].linkedNote).toBeNull();
    const fav = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(fav[0].linkedNote).toBeNull();
  });

  it('create 事件：favorites 同名自动关联；bz 不动', async () => {
    const { vault, vaultHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: '新文章', linkedNote: null },
    ], null, 2));

    vaultHandlers['create'][0]({ path: '卡片盒/新文章.md', basename: '新文章', extension: 'md' });
    await flushQueue();

    const fav = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(fav[0].linkedNote).toBe('卡片盒/新文章.md');
  });

  it('file-open 事件：favorites 同名自动关联', async () => {
    const { vault, wsHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      { id: 'f1', title: '笔记X', linkedNote: null },
    ], null, 2));

    wsHandlers['file-open'][0]({ path: '卡片盒/笔记X.md', basename: '笔记X', extension: 'md' });
    await flushQueue();

    const fav = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(fav[0].linkedNote).toBe('卡片盒/笔记X.md');
  });

  it('队列顺序：多个事件串行执行不交错', async () => {
    const { vault, vaultHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: 'A', linkedNote: '卡片盒/A.md', notePath: '卡片盒/A.md' },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', '[]');

    // 连续两个 rename（A → B → C）
    vaultHandlers['rename'][0](
      { path: '卡片盒/B.md', basename: 'B', extension: 'md' },
      '卡片盒/A.md'
    );
    vaultHandlers['rename'][0](
      { path: '卡片盒/C.md', basename: 'C', extension: 'md' },
      '卡片盒/B.md'
    );
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0]).toMatchObject({ linkedNote: '卡片盒/C.md', notePath: '卡片盒/C.md', title: 'C' });
  });
});

describe('AI 剪藏匹配', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

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

  const CLIP_MD = '---\nlink: "https://example.com/article-1"\ncreated: "2025-06-01"\n---\n正文';

  it('URL 精确匹配 → 直接归档（无弹窗、静默）', async () => {
    vi.useFakeTimers();
    const { vault, vaultHandlers } = await setup();
    // 备忘录有剪藏条目且 URL 相同
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '旧标题', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://example.com/article-1', linkedNote: null },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', '[]');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);

    vaultHandlers['create'][0]({ path: '归档/网页剪藏/文章1.md', basename: '文章1', extension: 'md' });
    await vi.advanceTimersByTimeAsync(50);
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0]).toMatchObject({ title: '文章1', linkedNote: '归档/网页剪藏/文章1.md' });
    expect(bz[0].completed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/); // 已归档
    expect(document.getElementById('clip-ok')).toBeNull(); // 无弹窗
    vi.useRealTimers();
  });

  it('URL 不中 → AI 判断命中 → 弹窗批准 → 归档', async () => {
    vi.useFakeTimers();
    const { vault, vaultHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '某篇文章', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://old.example.com/x', linkedNote: null },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', '[]');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody('{"match": true, "itemId": "m1"}'),
    });

    vaultHandlers['create'][0]({ path: '归档/网页剪藏/文章1.md', basename: '文章1', extension: 'md' });
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
    vi.useRealTimers();
  });

  it('AI 判断不中 → 无弹窗无改动', async () => {
    vi.useFakeTimers();
    const { vault, vaultHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '某篇文章', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://old.example.com/x', linkedNote: null },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', '[]');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody('{"match": false, "itemId": null}'),
    });

    vaultHandlers['create'][0]({ path: '归档/网页剪藏/文章1.md', basename: '文章1', extension: 'md' });
    await vi.advanceTimersByTimeAsync(1000);
    await flushQueue();

    expect(document.getElementById('clip-ok')).toBeNull();
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].completed).toBeNull();
    vi.useRealTimers();
  });

  it('AI 请求失败 → 静默跳过（console.error）', async () => {
    vi.useFakeTimers();
    const { vault, vaultHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: 'A', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://x.example.com', linkedNote: null },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', '[]');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);

    (global as any).fetch = vi.fn().mockRejectedValue(new Error('网络错误'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vaultHandlers['create'][0]({ path: '归档/网页剪藏/文章1.md', basename: '文章1', extension: 'md' });
    await vi.advanceTimersByTimeAsync(1000);
    await flushQueue();

    expect(document.getElementById('clip-ok')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    vi.useRealTimers();
  });

  it('剪藏笔记无 link frontmatter → 直接返回', async () => {
    vi.useFakeTimers();
    const { vault, vaultHandlers } = await setup();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: 'A', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://x.example.com', linkedNote: null },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', '[]');
    vault.files.set('归档/网页剪藏/文章1.md', '---\ntitle: x\n---\n无 link 字段');

    vaultHandlers['create'][0]({ path: '归档/网页剪藏/文章1.md', basename: '文章1', extension: 'md' });
    await vi.advanceTimersByTimeAsync(1000);
    await flushQueue();
    expect(document.getElementById('clip-ok')).toBeNull();
    vi.useRealTimers();
  });

  it('enableAIClipMatch=false → 跳过 AI 判断（无弹窗无改动，不请求 AI）', async () => {
    vi.useFakeTimers();
    const { vault, vaultHandlers } = await setup();
    setSettingsProvider(() => ({ ...SETTINGS, enableAIClipMatch: false } as any));
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '某篇文章', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://old.example.com/x', linkedNote: null },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', '[]');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, body: sseBody('{"match": true, "itemId": "m1"}') });
    (global as any).fetch = fetchSpy;

    vaultHandlers['create'][0]({ path: '归档/网页剪藏/文章1.md', basename: '文章1', extension: 'md' });
    await vi.advanceTimersByTimeAsync(1000);
    await flushQueue();
    expect(document.getElementById('clip-ok')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled(); // AI 请求未发出
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].completed).toBeNull();
    vi.useRealTimers();
  });

  it('aiAgentWatchedFolders 设置生效：范围外不监听', async () => {
    vi.useFakeTimers();
    const { vault, vaultHandlers } = await setup();
    setSettingsProvider(() => ({ ...SETTINGS, aiAgentWatchedFolders: '我的/其他' } as any));
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: 'A', scene: '剪藏', priority: 'minor', created: '2025-01-01 00:00:00', completed: null, url: 'https://x.example.com', linkedNote: null },
    ], null, 2));
    vault.files.set('CONFIG/STORAGE/favorites.json', '[]');
    vault.files.set('归档/网页剪藏/文章1.md', CLIP_MD);

    vaultHandlers['create'][0]({ path: '归档/网页剪藏/文章1.md', basename: '文章1', extension: 'md' });
    await vi.advanceTimersByTimeAsync(1000);
    await flushQueue();
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].completed).toBeNull(); // 未处理
    expect(document.getElementById('clip-ok')).toBeNull();
    vi.useRealTimers();
  });

});
