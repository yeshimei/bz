/**
 * 域内文件夹选择器（拍板原型 dk-dialog 落域）：设置面板 path 行的目录选择弹层。
 * - 替代 core openPathPicker（旧域组件）：观感随设置面板双皮（--sp-* tokens），
 *   DOM = 原型 openDirPicker 同构（.bz-sp-picker-* 契约类）。
 * - 数据源复用 core collectVaultFolders（文件聚合 + adapter 递归补齐 + 环境目录剪枝）。
 * - 列表平铺反转（深层在前、根级垫底）；搜索命中保留祖先链；
 *   确认条：单选「将选用 A ▸ B ▸ C」/ 多选「已选 N 个目录」。
 * - 单选点选高亮 + 双击直接选用；多选点击勾选累加；遮罩点击 / ESC 关闭。
 * - 弹层挂 body（fixed 覆盖视口，不受面板 overflow 裁剪），自挂 .bz-sp-picker-mask
 *   scope 携带 --sp-* tokens；topifyZ 保证盖在面板之上。
 */
import { setIcon } from 'obsidian';
import { getApp } from '../core/app';
import { collectVaultFolders, normalizePicked } from '../core/path-picker';
import { escManager } from '../core/esc-manager';
import { topifyZ } from '../core/z-order';

export interface DirPickerOptions {
  /** 弹窗标题（含行名，如「选择文件夹 · 日记目录」） */
  title: string;
  /** multi = 多选（勾选累加）；缺省单选（点选高亮 + 双击直选） */
  multi?: boolean;
  /** 当前已选目录（初始高亮/勾选） */
  selected?: string[];
  /** 确定按钮文案（缺省「选用」/ 多选「添加所选」） */
  okText?: string;
  /** 确定回调（list = 清洗后的目录清单；单选长度 0 或 1；'' = 库根目录） */
  onConfirm: (list: string[]) => void;
}

/** 打开选择器；立即返回，选择结果经 onConfirm 回调（取消不回调） */
export function openDirPicker(opts: DirPickerOptions): void {
  const multi = opts.multi === true;
  const selected = new Set<string>((opts.selected ?? []).filter((x) => x !== undefined));
  let q = '';
  let dirsCache: string[] = [];
  let dirsLoaded = false;

  const mask = document.createElement('div');
  mask.className = 'bz-sp-picker-mask';
  const dlg = document.createElement('div');
  dlg.className = 'bz-sp-picker';

  const head = document.createElement('div');
  head.className = 'bz-sp-picker-head';
  const titleEl = document.createElement('b');
  titleEl.textContent = opts.title;
  const search = document.createElement('div');
  search.className = 'bz-sp-picker-search';
  const searchIc = document.createElement('span');
  searchIc.className = 'bz-ic';
  setIcon(searchIc, 'search');
  const sinp = document.createElement('input');
  sinp.placeholder = '搜索目录…（命中项保留上级链）';
  search.append(searchIc, sinp);
  head.append(titleEl, search);

  const crumb = document.createElement('div');
  crumb.className = 'bz-sp-picker-crumb';
  const list = document.createElement('div');
  list.className = 'bz-sp-picker-list';
  const foot = document.createElement('div');
  foot.className = 'bz-sp-picker-foot';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'bz-sp-btn';
  cancel.textContent = '取消';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'bz-sp-btn bz-sp-btn--primary';
  ok.textContent = opts.okText || (multi ? '添加所选' : '选用');

  let settled = false;
  const close = (v: string[] | null) => {
    if (settled) return;
    settled = true;
    escHandle.unregister();
    mask.remove();
    if (v !== null) opts.onConfirm(normalizePicked(v));
  };
  cancel.addEventListener('click', () => close(null));
  ok.addEventListener('click', () => close([...selected]));
  mask.addEventListener('click', (e) => {
    if (e.target === mask) close(null);
  });
  const escHandle = escManager.register('bz-sp-dir-picker', {
    isVisible: () => mask.isConnected,
    close: () => close(null),
  });

  function renderCrumb(): void {
    crumb.innerHTML = '';
    const lab = document.createElement('span');
    lab.className = 'bz-sp-picker-lab';
    lab.textContent = multi ? '已选' : '将选用';
    crumb.appendChild(lab);
    const arr = [...selected].filter(Boolean);
    if (multi) {
      const v = document.createElement('span');
      v.textContent = arr.length ? `${arr.length} 个目录` : '尚未选择';
      crumb.appendChild(v);
    } else if (!arr.length) {
      const v = document.createElement('span');
      v.textContent = '未设置';
      crumb.appendChild(v);
    } else {
      arr[0].split('/').forEach((seg, i) => {
        if (i) {
          const sp = document.createElement('span');
          sp.className = 'bz-sp-picker-sep';
          sp.textContent = '▸';
          crumb.appendChild(sp);
        }
        const sg = document.createElement('span');
        sg.textContent = seg;
        crumb.appendChild(sg);
      });
    }
  }

  function renderList(): void {
    const query = q.trim().toLowerCase();
    let items = dirsCache;
    if (query) {
      // 命中项保留祖先链（子目录命中时上级路径仍在列，路径语境不断）
      const keep = new Set<string>();
      for (const d of dirsCache) {
        if (d.toLowerCase().includes(query)) {
          keep.add(d);
          const parts = d.split('/');
          for (let i = 1; i < parts.length; i++) keep.add(parts.slice(0, i).join('/'));
        }
      }
      items = dirsCache.filter((d) => keep.has(d));
    }
    // 平铺反转：深层在前、根级垫底（拍板形态）
    items = items.slice().reverse();
    list.innerHTML = '';
    if (!dirsLoaded) {
      // 目录扫描完成前的加载占位
      const loading = document.createElement('div');
      loading.className = 'bz-sp-picker-row';
      loading.style.pointerEvents = 'none';
      loading.style.opacity = '0.55';
      loading.textContent = '正在读取目录…';
      list.appendChild(loading);
      return;
    }
    for (const d of items) {
      const parts = d.split('/');
      const rowBtn = document.createElement('button');
      rowBtn.type = 'button';
      rowBtn.className = 'bz-sp-picker-row' + (selected.has(d) ? ' sel' : '');
      const ic = document.createElement('span');
      ic.className = 'bz-ic';
      setIcon(ic, 'folder-open');
      rowBtn.appendChild(ic);
      const nm = document.createElement('span');
      nm.textContent = parts[parts.length - 1] || '（库根目录）';
      rowBtn.appendChild(nm);
      const anc = document.createElement('span');
      anc.className = 'anc';
      anc.textContent = parts.length > 1 ? parts.slice(0, -1).join(' / ') + ' /' : 'vault 根目录';
      rowBtn.appendChild(anc);
      rowBtn.addEventListener('click', () => {
        if (multi) {
          if (selected.has(d)) selected.delete(d);
          else selected.add(d);
          rowBtn.classList.toggle('sel', selected.has(d));
        } else {
          selected.clear();
          selected.add(d);
          list.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel'));
          rowBtn.classList.add('sel');
        }
        renderCrumb();
      });
      if (!multi) rowBtn.addEventListener('dblclick', () => close([d]));
      list.appendChild(rowBtn);
    }
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'bz-sp-picker-row';
      empty.style.pointerEvents = 'none';
      empty.style.opacity = '0.55';
      empty.textContent = '无匹配目录';
      list.appendChild(empty);
    }
  }

  foot.append(cancel, ok);
  dlg.append(head, crumb, list, foot);
  mask.appendChild(dlg);
  document.body.appendChild(mask);
  topifyZ(mask);

  sinp.addEventListener('input', () => {
    q = sinp.value;
    renderList();
  });

  renderCrumb();
  renderList();
  // 目录扫描（文件聚合 + adapter 递归补齐）完成后填充全量列表
  void collectVaultFolders(getApp()).then((dirs) => {
    if (settled) return;
    dirsCache = dirs;
    dirsLoaded = true;
    renderList();
  });
}
