/**
 * 条目列表：筛选、渲染、卡片交互、滚动、编辑、删除确认。
 * 原脚本 1865-2578 行。
 */
import { Component, MarkdownRenderer } from 'obsidian';
import { notice } from '../../core/notice';
import { confirm } from '../../core/confirm';
import { emitDomainEvent } from '../../core/domain-bus';
import { attachItemActions, type ItemAction } from '../../core/item-actions';
import { getApp } from '../app';
import { BATCH_SIZE, DIARY_DIRECTORY, LETTER_DIRECTORY, MOVIE_DIRECTORY, getSubTagsOfPrimary, getTagEmoji } from '../config';
import { deleteEntry, refreshFile, reloadWithEncrypted } from '../store';
import { ENCRYPT_TAG, deleteEncryptedEntry, encryptEntry, isUnlocked, reclassifyEntry } from '../encrypt';
import { ensureSafeUnlocked, getSafeManager } from '../../encrypt';
import { collectNoteAttachmentPaths } from '../../encrypt/ui';
import { state } from '../state';
import type { DiaryEntry } from '../types';
import { getContentRenderModeSetting } from './ui-settings';
import { showTagPicker } from './dialogs';
import { closePanel } from './panel-close';
import { refreshSubTagsBar, updateTagCounts, updateTitleSuffix } from './filter-shared';

// ===== 渲染 markdown（原 3531-3548） =====

async function renderMarkdown(content: string, container: HTMLElement, filePath: string | null) {
  if (!content) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '';
  // P2：无文件路径或文件缺失时不再 innerHTML 原文（防注入），降级为纯文本
  if (!filePath) {
    container.textContent = content;
    return;
  }
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) {
    container.textContent = content;
    return;
  }
  await MarkdownRenderer.render(getApp(), content, container, file.path, new Component());
}

// ===== 筛选（原 1867-1952） =====

/**
 * 标签计数防抖（UX-41）：全量 O(条目×标签) 遍历在键击/联动波动下合并为一次；
 * 计时器引用挂 state，测试可清理（与 searchDebounceTimer 同款）。
 */
function scheduleTagCountUpdate(): void {
  if (state.data.tagCountTimer) return;
  state.data.tagCountTimer = setTimeout(() => {
    state.data.tagCountTimer = null;
    updateTagCounts();
  }, 200);
}

export function applyFilter(options: { skipTagCountUpdate?: boolean; skipSubBar?: boolean } = {}) {
  const { skipTagCountUpdate = false, skipSubBar = false } = options;
  let filtered = [...state.data.originalDiaryEntries];

  // 多标签筛选：对于每个选中的标签，如果是主标签且有二级标签，则匹配该主标签或其任意二级标签
  if (state.data.selectedTags.size > 0) {
    filtered = filtered.filter((entry) => {
      // 遍历选中的标签，只要满足一个即可
      for (const tag of state.data.selectedTags) {
        // 检查是否是主标签且有二级标签
        const subTags = getSubTagsOfPrimary(tag);
        if (subTags && subTags.length > 0) {
          // 主标签条件：entry包含该主标签，或者包含任意一个二级标签
          if (entry.tags.includes(tag) || entry.tags.some((t) => subTags.some((sub) => sub.tag === t))) {
            return true;
          }
        } else {
          // 普通主标签或二级标签：直接匹配
          if (entry.tags.includes(tag)) {
            return true;
          }
        }
      }
      return false;
    });
  }

  // 日期筛选
  if (state.data.currentDateFilter) {
    filtered = filtered.filter((entry) => {
      const [year, month] = entry.date.split('-');
      if (state.data.currentDateFilter!.month) {
        return year === state.data.currentDateFilter!.year && month === state.data.currentDateFilter!.month;
      }
      return year === state.data.currentDateFilter!.year;
    });
  }

  // 搜索筛选
  if (state.data.currentSearchKeyword) {
    const lowerKeyword = state.data.currentSearchKeyword.toLowerCase();
    filtered = filtered.filter((entry) => {
      return (
        entry.content.toLowerCase().includes(lowerKeyword) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(lowerKeyword)) ||
        entry.time.toLowerCase().includes(lowerKeyword) ||
        entry.date.includes(state.data.currentSearchKeyword)
      );
    });
  }

  // 更新显示用的单标签标志
  state.ui.singleSelectedTagForDisplay = state.data.selectedTags.size === 1 ? [...state.data.selectedTags][0] : null;

  state.data.currentFilteredEntries = filtered;
  state.data.currentDisplayCount = 0;
  if (state.ui.entriesContainer) {
    state.ui.entriesContainer.innerHTML = '';
    state.ui.scrollContainer = null;
  }
  renderEntries();
  updateTitleSuffix();
  // UX-41：选中标签未变的筛选（搜索等）跳过二级标签栏重建与标签全量计数
  if (!skipSubBar) refreshSubTagsBar();
  if (!skipTagCountUpdate) scheduleTagCountUpdate();
}

// ===== 标题日期后缀（原 1934-1952，经 filter-shared 桥接） =====
// （实现见 filter-shared.ts）

// ===== 渲染条目列表（原 1955-2029） =====

function renderEntries() {
  if (!state.ui.entriesContainer) {
    state.ui.entriesContainer = document.getElementById('__diary-entries-container__');
    if (!state.ui.entriesContainer) return;
  }

  if (state.data.currentDisplayCount === 0) state.ui.entriesContainer.innerHTML = '';

  if (!state.data.currentFilteredEntries || state.data.currentFilteredEntries.length === 0) {
    state.data.isLoadingMore = false; // P2：早退前复位，避免滚动加载永久卡死
    if (state.data.currentDisplayCount === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = state.data.selectedTags.size > 0 ? '没有找到匹配标签的日记内容' : '没有找到日记内容';
      emptyMessage.style.cssText = 'padding:40px;text-align:center;color:var(--text-faint);font-size:16px;';
      state.ui.entriesContainer.appendChild(emptyMessage);
    }
    return;
  }

  const startIndex = state.data.currentDisplayCount;
  const endIndex = Math.min(startIndex + BATCH_SIZE, state.data.currentFilteredEntries.length);
  const batchToShow = state.data.currentFilteredEntries.slice(startIndex, endIndex);

  if (batchToShow.length === 0) {
    state.data.isLoadingMore = false; // P2：早退前复位，避免滚动加载永久卡死
    return;
  }

  if (!state.ui.scrollContainer) {
    state.ui.scrollContainer = document.createElement('div');
    state.ui.scrollContainer.className = 'diary-scroll-container';
    // position:relative 使分区 offsetTop 相对本容器（UX-p5：置顶判定用流式位置缓存）
    state.ui.scrollContainer.style.cssText = 'padding:0 20px;position:relative;';
    state.ui.entriesContainer.appendChild(state.ui.scrollContainer);
    sectionTopCache = [];
    sectionTopCacheOwner = null;
  }

  let lastDate: string | null = null;
  let dateSection: HTMLElement | null = null;
  // UX-p5：本次批次新渲染的分区，流式位置增量入缓存（不重读既有分区）
  const appendedSections: HTMLElement[] = [];

  batchToShow.forEach((entry) => {
    if (entry.date !== lastDate) {
      dateSection = document.createElement('div');
      dateSection.className = 'date-section';
      dateSection.style.cssText = 'position:relative;';

      const dateSeparator = document.createElement('div');
      dateSeparator.className = 'diary-date-separator';
      dateSeparator.dataset.date = entry.date;
      dateSeparator.style.cssText = 'position:sticky;top:0;z-index:10;padding:10px 12px;background:var(--background-primary);color:var(--text-normal);font-weight:600;font-size:18px;';
      dateSeparator.textContent = entry.date;

      dateSection.appendChild(dateSeparator);
      state.ui.scrollContainer!.appendChild(dateSection);
      appendedSections.push(dateSection);
      lastDate = entry.date;
    }

    const entryCard = createEntryCard(entry);
    if (dateSection) dateSection.appendChild(entryCard);
    else state.ui.scrollContainer!.appendChild(entryCard);
  });

  state.data.currentDisplayCount = endIndex;

  // UX-p5：新分区流式位置增量入缓存（offsetTop 相对滚动容器，无逐项布局读取于滚动路径）
  for (const section of appendedSections) {
    sectionTopCache.push({ section, top: section.offsetTop });
  }
  sectionTopCacheOwner = state.ui.scrollContainer;

  if (state.data.currentDisplayCount >= state.data.currentFilteredEntries.length) {
    const allLoaded = document.createElement('div');
    allLoaded.className = 'all-loaded-hint';
    allLoaded.textContent = '已显示所有日记';
    allLoaded.style.cssText = 'text-align:center;color:var(--text-faint);padding:20px;font-size:14px;';
    state.ui.scrollContainer.appendChild(allLoaded);
  }

  state.data.isLoadingMore = false;
}


// ===== 条目卡片（原 2032-2098） =====

/** 显示的 emoji 序列：单选标签时只显示选中标签的 emoji（列表卡片专用；抽屉头部用 entry.emoji 完整序列） */
function getDisplayEmojiSeq(entry: DiaryEntry): string {
  if (state.ui.singleSelectedTagForDisplay && entry.tags.includes(state.ui.singleSelectedTagForDisplay)) {
    return getTagEmoji(state.ui.singleSelectedTagForDisplay);
  }
  return entry.tags.map((tag) => getTagEmoji(tag)).join('');
}

/**
 * 条目附件数量：
 * - 普通条目：正文里图片/视频引用计数（与加密时收集附件同源，正则为主）；
 * - 加密条目：保险箱清单里该 note 的附件数（还原时一并放回）。
 */
function getEntryAttachmentCount(entry: DiaryEntry): number {
  if (entry.encrypted) {
    try {
      const note = getSafeManager().manifest?.notes.find((n) => n.id === entry.noteId);
      return note ? note.attachments.length : 0;
    } catch (e) {
      return 0; // 降级链：保险箱未初始化/设置未注入视为无附件
    }
  }
  const datePath = `${DIARY_DIRECTORY}/${entry.date}.md`;
  return collectNoteAttachmentPaths(getApp(), datePath, entry.content || '').length;
}

/** 特殊条目（影视/信）：id 前缀 movie-/letter- 或来源文件路径含目录（P1-16/P2-9 分流共用） */
export function isSpecialEntry(entry: DiaryEntry): boolean {
  return (
    (!!entry.id && (entry.id.startsWith('movie-') || entry.id.startsWith('letter-'))) ||
    (!!entry.filename && entry.filename.includes('/'))
  );
}

/**
 * 抽屉顶部信息区：与列表卡片一致的 emoji + 时间 + 内容（同渲染路径）。
 * 差异化：emoji 始终显示完整序列（entry.emoji），不随列表单选标签收缩。
 * 加密条目（解锁态，明文已在内存）与普通条目显示完全一致；
 * 「隐藏」由未解锁完全不可见兜底（ADR-0017：密文绝不进列表，解锁后才解密进内存）。
 */
export function buildSheetHead(entry: DiaryEntry): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-item-sheet-entry';

  const infoRow = document.createElement('div');
  infoRow.className = 'bz-item-sheet-entry-info';
  const emoji = document.createElement('span');
  emoji.className = 'bz-item-sheet-emoji'; // 与列表头部一致：20px 独立 span
  emoji.textContent = entry.emoji; // 完整序列（所有标签图标），与列表收缩逻辑解耦
  infoRow.appendChild(emoji);
  const timeSpan = document.createElement('span');
  timeSpan.className = 'bz-item-sheet-time'; // 与列表头部一致：16px 加粗
  timeSpan.textContent = entry.time;
  infoRow.appendChild(timeSpan);
  head.appendChild(infoRow);

  const content = document.createElement('div');
  content.className = 'bz-item-sheet-entry-content';
  const contentText = entry.content.trim();
  content.textContent = contentText; // 先给纯文本兜底，再按渲染模式渲染（与列表一致）
  if (getContentRenderModeSetting() === 'markdown') {
    const filePath = entry.filename.includes('/') ? entry.filename : `${DIARY_DIRECTORY}/${entry.filename}.md`;
    void renderMarkdown(contentText, content, filePath);
  }
  head.appendChild(content);
  return head;
}

export function createEntryCard(entry: DiaryEntry) {
  const entryCard = document.createElement('div');
  entryCard.className = 'diary-entry-card';
  entryCard.id = `diary-entry-${entry.id}`;
  entryCard.style.cssText = 'border:1px solid var(--background-modifier-border);border-radius:12px;padding:20px;background:var(--background-primary);margin:20px 0;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';

  const timeInfo = document.createElement('div');
  timeInfo.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'diary-emoji';
  emojiSpan.dataset.entryId = entry.id;
  emojiSpan.textContent = getDisplayEmojiSeq(entry);
  emojiSpan.style.cssText = 'font-size:20px;cursor:pointer;user-select:none;';

  // emoji 单击 = 标签选择器（高频习惯保留）；长按收敛到抽屉「改标签」
  emojiSpan.addEventListener('click', (e) => {
    e.stopPropagation();
    showTagPicker(entry.id!);
  });

  const timeSpan = document.createElement('span');
  timeSpan.style.cssText = 'font-weight:600;color:var(--text-normal);font-size:16px;';
  timeSpan.textContent = entry.time;

  timeInfo.appendChild(emojiSpan);
  timeInfo.appendChild(timeSpan);
  header.appendChild(timeInfo);

  const content = document.createElement('div');
  content.className = 'diary-entry-content';
  content.dataset.entryId = entry.id;
  content.style.cssText = 'color:var(--text-normal);line-height:1.6;white-space:normal;font-size:15px;margin-bottom:12px;padding:8px;border-radius:4px;min-height:50px;cursor:text;';

  let lastClickTime = 0;
  content.addEventListener('click', async (e) => {
    // 加密条目不跳 md（无锚点），正文即预览（用户决策：无需预览窗），点击无操作
    if (entry.encrypted) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTime;
    if (timeDiff < 300 && timeDiff > 0) {
      e.stopPropagation();
      e.preventDefault();
      await jumpToEntry(entry);
    }
    lastClickTime = currentTime;
  });

  const contentText = entry.content.trim();
  let filePath = entry.filename.includes('/') ? entry.filename : `${DIARY_DIRECTORY}/${entry.filename}.md`;
  // 内容渲染方式：markdown（默认）/ plain（纯文本，设置项 diaryContentRenderMode）
  if (getContentRenderModeSetting() === 'plain') {
    content.textContent = contentText;
  } else {
    renderMarkdown(contentText, content, filePath);
  }

  entryCard.appendChild(header);
  entryCard.appendChild(content);

  // 统一操作条/长按浮层（手势统一）：
  // 非加密：打开 > 复制双链 > 复制正文 > 改标签 > 加密 > 删除；加密：解密 > 改分类 > 删除
  // 加密/解密：小字只带附件数（无附件不显示），已解锁时图标+小字换强调色（未解锁保持默认外观）
  // P1-16：影视/信等特殊条目无日记专属动作（改标签/加密/删除），保留 打开/双击/复制双链/复制正文
  const special = isSpecialEntry(entry);
  const actions: ItemAction[] = [];
  if (!entry.encrypted) {
    actions.push({ icon: 'external-link', label: '打开', title: '打开原文', onClick: () => void jumpToEntry(entry) });
    actions.push({ icon: 'link', label: '复制双链', title: '复制双链', onClick: () => void copyLink(entry.id!) });
    actions.push({
      icon: 'copy',
      label: '复制正文',
      title: '复制正文',
      sub: `${entry.content.trim().length} 字`,
      onClick: () => void copyEntryContent(entry.id!),
    });
    if (!special) {
      actions.push({ icon: 'tag', label: '改标签', title: '改标签', onClick: () => showTagPicker(entry.id!) });
      const attCount = getEntryAttachmentCount(entry);
      actions.push({
        icon: 'lock',
        label: '加密',
        title: '加密（移入保险箱）',
        sub: attCount > 0 ? `${attCount} 附件` : undefined,
        tone: isUnlocked() ? 'accent' : undefined,
        onClick: () => void encryptFromSheet(entry.id!),
      });
    }
  } else {
    const attCount = getEntryAttachmentCount(entry);
    actions.push({
      icon: 'unlock',
      label: '解密',
      title: '解密还原',
      sub: attCount > 0 ? `${attCount} 附件` : undefined,
      tone: isUnlocked() ? 'accent' : undefined,
      onClick: () => void decryptFromSheet(entry.id!),
    });
    actions.push({ icon: 'tag', label: '改分类', title: '改分类（解密）', onClick: () => showTagPicker(entry.id!) });
  }
  if (!special) {
    actions.push({
      icon: 'trash-2',
      label: '删除',
      title: '删除',
      kind: 'danger',
      onClick: () => showConfirm(entry.id!),
    });
  }
  attachItemActions(entryCard, actions, { sheetHead: buildSheetHead(entry) });

  return entryCard;
}

// ===== 跳转（原 2100-2137） =====

export async function jumpToEntry(entry: DiaryEntry, mode: 'select' | 'edit' = 'select') {
  // 判断是否为影视条目（id 以 movie- 开头 或 filename 包含 MOVIE_DIRECTORY）
  const isMovieEntry =
    (entry.id && entry.id.startsWith('movie-')) || (entry.filename && entry.filename.startsWith(MOVIE_DIRECTORY));
  if (isMovieEntry) {
    // 直接打开影视文件
    const file = getApp().vault.getAbstractFileByPath(entry.filename) as any;
    if (!file) {
      notice('找不到影视文件');
      return;
    }
    await getApp().workspace.openLinkText(file.path, '', false, { active: true });
    // UX-25：与遮罩/ESC 同路径关闭（关面板即锁保险箱）；保持「先跳原文后隐藏」顺序
    closePanel();
    return;
  }

  // P2-9：信条目分流——整文件即条目，直接打开原文件（无标题锚点可跳）
  const isLetterEntry =
    (entry.id && entry.id.startsWith('letter-')) || (entry.filename && entry.filename.startsWith(LETTER_DIRECTORY));
  if (isLetterEntry) {
    const file = getApp().vault.getAbstractFileByPath(entry.filename) as any;
    if (!file) {
      notice('找不到信文件');
      return;
    }
    await getApp().workspace.openLinkText(file.path, '', false, { active: true });
    closePanel();
    return;
  }

  // 处理普通日记条目
  const fileName = entry.filename; // 日期字符串，不含扩展名
  const filePath = `${DIARY_DIRECTORY}/${fileName}.md`;
  const anchor = `${entry.emoji} ${entry.time}`; // 例如 "📖 14:30"
  const link = `${DIARY_DIRECTORY}/${fileName}#${anchor}`;

  // 检查文件是否存在
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) {
    notice('找不到日记文件');
    return;
  }

  // 打开文件并滚动到对应的标题位置
  await getApp().workspace.openLinkText(link, '', false, { active: true });

  // 关闭日记本弹窗（UX-25：统一 closePanel 路径）
  closePanel();
}

// ===== 复制双链（原 2209-2215） =====

export async function copyLink(entryId: string) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) return;
  // P2-9：影视/信条目用真实文件路径生成双链（无日记标题锚点）；普通日记保持 日期文件#标题 锚点
  const link = isSpecialEntry(entry)
    ? `[[${entry.filename.replace(/\.md$/, '')}]]`
    : `[[${DIARY_DIRECTORY}/${entry.filename}#${entry.emoji} ${entry.time}]]`;
  await navigator.clipboard.writeText(link);
  notice(`已复制双链引用：${link}`, 'success');
}

// ===== 复制正文（抽屉动作：主动复制，与列表禁选字不冲突） =====

async function copyEntryContent(entryId: string) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) return;
  await navigator.clipboard.writeText(entry.content.trim());
  notice('已复制日记正文', 'success');
}

// ===== 加密（抽屉直通；与标签选择器加密同一流程：解锁 → 确认 → 入库 → 摘除原块） =====

async function encryptFromSheet(entryId: string) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry || entry.encrypted) return;
  try {
    const unlocked = await ensureSafeUnlocked();
    if (!unlocked) return;
    // 保险箱弹窗解锁不触发 onUnlockChange：解锁成功后手动重并，保险箱里已有的加密日记立即注入列表
    //（与筛选栏「加密」标签解锁路径同策略；幂等，重复并只保留一次）
    await reloadWithEncrypted();
    const proceed = await new Promise<boolean>((resolve) => {
      confirm({
        title: '加密日记',
        message: '确定将本条内容加密移出笔记？正文将从日记文件移除',
        confirmText: '加密',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!proceed) return;
    const enc = await encryptEntry(entry);
    if (enc) {
      // 从 md 摘除原普通块（encryptEntry 不删整 md，块级移除由日记域处理）→ 重并加密版
      if (entry.id) await deleteEntry(entry.id);
      await reloadWithEncrypted();
      // 动作埋点：加密移入保险箱成功（本期无消费者，emit 即可）
      emitDomainEvent('diary:entry-encrypted', { entryId, date: entry.date, time: entry.time });
      notice('已加密移入保险箱', 'success');
    }
  } catch (e: any) {
    notice('加密失败：' + (e?.message || e), 'error');
  }
}

// ===== 解密还原（去掉加密标签重建标题：🔐 不残留；密文取出即删，ADR-0017） =====

async function decryptFromSheet(entryId: string) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry || !entry.encrypted || !entry.noteId) return;
  const proceed = await new Promise<boolean>((resolve) => {
    confirm({
      title: '解密日记',
      message: '解密此日记并恢复为普通类型（确定）？',
      confirmText: '解密',
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
  if (!proceed) return;
  try {
    const newTags = entry.tags.filter((t) => t !== ENCRYPT_TAG);
    const ok = await reclassifyEntry(entry.noteId, newTags);
    if (!ok) {
      notice('解密失败', 'error');
      return;
    }
    // 主动重读该日期文件（还原块已在 md 内）：不依赖文件监听事件，还原条目立即进列表
    //（refreshFile 内含重并其余加密条目 + 全量刷新，与事件路径幂等）
    await refreshFile(`${DIARY_DIRECTORY}/${entry.date}.md`);
    // 动作埋点：解密还原成功（本期无消费者，emit 即可）
    emitDomainEvent('diary:entry-decrypted', { noteId: entry.noteId, date: entry.date, newTags });
    notice('已解密还原', 'success');
  } catch (e) {
    notice('解密失败', 'error');
  }
}

// ===== 取消编辑（原 2218-2240） =====

export function cancelEdit(entryId: string, originalHTML: string | null) {
  const contentElement = document.querySelector(
    `.diary-entry-content[data-entry-id="${entryId}"]`
  ) as HTMLElement | null;
  if (!contentElement) return;
  contentElement.contentEditable = 'false';
  contentElement.classList.remove('diary-editing');
  contentElement.style.touchAction = '';
  if (originalHTML) contentElement.innerHTML = originalHTML;
  else {
    const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
    if (entry) {
      const filePath = `${DIARY_DIRECTORY}/${entry.filename}.md`;
      // 退出编辑还原：跟随内容渲染方式设置
      if (getContentRenderModeSetting() === 'plain') {
        contentElement.textContent = entry.content.trim();
      } else {
        renderMarkdown(entry.content.trim(), contentElement, filePath);
      }
    }
  }
  if ((contentElement as any)._editHandlers) {
    contentElement.removeEventListener('keydown', (contentElement as any)._editHandlers.keydown);
    delete (contentElement as any)._editHandlers;
  }
  const actionsContainer = contentElement.nextElementSibling;
  if (actionsContainer && actionsContainer.classList.contains('diary-edit-actions')) actionsContainer.remove();
  if (state.ui.editingEntryId === entryId) state.ui.editingEntryId = null;
}

// ===== 删除确认（原 2509-2523） =====

export function showConfirm(entryId: string) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  const isEncrypted = !!entry?.encrypted;
  const hidePickers = () => {
    const tagSelectorMask = document.getElementById('diary-tag-selector-mask');
    const tagSelectorPopup = document.getElementById('diary-tag-selector-popup');
    if (tagSelectorMask) tagSelectorMask.style.display = 'none';
    if (tagSelectorPopup) tagSelectorPopup.style.display = 'none';
  };
  confirm({
    title: '确认删除',
    message: isEncrypted
      ? '确定删除这篇加密日记吗？\n\n此操作不可撤销，密文将从保险箱永久销毁。'
      : '确定要删除这篇日记吗？\n\n此操作不可撤销，日记将从笔记中永久删除。',
    confirmText: '删除日记',
    onConfirm: async () => {
      if (isEncrypted && entry && entry.noteId) {
        // 加密条目：永久删除保险箱密文（ADR-0017）
        await deleteEncryptedEntry(entry.noteId);
        await reloadWithEncrypted();
        // 动作埋点：加密日记密文销毁（本期无消费者，emit 即可）
        emitDomainEvent('diary:encrypted-purged', { noteId: entry.noteId });
      } else {
        await deleteEntry(entryId);
        // 动作埋点：普通条目删除意图（结构性事实 file-vacated 由 store 在整文件删除时另发）
        if (entry) emitDomainEvent('diary:entry-deleted', { date: entry.date, time: entry.time, wasEncrypted: false });
      }
      notice('日记条目已删除', 'success');
      hidePickers();
    },
  });
}

// ===== 移除卡片（原 2571-2575） =====

export function removeCard(entryId: string) {
  const card = document.getElementById(`diary-entry-${entryId}`);
  if (card) card.remove();
  // UX-p5：分区内减卡（改分类移除/删除卡片）会令后续分区的流式位置变化 → 全量重建缓存
  if (state.ui.scrollContainer) rebuildSectionTopCache();
}

// ===== 插入卡片（原 2577-2624） =====

export function insertCard(entry: DiaryEntry) {
  if (!state.ui.scrollContainer) return;
  const entryCard = createEntryCard(entry);
  const dateSections = state.ui.scrollContainer.querySelectorAll('.date-section');
  let targetSection: HTMLElement | null = null;
  for (const section of dateSections as any) {
    const sep = section.querySelector('.diary-date-separator');
    if (sep && sep.dataset.date === entry.date) {
      targetSection = section;
      break;
    }
  }
  if (targetSection) {
    const cards = targetSection.querySelectorAll('.diary-entry-card');
    let inserted = false;
    for (let i = 0; i < cards.length; i++) {
      // P1-15：时间比较用条目数据的真实时间源（卡片 id → 数据条目），不再错误解析 data-entry-id 六段式
      const cardId = (cards[i] as HTMLElement).id.replace(/^diary-entry-/, '');
      const existing =
        state.data.currentFilteredEntries.find((e) => e.id === cardId) ??
        state.data.originalDiaryEntries.find((e) => e.id === cardId);
      if (existing && entry.timeValue > existing.timeValue) {
        targetSection.insertBefore(entryCard, cards[i]);
        inserted = true;
        break;
      }
    }
    if (!inserted) targetSection.appendChild(entryCard);
  } else {
    const newSection = document.createElement('div');
    newSection.className = 'date-section';
    newSection.style.cssText = 'position:relative;margin-top:20px;';
    const dateSeparator = document.createElement('div');
    dateSeparator.className = 'diary-date-separator';
    dateSeparator.dataset.date = entry.date;
    dateSeparator.style.cssText = 'position:sticky;top:0;z-index:10;padding:12px 0;background:var(--background-primary);color:var(--text-normal);font-weight:600;font-size:18px;';
    dateSeparator.textContent = entry.date;
    newSection.appendChild(dateSeparator);
    newSection.appendChild(entryCard);
    let inserted = false;
    const sections = state.ui.scrollContainer.querySelectorAll('.date-section');
    for (let i = 0; i < sections.length; i++) {
      const sep = (sections[i] as HTMLElement).querySelector('.diary-date-separator');
      if (sep && ((sep as HTMLElement).dataset.date ?? '') < entry.date) {
        state.ui.scrollContainer.insertBefore(newSection, sections[i]);
        inserted = true;
        break;
      }
    }
    if (!inserted) state.ui.scrollContainer.appendChild(newSection);
  }
  // UX-p5：既有分区插卡与新增分区都会推移后续分区的流式位置 → 全量重建缓存
  rebuildSectionTopCache();
}

// ===== 滚动与粘性（原 2434-2505；UX-p5：置顶分隔符判定改缓存二分，滚动路径零布局读取） =====

/** 分区流式位置缓存条目：offsetTop 相对滚动容器（position:relative），滚动时恒定 */
interface SectionTopEntry {
  section: HTMLElement;
  top: number;
}

let sectionTopCache: SectionTopEntry[] = [];
/** 缓存归属的滚动容器：换容器（重渲染/测试换手）即失效，防误用旧布局数据 */
let sectionTopCacheOwner: HTMLElement | null = null;
let currentStickyEl: HTMLElement | null = null;

/** 全量重建分区位置缓存（中部插段等偏移变化场景；渲染批次走增量 append） */
function rebuildSectionTopCache(): void {
  sectionTopCache = [];
  const container = state.ui.scrollContainer;
  if (!container) {
    sectionTopCacheOwner = null;
    return;
  }
  const sections = container.querySelectorAll('.date-section');
  for (const s of Array.from(sections)) {
    sectionTopCache.push({ section: s as HTMLElement, top: (s as HTMLElement).offsetTop });
  }
  sectionTopCacheOwner = container;
}

export function initScroll() {
  if (!state.ui.entriesContainer)
    state.ui.entriesContainer = document.getElementById('__diary-entries-container__');
  state.ui.entriesContainer!.addEventListener('scroll', () => {
    if (state.data.isLoadingMore) return;
    const scrollTop = state.ui.entriesContainer!.scrollTop;
    const scrollHeight = state.ui.entriesContainer!.scrollHeight;
    const clientHeight = state.ui.entriesContainer!.clientHeight;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      state.data.isLoadingMore = true;
      renderEntries();
    }
    updateSticky();
  });
  setTimeout(updateSticky, 100);
}

export function updateSticky() {
  if (!state.ui.entriesContainer || !state.ui.scrollContainer) return;
  // 缓存为空/归属容器已换/指向已卸载分区（全量重渲染后）→ 重建；否则直接用流式位置，不读布局
  const cached = sectionTopCache;
  if (cached.length === 0 || sectionTopCacheOwner !== state.ui.scrollContainer || !cached[0]?.section.isConnected) {
    rebuildSectionTopCache();
  }
  const sectionTops = sectionTopCache;
  if (sectionTops.length === 0) return;

  const scrollTop = state.ui.entriesContainer.scrollTop;
  // 二分定位最后一个 flow top ≤ scrollTop+5 的分区 = 当前置顶分区（纯 JS 计算）
  let lo = 0;
  let hi = sectionTops.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sectionTops[mid].top <= scrollTop + 5) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  let next: HTMLElement | null = null;
  if (best !== -1) {
    next = sectionTops[best].section.querySelector('.diary-date-separator') as HTMLElement | null;
  }
  if (currentStickyEl === next) return;
  // 增量升降：仅切换置顶分隔符的 zIndex（sticky 基础样式由渲染期一次设定）
  if (currentStickyEl) currentStickyEl.style.zIndex = '10';
  if (next) next.style.zIndex = '20';
  currentStickyEl = next;
}
