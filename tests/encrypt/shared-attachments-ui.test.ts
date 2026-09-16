/**
 * 共享附件他引保护 UI 层测试（issue 338）：
 * 他引检查纯函数（findSharedAttachmentPaths）、app 级入口（collectSharedAttachmentPaths，
 * 由 mock-vault 的 metadataCache.embeds 解析驱动）、lockCurrentNote 端到端
 * （两笔记嵌同一图：加密后原件保留、他篇完好、manifest 标记、完成通知区分、还原跳过写回）、
 * 非共享附件确认框与既有语义不变。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { EncryptAppController, findSharedAttachmentPaths, collectSharedAttachmentPaths } from '../../src/encrypt/ui';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';

/** 轮询等待（真实 PBKDF2 长异步） */
async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const CONFIG = { root: 'CONFIG/.ENCRYPT', previewEnabled: false, previewSize: 384, previewQuality: 0.5, autoLoadOriginal: false, securityMode: false };

function setup(vault: MockVault, config = CONFIG) {
  const app = mockAppWithVault(vault);
  setApp(app as any);
  setSettingsProvider(() => CONFIG as any);
  resetObsidianMocks();
  return app;
}

describe('findSharedAttachmentPaths（他引检查纯函数）', () => {
  const attPaths = ['笔记/pic.png', '我的/影视/全路径.png', '我的/影视/海报.png'];

  it('他篇 basename/全路径/子目录命中 → 共享；被加密笔记自身引用排除', () => {
    const others = [
      { path: '笔记/主题.md', links: ['pic.png'] }, // 自身：排除
      { path: '笔记/其他.md', links: ['pic.png'] }, // basename 命中
      { path: '日志/x.md', links: ['我的/影视/全路径.png'] }, // 全路径命中
      { path: '日志/y.md', links: ['别的.png'] }, // 未命中
      { path: '日志/z.md', links: ['影视/海报.png#center'] }, // 子目录相对形式 + # 子路径剥离命中
    ];
    const shared = findSharedAttachmentPaths('笔记/主题.md', attPaths, others);
    expect([...shared].sort()).toEqual(['笔记/pic.png', '我的/影视/全路径.png', '我的/影视/海报.png'].sort());
  });

  it('空候选/无他篇 → 空；链接剥 # 块引用与 ./ 前缀；同一他篇多链接去重', () => {
    expect(findSharedAttachmentPaths('a.md', [], [{ path: 'b.md', links: ['x.png'] }])).toEqual([]);
    expect(findSharedAttachmentPaths('a.md', ['p/x.png'], [])).toEqual([]);
    const shared = findSharedAttachmentPaths('a.md', ['p/x.png'], [
      { path: 'b.md', links: ['./x.png#^blk', 'x.png'] },
    ]);
    expect(shared).toEqual(['p/x.png']);
  });
});

describe('collectSharedAttachmentPaths（app 级入口，metadataCache.embeds 驱动）', () => {
  it('他篇共用检出、自身排除；仅自身引用 → 无他引', () => {
    const vault = new MockVault();
    vault.create('笔记/主题.md', '正文\n![[pic.png]]');
    vault.create('笔记/其他.md', '他篇正文\n![[pic.png]]');
    const app = mockAppWithVault(vault);
    expect(collectSharedAttachmentPaths(app, '笔记/主题.md', ['笔记/pic.png'])).toEqual(['笔记/pic.png']);

    const vault2 = new MockVault();
    vault2.create('笔记/主题.md', '正文\n![[pic.png]]');
    const app2 = mockAppWithVault(vault2);
    expect(collectSharedAttachmentPaths(app2, '笔记/主题.md', ['笔记/pic.png'])).toEqual([]);
  });
});

describe('lockCurrentNote 共享附件端到端（issue 338）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    EncryptAppController.instance?.cleanup();
    EncryptAppController.instance = null;
  });

  it('两笔记嵌同一图：加密后原件保留、他篇完好、manifest 标记、完成通知区分；还原跳过附件写回', async () => {
    const app = setup(vault, CONFIG);
    vault.create('笔记/主题.md', '正文\n![[pic.png]]');
    vault.create('笔记/其他.md', '他篇正文\n![[pic.png]]');
    vault.createBinary('笔记/pic.png', new TextEncoder().encode('IMGDATA').buffer);
    const activeFile = { path: '笔记/主题.md', basename: '主题', vault: vault as any };
    (app.workspace as any).getActiveFile = () => activeFile;

    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    const p = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    // 确认框区分共享附件（原件保留提示）
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('原件将保留');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await p;
    await waitFor(() => document.getElementById('bz-encrypt-popup')!.style.display === 'flex');

    // 原件保留（他篇嵌入不断链），他篇笔记内容不变
    expect(vault.binaryFiles.has('笔记/pic.png')).toBe(true);
    expect(vault.files.get('笔记/其他.md')).toBe('他篇正文\n![[pic.png]]');
    // 被加密笔记移出，manifest 记共享标记
    expect(vault.files.has('笔记/主题.md')).toBe(false);
    expect(c.dataManager.manifest.notes.length).toBe(1);
    expect(c.dataManager.manifest.notes[0].attachments[0].keptShared).toBe(true);
    // 完成通知区分共享附件（无 emoji，走进度通知正文）
    expect(hasNotice(/1 个附件被其他笔记共用，原件保留/)).toBe(true);

    // 解锁还原：跳过共享附件写回（原件在加密后被改动的场景也不覆盖），正文复原，条目取出
    const noteId = c.dataManager.manifest.notes[0].id;
    vault.binaryFiles.set('笔记/pic.png', new TextEncoder().encode('CHANGED'));
    const { conflicts, removed } = await c.dataManager.restoreNote(noteId);
    expect(conflicts).toEqual([]);
    expect(removed).toBe(true);
    const cur = await vault.readBinary(vault.file('笔记/pic.png'));
    expect(new TextDecoder().decode(cur)).toBe('CHANGED');
    expect(vault.files.get('笔记/主题.md')).toBe('正文\n![[pic.png]]');
    expect(c.dataManager.manifest.notes.length).toBe(0);
  });

  it('非共享附件：确认框无共享提示（既有文案不变），加密后原件照删、清单无标记', async () => {
    const app = setup(vault, CONFIG);
    vault.create('笔记/主题.md', '正文\n![[pic.png]]');
    vault.createBinary('笔记/pic.png', new TextEncoder().encode('IMGDATA').buffer);
    const activeFile = { path: '笔记/主题.md', basename: '主题', vault: vault as any };
    (app.workspace as any).getActiveFile = () => activeFile;

    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    const p = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).not.toContain('原件将保留');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await p;
    await waitFor(() => document.getElementById('bz-encrypt-popup')!.style.display === 'flex');
    expect(vault.binaryFiles.has('笔记/pic.png')).toBe(false);
    expect(c.dataManager.manifest.notes[0].attachments[0].keptShared).toBeUndefined();
  });
});
