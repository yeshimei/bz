/**
 * 影院（cinema）入口/目录回落 + 事件补发测试（ADR-0087 接管旧 movie 域）
 * - ensureCinema：cinemaFolderPath 显式配置生效；缺省回落「我的/影视」
 * - quickAddWant：发 movie:created(want) 域事件（smartcat 行为流依赖）+ progress 通知 + 建笔记
 * - runAIRecommend / 快速状态窗 / 删除等事件补发由 ui.test / recommend.test 覆盖
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { onDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { M, resetCinemaState } from '../../src/cinema/state';
import { ensureCinema, unloadCinema } from '../../src/cinema';
import { quickAddWant } from '../../src/cinema/recommend';

function makeApp(vault: MockVault) {
  const app = mockAppWithVault(vault);
  setApp(app);
  return app;
}

describe('cinema ensureCinema 目录回落（ADR-0087）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadCinema();
    setSettingsProvider(() => ({} as any));
  });

  it('未配置 cinemaFolderPath → 回落默认「我的/影视」', () => {
    setSettingsProvider(() => ({} as any));
    const vault = new MockVault();
    ensureCinema(makeApp(vault));
    expect(M.folderPath).toBe('我的/影视');
  });

  it('显式配置 cinemaFolderPath → 使用该目录', () => {
    setSettingsProvider(() => ({ cinemaFolderPath: '我的/影院' } as any));
    const vault = new MockVault();
    ensureCinema(makeApp(vault));
    expect(M.folderPath).toBe('我的/影院');
  });

  it('cinemaFolderPath 为空白串 → 回落默认（trim 判断）', () => {
    setSettingsProvider(() => ({ cinemaFolderPath: '   ' } as any));
    const vault = new MockVault();
    ensureCinema(makeApp(vault));
    expect(M.folderPath).toBe('我的/影视');
  });
});

describe('cinema quickAddWant 事件补发（movie:created want）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
  });

  it('加入想看 → 建笔记 + 发 movie:created(want) 事件 + progress 通知', async () => {
    const seen: any[] = [];
    const off = onDomainEvent('movie', (evt) => seen.push(evt));
    const vault = new MockVault();
    const app = makeApp(vault);
    await quickAddWant(app, '新片', '电影');

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ kind: 'created', name: '新片', status: 'want', rating: null });
    expect((vault.files as any).get('我的/影视/《新片》.md')).toContain('评分: -1');
    // progress 通知（poster 占位轮询等待；进度通知不自动消失）
    expect(document.querySelector('.bz-notice--progress')?.textContent).toContain('正在获取海报');
    off();
  });
});
