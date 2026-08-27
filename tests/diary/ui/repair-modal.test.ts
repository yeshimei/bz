/**
 * 日记解析检测面板（ticket 121，jsdom）：
 * 进度扫描 → 可修项（预览 + 一键修复写回 + 重扫归零）、不可修项（跳转定位到行）、正常态。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { openDiaryRepairModal } from '../../../src/diary/ui/repair-modal';
import { resetObsidianMocks, clearNotices, hasNotice } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';

let vault: MockVault;
let app: any;

beforeEach(() => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  resetObsidianMocks();
  clearNotices();
  vault = new MockVault();
  app = mockAppWithVault(vault);
  setApp(app);
});

async function openAndSettle() {
  openDiaryRepairModal();
  await vi.waitFor(() => {
    expect(document.getElementById('bz-diary-repair-popup')).toBeTruthy();
    expect(document.querySelector('.bz-diary-repair-summary')).toBeTruthy();
  });
}

describe('日记解析检测面板（ticket 121）', () => {
  it('展示可修项预览并一键修复写回（真机样本：补空格 + 补零），修复后重扫归零', async () => {
    vault.files.set('我的/日记/2023-04-22.md', '# 🤝02:43\n正文A\n');
    vault.files.set('我的/日记/2023-10-27.md', '# 📖 9:33\n诗一\n诗二\n');
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n正常\n');
    await openAndSettle();

    const summary = document.querySelector('.bz-diary-repair-summary')!.textContent!;
    expect(summary).toContain('2 处'); // 一个文件可自动修复（2 处）
    expect(document.querySelectorAll('.bz-diary-repair-file').length).toBe(2);

    // 预览内容：before → after 都出现在面板
    const body = (document.getElementById('bz-diary-repair-popup') as HTMLElement).textContent!;
    expect(body).toContain('# 🤝02:43');
    expect(body).toContain('# 🤝 02:43');
    expect(body).toContain('# 📖 9:33');
    expect(body).toContain('# 📖 09:33');

    const fixBtn = [...document.querySelectorAll('button')].find((b) => b.textContent!.includes('一键修复'))!;
    fixBtn.click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    expect(document.getElementById('__shared_confirm_popup__')!.textContent).toContain('2 处标题行');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();

    await vi.waitFor(() => expect(hasNotice(/已修复 2 处未解析行/)).toBe(true));
    // 只改头行，正文一字不动
    expect(vault.files.get('我的/日记/2023-04-22.md')).toBe('# 🤝 02:43\n正文A\n');
    expect(vault.files.get('我的/日记/2023-10-27.md')).toBe('# 📖 09:33\n诗一\n诗二\n');
    // 修复后自动重扫：全部正常
    await vi.waitFor(() =>
      expect(document.querySelector('.bz-diary-repair-summary')!.textContent).toContain('全部正常解析')
    );
  });

  it('游离正文列为不可修，点击行打开文件并定位到行', async () => {
    vault.files.set('我的/日记/2023-05-01.md', '今天天气真好\n明天也是\n');
    await openAndSettle();

    const summary = document.querySelector('.bz-diary-repair-summary')!.textContent!;
    expect(summary).toContain('需手动处理（2 行）');

    const editorMock = { focus: vi.fn(), setCursor: vi.fn(), scrollIntoView: vi.fn() };
    app.workspace.getLeaf = vi.fn(() => ({
      openFile: vi.fn(async () => {}),
      view: { editor: editorMock },
    }));

    const link = document.querySelector('.bz-diary-repair-link') as HTMLElement;
    link.click();
    await vi.waitFor(() => expect(editorMock.setCursor).toHaveBeenCalledTimes(1));
    expect(editorMock.setCursor).toHaveBeenCalledWith(0, 0);
  });

  it('时间越界标题行与其后无归属正文均列不可修（不提供修复建议）', async () => {
    vault.files.set('我的/日记/2023-06-06.md', '# 📖 25:00\n正文\n');
    await openAndSettle();

    const summary = document.querySelector('.bz-diary-repair-summary')!.textContent!;
    // 越界标题行 1 行 + 其后正文无法归属 1 行 = 2 行
    expect(summary).toContain('需手动处理（2 行）');
    // 无可修项 → 不提供「一键修复」按钮
    expect([...document.querySelectorAll('button')].some((b) => b.textContent!.includes('一键修复'))).toBe(false);
  });

  it('全部文件解析正常时显示正常态', async () => {
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n正常\n');
    await openAndSettle();
    expect(document.querySelector('.bz-diary-repair-summary')!.textContent).toContain('全部正常解析');
  });
});