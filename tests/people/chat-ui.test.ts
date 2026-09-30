/**
 * 详情页「查看聊天」分页测试（issue 529）：动作签点开 → 聊天页读聊天仓 →
 * 只上屏最近 50 条 → 「更早的消息」哨兵点一下往上长一页 → 全量到顶后哨兵退场。
 *
 * 保库注入 MockVault 上的真 SafeManager（467 范式）；引擎用假件；数据全构造。
 * 那条聊天仓 120 条消息里有：文本、带时间间隔的、`[图片]` 媒体标签、群聊成员名。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  closePeoplePanel,
  openPeoplePanel,
  setJobsModuleForTests,
  setUnlockGateForTests,
  type JobsApi,
} from '../../src/people/ui';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { PersonEntry } from '../../src/people/types';
import type { StoreMsg } from '../../src/people/datasource';

const PW = 'chat-test-pw';
const DATA_ROOT = 'E:/微信脸谱数据/export_full';
const SELF_AVATAR = `${DATA_ROOT}/.bz-face/me/avatar.png`;

/** 1×1 PNG 头（字节数不做解析，够走扩展名白名单即可） */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const disk = new Map<string, Uint8Array>();

function click(sel: string): void {
  const node = document.querySelector(sel);
  if (!node) throw new Error(`找不到节点：${sel}`);
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const card = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-people-pocket="${id}"]`);
const chatPageEl = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-people-sub="chat"]');
const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.bz-people-chat-row')];
const moreBar = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-people-chat-more]');
const readonlyLine = (): string => document.querySelector<HTMLElement>('.bz-people-chat-readonly')?.textContent ?? '';

class FakeEngine implements JobsApi {
  startJobs = async (): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }> => ({ queued: [], skipped: [], resumed: [] });
  resumeJobs = async (): Promise<void> => undefined;
  resume = (): boolean => true;
  pauseJobs = (): void => undefined;
  removeJob = (): boolean => false;
  subscribe = (): (() => void) => () => undefined;
  snapshot = () => ({ queue: [], currentIndex: -1, running: false });
}

/** 120 条：文本 + 每 10 分钟一条（每条都该出时间分隔条）+ 两处媒体标签 + 群聊第三位成员 */
function seedMsgs(): StoreMsg[] {
  const base = new Date(2026, 8, 30, 9, 0).getTime();
  const out: StoreMsg[] = [];
  for (let i = 0; i < 120; i++) {
    const me = i % 2 === 0;
    const text = i === 40 ? '[图片] 一只趴在窗台上的猫' : i === 41 ? '[语音 12秒·平静] 你到了吗' : `第 ${i} 条`;
    out.push({
      key: `k${i}`,
      ts: base + i * 600000,
      isSender: me,
      type: i === 40 ? 3 : i === 41 ? 34 : 1,
      who: me ? '我' : i === 7 ? '莫莫' : '大琳',
      text,
    });
  }
  return out;
}

async function boot(): Promise<void> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  setSettingsProvider(() => ({
    storagePath: 'CONFIG/STORAGE',
    peopleDataDir: DATA_ROOT,
    peopleMyAvatar: '',
  }) as never);
  // 微信数据里扒出来的本人头像（工具 sync 轮的产物）
  disk.set(SELF_AVATAR, PNG_BYTES);
  (window as unknown as { require: (m: string) => unknown }).require = (m: string) => (m === 'fs'
    ? {
      existsSync: (p: string) => disk.has(String(p).replace(/\\/g, '/')),
      readFileSync: (p: string) => {
        const hit = disk.get(String(p).replace(/\\/g, '/'));
        if (!hit) throw new Error('ENOENT');
        return hit;
      },
    }
    : undefined);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  const safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
  const p: PersonEntry = { id: '大琳', name: '大琳', createdAt: '2026-09-25T02:57:37.341Z', imports: [] };
  await safe.write('大琳', (rec) => {
    rec.person = p;
    rec.store = { ...rec.store, msgs: seedMsgs(), stats: { msgCount: 120, voiceCount: 1, voiceTotalSec: 12, imageCount: 1 } };
  });
  setJobsModuleForTests(new FakeEngine());
  setUnlockGateForTests(() => Promise.resolve(true));
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(card('大琳')).toBeTruthy());
  click('[data-people-pocket="大琳"]');
  await vi.waitFor(() => expect(document.querySelector('[data-people-act="chat"]')).toBeTruthy());
}

/** 打开聊天页并等首屏落定 */
async function openChat(): Promise<void> {
  click('[data-people-act="chat"]');
  await vi.waitFor(() => expect(rows().length).toBeGreaterThan(0));
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  disk.clear();
});

afterEach(() => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setUnlockGateForTests(null);
  setPeopleSafeStoreForTests(null);
  delete (window as unknown as { require?: unknown }).require;
  vi.restoreAllMocks();
});

describe('详情页「查看聊天」（issue 529）', () => {
  it('点动作签翻出聊天页：按人现读聊天仓，只上屏最近 50 条（不整页铺）', async () => {
    await boot();
    await openChat();
    expect(chatPageEl()).toBeTruthy();
    expect(chatPageEl()!.querySelector('.bz-people-head-label')!.textContent).toBe('聊天记录');
    expect(rows()).toHaveLength(50);
    expect(readonlyLine()).toContain('共 120 条');
    // 落的是最新那一头：最后一条在屏上，最早那条不在
    expect(chatPageEl()!.textContent).toContain('第 119 条');
    expect(chatPageEl()!.textContent).not.toContain('第 0 条');
    expect(moreBar()!.textContent).toContain('还有 70 条');
  });

  it('「更早的消息」点一下往上长一页；到顶后哨兵退场', async () => {
    await boot();
    await openChat();
    click('[data-people-chat-more]');
    await vi.waitFor(() => expect(rows()).toHaveLength(100));
    expect(moreBar()!.textContent).toContain('还有 20 条');
    click('[data-people-chat-more]');
    await vi.waitFor(() => expect(rows()).toHaveLength(120));
    expect(moreBar()).toBeNull();
    expect(chatPageEl()!.textContent).toContain('第 0 条');
    // 全量铺开后那条媒体的标签成签、正文照旧
    expect(chatPageEl()!.querySelector('.bz-people-chat-tag')!.textContent).toBe('[图片]');
    expect(chatPageEl()!.textContent).toContain('一只趴在窗台上的猫');
  });

  it('时间分隔条：与上一条隔 10 分钟 → 每条都出；文案是当天的「M月D日 HH:mm」形态', async () => {
    await boot();
    await openChat();
    const seps = [...document.querySelectorAll<HTMLElement>('.bz-people-chat-sep')];
    expect(seps).toHaveLength(50);
    expect(seps[0].textContent).toMatch(/^(\d+月\d+日 \d{2}:\d{2}|昨天 \d{2}:\d{2}|\d{2}:\d{2})$/);
  });

  it('两侧头像：我方用微信里扒出来的本人头像，对方没头像落首字印；群聊第三位成员名字上屏', async () => {
    await boot();
    await openChat();
    const meRow = rows().find((r) => r.classList.contains('me'))!;
    expect(meRow.querySelector<HTMLImageElement>('.bz-people-chat-ava img')!.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    const otherRow = rows().find((r) => !r.classList.contains('me'))!;
    expect(otherRow.querySelector('.bz-people-chat-ava .bz-people-ava-txt')).toBeTruthy();
    // 会话里有「我 / 大琳 / 莫莫」三位 → 群聊：对方气泡上写发送者名
    const named = rows().filter((r) => !r.classList.contains('me') && r.querySelector('.bz-people-chat-who'));
    expect(named.length).toBeGreaterThan(0);
    expect(named.every((r) => ['大琳', '莫莫'].includes(r.querySelector('.bz-people-chat-who')!.textContent ?? ''))).toBe(true);
  });

  it('页眉那枚「合上这页」照旧关页（动作签不再承担关页）', async () => {
    await boot();
    await openChat();
    click('[data-people-sub="chat"] [data-people-close]');
    await vi.waitFor(() => expect(chatPageEl()).toBeNull());
    // 关页回到详情（动作签还在，且仍是「查看聊天」）
    expect(document.querySelector('[data-people-act="chat"]')!.textContent).toContain('查看聊天');
  });
});
