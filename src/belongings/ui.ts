/**
 * 归物本 UI（归物本.js 逐字移植）
 * 主面板：__gui_wu_ben__（visibility 控制，不销毁）；弹窗 z-index：add=10000/edit=10001/delete=10002/sort=10003；
 * 长按 600ms 删除 / 单击 <500ms 编辑；MutationObserver 主题变化重渲染。
 */
import { Notice } from 'obsidian';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { formatRelativeTime } from '../core/utils';
import { checkAndShowChangelog } from '../core/changelog';
import { loadDatabase, saveDatabase, calculateDailyCost, calculateDaysUsed } from './data';
import type { BelongingsDatabase, BelongingsItem } from './types';

// ----- 模块状态（原脚本全局变量） -----
let database: BelongingsDatabase | null = null;
let listContainer: HTMLDivElement | null = null;
let sortField = 'purchase_date'; // 默认按购买日期
let sortOrder = 'desc'; // 降序
let isDarkMode = false;

// ----- 渲染主界面 -----
function render() {
  if (!listContainer) return;
  const app = getApp();
  isDarkMode = document.body.classList.contains('theme-dark');
  // ----- 排序：根据当前 sortField 和 sortOrder -----
  let items = Object.values(database!.items);
  items.sort((a: any, b: any) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalValue = items.reduce((sum, item) => sum + item.purchase_price, 0);
  const totalDailyCost = items.reduce((sum, item) => {
    return sum + parseFloat(calculateDailyCost(item.purchase_price, item.purchase_date));
  }, 0);

  // 按状态分组，但保持全局排序顺序
  const statusMap: Record<string, any[]> = { '使用中': [], '闲置': [], '已转卖': [], '已丢弃': [] };
  items.forEach((item) => {
    if (statusMap[item.current_status]) statusMap[item.current_status].push(item);
  });

  const bg = isDarkMode ? '#1e1e1e' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const cardBg = isDarkMode ? '#2d2d2d' : '#ffffff';
  const muted = isDarkMode ? '#b0b0b0' : '#666666';
  const border = isDarkMode ? '#404040' : '#e0e0e0';

  let html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 15px; background: ${bg}; min-height: 100vh; color: ${textColor};">
    <!-- 统计卡片 -->
    <div style="background: linear-gradient(135deg, #3498db, #2ecc71); border-radius: 15px; padding: 20px; color: white; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(52,152,219,0.2);">
      <div style="margin-bottom: 15px;">
        <div style="font-size: 14px; opacity: 0.9;">总资产</div>
        <div style="font-size: 28px; font-weight: bold;">￥${totalValue.toFixed(2)}</div>
      </div>
      <div>
        <div style="font-size: 14px; opacity: 0.9;">日均成本</div>
        <div style="font-size: 20px; font-weight: bold;">￥${totalDailyCost.toFixed(2)}/天</div>
      </div>
    </div>
    <!-- 状态统计 -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
      ${['使用中', '闲置', '已转卖', '已丢弃'].map((status) => {
        const count = statusMap[status]?.length || 0;
        const icon = { '使用中': '✅', '闲置': '📦', '已转卖': '💰', '已丢弃': '🗑' }[status];
        const color = { '使用中': '#2ecc71', '闲置': '#f39c12', '已转卖': '#9b59b6', '已丢弃': '#e74c3c' }[status];
        return `<div style="background: ${cardBg}; border-radius: 12px; padding: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid ${border};">
          <div style="font-size: 20px; color: ${color};">${icon}</div>
          <div style="font-size: 16px; font-weight: bold; color: ${textColor};">${count}</div>
          <div style="font-size: 11px; color: ${muted};">${status}</div>
        </div>`;
      }).join('')}
    </div>
    <!-- 物品列表 -->
    ${['使用中', '闲置', '已转卖', '已丢弃'].map((status) => {
      const list = statusMap[status] || [];
      if (list.length === 0) return '';
      const colors = isDarkMode
        ? ['linear-gradient(135deg,#1e4a5f,#1a6b4b)', 'linear-gradient(135deg,#5d3a6f,#1e4a5f)', 'linear-gradient(135deg,#8b2c20,#a85e1a)', 'linear-gradient(135deg,#117a60,#0e6e57)', 'linear-gradient(135deg,#a85e1a,#8b4a0a)', 'linear-gradient(135deg,#1e4a5f,#1a4a6b)']
        : ['linear-gradient(135deg,#3498db,#2ecc71)', 'linear-gradient(135deg,#9b59b6,#3498db)', 'linear-gradient(135deg,#e74c3c,#e67e22)', 'linear-gradient(135deg,#1abc9c,#16a085)', 'linear-gradient(135deg,#f39c12,#d35400)', 'linear-gradient(135deg,#3498db,#2980b9)'];
      return `
      <div style="margin-bottom: 20px;">
        <h2 style="color: ${textColor}; font-size: 16px; margin-bottom: 12px;">${status === '使用中' ? '✅ 使用中' : status === '闲置' ? '📦 闲置' : status === '已转卖' ? '💰 已转卖' : '🗑 已丢弃'}</h2>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${list.map((item, idx) => {
            const dailyCost = calculateDailyCost(item.purchase_price, item.purchase_date);
            const daysUsed = calculateDaysUsed(item.purchase_date);
            const catIcon = database!.categoryIcons[item.category] || '📦';
            const colorIdx = idx % colors.length;
            return `<div style="background: ${colors[colorIdx]}; border-radius: 15px; padding: 15px; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" data-id="${item.id}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="font-size: 24px;">${catIcon}</div>
                  <div>
                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 3px;">${item.name}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${item.category.replace(/^[^ ]+ /, '')}</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 16px; font-weight: bold;">￥${item.purchase_price.toFixed(2)}</div>
                  <div style="font-size: 14px; opacity: 0.9;">￥${dailyCost}/天</div>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
                <div style="font-size: 14px;">${daysUsed}天</div>
                <div style="font-size: 12px; opacity: 0.8;">${formatRelativeTime(item.purchase_date)}购买</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
    <div style="text-align: center; color: ${muted}; font-size: 11px; margin-top: 15px; padding-top: 15px; border-top: 1px solid ${border};">
      最后更新: ${new Date().toLocaleString('zh-CN')}
    </div>
  </div>
  `;

  listContainer.innerHTML = html;

  // 为每个物品卡片绑定事件
  listContainer.querySelectorAll('[data-id]').forEach((card) => {
    const id = (card as HTMLElement).dataset.id!;

    card.addEventListener('pointerdown', (e) => {
      const startTime = Date.now();
      let longPressTriggered = false;

      const timer = setTimeout(() => {
        longPressTriggered = true;
        deleteItemById(id); // 长按删除
      }, 600);

      const onPointerUp = () => {
        clearTimeout(timer);
        if (!longPressTriggered) {
          const elapsed = Date.now() - startTime;
          if (elapsed < 500) {
            // 单击（小于500ms视为单击）
            editItemById(id);
          }
        }
        // 清理一次性监听
        card.removeEventListener('pointerup', onPointerUp);
        card.removeEventListener('pointerleave', onPointerLeave);
      };

      const onPointerLeave = () => {
        clearTimeout(timer);
        card.removeEventListener('pointerup', onPointerUp);
        card.removeEventListener('pointerleave', onPointerLeave);
      };

      card.addEventListener('pointerup', onPointerUp);
      card.addEventListener('pointerleave', onPointerLeave);
    });
  });
}

// ----- 操作函数 -----

/** 创建搜索下拉分类（与添加/编辑一致，可复用 helper） */
function createSearchSelect(
  field: { placeholder?: string; value?: string; options: string[] },
  palette: { bg: string; text: string; border: string; inputBg: string; isDark: boolean }
): HTMLDivElement {
  const { bg, text, border, inputBg, isDark } = palette;
  const searchWrapper = document.createElement('div');
  searchWrapper.style.cssText = 'position: relative;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = field.placeholder || '搜索分类...';
  input.value = field.value || '';
  input.style.cssText = `
        width: 100%; padding: 8px 12px; border-radius: 6px;
        border: 1px solid ${border}; background: ${inputBg}; color: ${text};
        font-size: 14px; box-sizing: border-box;
      `;
  input.autocomplete = 'off';

  const dropdown = document.createElement('div');
  dropdown.style.cssText = `
        position: absolute; top: 100%; left: 0; right: 0;
        background: ${bg}; border: 1px solid ${border};
        border-radius: 6px; max-height: 200px; overflow-y: auto;
        display: none; z-index: 10002;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;

  const allOptions = field.options;
  const optionItems: HTMLDivElement[] = [];

  allOptions.forEach((opt) => {
    const item = document.createElement('div');
    item.textContent = opt;
    item.style.cssText = `
          padding: 6px 12px; cursor: pointer; font-size: 14px;
          color: ${text}; border-bottom: 1px solid ${border};
        `;
    item.addEventListener('mouseenter', () => {
      item.style.background = isDark ? '#3d3d3d' : '#e8e8e8';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });
    item.addEventListener('click', () => {
      input.value = opt;
      dropdown.style.display = 'none';
      input.dispatchEvent(new Event('input'));
    });
    dropdown.appendChild(item);
    optionItems.push(item);
  });

  searchWrapper.appendChild(input);
  searchWrapper.appendChild(dropdown);

  // 搜索过滤
  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    let hasVisible = false;
    optionItems.forEach((item) => {
      const text = item.textContent!.toLowerCase();
      if (text.includes(query)) {
        item.style.display = 'block';
        hasVisible = true;
      } else {
        item.style.display = 'none';
      }
    });
    dropdown.style.display = hasVisible ? 'block' : 'none';
  });

  // 聚焦显示下拉
  input.addEventListener('focus', () => {
    input.dispatchEvent(new Event('input'));
  });

  // 点击外部关闭
  document.addEventListener('click', function closeDropdown(e) {
    if (!searchWrapper.contains(e.target as Node)) {
      dropdown.style.display = 'none';
    }
  });

  // 键盘事件
  input.addEventListener('keydown', (e) => {
    const visibleItems = optionItems.filter((item) => item.style.display !== 'none');
    if (visibleItems.length === 0) return;
    let currentIdx = visibleItems.findIndex((item) => item.style.background !== 'transparent');
    if (currentIdx === -1) currentIdx = -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.min(currentIdx + 1, visibleItems.length - 1);
      visibleItems.forEach((item, idx) => {
        item.style.background = idx === newIdx ? (isDark ? '#3d3d3d' : '#e8e8e8') : 'transparent';
      });
      if (newIdx >= 0) visibleItems[newIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.max(currentIdx - 1, 0);
      visibleItems.forEach((item, idx) => {
        item.style.background = idx === newIdx ? (isDark ? '#3d3d3d' : '#e8e8e8') : 'transparent';
      });
      if (newIdx >= 0) visibleItems[newIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = visibleItems.find((item) => item.style.background !== 'transparent');
      if (selected) {
        input.value = selected.textContent!;
        dropdown.style.display = 'none';
        input.dispatchEvent(new Event('input'));
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  });

  // 保存引用以便获取值
  (input as any)._dropdown = dropdown;
  (input as any)._optionItems = optionItems;
  return searchWrapper;
}

/** 弹窗公共结构（遮罩/弹窗/色板） */
function createModalShell(
  zIndex: number,
  maxWidth: number,
  titleText: string
): {
  overlay: HTMLDivElement;
  modal: HTMLDivElement;
  palette: { bg: string; text: string; border: string; inputBg: string; isDark: boolean };
  resolve: (v?: unknown) => void;
  promise: Promise<unknown>;
} {
  const isDark = document.body.classList.contains('theme-dark');
  const bg = isDark ? '#1e1e1e' : '#ffffff';
  const text = isDark ? '#ffffff' : '#333333';
  const border = isDark ? '#404040' : '#e0e0e0';
  const inputBg = isDark ? '#2d2d2d' : '#f5f7fa';
  const palette = { bg, text, border, inputBg, isDark };

  const overlay = document.createElement('div');
  overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: ${zIndex};
      display: flex; align-items: center; justify-content: center;
    `;

  const modal = document.createElement('div');
  modal.style.cssText = `
      background: ${bg}; color: ${text};
      border-radius: 12px; width: 90%; max-width: ${maxWidth}px;
      padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      border: 1px solid ${border};
      max-height: 90vh; overflow-y: auto;
    `;

  const title = document.createElement('h3');
  title.textContent = titleText;
  title.style.cssText = 'margin: 0 0 20px 0; font-size: 20px;';
  modal.appendChild(title);

  let resolveFn: (v?: unknown) => void = () => {};
  const promise = new Promise((resolve) => {
    resolveFn = resolve;
  });

  document.body.appendChild(overlay);
  overlay.appendChild(modal);
  return { overlay, modal, palette, resolve: resolveFn, promise };
}

/** 编辑物品（单击卡片触发） */
function editItemById(id: string): Promise<void> {
  const item = database!.items[id];
  if (!item) {
    new Notice('物品不存在', 3000);
    return Promise.resolve();
  }

  // ----- 创建独立编辑弹窗 -----
  return new Promise((resolve) => {
    const { overlay, modal, palette, resolve: done } = createModalShell(10001, 480, '编辑物品');
    const { bg, text, border, inputBg, isDark } = palette;

    // 表单字段（预填当前值）
    const fields: { id: string; label: string; type: string; placeholder?: string; value?: any; options?: string[]; required?: boolean }[] = [
      { id: 'name', label: '📝 物品名称', type: 'text', placeholder: '请输入物品名称', value: item.name, required: true },
      { id: 'category', label: '📦 分类', type: 'search-select', options: database!.categories, value: item.category, placeholder: '输入搜索分类...' },
      { id: 'price', label: '💰 购买价格（元）', type: 'number', placeholder: '0.00', value: item.purchase_price.toString(), required: true },
      { id: 'date', label: '📅 购买日期', type: 'date', value: item.purchase_date, required: true },
      { id: 'status', label: '📌 当前状态', type: 'select', options: ['使用中', '闲置', '已转卖', '已丢弃'], value: item.current_status },
      { id: 'description', label: '📋 描述（可选）', type: 'textarea', placeholder: '规格、颜色、购买原因等...', value: item.description },
    ];

    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    const inputs: Record<string, any> = {};

    // ---- 构建表单 ----
    fields.forEach((field) => {
      const wrapper = document.createElement('div');

      const label = document.createElement('label');
      label.textContent = field.label;
      label.style.cssText = `display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: ${text};`;

      let input: any;

      if (field.type === 'search-select') {
        const searchWrapper = createSearchSelect(field as any, palette);
        const inputElement = searchWrapper.querySelector('input') as HTMLInputElement;
        inputElement.id = `edit-item-${field.id}`;
        wrapper.appendChild(label);
        wrapper.appendChild(searchWrapper);
        inputs[field.id] = inputElement;
        // 保存下拉选项以便获取
        (inputElement as any)._dropdown = searchWrapper.querySelector('div');
        (inputElement as any)._optionItems = Array.from((inputElement as any)._dropdown.querySelectorAll('div'));
        // 设置初始值后触发搜索以高亮匹配项
        setTimeout(() => {
          inputElement.dispatchEvent(new Event('input'));
        }, 0);
      } else if (field.type === 'select') {
        input = document.createElement('select');
        input.style.cssText = `
          width: 100%; padding: 8px 12px; border-radius: 6px;
          border: 1px solid ${border}; background: ${inputBg}; color: ${text};
          font-size: 14px; box-sizing: border-box;
        `;
        (field.options as string[]).forEach((opt) => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          if (opt === field.value) option.selected = true;
          input.appendChild(option);
        });
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        inputs[field.id] = input;
      } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.style.cssText = `
          width: 100%; padding: 8px 12px; border-radius: 6px;
          border: 1px solid ${border}; background: ${inputBg}; color: ${text};
          font-size: 14px; box-sizing: border-box; resize: vertical; min-height: 60px;
        `;
        input.placeholder = field.placeholder || '';
        input.value = field.value || '';
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        inputs[field.id] = input;
      } else {
        input = document.createElement('input');
        input.type = field.type;
        input.style.cssText = `
          width: 100%; padding: 8px 12px; border-radius: 6px;
          border: 1px solid ${border}; background: ${inputBg}; color: ${text};
          font-size: 14px; box-sizing: border-box;
        `;
        if (field.placeholder) input.placeholder = field.placeholder;
        if (field.value !== undefined && field.value !== null) input.value = field.value;
        if (field.type === 'number') input.step = '0.01';
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        inputs[field.id] = input;
      }

      if (field.required) input.required = true;
      form.appendChild(wrapper);
    });

    // 按钮容器
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 8px 20px; border-radius: 6px; border: 1px solid ${border};
      background: transparent; color: ${text}; cursor: pointer; font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      done();
    });

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 保存';
    saveBtn.style.cssText = `
      padding: 8px 20px; border-radius: 6px; border: none;
      background: var(--interactive-accent); color: white; cursor: pointer; font-size: 14px; font-weight: 500;
    `;

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    modal.appendChild(form);
    modal.appendChild(btnRow);
    escManager.register('belongings-modal', {
      isVisible: () => overlay.isConnected,
      close: () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        done();
      },
    });

    // ---- 提交保存 ----
    saveBtn.addEventListener('click', async () => {
      const name = inputs.name.value.trim();
      if (!name) {
        new Notice('请输入物品名称', 3000);
        return;
      }
      const price = parseFloat(inputs.price.value);
      if (isNaN(price) || price < 0) {
        new Notice('请输入有效的价格', 3000);
        return;
      }
      const date = inputs.date.value;
      if (!date) {
        new Notice('请选择购买日期', 3000);
        return;
      }

      // 获取分类（可能是 search-select 输入框的值）
      let category = inputs.category.value.trim();
      if (!category) {
        new Notice('请选择或输入分类', 3000);
        return;
      }

      // 更新 item
      item.name = name;
      item.category = category;
      item.purchase_price = price;
      item.purchase_date = date;
      item.current_status = inputs.status.value;
      item.description = inputs.description.value.trim();
      item.last_updated = new Date().toISOString();

      await saveDatabase(database!);
      render();
      new Notice(`✅ 物品 "${name}" 编辑成功！`, 3000);

      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      done();
      resolve();
    });

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        done();
        resolve();
      }
    });

    // 回车提交（忽略搜索输入框）
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        if ((e.target as HTMLElement).id && (e.target as HTMLElement).id.startsWith('edit-item-category')) return;
        e.preventDefault();
        saveBtn.click();
      }
    });

    // 聚焦名称输入框
    setTimeout(() => inputs.name.focus(), 100);
  });
}

/** 删除物品（长按卡片触发，带确认弹窗） */
function deleteItemById(id: string): Promise<void> {
  const item = database!.items[id];
  if (!item) {
    new Notice('物品不存在', 3000);
    return Promise.resolve();
  }

  // ----- 创建独立确认弹窗 -----
  return new Promise((resolve) => {
    const { overlay, modal, palette, resolve: done } = createModalShell(10002, 400, '确认删除');
    const { bg, text, border, isDark } = palette;

    modal.style.maxHeight = 'none';
    modal.style.overflow = 'visible';

    const message = document.createElement('p');
    message.textContent = `确定要删除物品「${item.name}」吗？此操作不可撤销。`;
    message.style.cssText = `margin: 0 0 20px 0; font-size: 14px; color: ${isDark ? '#b0b0b0' : '#666'};`;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 8px 20px; border-radius: 6px; border: 1px solid ${border};
      background: transparent; color: ${text}; cursor: pointer; font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      done();
      resolve();
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '🗑 删除';
    confirmBtn.style.cssText = `
      padding: 8px 20px; border-radius: 6px; border: none;
      background: #e74c3c; color: white; cursor: pointer; font-size: 14px; font-weight: 500;
    `;
    confirmBtn.addEventListener('click', async () => {
      delete database!.items[id];
      await saveDatabase(database!);
      render();
      new Notice(`已删除 "${item.name}"`);
      document.body.removeChild(overlay);
      done();
      resolve();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);

    modal.appendChild(message);
    modal.appendChild(btnRow);
    escManager.register('belongings-modal', {
      isVisible: () => overlay.isConnected,
      close: () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        done();
        resolve();
      },
    });

    // 点击遮罩关闭（等同于取消）
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        done();
        resolve();
      }
    });

    // 回车确认
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      } else if (e.key === 'Escape') {
        cancelBtn.click();
      }
    });

    // 聚焦删除按钮（防止误触）
    setTimeout(() => confirmBtn.focus(), 100);
  });
}

// ----- 排序弹窗 -----
export function showSortModal(): Promise<void> {
  return new Promise((resolve) => {
    const { overlay, modal, palette, resolve: done } = createModalShell(10003, 480, '排序设置');
    const { bg, text, border } = palette;
    modal.style.maxHeight = 'none';
    modal.style.overflow = 'visible';

    // ---- 排序按钮容器 ----
    const sortGroup = document.createElement('div');
    sortGroup.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;';

    // 定义排序选项（与书库类似）
    const sortOptions = [
      { label: '名称 ↑', field: 'name', order: 'asc' },
      { label: '名称 ↓', field: 'name', order: 'desc' },
      { label: '价格 ↑', field: 'purchase_price', order: 'asc' },
      { label: '价格 ↓', field: 'purchase_price', order: 'desc' },
      { label: '日期 ↑', field: 'purchase_date', order: 'asc' },
      { label: '日期 ↓', field: 'purchase_date', order: 'desc' },
      { label: '状态 ↑', field: 'current_status', order: 'asc' },
      { label: '状态 ↓', field: 'current_status', order: 'desc' },
    ];
    const accent = 'var(--interactive-accent)';

    sortOptions.forEach((opt) => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      btn.style.cssText = `
        padding: 6px 14px; border-radius: 20px; border: 1px solid ${border};
        background: var(--background-secondary); color: ${text};
        cursor: pointer; font-size: 0.85rem;
        transition: all 0.15s;
        box-shadow: none;
      `;
      // 高亮当前选中的排序
      if (sortField === opt.field && sortOrder === opt.order) {
        btn.style.background = accent;
        btn.style.color = 'white';
        btn.style.borderColor = accent;
      }
      btn.addEventListener('click', () => {
        sortField = opt.field;
        sortOrder = opt.order;
        render();
        document.body.removeChild(overlay);
        done();
        resolve();
      });
      sortGroup.appendChild(btn);
    });

    // ---- 底部按钮（关闭） ----
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = `
      padding: 8px 20px; border-radius: 6px; border: 1px solid ${border};
      background: transparent; color: ${text}; cursor: pointer; font-size: 14px;
    `;
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      done();
      resolve();
    });

    btnRow.appendChild(closeBtn);

    modal.appendChild(sortGroup);
    modal.appendChild(btnRow);
    escManager.register('belongings-modal', {
      isVisible: () => overlay.isConnected,
      close: () => closeBtn.click(),
    });

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        done();
        resolve();
      }
    });

    // ESC 关闭
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeBtn.click();
      }
    });
  });
}

/** 添加物品（弹窗） */
export function addItem(): Promise<void> {
  return new Promise((resolve) => {
    const { overlay, modal, palette, resolve: done } = createModalShell(10000, 480, '添加物品');
    const { bg, text, border, inputBg, isDark } = palette;

    // --- 修改 fields：将分类类型改为 'search-select' ---
    const fields: { id: string; label: string; type: string; placeholder?: string; default?: string; options?: string[]; required?: boolean }[] = [
      { id: 'name', label: '📝 物品名称', type: 'text', placeholder: '请输入物品名称', required: true },
      { id: 'category', label: '📦 分类', type: 'search-select', options: database!.categories, placeholder: '输入搜索分类...' },
      { id: 'price', label: '💰 购买价格（元）', type: 'number', placeholder: '0.00', required: true },
      { id: 'date', label: '📅 购买日期', type: 'date', default: new Date().toISOString().split('T')[0] },
      { id: 'status', label: '📌 当前状态', type: 'select', options: ['使用中', '闲置', '已转卖', '已丢弃'] },
      { id: 'description', label: '📋 描述（可选）', type: 'textarea', placeholder: '规格、颜色、购买原因等...' },
    ];

    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    const inputs: Record<string, any> = {};

    fields.forEach((field) => {
      const wrapper = document.createElement('div');

      const label = document.createElement('label');
      label.textContent = field.label;
      label.style.cssText = `display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: ${text};`;

      let input: any;

      if (field.type === 'search-select') {
        // 创建输入框和下拉列表容器
        const searchWrapper = document.createElement('div');
        searchWrapper.style.cssText = 'position: relative;';

        input = document.createElement('input');
        input.type = 'text';
        input.placeholder = field.placeholder || '搜索分类...';
        input.style.cssText = `
          width: 100%; padding: 8px 12px; border-radius: 6px;
          border: 1px solid ${border}; background: ${inputBg}; color: ${text};
          font-size: 14px; box-sizing: border-box;
        `;
        input.autocomplete = 'off';

        // 下拉列表容器
        const dropdown = document.createElement('div');
        dropdown.style.cssText = `
          position: absolute; top: 100%; left: 0; right: 0;
          background: ${bg}; border: 1px solid ${border};
          border-radius: 6px; max-height: 200px; overflow-y: auto;
          display: none; z-index: 10001;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        // 填充选项
        const allOptions = field.options || [];
        const optionItems: HTMLDivElement[] = [];

        allOptions.forEach((opt) => {
          const item = document.createElement('div');
          item.textContent = opt;
          item.style.cssText = `
            padding: 6px 12px; cursor: pointer; font-size: 14px;
            color: ${text}; border-bottom: 1px solid ${border};
          `;
          item.addEventListener('mouseenter', () => {
            item.style.background = isDark ? '#3d3d3d' : '#e8e8e8';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
          });
          item.addEventListener('click', () => {
            input.value = opt;
            dropdown.style.display = 'none';
            // 触发输入事件以便验证
            input.dispatchEvent(new Event('input'));
          });
          dropdown.appendChild(item);
          optionItems.push(item);
        });

        searchWrapper.appendChild(input);
        searchWrapper.appendChild(dropdown);
        wrapper.appendChild(label);
        wrapper.appendChild(searchWrapper);

        // 搜索过滤
        input.addEventListener('input', () => {
          const query = input.value.toLowerCase().trim();
          let hasVisible = false;
          optionItems.forEach((item) => {
            const text = item.textContent!.toLowerCase();
            if (text.includes(query)) {
              item.style.display = 'block';
              hasVisible = true;
            } else {
              item.style.display = 'none';
            }
          });
          dropdown.style.display = hasVisible ? 'block' : 'none';
        });

        // 点击输入框显示下拉
        input.addEventListener('focus', () => {
          // 重新触发过滤以显示所有项
          input.dispatchEvent(new Event('input'));
        });

        // 点击外部关闭下拉
        document.addEventListener('click', function closeDropdown(e) {
          if (!searchWrapper.contains(e.target as Node)) {
            dropdown.style.display = 'none';
          }
        });

        // 键盘事件：上下键选择，回车确认
        input.addEventListener('keydown', (e) => {
          const visibleItems = optionItems.filter((item) => item.style.display !== 'none');
          if (visibleItems.length === 0) return;
          let currentIdx = visibleItems.findIndex((item) => item.style.background !== 'transparent');
          if (currentIdx === -1) currentIdx = -1;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const newIdx = Math.min(currentIdx + 1, visibleItems.length - 1);
            visibleItems.forEach((item, idx) => {
              item.style.background = idx === newIdx ? (isDark ? '#3d3d3d' : '#e8e8e8') : 'transparent';
            });
            if (newIdx >= 0) visibleItems[newIdx].scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const newIdx = Math.max(currentIdx - 1, 0);
            visibleItems.forEach((item, idx) => {
              item.style.background = idx === newIdx ? (isDark ? '#3d3d3d' : '#e8e8e8') : 'transparent';
            });
            if (newIdx >= 0) visibleItems[newIdx].scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = visibleItems.find((item) => item.style.background !== 'transparent');
            if (selected) {
              input.value = selected.textContent!;
              dropdown.style.display = 'none';
              input.dispatchEvent(new Event('input'));
            }
          } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
          }
        });

        // 保存下拉引用以便后续清理（可选）
        inputs[field.id] = input;
        // 保存选项列表以便后续使用（例如获取选中值）
        (input as any)._dropdownOptions = optionItems;
        // 将 dropdown 保存在 input 上以便后续清理
        (input as any)._dropdown = dropdown;

      } else if (field.type === 'select') {
        // 普通 select 保持不变
        input = document.createElement('select');
        input.style.cssText = `
          width: 100%; padding: 8px 12px; border-radius: 6px;
          border: 1px solid ${border}; background: ${inputBg}; color: ${text};
          font-size: 14px; box-sizing: border-box;
        `;
        (field.options || []).forEach((opt: string) => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          input.appendChild(option);
        });
        wrapper.appendChild(label);
        wrapper.appendChild(input);
      } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.style.cssText = `
          width: 100%; padding: 8px 12px; border-radius: 6px;
          border: 1px solid ${border}; background: ${inputBg}; color: ${text};
          font-size: 14px; box-sizing: border-box; resize: vertical; min-height: 60px;
        `;
        input.placeholder = field.placeholder || '';
        wrapper.appendChild(label);
        wrapper.appendChild(input);
      } else {
        // text, number, date
        input = document.createElement('input');
        input.type = field.type;
        input.style.cssText = `
          width: 100%; padding: 8px 12px; border-radius: 6px;
          border: 1px solid ${border}; background: ${inputBg}; color: ${text};
          font-size: 14px; box-sizing: border-box;
        `;
        if (field.placeholder) input.placeholder = field.placeholder;
        if (field.default) input.value = field.default;
        if (field.type === 'number') input.step = '0.01';
        wrapper.appendChild(label);
        wrapper.appendChild(input);
      }

      if (field.required) input.required = true;
      form.appendChild(wrapper);
      inputs[field.id] = input;
    });

    // 按钮容器
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 8px 20px; border-radius: 6px; border: 1px solid ${border};
      background: transparent; color: ${text}; cursor: pointer; font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      done();
      resolve();
    });

    const submitBtn = document.createElement('button');
    submitBtn.textContent = '✅ 保存';
    submitBtn.style.cssText = `
      padding: 8px 20px; border-radius: 6px; border: none;
      background: var(--interactive-accent); color: white; cursor: pointer; font-size: 14px; font-weight: 500;
    `;

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(submitBtn);

    modal.appendChild(form);
    modal.appendChild(btnRow);
    escManager.register('belongings-modal', {
      isVisible: () => overlay.isConnected,
      close: () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        done();
        resolve();
      },
    });

    // 提交事件
    submitBtn.addEventListener('click', async () => {
      const name = inputs.name.value.trim();
      if (!name) {
        new Notice('请输入物品名称', 3000);
        return;
      }
      const price = parseFloat(inputs.price.value);
      if (isNaN(price) || price < 0) {
        new Notice('请输入有效的价格', 3000);
        return;
      }
      const date = inputs.date.value;
      if (!date) {
        new Notice('请选择购买日期', 3000);
        return;
      }

      // 获取分类值：如果是 search-select，取输入框的值；否则取 select 的值
      let category = inputs.category.value.trim();
      // 如果分类不在现有列表中，但用户输入了，我们仍然使用（允许自定义）
      if (!category) {
        new Notice('请选择或输入分类', 3000);
        return;
      }

      const newItem = {
        id: `item_${Date.now()}`,
        name: name,
        category: category,
        purchase_price: price,
        purchase_date: date,
        current_status: inputs.status.value,
        description: inputs.description.value.trim(),
        created_date: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };

      database!.items[newItem.id] = newItem;
      await saveDatabase(database!);
      render();
      new Notice(`✅ 物品 "${name}" 添加成功！`, 3000);

      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      done();
      resolve();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        done();
        resolve();
      }
    });

    modal.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement).tagName;
      const type = (e.target as HTMLInputElement).type;
      if (e.key === 'Enter' && tag !== 'TEXTAREA' && tag !== 'INPUT' && type !== 'text') {
        // 忽略在搜索输入框中的回车，由键盘事件处理
        if ((e.target as HTMLElement).id === 'add-item-category') return;
        e.preventDefault();
        submitBtn.click();
      }
    });

    setTimeout(() => inputs.name.focus(), 100);
  });
}

// ----- 创建主弹窗 -----
export async function openBelongingsPanel(): Promise<void> {
  checkAndShowChangelog('belongings');
  const app = getApp();

  if (document.getElementById('__gui_wu_ben__')) {
    (document.getElementById('__gui_wu_ben__') as HTMLElement).style.visibility = 'visible';
    // 重新加载数据并渲染
    database = await loadDatabase();
    render();
    return;
  }

  database = await loadDatabase();

  const overlay = document.createElement('div');
  overlay.id = '__gui_wu_ben__';
  overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
    `;

  const modal = document.createElement('div');
  modal.style.cssText = `
      background: var(--background-primary); color: var(--text-normal);
      border-radius: 12px; width: 100%; max-width: 600px; height: 90vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    `;
  if (window.innerWidth <= 768) {
    modal.style.height = '100vh';
    modal.style.borderRadius = '0';
    modal.style.maxWidth = '100%';
    modal.style.paddingTop = '24px';
  }

  // 头部
  const header = document.createElement('div');
  header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 0 26px;
    `;
  header.innerHTML = '<p style="font-size:.8rem;">归物本</p>';

  const headerButtons = document.createElement('div');
  headerButtons.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const addBtn = document.createElement('button');
  addBtn.textContent = '✏️';
  addBtn.style.cssText = `background: none; border: none; font-size: .7rem;
    cursor: pointer; color: var(--text-muted);
    box-shadow: none;
    padding: 0;
    margin-left: 3px;`;
  addBtn.addEventListener('click', async () => {
    await addItem();
    render();
  });

  const sortBtn = document.createElement('button');
  sortBtn.textContent = '⚙️';
  sortBtn.style.cssText = ` background: none; border: none; font-size: .7rem;
    cursor: pointer; color: var(--text-muted);
    box-shadow: none;
    padding: 0;
    margin-left: 3px;`;
  sortBtn.addEventListener('click', async () => {
    await showSortModal();
  });

  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '⏳';
  refreshBtn.style.cssText = ` background: none; border: none; font-size: .7rem;
    cursor: pointer; color: var(--text-muted);
    box-shadow: none;
    padding: 0;
    margin-left: 3px;`;
  refreshBtn.addEventListener('click', async () => {
    database = await loadDatabase();
    render();
    new Notice('已刷新');
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '❌';
  closeBtn.style.cssText = ` background: none; border: none; font-size: .6rem;
    cursor: pointer; color: var(--text-muted);
    box-shadow: none;
    padding: 0;
    margin-left: 3px;`;
  closeBtn.addEventListener('click', () => {
    (overlay as HTMLElement).style.visibility = 'hidden';
  });

  headerButtons.appendChild(addBtn);
  headerButtons.appendChild(refreshBtn);
  headerButtons.appendChild(sortBtn);
  headerButtons.appendChild(closeBtn);
  header.appendChild(headerButtons);

  // 列表容器
  listContainer = document.createElement('div');
  listContainer.style.cssText = 'flex:1; overflow-y: auto; padding: 8px 16px;';

  modal.appendChild(header);
  modal.appendChild(listContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // 点击外部关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.visibility = 'hidden';
  });
  // ESC 关闭（全局注册表，同 ID 去重）
  escManager.register('belongings', {
    isVisible: () => {
      const el = document.getElementById('__gui_wu_ben__');
      return !!el && el.style.visibility === 'visible';
    },
    close: () => {
      const el = document.getElementById('__gui_wu_ben__');
      if (el) el.style.visibility = 'hidden';
    },
  });

  // 初次渲染
  render();

  // 主题变化监听
  const themeObserver = new MutationObserver(() => {
    render();
  });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('beforeunload', () => themeObserver.disconnect());
}

/** 命令回调体：belongings-add-item（面板不打开，直接弹添加） */
export async function addBelongingsItemCommand(): Promise<void> {
  if (!database) database = await loadDatabase();
  void addItem(); // 弹窗 promise 在使用者关闭时 resolve，命令回调不等待
}

/** 卸载清理：移除主面板 DOM */
export function cleanupBelongings(): void {
  const el = document.getElementById('__gui_wu_ben__');
  if (el) el.remove();
  listContainer = null;
  database = null;
}
