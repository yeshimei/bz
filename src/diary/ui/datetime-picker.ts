/**
 * 滚轮日期时间选择器（原脚本 2629-3234；issue 256 随写链路迁入新 diary 域）。
 * 年份动态范围（UX-34）改由调用方注入：写日记宿主（墙）打开弹窗时经
 * setDateTimeYearRangeProvider 提供当前数据的年份范围，未注入回落探测/1900～当前年+1。
 *
 * 2026-09 修复批 B：
 * - D2'：年/月滚轮溢出漂移——moment 的 year/month setter 保留 day 进位（1月31日点2月 →
 *   3月3日；闰 2/29 切非闰年 → 3月1日），先落 day=1 再 set 再钳回 min(原 day, 当月天数)；
 * - 效率#4：日期行常驻「此刻/昨天」chip；单击立即开滚轮（原 200ms 延迟为 dblclick 让路）；
 *   滚轮弹窗内加「手输」切换钮（替代隐身 dblclick，dblclick 保留兼容）；直开写日记
 *   （墙未开过、宿主未注入年份范围）时轻量探测数据最早年份，避免 1900 假范围；
 * - D-UI10：displayArea tabindex/Enter/Space 开滚轮；数值项 button 化 + ↑/↓ 步进；
 *   打开即聚焦选中项，键盘链路「开滚轮 → 选值 → 手输」闭环；
 * - D-UI16：手输聚焦软键盘顶起时写日记弹窗加 .keyboard-up 上移档（样式在域 styles.css）；
 * - 一致#2/#3/#5/#6、N11：阴影走 --dw-shadow-lg 三档 + role=dialog + esc 层 id 改
 *   bz-diary-datetime；删内联 scrollbar 隐藏（core components.css 已枚举本元素）与
 *   font-family 硬编码；字重 900 → 700；选中底色 --text-muted → --background-modifier-hover；
 *   placeholder「1分钟前」→「1 分钟前」；删除无调用方的 syncDateTime 死代码。
 */
import { moment } from 'obsidian';
import { notice } from '../../core/notice';
import { escManager } from '../../core/esc-manager';
import { allocZ } from '../../core/z-order';
import { getApp } from '../../core/app';
import { diaryDateFromEntryPath } from '../../core/diary-format';
import { DIARY_DIRECTORY } from '../config';
import { parseFlexibleDateTime } from '../parser';

/** 年份动态范围提供方（写日记宿主注册；null = 未注入回落默认范围） */
let yearRangeProvider: (() => { min: number; max: number }) | null = null;

export function setDateTimeYearRangeProvider(p: (() => { min: number; max: number }) | null) {
  yearRangeProvider = p;
}

// ===== 滚轮列（原 2629-2782） =====

interface WheelField {
  name: string;
  unit: string;
  min: number | (() => number);
  max: number | (() => number);
  get: (m: any) => number;
  set: (m: any, v: number) => void;
}

interface WheelPicker {
  tempMoment: any;
  fields: WheelField[];
  columns: any[];
  numberItems: any[][];
}

/** 数值项统一工厂（D-UI10/一致#6：button 化——原生可 Tab/回车；重置 button 默认样式，
 *  视觉与原 div 一致；font-family 走继承，不写死字体名） */
function createNumberItem(value: number, onSelect: () => void): HTMLButtonElement {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'datetime-number-item';
  item.dataset.value = String(value);
  item.textContent = value < 10 ? `0${value}` : String(value);
  item.style.cssText = `
    padding: 12px 8px;
    font-size: 18px;
    font-weight: 400;
    color: var(--text-muted);
    cursor: pointer;
    user-select: none;
    width: 100%;
    text-align: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-family: inherit;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  `;
  item.addEventListener('click', onSelect);
  return item;
}

/** 方向键步进选值（D-UI10）：↑/↓ 在本列 min～max 内步进并移动焦点；preventDefault
 *  防容器默认滚动。日列重建后 numberItems 换新数组，故取实时引用做焦点跟随。 */
function bindStepKeys(item: HTMLButtonElement, colIndex: number, picker: WheelPicker, select: (v: number) => void) {
  item.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const field = picker.fields[colIndex];
    const lo = typeof field.min === 'function' ? field.min() : field.min;
    const hi = typeof field.max === 'function' ? field.max() : field.max;
    const delta = e.key === 'ArrowUp' ? -1 : 1;
    const target = Math.min(hi, Math.max(lo, field.get(picker.tempMoment) + delta));
    if (target === field.get(picker.tempMoment)) return;
    select(target);
    const next = picker.numberItems[colIndex]?.[target - lo];
    if (next) next.focus();
  });
}

/**
 * 年/月列设值（D2' 修复）：moment 的 year/month setter 是溢出语义（保留 day-of-month 进位）——
 * 1月31日 set 2月 → 3月2/3日、2024-02-29 set 2025 → 3月1日；旧「set 后读 daysInMonth 再钳制」
 * 读到的已是溢出后的月份，`currentDay > dayMax` 恒不触发。现先把 day 落到 1（任意年月均合法，
 * setter 不再溢出），set 后钳回 min(原 day, 当月天数)——月末/闰日停在当月月末而非漂进下月。
 */
function applyFieldValue(picker: WheelPicker, field: WheelField, newVal: number) {
  if (field.unit === 'year' || field.unit === 'month') {
    const origDay = picker.tempMoment.date();
    picker.tempMoment.date(1);
    field.set(picker.tempMoment, newVal);
    const dayMax = picker.tempMoment.daysInMonth();
    const dayField = picker.fields.find((f) => f.unit === 'day');
    if (dayField) dayField.set(picker.tempMoment, Math.min(origDay, dayMax));
    regenerateDayNumbers(picker);
  } else {
    field.set(picker.tempMoment, newVal);
  }
}

function createWheelColumn(field: WheelField, colIndex: number, picker: WheelPicker) {
  const column = document.createElement('div');
  column.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  `;

  const label = document.createElement('div');
  label.textContent = field.name;
  label.style.cssText = `
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
    padding: 8px 4px;
    font-weight: 500;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  `;
  column.appendChild(label);

  const wheelScrollContainer = document.createElement('div');
  wheelScrollContainer.className = 'diary-datetime-scroll-container';
  // 滚动条隐藏单源在 core（components.css 已枚举 .diary-datetime-scroll-container），
  // 域内不自造 scrollbar 声明（一致#3，铁律 4）
  wheelScrollContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  `;
  column.appendChild(wheelScrollContainer);

  const numbersContainer = document.createElement('div');
  numbersContainer.className = 'datetime-numbers-container';
  numbersContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 120px 0;
  `;
  wheelScrollContainer.appendChild(numbersContainer);

  const items: HTMLElement[] = [];
  let min = typeof field.min === 'function' ? field.min() : field.min;
  let max = typeof field.max === 'function' ? field.max() : field.max;

  /** 选中某值（年/月列走 applyFieldValue 钳制重建；值未变 no-op） */
  const selectValue = (newVal: number) => {
    if (newVal === field.get(picker.tempMoment)) return;
    applyFieldValue(picker, field, newVal);
    updateSelection();
  };

  for (let i = min; i <= max; i++) {
    const item = createNumberItem(i, () => selectValue(parseInt(item.dataset.value!)));
    bindStepKeys(item, colIndex, picker, selectValue);
    items.push(item);
    numbersContainer.appendChild(item);
  }
  picker.numberItems[colIndex] = items;

  const updateSelection = () => {
    const currentVal = field.get(picker.tempMoment);
    let selected: HTMLElement | null = null;
    items.forEach((item) => {
      const val = parseInt(item.dataset.value!);
      if (val === currentVal) {
        // 一致#6：字重上限 700（原 900）；选中底色用背景族 token（原 --text-muted 是文字 token）
        item.style.color = 'var(--text-on-accent)';
        item.style.fontWeight = '700';
        item.style.background = 'var(--background-modifier-hover)';
        selected = item;
      } else {
        item.style.color = 'var(--text-muted)';
        item.style.fontWeight = '400';
        item.style.background = 'transparent';
      }
    });
    (column as any).selectedEl = selected; // D-UI10：打开滚轮时聚焦选中项用
  };

  const scrollToSelected = () => {
    const currentVal = field.get(picker.tempMoment);
    const index = currentVal - min;
    if (items[index]) {
      const itemHeight = items[index].offsetHeight || 44;
      const containerHeight = wheelScrollContainer.clientHeight;
      const targetScrollTop = index * itemHeight - containerHeight / 2 + itemHeight / 2;
      wheelScrollContainer.scrollTop = targetScrollTop;
    }
  };

  wheelScrollContainer.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      wheelScrollContainer.scrollTop += e.deltaY * 0.5;
    },
    { passive: false }
  );

  let touchStartY = 0;
  let scrollStartTop = 0;
  let isScrolling = false;

  wheelScrollContainer.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      scrollStartTop = wheelScrollContainer.scrollTop;
      isScrolling = true;
    },
    { passive: true }
  );

  wheelScrollContainer.addEventListener(
    'touchmove',
    (e) => {
      if (!isScrolling || e.touches.length !== 1) return;
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      wheelScrollContainer.scrollTop = scrollStartTop + deltaY;
    },
    { passive: false }
  );

  wheelScrollContainer.addEventListener(
    'touchend',
    () => {
      isScrolling = false;
    },
    { passive: true }
  );

  (column as any).updateSelection = updateSelection;
  (column as any).scrollToSelected = scrollToSelected;
  (column as any).selectValue = selectValue; // 日列重建项复用同一选中语义
  return column;
}

// ===== 重建天数列（原 2785-2850） =====

function regenerateDayNumbers(picker: WheelPicker) {
  const dayField = picker.fields.find((f) => f.unit === 'day')!;
  const dayColIndex = picker.fields.findIndex((f) => f.unit === 'day');
  const dayItems = picker.numberItems[dayColIndex];
  const dayMax = picker.tempMoment.daysInMonth();

  const currentCount = dayItems.length;
  const targetCount = dayMax;

  if (targetCount < currentCount) {
    for (let i = currentCount - 1; i >= targetCount; i--) {
      dayItems[i].remove();
      dayItems.pop();
    }
  } else if (targetCount > currentCount) {
    const container = dayItems[0].parentElement;
    const selectDay = (v: number) => (picker.columns[dayColIndex] as any).selectValue(v);
    for (let i = currentCount + 1; i <= targetCount; i++) {
      // 重建项复用统一工厂 + 方向键步进（与首建项同款；选中语义走列的 selectValue）
      const item = createNumberItem(i, () => selectDay(parseInt(item.dataset.value!)));
      bindStepKeys(item, dayColIndex, picker, selectDay);
      container!.appendChild(item);
      dayItems.push(item);
    }
  }

  dayItems.forEach((item, index) => {
    const value = index + 1;
    item.dataset.value = String(value);
    item.textContent = value < 10 ? `0${value}` : String(value);
  });

  // 注：日超月末的钳制在 applyFieldValue 内完成（D2' 修复后进到这里的天必 ≤ 当月天数）

  picker.columns[dayColIndex].updateSelection();
}

// ===== 更新所有列（原 2853-2862） =====

function updateAllColumns(picker: WheelPicker, shouldScroll = false) {
  picker.columns.forEach((col) => {
    if (col.updateSelection) {
      col.updateSelection();
      if (shouldScroll && col.scrollToSelected) {
        col.scrollToSelected();
      }
    }
  });
}

// ===== 显示统一日期时间选择器（原 2865-3033） =====

/** 会话级年份下限缓存：undefined=未探测；null=探测过但无数据/不可用（回落 1900） */
let earliestYearCache: number | null | undefined;

/**
 * 直开写日记（bz-diary-write，本会话未开过墙）时滚轮年份下限探测（效率#4③）：
 * 宿主未注入 yearRangeProvider 时扫日记目录条目文件名（YYMMDDHHmm(-N)，解析走
 * core/diary-format 单源）取最早年份，避免 1900 假范围。同步轻量（vault 文件清单
 * 现成），会话级缓存一次；app 未初始化/目录为空/异常一律静默回落默认范围。
 */
function probeEarliestYear(): number | null {
  if (earliestYearCache !== undefined) return earliestYearCache;
  earliestYearCache = null;
  try {
    const files = getApp().vault.getMarkdownFiles?.() ?? [];
    const dir = DIARY_DIRECTORY.replace(/\/+$/, '');
    let earliest: number | null = null;
    for (const f of files) {
      const p = String((f as any)?.path ?? '');
      if (dir && !p.startsWith(dir + '/')) continue;
      const date = diaryDateFromEntryPath(p);
      if (!date) continue;
      const y = parseInt(date.slice(0, 4), 10);
      if (!Number.isNaN(y) && (earliest === null || y < earliest)) earliest = y;
    }
    earliestYearCache = earliest;
  } catch (e) {
    /* app 未初始化/vault 异常：回落默认范围 */
  }
  return earliestYearCache;
}

/** 测试复位：清空年份下限探测缓存（会话级缓存仅生产侧使用） */
export function resetDateTimeYearProbe() {
  earliestYearCache = undefined;
}

/**
 * 滚轮年份动态范围（UX-34）：宿主注入的提供方优先；
 * 未注入回落最早年份探测（效率#4③）、下限兜底 1900、max 当前年份 + 1。
 */
function getYearRange(): { min: number; max: number } {
  if (yearRangeProvider) {
    try {
      const r = yearRangeProvider();
      if (r && Number.isFinite(r.min) && Number.isFinite(r.max) && r.min <= r.max) return r;
    } catch (e) {
      /* 提供方异常回落默认范围 */
    }
  }
  const max = new Date().getFullYear() + 1;
  const earliest = probeEarliestYear();
  return { min: Math.min(earliest ?? 1900, max), max };
}

export function showDateTimePicker(initialMoment: any, onConfirm: (m: any) => void, onManual?: () => void) {
  const existing = document.getElementById('unified-datetime-picker-mask');
  if (existing) existing.remove();

  const picker: WheelPicker = {
    tempMoment: initialMoment.clone(),
    fields: [
      {
        name: '年',
        unit: 'year',
        // UX-34：动态范围——min 数据最早年份（下限放宽至 1900）、max 当前年份+1
        min: () => getYearRange().min,
        max: () => getYearRange().max,
        get: (m) => m.year(),
        set: (m, v) => m.year(v),
      },
      {
        name: '月',
        unit: 'month',
        min: 1,
        max: 12,
        get: (m) => m.month() + 1,
        set: (m, v) => m.month(v - 1),
      },
      {
        name: '日',
        unit: 'day',
        min: 1,
        max: () => picker.tempMoment.daysInMonth(),
        get: (m) => m.date(),
        set: (m, v) => m.date(v),
      },
      {
        name: '时',
        unit: 'hour',
        min: 0,
        max: 23,
        get: (m) => m.hour(),
        set: (m, v) => m.hour(v),
      },
      {
        name: '分',
        unit: 'minute',
        min: 0,
        max: 59,
        get: (m) => m.minute(),
        set: (m, v) => m.minute(v),
      },
    ],
    columns: [],
    numberItems: [],
  };

  const mask = document.createElement('div');
  mask.id = 'unified-datetime-picker-mask';
  mask.style.cssText = `
    position: fixed; top:0; left:0; right:0; bottom:0;
    background: var(--background-modifier-cover);
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const popup = document.createElement('div');
  popup.style.cssText = `
    background: var(--background-primary);
    border-radius: 16px;
    padding: 20px 24px 24px 24px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    box-shadow: var(--dw-shadow-lg);
    display: flex;
    flex-direction: column;
  `;
  // 一致#2（降级口径）：遮罩色已走 --background-modifier-cover；阴影对齐手册三档
  // （--dw-shadow-lg，token 作用域在域 styles.css 同列声明）；补 role=dialog 语义
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-label', '选择日期时间');

  const title = document.createElement('h4');
  title.textContent = '选择日期时间';
  title.style.cssText = `
    margin:0 0 20px 0;
    font-size:18px;
    font-weight:600;
    color:var(--text-normal);
    text-align:center;
  `;
  popup.appendChild(title);

  const columnsContainer = document.createElement('div');
  columnsContainer.style.cssText = `
    display: flex;
    flex: 1;
    gap: 8px;
    min-height: 320px;
    overflow: hidden;
  `;

  picker.fields.forEach((field, colIndex) => {
    const col = createWheelColumn(field, colIndex, picker);
    columnsContainer.appendChild(col);
    picker.columns.push(col);
  });

  popup.appendChild(columnsContainer);

  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--background-modifier-border);
  `;

  const neutralBtnCss = `
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    flex: 1;
    font-family: inherit;
  `;

  const todayBtn = document.createElement('button');
  todayBtn.type = 'button';
  todayBtn.textContent = '此刻';
  todayBtn.style.cssText = neutralBtnCss;
  todayBtn.onclick = () => {
    picker.tempMoment = moment();
    regenerateDayNumbers(picker);
    updateAllColumns(picker, true);
  };

  btnContainer.appendChild(todayBtn);

  // 效率#4②：「手输」切换钮（显性化手输入口，原为隐身 dblclick；dblclick 保留兼容）
  if (onManual) {
    const manualBtn = document.createElement('button');
    manualBtn.type = 'button';
    manualBtn.textContent = '手输';
    manualBtn.style.cssText = neutralBtnCss;
    manualBtn.onclick = () => {
      mask.remove();
      onManual();
    };
    btnContainer.appendChild(manualBtn);
  }

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.textContent = '确定';
  okBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    flex: 1;
    font-family: inherit;
  `;
  okBtn.onclick = () => {
    if (onConfirm) onConfirm(picker.tempMoment.clone());
    mask.remove();
  };

  btnContainer.appendChild(okBtn);
  popup.appendChild(btnContainer);

  mask.appendChild(popup);
  mask.style.zIndex = String(allocZ()); // ADR-0067:一次性选择器,创建即显示即发号(popup 为 mask 子节点随动)
  document.body.appendChild(mask);

  updateAllColumns(picker, true);

  // D-UI10：打开即聚焦滚轮内当前选中项——键盘用户 Tab 一步进滚轮，↑/↓ 步进选值
  for (const col of picker.columns) {
    const el = (col as any).selectedEl as HTMLElement | null;
    if (el) {
      el.focus({ preventScroll: true });
      break;
    }
  }

  mask.addEventListener('click', (e) => {
    if (e.target === mask) mask.remove();
  });

  // 一致#5：esc 层 id 对齐 bz- 前缀口径（esc id 非 DOM 契约，无外部按 id 消费者）
  escManager.register('bz-diary-datetime', { isVisible: () => mask.isConnected, close: () => mask.remove() });

  return mask;
}

// ===== 日期时间控件（原 3036-3213） =====

/** 当前控件实例的外部同步入口（createDateTimeControl 注册；控件唯一，重建时覆盖） */
let activeMomentReset: ((m: any) => void) | null = null;

/**
 * 同步写日记弹窗日期控件的内部时刻（P1 审查修复：弹窗日期脱同步）。
 * openAddDialog 每次打开时调用——控件内部 currentMoment 只在创建时初始化一次，
 * 隔天复用弹窗时显示已更新而滚轮起点还是旧时刻，直接确认会写错日期。
 */
export function resetDateTimeControl(m: any) {
  if (activeMomentReset) activeMomentReset(m);
}

/** D-UI16：手输聚焦软键盘顶起时写日记弹窗上移一档（.keyboard-up 档在域 styles.css） */
function setKeyboardUp(on: boolean) {
  document.getElementById('add-diary-popup')?.classList.toggle('keyboard-up', on);
}

export function createDateTimeControl() {
  const container = document.createElement('div');
  container.style.cssText = 'margin-bottom:16px;';
  container.classList.add('datetime-picker-container');

  const label = document.createElement('label');
  label.textContent = '日期';
  label.style.cssText = 'display:block;margin-bottom:6px;font-size:14px;color:var(--text-muted);font-weight:500;';
  container.appendChild(label);

  const displayArea = document.createElement('div');
  displayArea.id = 'datetime-display-area';
  displayArea.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 8px 12px;
    background: var(--background-primary);
    cursor: pointer;
    flex-wrap: wrap;
  `;
  // D-UI10：显示区键盘可达（Tab 进序，Enter/Space 开滚轮）
  displayArea.tabIndex = 0;
  displayArea.setAttribute('role', 'button');
  displayArea.setAttribute('aria-label', '日期时间：回车或空格打开滚轮选择，滚轮内可切手输');

  const yearSpan = document.createElement('span');
  yearSpan.className = 'dt-part';
  yearSpan.setAttribute('data-part', 'year');
  yearSpan.style.cssText = 'padding:2px 6px; border-radius:4px;';
  yearSpan.textContent = '----';

  const monthSpan = document.createElement('span');
  monthSpan.className = 'dt-part';
  monthSpan.setAttribute('data-part', 'month');
  monthSpan.style.cssText = 'padding:2px 6px; border-radius:4px;';
  monthSpan.textContent = '--';

  const daySpan = document.createElement('span');
  daySpan.className = 'dt-part';
  daySpan.setAttribute('data-part', 'day');
  daySpan.style.cssText = 'padding:2px 6px; border-radius:4px;';
  daySpan.textContent = '--';

  const hourSpan = document.createElement('span');
  hourSpan.className = 'dt-part';
  hourSpan.setAttribute('data-part', 'hour');
  hourSpan.style.cssText = 'padding:2px 6px; border-radius:4px;';
  hourSpan.textContent = '--';

  const minuteSpan = document.createElement('span');
  minuteSpan.className = 'dt-part';
  minuteSpan.setAttribute('data-part', 'minute');
  minuteSpan.style.cssText = 'padding:2px 6px; border-radius:4px;';
  minuteSpan.textContent = '--';

  const sep1 = document.createTextNode('-');
  const sep2 = document.createTextNode('-');
  const space = document.createTextNode(' ');
  const colon = document.createTextNode(':');

  displayArea.appendChild(yearSpan);
  displayArea.appendChild(sep1);
  displayArea.appendChild(monthSpan);
  displayArea.appendChild(sep2);
  displayArea.appendChild(daySpan);
  displayArea.appendChild(space);
  displayArea.appendChild(hourSpan);
  displayArea.appendChild(colon);
  displayArea.appendChild(minuteSpan);

  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'text';
  hiddenInput.id = 'add-diary-datetime';
  hiddenInput.style.display = 'none';

  const manualInput = document.createElement('input');
  manualInput.type = 'text';
  manualInput.placeholder = 'YYYY-MM-DD HH:mm 或 1 分钟前';
  manualInput.style.cssText = `
    width: 100%;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    font-size: 14px;
    box-sizing: border-box;
    padding: 8px 12px;
    display: none;
  `;

  let currentMoment = moment();
  let isManualMode = false;

  /** 外部同步入口（P1 审查修复）：openAddDialog 每次打开时重置控件内部时刻，
   *  使滚轮起点与显示值一致——否则弹窗显示「现在」，滚轮内部还是控件创建日的时刻，
   *  直接点「确定」会把日记写回旧时刻 */
  const setMoment = (m: any) => {
    if (!m || typeof m.isValid !== 'function' || !m.isValid()) return;
    currentMoment = m.clone();
    updateDisplay(currentMoment);
  };
  activeMomentReset = setMoment;

  function updateDisplay(momentObj: any) {
    if (!momentObj || !momentObj.isValid()) {
      yearSpan.textContent = '----';
      monthSpan.textContent = '--';
      daySpan.textContent = '--';
      hourSpan.textContent = '--';
      minuteSpan.textContent = '--';
      hiddenInput.value = '';
      return;
    }
    yearSpan.textContent = momentObj.format('YYYY');
    monthSpan.textContent = momentObj.format('MM');
    daySpan.textContent = momentObj.format('DD');
    hourSpan.textContent = momentObj.format('HH');
    minuteSpan.textContent = momentObj.format('mm');
    hiddenInput.value = momentObj.format('YYYY-MM-DD HH:mm');
  }

  updateDisplay(currentMoment);

  function openUnifiedPicker() {
    if (isManualMode) return;
    showDateTimePicker(
      currentMoment,
      (newMoment) => {
        if (newMoment && newMoment.isValid()) {
          currentMoment = newMoment;
          updateDisplay(currentMoment);
        }
      },
      () => enterManualMode() // 效率#4②：滚轮内「手输」钮承接显性入口
    );
  }

  function enterManualMode() {
    if (isManualMode) return;
    isManualMode = true;
    displayArea.style.display = 'none';
    manualInput.style.display = 'block';
    manualInput.value = hiddenInput.value;
    manualInput.focus();
    manualInput.select();
  }

  function exitManualMode() {
    setKeyboardUp(false);
    if (!isManualMode) return;
    isManualMode = false;
    manualInput.style.display = 'none';
    displayArea.style.display = 'flex';
  }

  function commitManualEdit() {
    const raw = manualInput.value.trim();
    const newMoment = parseFlexibleDateTime(raw);
    if (newMoment && newMoment.isValid()) {
      currentMoment = newMoment;
      updateDisplay(currentMoment);
    } else {
      manualInput.value = hiddenInput.value;
      notice('日期时间格式无效，已恢复');
    }
    exitManualMode();
  }

  // 效率#4②：单击立即开滚轮（原 200ms 延迟只为给 dblclick 留判定窗口，手输已有显性入口）
  displayArea.addEventListener('click', openUnifiedPicker);
  displayArea.addEventListener('dblclick', enterManualMode); // 旧双击入口保留兼容
  displayArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openUnifiedPicker();
    }
  });

  // D-UI16：软键盘遮挡——手输聚焦加 .keyboard-up（弹窗上移档），blur 提交时移除
  manualInput.addEventListener('focus', () => setKeyboardUp(true));
  manualInput.addEventListener('blur', commitManualEdit);
  manualInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitManualEdit();
    }
  });

  container.appendChild(displayArea);
  // 常驻快捷 chip「此刻 / 昨天」已按用户要求移除（2026-09-19）；滚轮弹层内「此刻」钮保留
  container.appendChild(manualInput);
  container.appendChild(hiddenInput);
  return container;
}
