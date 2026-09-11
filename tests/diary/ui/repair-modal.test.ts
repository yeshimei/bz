/**
 * 日记解析检测面板（ticket 121，jsdom）：
 * 进度扫描 → 可修项（预览 + 一键修复写回 + 重扫归零）、不可修项（跳转定位到行）、正常态。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../../src/core/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { openDiaryRepairModal } from '../../../src/diary/ui/repair-modal';
import { resetObsidianMocks, clearNotices, hasNotice } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';
import { addEntry, setDiaryDataMap } from '../../../src/diary/store';

let vault: MockVault;
let app: any;

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

  it('D3 回归：子目录日记文件纳入检测（旧实现只扫顶层，子目录未解析行永久修不了）', async () => {
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n正常\n');
    vault.files.set('我的/日记/旧/2024-01-03.md', '子目录里的游离正文\n');
    await openAndSettle();
    const summary = document.querySelector('.bz-diary-repair-summary')!.textContent!;
    expect(summary).toContain('共扫描 2 个日记文件'); // 顶层 + 子目录都进了扫描
    expect(summary).toContain('需手动处理（1 行）');
    const body = (document.getElementById('bz-diary-repair-popup') as HTMLElement).textContent!;
    expect(body).toContain('我的/日记/旧/2024-01-03.md'); // 列出的是子目录完整路径
  });
});

/**
 * D4 回归（review-all-bugs 二节 D4 diary 半边）：修复写盘（runFix 读改写）包进与目标文件
 * 同路径的 core 串行队列——与 diary 写层 / encrypt mergeDiaryBlock 等同路径队列任务 FIFO 互斥，
 * 修复结果不再被「旧快照全量重写」交错抹掉，排队方也基于修复后现值写回（两不丢）。
 * 触发手法：钩住 vault.read，在修复任务的读盘时机同步向同路径塞入并发写方——
 * 修复占着队列，写方必然排在修复任务之后；旧实现（裸读改写）下写方立即插队，断言必挂。
 */
describe('D4 回归：修复写盘与同路径队列互斥', () => {
  /** 打开面板（单文件可修样本）并钩住目标文件的首读时机注入并发写方 */
  async function openHookAndConfirm(
    path: string,
    kick: () => void
  ): Promise<void> {
    await openAndSettle();
    const origRead = vault.read.bind(vault);
    let kicked = false;
    (app.vault as any).read = async (f: any) => {
      const content = await origRead(f);
      // 修复任务读盘后同步 kick 并发写方：此刻修复任务已占同路径队列，写方只能排队
      if (!kicked && f.path === path) {
        kicked = true;
        kick();
      }
      return content;
    };
    const fixBtn = [...document.querySelectorAll('button')].find((b) => b.textContent!.includes('一键修复'))!;
    fixBtn.click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await vi.waitFor(() => expect(hasNotice(/已修复 1 处未解析行/)).toBe(true));
  }

  it('修复窗口内写层写入（addEntry）排队在后：基于修复后内容全量重写，修复与新条目两不丢', async () => {
    const path = '我的/日记/2023-10-27.md';
    vault.files.set(path, '# 📖 9:33\n诗一\n');
    await openHookAndConfirm(path, () => {
      void addEntry('2023-10-27', '20:00', ['日记'], '夜里新条目').catch(() => {});
    });

    const final = vault.files.get(path)!;
    expect(final).toContain('# 📖 09:33'); // 修复没被写层旧快照重写抹掉
    expect(final).toContain('夜里新条目'); // 写层真写进去了（排在修复后读到干净现值，守卫不再拒）
    // 修复后自动重扫：该文件已全部正常
    await vi.waitFor(() =>
      expect(document.querySelector('.bz-diary-repair-summary')!.textContent).toContain('全部正常解析')
    );
  });

  it('修复与同路径裸写队列任务（encrypt mergeDiaryBlock 同形状：读现值整块写回）互斥，两方写入都保留', async () => {
    const path = '我的/日记/2023-10-27.md';
    vault.files.set(path, '# 📖 9:33\n诗一\n');
    const { enqueueFileTask } = await import('../../../src/core/storage');
    await openHookAndConfirm(path, () => {
      void enqueueFileTask(path, async () => {
        const file = app.vault.getAbstractFileByPath(path);
        const cur = await vault.read(file);
        await app.vault.modify(file, cur + '\n后合并的还原块\n');
      });
    });

    const final = vault.files.get(path)!;
    expect(final).toContain('# 📖 09:33'); // 修复没被裸写方的旧快照整写抹掉
    expect(final).toContain('后合并的还原块'); // 裸写方排在修复后，其写入也没被修复的滞回写回抹掉
  });
});