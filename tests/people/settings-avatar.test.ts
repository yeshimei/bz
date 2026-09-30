/**
 * 「我的头像」设置行（issue 529）：文本路径行 → 上传行。
 * 覆盖：行声明（custom + 行名，供设置面板搜索）、上传落盘并把库内相对路径写进设置键、
 * 恢复默认清键回落到微信里的本人头像、来源文案三态。
 *
 * 系统文件选择器走真链（window.require('@electron/remote') 的 dialog.showOpenDialog），
 * 库外字节走假 fs，vault 写盘走假 adapter；不碰真盘、不碰真 vault。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { peopleSettingsSchema } from '../../src/people/settings';
import type { SettingsSchema, SettingsRowContext } from '../../src/core/settings-schema';

const DATA_ROOT = 'E:/微信脸谱数据/export_full';
const SELF_AVATAR = `${DATA_ROOT}/.bz-face/me/avatar.png`;
const PICKED = 'D:/下载/新头像.png';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const settings: Record<string, unknown> = { peopleDataDir: DATA_ROOT, peopleMyAvatar: '' };
const disk = new Map<string, Uint8Array>();
const written = new Map<string, number>();
let saved = 0;
let picked: string[] = [PICKED];

/** 取「我的头像」那一行（custom 行） */
function avatarRowOf(schema: SettingsSchema): { type: string; name?: string; desc?: string; render: (body: HTMLElement, ctx: SettingsRowContext) => void } {
  const row = schema.groups
    .flatMap((g) => g.rows as unknown as Array<Record<string, unknown>>)
    .find((r) => r.name === '我的头像');
  expect(row).toBeTruthy();
  return row as unknown as { type: string; name?: string; desc?: string; render: (b: HTMLElement, c: SettingsRowContext) => void };
}

/** 按真链装配渲染上下文（行根 + 重求值回调） */
function mountRow(row: { render: (b: HTMLElement, c: SettingsRowContext) => void }): HTMLElement {
  const body = document.createElement('div');
  document.body.appendChild(body);
  row.render(body, { rowEl: body, refreshVisibility: () => undefined });
  return body;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  disk.clear();
  written.clear();
  saved = 0;
  picked = [PICKED];
  settings.peopleDataDir = DATA_ROOT;
  settings.peopleMyAvatar = '';
  (window as unknown as { require: (m: string) => unknown }).require = (m: string) => {
    if (m === 'fs') {
      return {
        existsSync: (p: string) => disk.has(String(p).replace(/\\/g, '/')),
        readFileSync: (p: string) => {
          const hit = disk.get(String(p).replace(/\\/g, '/'));
          if (!hit) throw new Error('ENOENT');
          return hit;
        },
      };
    }
    if (m === '@electron/remote') {
      return { dialog: { showOpenDialog: async () => ({ canceled: picked.length === 0, filePaths: [...picked] }) } };
    }
    return undefined;
  };
  setApp({
    vault: {
      adapter: {
        mkdir: async () => undefined,
        writeBinary: async (p: string, d: ArrayBuffer) => { written.set(p, d.byteLength); },
        exists: async (p: string) => written.has(p),
        remove: async (p: string) => { written.delete(p); },
      },
    },
  } as never);
  setSettingsProvider(() => settings as never);
  setSettingsSaver(async () => { saved++; });
});

afterEach(() => {
  delete (window as unknown as { require?: unknown }).require;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('「我的头像」设置行（issue 529）', () => {
  it('行声明 = custom + 行名（设置面板按行名渲染并纳入搜索）', () => {
    const row = avatarRowOf(peopleSettingsSchema());
    expect(row.type).toBe('custom');
    expect(row.desc).toContain('微信数据里导出的本人头像');
  });

  it('没设过、微信那头也没导过 → 首字印 + 「还没设置」文案', () => {
    const body = mountRow(avatarRowOf(peopleSettingsSchema()));
    expect(body.querySelector('.bz-people-setava-txt')!.textContent).toBe('我');
    expect(body.textContent).toContain('还没设置');
  });

  it('默认用微信数据里扒出来的本人头像（工具 sync 轮导出那张）', () => {
    disk.set(SELF_AVATAR, PNG);
    const body = mountRow(avatarRowOf(peopleSettingsSchema()));
    expect(body.textContent).toContain('微信数据里扒出来的本人头像');
    expect(body.querySelector<HTMLImageElement>('.bz-people-setava-img')!.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  it('上传：选一张 → 复制进 vault → 键值存库内相对路径 → 落盘并就地重画', async () => {
    disk.set(PICKED, PNG);
    const body = mountRow(avatarRowOf(peopleSettingsSchema()));
    body.querySelector<HTMLElement>('[data-people-setava-pick]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(settings.peopleMyAvatar).toBe('CONFIG/FACES/我/avatar.png'));
    expect(saved).toBe(1);
    expect(written.get('CONFIG/FACES/我/avatar.png')).toBe(PNG.byteLength);
    expect(body.textContent).toContain('自定义图片');
  });

  it('取消选择（对话框返回空）→ 什么都不动', async () => {
    picked = [];
    const body = mountRow(avatarRowOf(peopleSettingsSchema()));
    body.querySelector<HTMLElement>('[data-people-setava-pick]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.peopleMyAvatar).toBe('');
    expect(saved).toBe(0);
    expect(written.size).toBe(0);
  });

  it('恢复默认：清键 → 回落微信本人头像，落盘一次', async () => {
    disk.set(SELF_AVATAR, PNG);
    settings.peopleMyAvatar = 'CONFIG/FACES/我/avatar.png';
    const body = mountRow(avatarRowOf(peopleSettingsSchema()));
    expect(body.textContent).toContain('自定义图片');
    body.querySelector<HTMLElement>('[data-people-setava-reset]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(saved).toBe(1));
    expect(settings.peopleMyAvatar).toBe('');
    expect(body.textContent).toContain('微信数据里扒出来的本人头像');
  });
});
