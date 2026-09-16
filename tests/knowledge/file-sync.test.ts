// @vitest-environment node
/**
 * 知识盒引用同步测试（issue 336 / ADR-0149 决策 4，src/knowledge/file-sync.ts）：
 * knowledge.json 的 rename 同步 notePath/videoPath、delete 置空引用、rename 链合并去抖
 * 回放保序、范围外不动；md-deleted 消费体对卡片 source 的断链摘除与已降级卡片幂等跳过、
 * 卸载后静默。
 * stub 手法照抄 tests/memo/file-sync.test.ts（MockVault / mockAppWithVault，域事件经总线
 * emitDomainEvent 派发；consumer 通知 mock 掉，纯 JSON 读写无 DOM，故标 node 环境）。
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return {
    ...actual,
    notify: vi.fn(() => ({ setMessage: vi.fn(), setType: vi.fn(), hide: vi.fn() })),
  };
});
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ensureFileSync, unloadFileSync } from '../../src/knowledge/file-sync';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { notify } from '../../src/core/notice';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  knowledgeDirectory: '文献盒',
};

/** 术语卡片罐头（generateTermNote 落盘形态） */
const termCard = (sourceLine: string) =>
  ['---', 'title: "某名词"', 'type: term', sourceLine, 'sourceTitle: "页面标题"', 'date: "2026-09-15 10:00:00"', '---', '', '正文一段。'].join('\n');

async function setup() {
  unloadFileSync(); // 重置幂等守卫与监听（模块单例跨测试共享）
  clearDomainEvents(); // 总线为模块级单例：清掉跨测试残留订阅
  vi.mocked(notify).mockClear(); // 通知调用记录不跨测试累计
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  ensureFileSync(app as any);
  return { vault };
}

/** 等待队列清空：rename 经 DEBOUNCE_DELAY（默认 300ms）合并去抖，先越过窗口再等队列 */
async function flushQueue() {
  await new Promise((r) => setTimeout(r, 400)); // 覆盖去抖窗口
  await new Promise((r) => setTimeout(r, 30));
  await new Promise((r) => setTimeout(r, 0));
}

function knowledgeWrites(vault: MockVault): number {
  return vault.modifiedPaths.filter((p) => p.endsWith('knowledge.json')).length;
}

describe('knowledge.json 引用同步', () => {
  it('rename 事件（总线 vault:md-renamed）：同步任务 notePath/videoPath', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/knowledge.json', JSON.stringify([
      { id: 't1', url: 'https://b23.tv/x', status: 'success', notePath: '文献盒/旧笔记.md', videoPath: '文献盒/附件/旧笔记.mp4' },
      { id: 't2', url: 'https://b23.tv/y', status: 'success', notePath: '文献盒/无关.md', videoPath: null },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/旧笔记.md', newPath: '文献盒/新笔记.md' });
    await flushQueue();

    const tasks = JSON.parse(vault.files.get('CONFIG/STORAGE/knowledge.json')!);
    expect(tasks[0]).toMatchObject({ notePath: '文献盒/新笔记.md', videoPath: '文献盒/附件/旧笔记.mp4' }); // 视频路径不同名不动
    expect(tasks[1].notePath).toBe('文献盒/无关.md'); // 无关任务不动
  });

  it('videoPath 命中同样跟改（同名引用口径）', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/knowledge.json', JSON.stringify([
      { id: 't1', status: 'success', notePath: '文献盒/笔记.md', videoPath: '卡片盒/同名.md' },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/同名.md', newPath: '卡片盒/改名.md' });
    await flushQueue();

    const tasks = JSON.parse(vault.files.get('CONFIG/STORAGE/knowledge.json')!);
    expect(tasks[0]).toMatchObject({ notePath: '文献盒/笔记.md', videoPath: '卡片盒/改名.md' });
  });

  it('rename 链 A→B→C 连发：合并去抖后按序回放，终态一致', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/knowledge.json', JSON.stringify([
      { id: 't1', status: 'success', notePath: '文献盒/A.md', videoPath: null },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/A.md', newPath: '文献盒/B.md' });
    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/B.md', newPath: '文献盒/C.md' });
    await flushQueue();

    const tasks = JSON.parse(vault.files.get('CONFIG/STORAGE/knowledge.json')!);
    expect(tasks[0].notePath).toBe('文献盒/C.md');
  });

  it('delete 事件：notePath/videoPath 置空（UI 空路径守卫齐全，最小惊讶），无关任务不动', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/knowledge.json', JSON.stringify([
      { id: 't1', status: 'success', notePath: '文献盒/被删.md', videoPath: '文献盒/附件/视频.mp4' },
      { id: 't2', status: 'success', notePath: '文献盒/健在.md', videoPath: null },
    ], null, 2));

    emitDomainEvent('vault:md-deleted', { path: '文献盒/被删.md' });
    await flushQueue();

    const tasks = JSON.parse(vault.files.get('CONFIG/STORAGE/knowledge.json')!);
    expect(tasks[0]).toMatchObject({ notePath: null, videoPath: '文献盒/附件/视频.mp4', status: 'success' }); // 历史保留
    expect(tasks[1].notePath).toBe('文献盒/健在.md');
  });

  it('范围外 rename/delete：被 knowledge.json 引用的照常同步，无引用的不写回', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/knowledge.json', JSON.stringify([
      { id: 't1', status: 'success', notePath: '我的/随笔/外部笔记.md', videoPath: null },
    ], null, 2));

    // 无引用的范围外改名：不写回
    emitDomainEvent('vault:md-renamed', { oldPath: '随手记/无关.md', newPath: '随手记/改名.md' });
    await flushQueue();
    expect(knowledgeWrites(vault)).toBe(0);

    // 被引用的范围外改名：引用照常同步（E22 同款放行）
    emitDomainEvent('vault:md-renamed', { oldPath: '我的/随笔/外部笔记.md', newPath: '我的/随笔/外部笔记2.md' });
    await flushQueue();
    let tasks = JSON.parse(vault.files.get('CONFIG/STORAGE/knowledge.json')!);
    expect(tasks[0].notePath).toBe('我的/随笔/外部笔记2.md');

    // 范围外删除：被引用 → 置空
    emitDomainEvent('vault:md-deleted', { path: '我的/随笔/外部笔记2.md' });
    await flushQueue();
    tasks = JSON.parse(vault.files.get('CONFIG/STORAGE/knowledge.json')!);
    expect(tasks[0].notePath).toBeNull();
  });
});

describe('md-deleted 消费体（卡片 source 断链摘除，ADR-0149 决策 2）', () => {
  it('卡片 source 内链指向被删文件 → 行级摘除（sourceTitle 保留）+ 合并通知一条', async () => {
    const { vault } = await setup();
    vault.files.set('文献盒/量子.md', termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'));
    vault.files.set('文献盒/别的.md', termCard('source: "[[文献盒/健在.md|健在]]"'));

    emitDomainEvent('vault:md-deleted', { path: '归档/网页剪藏/甲文.md' });
    await flushQueue();

    const hit = vault.files.get('文献盒/量子.md')!;
    expect(hit).not.toContain('source:');
    expect(hit).toContain('sourceTitle: "页面标题"');
    expect(vault.files.get('文献盒/别的.md')).toContain('source: "[[文献盒/健在.md|健在]]"');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('已摘除 1 张知识卡片的失效来源', { type: 'info' });
  });

  it('已降级卡片（外链形态 source）天然幂等跳过：不摘除、不通知', async () => {
    const { vault } = await setup();
    const downgraded = termCard('source: "https://zhuanlan.zhihu.com/p/123"');
    vault.files.set('文献盒/已降级.md', downgraded);

    emitDomainEvent('vault:md-deleted', { path: '归档/网页剪藏/甲文.md' });
    await flushQueue();

    expect(vault.files.get('文献盒/已降级.md')).toBe(downgraded);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('卸载静默（unloadFileSync）', () => {
  it('去抖窗口内卸载积压事件不再回放，卸载后新事件不受理', async () => {
    const { vault } = await setup();
    vault.files.set('CONFIG/STORAGE/knowledge.json', JSON.stringify([
      { id: 't1', status: 'success', notePath: '文献盒/旧笔记.md', videoPath: null },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '文献盒/旧笔记.md', newPath: '文献盒/新笔记.md' });
    unloadFileSync(); // 立即卸载：cancelled 置位 + 清去抖定时器
    await new Promise((r) => setTimeout(r, 500)); // 越过本应触发的去抖窗口
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/knowledge.json')!)[0].notePath).toBe('文献盒/旧笔记.md');

    // 卸载后新事件同样静默（订阅已退订 + 任务首行短路；md-deleted 消费体不再摘卡片）
    vault.files.set('文献盒/量子.md', termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'));
    emitDomainEvent('vault:md-deleted', { path: '归档/网页剪藏/甲文.md' });
    await new Promise((r) => setTimeout(r, 60));
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/knowledge.json')!)[0].notePath).toBe('文献盒/旧笔记.md');
    expect(vault.files.get('文献盒/量子.md')).toContain('source: "[[归档/网页剪藏/甲文.md|甲文]]"');
  });
});
