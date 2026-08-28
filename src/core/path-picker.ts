/**
 * 统一路径选择器（ticket 128，ADR-0061）：设置面板所有路径类输入的统一样式组件。
 * - 卡片弹窗：标题头 + 搜索框 + vault 全部文件夹列表（滚动）+ 底部（selinfo / 清空(多选) / 确定）；
 *   遮罩 + ESC 关闭（esc-manager 层级），无关闭按钮（主窗口规范：弹窗不放关闭按钮，靠遮罩 + ESC）。
 * - 数据源 = 全部 vault 文件夹：vault.getFiles() 聚合所有父目录 + 库根（''，显示「（库根目录）」）
 *   + vault.adapter.list() 递归补齐空目录与点前缀隐藏目录（如 CONFIG/.ENCRYPT——vault.getFiles
 *   对点前缀不索引，只能经 adapter 列目录补齐）；去重排序。
 * - 搜索即时过滤（包含匹配，大小写不敏感；输入恰好等于某目录 → 显示全量）；
 * - 单选：点选高亮 + 确定提交；多选：点击切换勾选，确定回调全量列表。
 * - 移动端近全屏（≤768 顶对齐避让软键盘 + 底部 safe-area）。
 * - z-index 11200/11201：companion 档（>11000），叠于域设置弹窗 10050 之上（对表 settings-modal.ts
 *   z-index 家族注释；原 secondbrain 白名单弹窗同档 11200，退役合并后继续沿用）。
 */
import { Setting } from 'obsidian';
import { getApp } from './app';
import { createOverlay } from './dom';
import { escManager, type EscHandle } from './esc-manager';

/** 选择器遮罩 z-index（companion 档；本体 +1 = 11201） */
export const PATH_PICKER_Z_MASK = 11200;

export interface PathPickerOptions {
  /** 弹窗标题（缺省「选择文件夹」） */
  title?: string;
  /** single = 单选（点选高亮 + 确定提交）；multi = 多选（勾选累加）。缺省 single */
  mode?: 'single' | 'multi';
  /** 列表上方补充说明 */
  desc?: string;
  /** 当前已选目录（初始高亮/勾选） */
  selected?: string[];
  /** 确定按钮文案（缺省「确定」） */
  okText?: string;
  /** 确定回调（list = 清洗后的目录清单；单选长度 0 或 1；'' = 库根目录） */
  onConfirm: (list: string[]) => void;
}

/* ==================== 数据层 ==================== */

/** 由文件路径集合聚合全部祖先目录（含库根 ''）；排序去重 */
export function foldersFromFiles(paths: string[]): string[] {
  const out = new Set<string>(['']);
  for (const p of paths) {
    const sep = p.lastIndexOf('/');
    if (sep === -1) continue;
    let dir = p.slice(0, sep);
    while (dir) {
      out.add(dir);
      const i = dir.lastIndexOf('/');
      dir = i === -1 ? '' : dir.slice(0, i);
    }
  }
  return [...out].sort();
}

/**
 * 聚合 vault 全部文件夹（含空目录与点前缀隐藏目录）。
 * 1. vault.getFiles() 聚合所有父目录（不含空目录、不含点前缀目录——Obsidian 不对点前缀索引）；
 * 2. vault.adapter.list() 从根递归列目录补齐（磁盘直读，空目录与 .ENCRYPT 等一览无余）；
 * 3. 库根 '' 恒在（显示「（库根目录）」）。
 * adapter 异常（老环境/只读测试替身缺方法）静默回落纯文件聚合。幂等、可重复调用。
 */
export async function collectVaultFolders(app: any): Promise<string[]> {
  const out = new Set<string>(['']);
  try {
    const files = ((app?.vault?.getFiles?.() ?? []) as Array<{ path: string }>).map((f) => f.path);
    for (const p of foldersFromFiles(files)) out.add(p);
  } catch {
    /* 环境异常静默 */
  }
  const adapter = app?.vault?.adapter;
  if (adapter && typeof adapter.list === 'function') {
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 40) return; // 防御性深度上限（vault 目录层深远超常规）
      let listed: { folders?: string[] } | null = null;
      try {
        listed = await adapter.list(dir);
      } catch {
        // 根目录（''）在部分 adapter 实现不合法：回退 '/' 再试一次；仍失败静默跳过该分支
        if (dir === '') {
          try {
            listed = await adapter.list('/');
          } catch {
            return;
          }
        } else {
          return;
        }
      }
      for (const f of listed?.folders ?? []) {
        const p = String(f).replace(/^\/+|\/+$/g, '');
        if (!p) continue;
        // 去重仅跳过「已收集」，仍须递归（文件聚合已知的目录下可能藏着空目录/点前缀目录）
        if (!out.has(p)) out.add(p);
        await walk(p, depth + 1);
      }
    };
    try {
      await walk('', 0);
    } catch {
      /* 静默 */
    }
  }
  return [...out].sort();
}

/** 清洗选择集：trim / 去首尾斜杠 / 去重（'' 与纯斜杠串 = 库根目录保留；纯空白项与其余空项丢弃） */
export function normalizePicked(list: string[]): string[] {
  const out: string[] = [];
  for (const item of list) {
    const raw = String(item);
    if (raw === '') {
      if (!out.includes('')) out.push('');
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed === '') continue; // 纯空白残留 → 丢弃
    const p = trimmed.replace(/^\/+|\/+$/g, '');
    if (p === '') {
      if (!out.includes('')) out.push(''); // 纯斜杠串（'/'）→ 库根
      continue;
    }
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/* ==================== chips 渲染（设置行内与选择器共用） ==================== */

/** 已选目录 chips 渲染：✕ 移除后 onChange 回传最新列表（行为同旧 renderSelectedChips，类名随新组件） */
export function renderPathChips(
  container: HTMLElement,
  selected: string[],
  onChange: (list: string[]) => void,
  emptyText = '未选择'
): void {
  container.innerHTML = '';
  container.classList.add('bz-path-picker-chips');
  if (selected.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'bz-path-picker-chips-empty';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  for (const path of selected) {
    const label = path === '' ? '（库根目录）' : path;
    const chip = document.createElement('span');
    chip.className = 'bz-path-picker-chip';
    chip.title = label;
    const name = document.createElement('span');
    name.className = 'bz-path-picker-chip-name';
    name.textContent = label;
    const x = document.createElement('button');
    x.className = 'bz-path-picker-chip-x';
    x.textContent = '✕';
    x.setAttribute('aria-label', `移除 ${label}`);
    x.onclick = () => onChange(selected.filter((p) => p !== path));
    chip.appendChild(name);
    chip.appendChild(x);
    container.appendChild(chip);
  }
}

/* ==================== 设置行助手（chips + 选择…/添加…按钮，无手输输入框） ==================== */

export interface PathSettingRowOptions {
  /** 挂载容器（分组卡片 body / 设置页容器） */
  parent: HTMLElement;
  name: string;
  desc?: string;
  /** single = 单值（chips 至多一个，✕ 清除即未选择）；multi = 多值 */
  mode: 'single' | 'multi';
  /** 当前值：单值 = 路径字符串（'' = 未选择）；多值 = 数组 */
  value: string | string[];
  /** 选择器标题（缺省用 name） */
  pickerTitle?: string;
  /** 选择器内补充说明 */
  pickerDesc?: string;
  /** 按钮文案（缺省：single → 「选择…」；multi → 「添加…」） */
  buttonText?: string;
  /** 确定按钮文案（透传选择器） */
  okText?: string;
  /** 空态文案（chips 无已选时显示，覆盖缺省「未选择」） */
  emptyText?: string;
  /** 选择器确定 / chip ✕ 移除后的统一回调（list = 最新目录清单；单值 [] = 未选择） */
  onChange: (list: string[]) => void;
}

/** 构建路径设置行：Setting（名称/描述 + 选择按钮）+ 控件区内 chips（成对 ✕）。
 *  不保留手输文本框（ADR-0061 拍板 3：路径一律经选择器录入，限 vault 内）。
 *  返回 { refresh } 供外部按需重渲染 chips（如设置被其他入口改动后回同步）。 */
export function renderPathSettingRow(opts: PathSettingRowOptions): { refresh: () => void; settingEl: HTMLElement } {
  const readValue = (): string[] => {
    const v = opts.value;
    return Array.isArray(v) ? [...v] : v ? [v] : [];
  };
  let current = readValue();
  const setting = new Setting(opts.parent).setName(opts.name);
  if (opts.desc) setting.setDesc(opts.desc);
  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'bz-path-picker-chips--setting';
  const render = () =>
    renderPathChips(chipsWrap, current, (next) => {
      current = next;
      opts.onChange(next);
      render();
    }, opts.emptyText);
  setting.addButton((b) =>
    b
      .setButtonText(opts.buttonText || (opts.mode === 'multi' ? '添加…' : '选择…'))
      .setCta()
      .onClick(() =>
        openPathPicker({
          title: opts.pickerTitle || opts.name,
          desc: opts.pickerDesc,
          mode: opts.mode,
          selected: current,
          okText: opts.okText,
          onConfirm: (list) => {
            current = list;
            opts.onChange(list);
            render();
          },
        })
      )
  );
  // chips 并入控件区（移动端两行式按「控件区 ≥2 子元素」判定，button + chips 即触发）
  const control = setting.settingEl.querySelector('.setting-item-control');
  if (control) control.appendChild(chipsWrap);
  const refresh = () => {
    current = readValue();
    render();
  };
  render();
  return { refresh, settingEl: setting.settingEl };
}

/* ==================== 卡片弹窗 ==================== */

let currentMask: HTMLElement | null = null;
let currentPopup: HTMLElement | null = null;
let currentHandle: EscHandle | null = null;
let focusTimer: number | null = null;

/** 关闭当前选择器（无则静默）；取消语义：不回调 onConfirm。
 *  mask 与 popup 是 body 下两个独立兄弟节点（createOverlay 分别 append），必须都移除，
 *  否则孤儿 popup 残留在 DOM（同名 id 会被后续 getElementById 误命中）。 */
export function closePathPicker(): void {
  if (currentMask) {
    currentMask.remove();
    currentMask = null;
  }
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
  if (currentHandle) {
    currentHandle.unregister();
    currentHandle = null;
  }
  if (focusTimer !== null) {
    window.clearTimeout(focusTimer);
    focusTimer = null;
  }
}

/** 打开目录选择器（幂等：已开先关） */
export function openPathPicker(opts: PathPickerOptions): void {
  closePathPicker();
  const app = getApp();
  const mode = opts.mode || 'single';
  const selected = new Set(normalizePicked(opts.selected || []));

  const { mask, popup } = createOverlay({
    maskId: 'bz-path-picker-mask',
    popupId: 'bz-path-picker-popup',
    zIndex: PATH_PICKER_Z_MASK,
    width: 'min(92vw, 440px)',
    maxWidth: 440,
    onMaskClick: () => closePathPicker(),
  });
  currentMask = mask;
  currentPopup = popup;
  popup.classList.add('bz-path-picker');
  popup.style.height = 'min(560px, 82vh)'; // 功能性几何（铁律 8：显隐/动态计算内联，视觉样式收敛 CSS）

  // 头部：标题 + （可选）说明；无关闭按钮
  const head = document.createElement('div');
  head.className = 'bz-path-picker-head';
  const title = document.createElement('h3');
  title.className = 'bz-path-picker-title';
  title.textContent = opts.title || '选择文件夹';
  head.appendChild(title);
  if (opts.desc) {
    const desc = document.createElement('div');
    desc.className = 'bz-path-picker-desc';
    desc.textContent = opts.desc;
    head.appendChild(desc);
  }

  // 搜索框（聚焦不遮列表：弹窗定高 flex 布局，列表 flex:1 恒可见）
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'bz-path-picker-search';
  search.placeholder = '搜索目录…';
  search.spellcheck = false;
  search.setAttribute('aria-label', '搜索目录');

  // 目录列表（滚动）
  const listEl = document.createElement('div');
  listEl.className = 'bz-path-picker-list';
  const state: { folders: string[]; q: string } = { folders: [], q: '' };

  // 底部：已选信息 + 清空(多选) + 确定
  const foot = document.createElement('div');
  foot.className = 'bz-path-picker-foot';
  const selinfo = document.createElement('span');
  selinfo.className = 'bz-path-picker-selinfo';
  const btns = document.createElement('div');
  btns.className = 'bz-path-picker-foot-btns';
  foot.appendChild(selinfo);
  foot.appendChild(btns);

  const mkBtn = (label: string, primary: boolean, onclick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = 'bz-path-picker-btn' + (primary ? ' bz-path-picker-btn--primary' : '');
    b.onclick = onclick;
    btns.appendChild(b);
    return b;
  };
  if (mode === 'multi') mkBtn('清空', false, () => { selected.clear(); renderList(); updateSel(); });
  mkBtn(opts.okText || '确定', true, () => {
    const list = normalizePicked([...selected]);
    closePathPicker();
    opts.onConfirm(list);
  });

  function renderList(): void {
    listEl.innerHTML = '';
    const q = state.q.trim().toLowerCase();
    // 输入恰好等于某目录 → 视为「已选中」，显示完整列表（预填已选时不把列表滤掉）
    const exact = !!q && state.folders.includes(q);
    let n = 0;
    for (const folder of state.folders) {
      if (q && !exact && !folder.toLowerCase().includes(q)) continue;
      n++;
      const on = selected.has(folder);
      const row = document.createElement('div');
      row.className = 'bz-path-picker-row' + (on ? ' bz-path-picker-row--sel' : '');
      row.dataset.path = folder;
      row.setAttribute('role', mode === 'multi' ? 'checkbox' : 'option');
      row.setAttribute('aria-checked', on ? 'true' : 'false');
      const box = document.createElement('span');
      box.className = 'bz-path-picker-check';
      box.textContent = on ? '✓' : '';
      const name = document.createElement('span');
      name.className = 'bz-path-picker-name';
      name.textContent = folder === '' ? '（库根目录）' : folder;
      name.title = folder === '' ? '（库根目录）' : folder;
      row.appendChild(box);
      row.appendChild(name);
      row.onclick = () => {
        if (mode === 'single') {
          selected.clear();
          selected.add(folder);
        } else if (selected.has(folder)) {
          selected.delete(folder);
        } else {
          selected.add(folder);
        }
        renderList();
        updateSel();
      };
      listEl.appendChild(row);
    }
    if (!n) {
      const empty = document.createElement('div');
      empty.className = 'bz-path-picker-empty';
      empty.textContent = '没有匹配的目录';
      listEl.appendChild(empty);
    }
  }
  function updateSel(): void {
    if (mode === 'single') {
      const first = [...selected][0];
      selinfo.textContent = first === undefined ? '未选择' : first === '' ? '已选（库根目录）' : `已选 ${first}`;
    } else {
      selinfo.textContent = `已选 ${selected.size} 项`;
    }
  }

  search.oninput = () => {
    state.q = search.value;
    renderList();
  };

  // 异步聚合目录（open 后即时渲染；关闭后迟到的聚合直接丢弃）
  void collectVaultFolders(app).then((folders) => {
    if (!mask.isConnected) return;
    state.folders = folders;
    renderList();
  });

  renderList();
  updateSel();
  popup.append(head, search, listEl, foot);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  currentHandle = escManager.register('bz-path-picker', {
    isVisible: () => !!currentMask,
    close: () => closePathPicker(),
  });
  // 打开聚焦搜索框（30ms 等 DOM 挂载；聚焦不遮列表——定高布局列表恒可见）
  focusTimer = window.setTimeout(() => {
    focusTimer = null;
    if (mask.isConnected) search.focus();
  }, 30);
}