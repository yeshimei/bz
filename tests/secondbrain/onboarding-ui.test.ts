/**
 * 第二大脑首用引导态 UI 测试（ticket 107，jsdom）：
 * - 空库时三条命令统一打开主面板（参考/对话命令转开主面板，不建窄窗）；
 * - 引导态渲染：说明 + 开始按钮 + 📚💬 收起；
 * - 点击初始化：成功 → 进度 → 自动切换内容态并渲染统计；失败 → 给出原因并可重试；
 * - 就绪库打开 → 直接内容态。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  ensureSecondBrain,
  unloadSecondBrain,
  openSecondBrainPanel,
  openSecondBrainReference,
  openSecondBrainChat,
} from '../../src/secondbrain/index';
import { SecondBrainPanel } from '../../src/secondbrain/panel';
import { VectorStore } from '../../src/secondbrain/vector-store';
import { getEmbedding, getEmbeddingsBatch } from '../../src/secondbrain/ollama';

vi.mock('../../src/secondbrain/ollama', () => ({
  EMBED_BATCH_SIZE: 1,
  getEmbedding: vi.fn(),
  getEmbeddingsBatch: vi.fn(),
  checkRemoteOllama: vi.fn(),
}));

const STORE_PATH = 'CONFIG/STORAGE/secondbrain.json';
const VEC_PATH = 'CONFIG/STORAGE/secondbrain.vec';

/** 把 meta 对象包入 secondbrain.json 单文件结构（ticket 120；panel/link 段空置） */
function storeJSON(meta: unknown): string {
  return JSON.stringify({ version: 1, meta, panel: null, link: { queue: [], state: {} } });
}

function makeAdapter(vault: MockVault) {
  const binary = new Map<string, ArrayBuffer>();
  const adapter: any = {
    read: async (p: string) => {
      const f = vault.files.get(p);
      if (f === undefined) throw new Error('ENOENT');
      return f;
    },
    write: async (p: string, data: string) => {
      vault.files.set(p, data);
    },
    readBinary: async (p: string) => {
      const b = binary.get(p);
      if (!b) throw new Error('ENOENT');
      return b;
    },
    writeBinary: async (p: string, data: ArrayBuffer) => {
      binary.set(p, data.slice(0));
    },
    stat: async () => {
      throw new Error('ENOENT');
    },
    exists: async (p: string) => vault.files.has(p),
  };
  return { adapter, binary };
}

function makeApp(vault: MockVault, adapter: any, mtimes: Record<string, number> = {}) {
  return {
    vault: {
      getMarkdownFiles: () =>
        [...vault.files.keys()]
          .filter((p) => p.endsWith('.md'))
          .map((p) => ({ path: p, stat: { mtime: mtimes[p] ?? 1 } })),
      read: async (f: any) => {
        const v = vault.files.get(f.path);
        if (v === undefined) throw new Error('ENOENT: ' + f.path);
        return v;
      },
      adapter,
      on: () => {
        throw new Error('no events in test');
      },
    },
    workspace: {},
  };
}

function sbSettings() {
  return {
    storagePath: 'CONFIG/STORAGE',
    secondBrainChunkMinLength: '10',
    secondBrainAllowPaths: '我的',
    secondBrainRemoteOllamaUrl: '',
    secondBrainMobileDefaultFullscreen: false,
  };
}

/** 轮询等待异步条件（load/render 链路经多个微任务+定时器） */
async function until(fn: () => boolean, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error('until 超时');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('第二大脑首用引导（ticket 107）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    setSettingsProvider(() => sbSettings() as any);
    unloadSecondBrain();
    vi.mocked(getEmbeddingsBatch).mockReset();
    vi.mocked(getEmbedding).mockReset();
  });

  it('空库：三个命令统一打开主面板引导态，不创建窄窗', async () => {
    const vault = new MockVault();
    const { adapter } = makeAdapter(vault); // 无任何数据文件 → 空库
    const app = makeApp(vault, adapter);
    setApp(app as any);

    ensureSecondBrain(app as any);
    openSecondBrainPanel(app as any);
    openSecondBrainReference(app as any);
    openSecondBrainChat(app as any);

    expect(document.querySelector('.bz-sb-panel')).not.toBeNull(); // 主面板已建
    expect(document.querySelector('.bz-sb-float-win')).toBeNull(); // 参考窄窗未建
    expect(document.querySelector('.bz-sb-mb-sheet')).toBeNull();

    await until(() => document.getElementById('bz-sb-onboard')?.style.display === 'flex');
    expect(document.getElementById('bz-sb-content')!.style.display).toBe('none');
    // 引导期 📚💬 收起
    for (const b of document.querySelectorAll('.bz-sb-panel-func')) {
      expect(b.classList.contains('bz-sb-btn-hidden')).toBe(true);
    }
    expect(document.getElementById('bz-sb-init-btn')?.textContent).toContain('开始向量化');
    unloadSecondBrain();
  });

  it('引导初始化成功：进度推进 → 自动切换内容态并渲染统计', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的单一文本块内容用于成功路径。');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 3 });
    setApp(app as any);
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [0.6, 0.8]));

    const store = new VectorStore(app as any);
    await store.load();
    const panel = new SecondBrainPanel(app as any, store, { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();

    await until(() => document.getElementById('bz-sb-onboard')?.style.display === 'flex');
    (document.getElementById('bz-sb-init-btn') as HTMLButtonElement).click();

    await until(() => document.getElementById('bz-sb-content')!.style.display === 'flex');
    expect(store.isIndexReady()).toBe(true);
    expect(document.getElementById('bz-sb-cards')!.innerHTML).toContain('向量块');
    // 引导层收起、功能钮恢复
    expect(document.getElementById('bz-sb-onboard')!.style.display).toBe('none');
    const funcBtn = document.querySelector('.bz-sb-panel-func') as HTMLElement;
    expect(funcBtn.classList.contains('bz-sb-btn-hidden')).toBe(false);
    panel.destroy();
  });

  it('引导初始化失败（Ollama 不可达）：给出原因、按钮可重试、停留引导态', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的单一文本块内容用于失败路径。');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 3 });
    setApp(app as any);
    vi.mocked(getEmbeddingsBatch).mockRejectedValue(new Error('Ollama 无响应'));
    vi.mocked(getEmbedding).mockRejectedValue(new Error('Ollama 无响应'));

    const store = new VectorStore(app as any);
    await store.load();
    const panel = new SecondBrainPanel(app as any, store, { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();

    await until(() => document.getElementById('bz-sb-onboard')?.style.display === 'flex');
    (document.getElementById('bz-sb-init-btn') as HTMLButtonElement).click();

    await until(() => (document.getElementById('bz-sb-init-status')?.textContent ?? '').includes('没有成功向量化任何内容'));
    const btn = document.getElementById('bz-sb-init-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('重试初始化');
    expect(document.getElementById('bz-sb-content')!.style.display).toBe('none'); // 仍在引导态
    panel.destroy();
  });

  it('就绪库打开：直接内容态，统计卡片渲染，不显示引导', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '旧内容不会被重读因为 mtime 一致。');
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 5, chunks: [{ text: 't' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault);
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, 2, true);
    const row = new Float32Array([1, 0]);
    const out = new Uint8Array(4 + row.byteLength);
    out.set(header, 0);
    out.set(new Uint8Array(row.buffer, row.byteOffset, row.byteLength), 4);
    binary.set(VEC_PATH, out.buffer);
    const app = makeApp(vault, adapter, { '我的/A.md': 5 });
    setApp(app as any);

    const store = new VectorStore(app as any);
    await store.load();
    expect(store.isIndexReady()).toBe(true);

    const panel = new SecondBrainPanel(app as any, store, { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();

    await until(() => document.getElementById('bz-sb-cards')!.innerHTML.includes('向量块'));
    expect(document.getElementById('bz-sb-content')!.style.display).toBe('flex');
    expect(document.getElementById('bz-sb-onboard')!.style.display).toBe('none');
    const funcBtn = document.querySelector('.bz-sb-panel-func') as HTMLElement;
    expect(funcBtn.classList.contains('bz-sb-btn-hidden')).toBe(false);
    panel.destroy();
  });

  it('空库下参考/对话命令的转向发生在面板打开前也成立（先 ref 后 panel 单例复用）', async () => {
    const vault = new MockVault();
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);

    ensureSecondBrain(app as any);
    openSecondBrainReference(app as any); // 先参考
    expect(document.querySelector('.bz-sb-panel')).not.toBeNull();
    openSecondBrainChat(app as any); // 再对话：仍无窄窗
    expect(document.querySelector('.bz-sb-float-win')).toBeNull();
    await until(() => document.getElementById('bz-sb-onboard')?.style.display === 'flex');
    unloadSecondBrain();
  });

  it('待处理增量：打开面板先入进度视图，完成后自动进统计（ticket 108）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '旧内容不会重读因为 mtime 不一致会触发重嵌。');
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 5, chunks: [{ text: 't' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault);
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, 2, true);
    const row = new Float32Array([1, 0]);
    const out = new Uint8Array(4 + row.byteLength);
    out.set(header, 0);
    out.set(new Uint8Array(row.buffer, row.byteOffset, row.byteLength), 4);
    binary.set(VEC_PATH, out.buffer);
    const app = makeApp(vault, adapter, { '我的/A.md': 99 }); // mtime 不一致 → 有待处理
    setApp(app as any);
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [0.6, 0.8]));

    const store = new VectorStore(app as any);
    await store.load();
    expect(store.isIndexReady()).toBe(true);
    expect(store.hasPendingChanges()).toBe(true); // 关键前提：有增量待处理

    const panel = new SecondBrainPanel(app as any, store, { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();

    // 先进入进度视图（标题=正在同步索引，说明/按钮隐藏）
    await until(() => (document.getElementById('bz-sb-progress-title')?.textContent ?? '').includes('正在同步索引'));
    expect(document.getElementById('bz-sb-onboard-desc')!.style.display).toBe('none');
    expect((document.getElementById('bz-sb-init-btn') as HTMLElement).style.display).toBe('none');

    // 完成后自动切统计
    await until(() => document.getElementById('bz-sb-content')!.style.display === 'flex');
    expect(document.getElementById('bz-sb-cards')!.innerHTML).toContain('向量块');
    panel.destroy();
  });

  it('就绪无变更：打开直接进统计，不闪现进度视图（ticket 108）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '内容 A。');
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 5, chunks: [{ text: 't' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault);
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, 2, true);
    const row = new Float32Array([1, 0]);
    const out = new Uint8Array(4 + row.byteLength);
    out.set(header, 0);
    out.set(new Uint8Array(row.buffer, row.byteOffset, row.byteLength), 4);
    binary.set(VEC_PATH, out.buffer);
    const app = makeApp(vault, adapter, { '我的/A.md': 5 });
    setApp(app as any);

    const store = new VectorStore(app as any);
    await store.load();
    expect(store.hasPendingChanges()).toBe(false);

    const panel = new SecondBrainPanel(app as any, store, { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();

    await until(() => document.getElementById('bz-sb-cards')!.innerHTML.includes('向量块'));
    expect(document.getElementById('bz-sb-onboard')!.style.display).toBe('none');
    panel.destroy();
  });

  it('requestRebuild：打开后进入「正在重建向量数据库」进度并完成到统计（ticket 108）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的单一文本块内容用于重建流程。');
    vault.files.set(
      STORE_PATH,
      storeJSON({ version: 9, notes: { '我的/A.md': { mtime: 3, chunks: [{ text: '旧' }] } }, _dim: 2 })
    );
    const { adapter, binary } = makeAdapter(vault);
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, 2, true);
    const row = new Float32Array([1, 0]);
    const out = new Uint8Array(4 + row.byteLength);
    out.set(header, 0);
    out.set(new Uint8Array(row.buffer, row.byteOffset, row.byteLength), 4);
    binary.set(VEC_PATH, out.buffer);
    const app = makeApp(vault, adapter, { '我的/A.md': 3 });
    setApp(app as any);
    vi.mocked(getEmbeddingsBatch).mockImplementation(async (texts) => texts.map(() => [0.5, 0.5]));

    const store = new VectorStore(app as any);
    await store.load();
    expect(store.isIndexReady()).toBe(true);
    const panel = new SecondBrainPanel(app as any, store, { onOpenReference: () => {}, onOpenChat: () => {} });
    panel.requestRebuild(); // 设置页确认后的意图标记
    await panel.open();

    await until(() => (document.getElementById('bz-sb-progress-title')?.textContent ?? '').includes('正在重建向量数据库'));
    await until(() => document.getElementById('bz-sb-content')!.style.display === 'flex');
    expect(store.isIndexReady()).toBe(true);
    panel.destroy();
  });

  it('初始向量化进行中关页重开 → 恢复进度视图而非死按钮引导态（ticket 114）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/A.md', '足够长的文本块内容用于测试重开恢复进度。');
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter, { '我的/A.md': 1 });
    setApp(app as any);
    // 嵌入永远 pending：refresh 挂起，面板可检查 store.isRefreshing()
    const neverResolve = new Promise<number[][]>(() => {});
    vi.mocked(getEmbeddingsBatch).mockImplementation(async () => neverResolve);

    const store = new VectorStore(app as any);
    await store.load();
    expect(store.isIndexReady()).toBe(false);
    const panel = new SecondBrainPanel(app as any, store, { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    await until(() => (document.getElementById('bz-sb-init-btn')?.textContent?.includes('开始向量化') ?? false));

    // 点击开始 → 进度视图（此时 refresh 已挂起，refreshPromise 非空）
    (document.getElementById('bz-sb-init-btn') as HTMLButtonElement).click();
    await until(() => (document.getElementById('bz-sb-init-status')?.textContent ?? '').length > 0);
    expect(store.isRefreshing()).toBe(true);

    // 关页重开：mask/popup 仅隐藏（display:none），DOM 仍在 document.body
    panel.close();
    panel.close(); // 幂等：再调一次无妨
    await panel.open();
    await until(() => document.getElementById('bz-sb-onboard')?.style.display === 'flex');

    // 恢复进度视图：按钮隐藏，进度条可见，标题含「初始化」
    expect((document.getElementById('bz-sb-init-btn') as HTMLElement).style.display).toBe('none');
    expect(document.getElementById('bz-sb-init-progress')!.style.display).toBe('flex');
    expect(document.getElementById('bz-sb-progress-title')!.textContent).toContain('初始化向量数据库');
    // 不能是「开始向量化」引导态（按钮隐藏即证）
    panel.destroy();
  });
});

describe('第二大脑对话弹窗（ticket 108 改居中弹窗）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    setSettingsProvider(() => sbSettings() as any);
    unloadSecondBrain();
    vi.mocked(getEmbeddingsBatch).mockReset();
    vi.mocked(getEmbedding).mockReset();
  });

  it('show 显示遮罩+弹窗，close 隐藏；destroy 移除 DOM 并摘 esc 层', async () => {
    const vault = new MockVault();
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const store = new VectorStore(app as any);

    const { ChatPanel } = await import('../../src/secondbrain/chat-panel');
    const chat = new ChatPanel(store, app as any);
    expect(chat.alive).toBe(true);
    chat.show();
    const popup = document.getElementById('bz-sb-chat-panel');
    expect(popup).not.toBeNull();
    expect(popup!.style.display).toBe('flex');
    expect(document.getElementById('bz-sb-chat-mask')!.style.display).toBe('block');
    expect(popup!.querySelectorAll('button').length).toBe(1); // 只有发送钮，无头部按钮（ticket 108）

    chat.close();
    expect(popup!.style.display).toBe('none');
    chat.destroy();
    expect(document.getElementById('bz-sb-chat-panel')).toBeNull();
  });

  it('发送走统一 AI.ask（单参）；AI 失败 → 气泡显示错误且按钮恢复', async () => {
    const vault = new MockVault();
    const { adapter } = makeAdapter(vault);
    const app = makeApp(vault, adapter);
    setApp(app as any);
    const store = new VectorStore(app as any);
    // 检索走文本直通，无需向量数据
    vi.spyOn(store, 'search').mockResolvedValue([]);

    const { ChatPanel } = await import('../../src/secondbrain/chat-panel');
    const { AI } = await import('../../src/secondbrain/ai');
    vi.spyOn(AI, 'ask').mockRejectedValue(new Error('服务商不可用'));

    const chat = new ChatPanel(store, app as any);
    chat.show();
    chat.input.value = '测试问题';
    await chat.sendChatMessage();
    // 欢迎语 + user + assistant(报错) = 3 条
    await until(() => chat.messagesDiv.textContent!.includes('出错了：服务商不可用'));
    expect(chat.sendBtn.disabled).toBe(false);
    chat.destroy();
  });
});
