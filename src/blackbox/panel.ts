/**
 * 黑匣子主面板（v3 流式，grilling 2026-08 封板）：bz-blackbox-panel「黑匣子面板」。
 * 流式布局照搬日记本骨架：header（标题 + ✏️ 录入/👤 人物/🕐 时间线/⚙️ 设置/❌ 关闭）
 * + 类型标签栏（🧩 概念/📎 文献/💡 想法 多选，默认空集=全部）+ 搜索框（防抖）+ 时间流
 * （日期分隔吸顶 + 三类条目混排按 createdAt 降序 + 批次滚动）。
 * 卡片纯展示，无任何点击交互（无单击/双击/长按/emoji 点击——只参考日记本流式布局）。
 * 人物画像与事件时间线为面板内独立弹窗（完整度保留，复用 v2 渲染函数，宿主改为弹窗）。
 * 数据单份存储：画像事件投影与全局时间线同源（按人过滤，无复制）。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import type { EscHandle } from '../core/esc-manager';
import { createOverlay, createIconBtn } from '../core/dom';
import { confirm } from '../core/confirm';
import { notice } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { BlackBoxDataManager } from './data';
import { setBlackBoxSyncNotify } from './sync';
import { createProfileWithSeed, openBlackBoxCapture } from './capture';
import { openBlackBoxSettings } from './settings-ui';
import { jumpFromSource } from './host';
import { entrySourceText, resolveSourceJump, sourceDisplayText } from './source-jump';
import {
  aggregateEmotions,
  filterEventsByPerson,
  groupEventsByMonth,
  personLabel,
  resolveShowSpeculative,
  MAX_PEOPLE,
} from './types';
import type { BlackBoxData, Entry, EntryType, EventItem, Profile } from './types';

/** 批次大小（照搬日记本无限滚动骨架；数据为内存全量，分页仅保 DOM 性能与观感一致） */
const BATCH = 20;

let appRef: App | null = null;
let dataManager: BlackBoxDataManager | null = null;
let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let escHandle: EscHandle | null = null;
let data: BlackBoxData | null = null;

/** 类型筛选（单选 Set：0 或 1 个；空集 = 显示全部） */
let selectedTypes = new Set<EntryType>();
/** 概念子分类筛选（ticket 50：概念标签选中时展开子分类行，点击筛选该分类概念；null = 全览） */
let selectedCategory: string | null = null;
/** 搜索关键词（防抖后生效） */
let searchKeyword = '';
/** 搜索框显隐（ticket 04：默认隐藏，🔍 切换；隐藏即清空关键词） */
let searchVisible = false;
/** 批次游标（已渲染条数上限） */
let displayCount = BATCH;
/** 滚动保留 */
let streamScrollTop = 0;

/** 弹窗状态（👤 人物 / 🕐 时间线） */
let peopleMaskEl: HTMLElement | null = null;
let peoplePopupEl: HTMLElement | null = null;
let peopleEscHandle: EscHandle | null = null;
let timelineMaskEl: HTMLElement | null = null;
let timelinePopupEl: HTMLElement | null = null;
let timelineEscHandle: EscHandle | null = null;
/** 概念详情展开态（概念墙跳转用，保留 v2 语义） */
let detailConceptId: string | null = null;
/** 画像详情展开态 */
let detailProfileId: string | null = null;
/** 时间线筛选 */
let tlPerson = '';
let tlYear = '';
/** 面板内新建画像表单展开态 */
let panelNewProfileOpen = false;

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

/** 打开主面板（幂等；全新打开立即渲染骨架 + 「正在扫描」提示，数据后台加载后再渲染） */
export async function openBlackBoxPanel(app: App): Promise<void> {
  appRef = app;
  if (maskEl) {
    maskEl.style.display = 'block';
    popupEl!.style.display = 'flex';
    data = await manager(app).load();
    refreshAll();
    return;
  }
  searchVisible = false; // 每次打开回到默认隐藏
  // 默认类型筛选（设置项 blackboxDefaultTypeFilter，重启生效；空 = 全部）
  const s = tryGetSettings() as any;
  const def = (s && s.blackboxDefaultTypeFilter) || '';
  selectedTypes = def === 'concept' || def === 'literature' || def === 'thought' ? new Set([def]) : new Set();
  selectedCategory = null;
  searchKeyword = '';
  searchVisible = false; // 每次打开搜索框默认隐藏
  displayCount = BATCH;
  streamScrollTop = 0;
  detailConceptId = null;
  detailProfileId = null;
  tlPerson = '';
  tlYear = '';
  panelNewProfileOpen = false;
  buildDOM();
  // 缓存未就绪时先显示「正在扫描」提示（就绪后移除；缓存命中则下一帧前移除，不可见）
  const hint = document.createElement('div');
  hint.className = 'bz-blackbox-scanning';
  hint.id = 'bz-blackbox-panel-scanning';
  hint.textContent = '正在扫描黑匣子…';
  popupEl!.prepend(hint);
  // 数据后台加载：骨架立即显示，就绪后渲染（命令回调不 await 本函数 → 用户打开不阻塞）
  data = await manager(app).load();
  hint.remove();
  renderAll();
  // 实时同步（ticket 05）：笔记变更 → 面板实时刷新（保留筛选与滚动）
  setBlackBoxSyncNotify((fresh) => {
    data = fresh;
    refreshAll();
  });
}

export function closeBlackBoxPanel(): void {
  setBlackBoxSyncNotify(null);
  closePeoplePopup();
  closeTimelinePopup();
  if (maskEl) {
    maskEl.remove();
    maskEl = null;
  }
  if (popupEl) {
    popupEl.remove();
    popupEl = null;
  }
  if (escHandle) {
    escHandle.unregister();
    escHandle = null;
  }
}

export function unloadBlackBoxPanel(): void {
  closeBlackBoxPanel();
  dataManager = null;
  appRef = null;
  data = null;
}

// ---------------- DOM ----------------

function buildDOM(): void {
  const { mask, popup } = createOverlay({
    maskId: 'bz-blackbox-panel-mask',
    popupId: 'bz-blackbox-panel',
    zIndex: 10040,
    width: '640px',
    maxWidth: 640,
    onMaskClick: () => closeBlackBoxPanel(),
  });
  maskEl = mask;
  popupEl = popup;
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  // header（备忘录风格：左标题 + 右动作区，关闭在最后）
  const header = document.createElement('div');
  header.className = 'bz-blackbox-modal-header';
  const title = document.createElement('span');
  title.className = 'bz-blackbox-modal-title';
  title.id = 'bz-blackbox-panel-title';
  header.appendChild(title);
  const actions = document.createElement('div');
  actions.className = 'bz-blackbox-hdr-actions';
  const captureBtn = createIconBtn('✏️', '录入', () => {
    if (appRef) void openBlackBoxCapture(appRef);
  });
  captureBtn.id = 'bz-blackbox-panel-capture';
  actions.appendChild(captureBtn);
  const peopleBtn = createIconBtn('👤', '人物', () => openPeoplePopup());
  peopleBtn.id = 'bz-blackbox-panel-people';
  actions.appendChild(peopleBtn);
  const timelineBtn = createIconBtn('🕐', '时间线', () => openTimelinePopup());
  timelineBtn.id = 'bz-blackbox-panel-timeline';
  actions.appendChild(timelineBtn);
  // 搜索切换（ticket 04）：位于 ⚙️设置 前；显示时高亮
  const searchBtn = createIconBtn('🔍', '搜索', () => toggleSearch());
  searchBtn.id = 'bz-blackbox-panel-search';
  actions.appendChild(searchBtn);
  const settingsBtn = createIconBtn('⚙️', '黑匣子设置', () => {
    if (appRef) void openBlackBoxSettings(appRef);
  });
  settingsBtn.id = 'bz-blackbox-panel-settings';
  actions.appendChild(settingsBtn);
  const closeBtn = createIconBtn('❌', '关闭', () => closeBlackBoxPanel());
  closeBtn.className = 'bz-blackbox-hdr-close';
  actions.appendChild(closeBtn);
  header.appendChild(actions);
  popup.appendChild(header);

  // 类型标签栏（🧩 概念 / 📎 文献 / 💡 想法，单选带数量；概念选中展开子分类；样式仿日记标签按钮）
  const typeBar = document.createElement('div');
  typeBar.className = 'bz-blackbox-type-bar';
  typeBar.id = 'bz-blackbox-type-bar';
  const typeDefs: { type: EntryType; label: string }[] = [
    { type: 'concept', label: '🧩 概念' },
    { type: 'literature', label: '📎 文献' },
    { type: 'thought', label: '💡 想法' },
  ];
  for (const t of typeDefs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-blackbox-type-btn';
    btn.dataset.type = t.type;
    btn.addEventListener('click', () => {
      if (selectedTypes.has(t.type)) {
        // 再点当前选中 → 取消（回全部）
        selectedTypes.clear();
        if (t.type === 'concept') selectedCategory = null;
      } else {
        // 单选切换（ticket 50）；切到非概念类型时收起子分类
        selectedTypes.clear();
        selectedTypes.add(t.type);
        if (t.type !== 'concept') selectedCategory = null;
      }
      displayCount = BATCH;
      renderTypeBar();
      renderStream();
    });
    typeBar.appendChild(btn);
  }
  popup.appendChild(typeBar);
  // 概念子分类行（ticket 50：仅「概念」选中时显示；点击筛选该分类概念，再点取消）
  const subBar = document.createElement('div');
  subBar.className = 'bz-blackbox-subcat-bar';
  subBar.id = 'bz-blackbox-subcats';
  popup.appendChild(subBar);

  // 搜索框（ticket 04：默认隐藏；显示时宽度 100%；防抖 300ms）
  const searchWrap = document.createElement('div');
  searchWrap.className = 'bz-blackbox-search-wrap';
  searchWrap.id = 'bz-blackbox-search-wrap';
  searchWrap.style.display = 'none';
  const searchInput = document.createElement('input');
  searchInput.id = 'bz-blackbox-search-input';
  searchInput.type = 'text';
  searchInput.placeholder = '🔍 搜索黑匣子（内容、情绪、人物）...';
  searchInput.addEventListener('input', (e) => {
    const kw = (e.target as HTMLInputElement).value.trim();
    clearTimeout((searchInput as any)._debounceTimer);
    (searchInput as any)._debounceTimer = setTimeout(() => {
      searchKeyword = kw;
      displayCount = BATCH;
      renderStream();
    }, 300);
  });
  searchWrap.appendChild(searchInput);
  popup.appendChild(searchWrap);

  // 时间流容器（无限滚动）
  const stream = document.createElement('div');
  stream.id = 'bz-blackbox-stream';
  stream.className = 'bz-blackbox-stream';
  stream.addEventListener('scroll', () => {
    streamScrollTop = stream.scrollTop;
    if (stream.scrollTop + stream.clientHeight >= stream.scrollHeight - 50) {
      displayCount += BATCH;
      renderStream();
    }
  });
  popup.appendChild(stream);

  escHandle = escManager.register('blackbox-panel', { isVisible: () => !!maskEl, close: () => closeBlackBoxPanel() });
}

function renderAll(): void {
  if (!data) return;
  const title = document.getElementById('bz-blackbox-panel-title');
  if (title) title.textContent = '黑匣子'; // ticket 04：无 emoji、无「N 条内容」
  renderTypeBar();
  renderStream();
}

/** 搜索框显隐切换（ticket 04）：隐藏即清空已输入关键词并立即重渲染 */
function toggleSearch(): void {
  searchVisible = !searchVisible;
  const wrap = document.getElementById('bz-blackbox-search-wrap');
  const btn = document.getElementById('bz-blackbox-panel-search');
  const input = document.getElementById('bz-blackbox-search-input') as HTMLInputElement | null;
  if (wrap) wrap.style.display = searchVisible ? 'block' : 'none';
  if (btn) btn.classList.toggle('bz-blackbox-icon-on', searchVisible);
  if (!searchVisible) {
    searchKeyword = '';
    if (input) input.value = '';
    displayCount = BATCH;
    renderStream();
  } else if (input) {
    input.focus();
  }
}

/** 数据变更后全量刷新（标题/流/弹窗；保留筛选与滚动） */
function refreshAll(): void {
  if (!data) return;
  renderAll();
  if (peopleMaskEl) renderPeople();
  if (timelineMaskEl) renderTimeline();
}

function renderTypeBar(): void {
  if (!data) return;
  // 数量：各类型条目总数（原始数据统计，不随搜索/子分类变化；ticket 50）
  const counts: Record<EntryType, number> = { concept: 0, literature: 0, thought: 0 };
  for (const e of data.entries) {
    if (e.type === 'concept' || e.type === 'literature' || e.type === 'thought') counts[e.type] += 1;
  }
  const labels: Record<EntryType, string> = { concept: '🧩 概念', literature: '📎 文献', thought: '💡 想法' };
  for (const btn of Array.from(document.querySelectorAll('.bz-blackbox-type-btn'))) {
    const t = (btn as HTMLElement).dataset.type as EntryType;
    (btn as HTMLElement).innerHTML = `${labels[t]} <span class="bz-blackbox-type-count">(${counts[t]})</span>`;
    btn.classList.toggle('bz-blackbox-type-btn-on', !!t && selectedTypes.has(t));
  }
  renderSubCats();
}

/** 概念子分类行（ticket 50）：分类 = 概念条目的 category 文件夹；数量降序、同量按名；点击筛选/取消 */
function renderSubCats(): void {
  const sub = document.getElementById('bz-blackbox-subcats');
  if (!sub || !data) return;
  sub.innerHTML = '';
  if (!selectedTypes.has('concept')) {
    sub.style.display = 'none';
    return;
  }
  const catCount = new Map<string, number>();
  for (const e of data.entries) {
    if (e.type === 'concept' && e.category && e.category.trim()) {
      catCount.set(e.category, (catCount.get(e.category) || 0) + 1);
    }
  }
  if (!catCount.size) {
    sub.style.display = 'none';
    return;
  }
  sub.style.display = 'flex';
  const cats = [...catCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [cat, n] of cats) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-blackbox-subcat-btn' + (selectedCategory === cat ? ' bz-blackbox-subcat-btn-on' : '');
    btn.textContent = `${cat} (${n})`;
    btn.addEventListener('click', () => {
      selectedCategory = selectedCategory === cat ? null : cat;
      displayCount = BATCH;
      renderTypeBar();
      renderStream();
    });
    sub.appendChild(btn);
  }
}

// ---------------- 时间流（三类条目混排） ----------------

/** 搜索匹配：名称/定义/文本/来源 + 情绪标签 + 涉及的人显示名 */
function matchesSearch(e: Entry, kw: string): boolean {
  if (!kw) return true;
  const lower = kw.toLowerCase();
  const texts = [e.name, e.definition, e.text, e.source].filter((t): t is string => !!t);
  if (texts.some((t) => t.toLowerCase().includes(lower))) return true;
  if (e.emotions.some((t) => t.toLowerCase().includes(lower))) return true;
  if (e.people.some((p) => personLabel(p, data!.profiles).toLowerCase().includes(lower))) return true;
  return false;
}

/** 筛选 + 排序（createdAt 降序，新在上；ISO 字符串全序直接比较） */
function getFilteredEntries(): Entry[] {
  if (!data) return [];
  return data.entries
    .filter((e) => (selectedTypes.size === 0 ? true : selectedTypes.has(e.type)))
    // 子分类筛选（ticket 50）：仅概念选中时生效，只显示该分类概念
    .filter((e) => {
      if (!selectedCategory) return true;
      return selectedTypes.has('concept') && e.type === 'concept' && e.category === selectedCategory;
    })
    .filter((e) => matchesSearch(e, searchKeyword))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function renderStream(): void {
  const stream = document.getElementById('bz-blackbox-stream');
  if (!stream || !data) return;
  stream.innerHTML = '';
  if (!data.entries.length) {
    stream.appendChild(emptyState('黑匣子还空着', '用右上角 ✏️ 录入第一条：概念、文献或想法'));
    return;
  }
  const filtered = getFilteredEntries();
  if (!filtered.length) {
    stream.appendChild(emptyState('没有找到匹配的内容', '换个关键词，或清空类型筛选试试'));
    return;
  }
  const shown = filtered.slice(0, displayCount);
  let lastDate: string | null = null;
  let dateSection: HTMLElement | null = null;
  for (const e of shown) {
    const d = (e.createdAt || '').slice(0, 10);
    if (d !== lastDate) {
      dateSection = document.createElement('div');
      dateSection.className = 'bz-blackbox-stream-date-section';
      const sep = document.createElement('div');
      sep.className = 'bz-blackbox-stream-date';
      sep.textContent = d;
      dateSection.appendChild(sep);
      stream.appendChild(dateSection);
      lastDate = d;
    }
    if (dateSection) dateSection.appendChild(buildStreamCard(e));
  }
  if (displayCount >= filtered.length) {
    const hint = document.createElement('div');
    hint.className = 'bz-blackbox-stream-end';
    hint.textContent = '已显示所有内容';
    stream.appendChild(hint);
  }
  stream.scrollTop = streamScrollTop;
}

/** 卡片（纯展示，无任何点击交互）：头部 = 类型 emoji + 录入时刻 HH:MM；内容三铺法 */
/** 来源行渲染（ADR-0016）：epub 双链 / [[笔记]] / URL 可点击（点击经 jumpFromSource 分派执行）；其余纯文本不可点 */
function appendSourceRow(card: HTMLElement, source: string): void {
  if (!source) return;
  const action = resolveSourceJump(source);
  if (action.kind === 'none') {
    const div = document.createElement('div');
    div.className = 'bz-blackbox-stream-card-source';
    div.textContent = `📌 ${sourceDisplayText(source)}`;
    card.appendChild(div);
    return;
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bz-blackbox-stream-card-source bz-blackbox-source-link';
  btn.title =
    action.kind === 'epub' ? '跳转到书内原文位置' : action.kind === 'url' ? '用浏览器打开' : '在 Obsidian 中打开';
  btn.textContent = `📌 ${sourceDisplayText(source)}`;
  btn.addEventListener('click', () => {
    if (appRef) void jumpFromSource(appRef, source);
  });
  card.appendChild(btn);
}

function buildStreamCard(e: Entry): HTMLElement {
  const card = document.createElement('div');
  card.className = 'bz-blackbox-stream-card';
  card.dataset.id = e.id;

  const head = document.createElement('div');
  head.className = 'bz-blackbox-stream-card-head';
  const emoji = document.createElement('span');
  emoji.className = 'bz-blackbox-stream-card-emoji';
  emoji.textContent = e.type === 'concept' ? '🧩' : e.type === 'literature' ? '📎' : '💡';
  const time = document.createElement('span');
  time.className = 'bz-blackbox-stream-card-time';
  time.textContent = (e.createdAt || '').slice(11, 16);
  head.append(emoji, time);
  card.appendChild(head);

  if (e.type === 'concept') {
    const name = document.createElement('div');
    name.className = 'bz-blackbox-stream-card-name';
    name.textContent = e.name || '';
    card.appendChild(name);
    if (e.definition) {
      const def = document.createElement('div');
      def.className = 'bz-blackbox-stream-card-def';
      def.textContent = e.definition;
      card.appendChild(def);
    }
    const related = (e.related || [])
      .map((id) => data!.entries.find((x) => x.id === id))
      .filter((x): x is Entry => !!x);
    if (related.length) {
      const row = document.createElement('div');
      row.className = 'bz-blackbox-term-chips';
      for (const r of related) {
        const chip = document.createElement('span');
        chip.className = 'bz-blackbox-term-chip bz-blackbox-term-chip-on';
        chip.textContent = r.name || r.id;
        row.appendChild(chip);
      }
      card.appendChild(row);
    }
    // 概念来源（ADR-0016）：links[0] 单值；与摘抄来源同样可点击
    appendSourceRow(card, entrySourceText(e));
  } else if (e.type === 'literature') {
    if (e.text) {
      const body = document.createElement('div');
      body.className = 'bz-blackbox-stream-card-body';
      body.textContent = e.text;
      card.appendChild(body);
    }
    const terms = (e.terms || [])
      .map((id) => data!.entries.find((x) => x.id === id))
      .filter((x): x is Entry => !!x);
    if (terms.length) {
      const row = document.createElement('div');
      row.className = 'bz-blackbox-term-chips';
      for (const t of terms) {
        const chip = document.createElement('span');
        chip.className = 'bz-blackbox-term-chip bz-blackbox-term-chip-on';
        chip.textContent = t.name || t.id;
        row.appendChild(chip);
      }
      card.appendChild(row);
    }
    // 来源行（ticket 50）：移到正文 + 关联概念之后（卡片最底，双链最后面）；显示可读名，点击跳转不变
    appendSourceRow(card, entrySourceText(e));
    if (e.links && e.links.length) {
      const links = document.createElement('div');
      links.className = 'bz-blackbox-stream-card-links';
      links.textContent = `🔗 ${e.links.join('  ')}`;
      card.appendChild(links);
    }
  } else {
    if (e.text) {
      const body = document.createElement('div');
      body.className = 'bz-blackbox-stream-card-body';
      body.textContent = e.text;
      card.appendChild(body);
    }
    const meta = document.createElement('div');
    meta.className = 'bz-blackbox-stream-card-meta';
    for (const tag of e.emotions || []) {
      const chip = document.createElement('span');
      chip.className = 'bz-blackbox-emotion-tag';
      chip.textContent = tag;
      meta.appendChild(chip);
    }
    for (const p of e.people || []) {
      const tag = document.createElement('span');
      tag.className = 'bz-blackbox-people-tag';
      tag.textContent = personLabel(p, data!.profiles);
      meta.appendChild(tag);
    }
    if (e.scene) {
      const sc = document.createElement('span');
      sc.className = 'bz-blackbox-stream-card-scene';
      sc.textContent = `📍 ${e.scene}`;
      meta.appendChild(sc);
    }
    if (e.links && e.links.length) {
      const lk = document.createElement('span');
      lk.className = 'bz-blackbox-stream-card-links';
      lk.textContent = `🔗 ${e.links.length}`;
      meta.appendChild(lk);
    }
    card.appendChild(meta);
  }
  return card;
}

// ---------------- 👤 人物弹窗（独立中央弹窗，完整度保留） ----------------

function openPeoplePopup(): void {
  if (peopleMaskEl) {
    peopleMaskEl.style.display = 'block';
    peoplePopupEl!.style.display = 'flex';
    renderPeople();
    return;
  }
  const { mask, popup } = createOverlay({
    maskId: 'bz-blackbox-people-mask',
    popupId: 'bz-blackbox-people-popup',
    zIndex: 10041,
    width: '600px',
    maxWidth: 600,
    onMaskClick: () => closePeoplePopup(),
  });
  peopleMaskEl = mask;
  peoplePopupEl = popup;
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  const header = document.createElement('div');
  header.className = 'bz-blackbox-modal-header';
  const title = document.createElement('span');
  title.className = 'bz-blackbox-modal-title';
  title.textContent = '👤 人物';
  header.appendChild(title);
  const actions = document.createElement('div');
  actions.className = 'bz-blackbox-hdr-actions';
  const closeBtn = createIconBtn('❌', '关闭', () => closePeoplePopup());
  closeBtn.className = 'bz-blackbox-hdr-close';
  actions.appendChild(closeBtn);
  header.appendChild(actions);
  popup.appendChild(header);

  const body = document.createElement('div');
  body.id = 'bz-blackbox-people';
  body.className = 'bz-blackbox-popup-body';
  popup.appendChild(body);

  peopleEscHandle = escManager.register('blackbox-people', {
    isVisible: () => !!peopleMaskEl,
    close: () => closePeoplePopup(),
  });
  renderPeople();
}

function closePeoplePopup(): void {
  if (peopleMaskEl) {
    peopleMaskEl.remove();
    peopleMaskEl = null;
  }
  if (peoplePopupEl) {
    peoplePopupEl.remove();
    peoplePopupEl = null;
  }
  if (peopleEscHandle) {
    peopleEscHandle.unregister();
    peopleEscHandle = null;
  }
}

// ---------------- 🕐 时间线弹窗（独立中央弹窗，完整度保留） ----------------

function openTimelinePopup(): void {
  if (timelineMaskEl) {
    timelineMaskEl.style.display = 'block';
    timelinePopupEl!.style.display = 'flex';
    renderTimeline();
    return;
  }
  const { mask, popup } = createOverlay({
    maskId: 'bz-blackbox-timeline-mask',
    popupId: 'bz-blackbox-timeline-popup',
    zIndex: 10041,
    width: '600px',
    maxWidth: 600,
    onMaskClick: () => closeTimelinePopup(),
  });
  timelineMaskEl = mask;
  timelinePopupEl = popup;
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  const header = document.createElement('div');
  header.className = 'bz-blackbox-modal-header';
  const title = document.createElement('span');
  title.className = 'bz-blackbox-modal-title';
  title.textContent = '🕐 时间线';
  header.appendChild(title);
  const actions = document.createElement('div');
  actions.className = 'bz-blackbox-hdr-actions';
  const closeBtn = createIconBtn('❌', '关闭', () => closeTimelinePopup());
  closeBtn.className = 'bz-blackbox-hdr-close';
  actions.appendChild(closeBtn);
  header.appendChild(actions);
  popup.appendChild(header);

  const body = document.createElement('div');
  body.id = 'bz-blackbox-timeline';
  body.className = 'bz-blackbox-popup-body';
  popup.appendChild(body);

  timelineEscHandle = escManager.register('blackbox-timeline', {
    isVisible: () => !!timelineMaskEl,
    close: () => closeTimelinePopup(),
  });
  renderTimeline();
}

function closeTimelinePopup(): void {
  if (timelineMaskEl) {
    timelineMaskEl.remove();
    timelineMaskEl = null;
  }
  if (timelinePopupEl) {
    timelinePopupEl.remove();
    timelinePopupEl = null;
  }
  if (timelineEscHandle) {
    timelineEscHandle.unregister();
    timelineEscHandle = null;
  }
}

// ---------------- 👤 人物（v2 渲染复用：卡墙 + 详情 + 新建） ----------------

function renderPeople(): void {
  const box = document.getElementById('bz-blackbox-people');
  if (!box || !data) return;
  box.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'bz-blackbox-people-head';
  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.id = 'bz-blackbox-panel-profile-new';
  newBtn.className = 'bz-blackbox-ai-btn';
  newBtn.textContent = '➕ 新建画像';
  newBtn.addEventListener('click', () => {
    panelNewProfileOpen = !panelNewProfileOpen;
    renderPeople();
  });
  head.appendChild(newBtn);
  box.appendChild(head);

  if (panelNewProfileOpen) {
    const form = document.createElement('div');
    form.className = 'bz-blackbox-profile-form';
    const name = document.createElement('input');
    name.id = 'bz-blackbox-panel-profile-name';
    name.className = 'bz-blackbox-input';
    name.placeholder = '名字（必填）';
    const relation = document.createElement('input');
    relation.id = 'bz-blackbox-panel-profile-relation';
    relation.className = 'bz-blackbox-input';
    relation.placeholder = '关系（可选）';
    const create = document.createElement('button');
    create.type = 'button';
    create.id = 'bz-blackbox-panel-profile-create';
    create.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
    create.textContent = '创建';
    create.addEventListener('click', () => void panelCreateProfile(name.value.trim(), relation.value.trim()));
    form.append(name, relation, create);
    box.appendChild(form);
  }

  if (detailProfileId && data.profiles.some((p) => p.id === detailProfileId)) {
    renderProfileDetail(box);
    return;
  }
  detailProfileId = null;
  const profiles = data.profiles;
  if (!profiles.length) {
    box.appendChild(emptyState('还没有人物画像', '录入时「涉及的人」可现场新建，或在这里创建——包仔会读 TA 的往事'));
    return;
  }
  const wall = document.createElement('div');
  wall.className = 'bz-blackbox-profile-wall';
  for (const pf of profiles) {
    wall.appendChild(profileCard(pf));
  }
  box.appendChild(wall);
}

function profileCard(pf: Profile): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'bz-blackbox-profile-card';
  card.dataset.id = pf.id;
  const name = document.createElement('div');
  name.className = 'bz-blackbox-profile-card-name';
  name.textContent = pf.name + (pf.relation ? `（${pf.relation}）` : '');
  card.appendChild(name);
  const imp = document.createElement('div');
  imp.className = 'bz-blackbox-profile-card-imp';
  imp.textContent = pf.impression ? clip(pf.impression, 40) : '（暂无印象）';
  card.appendChild(imp);
  const meta = document.createElement('div');
  meta.className = 'bz-blackbox-profile-card-meta';
  const events = filterEventsByPerson(data!.events, pf).length;
  const agg = aggregateEmotions(data!.entries, pf);
  const topEmotions = Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  meta.textContent = `🕐 ${events} 事件 · 👁 ${pf.aiObservations.length} 观察`;
  card.appendChild(meta);
  if (topEmotions.length) {
    const emo = document.createElement('div');
    emo.className = 'bz-blackbox-profile-card-emotions';
    for (const [tag, n] of topEmotions) {
      const chip = document.createElement('span');
      chip.className = 'bz-blackbox-emotion-tag';
      chip.textContent = `${tag}×${n}`;
      emo.appendChild(chip);
    }
    card.appendChild(emo);
  }
  card.addEventListener('click', () => {
    detailProfileId = pf.id;
    renderPeople();
  });
  return card;
}

/** 画像详情：印象（字段级锁）/ AI 观察（采纳）/ 情绪聚合 / 事件投影 */
function renderProfileDetail(box: HTMLElement): void {
  if (!data || !detailProfileId) return;
  const pf = data.profiles.find((p) => p.id === detailProfileId);
  if (!pf) return;
  const detail = document.createElement('div');
  detail.className = 'bz-blackbox-profile-detail';
  detail.id = 'bz-blackbox-profile-detail';

  const head = document.createElement('div');
  head.className = 'bz-blackbox-detail-head';
  const title = document.createElement('span');
  title.textContent = `👤 ${pf.name}${pf.relation ? `（${pf.relation}）` : ''}`;
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'bz-blackbox-ai-btn';
  back.textContent = '← 返回';
  back.addEventListener('click', () => {
    detailProfileId = null;
    renderPeople();
  });
  head.append(title, back);
  detail.appendChild(head);

  // 用户印象区（字段级锁：AI 从不覆盖，只经采纳写入）
  detail.appendChild(sectionLabel('我的印象（用户主权区）'));
  const impArea = document.createElement('textarea');
  impArea.id = 'bz-blackbox-profile-impression';
  impArea.className = 'bz-blackbox-textarea';
  impArea.placeholder = '写下你眼中的 TA……';
  impArea.value = pf.impression;
  detail.appendChild(impArea);
  const saveImp = document.createElement('button');
  saveImp.type = 'button';
  saveImp.id = 'bz-blackbox-profile-imp-save';
  saveImp.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
  saveImp.textContent = '保存印象';
  saveImp.addEventListener('click', () => void saveProfileImpression(pf, impArea.value));
  detail.appendChild(saveImp);

  // AI 观察区（虚线框，持续追加，可采纳）
  detail.appendChild(sectionLabel('包仔的观察（AI 区）'));
  const obs = document.createElement('div');
  obs.className = 'bz-blackbox-ai-observation';
  if (!pf.aiObservations.length) {
    const tip = document.createElement('div');
    tip.className = 'bz-blackbox-ai-msg bz-blackbox-ai-fallback';
    tip.textContent = '复盘时包仔会持续写下新的观察';
    obs.appendChild(tip);
  }
  for (const o of pf.aiObservations) {
    const row = document.createElement('div');
    row.className = 'bz-blackbox-observation-row';
    const text = document.createElement('span');
    text.className = 'bz-blackbox-observation-text';
    text.textContent = o;
    const adopt = document.createElement('button');
    adopt.type = 'button';
    adopt.className = 'bz-blackbox-ai-btn';
    adopt.textContent = '采纳';
    adopt.addEventListener('click', () => void adoptObservation(pf, o));
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'bz-blackbox-people-remove';
    dismiss.textContent = '✕';
    dismiss.title = '移除这条观察';
    dismiss.addEventListener('click', () => void dismissObservation(pf, o));
    row.append(text, adopt, dismiss);
    obs.appendChild(row);
  }
  detail.appendChild(obs);

  // 情绪聚合
  const agg = aggregateEmotions(data.entries, pf);
  const aggEntries = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  detail.appendChild(sectionLabel('情绪聚合'));
  if (aggEntries.length) {
    const emoRow = document.createElement('div');
    emoRow.className = 'bz-blackbox-term-chips';
    for (const [tag, n] of aggEntries) {
      const chip = document.createElement('span');
      chip.className = 'bz-blackbox-emotion-tag';
      chip.textContent = `${tag} ×${n}`;
      emoRow.appendChild(chip);
    }
    detail.appendChild(emoRow);
  } else {
    const tip = document.createElement('div');
    tip.className = 'bz-blackbox-ai-msg bz-blackbox-ai-fallback';
    tip.textContent = '还没有带情绪的关联条目';
    detail.appendChild(tip);
  }

  // 事件投影（按人过滤，单份存储同源）
  detail.appendChild(sectionLabel('🕐 事件投影'));
  const projected = filterEventsByPerson(data.events, pf).sort((a, b) => (a.time < b.time ? 1 : -1));
  if (!projected.length) {
    const tip = document.createElement('div');
    tip.className = 'bz-blackbox-ai-msg bz-blackbox-ai-fallback';
    tip.textContent = '还没有提到 TA 的事件';
    detail.appendChild(tip);
  }
  for (const ev of projected) {
    detail.appendChild(compactEventCard(ev));
  }

  box.appendChild(detail);
}

async function saveProfileImpression(pf: Profile, value: string): Promise<void> {
  if (!appRef || !data) return;
  pf.impression = value.trim();
  const m = manager(appRef);
  const latest = await m.load();
  const target = latest.profiles.find((p) => p.id === pf.id);
  if (!target) return;
  target.impression = pf.impression;
  await m.updateProfile(latest, target);
  notice('印象已保存（包仔不会再覆盖这里）', 'success');
}

/** 采纳：观察 → 印象（追加），移除该观察 */
async function adoptObservation(pf: Profile, o: string): Promise<void> {
  if (!appRef || !data) return;
  const m = manager(appRef);
  const latest = await m.load();
  const target = latest.profiles.find((p) => p.id === pf.id);
  if (!target) return;
  target.impression = target.impression
    ? target.impression + '\n' + o
    : o;
  target.aiObservations = target.aiObservations.filter((x) => x !== o);
  await m.updateProfile(latest, target);
  pf.impression = target.impression;
  pf.aiObservations = target.aiObservations;
  notice('已采纳进印象', 'accept');
  refreshAll();
}

async function dismissObservation(pf: Profile, o: string): Promise<void> {
  if (!appRef || !data) return;
  const m = manager(appRef);
  const latest = await m.load();
  const target = latest.profiles.find((p) => p.id === pf.id);
  if (!target) return;
  target.aiObservations = target.aiObservations.filter((x) => x !== o);
  await m.updateProfile(latest, target);
  pf.aiObservations = target.aiObservations;
  refreshAll();
}

async function panelCreateProfile(name: string, relation: string): Promise<void> {
  if (!appRef || !data) return;
  if (!name) {
    notice('名字不能为空', 'warning');
    return;
  }
  if (data.profiles.some((p) => p.name === name)) {
    notice('已有同名画像', 'warning');
    return;
  }
  const pf = await createProfileWithSeed(appRef, name, relation);
  data = await manager(appRef).load();
  detailProfileId = pf.id;
  panelNewProfileOpen = false;
  renderPeople();
  notice(`画像「${name}」已创建`, 'success');
}

// ---------------- 🕐 时间线（v2 渲染复用：年月分组事件流 + 筛选） ----------------

function renderTimeline(): void {
  const box = document.getElementById('bz-blackbox-timeline');
  if (!box || !data) return;
  box.innerHTML = '';
  const showSpec = resolveShowSpeculative(data, tryGetSettings() as any);
  let events = data.events.slice();
  if (!showSpec) events = events.filter((e) => !e.inferred);

  // 筛选行（人物/年份）
  const filterRow = document.createElement('div');
  filterRow.className = 'bz-blackbox-tl-filters';
  const personSel = document.createElement('select');
  personSel.id = 'bz-blackbox-tl-person';
  personSel.className = 'bz-blackbox-select';
  personSel.appendChild(option('', `人物：全部${showSpec ? '' : '（推测已隐藏）'}`));
  for (const pf of data.profiles) {
    personSel.appendChild(option(pf.id, pf.name));
  }
  personSel.value = tlPerson;
  personSel.addEventListener('change', () => {
    tlPerson = personSel.value;
    renderTimeline();
  });
  filterRow.appendChild(personSel);

  const years = [...new Set(events.map((e) => (e.time || '').slice(0, 4)).filter(Boolean))].sort((a, b) => (a < b ? 1 : -1));
  const yearSel = document.createElement('select');
  yearSel.id = 'bz-blackbox-tl-year';
  yearSel.className = 'bz-blackbox-select';
  yearSel.appendChild(option('', '年份：全部'));
  for (const y of years) yearSel.appendChild(option(y, y));
  yearSel.value = tlYear;
  yearSel.addEventListener('change', () => {
    tlYear = yearSel.value;
    renderTimeline();
  });
  filterRow.appendChild(yearSel);
  box.appendChild(filterRow);

  if (tlPerson) {
    const tlProfile = data.profiles.find((p) => p.id === tlPerson);
    events = events.filter(
      (e) =>
        e.people.includes(tlPerson) ||
        e.mainPerson === tlPerson ||
        // 冷启动期以纯名字落库的事件同样筛出（与画像投影 entryReferences 口径一致）
        (!!tlProfile && (e.people.includes(tlProfile.name) || e.mainPerson === tlProfile.name))
    );
  }
  if (tlYear) events = events.filter((e) => (e.time || '').slice(0, 4) === tlYear);

  if (!events.length) {
    box.appendChild(
      emptyState('还没有事件', '包仔会在复盘时自动整理「发生了什么」；推测事件显示开关在 ⚙️ 设置')
    );
    return;
  }
  const groups = groupEventsByMonth(events);
  for (const g of groups) {
    const group = document.createElement('div');
    group.className = 'bz-blackbox-tl-group';
    const label = document.createElement('div');
    label.className = 'bz-blackbox-tl-group-label';
    label.textContent = g.label;
    group.appendChild(label);
    for (const ev of g.events) {
      group.appendChild(eventCard(ev));
    }
    box.appendChild(group);
  }
}

function option(value: string, text: string): HTMLOptionElement {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  return o;
}

/** 事件卡（时间线主卡：确认实线/推测虚线+❓+确认删除；证据链展开） */
function eventCard(ev: EventItem): HTMLElement {
  const card = document.createElement('div');
  card.className = 'bz-blackbox-event-card' + (ev.inferred ? ' speculative' : '');
  card.dataset.id = ev.id;
  const top = document.createElement('div');
  top.className = 'bz-blackbox-event-top';
  const date = document.createElement('span');
  date.className = 'bz-blackbox-event-date';
  date.textContent = (ev.time || '').slice(5).replace('-', '/');
  const title = document.createElement('span');
  title.className = 'bz-blackbox-event-title';
  title.textContent = ev.title;
  top.append(date, title);
  if (ev.inferred) {
    const q = document.createElement('span');
    q.className = 'bz-blackbox-event-spec';
    q.textContent = '❓ 推测';
    q.title = 'AI 不确定这是否真实发生（意图/计划/梦境等）';
    top.appendChild(q);
  }
  card.appendChild(top);

  const people = ev.people || [];
  const main = ev.mainPerson;
  const mainName = main ? personLabel(main, data!.profiles) : '';
  if (people.length || mainName) {
    const pRow = document.createElement('div');
    pRow.className = 'bz-blackbox-event-people';
    if (mainName) {
      const tag = document.createElement('span');
      tag.className = 'bz-blackbox-people-tag bz-blackbox-people-tag-main';
      tag.textContent = mainName;
      pRow.appendChild(tag);
    }
    const others = people.filter((p) => p !== main).slice(0, MAX_PEOPLE);
    let shown = 0;
    for (const p of others) {
      const label = personLabel(p, data!.profiles);
      if (label === mainName) continue;
      if (shown >= 2) break; // 配角折叠
      const tag = document.createElement('span');
      tag.className = 'bz-blackbox-people-tag';
      tag.textContent = label;
      pRow.appendChild(tag);
      shown++;
    }
    const hidden = others.length - shown;
    if (hidden > 0) {
      const more = document.createElement('span');
      more.className = 'bz-blackbox-people-more';
      more.textContent = `+${hidden}`;
      pRow.appendChild(more);
    }
    card.appendChild(pRow);
  }

  if (ev.emotions.length) {
    const emoRow = document.createElement('div');
    emoRow.className = 'bz-blackbox-event-emotions';
    for (const tag of ev.emotions) {
      const dot = document.createElement('span');
      dot.className = 'bz-blackbox-emotion-dot';
      dot.title = tag;
      dot.textContent = tag.slice(0, 1);
      emoRow.appendChild(dot);
    }
    card.appendChild(emoRow);
  }

  if (ev.summary) {
    const sum = document.createElement('div');
    sum.className = 'bz-blackbox-event-summary';
    sum.textContent = ev.summary;
    card.appendChild(sum);
  }

  if (ev.inferred) {
    const actions = document.createElement('div');
    actions.className = 'bz-blackbox-ai-row';
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
    confirmBtn.textContent = '✓ 确认';
    confirmBtn.addEventListener('click', () => void confirmEventAction(ev.id));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'bz-blackbox-ai-btn';
    del.textContent = '✕ 删除';
    del.addEventListener('click', () => void deleteEventAction(ev.id));
    actions.append(confirmBtn, del);
    card.appendChild(actions);
  }

  // 证据链（点击展开来源条目摘要）
  const evidence = (ev.evidence || []).map((id) => data!.entries.find((e) => e.id === id)).filter((e): e is Entry => !!e);
  if (evidence.length) {
    const evBtn = document.createElement('button');
    evBtn.type = 'button';
    evBtn.className = 'bz-blackbox-event-evidence-btn';
    evBtn.textContent = `📎 ${evidence.length} 条证据`;
    const evBox = document.createElement('div');
    evBox.className = 'bz-blackbox-event-evidence';
    evBox.style.display = 'none';
    for (const e of evidence) {
      const item = document.createElement('div');
      item.className = 'bz-blackbox-ref-item';
      const icon = e.type === 'concept' ? '🧩' : e.type === 'literature' ? '📎' : '💡';
      item.textContent = `${icon} ${clip(e.type === 'concept' ? `${e.name}：${e.definition || ''}` : e.text || '', 70)}`;
      evBox.appendChild(item);
    }
    evBtn.addEventListener('click', () => {
      evBox.style.display = evBox.style.display === 'none' ? 'block' : 'none';
    });
    card.append(evBtn, evBox);
  }

  return card;
}

/** 紧凑事件卡（画像详情事件投影复用，无操作按钮） */
function compactEventCard(ev: EventItem): HTMLElement {
  const card = document.createElement('div');
  card.className = 'bz-blackbox-event-card' + (ev.inferred ? ' speculative' : '');
  const top = document.createElement('div');
  top.className = 'bz-blackbox-event-top';
  const date = document.createElement('span');
  date.className = 'bz-blackbox-event-date';
  date.textContent = (ev.time || '').slice(5).replace('-', '/');
  const title = document.createElement('span');
  title.className = 'bz-blackbox-event-title';
  title.textContent = ev.title + (ev.inferred ? ' ❓' : '');
  top.append(date, title);
  card.appendChild(top);
  return card;
}

async function confirmEventAction(eventId: string): Promise<void> {
  if (!appRef || !data) return;
  const m = manager(appRef);
  const latest = await m.load();
  await m.confirmEvent(latest, eventId);
  data = latest;
  notice('已确认（转为实线事件）', 'confirm');
  refreshAll();
}

async function deleteEventAction(eventId: string): Promise<void> {
  if (!appRef || !data) return;
  const m = manager(appRef);
  const latest = await m.load();
  await m.deleteEvent(latest, eventId);
  data = latest;
  notice('已删除（遗忘权后置：不做忽略清单）', 'delete');
  refreshAll();
}

// ---------------- 通用 ----------------

function sectionLabel(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bz-blackbox-section-label';
  el.textContent = text;
  return el;
}

function emptyState(text: string, desc: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'bz-blackbox-empty';
  const t = document.createElement('div');
  t.className = 'bz-blackbox-empty-title';
  t.textContent = text;
  const d = document.createElement('div');
  d.className = 'bz-blackbox-empty-desc';
  d.textContent = desc;
  wrap.append(t, d);
  return wrap;
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
