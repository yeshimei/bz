// @vitest-environment node
/**
 * 加密日记还原的两种存储格式（ADR-0284 / 2026-11-06）：
 * day 格式下不再「追加到文件末尾」，而是按块头 HH:mm 插回当天文件的时间序位置。
 * 另钉住：落点跟随注入的 diaryDir（两分支同源）、只规范化插入点（不压缩其他条目空行）、
 * reclassifyEntry 走 buildRestoreBlock 的 day 格式完整链路（emoji 块头写回当天文件）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeManager } from '../../src/encrypt/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { applyDirectories, isDayFormat } from '../../src/diary/config';
import { reclassifyEntry } from '../../src/diary/encrypt';
import { getSafeManager } from '../../src/encrypt';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  setApp({ vault, metadataCache: { trigger: vi.fn() } } as any);
}

/** 解锁后的 SafeManager + 一篇待还原的加密日记（来源路径 = 当天的 day 文件） */
async function lockDiary(
  sm: SafeManager,
  opts: { path: string; time: string; content: string }
): Promise<string> {
  const note = await sm.lockNote({
    path: opts.path,
    title: `${opts.path.split('/').pop()!.replace(/\.md$/, '')} · ${opts.time} 日记`,
    kind: 'diary-entry',
    content: `# 日记/加密 ${opts.time}\n${opts.content}`,
    attachments: [],
  });
  return note.id;
}

describe('加密日记还原：day 格式按 HH:mm 插回', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    makeApp(vault);
    setSettingsProvider(
      () =>
        ({
          diaryDirectory: '我的/日记',
          diaryEntryFormat: 'day',
        }) as never
    );
  });

  it('还原 12:00 的块 → 插在 09:00 与 21:00 之间', async () => {
    vault.create('我的/日记/2026-08-10.md', '# 📖 09:00\n\n早起\n\n# 📖 21:00\n\n睡前\n');
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteId = await lockDiary(sm, {
      path: '我的/日记/2026-08-10.md',
      time: '12:00',
      content: '午后',
    });

    expect(await sm.restoreDiaryEntry(noteId, '# 📖 12:00\n\n午后')).toBe(true);
    const md = vault.files.get('我的/日记/2026-08-10.md')!;
    expect(md.indexOf('09:00')).toBeLessThan(md.indexOf('12:00'));
    expect(md.indexOf('12:00')).toBeLessThan(md.indexOf('21:00'));
    expect(md).toContain('早起');
    expect(md).toContain('午后');
    expect(md).toContain('睡前');
  });

  it('还原比当天所有块都晚的 → 接在末尾', async () => {
    vault.create('我的/日记/2026-08-11.md', '# 📖 09:00\n\n早起\n');
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteId = await lockDiary(sm, {
      path: '我的/日记/2026-08-11.md',
      time: '23:30',
      content: '夜深',
    });
    expect(await sm.restoreDiaryEntry(noteId, '# 📖 23:30\n\n夜深')).toBe(true);
    const md = vault.files.get('我的/日记/2026-08-11.md')!;
    expect(md.indexOf('09:00')).toBeLessThan(md.indexOf('23:30'));
  });

  it('同日同刻：新块插在已有同刻块之后（不越过同刻的较早条目）', async () => {
    vault.create(
      '我的/日记/2026-08-16.md',
      '# 📖 09:00\n\n早上\n\n# 📖 12:00\n\n先写的\n\n# 📖 21:00\n\n晚上\n'
    );
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteId = await lockDiary(sm, {
      path: '我的/日记/2026-08-16.md',
      time: '12:00',
      content: '后写的',
    });
    expect(await sm.restoreDiaryEntry(noteId, '# 📖 12:00\n\n后写的')).toBe(true);
    const md = vault.files.get('我的/日记/2026-08-16.md')!;
    // 顺序：09:00 → 先写的 → 后写的 → 21:00（同刻不插到已有同刻块前面）
    expect(md.indexOf('09:00')).toBeLessThan(md.indexOf('先写的'));
    expect(md.indexOf('先写的')).toBeLessThan(md.indexOf('后写的'));
    expect(md.indexOf('后写的')).toBeLessThan(md.indexOf('21:00'));
  });

  it('目标文件为空：新建当天文件，内容就是还原块本身', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteId = await lockDiary(sm, {
      path: '我的/日记/2026-08-14.md',
      time: '12:00',
      content: '午后',
    });
    expect(await sm.restoreDiaryEntry(noteId, '# 📖 12:00\n\n午后')).toBe(true);
    expect(vault.files.get('我的/日记/2026-08-14.md')).toBe('# 📖 12:00\n\n午后\n');
    // 取出即删：清单不再留有该条
    expect(sm.manifest.notes.some((n) => n.id === noteId)).toBe(false);
  });

  it('重复还原幂等：当天文件已含同一块（中断残留）→ 跳过不重复写，仍成功取出', async () => {
    const restored = '# 📖 09:00\n\n早上\n\n# 📖 12:00\n\n午后\n';
    vault.create('我的/日记/2026-08-15.md', restored);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteId = await lockDiary(sm, {
      path: '我的/日记/2026-08-15.md',
      time: '12:00',
      content: '午后',
    });
    expect(await sm.restoreDiaryEntry(noteId, '# 📖 12:00\n\n午后')).toBe(true);
    // 文件逐字未变（不重复追加第二份同刻块）
    expect(vault.files.get('我的/日记/2026-08-15.md')).toBe(restored);
    expect(sm.manifest.notes.some((n) => n.id === noteId)).toBe(false);
  });

  it('插入只规范插入点：不压缩其他条目正文里有意保留的连续空行', async () => {
    const original = '# 📖 09:00\n\n第一段\n\n\n\n第二段（保留 3 个空行）\n\n# 📖 21:00\n\n睡前\n';
    vault.create('我的/日记/2026-08-13.md', original);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteId = await lockDiary(sm, {
      path: '我的/日记/2026-08-13.md',
      time: '12:00',
      content: '午后',
    });
    expect(await sm.restoreDiaryEntry(noteId, '# 📖 12:00\n\n午后')).toBe(true);
    const md = vault.files.get('我的/日记/2026-08-13.md')!;
    // 其他条目内部 3 个连续空行原样保留（整文件级压缩会把它压成 2 个）
    expect(md).toContain('第一段\n\n\n\n第二段（保留 3 个空行）');
    // 新块本身仍与前后文各留一个空行
    expect(md).toContain('第二段（保留 3 个空行）\n\n# 📖 12:00\n\n午后\n\n# 📖 21:00');
  });

  it('被还原块自身正文的 3 个连续空行逐字保留（解密即原文，不压块内格式）', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteId = await lockDiary(sm, {
      path: '我的/日记/2026-08-18.md',
      time: '12:00',
      content: '午后',
    });
    // 目标文件不存在 → 整文件就是这一块；块内 3 个连续空行必须原样写回
    const block = '# 📖 12:00\n\n第一段\n\n\n\n第二段';
    expect(await sm.restoreDiaryEntry(noteId, block)).toBe(true);
    expect(vault.files.get('我的/日记/2026-08-18.md')).toBe(
      '# 📖 12:00\n\n第一段\n\n\n\n第二段\n'
    );
  });

  it('幂等（旧版残留）：文件里已有未压缩的同块 → 跳过不重复插入，仍成功出库', async () => {
    // 旧版 mergeLegacyDiaryBlock 只追加、不压缩：中断残留现场 = 未压缩的同块已落在当天文件里
    const restored = '# 📖 09:00\n\n早上\n\n# 📖 12:00\n\n第一段\n\n\n\n第二段\n';
    vault.create('我的/日记/2026-08-19.md', restored);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteId = await lockDiary(sm, {
      path: '我的/日记/2026-08-19.md',
      time: '12:00',
      content: '午后',
    });
    expect(await sm.restoreDiaryEntry(noteId, '# 📖 12:00\n\n第一段\n\n\n\n第二段')).toBe(true);
    const md = vault.files.get('我的/日记/2026-08-19.md')!;
    expect(md).toBe(restored); // 逐字未变：没有插入第二份同块
    expect(md.match(/# 📖 12:00/g)!.length).toBe(1);
    expect(sm.manifest.notes.some((n) => n.id === noteId)).toBe(false);
  });

  it('还原落点跟随注入的 diaryDir（与 settings 读取解耦，两分支同源）', async () => {
    // settings 仍是「我的/日记」，调用方注入「新日记本」→ 必须落到注入目录
    vault.create('新日记本/2026-08-12.md', '# 📖 09:00\n\n早上\n');
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteId = await lockDiary(sm, {
      path: '我的/日记/2026-08-12.md',
      time: '12:00',
      content: '午后',
    });
    expect(await sm.restoreDiaryEntry(noteId, '# 📖 12:00\n\n午后', '新日记本')).toBe(true);
    const moved = vault.files.get('新日记本/2026-08-12.md')!;
    expect(moved).toContain('午后');
    expect(moved.indexOf('09:00')).toBeLessThan(moved.indexOf('12:00'));
    // 旧目录（settings 值）不落新文件
    expect(vault.files.has('我的/日记/2026-08-12.md')).toBe(false);
  });
});

describe('reclassifyEntry：day 格式完整链路', () => {
  beforeEach(() => {
    setSettingsProvider(
      () =>
        ({
          diaryDirectory: '我的/日记',
          diaryEntryFormat: 'day',
        }) as never
    );
    applyDirectories({ diaryDirectory: '我的/日记', diaryEntryFormat: 'day' });
  });

  it('buildRestoreBlock 产出 emoji 块头，按 day 格式插回当天文件', async () => {
    expect(isDayFormat()).toBe(true);
    const vault = new MockVault();
    setApp({ vault, metadataCache: { trigger: vi.fn() } } as any);
    vault.create('我的/日记/2026-08-17.md', '# 📖 09:00\n\n早上\n\n# 📖 21:00\n\n晚上\n');
    const sm = getSafeManager();
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/2026-08-17.md',
      title: '2026-08-17 · 12:00 日记',
      kind: 'diary-entry',
      content: '# 日记/加密 12:00\n午后',
      attachments: [],
    });

    expect(await reclassifyEntry(note.id, ['日记'])).toBe(true);
    const md = vault.files.get('我的/日记/2026-08-17.md')!;
    // day 格式块头是 emoji（不是 v2 标签名制 `# 日记 12:00`）
    expect(md).toContain('# 📖 12:00');
    expect(md).not.toContain('加密');
    expect(md.indexOf('09:00')).toBeLessThan(md.indexOf('12:00'));
    expect(md.indexOf('12:00')).toBeLessThan(md.indexOf('21:00'));
    expect(md).toContain('午后');
    expect(sm.manifest.notes.some((n) => n.id === note.id)).toBe(false);
  });
});
