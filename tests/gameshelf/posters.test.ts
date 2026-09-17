// @vitest-environment node
/**
 * 媒体本地化测试（issue 368 增补；2026-09-17 扩图标 + 回写本地路径）：
 * 封面/图标串行下载到本地文件夹、属性回写成 vault 路径、已本地化不再重复请求、
 * 显示层四级兜底（本地文件 → 属性远端值 → 源键 → CDN 直拼）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import {
  DEFAULT_POSTER_FOLDER, coverDisplayUrl, ensurePosters, iconDisplayUrl, localCoverPath, localIconPath,
  resolvePosterFolder,
} from '../../src/gameshelf/posters';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { requestUrl } from 'obsidian';

const vault = new MockVault();
const app = { vault } as any;
const COVER = localCoverPath(1);
const ICON = localIconPath(1);

/** frontmatter 写入记录（upsertDetail 走 fileManager.processFrontMatter） */
const writes: Record<string, unknown>[] = [];

function setup() {
  setApp(app);
  setSettingsProvider(() => ({}) as any);
}

function media(over: Partial<Parameters<typeof ensurePosters>[1][number]> = {}) {
  return [{
    appid: 1,
    cover: null as string | null,
    coverSrc: 'https://cdn/1.jpg',
    icon: null as string | null,
    iconSrc: 'https://icon/1.jpg',
    file: {
      path: '我的/游戏/《A》.md',
    } as never,
    ...over,
  }];
}

beforeEach(() => {
  vault.files.clear();
  vault.binaryFiles.clear();
  vault.dirs.clear();
  writes.length = 0;
  (requestUrl as any).mockReset();
  (requestUrl as any).mockImplementation(async () => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
  // upsertDetail 只经 fileManager.processFrontMatter——假 App 记下写入即可
  app.fileManager = {
    processFrontMatter: async (_f: unknown, cb: (fm: Record<string, unknown>) => void) => {
      const fm: Record<string, unknown> = {};
      cb(fm);
      writes.push(fm);
    },
  };
});

describe('媒体本地化队列', () => {
  it('封面与图标都缺本地文件 → 各下一次，回写 vault 路径；重复入队去重', async () => {
    setup();
    ensurePosters(app, media());
    ensurePosters(app, media()); // 重复调用：pending 去重
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(vault.binaryFiles.has(COVER)).toBe(true);
    expect(vault.binaryFiles.has(ICON)).toBe(true);
    expect(writes[writes.length - 1]).toMatchObject({ 封面: COVER, 图标: ICON });
    const urls = (requestUrl as any).mock.calls.map((c: any[]) => String(c[0]?.url));
    expect(urls.filter((u: string) => u.includes('cdn/1.jpg')).length).toBe(1);
    expect(urls.filter((u: string) => u.includes('icon/1.jpg')).length).toBe(1);
  });

  it('本地文件已在、属性还是远端 → 不发请求，直接回写本地路径（迁移/自愈）', async () => {
    setup();
    vault.binaryFiles.set(COVER, new Uint8Array(8));
    vault.binaryFiles.set(ICON, new Uint8Array(8));
    ensurePosters(app, media({ cover: 'https://cdn/1.jpg', icon: 'https://icon/1.jpg' }));
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect((requestUrl as any).mock.calls.length).toBe(0);
    expect(writes[0]).toMatchObject({ 封面: COVER, 图标: ICON });
  });

  it('已完全本地化（文件在 + 属性已指本地）→ 不入队，零请求零写入', async () => {
    setup();
    vault.binaryFiles.set(COVER, new Uint8Array(8));
    vault.binaryFiles.set(ICON, new Uint8Array(8));
    ensurePosters(app, media({ cover: COVER, icon: ICON }));
    await new Promise((r) => setTimeout(r, 30));
    expect((requestUrl as any).mock.calls.length).toBe(0);
    expect(writes.length).toBe(0);
  });

  it('没有图标源 → 跳过图标，不影响封面', async () => {
    setup();
    ensurePosters(app, media({ iconSrc: null }));
    await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(vault.binaryFiles.has(COVER)).toBe(true);
    expect(vault.binaryFiles.has(ICON)).toBe(false);
    expect(writes[writes.length - 1]).not.toHaveProperty('图标');
  });

  it('下载失败 → 不写属性（属性保持远端，显示回落远端源）', async () => {
    setup();
    (requestUrl as any).mockImplementation(async () => ({ status: 403, arrayBuffer: new ArrayBuffer(0) }));
    ensurePosters(app, media({ iconSrc: null }));
    await new Promise((r) => setTimeout(r, 60));
    expect(writes.length).toBe(0);
    expect(vault.binaryFiles.has(COVER)).toBe(false);
  });
});

describe('显示 URL 四级兜底', () => {
  it('本地文件在 → 用 vault resource URL（最高优先）', () => {
    setup();
    vault.binaryFiles.set(COVER, new Uint8Array(8));
    vault.binaryFiles.set(ICON, new Uint8Array(8));
    expect(coverDisplayUrl(app, 1, 'https://cdn/1.jpg', null)).toBe('app://mock-vault/' + COVER);
    expect(iconDisplayUrl(app, 1, ICON, 'https://icon/1.jpg')).toBe('app://mock-vault/' + ICON);
  });

  it('本地文件不在 → 属性远端值 → 源键 → CDN 直拼', () => {
    setup();
    expect(resolvePosterFolder()).toBe(DEFAULT_POSTER_FOLDER);
    expect(coverDisplayUrl(app, 9, 'https://cdn/9.jpg', 'https://src/9.jpg')).toBe('https://cdn/9.jpg');
    // 属性是本地路径但文件没了 → 落到源键
    expect(coverDisplayUrl(app, 9, localCoverPath(9), 'https://src/9.jpg')).toBe('https://src/9.jpg');
    // 都没有 → CDN 直拼兜底
    expect(coverDisplayUrl(app, 9, null, null)).toContain('steam/apps/9/header.jpg');
    // 图标没有直拼兜底：拿不到就空串（UI 不渲染）
    expect(iconDisplayUrl(app, 9, null, null)).toBe('');
    expect(iconDisplayUrl(app, 9, null, 'https://icon/9.jpg')).toBe('https://icon/9.jpg');
  });
});
