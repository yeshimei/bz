/**
 * 第二大脑对话 UX 批次测试（ticket 141，jsdom）：
 * - 多行输入：input → textarea（类名 DOM 契约不变）；Enter 发送 / Shift+Enter 换行 /
 *   组合态（isComposing）回车不发送；输入事件自增高度；
 * - 请求可取消：发送钮原地切「停止」，点击经 AbortController 中止（signal abort → AI.ask 拒绝），
 *   状态恢复为「发送」，气泡提示「已停止生成。」；请求中 Enter 不触发新一轮；
 * - 流式增量渲染：onDelta 增量写入占位气泡，完成后整段 markdown 重渲；
 * - 历史持久化：secondbrain.json chatHistory 段每轮写盘 / 打开读回渲染 /
 *   旧数据无段兼容（零迁移）；「清空对话」flow 确认后清空并写盘；
 * - 概括移除：主面板无概括区块、无残留导出，设置「AI 通道」描述不再提概括。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';
import { ChatPanel } from '../../src/secondbrain/chat-panel';
import { AI } from '../../src/secondbrain/ai';
import {
  appendChatHistory,
  clearChatHistory,
  loadChatHistory,
} from '../../src/secondbrain/store-file';

const STORE_PATH = 'CONFIG/STORAGE/secondbrain.json';

function makeEnv() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as BzSettings);
  return { vault, app };
}

function makeStore(searchImpl: () => Promise<unknown[]> = async () => []): any {
  return { search: vi.fn(searchImpl) };
}

/** 轮询等待异步条件（写盘/读回链路经多个微任务；fn 可为异步） */
async function until(fn: () => boolean | Promise<boolean>, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  while (!(await fn())) {
    if (Date.now() - start > timeoutMs) throw new Error('until 超时');
    await new Promise((r) => setTimeout(r, 10));
  }
}

function pressKey(el: HTMLElement, init: KeyboardEventInit & { keyCode?: number }): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', init);
  if (init.keyCode !== undefined) Object.defineProperty(ev, 'keyCode', { value: init.keyCode });
  el.dispatchEvent(ev);
  return ev;
}

async function persisted(): Promise<{ role: string; content: string }[]> {
  const raw = await loadChatHistory();
  return raw.map((m) => ({ role: m.role, content: m.content }));
}

describe('第二大脑对话：多行输入（ticket 141）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    makeEnv();
  });

  it('输入为 textarea（类名沿用 bz-sb-chat-input），高度随输入自增', () => {
    const chat = new ChatPanel(makeStore(), {} as any);
    expect(chat.input.tagName).toBe('TEXTAREA');
    expect(chat.input.classList.contains('bz-sb-chat-input')).toBe(true);
    chat.input.value = '第一行';
    chat.input.dispatchEvent(new Event('input'));
    expect(chat.input.style.height).toContain('px'); // 自增高设置（jsdom scrollHeight=0，仅验证联动）
    chat.destroy();
  });

  it('Enter 发送；Shift+Enter 换行不发送；组合态回车不发送', async () => {
    const chat = new ChatPanel(makeStore(), {} as any);
    const askSpy = vi.spyOn(AI, 'ask').mockResolvedValue('回答');

    chat.input.value = '  测试问题  ';
    pressKey(chat.input, { key: 'Enter' });
    await until(() => chat.messagesDiv.textContent!.includes('回答'));
    expect(askSpy).toHaveBeenCalledTimes(1);
    // 输入框清空（发送后）
    expect(chat.input.value).toBe('');

    // Shift+Enter：不发送（textarea 默认换行，不打断）
    chat.input.value = '多行输入';
    pressKey(chat.input, { key: 'Enter', shiftKey: true });
    expect(askSpy).toHaveBeenCalledTimes(1);

    // 组合态（isComposing）：回车是选字确认，不发送
    const composing = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(composing, 'isComposing', { value: true });
    chat.input.dispatchEvent(composing);
    expect(askSpy).toHaveBeenCalledTimes(1);

    // 组合态 keyCode 229 兜底同样不发送
    pressKey(chat.input, { key: 'Enter', keyCode: 229 });
    expect(askSpy).toHaveBeenCalledTimes(1);

    chat.destroy();
  });
});

describe('第二大脑对话：请求可取消（ticket 141）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    makeEnv();
  });

  it('发送后按钮切「停止」；点击中止 → 状态恢复、气泡提示已停止、回复不落历史', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const chat = new ChatPanel(makeStore(), app);

    // AI.ask 挂起直至 signal abort
    vi.spyOn(AI, 'ask').mockImplementation((_prompt: string, opts?: any) => {
      return new Promise<string>((_resolve, reject) => {
        (opts?.signal as AbortSignal).addEventListener('abort', () => {
          const err = new Error('请求已取消');
          (err as any).name = 'AbortError';
          reject(err);
        });
      });
    });

    chat.input.value = '会取消的问题';
    chat.sendBtn.click();
    await until(() => chat.sendBtn.textContent === '停止');
    expect(chat.sendBtn.disabled).toBe(false); // 停止态可点击

    // 请求中 Enter 不触发新一轮（user 气泡不重复）
    pressKey(chat.input, { key: 'Enter' });
    expect(chat.messagesDiv.querySelectorAll('.bz-sb-chat-msg.user')).toHaveLength(1);

    chat.sendBtn.click(); // 停止
    await until(() => chat.sendBtn.textContent === '发送');
    expect(chat.messagesDiv.textContent).toContain('已停止生成。');
    expect(chat.messagesDiv.textContent).not.toContain('出错了');

    // 已中止轮次：user 已写盘，assistant 不落
    await until(async () => (await persisted()).length === 1);
    const hist = await persisted();
    expect(hist).toEqual([{ role: 'user', content: '会取消的问题' }]);
    chat.destroy();
  });

  it('AI 正常失败仍走「出错了」路径（与取消区分）', async () => {
    const chat = new ChatPanel(makeStore(), {} as any);
    vi.spyOn(AI, 'ask').mockRejectedValue(new Error('服务商不可用'));
    chat.input.value = '测试问题';
    await chat.sendChatMessage();
    await until(() => chat.messagesDiv.textContent!.includes('出错了：服务商不可用'));
    expect(chat.sendBtn.textContent).toBe('发送');
    expect(chat.sendBtn.disabled).toBe(false);
    chat.destroy();
  });
});

describe('第二大脑对话：流式增量渲染（ticket 141）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    makeEnv();
  });

  it('onDelta 增量写入占位气泡；完成后整段 markdown 重渲并写盘', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const chat = new ChatPanel(makeStore(), app);

    let liveDuringFlight = '';
    vi.spyOn(AI, 'ask').mockImplementation(async (_prompt: string, opts?: any) => {
      opts.onDelta('第一段');
      liveDuringFlight = (chat.messagesDiv.lastElementChild as HTMLElement)?.textContent || '';
      opts.onDelta('第二段');
      return '完整回答正文';
    });

    chat.input.value = '流式问题';
    await chat.sendChatMessage();

    expect(liveDuringFlight).toContain('第一段'); // 请求中增量已上屏
    await until(() => chat.messagesDiv.textContent!.includes('完整回答正文'));
    // 占位气泡被最终 markdown 消息取代（mock MarkdownRenderer 直接 textContent = md）
    const msgs = chat.messagesDiv.querySelectorAll('.bz-sb-chat-msg.assistant');
    expect(msgs[msgs.length - 1].textContent).toContain('完整回答正文');
    expect(chat.sendBtn.textContent).toBe('发送');
    // 一轮问答写盘两条
    await until(async () => (await persisted()).length === 2);
    chat.destroy();
  });
});

describe('第二大脑对话：历史持久化与清空（ticket 141）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    makeEnv();
  });

  it('一轮问答写盘（user+assistant），重开面板读回渲染', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const chat = new ChatPanel(makeStore(), app);
    vi.spyOn(AI, 'ask').mockResolvedValue('持久化的回答');

    chat.input.value = '持久化问题';
    await chat.sendChatMessage();
    await until(() => vault.files.get(STORE_PATH)?.includes('持久化问题') ?? false);

    const raw = JSON.parse(vault.files.get(STORE_PATH)!);
    expect(raw.chatHistory).toEqual([
      { role: 'user', content: '持久化问题' },
      { role: 'assistant', content: '持久化的回答' },
    ]);

    // 重开面板：读回渲染（welcome + 历史 2 条）
    chat.destroy();
    const chat2 = new ChatPanel(makeStore(), app);
    await until(() => chat2.messagesDiv.textContent!.includes('持久化的回答'));
    expect(chat2.messagesDiv.textContent).toContain('持久化问题');
    chat2.destroy();
  });

  it('旧数据无 chatHistory 段 → 空历史零迁移，新一轮加法写回', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    // 旧结构：仅 meta/panel/link 三段
    vault.files.set(STORE_PATH, JSON.stringify({ version: 1, meta: null, panel: null, link: { queue: [], state: {} } }));

    const chat = new ChatPanel(makeStore(), app);
    await new Promise((r) => setTimeout(r, 50)); // 等读回链路走完（旧段为空 → 不追加）
    expect(chat.messagesDiv.children.length).toBe(1); // 仅欢迎语
    expect(chat.messagesDiv.textContent).toContain('你好！每次提问会独立检索');

    vi.spyOn(AI, 'ask').mockResolvedValue('回答');
    chat.input.value = '加法扩展问题';
    await chat.sendChatMessage();
    await until(() => vault.files.get(STORE_PATH)?.includes('chatHistory') ?? false);
    const raw = JSON.parse(vault.files.get(STORE_PATH)!);
    expect(raw.panel).toBeNull(); // 旧段保留
    expect(raw.chatHistory).toHaveLength(2); // 新段加法写入
    chat.destroy();
  });

  it('「清空对话」：取消不清，确认后清 UI + 写盘空段', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const chat = new ChatPanel(makeStore(), app);
    vi.spyOn(AI, 'ask').mockResolvedValue('待清空的回答');

    chat.input.value = '将被清空的问题';
    await chat.sendChatMessage();
    await until(async () => (await persisted()).length === 2);

    const clearBtn = chat.popup.querySelector<HTMLButtonElement>('.bz-sb-chat-clear')!;
    expect(clearBtn.textContent).toBe('清空对话');

    // 取消路径：历史不动
    clearBtn.click();
    await until(() => document.getElementById('__shared_confirm_popup__') !== null);
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await until(() => document.getElementById('__shared_confirm_popup__') === null);
    expect((await persisted()).length).toBe(2);
    expect(chat.messagesDiv.textContent).toContain('待清空的回答');

    // 确认路径：清 UI + 写盘
    clearBtn.click();
    await until(() => document.getElementById('__shared_confirm_popup__') !== null);
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await until(async () => (await persisted()).length === 0);
    expect(chat.messagesDiv.children.length).toBe(1); // 仅欢迎语
    expect(chat.messagesDiv.textContent).toContain('你好！');
    expect((await loadChatHistory()).length).toBe(0);
    chat.destroy();
  });

  it('数据层上限：appendChatHistory 超 100 条截断最旧（store 侧终检）', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    for (let i = 0; i < 105; i++) {
      await appendChatHistory([{ role: 'user', content: '问题' + i }], app);
    }
    const hist = await loadChatHistory(app);
    expect(hist).toHaveLength(100);
    expect(hist[0].content).toBe('问题5'); // 最旧 5 条被截断
    expect(hist[99].content).toBe('问题104');
    await clearChatHistory(app);
    expect(await loadChatHistory(app)).toEqual([]);
  });
});

describe('第二大脑：AI 生成概括移除（ticket 141）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    makeEnv();
  });

  it('主面板无概括区块与按钮；模块无概括残留导出', async () => {
    const { SecondBrainPanel } = await import('../../src/secondbrain/panel');
    const app = mockAppWithVault(new MockVault());
    setApp(app);
    // 就绪库 fake：直接内容态
    const store: any = {
      initialLoad: Promise.resolve(),
      isIndexReady: () => true,
      hasPendingChanges: () => false,
      isRefreshing: () => false,
      refresh: async () => {},
      meta: { notes: {}, _dim: 0 },
      vectors: [],
    };
    const panel = new SecondBrainPanel(app, store, { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    await until(() => document.getElementById('bz-sb-cards')?.innerHTML.includes('向量块') ?? false);
    expect(document.getElementById('bz-sb-summary-text')).toBeNull();
    expect(document.getElementById('bz-sb-summary-meta')).toBeNull();
    expect(document.querySelector('.bz-sb-summary-btn')).toBeNull();
    expect(document.querySelector('.bz-sb-panel')!.textContent).not.toContain('生成概括');
    panel.destroy();

    const panelModule = await import('../../src/secondbrain/panel');
    expect((panelModule as any).buildSummaryPrompt).toBeUndefined();
  });

  it('设置「AI 通道」描述不再提概括（对话保留）', async () => {
    const { secondBrainSettingsSchema } = await import('../../src/secondbrain/panel');
    const schema = secondBrainSettingsSchema();
    let aiRow: any;
    for (const g of schema.groups) {
      for (const r of g.rows as any[]) {
        if (r.name === 'AI 通道') aiRow = r;
      }
    }
    expect(aiRow).toBeTruthy();
    expect(aiRow.desc).not.toContain('概括');
    expect(aiRow.desc).toContain('对话');
  });
});
