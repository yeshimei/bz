/**
 * 写链路弹窗族（issue 256 随写链路迁入新 diary 域；一致#2 收编 core uiModal 壳）：
 * - 写日记弹窗（openAddDialog/saveNewEntry + 滚轮日期时间控件）；
 * - 标签选择器（showTagPicker：改标签/加密条目改分类降级分流 + 删除入口）。
 * 两浮层统一走 core uiModal 壳（ADR-0125 浮层唯一壳）：遮罩/圆角/阴影 token、
 * ESC 层（壳自带 'bz-modal'）、焦点圈闭与还原、requestClose 关闭意图钩子均由壳承载。
 * D-UI2 三件套：ESC/遮罩关闭走脏表单分流（已选标签非空或日期偏离默认 → core
 * confirmDiscard，无输入直接收），写日记弹窗补「取消」按钮承接显式退出；
 * close 时壳自摘 mask 并成对注销 ESC 层（hide 兜底不再依赖 ui.ts）。
 * 表单回车提交走 core bindFormSubmit（效率#2）；标签过滤 + 频次前置 + sticky 底栏
 * 见效率#1（写弹窗与选择器一处数据源两处受益）。
 * 旧 createAddDialog/createTagPicker 预构建入口保留为兼容空操作（index.ts
 * ensureDiary 契约），弹窗改「按需构建、开即建关即拆」；遗留 mask/popup id 保留在
 * 壳上——main.ts/index.ts 卸载兜底按 id 摘除（D15）不受影响。
 * 数据落盘全走 ./store 写层（守卫 + 串行队列），条目定位 = filePath + time；
 * 动作结果经域事件（diary:entry-added / tags-changed / entry-decrypted）
 * 通知宿主（墙）与其他消费者，本模块不刷新任何列表 UI。
 */
import { MarkdownView as MarkdownViewFromObsidian, moment } from 'obsidian';
import { notice, notifySaveError } from '../../core/notice';
import { openFlowDialog, confirmDiscard } from '../../core/flow-dialog';
import { getApp } from '../../core/app';
import { tryGetSettings } from '../../core/settings-provider';
import { diaryDateFromEntryPath } from '../../core/diary-format';
import { localDayKey } from '../../core/utils';
import { emitDomainEvent, onDomainEvent } from '../../core/domain-bus';
import { uiModal, bindFormSubmit } from '../../core/ui/modal';
import { uiSearch } from '../../core/ui/search';
import { uiBtn } from '../../core/ui/button';
import {
  DIARY_DIRECTORY,
  getSortedTagsForAddDialog,
  getTagEmoji,
  getParentPrimaryTag,
  isSubTag,
} from '../config';
import { parseFlexibleDateTime } from '../parser';
import { addEntry, updateDiaryTags, isUnparsedRefusal, isDiaryReadFailure } from '../store';
import { ENCRYPT_TAG, reclassifyEntry } from '../encrypt';
import { createDateTimeControl, resetDateTimeControl, setDateTimeYearRangeProvider } from './datetime-picker';
import { jumpToDiaryEntry, showConfirm } from './entry-actions';
import { buildLocatorPredicateFor } from './locator';

/** 放弃确认框的域皮（与两浮层同皮，issue 291 先例） */
const DIARY_FLOW_SKIN = 'bz-diary-flow-dialog';

// ===== 标签使用频次（效率#1：chip 按使用频次前置，纯前端排序，无历史保持原序） =====

const tagUsageCount = new Map<string, number>();
onDomainEvent<{ tags?: string[] }>('diary:entry-added', (evt) => {
  for (const t of evt?.tags ?? []) tagUsageCount.set(t, (tagUsageCount.get(t) ?? 0) + 1);
});

/** 使用频次降序稳定排序（次数相同 / 无历史保持传入原序） */
function sortTagsByUsage(tags: string[]): string[] {
  return tags
    .map((tag, idx) => ({ tag, idx, count: tagUsageCount.get(tag) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.idx - b.idx)
    .map((x) => x.tag);
}

/** 清空标签使用频次统计（测试/重置入口） */
export function resetTagUsageStats(): void {
  tagUsageCount.clear();
}

// ===== 类型选择按钮（写日记弹窗与标签选择器共用） =====

/** 生成类型选择按钮（emoji + 标签，二级标签附父标签 emoji 角标；写日记弹窗/选择器恒显示 emoji）。
 * D-UI11：标签名/emoji 走 textContent + createElement 拼装（标签配置含 HTML 片段时字面显示）；
 * D-UI15：挂 bz-touch-target--xl（coarse 下 ::after 外扩热区，视觉不变），尺寸样式收
 * src/diary/styles.css（不再内联 cssText）。 */
function createTagOptionButton(tag: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'diary-tag-selector-btn bz-diary-tag-chip bz-touch-target--xl';
  btn.dataset.tag = tag;
  btn.appendChild(document.createTextNode(`${getTagEmoji(tag)} ${tag}`));
  if (isSubTag(tag)) {
    const parentTag = getParentPrimaryTag(tag);
    if (parentTag) {
      const badge = document.createElement('span');
      badge.className = 'bz-diary-tag-badge';
      badge.textContent = getTagEmoji(parentTag);
      btn.appendChild(badge);
    }
  }
  return btn;
}

/** 重建类型按钮组（效率#1：频次前置由调用方排好传入；selected 命中即选中态；点击切换纯 class，配色走 CSS） */
function renderTagOptions(container: HTMLElement, tags: string[], selected: Set<string>): void {
  container.innerHTML = '';
  for (const tag of tags) {
    const btn = createTagOptionButton(tag);
    if (selected.has(tag)) btn.classList.add('diary-active');
    btn.onclick = (e) => {
      e.preventDefault();
      btn.classList.toggle('diary-active');
    };
    container.appendChild(btn);
  }
}

/** 标签过滤输入框（效率#1：复用 core uiSearch 形制，输入即筛 chip）。
 * 过滤框标 data-bz-no-form-submit：回车只筛不提交（bindFormSubmit 豁免）。 */
function createTagFilter(chipsContainer: HTMLElement): HTMLDivElement {
  const { el, input } = uiSearch({ placeholder: '筛选类型' });
  input.dataset.bzNoFormSubmit = '';
  el.classList.add('bz-diary-tag-filter');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    chipsContainer.querySelectorAll<HTMLElement>('.diary-tag-selector-btn').forEach((btn) => {
      const tag = btn.dataset.tag ?? '';
      btn.style.display = !q || tag.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  return el;
}

/** 收集当前选中的标签名（保存与脏检测共用；顺序随 chip DOM 序） */
function collectSelectedTags(container: HTMLElement): string[] {
  const names: string[] = [];
  container.querySelectorAll('.diary-tag-selector-btn.diary-active').forEach((btn) => {
    names.push((btn as HTMLElement).dataset.tag!);
  });
  return names;
}

// ===== 标签选择器（原 2243-2430；定位 id → filePath+time） =====

/** 标签选择器的定位面：宿主（墙）条目透传字段 */
export interface DiaryEntryLocator {
  /** 来源文件名（日记 = 日期字符串） */
  filename: string;
  /** 来源文件完整 vault 路径（子目录日期文件必带；D2：写层按路径定位，不平面误写顶层同名文件） */
  filePath?: string;
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
/** 当前选择器壳（uiModal 产物；close = 摘 mask + 注销 ESC 层 + 还原焦点） */
let tagPickerUi: { mask: HTMLElement; popup: HTMLElement; close: () => void } | null = null;
/** 选择器「保存」钮（效率#3：保存进行中禁用 + 文案） */
let tagPickerSaveBtn: HTMLButtonElement | null = null;
/** 保存进行中标志（防连点；updateDiaryTags 幂等，但禁用态给慢盘窗口以反馈） */
let savingTagPicker = false;

/** 兼容入口（index.ts ensureDiary 预构建契约）：迁 uiModal 壳后弹窗按需构建，此处为空操作 */
export function createTagPicker(): void {}

/** 当前条目的原始标签集（加密条目剔除「加密」；脏检测基准） */
function tagPickerOriginalTags(loc: DiaryEntryLocator): Set<string> {
  return new Set(loc.encrypted ? loc.tags.filter((t) => t !== ENCRYPT_TAG) : loc.tags);
}

/** 脏检测（D-UI2）：选中集 ≠ 条目原标签集 = 有未保存改动 */
function tagPickerDirty(): boolean {
  const popup = document.getElementById('diary-tag-selector-popup');
  const loc = activeTagPickerLoc;
  if (!popup || !loc) return false;
  const sel = new Set(collectSelectedTags(popup));
  const orig = tagPickerOriginalTags(loc);
  if (sel.size !== orig.size) return true;
  for (const t of sel) if (!orig.has(t)) return true;
  return false;
}

/** 收壳：uiModal close 自会摘 mask、注销 ESC 层、还原焦点 */
function closeTagPicker(): void {
  tagPickerUi?.close();
  tagPickerUi = null;
  tagPickerSaveBtn = null;
}

/** 隐藏标签选择器（导出：宿主上锁归位 relock 等兜底可调用，收掉 body 级选择器） */
export function hideTagPicker(): void {
  closeTagPicker();
}

/** 关闭意图分流（D-UI2）：有未保存改动走 confirmDiscard，无改动直接收 */
function requestCloseTagPicker(): void {
  if (tagPickerDirty()) confirmDiscard(closeTagPicker, undefined, DIARY_FLOW_SKIN);
  else closeTagPicker();
}

function setTagPickerSavingUi(saving: boolean): void {
  const btn = tagPickerSaveBtn;
  if (!btn) return;
  btn.disabled = saving;
  const label = btn.querySelector('span') ?? btn;
  label.textContent = saving ? '保存中…' : '保存';
}

/** 选择器「保存」（效率#3）：收集选中 → 校验 → 写盘期间禁用防连点 → 成功才收壳
 * （失败留弹窗可重试/取消；守卫静默口径同原行为）。 */
async function commitTagPickerSave(): Promise<void> {
  const loc = activeTagPickerLoc;
  if (!loc) {
    closeTagPicker();
    return;
  }
  if (savingTagPicker) return; // 上一笔仍在写盘
  const popup = document.getElementById('diary-tag-selector-popup');
  if (!popup) return;
  const selTagNames = collectSelectedTags(popup);
  if (selTagNames.length === 0) {
    notice('请至少选择一个标签');
    return;
  }
  savingTagPicker = true;
  setTagPickerSavingUi(true);
  try {
    const ok = await handleTagPickerSave(loc, selTagNames, !!loc.encrypted);
    if (ok) closeTagPicker();
  } finally {
    savingTagPicker = false;
    setTagPickerSavingUi(false);
  }
}

export function showTagPicker(loc: DiaryEntryLocator) {
  activeTagPickerLoc = loc;
  if (tagPickerUi) closeTagPicker(); // 重开先收旧壳，避免叠加

  // 加密分类不在类型选择器提供（加密唯一入口 = 抽屉「加密」动作，ADR-0017）；
  // 加密条目的改分类（降级）同样不含「加密」选项
  const isEncrypted = !!loc.encrypted;
  const currentTagsSet = tagPickerOriginalTags(loc);
  const sortedTags = sortTagsByUsage(getSortedTagsForAddDialog());

  const content = document.createElement('div');
  content.className = 'bz-diary-form';

  const chips = document.createElement('div');
  chips.className = 'diary-tag-selector-buttons bz-diary-chip-scroll';
  renderTagOptions(chips, sortedTags, currentTagsSet);
  content.appendChild(createTagFilter(chips));
  content.appendChild(chips);

  const foot = document.createElement('div');
  foot.className = 'bz-diary-dialog-foot bz-diary-dialog-foot--split';
  const deleteBtn = uiBtn({
    label: '删除',
    tone: 'danger', // 一致#2：删除钮换 .bz-btn--danger 族（原手绘 error 实底退役）
    className: 'bz-touch-target--xl',
    onClick: () => {
      const target = activeTagPickerLoc;
      closeTagPicker();
      if (target) showConfirm(target);
    },
  });
  const saveBtn = uiBtn({
    label: '保存', // 一致#1：编辑既有条目 = 保存口径
    tone: 'primary',
    className: 'bz-touch-target--xl',
    onClick: () => void commitTagPickerSave(),
  });
  tagPickerSaveBtn = saveBtn;
  foot.appendChild(deleteBtn);
  foot.appendChild(saveBtn);
  content.appendChild(foot);

  const { mask, popup, close } = uiModal({
    content,
    maxWidth: 320,
    head: true,
    title: '选择类型',
    className: 'bz-diary-tag-popup',
    requestClose: requestCloseTagPicker,
  });
  // 遗留 id 保留在壳上：main.ts/index.ts 卸载兜底按 id 摘除（D15）与 core 滚动条
  // 通杀枚举同源；类名已迁 bz- 前缀域皮（遮罩/圆角/阴影 token 随壳对齐）
  mask.id = 'diary-tag-selector-mask';
  popup.id = 'diary-tag-selector-popup';
  tagPickerUi = { mask, popup, close };
  bindFormSubmit(popup, () => void commitTagPickerSave()); // 效率#2
}

/**
 * 标签选择器「保存」分流（ADR-0017），返回是否已保存（成功才收壳）：
 * - 加密条目的保存 = 改分类降级（reclassifyEntry），成功后 merge 回 md 并从保险箱取出，
 *   发 diary:entry-decrypted 通知宿主刷新；保存前 isUnlocked() 短路（N1：保险箱中途
 *   上锁时 getDiaryEntryPlain 会抛「未解锁」，此前成为 unhandled rejection 静默假成功）；
 * - 非加密条目走写层 updateDiaryTags（加密入口在抽屉「加密」动作，标签选择器不提供加密分类），
 *   写盘成功由写层发 diary:tags-changed；
 * - 整链 try/catch 兜底（N1）：守卫错误（拒写/读失败）静默——人话通知已由写层发过；
 *   其余非守卫错误补发「改标签失败」人话，不再 unhandled rejection 假成功。
 */
async function handleTagPickerSave(loc: DiaryEntryLocator, selTagNames: string[], isEncryptedEntry: boolean): Promise<boolean> {
  try {
    if (isEncryptedEntry) {
      // 加密条目：改分类 = 解密降级 + 应用新标签（Q20-a）；保险箱中途上锁先短路
      const { isUnlocked } = await import('../encrypt');
      if (!isUnlocked()) {
        notice('保险箱已上锁，请先解锁再改分类', 'error');
        return false;
      }
      const proceed =
        (await openFlowDialog({
          title: '改分类',
          message: '将解密此日记并恢复为普通条目，是否继续？',
          actions: [
            { label: '取消', value: 'cancel' },
            { label: '确定', value: 'ok', cta: true },
          ],
        })) === 'ok';
      if (!proceed) return false;
      if (!loc.noteId) return false;
      const newTags = selTagNames.filter((t) => t !== ENCRYPT_TAG);
      const success = await reclassifyEntry(loc.noteId, selTagNames);
      if (!success) {
        notice('解密改分类失败', 'error');
        return false;
      }
      // UX-8：加密条目改分类成功提示，语义同「已解密还原」
      notice('已解密还原', 'success');
      emitDomainEvent('diary:entry-decrypted', { noteId: loc.noteId, date: loc.date, newTags });
      return true;
    }

    // 普通改分类（行号优先、同刻唯一兜底；定位失败告警中止，不盲写旧数据）
    const dateStr = loc.date;
    const predicate = await buildLocatorPredicateFor(dateStr, loc);
    const updated = await updateDiaryTags(dateStr, predicate, selTagNames, { filePath: loc.filePath });
    if (!updated) {
      notice('未能在日记数据中定位该条目，标签没有修改', 'error');
      return false;
    }
    return true;
  } catch (e: any) {
    if (isUnparsedRefusal(e) || isDiaryReadFailure(e)) return false; // 守卫拒写/读失败：人话通知已由写层发出
    console.error('改标签失败:', e);
    notice('改标签失败：' + (e?.message || e), 'error');
    return false;
  }
}

// ===== 添加日记弹窗（原 3238-3478） =====

/** 当前写日记弹窗壳（uiModal 产物） */
let addDialogUi: { mask: HTMLElement; popup: HTMLElement; close: () => void } | null = null;
/** 打开时刻的日期默认值（脏检测基准：当前值偏离默认 = 有输入） */
let addDialogDefaultDateTime = '';
/** 「添加」钮（D-UI12：保存进行中禁用 + 「保存中…」） */
let addDialogSaveBtn: HTMLButtonElement | null = null;

/** 打开添加日记弹窗（原 3348-3426）。
 * opts.yearRange：宿主（墙）注入的滚轮年份动态范围（UX-34，取自当前数据最早/最新年份）；
 * 未注入回落 1900～当前年+1。
 * opts.onSaved：保存成功后的宿主回调（item-1789672493967-y11jgy，墙注入「收起主窗口」；
 * 回调注入避免本模块反向依赖 ui.ts 的 DiaryAppController——依赖铁律禁模块顶层互访）；
 * 打开新笔记在本模块内完成，回调只管宿主自身收尾。 */
let activeAddDialogOnSaved: (() => void) | null = null;

/** 兼容入口（index.ts ensureDiary 预构建契约）：迁 uiModal 壳后弹窗按需构建，此处为空操作 */
export function createAddDialog(): void {}

/** 脏检测（D-UI2）：已选类型非空 或 日期偏离打开时默认值 = 有未保存输入 */
function addDialogDirty(): boolean {
  const popup = document.getElementById('add-diary-popup');
  if (!popup) return false;
  if (collectSelectedTags(popup).length > 0) return true;
  const datetimeInput = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
  return !!datetimeInput && datetimeInput.value !== addDialogDefaultDateTime;
}

/** 收壳：uiModal close 自会摘 mask、注销 ESC 层、还原焦点（hide 兜底在 dialogs 内自洽） */
function closeAddDialog(): void {
  addDialogUi?.close();
  addDialogUi = null;
  addDialogSaveBtn = null;
}

/** 对外兜底入口（D-UI2 残款）：面板 hide()/上锁归位等清理路径强制收壳，不走脏拦截 */
export function hideAddDialog(): void {
  closeAddDialog();
}

/** 关闭意图分流（D-UI2）：有输入走 confirmDiscard（favorites/belongings 同款），无输入直接收 */
function requestCloseAddDialog(): void {
  if (addDialogDirty()) confirmDiscard(closeAddDialog, undefined, DIARY_FLOW_SKIN);
  else closeAddDialog();
}

function setAddSavingUi(saving: boolean): void {
  const btn = addDialogSaveBtn;
  if (!btn) return;
  btn.disabled = saving;
  const label = btn.querySelector('span') ?? btn;
  label.textContent = saving ? '保存中…' : '添加';
}

export function openAddDialog(opts?: { yearRange?: { min: number; max: number }; onSaved?: () => void }) {
  activeAddDialogOnSaved = opts?.onSaved ?? null;

  if (opts?.yearRange) {
    const range = opts.yearRange;
    setDateTimeYearRangeProvider(() => range);
  } else {
    setDateTimeYearRangeProvider(null);
  }

  // 重开先收旧壳（uiModal 开即建关即拆，避免叠加；close 幂等）
  if (addDialogUi) closeAddDialog();

  const content = document.createElement('div');
  content.className = 'bz-diary-form';

  const dateTimePicker = createDateTimeControl();
  content.appendChild(dateTimePicker);

  const typeLabel = document.createElement('label');
  typeLabel.className = 'bz-diary-field-label';
  typeLabel.textContent = '类型';

  const typeContainer = document.createElement('div');
  typeContainer.id = 'add-diary-type-container';
  typeContainer.className = 'diary-tag-selector-buttons bz-diary-chip-scroll';

  content.appendChild(typeLabel);
  // 写弹窗的「筛选类型」过滤框已按用户要求移除（2026-09-19）：chips 直选即可；
  // 标签选择器浮层的过滤框不受影响（createTagFilter 另有挂载点）
  content.appendChild(typeContainer);

  const foot = document.createElement('div');
  foot.className = 'bz-diary-dialog-foot';
  // 取消（D-UI2 三件套）：显式退出入口，同样承接脏拦截分流
  const cancelBtn = uiBtn({ label: '取消', className: 'bz-touch-target--xl', onClick: requestCloseAddDialog });
  const saveBtn = uiBtn({
    label: '添加', // 一致#1：新建条目 = 添加口径（编辑既有条目的选择器保持「保存」）
    tone: 'primary',
    className: 'bz-touch-target--xl', // D-UI15：保存/取消钮同批触控抬档
    onClick: () => void saveNewEntry(),
  });
  addDialogSaveBtn = saveBtn;
  foot.appendChild(cancelBtn);
  foot.appendChild(saveBtn);
  content.appendChild(foot); // 效率#1：sticky 底栏，保存钮不再随 chips 滚走

  const { mask, popup, close } = uiModal({
    content,
    maxWidth: 400,
    head: true,
    title: '写日记',
    className: 'bz-diary-add-popup',
    requestClose: requestCloseAddDialog, // ESC/遮罩关闭统一走脏拦截分流
  });
  // 遗留 id 保留在壳上：main.ts/index.ts 卸载兜底按 id 摘除（D15）与 core 滚动条
  // 通杀枚举同源；类名已迁 bz- 前缀域皮（遮罩/圆角/阴影 token 随壳对齐）
  mask.id = 'add-diary-mask';
  popup.id = 'add-diary-popup';
  addDialogUi = { mask, popup, close };
  bindFormSubmit(popup, () => void saveNewEntry()); // 效率#2：Ctrl+Enter / 单行 input 回车提交

  // 1. 刷新类型按钮（频次前置排序）
  // ----- 不预选任何标签（用户确认：默认全部加载，不选择任何标签） -----
  renderTagOptions(typeContainer, sortTagsByUsage(getSortedTagsForAddDialog()), new Set());

  // 2. 设置日期时间默认值（一致#7：日期键走 core localDayKey 单源）
  let defaultDateStr = localDayKey();
  let defaultTimeStr = moment().format('HH:mm');

  if (getUseFileDateTimeSetting()) {
    const activeView = getApp().workspace.getActiveViewOfType(MarkdownViewFromObsidian) as any;
    if (activeView && activeView.file) {
      const file = activeView.file;
      if (file.path.startsWith(DIARY_DIRECTORY)) {
        // 条目文件（YYMMDDHHmm(-N).md）取日期段：格式知识单源在 core/diary-format
        // （传完整 path：TFile.basename 不含 .md，契约正则要求扩展名）
        const entryDate = diaryDateFromEntryPath(file.path);
        if (entryDate) defaultDateStr = entryDate;
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
  addDialogDefaultDateTime = defaultDateTime;

  // D-UI5：旧「setTimeout 聚焦 display:none 隐藏 input」的 no-op 已删——开壳焦点由
  // uiModal 焦点管理接管（桌面聚焦首个可交互元素 = 标签过滤框；移动端跳过 input
  // 防软键盘，聚焦首个标签 chip）
}

/** useFileDateTime 设置读取（原 ui-settings.getUseFileDateTimeSetting；唯一存活的显示键，经设置访问器直读） */
function getUseFileDateTimeSetting(): boolean {
  const s = tryGetSettings() as Record<string, unknown>;
  return s?.useFileDateTime === true;
}

/** 保存进行中标志（D7 防连点）：大文件写盘慢时双击「添加」会在同刻写入两条重复空条目，
 *  同刻唯一兜底定位随之失效——进行中再点直接忽略，写盘结束（含失败）才放行。 */
let savingNewEntry = false;

/** 保存新日记条目（原 3428-3478；面板插拔随域退役，保存成功由写层发 diary:entry-added） */
export async function saveNewEntry() {
  if (savingNewEntry) return; // D7 防连点：上一笔仍在写盘
  const datetimeInput = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
  const typeContainer = document.getElementById('add-diary-type-container');
  if (!datetimeInput || !typeContainer || !document.getElementById('add-diary-popup')) return;

  const userInput = datetimeInput.value.trim();
  const selTagNames = collectSelectedTags(typeContainer);
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

  savingNewEntry = true;
  setAddSavingUi(true); // D-UI12/效率#3：写盘期间禁用 + 「保存中…」，慢盘窗口不再像按钮失灵
  try {
    const entry = await addEntry(dateStr, timeStr, selTagNames, '');
    // 收紧通知（memo item-1789105697068）：保存成功结果立即可见（弹窗关、墙已刷新），不再弹成功提示
    closeAddDialog(); // uiModal 壳：关壳即摘 mask + 成对注销 ESC 层
    // 创建成功 → 打开新笔记并通知宿主（item-1789672493967-y11jgy）：先 await 打开
    // 再回调关墙，对齐 jumpTo 先例「跳转后关日记本」；打开/回调失败不影响已落盘
    // 事实，静默兜底——不落入下方写盘失败分支误报「保存失败」
    try {
      await jumpToDiaryEntry(entry);
      activeAddDialogOnSaved?.();
      activeAddDialogOnSaved = null; // 消费即清：防陈旧回调（下次 openAddDialog 重设）
    } catch {
      // 打开新笔记失败（罕见）：条目已落盘、弹窗已关，无需人话通知
    }
  } catch (error: any) {
    if (isUnparsedRefusal(error) || isDiaryReadFailure(error)) return; // 守卫拒写/读盘失败：人话通知已由写层发出
    console.error('保存日记失败:', error);
    notifySaveError(error, '日记');
  } finally {
    savingNewEntry = false;
    setAddSavingUi(false); // 失败路径恢复按钮态（成功路径按钮已随壳摘除，复位为空操作）
  }
}
