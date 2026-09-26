/**
 * 归物本分类选择器（issue 478 阶段 C）：模态卡片，按组浏览 + 搜索（分类名/别名）+ 图标。
 * 以 path-picker 为模板，补上它缺的两样：分组头与每行图标。
 * - 不新造 modal：复用 core/dom createOverlay（遮罩 + ESC 关，esc-manager 层级）；
 * - 不引第三方组件；
 * - 数据 = 同一张分类表（core/category-table），与 AI 归类共用；
 * - 图标渲染：<i data-lucide> 占位，列表建完 mountIcons 批量兑现；未知图标走 resolveIconName 兜底
 *   （mountIcons 对未知名静默忽略，不兜底就是无声丢图）；
 * - 空态（未下载表）：不报错不空白，给文案 + 一句「可在 设置 → 通用 里下载」+ 跳设置面板按钮。
 */
import { createOverlay } from '../dom';
import { escManager, type EscHandle } from '../esc-manager';
import { mountIcons } from './icons';
import { getApp } from '../app';
// 注意：测试 mock（tests/mock-obsidian-entry.ts）不导出 getIconIds，
// 故用命名空间 import 取引用（缺失即 undefined，不会触发「缺少命名导出」的导入期报错）。
import * as Obsidian from 'obsidian';
import type { CategoryTable, CategoryGroup, CategoryItem } from '../category-table';

export interface CategoryPick {
  category: string;
  icon: string;
}

export interface CatPickerOptions {
  /** 分类表（loadCategoryTable 结果）；为 null = 未下载表 → 空态 */
  table: CategoryTable | null;
  /** 弹窗标题（缺省「选择分类」） */
  title?: string;
  /** 空态主文案（缺省「尚未下载分类表」） */
  emptyText?: string;
  /** 确定回调：选中 → {category, icon}；取消/关闭 → null */
  onConfirm: (sel: CategoryPick | null) => void;
}

/** 图标兜底：未知图标名 → 组图标 → 'package' */
const FALLBACK_ICON = 'package';
/**
 * 硬上限（防呆阈值，非性能调优）：仅当总条数 > 1200 才启用截断 + 提示。
 * 这不是渲染性能优化——515 条（约 1500 个 SVG 节点）对模态列表完全可接受，
 * 「能不能看到第 16–26 组」是功能问题，优先级高于渲染开销。设 1200 只是防这张表未来被人
 * 加厚到离谱量级（理论上限 65025 条）时不会一次性建出上万节点卡死；正常 26 组 515 条全量渲染。
 */
const HARD_CAP = 1200;

/** 取 obsidian 的图标 id 集合（运行期权威）。mock/老环境无此函数 → 返回 null（调用方原样使用图标名） */
function getIconIdSet(): Set<string> | string[] | null {
  try {
    const fn = (Obsidian as { getIconIds?: () => Set<string> | string[] }).getIconIds;
    if (typeof fn !== 'function') return null;
    return fn();
  } catch {
    return null;
  }
}

/** 集合成员判定（兼容 Set 与数组两种返回形态） */
function idHas(ids: Set<string> | string[], name: string): boolean {
  if (typeof (ids as Set<string>).has === 'function') return (ids as Set<string>).has(name);
  return Array.isArray(ids) && ids.includes(name);
}

/**
 * 未知图标名兜底：用 getIconIds() 做交集判断，不在集合内返回 fallback（组图标，再退 'package'）。
 * - getIconIds 不存在/抛错 → 原样返回 name（测试 mock 无此函数时不会丢图标）；
 * - getIconIds 存在但两边形态都不在集合 → 返回 fallback。
 *
 * **前缀坑（务必保留两种形态的判定）**：Obsidian 的 `getIconIds()` 对内置 lucide 图标返回的是
 * **带 `lucide-` 前缀**的 id——实测 1.13.4 实现为 `Object.keys(<内置表>).map(e => 'lucide-'+e)`
 * 再拼上自定义图标。而分类表里存的是**不带前缀**的规范名（`setIcon` 两种都接受）。
 * 只判一种形态会把整张表的图标全判成「未知」→ 全表静默退化成组图标，且不报错。
 */
export function resolveIconName(name: string | undefined, fallback: string): string {
  const nm = name || '';
  if (!nm) return fallback;
  const ids = getIconIdSet();
  if (!ids) return nm; // 取不到 → 原样使用
  if (idHas(ids, nm) || idHas(ids, 'lucide-' + nm)) return nm;
  if (nm.startsWith('lucide-') && idHas(ids, nm.slice(7))) return nm;
  return fallback;
}

// ═══════ 单例弹窗状态 ═══════
let currentMask: HTMLElement | null = null;
let currentPopup: HTMLElement | null = null;
let currentHandle: EscHandle | null = null;
let focusTimer: number | null = null;
let focusRestore: HTMLElement | null = null;

/** 关闭当前选择器（无则静默）；取消语义：不回调 onConfirm */
export function closeCatPicker(): void {
  if (currentMask) { currentMask.remove(); currentMask = null; }
  if (currentPopup) { currentPopup.remove(); currentPopup = null; }
  if (currentHandle) { currentHandle.unregister(); currentHandle = null; }
  if (focusTimer !== null) { window.clearTimeout(focusTimer); focusTimer = null; }
  if (focusRestore) {
    const el = focusRestore;
    focusRestore = null;
    if (el.isConnected) el.focus();
  }
}

/** 打开分类选择器（幂等：已开先关） */
export function openCatPicker(opts: CatPickerOptions): void {
  closeCatPicker();
  focusRestore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const table = opts.table;

  const { mask, popup } = createOverlay({
    maskId: 'bz-catpick-mask',
    popupId: 'bz-catpick-popup',
    width: 'min(calc(100vw - 32px), 440px)',
    maxWidth: 440,
    onMaskClick: () => cancel(),
  });
  currentMask = mask;
  currentPopup = popup;
  popup.classList.add('bz-catpick');
  popup.style.height = 'min(560px, 82vh)';

  const head = document.createElement('div');
  head.className = 'bz-catpick-head';
  const title = document.createElement('h3');
  title.className = 'bz-catpick-title';
  title.textContent = opts.title || '选择分类';
  head.appendChild(title);

  const listEl = document.createElement('div');
  listEl.className = 'bz-catpick-list';

  const confirm = (it: CategoryItem): void => {
    closeCatPicker();
    opts.onConfirm({ category: it.name, icon: it.icon });
  };
  const cancel = (): void => {
    closeCatPicker();
    opts.onConfirm(null);
  };

  if (!table) {
    // 空态：未下载表 —— 不报错、不空白
    const empty = document.createElement('div');
    empty.className = 'bz-catpick-empty bz-catpick-empty--full';
    const t1 = document.createElement('div');
    t1.className = 'bz-catpick-empty-title';
    t1.textContent = opts.emptyText || '尚未下载分类表';
    const t2 = document.createElement('div');
    t2.className = 'bz-catpick-empty-desc';
    t2.textContent = '可在 设置 → 通用 里下载分类表后使用';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-btn bz-btn--primary';
    btn.textContent = '去下载（打开设置面板）';
    btn.onclick = () => {
      // 复用既有命令通道（bz-settings-panel-open），不引入 core→settings-panel 跨层依赖
      try {
        const app = getApp() as unknown as { commands?: { executeCommandById?: (id: string) => void } };
        app.commands?.executeCommandById?.('bz-settings-panel-open');
      } catch {
        /* 静默：拿不到 app/命令不阻断弹窗 */
      }
    };
    empty.append(t1, t2, btn);
    listEl.appendChild(empty);
    popup.append(head, listEl);
  } else {
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'bz-catpick-search';
    search.placeholder = '搜索分类或别名…';
    search.spellcheck = false;
    search.setAttribute('aria-label', '搜索分类');

    const state = { q: '' };

    /** 构造渲染模型：非搜索态 = 全表组顺序全量；搜索态 = 过滤分类名/别名，只留命中的组 */
    function buildModel(): { group: CategoryGroup; items: CategoryItem[] }[] {
      const q = state.q.trim().toLowerCase();
      const out: { group: CategoryGroup; items: CategoryItem[] }[] = [];
      for (const g of table!.groups) {
        const items = q
          ? g.items.filter(
              (it) =>
                it.name.toLowerCase().includes(q) ||
                it.aliases.some((a) => a.toLowerCase().includes(q)),
            )
          : g.items;
        if (q && items.length === 0) continue; // 搜索态：只显示有命中的组
        out.push({ group: g, items });
      }
      return out;
    }

    function renderList(): void {
      listEl.innerHTML = '';
      const q = state.q.trim().toLowerCase();
      const model = buildModel();
      let total = 0;
      for (const { items } of model) total += items.length;
      let n = 0;
      for (const { group, items } of model) {
        if (n >= HARD_CAP) break; // 后续组条目全部超硬上限，不再渲染（头部与条目都不画）
        // 分组头：组图标 + 组名 + 条数（搜索态显示命中数）
        const header = document.createElement('div');
        header.className = 'bz-catpick-group';
        const gIcon = document.createElement('i');
        gIcon.className = 'bz-catpick-ic';
        gIcon.setAttribute('data-lucide', resolveIconName(group.icon, FALLBACK_ICON));
        const gName = document.createElement('span');
        gName.className = 'bz-catpick-group-name';
        gName.textContent = group.name;
        const gCount = document.createElement('span');
        gCount.className = 'bz-catpick-group-count';
        gCount.textContent = q ? `${items.length}` : `${group.items.length}`;
        header.append(gIcon, gName, gCount);
        listEl.appendChild(header);
        for (const it of items) {
          if (n >= HARD_CAP) break;
          n++;
          const row = document.createElement('div');
          row.className = 'bz-catpick-row';
          row.dataset.cat = it.name;
          row.dataset.icon = it.icon;
          row.setAttribute('role', 'option');
          const ic = document.createElement('i');
          ic.className = 'bz-catpick-ic';
          ic.setAttribute('data-lucide', resolveIconName(it.icon, group.icon));
          const name = document.createElement('span');
          name.className = 'bz-catpick-name';
          name.textContent = it.name;
          const alias = document.createElement('span');
          alias.className = 'bz-catpick-alias';
          if (it.aliases.length) alias.textContent = it.aliases.join('、');
          row.append(ic, name, alias);
          row.tabIndex = 0;
          row.onclick = () => confirm(it);
          row.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              confirm(it);
            }
          });
          listEl.appendChild(row);
        }
      }
      if (total === 0) {
        const empty = document.createElement('div');
        empty.className = 'bz-catpick-empty';
        empty.textContent = '没有匹配的分类';
        listEl.appendChild(empty);
      } else if (total > HARD_CAP) {
        const more = document.createElement('div');
        more.className = 'bz-catpick-empty';
        more.textContent = `结果过多，已显示前 ${HARD_CAP} 条`;
        listEl.appendChild(more);
      }
      mountIcons(listEl);
    }

    search.oninput = () => {
      state.q = search.value;
      renderList();
    };
    // 回车直选：选中当前可见首行
    search.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const first = listEl.querySelector<HTMLElement>('.bz-catpick-row');
      if (first) {
        ev.preventDefault();
        first.click();
      }
    });

    renderList();
    popup.append(head, search, listEl);
  }

  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  currentHandle = escManager.register('bz-catpick', {
    isVisible: () => !!currentMask,
    close: () => cancel(),
  });
  // 打开聚焦（30ms 等 DOM 挂载；搜索框优先，空态聚焦下载按钮）
  focusTimer = window.setTimeout(() => {
    focusTimer = null;
    if (!mask.isConnected) return;
    const focusEl =
      popup.querySelector<HTMLElement>('.bz-catpick-search') ??
      popup.querySelector<HTMLElement>('.bz-catpick-empty .bz-btn');
    focusEl?.focus();
  }, 30);
}
