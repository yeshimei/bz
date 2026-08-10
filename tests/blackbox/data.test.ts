/**
 * 黑匣子数据层测试（ticket 34）：blackbox.json 读写 + 阈值 + 人格生长 + 对话裁剪 + 容错。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { BlackBoxDataManager, getBlackBoxFilePath, createImpression } from '../../src/blackbox/data';
import { defaultBlackBoxData, DEFAULT_PERSONA } from '../../src/blackbox/types';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

describe('getBlackBoxFilePath', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('默认 CONFIG/STORAGE/blackbox.json', () => {
    expect(getBlackBoxFilePath()).toBe('CONFIG/STORAGE/blackbox.json');
  });

  it('storagePath 设置优先', () => {
    setSettingsProvider(() => ({ storagePath: 'DATA/私密' } as any));
    expect(getBlackBoxFilePath()).toBe('DATA/私密/blackbox.json');
  });
});

describe('BlackBoxDataManager', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('load：文件不存在 → 默认数据（种子包仔）', async () => {
    const { app } = setup();
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    expect(data.version).toBe(1);
    expect(data.persona.name).toBe('包仔');
    expect(data.persona).toEqual(DEFAULT_PERSONA);
    expect(data.impressions).toEqual([]);
    expect(data.reviews).toEqual([]);
    expect(data.chat).toEqual([]);
  });

  it('load：坏 JSON → 默认数据，且原文件改名备份 .bak 保留现场', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/blackbox.json', '{oops');
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.impressions).toEqual([]);
    const baks = [...vault.files.keys()].filter((p) => p.includes('.bak-'));
    expect(baks.length).toBe(1);
    expect(vault.files.get(baks[0])).toBe('{oops');
    expect(vault.files.has('CONFIG/STORAGE/blackbox.json')).toBe(false); // 原文件已改名，不再被覆盖
  });

  it('save：不存在时建目录建文件，可读回', async () => {
    const { app, vault } = setup();
    const dm = new BlackBoxDataManager(app);
    const data = defaultBlackBoxData();
    await dm.save(data);
    expect(vault.files.has('CONFIG/STORAGE/blackbox.json')).toBe(true);
    const back = await dm.load();
    expect(back.persona.name).toBe('包仔');
  });

  it('addImpression：追加 + 返回计数与阈值命中（threshold=10 时第 10 条触发）', async () => {
    const { app } = setup(new MockVault(), { blackboxReviewThreshold: '10' });
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    for (let i = 1; i <= 9; i++) {
      const r = await dm.addImpression(data, createImpression({ material: `素材${i}`, feeling: '感受', emotions: [], scene: '', people: '', direction: '', links: [] }));
      expect(r.shouldReview).toBe(false);
    }
    const r10 = await dm.addImpression(data, createImpression({ material: '素材10', feeling: '感受', emotions: [], scene: '', people: '', direction: '', links: [] }));
    expect(r10.count).toBe(10);
    expect(r10.shouldReview).toBe(true);
  });

  it('addImpression：阈值取设置值，默认 10', async () => {
    const { app } = setup();
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    const r = await dm.addImpression(data, createImpression({ material: 'm', feeling: 'f', emotions: [], scene: '', people: '', direction: '', links: [] }));
    expect(r.shouldReview).toBe(false); // 1 % 10 !== 0
  });

  it('addReview：reviews 追加 + newSelfView 非空时人格档案生长', async () => {
    const { app } = setup();
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    await dm.addReview(data, { ts: 't1', text: '复盘话', impressionCount: 10, newSelfView: '我越来越懂主人了' });
    expect(data.reviews.length).toBe(1);
    expect(data.persona.selfViews).toEqual([{ ts: 't1', view: '我越来越懂主人了' }]);

    await dm.addReview(data, { ts: 't2', text: '再复盘', impressionCount: 10, newSelfView: '' });
    expect(data.reviews.length).toBe(2);
    expect(data.persona.selfViews.length).toBe(1); // 空认知不生长
  });

  it('addChat：按 blackboxMaxHistory 滚动淘汰', async () => {
    const { app } = setup(new MockVault(), { blackboxMaxHistory: '3' });
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    for (let i = 1; i <= 5; i++) {
      await dm.addChat(data, i % 2 ? 'user' : 'assistant', `m${i}`, `t${i}`);
    }
    expect(data.chat.map((m) => m.text)).toEqual(['m3', 'm4', 'm5']);
    // 落盘后读回一致
    const back = await dm.load();
    expect(back.chat.map((m) => m.text)).toEqual(['m3', 'm4', 'm5']);
  });

  it('容错：非法条目（缺素材/坏情绪）过滤，合法保留', async () => {
    const vault = new MockVault();
    vault.files.set(
      'CONFIG/STORAGE/blackbox.json',
      JSON.stringify({
        version: 1,
        persona: { name: '', seed: '', toneExample: '', selfViews: [] },
        impressions: [
          { id: 'ok', ts: 't', material: '素材', feeling: '感受', emotions: [{ tag: '触动', intensity: 4 }], scene: '', people: '', direction: '', links: [] },
          { id: 'bad', ts: 't', material: '', feeling: '感受', emotions: [], scene: '', people: '', direction: '', links: [] },
        ],
        reviews: [{ ts: 't', text: '话', impressionCount: 1, newSelfView: '' }],
        chat: [{ role: 'bot', text: 'x', ts: 't' }],
      })
    );
    const { app } = setup(vault);
    const data = await new BlackBoxDataManager(app).load();
    expect(data.impressions.length).toBe(1);
    expect(data.impressions[0].id).toBe('ok');
    expect(data.persona.name).toBe('包仔'); // 空名字回退默认
    expect(data.chat).toEqual([]); // 非法 role 过滤
  });
});
