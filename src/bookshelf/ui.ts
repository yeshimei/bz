/**
 * 书架墙（bookshelf）域 UI：试点收编组件库（铁律 6）
 * 桌面：整宽头行（仅标题「书架墙」+ 计数）＋ 左栏（状态列表 + 底部阅读分析报告入口）
 *       ＋ 内容区（搜索 + 排序下拉 + 统计行[3 卡+近 12 月柱] + 封面平铺网格，hover 上抬）
 * 移动：头行标题 + 右上图标组（报告 / 搜索(默认隐藏可展开) / 筛选(底部抽屉) / 关闭）
 *       ＋ 2 统计卡 ＋ 封面平铺网格（2 列）
 * 交互：点封面 → 详情弹窗（uiModal 头行 + ✕；移动端全屏覆写）——改状态(平铺单选)/进度(滑条)/
 *       书评(textarea)；md 书可删除（二次确认，vault.delete）；EPUB 条目只读（Weave 驱动）。
 *       保存语义：已读→进度 100+补 completionDate/readingDate；在读→进度 1-99+补 readingDate 清 completionDate；
 *       未读→清两日期归零进度；书评空删键。落盘走 app.fileManager.processFrontMatter。
 * 基线：按钮/图标钮/输入/单选/滑条/空态/弹窗骨架走组件库（src/core/ui）；域内只留书架特有布局。
 * 图标：一律 lucide（字符串模板 data-lucide 占位 → mountIcons 统一 setIcon）。
 * 报告入口：执行现有命令 bz-reading-report-open（reading-report 域），本域不自建报告。
 */
import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { notice } from '../core/notice';
import { escManager } from '../core/esc-manager';
import { allocZ } from '../core/z-order';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { uiModal, uiIcon, uiChoice, uiRange, uiSelect, uiEmpty } from '../core/ui';
import { isMobileEnv } from '../core/mobile';
import {
  STATUS_COLORS, SIDE_DEFS, SORT_LABEL, ICON, REPORT_COMMAND_ID,
  EMPTY_BOOKS_ICON, EMPTY_SEARCH_ICON, EMPTY_FILTER_ICON,
} from './constants';
import { M, resetBookshelfState, type BookshelfItem, type SideId, type SortKey } from './state';
import { rebuildItems, getDisplayItems, computeStats, resolveFolderPath, resolveBookTag } from './data';

// ---------- 小工具 ----------

/** lucide 占位 HTML（innerHTML 拼接用；渲染后 mountIcons 统一 setIcon） */
function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]));
}

/** 容器内所有 data-lucide 占位替换为 setIcon 渲染的真图标（保持 class 修饰） */
function mountIcons(container: HTMLElement): void {
  container.querySelectorAll('i[data-lucide]').forEach((el) => {
    const name = el.getAttribute('data-lucide') || '';
    const cls = el.className;
    const fresh = uiIcon(name, '');
    if (cls && cls !== 'bz-ic') fresh.className = cls;
    el.replaceWith(fresh);
  });
}

/** 封面资源 URL（vault 路径 → resource URL）；无文件/非图返回 null */
function coverUrl(it: BookshelfItem, app: App): string | null {
  if (!it.cover) return null;
  const f = app.vault.getAbstractFileByPath(it.cover);
  if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
    return app.vault.getResourcePath(f);
  }
  return null;
}

/** 封面区块：有图出图，无图出占位（books 图标）；坏图由 bindCoverFallback 回退占位 */
function coverBlock(it: BookshelfItem, app: App, cls: string): string {
  const url = coverUrl(it, app);
  if (!url) return `<div class="bz-bs-cover-ph ${cls}">${iconSpan('library')}</div>`;
  return `<div class="bz-bs-cover ${cls}"><img src="${esc(url)}" alt="" loading="lazy"></div>`;
}

/** B4：坏图回退占位块（capture 阶段接 error 不冒泡事件；img 原位替换为占位）。
 *  container 级一次挂载，innerHTML 重渲染不失效。 */
function bindCoverFallback(container: HTMLElement): void {
  container.addEventListener('error', (e) => {
    const img = e.target as HTMLElement;
    if (!img || img.tagName !== 'IMG') return;
    const ph = document.createElement('div');
    ph.className = 'bz-bs-cover-ph';
    ph.innerHTML = iconSpan('library');
    mountIcons(ph);
    img.replaceWith(ph);
  }, true);
}

/** 状态徽章色（token 引用；数据语义色） */
function statusColor(status: string): string {
  return STATUS_COLORS[status] || 'var(--bz-text-3)';
}

// ---------- 渲染：主面板 ----------

function statusDefs(): { id: SideId; label: string; icon: string; count: number }[] {
  const map: Record<string, string> = { reading: '在读', unread: '未读', done: '已读' };
  return SIDE_DEFS.map((d) => ({
    id: d.id,
    label: d.label,
    icon: d.icon,
    count: d.id === 'all' ? M.items.length : M.items.filter((x) => x.status === map[d.id]).length,
  }));
}

function renderSide(): void {
  const sideEl = M.currentOverlay?.querySelector('.bz-bs-side-list') as HTMLElement | null;
  if (!sideEl) return;
  sideEl.innerHTML = statusDefs().map((s) => `
    <button class="bz-bs-side-item${s.id === M.side ? ' on' : ''}" data-bs-side="${s.id}">
      <span class="bz-bs-side-ic">${iconSpan(s.icon)}</span>${s.label}<span class="bz-bs-side-cnt">${s.count}</span>
    </button>`).join('');
  mountIcons(sideEl);
}

/** 统计行（桌面 3 卡 + 月柱；移动 2 卡，无柱） */
function dashHTML(s: ReturnType<typeof computeStats>, now: Date): { desktop: string; mobile: string } {
  const firstReading = s.reading[0];
  const accentHint = firstReading ? `《${firstReading.title.slice(0, 12)}${firstReading.title.length > 12 ? '…' : ''}》` : '';
  const statCard = (icon: string, label: string, num: string, hint: string, accent: boolean): string => `
    <div class="bz-bs-statcard${accent ? ' accent' : ''}">
      <div class="bz-bs-stat-label">${iconSpan(icon, 'bz-ic--sm')}${label}</div>
      <div class="bz-bs-stat-num">${num}</div>
      ${hint ? `<div class="bz-bs-stat-hint">${esc(hint)}</div>` : ''}
    </div>`;
  const bars = s.bars.map((b) => `
    <div class="bz-bs-bar-col"><div class="bz-bs-bar${b.isThis ? ' this' : ''}${b.count === 0 ? ' zero' : ''}" style="height:${Math.max(3, Math.round((b.count / s.maxBar) * 56))}px"><span>${b.count || ''}</span></div>
    <div class="bz-bs-bar-label">${b.label}</div></div>`).join('');
  const desktop = `
    ${statCard('book-open', '正在读', `${s.reading.length} 本`, accentHint, true)}
    ${statCard('check-circle', `${now.getFullYear()} 读完`, `${s.doneThisYear.length} 本`, `${s.done.length} 本累计`, false)}
    ${statCard('clock', '累计时长', `${s.totalHours} 小时`, '划线 ' + s.totalHighlights + ' 条', false)}
    <div class="bz-bs-chart">
      <div class="bz-bs-chart-head"><span class="bz-bs-ctitle">每月读完</span><span class="bz-bs-csub">近 12 个月 · 含当前</span></div>
      <div class="bz-bs-bars">${bars}</div>
      <div class="bz-bs-chart-foot"><span>读完峰值 ${s.maxBar} 本 / 月</span><span>累计 ${s.done.length} 本</span></div>
    </div>`;
  const mobile = `
    <div class="bz-bs-mcard accent"><div class="bz-bs-mlabel">正在读</div><div class="bz-bs-mnum">${s.reading.length} 本</div></div>
    <div class="bz-bs-mcard"><div class="bz-bs-mlabel">今年读完</div><div class="bz-bs-mnum">${s.doneThisYear.length} 本</div></div>`;
  return { desktop, mobile };
}

function renderDash(app: App): void {
  const s = computeStats();
  const now = new Date();
  const htmls = dashHTML(s, now);
  const dEl = M.currentOverlay?.querySelector('.bz-bs-dash') as HTMLElement | null;
  if (dEl) { dEl.innerHTML = htmls.desktop; mountIcons(dEl); }
  const mEl = M.currentOverlay?.querySelector('.bz-bs-mcards') as HTMLElement | null;
  if (mEl) { mEl.innerHTML = htmls.mobile; mountIcons(mEl); }
  const totalEl = M.currentOverlay?.querySelector('.bz-bs-total') as HTMLElement | null;
  if (totalEl) totalEl.textContent = `${M.items.length} 本`;
  void app;
}

/** 封面卡（桌面/移动同结构，尺寸靠 CSS 列数/比例） */
function bookCardHTML(it: BookshelfItem, app: App): string {
  const prog = it.status !== '已读' && it.progress > 0
    ? `<div class="bz-bs-prog"><i style="width:${Math.min(100, it.progress)}%"></i></div>` : '';
  const quote = it.bookReview
    ? `<div class="bz-bs-quote">${esc(it.bookReview.replace(/\[\[.*?\]\]/g, '').slice(0, 48))}</div>` : '';
  // B5：路径含引号会截断 HTML 属性 → esc() 转义；回查时浏览器已解码为原值
  return `<div class="bz-bs-book" data-bs-id="${esc(it.file?.path ?? it.epubVaultPath ?? '')}" data-bs-epub="${it.isEpub ? '1' : ''}">
    <div class="bz-bs-cover-wrap">${coverBlock(it, app, '')}${prog}
      <span class="bz-bs-statusdot" style="background:${statusColor(it.status)}"></span>${quote}
    </div>
    <div class="bz-bs-bname" title="${esc(it.title)}">${esc(it.title)}</div>
    <div class="bz-bs-bauthor">${esc(it.author)}</div>
  </div>`;
}

function renderShelves(app: App): void {
  const list = getDisplayItems();
  // B9：空态三态区分——库空 / 搜索无命中 / 状态筛无书（图标语义各自匹配）
  const emptyCfg = !M.items.length
    ? { icon: EMPTY_BOOKS_ICON, title: '书架墙还是空的', desc: `把书籍笔记放进「${resolveFolderPath()}」文件夹，并在 frontmatter 添加 tags: ${resolveBookTag()} 标签` }
    : M.searchKeyword
      ? { icon: EMPTY_SEARCH_ICON, title: '没有找到相关的书', desc: '试试其他关键词，或换一个筛选' }
      : { icon: EMPTY_FILTER_ICON, title: '这个状态下还没有书', desc: '换一个状态筛选，或用搜索找找' };
  const gridOrEmpty = list.length
    ? `<div class="bz-bs-grid">${list.map((it) => bookCardHTML(it, app)).join('')}</div>`
    : `<div class="bz-bs-none">${uiEmpty({ icon: emptyCfg.icon, title: emptyCfg.title, desc: emptyCfg.desc }).outerHTML}</div>`;
  const dEl = M.currentOverlay?.querySelector('.bz-bs-shelves') as HTMLElement | null;
  const mEl = M.currentOverlay?.querySelector('.bz-bs-shelves-m') as HTMLElement | null;
  // B7：按运行端只渲染一份网格（Platform.isMobile 静态判定；桌面/移动容器由 CSS 媒体查询切换显示），
  // 大书库免双份 DOM/图片请求
  const isMobile = isMobileEnv();
  if (!isMobile && dEl) {
    dEl.innerHTML = gridOrEmpty;
    mountIcons(dEl);
    bindCoverFallback(dEl);
  }
  if (isMobile && mEl) {
    mEl.innerHTML = gridOrEmpty;
    mountIcons(mEl);
    bindCoverFallback(mEl);
  }
}

function renderAll(app: App): void {
  renderSide();
  renderDash(app);
  renderShelves(app);
  paintFilterBtn();
}
export { renderAll };

// ---------- 移动端：筛选按钮 + 底部抽屉 ----------

function paintFilterBtn(): void {
  const btn = M.currentOverlay?.querySelector('#bz-bs-filterbtn') as HTMLElement | null;
  if (!btn) return;
  const active = M.side !== 'all';
  btn.classList.toggle('on', active);
  btn.innerHTML = iconSpan('funnel') + (active ? `<span class="bz-bs-filter-tag">${SIDE_DEFS.find((d) => d.id === M.side)?.label ?? ''} ${statusCount(M.side)}</span>` : '');
  mountIcons(btn);
}

function statusCount(side: SideId): number {
  if (side === 'all') return M.items.length;
  const status = side === 'reading' ? '在读' : side === 'unread' ? '未读' : '已读';
  return M.items.filter((it) => it.status === status).length;
}

/** 底部筛选抽屉（移动端；单例互斥，二次打开先关旧） */
function openFilterDrawer(app: App): void {
  closeDrawer();
  const mask = document.createElement('div');
  mask.className = 'bz-bs-drawer-mask';
  mask.style.zIndex = String(allocZ());
  mask.innerHTML = `<div class="bz-bs-drawer-sheet">
    <div class="bz-bs-drawer-grab"></div>
    <div class="bz-bs-drawer-head">筛选<button class="bz-icon-btn bz-icon-btn--lg" data-bs-drawer-close title="关闭">${iconSpan('x')}</button></div>
    <div class="bz-bs-drawer-body">
      ${SIDE_DEFS.map((d) => `
        <button class="bz-bs-drawer-opt${d.id === M.side ? ' on' : ''}" data-bs-dopt="${d.id}">
          <span class="bz-bs-drawer-ic">${iconSpan(d.icon)}</span>
          <span class="bz-bs-drawer-main"><span class="bz-bs-drawer-label">${d.label}</span>
          <span class="bz-bs-drawer-sub">${d.sub}</span></span>
          <span class="bz-bs-drawer-cnt">${statusCount(d.id)}</span>
          ${d.id === M.side ? `<span class="bz-bs-drawer-check">${iconSpan('check')}</span>` : ''}
        </button>`).join('')}
    </div>
  </div>`;
  mask.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === mask || t.closest('[data-bs-drawer-close]')) { closeDrawer(); return; }
    const opt = t.closest('[data-bs-dopt]') as HTMLElement | null;
    if (opt) {
      M.side = (opt.dataset.bsDopt || 'all') as SideId;
      closeDrawer();
      renderSide();
      renderShelves(app);
      paintFilterBtn();
    }
  });
  document.body.appendChild(mask);
  M.drawerEl = mask;
  requestAnimationFrame(() => mask.classList.add('open'));
}

function closeDrawer(): void {
  if (M.drawerEl) {
    M.drawerEl.remove();
    M.drawerEl = null;
  }
}

// ---------- 详情弹窗（改状态/进度/书评；EPUB 只读） ----------

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 时长展示「N小时M分」解析为小时文本（直接展示 readingTimeFormat 原文即可） */
function openBookDetail(it: BookshelfItem, app: App): void {
  const readonly = it.isEpub;
  // B4：封面坏图由 bindCoverFallback 回退占位（src 失效触发 error）
  const cover = it.cover
    ? `<img src="${esc(coverUrl(it, app) || '')}" alt="">`
    : `<div class="bz-bs-d-hero-ph">${iconSpan('library')}</div>`;
  const dateMeta = it.readingDate
    ? `<div class="bz-bs-d-meta"><b>阅读</b>：始于 ${esc(it.readingDate)}${it.completionDate ? ` · 读完 ${esc(it.completionDate)}` : ''}</div>`
    : `<div class="bz-bs-d-meta"><b>状态</b>：${esc(it.status)}${it.completionDate ? ` · 读完 ${esc(it.completionDate)}` : ''}</div>`;
  const chips = [
    it.highlights ? `${iconSpan('highlighter', 'bz-ic--xs')}${it.highlights} 划` : '',
    it.thinks ? `${iconSpan('brain', 'bz-ic--xs')}${it.thinks} 想` : '',
    it.readingTimeFormat ? `${iconSpan('clock', 'bz-ic--xs')}${esc(it.readingTimeFormat)}` : '',
  ].filter(Boolean).join('');

  const body = document.createElement('div');
  body.className = 'bz-bs-detail';
  body.innerHTML = `
    <div class="bz-bs-d-hero">
      <div class="bz-bs-d-cover">${cover}</div>
      <div class="bz-bs-d-info">
        <div class="bz-bs-d-title">${esc(it.title)}</div>
        <div class="bz-bs-d-author">${esc(it.author)}</div>
        <div class="bz-bs-d-badges"><span class="bz-chip bz-chip--locked" style="background:${statusColor(it.status)};border-color:transparent;color:var(--bz-on-overlay)">${esc(it.status)}</span></div>
        <div class="bz-bs-d-chips">${chips}</div>
        <div class="bz-bs-d-cat">${esc(it.category || '未分类')}</div>
        ${dateMeta}
      </div>
    </div>
    <div class="bz-bs-label">状态</div>
    <div class="bz-bs-d-status"></div>
    <div class="bz-bs-label">阅读进度</div>
    <div class="bz-bs-d-progrow"><span class="bz-bs-d-prog"></span><span class="bz-bs-d-prognum">${it.progress}%</span></div>
    <div class="bz-bs-label">书评</div>
    <textarea class="bz-input bz-bs-d-review" placeholder="写一句这本书…">${esc(it.bookReview || '')}</textarea>
    ${readonly ? '<div class="bz-bs-d-readonly">EPUB 书目由 Weave 阅读器记录：状态、进度随阅读自动更新，这里只读展示。</div>' : ''}`;
  const { popup, close } = uiModal({
    content: body,
    maxWidth: 560,
    head: true,
    title: '书籍详情',
    className: 'bz-bs-d-popup',
  });

  // 只读区之上组装编辑控件（组件库工厂；EPUB 禁用）
  const statusChoice = uiChoice({
    options: ['在读', '已读', '未读'].map((v) => ({ value: v, label: v, dot: statusColor(v) })),
    value: it.status,
    onChange: (v) => {
      progInput.disabled = readonly || v === '已读' || v === '未读';
      if (v === '已读') { progInput.value = '100'; paintProg(); }
      if (v === '未读') { progInput.value = '0'; paintProg(); }
    },
  });
  const statusEl = popup.querySelector('.bz-bs-d-status') as HTMLElement;
  statusEl.appendChild(statusChoice.el);
  const progInput = uiRange({ min: 0, max: 100, value: it.progress, disabled: readonly || it.status === '已读' || it.status === '未读' });
  const progNumEl = popup.querySelector('.bz-bs-d-prognum') as HTMLElement;
  const progWrap = popup.querySelector('.bz-bs-d-prog') as HTMLElement;
  function paintProg(): void { progNumEl.textContent = `${Math.round(parseFloat(progInput.value))}%`; }
  progInput.addEventListener('input', paintProg);
  progWrap.appendChild(progInput);
  const reviewEl = popup.querySelector('.bz-bs-d-review') as HTMLTextAreaElement;
  if (readonly) {
    reviewEl.disabled = true;
    statusChoice.el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    progInput.disabled = true;
  }

  // 操作区：删除（md 书）＋ 取消/保存
  const actions = document.createElement('div');
  actions.className = 'bz-bs-d-actions';
  if (!readonly && it.file) {
    const del = document.createElement('button');
    del.className = 'bz-btn bz-btn--ghost bz-bs-d-danger';
    del.type = 'button';
    del.innerHTML = iconSpan('trash-2', 'bz-ic--sm') + '删除';
    del.addEventListener('click', () => {
      const confHtml = `<div class="bz-bs-confirm">
        <div class="bz-bs-confirm-ic">${iconSpan('alert-circle')}</div>
        <p>确定删除《${esc(it.title)}》吗？</p>
        <div class="bz-bs-confirm-sub">书目笔记会被移入回收站，划线等记录一并删除</div>
        <div class="bz-btn-row bz-btn-row--center">
          <button class="bz-btn bz-btn--ghost" data-bs-c="0">取消</button>
          <button class="bz-btn bz-btn--danger" data-bs-c="1">删除</button>
        </div></div>`;
      const conf = uiModal({ content: confHtml, maxWidth: 320, className: 'bz-bs-confirm-pop' });
      mountIcons(conf.popup);
      conf.popup.querySelector('[data-bs-c="1"]')?.addEventListener('click', () => {
        void (async () => {
          try {
            if (it.file) await app.vault.delete(it.file);
            close();
            conf.close();
            await rebuildItems(app);
            renderAll(app);
            notice('已删除', 'success');
          } catch (e) {
            console.error('删除书目失败:', e);
            notice('删除失败', 'error');
          }
        })();
      });
      conf.popup.querySelector('[data-bs-c="0"]')?.addEventListener('click', () => conf.close());
    });
    actions.appendChild(del);
  }
  const spacer = document.createElement('span');
  spacer.className = 'bz-bs-d-spacer';
  actions.appendChild(spacer);
  const cancel = document.createElement('button');
  cancel.className = 'bz-btn bz-btn--ghost';
  cancel.type = 'button';
  cancel.textContent = '取消';
  cancel.addEventListener('click', () => close());
  actions.appendChild(cancel);
  if (!readonly) {
    const save = document.createElement('button');
    save.className = 'bz-btn bz-btn--primary';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', () => {
      void (async () => {
        const status = (statusChoice.el.querySelector('.is-on') as HTMLElement | null)?.dataset.value || it.status;
        const progVal = Math.round(parseFloat(progInput.value) || 0);
        const review = reviewEl.value.trim();
        try {
          await persistBook(it, app, { status, progress: progVal, review });
          close();
          await rebuildItems(app);
          renderAll(app);
          notice('已保存', 'success');
        } catch (e) {
          console.error('保存书目失败:', e);
          notice('保存失败', 'error');
        }
      })();
    });
    actions.appendChild(save);
  }
  popup.appendChild(actions);
  mountIcons(popup);
  bindCoverFallback(popup);
}

/** 落盘语义（md 书）：状态/进度/书评 → frontmatter（已读补 completionDate+readingDate、在读补 readingDate 清 completionDate、未读清两日期归零；书评空删键） */
async function persistBook(
  it: BookshelfItem,
  app: App,
  patch: { status: string; progress: number; review: string },
): Promise<void> {
  if (!it.file) return;
  await app.fileManager.processFrontMatter(it.file, (fm: Record<string, unknown>) => {
    if (patch.status === '已读') {
      fm.readingProgress = 100;
      if (!fm.readingDate) fm.readingDate = todayStr();
      fm.completionDate = fm.completionDate || todayStr();
    } else if (patch.status === '在读') {
      fm.readingProgress = Math.max(1, Math.min(99, patch.progress));
      if (!fm.readingDate) fm.readingDate = todayStr();
      delete fm.completionDate;
    } else {
      fm.readingProgress = 0;
      delete fm.readingDate;
      delete fm.completionDate;
    }
    if (patch.review) fm.bookReview = patch.review;
    else delete fm.bookReview;
  });
  // 同步本地条目（render 前保持一致；重扫由调用方 rebuildItems 兜底）
  it.status = patch.status;
  it.progress = patch.status === '已读' ? 100 : patch.status === '在读' ? Math.min(99, patch.progress) : 0;
  if (patch.status === '已读') {
    if (!it.readingDate) it.readingDate = todayStr();
    it.completionDate = it.completionDate || todayStr();
  } else if (patch.status === '在读') {
    if (!it.readingDate) it.readingDate = todayStr();
    it.completionDate = null;
  } else {
    it.readingDate = null;
    it.completionDate = null;
  }
  if (patch.review) it.bookReview = patch.review;
  else it.bookReview = null;
}

// ---------- 主面板创建 ----------

function openReadingReport(app: App): void {
  (app as any).commands?.executeCommandById?.(REPORT_COMMAND_ID);
}

function iconBtnHTML(icon: string, title: string, toolAttr: string, extraCls = ''): string {
  return `<button class="bz-icon-btn${extraCls ? ' ' + extraCls : ''}" data-bs-tool="${toolAttr}" title="${title}">${iconSpan(icon)}</button>`;
}

export function createOverlay(app: App): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-bs-overlay';
  overlay.style.zIndex = String(allocZ());
  const fullscreen = (tryGetSettings() as Record<string, unknown>).bookshelfMobileDefaultFullscreen === true;

  overlay.innerHTML = `
    <div class="bz-bs-panel">
      <div class="bz-bs-head">
        <div class="bz-bs-title">书架墙<span class="bz-bs-total"></span></div>
        <div class="bz-bs-head-btns">
          ${iconBtnHTML(ICON.report, '阅读分析报告', 'report')}
          ${iconBtnHTML(ICON.search, '搜索', 'search')}
          <button class="bz-icon-btn bz-bs-filterbtn" id="bz-bs-filterbtn" data-bs-tool="filter" title="筛选"></button>
          ${iconBtnHTML(ICON.close, '关闭', 'close')}
        </div>
      </div>
      <div class="bz-bs-searchbar" id="bz-bs-searchbar">
        ${iconSpan('search', 'bz-bs-searchbar-ic')}<input class="bz-input" type="text" id="bz-bs-msearch" placeholder="搜索书名 / 作者 / 分类…" autocomplete="off">
      </div>
      <div class="bz-bs-body">
        <aside class="bz-bs-side">
          <div class="bz-bs-side-label">状态</div>
          <div class="bz-bs-side-list"></div>
          <div class="bz-bs-side-foot">
            <button class="bz-bs-report" data-bs-tool="report" title="阅读分析报告">
              ${iconSpan('bar-chart-3')}<span>阅读分析报告</span>${iconSpan('chevron-right', 'bz-bs-report-chev')}
            </button>
          </div>
        </aside>
        <div class="bz-bs-main">
          <div class="bz-bs-toolbar">
            <span class="bz-bs-search">${iconSpan('search')}<input class="bz-input" type="text" id="bz-bs-dsearch" placeholder="搜索书名 / 作者 / 分类…" autocomplete="off"></span>
            <span class="bz-bs-spacer"></span>
            <span class="bz-bs-sort-slot"></span>
          </div>
          <div class="bz-bs-dash"></div>
          <div class="bz-bs-mcards"></div>
          <div class="bz-bs-shelves"></div>
          <div class="bz-bs-shelves-m"></div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  M.currentOverlay = overlay;
  M.renderFn = () => renderAll(app);
  applyMobileWindowFullscreen(overlay.querySelector('.bz-bs-panel') as HTMLElement, fullscreen);

  // 排序下拉（组件库 uiSelect 工厂；桌面工具栏占位槽）
  const sortSlot = overlay.querySelector('.bz-bs-sort-slot') as HTMLElement;
  const sortSel = uiSelect<SortKey>({
    options: (Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({ value: k, label: SORT_LABEL[k] })),
    value: M.sortMode,
    className: 'bz-bs-sort',
    onChange: (v) => {
      M.sortMode = v;
      renderShelves(app);
    },
  });
  sortSlot.appendChild(sortSel.el);

  // 事件（单一委托）
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // 点遮罩 = 关闭主面板（桌面无关闭钮）
    if (e.target === overlay) { closeOverlay(); return; }
    // 详情弹窗内（uiModal mask 挂在 body，非 overlay 子级）不会被此委托命中
    // 排序下拉（点击开关；菜单由 uiSelect 内部管理）
    if (t.closest('.bz-bs-sort')) return;
    const side = t.closest('[data-bs-side]') as HTMLElement | null;
    if (side) {
      M.side = (side.dataset.bsSide || 'all') as SideId;
      renderSide(); renderShelves(app); paintFilterBtn();
      return;
    }
    // 报告入口（左栏底 + 移动头部图标）
    const tool = t.closest('[data-bs-tool]') as HTMLElement | null;
    if (tool) {
      const kind = tool.dataset.bsTool;
      if (kind === 'report') { openReadingReport(app); return; }
      if (kind === 'search') { toggleMobileSearch(); return; }
      if (kind === 'filter') { openFilterDrawer(app); return; }
      if (kind === 'close') { closeOverlay(); return; }
      return;
    }
    // 书卡 → 详情
    const book = t.closest('[data-bs-id]') as HTMLElement | null;
    if (book) {
      const epub = book.dataset.bsEpub === '1';
      const it = M.items.find((x) => epub ? x.epubVaultPath === book.dataset.bsId : x.file?.path === book.dataset.bsId);
      if (it) openBookDetail(it, app);
      return;
    }
  });

  // 搜索（防抖；桌面 + 移动两个输入框共用同一关键字）
  function bindSearch(input: HTMLInputElement): void {
    input.addEventListener('input', () => {
      if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
      M.searchDebounceTimer = setTimeout(() => {
        M.searchKeyword = input.value.trim();
        renderShelves(app);
      }, 200);
    });
  }
  bindSearch(overlay.querySelector('#bz-bs-dsearch') as HTMLInputElement);
  bindSearch(overlay.querySelector('#bz-bs-msearch') as HTMLInputElement);

  mountIcons(overlay);
  // B8：首扫加载态——rebuild 完成前 shelves 显示占位，防异步读 weave-data 时空白闪烁
  const loadingHtml = `<div class="bz-bs-none">${uiEmpty({ icon: 'loader', title: '正在整理书架…', desc: '' }).outerHTML}</div>`;
  const dEl0 = overlay.querySelector('.bz-bs-shelves') as HTMLElement | null;
  const mEl0 = overlay.querySelector('.bz-bs-shelves-m') as HTMLElement | null;
  if (dEl0) { dEl0.innerHTML = loadingHtml; mountIcons(dEl0); }
  if (mEl0) { mEl0.innerHTML = loadingHtml; mountIcons(mEl0); }
  void rebuildItems(app).then(() => renderAll(app));
}

function toggleMobileSearch(): void {
  const bar = M.currentOverlay?.querySelector('#bz-bs-searchbar') as HTMLElement | null;
  const btn = M.currentOverlay?.querySelector('[data-bs-tool="search"]') as HTMLElement | null;
  if (!bar) return;
  const show = !bar.classList.contains('show');
  bar.classList.toggle('show', show);
  btn?.classList.toggle('on', show);
  if (show) (bar.querySelector('input') as HTMLInputElement)?.focus();
}

export function closeOverlay(): void {
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
  closeDrawer();
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  M.renderFn = null;
}

// ---------- ESC（主面板） ----------

let mainEscRegistered = false;
let mainEscHandle: { unregister: () => void } | null = null;
export function registerEscapeHandler(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  // B1：句柄存模块级，unloadBookshelf 时 unregister（卸载清理闭环）
  mainEscHandle = escManager.register('bz-bookshelf', {
    isVisible: () => !!M.currentOverlay || !!M.drawerEl,
    close: () => {
      if (M.drawerEl) closeDrawer();
      else closeOverlay();
    },
  });
}

/** 注销 ESC 层（卸载时调用；escManager 层不随插件卸载自动清理） */
export function unregisterEscapeHandler(): void {
  if (!mainEscRegistered) return;
  mainEscRegistered = false;
  mainEscHandle?.unregister();
  mainEscHandle = null;
}
