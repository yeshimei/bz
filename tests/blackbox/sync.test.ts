/**
 * 黑匣子实时同步测试（ticket 05）：笔记编辑 → 索引与面板实时跟随。
 * metadataCache changed / vault rename/delete/create → 防抖后重水合 + 面板 refreshAll。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ensureBlackBoxSync, unloadBlackBoxSync } from '../../src/blackbox/sync';
import { BlackBoxDataManager } from '../../src/blackbox/data';
import { openBlackBoxPanel, closeBlackBoxPanel, unloadBlackBoxPanel } from '../../src/blackbox/panel';
import { unloadBlackBox } from '../../src/blackbox';

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

/** 预置 v3：2 概念 1 摘抄（含索引） */
function seedNotes(vault: MockVault): void {
  vault.files.set(
    '我的/黑匣子/概念/提喻法.md',
    '---\nid: bb_c1\ntype: concept\ncreatedAt: "2026-08-01T00:00:00.000Z"\n---\n以部分代整体的修辞\n'
  );
  vault.files.set(
    '我的/黑匣子/概念/借代.md',
    '---\nid: bb_c2\ntype: concept\ncreatedAt: "2026-08-02T00:00:00.000Z"\n---\n用相关事物代替本体\n'
  );
  vault.files.set(
    '我的/黑匣子/摘抄/修辞的弹性.md',
    '---\nid: bb_l1\ntype: literature\ncreatedAt: "2026-08-03T00:00:00.000Z"\nsource: "《诗学》"\n---\n修辞是语言的弹性，让有限词句装下无限情意。\n'
  );
  vault.files.set(
    'CONFIG/STORAGE/blackbox.json',
    JSON.stringify({
      version: 3,
      settings: {},
      persona: {},
      entries: [],
      profiles: [],
      events: [],
      reviews: [],
      chat: [],
      meta: {},
      index: {
        bb_c1: '我的/黑匣子/概念/提喻法.md',
        bb_c2: '我的/黑匣子/概念/借代.md',
        bb_l1: '我的/黑匣子/摘抄/修辞的弹性.md',
      },
    })
  );
}

function streamCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll('#bz-blackbox-stream .bz-blackbox-stream-card')) as HTMLElement[];
}

describe('黑匣子实时同步（ticket 05）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadBlackBox();
  });
  afterEach(() => {
    unloadBlackBoxSync();
    unloadBlackBoxPanel();
    closeBlackBoxPanel();
    document.body.innerHTML = '';
  });

  it('内容编辑（metadataCache changed）→ 索引刷新 + 面板实时刷新（保留筛选与滚动）', async () => {
    const vault = new MockVault();
    seedNotes(vault);
    const { app } = setup(vault);
    ensureBlackBoxSync(app);
    await openBlackBoxPanel(app);
    expect(streamCards().length).toBe(3);
    // 用户改笔记正文
    vault.files.set('我的/黑匣子/概念/提喻法.md', '---\nid: bb_c1\ntype: concept\ncreatedAt: "2026-08-01T00:00:00.000Z"\n---\n以部分代整体的修辞（用户编辑后的新定义）\n');
    (app.metadataCache as any).emit('changed', vault.file('我的/黑匣子/概念/提喻法.md'));
    await vi.waitFor(() => {
      const card = streamCards().find((c) => c.textContent.includes('提喻法')) as HTMLElement;
      expect(card.textContent).toContain('用户编辑后的新定义');
    });
    // 面板数据源同步（data 已换新）
    const d = await new BlackBoxDataManager(app).load();
    expect(d.entries.find((e: any) => e.id === 'bb_c1')!.definition).toContain('用户编辑后的新定义');
  });

  it('改名（vault rename）→ 索引按 id 重映射；面板不残留旧文件', async () => {
    const vault = new MockVault();
    seedNotes(vault);
    const { app } = setup(vault);
    ensureBlackBoxSync(app);
    await openBlackBoxPanel(app);
    // 用户改名：提喻法.md → 提喻法与借代.md
    const old = vault.file('我的/黑匣子/概念/提喻法.md');
    await vault.rename(old, '我的/黑匣子/概念/提喻法与借代.md');
    vault.emit('rename', vault.file('我的/黑匣子/概念/提喻法与借代.md'), '我的/黑匣子/概念/提喻法.md');
    await vi.waitFor(async () => {
      const d = await new BlackBoxDataManager(app).load();
      expect(d.index['bb_c1']).toBe('我的/黑匣子/概念/提喻法与借代.md'); // 重映射
      expect(d.entries.length).toBe(3);
    });
    // 面板仍显示 3 条（改名后不丢条）
    expect(streamCards().length).toBe(3);
  });

  it('删除（vault delete）→ 面板不残留该条', async () => {
    const vault = new MockVault();
    seedNotes(vault);
    const { app } = setup(vault);
    ensureBlackBoxSync(app);
    await openBlackBoxPanel(app);
    expect(streamCards().length).toBe(3);
    await vault.delete(vault.file('我的/黑匣子/概念/借代.md'));
    vault.emit('delete', vault.file('我的/黑匣子/概念/借代.md'));
    await vi.waitFor(() => {
      expect(streamCards().length).toBe(2); // 面板实时移除
    });
    const cards = streamCards();
    expect(cards.some((c) => c.textContent.includes('借代'))).toBe(false);
  });

  it('新建笔记：create 仅失效缓存（不触发面板实时刷新），下次 load 孤儿自愈入索引', async () => {
    const vault = new MockVault();
    seedNotes(vault);
    const { app } = setup(vault);
    ensureBlackBoxSync(app);
    await openBlackBoxPanel(app);
    // 用户手动新建一篇合法 bb 笔记（vault create 事件 → 缓存失效；面板刷新不监听 create 防插件自写循环）
    await vault.create(
      '我的/黑匣子/想法/夏夜的吉他声.md',
      '---\nid: bb_t9\ntype: thought\ncreatedAt: "2026-08-09T00:00:00.000Z"\n---\n给妹妹买吉他，她笑了很久。\n'
    );
    vault.emit('create', vault.file('我的/黑匣子/想法/夏夜的吉他声.md'));
    await new Promise((r) => setTimeout(r, 400)); // 防抖窗口内无刷新
    expect(streamCards().length).toBe(3); // 面板未实时出现（create 不触发 refresh）
    // 下次 load（打开面板/任意事件）→ 缓存已失效，全量水合孤儿自愈入索引
    const d = await new BlackBoxDataManager(app).load();
    expect(d.index['bb_t9']).toBe('我的/黑匣子/想法/夏夜的吉他声.md');
    expect(d.entries.length).toBe(4);
    await openBlackBoxPanel(app);
    expect(streamCards().length).toBe(4); // 打开时水合后出现
  });

  it('面板实时刷新保留类型筛选与搜索词（仅内容变，状态不丢）', async () => {
    const vault = new MockVault();
    seedNotes(vault);
    const { app } = setup(vault);
    ensureBlackBoxSync(app);
    await openBlackBoxPanel(app);
    // 类型筛选：只显示概念
    (document.querySelector('.bz-blackbox-type-btn[data-type="concept"]') as HTMLElement).click();
    expect(streamCards().length).toBe(2);
    // 编辑摘抄（非概念）→ 刷新后筛选仍生效
    vault.files.set('我的/黑匣子/摘抄/修辞的弹性.md', '---\nid: bb_l1\ntype: literature\ncreatedAt: "2026-08-03T00:00:00.000Z"\nsource: "《诗学》"\n---\n修辞是语言的弹性。（编辑）\n');
    (app.metadataCache as any).emit('changed', vault.file('我的/黑匣子/摘抄/修辞的弹性.md'));
    await vi.waitFor(async () => {
      const d = await new BlackBoxDataManager(app).load();
      expect(d.entries.find((e: any) => e.id === 'bb_l1')!.text).toContain('（编辑）');
    });
    expect(streamCards().length).toBe(2); // 概念筛选保留
  });

  it('面板未打开时同步照常更新（回调摘除安全）；防抖合并多次事件', async () => {
    const vault = new MockVault();
    seedNotes(vault);
    const { app } = setup(vault);
    ensureBlackBoxSync(app);
    // 连续三次事件（改名 + 编辑 + 删除）→ 防抖合并一次重水合
    await vault.rename(vault.file('我的/黑匣子/概念/借代.md'), '我的/黑匣子/概念/借代法.md');
    vault.emit('rename', vault.file('我的/黑匣子/概念/借代法.md'), '我的/黑匣子/概念/借代.md');
    vault.files.set('我的/黑匣子/概念/提喻法.md', '---\nid: bb_c1\ntype: concept\ncreatedAt: "2026-08-01T00:00:00.000Z"\n---\n编辑后定义\n');
    (app.metadataCache as any).emit('changed', vault.file('我的/黑匣子/概念/提喻法.md'));
    await new Promise((r) => setTimeout(r, 400));
    const d = await new BlackBoxDataManager(app).load();
    expect(d.index['bb_c2']).toBe('我的/黑匣子/概念/借代法.md');
    expect(d.entries.find((e: any) => e.id === 'bb_c1')!.definition).toBe('编辑后定义');
    // 打开面板显示最新
    await openBlackBoxPanel(app);
    expect(streamCards().length).toBe(3);
  });

  it('自动维护：笔记手动拖入分类文件夹 → frontmatter category 跟随目录；拖回根目录 → 移除', async () => {
    const vault = new MockVault();
    seedNotes(vault);
    const { app } = setup(vault);
    ensureBlackBoxSync(app);
    // 手动移动到 我的/黑匣子/概念/文学/（分类文件夹）
    const old = vault.file('我的/黑匣子/概念/提喻法.md');
    await vault.rename(old, '我的/黑匣子/概念/文学/提喻法.md');
    vault.emit('rename', vault.file('我的/黑匣子/概念/文学/提喻法.md'), '我的/黑匣子/概念/提喻法.md');
    await new Promise((r) => setTimeout(r, 400));
    const raw = vault.files.get('我的/黑匣子/概念/文学/提喻法.md')!;
    expect(raw).toContain('category: "文学"'); // sync 层写死带引号（YAML 合法，解析器剥引号）
    // 拖回类型根目录 → category 移除
    const moved = vault.file('我的/黑匣子/概念/文学/提喻法.md');
    await vault.rename(moved, '我的/黑匣子/概念/提喻法.md');
    vault.emit('rename', vault.file('我的/黑匣子/概念/提喻法.md'), '我的/黑匣子/概念/文学/提喻法.md');
    await new Promise((r) => setTimeout(r, 400));
    const back = vault.files.get('我的/黑匣子/概念/提喻法.md')!;
    expect(back).not.toContain('category:');
  });
});
