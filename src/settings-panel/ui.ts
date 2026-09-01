/**
 * 设置面板 UI（settings-panel，ADR-0080）
 * 原型 .scratch/global-settings-panel-prototype.html 1:1 复刻（完全自绘，抛弃 Obsidian 原生样式影响）：
 * - 桌面端：B 侧栏工作台（左域导航 + 右内容区直接自绘渲染该域全部设置分组）
 * - 移动端：M1 命令面板（搜索 + 域列表，主面板真全屏 + 关闭按钮）
 * - 域设置内容：数据 = 各域真实 schema（xxxSettingsSchema()，与 ⚙️ 弹窗同源），
 *   视觉 = 自绘渲染器 renderPanelSchema（自绘开关/输入/下拉/滑块/按钮/chips/路径行），
 *   绑定逻辑照抄 core/settings-schema（键直绑 getSettings/saveSettings / 三函数 / visibleWhen / onChange）；
 *   路径行走自绘 chips + openPathPicker（ADR-0061 选择器），不再嵌套原生设置行。
 * - 全局域 → mainSettingsSchema()（AI 服务商 + 数据存储路径）。
 */
import { App, setIcon } from 'obsidian';
import { createOverlay, topifyZ } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { isMobileEnv, applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import type { SettingsSchema } from '../core/settings-schema';
import { renderPanelSchema } from './renderer';
import { notice } from '../core/notice';
import { getApp } from '../core/app';

/* ==================== 域清单（全局 + 20 域） ==================== */

interface DomainDef {
  id: string;
  name: string;
  icon: string; // lucide 图标名（setIcon 用）
  desc: string;
  /** 无任何设置项（聚合讯/做题家等：面板内显示空态） */
  noSettings?: boolean;
  /** 有真实 schema 的域：内嵌渲染（惰性加载） */
  schemaLoader?: () => Promise<SettingsSchema>;
}

/** 惰性 schema 加载器（与各域 ⚙️ 弹窗同源） */
const schemaLoaders: Record<string, () => Promise<SettingsSchema>> = {
  global: async () => (await import('../core/settings-main-schema')).mainSettingsSchema(),
  diary: async () => (await import('../diary/ui/panel')).diarySettingsSchema(),
  memo: async () => (await import('../memo/ui')).memoSettingsSchema(),
  belongings: async () => (await import('../belongings/ui')).belongingSettingsSchema(),
  clipping: async () => (await import('../clipping/view')).clippingSettingsSchema(),
  password: async () => (await import('../password/ui')).passwordSettingsSchema(),
  favorites: async () => (await import('../favorites/ui')).favoritesSettingsSchema(),
  library: async () => (await import('../library/ui')).librarySettingsSchema(),
  movie: async () => (await import('../movie/ui')).movieSettingsSchema(),
  review: async () => {
    const { reviewApp } = await import('../review/app');
    const { reviewSettingsSchema } = await import('../review/ui');
    const app = getApp();
    reviewApp.ensure(app);
    return reviewSettingsSchema({ app, dataManager: reviewApp.dataManager! });
  },
  secondbrain: async () => (await import('../secondbrain/panel')).secondBrainSettingsSchema(),
  pomodoro: async () => (await import('../pomodoro/ui')).pomodoroSettingsSchema(),
  encrypt: async () => (await import('../encrypt/ui')).encryptSettingsSchema(),
  literature: async () => (await import('../literature/ui')).literatureSettingsSchema(),
  smartcat: async () => {
    const { loadSmartCatData } = await import('../smartcat/data');
    const { smartcatSettingsSchema } = await import('../smartcat/ui');
    const app = getApp();
    const data = await loadSmartCatData(app);
    const saveConfig = async (config: unknown): Promise<void> => {
      const { saveSmartCatData } = await import('../smartcat/data');
      data.config = config as never;
      await saveSmartCatData(app, data);
    };
    return smartcatSettingsSchema({
      getConfig: () => data.config,
      saveConfig,
      settingsKeys: {
        enabled: (tryGetSettings() as any).smartcatEnabled !== false,
        mobileFullscreen: (tryGetSettings() as any).smartcatMobileDefaultFullscreen === true,
      },
      setMobileFullscreen: async (v) => {
        (getSettings() as any).smartcatMobileDefaultFullscreen = v;
        await saveSettings();
      },
    });
  },
};

const DOMAINS: DomainDef[] = [
  { id: 'global', name: '全局', icon: 'settings-2', desc: 'AI 服务商、数据存储路径、移动端全屏与入口偏好', schemaLoader: schemaLoaders.global },
  { id: 'diary', name: '日记本', icon: 'notebook', desc: '日记目录、显示与默认视图', schemaLoader: schemaLoaders.diary },
  { id: 'memo', name: '备忘录', icon: 'sticky-note', desc: '提醒与到期行为', schemaLoader: schemaLoaders.memo },
  { id: 'belongings', name: '归物本', icon: 'package', desc: '物品登记与查找', schemaLoader: schemaLoaders.belongings },
  { id: 'clipping', name: '剪藏本', icon: 'scissors', desc: '网页剪藏与聚合讯', schemaLoader: schemaLoaders.clipping },
  { id: 'news', name: '聚合讯', icon: 'rss', desc: '资讯聚合', noSettings: true },
  { id: 'password', name: '密码本', icon: 'key', desc: '账号密码管理', schemaLoader: schemaLoaders.password },
  { id: 'favorites', name: '收藏本', icon: 'star', desc: '收藏条目', schemaLoader: schemaLoaders.favorites },
  { id: 'library', name: '书库', icon: 'library', desc: '藏书与读书笔记', schemaLoader: schemaLoaders.library },
  { id: 'reading-report', name: '阅读报告', icon: 'bar-chart-3', desc: '阅读统计', noSettings: true },
  { id: 'movie', name: '影视', icon: 'film', desc: '影视目录与海报', schemaLoader: schemaLoaders.movie },
  { id: 'review', name: '复习计划', icon: 'calendar', desc: '间隔重复与做题', schemaLoader: schemaLoaders.review },
  { id: 'quiz', name: '做题家', icon: 'brain', desc: '题目练习（并入复习计划）', noSettings: true },
  { id: 'secondbrain', name: '第二大脑', icon: 'brain', desc: '嵌入检索与对话', schemaLoader: schemaLoaders.secondbrain },
  { id: 'auto-summary', name: '自动摘要', icon: 'sparkles', desc: '剪藏自动摘要', noSettings: true },
  { id: 'launcher', name: '入口页', icon: 'layout-grid', desc: '命令磁贴入口', noSettings: true },
  { id: 'pomodoro', name: '番茄钟', icon: 'timer', desc: '专注计时与休息', schemaLoader: schemaLoaders.pomodoro },
  { id: 'attach', name: '附件搬移', icon: 'folder-down', desc: '附件整理', noSettings: true },
  { id: 'bili-downloader', name: 'B站下载', icon: 'download', desc: 'B站视频下载任务', noSettings: true },
  { id: 'encrypt', name: '加密保险箱', icon: 'lock', desc: '加密文件保险箱', schemaLoader: schemaLoaders.encrypt },
  { id: 'smartcat', name: '小橘陪伴猫', icon: 'cat', desc: '桌面宠物陪伴', schemaLoader: schemaLoaders.smartcat },
  { id: 'literature', name: '文献笔记', icon: 'book-open', desc: '文献管理与术语', schemaLoader: schemaLoaders.literature },
];

/** 域名 → 设置组数徽标（桌面侧栏；数据加载后回填） */
const groupCounts = new Map<string, number>();

/* ==================== 面板 UI（桌面 B + 移动 M1） ==================== */

export class SettingsPanelUI {
  private mask: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private escHandle: { unregister: () => void } | null = null;
  private activeDomain = 0;
  /** 保存渲染句柄，域切换时 dispose（防旧句柄 refresh 干扰） */
  private renderHandles: Array<{ refresh: () => void }> = [];

  open(): void {
    if (this.mask && this.popup) {
      topifyZ(this.mask, this.popup);
      this.mask.style.display = 'block';
      this.popup.style.display = 'flex';
      return;
    }
    this.build();
  }

  private build(): void {
    const { mask, popup } = createOverlay({
      maskId: 'bz-settings-panel-mask',
      popupId: 'bz-settings-panel-popup',
      maxWidth: 920,
      onMaskClick: () => this.hide(),
    });
    this.mask = mask;
    this.popup = popup;
    applyMobileWindowFullscreen(popup, tryGetSettings().settingsPanelMobileDefaultFullscreen === true);

    if (isMobileEnv()) {
      this.buildMobile(popup);
    } else {
      this.buildDesktop(popup);
    }

    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = 'block';
    popup.style.display = 'flex';
    topifyZ(mask, popup);

    this.escHandle = escManager.register('bz-settings-panel', {
      isVisible: () => !!this.mask && this.mask.style.display === 'block',
      close: () => this.hide(),
    });
  }

  /* ---------- 桌面：B 侧栏工作台（左导航 + 右内嵌渲染） ---------- */

  private buildDesktop(popup: HTMLElement): void {
    popup.classList.add('bz-sp-desk');
    popup.innerHTML = `
      <div class="bz-sp-desk-side">
        <div class="bz-sp-brand">
          <span class="bz-sp-logo"></span>
          <span class="bz-sp-brand-name">设置</span>
        </div>
        <div class="bz-sp-search">
          <span class="bz-sp-search-ic"></span>
          <input class="bz-sp-search-in" placeholder="搜索设置…" />
        </div>
        <div class="bz-sp-nav"></div>
      </div>
      <div class="bz-sp-desk-main">
        <div class="bz-sp-pane"></div>
      </div>
    `;
    setIcon(popup.querySelector('.bz-sp-logo')!, 'settings-2');
    setIcon(popup.querySelector('.bz-sp-search-ic')!, 'search');

    const nav = popup.querySelector('.bz-sp-nav')!;
    const pane = popup.querySelector('.bz-sp-pane') as HTMLElement;
    const searchIn = popup.querySelector('.bz-sp-search-in') as HTMLInputElement;

    const renderNav = (q: string) => {
      const query = q.trim();
      nav.innerHTML = '';
      DOMAINS.forEach((d, i) => {
        if (query && !d.name.includes(query) && !d.desc.includes(query)) return;
        const b = document.createElement('button');
        b.className = 'bz-sp-nav-item' + (i === this.activeDomain && !query ? ' on' : '');
        b.dataset.i = String(i);
        const ic = document.createElement('span');
        ic.className = 'bz-sp-nav-ic';
        setIcon(ic, d.icon);
        const nm = document.createElement('span');
        nm.className = 'bz-sp-nav-name';
        nm.textContent = d.name;
        b.append(ic, nm);
        // 设置组数徽标（原型 b-ct；数据加载后回填）
        const ct = document.createElement('span');
        ct.className = 'bz-sp-nav-count';
        const n = groupCounts.get(d.id);
        ct.textContent = n !== undefined ? String(n) : '';
        b.appendChild(ct);
        b.addEventListener('click', () => {
          this.activeDomain = i;
          renderNav(searchIn.value);
          void this.renderDomain(pane, d);
        });
        nav.appendChild(b);
      });
    };

    searchIn.addEventListener('input', () => renderNav(searchIn.value));
    renderNav('');
    void this.renderDomain(pane, DOMAINS[this.activeDomain]);
  }

  /**
   * 渲染某域设置到容器：内嵌自绘渲染器（与 ⚙️ 弹窗同数据源，视觉 1:1 原型）。
   * 无 schema 的域显示空态。
   */
  private async renderDomain(pane: HTMLElement, domain: DomainDef): Promise<void> {
    // 清理旧渲染句柄
    this.renderHandles = [];
    pane.innerHTML = '';

    // 无设置项域 → 空态（原型 empty）
    if (domain.noSettings || !domain.schemaLoader) {
      const empty = document.createElement('div');
      empty.className = 'bz-sp-empty';
      empty.innerHTML = `<div class="bz-sp-empty-ic"></div><div class="bz-sp-empty-title">${domain.name} · 暂无设置项</div><div class="bz-sp-empty-desc">该域没有可在此配置的设置（设置就近在对应功能面板）</div>`;
      setIcon(empty.querySelector('.bz-sp-empty-ic')!, 'file-question');
      pane.appendChild(empty);
      return;
    }

    // 惰性加载 schema 并内嵌渲染
    const body = document.createElement('div');
    body.className = 'bz-sp-settings-body';
    pane.appendChild(body);
    const loading = document.createElement('div');
    loading.className = 'bz-sp-loading';
    loading.textContent = '加载设置…';
    body.appendChild(loading);

    try {
      const schema = await domain.schemaLoader();
      loading.remove();
      const handle = renderPanelSchema(body, schema);
      this.renderHandles.push(handle);
      // 回填侧栏徽标（组数 = 可见分组卡片数；mobileFullscreenGroup 组级隐藏不计）
      const groupEls = body.querySelectorAll<HTMLElement>('.bz-sp-group');
      const visible = [...groupEls].filter((g) => g.style.display !== 'none').length;
      groupCounts.set(domain.id, visible);
      navCountRefresh(domain.id);
      // 全部组被门控隐藏（如归物本仅移动端组，桌面无可配置项）→ 空态引导
      if (visible === 0 && groupEls.length > 0) {
        const empty = document.createElement('div');
        empty.className = 'bz-sp-empty';
        empty.innerHTML = `<div class="bz-sp-empty-ic"></div><div class="bz-sp-empty-title">${domain.name} · 暂无设置项</div><div class="bz-sp-empty-desc">该域的设置项仅移动端可见（如移动端默认全屏），桌面端无需配置</div>`;
        setIcon(empty.querySelector('.bz-sp-empty-ic')!, 'smartphone');
        body.appendChild(empty);
      }
      return;
    } catch (e) {
      loading.remove();
      const err = document.createElement('div');
      err.className = 'bz-sp-empty';
      err.innerHTML = `<div class="bz-sp-empty-ic"></div><div class="bz-sp-empty-title">加载失败</div><div class="bz-sp-empty-desc">${(e as Error).message}</div>`;
      setIcon(err.querySelector('.bz-sp-empty-ic')!, 'alert-triangle');
      pane.appendChild(err);
      notice(`加载「${domain.name}」设置失败：${(e as Error).message}`, 'error');
    }
  }

  /* ---------- 移动端：M1 命令面板（搜索 + 域列表 → 域设置弹窗） ---------- */

  private buildMobile(popup: HTMLElement): void {
    popup.classList.add('bz-sp-mobile');
    popup.innerHTML = `
      <div class="bz-sp-mob-head">
        <h2>⚙️ 设置</h2>
        <span class="bz-sp-mob-count">${DOMAINS.length} 域</span>
        <button class="bz-sp-mob-close" title="关闭"></button>
      </div>
      <div class="bz-sp-mob-search">
        <span class="bz-sp-search-ic"></span>
        <input class="bz-sp-search-in" placeholder="搜索设置、域…" />
        <button class="bz-sp-mob-clear" title="清除"></button>
      </div>
      <div class="bz-sp-mob-list"></div>
    `;
    setIcon(popup.querySelector('.bz-sp-mob-search .bz-sp-search-ic')!, 'search');
    setIcon(popup.querySelector('.bz-sp-mob-close')!, 'x');
    setIcon(popup.querySelector('.bz-sp-mob-clear')!, 'x');

    const list = popup.querySelector('.bz-sp-mob-list')!;
    const searchIn = popup.querySelector('.bz-sp-mob-search .bz-sp-search-in') as HTMLInputElement;
    const clearBtn = popup.querySelector('.bz-sp-mob-clear') as HTMLElement;
    const searchWrap = popup.querySelector('.bz-sp-mob-search')!;
    popup.querySelector('.bz-sp-mob-close')!.addEventListener('click', () => this.hide());
    clearBtn.addEventListener('click', () => {
      searchIn.value = '';
      searchWrap.classList.remove('hasval');
      render('');
      searchIn.focus();
    });

    const render = (q: string) => {
      const query = q.trim();
      searchWrap.classList.toggle('hasval', !!query);
      list.innerHTML = '';
      DOMAINS.forEach((d) => {
        if (query && !d.name.includes(query) && !d.desc.includes(query)) return;
        const item = document.createElement('button');
        item.className = 'bz-sp-mob-item';
        const ic = document.createElement('span');
        ic.className = 'bz-sp-mob-ic';
        setIcon(ic, d.icon);
        const t = document.createElement('span');
        t.className = 'bz-sp-mob-t';
        const nm = document.createElement('span');
        nm.className = 'bz-sp-mob-name';
        nm.textContent = d.name;
        const ds = document.createElement('span');
        ds.className = 'bz-sp-mob-desc';
        ds.textContent = d.desc;
        t.append(nm, ds);
        const chev = document.createElement('span');
        chev.className = 'bz-sp-mob-chev';
        chev.textContent = '›';
        item.append(ic, t, chev);
        item.addEventListener('click', () => void this.openMobileDomain(d));
        list.appendChild(item);
      });
      if (!list.children.length) {
        const empty = document.createElement('div');
        empty.className = 'bz-sp-mob-empty';
        empty.textContent = `没有匹配「${query}」的设置或域`;
        list.appendChild(empty);
      }
    };

    searchIn.addEventListener('input', () => render(searchIn.value));
    render('');
  }

  /** 移动端：域设置 → 居中弹窗内嵌渲染（子面板一律弹窗，遮罩点击关闭） */
  private async openMobileDomain(domain: DomainDef): Promise<void> {
    const mask = document.createElement('div');
    mask.className = 'bz-overlay-mask';
    mask.style.display = 'block';
    const popup = document.createElement('div');
    popup.className = 'bz-overlay-popup bz-sp-mob-modal';
    popup.style.display = 'flex';
    popup.style.maxWidth = '560px';
    popup.style.width = 'min(calc(100vw - 32px), 560px)';
    popup.style.maxHeight = '82vh';
    topifyZ(mask, popup);

    const head = document.createElement('div');
    head.className = 'bz-sp-mob-modal-head';
    const title = document.createElement('h3');
    title.className = 'bz-sp-mob-modal-title';
    title.textContent = `${domain.name}设置`;
    const x = document.createElement('button');
    x.className = 'bz-sp-mob-modal-x';
    setIcon(x, 'x');
    x.title = '关闭';
    head.append(title, x);
    popup.appendChild(head);

    const body = document.createElement('div');
    body.className = 'bz-sp-settings-body bz-sp-mob-modal-body';
    popup.appendChild(body);

    const close = () => {
      mask.remove();
      popup.remove();
    };
    x.addEventListener('click', close);
    mask.addEventListener('click', (e) => {
      if (e.target === mask) close();
    });

    document.body.appendChild(mask);
    document.body.appendChild(popup);

    if (domain.noSettings || !domain.schemaLoader) {
      const empty = document.createElement('div');
      empty.className = 'bz-sp-empty';
      empty.innerHTML = `<div class="bz-sp-empty-ic"></div><div class="bz-sp-empty-title">${domain.name} · 暂无设置项</div><div class="bz-sp-empty-desc">该域没有可在此配置的设置</div>`;
      setIcon(empty.querySelector('.bz-sp-empty-ic')!, 'file-question');
      body.appendChild(empty);
      return;
    }

    const loading = document.createElement('div');
    loading.className = 'bz-sp-loading';
    loading.textContent = '加载设置…';
    body.appendChild(loading);
    try {
      const schema = await domain.schemaLoader();
      loading.remove();
      renderPanelSchema(body, schema);
    } catch (e) {
      loading.remove();
      const err = document.createElement('div');
      err.className = 'bz-sp-empty';
      err.innerHTML = `<div class="bz-sp-empty-ic"></div><div class="bz-sp-empty-title">加载失败</div><div class="bz-sp-empty-desc">${(e as Error).message}</div>`;
      setIcon(err.querySelector('.bz-sp-empty-ic')!, 'alert-triangle');
      body.appendChild(err);
    }
  }

  hide(): void {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  cleanup(): void {
    if (this.escHandle) {
      this.escHandle.unregister();
      this.escHandle = null;
    }
    if (this.mask) {
      this.mask.remove();
      this.mask = null;
    }
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
    this.renderHandles = [];
  }
}

/** 侧栏导航徽标刷新（桌面端；指定域或全部） */
export function navCountRefresh(domainId?: string): void {
  document.querySelectorAll<HTMLElement>('.bz-sp-nav-item').forEach((b) => {
    const id = DOMAINS[Number(b.dataset.i)]?.id;
    if (!id || (domainId && id !== domainId)) return;
    const ct = b.querySelector('.bz-sp-nav-count');
    const n = groupCounts.get(id);
    if (ct) ct.textContent = n !== undefined ? String(n) : '';
  });
}
