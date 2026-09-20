// @vitest-environment node
/**
 * memo 重审缺陷修复批 · 数据层回归（tests/memo/defects-fix-data.test.ts，防撞命名）
 * 覆盖（来源标注于各用例）：
 *  - memo2-func #2：loadItems 数组内 null/非对象元素此前 item.id 直接 TypeError，
 *    面板永久空白；修复后剔除坏元素 + 清档回写，好元素照常加载。
 *  - memo2-func #2（连带）：normalizeItem 对 title/scene 兜底（null 不再炸渲染面）。
 *  - memo2-func #4（遗留清洗）：iOS 落盘的 'NaN-…' 脏 due 归一为 null。
 *  - memo2-func #15 / memo2-arch A6：getCourseNotes 目录前缀匹配加 `/` 边界（core
 *    isUnderFolder 单源），相邻同名目录不再误命中。
 *  - memo2-efficiency 新-3：getCourseNotes 会话级缓存（init 失效），不再每次弹窗全 vault 扫。
 *  - memo2-arch T10（验证性用例）：字段清除批 purgeStaleFields 挂 MemoData.write 单点后，
 *    验证全部写回路径（restoreItem/updateSceneBulk/completeItem；deleteItem 未找到不写盘）
 *    盘上条目键集 ⊆ 14 约定字段。
 * 一切以自造 fixture 验证，不读用户真实数据。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoData, normalizeItem } from '../../src/memo/data';
import { MEMO_ITEM_FIELDS } from '../../src/checkup/checks-drift';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

const PATH = 'CONFIG/STORAGE/memo.json';
const BASE_SETTINGS = { memoFilePath: 'CONFIG/STORAGE', cinemaFolderPath: '我的/影视' };

function makeApp(vault: MockVault) {
  return {
    vault,
    workspace: { getActiveFile: () => null },
    metadataCache: { getFileCache: () => null },
  };
}

/** 自造 14 字段条目（缺省补齐） */
function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'x', title: '条目', scene: '工作', priority: 'minor', created: '2026-09-01 10:00:00',
    completed: null, due: null, notePath: null, notePosition: null,
    scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    ...overrides,
  };
}

describe('memo2-func #2：loadItems 数组内坏元素守卫', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    MemoData.init(BASE_SETTINGS);
  });

  it('修复前必红形态：[null, 好条目] 载入不再 TypeError，好条目照常返回', async () => {
    vault.files.set(PATH, JSON.stringify([null, item({ id: 'good' })]));
    const items = await MemoData.loadItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('good');
    expect(items[0].title).toBe('条目');
  });

  it('坏元素剔除后清档回写：盘上不再有 null 元素', async () => {
    vault.files.set(PATH, JSON.stringify([null, item({ id: 'a' }), 42, item({ id: 'b' })]));
    await MemoData.loadItems();
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw.map((r: any) => r.id)).toEqual(['a', 'b']);
  });

  it('全坏数组：载入得空清单且文件被清档（不再抛错）', async () => {
    vault.files.set(PATH, JSON.stringify([null, undefined]));
    const items = await MemoData.loadItems();
    expect(items).toEqual([]);
    expect(JSON.parse(vault.files.get(PATH)!)).toEqual([]);
  });

  it('normalizeItem 兜底：null title/scene 归一空串（不炸 it.title.length / esc 渲染面）', () => {
    const out = normalizeItem({ id: 'x', title: null, scene: null, priority: 'minor' });
    expect(out.title).toBe('');
    expect(out.scene).toBe('');
    expect(() => out.title.length).not.toThrow();
  });
});

describe('memo2-func #4 遗留清洗：NaN 脏 due 归一', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    MemoData.init(BASE_SETTINGS);
  });

  it("iOS 落盘的 'NaN-NaN-NaN 09:00' 载入即归一 null 并回写清档", async () => {
    vault.files.set(PATH, JSON.stringify([item({ id: 'dirty', due: 'NaN-NaN-NaN 09:00' })]));
    const items = await MemoData.loadItems();
    expect(items[0].due).toBeNull();
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw[0].due).toBeNull();
  });

  it('正常 due 不受清洗影响', async () => {
    vault.files.set(PATH, JSON.stringify([item({ id: 'ok', due: '2026-09-25 18:00' })]));
    const items = await MemoData.loadItems();
    expect(items[0].due).toBe('2026-09-25 18:00');
  });
});

describe('memo2-func #15 / memo2-arch A6 + memo2-efficiency 新-3：getCourseNotes 边界与缓存', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    MemoData.init(BASE_SETTINGS);
  });

  /** 挂 getFileCache/getFiles mock（frontmatter tags 简易解析，data.test 同手法） */
  function wireApp() {
    const app = makeApp(vault) as any;
    app.metadataCache.getFileCache = (file: any) => {
      const content = vault.files.get(file.path) || '';
      const m = content.match(/^---\n([\s\S]*?)\n---/);
      const tags: string[] = [];
      if (m) {
        const tm = m[1].match(/tags:\s*\[([^\]]*)\]/);
        if (tm) tags.push(...tm[1].split(',').map((s: string) => s.trim()));
      }
      return { tags: tags.map((t) => ({ tag: '#' + t })), frontmatter: { tags } };
    };
    app.vault.getFiles = () =>
      [...vault.files.keys()].map((p) => ({
        path: p,
        basename: p.split('/').pop()!.replace(/\.md$/, ''),
        extension: p.endsWith('.md') ? 'md' : '',
      }));
    setApp(app);
    return app;
  }

  it('相邻同名目录不误命中：我的/影视花絮/ 不算 我的/影视/ 的课', async () => {
    wireApp();
    vault.files.set('我的/影视/正课.md', '---\ntags: [公开课]\n---\n内容');
    vault.files.set('我的/影视花絮/花絮.md', '---\ntags: [公开课]\n---\n内容');
    const notes = await MemoData.getCourseNotes();
    expect(notes).toEqual([{ name: '正课', path: '我的/影视/正课.md' }]);
  });

  it('会话级缓存：二次调用零扫描（同引用返回），init 后失效重扫', async () => {
    const app = wireApp();
    vault.files.set('我的/影视/课.md', '---\ntags: [公开课]\n---\n内容');
    const first = await MemoData.getCourseNotes();
    const scans = () => app.vault.getFiles.mock ? app.vault.getFiles.mock.calls.length : scanCount;
    let scanCount = 0;
    // 重新挂计数版 getFiles（前两次扫描已完成，此处起计数）
    let counted = 0;
    app.vault.getFiles = () => {
      counted++;
      return [...vault.files.keys()].map((p) => ({
        path: p,
        basename: p.split('/').pop()!.replace(/\.md$/, ''),
        extension: p.endsWith('.md') ? 'md' : '',
      }));
    };
    const second = await MemoData.getCourseNotes();
    expect(second).toBe(first); // 缓存命中：同引用
    expect(counted).toBe(0); // 零扫描
    MemoData.init(BASE_SETTINGS); // init 失效
    const third = await MemoData.getCourseNotes();
    expect(counted).toBe(1); // 重扫一次
    expect(third).not.toBe(first);
    expect(third).toEqual(first);
    void scans;
  });
});

describe('memo2-arch T10（验证性）：全部写回路径盘上键集 ⊆ 14 约定字段', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    MemoData.init(BASE_SETTINGS);
  });

  /** 带回滚残留两键的盘上条目（未经理 loadItems，直接种盘——模拟残留已在盘上） */
  function staleRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      ...item(),
      recur: { kind: 'weekly' },
      checklist: [{ text: '子任务', done: false }],
      ...overrides,
    };
  }

  it('restoreItem（撤销删除插回）写回后：全文件条目键集 ⊆ 14 字段', async () => {
    vault.files.set(PATH, JSON.stringify([staleRaw({ id: 'keep' })]));
    await MemoData.restoreItem({ ...(item({ id: 'back' }) as any) }, 0);
    const raw = JSON.parse(vault.files.get(PATH)!);
    for (const it of raw) expect([...Object.keys(it)].every((k) => (MEMO_ITEM_FIELDS as readonly string[]).includes(k))).toBe(true);
  });

  it('updateSceneBulk（场景重命名/删除迁移）写回后：残留键被剥', async () => {
    vault.files.set(PATH, JSON.stringify([staleRaw({ id: 's1', scene: '旧场景' })]));
    await MemoData.updateSceneBulk('旧场景', '新场景');
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw[0].scene).toBe('新场景');
    expect([...Object.keys(raw[0])].every((k) => (MEMO_ITEM_FIELDS as readonly string[]).includes(k))).toBe(true);
  });

  it('completeItem（经 updateItem 合并写回）后：残留键被剥、完成时间落盘', async () => {
    vault.files.set(PATH, JSON.stringify([staleRaw({ id: 'c1' })]));
    await MemoData.completeItem('c1');
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw[0].completed).toBeTruthy();
    expect([...Object.keys(raw[0])].every((k) => (MEMO_ITEM_FIELDS as readonly string[]).includes(k))).toBe(true);
  });

  it('deleteItem 未命中（idx=-1）不写盘：盘上内容原样（含残留——写口外无副作用）', async () => {
    const content = JSON.stringify([staleRaw({ id: 'gone' })]);
    vault.files.set(PATH, content);
    const idx = await MemoData.deleteItem('不存在');
    expect(idx).toBe(-1);
    expect(vault.files.get(PATH)).toBe(content);
  });
});
