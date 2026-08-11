/**
 * 黑匣子主面板（ticket 41/43/44）：bz-blackbox-panel「黑匣子面板」五标签中央弹窗。
 * 🧩 概念墙（卡片网格/详情展开/关联跳转）｜📎 文献架（来源+摘要+名词表）｜💡 想法池（情绪+人）
 * ｜👤 人物（画像卡墙 + 详情：印象字段级锁/AI 观察可采纳/情绪聚合/事件投影）｜🕐 时间线（年月分组/
 * 推测事件确认删除/人物年份筛选/证据链）。
 * 数据单份存储：画像事件投影与全局时间线同源（按人过滤，无复制）。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { confirm } from '../core/confirm';
import { notice } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { BlackBoxDataManager } from './data';
import { createProfileWithSeed, openBlackBoxCapture } from './capture';
import { openBlackBoxSettings } from './settings-ui';
import {
  aggregateEmotions,
  filterEventsByPerson,
  groupEventsByMonth,
  personLabel,
  resolveShowSpeculative,
  MAX_PEOPLE,
} from './types';
import type { BlackBoxData, Entry, EventItem, Profile } from './types';

let appRef: App | null = null;
let dataManager: BlackBoxDataManager | null = null;
let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
let data: BlackBoxData | null = null;

type PanelTab = 'wall' | 'shelf' | 'pool' | 'people' | 'timeline';
let activeTab: PanelTab = 'wall';
/** 各 tab 滚动位置（切换保留） */
const scrollPos: Record<string, number> = {};
/** 概念详情展开态（概念墙跳转用） */
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

/** 打开主面板（幂等；每次打开重载数据；全新打开重置页状态） */
export async function openBlackBoxPanel(app: App): Promise<void> {
  appRef = app;
  if (maskEl) {
    maskEl.style.display = 'block';
    data = await manager(app).load();
    refreshAll();
    return;
  }
  data = await manager(app).load();
  activeTab = 'wall';
  detailConceptId = null;
  detailProfileId = null;
  tlPerson = '';
  tlYear = '';
  panelNewProfileOpen = false;
  buildDOM();
  renderAll();
}

export function closeBlackBoxPanel(): void {
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
  const captureBtn = document.createElement('button');
  captureBtn.type = 'button';
  captureBtn.className = 'bz-blackbox-hdr-btn';
  captureBtn.id = 'bz-blackbox-panel-capture';
  captureBtn.textContent = '✏️';
  captureBtn.title = '录入';
  captureBtn.addEventListener('click', () => {
    if (appRef) void openBlackBoxCapture(appRef);
  });
  actions.appendChild(captureBtn);
  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'bz-blackbox-hdr-btn';
  settingsBtn.id = 'bz-blackbox-panel-settings';
  settingsBtn.textContent = '⚙️';
  settingsBtn.title = '黑匣子设置';
  settingsBtn.addEventListener('click', () => {
    if (appRef) void openBlackBoxSettings(appRef);
  });
  actions.appendChild(settingsBtn);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bz-blackbox-hdr-btn bz-blackbox-hdr-close';
  closeBtn.textContent = '❌';
  closeBtn.title = '关闭';
  closeBtn.addEventListener('click', () => closeBlackBoxPanel());
  actions.appendChild(closeBtn);
  header.appendChild(actions);
  popup.appendChild(header);

  // 五标签
  const tabs = document.createElement('div');
  tabs.className = 'bz-blackbox-panel-tabs';
  tabs.id = 'bz-blackbox-panel-tabs';
  const tabDefs: { tab: PanelTab; label: string }[] = [
    { tab: 'wall', label: '🧩 概念墙' },
    { tab: 'shelf', label: '📎 文献架' },
    { tab: 'pool', label: '💡 想法池' },
    { tab: 'people', label: '👤 人物' },
    { tab: 'timeline', label: '🕐 时间线' },
  ];
  for (const t of tabDefs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.tab = t.tab;
    btn.className = 'bz-blackbox-panel-tab-btn';
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      activeTab = t.tab;
      renderTabs();
      renderActiveTab();
    });
    tabs.appendChild(btn);
  }
  popup.appendChild(tabs);

  // 内容区（五容器常驻，切换保留状态）
  const content = document.createElement('div');
  content.className = 'bz-blackbox-panel-content';
  const names: PanelTab[] = ['wall', 'shelf', 'pool', 'people', 'timeline'];
  for (const n of names) {
    const c = document.createElement('div');
    c.id = `bz-blackbox-${n}`;
    c.className = 'bz-blackbox-panel-tab-content';
    c.style.display = 'none';
    content.appendChild(c);
  }
  popup.appendChild(content);

  escHandle = escManager.register('blackbox-panel', { isVisible: () => !!maskEl, close: () => closeBlackBoxPanel() });
}

function renderAll(): void {
  if (!data) return;
  const title = document.getElementById('bz-blackbox-panel-title');
  if (title) title.textContent = `🕳️ 黑匣子面板 · ${data.entries.length} 条内容`;
  renderTabs();
  renderActiveTab();
}

function renderTabs(): void {
  for (const btn of Array.from(document.querySelectorAll('.bz-blackbox-panel-tab-btn'))) {
    btn.classList.toggle('bz-blackbox-panel-tab-on', (btn as HTMLElement).dataset.tab === activeTab);
  }
}

/** 渲染当前激活 tab（保留滚动位置） */
function renderActiveTab(): void {
  if (!data) return;
  for (const n of ['wall', 'shelf', 'pool', 'people', 'timeline'] as PanelTab[]) {
    const c = document.getElementById(`bz-blackbox-${n}`);
    if (!c) continue;
    if (n !== activeTab) {
      scrollPos[n] = c.scrollTop;
      c.style.display = 'none';
      continue;
    }
    c.style.display = 'block';
    const fn: Record<PanelTab, () => void> = {
      wall: renderWall,
      shelf: renderShelf,
      pool: renderPool,
      people: renderPeople,
      timeline: renderTimeline,
    };
    fn[n]();
    c.scrollTop = scrollPos[n] || 0;
  }
}

/** 数据变更后全量刷新（保留各 tab 滚动） */
function refreshAll(): void {
  if (!data) return;
  for (const n of ['wall', 'shelf', 'pool', 'people', 'timeline'] as PanelTab[]) {
    const c = document.getElementById(`bz-blackbox-${n}`);
    if (c) scrollPos[n] = c.scrollTop;
  }
  renderActiveTab();
}

// ---------------- 🧩 概念墙 ----------------

function renderWall(): void {
  const box = document.getElementById('bz-blackbox-wall');
  if (!box || !data) return;
  box.innerHTML = '';
  const concepts = data.entries
    .filter((e) => e.type === 'concept')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!concepts.length) {
    box.appendChild(emptyState('暂无概念', '用「录入」喂一个名词给包仔，生成第一张知识卡片'));
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'bz-blackbox-wall-grid';
  for (const c of concepts) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bz-blackbox-concept-card';
    card.dataset.id = c.id;
    card.title = '点击查看详情'; // 悬浮提示，卡片本体只显示名称（定义/关联数在详情内）
    const name = document.createElement('div');
    name.className = 'bz-blackbox-concept-card-name';
    name.textContent = c.name || '';
    card.appendChild(name);
    card.addEventListener('click', () => {
      detailConceptId = c.id;
      renderWallDetail(box);
    });
    grid.appendChild(card);
  }
  box.appendChild(grid);
  // 详情容器（常驻，展开/跳转渲染于此）
  const detailBox = document.createElement('div');
  detailBox.id = 'bz-blackbox-wall-detail';
  box.appendChild(detailBox);
  if (detailConceptId) renderWallDetail(box);
}

function renderWallDetail(box: HTMLElement): void {
  if (!data || !detailConceptId) return;
  const c = data.entries.find((e) => e.id === detailConceptId);
  const detail = document.getElementById('bz-blackbox-wall-detail');
  if (!detail) return;
  detail.innerHTML = '';
  if (!c) {
    detailConceptId = null;
    return;
  }
  const head = document.createElement('div');
  head.className = 'bz-blackbox-detail-head';
  const title = document.createElement('span');
  title.textContent = `🧩 ${c.name}`;
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'bz-blackbox-ai-btn bz-blackbox-del-btn';
  del.textContent = '🗑 删除';
  del.title = '删除这个概念（不可恢复；引用它的文献关联一并清理）';
  del.addEventListener('click', () => {
    confirm({
      title: `删除概念「${c.name}」？`,
      message: '删除后不可恢复；引用了它的文献名词关联会一并清理。',
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: () =>
        void (async () => {
          await manager(appRef!).deleteEntry(data!, c.id);
          detailConceptId = null;
          data = await manager(appRef!).load();
          refreshAll();
          notice(`🗑 已删除「${c.name}」`);
        })(),
    });
  });
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'bz-blackbox-ai-btn';
  back.textContent = '← 返回';
  back.addEventListener('click', () => {
    detailConceptId = null;
    renderWall();
  });
  head.append(title, back, del);
  detail.appendChild(head);

  const def = document.createElement('div');
  def.className = 'bz-blackbox-detail-body';
  def.textContent = c.definition || '暂无定义（可重新生成卡片）';
  detail.appendChild(def);

  const related = (c.related || []).map((id) => data!.entries.find((e) => e.id === id)).filter((e): e is Entry => !!e);
  if (related.length) {
    detail.appendChild(sectionLabel('🔗 关联概念'));
    const relRow = document.createElement('div');
    relRow.className = 'bz-blackbox-related-row';
    for (const r of related) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'bz-blackbox-term-chip bz-blackbox-term-chip-on';
      chip.textContent = r.name || r.id;
      chip.addEventListener('click', () => {
        detailConceptId = r.id;
        renderWall();
        renderWallDetail(box);
      });
      relRow.appendChild(chip);
    }
    detail.appendChild(relRow);
  }

  const refs = data.entries.filter((e) => e.type === 'literature' && (e.terms || []).includes(c.id));
  if (refs.length) {
    detail.appendChild(sectionLabel('📎 引用的文献'));
    for (const r of refs.slice(0, 5)) {
      const item = document.createElement('div');
      item.className = 'bz-blackbox-ref-item';
      item.textContent = clip(r.text || '', 60);
      detail.appendChild(item);
    }
  }
}

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

// ---------------- 📎 文献架 ----------------

function renderShelf(): void {
  const box = document.getElementById('bz-blackbox-shelf');
  if (!box || !data) return;
  box.innerHTML = '';
  const items = data.entries
    .filter((e) => e.type === 'literature')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!items.length) {
    box.appendChild(emptyState('暂无文献', '用「录入」粘贴一段摘抄，包仔会帮你找概念'));
    return;
  }
  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'bz-blackbox-shelf-card';
    const head = document.createElement('div');
    head.className = 'bz-blackbox-shelf-head';
    const src = document.createElement('span');
    src.className = 'bz-blackbox-shelf-source';
    src.textContent = it.source || '未标注来源';
    const time = document.createElement('span');
    time.className = 'bz-blackbox-growth-time';
    time.textContent = it.createdAt.slice(0, 10);
    head.append(src, time);
    card.appendChild(head);
    const body = document.createElement('div');
    body.className = 'bz-blackbox-shelf-body';
    body.textContent = clip(it.text || '', 80);
    card.appendChild(body);
    const terms = (it.terms || [])
      .map((id) => data!.entries.find((e) => e.id === id))
      .filter((e): e is Entry => !!e);
    if (terms.length) {
      const tagRow = document.createElement('div');
      tagRow.className = 'bz-blackbox-term-chips';
      for (const t of terms) {
        const tag = document.createElement('span');
        tag.className = 'bz-blackbox-term-chip bz-blackbox-term-chip-on';
        tag.textContent = t.name || t.id;
        tagRow.appendChild(tag);
      }
      card.appendChild(tagRow);
    }
    // 点击展开全文
    const detail = document.createElement('div');
    detail.className = 'bz-blackbox-shelf-full';
    detail.style.display = 'none';
    detail.textContent = it.text || '';
    if (it.links && it.links.length) {
      const links = document.createElement('div');
      links.className = 'bz-blackbox-shelf-links';
      links.textContent = `🔗 ${it.links.join('  ')}`;
      detail.appendChild(links);
    }
    card.appendChild(detail);
    card.addEventListener('click', () => {
      detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    });
    box.appendChild(card);
  }
}

// ---------------- 💡 想法池 ----------------

function renderPool(): void {
  const box = document.getElementById('bz-blackbox-pool');
  if (!box || !data) return;
  box.innerHTML = '';
  const items = data.entries
    .filter((e) => e.type === 'thought')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!items.length) {
    box.appendChild(emptyState('暂无想法', '用「录入」记下此刻的念头，想法的核心层在这里'));
    return;
  }
  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'bz-blackbox-pool-card';
    const body = document.createElement('div');
    body.className = 'bz-blackbox-pool-body';
    body.textContent = it.text || '';
    card.appendChild(body);
    const meta = document.createElement('div');
    meta.className = 'bz-blackbox-pool-meta';
    if (it.emotions.length) {
      for (const tag of it.emotions) {
        const chip = document.createElement('span');
        chip.className = 'bz-blackbox-emotion-tag';
        chip.textContent = tag;
        meta.appendChild(chip);
      }
    }
    if (it.people.length) {
      for (const p of it.people) {
        const tag = document.createElement('span');
        tag.className = 'bz-blackbox-people-tag';
        tag.textContent = personLabel(p, data!.profiles);
        meta.appendChild(tag);
      }
    }
    if (it.scene) {
      const sc = document.createElement('span');
      sc.className = 'bz-blackbox-pool-scene';
      sc.textContent = `📍 ${it.scene}`;
      meta.appendChild(sc);
    }
    if (it.links && it.links.length) {
      const lk = document.createElement('span');
      lk.className = 'bz-blackbox-pool-links';
      lk.textContent = `🔗 ${it.links.length}`;
      meta.appendChild(lk);
    }
    const time = document.createElement('span');
    time.className = 'bz-blackbox-growth-time';
    time.textContent = it.createdAt.slice(0, 10);
    meta.appendChild(time);
    card.appendChild(meta);
    box.appendChild(card);
  }
}

// ---------------- 👤 人物 ----------------

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
  notice('✅ 印象已保存（包仔不会再覆盖这里）');
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
  notice('✨ 已采纳进印象');
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
    notice('⚠️ 名字不能为空');
    return;
  }
  if (data.profiles.some((p) => p.name === name)) {
    notice('⚠️ 已有同名画像');
    return;
  }
  const pf = await createProfileWithSeed(appRef, name, relation);
  data = await manager(appRef).load();
  detailProfileId = pf.id;
  panelNewProfileOpen = false;
  renderPeople();
  notice(`✅ 画像「${name}」已创建`);
}

// ---------------- 🕐 时间线 ----------------

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
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
    confirm.textContent = '✓ 确认';
    confirm.addEventListener('click', () => void confirmEventAction(ev.id));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'bz-blackbox-ai-btn';
    del.textContent = '✕ 删除';
    del.addEventListener('click', () => void deleteEventAction(ev.id));
    actions.append(confirm, del);
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
  notice('✓ 已确认（转为实线事件）');
  refreshAll();
}

async function deleteEventAction(eventId: string): Promise<void> {
  if (!appRef || !data) return;
  const m = manager(appRef);
  const latest = await m.load();
  await m.deleteEvent(latest, eventId);
  data = latest;
  notice('🗑 已删除（遗忘权后置：不做忽略清单）');
  refreshAll();
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
