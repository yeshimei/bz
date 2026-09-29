/**
 * 留影删除的面板级回归：删的是「按 img 认的那条」而不是「img: 前缀键的那条」。
 *
 * 导入进来的图键走 msgKey（`s<sid>:<ct>` / `h<hash>`），只有「选图片…」补录的才是 `img:<路径>`；
 * 旧写法按 `img:` 前缀过滤，对导入的那批是静默空操作（点了删、刷新还在）。
 * 这里两种键各放一张，点掉导入的那张，断言仓里只少它、计数与统计跟着重算。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closePeoplePanel, openPeoplePanel, setJobsModuleForTests } from '../../src/people/ui';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { PersonEntry } from '../../src/people/types';
import type { StoreContact } from '../../src/people/datasource';

const T0 = new Date('2026-09-25T08:00:00').getTime();
const PW = 'supp-img-del-pw';
const IMPORTED = '2026-09/WX_9.jpg';
const PASTED = '2026-09/补录_1.jpg';

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

async function boot(): Promise<PeopleSafeStore> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  // 数据根库外（真实口径）；desc 档不存在 → 缩略图读不到字节也不该炸（url 落空串）
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: 'E:/数据根' }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  const safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
  const person: PersonEntry = { id: 'wxid_a', name: '陈默', createdAt: new Date(T0).toISOString(), imports: [] };
  const store: StoreContact = {
    msgs: [
      { key: 's12345:1699', ts: T0, isSender: false, type: 3, img: IMPORTED, text: '[图片] 窗台那只橘猫' },
      { key: `img:${PASTED}`, ts: T0 + 60_000, isSender: true, type: 3, img: PASTED, text: '[图片] 补录的一张' },
      { key: 's12345:1700', ts: T0 + 120_000, isSender: true, type: 1, text: '收到' },
    ],
    watermarkSid: 12345,
    stats: { msgCount: 3, voiceCount: 0, voiceTotalSec: 0, imageCount: 2 },
    kindCounts: { 图片: 2 },
    updatedAt: new Date(T0).toISOString(),
  };
  await safe.write('wxid_a', (rec) => { rec.person = person; rec.store = store; });
  return safe;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setPeopleSafeStoreForTests(null);
});

describe('留影删除：按 img 认条目（不是 `img:` 前缀键）', () => {
  it('删掉导入的那张：仓里只少它，补录那张还在；计数与图片统计跟着重算', async () => {
    const safe = await boot();
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(document.querySelector('[data-people-pocket="wxid_a"]')).toBeTruthy());
    click('[data-people-pocket="wxid_a"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-detail="wxid_a"]')).toBeTruthy());
    click('[data-people-detail="wxid_a"] [data-people-act="note"]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-supp-tab="image"]')).toBeTruthy());
    click('[data-people-supp-tab="image"]');
    await vi.waitFor(() => expect(document.querySelector(`[data-people-supp-img-del="${IMPORTED}"]`)).toBeTruthy());
    click(`[data-people-supp-img-del="${IMPORTED}"]`);
    await vi.waitFor(() => expect(document.querySelector(`[data-people-supp-img-del-ok="${IMPORTED}"]`)).toBeTruthy());
    click(`[data-people-supp-img-del-ok="${IMPORTED}"]`);

    await vi.waitFor(async () => {
      const rec = await safe.read('wxid_a');
      expect(rec?.store.msgs.some((m) => m.type === 3 && m.img === IMPORTED)).toBe(false);
    });
    const rec = await safe.read('wxid_a');
    expect(rec!.store.msgs.some((m) => m.img === PASTED)).toBe(true); // 补录那张没被误删
    expect(rec!.store.msgs.some((m) => m.type === 1 && m.text === '收到')).toBe(true); // 文本没动
    expect(rec!.store.kindCounts?.图片).toBe(1);
    expect(rec!.store.stats.imageCount).toBe(1);
    expect(rec!.store.stats.msgCount).toBe(2);
  });
});
