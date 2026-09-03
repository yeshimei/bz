/**
 * 设置面板 UI（settings-panel，ADR-0080）
 * 新体系组件库版（铁律 6 收编：按钮/输入/开关/下拉/chip/空态等全部消费 src/core/ui；
 * 图标一律 lucide，禁止 emoji 当图标）：
 * - 桌面端：B 侧栏工作台 = 影院式整宽头行（仅标题「设置」，占满 100% 宽）
 *   + 左域导航 + 右内容区内嵌渲染该域全部设置分组；遮罩/ESC 关闭（头行无关闭钮）
 * - 移动端：M1 命令面板（搜索 + 域列表，主面板真全屏 + 头行关闭按钮）
 * - 域设置内容：数据 = 各域真实 schema（xxxSettingsSchema()，与 ⚙️ 弹窗同源），
 *   视觉 = 渲染器 renderPanelSchema（组件库控件），绑定逻辑与 ⚙️ 弹窗同一套
 *   （键直绑 getSettings/saveSettings / 三函数 / visibleWhen / onChange）；
 *   路径行走 uiChip 路径胶囊 + openPathPicker（ADR-0061 选择器）。
 * - 桌面导航徽标动态计算（无设置=— / 其余初始=·，schema 加载后回填设置项总数）。
 * - 通用域/AI 域 → generalSettingsSchema()/aiSettingsSchema()（issue 186：AI 自全局拆出独立成域）。
 */
import type { App } from 'obsidian';
import { setIcon } from 'obsidian';
import { createOverlay, topifyZ } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { isMobileEnv, applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import type { SettingsSchema } from '../core/settings-schema';
import { renderPanelSchema } from './renderer';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { uiIcon, uiIconBtn, uiEmpty } from '../core/ui';

/* ==================== 域清单（全局 + 20 域；图标 = lucide 名） ==================== */

interface DomainDef {
  id: string;
  name: string;
  /** 列表/头部图标（lucide 名，经 setIcon 渲染；对应原型 emoji 图标位） */
  icon: string;
  desc: string;
  /** 无任何设置项（聚合讯/做题家等：面板内显示空态） */
  noSettings?: boolean;
  /** 有真实 schema 的域：内嵌渲染（惰性加载） */
  schemaLoader?: () => Promise<SettingsSchema>;
}

/** 惰性 schema 加载器（与各域 ⚙️ 弹窗同源） */
const schemaLoaders: Record<string, () => Promise<SettingsSchema>> = {
  general: async () => (await import('../core/settings-main-schema')).generalSettingsSchema(),
  ai: async () => (await import('../core/settings-main-schema')).aiSettingsSchema(),
  diary: async () => (await import('../diary/ui/panel')).diarySettingsSchema(),
  memo: async () => (await import('../memo/ui')).memoSettingsSchema(),
  todo: async () => (await import('../todo/settings')).todoSettingsSchema(),
  belongings: async () => (await import('../belongings/ui')).belongingSettingsSchema(),
  clipping: async () => (await import('../clipbook/ui')).clipbookSettingsSchema(),
  favorites: async () => (await import('../favorites/ui')).favoritesSettingsSchema(),
  library: async () => (await import('../library/ui')).librarySettingsSchema(),
  cinema: async () => (await import('../cinema/settings')).cinemaSettingsSchema(),
  bookshelf: async () => (await import('../bookshelf/settings')).bookshelfSettingsSchema(),
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

/** 域清单（lucide 图标名；徽标运行时动态计算，见 badgeOf） */
const DOMAINS: DomainDef[] = [
  { id: 'global', name: '通用', icon: 'settings', desc: '存储路径等跨域基础偏好', schemaLoader: schemaLoaders.general },
  { id: 'ai', name: 'AI', icon: 'sparkles', desc: 'AI 服务商与模型配置', schemaLoader: schemaLoaders.ai },
  { id: 'diary', name: '日记本', icon: 'book-open', desc: '日记目录、显示与默认视图', schemaLoader: schemaLoaders.diary },
  { id: 'memo', name: '备忘录', icon: 'sticky-note', desc: '提醒与到期行为', schemaLoader: schemaLoaders.memo },
  { id: 'todo', name: '待办', icon: 'check-square', desc: '备忘工作台（新域）', schemaLoader: schemaLoaders.todo },
  { id: 'belongings', name: '归物本', icon: 'package', desc: '物品登记与查找', schemaLoader: schemaLoaders.belongings },
  { id: 'clipping', name: '剪藏本', icon: 'scissors', desc: '聚合讯未读流与剪藏笔记（融合域 ADR-0082）', schemaLoader: schemaLoaders.clipping },
  { id: 'favorites', name: '收藏本', icon: 'star', desc: '收藏条目', schemaLoader: schemaLoaders.favorites },
  { id: 'library', name: '书库', icon: 'library', desc: '藏书与读书笔记', schemaLoader: schemaLoaders.library },
  { id: 'reading-report', name: '阅读报告', icon: 'bar-chart-3', desc: '阅读统计', noSettings: true },

  { id: 'cinema', name: '影院', icon: 'clapperboard', desc: '影视目录与海报（ADR-0087 接管影视）', schemaLoader: schemaLoaders.cinema },
  { id: 'bookshelf', name: '书架墙', icon: 'book-open', desc: '藏书封面墙（新域）', schemaLoader: schemaLoaders.bookshelf },
  { id: 'review', name: '复习计划', icon: 'repeat-2', desc: '间隔重复与做题', schemaLoader: schemaLoaders.review },
  { id: 'secondbrain', name: '第二大脑', icon: 'network', desc: '嵌入检索与对话', schemaLoader: schemaLoaders.secondbrain },
  { id: 'auto-summary', name: '自动摘要', icon: 'sparkles', desc: '剪藏自动摘要', noSettings: true },
  { id: 'launcher', name: '入口页', icon: 'puzzle', desc: '命令磁贴入口', noSettings: true },
  { id: 'home', name: '内容首页', icon: 'layout-grid', desc: '统计域卡首页（新域）', noSettings: true },
  { id: 'pomodoro', name: '番茄钟', icon: 'timer', desc: '专注计时与休息', schemaLoader: schemaLoaders.pomodoro },
  { id: 'attach', name: '附件搬移', icon: 'paperclip', desc: '附件整理', noSettings: true },
  { id: 'bili-downloader', name: 'B站下载', icon: 'download', desc: 'B站视频下载任务', noSettings: true },
  { id: 'encrypt', name: '保险库', icon: 'lock', desc: '密码·加密笔记·日记（统一域 ADR-0085）', schemaLoader: schemaLoaders.encrypt },
  { id: 'smartcat', name: '小橘陪伴猫', icon: 'cat', desc: '桌面宠物陪伴', noSettings: true },
  { id: 'literature', name: '文献笔记', icon: 'file-text', desc: '文献管理与术语', schemaLoader: schemaLoaders.literature },
];

/** 可见域：无设置项的域（noSettings）不在左侧列表/移动端列表显示（用户拍板：没有设置的域隐藏）。
 *  搜索同样只搜可见域（隐藏的域没有可配置项，不占列表位）。 */
const visibleDomains = (): DomainDef[] => DOMAINS.filter((d) => !d.noSettings);

/** 已加载域的 schema 行缓存（移动端搜索「设置项」段用：域名 → 行名/描述列表） */
const schemaRowCache = new Map<string, Array<{ name: string; desc: string }>>();

/** 导航徽标运行时值（域 id → 徽标文案）：初始 ·；noSettings 域 —；schema 加载后回填设置项总数。
 *  动态计算：设置项随 schema 增删或 visibleWhen 门控变化后，徽标自动跟随。 */
const navBadges = new Map<string, string>();

function badgeOf(d: DomainDef): string {
  if (d.noSettings || !d.schemaLoader) return '—';
  return navBadges.get(d.id) ?? '·';
}

/** 可见设置项总数（issue 186 徽标口径 = 设置项数，非分组数）：
 *  组级/行级 visibleWhen 求值 false 的不计（求值异常保守视为可见）；
 *  button 操作行不计——与分组卡「N 项」徽标同口径。 */
function visibleItemCount(schema: SettingsSchema): number {
  let n = 0;
  for (const g of schema.groups) {
    const gvw = (g as { visibleWhen?: (s: unknown) => boolean }).visibleWhen;
    if (gvw) {
      try {
        if (!gvw(tryGetSettings() as unknown as never)) continue;
      } catch {
        /* 求值异常视为可见 */
      }
    }
    for (const r of g.rows) {
      if (r.type === 'button') continue;
      const rvw = (r as { visibleWhen?: (s: unknown) => boolean }).visibleWhen;
      if (rvw) {
        try {
          if (!rvw(tryGetSettings() as unknown as never)) continue;
        } catch {
          /* 求值异常视为可见 */
        }
      }
      n++;
    }
  }
  return n;
}

/* ==================== 面板 UI（桌面 B + 移动 M1） ==================== */

export class SettingsPanelUI {
  private mask: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private escHandle: { unregister: () => void } | null = null;
  /** 当前激活域 id（按 id 驱动：可见域过滤后索引会错位，不用数字下标） */
  private activeDomainId = 'global';
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

  /* ---------- 头行（影院式：整宽、仅标题；关闭靠遮罩/ESC） ---------- */

  private buildHeadHtml(): string {
    // 桌面：只有标题（占满整宽的头条）；关闭钮由移动端 build 追加到 .bz-sp-head-tools
    return `<div class="bz-sp-head"><span class="bz-sp-head-title">设置</span><span class="bz-sp-head-tools"></span></div>`;
  }

  /* ---------- 桌面：B 侧栏工作台（头行 + 左导航 + 右内嵌渲染） ---------- */

  private buildDesktop(popup: HTMLElement): void {
    popup.classList.add('bz-sp-desk');
    popup.innerHTML = `
      ${this.buildHeadHtml()}
      <div class="bz-sp-desk-body">
        <div class="bz-sp-desk-side">
          <div class="bz-sp-search">
            <span class="bz-input-wrap"><i class="bz-ic"></i><input class="bz-input" placeholder="搜索设置…" /></span>
          </div>
          <div class="bz-sp-nav"></div>
        </div>
        <div class="bz-sp-desk-main">
          <div class="bz-sp-pane"></div>
        </div>
      </div>
    `;

    const searchIcon = popup.querySelector('.bz-sp-search .bz-ic') as HTMLElement;
    setIcon(searchIcon, 'search');
    const nav = popup.querySelector('.bz-sp-nav') as HTMLElement;
    this.navEl = nav;
    const pane = popup.querySelector('.bz-sp-pane') as HTMLElement;
    const searchIn = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;

    const renderNav = (q: string) => {
      const query = q.trim();
      nav.innerHTML = '';
      // 无设置项的域不在左侧列表显示（用户拍板）；搜索同样只搜可见域
      visibleDomains().forEach((d) => {
        if (query && !d.name.includes(query) && !d.desc.includes(query)) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bz-sp-nav-item' + (d.id === this.activeDomainId && !query ? ' on' : '');
        b.dataset.d = d.id;
        const ic = uiIcon(d.icon);
        ic.classList.add('bz-sp-nav-ic');
        const nm = document.createElement('span');
        nm.className = 'bz-sp-nav-name';
        nm.textContent = d.name;
        b.append(ic, nm);
        // 动态徽标（·/—/设置项总数，随 schema 加载与显隐门控回填）
        const ct = document.createElement('span');
        ct.className = 'bz-sp-nav-count';
        ct.textContent = badgeOf(d);
        b.appendChild(ct);
        b.addEventListener('click', () => {
          this.activeDomainId = d.id;
          renderNav(searchIn.value);
          void this.renderDomain(pane, d);
        });
        nav.appendChild(b);
      });
    };

    searchIn.addEventListener('input', () => renderNav(searchIn.value));
    renderNav('');
    void this.renderDomain(pane, DOMAINS.find((x) => x.id === this.activeDomainId) ?? DOMAINS[0]);
    // 打开即预加载全部域 schema 元数据（仅取分组结构，不渲染 UI）→ 左侧徽标全量动态计算
    void this.preloadAllBadges();
  }

  /**
   * 预加载全部有 schema 的域，回填左侧导航徽标（设置项总数）。
   * 面板打开即算全量徽标（用户拍板：无需先点击各域）。
   * 只调用 schemaLoader 取结构，不渲染 UI；副作用与点击加载一致（review.ensure 幂等）。
   * 组级/行级 visibleWhen 门控（如移动端组）按当前端环境过滤。
   */
  private async preloadAllBadges(): Promise<void> {
    const tasks = DOMAINS.filter((d) => d.schemaLoader).map(async (d) => {
      try {
        const schema = await d.schemaLoader!();
        const count = visibleItemCount(schema);
        navBadges.set(d.id, count > 0 ? String(count) : '·');
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
      const d = DOMAINS.find((x) => x.id === b.dataset.d);
      if (!d) return;
      const ct = b.querySelector('.bz-sp-nav-count');
      if (ct) ct.textContent = badgeOf(d);
    });
  }

  /** 空态构建（组件库 uiEmpty：图标 lucide + 标题 + 描述） */
  private emptyEl(icon: string, title: string, desc: string): HTMLElement {
    return uiEmpty({ icon, title, desc });
  }

  /** 加载态（spinner + 文案） */
  private loadingEl(): HTMLElement {
    const loading = document.createElement('div');
    loading.className = 'bz-sp-loading';
    const sp = document.createElement('span');
    sp.className = 'bz-spinner';
    const tx = document.createElement('span');
    tx.textContent = '加载设置…';
    loading.append(sp, tx);
    return loading;
  }

  /**
   * 渲染某域设置到容器：内嵌渲染器（与 ⚙️ 弹窗同数据源）。
   * 无 schema 的域显示空态。
   */
  private async renderDomain(pane: HTMLElement, domain: DomainDef): Promise<void> {
    // 清理旧渲染句柄
    this.renderHandles = [];
    pane.innerHTML = '';

    // 无设置项域 → 空态
    if (domain.noSettings || !domain.schemaLoader) {
      pane.appendChild(this.emptyEl(
        'settings',
        `${domain.name} · 暂无设置项`,
        '该域没有可在此配置的设置（设置就近在对应功能面板）'
      ));
      return;
    }

    // 惰性加载 schema 并内嵌渲染
    const body = document.createElement('div');
    body.className = 'bz-sp-settings-body';
    pane.appendChild(body);
    body.appendChild(this.loadingEl());

    try {
      const schema = await domain.schemaLoader();
      body.innerHTML = '';
      const handle = renderPanelSchema(body, schema);
      this.renderHandles.push(handle);
      // 记录本域 schema 行（移动端搜索「设置项」段用）
      const rowsOf = schema.groups.flatMap((g) =>
        g.rows.map((r) => ({ name: (r as { name?: string }).name ?? '', desc: (r as { desc?: string }).desc ?? '' }))
      );
      schemaRowCache.set(domain.id, rowsOf);
      // 回填导航徽标：设置项总数（visibleWhen 门控隐藏的不计、button 操作行不计，与 preload 同口径）；
      // 0 项显示 ·（有 schema 但全被门控隐藏）
      const groupEls = body.querySelectorAll<HTMLElement>('.bz-sp-group');
      const visibleGroups = [...groupEls].filter((g) => g.style.display !== 'none').length;
      const count = visibleItemCount(schema);
      navBadges.set(domain.id, count > 0 ? String(count) : '·');
      this.refreshNavBadges();
      // 全部组被门控隐藏（如归物本仅移动端组，桌面无可配置项）→ 空态引导
      if (visibleGroups === 0 && groupEls.length > 0) {
        body.appendChild(this.emptyEl(
          'smartphone',
          `${domain.name} · 暂无设置项`,
          '该域的设置项仅移动端可见（如移动端默认全屏），桌面端无需配置'
        ));
      }
      return;
    } catch (e) {
      body.innerHTML = '';
      body.appendChild(this.emptyEl(
        'alert-circle',
        '加载失败',
        (e as Error).message
      ));
      notice(`加载「${domain.name}」设置失败：${(e as Error).message}`, 'error');
    }
  }

  /* ---------- 移动端：M1 命令面板（头行 + 搜索 + 域列表 → 域设置弹窗） ---------- */

  private buildMobile(popup: HTMLElement): void {
    popup.classList.add('bz-sp-mobile');
    popup.innerHTML = `
      <div class="bz-sp-head">
        <span class="bz-sp-head-title">设置</span>
        <span class="bz-sp-head-tools"></span>
      </div>
      <div class="bz-sp-mob-search">
        <span class="bz-input-wrap"><i class="bz-ic"></i><input class="bz-input" placeholder="搜索设置、域…" /></span>
      </div>
      <div class="bz-sp-mob-list"></div>
    `;

    // 头行工具（移动端：关闭钮）
    const tools = popup.querySelector('.bz-sp-head-tools') as HTMLElement;
    tools.appendChild(uiIconBtn({ icon: 'x', lg: true, title: '关闭', className: 'bz-sp-mob-close', onClick: () => this.hide() }));

    const list = popup.querySelector('.bz-sp-mob-list')!;
    const searchWrap = popup.querySelector('.bz-sp-mob-search') as HTMLElement;
    const searchIn = popup.querySelector('.bz-sp-mob-search .bz-input') as HTMLInputElement;
    const searchIcon = popup.querySelector('.bz-sp-mob-search .bz-ic') as HTMLElement;
    setIcon(searchIcon, 'search');
    const clearBtn = uiIconBtn({ icon: 'x', title: '清除', className: 'bz-sp-mob-clear' });
    searchWrap.appendChild(clearBtn);
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
        // 无搜索：全部可见域（无设置项的域不显示，用户拍板）
        visibleDomains().forEach((d) => {
          list.appendChild(mobItem(d));
        });
        return;
      }
      // 搜索：域段 + 设置项段
      const doms = visibleDomains().filter((d) => d.name.includes(query) || d.desc.includes(query));
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
          item.type = 'button';
          item.className = 'bz-sp-mob-item';
          const ic = document.createElement('span');
          ic.className = 'bz-sp-mob-ic';
          ic.appendChild(uiIcon(r.icon));
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

    /** 构造移动端域行（图标方块 + 名称 + 描述 + ›） */
    const mobItem = (d: DomainDef): HTMLElement => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'bz-sp-mob-item';
      const ic = document.createElement('span');
      ic.className = 'bz-sp-mob-ic';
      ic.appendChild(uiIcon(d.icon));
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
      chev.appendChild(uiIcon('chevron-right'));
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

    // 弹窗头行：图标方块 + 名称 + 关闭钮（图标为 lucide，非 emoji）
    const head = document.createElement('div');
    head.className = 'bz-sp-mob-modal-head';
    const ic = document.createElement('span');
    ic.className = 'bz-sp-mob-modal-ic';
    ic.appendChild(uiIcon(domain.icon));
    const title = document.createElement('h3');
    title.className = 'bz-sp-mob-modal-title';
    title.textContent = domain.name;
    head.append(ic, title);
    const x = uiIconBtn({ icon: 'x', lg: true, title: '关闭' });
    head.appendChild(x);
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
      body.appendChild(this.emptyEl(
        'settings',
        `${domain.name} · 暂无设置项`,
        '该域没有可在此配置的设置'
      ));
      return;
    }

    body.appendChild(this.loadingEl());
    try {
      const schema = await domain.schemaLoader();
      body.innerHTML = '';
      renderPanelSchema(body, schema);
      // 记录本域 schema 行（移动端搜索「设置项」段用；与桌面 renderDomain 同口径）
      const rowsOf = schema.groups.flatMap((g) =>
        g.rows.map((r) => ({ name: (r as { name?: string }).name ?? '', desc: (r as { desc?: string }).desc ?? '' }))
      );
      schemaRowCache.set(domain.id, rowsOf);
      // 回填导航徽标（移动端列表无徽标展示，但保持与桌面一致的设置项总数口径）
      const count = visibleItemCount(schema);
      navBadges.set(domain.id, count > 0 ? String(count) : '·');
    } catch (e) {
      body.innerHTML = '';
      body.appendChild(this.emptyEl(
        'alert-circle',
        '加载失败',
        (e as Error).message
      ));
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
