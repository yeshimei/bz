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

const META_PATH = 'CONFIG/STORAGE/secondbrain_meta.json';
const VEC_PATH = 'CONFIG/STORAGE/secondbrain_vectors.vec';

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
      META_PATH,
      JSON.stringify({ version: 8, notes: { '我的/A.md': { mtime: 5, chunks: [{ text: 't' }] } }, _dim: 2 })
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
});
