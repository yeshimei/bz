/**
 * diary UI 补测（覆盖率 85% 目标）：entries 卡片/长按/跳转/插入/编辑恢复、
 * dialogs 标签选择器/添加弹窗/更新标签、datetime-picker 控件同步、quote 命令空态。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { init } from '../../../src/diary/ui/panel';
import { applyFilter, createEntryCard, buildSheetHead, copyLink, jumpToEntry, cancelEdit, removeCard, insertCard, initScroll, updateSticky } from '../../../src/diary/ui/entries';
import { createTagPicker, showTagPicker, updateTags, createAddDialog, openAddDialog, createDatePicker } from '../../../src/diary/ui/dialogs';
import { createDateTimeControl, syncDateTime, showDateTimePicker } from '../../../src/diary/ui/datetime-picker';
import { state } from '../../../src/diary/state';
import { applyUiSettings } from '../../../src/diary/ui/ui-settings';
import { resetObsidianMocks, Platform as MockPlatform, getNoticeMessages, hasNotice, clearNotices } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';
import { moment } from 'obsidian';

let vault: MockVault;
let app: any;

beforeEach(async () => {
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
  state.ui.singleSelectedTagForDisplay = null;
  state.ui.isTouchDevice = false;
  if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  vault = new MockVault();
  vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n第一条日记\n');
  vault.files.set('我的/日记/2024-01-02.md', '# ✍️ 09:00\n第二条日记\n');
  app = mockAppWithVault(vault);
  setApp(app);
  await init({ registerEvent: () => {} });
});

/** 独立条目（id 唯一，避免与 init 渲染的面板卡片冲突） */
function soloEntry() {
  const e = state.data.originalDiaryEntries[0];
  return { ...e, id: 'test-1' };
}

describe('entries 补测', () => {
  it('createEntryCard：结构 + 单选标签显示分支', () => {
    const entry = soloEntry();
    const card = createEntryCard(entry);
    expect(card.className).toContain('diary-entry-card');
    expect(card.classList.contains('bz-item-card')).toBe(true); // 挂统一操作条容器类
    expect(card.id).toBe('diary-entry-test-1');
    expect(card.querySelector('.diary-emoji')!.textContent).toBe(entry.emoji);
    expect(card.querySelector('.diary-entry-content')).toBeTruthy();
    // 多标签条目 + 单选显示：只显示选中标签 emoji
    const multi = { ...entry, id: 'test-2', tags: ['书', '电影'], emoji: '📕🎬' };
    state.ui.singleSelectedTagForDisplay = '书';
    const card2 = createEntryCard(multi);
    expect((card2.querySelector('.diary-emoji') as HTMLElement).textContent).toBe('📕');
    expect((card2.querySelector('.diary-emoji') as HTMLElement).textContent).not.toContain('🎬');
  });

  it('diaryContentRenderMode=plain → 卡片内容纯文本（无 Markdown 结构）', async () => {
    const entry = soloEntry();
    state.data.originalDiaryEntries[0] = { ...state.data.originalDiaryEntries[0], content: '**加粗** 和 `代码`' } as any;
    applyUiSettings({ diaryContentRenderMode: 'plain' });
    const card = createEntryCard({ ...entry, content: '**加粗** 和 `代码`' } as any);
    const content = card.querySelector('.diary-entry-content') as HTMLElement;
    expect(content.textContent).toContain('**加粗**');
    expect(content.querySelector('strong')).toBeNull();
    applyUiSettings({ diaryContentRenderMode: 'markdown' });
  });

  it('长按卡片 → 移动端底部抽屉：非加密含 打开/复制双链/复制正文/改标签/加密/删除，头部与列表一致', async () => {
    MockPlatform.isMobile = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const entry = state.data.originalDiaryEntries[0]; // 真实条目（showTagPicker 按 id 查库）
    const card = createEntryCard(entry);
    document.body.appendChild(card);
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    await vi.advanceTimersByTimeAsync(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain('打开');
    expect(sheet.textContent).toContain('复制双链');
    expect(sheet.textContent).toContain('复制正文');
    expect(sheet.textContent).toContain('改标签');
    expect(sheet.textContent).toContain('加密');
    expect(sheet.textContent).toContain('删除');
    // 复制正文右侧小字：动态字数（次级数据）
    const copyItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('复制正文')
    ) as HTMLElement;
    const copySub = copyItem.querySelector('.bz-item-sheet-item-sub') as HTMLElement;
    expect(copySub).not.toBeNull();
    expect(copySub.textContent).toBe(`${entry.content.trim().length} 字`);
    // 头部信息区：与列表一致的 emoji + 时间 + 内容
    const head = sheet.querySelector('.bz-item-sheet-head') as HTMLElement;
    expect(head.textContent).toContain(entry.time);
    expect(head.textContent).toContain(entry.content.trim());
    // emoji 与标题行独立类（放大样式挂点：与列表头部一字不差）
    const headEmoji = head.querySelector('.bz-item-sheet-emoji') as HTMLElement;
    expect(headEmoji).not.toBeNull();
    expect(headEmoji.textContent).toBe(entry.emoji);
    const headTime = head.querySelector('.bz-item-sheet-time') as HTMLElement;
    expect(headTime).not.toBeNull();
    expect(headTime.textContent).toBe(entry.time);
    // 点「改标签」→ 标签选择器弹出（原 emoji 长按语义）
    const tagItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('改标签')
    ) as HTMLElement;
    tagItem.click();
    expect(document.getElementById('diary-tag-selector-popup')!.style.display).toBe('block');
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });

  it('长按卡片 → 抽屉点「复制正文」：写剪贴板 + 成功通知', async () => {
    MockPlatform.isMobile = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const entry = state.data.originalDiaryEntries[0];
    const card = createEntryCard(entry);
    document.body.appendChild(card);
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    await vi.advanceTimersByTimeAsync(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const copyItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('复制正文')
    ) as HTMLElement;
    copyItem.click();
    await vi.advanceTimersByTimeAsync(50);
    expect(writeSpy).toHaveBeenCalledWith(entry.content.trim());
    expect(hasNotice('已复制日记正文')).toBe(true);
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });

  it('长按卡片 → 抽屉条件显示：加密条目无「打开/复制双链/加密」，含「解密」，头部与普通一致显示明文', async () => {
    MockPlatform.isMobile = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const entry = { ...soloEntry(), id: 'enc-1', encrypted: true, noteId: 'note-1' } as any;
    const card = createEntryCard(entry);
    document.body.appendChild(card);
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    await vi.advanceTimersByTimeAsync(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    const bodyText = (sheet.querySelector('.bz-item-sheet-body') as HTMLElement).textContent!;
    // 动作区断言限定在 body（头部与普通一致显示明文，无「已加密」占位）
    expect(bodyText).not.toContain('打开');
    expect(bodyText).not.toContain('复制双链');
    expect(bodyText).not.toContain('复制正文');
    expect(bodyText).not.toContain('加密');
    expect(bodyText).toContain('解密');
    expect(bodyText).toContain('改分类');
    expect(bodyText).toContain('删除');
    // 头部：与普通条目一致渲染明文内容（解锁态明文在内存，显示与列表一字不差）
    const head = sheet.querySelector('.bz-item-sheet-head') as HTMLElement;
    expect(head.textContent).not.toContain('已加密');
    expect(head.textContent).toContain(entry.content.trim());
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });

  it('buildSheetHead：单选标签时仍显示完整 emoji 序列（列表卡片收缩、抽屉头部完整，两处解耦）', () => {
    const entry = { ...soloEntry(), id: 'test-9', tags: ['书', '电影'], emoji: '📕🎬' } as any;
    state.ui.singleSelectedTagForDisplay = '书';
    const card = createEntryCard(entry);
    expect((card.querySelector('.diary-emoji') as HTMLElement).textContent).toBe('📕'); // 列表收缩
    const head = buildSheetHead(entry);
    expect((head.querySelector('.bz-item-sheet-emoji') as HTMLElement).textContent).toBe('📕🎬'); // 抽屉完整
    state.ui.singleSelectedTagForDisplay = null;
  });

  it('抽屉加密动作：附件数小字 + 未解锁保持默认外观（无强调色 class）', async () => {
    MockPlatform.isMobile = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vault.files.set('a.png', 'x');
    state.data.originalDiaryEntries[0] = { ...soloEntry(), content: '看图 ![[a.png]]' } as any;
    const card = createEntryCard(state.data.originalDiaryEntries[0]);
    document.body.appendChild(card);
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    await vi.advanceTimersByTimeAsync(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const encItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('加密')
    ) as HTMLElement;
    expect((encItem.querySelector('.bz-item-sheet-item-sub') as HTMLElement).textContent).toBe('1 附件');
    expect(encItem.classList.contains('bz-item-sheet-item--accent')).toBe(false); // 未解锁默认外观
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });

  it('copyLink：生成双链并写剪贴板', async () => {
    const entry = state.data.originalDiaryEntries[0];
    await copyLink(entry.id!);
    expect(hasNotice(/已复制双链引用/)).toBe(true);
  });

  it('jumpToEntry：日记文件存在时 openLinkText 并隐藏弹窗', async () => {
    const entry = soloEntry();
    const openSpy = vi.spyOn(app.workspace, 'openLinkText').mockResolvedValue(undefined);
    await jumpToEntry(entry);
    expect(openSpy).toHaveBeenCalled();
  });

  it('jumpToEntry：文件不存在 → 「找不到日记文件」', async () => {
    const entry = { ...soloEntry(), filename: '2099-12-31' };
    await jumpToEntry(entry);
    expect(hasNotice('找不到日记文件')).toBe(true);
  });

  it('jumpToEntry：影视条目找不到文件 → 「找不到影视文件」', async () => {
    const entry = { ...soloEntry(), id: 'movie-1', filename: '我的/影视/不存在.md' };
    await jumpToEntry(entry);
    expect(hasNotice('找不到影视文件')).toBe(true);
  });

  it('cancelEdit：无内容元素直接返回；有元素恢复 contentEditable', () => {
    cancelEdit('nope', null);
    expect(state.ui.editingEntryId).toBeNull();
    const entry = soloEntry();
    const card = createEntryCard(entry);
    document.body.appendChild(card);
    const content = card.querySelector('.diary-entry-content') as HTMLElement;
    content.contentEditable = 'true';
    content.innerHTML = '修改中';
    state.ui.editingEntryId = entry.id;
    cancelEdit(entry.id, '原始内容');
    expect(content.contentEditable).toBe('false');
    expect(content.innerHTML).toBe('原始内容');
    expect(state.ui.editingEntryId).toBeNull();
  });

  it('insertCard：新日期创建 date-section；已有日期按时间插入', () => {
    const container = document.createElement('div');
    state.ui.scrollContainer = container;
    const entry = soloEntry();
    insertCard(entry);
    expect(container.querySelectorAll('.date-section').length).toBe(1);
    expect(container.querySelector('.diary-date-separator')!.textContent).toBe(entry.date);
    // 同日期时间更大的插到前面
    const entry2 = { ...entry, id: 'test-2', time: '23:59', timeValue: 2359 };
    insertCard(entry2);
    expect(container.querySelectorAll('.diary-entry-card').length).toBe(2);
  });

  it('removeCard：移除卡片', () => {
    const entry = soloEntry();
    const card = createEntryCard(entry);
    document.body.appendChild(card);
    removeCard(entry.id);
    expect(document.getElementById('diary-entry-test-1')).toBeNull();
  });

  it('updateSticky：无容器直接返回；有分隔符设置 sticky', () => {
    updateSticky();
    const container = document.createElement('div');
    const sep = document.createElement('div');
    sep.className = 'diary-date-separator';
    container.appendChild(sep);
    state.ui.entriesContainer = container;
    state.ui.scrollContainer = container;
    updateSticky();
    expect(sep.style.position).toBe('sticky');
  });
});

describe('dialogs 补测', () => {
  it('createTagPicker：每次重建但 DOM 唯一', () => {
    createTagPicker();
    createTagPicker();
    expect(document.querySelectorAll('#diary-tag-selector-mask').length).toBe(1);
    expect(document.getElementById('diary-tag-selector-popup')).toBeTruthy();
  });

  it('showTagPicker：entry 不存在直接返回（弹窗保持隐藏）', () => {
    createTagPicker();
    showTagPicker('nope');
    expect(document.getElementById('diary-tag-selector-popup')!.style.display).not.toBe('block');
  });

  it('showTagPicker：生成标签按钮（选中态）', () => {
    createTagPicker();
    const entry = state.data.originalDiaryEntries[0];
    showTagPicker(entry.id!);
    const popup = document.getElementById('diary-tag-selector-popup')!;
    expect(popup.style.display).toBe('block');
    expect(popup.querySelectorAll('.diary-tag-selector-btn').length).toBeGreaterThan(0);
    expect(popup.querySelectorAll('.diary-tag-selector-btn.diary-active').length).toBeGreaterThan(0);
  });

  it('updateTags：entry 不存在/标签未变直接返回', async () => {
    await updateTags('nope', []);
    const entry = state.data.originalDiaryEntries[0];
    await updateTags(entry.id!, [...entry.tags]);
    expect(getNoticeMessages().length).toBe(0);
  });

  it('updateTags：修改标签写回文件 + 卡片 emoji 更新', async () => {
    const entry = state.data.originalDiaryEntries[0];
    createTagPicker();
    const card = createEntryCard(entry);
    card.id = `diary-entry-${entry.id}`;
    document.body.appendChild(card);
    await updateTags(entry.id!, ['书']);
    expect(entry.emoji).toBe('📕');
    expect((document.querySelector(`#diary-entry-${CSS.escape(entry.id!)} .diary-emoji`) as HTMLElement).textContent).toBe('📕');
    expect(vault.files.get(`我的/日记/${entry.date}.md`)).toContain('📕');
  });

  it('createAddDialog：渲染添加弹窗 DOM + 打开显示', () => {
    createAddDialog();
    expect(document.getElementById('add-diary-mask')).toBeTruthy();
    expect(document.getElementById('add-diary-popup')).toBeTruthy();
    openAddDialog();
    expect(document.getElementById('add-diary-mask')!.style.display).toBe('block');
    expect(document.getElementById('add-diary-popup')!.style.display).toBe('block');
  });

  it('createDatePicker：渲染日期筛选弹窗结构', () => {
    createDatePicker();
    expect(document.getElementById('diary-date-filter-mask')).toBeTruthy();
    expect(document.getElementById('diary-date-filter-popup')).toBeTruthy();
    expect(document.getElementById('date-filter-content')).toBeTruthy();
  });
});

describe('datetime-picker 补测', () => {  function mountControl() {
    // init 可能已创建同名弹窗，先移除保证 id 唯一
    document.querySelectorAll('#add-diary-popup').forEach((el) => el.remove());
    const ctrl = createDateTimeControl();
    const popup = document.createElement('div');
    popup.id = 'add-diary-popup';
    popup.appendChild(ctrl);
    document.body.appendChild(popup);
    return ctrl;
  }

  it('createDateTimeControl：结构 + 默认当前时间显示', () => {
    const ctrl = mountControl();
    expect(ctrl.querySelector('#datetime-display-area')).toBeTruthy();
    expect(ctrl.querySelectorAll('.dt-part').length).toBe(5);
    const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(hidden.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('syncDateTime：隐藏输入更新各段显示', () => {
    const ctrl = mountControl();
    const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement;
    hidden.value = '2024-06-15 14:30';
    syncDateTime();
    const parts = ctrl.querySelectorAll('.dt-part');
    expect(parts[0].textContent).toBe('2024');
    expect(parts[1].textContent).toBe('06');
    expect(parts[2].textContent).toBe('15');
    expect(parts[3].textContent).toBe('14');
    expect(parts[4].textContent).toBe('30');
  });

  it('showDateTimePicker：打开滚轮选择器弹窗', () => {
    showDateTimePicker(moment('2024-06-15 14:30'), vi.fn());
    expect(document.getElementById('unified-datetime-picker-mask')).toBeTruthy();
  });
});

// ===== 修复回归（fx-diary-review） =====

describe('insertCard 真实时间源（P1-15 回归）', () => {
  it('同日内按条目数据的真实时间降序插入（不再解析 data-entry-id）', () => {
    const container = document.createElement('div');
    state.ui.scrollContainer = container;
    const mk = (id: string, time: string, tv: number) => ({ ...soloEntry(), id, time, timeValue: tv }) as any;
    const late = mk('late', '15:00', 1500);
    const early = mk('early', '09:00', 900);
    state.data.originalDiaryEntries = [late, early];
    state.data.currentFilteredEntries = [late, early];
    // 已有 15:00 卡片的日期段，插入 09:00 → 必须排在其后（旧逻辑 cardTime 恒为 '' 会插到最前）
    const section = document.createElement('div');
    section.className = 'date-section';
    const sep = document.createElement('div');
    sep.className = 'diary-date-separator';
    sep.dataset.date = early.date;
    section.appendChild(sep);
    section.appendChild(createEntryCard(late));
    container.appendChild(section);
    insertCard(early);
    let cards = section.querySelectorAll('.diary-entry-card');
    expect([cards[0].id, cards[1].id]).toEqual(['diary-entry-late', 'diary-entry-early']);
    // 再插入 12:00 → 排在 15:00 之后、09:00 之前
    const noon = mk('noon', '12:00', 1200);
    state.data.originalDiaryEntries.push(noon);
    state.data.currentFilteredEntries.push(noon);
    insertCard(noon);
    cards = section.querySelectorAll('.diary-entry-card');
    expect([cards[0].id, cards[1].id, cards[2].id]).toEqual([
      'diary-entry-late',
      'diary-entry-noon',
      'diary-entry-early',
    ]);
  });
});

describe('特殊条目动作裁剪（P1-16 回归）', () => {
  async function openSheet(entry: any) {
    MockPlatform.isMobile = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const card = createEntryCard(entry);
    document.body.appendChild(card);
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    await vi.advanceTimersByTimeAsync(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return document.querySelector('.bz-item-sheet') as HTMLElement;
  }

  function closeSheet() {
    document.querySelectorAll('.bz-item-sheet').forEach((el) => el.remove());
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  }

  it('影视卡片动作条无 删除/加密/改标签，保留 打开/复制双链/复制正文', async () => {
    const entry = { ...soloEntry(), id: 'movie-x', filename: '我的/影视/film.md' } as any;
    const sheet = await openSheet(entry);
    expect(sheet).not.toBeNull();
    const bodyText = (sheet.querySelector('.bz-item-sheet-body') as HTMLElement).textContent!;
    expect(bodyText).toContain('打开');
    expect(bodyText).toContain('复制双链');
    expect(bodyText).toContain('复制正文');
    expect(bodyText).not.toContain('改标签');
    expect(bodyText).not.toContain('加密');
    expect(bodyText).not.toContain('删除');
    closeSheet();
  });

  it('信卡片动作条同样裁剪日记专属动作', async () => {
    const entry = { ...soloEntry(), id: 'letter-x', filename: '我的/信/dear.md' } as any;
    const sheet = await openSheet(entry);
    expect(sheet).not.toBeNull();
    const bodyText = (sheet.querySelector('.bz-item-sheet-body') as HTMLElement).textContent!;
    expect(bodyText).toContain('打开');
    expect(bodyText).not.toContain('改标签');
    expect(bodyText).not.toContain('加密');
    expect(bodyText).not.toContain('删除');
    closeSheet();
  });
});

describe('letter 分流与双链路径（P2-9 回归）', () => {
  it('jumpToEntry：信条目直接 openLinkText(file.path)（无锚点）', async () => {
    vault.files.set('我的/信/hello.md', '---\ndate: 2024-01-01\n---\n正文');
    const entry = { ...soloEntry(), id: 'letter-x', filename: '我的/信/hello.md' } as any;
    const openSpy = vi.spyOn(app.workspace, 'openLinkText').mockResolvedValue(undefined);
    await jumpToEntry(entry);
    expect(openSpy).toHaveBeenCalledWith('我的/信/hello.md', '', false, { active: true });
  });

  it('jumpToEntry：信文件不存在 → 「找不到信文件」', async () => {
    const entry = { ...soloEntry(), id: 'letter-x', filename: '我的/信/gone.md' } as any;
    await jumpToEntry(entry);
    expect(hasNotice('找不到信文件')).toBe(true);
  });

  it('copyLink：特殊条目用真实路径生成双链；普通日记保持日期锚点', async () => {
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const base = state.data.originalDiaryEntries[0];
    const letter = { ...base, id: 'letter-x', filename: '我的/信/hello.md' };
    const movie = { ...base, id: 'movie-x', filename: '我的/影视/film.md' };
    state.data.originalDiaryEntries.push(letter as any, movie as any);
    await copyLink('letter-x');
    expect(writeSpy).toHaveBeenLastCalledWith('[[我的/信/hello]]');
    await copyLink('movie-x');
    expect(writeSpy).toHaveBeenLastCalledWith('[[我的/影视/film]]');
    await copyLink(base.id!);
    expect(writeSpy).toHaveBeenLastCalledWith(`[[我的/日记/${base.date}#${base.emoji} ${base.time}]]`);
  });
});

describe('renderMarkdown 兜底安全化（P2-10 回归）', () => {
  it('文件缺失分支用 textContent 渲染，不 innerHTML 注入原文', async () => {
    const entry = {
      ...soloEntry(),
      id: 'xss-1',
      filename: '2099-12-31',
      content: '<b>粗体</b><img src=x onerror="alert(1)">',
    } as any;
    const card = createEntryCard(entry);
    document.body.appendChild(card);
    await new Promise((r) => setTimeout(r, 0));
    const content = card.querySelector('.diary-entry-content') as HTMLElement;
    expect(content.querySelector('b')).toBeNull();
    expect(content.querySelector('img')).toBeNull();
    expect(content.textContent).toContain('<b>粗体</b>');
    expect(content.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});

describe('isLoadingMore 早退复位（P2-11 回归）', () => {
  it('空筛选结果早退前复位', () => {
    state.data.originalDiaryEntries = [];
    state.data.isLoadingMore = true;
    applyFilter();
    expect(state.data.isLoadingMore).toBe(false);
  });

  it('滚动加载：批次耗尽后再次滚动 isLoadingMore 复位（不卡死）', () => {
    const container = document.getElementById('__diary-entries-container__')!;
    const entry = soloEntry();
    state.data.originalDiaryEntries = [entry];
    state.data.currentFilteredEntries = [entry];
    state.data.currentDisplayCount = 0;
    container.innerHTML = '';
    state.ui.entriesContainer = container;
    state.ui.scrollContainer = null;
    initScroll();
    container.dispatchEvent(new Event('scroll'));
    expect(state.data.isLoadingMore).toBe(false); // 首批渲染完成即复位
    container.dispatchEvent(new Event('scroll')); // 批次耗尽 → 空批次早退
    expect(state.data.isLoadingMore).toBe(false); // 早退前已复位（旧逻辑卡在 true）
  });
});

