import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from './app';
import { resetTagsConfig, applyDirectories } from './config';
import { buildTagMaps } from './config';
import {
  addEntry,
  deleteEntry,
  loadAll,
  onFileChange,
  onFullRefresh,
  onLightRefresh,
  onLoadingChange,
  onProgress,
  setFileChangeDelay,
} from './store';
import { diaryDataMap, setDiaryDataMap, state } from './state';

/** 内存 vault mock：可读写的虚拟文件树 */
class MockVault {
  files = new Map<string, string>();

  getAbstractFileByPath(path: string): any {
    if (this.files.has(path)) return this.file(path);
    // 目录：收集以 path/ 开头的文件
    const prefix = path.endsWith('/') ? path : path + '/';
    const children = [...this.files.keys()]
      .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .map((p) => this.file(p));
    if (children.length || path.split('/').length === 2) {
      return { path, children, isFolder: true };
    }
    return null;
  }

  file(path: string) {
    const content = this.files.get(path)!;
    const basename = path.split('/').pop()!.replace(/\.md$/, '');
    return {
      path,
      basename,
      extension: path.endsWith('.md') ? 'md' : '',
      name: path.split('/').pop()!,
      stat: Promise.resolve({ ctime: Date.UTC(2024, 0, 1, 12, 0), birthtime: Date.UTC(2024, 0, 1, 12, 0) }),
      content,
    };
  }

  async read(file: any): Promise<string> {
    return this.files.get(file.path) ?? '';
  }

  async create(path: string, content: string): Promise<any> {
    this.files.set(path, content);
    return this.file(path);
  }

  async modify(file: any, content: string): Promise<void> {
    this.files.set(file.path, content);
  }

  async delete(file: any): Promise<void> {
    this.files.delete(file.path);
  }
}

let vault: MockVault;

beforeEach(() => {
  resetTagsConfig();
  applyDirectories({});
  setFileChangeDelay(0);
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.data.selectedTags.clear();
  state.data.currentDateFilter = null;
  state.data.currentSearchKeyword = '';
  state.events.isInternalUpdate = false;
  setDiaryDataMap(null);
});

function makeVault(files: Record<string, string>) {
  vault = new MockVault();
  for (const [p, c] of Object.entries(files)) vault.files.set(p, c);
  setApp({
    vault,
    metadataCache: { getFileCache: () => null },
    workspace: {},
  } as any);
  return vault;
}

describe('loadAll', () => {
  it('加载日记/影视/信并按日期时间排序', async () => {
    makeVault({
      '我的/日记/2024-01-02.md': '# ✍️ 09:00\n第二天\n',
      '我的/日记/2024-01-01.md': '# 📖 08:00\n第一条\n',
      '我的/影视/film.md': '---\n影评: 好看\n观影日期: 2024-01-03\ntags: [电影]\n---\n',
    });
    // frontmatter 解析 mock（影视/信文件）
    const vm = vault as any;
    setApp({
      vault,
      metadataCache: {
        getFileCache: (f: any) => {
          const content = vm.files.get(f.path) ?? '';
          const m = content.match(/^---\n([\s\S]*?)\n---\n/);
          if (!m) return null;
          const fm: any = {};
          for (const line of m[1].split('\n')) {
            const idx = line.indexOf(':');
            if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
          return { frontmatter: fm };
        },
      },
      workspace: {},
    } as any);
    await loadAll();
    expect(state.data.originalDiaryEntries.length).toBe(3);
    // 排序：日期降序，同日时间升序
    expect(state.data.originalDiaryEntries[0].date).toBe('2024-01-03');
    expect(state.data.originalDiaryEntries[1].date).toBe('2024-01-02');
    expect(state.data.originalDiaryEntries[2].date).toBe('2024-01-01');
    // id 生成
    for (const e of state.data.originalDiaryEntries) expect(e.id).toBeTruthy();
  });

  it('加密条目隐藏但保留在映射中', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\n🔐秘密🔐\n' });
    await loadAll();
    expect(state.data.originalDiaryEntries.length).toBe(0);
    expect(diaryDataMap!.get('2024-01-01')).toHaveLength(1);
  });

  it('空目录安全返回', async () => {
    makeVault({});
    await loadAll();
    expect(state.data.originalDiaryEntries).toEqual([]);
  });

  it('进度与加载状态回调触发', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n' });
    const progress = vi.fn();
    const loading = vi.fn();
    onProgress(progress);
    onLoadingChange(loading);
    await loadAll();
    expect(progress).toHaveBeenCalled();
    expect(loading).toHaveBeenCalledWith(true);
    expect(loading).toHaveBeenCalledWith(false);
  });

  it('full refresh 回调触发', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n' });
    const refresh = vi.fn();
    onFullRefresh(refresh);
    await loadAll();
    expect(refresh).toHaveBeenCalled();
  });
});

describe('writeFile', () => {
  it('按时间升序写回，格式 # emoji 时间 + 正文', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '' });
    setDiaryDataMap(
      new Map([
        [
          '2024-01-01',
          [
            { date: '2024-01-01', time: '10:00', timeValue: 1000, tags: ['随笔'], emoji: '', content: '晚点写的', filename: '2024-01-01', lineNumber: 0 },
            { date: '2024-01-01', time: '08:00', timeValue: 800, tags: ['日记'], emoji: '', content: '早上好', filename: '2024-01-01', lineNumber: 0 },
          ],
        ],
      ])
    );
    const { writeFile } = await import('./store');
    await writeFile('2024-01-01');
    const out = vault.files.get('我的/日记/2024-01-01.md')!;
    expect(out).toBe('# 📖 08:00\n\n早上好\n\n# ✍️ 10:00\n\n晚点写的');
  });

  it('空条目列表删除文件', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n' });
    setDiaryDataMap(new Map([['2024-01-01', []]]));
    const { writeFile } = await import('./store');
    await writeFile('2024-01-01');
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(false);
  });

  it('文件不存在时创建', async () => {
    makeVault({});
    setDiaryDataMap(
      new Map([
        ['2024-01-01', [{ date: '2024-01-01', time: '08:00', timeValue: 800, tags: ['日记'], emoji: '', content: 'hi', filename: '2024-01-01', lineNumber: 0 }]],
      ])
    );
    const { writeFile } = await import('./store');
    await writeFile('2024-01-01');
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(true);
  });
});

describe('addEntry', () => {
  it('插入数据映射、写回文件、触发轻量刷新', async () => {
    makeVault({});
    setDiaryDataMap(new Map());
    const light = vi.fn();
    onLightRefresh(light);
    const entry = await addEntry('2024-01-01', '12:30', ['日记'], '中午吃饭');
    expect(entry.id).toContain('2024-01-01');
    expect(vault.files.get('我的/日记/2024-01-01.md')).toContain('# 📖 12:30');
    expect(vault.files.get('我的/日记/2024-01-01.md')).toContain('中午吃饭');
    expect(state.data.originalDiaryEntries).toContainEqual(entry);
    expect(light).toHaveBeenCalled();
  });
});

describe('deleteEntry', () => {
  it('删除条目并写回；空文件删除文件；触发全量刷新', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n' });
    setDiaryDataMap(
      new Map([
        ['2024-01-01', [{ date: '2024-01-01', time: '08:00', timeValue: 800, tags: ['日记'], emoji: '📖', content: 'x', filename: '2024-01-01', lineNumber: 1, id: '2024-01-01-08-00-0' }]],
      ])
    );
    state.data.originalDiaryEntries = [
      { date: '2024-01-01', time: '08:00', timeValue: 800, tags: ['日记'], emoji: '📖', content: 'x', filename: '2024-01-01', lineNumber: 1, id: '2024-01-01-08-00-0' },
    ];
    const full = vi.fn();
    onFullRefresh(full);
    await deleteEntry('2024-01-01-08-00-0');
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(false);
    expect(state.data.originalDiaryEntries).toEqual([]);
    expect(full).toHaveBeenCalled();
  });

  it('不存在条目抛错', async () => {
    makeVault({});
    setDiaryDataMap(new Map());
    await expect(deleteEntry('nope')).rejects.toThrow('未找到日记条目');
  });
});

describe('onFileChange', () => {
  it('日记文件变更后刷新（节流合并）', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n' });
    setFileChangeDelay(10);
    await loadAll();
    expect(state.data.originalDiaryEntries).toHaveLength(1);
    // 模拟外部修改：内容变化
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\nx\n# ✍️ 09:00\ny\n');
    onFileChange({ path: '我的/日记/2024-01-01.md', extension: 'md' });
    await new Promise((r) => setTimeout(r, 50));
    expect(state.data.originalDiaryEntries).toHaveLength(2);
  });

  it('内部更新不触发回环', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n' });
    setDiaryDataMap(new Map());
    state.events.isInternalUpdate = true;
    const before = state.data.originalDiaryEntries.length;
    onFileChange({ path: '我的/日记/2024-01-01.md', extension: 'md' });
    await new Promise((r) => setTimeout(r, 30));
    expect(state.data.originalDiaryEntries.length).toBe(before);
  });

  it('非日记目录的文件不处理', async () => {
    makeVault({ '其他/note.md': 'x' });
    setDiaryDataMap(new Map());
    onFileChange({ path: '其他/note.md', extension: 'md' });
    await new Promise((r) => setTimeout(r, 30));
    expect(state.data.originalDiaryEntries).toEqual([]);
  });
});
