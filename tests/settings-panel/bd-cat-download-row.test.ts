/**
 * 通用页「归物分类表」下载行（issue 478 阶段 D）回归：
 * - 未下载态文案与按钮（状态从本地文件现推，不新增设置键）；
 * - 点击下载成功 → 成功通知 + 状态行就地刷新为「已下载 · v… · N 组 M 条」；
 * - 下载失败 → notifyActionError 人话通知、按钮落 fail 态但**不**把已有表弄丢、状态行保持原样；
 * - busy 期间禁点 = 防重入（连点两次只发一次请求）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { SettingsPanelUI } from '../../src/settings-panel/ui';
import type { CategoryTable } from '../../src/core/category-table';

/** 假表（与真实表同构，只取一条便于断言） */
const FAKE_TABLE: CategoryTable = {
  version: '0.1.0',
  groups: [
    {
      id: 'g001',
      name: '数码影音',
      icon: 'smartphone',
      items: [{ id: 'c0001', name: '智能手机', icon: 'smartphone', aliases: ['手机'] }],
    },
  ],
};

/** 本地文件状态（两组实现共享的可变槽：load 读它、download 写它） */
let localTable: CategoryTable | null = null;
const loadImpl = vi.fn(async (_app: unknown) => localTable);
const downloadImpl = vi.fn(async (_app: unknown) => {
  localTable = FAKE_TABLE;
});

vi.mock('../../src/core/category-table', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadCategoryTable: (app: unknown) => loadImpl(app),
  downloadCategoryTable: (app: unknown) => downloadImpl(app),
}));

async function waitFor(fn: () => boolean, ms = 4000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error('waitFor 超时');
}

async function waitGroups(container: HTMLElement, min: number): Promise<boolean> {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (container.querySelectorAll('.bz-sp-group').length >= min) return true;
    await new Promise((r) => setTimeout(r, 30));
  }
  return false;
}

/** 打开面板 → 通用页（默认页）渲染完 → 取「归物分类表」行与按钮 */
async function openGeneralRow(): Promise<{ ui: SettingsPanelUI; row: HTMLElement; btn: HTMLButtonElement; desc: () => string }> {
  const ui = new SettingsPanelUI();
  ui.open();
  const popup = document.getElementById('bz-settings-panel-popup')!;
  expect(await waitGroups(popup, 2)).toBe(true);
  const row = await (async () => {
    await waitFor(() => !!findRow(popup));
    return findRow(popup)!;
  })();
  return {
    ui,
    row,
    btn: row.querySelector<HTMLButtonElement>('.bz-sp-btn')!,
    desc: () => row.querySelector('.bz-sp-set-desc')?.textContent || '',
  };
}

function findRow(popup: HTMLElement): HTMLElement | undefined {
  return [...popup.querySelectorAll<HTMLElement>('.bz-sp-set-row')].find(
    (r) => r.querySelector('.bz-sp-set-name')?.textContent === '归物分类表'
  );
}

describe('通用页「归物分类表」下载行', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    loadImpl.mockClear();
    downloadImpl.mockClear();
    downloadImpl.mockImplementation(async () => {
      localTable = FAKE_TABLE;
    });
    localTable = null;
    setSettingsProvider(() => ({}) as any);
    setSettingsSaver(vi.fn(async () => {}) as any);
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  it('未下载态：显示「未下载」+ 按钮「下载」', async () => {
    const { ui, btn, desc } = await openGeneralRow();
    expect(desc()).toContain('未下载');
    expect(desc()).toContain('归物本 AI 归类与分类选择器');
    expect(btn.textContent).toBe('下载');
    expect(btn.disabled).toBe(false);
    ui.cleanup();
  });

  it('下载成功：成功通知 + 状态行就地刷新 + 按钮转「重新下载」', async () => {
    const { ui, row, btn, desc } = await openGeneralRow();
    btn.click();
    await waitFor(() => desc().includes('已下载'));
    expect(desc()).toContain('已下载 · v0.1.0 · 1 组 1 条');
    expect(hasNotice(/归物分类表已更新/)).toBe(true);
    expect(hasNotice(/1 组 1 条/)).toBe(true);
    expect(btn.textContent).toBe('重新下载');
    expect(btn.disabled).toBe(false);
    expect(row.querySelector('.bz-sp-set-row')).toBeNull();
    ui.cleanup();
  });

  it('下载失败：人话通知 + 按钮落 fail 态 + 状态行保持未下载（不假成功）', async () => {
    downloadImpl.mockImplementation(async () => {
      throw new Error('网络不通');
    });
    const { ui, btn, desc } = await openGeneralRow();
    btn.click();
    await waitFor(() => hasNotice(/下载归物分类表失败/));
    expect(hasNotice(/网络不通/)).toBe(true);
    expect(btn.textContent).toBe('网络不通'); // shortFailReason 落到按钮本体
    expect(btn.disabled).toBe(false); // 结果态可再点（复原柄另计时）
    expect(desc()).toContain('未下载'); // 本地表没被弄丢，状态未变
    ui.cleanup();
  });

  it('防重入：busy 期间连点两次只发一次下载请求', async () => {
    let release: (() => void) | null = null;
    downloadImpl.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            localTable = FAKE_TABLE;
            resolve();
          };
        })
    );
    const { ui, btn } = await openGeneralRow();
    btn.click();
    btn.click(); // 第二次点击：按钮已 disabled，不应再触发
    await waitFor(() => btn.disabled);
    expect(downloadImpl).toHaveBeenCalledTimes(1);
    release!();
    await waitFor(() => !btn.disabled);
    ui.cleanup();
  });
});
