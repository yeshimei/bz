/**
 * 待办（todo）域 UI：场景工作台（原型 1 定稿形态）
 * 桌面：遮罩 + 720×580 面板（ADR-0084：右缘/底缘/右下角拖动缩放，
 *       钳制 720×520 ~ min(1280×880, 视口92%)；尺寸记忆 settings.todoPanelWidth/Height）：
 *       左场景栏（全部/今日/场景 + 添加场景）+ 右侧列表
 *       （工具栏：搜索 + 排序 segmented；条目卡 meta 对齐源码 buildMeta 顺序）
 * 移动：真全屏 + 顶部横滑场景 chips + 右上关闭（仅全屏显示）
 * 交互：
 *   - 桌面右键条目 → 跟手菜单（无顶部信息卡）；移动长按 → 底部抽屉（带 sheetHead）
 *     （两者复用 core/item-actions：attachItemActions）
 *   - 行内勾选完成（300ms 防抖 + emitDomainEvent('memo', completed) 行为流）
 *   - 编辑/新建弹窗 = uiModal（无关闭按钮，点遮罩/ESC 关；无滚动条）
 *   - 场景/优先级平铺选择 = 组件库 .bz-choice（选中 = 品牌色，非黑底）
 *   - 添加场景弹窗：输入场景名 → 写入 memoScenarios 设置并即时生效
 * 基线：按钮/输入/弹窗/平铺选择走组件库；域内只留待办特有布局。
 * 图标：一律 lucide。
 * 数据：与旧 memo 域读写同一 memo.json；后台任务由旧 memo 域执行。
 */
import type { App, EventRef } from 'obsidian';
import moment from 'moment';
import { notice } from '../core/notice';
import { escManager } from '../core/esc-manager';
import { topifyZ } from '../core/dom';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { uiModal, uiIcon, uiSegmented, uiChoice, uiBtn, uiBtnRow, uiResizable } from '../core/ui';
import { openFlowDialog } from '../core/flow-dialog';
import { emitDomainEvent } from '../core/domain-bus';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import {
  formatRelativeTime, getCurrentNoteInfo, getCurrentCursorPosition,
  generateId, extractUrlAndDisplay, escapeHtml,
} from '../core/utils';
import { TodoData } from './data';
import { getDueStatus, formatDueText } from './due';
import type { TodoItem } from './types';
import { M } from './state';

/** 待办主面板尺寸（ADR-0084：默认/最小/硬上限；实际上限另受视口 92% 约束） */
const PANEL = { DEF_W: 720, DEF_H: 580, MIN_W: 720, MIN_H: 520, MAX_W: 1280, MAX_H: 880 };

// ---------- 小工具 ----------

const ICON = {
  close: 'x',
  search: 'search',
  add: 'plus',
  addScene: 'tag',
  empty: 'inbox',
  pos: 'pin',
  clear: 'x',
  external: 'external-link',
  book: 'book-open',
  check: 'check',
  restore: 'rotate-ccw',
  postpone1: 'calendar-plus',
  postpone3: 'calendar-clock',
  star: 'star',
  copy: 'copy',
  edit: 'pencil',
  del: 'trash-2',
  course: 'graduation-cap',
  script: 'terminal',
  url: 'arrow-up-right',
  overdue: 'circle-alert',
  clock: 'clock',
  calendar: 'calendar',
  doneFold: 'chevron-down',
};

/** lucide 占位 HTML（innerHTML 拼接用；渲染后 mountIcons 统一 setIcon） */
function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}

const esc = escapeHtml;

/** 容器内所有 data-lucide 占位替换为 setIcon 渲染的真图标 */
function mountIcons(container: HTMLElement): void {
  container.querySelectorAll('i[data-lucide]').forEach((el) => {
    const name = el.getAttribute('data-lucide') || '';
    const cls = el.className;
    const fresh = uiIcon(name, '');
    if (cls && cls !== 'bz-ic') fresh.className = cls;
    el.replaceWith(fresh);
  });
}

/** 场景色点（数据语义色，域内直给；与旧 memo 相近语义） */
const SCENE_DOTS: Record<string, string> = {
  剪藏: '#e67341', 代码: '#4c82c8', 公开课: '#8f5fc0', 学习: '#4c9e6c', 生活: '#c27a48', 工作: '#b25757',
};
function sceneDot(scene: string): string {
  return SCENE_DOTS[scene] || '#8b8f9a';
}

/** 到期状态图标名（meta 标签前缀） */
function dueIconName(status: string): string {
  if (status === 'overdue') return ICON.overdue;
  if (status === 'today') return ICON.clock;
  return ICON.calendar;
}
function dueTagClass(status: string): string {
  if (status === 'overdue') return 'bz-todo-tag-overdue';
  if (status === 'today') return 'bz-todo-tag-today';
  return 'bz-todo-tag-future';
}
function dueText(item: TodoItem): string {
  const mode = (tryGetSettings() as any).memoDueFormat === 'absolute' ? 'absolute' : 'relative';
  return formatDueText(item.due!, mode);
}

// ---------- 数据操作 ----------

/** 读取数据（从 memo.json），清空状态计数后给 items */
async function loadData(): Promise<void> {
  M.items = await TodoData.loadItems();
}

/** 写盘后刷新 UI */
async function refresh(): Promise<void> {
  await loadData();
  M.renderFn?.();
}

// ---------- T1：同源 memo.json 跨域同步（旧 memo 面板/后台任务改动 → 已开 todo 面板重读） ----------
let vaultSyncRef: EventRef | null = null;
let vaultSyncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false; // 自己写盘引发的 modify 不重复刷新（写路径已自 refresh）
let origTodoWrite: ((data: any) => Promise<unknown>) | null = null; // 包装前原始 write（卸载还原）

/** 订阅 vault modify：memo.json 文件变更（任意来源——memo 面板/后台任务/外部）→ 面板开着时防抖重读 */
function subscribeMemoSync(app: App): void {
  if (vaultSyncRef) return;
  // 包装 TodoData.write：todo 自己的写盘置 syncing，modify 事件不再重复刷新（写路径已自 refresh）
  if (!origTodoWrite) {
    origTodoWrite = TodoData.write.bind(TodoData);
    TodoData.write = async (data: any) => {
      syncing = true;
      try {
        return await origTodoWrite!(data);
      } finally {
        syncing = false;
      }
    };
  }
  vaultSyncRef = app.vault.on('modify', (file) => {
    if (syncing) return; // 自己写盘
    if (!M.overlay) return; // 面板没开不刷
    if (file && file.path !== TodoData.todoFilePath) return; // 只关心 memo.json
    if (vaultSyncTimer !== null) clearTimeout(vaultSyncTimer);
    vaultSyncTimer = setTimeout(() => {
      vaultSyncTimer = null;
      void refresh();
    }, 150);
  });
}
function unsubscribeMemoSync(): void {
  if (vaultSyncRef) {
    // vault.on 返回 EventRef，注销走 offref（M.appRef 在 unloadTodo 里于本函数之后才置空）
    M.appRef?.vault.offref(vaultSyncRef);
    vaultSyncRef = null;
  }
  if (vaultSyncTimer !== null) {
    clearTimeout(vaultSyncTimer);
    vaultSyncTimer = null;
  }
  syncing = false;
  // 还原 write 包装（卸载后不再拦截，避免引用的 UI 闭包残留）
  if (origTodoWrite) {
    TodoData.write = origTodoWrite;
    origTodoWrite = null;
  }
}

// ---------- 视图判定（过滤 + 排序） ----------

function dueStatusOf(it: TodoItem): string | null {
  return getDueStatus(it.due);
}
/** 到期排序优先级：overdue 0 / today 1 / future 2 / 无 3 */
function dueRank(it: TodoItem): number {
  if (!it.due) return 3;
  const st = getDueStatus(it.due);
  return st === 'overdue' ? 0 : st === 'today' ? 1 : 2;
}

function getVisibleItems(): TodoItem[] {
  const kw = M.search.trim().toLowerCase();
  let list = M.items.filter((it) => {
    // 场景筛选
    if (M.activeScene === '今日') {
      // T3：已完成项放行（进 done 折叠区可恢复）；未完成项需今日/逾期才进列表
      if (!it.completed) {
        const st = getDueStatus(it.due);
        if (st !== 'overdue' && st !== 'today') return false;
      }
    } else if (M.activeScene !== '全部' && it.scene !== M.activeScene) return false;
    // 搜索（内容/场景/笔记名）
    if (kw) {
      const hay = [it.title, it.scene, it.notePath, it.scriptName, it.courseName].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
  // 排序：priority 模式 = 到期优先 + 重要优先（对齐 memo sortFn）
  list.sort((a, b) => {
    const ac = !!a.completed, bc = !!b.completed;
    if (ac !== bc) return ac ? 1 : -1;
    const dr = dueRank(a) - dueRank(b);
    if (dr !== 0) return dr;
    if (M.sortMode === 'priority') {
      const pa = a.priority === 'important' ? 0 : 1;
      const pb = b.priority === 'important' ? 0 : 1;
      if (pa !== pb) return pa - pb;
    }
    if (M.sortMode === 'created') {
      return (b.created || '').localeCompare(a.created || '');
    }
    if (a.due && b.due) return a.due.localeCompare(b.due);
    return (b.created || '').localeCompare(a.created || '');
  });
  return list;
}

/** 场景计数（当前场景下满足搜索的条目数） */
function sceneCount(scene: string): number {
  if (scene === '今日') {
    return M.items.filter((it) => !it.completed && (getDueStatus(it.due) === 'overdue' || getDueStatus(it.due) === 'today')).length;
  }
  if (scene === '全部') return M.items.length;
  return M.items.filter((it) => it.scene === scene).length;
}

// ---------- 主面板（打开/关闭/ESC） ----------

export function openTodoPanel(app: App): void {
  if (M.overlay) {
    closeTodoPanel();
    return;
  }
  TodoData.init(tryGetSettings() as any);
  const fullscreen = (tryGetSettings() as any).todoMobileDefaultFullscreen === true;
  // 设置播种（P2）：「默认排序方式」（与 memo 共用 memoSortMode 键）与「默认显示归档」
  // 在面板打开时初始化——此前恒「紧急优先」+ 折叠，两项设置对 todo 面板不生效
  const sortSetting = (tryGetSettings() as any).memoSortMode;
  M.sortMode = sortSetting === 'priority' || sortSetting === 'due' || sortSetting === 'created' ? sortSetting : 'priority';
  M.showDone = (tryGetSettings() as any).memoShowArchivedByDefault === true;

  const overlay = document.createElement('div');
  overlay.className = 'bz-todo-overlay';
  overlay.innerHTML = `
    <div class="bz-todo-panel">
      <div class="bz-todo-head">
        <div class="bz-todo-title">待办</div>
      </div>
      <div class="bz-todo-body">
        <div class="bz-todo-side">
          <div class="bz-todo-side-label">场景</div>
          <div class="bz-todo-nav" data-todo-nav></div>
          <button class="bz-todo-side-add" data-todo-addscene>${iconSpan(ICON.addScene)} 添加场景</button>
        </div>
        <div class="bz-todo-main">
          <div class="bz-todo-main-head">
            <div class="bz-todo-main-title" data-todo-main-title>全部</div>
            <div class="bz-todo-main-count" data-todo-main-count></div>
            <div class="bz-todo-main-spacer"></div>
            <button class="bz-btn bz-btn--primary" data-todo-newbtn>${iconSpan(ICON.add, 'bz-ic--sm')} 新建待办</button>
          </div>
          <div class="bz-todo-toolbar">
            <div class="bz-todo-search">${iconSpan(ICON.search)}<input class="bz-input" type="text" data-todo-search placeholder="搜索内容 / 场景…"></div>
            <div class="bz-todo-sort" data-todo-sort></div>
          </div>
          <div class="bz-todo-mob-scenes" data-todo-mob-scenes></div>
          <div class="bz-todo-content" data-todo-content></div>
          <div class="bz-todo-composer">
            <input class="bz-input" type="text" data-todo-composer-input placeholder="输入内容，Enter 保存…">
            <button class="bz-btn bz-btn--primary" data-todo-composer-add>${iconSpan(ICON.add, 'bz-ic--sm')} 添加</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  topifyZ(overlay); // T6：ADR-0067 动态发号——后开恒压先开的动态 overlay；不再占死静态 100000
  M.overlay = overlay;
  M.appRef = app;
  M.renderFn = () => renderAll();

  const panelEl = overlay.querySelector('.bz-todo-panel') as HTMLElement;
  // 桌面尺寸记忆（ADR-0084）：flex 居中容器内改宽高即双向对称扩缩，越界值回落默认。
  // 仅桌面写内联宽高——内联样式优先级高于移动端媒体查询的满屏规则，写了会把移动端
  // 面板压成视口 92% 小卡（移动端尺寸交给 CSS）
  if (!isMobileEnv()) {
    const saved = savedPanelSize();
    panelEl.style.width = `${saved.w}px`;
    panelEl.style.height = `${saved.h}px`;
  }
  applyMobileWindowFullscreen(panelEl, fullscreen);
  mountIcons(overlay);

  // 排序 segmented（组件库；桌面工具行；移动不显示）
  const sortEl = overlay.querySelector('[data-todo-sort]') as HTMLElement;
  const seg = uiSegmented<string>({
    options: [
      { value: 'priority', label: '紧急优先' },
      { value: 'due', label: '仅按到期' },
      { value: 'created', label: '按创建' },
    ],
    value: M.sortMode,
    onChange: (v) => {
      M.sortMode = v;
      // 同步写入默认排序（与 memo 共用 memoSortMode 键）
      const s = getSettings() as any;
      s.memoSortMode = v;
      void saveSettings();
      renderAll();
    },
  });
  seg.el.classList.add('bz-segmented--sm');
  sortEl.appendChild(seg.el);

  // 桌面拖动缩放（ADR-0084；移动端真全屏/常规卡都由 CSS 撑满视口，不挂）
  if (!isMobileEnv()) {
    panelResizeDetach = uiResizable(panelEl, {
      minW: PANEL.MIN_W, minH: PANEL.MIN_H,
      maxW: PANEL.MAX_W, maxH: PANEL.MAX_H,
      onChange: (w, h) => rememberPanelSize(w, h),
    });
  }

  // 事件委托
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // 点遮罩 = 关闭主面板（无关闭按钮，靠遮罩/ESC）
    if (e.target === overlay) {
      closeTodoPanel();
      return;
    }
    // 场景切换（左栏 / 移动 chips）
    const nav = t.closest('[data-todo-scene]') as HTMLElement | null;
    if (nav) {
      const scene = nav.dataset.todoScene as string;
      M.activeScene = M.activeScene === scene ? '全部' : scene;
      renderAll();
      return;
    }
    const addScene = t.closest('[data-todo-addscene]');
    if (addScene) { openAddSceneDialog(); return; }
    // 主头行「新建待办」按钮 → 打开创建编辑器
    const newBtn = t.closest('[data-todo-newbtn]');
    if (newBtn) { openEditor(null); return; }
    // 已完成折叠条
    const donebar = t.closest('[data-todo-donebar]');
    if (donebar) {
      M.showDone = !M.showDone;
      renderAll();
      return;
    }
    // 底部录入
    const composerAdd = t.closest('[data-todo-composer-add]');
    if (composerAdd) { addFromComposer(); return; }
  });

  // 行内勾选（完成/恢复；300ms 防抖对齐 memo 卡片）
  const content = overlay.querySelector('[data-todo-content]') as HTMLElement;
  content.addEventListener('click', (e) => {
    const check = (e.target as HTMLElement).closest('[data-todo-check]') as HTMLElement | null;
    if (!check) return;
    const card = check.closest('.bz-todo-card') as HTMLElement | null;
    if (!card) return;
    const it = M.items.find((i) => i.id === card.dataset.todoId);
    if (!it) return;
    e.stopPropagation();
    // 已恢复路径（已完成条目勾选 = 恢复）
    if (it.completed) {
      void restoreItem(it);
      return;
    }
    // 完成防抖：300ms 内反悔取消
    if (M.completeTimers.has(it.id)) {
      clearTimeout(M.completeTimers.get(it.id));
      M.completeTimers.delete(it.id);
      return;
    }
    const timer = setTimeout(() => {
      M.completeTimers.delete(it.id);
      void completeItem(it);
    }, 300);
    M.completeTimers.set(it.id, timer);
  });

  // 底部录入 Enter
  const composerInput = overlay.querySelector('[data-todo-composer-input]') as HTMLInputElement;
  composerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addFromComposer();
  });

  // 搜索（防抖 250ms）
  const searchInput = overlay.querySelector('[data-todo-search]') as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    M.search = searchInput.value.trim();
    renderAll();
  });

  void (async () => {
    await loadData();
    renderAll();
  })();
}

export function closeTodoPanel(): void {
  if (M.overlay) {
    M.overlay.remove();
    M.overlay = null;
  }
  // 卸载拖动缩放（detach 幂等；无会话内 handler 残留）
  if (panelResizeDetach) {
    panelResizeDetach.detach();
    panelResizeDetach = null;
  }
  flushPendingSize(); // T2：面板关闭时立即落盘尺寸（防防抖窗口内丢失）
  M.renderFn = null;
  M.completeTimers.forEach((t) => clearTimeout(t));
  M.completeTimers.clear();
}

let mainEscRegistered = false;
export function registerEscapeHandler(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  escManager.register('bz-todo', {
    isVisible: () => !!M.overlay,
    close: () => closeTodoPanel(),
  });
}

// ---------- 面板尺寸记忆（ADR-0084：uiResizable 松手落 settings；重开沿用） ----------

/** 面板当前 resize detach（打开期间非空，关闭清空） */
let panelResizeDetach: { detach: () => void } | null = null;

/** 记忆尺寸安全读取（settings 兜底默认值；越界——旧值/手改——回落默认或钳到上限） */
function savedPanelSize(): { w: number; h: number } {
  const s = tryGetSettings() as any;
  const w = Number(s?.todoPanelWidth) || 0;
  const h = Number(s?.todoPanelHeight) || 0;
  if (w < PANEL.MIN_W || h < PANEL.MIN_H) return { w: PANEL.DEF_W, h: PANEL.DEF_H };
  // 上限：硬上限 + 视口 92% 双限（与 uiResizable cap 同口径，防手改超大值打开即超屏）
  const capW = Math.min(PANEL.MAX_W, Math.floor(window.innerWidth * 0.92));
  const capH = Math.min(PANEL.MAX_H, Math.floor(window.innerHeight * 0.92));
  return { w: Math.min(w, capW), h: Math.min(h, capH) };
}

/**
 * 面板拖动缩放记忆（T2）：拖动期间每帧回调 → trailing 防抖 150ms 落盘一次，
 * 避免拖一次面板边界 = 几十上百次 settings 写盘（ADR-0084 意图：松手沿用，非逐帧持久化）。
 * 关闭面板时 flushPendingSize() 立即落盘防丢。
 */
let pendingSizeTimer: ReturnType<typeof setTimeout> | null = null;
function rememberPanelSize(w: number, h: number): void {
  const s = tryGetSettings() as any;
  if (!s) return;
  s.todoPanelWidth = w;
  s.todoPanelHeight = h;
  if (pendingSizeTimer !== null) clearTimeout(pendingSizeTimer);
  pendingSizeTimer = setTimeout(() => {
    pendingSizeTimer = null;
    void saveSettings();
  }, 150);
}
function flushPendingSize(): void {
  if (pendingSizeTimer !== null) {
    clearTimeout(pendingSizeTimer);
    pendingSizeTimer = null;
    void saveSettings();
  }
}

// ---------- 渲染 ----------

function renderAll(): void {
  if (!M.overlay) return;
  renderNav();
  renderMobScenes();
  renderMainHead();
  renderContent();
}

/** 主头行（原型 p1-main-head）：当前场景标题 + “· N 项 · M 未完成” + 右侧新建按钮 */
function renderMainHead(): void {
  const overlay = M.overlay!;
  const titleEl = overlay.querySelector('[data-todo-main-title]') as HTMLElement | null;
  const countEl = overlay.querySelector('[data-todo-main-count]') as HTMLElement | null;
  if (!titleEl || !countEl) return;
  titleEl.textContent = M.activeScene;
  // 计数 = 当前场景 + 当前搜索下的条目总数与未完成数（对齐原型 updateCount）
  const items = getVisibleItems();
  const undone = items.filter((i) => !i.completed).length;
  countEl.textContent = `· ${items.length} 项 · ${undone} 未完成`;
}

/** 场景计数归一（桌面 nav / 移动 chips 共用） */
function sceneOptions(): { scene: string; dot: string }[] {
  return [
    { scene: '全部', dot: '' },
    { scene: '今日', dot: '#e5534b' },
    ...TodoData.getScenarios().map((s) => ({ scene: s, dot: sceneDot(s) })),
  ];
}

function renderNav(): void {
  const nav = M.overlay!.querySelector('[data-todo-nav]') as HTMLElement;
  if (!nav) return;
  nav.innerHTML = sceneOptions()
    .map((o) => {
      const active = M.activeScene === o.scene;
      const dotHtml = o.scene === '全部'
        ? ''
        : `<span class="bz-todo-nav-dot" style="background:${o.dot}"></span>`;
      return `<button class="bz-todo-nav-item${active ? ' bz-todo-nav-active' : ''}" data-todo-scene="${esc(o.scene)}">${dotHtml}<span>${esc(o.scene)}</span><span class="bz-todo-nav-cnt">${sceneCount(o.scene)}</span></button>`;
    })
    .join('');
  mountIcons(nav);
}

function renderMobScenes(): void {
  const wrap = M.overlay!.querySelector('[data-todo-mob-scenes]') as HTMLElement;
  if (!wrap) return;
  wrap.innerHTML = sceneOptions()
    .map((o) => {
      const active = M.activeScene === o.scene;
      const dotHtml = o.scene === '全部'
        ? ''
        : `<span class="bz-todo-nav-dot" style="background:${o.dot}"></span>`;
      return `<button class="bz-todo-mob-chip${active ? ' bz-todo-mob-chip-active' : ''}" data-todo-scene="${esc(o.scene)}">${dotHtml}${esc(o.scene)}</button>`;
    })
    .join('');
}

/** 卡片 meta 行（顺序对齐 memo buildMeta：课程→脚本→链接→位置→场景→截止→时间） */
function metaTags(it: TodoItem): string {
  const tags: string[] = [];
  // 1. 课程（公开课）
  if (it.scene === '公开课' && it.courseName) {
    tags.push(`<span class="bz-todo-tag bz-todo-tag-course">${iconSpan(ICON.course)} ${esc(it.courseName.replace(/^《|》$/g, ''))}</span>`);
  }
  // 2. 脚本（代码）
  if (it.scene === '代码' && it.scriptName) {
    tags.push(`<span class="bz-todo-tag bz-todo-tag-script">${iconSpan(ICON.script)} ${esc(it.scriptName)}</span>`);
  }
  // 3. 链接
  if (it.url) {
    let host = '链接';
    try { host = new URL(it.url).hostname.replace(/^www\./, ''); } catch (e) { /* 保持默认 */ }
    tags.push(`<span class="bz-todo-tag bz-todo-tag-url" title="${esc(it.url)}">${iconSpan(ICON.url)} ${esc(host)}</span>`);
  }
  // 4. 位置（绑定笔记才显示；公开课课程同名文件不重复）
  if (it.notePath) {
    const name = it.notePath.split('/').pop()!.replace(/\.md$/i, '');
    const isCourseSame = it.scene === '公开课' && it.courseName && it.courseName.replace(/^《|》$/g, '') === name;
    if (!isCourseSame) {
      tags.push(`<span class="bz-todo-tag bz-todo-tag-pos" data-todo-pos="${esc(it.id)}">${iconSpan(ICON.pos)} ${esc(name)}</span>`);
    }
  }
  // 5. 场景（重要红底）
  const imp = it.priority === 'important' ? ' bz-todo-tag-important' : '';
  tags.push(`<span class="bz-todo-tag bz-todo-tag-scene${imp}">#${esc(it.scene)}</span>`);
  // 6. 截止（未完成）
  if (it.due && !it.completed) {
    const st = getDueStatus(it.due);
    tags.push(`<span class="bz-todo-tag ${dueTagClass(st!)}">${iconSpan(dueIconName(st!))} ${esc(dueText(it))}</span>`);
  }
  // 7. 相对时间
  if (it.created) {
    tags.push(`<span class="bz-todo-time">${esc(formatRelativeTime(it.created))}</span>`);
  }
  return tags.join('');
}

function renderContent(): void {
  const content = M.overlay!.querySelector('[data-todo-content]') as HTMLElement;
  if (!content) return;
  const items = getVisibleItems();
  if (items.length === 0) {
    content.innerHTML = `<div class="bz-todo-empty">${M.search ? '没有匹配的待办' : '这里还没有待办，记一条吧'}</div>`;
    return;
  }
  // 分组：到期优先（overdue/today）→ 其他 → 已完成（折叠条）
  const active = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);
  const urgent = active.filter((i) => dueRank(i) <= 1);
  const normal = active.filter((i) => dueRank(i) > 1);

  const cardHtml = (it: TodoItem, isDone: boolean) => {
    const checkCls = isDone ? ' bz-todo-checked' : '';
    const titleCls = it.completed ? ' bz-todo-done' : '';
    // 内容：有 url/linkedNote 时显示为可点链接（点击 = 打开），纯文本直出
    const clickable = !!(it.linkedNote || it.url);
    const titleHtml = clickable
      ? `<a href="javascript:void(0)" data-todo-openitem="${esc(it.id)}">${esc(it.title)}</a>`
      : esc(it.title);
    return `<div class="bz-todo-card${titleCls}" data-todo-id="${esc(it.id)}">
      <span class="bz-todo-check${checkCls}" data-todo-check title="${isDone ? '恢复未完成' : '标记完成'}"></span>
      <div class="bz-todo-body-text">
        <div class="bz-todo-card-title">${titleHtml}</div>
        <div class="bz-todo-meta">${metaTags(it)}</div>
      </div>
    </div>`;
  };

  const sections: string[] = [];
  if (urgent.length) {
    sections.push(`<div class="bz-todo-section-label">到期优先 <span class="bz-todo-sec-cnt">${urgent.length}</span></div>`);
    sections.push(...urgent.map((it) => cardHtml(it, false)));
  }
  if (normal.length) {
    sections.push(`<div class="bz-todo-section-label">其他 <span class="bz-todo-sec-cnt">${normal.length}</span></div>`);
    sections.push(...normal.map((it) => cardHtml(it, false)));
  }
  if (done.length) {
    const open = M.showDone;
    sections.push(`<div class="bz-todo-donebar${open ? ' bz-todo-donebar-open' : ''}" data-todo-donebar>
      ${iconSpan(ICON.doneFold)} 已完成 <span class="bz-todo-donebar-cnt">${done.length}</span></div>`);
    if (open) sections.push(...done.map((it) => cardHtml(it, true)));
  }
  content.innerHTML = sections.join('');
  mountIcons(content);

  // 链接点击：打开关联内容（内部笔记 / 外部 URL），不走浏览器默认
  content.querySelectorAll('[data-todo-openitem]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const it = M.items.find((i) => i.id === (el as HTMLElement).dataset.todoOpenitem);
      if (it) openItem(it);
    });
  });
  // 位置标签点击 → 跳转关联笔记
  content.querySelectorAll('[data-todo-pos]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = M.items.find((i) => i.id === (el as HTMLElement).dataset.todoPos);
      if (it) jumpToNote(it);
    });
  });

  // 条目卡操作（右键菜单 / 移动长按抽屉）——桌面右键无头卡、移动抽屉带 sheetHead 由组件库分发
  content.querySelectorAll('.bz-todo-card').forEach((card) => {
    const id = (card as HTMLElement).dataset.todoId;
    const it = M.items.find((i) => i.id === id);
    if (!it) return;
    attachItemActions(card as HTMLElement, buildCardActions(it), {
      sheetHead: buildSheetHead(it),
    });
  });
}

/** 移动抽屉顶部信息说明（与列表卡一致的标题 + meta；桌面右键菜单不带头部，组件库自动区分） */
function buildSheetHead(it: TodoItem): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-item-sheet-entry';
  const title = document.createElement('div');
  title.textContent = it.title;
  if (it.completed) title.classList.add('done');
  head.appendChild(title);
  const meta = document.createElement('div');
  meta.className = 'bz-todo-meta';
  meta.innerHTML = metaTags(it);
  mountIcons(meta);
  head.appendChild(meta);
  return head;
}

// ---------- 卡片操作（菜单/抽屉动作全集） ----------

function openItem(it: TodoItem): void {
  closeTodoPanel();
  const app = M.appRef!;
  if (it.linkedNote) {
    const file = app.vault.getAbstractFileByPath(it.linkedNote);
    if (file) void app.workspace.getLeaf().openFile(file as any);
    else notice('关联笔记不存在');
  } else if (it.url) {
    try {
      (app as any).openUrl(it.url);
    } catch (e) {
      const electron = (window as any).require && (window as any).require('electron');
      if (electron && electron.shell) electron.shell.openExternal(it.url);
    }
  }
}

function jumpToNote(it: TodoItem): void {
  if (!it.notePath) return;
  closeTodoPanel();
  const app = M.appRef!;
  const file = app.vault.getAbstractFileByPath(it.notePath);
  if (!file) {
    notice('关联笔记不存在');
    return;
  }
  const leaf = app.workspace.getLeaf();
  void leaf.openFile(file as any);
  const editor = (leaf as any).view?.editor;
  if (editor && it.notePosition) {
    const { line, ch } = it.notePosition;
    editor.focus();
    editor.setCursor(line, ch || 0);
    editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
  }
}

async function completeItem(it: TodoItem): Promise<void> {
  try {
    await TodoData.completeItem(it.id);
    emitDomainEvent('memo', { kind: 'completed', title: it.title });
    notice('已标记完成', 'success');
  } catch (e) {
    notice('操作失败', 'error');
    console.error(e);
  }
  await refresh();
}

async function restoreItem(it: TodoItem): Promise<void> {
  try {
    await TodoData.updateItem(it.id, { completed: null } as any);
    emitDomainEvent('memo', { kind: 'restored', title: it.title });
    notice('已恢复未完成', 'success');
  } catch (e) {
    notice('操作失败', 'error');
    console.error(e);
  }
  await refresh();
}

async function postponeItem(id: string, days: number): Promise<void> {
  const it = M.items.find((i) => i.id === id);
  if (!it || !it.due) return;
  const d = new Date(it.due.replace('T', ' '));
  d.setDate(d.getDate() + days);
  const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  try {
    await TodoData.updateItem(id, { due: next } as any);
    emitDomainEvent('memo', { kind: 'postponed', title: it.title, due: next });
    notice(`已延后 ${days} 天`, 'success');
  } catch (e) {
    notice('操作失败', 'error');
    console.error(e);
  }
  await refresh();
}

async function togglePrio(id: string): Promise<void> {
  const it = M.items.find((i) => i.id === id);
  if (!it) return;
  const to = it.priority === 'important' ? 'minor' : 'important';
  try {
    await TodoData.updateItem(id, { priority: to } as any);
    emitDomainEvent('memo', { kind: 'priority', title: it.title, to });
    notice(to === 'important' ? '已转为重要' : '已转为次要', 'success');
  } catch (e) {
    notice('操作失败', 'error');
    console.error(e);
  }
  await refresh();
}

async function deleteItemConfirm(it: TodoItem): Promise<void> {
  const ok = await openFlowDialog({
    title: '删除待办',
    message: it.title,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'delete', danger: true, cta: true },
    ],
  });
  if (ok !== 'delete') return;
  try {
    await TodoData.deleteItem(it.id);
    emitDomainEvent('memo', { kind: 'deleted', title: it.title });
    notice('已删除', 'success');
  } catch (e) {
    notice('删除失败', 'error');
    console.error(e);
  }
  await refresh();
}

/** 条目操作动作（桌面右键菜单 / 移动长按抽屉共用；keepOpen 用于抽屉内继续操作） */
function buildCardActions(it: TodoItem): ItemAction[] {
  const actions: ItemAction[] = [];
  if (it.linkedNote || it.url) {
    let sub: string | undefined;
    if (it.linkedNote) sub = it.linkedNote.split('/').pop()?.replace(/\.md$/i, '');
    else if (it.url) {
      try { sub = new URL(it.url).hostname; } catch (e) { /* 忽略 */ }
    }
    actions.push({ icon: 'external-link', label: '打开', title: '打开关联内容', sub, onClick: () => openItem(it) });
  }
  if (it.notePath) {
    actions.push({
      icon: 'book-open', label: '跳转关联笔记', title: '跳转关联笔记',
      sub: it.notePath.split('/').pop()?.replace(/\.md$/i, ''),
      onClick: () => jumpToNote(it),
    });
  }
  if (!it.completed) {
    actions.push({
      icon: 'check-circle', label: '标记完成', title: '标记完成',
      sub: it.due ? formatDueText(it.due) : undefined,
      onClick: async () => { await completeItem(it); },
    });
  } else {
    actions.push({ icon: 'rotate-ccw', label: '恢复未完成', title: '恢复未完成', onClick: async () => { await restoreItem(it); } });
  }
  if (it.due && !it.completed) {
    const postponeSub = (days: number) => {
      const d = new Date(it.due!.replace('T', ' '));
      d.setDate(d.getDate() + days);
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    actions.push({ icon: 'clock', label: '延后 1 天', title: '延后 1 天', sub: `→ ${postponeSub(1)}`, onClick: async () => { await postponeItem(it.id, 1); } });
    actions.push({ icon: 'clock', label: '延后 3 天', title: '延后 3 天', sub: `→ ${postponeSub(3)}`, onClick: async () => { await postponeItem(it.id, 3); } });
  }
  const isImportant = it.priority === 'important';
  actions.push({
    icon: 'star', label: isImportant ? '转为次要' : '转为重要', title: '切换优先级',
    onClick: async () => { await togglePrio(it.id); },
  });
  actions.push({
    icon: 'copy', label: '复制内容', title: '复制内容',
    sub: `${it.title.length} 字`,
    onClick: async () => { await navigator.clipboard.writeText(it.title); notice('内容已复制', 'success'); },
  });
  // 编辑紧贴删除之上；删除永远垫底（danger）
  actions.push({ icon: 'pencil', label: '编辑', title: '编辑', onClick: () => openEditor(it) });
  actions.push({ icon: 'trash-2', label: '删除', title: '删除', kind: 'danger', onClick: () => void deleteItemConfirm(it) });
  return actions;
}

// ---------- 编辑器（新建/编辑弹窗） ----------

function addFromComposer(): void {
  const overlay = M.overlay!;
  const input = overlay.querySelector('[data-todo-composer-input]') as HTMLInputElement;
  const txt = (input.value || '').trim();
  if (!txt) { notice('请输入内容'); return; }
  const scenes = TodoData.getScenarios();
  const scene = M.activeScene === '全部' || M.activeScene === '今日'
    ? scenes[0]
    : scenes.includes(M.activeScene) ? M.activeScene : scenes[0];
  void (async () => {
    // T4：composer 快速录入与编辑器同口径提取 URL（标题含链接 → url 可点）
    const { url } = extractUrlAndDisplay(txt);
    const it: TodoItem = {
      id: generateId(), // T5：与旧 memo 同前缀 'item'（同源 memo.json）
      title: txt,
      scene,
      priority: 'minor',
      created: moment().format('YYYY-MM-DD HH:mm:ss'),
      completed: null,
      due: null,
      notePath: null,
      notePosition: null,
      scriptName: null,
      courseName: null,
      coursePath: null,
      linkedNote: null,
      url,
    };
    try {
      await TodoData.addItem(it);
      emitDomainEvent('memo', { kind: 'added', title: it.title, scene: it.scene, priority: it.priority, due: it.due });
      notice(`已添加到「${scene}」`, 'success');
    } catch (e) {
      notice('保存失败', 'error');
      console.error(e);
    }
    input.value = '';
    await refresh();
  })();
}

/** 打开编辑器（item = null 新建）；用 uiModal：无关闭按钮、点遮罩/ESC 关闭 */
export function openEditor(item: TodoItem | null): void {
  const isEdit = !!item;
  const scenes = TodoData.getScenarios();
  const editing = item ?? null;
  // 默认场景：设置 memoDefaultScene 或第一个
  let defaultScene: string;
  if (editing) defaultScene = editing.scene;
  else {
    const s = (tryGetSettings() as any).memoDefaultScene;
    defaultScene = s && scenes.includes(s) ? s : scenes[0];
  }
  const isClip = defaultScene === '剪藏';
  const isCode = defaultScene === '代码';
  const isCourse = defaultScene === '公开课';

  // 构建表单（字段全部组件库类；图标 lucide）
  const form = document.createElement('div');
  form.className = 'bz-todo-form';
  const title = document.createElement('div');
  title.className = 'bz-todo-form-title';
  title.textContent = isEdit ? '编辑待办' : '创建待办';
  form.appendChild(title);

  // 内容
  const contentField = document.createElement('div');
  contentField.className = 'bz-field';
  const contentLabel = document.createElement('span');
  contentLabel.className = 'bz-field-label';
  contentLabel.textContent = '内容';
  const contentInput = document.createElement('textarea');
  contentInput.className = 'bz-input';
  contentInput.placeholder = '输入待办内容...';
  contentInput.value = editing ? editing.title : '';
  contentField.append(contentLabel, contentInput);
  form.appendChild(contentField);

  // 第二输入框区（剪藏标题/代码脚本/公开课课程；随场景显隐）——放在场景平铺上方
  const titleBox = document.createElement('div');
  titleBox.className = 'bz-todo-extra' + (isClip ? ' bz-todo-extra-on' : '');
  const titleInput = document.createElement('input');
  titleInput.className = 'bz-input';
  titleInput.placeholder = '标题（可选）';
  titleInput.value = '';
  titleBox.appendChild(titleInput);
  form.appendChild(titleBox);

  const scriptBox = document.createElement('div');
  scriptBox.className = 'bz-todo-extra' + (isCode ? ' bz-todo-extra-on' : '');
  const scriptInput = document.createElement('input');
  scriptInput.className = 'bz-input';
  scriptInput.placeholder = '脚本名';
  scriptInput.value = editing?.scriptName || '';
  const scriptSug = document.createElement('div');
  scriptSug.className = 'bz-todo-sug-box';
  scriptSug.style.display = 'none';
  scriptBox.append(scriptInput, scriptSug);
  form.appendChild(scriptBox);

  const courseBox = document.createElement('div');
  courseBox.className = 'bz-todo-extra' + (isCourse ? ' bz-todo-extra-on' : '');
  const courseInput = document.createElement('input');
  courseInput.className = 'bz-input';
  courseInput.placeholder = '课程名';
  courseInput.value = editing?.courseName || '';
  const courseSug = document.createElement('div');
  courseSug.className = 'bz-todo-sug-box';
  courseSug.style.display = 'none';
  courseBox.append(courseInput, courseSug);
  form.appendChild(courseBox);

  // 场景平铺单选（uiChoice：无彩色圆点，选中 = 品牌色非黑底）
  const sceneField = document.createElement('div');
  sceneField.className = 'bz-field';
  const sceneLabel = document.createElement('span');
  sceneLabel.className = 'bz-field-label';
  sceneLabel.textContent = '场景';
  sceneField.appendChild(sceneLabel);
  const choice = uiChoice<string>({
    options: scenes.map((s) => ({ value: s, label: s })),
    value: defaultScene,
    onChange: (v) => {
      // 场景联动：剪藏 → 标题框；代码 → 脚本框；公开课 → 课程框（class 驱动显隐）
      titleBox.classList.toggle('bz-todo-extra-on', v === '剪藏');
      scriptBox.classList.toggle('bz-todo-extra-on', v === '代码');
      courseBox.classList.toggle('bz-todo-extra-on', v === '公开课');
    },
  });
  sceneField.appendChild(choice.el);
  form.appendChild(sceneField);

  // 优先级平铺单选（无彩色圆点）
  const prioField = document.createElement('div');
  prioField.className = 'bz-field';
  const prioLabel = document.createElement('span');
  prioLabel.className = 'bz-field-label';
  prioLabel.textContent = '优先级';
  prioField.appendChild(prioLabel);
  const prioChoice = uiChoice<string>({
    options: [
      { value: 'minor', label: '次要' },
      { value: 'important', label: '重要' },
    ],
    value: editing ? editing.priority : (tryGetSettings() as any).memoDefaultPriority || 'minor',
    onChange: () => { /* 值由保存时读取 */ },
  });
  prioField.appendChild(prioChoice.el);
  form.appendChild(prioField);

  // 建议（从已有条目收集脚本名/课程名 + 公开课笔记）
  const knownScripts = [...new Set(M.items.map((i) => i.scriptName).filter((n): n is string => !!n))].sort();
  const knownCourses = [...new Set(M.items.map((i) => i.courseName).filter((n): n is string => !!n))].sort();
  function bindSug(input: HTMLInputElement, sug: HTMLElement, list: () => string[]) {
    const render = () => {
      const v = input.value.trim().toLowerCase();
      const all = list()
        .filter((s) => !v || s.toLowerCase().includes(v))
        .slice(0, 5);
      if (!all.length) { sug.style.display = 'none'; return; }
      sug.innerHTML = all.map((s) => `<button class="bz-todo-sug-item" type="button">${esc(s)}</button>`).join('');
      sug.style.display = 'block';
      sug.querySelectorAll('.bz-todo-sug-item').forEach((b) => {
        b.addEventListener('click', () => { input.value = (b as HTMLElement).textContent || ''; sug.style.display = 'none'; });
      });
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    render();
  }
  bindSug(scriptInput, scriptSug, () => knownScripts);
  bindSug(courseInput, courseSug, () => knownCourses);
  void TodoData.getCourseNotes().then((notes) => {
    const extra = notes.map((n) => n.name);
    knownCourses.push(...extra.filter((n) => !knownCourses.includes(n)));
    if (courseBox.classList.contains('bz-todo-extra-on')) courseInput.dispatchEvent(new Event('focus'));
  });

  // 截止时间
  const dueField = document.createElement('div');
  dueField.className = 'bz-field';
  const dueLabel = document.createElement('span');
  dueLabel.className = 'bz-field-label';
  dueLabel.textContent = '截止时间（可选）';
  const dueRow = document.createElement('div');
  dueRow.className = 'bz-todo-due-row';
  const dueInput = document.createElement('input');
  dueInput.type = 'datetime-local';
  dueInput.className = 'bz-input';
  if (editing?.due) dueInput.value = editing.due.replace(' ', 'T');
  const dueClear = uiIconBtnClear();
  dueClear.style.display = editing?.due ? 'inline-flex' : 'none';
  dueClear.addEventListener('click', () => { dueInput.value = ''; dueClear.style.display = 'none'; });
  dueInput.addEventListener('input', () => { dueClear.style.display = dueInput.value ? 'inline-flex' : 'none'; });
  dueRow.append(dueInput, dueClear);
  dueField.append(dueLabel, dueRow);
  form.appendChild(dueField);

  // 📌 定位（真实读取当前笔记与光标；修复排版：flex 垂直居中）
  const posRow = document.createElement('div');
  posRow.className = 'bz-todo-pos-row';
  const posState: { notePath: string | null; notePosition: { line: number; ch: number } | null } = {
    notePath: editing?.notePath || null,
    notePosition: editing?.notePosition || null,
  };
  const setPosBtn = (name: string, active: boolean) => {
    posBtn.textContent = '';
    posBtn.appendChild(uiIcon('pin'));
    const span = document.createElement('span');
    span.textContent = name;
    posBtn.appendChild(span);
    posBtn.classList.toggle('bz-todo-pos-btn-active', active);
  };
  const posBtn = uiBtn({
    label: '',
    icon: 'pin',
    onClick: () => {
      if (posState.notePath) {
        posState.notePath = null;
        posState.notePosition = null;
        setPosBtn('定位到笔记', false);
        return;
      }
      const info = getCurrentNoteInfo();
      const pos = getCurrentCursorPosition();
      if (info && pos) {
        posState.notePath = info.path;
        posState.notePosition = { line: pos.line, ch: pos.ch };
        setPosBtn(info.name, true);
      } else {
        notice('无法获取当前位置');
      }
    },
  });
  // uiBtn 会把 label '' 跳过，补图标后追加文本 span
  if (posState.notePath) {
    const name = (posState.notePath.split('/').pop() || '').replace(/\.md$/i, '');
    setPosBtn(name, true);
  } else {
    setPosBtn('定位到笔记', false);
  }
  const posHint = document.createElement('span');
  posHint.className = 'bz-todo-pos-hint';
  posHint.textContent = '绑定当前打开的笔记位置';
  posRow.append(posBtn, posHint);
  form.appendChild(posRow);

  // 底部按钮行（先建好 modal 拿 close，再绑按钮；避免 TDZ）
  let closeModal: () => void = () => {};
  const modalBox = document.createElement('div');
  modalBox.className = 'bz-todo-editor';
  const cancelBtn = uiBtn({ label: '取消', onClick: () => closeModal() });
  const saveBtn = uiBtn({ label: isEdit ? '保存' : '添加', tone: 'primary' });
  const actionsRow = document.createElement('div');
  actionsRow.className = 'bz-todo-form-actions';
  actionsRow.appendChild(uiBtnRow([cancelBtn, saveBtn]));
  form.appendChild(actionsRow);
  modalBox.appendChild(form);

  // 保存
  saveBtn.addEventListener('click', () => {
    const content = contentInput.value.trim();
    if (!content) { notice('请输入内容'); return; }
    let scene: string = defaultScene;
    const sceneBtnOn = choice.el.querySelector('.is-on');
    if (sceneBtnOn) scene = (sceneBtnOn as HTMLElement).dataset.value || scene;
    const prioBtnOn = prioChoice.el.querySelector('.is-on');
    const priority: string = prioBtnOn ? (prioBtnOn as HTMLElement).dataset.value || 'minor' : 'minor';
    const dueVal = dueInput.value;
    const due = dueVal ? dueVal.replace('T', ' ') : null;
    const titleVal = titleInput.value.trim();
    const scriptName = scene === '代码' ? (scriptInput.value.trim() || null) : null;
    const courseName = scene === '公开课' ? (courseInput.value.trim() || null) : null;
    // 剪藏：标题可选（未填则用内容）
    const finalTitle = scene === '剪藏' && titleVal ? titleVal : content;
    const { url } = extractUrlAndDisplay(content);
    void (async () => {
      try {
        if (isEdit && editing) {
          await TodoData.updateItem(editing.id, {
            title: finalTitle,
            scene,
            priority,
            due,
            notePath: posState.notePath,
            notePosition: posState.notePosition,
            scriptName,
            courseName,
            url: url ?? editing.url,
          } as any);
          emitDomainEvent('memo', { kind: 'edited', old: { title: editing.title }, next: { title: finalTitle, scene, priority, due } });
          notice('已保存', 'success');
        } else {
          const it: TodoItem = {
            id: generateId(), // T5：与旧 memo 同前缀 'item'（同源 memo.json）
            title: finalTitle,
            scene,
            priority,
            created: moment().format('YYYY-MM-DD HH:mm:ss'),
            completed: null,
            due,
            notePath: posState.notePath,
            notePosition: posState.notePosition,
            scriptName,
            courseName,
            coursePath: null,
            linkedNote: null,
            url,
          };
          await TodoData.addItem(it);
          emitDomainEvent('memo', { kind: 'added', title: finalTitle, scene, priority, due });
          notice(`已添加到「${scene}」`, 'success');
        }
        closeModal();
        await refresh();
      } catch (e) {
        notice('保存失败', 'error');
        console.error(e);
      }
    })();
  });

  const { close } = uiModal({ content: modalBox, maxWidth: 420 });
  closeModal = close;
  contentInput.focus();
}

function uiIconBtnClear(): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bz-icon-btn bz-icon-btn--lg';
  b.title = '清除截止时间';
  b.appendChild(uiIcon('x'));
  return b;
}

// ---------- 添加场景弹窗 ----------

function openAddSceneDialog(): void {
  const wrap = document.createElement('div');
  wrap.className = 'bz-todo-addscene';
  const title = document.createElement('div');
  title.className = 'bz-todo-form-title';
  title.textContent = '添加场景';
  const input = document.createElement('input');
  input.className = 'bz-input';
  input.placeholder = '场景名称（如：健身）';
  const hint = document.createElement('div');
  hint.className = 'bz-todo-addscene-hint';
  hint.textContent = '场景将写入备忘录设置（与旧备忘录共用）';
  const saveBtn = uiBtn({ label: '添加', tone: 'primary' });
  const cancelBtn = uiBtn({ label: '取消' });
  const row = uiBtnRow([cancelBtn, saveBtn]);
  wrap.append(title, input, hint, row);
  const { close } = uiModal({ content: wrap, maxWidth: 340 });
  const doSave = () => {
    const name = input.value.trim();
    if (!name) { notice('请输入场景名称'); return; }
    if (/[,，]/.test(name)) { notice('场景名不能包含逗号'); return; }
    const scenes = TodoData.getScenarios();
    if (scenes.includes(name)) { notice('场景已存在'); return; }
    const settings = getSettings() as any;
    const next = [...scenes, name].join(',');
    settings.memoScenarios = next;
    void saveSettings().then(async () => {
      TodoData.init(getSettings() as any);
      notice(`已添加场景「${name}」`, 'success');
      close();
      await refresh();
    });
  };
  saveBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', () => close());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSave();
    if (e.key === 'Escape') close();
  });
  setTimeout(() => input.focus(), 30);
}

// ---------- 导出（index.ts 用） ----------

export function ensureTodo(app: App): void {
  if (M.appRef) return;
  M.appRef = app;
  registerEscapeHandler();
  subscribeMemoSync(app); // T1：同源 memo.json 跨域同步
  void loadData();
}

export function openTodo(app: App): void {
  ensureTodo(app);
  openTodoPanel(app);
}

export function addTodo(app: App): void {
  ensureTodo(app);
  void (async () => {
    if (!M.items.length) await loadData();
    if (!M.overlay) openTodoPanel(app);
    openEditor(null);
  })();
}

export function unloadTodo(): void {
  closeTodoPanel();
  unsubscribeMemoSync(); // T1：退订 vault modify + 还原 TodoData.write 包装
  M.completeTimers.forEach((t) => clearTimeout(t));
  M.completeTimers.clear();
  M.appRef = null;
}
