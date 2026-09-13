/**
 * 日记格式体检面板（ADR-0131 只读化，jsdom）：
 * 进度扫描 → 三类体检项分组清单（legacy/unparsable/name-mismatch）→ 点击跳转打开文件手工处理；
 * 面板不改写任何文件（无修复按钮、无确认弹窗）；健康态与重新体检。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../../src/core/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { openDiaryRepairModal } from '../../../src/diary/ui/repair-modal';
import { resetObsidianMocks, clearNotices } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';
import { serializeDiaryEntryFile } from '../../../src/core/diary-format';
import { setDiaryDataMap } from '../../../src/diary/store';

let vault: MockVault;
let app: any;

const entry = (date: string, time: string, tags: string[], body: string) =>
  serializeDiaryEntryFile({ date, time }, tags, body);

beforeEach(() => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  resetObsidianMocks();
  clearNotices();
  setDiaryDataMap(null);
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

describe('日记格式体检面板（ADR-0131 只读）', () => {
  it('全部健康：正常态，无体检项清单', async () => {
    vault.files.set('我的/日记/2401010800.md', entry('2024-01-01', '08:00', ['日记'], '正常'));
    vault.files.set('我的/日记/2401010930-2.md', entry('2024-01-01', '09:30', ['日记'], '同刻第二条'));
    await openAndSettle();
    expect(document.querySelector('.bz-diary-repair-summary')!.textContent).toContain('全部健康');
    expect(document.querySelector('.bz-diary-repair-section-title')).toBeNull();
  });

  it('三类体检项分组展示（legacy/unparsable/name-mismatch），行带原因与路径', async () => {
    vault.files.set('我的/日记/2401010800.md', entry('2024-01-01', '08:00', ['日记'], '健康'));
    vault.files.set('我的/日记/2023-04-22.md', '# 🤝02:43\n旧格式残留\n');
    vault.files.set('我的/日记/随手记.md', '没有 frontmatter 的普通笔记');
    vault.files.set('我的/日记/2305010800.md', entry('2023-05-02', '08:00', ['日记'], '错位'));
    await openAndSettle();

    const summary = document.querySelector('.bz-diary-repair-summary')!.textContent!;
    expect(summary).toContain('共体检 4 个日记文件');
    expect(summary).toContain('3 个需要处理');

    const body = (document.getElementById('bz-diary-repair-popup') as HTMLElement).textContent!;
    expect(body).toContain('旧格式日期文件（未迁移）（1）');
    expect(body).toContain('无法解析为条目（1）');
    expect(body).toContain('属性时间与题目不一致（1）');
    expect(body).toContain('2023-04-22.md');
    expect(body).toContain('随手记.md');
    expect(body).toContain('2305010800.md');
  });

  it('点击体检项打开文件并定位到顶部；面板不改写任何文件', async () => {
    vault.files.set('我的/日记/2023-04-22.md', '# 🤝02:43\n旧格式残留\n');
    await openAndSettle();

    const before = vault.files.get('我的/日记/2023-04-22.md');
    const editorMock = { focus: vi.fn(), setCursor: vi.fn(), scrollIntoView: vi.fn() };
    const openFile = vi.fn(async () => {});
    app.workspace.getLeaf = vi.fn(() => ({ openFile, view: { editor: editorMock } }));

    const link = document.querySelector('.bz-diary-repair-link') as HTMLElement;
    link.click();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(editorMock.setCursor).toHaveBeenCalledWith(0, 0));
    // 只读：文件内容一字未动
    expect(vault.files.get('我的/日记/2023-04-22.md')).toBe(before);
    // 无「修复」类按钮、无确认弹窗
    expect([...document.querySelectorAll('button')].some((b) => b.textContent!.includes('修复'))).toBe(false);
  });

  it('重新体检按钮重扫面板（改好文件后清单归零）', async () => {
    vault.files.set('我的/日记/2023-04-22.md', '# 🤝02:43\n旧格式残留\n');
    await openAndSettle();
    expect(document.querySelector('.bz-diary-repair-summary')!.textContent).toContain('1 个需要处理');

    // 用户手工把旧文件迁移成条目文件
    vault.files.delete('我的/日记/2023-04-22.md');
    vault.files.set('我的/日记/2304220243.md', entry('2023-04-22', '02:43', ['日记'], '正文A'));

    const again = [...document.querySelectorAll('button')].find((b) => b.textContent!.includes('重新体检'))!;
    again.click();
    await vi.waitFor(() =>
      expect(document.querySelector('.bz-diary-repair-summary')!.textContent).toContain('全部健康')
    );
  });

  it('D3 沿革：子目录文件纳入体检（递归收集）', async () => {
    vault.files.set('我的/日记/2401010800.md', entry('2024-01-01', '08:00', ['日记'], '正常'));
    vault.files.set('我的/日记/旧/2024-01-03.md', '子目录里的旧格式残留\n');
    await openAndSettle();
    const summary = document.querySelector('.bz-diary-repair-summary')!.textContent!;
    expect(summary).toContain('共体检 2 个日记文件');
    const body = (document.getElementById('bz-diary-repair-popup') as HTMLElement).textContent!;
    expect(body).toContain('我的/日记/旧/2024-01-03.md');
  });
});
