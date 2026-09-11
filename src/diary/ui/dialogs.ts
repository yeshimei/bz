/**
 * 写链路弹窗族（issue 256 随写链路迁入新 diary 域）：
 * - 写日记弹窗（openAddDialog/saveNewEntry + 滚轮日期时间控件）；
 * - 标签选择器（showTagPicker：改标签/加密条目改分类降级分流 + 删除入口）。
 * 旧编辑面板专属的日期筛选弹窗、卡片插拔/筛选刷新随域退役；
 * 数据落盘全走 ./store 写层（守卫 + 串行队列），条目定位 = filename + lineNumber；
 * 动作结果经域事件（diary:entry-added / tags-changed / entry-deleted / entry-decrypted）
 * 通知宿主（墙）与其他消费者，本模块不刷新任何列表 UI。
 */
import { MarkdownView as MarkdownViewFromObsidian, moment } from 'obsidian';
import { topifyZ } from '../../core/z-order';
import { notice } from '../../core/notice';
import { openFlowDialog } from '../../core/flow-dialog';
import { getApp } from '../../core/app';
import { tryGetSettings } from '../../core/settings-provider';
import {
  DIARY_DIRECTORY,
  getSortedTagsForAddDialog,
  getTagEmoji,
  getParentPrimaryTag,
  isSubTag,
} from '../config';
import { parseFlexibleDateTime } from '../parser';
import { addEntry, updateDiaryTags, isUnparsedRefusal } from '../store';
import { ENCRYPT_TAG, reclassifyEntry } from '../encrypt';
import { emitDomainEvent } from '../../core/domain-bus';
import { createDateTimeControl, resetDateTimeControl, setDateTimeYearRangeProvider } from './datetime-picker';
import { showConfirm } from './entry-actions';
import { buildLocatorPredicateFor } from './locator';

// ===== 类型选择按钮（写日记弹窗与标签选择器共用） =====

/** 生成类型选择按钮（emoji + 标签，二级标签附父标签 emoji 角标；写日记弹窗/选择器恒显示 emoji） */
function createTagOptionButton(tag: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'diary-tag-selector-btn';
  btn.dataset.tag = tag;
  let buttonText = `${getTagEmoji(tag)} ${tag}`;
  if (isSubTag(tag)) {
    const parentTag = getParentPrimaryTag(tag);
    if (parentTag) {
      buttonText += ` <span style="font-size: 12px;margin-left:4px;position: absolute;top: 0;right: 0;translate: 5px -5px;">${getTagEmoji(parentTag)}</span>`;
    }
  }
  btn.innerHTML = buttonText;
  btn.style.cssText = 'padding:6px 12px;border-radius:20px;background:var(--background-secondary);border:none;cursor:pointer;font-size:14px;color:var(--text-normal);position: relative;';
  return btn;
}

// ===== 标签选择器（原 2243-2430；定位 id → filename+lineNumber） =====

/** 标签选择器的定位面：宿主（墙）条目透传字段 */
export interface DiaryEntryLocator {
  /** 来源文件名（日记 = 日期字符串） */
  filename: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 时间 HH:mm */
  time: string;
  /** 在文件中的标题行号（写层稳定定位依据） */
  lineNumber: number;
  /** 当前标签数组 */
  tags: string[];
  /** 是否加密条目（改分类 = 解密降级） */
  encrypted?: boolean;
  /** 加密条目的保险箱 SafeNote id */
  noteId?: string;
}

/** 当前标签选择器绑定的条目（showTagPicker 设置，保存/删除时消费） */
let activeTagPickerLoc: DiaryEntryLocator | null = null;

export function createTagPicker() {
  const existingPopup = document.getElementById('diary-tag-selector-popup');
  const existingMask = document.getElementById('diary-tag-selector-mask');
  if (existingPopup) existingPopup.remove();
  if (existingMask) existingMask.remove();

  const mask = document.createElement('div');
  mask.id = 'diary-tag-selector-mask';
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);display:none;';
  mask.onclick = (e) => e.target === mask && (mask.style.display = 'none');

  const popup = document.createElement('div');
  popup.id = 'diary-tag-selector-popup';
  popup.className = 'diary-tag-selector-popup';
  popup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:20px;max-width:300px;width:90%;max-height:80vh;overflow-y:auto;display:none;';

  const title = document.createElement('h4');
  title.className = 'diary-tag-selector-title';
  title.textContent = '选择类型';

  // 按钮容器 - 动态生成内容，不在初始化时填充
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'diary-tag-selector-buttons';

  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'diary-tag-selector-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'diary-action-btn diary-delete-btn';
  deleteBtn.textContent = '删除';
  deleteBtn.style.cssText = 'background:var(--background-modifier-error);color:var(--background-primary);margin-right:auto;';
  deleteBtn.onclick = () => {
    const loc = activeTagPickerLoc;
    hideTagPicker();
    if (loc) showConfirm(loc);
  };

  const saveBtn = document.createElement('button');
  saveBtn.className = 'diary-action-btn diary-save-btn';
  saveBtn.textContent = '保存';
  saveBtn.onclick = () => {
    const loc = activeTagPickerLoc;
    if (!loc) {
      hideTagPicker();
      return;
    }
    const selTagNames: string[] = [];
    buttonsContainer.querySelectorAll('.diary-tag-selector-btn.diary-active').forEach((btn) => {
      selTagNames.push((btn as HTMLElement).dataset.tag!);
    });
    if (selTagNames.length === 0) {
      notice('请至少选择一个标签');
      return;
    }
    hideTagPicker();
    void handleTagPickerSave(loc, selTagNames, !!loc.encrypted);
  };

  actionsContainer.appendChild(deleteBtn);
  actionsContainer.appendChild(saveBtn);
  popup.appendChild(title);
  popup.appendChild(buttonsContainer);
  popup.appendChild(actionsContainer);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}

/** 隐藏标签选择器弹窗 */
function hideTagPicker() {
  const mask = document.getElementById('diary-tag-selector-mask');
  const popup = document.getElementById('diary-tag-selector-popup');
  if (mask) mask.style.display = 'none';
  if (popup) popup.style.display = 'none';
}

/**
 * 标签选择器「保存」分流（ADR-0017）：
 * - 加密条目的保存 = 改分类降级（reclassifyEntry），成功后 merge 回 md 并从保险箱取出，
 *   发 diary:entry-decrypted 通知宿主刷新；
 * - 非加密条目走写层 updateDiaryTags（加密入口在抽屉「加密」动作，标签选择器不提供加密分类），
 *   写盘成功由写层发 diary:tags-changed。
 */
async function handleTagPickerSave(loc: DiaryEntryLocator, selTagNames: string[], isEncryptedEntry: boolean) {
  if (isEncryptedEntry) {
    // 加密条目：改分类 = 解密降级 + 应用新标签（Q20-a）
    const proceed =
      (await openFlowDialog({
        title: '改分类',
        message: '将解密此日记并恢复为普通条目，是否继续？',
        actions: [
          { label: '取消', value: 'cancel' },
          { label: '确定', value: 'ok', cta: true },
        ],
      })) === 'ok';
    if (!proceed) return;
    if (!loc.noteId) return;
    const newTags = selTagNames.filter((t) => t !== ENCRYPT_TAG);
    const success = await reclassifyEntry(loc.noteId, selTagNames);
    if (!success) {
      notice('解密改分类失败', 'error');
      return;
    }
    // UX-8：加密条目改分类成功提示，语义同「已解密还原」
    notice('已解密还原', 'success');
    emitDomainEvent('diary:entry-decrypted', { noteId: loc.noteId, date: loc.date, newTags });
    return;
  }

  // 普通改分类（行号优先、同刻唯一兜底；定位失败告警中止，不盲写旧数据）
  const dateStr = loc.date;
  const predicate = await buildLocatorPredicateFor(dateStr, loc);
  try {
    const updated = await updateDiaryTags(dateStr, predicate, selTagNames);
    if (!updated) {
      notice('未能在日记数据中定位该条目，标签没有修改', 'error');
    }
  } catch (e) {
    if (!isUnparsedRefusal(e)) throw e;
  }
}

export function showTagPicker(loc: DiaryEntryLocator) {
  const mask = document.getElementById('diary-tag-selector-mask');
  const popup = document.getElementById('diary-tag-selector-popup');
  if (!mask || !popup) return;
  activeTagPickerLoc = loc;

  const buttonsContainer = popup.querySelector('.diary-tag-selector-buttons');
  if (!buttonsContainer) return;

  // 清空并重新生成按钮
  buttonsContainer.innerHTML = '';

  // 加密分类不在类型选择器提供（加密唯一入口 = 抽屉「加密」动作，ADR-0017）；
  // 加密条目的改分类（降级）同样不含「加密」选项
  const isEncrypted = !!loc.encrypted;
  const sortedTags = getSortedTagsForAddDialog();

  // 当前条目的标签集合（加密条目：除「加密」外的原始分类为已选项）
  const currentTagsSet = new Set(isEncrypted ? loc.tags.filter((t) => t !== ENCRYPT_TAG) : loc.tags);

  // 生成按钮
  for (const tag of sortedTags) {
    const button = createTagOptionButton(tag);

    if (currentTagsSet.has(tag)) {
      button.classList.add('diary-active');
      button.style.background = 'var(--interactive-accent)';
      button.style.color = 'var(--background-primary)';
    } else {
      button.style.background = 'var(--background-secondary)';
      button.style.color = 'var(--text-normal)';
    }

    button.onclick = (e) => {
      e.stopPropagation();
      button.classList.toggle('diary-active');
      if (button.classList.contains('diary-active')) {
        button.style.background = 'var(--interactive-accent)';
        button.style.color = 'var(--background-primary)';
      } else {
        button.style.background = 'var(--background-secondary)';
        button.style.color = 'var(--text-normal)';
      }
    };
    buttonsContainer.appendChild(button);
  }

  topifyZ(mask, popup); // ADR-0067：显示即发号
  mask.style.display = 'block';
  popup.style.display = 'block';
}

// ===== 添加日记弹窗（原 3238-3478） =====

export function createAddDialog() {
  const existingMask = document.getElementById('add-diary-mask');
  const existingPopup = document.getElementById('add-diary-popup');
  if (existingMask) existingMask.remove();
  if (existingPopup) existingPopup.remove();

  const mask = document.createElement('div');
  mask.id = 'add-diary-mask';
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);display:none;';
  mask.onclick = (e) => e.target === mask && (mask.style.display = 'none');

  const popup = document.createElement('div');
  popup.id = 'add-diary-popup';
  popup.className = 'add-diary-popup';
  popup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;display:none;';

  const title = document.createElement('h4');
  title.className = 'add-diary-title';
  title.textContent = '写日记';
  title.style.cssText = 'margin:0 0 20px 0;font-size:18px;font-weight:600;color:var(--text-normal);';

  const dateTimePicker = createDateTimeControl();

  const typeLabel = document.createElement('label');
  typeLabel.textContent = '类型';
  typeLabel.style.cssText = 'display:block;margin-bottom:6px;font-size:14px;color:var(--text-muted);font-weight:500;';

  const typeContainer = document.createElement('div');
  typeContainer.id = 'add-diary-type-container';
  typeContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;';

  // 类型按钮（排序规则与 openAddDialog 一致：主标签平铺、有二级标签的主标签展开为二级；加密分类不在此提供）
  const allTags = getSortedTagsForAddDialog();
  for (const tag of allTags) {
    const btn = createTagOptionButton(tag);
    btn.onclick = (e) => {
      e.preventDefault();
      btn.classList.toggle('diary-active');
    };
    typeContainer.appendChild(btn);
  }

  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--background-primary);cursor:pointer;font-size:14px;font-weight:500;';
  saveBtn.onclick = async () => await saveNewEntry();

  buttonsContainer.appendChild(saveBtn);

  popup.appendChild(title);
  popup.appendChild(dateTimePicker);
  popup.appendChild(typeLabel);
  popup.appendChild(typeContainer);
  popup.appendChild(buttonsContainer);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}

/** 打开添加日记弹窗（原 3348-3426）。
 * opts.yearRange：宿主（墙）注入的滚轮年份动态范围（UX-34，取自当前数据最早/最新年份）；
 * 未注入回落 1900～当前年+1。 */
export function openAddDialog(opts?: { yearRange?: { min: number; max: number } }) {
  const mask = document.getElementById('add-diary-mask');
  const popup = document.getElementById('add-diary-popup');
  if (!mask || !popup) return;

  if (opts?.yearRange) {
    const range = opts.yearRange;
    setDateTimeYearRangeProvider(() => range);
  } else {
    setDateTimeYearRangeProvider(null);
  }

  // 1. 刷新类型按钮（按排序规则）
  const typeContainer = document.getElementById('add-diary-type-container');
  if (typeContainer) {
    typeContainer.innerHTML = '';
    const sortedTags = getSortedTagsForAddDialog();
    for (const tag of sortedTags) {
      const btn = createTagOptionButton(tag);
      btn.onclick = (e) => {
        e.preventDefault();
        btn.classList.toggle('diary-active');
      };
      typeContainer.appendChild(btn);
    }

    // ----- 不预选任何标签（用户确认：默认全部加载，不选择任何标签） -----
  }

  // 2. 设置日期时间默认值
  let defaultDateStr = moment().format('YYYY-MM-DD');
  let defaultTimeStr = moment().format('HH:mm');

  if (getUseFileDateTimeSetting()) {
    const activeView = getApp().workspace.getActiveViewOfType(MarkdownViewFromObsidian) as any;
    if (activeView && activeView.file) {
      const file = activeView.file;
      if (file.path.startsWith(DIARY_DIRECTORY)) {
        const fileName = file.basename;
        if (/^\d{4}-\d{2}-\d{2}$/.test(fileName)) {
          defaultDateStr = fileName;
        }
      }
    }
  }
  // 否则保持当前时间

  const defaultDateTime = `${defaultDateStr} ${defaultTimeStr}`;
  // P1 审查修复：打开时同步重置控件内部 currentMoment（显示与滚轮起点一致）。
  // 旧路径只改 hiddenInput 显示值——控件内部时刻停在创建那天，隔天打开直接点
  // 「确定」会把日记写回旧时刻
  resetDateTimeControl(moment(defaultDateTime, 'YYYY-MM-DD HH:mm', true));
  const datetimeInput = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
  if (datetimeInput) {
    datetimeInput.value = defaultDateTime;
  }

  topifyZ(mask, popup); // ADR-0067：显示即发号
  mask.style.display = 'block';
  popup.style.display = 'block';
  setTimeout(() => datetimeInput && datetimeInput.focus(), 100);
}

/** useFileDateTime 设置读取（原 ui-settings.getUseFileDateTimeSetting；唯一存活的显示键，经设置访问器直读） */
function getUseFileDateTimeSetting(): boolean {
  const s = tryGetSettings() as Record<string, unknown>;
  return s?.useFileDateTime === true;
}

/** 保存新日记条目（原 3428-3478；面板插拔随域退役，保存成功由写层发 diary:entry-added） */
export async function saveNewEntry() {
  const datetimeInput = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
  const mask = document.getElementById('add-diary-mask');
  const popup = document.getElementById('add-diary-popup');
  if (!datetimeInput || !mask || !popup) return;

  const userInput = datetimeInput.value.trim();
  const typeContainer = document.getElementById('add-diary-type-container')!;
  const selTagNames: string[] = [];
  typeContainer.querySelectorAll('.diary-tag-selector-btn.diary-active').forEach((btn) => {
    selTagNames.push((btn as HTMLElement).dataset.tag!);
  });
  if (selTagNames.length === 0) {
    notice('请至少选择一个类型');
    return;
  }

  let targetMoment = parseFlexibleDateTime(userInput);
  if (!targetMoment || !targetMoment.isValid()) {
    notice('日期时间格式不正确');
    return;
  }

  const dateStr = targetMoment.format('YYYY-MM-DD');
  const timeStr = targetMoment.format('HH:mm');

  try {
    await addEntry(dateStr, timeStr, selTagNames, '');
    // 收紧通知（memo item-1789105697068）：保存成功结果立即可见（弹窗关、墙已刷新），不再弹成功提示
    mask.style.display = 'none';
    popup.style.display = 'none';
  } catch (error: any) {
    if (isUnparsedRefusal(error)) return; // 守卫拒写：人话通知已由写层发出
    console.error('保存日记失败:', error);
    notice('保存日记失败：' + error.message, 'error');
  }
}
