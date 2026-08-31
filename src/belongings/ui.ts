/**
 * 归物本 UI（归物本.js 逐字移植）
 * 主面板：__gui_wu_ben__（visibility 控制，不销毁，显示即 topifyZ 发号）；弹窗 z-index 动态发号（ADR-0067）：谁后打开谁在上；
 * 统一抽屉（桌面右键/移动长按）：状态流转 + 编辑 + 删除（用户拍板，替换原手写 pointerdown 长按删除/单击编辑）；
 * 刷新：右上角 ⏳ 按钮已移除 → 打开期间监听 belongings.json 变更自动刷新（用户拍板）；
 * MutationObserver 主题变化重渲染。
 */
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { allocZ, topifyZ } from '../core/z-order';
import { escapeHtml, formatRelativeTime } from '../core/utils';
import { tryGetSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
import {
  attachItemActions,
  refreshItemSheet,
  registerSheetCompanion,
  unregisterSheetCompanion,
  closeItemMenu,
  type ItemAction,
} from '../core/item-actions';
import { loadDatabase, saveDatabase, calculateDailyCost, calculateDaysUsed, getDataFilePath } from './data';
import type { BelongingsDatabase, BelongingsItem } from './types';
import { emitDomainEvent } from '../core/domain-bus';
import { belongingsEditChanges } from '../smartcat/belongings-source';
import type { SettingsSchema } from '../core/settings-schema';

/** 归物本设置 schema（ticket 131 声明式；空态域唯一内容为通用「移动端」组） */
export function belongingSettingsSchema(): SettingsSchema {
  return { groups: [mobileFullscreenGroup('belongingsMobileDefaultFullscreen', { desc: '' })] };
}

// ----- 类型 -----
/** 弹窗色板（createModalShell 返回值） */
interface ModalPalette {
  bg: string;
  text: string;
  border: string;
  inputBg: string;
  isDark: boolean;
}

/** 表单字段描述（添加/编辑共用） */
interface FormField {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  value?: any;
  default?: string;
  options?: string[];
  required?: boolean;
}


// ----- 模块状态（原脚本全局变量） -----

let database: BelongingsDatabase | null = null;
let listContainer: HTMLDivElement | null = null;
/** 抽屉来源的编辑（保存成功后关抽屉，与收藏本 Q8 同决策） */
let sheetEditPending = false;
/** 数据文件变更监听（打开期间注册，关闭注销——用户拍板"自动刷新"） */
let autoRefreshOff: (() => void) | null = null;
/** 主题变化监听（模块级持有，cleanupBelongings 时断开——防卸载残留） */
let bodyThemeObserver: MutationObserver | null = null;
/** 主题淡化渲染只关心 body 上的主题类（P44 去全量重渲染） */
const THEME_CLASSES = new Set(['theme-dark', 'theme-light']);
let sortField = 'purchase_date'; // 默认按购买日期
let sortOrder = 'desc'; // 降序

// ----- 渲染主界面 -----
function render() {
  if (!listContainer) return;
  const isDarkMode = document.body.classList.contains('theme-dark');

  // ----- 排序：根据当前 sortField 和 sortOrder -----
  const items = sortItems();
  const { totalValue, totalDailyCost, statusMap } = computeStats(items);

  const palette = {
    bg: isDarkMode ? '#1e1e1e' : '#ffffff',
    textColor: isDarkMode ? '#ffffff' : '#333333',
    cardBg: isDarkMode ? '#2d2d2d' : '#ffffff',
    muted: isDarkMode ? '#b0b0b0' : '#666666',
    border: isDarkMode ? '#404040' : '#e0e0e0',
    isDark: isDarkMode,
  };

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 15px; background: ${palette.bg}; min-height: 100vh; color: ${palette.textColor};">
    ${buildStatsHtml(palette, totalValue, totalDailyCost, statusMap)}
    ${items.length === 0 ? buildEmptyGuideHtml(palette) : buildItemGroupsHtml(palette, statusMap)}
    <div style="text-align: center; color: ${palette.muted}; font-size: 11px; margin-top: 15px; padding-top: 15px; border-top: 1px solid ${palette.border};">
      最后更新: ${new Date().toLocaleString('zh-CN')}
    </div>
  </div>
  `;

  listContainer.innerHTML = html;

  // 为每个物品卡片挂统一抽屉
  bindCardDrawers();
}

/** 排序：按当前 sortField/sortOrder 返回排序后的物品 */
function sortItems(): any[] {
  const items = Object.values(database!.items);
  items.sort((a: any, b: any) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
  return items;
}

/** 统计计算：总资产/日均成本/按状态分组（保持全局排序顺序） */
function computeStats(items: any[]): {
  totalValue: number;
  totalDailyCost: number;
  statusMap: Record<string, any[]>;
} {
  // P2 形状容错：purchase_price 缺失按 0 计，不再 NaN/TypeError
  const totalValue = items.reduce((sum: number, item: any) => sum + (item.purchase_price || 0), 0);
  const totalDailyCost = items.reduce((sum: number, item: any) => {
    return sum + parseFloat(calculateDailyCost(item.purchase_price || 0, item.purchase_date));
  }, 0);

  // 按状态分组，但保持全局排序顺序
  const statusMap: Record<string, any[]> = { '使用中': [], '闲置': [], '已转卖': [], '已丢弃': [] };
  items.forEach((item: any) => {
    if (statusMap[item.current_status]) statusMap[item.current_status].push(item);
  });
  return { totalValue, totalDailyCost, statusMap };
}

/** 统计 HTML：顶部渐变统计卡 + 状态计数四宫格 */
function buildStatsHtml(
  palette: { bg: string; textColor: string; cardBg: string; muted: string; border: string },
  totalValue: number,
  totalDailyCost: number,
  statusMap: Record<string, any[]>
): string {
  const { bg, textColor, cardBg, muted, border } = palette;
  return `
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
    </div>`;
}

/** 物品列表 HTML：按状态分组渲染渐变卡片 */
function buildItemGroupsHtml(
  palette: { textColor: string; muted: string; border: string; isDark: boolean },
  statusMap: Record<string, any[]>
): string {
  const { textColor, muted, border, isDark } = palette;
  return `
    <!-- 物品列表 -->
    ${['使用中', '闲置', '已转卖', '已丢弃'].map((status) => {
      const list = statusMap[status] || [];
      if (list.length === 0) return '';
      const colors = isDark
        ? ['linear-gradient(135deg,#1e4a5f,#1a6b4b)', 'linear-gradient(135deg,#5d3a6f,#1e4a5f)', 'linear-gradient(135deg,#8b2c20,#a85e1a)', 'linear-gradient(135deg,#117a60,#0e6e57)', 'linear-gradient(135deg,#a85e1a,#8b4a0a)', 'linear-gradient(135deg,#1e4a5f,#1a4a6b)']
        : ['linear-gradient(135deg,#3498db,#2ecc71)', 'linear-gradient(135deg,#9b59b6,#3498db)', 'linear-gradient(135deg,#e74c3c,#e67e22)', 'linear-gradient(135deg,#1abc9c,#16a085)', 'linear-gradient(135deg,#f39c12,#d35400)', 'linear-gradient(135deg,#3498db,#2980b9)'];
      return `
      <div style="margin-bottom: 20px;">
        <h2 style="color: ${textColor}; font-size: 16px; margin-bottom: 12px;">${status === '使用中' ? '✅ 使用中' : status === '闲置' ? '📦 闲置' : status === '已转卖' ? '💰 已转卖' : '🗑 已丢弃'}</h2>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${list.map((item, idx) => {
            const dailyCost = calculateDailyCost(item.purchase_price || 0, item.purchase_date);
            const daysUsed = calculateDaysUsed(item.purchase_date);
            // P0-8：名称/分类/分类图标过 escapeHtml（物品名含 HTML 时按文本渲染）；P2：字段兜底
            const catIcon = escapeHtml(database!.categoryIcons[item.category] || '📦');
            const catName = escapeHtml((item.category || '').replace(/^[^ ]+ /, ''));
            const colorIdx = idx % colors.length;
            return `<div style="background: ${colors[colorIdx]}; border-radius: 15px; padding: 15px; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" data-id="${escapeHtml(item.id)}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="font-size: 24px;">${catIcon}</div>
                  <div>
                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 3px;">${escapeHtml(item.name)}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${catName}</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 16px; font-weight: bold;">￥${(item.purchase_price ?? 0).toFixed(2)}</div>
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
    }).join('')}`;
}

/** 空态首步引导（l6-belongings）：零物品时提示点 ✏️ 添加第一个物品 */
function buildEmptyGuideHtml(palette: { textColor: string; muted: string; border: string }): string {
  const { textColor, muted, border } = palette;
  return `
    <div style="text-align:center;padding:32px 16px;border:1px dashed ${border};border-radius:12px;color:${muted};font-size:13px;">
      <div style="font-size:15px;color:${textColor};font-weight:600;margin-bottom:8px;">归物本还没有物品</div>
      点右上角 ✏️ 添加第一个物品
    </div>`;
}

/** 为物品卡片挂统一抽屉（桌面右键菜单 / 移动长按抽屉）：状态流转 + 编辑 + 删除 */
function bindCardDrawers(): void {
  if (!listContainer) return;
  listContainer.querySelectorAll('[data-id]').forEach((cardEl) => {
    const id = (cardEl as HTMLElement).dataset.id!;
    const item = database!.items[id];
    if (!item) return;
    const rebuild = () => refreshItemSheet(buildActions(item, rebuild), buildSheetHead(item));
    attachItemActions(cardEl as HTMLElement, buildActions(item, rebuild), { sheetHead: buildSheetHead(item) });
  });
}

/** 归物本抽屉动作：4 状态流转（当前状态不显示，keepOpen）→ 编辑 → 删除 */
function buildActions(item: BelongingsItem, rebuild: () => void): ItemAction[] {
  const acts: ItemAction[] = [];
  const STATUS_ICONS: Record<string, any> = {
    使用中: 'check-circle',
    闲置: 'package',
    已转卖: 'banknote',
    已丢弃: 'archive',
  };

  // 状态流转（归物本特色：常用操作，比进编辑改下拉快）
  for (const s of ['使用中', '闲置', '已转卖', '已丢弃']) {
    if (s === item.current_status) continue; // 当前状态不显示（头部已示）
    acts.push({
      icon: STATUS_ICONS[s],
      label: `标记为${s}`,
      keepOpen: true,
      onClick: () => {
        void (async () => {
          item.current_status = s;
          item.last_updated = new Date().toISOString();
          await saveAndRender();
          // ticket 079：状态流转通知 smartcat（4 态动词化，不防抖）
          emitDomainEvent('belongings', { kind: 'status', title: item.name, status: s });
          notice(`「${item.name}」已标记为${s}`, 'success');
          rebuild();
        })();
      },
    });
  }

  // 编辑（keepOpen：编辑弹窗叠抽屉；保存后关抽屉）
  acts.push({
    icon: 'pencil',
    label: '编辑',
    keepOpen: true,
    onClick: () => {
      sheetEditPending = true;
      void editItemById(item.id);
    },
  });

  // 删除（danger：点删除先收抽屉再弹确认）
  acts.push({
    icon: 'trash-2',
    label: '删除',
    kind: 'danger',
    onClick: () => {
      void deleteItemById(item.id);
    },
  });

  return acts;
}

/** 抽屉头部：分类 emoji + 名称 + 小字行（分类名 · 价格 · 天数），复用通用头部类 */
function buildSheetHead(item: BelongingsItem): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-item-sheet-entry';
  const body = document.createElement('div');
  body.style.cssText = 'display:flex; align-items:flex-start; gap:10px;';

  const catIcon = database!.categoryIcons[item.category] || '📦';
  const emoji = document.createElement('span');
  emoji.className = 'bz-item-sheet-emoji';
  emoji.textContent = catIcon;
  body.appendChild(emoji);

  const info = document.createElement('div');
  info.style.cssText = 'flex:1; min-width:0;';
  const title = document.createElement('div');
  title.className = 'bz-item-sheet-title';
  title.textContent = item.name;
  info.appendChild(title);
  const sub = document.createElement('div');
  sub.className = 'bz-item-sheet-sub';
  // P2 形状容错：脏数据缺字段不再 TypeError
  const catName = (item.category || '').replace(/^[^ ]+ /, '');
  const days = calculateDaysUsed(item.purchase_date);
  sub.textContent = `${catName} · ￥${(item.purchase_price ?? 0).toFixed(2)} · 已用 ${days} 天`;
  info.appendChild(sub);

  body.appendChild(info);
  head.appendChild(body);
  return head;
}


// ----- 操作函数 -----

/** 创建搜索下拉分类（与添加/编辑一致，可复用 helper） */
function createSearchSelect(
  field: FormField,
  palette: ModalPalette
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
  dropdown.className = 'bz-belongings-overlay--dropdown'; // 标识钩子（层级已动态发号 ADR-0067）
  dropdown.style.zIndex = String(allocZ()); // ADR-0067：动态发号（overlay 层叠上下文内最高，压过 modal 兄弟）
  dropdown.style.cssText = `
        position: absolute; top: 100%; left: 0; right: 0;
        background: ${bg}; border: 1px solid ${border};
        border-radius: 6px; max-height: 200px; overflow-y: auto;
        display: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;

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

  // 点击外部关闭（P2 监听泄漏修复：closeDropdown 引用化——弹窗销毁（searchWrapper 脱离文档）
  // 后首次点击自注销，不再永久挂在 document 上）
  const closeDropdown = (e: MouseEvent): void => {
    if (!searchWrapper.isConnected) {
      document.removeEventListener('click', closeDropdown);
      return;
    }
    if (!searchWrapper.contains(e.target as Node)) {
      dropdown.style.display = 'none';
    }
  };
  document.addEventListener('click', closeDropdown);

  // 键盘事件
  input.addEventListener('keydown', (e) => {
    const visibleItems = optionItems.filter((item) => item.style.display !== 'none');
    if (visibleItems.length === 0) return;
    let currentIdx = visibleItems.findIndex((item) => item.style.background !== 'transparent');


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
      // e1：下拉可见 → 只收下拉，不再冒泡到 escManager 连关整层弹窗（ESC 一次只关一层）；
      // 修 c3：下拉不可见/无匹配时放行冒泡，ESC 照常经 escManager 关弹窗/主面板（不留 ESC 死区）
      if (dropdown.style.display !== 'none') {
        e.stopImmediatePropagation();
        dropdown.style.display = 'none';
      }
    }
  });

  return searchWrapper;
}

/** 表单校验（添加/编辑共用）：返回错误消息或 null */
function validateForm(inputs: Record<string, any>): string | null {
  if (!inputs.name.value.trim()) return '请输入物品名称';
  const price = parseFloat(inputs.price.value);
  if (isNaN(price) || price < 0) return '请输入有效的价格';
  if (!inputs.date.value) return '请选择购买日期';
  if (!inputs.category.value.trim()) return '请选择或输入分类';
  return null;
}

/** 次要按钮（取消/关闭） */
function createSecondaryButton(
  text: string,
  palette: Pick<ModalPalette, 'text' | 'border'>,
  onClick: () => void
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = `
      padding: 8px 20px; border-radius: 6px; border: 1px solid ${palette.border};
      background: transparent; color: ${palette.text}; cursor: pointer; font-size: 14px;
    `;
  btn.addEventListener('click', onClick);
  return btn;
}

/** 主操作按钮（保存/删除等，自定义背景色） */
function createActionButton(
  text: string,
  background: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = `
      padding: 8px 20px; border-radius: 6px; border: none;
      background: ${background}; color: white; cursor: pointer; font-size: 14px; font-weight: 500;
    `;
  btn.addEventListener('click', onClick);
  return btn;
}

/** 构建表单（添加/编辑共用）；searchSelectInit 用于 search-select 字段的差异化初始化 */
function buildForm(
  fields: FormField[],
  palette: ModalPalette,
  searchSelectInit?: (input: HTMLInputElement, field: FormField) => void
): { form: HTMLDivElement; inputs: Record<string, any> } {
  const { text, border, inputBg } = palette;
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
      const searchWrapper = createSearchSelect(field, palette);
      const searchInput = searchWrapper.querySelector('input') as HTMLInputElement;
      if (searchSelectInit) searchSelectInit(searchInput, field);
      input = searchInput;
      wrapper.appendChild(label);
      wrapper.appendChild(searchWrapper);
    } else if (field.type === 'select') {
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
        if (opt === field.value) option.selected = true;
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
      input.value = field.value || '';
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
      else if (field.value !== undefined && field.value !== null) input.value = field.value;
      if (field.type === 'number') input.step = '0.01';
      wrapper.appendChild(label);
      wrapper.appendChild(input);
    }

    if (field.required) input.required = true;
    form.appendChild(wrapper);
    inputs[field.id] = input;
  });

  return { form, inputs };
}


/** 弹窗公共结构（遮罩/弹窗/色板） */
function createModalShell(maxWidth: number, titleText: string): {
  overlay: HTMLDivElement;
  modal: HTMLDivElement;
  palette: ModalPalette;
} {
  const isDark = document.body.classList.contains('theme-dark');
  const bg = isDark ? '#1e1e1e' : '#ffffff';
  const text = isDark ? '#ffffff' : '#333333';
  const border = isDark ? '#404040' : '#e0e0e0';
  const inputBg = isDark ? '#2d2d2d' : '#f5f7fa';
  const palette = { bg, text, border, inputBg, isDark };

  const overlay = document.createElement('div');
  overlay.className = 'bz-belongings-overlay--modal'; // 标识钩子（层级已动态发号 ADR-0067）
  overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
    `;
  overlay.style.zIndex = String(allocZ()); // ADR-0067：弹窗每次新建，创建即显示即发号（modal 为子节点随动）

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

  document.body.appendChild(overlay);
  overlay.appendChild(modal);
  return { overlay, modal, palette };
}

/** 编辑弹窗关闭路径统一清理：清抽屉编辑标志 + 注销附属浮层（取消/遮罩/ESC，抽屉保持） */
function closeSheetEditState(overlay: HTMLElement): void {
  if (sheetEditPending) {
    sheetEditPending = false;
    unregisterSheetCompanion(overlay);
  }
}

/** 编辑物品（单击卡片触发） */
function editItemById(id: string): Promise<void> {
  const item = database!.items[id];
  if (!item) {
    notice('物品不存在', 'warning');
    return Promise.resolve();
  }

  // ----- 创建独立编辑弹窗 -----
  return new Promise((resolve) => {
    // P0-7：抬到 11100 档——companion 编辑弹窗必须压过抽屉遮罩 10999 / 抽屉本体 11000
    const { overlay, modal, palette } = createModalShell(480, '编辑物品');
    // 抽屉来源的编辑：注册附属浮层（弹窗内点击不误关抽屉）
    if (sheetEditPending) registerSheetCompanion(overlay);

    // ticket 079：编辑前的 old 值快照（保存时直接改 item 引用，通知时比较生成 changes）
    const snapshot = { ...item };

    // 表单字段（预填当前值）
    const fields: FormField[] = [
      { id: 'name', label: '📝 物品名称', type: 'text', placeholder: '请输入物品名称', value: item.name, required: true },
      { id: 'category', label: '📦 分类', type: 'search-select', options: database!.categories, value: item.category, placeholder: '输入搜索分类...' },
      { id: 'price', label: '💰 购买价格（元）', type: 'number', placeholder: '0.00', value: item.purchase_price.toString(), required: true },
      { id: 'date', label: '📅 购买日期', type: 'date', value: item.purchase_date, required: true },
      { id: 'status', label: '📌 当前状态', type: 'select', options: ['使用中', '闲置', '已转卖', '已丢弃'], value: item.current_status },
      { id: 'description', label: '📋 描述（可选）', type: 'textarea', placeholder: '规格、颜色、购买原因等...', value: item.description },
    ];

    const { form, inputs } = buildForm(fields, palette, (input, field) => {
      // search-select：设置 id（回车处理识别）+ 初始化后触发搜索以高亮匹配项
      input.id = `edit-item-${field.id}`;
      setTimeout(() => {
        input.dispatchEvent(new Event('input'));
      }, 0);
    });

    // 按钮容器
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;';

    const cancelBtn = createSecondaryButton('取消', palette, () => {
      document.body.removeChild(overlay);
      closeSheetEditState(overlay);
      resolve();
    });

    const saveBtn = createActionButton('💾 保存', 'var(--interactive-accent)', async () => {
      const errMsg = validateForm(inputs);
      if (errMsg) {
        notice(errMsg, 'warning');
        return;
      }
      const name = inputs.name.value.trim();

      // 更新 item
      item.name = name;
      item.category = inputs.category.value.trim();
      item.purchase_price = parseFloat(inputs.price.value);
      item.purchase_date = inputs.date.value;
      item.current_status = inputs.status.value;
      item.description = inputs.description.value.trim();
      item.last_updated = new Date().toISOString();

      await saveAndRender();
      notice(`物品「${name}」已更新`, 'success');
      // ticket 079：编辑成功通知 smartcat（α 变化列表：snapshot vs 保存后的 item）
      emitDomainEvent('belongings', { kind: 'edit', title: name, changes: belongingsEditChanges(snapshot, item) });

      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      // 抽屉来源的编辑：保存成功后关抽屉（用户拍板）
      if (sheetEditPending) {
        closeSheetEditState(overlay);
        closeItemMenu();
      }
      resolve();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    modal.appendChild(form);
    modal.appendChild(btnRow);
    escManager.register('belongings-modal', {
      isVisible: () => overlay.isConnected,
      close: () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        closeSheetEditState(overlay);
        resolve();
      },
    });

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        closeSheetEditState(overlay);
        resolve();
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
    notice('物品不存在', 'warning');
    return Promise.resolve();
  }

  // ----- 创建独立确认弹窗 -----
  return new Promise((resolve) => {
    const { overlay, modal, palette } = createModalShell(400, '确认删除');
    const { isDark } = palette;

    modal.style.maxHeight = 'none';
    modal.style.overflow = 'visible';

    const message = document.createElement('p');
    message.textContent = `确定要删除物品「${item.name}」吗？此操作不可撤销。`;
    message.style.cssText = `margin: 0 0 20px 0; font-size: 14px; color: ${isDark ? '#b0b0b0' : '#666'};`;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px;';

    const cancelBtn = createSecondaryButton('取消', palette, () => {
      document.body.removeChild(overlay);
      resolve();
    });

    const confirmBtn = createActionButton('🗑 删除', '#e74c3c', async () => {
      delete database!.items[id];
      await saveAndRender();
      notice(`已删除「${item.name}」`, 'success');
      // ticket 079：删除成功通知 smartcat（仅标题）
      emitDomainEvent('belongings', { kind: 'delete', title: item.name });
      document.body.removeChild(overlay);
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
        resolve();
        resolve();
      },
    });

    // 点击遮罩关闭（等同于取消）
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve();
        resolve();
      }
    });

    // 回车处理（P1-38 + 修 c4：Enter 跟随当前焦点——焦点在「取消」→ 取消，不再焦点在取消却按 Enter 删除；
    // 焦点在「删除」或未聚焦 → 确认删除；preventDefault 与 edit/add 弹窗对齐，拦原生按钮激活防双发）
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (document.activeElement === cancelBtn) {
          cancelBtn.click();
        } else {
          confirmBtn.click();
        }
      } else if (e.key === 'Escape') {
        // e1：本地关确认弹窗即止，不再冒泡到 escManager 连关主面板（ESC 一次只关一层）
        e.stopImmediatePropagation();
        cancelBtn.click();
      }
    });

    // P19：默认焦点不落在「删除」按钮（防误触），落在「取消」
    setTimeout(() => cancelBtn.focus(), 100);
  });
}

// ----- 排序弹窗 -----
export function showSortModal(): Promise<void> {
  return new Promise((resolve) => {
    const { overlay, modal, palette } = createModalShell(480, '排序设置');
    const { text, border } = palette;
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
        resolve();
        resolve();
      });
      sortGroup.appendChild(btn);
    });

    // ---- 底部按钮（关闭） ----
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;';

    const closeBtn = createSecondaryButton('关闭', palette, () => {
      document.body.removeChild(overlay);
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
        resolve();
        resolve();
      }
    });

    // ESC 关闭
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // e1：本地关排序弹窗即止，不再冒泡到 escManager 连关主面板（ESC 一次只关一层）
        e.stopImmediatePropagation();
        closeBtn.click();
      }
    });
  });
}

/** 添加物品（弹窗） */
export function addItem(): Promise<void> {
  return new Promise((resolve) => {
    const { overlay, modal, palette } = createModalShell(480, '添加物品');

    const fields: FormField[] = [
      { id: 'name', label: '📝 物品名称', type: 'text', placeholder: '请输入物品名称', required: true },
      { id: 'category', label: '📦 分类', type: 'search-select', options: database!.categories, placeholder: '输入搜索分类...' },
      { id: 'price', label: '💰 购买价格（元）', type: 'number', placeholder: '0.00', required: true },
      { id: 'date', label: '📅 购买日期', type: 'date', default: new Date().toISOString().split('T')[0] },
      { id: 'status', label: '📌 当前状态', type: 'select', options: ['使用中', '闲置', '已转卖', '已丢弃'] },
      { id: 'description', label: '📋 描述（可选）', type: 'textarea', placeholder: '规格、颜色、购买原因等...' },
    ];

    const { form, inputs } = buildForm(fields, palette);

    // 按钮容器
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;';

    const cancelBtn = createSecondaryButton('取消', palette, () => {
      document.body.removeChild(overlay);
      resolve();
    });

    const submitBtn = createActionButton('✅ 保存', 'var(--interactive-accent)', async () => {
      const errMsg = validateForm(inputs);
      if (errMsg) {
        notice(errMsg, 'warning');
        return;
      }
      const name = inputs.name.value.trim();

      const newItem = {
        id: `item_${Date.now()}`,
        name: name,
        category: inputs.category.value.trim(),
        purchase_price: parseFloat(inputs.price.value),
        purchase_date: inputs.date.value,
        current_status: inputs.status.value,
        description: inputs.description.value.trim(),
        created_date: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };

      database!.items[newItem.id] = newItem;
      await saveAndRender();
      notice(`物品「${name}」已添加`, 'success');
      // ticket 079：添加成功通知 smartcat（键值式完整信息，字段有才加）
      emitDomainEvent('belongings', { kind: 'add', item: newItem });

      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      resolve();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(submitBtn);

    modal.appendChild(form);
    modal.appendChild(btnRow);
    escManager.register('belongings-modal', {
      isVisible: () => overlay.isConnected,
      close: () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        resolve();
        resolve();
      },
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve();
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

/** 本会话写盘标记（P44 去双渲染）：saveAndRender 保存期间置位，modify 事件自写短路吸收 */
let selfWritePending = false;

/** 保存 + 渲染单点入口：先置写盘标记再保存，事件型自动刷新对自写出让（不再重载重渲染）；
 *  外部修改（非本会话写盘）仍走 startAutoRefresh 的 modify 路径重载。 */
async function saveAndRender(): Promise<void> {
  selfWritePending = true;
  try {
    await saveDatabase(database!);
  } finally {
    selfWritePending = false;
  }
  render();
}

/** 打开期间监听数据文件变更自动刷新（用户拍板：去 ⏳ 按钮改实时）；面板隐藏时注销。
 *  监听对象是 belongings.json（json 数据文件）：域事件总线一期仅收编 md 事件不覆盖，维持原生订阅（ADR-0048 边界）。 */
function startAutoRefresh(): void {
  stopAutoRefresh();
  const app = getApp();
  const off = app.vault.on('modify', (file: any) => {
    if (file && file.path === getDataFilePath()) {
      // 自写短路（P44 去双渲染）：本会话 saveAndRender 已渲染，事件型刷新不再重载重渲染
      if (selfWritePending) {
        selfWritePending = false;
        return;
      }
      void (async () => {
        database = await loadDatabase();
        render();
      })();
    }
  });
  autoRefreshOff = () => app.vault.offref(off);
}

/** 停止数据文件变更监听（幂等） */
function stopAutoRefresh(): void {
  if (autoRefreshOff) {
    autoRefreshOff();
    autoRefreshOff = null;
  }
}

// ----- 创建主弹窗 -----
export async function openBelongingsPanel(): Promise<void> {
  const app = getApp();

  if (document.getElementById('__gui_wu_ben__')) {
    const overlayEl = document.getElementById('__gui_wu_ben__') as HTMLElement;
    // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等，对已存在面板同样生效），关=常规卡
    applyMobileWindowFullscreen(overlayEl.firstElementChild as HTMLElement | null, tryGetSettings().belongingsMobileDefaultFullscreen === true);
    topifyZ(overlayEl); // ADR-0067：显示即发号，谁后显示谁在上（modal 为子节点随动）
    overlayEl.style.visibility = 'visible';
    // 重新加载数据并渲染
    database = await loadDatabase();
    render();
    startAutoRefresh();
    return;
  }

  database = await loadDatabase();

  const overlay = document.createElement('div');
  overlay.id = '__gui_wu_ben__';
  overlay.className = 'bz-belongings-overlay--main'; // 标识钩子（层级已动态发号 ADR-0067）
  overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
    `;
  overlay.style.zIndex = String(allocZ()); // ADR-0067：首建即显示即发号（modal 为子节点随动）

  const modal = document.createElement('div');
  modal.style.cssText = `
      background: var(--background-primary); color: var(--text-normal);
      border-radius: 12px; width: 100%; max-width: 600px; height: 90vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    `;
  // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
  applyMobileWindowFullscreen(modal, tryGetSettings().belongingsMobileDefaultFullscreen === true);

  // 头部
  const header = document.createElement('div');
  header.className = 'bz-win-head';
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
  sortBtn.textContent = '🔀';
  sortBtn.title = '排序';
  sortBtn.style.cssText = ` background: none; border: none; font-size: .7rem;
    cursor: pointer; color: var(--text-muted);
    box-shadow: none;
    padding: 0;
    margin-left: 3px;`;
  sortBtn.addEventListener('click', async () => {
    await showSortModal();
  });

  // 设置弹窗（ADR-0009：归物本无行为设置，空弹窗）
  const settingsBtn = document.createElement('button');
  settingsBtn.textContent = '⚙️';
  settingsBtn.title = '归物本设置';
  settingsBtn.style.cssText = ` background: none; border: none; font-size: .7rem;
    cursor: pointer; color: var(--text-muted);
    box-shadow: none;
    padding: 0;
    margin-left: 3px;`;
  settingsBtn.addEventListener('click', () => {
    openSettingsModal({
      title: '归物本设置',
      maxWidth: 520, // 拍板 Q11：空态域统一分组卡片口径、宽度向 520 看齐
      // 空态域：唯一内容为通用「移动端」组（桌面端整组隐藏 → 照常显示空态文案）
      schema: belongingSettingsSchema(),
      emptyText: '归物本没有可配置的设置项',
      emptyDesc: '数据文件路径由全局设置「数据存储路径」统一管理',
    });
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '❌';
  closeBtn.className = 'bz-win-close';
  closeBtn.style.cssText = ` background: none; border: none; font-size: .6rem;
    cursor: pointer; color: var(--text-muted);
    box-shadow: none;
    padding: 0;
    margin-left: 3px;`;
  closeBtn.addEventListener('click', () => {
    (overlay as HTMLElement).style.visibility = 'hidden';
    stopAutoRefresh();
  });

  headerButtons.appendChild(addBtn);
  headerButtons.appendChild(sortBtn);
  headerButtons.appendChild(settingsBtn);
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
    if (e.target === overlay) {
      overlay.style.visibility = 'hidden';
      stopAutoRefresh();
    }
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
      stopAutoRefresh();
    },
  });

  // 初次渲染
  render();
  startAutoRefresh();

  // 主题变化监听（P44 去全量重渲染）：body class 任意变更不再全量重渲染，
  // 仅当实际变化的类与渲染相关（主题类 theme-dark/theme-light）才重渲染
  bodyThemeObserver?.disconnect();
  let lastBodyClasses = document.body.className;
  bodyThemeObserver = new MutationObserver(() => {
    const cur = document.body.className;
    if (cur === lastBodyClasses) return;
    const prevTokens = new Set(lastBodyClasses.split(/\s+/).filter(Boolean));
    const nextTokens = new Set(cur.split(/\s+/).filter(Boolean));
    lastBodyClasses = cur;
    let relevant = false;
    for (const c of nextTokens) if (!prevTokens.has(c) && THEME_CLASSES.has(c)) { relevant = true; break; }
    if (!relevant) for (const c of prevTokens) if (!nextTokens.has(c) && THEME_CLASSES.has(c)) { relevant = true; break; }
    if (relevant) render();
  });
  bodyThemeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('beforeunload', () => bodyThemeObserver?.disconnect());
}

/** 命令回调体：belongings-add-item（面板不打开，直接弹添加） */
export async function addBelongingsItemCommand(): Promise<void> {
  if (!database) database = await loadDatabase();
  void addItem(); // 弹窗 promise 在使用者关闭时 resolve，命令回调不等待
}

/** 卸载清理：移除主面板 DOM */
export function cleanupBelongings(): void {
  stopAutoRefresh();
  // 主题监听断开（l2：防卸载残留）
  if (bodyThemeObserver) {
    bodyThemeObserver.disconnect();
    bodyThemeObserver = null;
  }
  const el = document.getElementById('__gui_wu_ben__');
  if (el) el.remove();
  listContainer = null;
  database = null;
}
