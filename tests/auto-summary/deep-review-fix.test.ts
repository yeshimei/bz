/**
 * 自动摘要域深审修复批回归（bz-fix-as-core）：
 * - A2 AI 结果 schema 校验 / N-UI5 回执诚信 / N-UI2 短文反馈 / N3 流式数组不覆盖
 * - A5+N4 结果契约与写盘失败人话 / N5 重试钮 core action 化 / T6 clipbook 接缝
 * - N1 尾斜杠 / A3 顶层口径 / N-UI1 批次键 / EFF-1 聚合 / EFF-2 插队 / EFF-3 熔断
 * - N6/A4 stop 语义 / AS3 双注册探针 / T4 超时防线 / T5 reset seam
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import {
  ensureAutoSummary,
  stopAutoSummary,
  __resetForTest,
  regenerateSummary,
  redoSummaryForActiveFile,
} from '../../src/auto-summary/index';
import { processFile } from '../../src/auto-summary/processor';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';

vi.mock('../../src/clipbook/ui', () => ({
  revealClipArticle: vi.fn(),
}));

import { revealClipArticle } from '../../src/clipbook/ui';

function makeApp(vault: MockVault, workspace = makeWorkspace()) {
  return { vault, metadataCache: {}, workspace } as any;
}

/** workspace mock：可注册/触发 file-open（offref 语义与 MockVault 一致）+ getActiveFile */
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

function makeAI(result: string | null, reject = false) {
  const prompt = reject
    ? vi.fn().mockRejectedValue(new Error('AI 挂了'))
    : vi.fn().mockResolvedValue(result);
  return { prompt } as any;
}

const LONG_BODY = '段落内容。'.repeat(30); // >100 字

/** 立即成功的流式 AI mock（fake timers 下用） */
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

/** 门控 fetch 状态 + 挂起型 mock（批量队列测试用；afterEach 兜底放行） */
const gate: { pending: Array<(json: string) => void>; fetchSpy: ReturnType<typeof vi.fn> | null } = {
  pending: [],
  fetchSpy: null,
};

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

function releaseNext(json = '{"summary":"S","tags":["a"]}'): void {
  const r = gate.pending.shift();
  if (r) r(json);
}

describe('processor 深审修复（A2/N-UI5/N-UI2/N3/N4/N5/A5/T6）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    resetAIProviderCache();
    setAISettingsProvider(() => ({})); // 默认未配 AI：失败原因走「未配置」文案
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  it('A2：AI 返回 title 为对象 → 不改名、无 [object Object] 物化，按未生成处理（partial）', async () => {
    vault.files.set('归档/网页剪藏/obj.md', `---\nurl: "https://x.com/o"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"title":{"main":"对象标题"},"summary":"摘要","tags":["a"]}');
    const outcome = await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/obj.md'));
    expect(outcome).toBe('partial'); // title 未生成
    expect(vault.files.has('归档/网页剪藏/[object Object].md')).toBe(false);
    const out = vault.files.get('归档/网页剪藏/obj.md')!; // 未改名
    expect(out).not.toContain('[object Object]');
    expect(out).toContain('summary: "摘要"'); // 有效字段照写
    expect(getNoticeMessages().some((m) => m.includes('标题未能生成'))).toBe(true);
  });

  it('A2：AI 返回 summary 为数组 → summary 未写入（不物化 String()）', async () => {
    vault.files.set('归档/网页剪藏/arr.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"summary":["段1","段2"],"tags":["a"]}');
    const outcome = await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/arr.md'));
    expect(outcome).toBe('partial');
    const out = vault.files.get('归档/网页剪藏/arr.md')!;
    expect(out).not.toContain('[object Object]');
    expect(out).not.toContain('段1');
    expect(out).toContain('  - "a"');
  });

  it('N-UI5：AI 返回只有 summary（请求 title+summary+tags）→ 通知非「已完成」，含未补全提示', async () => {
    vault.files.set('归档/网页剪藏/half.md', `---\nurl: "https://x.com/h"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"summary":"只有摘要"}');
    const outcome = await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/half.md'));
    expect(outcome).toBe('partial');
    const msgs = getNoticeMessages();
    expect(msgs.some((m) => m === '已完成')).toBe(false); // 回执诚信 gate：缺口不得报「已完成」
    expect(msgs.some((m) => m.includes('未能生成'))).toBe(true);
  });

  it('A2 畸形 JSON 与纯文本响应 → aiProcess 静默 null（与 reject 同兜底）', async () => {
    const { aiProcess } = await import('../../src/auto-summary/processor');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await aiProcess(makeAI('{"title":'), '正文', ['title'])).toBeNull(); // 残缺 JSON
    expect(await aiProcess(makeAI('抱歉我无法解析'), '正文', ['title'])).toBeNull(); // 无 JSON 形
    expect(await aiProcess(makeAI('{不是合法结构}'), '正文', ['title'])).toBeNull();
    warn.mockRestore();
  });

  it('N-UI2：force + 正文 <100 字 → info 反馈 + AI 未调（手动动作不再零反馈）', async () => {
    vault.files.set('归档/网页剪藏/short.md', `---\ntitle: "T"\n---\n\n太短`);
    const ai = makeAI('{"summary":"S"}');
    const outcome = await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/short.md'), { force: true });
    expect(outcome).toBe('skipped-short');
    expect(getNoticeMessages().some((m) => m.includes('正文过短'))).toBe(true);
    expect(ai.prompt).not.toHaveBeenCalled();
  });

  it('N3：tags 为流式数组降级字符串（非空）→ 不判缺失、不请求不覆盖', async () => {
    vault.files.set(
      '归档/网页剪藏/inline.md',
      `---\ntitle: "T"\ntags: ['a', 'b']\n---\n\n${LONG_BODY}`
    );
    const ai = makeAI('{"summary":"新摘要"}');
    const outcome = await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/inline.md'));
    expect(outcome).toBe('ok');
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).not.toContain('tags 规则'); // 只请求 summary
    const out = vault.files.get('归档/网页剪藏/inline.md')!;
    expect(out).toContain("['a', 'b']"); // 原值保留（管辖键重序列化引号化，YAML 语义不变；不被 AI 标签覆盖）
    expect(out).toContain('summary: "新摘要"');
  });

  it('N4：写盘失败（modify reject）→ 「摘要写入失败」常驻 error + 重试按钮 + write-failed', async () => {
    vault.files.set('归档/网页剪藏/wf.md', `---\nurl: "https://x.com/w"\n---\n\n${LONG_BODY}`);
    const failing = new MockVault();
    failing.files.set('归档/网页剪藏/wf.md', `---\nurl: "https://x.com/w"\n---\n\n${LONG_BODY}`);
    failing.modify = vi.fn().mockRejectedValue(new Error('磁盘写满')) as any;
    setApp(makeApp(failing));
    const ai = makeAI('{"summary":"S","tags":["a"]}');
    const outcome = await processFile(makeApp(failing), ai, failing.file('归档/网页剪藏/wf.md'));
    expect(outcome).toBe('write-failed');
    await new Promise((r) => setTimeout(r, 250)); // progress 退出动画
    expect(getNoticeMessages()).toContain('摘要写入失败，请重试');
    const retryBtn = document.querySelector('.bz-notice .bz-notice-action') as HTMLElement;
    expect(retryBtn).not.toBeNull();
    expect(retryBtn.textContent).toBe('重试');
  });

  it('A5 结果契约：字段齐全 → skipped-complete；AI null → ai-failed（泵可感知）', async () => {
    vault.files.set(
      '归档/网页剪藏/full.md',
      `---\ntitle: "T"\nsummary: "S"\ntags:\n  - "a"\n---\n\n${LONG_BODY}`
    );
    const outcome = await processFile(makeApp(vault), makeAI(null), vault.file('归档/网页剪藏/full.md'));
    expect(outcome).toBe('skipped-complete');

    vault.files.set('归档/网页剪藏/fail.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    const outcome2 = await processFile(makeApp(vault), makeAI(null, true), vault.file('归档/网页剪藏/fail.md'));
    expect(outcome2).toBe('ai-failed');
  });

  it('N5：失败通知「重试」按钮由 core action 通道渲染（tabIndex 键盘可达）', async () => {
    vault.files.set('归档/网页剪藏/kb.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    await processFile(makeApp(vault), makeAI(null), vault.file('归档/网页剪藏/kb.md'));
    await new Promise((r) => setTimeout(r, 250));
    const btn = document.querySelector('.bz-notice .bz-notice-action') as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('重试');
    expect(btn.tabIndex).toBe(0); // core appendActionBtn：R6 键盘可达
  });

  it('T6：成功通知「查看」onClick → revealClipArticle(目标路径)（clipbook 接缝断言）', async () => {
    vault.files.set('归档/网页剪藏/view.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    await processFile(makeApp(vault), makeAI('{"summary":"S","tags":["a"]}'), vault.file('归档/网页剪藏/view.md'));
    const btn = [...document.querySelectorAll('.bz-notice-action')].find(
      (el) => el.textContent === '查看'
    ) as HTMLElement;
    expect(btn).not.toBeUndefined();
    btn.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(revealClipArticle).toHaveBeenCalledWith('归档/网页剪藏/view.md');
  });

  it('clipbook 写侧 tags 数组项含引号 → 转义产物合法（一致#1 防退役）', async () => {
    const { writeClipNote } = await import('../../src/clipbook/save');
    await writeClipNote({ title: '引号标签文', url: 'https://x.com/q', tags: ['a"b'], body: '正文' });
    const md = vault.files.get('归档/网页剪藏/引号标签文.md')!;
    expect(md).toContain('  - "a\\"b"');
  });
});

describe('index 深审修复（N1/A3/N-UI1/EFF-1/EFF-2/EFF-3/N6/A4/AS3/T4/T5）', () => {
  let vault: MockVault;
  let workspace: ReturnType<typeof makeWorkspace>;

  beforeEach(() => {
    vi.useFakeTimers();
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    workspace = makeWorkspace();
    setApp(makeApp(vault, workspace));
  });

  afterEach(async () => {
    // T5 reset seam + 门控兜底：先放行挂起请求让 in-flight settle，再冲洗模块态
    for (const r of gate.pending.splice(0)) r('{"summary":"S","tags":["a"]}');
    __resetForTest();
    vi.useRealTimers();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });

  it('N1：设置带尾斜杠 → 监听命中补全 + 命令不误报（修复前前缀成 `…//` 恒不命中）', async () => {
    setSettingsProvider(() => ({ articleDirectory: '归档/网页剪藏/' }) as any);
    const fetchSpy = mockAIResponse('{"summary":"尾斜杠","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/ts.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    workspace.emit('file-open', vault.file('归档/网页剪藏/ts.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 修复前：startsWith('归档/网页剪藏//') 恒 false
    expect(vault.files.get('归档/网页剪藏/ts.md')).toContain('summary: "尾斜杠"');
    // 命令对目录内笔记不再误报「当前打开的不是剪藏笔记」（redo 走队列，需推进泵）
    workspace.setActiveFile(vault.file('归档/网页剪藏/ts.md'));
    const redo = redoSummaryForActiveFile(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(50);
    await redo;
    expect(getNoticeMessages().some((m) => m.includes('当前打开的不是剪藏笔记'))).toBe(false);
  });

  it('A3：watch 目录子目录内缺字段 md → file-open 不触发 AI、文件不改（口径对齐 clipbook 顶层扫描）', async () => {
    const fetchSpy = mockAIResponse('{"summary":"不该出现","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/资料/私人笔记.md', `---\ntitle: "私人"\n---\n\n${LONG_BODY}`);
    workspace.emit('file-open', vault.file('归档/网页剪藏/资料/私人笔记.md'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).not.toHaveBeenCalled(); // 修复前：递归前缀命中 → AI 补全甚至改名
    expect(vault.files.get('归档/网页剪藏/资料/私人笔记.md')).not.toContain('summary:');
  });

  it('N-UI1：两批间隔 <30s → 第二批聚合进度仍出现（批次键带序号，不再撞 core 去重窗）', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    // 批次 1：2 篇
    for (const p of ['n1a', 'n1b']) {
      vault.files.set(`归档/网页剪藏/${p}.md`, `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
      vault.emit('create', vault.file(`归档/网页剪藏/${p}.md`));
    }
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getNoticeMessages().some((m) => m.includes('正在生成摘要 1/2'))).toBe(true);
    releaseNext();
    await vi.advanceTimersByTimeAsync(100); // f1 完成 → f2 开跑
    releaseNext();
    await vi.advanceTimersByTimeAsync(600); // f2 完成 → 批次 1 收场（聚合通知 hide）
    expect(getNoticeMessages().some((m) => m.includes('正在生成摘要'))).toBe(false);
    // 批次 2（30s 去重窗内）：2 篇——修复前常量键被吞、整批零进度指示
    for (const p of ['n2a', 'n2b']) {
      vault.files.set(`归档/网页剪藏/${p}.md`, `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
      vault.emit('create', vault.file(`归档/网页剪藏/${p}.md`));
    }
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(getNoticeMessages().some((m) => m.includes('正在生成摘要 1/2'))).toBe(true); // 修复前必红
    releaseNext();
    await vi.advanceTimersByTimeAsync(100);
    releaseNext();
    await vi.advanceTimersByTimeAsync(600);
  });

  it('EFF-1：批量 3 篇全成功 → 逐篇「已完成」0 条 + 收场单条「已生成 3 篇摘要」', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    for (const p of ['e1', 'e2', 'e3']) {
      vault.files.set(`归档/网页剪藏/${p}.md`, `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
      vault.emit('create', vault.file(`归档/网页剪藏/${p}.md`));
    }
    await vi.advanceTimersByTimeAsync(1600);
    releaseNext();
    await vi.advanceTimersByTimeAsync(100);
    releaseNext();
    await vi.advanceTimersByTimeAsync(100);
    releaseNext();
    await vi.advanceTimersByTimeAsync(500); // 收场 + 汇总
    const msgs = getNoticeMessages();
    expect(msgs.filter((m) => m === '已完成')).toHaveLength(0); // 修复前 3 条一模一样
    expect(msgs.some((m) => m === '已生成 3 篇摘要')).toBe(true);
  });

  it('EFF-3：连续失败 3 篇 → 熔断暂停（第 4 篇不发起）+ 「继续」续跑 + 收场失败汇总', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = vi.fn().mockRejectedValue(new Error('网络挂了'));
    (global as any).fetch = fetchSpy;
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    resetAIProviderCache();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    for (const p of ['b1', 'b2', 'b3', 'b4']) {
      vault.files.set(`归档/网页剪藏/${p}.md`, `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
      vault.emit('create', vault.file(`归档/网页剪藏/${p}.md`));
    }
    await vi.advanceTimersByTimeAsync(2000); // 前 3 篇串行快速失败
    expect(fetchSpy).toHaveBeenCalledTimes(3); // 修复前：4 篇连环失败无熔断
    expect(getNoticeMessages().some((m) => m.includes('批量摘要已暂停'))).toBe(true);
    const cont = [...document.querySelectorAll('.bz-notice-action')].find(
      (el) => el.textContent === '继续'
    ) as HTMLElement;
    expect(cont).not.toBeUndefined();
    cont.click();
    await vi.advanceTimersByTimeAsync(1000); // 第 4 篇失败 + 收场
    expect(fetchSpy).toHaveBeenCalledTimes(4); // 续跑发起
    expect(getNoticeMessages().some((m) => m.includes('批量摘要生成失败'))).toBe(true);
    warn.mockRestore();
  });

  it('EFF-2：批量排队中手动重跑 → 插队队头 + 入队反馈（修复前 FIFO 队尾长等无感知）', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    for (const p of ['q1', 'q2']) {
      vault.files.set(`归档/网页剪藏/${p}.md`, `---\ntitle: "T"\n---\n\n${p}特征正文。${LONG_BODY}`);
      vault.emit('create', vault.file(`归档/网页剪藏/${p}.md`));
    }
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // q1 开跑挂起，q2 排队

    vault.files.set('归档/网页剪藏/manual.md', `---\ntitle: "T"\n---\n\n手动特征正文。${LONG_BODY}`);
    const manual = regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/manual.md'));
    await vi.advanceTimersByTimeAsync(50); // 入队（unshift）+ 合并窗
    expect(getNoticeMessages().some((m) => m.includes('已加入摘要队列'))).toBe(true);
    releaseNext('{"summary":"S1","tags":["a"]}'); // q1 完成
    await vi.advanceTimersByTimeAsync(100);
    expect(String(fetchSpy.mock.calls[1][1]?.body)).toContain('手动特征正文'); // 插队：下一个跑的是手动篇
    releaseNext('{"summary":"SM","tags":["a"]}'); // manual 完成
    await vi.advanceTimersByTimeAsync(100);
    expect(String(fetchSpy.mock.calls[2][1]?.body)).toContain('q2特征正文');
    releaseNext('{"summary":"S2","tags":["a"]}');
    await vi.advanceTimersByTimeAsync(500);
    await manual; // 手动任务 Promise 随队列 settle
  });

  it('N-UI3：目标在处理中 → 手动重跑给「正在处理中」反馈 + 不双跑（修复前静默吞）', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/busy.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    const first = regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/busy.md'));
    await vi.advanceTimersByTimeAsync(50); // 开跑挂起
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const second = regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/busy.md'));
    await second; // 立即 settle
    expect(getNoticeMessages().some((m) => m.includes('该篇正在处理中'))).toBe(true); // 修复前零反馈
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 去重：不双跑
    releaseNext();
    await vi.advanceTimersByTimeAsync(100);
    await first;
  });

  it('N6：排队任务遇 stop → await 的 regenerateSummary resolve（修复前 Promise 永挂）', async () => {
    setSettingsProvider(() => ({}) as any);
    gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/run.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    vault.files.set('归档/网页剪藏/queued.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    const p1 = regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/run.md'));
    await vi.advanceTimersByTimeAsync(50); // run 开跑挂起
    const p2 = regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/queued.md'));
    await vi.advanceTimersByTimeAsync(50); // queued 排队
    let settled = false;
    p2.then(() => { settled = true; });
    stopAutoSummary();
    await vi.advanceTimersByTimeAsync(50); // 冲洗微任务
    expect(settled).toBe(true); // 修复前：清队不 resolve，await 永挂
    releaseNext(); // in-flight run 完成落盘（stop 后完成即止）
    await vi.advanceTimersByTimeAsync(200);
    await p1;
    expect(vault.files.get('归档/网页剪藏/run.md')).toContain('summary: "S"');
    expect(vault.files.get('归档/网页剪藏/queued.md')).not.toContain('summary:'); // 排队任务被丢弃
  });

  it('A4：stop → ensure 后对 in-flight 同篇手动重跑 → 去重仍拦截（修复前双跑 AI）', async () => {
    setSettingsProvider(() => ({}) as any);
    const fetchSpy = gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/inf.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    const p1 = regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/inf.md'));
    await vi.advanceTimersByTimeAsync(50); // inf 开跑挂起（force，fetch=1）
    stopAutoSummary(); // 修复前：无条件 processingPaths.clear() 连「处理中」事实一起撤
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    await regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/inf.md'));
    expect(getNoticeMessages().some((m) => m.includes('该篇正在处理中'))).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 修复前必红：第二次 fetch 发出（双倍花费）
    releaseNext();
    await vi.advanceTimersByTimeAsync(200);
    await p1;
  });

  it('AS3 探针：lazy 档未 stop 连续两次 ensure → file-open 监听恰 1（修复前双注册）', async () => {
    setSettingsProvider(() => ({ autoSummaryTiming: 'lazy', articleDirectory: '归档/网页剪藏' }) as any);
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    expect(workspace.listeners['file-open']).toHaveLength(1);
    ensureAutoSummary(makeApp(vault, workspace)); // 不 stop 直接再 ensure（未来新入口形态）
    await vi.advanceTimersByTimeAsync(2000);
    expect(workspace.listeners['file-open']).toHaveLength(1); // 修复前：判据看 fileListenerRef（lazy 恒 null）→ 2
  });

  it('T4 防线：AI 请求永挂起 → core 60s 空闲超时兜底，泵继续下一篇（不卡死队列）', async () => {
    setSettingsProvider(() => ({}) as any);
    const encoder = new TextEncoder();
    // 永挂 fetch（不主动回包）：监听 core 传入的 abort signal（idle 超时 abort → reject，
    // 复刻真实 fetch 语义）；resolver 存 gate.pending 供 afterEach 兜底放行防跨用例滞留
    const fetchSpy = vi.fn().mockImplementation((_url: any, init: any) => new Promise<any>((resolve, reject) => {
      const signal = init?.signal;
      const onAbort = () => reject(new Error('The operation was aborted.'));
      if (signal?.aborted) { onAbort(); return; }
      signal?.addEventListener('abort', onAbort);
      gate.pending.push((json: string) => {
        signal?.removeEventListener('abort', onAbort);
        resolve({
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
      });
    }));
    (global as any).fetch = fetchSpy;
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    resetAIProviderCache();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    for (const p of ['t1', 't2']) {
      vault.files.set(`归档/网页剪藏/${p}.md`, `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
      vault.emit('create', vault.file(`归档/网页剪藏/${p}.md`));
    }
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // t1 挂起
    // fetch 在 ≈1600ms 时刻发起，core 空闲 timer 60s → due ≈61600ms：一次推进需覆盖
    await vi.advanceTimersByTimeAsync(62000); // core AI_IDLE_TIMEOUT_MS（C1）触发
    await vi.advanceTimersByTimeAsync(500); // requestUrl 兜底链冲洗
    expect(fetchSpy).toHaveBeenCalledTimes(2); // 泵继续 t2——修复前无此防线用例
    warn.mockRestore();
  });

  it('T5：__resetForTest 冲洗后队列可复用（draining 不跨用例滞留）', async () => {
    setSettingsProvider(() => ({}) as any);
    gateFetch();
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/hold.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    const hold = regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/hold.md'));
    await vi.advanceTimersByTimeAsync(50); // 挂起（draining=true）
    for (const r of gate.pending.splice(0)) r('{"summary":"S","tags":["a"]}');
    __resetForTest(); // 冲洗（含 stop + 状态清零）
    await vi.advanceTimersByTimeAsync(100);
    await hold;
    // 冲洗后新批次可正常入队跑通（draining 已复位）
    const fetchSpy2 = mockAIResponse('{"summary":"新批次","tags":["a"]}');
    ensureAutoSummary(makeApp(vault, workspace));
    await vi.advanceTimersByTimeAsync(2000);
    vault.files.set('归档/网页剪藏/again.md', `---\ntitle: "T"\n---\n\n${LONG_BODY}`);
    const again = regenerateSummary(makeApp(vault, workspace), vault.file('归档/网页剪藏/again.md'));
    await vi.advanceTimersByTimeAsync(100);
    await again;
    expect(fetchSpy2).toHaveBeenCalledTimes(1);
    expect(vault.files.get('归档/网页剪藏/again.md')).toContain('summary: "新批次"');
  });
});
