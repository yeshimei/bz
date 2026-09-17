/**
 * 游戏架（gameshelf）域 UI：面板行为层（issue 368）。
 * markup 由本文件纯函数产出（shelfHtml/reportHtml/guidanceHtml，可测）；
 * overlay 范式对齐 secondbrain/panel.ts：自绘遮罩挂 body + ESC 层（escManager）+
 * topifyZ 动态层级 + 移动端 .bz-panel-mtop（真全屏 + 44px 顶部避让）+ 遮罩点击关。
 * 图标 lucide（data-lucide 占位 → mountIcons 物化）；样式全消费 core/ui token，
 * 暗色由 token 层自动跟随，不留固定色。
 */
import type { App } from 'obsidian';
import { topifyZ } from '../core/dom';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { tryGetSettings } from '../core/settings-provider';
import { mountIcons } from '../core/ui';
import { M, type GameItem, type GameshelfViewKind } from './state';
import { buildReport, REPORT_CAVEAT, type GameshelfReport } from './report';

const ESC_ID = 'gameshelf';
let maskEl: HTMLElement | null = null;

// ---------- markup 纯函数（测试直断言字符串/DOM） ----------

/** 未配置引导态（两键：去配置 = 设置面板游戏架页深链；重新检测 = 就地重渲染）。不自动弹设置。 */
export function guidanceHtml(): string {
  return `
  <div class="bz-gs-guide">
    <i data-lucide="gamepad-2" class="bz-gs-guide-icon"></i>
    <div class="bz-gs-guide-title">接上 Steam，游戏架自己长出来</div>
    <div class="bz-gs-guide-desc">在设置面板游戏架页填两样：SteamID64 和 Web API 密钥，保存后回来点同步，库和时长自动拉进来，不用手动登记。</div>
    <div class="bz-gs-guide-actions">
      <button class="bz-gs-btn bz-gs-btn--primary" id="bz-gs-guide-config">去配置</button>
      <button class="bz-gs-btn" id="bz-gs-guide-recheck">重新检测</button>
    </div>
  </div>`;
}

/** 游戏墙：封面网格；offShelf 条目置灰挂「已下架」角标（保留不删语义的可视化） */
export function shelfHtml(items: GameItem[]): string {
  if (items.length === 0) {
    return '<div class="bz-gs-empty">还没有游戏，点右上角同步从 Steam 拉库</div>';
  }
  const cards = items
    .map((it) => {
      const meta = it.offShelf
        ? '已下架保留'
        : `${hoursText(it.playtimeMin)}${it.lastPlayed ? ` · 最后玩 ${it.lastPlayed}` : ' · 还没玩过'}`;
      return `
      <div class="bz-gs-card${it.offShelf ? ' bz-gs-card--off' : ''}" data-appid="${it.appid}" title="${escAttr(it.name)}">
        <div class="bz-gs-cover">${it.cover ? `<img loading="lazy" src="${escAttr(it.cover)}" alt="">` : '<i data-lucide="gamepad-2"></i>'}
          ${it.offShelf ? '<span class="bz-gs-off-badge">已下架</span>' : ''}
        </div>
        <div class="bz-gs-name">${escHtml(it.name)}</div>
        <div class="bz-gs-meta">${escHtml(meta)}</div>
      </div>`;
    })
    .join('');
  return `<div class="bz-gs-grid">${cards}</div>`;
}

/** 报告页：库总览三数 + 时长排行条形 + 最近在玩 + 月份分布 + 口径注记 */
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
  <div class="bz-gs-stats">
    <div class="bz-gs-stat"><div class="bz-gs-statnum">${rp.total}</div><div class="bz-gs-statlabel">在架游戏</div></div>
    <div class="bz-gs-stat"><div class="bz-gs-statnum">${rp.totalHours}h</div><div class="bz-gs-statlabel">累计时长</div></div>
    <div class="bz-gs-stat"><div class="bz-gs-statnum">${rp.recent.length}</div><div class="bz-gs-statlabel">近两周在玩</div></div>
    ${rp.offShelfCount > 0 ? `<div class="bz-gs-stat"><div class="bz-gs-statnum">${rp.offShelfCount}</div><div class="bz-gs-statlabel">已下架保留</div></div>` : ''}
  </div>
  <div class="bz-gs-caveat">${escHtml(REPORT_CAVEAT)}</div>
  <div class="bz-gs-section"><div class="bz-gs-sectitle">时长排行</div>${topRows || '<div class="bz-gs-meta">空空如也</div>'}</div>
  <div class="bz-gs-section"><div class="bz-gs-sectitle">最近在玩（两周内）</div>${recentRows}</div>
  <div class="bz-gs-section"><div class="bz-gs-sectitle">最近游玩月份分布</div>${monthRows}</div>`;
}

// ---------- 面板壳与行为 ----------

function shellHtml(): string {
  return `
  <div class="bz-gs-head">
    <div class="bz-gs-title">游戏架</div>
    <div class="bz-gs-tabs">
      <button class="bz-gs-tab" data-view="shelf">游戏墙</button>
      <button class="bz-gs-tab" data-view="report">报告</button>
    </div>
    <div class="bz-gs-head-actions">
      <button class="bz-gs-btn bz-gs-btn--sync" id="bz-gs-sync"><i data-lucide="refresh-cw"></i>立即同步</button>
      <button class="bz-gs-close" id="bz-gs-close" aria-label="关闭"><i data-lucide="x"></i></button>
    </div>
  </div>
  <div class="bz-gs-status" id="bz-gs-status"></div>
  <div class="bz-gs-body" id="bz-gs-body"></div>`;
}

/** 组装面板（挂 body）；重复打开防重入 */
function createUI(app: App): void {
  if (maskEl && document.body.contains(maskEl)) return;
  const mask = document.createElement('div');
  mask.className = 'bz-gs-mask';
  mask.onclick = () => closePanel();
  const popup = document.createElement('div');
  popup.className = 'bz-gs-panel bz-panel-mtop';
  popup.innerHTML = shellHtml();
  popup.querySelector('#bz-gs-close')?.addEventListener('click', () => closePanel());
  popup.querySelector('#bz-gs-sync')?.addEventListener('click', () => void onSyncClick(app));
  popup.querySelector('.bz-gs-tabs')?.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('.bz-gs-tab') as HTMLElement | null;
    if (!tab) return;
    const v = tab.dataset.view as GameshelfViewKind;
    if (v !== 'shelf' && v !== 'report') return;
    M.view = v;
    renderAll(app);
  });
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
  renderAll(app);
}

function goConfig(app: App): void {
  closePanel();
  void import('../settings-panel').then((m) => m.openSettingsPanel(app, 'gameshelf'));
}

/** 全量重渲染（视图分派：未配置 → 引导；其余按 M.view） */
export function renderAll(app: App): void {
  const popup = M.currentOverlay;
  if (!popup || !document.body.contains(popup)) return;
  const configured = isConfigured();
  // 页签态：未配置时两页签都灰（引导态接管 body）
  for (const tab of popup.querySelectorAll('.bz-gs-tab')) {
    tab.classList.toggle('is-active', configured && M.view === (tab as HTMLElement).dataset.view);
  }
  const syncBtn = popup.querySelector('#bz-gs-sync') as HTMLButtonElement | null;
  if (syncBtn) syncBtn.disabled = M.syncing || !configured;
  const status = popup.querySelector('#bz-gs-status');
  if (status) status.textContent = M.statusMsg;
  const body = popup.querySelector('#bz-gs-body');
  if (!body) return;
  if (!configured) {
    body.innerHTML = guidanceHtml();
    body.querySelector('#bz-gs-guide-config')?.addEventListener('click', () => goConfig(app));
    body.querySelector('#bz-gs-guide-recheck')?.addEventListener('click', () => renderAll(app));
  } else if (M.view === 'report') {
    body.innerHTML = reportHtml(buildReport(M.items));
  } else {
    body.innerHTML = shelfHtml(M.items);
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

/** 打开面板（挂壳 + 首渲）；已挂则跳过（toggle 关分支走 closePanel） */
export function openPanel(app: App): void {
  createUI(app);
  M.renderFn = () => renderAll(app);
  renderAll(app);
}

/** 关闭（toggle 语义的关分支）：DOM 摘除 + ESC 注销；状态保留（下次打开重建） */
export function closePanel(): void {
  unregisterPanelEsc(ESC_ID);
  maskEl?.remove();
  maskEl = null;
  M.currentOverlay?.remove();
  M.currentOverlay = null;
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
