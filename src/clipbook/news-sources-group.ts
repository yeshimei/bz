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
import { getApp } from '../core/app';
import { onDomainEvent } from '../core/domain-bus';
import { DOWNLOADS_CHANGED_EVENT } from '../core/remote-asset';
import {
  catalogCategoryCounts, downloadRssCatalog, feedDomainOf, filterCatalogFeeds,
  loadRssCatalog, resolveCatalogFeedUrl, subscribedUrlSet, RSS_CATALOG_FILE, RSS_HUB_DEFAULT_INSTANCE,
  type RssCatalog, type RssCatalogFeed,
} from '../core/rss-catalog';
import type { SettingsRow, SettingsRowContext, SettingsSchema } from '../core/settings-schema';
import {
  readDataSourceState, writeSources, addBilibiliUp, removeBilibiliUp, writeBilibiliUpInfo,
  writeBilibiliMaxItems, addRssFeed, removeRssFeed, writeFetchInterval, writeRsshubInstance, type DataSourceState,
} from './news-source-settings';
import { fetchNowNews, notifyManualFetchResult, localDatetime } from './news-fetcher';
import { resolveUidFromInputDetailed, fetchUpProfile, extractFeedTitleFromXml, looksLikeFeedXml, normalizeRssFeedUrl, normalizeFetchIntervalMin, normalizeRsshubInstance, FETCH_INTERVAL_STEPS, type BilibiliUpInfo, type RssFeed } from './news-data';

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
  /** 名单行描述（动态计数；issue 434 精简口径，管理入口就是行内「管理」钮不再赘述） */
  const upListDesc = () =>
    box.bilibiliUps.length > 0
      ? `已跟踪 ${box.bilibiliUps.length} 位 UP 主`
      : '暂未跟踪任何 UP 主';
  /** RSS 订阅行描述（ADR-0121：订阅源计数） */
  const rssListDesc = () =>
    box.rssFeeds.length > 0
      ? `已订阅 ${box.rssFeeds.length} 个 RSS 源`
      : '暂未订阅任何 RSS 源';

  /** 抓取间隔描述（动态展示上次抓取时间；时间走 localDatetime 免斜杠串） */
  const intervalDesc = () => {
    const t = box.lastFetchAt > 0 ? localDatetime(box.lastFetchAt) : '还没有抓取过';
    return `上次抓取 ${t}`;
  };
  return [
    { type: 'button', name: '立即抓取', desc: intervalDesc(), buttonText: '抓取', cta: true,
      help:
        '立刻跑一轮抓取，不必等抓取间隔到点。范围是所有启用的源：知乎日报、果壳，以及名单非空的 B 站与 RSS——名单为空的源直接跳过。四个源并行抓，已经在抓的时候再点会提示稍候。' +
        '这一步只发 HTTP 请求、不调 AI，不产生费用；被风控或抓取失败会弹通知，不静默。',
      onClick: async (ctx) => {
        const r = await fetchNowNews();
        notifyManualFetchResult(r);
        const fresh = await readDataSourceState();
        box.lastFetchAt = fresh.lastFetchAt;
        box.fetchIntervalMin = fresh.fetchIntervalMin;
        setRowDesc(ctx, intervalDesc());
      } },
    { type: 'select', name: '抓取间隔', desc: '新闻自动抓取的最小间隔',
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
      help:
        '要跟进的 B 站 UP 主名单，点「管理」增删，行描述里显示当前条数。名单为空时 B 站这一路直接跳过，不算报错，只是不抓。' +
        '抓取时按名单逐个 UP 主翻最近投稿，每位抓多少条由下面的「B站抓取条数」决定。',
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
      help:
        'RSS 订阅列表，点「管理」增删，行描述里显示当前条数。名单为空时 RSS 这一路整个跳过，不报错。' +
        '抓回来的文章走与其它源统一的入库流程：默认进未读流，要不要立刻生成摘要由上方的「自动摘要」设置决定。',
      onClick: (ctx) => openRssManagerModal({
        feeds: box.rssFeeds.map((f) => ({ ...f })),
        onChanged: async () => {
          const fresh = await readDataSourceState();
          box.rssFeeds = fresh.rssFeeds.map((f) => ({ ...f }));
          setRowDesc(ctx, rssListDesc());
          ctx.refreshVisibility();
        },
      }) },
    { type: 'text', name: 'RSSHub 实例', desc: '源库里 RSSHub 路由源订阅时使用的实例地址',
      placeholder: RSS_HUB_DEFAULT_INSTANCE,
      binding: {
        get: () => box.rsshubInstance,
        set: (v) => { box.rsshubInstance = v; },
        save: async () => {
          // 保存成功后字盒回填归一值（trim/补协议/去尾斜杠；非法回退默认），下次打开显示的就是真值
          const normalized = normalizeRsshubInstance(box.rsshubInstance) ?? RSS_HUB_DEFAULT_INSTANCE;
          if (await writeRsshubInstance(box.rsshubInstance)) box.rsshubInstance = normalized;
          else notifyWriteFailed('RSSHub 实例');
        },
      } },
    { type: 'number', name: 'B站抓取条数', desc: '每位 UP 主抓取的动态条数上限', min: 1, max: 50, step: 1,
      binding: {
        get: () => box.bilibiliMaxItems,
        set: (v) => { box.bilibiliMaxItems = v; },
        save: async () => {
          if (!(await writeBilibiliMaxItems(box.bilibiliMaxItems))) notifyWriteFailed('B站抓取条数');
        },
      } },
    { type: 'number', name: '文章保留天数', desc: '已读文章数据的保留天数', min: 1, max: 3650, step: 1,
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

/** UP 弹窗级可变状态盒：添加/名单操作共享（schema 每次打开重建，状态随弹窗生命周期）；
 *  导出供 openUpManagerModal 持有——打开即补资料的刷新链要操作同一个字盒（2026-09-22） */
export interface UpManagerBox {
  inputValue: string;
  ups: string[];
  upInfo: Record<string, BilibiliUpInfo>;
}

/**
 * UP 主名单管理弹窗 schema（全面声明行；原 custom 三行——添加复合行/Cookie 复合行/自绘名单已退役；
 * Cookie 可选行与「添加 UP 主」灰字描述随 2026-09-12 用户拍板移除）：
 * 添加行 = text + 行内按钮（actions，渲染器统一实现）；名单 = 通用 list 行
 * （头像/主副文案/移除，items 函数形式每次移除后以字盒为基底重建）。
 * 资料（名字/头像）来源两路（2026-09-22）：添加时与打开弹窗时对缺资料条目直查
 * fetchUpProfile（web-interface/card）回填；抓取轮从动态条目抽的 extractUpInfo 照旧覆盖。
 * 原「每日简报」组随每日简报退役删除（ADR-0121）；RSS 订阅管理在独立弹窗（rssManagerSettingsSchema）。
 */
export function upManagerSettingsSchema(opts: UpManagerSchemaOptions, boxIn?: UpManagerBox): SettingsSchema {
  const box: UpManagerBox = boxIn ?? {
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
              onClick: (value, ctx) => addUpUid(value, box, opts, ctx),
            }],
          },
          {
            type: 'list',
            name: '名单列表',
            items: () => box.ups.map((uid) => ({
              key: uid,
              label: upDisplayName(uid, box.upInfo[uid]),
              sub: `UID ${uid}`,
              // 头像来自 bilibiliUpInfo（添加时/打开弹窗时直查回填，或抓取轮从动态条目抽）
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

/** 资料回填结果（C4 口径：网络取不到与写盘失败分型，调用方给准确提示） */
type ProfileBackfillOutcome = 'filled' | 'none' | 'write-failed';

/** 本会话已试过资料回填的 uid（成功与否都记账——取不到的 uid 不重复打接口） */
const profileTried = new Set<string>();

/**
 * 后台补 UP 资料（名字/头像，2026-09-22）：只补缺的条目，每个 uid 每会话最多查一次；
 * 取到即写盘（段级合并只动该 uid）+ 重渲列表，头像/名字当场就位。
 * 逐条串行（B站接口风控敏感，不并发）；单条失败继续下一条。
 */
async function backfillUpProfiles(uids: string[], box: UpManagerBox, refresh: () => void): Promise<ProfileBackfillOutcome> {
  let filled = false;
  let writeFailed = false;
  for (const uid of uids) {
    if (!uid || profileTried.has(uid)) continue;
    if (box.upInfo[uid]?.name && box.upInfo[uid]?.avatar) { profileTried.add(uid); continue; }
    profileTried.add(uid);
    const info = await fetchUpProfile(uid);
    if (!info) continue; // 网络失败/风控/查无此人：抓取轮 extractUpInfo 还会兜底
    if (!(await writeBilibiliUpInfo(uid, info))) { writeFailed = true; continue; }
    box.upInfo[uid] = { ...box.upInfo[uid], ...info };
    filled = true;
  }
  if (filled) refresh(); // 列表重建读到字盒里的新资料（头像 + 名字）
  if (filled) return 'filled';
  return writeFailed ? 'write-failed' : 'none';
}

/** 添加动作：解析 UID 入库（去重），回填字盒并联动外部刷新；入库后直查资料（名字/头像）。
 *  ctx 用于资料到位后重渲列表——添加本身不 await 这次网络查询，慢网不卡列表刷新
 *  （ctx 缺省 = 单测直调场景：不重渲，其余链路不变）。 */
async function addUpUid(raw: string | undefined, box: UpManagerBox, opts: UpManagerSchemaOptions, ctx?: SettingsRowContext): Promise<void> {
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
      void backfillUpProfiles([uid], box, ctx?.refreshVisibility ?? (() => {})).then((r) => {
        if (r === 'none') notice('网络读取 UP 主资料失败，抓取时会自动回填', 'info');
        else if (r === 'write-failed') notifyWriteFailed('回填 UP 主资料');
      });
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

  /** 弹窗字盒：schema 与「打开即补资料」共用同一份——回填写进去，列表重建才看得到 */
  const box: UpManagerBox = { inputValue: '', ups: [...opts.ups], upInfo: { ...opts.upInfo } };

  try {
    // 内容 = 面板通用渲染器（renderPanelSchema，行/组卡与设置面板同组件单源）；
    // 懒加载解析跨域环（settings-panel schemaLoaders ←→ 本域管理弹窗，函数级延迟解析）
    const { renderPanelSchema } = await import('../settings-panel/renderer');
    const { refresh } = renderPanelSchema(content, upManagerSettingsSchema(opts, box));
    // 打开即补缺资料（存量名单的 uid 多半只有 uid、没有名字/头像）：后台逐条串行查，
    // 查到即写盘 + 重渲列表；失败静默（抓取轮 extractUpInfo 还会兜底，不打扰评审）
    void backfillUpProfiles(box.ups, box, refresh);
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

// ===== RSS 订阅管理弹窗（ADR-0121；issue 495 大改：我的订阅 / 源库 双页签）=====
// 与 UP 主管理同范式的独立 overlay（bz-rss-manager-mask/-popup，z-index 经 core createOverlay
// 动态发号 ADR-0067，不再是静态档）；宽度 720（源库列表要放「名称 + 域名 + 标签 + 订阅钮」一行）。
// 「我的订阅」页签 = 原 schema 原样搬入（添加源时 requestUrl 试拉校验并预取 feed 自带标题）；
// 「源库」页签 = 域内自绘面板（createRssCatalogPane，黄页模型 ADR-0208：订阅即拷贝进 rssFeeds）。

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
            emptyText: '暂无订阅源，在上方粘贴 RSS 地址添加，或切到「源库」页签挑选',
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

/** 源库列表单次渲染上限：千级条目全量上 DOM 移动端会卡，超出部分提示缩小范围 */
const RSS_CAT_RENDER_LIMIT = 200;
/** 源库搜索防抖（敲键不逐字全列表重算） */
const RSS_CAT_SEARCH_DEBOUNCE_MS = 200;

/** 源库页签面板控制器（弹窗内单实例；导出供 UI 测试直驱） */
export interface RssCatalogPane {
  /** 从磁盘重载（库 + 订阅集）并整面板重渲：首次切入本页签 / 下载落盘事件走这里 */
  reload(): Promise<void>;
  /** 只刷新「已订阅」标记（我的订阅页签有增删后调用；列表结构不动） */
  refreshSubscribed(): Promise<void>;
  /** 弹窗关闭时清理（搜索防抖定时器） */
  dispose(): void;
}

/**
 * 源库页签面板构建（导出供 UI 测试直驱；生产仅 openRssManagerModal 消费）。
 * 黄页模型 ADR-0208；域内自绘——搜索 / 分类 / 订阅态是交互密集 UI，
 * 超出声明行渲染器的行型；视觉沿用设置面板语言，订阅钮直接复用 .bz-sp-btn。
 * 两态：未下载（空态引导 + 就地下载，走 downloadRssCatalog 统一清单通道）→
 * 就绪（搜索框 + 分类 chips + 列表）。订阅 = addRssFeed 拷贝入库：出版期已测活，
 * 免试拉即时反馈；已订阅态按归一 URL 匹配（subscribedUrlSet），删库/更新库不影响已订阅。
 */
export function createRssCatalogPane(root: HTMLElement, deps: { onChanged: () => void }): RssCatalogPane {
  let catalog: RssCatalog | null = null;
  let subscribed = new Set<string>();
  /** RSSHub 实例地址（ADR-0209）：readSubscribed 随订阅集一起刷；路由条目订阅/已订阅匹配都用它 */
  let instance = RSS_HUB_DEFAULT_INSTANCE;
  let query = '';
  let activeCat = ''; // '' = 全部
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  const readSubscribed = async (): Promise<void> => {
    const st = await readDataSourceState();
    subscribed = subscribedUrlSet(st.rssFeeds.map((f) => f.url));
    instance = normalizeRsshubInstance(st.rsshubInstance) ?? RSS_HUB_DEFAULT_INSTANCE;
  };

  /** 订阅动作（行内按钮态机：订阅 → 订阅中… → 已订阅/还原）。C4：数据层结果分型各给准确反馈。
   *  路由条目按当前实例重拼（订阅=拷贝当时 URL，ADR-0209：改实例不影响已订阅）；重拼失败回退出版期 url */
  const subscribeFeed = async (feed: RssCatalogFeed, btn: HTMLButtonElement): Promise<void> => {
    btn.disabled = true;
    btn.textContent = '订阅中…';
    const url = resolveCatalogFeedUrl(feed, instance);
    const outcome = await addRssFeed(url, feed.title || undefined);
    if (outcome === 'added') {
      subscribed.add(url);
      btn.textContent = '已订阅';
      notice(`已订阅 ${feed.title || url}`, 'success');
      deps.onChanged(); // 数据源组行描述计数 + 我的订阅页签跟上
      return;
    }
    if (outcome === 'exists') {
      subscribed.add(url); // 已订阅态就地校正，不打扰
      btn.textContent = '已订阅';
      return;
    }
    btn.disabled = false;
    btn.textContent = '订阅';
    if (outcome === 'invalid') notice('无效的源地址，未能订阅', 'error');
    else notifyWriteFailed(`订阅 ${feed.title || url}`);
  };

  const catalogRowEl = (feed: RssCatalogFeed): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'bz-rss-cat-row';
    const info = document.createElement('div');
    info.className = 'bz-rss-cat-info';
    const nameline = document.createElement('div');
    nameline.className = 'bz-rss-cat-nameline';
    const name = document.createElement('div');
    name.className = 'bz-rss-cat-name';
    name.textContent = feed.title || feed.url;
    nameline.appendChild(name);
    if (feed.via) {
      // 路由型徽标（ADR-0209 决策 7）：区分来源形态、管理「公共实例上可能拉不到」的预期
      const via = document.createElement('span');
      via.className = 'bz-rss-cat-via';
      via.textContent = 'RSSHub';
      via.title = `路由 ${feed.via}，订阅地址按 RSSHub 实例「${instance}」拼出；公共实例对部分路由可能拉不到，自建实例更稳`;
      nameline.appendChild(via);
    }
    const domain = document.createElement('div');
    domain.className = 'bz-rss-cat-domain';
    domain.textContent = feedDomainOf(feed.url);
    info.append(nameline, domain);
    const tags = document.createElement('div');
    tags.className = 'bz-rss-cat-tags';
    for (const t of feed.tags.slice(0, 3)) {
      const tag = document.createElement('span');
      tag.className = 'bz-rss-cat-tag';
      tag.textContent = t;
      tags.appendChild(tag);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-sp-btn bz-rss-cat-sub';
    // 已订阅按重拼后的最终 URL 匹配（黄页口径的地基是「订阅时拷进去的那个地址」）
    const finalUrl = resolveCatalogFeedUrl(feed, instance);
    const isSub = subscribed.has(finalUrl);
    btn.textContent = isSub ? '已订阅' : '订阅';
    btn.disabled = isSub;
    if (!isSub) btn.addEventListener('click', () => void subscribeFeed(feed, btn));
    row.append(info, tags, btn);
    return row;
  };

  const renderList = (hit: HTMLElement, list: HTMLElement): void => {
    if (!catalog) return;
    const all = filterCatalogFeeds(catalog, { query, cat: activeCat });
    hit.textContent = all.length === catalog.feeds.length
      ? `共 ${all.length} 个源`
      : `命中 ${all.length} / ${catalog.feeds.length} 个源`;
    const shown = all.slice(0, RSS_CAT_RENDER_LIMIT);
    if (all.length === 0) {
      const none = document.createElement('div');
      none.className = 'bz-rss-cat-none';
      none.textContent = '没有匹配的源，换个关键词或分类试试';
      list.replaceChildren(none);
      return;
    }
    const rows = shown.map((f) => catalogRowEl(f));
    if (all.length > shown.length) {
      const more = document.createElement('div');
      more.className = 'bz-rss-cat-more';
      more.textContent = `仅显示前 ${shown.length} 条，请搜索或选分类缩小范围`;
      rows.push(more);
    }
    list.replaceChildren(...rows);
  };

  const renderEmpty = (): void => {
    const wrap = document.createElement('div');
    wrap.className = 'bz-rss-cat-empty';
    const p = document.createElement('p');
    p.className = 'bz-rss-cat-empty-text';
    p.textContent = '源库还没下载。下载后可按分类浏览、搜索并一键订阅上千个中文 RSS 源（数据来自社区维护的开源清单）。';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-sp-btn bz-rss-cat-download';
    btn.textContent = '下载源库';
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = '下载中…';
      void (async () => {
        try {
          const c = await downloadRssCatalog(getApp());
          catalog = c;
          await readSubscribed();
          notice(`源库已就绪，共收录 ${c.feeds.length} 个源`, 'success');
          render();
        } catch (e) {
          notice(e instanceof Error ? e.message : String(e), 'error');
          btn.disabled = false;
          btn.textContent = '下载源库';
        }
      })();
    });
    wrap.append(p, btn);
    root.replaceChildren(wrap);
  };

  const renderReady = (): void => {
    if (!catalog) return;
    const meta = document.createElement('div');
    meta.className = 'bz-rss-cat-meta';
    const catCount = catalogCategoryCounts(catalog).filter((c) => c.count > 0).length;
    meta.textContent = `已收录 ${catalog.feeds.length} 个源 · ${catCount} 个分类 · 更新于 ${catalog.updatedAt}`;
    const src = document.createElement('div');
    src.className = 'bz-rss-cat-src';
    src.textContent = `来源：${catalog.meta.sources.map((s) => `${s.name}（${s.license}）`).join('、')}`;
    src.title = catalog.meta.sources.map((s) => s.url).join('\n');

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'bz-rss-cat-search';
    search.placeholder = '搜索名称、域名、标签或路由…';
    search.value = query;
    search.addEventListener('input', () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchTimer = null;
        query = search.value;
        renderList(hit, list);
      }, RSS_CAT_SEARCH_DEBOUNCE_MS);
    });

    const chips = document.createElement('div');
    chips.className = 'bz-rss-cat-chips';
    const hit = document.createElement('div');
    hit.className = 'bz-rss-cat-hit';
    const list = document.createElement('div');
    list.className = 'bz-rss-cat-list';

    const renderChips = (): void => {
      chips.replaceChildren();
      const mkChip = (label: string, cat: string, count: number): void => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bz-rss-cat-chip' + (activeCat === cat ? ' active' : '');
        chip.textContent = `${label} ${count}`;
        chip.addEventListener('click', () => {
          activeCat = cat;
          renderChips();
          renderList(hit, list);
        });
        chips.appendChild(chip);
      };
      mkChip('全部', '', catalog!.feeds.length);
      for (const { cat, count } of catalogCategoryCounts(catalog!)) {
        if (count > 0) mkChip(cat, cat, count);
      }
    };
    renderChips();
    renderList(hit, list);
    root.replaceChildren(meta, src, search, chips, hit, list);
  };

  const render = (): void => {
    if (catalog) renderReady();
    else renderEmpty();
  };

  return {
    reload: async () => {
      catalog = await loadRssCatalog(getApp());
      await readSubscribed();
      render();
    },
    refreshSubscribed: async () => {
      await readSubscribed();
      if (catalog) {
        // 已订阅标记散在列表按钮上，整列表重渲最省心（限 200 行，开销可忽略）
        const hit = root.querySelector<HTMLElement>('.bz-rss-cat-hit');
        const list = root.querySelector<HTMLElement>('.bz-rss-cat-list');
        if (hit && list) renderList(hit, list);
      }
    },
    dispose: () => {
      if (searchTimer) {
        clearTimeout(searchTimer);
        searchTimer = null;
      }
    },
  };
}

/** 打开 RSS 订阅管理弹窗（issue 495 大改）：自建 overlay + 双页签——
 *  「我的订阅」= 原 schema（renderPanelSchema 渲染，每次切入按磁盘现值重建）；
 *  「源库」= createRssCatalogPane 自绘面板。
 *  C25：单例守卫——已开或正在打开即直接返回，消灭连点叠层 */
async function openRssManagerModal(opts: { feeds: RssFeed[]; onChanged: () => void }): Promise<void> {
  if (rssManagerOpen || document.getElementById('bz-rss-manager-mask')) return;
  rssManagerOpen = true;
  let handle: { unregister(): void } | null = null;
  let activeTab: 'my' | 'catalog' = 'my';
  let catPane: RssCatalogPane | null = null;
  let offAsset: (() => void) | null = null;
  function close(): void {
    rssManagerClose = null;
    catPane?.dispose();
    if (offAsset) {
      offAsset();
      offAsset = null;
    }
    mask.remove();
    popup.remove();
    if (handle) handle.unregister();
    rssManagerOpen = false;
  }
  const { mask, popup, registerClose } = createOverlay({
    maskId: 'bz-rss-manager-mask',
    popupId: 'bz-rss-manager-popup',
    maxWidth: 720,
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

  const tabs = document.createElement('div');
  tabs.className = 'bz-rss-cat-tabs';
  const tabMy = document.createElement('button');
  tabMy.type = 'button';
  tabMy.className = 'bz-rss-cat-tab active';
  tabMy.textContent = '我的订阅';
  const tabCat = document.createElement('button');
  tabCat.type = 'button';
  tabCat.className = 'bz-rss-cat-tab';
  tabCat.textContent = '源库';
  tabs.append(tabMy, tabCat);

  const paneMy = document.createElement('div');
  paneMy.className = 'bz-settings-content bz-rss-pane';
  const paneCat = document.createElement('div');
  paneCat.className = 'bz-settings-content bz-rss-pane';
  paneCat.style.display = 'none';

  // 我的订阅页签有增删 → 数据源组行计数 + 源库页签的已订阅标记跟上
  const onMyChanged = (): void => {
    opts.onChanged();
    void catPane?.refreshSubscribed();
  };

  // 页签激活统一静默收口：渲染链异常只留档不上抛（弹窗关闭/切换竞态下避免 unhandled rejection）
  const activate = (next: () => Promise<void>): void => {
    void next().catch((e) => console.warn('[bz] RSS 订阅弹窗页签渲染失败:', (e as Error)?.message || e));
  };

  const activateMy = async (): Promise<void> => {
    activeTab = 'my';
    tabMy.classList.add('active');
    tabCat.classList.remove('active');
    paneCat.style.display = 'none';
    paneMy.style.display = '';
    // 每次切入按磁盘现值重建（源库订阅、别处增删后，回到本页签即最新）
    paneMy.replaceChildren();
    const st = await readDataSourceState();
    if (!rssManagerOpen || activeTab !== 'my') return; // 渲染期间弹窗已关/已切页
    const { renderPanelSchema } = await import('../settings-panel/renderer');
    renderPanelSchema(paneMy, rssManagerSettingsSchema({ feeds: st.rssFeeds, onChanged: onMyChanged }));
  };

  const activateCatalog = async (): Promise<void> => {
    activeTab = 'catalog';
    tabCat.classList.add('active');
    tabMy.classList.remove('active');
    paneMy.style.display = 'none';
    paneCat.style.display = '';
    if (!catPane) catPane = createRssCatalogPane(paneCat, { onChanged: onMyChanged });
    await catPane.reload();
  };

  tabMy.addEventListener('click', () => activate(activateMy));
  tabCat.addEventListener('click', () => activate(activateCatalog));
  // 跨入口同步：设置面板在线资源行下载/更新源库落盘后，开着的源库页签就地跟上
  // （只对本资产落盘做出反应——皮肤/手册等落盘与源库无关；ADR-0205 同款事件）
  offAsset = onDomainEvent(DOWNLOADS_CHANGED_EVENT, (evt: { fileName?: string }) => {
    if (evt && evt.fileName && evt.fileName !== RSS_CATALOG_FILE) return;
    if (rssManagerOpen && activeTab === 'catalog') void catPane?.reload();
  });

  try {
    // 渲染器懒加载解析跨域环（settings-panel schemaLoaders ←→ 本域管理弹窗，函数级延迟解析）
    await import('../settings-panel/renderer');
  } catch (e) {
    // 打开失败（动态加载）：close 复位守卫并清理半成品——否则单例标志滞留，「管理」此后无响应
    close();
    throw e;
  }

  // 渲染期间域已收口（unloadClipbook/closeAllOverlays 走过 close）→ 不再挂载 DOM/esc 层
  if (!rssManagerOpen) return;
  popup.appendChild(header);
  popup.appendChild(tabs);
  popup.appendChild(paneMy);
  popup.appendChild(paneCat);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  const handleReg = escManager.register('bz-rss-manager', {
    isVisible: () => true,
    close,
  });
  handle = handleReg;
  activate(activateMy);
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
