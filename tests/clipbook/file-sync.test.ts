// @vitest-environment node
/**
 * 剪藏本引用同步测试（issue 336 / ADR-0149 决策 4，src/clipbook/file-sync.ts）：
 * clipbook.json 的 marks[][].notePath 与 pendingSource[][] 在 rename 时跟改、delete 时
 * 剔条（划词文本保持纯文本——applyBodyTransforms 只对现存 mark 换链，anchor.ts 语义）、
 * rename 链合并去抖回放保序、范围外不动、卸载后静默。
 * stub 手法照抄 tests/memo/file-sync.test.ts（MockVault，域事件经总线 emitDomainEvent 派发；
 * 通知 mock 掉，纯 JSON 读写无 DOM，故标 node 环境）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return {
    ...actual,
    notify: vi.fn(() => ({ setMessage: vi.fn(), setType: vi.fn(), hide: vi.fn() })),
  };
});
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ensureFileSync, unloadFileSync } from '../../src/clipbook/file-sync';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { readClipbookData } from '../../src/clipbook/data';
import { applyBodyTransforms } from '../../src/clipbook/anchor';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  articleDirectory: '归档/网页剪藏',
};

function seedSidecar(vault: MockVault, marks: Record<string, any>, pending: Record<string, string[]>): void {
  vault.files.set('CONFIG/STORAGE/clipbook.json', JSON.stringify({
    articleOverrides: {}, savedArchive: [], order: [],
    marks, savedImages: {}, pendingSource: pending,
  }));
}

async function setup() {
  unloadFileSync(); // 重置幂等守卫与监听（模块单例跨测试共享）
  clearDomainEvents(); // 总线为模块级单例：清掉跨测试残留订阅
  const vault = new MockVault();
  setApp({ vault } as any);
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  ensureFileSync({ vault } as any);
  return { vault };
}

/** 等待队列清空：rename 经 DEBOUNCE_DELAY（默认 300ms）合并去抖，先越过窗口再等队列 */
async function flushQueue() {
  await new Promise((r) => setTimeout(r, 400)); // 覆盖去抖窗口
  await new Promise((r) => setTimeout(r, 30));
  await new Promise((r) => setTimeout(r, 0));
}

function clipbookWrites(vault: MockVault): number {
  return vault.modifiedPaths.filter((p) => p.endsWith('clipbook.json')).length;
}

beforeEach(() => {
  resetObsidianMocks();
});

describe('clipbook.json 引用同步', () => {
  it('rename 事件：marks[].notePath 与 pendingSource[] 跟改新路径', async () => {
    const { vault } = await setup();
    seedSidecar(vault, {
      'url:https://a.com/1': [{ find: '量子纠缠', notePath: '文献盒/量子纠缠.md', kind: 'term' }],
    }, { 'url:https://a.com/1': ['文献盒/量子纠缠.md', '文献盒/无关.md'] });

    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/量子纠缠.md', newPath: '文献盒/量子纠缠（第二版）.md' });
    await flushQueue();

    const side = await readClipbookData();
    expect(side.marks['url:https://a.com/1']).toEqual([{ find: '量子纠缠', notePath: '文献盒/量子纠缠（第二版）.md', kind: 'term' }]);
    expect(side.pendingSource['url:https://a.com/1']).toEqual(['文献盒/量子纠缠（第二版）.md', '文献盒/无关.md']);
  });

  it('rename 后划词别名链按新路径取 basename（渲染/物化同一口径，不产生断链）', async () => {
    const { vault } = await setup();
    seedSidecar(vault, {
      'url:https://a.com/2': [{ find: '量子纠缠', notePath: '文献盒/旧名.md', kind: 'term' }],
    }, {});

    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/旧名.md', newPath: '文献盒/新名.md' });
    await flushQueue();

    const side = await readClipbookData();
    const out = applyBodyTransforms('讲到量子纠缠。', side.marks['url:https://a.com/2'], []);
    expect(out.body).toContain('[[新名|量子纠缠]]');
  });

  it('delete 事件：剔除指向被删笔记的 marks 条目与 pendingSource 项，空键一并清理', async () => {
    const { vault } = await setup();
    seedSidecar(vault, {
      'url:https://a.com/3': [
        { find: '量子纠缠', notePath: '文献盒/被删.md', kind: 'term' },
        { find: '引力波', notePath: '文献盒/健在.md', kind: 'passage' },
      ],
      'url:https://a.com/4': [{ find: '全被删', notePath: '文献盒/被删.md', kind: 'term' }],
    }, { 'url:https://a.com/3': ['文献盒/被删.md', '文献盒/健在.md'], 'url:https://a.com/5': ['文献盒/被删.md'] });

    emitDomainEvent('vault:md-deleted', { path: '文献盒/被删.md' });
    await flushQueue();

    const side = await readClipbookData();
    // 指向被删笔记的 mark 剔除，健在条目保留（划词文本保持纯文本：不再有 mark 就不换链）
    expect(side.marks['url:https://a.com/3']).toEqual([{ find: '引力波', notePath: '文献盒/健在.md', kind: 'passage' }]);
    expect(side.marks['url:https://a.com/4']).toBeUndefined(); // 全剔后空键清理
    expect(side.pendingSource['url:https://a.com/3']).toEqual(['文献盒/健在.md']);
    expect(side.pendingSource['url:https://a.com/5']).toBeUndefined();
  });

  it('rename 链 A→B→C 连发：合并去抖后按序回放，终态一致', async () => {
    const { vault } = await setup();
    seedSidecar(vault, {
      'url:https://a.com/6': [{ find: '量子纠缠', notePath: '文献盒/A.md', kind: 'term' }],
    }, {});

    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/A.md', newPath: '文献盒/B.md' });
    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/B.md', newPath: '文献盒/C.md' });
    await flushQueue();

    const side = await readClipbookData();
    expect(side.marks['url:https://a.com/6']![0].notePath).toBe('文献盒/C.md');
  });

  it('范围外 rename/delete：被 clipbook.json 引用的照常同步，无引用的不写回', async () => {
    const { vault } = await setup();
    seedSidecar(vault, {
      'url:https://a.com/7': [{ find: '外部', notePath: '我的/随笔/外部笔记.md', kind: 'term' }],
    }, {});

    // 无引用的范围外改名：不写回
    emitDomainEvent('vault:md-renamed', { oldPath: '随手记/无关.md', newPath: '随手记/改名.md' });
    await flushQueue();
    expect(clipbookWrites(vault)).toBe(0);

    // 被引用的范围外改名：引用照常同步（E22 同款放行）
    emitDomainEvent('vault:md-renamed', { oldPath: '我的/随笔/外部笔记.md', newPath: '我的/随笔/外部笔记2.md' });
    await flushQueue();
    const side = await readClipbookData();
    expect(side.marks['url:https://a.com/7']![0].notePath).toBe('我的/随笔/外部笔记2.md');
  });

  it('卸载静默：去抖窗口内卸载积压事件不再回放，卸载后新事件不受理', async () => {
    const { vault } = await setup();
    seedSidecar(vault, {
      'url:https://a.com/8': [{ find: '量子纠缠', notePath: '文献盒/旧笔记.md', kind: 'term' }],
    }, {});

    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/旧笔记.md', newPath: '文献盒/新笔记.md' });
    unloadFileSync(); // 立即卸载：cancelled 置位 + 清去抖定时器
    await new Promise((r) => setTimeout(r, 500));
    let side = await readClipbookData();
    expect(side.marks['url:https://a.com/8']![0].notePath).toBe('文献盒/旧笔记.md');

    // 卸载后新 delete 事件同样静默
    emitDomainEvent('vault:md-deleted', { path: '文献盒/旧笔记.md' });
    await new Promise((r) => setTimeout(r, 60));
    side = await readClipbookData();
    expect(side.marks['url:https://a.com/8']).toHaveLength(1);
  });
});
