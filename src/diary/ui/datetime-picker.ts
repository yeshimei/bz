/**
 * 滚轮日期时间选择器（原脚本 2629-3234）。
 */
import { Notice, moment } from 'obsidian';
import { escManager } from '../../core/esc-manager';
import { parseNaturalTime } from '../parser';

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
  wheelScrollContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    scrollbar-width: none;
    -ms-overflow-style: none;
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

  for (let i = min; i <= max; i++) {
    const item = document.createElement('div');
    item.className = 'datetime-number-item';
    item.dataset.value = String(i);
    item.textContent = i < 10 ? `0${i}` : String(i);
    item.style.cssText = `
      padding: 12px 8px;
      font-size: 18px;
      font-weight: 400;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
      width: 100%;
      text-align: center;
      border-radius: 8px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    `;
    items.push(item);
    numbersContainer.appendChild(item);
  }
  picker.numberItems[colIndex] = items;

  const updateSelection = () => {
    const currentVal = field.get(picker.tempMoment);
    items.forEach((item) => {
      const val = parseInt(item.dataset.value!);
      if (val === currentVal) {
        item.style.color = 'var(--text-on-accent)';
        item.style.fontWeight = '900';
        item.style.background = 'var(--text-muted)';
      } else {
        item.style.color = 'var(--text-muted)';
        item.style.fontWeight = '400';
        item.style.background = 'transparent';
      }
    });
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

  items.forEach((item) => {
    item.addEventListener('click', () => {
      const newVal = parseInt(item.dataset.value!);
      if (newVal !== field.get(picker.tempMoment)) {
        field.set(picker.tempMoment, newVal);
        if (field.unit === 'year' || field.unit === 'month') {
          const dayField = picker.fields.find((f) => f.unit === 'day');
          if (dayField) {
            const dayMax = picker.tempMoment.daysInMonth();
            const currentDay = dayField.get(picker.tempMoment);
            if (currentDay > dayMax) {
              dayField.set(picker.tempMoment, dayMax);
            }
            regenerateDayNumbers(picker);
          }
        }
        updateSelection();
      }
    });
  });

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
  return column;
}

// ===== 重建天数列（原 2785-2850） =====

function regenerateDayNumbers(picker: WheelPicker) {
  const dayField = picker.fields.find((f) => f.unit === 'day')!;
  const dayColIndex = picker.fields.findIndex((f) => f.unit === 'day');
  const dayItems = picker.numberItems[dayColIndex];
  const dayMin = 1;
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
    for (let i = currentCount + 1; i <= targetCount; i++) {
      const item = document.createElement('div');
      item.className = 'datetime-number-item';
      item.dataset.value = String(i);
      item.textContent = i < 10 ? `0${i}` : String(i);
      item.style.cssText = `
        padding: 12px 8px;
        font-size: 18px;
        font-weight: 400;
        color: var(--text-muted);
        cursor: pointer;
        user-select: none;
        transition: all 0.15s;
        width: 100%;
        text-align: center;
        border-radius: 8px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      `;

      item.addEventListener('click', () => {
        const newVal = parseInt(item.dataset.value!);
        if (newVal !== dayField.get(picker.tempMoment)) {
          dayField.set(picker.tempMoment, newVal);
          picker.columns[dayColIndex].updateSelection();
        }
      });

      container!.appendChild(item);
      dayItems.push(item);
    }
  }

  dayItems.forEach((item, index) => {
    const value = index + 1;
    item.dataset.value = String(value);
    item.textContent = value < 10 ? `0${value}` : String(value);
  });

  const currentDay = dayField.get(picker.tempMoment);
  if (currentDay > dayMax) {
    dayField.set(picker.tempMoment, dayMax);
  }

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

export function showDateTimePicker(initialMoment: any, onConfirm: (m: any) => void) {
  const existing = document.getElementById('unified-datetime-picker-mask');
  if (existing) existing.remove();

  const picker: WheelPicker = {
    tempMoment: initialMoment.clone(),
    fields: [
      {
        name: '年',
        unit: 'year',
        min: 2000,
        max: 2030,
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
    z-index: 10010;
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
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
  `;

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

  const todayBtn = document.createElement('button');
  todayBtn.textContent = '此刻';
  todayBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    flex: 1;
  `;
  todayBtn.onclick = () => {
    picker.tempMoment = moment();
    regenerateDayNumbers(picker);
    updateAllColumns(picker, true);
  };

  const okBtn = document.createElement('button');
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
  `;
  okBtn.onclick = () => {
    if (onConfirm) onConfirm(picker.tempMoment.clone());
    mask.remove();
  };

  btnContainer.appendChild(todayBtn);
  btnContainer.appendChild(okBtn);
  popup.appendChild(btnContainer);

  mask.appendChild(popup);
  document.body.appendChild(mask);

  updateAllColumns(picker, true);

  mask.addEventListener('click', (e) => {
    if (e.target === mask) mask.remove();
  });

  escManager.register('diary-datetime', { isVisible: () => mask.isConnected, close: () => mask.remove() });

  return mask;
}

// ===== 日期时间控件（原 3036-3213） =====

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
  manualInput.placeholder = 'YYYY-MM-DD HH:mm 或 1分钟前';
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
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

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
    showDateTimePicker(currentMoment, (newMoment) => {
      if (newMoment && newMoment.isValid()) {
        currentMoment = newMoment;
        updateDisplay(currentMoment);
      }
    });
  }

  function onSingleClick() {
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickTimer = null;
      openUnifiedPicker();
    }, 200);
  }

  function onDoubleClick() {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    if (isManualMode) return;
    isManualMode = true;
    displayArea.style.display = 'none';
    manualInput.style.display = 'block';
    manualInput.value = hiddenInput.value;
    manualInput.focus();
    manualInput.select();
  }

  displayArea.addEventListener('click', onSingleClick);
  displayArea.addEventListener('dblclick', onDoubleClick);

  function commitManualEdit() {
    const raw = manualInput.value.trim();
    let newMoment = parseNaturalTime(raw);
    if (!newMoment || !newMoment.isValid()) {
      newMoment = moment(raw, 'YYYY-MM-DD HH:mm', true);
    }
    if (newMoment && newMoment.isValid()) {
      currentMoment = newMoment;
      updateDisplay(currentMoment);
    } else {
      manualInput.value = hiddenInput.value;
      new Notice('日期时间格式无效，已恢复');
    }
    isManualMode = false;
    manualInput.style.display = 'none';
    displayArea.style.display = 'flex';
  }

  manualInput.addEventListener('blur', commitManualEdit);
  manualInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitManualEdit();
    }
  });

  container.appendChild(displayArea);
  container.appendChild(manualInput);
  container.appendChild(hiddenInput);
  return container;
}

// ===== 同步日期时间显示（原 3216-3234） =====

export function syncDateTime() {
  const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
  if (!hidden) return;
  const val = hidden.value;
  const m = moment(val, 'YYYY-MM-DD HH:mm', true);
  if (!m.isValid()) return;
  const container = hidden.closest('#add-diary-popup');
  if (!container) return;
  const yearSpan = container.querySelector('[data-part="year"]');
  const monthSpan = container.querySelector('[data-part="month"]');
  const daySpan = container.querySelector('[data-part="day"]');
  const hourSpan = container.querySelector('[data-part="hour"]');
  const minuteSpan = container.querySelector('[data-part="minute"]');
  if (yearSpan) yearSpan.textContent = m.format('YYYY');
  if (monthSpan) monthSpan.textContent = m.format('MM');
  if (daySpan) daySpan.textContent = m.format('DD');
  if (hourSpan) hourSpan.textContent = m.format('HH');
  if (minuteSpan) minuteSpan.textContent = m.format('mm');
}
