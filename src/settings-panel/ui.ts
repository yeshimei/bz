/**
 * 设置面板 UI（settings-panel，ADR-0080）
 * 新体系组件库版（铁律 6 收编：按钮/输入/开关/下拉/chip/空态等全部消费 src/core/ui；
 * 图标一律 lucide，禁止 emoji 当图标）：
 * - 桌面端：B 侧栏工作台 = 影院式整宽头行（仅标题「设置」，占满 100% 宽）
 *   + 左域导航 + 右内容区内嵌渲染该域全部设置分组；遮罩/ESC 关闭（头行无关闭钮）
 * - 移动端：全屏推入式两页（首页搜索 + 域列表 → 推入域设置页，返回弹回）
 * - 域设置内容：数据 = 各域真实 schema（xxxSettingsSchema()，与 ⚙️ 弹窗同源），
 *   视觉 = 渲染器 renderPanelSchema（组件库控件），绑定逻辑与 ⚙️ 弹窗同一套
 *   （键直绑 getSettings/saveSettings / 三函数 / visibleWhen / onChange）；
 *   路径行走 uiChip 路径胶囊 + openPathPicker（ADR-0061 选择器）。
 * - 桌面导航徽标动态计算（无设置=— / 其余初始=·，schema 加载后回填设置项总数）。
 * - 通用域/AI 域 → generalSettingsSchema()/aiSettingsSchema()（issue 186：AI 自全局拆出独立成域）。
 */
import { createOverlay, topifyZ } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import type { SettingsSchema } from '../core/settings-schema';
import { DOMAIN_ICONS } from '../core/domain-icons';
import { renderPanelSchema } from './renderer';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { uiIconBtn, uiEmpty, mountIcons } from '../core/ui';
// markup 单源（ADR-0104/0105）：面板壳/导航/页头结构串全出自渲染纯层；
// 行为单源（ADR-0106，issue 245 范式）：本文件即唯一真理，原型壳为双 iframe 评审壳
import * as R from './render';

/* ==================== 域清单（全局 + 19 域；图标 = lucide 名） ==================== */

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
  // 通用组：基础 schema（存储路径）+「数据体检」按钮行（D4：检查项直达体检面板；
  // core 不反向依赖域——入口在面板层追加，⚙️ 原生设置页不带此行）
  general: async () => {
    const schema = await (await import('../core/settings-main-schema')).generalSettingsSchema();
    const { openDataCheckup } = await import('../checkup');
    // 「数据体检」按钮挂「数据存储路径」组尾（按 name 定位防未来组序漂移）
    const storageGroup = schema.groups.find((g) => g.name === '数据存储路径') ?? schema.groups[schema.groups.length - 1];
    storageGroup.rows.push({
      type: 'button',
      name: '数据体检',
      buttonText: '打开体检',
      cta: true,
      desc: '检查各域数据文件能否解析、字段漂移与孤儿条目（只读体检，可修复项一键清理）',
      onClick: () => void openDataCheckup(getApp()),
    });
    return schema;
  },
  ai: async () => (await import('../core/settings-main-schema')).aiSettingsSchema(),
  appearance: async () => (await import('./schema')).appearanceSettingsSchema(),
  // 内容首页（home 域，2026-09-10）：入口顺序与显隐 = 一个按钮开编辑弹窗
  home: async () => (await import('../home/settings')).homeSettingsSchema(),
  diary: async () => (await import('../diary/settings')).diarySettingsSchema(),
  memo: async () => (await import('../memo/settings')).memoSettingsSchema(),
  belongings: async () => (await import('../belongings/ui')).belongingSettingsSchema(),
  // 数据源组为声明行（外部 news.json 状态），先读盘预载再建 schema
  clipping: async () => {
    const { readDataSourceState } = await import('../clipbook/news-source-settings');
    const state = await readDataSourceState();
    return (await import('../clipbook/ui')).clipbookSettingsSchema(state);
  },
  favorites: async () => (await import('../favorites/ui')).favoritesSettingsSchema(),
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
  'password-vault': async () => (await import('../password-vault/settings')).passwordVaultSettingsSchema(),
  knowledge: async () => (await import('../knowledge/ui')).knowledgeSettingsSchema(),
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
        enabled: (tryGetSettings() as Record<string, unknown>).smartcatEnabled !== false,
      },
    });
  },
};

/** 域清单（图标 = core/domain-icons 单一事实源，与命令面板/内容首页同源——enh-sweep-a 收敛；
 *  描述只写功能语义，不带「新域/ADR」开发黑话；徽标运行时动态计算，见 badgeOf）。
 *  导出供回归测试断言（图标映射一致性/历史重复图标错开）。 */
export const DOMAINS: DomainDef[] = [
  { id: 'global', name: '通用', icon: DOMAIN_ICONS.global, desc: '存储路径等跨域基础偏好', schemaLoader: schemaLoaders.general },
  { id: 'appearance', name: '设置', icon: DOMAIN_ICONS.appearance, desc: '设置面板的布局与主题', schemaLoader: schemaLoaders.appearance },
  { id: 'ai', name: 'AI', icon: DOMAIN_ICONS.ai, desc: 'AI 服务商与模型配置', schemaLoader: schemaLoaders.ai },
  // diary = ADR-0115 回忆墙升格正名（唯一日记 UI），diary-wall 域退役
  { id: 'diary', name: '日记本', icon: DOMAIN_ICONS.diary, desc: '日记目录、写日记与解析检测', schemaLoader: schemaLoaders.diary },
  { id: 'memo', name: '备忘录', icon: DOMAIN_ICONS.memo, desc: '备忘录工作台与提醒（捕获入口落点）', schemaLoader: schemaLoaders.memo },
  { id: 'belongings', name: '归物本', icon: DOMAIN_ICONS.belongings, desc: '物品登记与查找', schemaLoader: schemaLoaders.belongings },
  { id: 'clipping', name: '剪藏本', icon: DOMAIN_ICONS.clipping, desc: '未读流与剪藏笔记', schemaLoader: schemaLoaders.clipping },
  { id: 'favorites', name: '收藏本', icon: DOMAIN_ICONS.favorites, desc: '收藏条目', schemaLoader: schemaLoaders.favorites },
  { id: 'reading-report', name: '阅读报告', icon: DOMAIN_ICONS['reading-report'], desc: '阅读统计', noSettings: true },

  { id: 'cinema', name: '影院', icon: DOMAIN_ICONS.cinema, desc: '影视目录与海报', schemaLoader: schemaLoaders.cinema },
  { id: 'bookshelf', name: '书库', icon: DOMAIN_ICONS.bookshelf, desc: '藏书封面墙', schemaLoader: schemaLoaders.bookshelf },
  { id: 'review', name: '复习计划', icon: DOMAIN_ICONS.review, desc: '间隔重复与做题', schemaLoader: schemaLoaders.review },
  { id: 'secondbrain', name: '第二大脑', icon: DOMAIN_ICONS.secondbrain, desc: '嵌入检索与对话', schemaLoader: schemaLoaders.secondbrain },
  { id: 'auto-summary', name: '自动摘要', icon: DOMAIN_ICONS['auto-summary'], desc: '剪藏自动摘要', noSettings: true },
  { id: 'home', name: '首页', icon: DOMAIN_ICONS.home, desc: '首页外观：入口顺序与显隐', schemaLoader: schemaLoaders.home },
  { id: 'pomodoro', name: '番茄钟', icon: DOMAIN_ICONS.pomodoro, desc: '专注计时与休息', schemaLoader: schemaLoaders.pomodoro },
  { id: 'attach', name: '附件搬移', icon: DOMAIN_ICONS.attach, desc: '附件整理', noSettings: true },
  { id: 'encrypt', name: '保险库', icon: DOMAIN_ICONS.encrypt, desc: '密码、加密笔记与加密日记', schemaLoader: schemaLoaders.encrypt },
  { id: 'password-vault', name: '密码本', icon: DOMAIN_ICONS['password-vault'], desc: '密码条目与生成器', schemaLoader: schemaLoaders['password-vault'] },
  { id: 'smartcat', name: '小橘陪伴猫', icon: DOMAIN_ICONS.smartcat, desc: '桌面宠物陪伴', schemaLoader: schemaLoaders.smartcat },
  { id: 'knowledge', name: '知识盒', icon: DOMAIN_ICONS.knowledge, desc: '文献录入 · 卡片 · 主题', schemaLoader: schemaLoaders.knowledge },
];

/** 导航语义分组（拍板原型 P1：基础/记录/媒体与知识/工具 四组；不在表内的域归「其他」尾组）。
 *  id 口径 = DOMAINS 的 id（剪藏本在 DOMAINS 里叫 clipping）。导出供回归测试断言。 */
export const NAV_SECS: Array<{ title: string; ids: string[] }> = [
  { title: '基础', ids: ['global', 'appearance', 'home'] },
  { title: '智能', ids: ['ai', 'secondbrain'] },
  { title: '记录', ids: ['diary', 'memo', 'belongings'] },
  { title: '收集', ids: ['clipping', 'favorites'] },
  { title: '媒体与阅读', ids: ['cinema', 'bookshelf', 'review', 'knowledge'] },
  { title: '工具', ids: ['pomodoro', 'smartcat'] },
  { title: '安全', ids: ['encrypt', 'password-vault'] },
];

/** 已加载域的 schema 行缓存（移动端搜索「设置项」段用：域名 → 行名/描述列表） */
const schemaRowCache = new Map<string, Array<{ name: string; desc: string }>>();

/** 缓存域 schema 行（移动端搜索「设置项」段用；preload/renderDomain/openMobileDomain 三处同口径） */
function cacheRowsFor(domainId: string, schema: SettingsSchema): void {
  const rows = schema.groups.flatMap((g) =>
    g.rows.map((r) => ({ name: (r as { name?: string }).name ?? '', desc: (r as { desc?: string }).desc ?? '' }))
  );
  schemaRowCache.set(domainId, rows);
}

/** NAV_SECS 语义分组 +「其他」尾组；matches 可选（桌面搜索命中过滤用；桌面导航/移动列表共用） */
function groupDomains(visible: DomainDef[], matches?: (d: DomainDef) => boolean): Array<{ title: string; domains: DomainDef[] }> {
  const hit = matches ?? (() => true);
  const secs: Array<{ title: string; domains: DomainDef[] }> = NAV_SECS.map((sec) => ({
    title: sec.title,
    domains: visible.filter((d) => sec.ids.indexOf(d.id) >= 0 && hit(d)),
  }));
  const rest = visible.filter((d) => !NAV_SECS.some((sec) => sec.ids.indexOf(d.id) >= 0) && hit(d));
  if (rest.length) secs.push({ title: '其他', domains: rest });
  return secs;
}

/** 已加载域的当前端可见设置项数（preloadAllBadges 回填；面板销毁随 navBadges 一并清空）。
 *  导出供回归测试断言（与 DOMAINS 同惯例）。 */
export const loadedCounts = new Map<string, number>();

/**
 * 列表可见域（issue 194 按端隐藏）：无设置项的域（noSettings）不显示；有 schema 但当前端
 * 可见项数为 0 的域（如设置全部是移动端组而处于桌面端）也不显示——加载完成前先展示
 * （避免列表闪空），preloadAllBadges 解析后剔除。搜索同样只搜列表可见域。
 * 导出供回归测试断言（与 DOMAINS 同惯例）。
 */
export const listableDomains = (): DomainDef[] =>
  DOMAINS.filter((d) => !d.noSettings && d.schemaLoader && (!loadedCounts.has(d.id) || (loadedCounts.get(d.id) ?? 0) > 0));

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
  /** 域渲染竞态序号（P2-4：每次 renderDomain 自增，await 后校验丢弃过期渲染） */
  private renderSeq = 0;
  /** 列表重绘回调（桌面导航/移动列表各自注册；preload 解析出零项域后剔除重绘） */
  private rerenderList: (() => void) | null = null;
  /** 移动端推入状态：home = 首页列表；domain = 已推入域设置页 */
  private mobPushed = false;

  /**
   * 打开面板；domainId 可选（增强包：备忘录场景菜单「在设置中编辑」直达）——
   * 桌面定位左栏选中域；移动端打开后直接进域设置弹窗。未知 id 忽略（回退通用）。
   */
  open(domainId?: string): void {
    const deep = domainId ? DOMAINS.find((x) => x.id === domainId) : undefined;
    if (deep) this.activeDomainId = deep.id;
    if (this.mask && this.popup) {
      topifyZ(this.mask, this.popup);
      this.mask.style.display = 'block';
      this.popup.style.display = 'flex';
      if (deep && isMobileEnv()) void this.pushDomain(deep);
      return;
    }
    this.build(deep);
  }

  private build(deep?: DomainDef): void {
    const { mask, popup } = createOverlay({
      maskId: 'bz-settings-panel-mask',
      popupId: 'bz-settings-panel-popup',
      maxWidth: 1080, // 与 .bz-sp-desk 定稿宽 min(1080px, 94vw) 同源
      onMaskClick: () => this.hide(),
    });
    this.mask = mask;
    this.popup = popup;

    if (isMobileEnv()) {
      this.buildMobile(popup);
      // 直达域（移动端）：跳过首页列表，直接推入域设置页
      if (deep) void this.pushDomain(deep);
    } else {
      this.buildDesktop(popup);
    }
    // 打开即预加载全部域 schema（徽标回填 + 零项域按端从列表剔除，两端共用）
    void this.preloadAllBadges();

    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = 'block';
    popup.style.display = 'flex';
    topifyZ(mask, popup);

    this.escHandle = escManager.register('bz-settings-panel', {
      isVisible: () => !!this.mask && this.mask.style.display === 'block',
      close: () => {
        // 移动端推入页先弹回首页，再次 ESC 才收面板
        if (this.popup?.classList.contains('bz-sp-mob-pushed')) this.popDomain();
        else this.hide();
      },
    });
  }

  /* ---------- 桌面：B 侧栏工作台（头行 + 左导航 + 右内嵌渲染） ---------- */

  private buildDesktop(popup: HTMLElement): void {
    popup.classList.add('bz-sp-desk');
    // 壳结构单源（R.deskShellHtml：头行 + 左导航 + 右内容区，逐字原型）
    popup.innerHTML = R.deskShellHtml();
    mountIcons(popup); // 头行搜索图标占位物化

    const nav = popup.querySelector('.bz-sp-nav') as HTMLElement;
    this.navEl = nav;
    const pane = popup.querySelector('.bz-sp-pane') as HTMLElement;
    const searchIn = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;

    const renderNav = (q: string) => {
      const query = q.trim();
      nav.innerHTML = '';
      // 无设置项/当前端零设置项的域不在左侧列表显示（用户拍板 + issue 194）；搜索同样只搜列表可见域
      const visible = listableDomains();
      // 搜索命中：域名/描述 + 已加载域的设置项行名（只匹配行名——desc 常含跨域引用词会误命中）
      const matches = (d: DomainDef) =>
        !query || d.name.includes(query) || d.desc.includes(query) ||
        (schemaRowCache.get(d.id) || []).some((r) => r.name.includes(query));
      // 拍板原型：导航按语义分四组（基础/记录/媒体与知识/工具）；不在表内的域归「其他」尾组
      const secs = groupDomains(visible, matches);
      for (const sec of secs) {
        if (!sec.domains.length) continue;
        // 导航结构单源（R.navSecHtml/navItemHtml；data-sp-domain 契约供点击回查）
        let itemsHtml = '';
        sec.domains.forEach((d) => {
          itemsHtml += R.navItemHtml({
            id: d.id, icon: d.icon, name: d.name, count: badgeOf(d),
            on: d.id === this.activeDomainId && !query,
          });
        });
        nav.insertAdjacentHTML('beforeend', R.navSecHtml(sec.title, itemsHtml));
      }
      mountIcons(nav); // 导航图标占位物化（mock setIcon 记 data-icon）
      nav.querySelectorAll<HTMLElement>('.bz-sp-nav-item').forEach((b) => {
        const id = b.dataset.spDomain!;
        b.addEventListener('click', () => {
          this.activeDomainId = id;
          renderNav(searchIn.value);
          void this.renderDomain(pane, DOMAINS.find((x) => x.id === id)!);
        });
      });
    };

    searchIn.addEventListener('input', () => {
      renderNav(searchIn.value);
      // 桌面搜索词对当前内容区行做 .hit 命中高亮（renderNav 重绘 + 行级命中同刷）
      const q = searchIn.value.trim();
      popup.querySelectorAll<HTMLElement>('.bz-sp-settings-body .bz-sp-set-row').forEach((row) => {
        row.classList.toggle('hit', !!q && !!row.textContent && row.textContent.includes(q));
      });
    });
    renderNav('');
    // 注册列表重绘回调：preload 解析出零项域后按当前搜索词重绘导航（issue 194 按端隐藏）
    this.rerenderList = () => renderNav(searchIn.value);
    void this.renderDomain(pane, DOMAINS.find((x) => x.id === this.activeDomainId) ?? DOMAINS[0]);
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
        loadedCounts.set(d.id, count);
        navBadges.set(d.id, count > 0 ? String(count) : '—');
        // 顺带填充移动端搜索「设置项」缓存
        cacheRowsFor(d.id, schema);
      } catch {
        navBadges.set(d.id, '·'); // 加载失败保守显示占位（域保持列表可见）
      }
      this.refreshNavBadges();
      // 零项域解析完成 → 从列表剔除（桌面导航/移动列表按当前端注册的重绘回调）
      this.rerenderList?.();
    });
    await Promise.allSettled(tasks);
  }

  /** 重绘桌面导航徽标（schema 加载/组数变化后调用；不重建导航项，只刷数字） */
  private refreshNavBadges(): void {
    if (!this.navEl) return;
    this.navEl.querySelectorAll<HTMLElement>('.bz-sp-nav-item').forEach((b) => {
      const d = DOMAINS.find((x) => x.id === b.dataset.spDomain);
      if (!d) return;
      const ct = b.querySelector('.bz-sp-nav-count');
      if (ct) ct.textContent = badgeOf(d);
    });
  }

  /** 空态构建（组件库 uiEmpty：图标 lucide + 标题 + 描述） */
  private emptyEl(icon: string, title: string, desc: string): HTMLElement {
    return uiEmpty({ icon, title, desc });
  }

  /**
   * 渲染某域设置到容器：内嵌渲染器（与 ⚙️ 弹窗同数据源）。
   * 无 schema 的域显示空态。
   */
  private async renderDomain(pane: HTMLElement, domain: DomainDef, opts: { withHead?: boolean } = {}): Promise<void> {
    // 竞态 token（P2-4）：用户快速切换域时，前一个 schemaLoader await 完成后若已非当前域，
    // 丢弃渲染（避免往 detached body 写、旧句柄推入新渲染任务）
    const runId = ++this.renderSeq;
    // 清理旧渲染句柄
    this.renderHandles = [];
    pane.innerHTML = '';

    // 域页头（桌面：域名 + 描述 + 右侧项数/组数徽标；移动端推入页头行已有域名，跳过）
    let pageHead: HTMLElement | null = null;
    if (opts.withHead !== false) {
      const headHolder = document.createElement('div');
      headHolder.innerHTML = R.pageHeadHtml(domain.name, domain.desc, '');
      pageHead = headHolder.firstElementChild as HTMLElement;
      pane.appendChild(pageHead);
    }

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
    body.innerHTML = R.loadingHtml(); // 加载态结构单源

    try {
      const schema = await domain.schemaLoader();
      if (runId !== this.renderSeq) return; // 已有更新的渲染任务，放弃本次结果
      body.innerHTML = '';
      const handle = renderPanelSchema(body, schema);
      this.renderHandles.push(handle);
      // 记录本域 schema 行（移动端搜索「设置项」段用）
      cacheRowsFor(domain.id, schema);
      // 回填导航徽标：设置项总数（visibleWhen 门控隐藏的不计、button 操作行不计，与 preload 同口径）；
      // 0 项显示 ·（有 schema 但全被门控隐藏）
      const groupEls = body.querySelectorAll<HTMLElement>('.bz-sp-group');
      const visibleGroups = [...groupEls].filter((g) => g.style.display !== 'none').length;
      const count = visibleItemCount(schema);
      navBadges.set(domain.id, count > 0 ? String(count) : '·');
      this.refreshNavBadges();
      // 页头徽标回填（项数/组数；组数含被门控隐藏的组——与渲染出的分组卡一致）
      if (pageHead) {
        (pageHead.querySelector('.bz-sp-page-tag') as HTMLElement).textContent = `${count} 项 · ${schema.groups.length} 组`;
      }
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

  /* ---------- 移动端：全屏推入式两页（首页搜索 + 域列表 → 推入域设置页） ---------- */

  private buildMobile(popup: HTMLElement): void {
    // bz-panel-mtop：≤768px 顶部避让 Obsidian 移动端头部（max(44px, 安全区)，全站统一档）
    popup.classList.add('bz-sp-mobile', 'bz-panel-mtop');
    popup.innerHTML = R.mobShellHtml();
    this.mobPushed = false; // 面板重建（含上次关闭时停在推入页）从首页起

    // 两页头行工具：**只有首页一枚关闭钮**；域页不设关闭（用户 2026-09-10 拍板——
    // 域页已有一枚返回钮弹回首页，再叠一枚关闭会与它并排、误触率高；关面板走首页那枚）
    const homeTools = popup.querySelector('[data-sp-mob-tools="home"]') as HTMLElement;
    homeTools.appendChild(uiIconBtn({ icon: 'x', lg: true, title: '关闭', className: 'bz-sp-mob-close', onClick: () => this.hide() }));
    const back = popup.querySelector('[data-sp-mob-back]') as HTMLElement;
    back.appendChild(uiIconBtn({ icon: 'arrow-left', lg: true, title: '返回', className: 'bz-sp-mob-back-btn', onClick: () => this.popDomain() }));
    mountIcons(popup); // 壳内图标占位物化（搜索/返回/关闭）

    const list = popup.querySelector('.bz-sp-mob-list') as HTMLElement;
    const searchIn = popup.querySelector('.bz-sp-mob-search .bz-input') as HTMLInputElement;

    const render = (q: string) => {
      const query = q.trim();
      list.innerHTML = '';
      if (!query) {
        // 无搜索：全部列表可见域按语义分组（基础/记录/媒体与知识/工具；同桌面导航口径）
        const secs = groupDomains(listableDomains());
        for (const sec of secs) {
          if (!sec.domains.length) continue;
          const secEl = document.createElement('div');
          secEl.className = 'bz-sp-mob-sec';
          secEl.textContent = sec.title;
          list.appendChild(secEl);
          sec.domains.forEach((d) => list.insertAdjacentHTML('beforeend', R.mobItemHtml({ id: d.id, icon: d.icon, name: d.name, desc: d.desc })));
        }
      } else {
        // 搜索：域段 + 设置项段（同样只搜列表可见域）
        const doms = listableDomains().filter((d) => d.name.includes(query) || d.desc.includes(query));
        const rows: Array<{ domain: DomainDef; name: string; desc: string }> = [];
        schemaRowCache.forEach((rowsOf, did) => {
          const d = DOMAINS.find((x) => x.id === did);
          if (!d) return;
          rowsOf.forEach((r) => {
            if (r.name.includes(query) || (r.desc && r.desc.includes(query))) rows.push({ domain: d, name: r.name, desc: r.desc || d.name });
          });
        });
        let html = '';
        if (doms.length) {
          html += `<div class="bz-sp-mob-sec">域（${doms.length}）</div>`;
          doms.forEach((d) => { html += R.mobItemHtml({ id: d.id, icon: d.icon, name: d.name, desc: d.desc }); });
        }
        if (rows.length) {
          html += `<div class="bz-sp-mob-sec">设置项（${rows.length}）</div>`;
          rows.forEach((r) => { html += R.mobItemHtml({ id: r.domain.id, icon: r.domain.icon, name: r.name, desc: `${r.domain.name} · ${r.desc}`, kind: '设置' }); });
        }
        if (!doms.length && !rows.length) html = `<div class="bz-sp-mob-empty">没有匹配「${query}」的设置或域</div>`;
        list.innerHTML = html;
      }
      list.querySelectorAll<HTMLElement>('.bz-sp-mob-item').forEach((b) => {
        const d = DOMAINS.find((x) => x.id === b.dataset.spDomain);
        if (d) b.addEventListener('click', () => void this.pushDomain(d));
      });
      mountIcons(list); // 列表项图标占位物化（render 重绘后补挂）
    };

    searchIn.addEventListener('input', () => render(searchIn.value));
    render('');
    // 注册列表重绘回调：preload 解析出零项域后按当前搜索词重绘列表（issue 194 按端隐藏）
    this.rerenderList = () => { if (!this.mobPushed) render(searchIn.value); };
  }

  /** 推入域设置页（全屏页切换；返回/ESC 弹回首页） */
  private async pushDomain(domain: DomainDef): Promise<void> {
    const popup = this.popup!;
    this.mobPushed = true;
    (popup.querySelector('.bz-sp-mob-title') as HTMLElement).textContent = domain.name;
    popup.classList.add('bz-sp-mob-pushed');
    const body = popup.querySelector('.bz-sp-mob-page-body') as HTMLElement;
    await this.renderDomain(body, domain, { withHead: false });
  }

  /** 弹回首页（作废进行中的域渲染；下次推入重渲） */
  private popDomain(): void {
    this.mobPushed = false;
    this.renderSeq++; // 作废未完成的域渲染任务
    this.popup?.classList.remove('bz-sp-mob-pushed');
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
    this.rerenderList = null;
    // 徽标/行缓存/已加载数随面板销毁清空（下次打开重新动态计算）
    navBadges.clear();
    schemaRowCache.clear();
    loadedCounts.clear();
  }
}
