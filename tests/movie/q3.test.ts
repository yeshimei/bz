/**
 * 影视 Q3 海报整理测试（ticket 14）：海报移动/已在目标文件夹/重名/扩展名过滤
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetMovieState } from '../../src/movie/state';
import { initQ3, resetQ3 } from '../../src/movie/q3';

function makeApp(vault: MockVault) {
  const app: any = mockAppWithVault(vault);
  app.fileManager = {
    processFrontMatter: async (file: any, fn: (fm: Record<string, any>) => void) => {
      const content = vault.files.get(file.path) ?? '';
      const fm = content.match(/^---\n([\s\S]*?)\n---/)
        ? Object.fromEntries(
            (content.match(/^---\n([\s\S]*?)\n---/)![1].split('\n'))
              .filter((l) => l.includes(':'))
              .map((l) => {
                const i = l.indexOf(':');
                return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
              })
          )
        : {};
      fn(fm);
      const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
      vault.files.set(file.path, `---\n${lines.join('\n')}\n---\n${content.slice(content.indexOf('---', 4))}`);
    },
  };
  app.vault.rename = async (file: any, newPath: string) => {
    const content = vault.files.get(file.path) ?? '';
    vault.files.delete(file.path);
    vault.files.set(newPath, content);
    return { ...file, path: newPath, name: newPath.split('/').pop() };
  };
  return app;
}

/** 触发文件内海报处理（通过 modify 事件防抖 300ms） */
async function fireModify(app: any, path: string) {
  (app.vault as any).emit('modify', { path });
  await new Promise((r) => setTimeout(r, 350));
}

describe('initQ3 海报整理', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    resetQ3();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
    M.posterFolder = 'CONFIG/MOVIE POSTER';
  });

  it('海报从笔记目录移动到 CONFIG/MOVIE POSTER，更新引用与海报字段', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n海报: \n---\n![[p1.png]]\n');
    vault.files.set('我的/影视/p1.png', 'img');
    const app = makeApp(vault);
    const meta = app.metadataCache;
    app.metadataCache.getFirstLinkpathDest = (p: string) => (p === 'p1.png' ? vault.file('我的/影视/p1.png') : null);
    initQ3(app, '我的/影视', 'CONFIG/MOVIE POSTER');

    await fireModify(app, '我的/影视/《A》.md');

    expect(vault.files.has('CONFIG/MOVIE POSTER/p1.png')).toBe(true);
    expect(vault.files.has('我的/影视/p1.png')).toBe(false);
    const content = vault.files.get('我的/影视/《A》.md')!;
    expect(content).toContain('![[p1.png]]');
    expect(content).toContain('海报: CONFIG/MOVIE POSTER/p1.png');
  });

  it('海报已在目标文件夹 → 仅写海报字段，不移动', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/MOVIE POSTER/p1.png', 'img');
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n海报: \n---\n![[p1.png]]\n');
    const app = makeApp(vault);
    app.metadataCache.getFirstLinkpathDest = (p: string) => (p === 'p1.png' ? vault.file('CONFIG/MOVIE POSTER/p1.png') : null);
    initQ3(app, '我的/影视', 'CONFIG/MOVIE POSTER');

    await fireModify(app, '我的/影视/《A》.md');

    expect(vault.files.has('CONFIG/MOVIE POSTER/p1.png')).toBe(true);
    const content = vault.files.get('我的/影视/《A》.md')!;
    expect(content).toContain('海报: CONFIG/MOVIE POSTER/p1.png');
  });

  it('重名 → 追加时间戳后缀', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/MOVIE POSTER/p1.png', 'existing');
    vault.files.set('我的/影视/p1.png', 'img');
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n海报: \n---\n![[p1.png]]\n');
    const app = makeApp(vault);
    app.metadataCache.getFirstLinkpathDest = (p: string) => (p === 'p1.png' ? vault.file('我的/影视/p1.png') : null);
    initQ3(app, '我的/影视', 'CONFIG/MOVIE POSTER');

    await fireModify(app, '我的/影视/《A》.md');

    const moved = [...vault.files.keys()].find((k) => k.startsWith('CONFIG/MOVIE POSTER/') && /p1_\d+\.png$/.test(k));
    expect(moved).toMatch(/p1_\d+\.png$/);
    expect(vault.files.has('我的/影视/p1.png')).toBe(false);
    const content = vault.files.get('我的/影视/《A》.md')!;
    expect(content).toContain(`海报: CONFIG/MOVIE POSTER/${moved!.split('/').pop()}`);
  });

  it('扩展名不在白名单 → 跳过；无图片 → 跳过', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/p1.pdf', 'pdf');
    vault.files.set('我的/影视/《B》.md', '---\ntags: [电影]\n海报: \n---\n![[p1.pdf]]\n');
    vault.files.set('我的/影视/《C》.md', '---\ntags: [电影]\n海报: \n---\n无图\n');
    const app = makeApp(vault);
    app.metadataCache.getFirstLinkpathDest = (p: string) => (p === 'p1.pdf' ? vault.file('我的/影视/p1.pdf') : null);
    initQ3(app, '我的/影视', 'CONFIG/MOVIE POSTER');

    await fireModify(app, '我的/影视/《B》.md');
    await fireModify(app, '我的/影视/《C》.md');

    expect(vault.files.has('我的/影视/p1.pdf')).toBe(true);
    expect(vault.files.has('CONFIG/MOVIE POSTER/p1.pdf')).toBe(false);
  });
});
