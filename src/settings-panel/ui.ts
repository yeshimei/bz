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
 *   路径行走 uiChip 路径胶囊 + openPathPicker（ADR-0061 选择器；面板内挂 .bz-sp-skin 皮肤，ADR-0127）。
 * - 桌面导航徽标动态计算（无设置=— / 其余初始=·，schema 加载后回填设置项总数）。
 * - 通用域/AI 域 → generalSettingsSchema()/aiSettingsSchema()（issue 186：AI 自全局拆出独立成域）。
 */
import { setIcon } from 'obsidian';
import { createOverlay, topifyZ } from '../core/dom';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { isMobileEnv } from '../core/mobile';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { openFlowDialog } from '../core/flow-dialog';
import type { SettingsSchema } from '../core/settings-schema';
import { DOMAIN_ICONS } from '../core/domain-icons';
import { renderPanelSchema, closeAllSelectMenus, refreshGroupCounts } from './renderer';
import { notice, notifyActionError, notifySaveError } from '../core/notice';
import { getApp } from '../core/app';
import { uiIconBtn, uiBtn, uiEmpty, mountIcons } from '../core/ui';
import { firstFocusable, trapFocus } from '../core/ui/focus-trap';
import { debounce } from '../core/utils';
// markup 单源（ADR-0104/0105）：面板壳/导航/页头结构串全出自渲染纯层；
// 行为单源（ADR-0106，issue 245 范式）：本文件即唯一真理，原型壳为双 iframe 评审壳
import * as R from './render';
// 动效层（校准台语义世界，见 motion.ts 文件头）：只在生命周期挂点被调用，markup 契约不变
import * as spm from './motion';
// 更新日志弹窗（issue 472）：侧栏底部入口的独立子弹窗，同皮 .bz-sp-skin
import { openChangelogModal } from './changelog';

/** 搜索输入防抖窗口（E-5）：纯 UI 重绘无数据丢失面，每键全量重建导航/列表 + 图标物化 + 全行
 *  重扫收敛为一停顿一次（core debounce 先例口径 180ms）。 */
const SEARCH_DEBOUNCE_MS = 180;

/** 搜索命中归一（UI-7）：query 与被检串同转小写再 includes——英文缩写词（api/rss/deepseek）
 *  小写输入也可命中；中文无感。 */
const spMatch = (hay: string, needle: string): boolean =>
  !needle || hay.toLowerCase().includes(needle.toLowerCase());

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
  // 通用组：基础 schema（存储路径）+ 外观组（原「设置」页并入）+「数据体检」按钮行
  // （D4：检查项直达体检面板；core 不反向依赖域——入口在面板层追加，⚙️ 原生设置页不带此行）
  general: async () => {
    const schema = await (await import('../core/settings-main-schema')).generalSettingsSchema();
    const { openDataCheckup } = await import('../checkup');
    // 外观组排最前（2026-09-12 用户拍板：「设置」页撤销，其外观组并入通用）
    const { appearanceSettingsSchema } = await import('./schema');
    schema.groups.unshift(...appearanceSettingsSchema().groups);
    // 「数据体检」按钮挂「数据存储路径」组尾（按 name 定位防未来组序漂移）
    const storageGroup = schema.groups.find((g) => g.name === '数据存储路径') ?? schema.groups[schema.groups.length - 1];
    storageGroup.rows.push({
      type: 'button',
      name: '数据体检',
      buttonText: '打开体检',
      cta: true,
      desc: '各域数据文件的只读体检',
      onClick: () => void openDataCheckup(getApp()),
    });
    return schema;
  },
  ai: async () => (await import('../core/settings-main-schema')).aiSettingsSchema(),
  // 通知（2026-09-12 用户拍板）：自「通用」域拆出，面板里独立成一页
  // （不建业务域——横切偏好，schema 留 core/settings-main-schema）
  notice: async () => (await import('../core/settings-main-schema')).noticeSettingsSchema(),
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
  gameshelf: async () => (await import('../gameshelf/settings')).gameshelfSettingsSchema(),
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
  // 脸谱（issue 446/466/467）：「清空聊天数据」清各保库记录的聊天仓段（confirm 在域内 notice 层做，不动人物卡）
  people: async () => {
    const { peopleSettingsSchema } = await import('../people/settings');
    const { getPeopleSafeStore } = await import('../people/safe-store');
    const { notifyActionError } = await import('../core/notice');
    return peopleSettingsSchema({
      onClearStore: async () => {
        try {
          const safe = await getPeopleSafeStore();
          if (!safe.unlocked) {
            notice('保险库未解锁，先解锁再清空', 'warning');
            return;
          }
          await safe.clearStores();
          notice('聊天数据已清空', 'delete');
        } catch (e) {
          notifyActionError(e, '清空聊天数据');
        }
      },
    });
  },
  knowledge: async () => {
    const { knowledgeSettingsSchema } = await import('../knowledge/ui');
    // 清空建议缓存（挂载树 issue 318）：域内单文件缓存的清空入口，接线口径同「清空历史」回调
    return knowledgeSettingsSchema({
      onClearSuggestCache: async () => {
        const { clearSuggestCache } = await import('../knowledge/mount-suggest');
        await clearSuggestCache();
      },
    });
  },
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
  { id: 'global', name: '通用', icon: DOMAIN_ICONS.global, desc: '面板外观、存储路径等跨域偏好', schemaLoader: schemaLoaders.general },
  // 通知（2026-09-12）：自通用域拆出的独立面板页；「设置」页并入通用后 appearance 域退役
  { id: 'notice', name: '通知', icon: DOMAIN_ICONS.notice, desc: '通知级别、时长与弹出位置', schemaLoader: schemaLoaders.notice },
  { id: 'ai', name: 'AI', icon: DOMAIN_ICONS.ai, desc: 'AI 模型与凭据配置', schemaLoader: schemaLoaders.ai },
  // diary = ADR-0115 回忆墙升格正名（唯一日记 UI），diary-wall 域退役
  { id: 'diary', name: '日记本', icon: DOMAIN_ICONS.diary, desc: '日记目录与写日记口径', schemaLoader: schemaLoaders.diary },
  { id: 'memo', name: '备忘录', icon: DOMAIN_ICONS.memo, desc: '备忘录工作台与提醒设置', schemaLoader: schemaLoaders.memo },
  { id: 'belongings', name: '归物本', icon: DOMAIN_ICONS.belongings, desc: '物品登记与查找', schemaLoader: schemaLoaders.belongings },
  // 脸谱（issue 435 面板 / issue 446 数据源）：与备忘录同属记录类
  { id: 'people', name: '脸谱', icon: DOMAIN_ICONS.people, desc: '微信聊天导入与 AI 人物画像', schemaLoader: schemaLoaders.people },
  { id: 'clipping', name: '剪藏本', icon: DOMAIN_ICONS.clipping, desc: '未读流与剪藏笔记', schemaLoader: schemaLoaders.clipping },
  { id: 'favorites', name: '收藏本', icon: DOMAIN_ICONS.favorites, desc: '收藏条目', schemaLoader: schemaLoaders.favorites },
  { id: 'reading-report', name: '阅读报告', icon: DOMAIN_ICONS['reading-report'], desc: '阅读统计', noSettings: true },

  { id: 'cinema', name: '影院', icon: DOMAIN_ICONS.cinema, desc: '影视目录与海报', schemaLoader: schemaLoaders.cinema },
  { id: 'bookshelf', name: '书库', icon: DOMAIN_ICONS.bookshelf, desc: '藏书封面墙、读书笔记与阅读报告', schemaLoader: schemaLoaders.bookshelf },
  // 游戏库（2026-09-17）：声明在书库之后（与首页入口同序：影院 → 书库 → 游戏库）
  { id: 'gameshelf', name: '游戏库', icon: DOMAIN_ICONS.gameshelf, desc: 'Steam 游戏库同步与统计', schemaLoader: schemaLoaders.gameshelf },
  { id: 'review', name: '复习计划', icon: DOMAIN_ICONS.review, desc: '间隔重复与做题', schemaLoader: schemaLoaders.review },
  { id: 'secondbrain', name: '第二大脑', icon: DOMAIN_ICONS.secondbrain, desc: '嵌入检索与对话', schemaLoader: schemaLoaders.secondbrain },
  { id: 'auto-summary', name: '自动摘要', icon: DOMAIN_ICONS['auto-summary'], desc: '剪藏自动摘要', noSettings: true },
  { id: 'home', name: '首页', icon: DOMAIN_ICONS.home, desc: '首页外观与时间线入口等显示偏好', schemaLoader: schemaLoaders.home },
  { id: 'pomodoro', name: '番茄钟', icon: DOMAIN_ICONS.pomodoro, desc: '专注计时与休息', schemaLoader: schemaLoaders.pomodoro },
  { id: 'attach', name: '附件搬移', icon: DOMAIN_ICONS.attach, desc: '附件整理', noSettings: true },
  { id: 'encrypt', name: '保险库', icon: DOMAIN_ICONS.encrypt, desc: '密码、加密笔记与加密日记', schemaLoader: schemaLoaders.encrypt },
  { id: 'password-vault', name: '密码本', icon: DOMAIN_ICONS['password-vault'], desc: '密码条目与生成器', schemaLoader: schemaLoaders['password-vault'] },
  { id: 'smartcat', name: '小橘陪伴猫', icon: DOMAIN_ICONS.smartcat, desc: '桌面宠物陪伴', schemaLoader: schemaLoaders.smartcat },
  { id: 'knowledge', name: '知识盒', icon: DOMAIN_ICONS.knowledge, desc: '文献录入、卡片与主题管理', schemaLoader: schemaLoaders.knowledge },
];

/** 导航语义分组（拍板原型 P1：基础/记录/媒体与知识/工具 四组；不在表内的域归「其他」尾组）。
 *  id 口径 = DOMAINS 的 id（剪藏本在 DOMAINS 里叫 clipping）。导出供回归测试断言。
 *  2026-09-17：游戏库归「媒体与阅读」（此前不在表内 → 落「其他」尾组，用户点名要按语义归位）。 */
export const NAV_SECS: Array<{ title: string; ids: string[] }> = [
  { title: '基础', ids: ['global', 'notice', 'home'] },
  { title: '智能', ids: ['ai', 'secondbrain'] },
  { title: '记录', ids: ['diary', 'memo', 'belongings', 'people'] },
  { title: '收集', ids: ['clipping', 'favorites'] },
  { title: '媒体与阅读', ids: ['cinema', 'bookshelf', 'gameshelf', 'review', 'knowledge'] },
  { title: '工具', ids: ['pomodoro', 'smartcat'] },
  { title: '安全', ids: ['encrypt', 'password-vault'] },
];

/** 已加载域的 schema 行缓存（移动端搜索「设置项」段用：域名 → 行名/描述列表） */
const schemaRowCache = new Map<string, Array<{ name: string; desc: string }>>();

/**
 * 会话级 schema 缓存（E-8）：同一次面板会话内每域 loader 只跑一次——预载/进域/推入/重置共享
 * 同一份 schema（剪藏本/小橘/复习等含磁盘 IO 的 loader 不再反复重跑）；visibleWhen 求值仍在
 * 计数/刷新时按当前设置实时判，徽标新鲜度不受影响。cleanup 清空（与三缓存同生命周期）。
 */
const schemaCache = new Map<string, SettingsSchema>();

/** 经会话缓存取域 schema（E-8；loader 抛错不缓存，失败域下次仍可重试） */
async function loadSchemaCached(domain: DomainDef): Promise<SettingsSchema> {
  const hit = schemaCache.get(domain.id);
  if (hit) return hit;
  const schema = await domain.schemaLoader!();
  schemaCache.set(domain.id, schema);
  return schema;
}

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
 *  UI-8 口径如实化：进入域（renderDomain 联动）/重开面板（preload）时重算，refresh 链经
 *  renderHandles 包装同步——visibleWhen 门控变化后徽标跟随，不再只是首载快照。 */
const navBadges = new Map<string, string>();

function badgeOf(d: DomainDef): string {
  if (d.noSettings || !d.schemaLoader) return '—';
  return navBadges.get(d.id) ?? '·';
}

/** 可见设置项总数（issue 186 徽标口径 = 设置项数，非分组数）：
 *  组级/行级 visibleWhen 求值 false 的不计（求值异常保守视为可见）；button 操作行不计；
 *  isChild 行按「组级父项开关」合成判定（UI-8 与组卡「N 项」徽标同口径——父关时子行不计，
 *  与渲染器 H2 的合成条件一致）。导出供回归测试断言（与 DOMAINS/loadedCounts 同惯例）。 */
export function visibleItemCount(schema: SettingsSchema): number {
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
    // isChild 合成（H2 同口径）：本组首个键直绑 toggle = 组级父项
    const parentToggleKey = (
      g.rows.find(
        (pr) => pr.type === 'toggle' && typeof (pr.binding as { key?: string } | undefined)?.key === 'string'
      ) as { binding: { key: string } } | undefined
    )?.binding.key ?? null;
    for (const r of g.rows) {
      if (r.type === 'button') continue;
      const rvw = (r as { visibleWhen?: (s: unknown) => boolean }).visibleWhen;
      let visible = true;
      if (rvw) {
        try {
          visible = !!rvw(tryGetSettings() as unknown as never);
        } catch {
          /* 求值异常视为可见 */
        }
      }
      if (visible && (r as { isChild?: boolean }).isChild && parentToggleKey) {
        visible = (tryGetSettings() as unknown as Record<string, unknown>)[parentToggleKey] === true;
      }
      if (visible) n++;
    }
  }
  return n;
}

/* ==================== 面板 UI（桌面 B + 移动 M1） ==================== */

export class SettingsPanelUI {
  private mask: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  /** 当前激活域 id（按 id 驱动：可见域过滤后索引会错位，不用数字下标） */
  private activeDomainId = 'global';
  /** 桌面导航容器引用（schema 加载后回填徽标用） */
  private navEl: HTMLElement | null = null;
  /** 保存渲染句柄，域切换时 dispose（防旧句柄 refresh 干扰） */
  private renderHandles: Array<{ refresh: () => void }> = [];
  /** 域渲染竞态序号（P2-4：每次 renderDomain 自增，await 后校验丢弃过期渲染） */
  private renderSeq = 0;
  /** 域滚位会话记忆（SP5/呈报#49；clipbook 效率#17 样板）：域名 → 离开时的 scrollTop。
   *  桌面滚动元素 = .bz-sp-desk-main（pane 父级）、移动 = .bz-sp-mob-page-body（pane 自身），
   *  key 以端前缀区分；cleanup 随面板销毁清空（会话内有效）。 */
  private scrollMem = new Map<string, number>();
  /** 列表重绘回调（桌面导航/移动列表各自注册；preload 解析出零项域后剔除重绘） */
  private rerenderList: (() => void) | null = null;
  /** 移动端推入状态：home = 首页列表；domain = 已推入域设置页 */
  private mobPushed = false;
  /** 当前搜索词（桌面：切域重渲后按它重刷命中/过滤状态）。
   *  2026-09-12 用户拍板：去掉「只看命中」开关，搜索即过滤（默认恒开）。 */
  private searchQuery = '';
  /** 徽标预载在途 Promise（ARCH-2 单飞：并发 open 收敛为一轮，磁盘 IO 域不双倍重跑） */
  private preloadInFlight: Promise<void> | null = null;

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
      // ESC 栈序与 z 序重同步（checkup 深审 ui P2-1 同刀）：hide 型常驻层重开只抬 z 不抬
      // ESC 栈会失配（z 序正确、ESC 却先关底下被盖住的面板）。重放注册——registerPanelEsc
      // 的幂等样板「已注册即跳过」不解决抬栈，须先 unregisterPanelEsc 再挂，注册序自此
      // 跟随显示序。
      unregisterPanelEsc('bz-settings-panel');
      this.armPanelEsc();
      if (deep && isMobileEnv()) {
        void this.pushDomain(deep);
      } else if (deep) {
        // 桌面深链（H3）：面板已开也要落到目标域——重绘导航（选中态跟手）+ 重渲内容区，
        // 只改 activeDomainId 不重绘会让「在设置中编辑」停在原域
        this.rerenderList?.();
        const pane = this.popup.querySelector('.bz-sp-pane') as HTMLElement | null;
        if (pane) void this.renderDomain(pane, deep);
      }
      // 会话内其他域徽标可能已过期（preload 只在首次 build 跑）——重开即重算（H9）。
      // 先从会话缓存同步重算（单飞在途时新轮被收敛，缓存重算保住新鲜度），再起新轮预载
      this.recomputeBadgesFromCache();
      // 动效挂点：软重开 = 重新通电（尘光/萤标随 open 链唤醒，见 motion.ts 睡眠/唤醒）
      spm.motionPanelIn(this.popup, this.mask);
      spm.motionEnsureDust(this.popup);
      void this.preloadAllBadges();
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

    // C-5：面板 ESC 注册收编 registerPanelEsc 幂等样板（八域先例，删 escHandle 手写形制）
    this.armPanelEsc();
    // E-3：打开即聚焦首个可交互元素（core uiModal firstFocusable 范式）——桌面 = 头行搜索框，
    // 键盘流第一步可达（搜索 → ↑↓ 切域 → ESC 关全链键盘闭环）；移动端跳过输入框聚焦关闭钮
    firstFocusable(popup)?.focus();
    // 呈报#13 F3+H3：补 Tab 圈闭（入焦保持 E-3 的首个可交互元素口径，不夺焦；纯接线一行）——
    // build 每开重建 popup，监听随元素弃置，无需存句柄
    trapFocus(popup);
  }

  /* ---------- 桌面：B 侧栏工作台（头行 + 左导航 + 右内嵌渲染） ---------- */

  private buildDesktop(popup: HTMLElement): void {
    popup.classList.add('bz-sp-desk');
    // 壳结构单源（R.deskShellHtml：头行 + 左导航 + 右内容区，逐字原型）
    popup.innerHTML = R.deskShellHtml();
    mountIcons(popup); // 头行搜索图标占位物化

    // 更新日志入口（issue 472）：footer 静态壳内容，绑定一次（nav 重渲不波及）；
    // issue 474 起与手册同刀——一键 = 无日志先下载再打开，已下载直接打开
    const chgBtn = popup.querySelector<HTMLElement>('[data-sp-changelog]');
    chgBtn?.addEventListener('click', () => void this.runChangelogOpen(chgBtn));

    // 使用手册入口（issue 473）：一键 = 无手册先下载再打开，已下载直接打开；
    // 下载期间按钮图标转圈（.is-loading + loader）防重入，完成/失败复原（见 runManualOpen）
    const manBtn = popup.querySelector<HTMLElement>('[data-sp-manual]');
    manBtn?.addEventListener('click', () => void this.runManualOpen(manBtn));

    const nav = popup.querySelector('.bz-sp-nav') as HTMLElement;
    this.navEl = nav;
    const pane = popup.querySelector('.bz-sp-pane') as HTMLElement;
    const searchIn = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;

    // 键盘导航（2026-09-12 补）：↑↓ 在可见域间前后切换（顺序同导航视觉顺序）
    popup.addEventListener('keydown', (e) => this.onNavKey(e, pane));

    // E-4 roving tabindex：左栏导航收敛为 Tab 序单站——容器可聚焦、域钮退出 Tab 序，
    // 容器聚焦后 ↑↓ 在域钮间移焦点（Enter 原生点击），到内容区首个控件不再穿 20+ 次 Tab
    nav.tabIndex = 0;
    nav.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...nav.querySelectorAll<HTMLElement>('.bz-sp-nav-item')];
      if (!items.length) return;
      e.preventDefault();
      e.stopPropagation(); // 导航容器内 ↑↓ 专用于 roving 焦点，不冒泡给面板 ↑↓ 切域
      const cur = items.indexOf(document.activeElement as HTMLElement);
      const next = cur < 0
        ? (e.key === 'ArrowDown' ? 0 : items.length - 1)
        : e.key === 'ArrowDown' ? Math.min(cur + 1, items.length - 1) : Math.max(cur - 1, 0);
      items[next].focus();
    });

    const renderNav = (q: string) => {
      const query = q.trim();
      nav.innerHTML = '';
      // 无设置项/当前端零设置项的域不在左侧列表显示（用户拍板 + issue 194）；搜索同样只搜列表可见域
      const visible = listableDomains();
      // 搜索命中：域名/描述 + 已加载域的设置项行名（只匹配行名——desc 常含跨域引用词会误命中；
      // UI-7：大小写不敏感归一）
      const matches = (d: DomainDef) =>
        !query || spMatch(d.name, query) || spMatch(d.desc, query) ||
        (schemaRowCache.get(d.id) || []).some((r) => spMatch(r.name, query));
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
        b.tabIndex = -1; // E-4：域钮退出 Tab 序（roving 由容器接管）
        const id = b.dataset.spDomain!;
        b.addEventListener('click', () => {
          this.activeDomainId = id;
          renderNav(searchIn.value);
          void this.renderDomain(pane, DOMAINS.find((x) => x.id === id)!);
        });
      });
      // 动效挂点：萤标跟随新选中项（重建后 sync，幂等）——不推迟任何 DOM 就位
      spm.motionNavSynced(nav);
    };

    // E-5：搜索输入 180ms 防抖（每键全量重建导航/列表收敛为一停顿一次；纯 UI 重绘无数据丢失面）
    const applySearch = debounce(() => {
      renderNav(searchIn.value);
      // 搜索即过滤（2026-09-12 用户拍板：命中行高亮，未命中行与空组隐藏，无开关恒开）；
      // 切域重渲后按 searchQuery 以同一口径复刷
      this.searchQuery = searchIn.value.trim();
      this.applyHitFilter(popup, this.searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    searchIn.addEventListener('input', () => applySearch());
    // 搜索键盘闭环（SP3+SP4/呈报#17；clipbook 效率#11 二段清词先例同刀）：
    // - ESC 二段语义（✕ 清除钮已退役，ESC 是唯一清词口）：有词 = 清词复显 + 拦冒泡（escManager
    //   在 document 层收不到，面板不关）+ 焦点回框；无词 = 放行（面板关闭语义不变）
    // - Enter = 跳第一个命中域（与点击同一动线：导航选中态重绘 + 内容区渲染 + 跟手滚动）
    searchIn.addEventListener('keydown', (e) => {
      const q = searchIn.value.trim();
      if (e.key === 'Escape' && q) {
        e.preventDefault();
        e.stopImmediatePropagation();
        searchIn.value = '';
        this.searchQuery = '';
        renderNav('');
        this.applyHitFilter(popup, '');
        searchIn.focus();
        return;
      }
      if (e.key === 'Enter' && q) {
        const first = this.matchedDomains(q)[0];
        if (!first) return;
        e.preventDefault();
        this.activeDomainId = first.id;
        renderNav(searchIn.value);
        void this.renderDomain(pane, first);
        this.navEl
          ?.querySelector<HTMLElement>(`.bz-sp-nav-item[data-sp-domain="${first.id}"]`)
          ?.scrollIntoView({ block: 'nearest' });
      }
    });
    renderNav('');
    // 动效挂点：导航悬停微浮（委托绑 nav 容器，重建免疫）
    spm.motionBindNavFeel(nav);
    // 注册列表重绘回调：preload 解析出零项域后按当前搜索词重绘导航（issue 194 按端隐藏）
    this.rerenderList = () => renderNav(searchIn.value);
    void this.renderDomain(pane, DOMAINS.find((x) => x.id === this.activeDomainId) ?? DOMAINS[0]);
    // 动效挂点（面板级，build 一次）：通电入场 + 按压实感 + 灯下尘常驻
    // （萤标已由 renderNav→motionNavSynced 自建；markup 契约零改写，见 motion.ts）
    spm.motionPanelIn(popup, this.mask);
    spm.motionBindPressFeel(popup);
    spm.motionEnsureDust(popup);
  }

  /* 使用手册一键（issue 473）：无手册先下载再打开，已下载直接打开（core/manual 单源）。
   * 下载期间按钮图标换 loader + .is-loading 转圈（用户拍板：不弹窗不要进度条），
   * 完成/失败 finally 复原 book-open；就绪后在 Obsidian 内独立弹窗内嵌渲染
   * （manual-viewer，srcdoc 直灌，不走系统浏览器）；失败原因由 core/manual 的
   * Error 消息出人话 notice——本层只兜下载/读取抛错。 */
  private async runManualOpen(btn: HTMLElement): Promise<void> {
    if (btn.classList.contains('is-loading')) return; // 下载中防重入
    const ic = btn.querySelector<HTMLElement>('.bz-ic');
    btn.classList.add('is-loading');
    try {
      const [core, viewer] = await Promise.all([
        import('../core/manual'),
        import('./manual-viewer'),
      ]);
      if (ic) setIcon(ic, 'loader');
      const html = await core.ensureManualReady(getApp());
      viewer.openManualViewer(html);
    } catch (e) {
      notice((e as Error)?.message || '手册下载失败', 'error');
    } finally {
      btn.classList.remove('is-loading');
      if (ic) setIcon(ic, 'book-open');
    }
  }

  /* 更新日志一键（issue 474）：与手册同口径——日志不随构建分发，现场从 GitHub 下载
   * manual/bz-changelog.html 再在 OB 内独立弹窗内嵌渲染（iframe srcdoc，与手册同范式）。
   * 下载期间按钮图标换 loader + .is-loading 转圈防重入；失败不兜底（用户拍板：
   * 不退回内置快照），core/changelog 的人话原因出 notice，弹窗不开。 */
  private async runChangelogOpen(btn: HTMLElement): Promise<void> {
    if (btn.classList.contains('is-loading')) return; // 下载中防重入
    const ic = btn.querySelector<HTMLElement>('.bz-ic');
    btn.classList.add('is-loading');
    try {
      const [core, modal] = await Promise.all([
        import('../core/changelog'),
        import('./changelog'),
      ]);
      if (ic) setIcon(ic, 'loader');
      const html = await core.ensureChangelogReady(getApp());
      modal.openChangelogModal(html);
    } catch (e) {
      notice((e as Error)?.message || '更新日志下载失败', 'error');
    } finally {
      btn.classList.remove('is-loading');
      if (ic) setIcon(ic, 'history');
    }
  }

  /** 从会话 schema 缓存同步重算全部域徽标（H9 × ARCH-2 合流：软重开遇预载单飞在途时，
   *  新轮被收敛不重跑——缓存重算保证「重开即重算」新鲜度；visibleWhen 按当前设置实时求值） */
  private recomputeBadgesFromCache(): void {
    for (const d of DOMAINS) {
      const schema = schemaCache.get(d.id);
      if (!schema) continue;
      const count = visibleItemCount(schema);
      loadedCounts.set(d.id, count);
      navBadges.set(d.id, count > 0 ? String(count) : '—');
    }
    this.refreshNavBadges();
  }

  /**
   * 预加载全部有 schema 的域，回填左侧导航徽标（设置项总数）。
   * 面板打开即算全量徽标（用户拍板：无需先点击各域）。
   * 只经会话缓存取 schema 结构（E-8），不渲染 UI；副作用与点击加载一致（review.ensure 幂等）。
   * 组级/行级 visibleWhen 门控（如移动端组）按当前端环境过滤。
   * ARCH-2 单飞：上一轮在途时复用同一 Promise——并发 open（命令重跑/深链）不再并发重跑
   * 全量 loader（含磁盘 IO 域，重建风暴由轮末单次重绘收敛）；软重开的新鲜度由
   * recomputeBadgesFromCache 兜底（H9 语义保持），完成后新 open 自然起新轮。
   */
  private async preloadAllBadges(): Promise<void> {
    if (this.preloadInFlight) return this.preloadInFlight;
    const run = (async () => {
      const tasks = DOMAINS.filter((d) => d.schemaLoader).map(async (d) => {
        try {
          const schema = await loadSchemaCached(d);
          const count = visibleItemCount(schema);
          loadedCounts.set(d.id, count);
          navBadges.set(d.id, count > 0 ? String(count) : '—');
          // 顺带填充移动端搜索「设置项」缓存
          cacheRowsFor(d.id, schema);
        } catch {
          navBadges.set(d.id, '·'); // 加载失败保守显示占位（域保持列表可见）
        }
        this.refreshNavBadges();
      });
      await Promise.allSettled(tasks);
      // 全部解析完一次重绘（ARCH-2：每域完成各触发一次全量重建的重建风暴收敛为单次；
      // 零项域按端剔除口径不变）
      this.rerenderList?.();
    })();
    this.preloadInFlight = run;
    try {
      await run;
    } finally {
      if (this.preloadInFlight === run) this.preloadInFlight = null;
    }
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
    // F-2：移除聚焦输入框前先真实 blur——浏览器对「从 DOM 移除聚焦元素」不派发 blur，
    // 防抖窗口内的编辑会随元素静默丢弃（↑↓ 切域/深链重渲路径的丢字缺口）
    this.flushPendingTextCommit();
    // SP5：离开旧域前存滚位（pane.dataset.spActive = 上次渲染成功的域 id）；
    // 渲染完成后回填目标域滚位——切域/重进域不再每次回顶
    const side = isMobileEnv() ? 'm' : 'd';
    const scroller = (isMobileEnv() ? pane : pane.parentElement) ?? pane;
    const prevId = pane.dataset.spActive;
    if (prevId) this.scrollMem.set(`${side}:${prevId}`, scroller.scrollTop);
    // 清理旧渲染句柄
    this.renderHandles = [];
    pane.innerHTML = '';

    // 域页头（桌面：域名 + 描述 + 「重置本域」+ 右侧项数/组数徽标；移动端推入页头行已有域名，跳过）
    let pageHead: HTMLElement | null = null;
    if (opts.withHead !== false) {
      const headHolder = document.createElement('div');
      headHolder.innerHTML = R.pageHeadHtml(domain.name, domain.desc, '', true);
      pageHead = headHolder.firstElementChild as HTMLElement;
      // 「重置本域」（2026-09-12 补）：本域 schema 里带字符串键的行恢复 DEFAULT 值
      pageHead.querySelector('.bz-sp-page-reset')?.addEventListener('click', () => {
        void this.resetDomain(domain, pane);
      });
      pane.appendChild(pageHead);
    }

    // 无设置项域 → 空态
    if (domain.noSettings || !domain.schemaLoader) {
      pane.appendChild(this.emptyEl(
        'settings',
        `${domain.name} · 暂无设置项`,
        '该域没有可在此配置的设置（设置就近在对应功能面板）'
      ));
      pane.dataset.spActive = domain.id;
      scroller.scrollTop = 0;
      return;
    }

    // 惰性加载 schema 并内嵌渲染
    const body = document.createElement('div');
    body.className = 'bz-sp-settings-body';
    pane.appendChild(body);
    body.innerHTML = R.loadingHtml(); // 加载态结构单源

    try {
      const schema = await loadSchemaCached(domain);
      if (runId !== this.renderSeq) return; // 已有更新的渲染任务，放弃本次结果
      body.innerHTML = '';
      const handle = renderPanelSchema(body, schema);
      // UI-8：refresh 链联动 nav 徽标——「visibleWhen 门控变化后徽标自动跟随」承诺兑现
      //（visibleItemCount 已补 isChild 合成，与组卡「N 项」徽标同口径）
      const refreshWithBadge = () => {
        handle.refresh();
        const cnt = visibleItemCount(schema);
        navBadges.set(domain.id, cnt > 0 ? String(cnt) : '—');
        this.refreshNavBadges();
      };
      this.renderHandles.push({ refresh: refreshWithBadge });
      // 记录本域 schema 行（移动端搜索「设置项」段用）
      cacheRowsFor(domain.id, schema);
      // 回填导航徽标：设置项总数（visibleWhen 门控隐藏的不计、button 操作行不计，与 preload 同口径）；
      // 0 项显示 —（无可见设置项，与 preloadAllBadges 口径一致——H9 收口，原 · 是两处口径漂移）
      const groupEls = body.querySelectorAll<HTMLElement>('.bz-sp-group');
      const visibleGroups = [...groupEls].filter((g) => g.style.display !== 'none').length;
      const count = visibleItemCount(schema);
      navBadges.set(domain.id, count > 0 ? String(count) : '—');
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
      // 切域/重渲后按当前搜索词复刷命中高亮与过滤（H：状态跨域保持）
      this.applyHitFilter(pane, this.searchQuery);
      // SP5：记账本域 + 回填记忆滚位——重进域回到离开时的位置（过滤后行高已定，钳制自然兜底）
      pane.dataset.spActive = domain.id;
      scroller.scrollTop = this.scrollMem.get(`${side}:${domain.id}`) ?? 0;
      // 动效挂点：翻层揭帘（DOM 已全部就位后纯表现编排，绝不推迟重写——契约见 motion.ts）
      spm.motionRendered(pane);
      return;
    } catch (e) {
      body.innerHTML = '';
      // 失败页也记账（滚位归零——失败态无位置可记，防旧域滚位错记到失败页）
      pane.dataset.spActive = domain.id;
      scroller.scrollTop = 0;
      // C-4：收编 notifyActionError+onRetry 定稿范式——非 Error 抛出物不再显示 "undefined"，
      // 通知自带「重试」出口；空态下沿同挂一枚重试按钮走同一回调
      const retry = () => void this.renderDomain(pane, domain);
      const actions = document.createElement('div');
      actions.className = 'bz-sp-load-retry';
      actions.appendChild(uiBtn({ label: '重试', tone: 'primary', onClick: retry }));
      const empty = this.emptyEl('alert-circle', '加载失败', e instanceof Error ? e.message : String(e));
      empty.appendChild(actions);
      body.appendChild(empty);
      notifyActionError(e, `加载「${domain.name}」设置`, { onRetry: retry });
    }
  }

  /**
   * 命中高亮 + 搜索过滤（2026-09-12 补，桌面；用户拍板：无开关，搜索即过滤）：
   * - q 非空时给命中行加 .hit，并隐藏未命中行与「无可见行」的组；q 清空恢复全显；
   * - **只回收自己设过的**内联 display，不触碰渲染器 visibleWhen 的隐藏
   *   （F-1：打标只记「本次过滤亲手藏的」——display 已为 none 的门控行不碰不标，
   *   恢复分支因此永不放行 visibleWhen 隐藏的行/组；清空后再经渲染句柄 refresh 重求值门控兜底）；
   * - 组卡「N 项」徽标按当前可见行数重算（UI-6：搜索态计数与实际可见行数一致）。
   */
  private applyHitFilter(root: HTMLElement, q: string): void {
    root.querySelectorAll<HTMLElement>('.bz-sp-set-row').forEach((row) => {
      if (row.dataset.spHitHidden === '1') {
        row.style.display = '';
        delete row.dataset.spHitHidden;
      }
      const hit = !!q && !!row.textContent && spMatch(row.textContent, q);
      row.classList.toggle('hit', hit);
      this.markHitText(row, q);
      if (q && !hit && row.style.display !== 'none') {
        row.style.display = 'none';
        row.dataset.spHitHidden = '1';
      }
    });
    root.querySelectorAll<HTMLElement>('.bz-sp-group').forEach((g) => {
      if (g.dataset.spHitHidden === '1') {
        g.style.display = '';
        delete g.dataset.spHitHidden;
      }
      if (!q) return;
      const any = [...g.querySelectorAll<HTMLElement>('.bz-sp-set-row')].some((r) => r.style.display !== 'none');
      if (!any && g.style.display !== 'none') {
        g.style.display = 'none';
        g.dataset.spHitHidden = '1';
      }
    });
    if (!q) {
      // F-1 纵深：恢复后经渲染句柄重求值门控（搜索期间门控条件若变化，此处重新落位）
      this.renderHandles.forEach((h) => h.refresh());
    }
    refreshGroupCounts(root);
  }

  /**
   * 命中词词级高亮（SP2/呈报#26；UX-1）：行名与描述段内的全部命中词包
   * `<mark class="bz-sp-mark">`——整行色条（.hit）之外的一眼定位。原文先存
   * data-sp-orig（行 DOM 生命周期内的还原底稿）再按小写归一切片重建文本节点，
   * 不做动态 regex（与 UX-1 修法建议同口径，无注入面）；q 清空按 orig 还原。
   */
  private markHitText(row: HTMLElement, q: string): void {
    const needle = q.trim().toLowerCase();
    row.querySelectorAll<HTMLElement>('.bz-sp-set-name, .bz-sp-set-desc').forEach((el) => {
      if (el.dataset.spOrig === undefined) el.dataset.spOrig = el.textContent ?? '';
      const text = el.dataset.spOrig ?? '';
      el.textContent = '';
      if (!needle) {
        el.textContent = text;
        return;
      }
      const lower = text.toLowerCase();
      let cursor = 0;
      for (;;) {
        const at = lower.indexOf(needle, cursor);
        if (at < 0) break;
        if (at > cursor) el.append(document.createTextNode(text.slice(cursor, at)));
        const mark = document.createElement('mark');
        mark.className = 'bz-sp-mark';
        mark.textContent = text.slice(at, at + needle.length);
        el.append(mark);
        cursor = at + needle.length;
      }
      if (cursor < text.length) el.append(document.createTextNode(text.slice(cursor)));
    });
  }

  /**
   * 键盘导航（2026-09-12 补，桌面）：↑↓ 在可见域间前后切换，顺序 = 导航视觉顺序
   * （NAV_SECS 分组序，与左栏自上而下一致）。多行文本 / 下拉 / 单行输入里让位（SP1/呈报#17：
   * 输入框内 ↑↓ 是光标移动——搜索框与文本设置行里不再借道切域）。
   * F-6：搜索态与 renderNav 同源——只在当前命中（导航可见）集内移动，切到的一定是看得见的域；
   * 当前域不在命中集时 ↓/↑ 进首/末个命中域；命中集为空 no-op。
   */
  private onNavKey(e: KeyboardEvent, pane: HTMLElement): void {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'INPUT')) return;
    const ordered = this.matchedDomains(this.searchQuery);
    if (!ordered.length) return;
    const idx = ordered.findIndex((d) => d.id === this.activeDomainId);
    let next: number;
    if (idx < 0) {
      next = e.key === 'ArrowDown' ? 0 : ordered.length - 1;
    } else {
      next = e.key === 'ArrowDown' ? Math.min(idx + 1, ordered.length - 1) : Math.max(idx - 1, 0);
      if (next === idx) return;
    }
    e.preventDefault();
    const d = ordered[next];
    this.activeDomainId = d.id;
    this.rerenderList?.(); // 重绘导航：选中态跟手（与点击同一路径）
    void this.renderDomain(pane, d);
    this.navEl
      ?.querySelector<HTMLElement>(`.bz-sp-nav-item[data-sp-domain="${d.id}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }

  /** 搜索命中域集（导航视觉序；↑↓ 切域与 Enter 首跳共用同一口径，F-6 不漂移） */
  private matchedDomains(q: string): DomainDef[] {
    const query = q.trim();
    const matches = (d: DomainDef) =>
      !query || spMatch(d.name, query) || spMatch(d.desc, query) ||
      (schemaRowCache.get(d.id) || []).some((r) => spMatch(r.name, query));
    return groupDomains(listableDomains(), matches).flatMap((s) => s.domains);
  }

  /**
   * 重置本域（2026-09-12 补）：把本域 schema 中带**字符串键**的行恢复为 DEFAULT_SETTINGS 值，
   * 落盘后重渲。三函数 binding 的行（无键，如 per-provider 覆盖 / 钳制类）跳过——无通用默认值可查，
   * 误写风险大于收益。破坏性动作，flow 确认在前，不能一点就改。
   */
  private async resetDomain(domain: DomainDef, pane: HTMLElement): Promise<void> {
    if (!domain.schemaLoader) return;
    let schema: SettingsSchema;
    try {
      schema = await loadSchemaCached(domain);
    } catch (e) {
      // C-4：收编 notifyActionError+onRetry（非 Error 抛出物不再显示 "undefined"，带重试出口）
      notifyActionError(e, `读取「${domain.name}」设置`, { onRetry: () => void this.resetDomain(domain, pane) });
      return;
    }
    const keys = new Set<string>();
    for (const g of schema.groups) {
      for (const r of g.rows) {
        const k = (r as { binding?: { key?: string } }).binding?.key;
        if (k) keys.add(k);
      }
    }
    if (!keys.size) {
      notice(`「${domain.name}」没有可重置的设置项`, 'info');
      return;
    }
    const ans = await openFlowDialog({
      title: '重置本域设置',
      message: `把「${domain.name}」的设置项恢复为默认值（未改动的项不受影响）。确定继续吗？`,
      // 面板体系皮肤（2026-09-25）：流程框挂 .bz-sp-skin 才拿得到 --sp-*（否则回落到组件库中性冷色，
      // 亮皮下弹窗是纯白、按钮同色看不见）——与路径选择器/各管理弹窗同一口径
      className: 'bz-sp-skin',
      actions: [
        { label: '取消', value: 'cancel' },
        // E-2：破坏性动作 danger 反焦（全仓惯例）——主按钮不默认持焦，防 Enter 一击即重置
        { label: '重置', value: 'ok', cta: true, danger: true },
      ],
    });
    if (ans !== 'ok') return;
    const { DEFAULT_SETTINGS } = await import('../settings');
    const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
    const s = getSettings() as unknown as Record<string, unknown>;
    let n = 0;
    for (const k of keys) {
      const def = defaults[k];
      if (def === undefined) continue;
      s[k] = Array.isArray(def) ? [...def] : def; // 数组浅拷贝：别把 DEFAULT 里的数组引用写进设置
      n++;
    }
    try {
      await saveSettings();
    } catch (e) {
      // F-5：批写落盘失败不再假成功——内存已重置（所见即所得），人话提示 + 重渲，成功提示跳过
      notifySaveError(e, `重置「${domain.name}」`);
      void this.renderDomain(pane, domain);
      return;
    }
    notice(`「${domain.name}」已重置 ${n} 项`, 'success');
    void this.renderDomain(pane, domain);
  }

  /* ---------- 移动端：全屏推入式两页（首页搜索 + 域列表 → 推入域设置页） ---------- */

  private buildMobile(popup: HTMLElement): void {
    // bz-panel-mtop：≤768px 顶部避让 Obsidian 移动端头部（max(44px, 安全区)，全站统一档）
    popup.classList.add('bz-sp-mobile', 'bz-panel-mtop');
    popup.innerHTML = R.mobShellHtml();
    this.mobPushed = false; // 面板重建（含上次关闭时停在推入页）从首页起

    // 两页头行工具：**只有首页一枚关闭钮**；域页不设关闭（用户 2026-09-10 拍板——
    // 域页已有一枚返回钮弹回首页，再叠一枚关闭会与它并排、误触率高；关面板走首页那枚）。
    // UI-4：32px 主导航钮挂 bz-touch-target（-6px 外扩触屏达 44px 档）
    const homeTools = popup.querySelector('[data-sp-mob-tools="home"]') as HTMLElement;
    homeTools.appendChild(uiIconBtn({ icon: 'x', lg: true, title: '关闭', className: 'bz-sp-mob-close bz-touch-target', onClick: () => this.hide() }));
    const back = popup.querySelector('[data-sp-mob-back]') as HTMLElement;
    back.appendChild(uiIconBtn({ icon: 'arrow-left', lg: true, title: '返回', className: 'bz-sp-mob-back-btn bz-touch-target', onClick: () => this.popDomain() }));
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
        // 搜索：域段 + 设置项段（同样只搜列表可见域；UI-7：大小写不敏感归一）
        const doms = listableDomains().filter((d) => spMatch(d.name, query) || spMatch(d.desc, query));
        const rows: Array<{ domain: DomainDef; name: string; desc: string }> = [];
        schemaRowCache.forEach((rowsOf, did) => {
          const d = DOMAINS.find((x) => x.id === did);
          if (!d) return;
          rowsOf.forEach((r) => {
            if (spMatch(r.name, query) || (r.desc && spMatch(r.desc, query))) rows.push({ domain: d, name: r.name, desc: r.desc || d.name });
          });
        });
        let html = '';
        if (doms.length) {
          html += `<div class="bz-sp-mob-sec">域（${doms.length}）</div>`;
          doms.forEach((d) => { html += R.mobItemHtml({ id: d.id, icon: d.icon, name: d.name, desc: d.desc }); });
        }
        if (rows.length) {
          html += `<div class="bz-sp-mob-sec">设置项（${rows.length}）</div>`;
          // row = 行名（data-sp-row）：推入该域后据此滚动定位并高亮（2026-09-12 补）
          rows.forEach((r) => { html += R.mobItemHtml({ id: r.domain.id, icon: r.domain.icon, name: r.name, desc: `${r.domain.name} · ${r.desc}`, kind: '设置', row: r.name }); });
        }
        if (!doms.length && !rows.length) html = `<div class="bz-sp-mob-empty">没有匹配「${R.esc(query)}」的设置或域</div>`;
        list.innerHTML = html;
      }
      list.querySelectorAll<HTMLElement>('.bz-sp-mob-item').forEach((b) => {
        const d = DOMAINS.find((x) => x.id === b.dataset.spDomain);
        // 设置项命中带 data-sp-row → 推入后定位到该行（2026-09-12 补）
        if (d) b.addEventListener('click', () => void this.pushDomain(d, b.dataset.spRow));
      });
      mountIcons(list); // 列表项图标占位物化（render 重绘后补挂）
      // 动效挂点：列表项轻浮接力（DOM 已就位的纯表现层，前 12 项，其余直达）
      spm.motionMobList(list);
    };

    // E-5：搜索输入 180ms 防抖（每键全量重建列表 + 图标物化收敛，同桌面口径）
    const applySearch = debounce(() => render(searchIn.value), SEARCH_DEBOUNCE_MS);
    searchIn.addEventListener('input', () => applySearch());
    // 搜索键盘闭环（SP3+SP4/呈报#17，桌面同刀）：ESC 有词清词拦冒泡（面板不关）、无词放行；
    // Enter 跳第一个命中（域段优先，其次设置项段——与列表渲染序一致，设置项命中带定位行）
    searchIn.addEventListener('keydown', (e) => {
      const q = searchIn.value.trim();
      if (e.key === 'Escape' && q) {
        e.preventDefault();
        e.stopImmediatePropagation();
        searchIn.value = '';
        render('');
        searchIn.focus();
        return;
      }
      if (e.key === 'Enter' && q) {
        const doms = listableDomains().filter((d) => spMatch(d.name, q) || spMatch(d.desc, q));
        if (doms.length) {
          e.preventDefault();
          void this.pushDomain(doms[0]);
          return;
        }
        // 域段未命中时取设置项段首个命中（schemaRowCache 迭代序 = preload 加载序）
        let hit: { domain: DomainDef; row: string } | null = null;
        for (const [did, rowsOf] of schemaRowCache) {
          const d = DOMAINS.find((x) => x.id === did);
          const r = d ? rowsOf.find((rr) => spMatch(rr.name, q) || (rr.desc && spMatch(rr.desc, q))) : undefined;
          if (d && r) { hit = { domain: d, row: r.name }; break; }
        }
        if (hit) {
          e.preventDefault();
          void this.pushDomain(hit.domain, hit.row);
        }
      }
    });
    render('');
    // 动效挂点（面板级，build 一次）：通电入场 + 按压实感 + 灯下尘常驻（尘挂域页滚动域）
    spm.motionPanelIn(popup, this.mask);
    spm.motionBindPressFeel(popup);
    spm.motionEnsureDust(popup);
    // 注册列表重绘回调：preload 解析出零项域后按当前搜索词重绘列表（issue 194 按端隐藏）
    this.rerenderList = () => { if (!this.mobPushed) render(searchIn.value); };
  }

  /** 推入域设置页（全屏页切换；返回/ESC 弹回首页）。
   *  focusRow（2026-09-12 补）：来自搜索「设置项」命中 → 渲染完成后滚动定位并高亮该行。
   *  E-6：域页工具位挂「重置本域」图标钮——移动端重置动线此前不存在（withHead:false 连带
   *  砍掉页头重置钮），flow 确认弹窗在移动端同样可用；重复推入先清工具位防叠挂。 */
  private async pushDomain(domain: DomainDef, focusRow?: string): Promise<void> {
    const popup = this.popup!;
    this.mobPushed = true;
    (popup.querySelector('.bz-sp-mob-title') as HTMLElement).textContent = domain.name;
    popup.classList.add('bz-sp-mob-pushed');
    const tools = popup.querySelector('[data-sp-mob-tools="domain"]') as HTMLElement;
    tools.replaceChildren();
    tools.appendChild(uiIconBtn({
      icon: 'rotate-ccw', lg: true, title: '重置本域', className: 'bz-touch-target',
      onClick: () => void this.resetDomain(domain, popup.querySelector('.bz-sp-mob-page-body') as HTMLElement),
    }));
    const body = popup.querySelector('.bz-sp-mob-page-body') as HTMLElement;
    await this.renderDomain(body, domain, { withHead: false });
    if (focusRow) this.focusRowIn(body, focusRow);
  }

  /** 滚动定位到指定行并高亮（行名匹配 .bz-sp-set-name；找不到静默跳过）。 */
  private focusRowIn(body: HTMLElement, rowName: string): void {
    const target = [...body.querySelectorAll<HTMLElement>('.bz-sp-set-row')].find(
      (el) => el.querySelector('.bz-sp-set-name')?.textContent === rowName
    );
    if (!target) return;
    target.classList.add('hit');
    target.scrollIntoView({ block: 'center' });
  }

  /** 弹回首页（作废进行中的域渲染；下次推入重渲） */
  private popDomain(): void {
    this.mobPushed = false;
    this.renderSeq++; // 作废未完成的域渲染任务
    this.popup?.classList.remove('bz-sp-mob-pushed');
  }

  /** 面板 ESC 层注册（build 与重开共用；重开由 open 先 unregisterPanelEsc 再走本方法抬栈） */
  private armPanelEsc(): void {
    registerPanelEsc('bz-settings-panel', () => !!this.mask && this.mask.style.display === 'block', () => {
      // 移动端推入页先弹回首页，再次 ESC 才收面板
      if (this.popup?.classList.contains('bz-sp-mob-pushed')) this.popDomain();
      else this.hide();
    });
  }

  hide(): void {
    // UI-1 纵深：软关前强制收起自绘下拉——菜单 DOM 与组卡提层样式不留残，重开面板不「复活」
    if (this.popup) closeAllSelectMenus(this.popup);
    // 动效挂点：软关入睡（编排定时器清空 + 双系统停泵；唤醒在 open→motionPanelIn 链）
    spm.motionSleep();
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  /** F-2：移除聚焦输入框前 flush 防抖——面板内 INPUT/TEXTAREA 持焦时真实 blur（触发已注册
   *  blur commit 监听立即落盘），防「从 DOM 移除聚焦元素不派发 blur」的静默丢字。 */
  private flushPendingTextCommit(): void {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      this.popup?.contains(active) &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    ) {
      active.blur();
    }
  }

  cleanup(): void {
    unregisterPanelEsc('bz-settings-panel'); // C-5：幂等注销样板
    // 动效挂点：全清（泵/监听/注入件状态全收，幂等）——先于 DOM 摘除，句柄不残留
    spm.motionTeardown();
    this.flushPendingTextCommit(); // F-2：卸载清理路径 flush 防抖窗口文本
    if (this.popup) closeAllSelectMenus(this.popup); // UI-1 纵深：非常规关闭路径菜单不留残
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
    this.preloadInFlight = null;
    // 徽标/行缓存/已加载数/schema 会话缓存/域滚位随面板销毁清空（下次打开重新动态计算）
    navBadges.clear();
    schemaRowCache.clear();
    loadedCounts.clear();
    schemaCache.clear();
    this.scrollMem.clear();
  }
}
