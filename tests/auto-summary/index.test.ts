/**
 * 自动摘要入口测试（ticket 22）：fake timers 推进注册 + create/file-open 双触发 + 去重。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import {
  ensureAutoSummary,
  isAutoSummaryInitialized,
  unloadAutoSummary,
  stopAutoSummary,
  regenerateSummary,
  redoSummaryForActiveFile,
} from '../../src/auto-summary/index';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';

/** workspace mock：可注册/触发 file-open 事件（offref 语义与 MockVault 一致）+ getActiveFile */
function makeWorkspace() {
  const listeners: Record<string, Function[]> = {};
  let activeFile: any = null;
  return {
    listeners,
    getActiveFile: () => activeFile,
    setActiveFile(f: any): void {
      activeFile = f;
    },
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

  afterEach(async () => {
    // 兜底放行挂起的门控请求：断言中断的用例若留未完成的 in-flight 任务，
    // 模块级 draining 会跨用例滞留（后续用例的队列泵全部拒动）
    for (const r of gate.pending.splice(0)) r('{"summary":"S","tags":["a"]}');
    unloadAutoSummary();
    vi.useRealTimers();
    // 微任务冲洗：恢复的 drain 队列收尾（draining 复位），不带入下一用例
    for (let i = 0; i < 5; i++) await Promise.resolve();
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
    vault.files.set('Inbox/x.md', `---\nurl: "https://x.com/x"\n---\n\n${LONG_BODY}`);
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
    // 动态链路（ticket 25）：单条通知原地更新为结果
    expect(getNoticeMessages()).toHaveLength(1);
    expect(getNoticeMessages()[0]).toBe('《已有标题》\n\n摘要\n\n#AI');
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

  it('stopAutoSummary（P1-22）：关闭 → 新建剪藏不触发 AI；再开启恢复监听与处理', async () => {
    setSettingsProvider(() => ({}) as any); // 重置前面用例残留的 articleDirectory
    const fetchSpy = mockAIResponse('{"summary":"S","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    expect(vault.listeners['create']).toHaveLength(1);

    stopAutoSummary();
    expect(vault.listeners['create']).toHaveLength(0); // 摘除 create 监听
    expect(workspace.listeners['file-open']).toHaveLength(0); // 摘除 file-open 监听
    expect(isAutoSummaryInitialized()).toBe(true); // initialized 保留以便再开启复用

    // 关闭后新建剪藏 → 不触发 AI 流程
    vault.files.set('归档/网页剪藏/off.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    vault.emit('create', vault.file('归档/网页剪藏/off.md'));
    workspace.emit('file-open', vault.file('归档/网页剪藏/off.md'));
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(vault.modifiedPaths).toHaveLength(0);

    // 再开启 → 重新注册监听，恢复正常处理
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    expect(vault.listeners['create']).toHaveLength(1);
    expect(workspace.listeners['file-open']).toHaveLength(1);
    vault.emit('create', vault.file('归档/网页剪藏/off.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(vault.files.get('归档/网页剪藏/off.md')).toContain('summary: "S"');
  });

  it('处理中集合（P2）：processFile 完成前重复触发直接忽略，完成后恢复可处理', async () => {
    setSettingsProvider(() => ({}) as any); // 重置前面用例残留的 articleDirectory
    const encoder = new TextEncoder();
    const makeRes = (json: string) => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: json } }] })}\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n'));
          controller.close();
        },
      }),
    });
    let release!: (r: any) => void;
    const gate = new Promise<any>((r) => { release = r; }); // AI 请求挂起
    const fetchSpy = vi.fn().mockReturnValue(gate);
    (global as any).fetch = fetchSpy;
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    resetAIProviderCache();

    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/p.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);

    workspace.emit('file-open', vault.file('归档/网页剪藏/p.md'));
    await vi.advanceTimersByTimeAsync(1600); // 延迟窗到期入队 + 0ms 合并窗后泵启动（fetch 挂起）
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 处理中再次触发（如再次 file-open）→ 直接忽略
    workspace.emit('file-open', vault.file('归档/网页剪藏/p.md'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 放行 AI 响应 → 写回完成
    release(makeRes('{"summary":"S","tags":["a"]}'));
    await vi.advanceTimersByTimeAsync(100);
    expect(vault.files.get('归档/网页剪藏/p.md')).toContain('summary: "S"');

    // 完成后（字段已齐全）再次打开 → 不再请求 AI
    workspace.emit('file-open', vault.file('归档/网页剪藏/p.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('ticket 124：摘要时机 lazy → 只注册 file-open（不注册 create），保存新文件不补全、打开才补全', async () => {
    setSettingsProvider(() => ({ autoSummaryTiming: 'lazy', articleDirectory: '归档/网页剪藏' }) as any);
    const fetchSpy = mockAIResponse('{"summary":"S","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    // lazy：无 create 监听，仅 file-open
    expect(vault.listeners['create']).toBeUndefined();
    expect(workspace.listeners['file-open']).toHaveLength(1);

    // 保存（create）新剪藏 → 不触发 AI
    vault.files.set('归档/网页剪藏/lazy.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    vault.emit('create', vault.file('归档/网页剪藏/lazy.md'));
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchSpy).not.toHaveBeenCalled();

    // 打开文件 → 补全触发
    workspace.emit('file-open', vault.file('归档/网页剪藏/lazy.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(vault.files.get('归档/网页剪藏/lazy.md')).toContain('summary: "S"');
  });

  it('ticket 124：摘要时机 immediate（默认）→ create+file-open 双监听（行为不变）', async () => {
    setSettingsProvider(() => ({ autoSummaryTiming: 'immediate', articleDirectory: '归档/网页剪藏' }) as any);
    const fetchSpy = mockAIResponse('{"summary":"S","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    expect(vault.listeners['create']).toHaveLength(1);
    expect(workspace.listeners['file-open']).toHaveLength(1);
    vault.files.set('归档/网页剪藏/imm.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    vault.emit('create', vault.file('归档/网页剪藏/imm.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('stopAutoSummary 撤销已排队任务：停用后 clearTimeout，延迟窗内的文件不再触发 AI（审计修复）', async () => {
    setSettingsProvider(() => ({}) as any); // 重置残留 articleDirectory
    const fetchSpy = mockAIResponse('{"summary":"S","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/queued.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    workspace.emit('file-open', vault.file('归档/网页剪藏/queued.md'));
    await vi.advanceTimersByTimeAsync(1000); // 已入队，尚未到 1500ms
    stopAutoSummary(); // 停用：排队任务应被 clearTimeout 撤销
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchSpy).not.toHaveBeenCalled(); // 停用后不再触发 AI
    expect(vault.modifiedPaths).toHaveLength(0); // 文件未被改写
    // 再开启：恢复正常处理
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    workspace.emit('file-open', vault.file('归档/网页剪藏/queued.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ===== enh-autosum 包 2：批量串行队列与通知聚合 =====

  /** 门控 fetch 状态：挂起请求按序放行；afterEach 兜底清空——断言中断的用例若留
   *  未完成的 in-flight 任务，模块级 draining 会跨用例滞留（后续用例队列泵拒动） */
  const gate: { fetchSpy: ReturnType<typeof vi.fn> | null; pending: Array<(json: string) => void> } = {
    fetchSpy: null,
    pending: [],
  };

  /** 门控 fetch mock：每次调用挂起，测试按序放行并逐个给 AI 响应 */
  function gateFetch(): ReturnType<typeof vi.fn> {
    const encoder = new TextEncoder();
    const fetchSpy = vi.fn().mockImplementation(() => new Promise<any>((resolve) => {
      gate.pending.push((json: string) => resolve({
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: json } }] })}\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n'));
            controller.close();
          },
        }),
      }));
    }));
    gate.fetchSpy = fetchSpy;
    gate.pending.length = 0;
    (global as any).fetch = fetchSpy;
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    resetAIProviderCache();
    return fetchSpy;
  }

  /** 按序放行最早挂起的 AI 请求 */
  function releaseNext(json = '{"summary":"S","tags":["a"]}'): void {
    const r = gate.pending.shift();
    if (r) r(json);
  }

  it('enh 包 2：多篇并发收敛为串行 FIFO——严格按入队顺序逐个处理', async () => {
    setSettingsProvider(() => ({}) as any); // 重置残留 articleDirectory
    const fetchSpy = gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    const feats: Array<[string, string]> = [
      ['归档/网页剪藏/q1.md', '特征句一'],
      ['归档/网页剪藏/q2.md', '特征句二'],
      ['归档/网页剪藏/q3.md', '特征句三'],
    ];
    for (const [p, feat] of feats) {
      vault.files.set(p, `---\ntitle: "T"\n---\n\n${feat}${LONG_BODY}`);
    }
    vault.emit('create', vault.file('归档/网页剪藏/q1.md'));
    vault.emit('create', vault.file('归档/网页剪藏/q2.md'));
    vault.emit('create', vault.file('归档/网页剪藏/q3.md'));
    await vi.advanceTimersByTimeAsync(1600); // 三个延迟窗到期 → 依序入队（0ms 合并窗后泵启动）
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 串行：第 1 篇完成前不发起第 2 篇
    expect(String(fetchSpy.mock.calls[0][1]?.body)).toContain('特征句一'); // FIFO：队列头先跑

    releaseNext('{"summary":"S1","tags":["a"]}');
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1][1]?.body)).toContain('特征句二');

    releaseNext('{"summary":"S2","tags":["a"]}');
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(String(fetchSpy.mock.calls[2][1]?.body)).toContain('特征句三');

    releaseNext('{"summary":"S3","tags":["a"]}');
    await vi.advanceTimersByTimeAsync(300);
    expect(vault.files.get('归档/网页剪藏/q1.md')).toContain('summary: "S1"');
    expect(vault.files.get('归档/网页剪藏/q2.md')).toContain('summary: "S2"');
    expect(vault.files.get('归档/网页剪藏/q3.md')).toContain('summary: "S3"');
  });

  it('enh 包 2：批量进度聚合为单条「正在生成摘要 k/N…」逐个更新，不再逐篇叠 progress', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    for (const p of ['a', 'b', 'c']) {
      vault.files.set(`归档/网页剪藏/batch-${p}.md`, `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
      vault.emit('create', vault.file(`归档/网页剪藏/batch-${p}.md`));
    }
    await vi.advanceTimersByTimeAsync(1600); // 全部入队（合并窗落位）→ 第 1 篇开跑
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    let msgs = getNoticeMessages();
    expect(msgs.some((m) => m.includes('正在生成摘要 1/3'))).toBe(true); // 单条聚合通知
    expect(msgs.some((m) => m.includes('正在为《'))).toBe(false); // 逐篇 progress 已静音

    releaseNext();
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(getNoticeMessages().some((m) => m.includes('正在生成摘要 2/3'))).toBe(true); // 原地更新

    releaseNext();
    await vi.advanceTimersByTimeAsync(100);
    releaseNext();
    await vi.advanceTimersByTimeAsync(400); // 末篇完成 + 聚合通知退出动画
    // 三篇全部写回
    for (const p of ['a', 'b', 'c']) {
      expect(vault.files.get(`归档/网页剪藏/batch-${p}.md`)).toContain('summary: "S"');
    }
    // 批次收尾：聚合 progress 通知撤下
    expect(getNoticeMessages().some((m) => m.includes('正在生成摘要'))).toBe(false);
  });

  it('enh 包 2：单篇仍走逐篇进度通知（聚合只在 >1 篇时出现）', async () => {
    setSettingsProvider(() => ({}) as any);
    mockAIResponse('{"summary":"S","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/solo.md', `---\ntitle: "孤篇"\n---\n\n${LONG_BODY}`);
    workspace.emit('file-open', vault.file('归档/网页剪藏/solo.md'));
    await vi.advanceTimersByTimeAsync(1600);
    const msgs = getNoticeMessages();
    expect(msgs).toHaveLength(1); // 进度原地合并为结果，单条
    expect(msgs[0]).toBe('《孤篇》\n\nS\n\n#a');
    expect(msgs.some((m) => m.includes('正在生成摘要'))).toBe(false); // 无聚合通知
  });

  it('enh 包 2：stopAutoSummary 清空待处理队列——进行中任务完成，未开工任务丢弃', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/run.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    vault.files.set('归档/网页剪藏/wait.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    vault.emit('create', vault.file('归档/网页剪藏/run.md'));
    vault.emit('create', vault.file('归档/网页剪藏/wait.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // run 开跑（挂起），wait 排队

    stopAutoSummary(); // 清空队列
    releaseNext();
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // wait 不再发起 AI
    expect(vault.files.get('归档/网页剪藏/run.md')).toContain('summary: "S"'); // 进行中任务完成落盘
    expect(vault.files.get('归档/网页剪藏/wait.md')).not.toContain('summary:'); // 排队任务被丢弃
  });

  // ===== enh-autosum 包 1：手动重跑入口 =====

  it('enh 包 1：regenerateSummary——字段齐全文件强制重建，title 不动、不重命名', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = mockAIResponse('{"summary":"新S","tags":["新"]}');
    vault.files.set('归档/网页剪藏/manual.md', `---\ntitle: "用户标题"\nsummary: "旧S"\ntags:\n  - "旧"\n---\n\n${LONG_BODY}`);
    const done = regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/manual.md'));
    await vi.advanceTimersByTimeAsync(50); // 泵 0ms 合并窗（fake timers 需推进）
    await done;
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 字段齐全仍调 AI（force 跳过缺失检测）
    const out = vault.files.get('归档/网页剪藏/manual.md')!; // 未重命名
    expect(out).toContain('title: "用户标题"');
    expect(out).toContain('summary: "新S"');
    expect(out).toContain('  - "新"');
  });

  it('enh 包 1：redoSummaryForActiveFile——非剪藏笔记给人话提示，不调 AI', async () => {
    const fetchSpy = mockAIResponse('{"summary":"S"}');
    vault.files.set('日记/随记.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    workspace.setActiveFile(vault.file('日记/随记.md'));
    await redoSummaryForActiveFile(makeApp(vault, workspace));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getNoticeMessages().some((m) => m.includes('当前打开的不是剪藏笔记'))).toBe(true);
  });

  it('enh 包 1：redoSummaryForActiveFile——无打开文件同样人话提示', async () => {
    mockAIResponse('{"summary":"S"}');
    workspace.setActiveFile(null);
    await redoSummaryForActiveFile(makeApp(vault, workspace));
    expect(getNoticeMessages().some((m) => m.includes('当前打开的不是剪藏笔记'))).toBe(true);
  });

  it('enh 包 1：redoSummaryForActiveFile——剪藏笔记 force 重建走串行队列', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = mockAIResponse('{"summary":"新S","tags":["新"]}');
    vault.files.set('归档/网页剪藏/act.md', `---\ntitle: "T"\nsummary: "旧S"\n---\n\n${LONG_BODY}`);
    workspace.setActiveFile(vault.file('归档/网页剪藏/act.md'));
    const done = redoSummaryForActiveFile(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(50); // 泵 0ms 合并窗
    await done;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const out = vault.files.get('归档/网页剪藏/act.md')!;
    expect(out).toContain('summary: "新S"');
    expect(out).toContain('title: "T"'); // force 不吞标题
  });
});
