/**
 * UX 整改（2026 拍板批次）日记域测试：
 * 7 保存确认 · 8 加密改分类提示 · 9 解析失败汇总 · 24 ESC 只收搜索 ·
 * 25 关闭路径统一 · 34 滚轮年份放开 · 41 增量更新 · p5 滚动性能。
 * 沿用既有 helper 风格（init 全链路 + MockVault + notice DOM 断言）。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { init, showDiaryPanel } from '../../../src/diary/ui/panel';
import { openAddDialog, saveNewEntry, createTagPicker, showTagPicker } from '../../../src/diary/ui/dialogs';
import { jumpToEntry, insertCard, removeCard, updateSticky } from '../../../src/diary/ui/entries';
import { rebuildTags, updateTagCounts, refreshSubTagsBar } from '../../../src/diary/ui/filter-shared';
import { showDateTimePicker } from '../../../src/diary/ui/datetime-picker';
import { loadAll } from '../../../src/diary/store';
import { state, setDiaryDataMap } from '../../../src/diary/state';
import { applyUiSettings } from '../../../src/diary/ui/ui-settings';
import * as diaryEncrypt from '../../../src/diary/encrypt';
import * as storeModule from '../../../src/diary/store';
import * as filterShared from '../../../src/diary/ui/filter-shared';
import { resetObsidianMocks, hasNotice, clearNotices } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';
import { moment } from 'obsidian';

let vault: MockVault;
let app: any;

beforeEach(async () => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  resetObsidianMocks();
  clearNotices();
  state.data.selectedTags.clear();
  state.data.currentDateFilter = null;
  state.data.currentSearchKeyword = '';
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.data.currentDisplayCount = 0;
  state.ui.isPopupShown = false;
  state.ui.editingEntryId = null;
  state.ui.singleSelectedTagForDisplay = null;
  state.ui.isTouchDevice = false;
  if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  // UX-41 计数防抖计时器清理（跨用例不泄漏）
  if (state.data.tagCountTimer) {
    clearTimeout(state.data.tagCountTimer);
    state.data.tagCountTimer = null;
  }
  setDiaryDataMap(null);
  vault = new MockVault();
  vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n第一条日记\n');
  vault.files.set('我的/日记/2024-01-02.md', '# ✍️ 09:00\n第二条日记\n');
  app = mockAppWithVault(vault);
  setApp(app);
  await init({ registerEvent: () => {} });
});

// ===== 7 保存成功确认 =====

describe('UX-7 保存成功确认', () => {
  it('saveNewEntry 成功路径弹「已保存日记」success 提示（正文不带 emoji）', async () => {
    openAddDialog();
    (document.querySelector('#add-diary-type-container [data-tag="书"]') as HTMLElement).click();
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    dt.value = '2024-01-31 10:30';
    await saveNewEntry();
    expect(hasNotice('已保存日记')).toBe(true);
    expect(vault.files.has('我的/日记/2024-01-31.md')).toBe(true);
  });

  it('保存失败只弹错误提示，不弹成功提示', async () => {
    const spy = vi.spyOn(storeModule, 'addEntry').mockRejectedValue(new Error('boom'));
    try {
      openAddDialog();
      (document.querySelector('#add-diary-type-container [data-tag="书"]') as HTMLElement).click();
      await saveNewEntry();
      expect(hasNotice(/保存日记失败：boom/)).toBe(true);
      expect(hasNotice('已保存日记')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

// ===== 8 加密条目标签改分类成功提示 =====

describe('UX-8 加密改分类提示', () => {
  function pushEncryptedEntry(id: string, noteId: string) {
    const entry = {
      ...state.data.originalDiaryEntries[0],
      id,
      encrypted: true,
      noteId,
      tags: ['加密', '日记'],
    } as any;
    state.data.originalDiaryEntries.push(entry);
    return entry;
  }

  it('成功 → 「已解密还原」success（复用既有文案模式）', async () => {
    pushEncryptedEntry('enc-ux-ok', 'note-ux-ok');
    const reclassifySpy = vi.spyOn(diaryEncrypt, 'reclassifyEntry').mockResolvedValue(true);
    const reloadSpy = vi.spyOn(storeModule, 'reloadWithEncrypted').mockResolvedValue(undefined);
    try {
      createTagPicker();
      showTagPicker('enc-ux-ok');
      // 加密条目的已选分类为「日记」（加密不提供分类入口），追加「书」
      (document.querySelector('#diary-tag-selector-popup [data-tag="书"]') as HTMLElement).click();
      (document.querySelector('.diary-save-btn') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 0));
      const ok = document.getElementById('__shared_confirm_ok__');
      expect(ok).toBeTruthy();
      (ok as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 20));
      expect(hasNotice('已解密还原')).toBe(true);
      expect(hasNotice(/解密改分类失败/)).toBe(false);
      expect(reclassifySpy).toHaveBeenCalledWith('note-ux-ok', ['日记', '书']);
      expect(reloadSpy).toHaveBeenCalled();
    } finally {
      reclassifySpy.mockRestore();
      reloadSpy.mockRestore();
    }
  });

  it('失败 → 「解密改分类失败」error', async () => {
    pushEncryptedEntry('enc-ux-fail', 'note-ux-fail');
    const reclassifySpy = vi.spyOn(diaryEncrypt, 'reclassifyEntry').mockResolvedValue(false);
    const reloadSpy = vi.spyOn(storeModule, 'reloadWithEncrypted').mockResolvedValue(undefined);
    try {
      createTagPicker();
      showTagPicker('enc-ux-fail');
      (document.querySelector('.diary-save-btn') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 0));
      (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 20));
      expect(hasNotice('解密改分类失败')).toBe(true);
      expect(hasNotice('已解密还原')).toBe(false);
    } finally {
      reclassifySpy.mockRestore();
      reloadSpy.mockRestore();
    }
  });
});

// ===== 9 解析失败汇总提示 =====

describe('UX-9 解析失败汇总提示', () => {
  it('存在未解析行 → 一次 warning 汇总「N 条未能解析，请检查日记文件格式」', async () => {
    vault.files.set('我的/日记/2020-01-01.md', '游离前言\n# 📖 08:00\n正常\n');
    await loadAll();
    expect(hasNotice('1 条未能解析，请检查日记文件格式')).toBe(true);
    // 解析结果不受影响：游离行不产生条目，正常条目照常解析
    expect(state.data.originalDiaryEntries.some((e) => e.date === '2020-01-01' && e.content === '正常')).toBe(true);
  });

  it('多文件未解析行跨文件累计为一次提示', async () => {
    vault.files.set('我的/日记/2020-01-01.md', '游离一\n游离二\n# 📖 08:00\n正常\n');
    vault.files.set('我的/日记/2019-12-31.md', '# 📖 27:00\nx\n# ✍️ 09:00\ny\n');
    await loadAll();
    // 2020 文件 2 行游离 + 2019 文件 1 行越界标题 + 其 1 行孤儿正文 = 4
    expect(hasNotice('4 条未能解析，请检查日记文件格式')).toBe(true);
    // 可解析部分不受影响
    expect(state.data.originalDiaryEntries.some((e) => e.date === '2019-12-31' && e.time === '09:00')).toBe(true);
  });

  it('全部可解析 → 不弹解析失败提示', async () => {
    await loadAll();
    expect(hasNotice(/未能解析/)).toBe(false);
  });
});

// ===== 24 ESC 只收搜索 =====

describe('UX-24 ESC 只收搜索', () => {
  it('焦点在搜索框：ESC 清空/失焦搜索框，面板保持可见；再次 ESC 才关面板', async () => {
    await showDiaryPanel();
    const container = document.getElementById('diary-search-container') as HTMLElement;
    container.style.display = 'block';
    const input = document.getElementById('diary-search-input') as HTMLInputElement;
    input.value = '关键词';
    input.focus();
    expect(document.activeElement).toBe(input);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(input.value).toBe('');
    expect(document.activeElement).not.toBe(input);
    expect(state.data.currentSearchKeyword).toBe('');
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('visible');

    // 第二次 ESC（焦点已不在搜索框）→ 正常关闭面板
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('hidden');
  });

  it('焦点不在搜索框：ESC 直接关闭面板（原行为不破坏）', async () => {
    await showDiaryPanel();
    const input = document.getElementById('diary-search-input') as HTMLInputElement;
    input.value = '残留';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('hidden');
  });
});

// ===== 25 关闭路径统一 =====

describe('UX-25 关闭路径统一', () => {
  it('遮罩点击 → closePanel（关面板即锁保险箱语义）', async () => {
    await showDiaryPanel();
    document.getElementById('diary-filter-mask')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('hidden');
    expect(document.getElementById('diary-filter-mask')!.style.visibility).toBe('hidden');
  });

  it('jumpToEntry 三路径（日记/影视/信）：先跳原文后隐藏面板', async () => {
    const openSpy = vi.spyOn(app.workspace, 'openLinkText').mockResolvedValue(undefined);
    const base = state.data.originalDiaryEntries[0];
    try {
      // 日记路径（双击跳原文）
      await showDiaryPanel();
      await jumpToEntry(base);
      expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('#'), '', false, { active: true });
      expect(document.getElementById('diary-filter-mask')!.style.visibility).toBe('hidden');

      // 影视路径
      await showDiaryPanel();
      vault.files.set('我的/影视/film.md', 'x');
      await jumpToEntry({ ...base, id: 'movie-ux', filename: '我的/影视/film.md' } as any);
      expect(openSpy).toHaveBeenCalledWith('我的/影视/film.md', '', false, { active: true });
      expect(document.getElementById('diary-filter-mask')!.style.visibility).toBe('hidden');

      // 信路径
      await showDiaryPanel();
      vault.files.set('我的/信/hello.md', 'x');
      await jumpToEntry({ ...base, id: 'letter-ux', filename: '我的/信/hello.md' } as any);
      expect(openSpy).toHaveBeenCalledWith('我的/信/hello.md', '', false, { active: true });
      expect(document.getElementById('diary-filter-mask')!.style.visibility).toBe('hidden');
    } finally {
      openSpy.mockRestore();
    }
  });
});

// ===== 34 滚轮年份放开 =====

describe('UX-34 滚轮年份动态范围', () => {
  function yearItems(mask: HTMLElement): string[] {
    const yearCol = mask.querySelectorAll('.diary-datetime-scroll-container')[0];
    return [...yearCol.querySelectorAll<HTMLElement>('.datetime-number-item')].map((el) => el.dataset.value!);
  }

  it('min=数据最早年份、max=当前年份+1', () => {
    const saved = state.data.originalDiaryEntries;
    state.data.originalDiaryEntries = [
      { id: 'a', date: '2021-05-01', time: '08:00', timeValue: 800, tags: ['日记'], emoji: '', content: '', filename: 'x', lineNumber: 0 } as any,
      { id: 'b', date: '2024-06-01', time: '09:00', timeValue: 900, tags: ['日记'], emoji: '', content: '', filename: 'x', lineNumber: 0 } as any,
    ];
    try {
      const mask = showDateTimePicker(moment('2024-06-15 14:30'), () => {});
      const items = yearItems(mask);
      expect(items[0]).toBe('2021');
      expect(items[items.length - 1]).toBe(String(new Date().getFullYear() + 1));
      // 当前年份包含在列内（max = 当前+1 提供未来余量）
      expect(items).toContain(String(new Date().getFullYear()));
      mask.remove();
    } finally {
      state.data.originalDiaryEntries = saved;
    }
  });

  it('无数据时年份下限放宽至 1900', () => {
    const saved = state.data.originalDiaryEntries;
    state.data.originalDiaryEntries = [];
    try {
      const mask = showDateTimePicker(moment('2024-06-15 14:30'), () => {});
      const items = yearItems(mask);
      expect(items[0]).toBe('1900');
      expect(items[items.length - 1]).toBe(String(new Date().getFullYear() + 1));
      mask.remove();
    } finally {
      state.data.originalDiaryEntries = saved;
    }
  });
});

// ===== 41 增量更新 =====

describe('UX-41 增量更新', () => {
  it('搜索键击不触发标签全量计数与二级标签栏重建', async () => {
    // init 链路会排一次计数防抖（合法全量场景），先冲刷再挂 spy，隔离本次断言窗口
    if (state.data.tagCountTimer) {
      clearTimeout(state.data.tagCountTimer);
      state.data.tagCountTimer = null;
    }
    const countSpy = vi.spyOn(filterShared, 'updateTagCounts');
    const subBarSpy = vi.spyOn(filterShared, 'refreshSubTagsBar');
    try {
      const container = document.getElementById('diary-search-container') as HTMLElement;
      container.style.display = 'block';
      const input = document.getElementById('diary-search-input') as HTMLInputElement;
      input.value = '第二条';
      input.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 350)); // 搜索防抖 300ms
      expect(state.data.currentFilteredEntries.length).toBe(1);
      expect(countSpy).not.toHaveBeenCalled();
      expect(subBarSpy).not.toHaveBeenCalled();
    } finally {
      subBarSpy.mockRestore();
      countSpy.mockRestore();
    }
  });

  it('rebuildTags 重建后保留横向滚动位置', () => {
    const container = document.getElementById('diary-tag-container')!;
    const old = container.querySelector('.diary-tags-scroll-container') as HTMLElement;
    old.scrollLeft = 88;
    rebuildTags();
    const fresh = container.querySelector('.diary-tags-scroll-container') as HTMLElement;
    expect(fresh).not.toBe(old);
    expect(fresh.scrollLeft).toBe(88);
  });

  it('updateTagCounts 增量刷新：只更新计数 span，不重写按钮结构', () => {
    applyUiSettings({ diaryTagShowEmoji: true });
    rebuildTags();
    const container = document.getElementById('diary-tag-container')!;
    const btn = container.querySelector('[data-tag="日记"]') as HTMLElement;
    const span = btn.querySelector('.diary-tag-count') as HTMLElement;
    expect(span).toBeTruthy();
    expect(span.textContent).toBe('(1)'); // beforeEach vault：1 条 📖
    state.data.originalDiaryEntries.push({
      id: 'ux-count', date: '2024-01-03', time: '11:00', timeValue: 1100, tags: ['日记'], emoji: '📖', content: '', filename: '2024-01-03', lineNumber: 0,
    } as any);
    updateTagCounts();
    expect(span.textContent).toBe('(2)');
    // 结构未重写：emoji 前缀与计数 span 保持唯一
    expect(btn.innerHTML.startsWith('📖 日记')).toBe(true);
    expect(btn.querySelectorAll('.diary-tag-count').length).toBe(1);
    expect(btn.classList.contains('bz-encrypt-locked')).toBe(false);
    applyUiSettings({ diaryTagShowEmoji: true });
  });

  it('标签选中增量切换：仅新旧按钮样式变化，其余保持默认', () => {
    state.data.selectedTags.clear();
    rebuildTags();
    const container = document.getElementById('diary-tag-container')!;
    const diary = container.querySelector('[data-tag="日记"]') as HTMLElement;
    const book = container.querySelector('[data-tag="书"]') as HTMLElement;
    diary.click();
    expect(diary.style.background).toBe('var(--interactive-accent)');
    book.click();
    expect(diary.style.background).toBe('var(--background-secondary)');
    expect(book.style.background).toBe('var(--interactive-accent)');
    const highlighted = [...container.querySelectorAll('.diary-tag-btn')].filter(
      (b) => (b as HTMLElement).style.background === 'var(--interactive-accent)'
    );
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]).toBe(book);
  });
});

// ===== p5 滚动性能 =====

describe('UX-p5 滚动性能', () => {
  it('updateSticky 缓存二分定位置顶分隔符并增量升降 zIndex（滚动路径无逐项布局读取）', () => {
    const container = document.createElement('div');
    const mk = (top: number) => {
      const section = document.createElement('div');
      section.className = 'date-section';
      const sep = document.createElement('div');
      sep.className = 'diary-date-separator';
      Object.assign(sep.style, { position: 'sticky', top: '0', zIndex: '10' });
      section.appendChild(sep);
      container.appendChild(section);
      Object.defineProperty(section, 'offsetTop', { value: top, configurable: true });
      return { section, sep };
    };
    const a = mk(100);
    const b = mk(300);
    document.body.appendChild(container);
    state.ui.entriesContainer = container;
    state.ui.scrollContainer = container;
    try {
      container.scrollTop = 250; // 分区 A 顶部 100 ≤ 255 → A 置顶
      updateSticky();
      expect(a.sep.style.zIndex).toBe('20');
      expect(b.sep.style.zIndex).toBe('10');
      container.scrollTop = 350; // B 顶部 300 ≤ 355 → 置顶切换为 B
      updateSticky();
      expect(b.sep.style.zIndex).toBe('20');
      expect(a.sep.style.zIndex).toBe('10');
      container.scrollTop = 350;
      updateSticky(); // 置顶未变 → 幂等无抖动
      expect(b.sep.style.zIndex).toBe('20');
      expect(a.sep.style.zIndex).toBe('10');
    } finally {
      state.ui.entriesContainer = null;
      state.ui.scrollContainer = null;
      container.remove();
    }
  });

  it('既有分区插卡后分区缓存重建：后续分区移位被重新读取（UX-p5 回归）', () => {
    const container = document.createElement('div');
    const mk = (top: number, date: string) => {
      const section = document.createElement('div');
      section.className = 'date-section';
      const sep = document.createElement('div');
      sep.className = 'diary-date-separator';
      sep.dataset.date = date;
      Object.assign(sep.style, { position: 'sticky', top: '0', zIndex: '10' });
      section.appendChild(sep);
      container.appendChild(section);
      Object.defineProperty(section, 'offsetTop', { value: top, configurable: true });
      return { section, sep };
    };
    const a = mk(100, '2024-01-01');
    const b = mk(300, '2024-01-02');
    document.body.appendChild(container);
    state.ui.entriesContainer = container;
    state.ui.scrollContainer = container;
    try {
      container.scrollTop = 250;
      updateSticky(); // 建缓存 [100, 300] → A 置顶
      expect(a.sep.style.zIndex).toBe('20');
      // 模拟插卡后 B 下移：先改 stub，再走「既有分区插卡」路径（保存新条目/改分类重入列同源）
      Object.defineProperty(b.section, 'offsetTop', { value: 1000, configurable: true });
      const entry = { ...state.data.originalDiaryEntries[0], id: 'ux-insert', date: '2024-01-01', time: '23:59', timeValue: 2359 } as any;
      insertCard(entry); // 命中 2024-01-01 既有分区 → 必须重建缓存（新 B 顶 1000）
      container.scrollTop = 800;
      updateSticky();
      // 若缓存未重建：B 旧值 300 ≤ 805 会被误选为置顶 → B z20 错误
      expect(a.sep.style.zIndex).toBe('20');
      expect(b.sep.style.zIndex).toBe('10');
    } finally {
      state.ui.entriesContainer = null;
      state.ui.scrollContainer = null;
      container.remove();
    }
  });

  it('removeCard 后分区缓存重建：后续分区上移被重新读取（UX-p5 回归）', () => {
    const container = document.createElement('div');
    const mk = (top: number, date: string) => {
      const section = document.createElement('div');
      section.className = 'date-section';
      const sep = document.createElement('div');
      sep.className = 'diary-date-separator';
      sep.dataset.date = date;
      Object.assign(sep.style, { position: 'sticky', top: '0', zIndex: '10' });
      section.appendChild(sep);
      container.appendChild(section);
      Object.defineProperty(section, 'offsetTop', { value: top, configurable: true });
      return { section, sep };
    };
    const a = mk(100, '2024-01-01');
    const b = mk(300, '2024-01-02');
    // 分区 A 内放一张真实卡片（减卡路径）
    const card = document.createElement('div');
    card.id = 'diary-entry-ux-rm';
    a.section.appendChild(card);
    document.body.appendChild(container);
    state.ui.entriesContainer = container;
    state.ui.scrollContainer = container;
    try {
      container.scrollTop = 250;
      updateSticky(); // 建缓存 [100, 300] → A 置顶
      expect(a.sep.style.zIndex).toBe('20');
      // 模拟减卡后 B 上移：先改 stub，再走 removeCard（改分类移除卡片同源）
      Object.defineProperty(b.section, 'offsetTop', { value: 200, configurable: true });
      removeCard('ux-rm');
      expect(document.getElementById('diary-entry-ux-rm')).toBeNull();
      container.scrollTop = 250;
      updateSticky();
      // 若缓存未重建：B 旧值 300 > 255 不会被选中 → A 仍置顶，B 应为新值 200 → B z20
      expect(b.sep.style.zIndex).toBe('20');
      expect(a.sep.style.zIndex).toBe('10');
    } finally {
      state.ui.entriesContainer = null;
      state.ui.scrollContainer = null;
      container.remove();
    }
  });
});