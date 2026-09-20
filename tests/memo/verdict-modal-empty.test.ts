/**
 * memo 拍板执行批回归 · 空态文案与移动弹窗键盘适配（呈报#16/#18，2026-09-21 拍板）：
 * - 16A「今日」「重要」伪场景空态各给专属文案；搜索态与通用空态保持修复批既有口径
 *   不覆写。修复前必红：两个伪场景空态仍显示通用「这里还没有备忘录」。
 * - 18A 移动端编辑弹窗键盘适配：编辑弹窗 popup 挂 bz-memo-editor-popup（域内覆盖锚点，
 *   不动 core 公共壳）；域 styles.css 以 --bz-vvh 随键盘收缩 + 顶对齐 + 保存钮行钉底。
 *   修复前必红：popup 无该类、styles.css 无对应规则。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, openEditor } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  memoAutoArchive: true,
  cinemaFolderPath: '我的/影视',
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

/** 自造 fixture：一条普通条目（无到期、未标星、非今天完成）→「今日」「重要」皆空 */
function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  const items = [
    { id: 'e1', title: '普通一条', scene: '学习', priority: 'minor', created: at(-3, '10:00'), completed: null, due: null },
  ];
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings = { ...SETTINGS };
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app };
}

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const css = () => repo('src/memo/styles.css');

describe('呈报#16（16A）：伪场景空态专属文案', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  it('「今日」空态：说明是今天没有到期/已完成，不是库里没有', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-scene="今日"]')).toBeTruthy());
    (document.querySelector('[data-memo-scene="今日"]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-empty')).toBeTruthy());
    expect(document.querySelector('.bz-empty')!.textContent).toContain('今日没有备忘录');
    expect(document.querySelector('.bz-empty')!.textContent).toContain('今天到期或已完成的备忘录会显示在这里');
    expect(document.querySelector('.bz-empty')!.textContent).not.toContain('这里还没有备忘录');
  });

  it('「重要」空态：说明还没标重要 + 给出标星路径', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-scene="重要"]')).toBeTruthy());
    (document.querySelector('[data-memo-scene="重要"]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-empty')).toBeTruthy());
    expect(document.querySelector('.bz-empty')!.textContent).toContain('还没有标为重要的备忘录');
    expect(document.querySelector('.bz-empty')!.textContent).toContain('转为重要');
  });

  it('搜索态与通用空态口径不覆写（修复批新口径保持同源）', async () => {
    const { app, vault } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-search]')).toBeTruthy());
    // 搜索空态：文案照旧 + 兑现「清除搜索」承诺（5A 联动）
    const input = document.querySelector('[data-memo-search]') as HTMLInputElement;
    input.value = 'zzz无命中';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => {
      const t = document.querySelector('.bz-empty')!.textContent;
      expect(t).toContain('没有匹配的备忘录');
      expect(t).toContain('试试其他关键词，或清除搜索');
    });
    // 通用空态（空库）：文案照旧
    closeMemoPanel();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([], null, 2));
    MemoData.init({ ...SETTINGS } as any);
    openMemoPanel(app);
    await vi.waitFor(() => {
      const t = document.querySelector('.bz-empty')?.textContent ?? '';
      expect(t).toContain('这里还没有备忘录');
      expect(t).toContain('随手记一条，别让它溜走');
    });
  });
});
