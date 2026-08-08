/**
 * 备忘录数据层测试（ticket 04）：memo.json 14 字段零迁移、
 * 场景/平台映射构建、条目 CRUD。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataManager } from '../../src/memo/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  return {
    vault,
    workspace: { getActiveFile: () => null },
    metadataCache: {
      getFileCache: () => null,
    },
  };
}

const BASE_SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  showFileName: true,
  autoPopupOnStart: true,
  movieFolderPath: '我的/影视',
};

describe('DataManager 构建', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
  });

  it('init 拼出 todoFilePath = 目录 + /memo.json（尾部斜杠去除）', () => {
    DataManager.init({ ...BASE_SETTINGS, todoFilePath: 'CONFIG/STORAGE/' });
    expect(DataManager.todoFilePath).toBe('CONFIG/STORAGE/memo.json');
    DataManager.init({ ...BASE_SETTINGS, todoFilePath: ' 自定义 ' });
    expect(DataManager.todoFilePath).toBe('自定义/memo.json');
  });

  it('场景固定为默认 6 场景（设置项已移除）', () => {
    DataManager.init({ ...BASE_SETTINGS });
    expect(DataManager.getScenarios()).toEqual(['剪藏', '工作', '学习', '生活', '代码', '公开课']);
  });

  it('平台映射固定为内置默认（设置项已移除）', () => {
    DataManager.init({ ...BASE_SETTINGS });
    const map = DataManager.getPlatformMap();
    expect(map.length).toBeGreaterThan(0);
    expect(map.some((m) => m.host === 'zhihu.com' && m.name === '知乎')).toBe(true);
    expect(map.some((m) => m.host === 'daily.zhihu.com')).toBe(true);
  });

  it('loadItems：缺省字段补齐（id 生成 + priority minor + 其余 null）', async () => {
    DataManager.init(BASE_SETTINGS);
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([{ title: '旧条目', scene: '工作' }], null, 2));
    const items = await DataManager.loadItems();
    expect(items.length).toBe(1);
    const it = items[0];
    expect(it.id).toBeTruthy();
    expect(it.priority).toBe('minor');
    expect(it.completed).toBeNull();
    expect(it.due).toBeNull();
    expect(it.notePath).toBeNull();
    expect(it.scriptName).toBeNull();
    expect(it.courseName).toBeNull();
    expect(it.coursePath).toBeNull();
    expect(it.linkedNote).toBeNull();
    expect(it.url).toBeNull();
    expect(it.title).toBe('旧条目');
    // 补 id 后写回
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].id).toBeTruthy();
  });
});

describe('DataManager CRUD', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    DataManager.init(BASE_SETTINGS);
  });

  it('addItem 头部插入 + 读取往返', async () => {
    const a = { id: 'a', title: 'A', scene: '工作' };
    const b = { id: 'b', title: 'B', scene: '学习' };
    await DataManager.addItem(a as any);
    await DataManager.addItem(b as any);
    const items = await DataManager.read();
    expect(items.map((i: any) => i.id)).toEqual(['b', 'a']);
  });

  it('updateItem：合并字段、保留 id/created、title 自动提取 url', async () => {
    await DataManager.addItem({ id: 'a', title: '旧标题', scene: '工作', created: '2025-01-01 00:00:00' } as any);
    await DataManager.updateItem('a', { title: 'https://example.com 新标题', scene: '剪藏' } as any);
    const items = await DataManager.read();
    expect(items[0]).toMatchObject({
      id: 'a',
      title: 'https://example.com 新标题',
      scene: '剪藏',
      url: 'https://example.com',
      created: '2025-01-01 00:00:00',
    });
  });

  it('updateItem 不存在 → 抛「条目不存在」', async () => {
    await expect(DataManager.updateItem('nope', { title: 'x' } as any)).rejects.toThrow('条目不存在');
  });

  it('completeItem：写入 completed 时间戳', async () => {
    await DataManager.addItem({ id: 'a', title: 'A', scene: '工作' } as any);
    await DataManager.completeItem('a');
    const items = await DataManager.read();
    expect(items[0].completed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('deleteItem：删除指定 id', async () => {
    await DataManager.addItem({ id: 'a', title: 'A', scene: '工作' } as any);
    await DataManager.addItem({ id: 'b', title: 'B', scene: '工作' } as any);
    await DataManager.deleteItem('a');
    const items = await DataManager.read();
    expect(items.map((i: any) => i.id)).toEqual(['b']);
  });

  it('getCourseNotes：影视目录下含公开课标签的 md 文件', async () => {
    vault.files.set('我的/影视/《公开课：AI入门》.md', '---\ntags: [公开课]\n---\n内容');
    vault.files.set('我的/影视/《电影》.md', '---\ntags: [电影]\n---\n内容');
    vault.files.set('其他/普通.md', '---\ntags: [公开课]\n---\n');
    const app = makeApp(vault) as any;
    setApp(app); // 复用同一实例（getCourseNotes 经 getApp 取 app）
    // metadataCache mock：从 frontmatter 简单解析 tags
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
    const notes = await DataManager.getCourseNotes();
    // basename 含书名号（真实 Obsidian 行为：文件名去掉扩展名）
    expect(notes).toEqual([{ name: '《公开课：AI入门》', path: '我的/影视/《公开课：AI入门》.md' }]);
  });
});
