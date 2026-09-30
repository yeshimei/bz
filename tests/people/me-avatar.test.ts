/**
 * 「我」的头像解析单源测试（issue 529）：三级取值（自定义 → 微信数据里的本人头像 → 空）
 * 与上传落盘（复制进 vault + 清掉换扩展名的旧图）。
 *
 * 库外字节走假 fs（`window.require('fs')`，与真机 datasource.getFs 同一注入面），
 * vault 写盘走假 adapter（writeBinary / mkdir / remove）；不碰真盘、不碰真 vault。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import {
  MY_AVATAR_DIR,
  clearMyAvatarCache,
  importMyAvatarFromFile,
  myAvatarSource,
  resolveMyAvatar,
  wechatSelfAvatarPath,
} from '../../src/people/me-avatar';

const ROOT = 'E:/微信脸谱数据/export_full';
const SELF = `${ROOT}/.bz-face/me/avatar.png`;
/** 一张 1×1 PNG（够真：魔数走 readAvatarInput 的白名单扩展名，不解析内容） */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

const disk = new Map<string, Uint8Array>();
const written = new Map<string, number>();
const dirs: string[] = [];
const removed: string[] = [];

function installFs(): void {
  (window as unknown as { require: (m: string) => unknown }).require = (m: string) => {
    if (m !== 'fs') return undefined;
    return {
      existsSync: (p: string) => disk.has(p.replace(/\\/g, '/')),
      readFileSync: (p: string) => {
        const hit = disk.get(p.replace(/\\/g, '/'));
        if (!hit) throw new Error('ENOENT');
        return hit;
      },
    };
  };
}

function installApp(): void {
  setApp({
    vault: {
      adapter: {
        mkdir: async (p: string) => { dirs.push(p); },
        writeBinary: async (p: string, d: ArrayBuffer) => { written.set(p, d.byteLength); },
        exists: async (p: string) => written.has(p),
        remove: async (p: string) => { removed.push(p); written.delete(p); },
      },
    },
  } as never);
}

beforeEach(() => {
  disk.clear();
  written.clear();
  dirs.length = 0;
  removed.length = 0;
  clearMyAvatarCache();
  installFs();
  installApp();
});

afterEach(() => {
  delete (window as unknown as { require?: unknown }).require;
});

describe('wechatSelfAvatarPath：微信数据里的本人头像', () => {
  it('探到就是绝对路径（反斜杠数据根也认）', () => {
    disk.set(SELF, PNG);
    expect(wechatSelfAvatarPath(ROOT)).toBe(SELF);
    expect(wechatSelfAvatarPath('E:\\微信脸谱数据\\export_full\\')).toBe(SELF);
  });

  it('没导过 / 没配数据根 / 环境没有 fs → null', () => {
    expect(wechatSelfAvatarPath(ROOT)).toBeNull();
    expect(wechatSelfAvatarPath('')).toBeNull();
    delete (window as unknown as { require?: unknown }).require;
    expect(wechatSelfAvatarPath(ROOT)).toBeNull();
  });
});

describe('resolveMyAvatar：三级取值', () => {
  it('自定义库内相对路径原样交给渲染层（走 vault getResourcePath）', () => {
    expect(resolveMyAvatar('CONFIG/FACES/我/avatar.jpg', ROOT)).toBe('CONFIG/FACES/我/avatar.jpg');
  });

  it('自定义库外绝对路径读字节转 data URL', () => {
    const abs = 'D:/图片/我.png';
    disk.set(abs, PNG);
    expect(resolveMyAvatar(abs, ROOT)).toMatch(/^data:image\/png;base64,/);
  });

  it('留空 → 回落微信里扒出来的本人头像（读字节转 data URL）', () => {
    disk.set(SELF, PNG);
    expect(resolveMyAvatar('', ROOT)).toMatch(/^data:image\/png;base64,/);
  });

  it('留空且没导过 → 空串（渲染层落首字印）', () => {
    expect(resolveMyAvatar('', ROOT)).toBe('');
    expect(resolveMyAvatar(undefined, ROOT)).toBe('');
  });
});

describe('myAvatarSource：来源文案判定', () => {
  it('自定义 / 微信 / 都没有三态', () => {
    expect(myAvatarSource('CONFIG/FACES/我/avatar.jpg', ROOT)).toBe('custom');
    expect(myAvatarSource('', ROOT)).toBe('none');
    disk.set(SELF, PNG);
    expect(myAvatarSource('', ROOT)).toBe('wechat');
    expect(myAvatarSource('  ', ROOT)).toBe('wechat');
  });
});

describe('importMyAvatarFromFile：上传落盘', () => {
  it('读字节 → 建目录 → 写 vault，返回库内相对路径', async () => {
    const src = 'D:/下载/新头像.png';
    disk.set(src, PNG);
    const rel = await importMyAvatarFromFile(src);
    expect(rel).toBe(`${MY_AVATAR_DIR}/avatar.png`);
    expect(dirs).toEqual(['CONFIG', 'CONFIG/FACES', `${MY_AVATAR_DIR}`]);
    expect(written.get(`${MY_AVATAR_DIR}/avatar.png`)).toBe(PNG.byteLength);
  });

  it('换扩展名上传：旧的那张清掉（否则探测序先撞上旧图，看起来「没生效」）', async () => {
    disk.set('D:/下载/旧.jpg', new Uint8Array([0xff, 0xd8, 0xff, 1]));
    disk.set('D:/下载/新.webp', new Uint8Array([0x52, 0x49, 0x46, 0x46, 9]));
    await importMyAvatarFromFile('D:/下载/旧.jpg');
    const rel = await importMyAvatarFromFile('D:/下载/新.webp');
    expect(rel).toBe(`${MY_AVATAR_DIR}/avatar.webp`);
    expect(removed).toContain(`${MY_AVATAR_DIR}/avatar.jpg`);
  });

  it('读不动（文件不在 / 扩展名不在白名单）→ null，不写盘', async () => {
    expect(await importMyAvatarFromFile('D:/下载/没有.png')).toBeNull();
    disk.set('D:/下载/头像.bmp', PNG);
    expect(await importMyAvatarFromFile('D:/下载/头像.bmp')).toBeNull();
    expect(written.size).toBe(0);
  });
});
