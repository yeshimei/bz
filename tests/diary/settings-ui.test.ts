/**
 * 日记本设置页收尾（接 b8fbb1f1）：存储格式确认框 / 转换进度 / 分类 emoji 选择器。
 *
 * 为什么走真 DOM：这三个问题都只在真实渲染里出现——
 *  1) 确认框排版与「样例文件名等宽块」靠具体子结构与样式类；
 *  2) 转换进度残影的根因是 `hidden` 被 `display:flex` 压过，只有看 DOM 才分得清「移除」与「留残影」；
 *  3) emoji 浮层被设置面板（topifyZ 发的 100000+ 动态档）压住，静态 z-index 在源码里看不出问题。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';
import { cancelActiveFlowDialog } from '../../src/core/flow-dialog';
import { parseEntryFile } from '../../src/diary/parser';
import { parseLegacyDayFile } from '../../src/diary/legacy';
import {
  applyDiaryTypes,
  applyDirectories,
  DEFAULT_DIARY_TYPES,
  getTagEmoji,
  type DiaryTypeConfig,
} from '../../src/diary/config';
import { mountDiaryFormatEditor } from '../../src/diary/settings-format';
import { mountDiaryTypeEditor } from '../../src/diary/settings-types';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices } from '../mock-obsidian-entry';

const DIR = '我的/日记';
const ENTRY = `${DIR}/2606131223.md`;

let vault: MockVault;
let settings: Record<string, unknown>;
let saves: number;
let host: HTMLElement;

function mountHost(): void {
  host = document.createElement('div');
  document.body.appendChild(host);
}

function buttonByText(root: ParentNode, text: string): HTMLElement {
  const hit = [...root.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === text);
  if (!hit) throw new Error(`找不到按钮「${text}」`);
  return hit as HTMLElement;
}

function savedTypes(): DiaryTypeConfig[] {
  return JSON.parse(String(settings.diaryTypes)) as DiaryTypeConfig[];
}

beforeEach(() => {
  document.body.innerHTML = '';
  cancelActiveFlowDialog();
  clearNotices();
  vault = new MockVault();
  setApp(mockAppWithVault(vault));
  settings = {
    diaryDirectory: DIR,
    letterDirectory: '我的/信',
    diaryEntryFormat: 'entry',
    diaryTypes: JSON.stringify(DEFAULT_DIARY_TYPES),
  };
  saves = 0;
  setSettingsProvider(() => settings as never);
  setSettingsSaver(async () => {
    saves += 1;
  });
  applyDirectories(settings);
  applyDiaryTypes(DEFAULT_DIARY_TYPES);
  mountHost();
});

afterEach(() => {
  cancelActiveFlowDialog();
  clearNotices();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('存储：切换格式确认框（日记本的纸面皮）', () => {
  it('点「一天一个文件」弹确认框：三段文案、现存量动态、样例文件名等宽块', () => {
    vault.files.set(ENTRY, serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A'));
    mountDiaryFormatEditor(host);
    (host.querySelector('[data-fmt="day"]') as HTMLElement).click();

    const popup = document.getElementById('__shared_confirm_popup__');
    expect(popup).not.toBeNull();
    // 皮肤类：既有纸面流程框 + 本框排版类；裸壳会被判「另一个插件的框」
    expect(popup!.classList.contains('bz-diary-flow-dialog')).toBe(true);
    expect(popup!.classList.contains('bz-diary-fmt-dialog')).toBe(true);
    expect(popup!.querySelector('h4')!.textContent).toBe('切换到「一天一个文件」？');

    // 旧实现是四段居中长文，现在只剩「目标 / 现状 / 可转换」三段，左对齐
    const body = popup!.querySelector('.bz-diary-fmt-dialog-body')!;
    expect(body.querySelectorAll('.bz-diary-fmt-dialog-line')).toHaveLength(3);
    expect(body.querySelector('.bz-diary-fmt-dialog-file')!.textContent).toBe('2026-06-13.md');
    expect(body.textContent).toContain('已有的 1 个文件保持原样。'); // 数字来自真实统计
    expect(body.textContent).toContain('也可以顺手转换，原文件进 Obsidian 回收站，可恢复。');
    expect(body.querySelector('.bz-diary-fmt-dialog-note')).not.toBeNull();

    // 三颗按钮保留；DOM 上没有内联视觉样式（颜色/间距都在 styles.css）
    expect(popup!.querySelectorAll('.confirm-actions button')).toHaveLength(3);
    expect(popup!.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('没有日记文件时现存量文案不写死 1', () => {
    mountDiaryFormatEditor(host);
    (host.querySelector('[data-fmt="day"]') as HTMLElement).click();
    const body = document.querySelector('.bz-diary-fmt-dialog-body')!;
    expect(body.textContent).toContain('现在还没有已存的日记文件。');
    expect(body.textContent).not.toContain('已有的 1 个文件');
  });

  it('样式源在 src/diary/styles.css：id + 域皮肤类起手，含等宽样例块规则', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');
    expect(css).toMatch(/#__shared_confirm_popup__\.bz-diary-fmt-dialog\s*\{/);
    expect(css).toMatch(/#__shared_confirm_popup__\.bz-diary-fmt-dialog \.bz-diary-fmt-dialog-file\s*\{/);
    expect(css).toMatch(/font-family:\s*var\(--bz-font-mono/);
    // 样式只进源文件：不许在入口里出现内联 style 属性
    const ts = readFileSync(resolve(process.cwd(), 'src/diary/settings-format.ts'), 'utf8');
    expect(ts).not.toMatch(/style="/);
  });
});

describe('存储：转换进度收尾不留残影', () => {
  it('转换期间显示进度，成功后进度容器从 DOM 移除（不残留「正在转换… 0%」）', async () => {
    vault.files.set(ENTRY, serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A'));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const realRead = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async (f: any) => {
      await gate; // 卡住第一个文件的读取，让进度条有机会停在页面上
      return realRead(f);
    });

    mountDiaryFormatEditor(host);
    (host.querySelector('[data-fmt="day"]') as HTMLElement).click();
    buttonByText(document, '切换并转换').click();

    await vi.waitFor(() => expect(host.querySelector('.bz-diary-fmt-progress')).not.toBeNull());
    expect(host.textContent).toContain('正在转换');
    release();

    await vi.waitFor(() => expect(host.querySelector('.bz-diary-fmt-progress')).toBeNull());
    expect(host.textContent).not.toContain('正在转换');
    expect(vault.files.has(`${DIR}/2026-06-13.md`)).toBe(true);
    expect(settings.diaryEntryFormat).toBe('day');
    expect(saves).toBeGreaterThan(0);
  });

  it('转换失败也清掉进度（失败通知照发，页面不留进度条）', async () => {
    vault.files.set(ENTRY, serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A'));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const realRead = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async (f: any) => {
      await gate; // 先让进度条真的出现（否则 waitFor 的首次检查早于 showProgress，会假绿）
      return realRead(f);
    });
    vi.spyOn(vault, 'create').mockRejectedValue(new Error('写入失败'));

    mountDiaryFormatEditor(host);
    (host.querySelector('[data-fmt="day"]') as HTMLElement).click();
    buttonByText(document, '切换并转换').click();

    await vi.waitFor(() => expect(host.querySelector('.bz-diary-fmt-progress')).not.toBeNull());
    release();
    await vi.waitFor(() => expect(host.querySelector('.bz-diary-fmt-progress')).toBeNull());
    expect(host.textContent).not.toContain('正在转换');
    expect(settings.diaryEntryFormat).toBe('entry'); // 没转换成功不切换格式
  });
});

describe('分类：旧日记的 type 不因默认只留 3 个而消失', () => {
  it('一篇一文件：frontmatter 的旧 type 原文照常读出，emoji 用默认兜底（不是空白）', () => {
    const content = serializeDiaryEntryFile({ date: '2024-01-01', time: '14:30' }, ['四川'], '游记');
    const entry = parseEntryFile(content, `${DIR}/2401011430.md`);
    expect(entry).not.toBeNull();
    expect(entry!.tags).toEqual(['四川']);
    expect(entry!.emoji).toBe('📖');
  });

  it('一天一文件：旧 emoji 头行仍能从旧表反查标签（升级后不丢旧日记类型）', () => {
    // 🀄 = 旧版 28 类里的「四川」，当前默认分类表没有它——靠 legacy 反查表兜底
    const day = parseLegacyDayFile('# 🀄 12:00\n\n游记\n', `${DIR}/2026-06-13.md`);
    expect(day).not.toBeNull();
    expect(day!.blocks[0].tags).toEqual(['四川']);
  });
});

describe('分类：emoji 选择器', () => {
  it('点 emoji 打开浮层（层级高于设置面板），选中后写回 settings.diaryTypes 并即时更新列表', () => {
    mountDiaryTypeEditor(host);
    const emojiBtn = host.querySelector<HTMLElement>('.bz-diary-type-emoji')!;
    emojiBtn.click();

    const pop = document.querySelector<HTMLElement>('.bz-diary-type-emoji-pop');
    expect(pop, '点 emoji 没有弹出选择器').not.toBeNull();
    // 设置面板是 topifyZ 发的 100000+ 动态档；浮层必须同走动态发号（旧静态 10050 会被压住）
    expect(Number(pop!.style.zIndex)).toBeGreaterThanOrEqual(100000);

    const cell = [...pop!.querySelectorAll<HTMLElement>('[data-e]')].find((b) => b.textContent === '🐱');
    expect(cell).not.toBeUndefined();
    cell!.click();

    expect(document.querySelector('.bz-diary-type-emoji-pop')).toBeNull();
    expect(host.querySelector('.bz-diary-type-row .bz-diary-type-emoji')!.textContent).toBe('🐱');
    expect(savedTypes()[0]).toEqual({ tag: '日记', emoji: '🐱' });
    expect(getTagEmoji('日记')).toBe('🐱');
    expect(saves).toBeGreaterThan(0);
  });

  it('emoji 浮层样式不写静态 z-index（层级归 topifyZ）', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');
    const block = css.match(/\.bz-diary-type-emoji-pop\s*\{([^}]*)\}/);
    expect(block, '缺 .bz-diary-type-emoji-pop 规则').not.toBeNull();
    expect(block![1]).not.toContain('z-index');
  });
});
