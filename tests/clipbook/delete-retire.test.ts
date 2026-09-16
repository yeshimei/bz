/**
 * 删除流集成测试（issue 336 / ADR-0149 决策 1）：deleteClipNote 在 trash 前把知识盒卡片里
 * 指向本剪藏的 source 降级回外链（无 url 剪藏 → 改调摘除）；trash 后的 md-deleted 消费体
 * 对已退役卡片天然幂等跳过。域事件经总线 emitDomainEvent 派发（tests/memo file-sync 先例）。
 * 确认框（flow-dialog）mock 成「确定」；通知 mock 断言（同 source-upgrade.test.ts 手法）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../../src/core/flow-dialog', () => ({
  openFlowDialog: vi.fn(async () => 'ok'),
}));
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return {
    ...actual,
    notice: vi.fn(),
    notify: vi.fn(() => ({ setMessage: vi.fn(), setType: vi.fn(), hide: vi.fn() })),
    notifyUndo: vi.fn(),
  };
});
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { deleteClipNote } from '../../src/clipbook/ui';
import { ensureFileSync as ensureKnowledgeFileSync, unloadFileSync as unloadKnowledgeFileSync } from '../../src/knowledge/file-sync';import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { notify, notifyUndo } from '../../src/core/notice';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  articleDirectory: '归档/网页剪藏',
  knowledgeDirectory: '文献盒',
};

const CLIP_PATH = '归档/网页剪藏/甲文.md';
const CLIP_URL = 'https://zhuanlan.zhihu.com/p/123';

/** 术语卡片罐头（generateTermNote 落盘形态，source 已被 ADR-0144 物化升级为内部双链） */
const termCard = (sourceLine: string) =>
  ['---', 'title: "量子纠缠"', 'type: term', sourceLine, 'sourceTitle: "页面标题"', 'date: "2026-09-15 10:00:00"', '---', '', '正文一段。'].join('\n');

/** 剪藏笔记罐头（writeClipNote 落盘形态：frontmatter url + created） */
const clipNote = (url: string) =>
  `---\nurl: "${url}"\nauthor: "作者"\nsite: "站点"\nsummary: "摘要"\ntags: []\ndate: ""\ncreated: 1750000000000\n---\n\n正文。`;

function clipArticle(vault: MockVault, url: string) {
  return {
    id: 'url:' + url,
    origin: 'clip',
    title: '甲文',
    url,
    notePath: CLIP_PATH,
    note: { path: CLIP_PATH, file: vault.file(CLIP_PATH) },
    st: 'saved',
  } as any;
}

/** 包一层 trash：记录 trash 时刻卡片内容（断言降级发生在 trash 之前） */
function spyTrash(vault: MockVault): string[] {
  const cardAtTrash: string[] = [];
  const orig = vault.trash.bind(vault);
  (vault as any).trash = async (file: any, system: boolean) => {
    cardAtTrash.push(vault.files.get('文献盒/量子.md') ?? '');
    return orig(file, system);
  };
  return cardAtTrash;
}

async function flushQueue() {
  await new Promise((r) => setTimeout(r, 420)); // 越过 md-deleted 即时通道与队列
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  resetObsidianMocks();
  vi.clearAllMocks();
  unloadKnowledgeFileSync();
  clearDomainEvents();
});

describe('剪藏删除流 × 知识盒 source 降级（issue 336 链路 1）', () => {
  it('有 url 剪藏删除：trash 前卡片 source 已回退为 url（sourceTitle 保持），消费体随后幂等跳过', async () => {
    const vault = new MockVault();
    vault.files.set(CLIP_PATH, clipNote(CLIP_URL));
    vault.files.set('文献盒/量子.md', termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'));
    const app = mockAppWithVault(vault) as any;
    setApp(app);
    setSettingsProvider(() => ({ ...SETTINGS } as any));
    const cardAtTrash = spyTrash(vault);

    await deleteClipNote(clipArticle(vault, CLIP_URL));

    // trash 前降级：trash 时刻卡片已是外链形态
    expect(cardAtTrash).toHaveLength(1);
    expect(cardAtTrash[0]).toContain(`source: "${CLIP_URL}"`);
    // 剪藏进系统回收站
    expect(vault.trashed.some((t) => t.path === CLIP_PATH && t.system)).toBe(true);
    // 卡片终态：url 来源 + sourceTitle 零扰动（ADR-0144 物化前两态还原）
    const card = vault.files.get('文献盒/量子.md')!;
    expect(card).toContain(`source: "${CLIP_URL}"`);
    expect(card).toContain('sourceTitle: "页面标题"');
    // 降级通知 + 删除撤销通知
    expect(notify).toHaveBeenCalledWith('已把 1 张知识卡片来源回退为原链接', { type: 'success' });
    expect(notifyUndo).toHaveBeenCalledWith('已删除剪藏「甲文」（已移入系统回收站）', expect.any(Function));

    // trash 触发的 md-deleted 消费体：已降级卡片天然不命中（不摘除、不追加通知）
    ensureKnowledgeFileSync(app);
    emitDomainEvent('vault:md-deleted', { path: CLIP_PATH });
    await flushQueue();
    expect(vault.files.get('文献盒/量子.md')).toBe(card);
    expect(notify).toHaveBeenCalledTimes(1); // 仍只有降级那一条
  });

  it('无 url 剪藏删除：trash 前改调摘除（source 行移除、sourceTitle 保持），消费体零重复', async () => {
    const vault = new MockVault();
    vault.files.set(CLIP_PATH, clipNote('')); // 无 url 剪藏
    vault.files.set('文献盒/量子.md', termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'));
    const app = mockAppWithVault(vault) as any;
    setApp(app);
    setSettingsProvider(() => ({ ...SETTINGS } as any));
    const cardAtTrash = spyTrash(vault);

    await deleteClipNote(clipArticle(vault, ''));

    expect(cardAtTrash).toHaveLength(1);
    expect(cardAtTrash[0]).not.toContain('source:'); // trash 前已摘除
    expect(cardAtTrash[0]).toContain('sourceTitle: "页面标题"');
    expect(vault.trashed.some((t) => t.path === CLIP_PATH)).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('已摘除 1 张知识卡片的失效来源', { type: 'info' });

    // 摘除后的 md-deleted 消费体：无 source 行可摘 → 不再通知
    ensureKnowledgeFileSync(app);
    emitDomainEvent('vault:md-deleted', { path: CLIP_PATH });
    await flushQueue();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('降级失败不阻断删除：契约抛错时剪藏照常进回收站', async () => {
    const vault = new MockVault();
    vault.files.set(CLIP_PATH, clipNote(CLIP_URL));
    const app = mockAppWithVault(vault) as any;
    setApp(app);
    setSettingsProvider(() => ({ ...SETTINGS } as any));
    // 让 retire 编排整体抛错（扫描半边挂掉），验证删除流的静默兜底分支
    (app.vault as any).getMarkdownFiles = () => {
      throw new Error('vault boom');
    };

    await deleteClipNote(clipArticle(vault, CLIP_URL));

    expect(vault.trashed.some((t) => t.path === CLIP_PATH)).toBe(true); // 删除未被阻断
    expect(notifyUndo).toHaveBeenCalledWith('已删除剪藏「甲文」（已移入系统回收站）', expect.any(Function));
  });
});
