// @vitest-environment node
/**
 * 待办（todo）数据层测试：memo.json 同源读写（与旧 memo 共用）、14 字段零迁移、
 * 场景解析、条目 CRUD、公开课笔记检索。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TodoData, parseScenarios, DEFAULT_SCENARIOS } from '../../src/todo/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  return {
    vault,
    workspace: { getActiveFile: () => null },
    metadataCache: { getFileCache: () => null },
  };
}

const BASE_SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  cinemaFolderPath: '我的/影视',
};

describe('TodoData 构建', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
  });

  it('init 拼出 memo.json 路径（storagePath 优先 / 尾部斜杠去除）', () => {
    TodoData.init({ ...BASE_SETTINGS, todoFilePath: 'CONFIG/STORAGE/' });
    expect(TodoData.todoFilePath).toBe('CONFIG/STORAGE/memo.json');
    TodoData.init({ ...BASE_SETTINGS, storagePath: 'DATA/', todoFilePath: 'OLD/' });
    expect(TodoData.todoFilePath).toBe('DATA/memo.json');
  });

  it('场景从设置解析（逗号分隔去空去重；空则默认 6 场景，与旧 memo 一致）', () => {
    TodoData.init({ ...BASE_SETTINGS, memoScenarios: '工作,学习,工作, ' });
    expect(TodoData.getScenarios()).toEqual(['工作', '学习']);
    TodoData.init({ ...BASE_SETTINGS, memoScenarios: '' });
    expect(TodoData.getScenarios()).toEqual(DEFAULT_SCENARIOS);
  });

  it('parseScenarios 单元：非法输入回退默认', () => {
    expect(parseScenarios(undefined)).toEqual(DEFAULT_SCENARIOS);
    expect(parseScenarios(' , ')).toEqual(DEFAULT_SCENARIOS);
    expect(parseScenarios('剪藏,代码')).toEqual(['剪藏', '代码']);
  });

  it('loadItems：缺省字段补齐（id 生成 + priority minor + 其余 null）并写回', async () => {
    TodoData.init(BASE_SETTINGS);
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([{ title: '旧条目', scene: '工作' }], null, 2));
    const items = await TodoData.loadItems();
    expect(items.length).toBe(1);
    const it = items[0];
    expect(it.id).toBeTruthy();
    expect(it.priority).toBe('minor');
    expect(it.completed).toBeNull();
    expect(it.due).toBeNull();
    expect(it.notePath).toBeNull();
    expect(it.notePosition).toBeNull();
    expect(it.scriptName).toBeNull();
    expect(it.courseName).toBeNull();
    expect(it.coursePath).toBeNull();
    expect(it.linkedNote).toBeNull();
    expect(it.url).toBeNull();
    expect(it.title).toBe('旧条目');
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].id).toBeTruthy();
  });

  it('读取旧 memo 域写入的数据（14 字段完整条目零迁移）', async () => {
    TodoData.init(BASE_SETTINGS);
    const legacy = {
      id: 'legacy-1', title: '剪藏标题', scene: '剪藏', priority: 'important',
      created: '2026-08-01 10:00:00', completed: null, due: '2026-09-03 18:00:00',
      notePath: '我的/日记/2026-09-03.md', notePosition: { line: 12, ch: 3 },
      scriptName: null, courseName: null, coursePath: null,
      linkedNote: '归档/网页剪藏/文章.md', url: 'https://example.com/a',
    };
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([legacy], null, 2));
    const items = await TodoData.loadItems();
    expect(items[0]).toEqual(legacy);
  });
});

describe('TodoData CRUD', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    TodoData.init(BASE_SETTINGS);
  });

  it('addItem 头部插入 + 读取往返', async () => {
    await TodoData.addItem({ id: 'a', title: 'A', scene: '工作' } as any);
    await TodoData.addItem({ id: 'b', title: 'B', scene: '学习' } as any);
    const items = await TodoData.read();
    expect(items.map((i: any) => i.id)).toEqual(['b', 'a']);
  });

  it('updateItem：合并字段、保留 id/created、title 自动提取 url', async () => {
    await TodoData.addItem({ id: 'a', title: '旧标题', scene: '工作', created: '2025-01-01 00:00:00' } as any);
    await TodoData.updateItem('a', { title: 'https://example.com 新标题', scene: '剪藏' } as any);
    const items = await TodoData.read();
    expect(items[0]).toMatchObject({
      id: 'a',
      title: 'https://example.com 新标题',
      scene: '剪藏',
      url: 'https://example.com',
      created: '2025-01-01 00:00:00',
    });
  });

  it('updateItem 不存在 → 抛「条目不存在」', async () => {
    await expect(TodoData.updateItem('nope', { title: 'x' } as any)).rejects.toThrow('条目不存在');
  });

  it('completeItem：写入 completed 时间戳', async () => {
    await TodoData.addItem({ id: 'a', title: 'A', scene: '工作' } as any);
    await TodoData.completeItem('a');
    const items = await TodoData.read();
    expect(items[0].completed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('deleteItem：删除指定 id', async () => {
    await TodoData.addItem({ id: 'a', title: 'A', scene: '工作' } as any);
    await TodoData.addItem({ id: 'b', title: 'B', scene: '工作' } as any);
    await TodoData.deleteItem('a');
    const items = await TodoData.read();
    expect(items.map((i: any) => i.id)).toEqual(['b']);
  });

  it('getCourseNotes：影视目录下含公开课标签的 md 文件', async () => {
    vault.files.set('我的/影视/《公开课：AI入门》.md', '---\ntags: [公开课]\n---\n内容');
    vault.files.set('我的/影视/《电影》.md', '---\ntags: [电影]\n---\n内容');
    vault.files.set('其他/普通.md', '---\ntags: [公开课]\n---\n');
    const app = makeApp(vault) as any;
    setApp(app);
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
    const notes = await TodoData.getCourseNotes();
    expect(notes).toEqual([{ name: '《公开课：AI入门》', path: '我的/影视/《公开课：AI入门》.md' }]);
  });
});
