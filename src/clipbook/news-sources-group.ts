/**
 * 剪藏本设置「数据源」组（ticket 124，ADR-0060；自旧 clipping 域迁入 clipbook，ADR-0086）：
 * news.json 存在 → 三源开关 + UP 主名单管理 + B站抓取条数 + 保留天数；缺失 → 安装引导行。
 * 数据操作走 ./news-source-settings（串行队列 + 段级合并写盘）。
 * 抓取自插件内完成（issue 302 / ADR-0128）：抓取间隔 select + 立即抓取按钮；
 * 原「安装外部数据源守护」引导分支退役。
 *
 * 声明式重写（推翻 ticket 131 的 custom 插槽方案）：全组输出标准声明行（toggle/number/
 * button/info），与其他设置组同一渲染链（core ⚙️ 弹窗 + 设置面板两端同 schema 同视觉）。
 * 三难点的解法：
 * - 异步状态：schema 构建改为「先 await readDataSourceState() 再建行」，状态在构建期
 *   一次性预载进闭包状态盒（入口见 clipbook/ui.ts openSettings 与 settings-panel loader）；
 * - 外部数据绑定：news.json 键走 RowBinding 三函数逃生口（get/set 读写字盒、save 落盘），
 *   不占 data.json；显隐联动用闭包捕获字盒（snapshot 只覆盖 data.json，外部行自捕获）；
 * - UP 名单列表：组内只留「管理」按钮行（计数在 desc），增删/配置在独立 UP 主弹窗
 *   （renderPanelSchema 渲染进自建 overlay，形态不变）。
 */
import { httpGetText, requestUrlAsFetch } from '../core/http';
import { notice, notifySaveError } from '../core/notice';
import { numStrBinding } from '../core/settings-common';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import type { SettingsRow, SettingsRowContext, SettingsSchema } from '../core/settings-schema';
import {
  readDataSourceState, writeSources, addBilibiliUp, removeBilibiliUp,
  writeBilibiliMaxItems, addRssFeed, removeRssFeed, writeFetchInterval, type DataSourceState,
} from './news-source-settings';
import { fetchNowNews, notifyManualFetchResult, localDatetime } from './news-fetcher';
import { resolveUidFromInputDetailed, extractFeedTitleFromXml, looksLikeFeedXml, normalizeRssFeedUrl, normalizeFetchIntervalMin, FETCH_INTERVAL_STEPS, type BilibiliUpInfo, type RssFeed } from './news-data';

/** 状态盒（构建期快照的可变副本）：三函数绑定 get/set 读它，save 经数据层落盘 */
type DataSourceBox = DataSourceState;

/**
 * 数据源组声明行（入口先 await readDataSourceState() 把状态传进来）：
 * B 站/RSS 开关已退役（用户拍板 2026-09-12）——UP 主名单、RSS 订阅源、抓取条数三行常显。
 */
export function dataSourceGroupRows(init: DataSourceState): SettingsRow[] {
  const box: DataSourceBox = {
    ...init,
    sources: { ...init.sources },
    bilibiliUps: [...init.bilibiliUps],
    bilibiliUpInfo: { ...init.bilibiliUpInfo },
    rssFeeds: init.rssFeeds.map((f) => ({ ...f })),
  };
  /** 双源开关绑定：读写字盒 sources 段，落盘整段合并写（数据层只声明 sources 段）。
   *  C4：写失败（news.json 损坏/读盘失败）时提示——不提示即「开关已改、磁盘未写、重开回弹」 */
  const sourceBinding = (key: 'zhihu' | 'guokr') => ({
    get: () => box.sources[key] === true,
    set: (v: boolean) => { box.sources[key] = v; },
    save: async () => {
      if (!(await writeSources({ ...box.sources }))) notifyWriteFailed('数据源开关');
    },
  });
  /** 名单行描述（动态计数；文案过 ticket 100 lint：8 字以上自然句） */
  const upListDesc = () =>
    box.bilibiliUps.length > 0
      ? `已跟踪 ${box.bilibiliUps.length} 位 UP 主，添加与移除在管理弹窗`
      : '暂未跟踪 UP 主，添加与移除在管理弹窗';
  /** RSS 订阅行描述（ADR-0121：订阅源计数） */
  const rssListDesc = () =>
    box.rssFeeds.length > 0
      ? `已订阅 ${box.rssFeeds.length} 个 RSS 源，添加与移除在管理弹窗`
      : '暂未订阅 RSS 源，添加与移除在管理弹窗';

  /** 抓取间隔描述（动态展示当前档位语义；时间走 localDatetime 免斜杠串） */
  const intervalDesc = () => {
    const t = box.lastFetchAt > 0 ? localDatetime(box.lastFetchAt) : '还没有抓取过';
    return `打开插件或剪藏本时超过该间隔自动抓取，上次抓取 ${t}`;
  };
  return [
    { type: 'button', name: '立即抓取', desc: intervalDesc(), buttonText: '抓取', cta: true,
      onClick: async (ctx) => {
        const r = await fetchNowNews();
        notifyManualFetchResult(r);
        const fresh = await readDataSourceState();
        box.lastFetchAt = fresh.lastFetchAt;
        box.fetchIntervalMin = fresh.fetchIntervalMin;
        setRowDesc(ctx, intervalDesc());
      } },
    { type: 'select', name: '抓取间隔', desc: '打开插件或剪藏本时超过该间隔才自动抓取，最短 30 分钟',
      options: FETCH_INTERVAL_STEPS.map((m) => ({ value: String(m), label: m >= 60 ? `${m / 60} 小时` : `${m} 分钟` })),
      binding: {
        get: () => String(box.fetchIntervalMin),
        set: (v) => { box.fetchIntervalMin = normalizeFetchIntervalMin(v); },
        save: async () => {
          if (!(await writeFetchInterval(box.fetchIntervalMin))) notifyWriteFailed('抓取间隔');
        },
      } },
    { type: 'toggle', name: '知乎日报', desc: '抓取知乎日报每日文章', binding: sourceBinding('zhihu') },
    { type: 'toggle', name: '果壳科学人', desc: '抓取果壳科学人最新文章', binding: sourceBinding('guokr') },
    { type: 'button', name: 'UP 主名单', desc: upListDesc(), buttonText: '管理', cta: true,
      onClick: (ctx) => openUpManagerModal({
        ups: [...box.bilibiliUps],
        upInfo: { ...box.bilibiliUpInfo },
        onChanged: async () => {
          // 增删/配置后重读盘回填状态盒 + 行描述（以磁盘为基底，与写队列串行）
          const fresh = await readDataSourceState();
          box.bilibiliUps = [...fresh.bilibiliUps];
          box.bilibiliUpInfo = { ...fresh.bilibiliUpInfo };
          setRowDesc(ctx, upListDesc());
          ctx.refreshVisibility();
        },
      }) },
    { type: 'button', name: 'RSS 订阅源', desc: rssListDesc(), buttonText: '管理', cta: true,
      onClick: (ctx) => openRssManagerModal({
        feeds: box.rssFeeds.map((f) => ({ ...f })),
        onChanged: async () => {
          const fresh = await readDataSourceState();
          box.rssFeeds = fresh.rssFeeds.map((f) => ({ ...f }));
          setRowDesc(ctx, rssListDesc());
          ctx.refreshVisibility();
        },
      }) },
    { type: 'number', name: 'B站抓取条数', desc: '每位 UP 主抓取最近动态的条数上限，默认 10', min: 1, max: 50, step: 1,
      binding: {
        get: () => box.bilibiliMaxItems,
        set: (v) => { box.bilibiliMaxItems = v; },
        save: async () => {
          if (!(await writeBilibiliMaxItems(box.bilibiliMaxItems))) notifyWriteFailed('B站抓取条数');
        },
      } },
    { type: 'number', name: '文章保留天数', desc: '已读与跳过文章的数据超期自动清理，默认 30 天', min: 1, step: 1,
      binding: numStrBinding('newsRetentionUnsavedDays', 30) },
  ];
}

/** 行描述回填（弹窗改名单后刷新计数）：面板行 = .bz-sp-set-desc，core ⚙️ 弹窗行 = .setting-item-description */
function setRowDesc(ctx: SettingsRowContext, text: string): void {
  const el = ctx.rowEl.querySelector<HTMLElement>('.bz-sp-set-desc')
    || ctx.rowEl.querySelector<HTMLElement>('.setting-item-description');
  if (el) el.textContent = text;
}

/** C4：设置/名单写失败提示——news.json 损坏或读盘失败时数据层放弃落盘（F8 保护），
 *  调用方必须告知「改了但没存上」，不再给假成功反馈。
 *  文案收编 core notifySaveError 单源（review-deep 一致#3）：保存失败（what）：原因 */
function notifyWriteFailed(what: string): void {
  notifySaveError(new Error('news.json 不可读或已损坏'), what);
}

// ===== UP 主名单管理弹窗（ticket 126 + 127）=====
// 独立 overlay——层 10100（设置弹窗 10050 之上、共享确认 10250 之下）；
// 内容 = 设置面板通用渲染器 renderPanelSchema（行/组卡与面板同组件单源，2026-09-12 用户拍板
// 换离 core 渲染器——此前靠 id 级 CSS 模仿面板皮，模仿不完整即「风格不统一」）；
// bz-up-manager-mask/-popup id 与 z 序 10100/10101 不变；不换 openSettingsModal——
// 其单例 toggle 语义会顶掉底层剪藏设置弹窗。

/** UP 弹窗 schema 构建入参（lint 注册时以最小参数调用即可） */
export interface UpManagerSchemaOptions {
  ups: string[];
  upInfo: Record<string, BilibiliUpInfo>;
  onChanged: () => void;
}

/** UP 弹窗级可变状态盒：添加/名单操作共享（schema 每次打开重建，状态随弹窗生命周期） */
interface UpManagerBox {
  inputValue: string;
  ups: string[];
  upInfo: Record<string, BilibiliUpInfo>;
}

/**
 * UP 主名单管理弹窗 schema（全面声明行；原 custom 三行——添加复合行/Cookie 复合行/自绘名单已退役；
 * Cookie 可选行与「添加 UP 主」灰字描述随 2026-09-12 用户拍板移除）：
 * 添加行 = text + 行内按钮（actions，渲染器统一实现）；名单 = 通用 list 行
 * （头像/主副文案/移除，items 函数形式每次移除后以字盒为基底重建）。
 * 原「每日简报」组随每日简报退役删除（ADR-0121）；RSS 订阅管理在独立弹窗（rssManagerSettingsSchema）。
 */
export function upManagerSettingsSchema(opts: UpManagerSchemaOptions): SettingsSchema {
  const box: UpManagerBox = {
    inputValue: '',
    ups: [...opts.ups],
    upInfo: { ...opts.upInfo },
  };
  return {
    groups: [
      {
        icon: 'users',
        name: 'UP 主名单',
        rows: [
          {
            type: 'text',
            name: '添加 UP 主',
            placeholder: '粘贴链接或 UID',
            binding: {
              get: () => box.inputValue,
              set: (v) => { box.inputValue = v; },
              save: () => {},
            },
            actions: [{
              text: '添加',
              cta: true,
              onClick: (value) => addUpUid(value, box, opts),
            }],
          },
          {
            type: 'list',
            name: '名单列表',
            items: () => box.ups.map((uid) => ({
              key: uid,
              label: upDisplayName(uid, box.upInfo[uid]),
              sub: `UID ${uid}`,
              imageUrl: box.upInfo[uid]?.avatar,
            })),
            emptyText: '暂无跟踪 UP 主，在上方粘贴主页链接或视频链接添加',
            // 返回 Promise 与 RSS 订阅行同口径：渲染器待落盘完成后重读重建——否则字盒变更晚于
            // refresh，写失败保留的条目（或已移除条目）在弹窗内回显不准
            onChange: (keys) => (async () => {
              const removed = box.ups.filter((u) => !keys.includes(u));
              let changed = false;
              for (const uid of removed) {
                // C4：以磁盘写结果决定成功通知与字盒变更——写失败保留条目 + 错误提示，不弹假成功
                if (!(await removeBilibiliUp(uid))) {
                  notifyWriteFailed(`移除 UP 主 ${uid}`);
                  continue;
                }
                box.ups = box.ups.filter((u) => u !== uid);
                delete box.upInfo[uid];
                changed = true;
                notice(`已移除 UP 主 ${uid}`, 'success');
              }
              if (changed) opts.onChanged();
            })(),
          },
        ],
      },
    ],
  };
}

/** UP 主显示名：后台回填名字则用之，否则回退 uid（ticket 126） */
function upDisplayName(uid: string, info?: BilibiliUpInfo): string {
  return info && info.name ? info.name : `UP ${uid}`;
}

/** 添加动作：解析 UID 入库（去重），回填字盒并联动外部刷新 */
async function addUpUid(raw: string | undefined, box: UpManagerBox, opts: UpManagerSchemaOptions): Promise<void> {
  const input = String(raw || '').trim();
  if (!input) return;
  // 新-8：网络失败与「无法识别」分文案（resolveUidFromInputDetailed 由批 B 落地）
  const res = await resolveUidFromInputDetailed(input);
  if (res.networkFailed) {
    notice('网络读取 B站信息失败，请检查网络后重试', 'error');
    return;
  }
  if (!res.uid) {
    notice('无法识别 UID，请粘贴 space.bilibili.com 内的主页链接', 'error');
    return;
  }
  const uid = res.uid;
  // C4：数据层结果四分（已写入/已存在/入参非法/读盘失败），各给准确文案——不再把读盘失败说成「已在名单中」
  const outcome = await addBilibiliUp(uid);
  switch (outcome) {
    case 'added':
      box.inputValue = '';
      box.ups = [...box.ups, uid];
      opts.onChanged();
      notice(`已添加 UP 主 ${uid}`, 'success');
      return;
    case 'exists':
      notice('该 UP 主已在名单中', 'info');
      return;
    case 'invalid':
      notice('无法识别 UID，请粘贴 space.bilibili.com 内的主页链接', 'error');
      return;
    default:
      notifyWriteFailed('添加 UP 主');
      return;
  }
}

/**
 * C25：UP 主管理弹窗「正在打开/已打开」单例标志。open 流程首段同步置位、close() 复位——
 * 首开在动态加载 renderer 期间 mask 尚未挂 DOM，只查 mask 存在性会漏掉同帧连点（叠出第二层）。
 */
let upManagerOpen = false;
/** close 句柄外提（CB10/A1）：域卸载兜底与 closeAllOverlays 都能收口闭包内的 close */
let upManagerClose: (() => void) | null = null;

/** 打开 UP 主名单管理弹窗：自建 overlay + 面板通用组件渲染（z 序与叠加行为零变化）。
 *  C25：单例守卫——已开或正在打开即直接返回，消灭连点叠层（各层各持 esc 句柄、遮罩叠遮罩、Esc 只关最上层） */
async function openUpManagerModal(opts: { ups: string[]; upInfo: Record<string, BilibiliUpInfo>; onChanged: () => void }): Promise<void> {
  if (upManagerOpen || document.getElementById('bz-up-manager-mask')) return;
  upManagerOpen = true;
  let handle: { unregister(): void } | null = null;
  function close(): void {
    upManagerClose = null;
    mask.remove();
    popup.remove();
    if (handle) handle.unregister();
    upManagerOpen = false;
  }
  const { mask, popup, registerClose } = createOverlay({
    maskId: 'bz-up-manager-mask',
    popupId: 'bz-up-manager-popup',
    maxWidth: 560, // ticket 170 方案 A：加宽让描述换行，文字不再拥挤
    onMaskClick: close,
  });
  // CB10/A1：close 登记进 core 存活表（closeAllOverlays 全域兜底可达）+ 域卸载外提句柄
  upManagerClose = close;
  registerClose(close);

  const header = document.createElement('div');
  header.className = 'bz-settings-header';
  const title = document.createElement('h3');
  title.className = 'bz-settings-title';
  title.textContent = 'UP 主名单管理';
  header.appendChild(title);

  const content = document.createElement('div');
  content.className = 'bz-settings-content';

  try {
    // 内容 = 面板通用渲染器（renderPanelSchema，行/组卡与设置面板同组件单源）；
    // 懒加载解析跨域环（settings-panel schemaLoaders ←→ 本域管理弹窗，函数级延迟解析）
    const { renderPanelSchema } = await import('../settings-panel/renderer');
    renderPanelSchema(content, upManagerSettingsSchema(opts));
  } catch (e) {
    // 打开失败（动态加载/渲染异常）：close 复位守卫并清理半成品——否则单例标志滞留，「管理」此后无响应
    close();
    throw e;
  }

  // 渲染期间域已收口（unloadClipbook/closeAllOverlays 走过 close）→ 不再挂载 DOM/esc 层
  // （防卸载后弹窗复活成无 esc 句柄的孤儿浮层）
  if (!upManagerOpen) return;
  popup.appendChild(header);
  popup.appendChild(content);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  const handleReg = escManager.register('bz-up-manager', {
    isVisible: () => true,
    close,
  });
  handle = handleReg;
}

// ===== RSS 订阅管理弹窗（ADR-0121）=====
// 与 UP 主管理同范式的独立 overlay（bz-rss-manager-mask/-popup，z 序 10100/10101）；
// 添加源时 requestUrl 试拉校验并预取 feed 自带标题（守护 30 分钟才拉一轮，坏 URL 当场拦截）。

/** RSS 弹窗 schema 构建入参（lint 注册时以最小参数调用即可） */
export interface RssManagerSchemaOptions {
  feeds: RssFeed[];
  onChanged: () => void;
}

/** RSS 弹窗级可变状态盒 */
interface RssManagerBox {
  inputValue: string;
  feeds: RssFeed[];
}

/** 试拉 RSS：取 XML 原文，须带 feed 结构标记（<rss>/<feed>/<RDF>，拦截恰好含 <title> 的
 *  普通 HTML 网页）再提取 feed 自带标题；10s 超时/非 2xx/网络错/非 feed 结构/解析不出 → null。
 *  超时壳收编 core/http（issue 365）；导出（C23 回归测试用；生产仅 addRssFeedUrl 消费） */
export async function fetchRssFeedTitle(url: string): Promise<string | null> {
  const xml = await httpGetText(url, { timeoutMs: 10000, fetchImpl: requestUrlAsFetch() });
  if (!xml || !looksLikeFeedXml(xml)) return null;
  return extractFeedTitleFromXml(xml);
}

/**
 * RSS 订阅管理弹窗 schema：添加行（text + 行内按钮，试拉校验）+
 * 通用 list 行（feed 名为主文案、URL 为副文案、移除）。
 * 原「守护需更新」版本提示行随 2026-09-12 用户拍板移除。
 */
export function rssManagerSettingsSchema(opts: RssManagerSchemaOptions): SettingsSchema {
  const box: RssManagerBox = {
    inputValue: '',
    feeds: opts.feeds.map((f) => ({ ...f })),
  };
  return {
    groups: [
      {
        icon: 'rss',
        name: 'RSS 订阅源',
        rows: [
          {
            type: 'text',
            name: '添加 RSS 源',
            placeholder: 'https://example.com/rss.xml',
            binding: {
              get: () => box.inputValue,
              set: (v) => { box.inputValue = v; },
              save: () => {},
            },
            actions: [{
              text: '添加',
              cta: true,
              onClick: (value) => addRssFeedUrl(value, box, opts),
            }],
          },
          {
            type: 'list',
            name: '订阅列表',
            items: () => box.feeds.map((f) => ({
              key: f.url,
              label: f.title || f.url,
              sub: f.title ? f.url : '',
            })),
            emptyText: '暂无订阅源，在上方粘贴 RSS 地址添加',
            onChange: (keys) => (async () => {
              const removed = box.feeds.filter((f) => !keys.includes(f.url));
              let changed = false;
              for (const f of removed) {
                // C4：以磁盘写结果决定成功通知与字盒变更——写失败保留条目 + 错误提示，不弹假成功
                if (!(await removeRssFeed(f.url))) {
                  notifyWriteFailed(`移除 RSS 源 ${f.title || f.url}`);
                  continue;
                }
                box.feeds = box.feeds.filter((x) => x.url !== f.url);
                changed = true;
                notice(`已移除 RSS 源 ${f.title || f.url}`, 'success');
              }
              if (changed) opts.onChanged();
            })(),
          },
        ],
      },
    ],
  };
}

/** 添加 RSS 源动作：url 归一 → 去重 → 试拉校验预取名 → 入库并回填字盒 */
async function addRssFeedUrl(raw: string | undefined, box: RssManagerBox, opts: RssManagerSchemaOptions): Promise<void> {
  const input = String(raw || '').trim();
  if (!input) return;
  const url = normalizeRssFeedUrl(input);
  if (!url) {
    notice('无效的 RSS 地址，请粘贴 http/https 开头的订阅链接', 'error');
    return;
  }
  if (box.feeds.some((f) => f.url === url)) {
    notice('该 RSS 源已在订阅列表中', 'info');
    return;
  }
  notice('正在校验 RSS 地址…', 'info');
  const title = await fetchRssFeedTitle(url);
  if (title === null) {
    notice('试拉失败：地址不可达或不是有效的 RSS 源，未添加', 'error');
    return;
  }
  // C4：数据层结果四分（已写入/已存在/入参非法/读盘失败），各给准确文案——不再把读盘失败说成「已在订阅列表中」
  const outcome = await addRssFeed(url, title);
  switch (outcome) {
    case 'added':
      box.inputValue = '';
      box.feeds = [...box.feeds, { url, title }];
      opts.onChanged();
      notice(`已订阅 ${title || url}`, 'success');
      return;
    case 'exists':
      notice('该 RSS 源已在订阅列表中', 'info');
      return;
    case 'invalid':
      notice('无效的 RSS 地址，请粘贴 http/https 开头的订阅链接', 'error');
      return;
    default:
      notifyWriteFailed('添加 RSS 源');
      return;
  }
}

/** C25：RSS 管理弹窗单例标志（语义同 upManagerOpen：首开异步加载期间 mask 未挂 DOM，同帧连点靠它拦住） */
let rssManagerOpen = false;
/** close 句柄外提（CB10/A1）：语义同 upManagerClose */
let rssManagerClose: (() => void) | null = null;

/** 打开 RSS 订阅管理弹窗：自建 overlay + 面板通用组件渲染（范式同 UP 主管理弹窗）。
 *  C25：单例守卫——已开或正在打开即直接返回，消灭连点叠层 */
async function openRssManagerModal(opts: { feeds: RssFeed[]; onChanged: () => void }): Promise<void> {
  if (rssManagerOpen || document.getElementById('bz-rss-manager-mask')) return;
  rssManagerOpen = true;
  let handle: { unregister(): void } | null = null;
  function close(): void {
    rssManagerClose = null;
    mask.remove();
    popup.remove();
    if (handle) handle.unregister();
    rssManagerOpen = false;
  }
  const { mask, popup, registerClose } = createOverlay({
    maskId: 'bz-rss-manager-mask',
    popupId: 'bz-rss-manager-popup',
    maxWidth: 560,
    onMaskClick: close,
  });
  // CB10/A1：同 UP 主弹窗——close 登记 core 存活表 + 域卸载外提句柄
  rssManagerClose = close;
  registerClose(close);

  const header = document.createElement('div');
  header.className = 'bz-settings-header';
  const title = document.createElement('h3');
  title.className = 'bz-settings-title';
  title.textContent = 'RSS 订阅管理';
  header.appendChild(title);

  const content = document.createElement('div');
  content.className = 'bz-settings-content';

  try {
    const { renderPanelSchema } = await import('../settings-panel/renderer');
    renderPanelSchema(content, rssManagerSettingsSchema(opts));
  } catch (e) {
    // 打开失败：close 复位守卫并清理半成品（同 UP 主弹窗口径）
    close();
    throw e;
  }

  // 渲染期间域已收口 → 不挂载 DOM/esc（同 UP 主弹窗口径）
  if (!rssManagerOpen) return;
  popup.appendChild(header);
  popup.appendChild(content);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  const handleReg = escManager.register('bz-rss-manager', {
    isVisible: () => true,
    close,
  });
  handle = handleReg;
}

/**
 * 域卸载兜底（CB10/A1，unloadClipbook 调用）：UP/RSS 管理弹窗开着时走各自 close 幂等收口
 * （DOM 摘除 + esc 注销 + 单例旗标复位）；未开时 no-op。main.ts closeAllOverlays 全域兜底
 * 之外的第二道——两道都以 close 收尾，先到先收、后到空转。
 */
export function unloadManagerModals(): void {
  upManagerClose?.();
  rssManagerClose?.();
}
