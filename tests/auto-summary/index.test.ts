/**
 * 自动摘要入口测试（ticket 22）：fake timers 推进注册 + create/file-open 双触发 + 去重。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { ensureAutoSummary, isAutoSummaryInitialized, unloadAutoSummary } from '../../src/auto-summary/index';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, MockNotice } from '../mock-obsidian-entry';

/** workspace mock：可注册/触发 file-open 事件（offref 语义与 MockVault 一致） */
function makeWorkspace() {
  const listeners: Record<string, Function[]> = {};
  return {
    listeners,
    on(event: string, cb: (...args: any[]) => void): any {
      (listeners[event] ||= []).push(cb);
      return { event, cb };
    },
    offref(ref: any): void {
      if (!ref || !ref.event) return;
      const arr = listeners[ref.event] || [];
      const idx = arr.indexOf(ref.cb);
      if (idx >= 0) arr.splice(idx, 1);
    },
    emit(event: string, ...args: any[]): void {
      for (const cb of listeners[event] || []) cb(...args);
    },
  };
}

function makeApp(vault: MockVault, workspace = makeWorkspace()) {
  return { vault, metadataCache: {}, workspace } as any;
}

/** mock AI 流式响应（core/ai 走 fetch SSE），返回 fetch spy */
function mockAIResponse(json: string) {
  const encoder = new TextEncoder();
  const chunks = [`data: ${JSON.stringify({ choices: [{ delta: { content: json } }] })}\n`, 'data: [DONE]\n'];
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
        controller.close();
      },
    }),
  });
  (global as any).fetch = fetchSpy;
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  resetAIProviderCache();
  return fetchSpy;
}

describe('auto-summary 入口', () => {
  let vault: MockVault;
  let workspace: ReturnType<typeof makeWorkspace>;
  const LONG_BODY = '段落内容。'.repeat(30);

  beforeEach(() => {
    vi.useFakeTimers();
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    workspace = makeWorkspace();
    setApp(makeApp(vault, workspace));
  });

  afterEach(() => {
    unloadAutoSummary();
    vi.useRealTimers();
  });

  it('初始化幂等 + 延迟注册 create 与 file-open 监听', () => {
    ensureAutoSummary(makeApp(vault, workspace));
    expect(isAutoSummaryInitialized()).toBe(true);
    // 未到 2000ms 不注册监听
    expect(vault.listeners['create']).toBeUndefined();
    expect(workspace.listeners['file-open']).toBeUndefined();
    vi.advanceTimersByTime(2000);
    expect(vault.listeners['create']).toHaveLength(1);
    expect(workspace.listeners['file-open']).toHaveLength(1);
  });

  it('非 md / 目录外文件（create 与 open）→ 不处理', async () => {
    mockAIResponse('{"summary":"S","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    // 目录外 md
    vault.files.set('Inbox/x.md', `---\nlink: "https://x.com/x"\n---\n\n${LONG_BODY}`);
    // 非 md
    vault.files.set('归档/网页剪藏/y.txt', 'hello');
    vault.emit('create', vault.file('Inbox/x.md'));
    vault.emit('create', vault.file('归档/网页剪藏/y.txt'));
    workspace.emit('file-open', vault.file('Inbox/x.md'));
    workspace.emit('file-open', vault.file('归档/网页剪藏/y.txt'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(vault.modifiedPaths).toHaveLength(0);
  });

  it('卸载清理：offref 移除双监听 + initialized=false', () => {
    ensureAutoSummary(makeApp(vault, workspace));
    vi.advanceTimersByTime(2000);
    expect(isAutoSummaryInitialized()).toBe(true);
    unloadAutoSummary();
    expect(isAutoSummaryInitialized()).toBe(false);
    expect(vault.listeners['create']).toHaveLength(0);
    expect(workspace.listeners['file-open']).toHaveLength(0);
    // 再次 ensure 可重新注册
    ensureAutoSummary(makeApp(vault, workspace));
    vi.advanceTimersByTime(2000);
    expect(vault.listeners['create']).toHaveLength(1);
    expect(workspace.listeners['file-open']).toHaveLength(1);
  });

  it('file-open 触发处理：打开剪藏目录内缺字段文件 → 补全写回 + 通知', async () => {
    mockAIResponse('{"summary":"摘要","tags":["AI"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set(
      '归档/网页剪藏/x.md',
      `---\ntitle: "已有标题"\n---\n\n${LONG_BODY}`
    );
    workspace.emit('file-open', vault.file('归档/网页剪藏/x.md'));
    await vi.advanceTimersByTimeAsync(1600);
    const out = vault.files.get('归档/网页剪藏/x.md')!;
    expect(out).toContain('summary: "摘要"');
    expect(out).toContain('  - "AI"');
    expect(MockNotice.instances).toHaveLength(2);
    expect(MockNotice.instances[0].message).toBe('正在为《已有标题》生成摘要…');
    expect(MockNotice.instances[1].message).toBe('《已有标题》\n\n摘要\n\n#AI');
  });

  it('create + file-open 同一文件去重 → 只处理一次', async () => {
    const fetchSpy = mockAIResponse('{"summary":"S","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set(
      '归档/网页剪藏/d.md',
      `---\ntitle: "已有标题"\n---\n\n${LONG_BODY}`
    );
    vault.emit('create', vault.file('归档/网页剪藏/d.md'));
    workspace.emit('file-open', vault.file('归档/网页剪藏/d.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 双触发只请求一次 AI
  });

  it('延迟窗口外再次打开 → 再次处理（每次打开都执行）', async () => {
    const fetchSpy = mockAIResponse('{"summary":"S","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set(
      '归档/网页剪藏/e.md',
      `---\ntitle: "T"\n---\n\n${LONG_BODY}`
    );
    workspace.emit('file-open', vault.file('归档/网页剪藏/e.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // 再次打开（字段已齐全 → 不请求 AI）
    workspace.emit('file-open', vault.file('归档/网页剪藏/e.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 字段齐全跳过
  });

  it('file-open 传 null（关闭标签）→ 不处理', async () => {
    mockAIResponse('{"summary":"S"}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    workspace.emit('file-open', null);
    await vi.advanceTimersByTimeAsync(1600);
    expect(vault.modifiedPaths).toHaveLength(0);
  });

  it('监听目录跟随剪藏目录设置（articleDirectory）', async () => {
    mockAIResponse('{"summary":"S","tags":["a"]}');
    setSettingsProvider(() => ({ articleDirectory: '我的/剪藏2' }) as any);
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    // 设置目录内 md → 触发处理；默认目录内 → 不处理
    vault.files.set('我的/剪藏2/x.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    vault.files.set('归档/网页剪藏/y.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    vault.emit('create', vault.file('我的/剪藏2/x.md'));
    vault.emit('create', vault.file('归档/网页剪藏/y.md'));
    await vi.advanceTimersByTimeAsync(1600);
    // 只有设置目录内的文件被处理（x.md 被 modify）
    expect(vault.modifiedPaths.some((p) => p.includes('我的/剪藏2/x.md'))).toBe(true);
    expect(vault.modifiedPaths.some((p) => p.includes('归档/网页剪藏/y.md'))).toBe(false);
  });
});
