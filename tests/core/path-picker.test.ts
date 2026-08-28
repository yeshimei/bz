// @vitest-environment node
/**
 * 统一路径选择器数据层测试（ticket 128，ADR-0061，core/path-picker.ts）：
 * foldersFromFiles 目录聚合 / normalizePicked 清洗 / collectVaultFolders 全量聚合
 * （含空目录与点前缀隐藏目录、adapter 缺失与异常静默回落）。纯函数/纯 async，node 环境无 DOM。
 */
import { describe, it, expect } from 'vitest';
import { foldersFromFiles, normalizePicked, collectVaultFolders } from '../../src/core/path-picker';

describe('foldersFromFiles：由文件路径聚合全部祖先目录', () => {
  it('逐级祖先目录 + 库根恒在，排序去重', () => {
    // JS sort 按 UTF-16 码元（影=0x5F71 在 日=0x65E5 之前）
    expect(foldersFromFiles(['我的/日记/a.md', '我的/日记/b.md', '我的/影视/c.png'])).toEqual([
      '', '我的', '我的/影视', '我的/日记',
    ]);
  });
  it('深层路径每级祖先都聚合', () => {
    expect(foldersFromFiles(['a/b/c/d.md'])).toEqual(['', 'a', 'a/b', 'a/b/c']);
  });
  it('根级文件不产生目录（库根仍在）', () => {
    expect(foldersFromFiles(['独立.md', 'x.txt'])).toEqual(['']);
  });
  it('空输入 → 仅库根', () => {
    expect(foldersFromFiles([])).toEqual(['']);
  });
  it('排序为字典序且无重复', () => {
    const out = foldersFromFiles(['Z/1.md', 'A/2.md', 'A/B/3.md', 'A/2.md']);
    expect(out).toEqual(['', 'A', 'A/B', 'Z']);
  });
});

describe('normalizePicked：清洗选择集', () => {
  it('trim / 去首尾斜杠 / 去重', () => {
    expect(normalizePicked([' A ', '/B/', ' A '])).toEqual(['A', 'B']);
  });
  it('空串与纯斜杠串 = 库根目录保留且去重', () => {
    expect(normalizePicked(['', '/', 'A'])).toEqual(['', 'A']);
  });
  it('纯空白项丢弃', () => {
    expect(normalizePicked(['   ', 'A'])).toEqual(['A']);
  });
  it('空输入 → 空数组', () => {
    expect(normalizePicked([])).toEqual([]);
  });
});

/** 构造最小可测 app（files + adapter 树） */
function fakeApp(files: string[], adapterTree?: Record<string, string[]>): any {
  const adapter = {
    list: async (dir: string): Promise<{ files: string[]; folders: string[] }> => {
      // 支持显式树；未给出时按 MockVault 惯例由文件路径派生（含空目录需显式树）
      if (adapterTree) {
        const f = adapterTree[dir] || [];
        return { files: [], folders: f };
      }
      const prefix = dir.endsWith('/') ? dir : dir + '/';
      const folders = [...new Set(
        files
          .filter((p) => p.startsWith(prefix) && p.slice(prefix.length).includes('/'))
          .map((p) => prefix + p.slice(prefix.length).split('/')[0])
      )];
      return { files: [], folders };
    },
  };
  return { vault: { getFiles: () => files.map((p) => ({ path: p })), adapter } };
}

describe('collectVaultFolders：全量 vault 目录聚合（含空目录与点前缀）', () => {
  it('文件聚合 + adapter 递归补齐空目录与点前缀隐藏目录（如 CONFIG/.ENCRYPT）', async () => {
    const app = fakeApp(['我的/日记/a.md', '文章/b.md'], {
      '': ['CONFIG', '空目录'],
      CONFIG: ['CONFIG/.ENCRYPT'],
      'CONFIG/.ENCRYPT': [],
      '空目录': [],
    });
    const folders = await collectVaultFolders(app);
    // JS sort 按 UTF-16 码元（我=0x6211 文=0x6587 空=0x7A7A）升序
    expect(folders).toEqual([
      '', 'CONFIG', 'CONFIG/.ENCRYPT', '我的', '我的/日记', '文章', '空目录',
    ]);
  });

  it('点前缀目录经 adapter 补齐但文件聚合不产生（vault.getFiles 不索引点前缀）', async () => {
    const app = fakeApp(['笔记/a.md'], { '': ['CONFIG'], CONFIG: ['CONFIG/.ENCRYPT'], 'CONFIG/.ENCRYPT': [] });
    // getFiles 不返回任何 CONFIG/.ENCRYPT 下的文件 → 目录只能来自 adapter
    const folders = await collectVaultFolders(app);
    expect(folders).toContain('CONFIG/.ENCRYPT');
    expect(folders).toContain('笔记');
  });

  it('回归：目录已在文件聚合中（有文件）仍递归补齐其下空/点前缀子目录', async () => {
    // CONFIG/STORAGE/ 下有文件（CONFIG 与 CONFIG/STORAGE 已由文件聚合收集）
    // 但 CONFIG/.ENCRYPT 只能经 adapter 递归发现（匹配真实「加密根在存储旁」场景）
    const app = fakeApp(['CONFIG/STORAGE/a.json', '笔记/b.md'], {
      '': ['CONFIG'],
      CONFIG: ['CONFIG/STORAGE', 'CONFIG/.ENCRYPT'],
      'CONFIG/STORAGE': [],
      'CONFIG/.ENCRYPT': [],
    });
    const folders = await collectVaultFolders(app);
    expect(folders).toContain('CONFIG/STORAGE');
    expect(folders).toContain('CONFIG/.ENCRYPT');
    expect(folders).toContain('笔记');
  });

  it('adapter 缺失 → 静默回落纯文件聚合（库根恒在）', async () => {
    const app: any = { vault: { getFiles: () => [{ path: 'A/b.md' }] } };
    expect(await collectVaultFolders(app)).toEqual(['', 'A']);
  });

  it('adapter.list 抛异常 → 静默跳过适配器分支，不打断文件聚合', async () => {
    const app: any = {
      vault: {
        getFiles: () => [{ path: 'A/b.md' }],
        adapter: {
          list: async () => {
            throw new Error('boom');
          },
        },
      },
    };
    expect(await collectVaultFolders(app)).toEqual(['', 'A']);
  });

  it('深度防御：树过深不无限递归（深度上限截断后仍返回已收集目录）', async () => {
    // 深度 45 层的树：超过 40 层上限，walk 静默截断
    const tree: Record<string, string[]> = {};
    let cur = '';
    for (let i = 0; i < 45; i++) {
      const child = cur ? `${cur}/d${i}` : `d${i}`;
      tree[cur] = [child];
      cur = child;
    }
    tree[cur] = [];
    const app = fakeApp([], tree);
    const folders = await collectVaultFolders(app);
    // 深度上限内的目录已收集（>40 层截断），不会无限循环
    expect(folders.length).toBeGreaterThan(0);
    expect(folders[0]).toBe('');
  });

  it('空库 → 仅库根', async () => {
    const app = fakeApp([], { '': [] });
    expect(await collectVaultFolders(app)).toEqual(['']);
  });

  it('幂等：两次调用结果一致', async () => {
    const app = fakeApp(['A/x.md'], { '': ['B'], B: [] });
    expect(await collectVaultFolders(app)).toEqual(await collectVaultFolders(app));
  });
});