/**
 * 游戏架（gameshelf）域 UI v2（issue 368 增补：对齐 bz 组件库整体设计）：
 * 头行 = uiMainHead（memo/cinema/favorites 同款视觉），视图切换 = uiSegmented，
 * 报告统计卡 = uiStat，空态/引导态 = uiEmpty；卡片/条形图细节走 --bz token。
 * 亮暗由 token 层自动跟随（零固定色）；无入场动效；滚动条不自造。
 * 移动端 ≤768px 真全屏 + .bz-panel-mtop 44px 顶距（issue 272 范式）。
 * markup 纯函数（shelfHtml/reportHtml/detail 壳）与行为层同文件，测试直断言 DOM/串。
 * 详情弹窗：成就（含全球解锁率→稀有成就）与商店元数据按需拉取，写回 frontmatter 缓存。
 */
import type { App } from 'obsidian';
import { topifyZ } from '../core/dom';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { tryGetSettings } from '../core/settings-provider';
import { uiModal, uiMainHead, uiSegmented, uiStat, uiEmpty, uiBtn, mountIcons } from '../core/ui';
import { readDetailFm } from './notes';
import { posterDisplayUrl } from './posters';
import { M, type GameItem, type GameshelfViewKind } from './state';
import { buildReport, REPORT_CAVEAT, type GameshelfReport } from './report';

const ESC_ID = 'gameshelf';
let maskEl: HTMLElement | null = null;
let segRef: { setValue: (v: GameshelfViewKind) => void } | null = null;
let countRef: { setCount: (c?: string) => void } | null = null;

// ---------- 引导态（未配置） ----------

/** 未配置引导态（两键：去配置 = 设置面板游戏架页深链；重新检测 = 就地重渲染）。不自动弹设置。 */
function guidanceEl(app: App): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'bz-gs-guide-actions';
  const go = uiBtn({ label: '去配置', tone: 'primary', onClick: () => goConfig(app) });
  go.id = 'bz-gs-guide-config';
  const re = uiBtn({ label: '重新检测', onClick: () => renderAll(app) });
  re.id = 'bz-gs-guide-recheck';
  actions.appendChild(go);
  actions.appendChild(re);
  return uiEmpty({
    icon: 'gamepad-2',
    title: '接上 Steam，游戏架自己长出来',
    desc: '在设置面板游戏架页填 SteamID64 和 Web API 密钥，保存后回来点同步，库和时长自动拉进来，不用手动登记。',
    actions,
  });
}

function goConfig(app: App): void {
  closePanel();
  void import('../settings-panel').then((m) => m.openSettingsPanel(app, 'gameshelf'));
}

// ---------- 游戏墙 ----------

/** 游戏墙：封面网格（本地海报优先）；offShelf 置灰挂角标（保留不删语义的可视化） */
export function shelfHtml(items: GameItem[], coverOf: (it: GameItem) => string): string {
  if (items.length === 0) {
    return '<div class="bz-gs-empty">还没有游戏，点右上角立即同步从 Steam 拉库</div>';
  }
  const cards = items
    .map((it) => {
      const cover = coverOf(it);
      return `
      <button class="bz-gs-card${it.offShelf ? ' bz-gs-card--off' : ''}" data-appid="${it.appid}" title="${escAttr(it.name)}">
        <span class="bz-gs-cover">${cover ? `<img loading="lazy" src="${escAttr(cover)}" alt="">` : '<i data-lucide="gamepad-2"></i>'}
          ${it.offShelf ? '<span class="bz-gs-off-badge">已下架</span>' : ''}
        </span>
        <span class="bz-gs-cardbar">
          <span class="bz-gs-name">${escHtml(it.name)}</span>
          <span class="bz-gs-hours">${hoursText(it.playtimeMin)}</span>
        </span>
      </button>`;
    })
    .join('');
  return `<div class="bz-gs-grid">${cards}</div>`;
}

// ---------- 报告 ----------

/** 报告页区块：时长排行 + 最近在玩 + 月份分布（统计卡由 uiStat 出，详见 renderAll） */
export function reportHtml(rp: GameshelfReport): string {
  const topRows = rp.top
    .map((t, i) => {
      const max = rp.top[0]?.hours || 1;
      const pct = Math.max(2, Math.round((t.hours / max) * 100));
      return `
      <div class="bz-gs-toprow" data-appid="${t.appid}">
        <span class="bz-gs-toprank">${i + 1}</span>
        <span class="bz-gs-topname">${escHtml(t.name)}</span>
        <span class="bz-gs-topbar"><span style="width:${pct}%"></span></span>
        <span class="bz-gs-tophours">${t.hours}h</span>
      </div>`;
    })
    .join('');
  const recentRows = rp.recent.length
    ? rp.recent
        .map(
          (it) =>
            `<div class="bz-gs-recentrow"><span class="bz-gs-topname">${escHtml(it.name)}</span><span class="bz-gs-meta">${escHtml(it.lastPlayed)}</span></div>`,
        )
        .join('')
    : '<div class="bz-gs-meta">近两周没有打开过 Steam 游戏</div>';
  const maxMonth = Math.max(1, ...rp.months.map((m) => m.count));
  const monthRows = rp.months
    .map((m) => {
      const pct = Math.max(2, Math.round((m.count / maxMonth) * 100));
      return `<div class="bz-gs-monthrow"><span class="bz-gs-topname">${m.month}</span><span class="bz-gs-topbar"><span style="width:${pct}%"></span></span><span class="bz-gs-tophours">${m.count}</span></div>`;
    })
    .join('');
  return `
  <div class="bz-gs-caveat">${escHtml(REPORT_CAVEAT)}</div>
  <div class="bz-gs-section"><div class="bz-gs-sectitle">时长排行</div>${topRows || '<div class="bz-gs-meta">空空如也</div>'}</div>
  <div class="bz-gs-section"><div class="bz-gs-sectitle">最近在玩（两周内）</div>${recentRows}</div>
  <div class="bz-gs-section"><div class="bz-gs-sectitle">最近游玩月份分布</div>${monthRows}</div>`;
}

/** 报告统计行（uiStat 组件出卡：在架 / 累计时长 / 近两周在玩 / 下架保留） */
function statsEl(rp: GameshelfReport): HTMLElement {
  const row = document.createElement('div');
  row.className = 'bz-gs-stats';
  row.appendChild(uiStat({ icon: 'gamepad-2', label: '在架游戏', num: rp.total }));
  row.appendChild(uiStat({ icon: 'clock', label: '累计时长', num: `${rp.totalHours}h` }));
  row.appendChild(uiStat({ icon: 'flame', label: '近两周在玩', num: rp.recent.length }));
  if (rp.offShelfCount > 0) row.appendChild(uiStat({ icon: 'archive', label: '已下架保留', num: rp.offShelfCount }));
  return row;
}

// ---------- 面板壳与行为 ----------

function createUI(app: App): void {
  if (maskEl && document.body.contains(maskEl)) return;
  const mask = document.createElement('div');
  mask.className = 'bz-gs-mask';
  mask.onclick = () => closePanel();
  const popup = document.createElement('div');
  popup.className = 'bz-gs-panel bz-panel-mtop';

  // 头行：uiMainHead 同款（标题+计数+立即同步主钮），插页签、补关闭钮
  const head = uiMainHead({
    title: '游戏架',
    action: { label: '立即同步', icon: 'refresh-cw', onClick: () => void onSyncClick(app) },
  });
  countRef = head;
  const seg = uiSegmented<GameshelfViewKind>({
    value: M.view,
    label: '视图切换',
    options: [
      { value: 'shelf', label: '游戏墙' },
      { value: 'report', label: '报告' },
    ],
    onChange: (v) => {
      M.view = v;
      renderAll(app);
    },
  });
  segRef = seg;
  const spacer = head.el.querySelector('.bz-main-spacer');
  if (spacer) head.el.insertBefore(seg.el, spacer);
  const close = uiBtn({ label: '关闭', icon: 'x', onClick: () => closePanel() });
  close.classList.add('bz-gs-close');
  close.setAttribute('aria-label', '关闭');
  head.el.appendChild(close);
  popup.appendChild(head.el);

  const status = document.createElement('div');
  status.className = 'bz-gs-status';
  status.id = 'bz-gs-status';
  popup.appendChild(status);

  const body = document.createElement('div');
  body.className = 'bz-gs-body';
  body.id = 'bz-gs-body';
  // 卡片点击 → 详情弹窗（委托：重渲 innerHTML 不丢监听）
  body.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('.bz-gs-card') as HTMLElement | null;
    if (!card) return;
    const appid = Number(card.dataset.appid);
    if (Number.isFinite(appid)) openDetail(app, appid);
  });
  popup.appendChild(body);

  document.body.appendChild(mask);
  document.body.appendChild(popup);
  topifyZ(mask, popup);
  maskEl = mask;
  M.currentOverlay = popup;
  registerPanelEsc(ESC_ID, () => !!M.currentOverlay, closePanel);
}

async function onSyncClick(app: App): Promise<void> {
  const { runSync } = await import('./sync');
  await runSync(app, { force: true });
  void ensurePostersFor(app);
  renderAll(app);
}

/** 同步/打开后补海报（缺本地缓存的入队后台串行下载） */
async function ensurePostersFor(app: App): Promise<void> {
  const { ensurePosters } = await import('./posters');
  ensurePosters(app, M.items.map((it) => ({ appid: it.appid, cover: it.cover })));
}

/** 全量重渲染（视图分派：未配置 → 引导；其余按 M.view） */
export function renderAll(app: App): void {
  const popup = M.currentOverlay;
  if (!popup || !document.body.contains(popup)) return;
  const configured = isConfigured();
  segRef?.setValue(M.view);
  countRef?.setCount(configured ? `${M.items.filter((it) => !it.offShelf).length} 款` : '');
  const syncBtn = popup.querySelector('.bz-btn--primary') as HTMLButtonElement | null;
  if (syncBtn) syncBtn.disabled = M.syncing || !configured;
  const status = popup.querySelector('#bz-gs-status');
  if (status) status.textContent = M.statusMsg;
  const body = popup.querySelector('#bz-gs-body');
  if (!body) return;
  if (!configured) {
    body.innerHTML = '';
    body.appendChild(guidanceEl(app));
  } else if (M.view === 'report') {
    const rp = buildReport(M.items);
    body.innerHTML = '';
    body.appendChild(statsEl(rp));
    body.insertAdjacentHTML('beforeend', reportHtml(rp));
  } else {
    body.innerHTML = shelfHtml(M.items, (it) => posterDisplayUrl(app, it.appid, it.cover));
  }
  mountIcons(popup);
}

function isConfigured(): boolean {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    return typeof s.gameshelfSteamId === 'string' && !!s.gameshelfSteamId.trim() &&
      typeof s.gameshelfSteamApiKey === 'string' && !!s.gameshelfSteamApiKey.trim();
  } catch {
    return false;
  }
}

// ---------- 详情弹窗（成就/商店元数据按需拉取，写回 frontmatter 缓存） ----------

/** 卡片点击 → 详情弹窗；已缓存的段直接展示，缺的段按需拉取（成就需配置与代理，商店直连可达） */
function openDetail(app: App, appid: number): void {
  const item = M.items.find((it) => it.appid === appid);
  if (!item || !item.file) return;
  const cached = readDetailFmSafe(app, item.file);
  const modal = uiModal({
    head: true,
    title: `《${item.name}》`,
    maxWidth: 620,
    className: 'bz-gs-detail-modal',
    content: detailShellHtml(item),
  });
  const popup = modal.popup;
  hydrateAchievements(app, item, cached, popup.querySelector('#bz-gs-detail-ach'));
  hydrateStore(app, item, cached, popup.querySelector('#bz-gs-detail-store'));
}

function readDetailFmSafe(app: App, file: NonNullable<GameItem['file']>): Record<string, unknown> {
  try {
    return readDetailFm(app, file);
  } catch {
    return {};
  }
}

function detailShellHtml(item: GameItem): string {
  const meta = item.offShelf ? '已下架保留' : `${hoursText(item.playtimeMin)}${item.lastPlayed ? ` · 最后玩 ${item.lastPlayed}` : ' · 还没玩过'}`;
  const cover = appRef() ? posterDisplayUrl(appRef(), item.appid, item.cover) : (item.cover ?? '');
  return `
  <div class="bz-gs-detail">
    <div class="bz-gs-detail-cover">${cover ? `<img src="${escAttr(cover)}" alt="">` : ''}</div>
    <div class="bz-gs-detail-line">${escHtml(meta)}</div>
    <div class="bz-gs-detail-sec" id="bz-gs-detail-ach"><div class="bz-gs-sectitle">成就</div><div class="bz-gs-meta">加载中…</div></div>
    <div class="bz-gs-detail-sec" id="bz-gs-detail-store"><div class="bz-gs-sectitle">游戏资料</div><div class="bz-gs-meta">加载中…</div></div>
  </div>`;
}

function appRef(): App {
  return M.appRef as App;
}

/** 成就段：有缓存直接展示；有成就页但没缓存 → 拉取并写回；无成就页 → 说明文字 */
async function hydrateAchievements(app: App, item: GameItem, cached: Record<string, unknown>, box: Element | null): Promise<void> {
  if (!box) return;
  if (cached['成就总数'] !== undefined) {
    box.innerHTML = achHtml(cached);
    return;
  }
  if (cached['有成就'] !== true) {
    box.innerHTML = '<div class="bz-gs-sectitle">成就</div><div class="bz-gs-meta">这款游戏没有成就页</div>';
    return;
  }
  const { readSteamConfig } = await import('./sync');
  const { steamId, apiKey } = readSteamConfig();
  if (!steamId || !apiKey) {
    box.innerHTML = '<div class="bz-gs-sectitle">成就</div><div class="bz-gs-meta">未配置 Steam，无法拉取成就</div>';
    return;
  }
  const { fetchAchievementSummary } = await import('./steam');
  const r = await fetchAchievementSummary(steamId, apiKey, item.appid);
  if (!r.ok) {
    box.innerHTML = `<div class="bz-gs-sectitle">成就</div><div class="bz-gs-meta">${escHtml(r.message)}</div>`;
    return;
  }
  const fields: Record<string, unknown> = {
    成就已解: r.data.unlocked,
    成就总数: r.data.total,
    稀有成就: r.data.rarestName ? `${r.data.rarestName}（全球 ${r.data.rarestPercent}% 拥有）` : '',
  };
  await writeDetail(app, item, fields);
  box.innerHTML = achHtml({ ...cached, ...fields });
}

/** 商店段：类型/开发商/发行日期/简体中文支持（appdetails，l=schinese 直出中文）+ 好评率/评测数（appreviews） */
async function hydrateStore(app: App, item: GameItem, cached: Record<string, unknown>, box: Element | null): Promise<void> {
  if (!box) return;
  if (cached['类型'] !== undefined && cached['好评率'] !== undefined) {
    box.innerHTML = storeHtml(cached);
    return;
  }
  const { fetchStoreMeta } = await import('./steam');
  const r = await fetchStoreMeta(item.appid);
  if (!r.ok) {
    box.innerHTML = `<div class="bz-gs-sectitle">游戏资料</div><div class="bz-gs-meta">${escHtml(r.message)}</div>`;
    return;
  }
  const fields: Record<string, unknown> = {
    类型: r.data.genres ?? '',
    开发商: r.data.developers ?? '',
    发行日期: r.data.releaseDate ?? '',
    好评率: r.data.reviewDesc ?? '',
    评测数: r.data.reviewsTotal ?? '',
    简体中文支持: r.data.zhSupported,
  };
  await writeDetail(app, item, fields);
  box.innerHTML = storeHtml({ ...cached, ...fields });
}

async function writeDetail(app: App, item: GameItem, fields: Record<string, unknown>): Promise<void> {
  if (!item.file) return;
  const { upsertDetail } = await import('./notes');
  await upsertDetail(app, item.file, fields);
}

function achHtml(fm: Record<string, unknown>): string {
  const total = Number(fm['成就总数']);
  const unlocked = Number(fm['成就已解']) || 0;
  const pct = total > 0 ? Math.round((unlocked / total) * 1000) / 10 : 0;
  const rare = typeof fm['稀有成就'] === 'string' && fm['稀有成就'] ? `<div class="bz-gs-meta">稀有：${escHtml(fm['稀有成就'])}</div>` : '';
  return `
  <div class="bz-gs-sectitle">成就</div>
  <div class="bz-gs-detailline"><span class="bz-gs-topname">${unlocked} / ${total}（${pct}%）</span><span class="bz-gs-topbar"><span style="width:${pct}%"></span></span></div>
  ${rare}`;
}

function storeHtml(fm: Record<string, unknown>): string {
  const row = (label: string, v: unknown) =>
    v === undefined || v === null || v === '' ? '' : `<div class="bz-gs-detailline"><span class="bz-gs-detail-label">${label}</span><span>${escHtml(String(v))}</span></div>`;
  return `
  <div class="bz-gs-sectitle">游戏资料</div>
  ${row('类型', fm['类型'])}
  ${row('开发商', fm['开发商'])}
  ${row('发行日期', fm['发行日期'])}
  ${row('评价', fm['好评率'])}
  ${row('评测数', fm['评测数'])}
  ${fm['简体中文支持'] !== undefined ? row('简体中文', fm['简体中文支持'] ? '支持' : '无官方') : ''}`;
}

// ---------- 小工具 ----------

function hoursText(playtimeMin: number): string {
  const h = Math.round((playtimeMin || 0) / 6) / 10;
  return `${h}h`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(s: string): string {
  return escHtml(s);
}

/** 打开面板（挂壳 + 首渲 + 补海报）；已挂则跳过（toggle 关分支走 closePanel） */
export function openPanel(app: App): void {
  createUI(app);
  M.renderFn = () => renderAll(app);
  renderAll(app);
  void ensurePostersFor(app);
}

/** 关闭（toggle 语义的关分支）：DOM 摘除 + ESC 注销；状态保留（下次打开重建） */
export function closePanel(): void {
  unregisterPanelEsc(ESC_ID);
  maskEl?.remove();
  maskEl = null;
  M.currentOverlay?.remove();
  M.currentOverlay = null;
}
