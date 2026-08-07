/**
 * 真实数据集成测试：用 vault 中真实的日记/影视/信文件跑完整 init → 渲染链路。
 * （临时诊断测试，可删除）
 */
import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { setApp } from '../../../src/diary/app';
import { resetTagsConfig, applyDirectories } from '../../../src/diary/config';
import { init } from '../../../src/diary/ui/panel';
import { state } from '../../../src/diary/state';
import { MockVault, mockAppWithVault } from '../../mock-vault';
import { resetObsidianMocks } from '../../mock-obsidian-entry';

const VAULT = 'E:/Obsidian/叫我包仔';

function listFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).slice(0, 5);
  } catch {
    return [];
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  resetObsidianMocks();
  state.data.selectedTags.clear();
  state.data.currentDateFilter = null;
  state.data.currentSearchKeyword = '';
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.ui.isPopupShown = false;
  state.ui.editingEntryId = null;
});

it('真实日记文件 → 解析 → 渲染卡片', async () => {
  const diaryFiles = listFiles(path.join(VAULT, '我的/日记'));
  console.log('真实日记文件数（抽样 5）:', diaryFiles);
  expect(diaryFiles.length).toBeGreaterThan(0);

  const vault = new MockVault();
  vault.dirs.add('我的/日记');
  vault.dirs.add('我的/影视');
  vault.dirs.add('我的/信');
  for (const f of diaryFiles) {
    const content = fs.readFileSync(path.join(VAULT, '我的/日记', f), 'utf-8');
    vault.files.set(`我的/日记/${f}`, content);
  }
  // 抽样影视/信
  for (const f of listFiles(path.join(VAULT, '我的/影视'))) {
    vault.files.set(`我的/影视/${f}`, fs.readFileSync(path.join(VAULT, '我的/影视', f), 'utf-8'));
  }
  for (const f of listFiles(path.join(VAULT, '我的/信'))) {
    vault.files.set(`我的/信/${f}`, fs.readFileSync(path.join(VAULT, '我的/信', f), 'utf-8'));
  }
  setApp(mockAppWithVault(vault));

  await init({ registerEvent: () => {} });

  console.log('解析条目数:', state.data.originalDiaryEntries.length);
  console.log('渲染卡片数:', document.querySelectorAll('.diary-entry-card').length);
  console.log('DOM 中第一张卡片:', document.querySelector('.diary-entry-card')?.textContent?.slice(0, 60));

  expect(state.data.originalDiaryEntries.length).toBeGreaterThan(0);
  expect(document.querySelectorAll('.diary-entry-card').length).toBeGreaterThan(0);
}, 30000);
