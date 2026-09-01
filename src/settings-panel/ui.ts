/**
 * 设置面板 UI（settings-panel，ADR-0080）
 * 原型 .scratch/global-settings-panel-prototype.html 1:1 复刻（完全自绘，抛弃 Obsidian 原生样式影响）：
 * - 桌面端：B 侧栏工作台（左域导航 + 右内容区直接自绘渲染该域全部设置分组）
 * - 移动端：M1 命令面板（搜索 + 域列表，主面板真全屏 + 关闭按钮）
 * - 域设置内容：数据 = 各域真实 schema（xxxSettingsSchema()，与 ⚙️ 弹窗同源），
 *   视觉 = 自绘渲染器 renderPanelSchema（自绘开关/输入/下拉/滑块/按钮/chips/路径行），
 *   绑定逻辑照抄 core/settings-schema（键直绑 getSettings/saveSettings / 三函数 / visibleWhen / onChange）；
 *   路径行走自绘 chips + openPathPicker（ADR-0061 选择器），不再嵌套原生设置行。
 * - 图标系统 1:1 原型：域列表/分组卡/头部 logo/搜索/弹窗标题全部用 emoji（原型 DOMAINS 同款），
 *   桌面导航徽标静态预填（deep 域=组数 / 无设置=— / 其余=·）。
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

/* ==================== 域清单（全局 + 20 域；原型 DOMAINS 1:1） ==================== */

interface DomainDef {
  id: string;
  name: string;
  /** 列表/头部 emoji 图标（原型 .b-ic/.m1-ic） */
  icon: string;
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

/** 域清单（原型 DOMAINS 1:1：emoji 图标；徽标运行时动态计算，见 DomainDef.badge 注释） */
const DOMAINS: DomainDef[] = [
  { id: 'global', name: '全局', icon: '⚙️', desc: 'AI、存储路径、移动端全屏与入口偏好', schemaLoader: schemaLoaders.global },
  { id: 'diary', name: '日记本', icon: '📖', desc: '日记目录、显示与默认视图', schemaLoader: schemaLoaders.diary },
  { id: 'memo', name: '备忘录', icon: '📝', desc: '提醒与到期行为', schemaLoader: schemaLoaders.memo },
  { id: 'belongings', name: '归物本', icon: '📦', desc: '物品登记与查找', schemaLoader: schemaLoaders.belongings },
  { id: 'clipping', name: '剪藏本', icon: '📰', desc: '网页剪藏与聚合讯', schemaLoader: schemaLoaders.clipping },
  { id: 'news', name: '聚合讯', icon: '📡', desc: '资讯聚合', noSettings: true },
  { id: 'password', name: '密码本', icon: '🔐', desc: '账号密码管理', schemaLoader: schemaLoaders.password },
  { id: 'favorites', name: '收藏本', icon: '⭐', desc: '收藏条目', schemaLoader: schemaLoaders.favorites },
  { id: 'library', name: '书库', icon: '📚', desc: '藏书与读书笔记', schemaLoader: schemaLoaders.library },
  { id: 'reading-report', name: '阅读报告', icon: '📈', desc: '阅读统计', noSettings: true },
  { id: 'movie', name: '影视', icon: '🎬', desc: '影视目录与海报', schemaLoader: schemaLoaders.movie },
  { id: 'review', name: '复习计划', icon: '🔁', desc: '间隔重复与做题', schemaLoader: schemaLoaders.review },
  { id: 'quiz', name: '做题家', icon: '🧠', desc: '题目练习（并入复习计划）', noSettings: true },
  { id: 'secondbrain', name: '第二大脑', icon: '🧠', desc: '嵌入检索与对话', schemaLoader: schemaLoaders.secondbrain },
  { id: 'auto-summary', name: '自动摘要', icon: '✨', desc: '剪藏自动摘要', noSettings: true },
  { id: 'launcher', name: '入口页', icon: '🧩', desc: '命令磁贴入口', noSettings: true },
  { id: 'pomodoro', name: '番茄钟', icon: '🍅', desc: '专注计时与休息', schemaLoader: schemaLoaders.pomodoro },
  { id: 'attach', name: '附件搬移', icon: '📎', desc: '附件整理', noSettings: true },
  { id: 'bili-downloader', name: 'B站下载', icon: '📥', desc: 'B站视频下载任务', noSettings: true },
  { id: 'encrypt', name: '加密保险箱', icon: '🔏', desc: '加密文件保险箱', schemaLoader: schemaLoaders.encrypt },
  { id: 'smartcat', name: '小橘陪伴猫', icon: '🐱', desc: '桌面宠物陪伴', noSettings: true },
  { id: 'literature', name: '文献笔记', icon: '📑', desc: '文献管理与术语', schemaLoader: schemaLoaders.literature },
];

/** 已加载域的 schema 行缓存（移动端搜索「设置项」段用：域名 → 行名/描述列表） */
const schemaRowCache = new Map<string, Array<{ name: string; desc: string }>>();

/** 导航徽标运行时值（域 id → 徽标文案）：初始 ·；noSettings 域 —；schema 加载后回填可见组数。
 *  动态计算：设置项/分组随 schema 增删或 visibleWhen 门控变化后，徽标自动跟随。 */
const navBadges = new Map<string, string>();

function badgeOf(d: DomainDef): string {
  if (d.noSettings || !d.schemaLoader) return '—';
  return navBadges.get(d.id) ?? '·';
}

/* ==================== 面板 UI（桌面 B + 移动 M1） ==================== */

export class SettingsPanelUI {
  private mask: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private escHandle: { unregister: () => void } | null = null;
  private activeDomain = 0;
  /** 桌面导航容器引用（schema 加载后回填徽标用） */
  private navEl: HTMLElement | null = null;
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
          <span class="bz-sp-logo">⚙️</span>
          <span class="bz-sp-brand-name">设置</span>
        </div>
        <div class="bz-sp-search">
          <span class="bz-sp-search-ic">🔍</span>
          <input class="bz-sp-search-in" placeholder="搜索设置…" />
        </div>
        <div class="bz-sp-nav"></div>
      </div>
      <div class="bz-sp-desk-main">
        <div class="bz-sp-pane"></div>
      </div>
    `;

    const nav = popup.querySelector('.bz-sp-nav') as HTMLElement;
    this.navEl = nav;
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
        ic.textContent = d.icon; // emoji（原型 .b-ic）
        const nm = document.createElement('span');
        nm.className = 'bz-sp-nav-name';
        nm.textContent = d.name;
        b.append(ic, nm);
        // 动态徽标（原型 .b-ct）：·/—/可见组数，随 schema 加载与显隐门控回填
        const ct = document.createElement('span');
        ct.className = 'bz-sp-nav-count';
        ct.textContent = badgeOf(d);
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
    // 打开即预加载全部域 schema 元数据（仅取分组结构，不渲染 UI）→ 左侧徽标全量动态计算
    void this.preloadAllBadges();
  }

  /**
   * 预加载全部有 schema 的域，回填左侧导航徽标（可见分组数）。
   * 面板打开即算全量徽标（用户拍板：日记本 4 个/备忘录 N 个/购物本无等，无需先点击各域）。
   * 只调用 schemaLoader 取 groups 结构，不渲染 UI；副作用与点击加载一致（review.ensure 幂等）。
   * 组级 visibleWhen 门控（如移动端组）按当前端环境过滤：桌面端不计移动端组。
   */
  private async preloadAllBadges(): Promise<void> {
    const tasks = DOMAINS.filter((d) => d.schemaLoader).map(async (d) => {
      try {
        const schema = await d.schemaLoader!();
        // 组级门控过滤：visibleWhen 求值（isMobileEnv 等）为 false 的组不计入徽标
        const visibleCount = schema.groups.filter((g) => {
          const vw = (g as { visibleWhen?: (s: unknown) => boolean }).visibleWhen;
          if (!vw) return true;
          try {
            return vw(tryGetSettings() as unknown as never);
          } catch {
            return true; // 求值异常视为可见（保守）
          }
        }).length;
        navBadges.set(d.id, visibleCount > 0 ? String(visibleCount) : '·');
        // 顺带填充移动端搜索「设置项」缓存
        const rowsOf = schema.groups.flatMap((g) =>
          g.rows.map((r) => ({ name: (r as { name?: string }).name ?? '', desc: (r as { desc?: string }).desc ?? '' }))
        );
        schemaRowCache.set(d.id, rowsOf);
      } catch {
        navBadges.set(d.id, '·'); // 加载失败保守显示占位
      }
      this.refreshNavBadges();
    });
    await Promise.allSettled(tasks);
  }

  /** 重绘桌面导航徽标（schema 加载/组数变化后调用；不重建导航项，只刷数字） */
  private refreshNavBadges(): void {
    if (!this.navEl) return;
    this.navEl.querySelectorAll<HTMLElement>('.bz-sp-nav-item').forEach((b) => {
      const i = Number(b.dataset.i);
      const d = DOMAINS[i];
      if (!d) return;
      const ct = b.querySelector('.bz-sp-nav-count');
      if (ct) ct.textContent = badgeOf(d);
    });
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
      empty.innerHTML = `<div class="bz-sp-empty-ic">🫙</div><div class="bz-sp-empty-title">${domain.name} · 暂无设置项</div><div class="bz-sp-empty-desc">该域没有可在此配置的设置（设置就近在对应功能面板）</div>`;
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
      // 记录本域 schema 行（移动端搜索「设置项」段用）
      const rowsOf = schema.groups.flatMap((g) =>
        g.rows.map((r) => ({ name: (r as { name?: string }).name ?? '', desc: (r as { desc?: string }).desc ?? '' }))
      );
      schemaRowCache.set(domain.id, rowsOf);
      // 回填导航徽标：可见分组数（组级 visibleWhen 门控隐藏的组不计，如移动端组桌面不计）——
      // 动态计算，随 schema 与当前端环境（桌面/移动）变化；0 组显示 ·（有 schema 但全被门控隐藏）
      const groupEls = body.querySelectorAll<HTMLElement>('.bz-sp-group');
      const visibleGroups = [...groupEls].filter((g) => g.style.display !== 'none').length;
      navBadges.set(domain.id, visibleGroups > 0 ? String(visibleGroups) : '·');
      this.refreshNavBadges();
      // 全部组被门控隐藏（如归物本仅移动端组，桌面无可配置项）→ 空态引导
      if (visibleGroups === 0 && groupEls.length > 0) {
        const empty = document.createElement('div');
        empty.className = 'bz-sp-empty';
        empty.innerHTML = `<div class="bz-sp-empty-ic">📱</div><div class="bz-sp-empty-title">${domain.name} · 暂无设置项</div><div class="bz-sp-empty-desc">该域的设置项仅移动端可见（如移动端默认全屏），桌面端无需配置</div>`;
        body.appendChild(empty);
      }
      return;
    } catch (e) {
      loading.remove();
      const err = document.createElement('div');
      err.className = 'bz-sp-empty';
      err.innerHTML = `<div class="bz-sp-empty-ic">⚠️</div><div class="bz-sp-empty-title">加载失败</div><div class="bz-sp-empty-desc">${(e as Error).message}</div>`;
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
        <button class="bz-sp-mob-close" title="关闭">✕</button>
      </div>
      <div class="bz-sp-mob-search">
        <span class="bz-sp-search-ic">⌕</span>
        <input class="bz-sp-search-in" placeholder="搜索设置、域…" />
        <button class="bz-sp-mob-clear" title="清除">✕</button>
      </div>
      <div class="bz-sp-mob-list"></div>
    `;

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
      if (!query) {
        // 无搜索：全部域（原型 draw('') 分支）
        DOMAINS.forEach((d) => {
          list.appendChild(mobItem(d));
        });
        return;
      }
      // 搜索：域段 + 设置项段（原型 m1-sec 两段）
      const doms = DOMAINS.filter((d) => d.name.includes(query) || d.desc.includes(query));
      const rows: Array<{ icon: string; name: string; desc: string; domain: DomainDef }> = [];
      schemaRowCache.forEach((rowsOf, did) => {
        const d = DOMAINS.find((x) => x.id === did);
        if (!d) return;
        rowsOf.forEach((r) => {
          if (r.name.includes(query) || (r.desc && r.desc.includes(query))) {
            rows.push({ icon: d.icon, name: r.name, desc: r.desc || d.name, domain: d });
          }
        });
      });
      let html = '';
      if (doms.length) {
        html += `<div class="bz-sp-mob-sec">域（${doms.length}）</div>`;
        doms.forEach((d) => {
          html += mobItem(d).outerHTML;
        });
      }
      if (rows.length) {
        html += `<div class="bz-sp-mob-sec">设置项（${rows.length}）</div>`;
        rows.forEach((r) => {
          const item = document.createElement('button');
          item.className = 'bz-sp-mob-item';
          const ic = document.createElement('span');
          ic.className = 'bz-sp-mob-ic';
          ic.textContent = r.icon;
          const t = document.createElement('span');
          t.className = 'bz-sp-mob-t';
          const nm = document.createElement('span');
          nm.className = 'bz-sp-mob-name';
          nm.textContent = r.name;
          const ds = document.createElement('span');
          ds.className = 'bz-sp-mob-desc';
          ds.textContent = `${r.domain.name} · ${r.desc}`;
          t.append(nm, ds);
          const kind = document.createElement('span');
          kind.className = 'bz-sp-mob-kind';
          kind.textContent = '设置';
          item.append(ic, t, kind);
          item.addEventListener('click', () => void this.openMobileDomain(r.domain));
          html += item.outerHTML;
        });
      }
      if (!doms.length && !rows.length) {
        html = `<div class="bz-sp-mob-empty">没有匹配「${query}」的设置或域</div>`;
      }
      list.innerHTML = html;
    };

    /** 构造移动端域行（原型 .m1-item：emoji 图标 + 名称 + 描述 + ›） */
    const mobItem = (d: DomainDef): HTMLElement => {
      const item = document.createElement('button');
      item.className = 'bz-sp-mob-item';
      const ic = document.createElement('span');
      ic.className = 'bz-sp-mob-ic';
      ic.textContent = d.icon; // emoji（原型 .m1-ic）
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
      return item;
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
    // 弹窗标题带 emoji（原型 .m1-modal-title：`${domain.icon} ${domain.name}`）
    title.textContent = `${domain.icon} ${domain.name}`;
    const x = document.createElement('button');
    x.className = 'bz-sp-mob-modal-x';
    x.textContent = '✕';
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
      empty.innerHTML = `<div class="bz-sp-empty-ic">🫙</div><div class="bz-sp-empty-title">${domain.name} · 暂无设置项</div><div class="bz-sp-empty-desc">该域没有可在此配置的设置</div>`;
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
      // 记录本域 schema 行（移动端搜索「设置项」段用；与桌面 renderDomain 同口径）
      const rowsOf = schema.groups.flatMap((g) =>
        g.rows.map((r) => ({ name: (r as { name?: string }).name ?? '', desc: (r as { desc?: string }).desc ?? '' }))
      );
      schemaRowCache.set(domain.id, rowsOf);
      // 回填导航徽标（移动端列表无徽标展示，但保持与桌面一致的状态缓存）
      const groupEls = body.querySelectorAll<HTMLElement>('.bz-sp-group');
      const visibleGroups = [...groupEls].filter((g) => g.style.display !== 'none').length;
      navBadges.set(domain.id, visibleGroups > 0 ? String(visibleGroups) : '·');
    } catch (e) {
      loading.remove();
      const err = document.createElement('div');
      err.className = 'bz-sp-empty';
      err.innerHTML = `<div class="bz-sp-empty-ic">⚠️</div><div class="bz-sp-empty-title">加载失败</div><div class="bz-sp-empty-desc">${(e as Error).message}</div>`;
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
    this.navEl = null;
    // 徽标/行缓存随面板销毁清空（下次打开重新动态计算）
    navBadges.clear();
    schemaRowCache.clear();
  }
}
