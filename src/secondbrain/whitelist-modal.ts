/**
 * 白名单目录选择器弹窗（ticket 114）：替代手写逗号路径的主要录入方式。
 * - 列出来自 app.vault.getMarkdownFiles() 聚合的全部含笔记目录（每一级祖先一行，
 *   附子树笔记计数，按层级缩进）+ 根级单文件（白名单「全等」语义精确条目）；
 * - 搜索框即时过滤；顶部已选 chips 可单个 ✕ 移除；
 * - 底部「清空 / 全选（当前筛选结果）/ 确定」；遮罩 / ESC 取消不保存；
 * - 确定时回调 normalizeSelection 后的列表（祖先已选则去冗余后代），由调用方落设置键；
 * - renderSelectedChips 一并导出：⚙️ 设置弹窗内的已选 chips 行复用同一渲染。
 * - z-index 11200/11201：companion 档（>11000），叠于域设置弹窗 10050 之上
 *   （对表 settings-modal.ts z-index 家族注释）。
 */
import { getApp } from '../core/app';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { collectFolderInfos, normalizeSelection, type FolderInfo } from './whitelist';

export interface WhitelistPickerOptions {
  title?: string;
  /** 列表上方补充说明（如「关联范围」行的回退语义） */
  desc?: string;
  selected: string[];
  onConfirm: (list: string[]) => void;
}

const PICKER_Z_MASK = 11200;

/** 已选 chips 渲染（设置弹窗行内与选择器顶部共用）：✕ 移除后 onChange 回传最新列表 */
export function renderSelectedChips(
  container: HTMLElement,
  selected: string[],
  onChange: (list: string[]) => void
): void {
  container.innerHTML = '';
  container.classList.add('bz-sb-pick-chips');
  if (selected.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'bz-sb-pick-chips-empty';
    empty.textContent = '暂未选择（留空 = 索引全库或按各自行内说明回退）';
    container.appendChild(empty);
    return;
  }
  for (const path of selected) {
    const chip = document.createElement('span');
    chip.className = 'bz-sb-pick-chip';
    chip.title = path;
    const name = document.createElement('span');
    name.className = 'bz-sb-pick-chip-name';
    name.textContent = path;
    const x = document.createElement('button');
    x.className = 'bz-sb-pick-chip-x';
    x.textContent = '✕';
    x.setAttribute('aria-label', `移除 ${path}`);
    x.onclick = () => onChange(selected.filter((p) => p !== path));
    chip.appendChild(name);
    chip.appendChild(x);
    container.appendChild(chip);
  }
}

/** 打开目录选择器（幂等：已开先关） */
export function openWhitelistPicker(opts: WhitelistPickerOptions): void {
  closeWhitelistPicker();

  const app = getApp() as any;
  const mdPaths: string[] = ((app?.vault?.getMarkdownFiles?.() ?? []) as any[]).map((f) => f.path);
  const infos = collectFolderInfos(mdPaths);
  const selected = new Set<string>(normalizeSelection(opts.selected));

  const { mask, popup } = createOverlay({
    maskId: 'bz-sb-whitelist-mask',
    popupId: 'bz-sb-whitelist-popup',
    zIndex: PICKER_Z_MASK,
    maxWidth: 460,
    onMaskClick: () => closeWhitelistPicker(),
  });
  popup.classList.add('bz-sb-pick');

  // 头部标题 + 说明
  const head = document.createElement('div');
  head.className = 'bz-sb-pick-head';
  const title = document.createElement('h3');
  title.textContent = opts.title || '选择白名单目录';
  head.appendChild(title);
  if (opts.desc) {
    const desc = document.createElement('div');
    desc.className = 'bz-sb-pick-desc';
    desc.textContent = opts.desc;
    head.appendChild(desc);
  }

  // 已选 chips（✕ 即时移除）
  const chips = document.createElement('div');
  chips.id = 'bz-sb-whitelist-chips';

  // 搜索框
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'bz-sb-pick-search';
  search.placeholder = '搜索目录…';
  search.spellcheck = false;

  // 目录清单（checkbox 行）
  const list = document.createElement('div');
  list.className = 'bz-sb-pick-list';
  for (const info of infos) {
    const row = document.createElement('label');
    row.className = 'bz-sb-pick-row' + (info.isFile ? ' bz-sb-pick-row--file' : '');
    row.dataset.path = info.path.toLowerCase();
    row.style.paddingLeft = `${8 + info.depth * 14}px`; // 层级缩进（功能性几何内联）
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = selected.has(info.path);
    box.onchange = () => {
      if (box.checked) selected.add(info.path);
      else selected.delete(info.path);
      renderChips();
      updateCount();
    };
    const name = document.createElement('span');
    name.className = 'bz-sb-pick-name';
    name.textContent = info.name;
    name.title = info.path;
    const count = document.createElement('span');
    count.className = 'bz-sb-pick-count';
    count.textContent = info.isFile ? '单文件' : `${info.notes} 篇`;
    row.appendChild(box);
    row.appendChild(name);
    row.appendChild(count);
    list.appendChild(row);
  }
  if (infos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bz-sb-pick-empty';
    empty.textContent = '库内还没有任何 Markdown 笔记';
    list.appendChild(empty);
  }

  // 搜索过滤（命中路径子串，大小写不敏感）
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    for (const row of Array.from(list.querySelectorAll('.bz-sb-pick-row')) as HTMLElement[]) {
      row.style.display = !q || row.dataset.path!.includes(q) ? '' : 'none';
    }
  };

  // 底部：计数 + 操作钮
  const foot = document.createElement('div');
  foot.className = 'bz-sb-pick-foot';
  const countEl = document.createElement('span');
  countEl.className = 'bz-sb-pick-count-all';
  const footBtns = document.createElement('div');
  footBtns.className = 'bz-sb-pick-foot-btns';
  const mkBtn = (label: string, primary: boolean, onclick: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = 'bz-sb-pick-btn' + (primary ? ' bz-sb-pick-btn--primary' : '');
    b.onclick = onclick;
    footBtns.appendChild(b);
    return b;
  };
  mkBtn('清空', false, () => {
    selected.clear();
    syncBoxes();
  });
  mkBtn('全选（筛选结果）', false, () => {
    for (const row of Array.from(list.querySelectorAll('.bz-sb-pick-row')) as HTMLElement[]) {
      if (row.style.display !== 'none') selected.add(row.dataset.path!);
    }
    syncBoxes();
  });
  mkBtn('确定', true, () => {
    const list0 = normalizeSelection([...selected]);
    closeWhitelistPicker();
    opts.onConfirm(list0);
  });

  function renderChips(): void {
    renderSelectedChips(chips, [...selected].sort(), (next) => {
      selected.clear();
      for (const p of next) selected.add(p);
      renderChips();
      updateCount();
      syncBoxes();
    });
  }
  function syncBoxes(): void {
    for (const row of Array.from(list.querySelectorAll('.bz-sb-pick-row')) as HTMLElement[]) {
      (row.querySelector('input[type=checkbox]') as HTMLInputElement).checked = selected.has(row.dataset.path!);
    }
    renderChips();
    updateCount();
  }
  function updateCount(): void {
    countEl.textContent = `已选 ${selected.size} 项`;
  }

  renderChips();
  updateCount();
  foot.appendChild(countEl);
  foot.appendChild(footBtns);

  popup.append(head, chips, search, list, foot);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  const escHandle = escManager.register('bz-sb-whitelist-picker', {
    isVisible: () => !!document.getElementById('bz-sb-whitelist-popup'),
    close: () => closeWhitelistPicker(),
  });
}

/** 关闭选择器（无则静默）；取消语义：不回调 onConfirm */
export function closeWhitelistPicker(): void {
  document.getElementById('bz-sb-whitelist-mask')?.remove();
  document.getElementById('bz-sb-whitelist-popup')?.remove();
}
