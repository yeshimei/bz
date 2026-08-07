/**
 * 影视 UI 补测（覆盖率目标）：ESC 多分支（编辑/添加/推荐/设置/主遮罩）、
 * overlay 遮罩点击关闭、settings 打开时 ESC 优先级。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetMovieState } from '../../src/movie/state';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import {
  openAddModal, openEditModal, openSettingsModal, createOverlay, registerEscapeHandler,
  closeOverlay,
} from '../../src/movie/ui';
import { escManager } from '../../src/core/esc-manager';
import { ensureMovie } from '../../src/movie/index';

function makeApp(vault: MockVault) {
  const app: any = mockAppWithVault(vault);
  setApp(app);
  return app;
}

function pressEsc() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

const sampleItem = {
  name: '《测试片》', tag: '电影', typeTag: '电影', rating: 5, status: '想看',
  path: '我的/影视/《测试片》.md', file: { path: '我的/影视/《测试片》.md' },
};

let app: any;

beforeEach(async () => {
  resetObsidianMocks();
  resetMovieState();
  document.body.innerHTML = '';
  const vault = new MockVault();
  vault.files.set('我的/影视/《测试片》.md', '---\ntags: [电影]\n评分: 5\n---');
  app = makeApp(vault);
  setSettingsProvider(() => ({}));
  M.folderPath = '我的/影视';
  M.pageSize = 50;
  ensureMovie(app);
  M.entries = [sampleItem];
  registerEscapeHandler();
});

describe('ESC 多分支', () => {
  it('编辑弹窗打开时 ESC → 关闭编辑', () => {
    openEditModal(sampleItem, app);
    expect(M.editOverlay).toBeTruthy();
    pressEsc();
    expect(M.editOverlay).toBeNull();
  });

  it('添加弹窗打开时 ESC → 关闭添加', () => {
    openAddModal(app);
    expect(M.addOverlay).toBeTruthy();
    pressEsc();
    expect(M.addOverlay).toBeNull();
  });

  it('推荐弹窗打开时 ESC → 移除推荐遮罩', () => {
    M.recommendOverlay = document.createElement('div');
    document.body.appendChild(M.recommendOverlay);
    pressEsc();
    expect(M.recommendOverlay).toBeNull();
  });

  it('设置弹窗打开时 ESC → 关闭设置', () => {
    openSettingsModal();
    expect(M.settingsOverlay).toBeTruthy();
    pressEsc();
    expect(M.settingsOverlay).toBeNull();
  });

  it('主遮罩打开时 ESC → 关闭主面板', () => {
    createOverlay(app);
    expect(M.currentOverlay).toBeTruthy();
    pressEsc();
    expect(M.currentOverlay).toBeNull();
  });
});

describe('遮罩点击关闭', () => {
  it('overlay 点击遮罩本体 → closeOverlay', () => {
    createOverlay(app);
    const overlay = M.currentOverlay!;
    overlay.click();
    expect(M.currentOverlay).toBeNull();
  });

  it('overlay 点击内部不关闭（目标不是遮罩）', () => {
    createOverlay(app);
    const overlay = M.currentOverlay!;
    const modal = overlay.querySelector('div')!;
    modal.click();
    expect(M.currentOverlay).not.toBeNull();
    closeOverlay();
  });
});
