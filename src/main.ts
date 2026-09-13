/**
 * bz 插件入口：装配、命令注册（ADR-0004 裸注册）、设置页、懒加载（ADR-0003）。
 *
 * 命令 id 统一 `bz-` 前缀（ADR-0004 修订：2025 用户决策统一品牌前缀），不设置默认快捷键，
 * 卸载时 removeCommand 清理——取代原脚本的 window.__*CommandRegistered 防重标志。
 */
import { Plugin, PluginSettingTab } from 'obsidian';
import { notice, cleanupNotices } from './core/notice';
import { escManager } from './core/esc-manager';
import { closeItemMenu } from './core/item-actions';
import { cancelActiveFlowDialog } from './core/flow-dialog';
import { setApp, getApp } from './core/app';
import { setAISettingsProvider, resetAIProviderCache } from './core/ai';
import { setSettingsProvider, setSettingsSaver } from './core/settings-provider';
import { bindMobileViewport, unbindMobileViewport } from './core/viewport';
import { DOMAIN_ICONS } from './core/domain-icons';
import { clearDomainEvents } from './core/domain-bus';
import { attachObsidianAdapter, detachObsidianAdapter } from './core/obsidian-adapter';
import { renderSettingsInto } from './core/settings-schema';
import { mainSettingsSchema } from './core/settings-main-schema';

import BzSettings, { DEFAULT_SETTINGS, migrateMemoSettingKeys } from './settings';

// 备忘录（memo 域，ADR-0092 旧备忘录域退役后 memo.json 唯一属主，ADR-0117 正名：UI/交互/写盘/引用同步归本域；
// 被动捕获入口——启动自动弹出/file-open 提醒/侧栏图标——落点=备忘录面板）
import { openMemoPanel, addMemoItem, addMemoForActiveNote, unloadMemo, ensureMemoReminders, ensureFileSync, unloadFileSync } from './memo';
// 15 域（懒加载：首次命令/事件触发时 ensureXxx 幂等初始化）
import { addBelongingsItem, openBelongings, unloadBelongings } from './belongings';
// 剪藏本融合域（clipbook，ADR-0082/issue 177）：聚合讯+剪藏本合一
import { openClipbook, markAllUnreadRead, unloadClipbook } from './clipbook';
import { maybeFetchNews, fetchNowNews } from './clipbook/news-fetcher';
// 统一保险库（encrypt 域，ADR-0085）：密码管理已并入 encrypt，旧 password-vault 域已删除
// 日记本（diary 域，ADR-0115：原回忆墙升格正名，旧编辑域退役；媒体墙 + 写链路单一 UI）
import { openDiary, openDiaryWrite, unloadDiary } from './diary';
import { applyDirectories } from './diary/config';
import { openFavoritesPanel, addFavoriteItem, unloadFavorites } from './favorites';
// 阅读数据分析报告（读书报告内嵌化：独立弹窗退役，unloadReadingReport 只作废在途渲染/toast）
import { unloadReadingReport } from './reading-report';
// 影院（cinema 域，ADR-0087 起接管影视；旧 movie 域已退役。ADR-0090：openCinemaAnalysis
// 直达影院面板分析页，独立报告窗退役）
import { openCinema, addCinemaItem, openCinemaAnalysis, pickRandomCinema, unloadCinema } from './cinema';
// 书架墙（bookshelf 域，新域与书库并存；不修改旧书库代码；读书报告内嵌为面板内视图）
import { openBookshelf, openBookshelfReport, continueReading, unloadBookshelf } from './bookshelf';
// 影视分析报告独立域已退役（ADR-0090：报告窗并入影院内嵌分析页，命令直达 bz-cinema-analysis）
import { openReviewPanel, openReviewReport, reviewAddCurrent, reviewRemoveCurrent, reviewJumpOverdue, reviewMarkDialog, reviewMarkRating, reviewStart, ensureReview, unloadReview } from './review';
import {
  openSecondBrainPanel,
  openSecondBrainReference,
  openSecondBrainChat,
  rebuildSecondBrainLinks,
  runSecondBrainLinkAll,
  rebuildSecondBrainIndex,
  unloadSecondBrain,
} from './secondbrain';
import { openPomodoro, unloadPomodoro, ensurePomodoro, toggleFocus, skipBreak, togglePause } from './pomodoro';
import { mountPomodoroStatusBar, unmountPomodoroStatusBar } from './pomodoro/statusbar';
// 知识盒（knowledge 域，ADR-0072 自 bili-downloader 迁出、ADR-0112 三部重构；网页版已移除，见 tools/bili-downloader）
import { openKnowledgePanel, openTermNote, openKnowledgeAddTask, unloadKnowledge } from './knowledge';
// 附件搬移（ticket 65 新域：移动当前笔记附件，fileManager 自动更新内部链接 + 右键菜单）
import { openAttachMove, ensureAttachFileMenu, ATTACH_COMMAND_ID } from './attach';
// 统一保险库（encrypt 域，ADR-0085：密码/加密笔记/加密日记三资产单一面板）
import { openEncrypt, encryptCurrentNote, copyVaultPassword, lockEncrypt, unloadEncrypt, mountEncryptStatusBar, unmountEncryptStatusBar } from './encrypt';
// 密码本（password-vault 域，ADR-0109 自统一保险库拆回独立域；ADR-0078 成型版，共享保险箱锁与数据）
import { openPasswordVault, unloadPasswordVault, copyGeneratedPassword, lockPasswordVault } from './password-vault';
// 内容首页（home 域，ticket 177；旧入口页 launcher 已退役删除，ADR-0093）
import { openHome, unloadHome } from './home';
// 今日回顾（recap 域，方向一 R2）：当天五域痕迹聚合只读面板
import { openRecap, unloadRecap } from './recap';
import { ensureAutoSummary, unloadAutoSummary, redoSummaryForActiveFile } from './auto-summary';
// ai-agent 域解散：引用同步拆入 memo/favorites 域无条件常驻（原 ensureAIAgent/unloadAIAgent 换线）
// 小橘陪伴猫（smartcat 域：桌面宠物 + AI 陪伴；AI 走 bz core/ai，数据单 json smartcat.json）
import { ensureSmartCat, unloadSmartCat, openSmartCat, openSmartCatChat, hideSmartCat, openSmartcatDashboard } from './smartcat';
// 设置面板（settings-panel 域，ADR-0080：全域设置聚合入口，桌面侧栏工作台 / 移动命令面板）
import { openSettingsPanel, unloadSettingsPanel } from './settings-panel';
// 数据体检（checkup 域，D4：全插件数据可靠层只读巡检面板）
import { openDataCheckup, unloadDataCheckup } from './checkup';

/** 命令表：id/name 统一命名（spec「命令 id 全清单」第 9 轮：bz-<域>-<动作>）。
 *  域入口命令 icon 一律从 core/domain-icons（DOMAIN_ICONS）取——与设置面板导航单一事实源（enh-sweep-a）；
 *  动作类命令（加/评级/补链等）保持字面量图标。 */
const COMMANDS: { id: string; name: string; icon: string; callback: () => void }[] = [
  // 内容首页（home 域，ticket 177）
  { id: 'bz-home-open', name: '内容首页', icon: DOMAIN_ICONS.home, callback: () => openHome(getApp()) },
  // 今日回顾（recap 域，方向一 R2：当天日记/影视/读书/备忘录/番茄痕迹聚合面板）
  { id: 'bz-recap-today', name: '今日回顾', icon: DOMAIN_ICONS.recap, callback: () => openRecap(getApp()) },
  // 备忘录（memo 域，ADR-0092 起为 memo.json 唯一属主）
  { id: 'bz-memo-open', name: '备忘录', icon: DOMAIN_ICONS.memo, callback: () => openMemoPanel(getApp()) },
  { id: 'bz-memo-add', name: '加备忘录', icon: 'clipboard-list', callback: () => addMemoItem(getApp()) },
  // 给当前笔记记一笔（2026-09-11 首页入口菜单）：同一个创建弹窗 + 预置「定位」字段到当前笔记
  { id: 'bz-memo-note-binding', name: '给当前笔记记一笔', icon: 'notebook-pen', callback: () => addMemoForActiveNote(getApp()) },
  // 归物本
  { id: 'bz-belongings-add', name: '加物品', icon: 'archive', callback: () => addBelongingsItem(getApp()) },
  { id: 'bz-belongings-open', name: '归物本', icon: DOMAIN_ICONS.belongings, callback: () => openBelongings(getApp()) },
  // 剪藏本（clipbook 融合域，ADR-0082：聚合讯未读流 + 剪藏笔记一体化工作台）
  { id: 'bz-clipbook-open', name: '剪藏本', icon: DOMAIN_ICONS.clipping, callback: () => openClipbook(getApp()) },
  // 自动摘要（enh-autosum 包 1）：当前剪藏笔记手动重跑 AI 摘要（只重建摘要/标签，不动用户标题）
  { id: 'bz-auto-summary-redo', name: '重新生成当前剪藏摘要', icon: DOMAIN_ICONS['auto-summary'], callback: () => void redoSummaryForActiveFile(getApp()) },
  // 未读全部标为已读（2026-09-11 首页入口菜单）：跨全库批量已读，确认框写明篇数
  { id: 'bz-clipbook-mark-all-read', name: '未读全部标为已读', icon: 'check-check', callback: () => markAllUnreadRead() },
  // 立即抓取（issue 302 / ADR-0128）：插件内抓取的手动入口，忽略间隔
  { id: 'bz-clipbook-fetch-now', name: '剪藏本抓取新文章', icon: 'rss', callback: () => {
    void fetchNowNews().then((r) => {
      // 命令触发无就地可见结果（面板可能没开）：完成态给反馈；面板开着由 reloadIfOpen 同步
      if (r) notice(r.added > 0 ? `抓取完成，新增 ${r.added} 篇文章` : '抓取完成，暂无新文章', 'success');
    });
  } },

  // 日记本（diary 域，ADR-0115：原回忆墙升格正名；媒体墙即日记本唯一 UI）
  { id: 'bz-diary-open', name: '日记本', icon: DOMAIN_ICONS.diary, callback: () => openDiary(getApp()) },
  { id: 'bz-diary-write', name: '写日记', icon: DOMAIN_ICONS.diary, callback: () => openDiaryWrite(getApp()) },
  // 收藏本
  { id: 'bz-favorites-open', name: '收藏本', icon: DOMAIN_ICONS.favorites, callback: () => openFavoritesPanel(getApp()) },
  { id: 'bz-favorites-add', name: '加收藏', icon: 'bookmark', callback: () => addFavoriteItem(getApp()) },
  // 阅读数据分析报告（读书报告内嵌化：打开书架墙面板并切到报告视图；home 报告磁贴/剪藏本深链自动受益）
  { id: 'bz-reading-report-open', name: '阅读分析报告', icon: DOMAIN_ICONS['reading-report'], callback: () => openBookshelfReport(getApp()) },
  // 影视分析报告（ADR-0090 内嵌化：独立报告窗退役，命令直达影院面板分析页；
  // id 随域换 bz-cinema-analysis，名称「影视分析报告」保持用户习惯；pie-chart 与阅读 bar-chart-3、
  // 复习 calendar-check 三份报告图标各异——enh-sweep-a 错开）
  { id: 'bz-cinema-analysis', name: '影视分析报告', icon: 'pie-chart', callback: () => openCinemaAnalysis(getApp()) },
  // 影院（cinema 域，ADR-0087）
  { id: 'bz-cinema-open', name: '影院', icon: DOMAIN_ICONS.cinema, callback: () => openCinema(getApp()) },
  { id: 'bz-cinema-add', name: '加影视', icon: 'plus-circle', callback: () => addCinemaItem(getApp()) },
  // 随机抽一部（2026-09-11 首页入口菜单）：想看池随机 → 直开详情
  { id: 'bz-cinema-random-pick', name: '随机抽一部', icon: 'shuffle', callback: () => pickRandomCinema(getApp()) },
  // 书架墙（bookshelf 新域）
  { id: 'bz-bookshelf-open', name: '书库', icon: DOMAIN_ICONS.bookshelf, callback: () => openBookshelf(getApp()) },
  // 继续在读（2026-09-11 首页入口菜单）：开书架墙并落到「在读」分栏
  { id: 'bz-bookshelf-continue', name: '继续在读', icon: 'book-open', callback: () => void continueReading(getApp()) },
  // 复习计划（9 命令）
  { id: 'bz-review-open', name: '复习计划', icon: DOMAIN_ICONS.review, callback: () => openReviewPanel(getApp()) },
  // ticket 174：独立「复习计划分析报告」命令（直开统计弹窗）；图标弃 bar-chart-3（阅读分析报告独占，
  // enh-sweep-a 错开）改 calendar-check（呼应复习日程语义）
  { id: 'bz-review-report', name: '复习计划分析报告', icon: 'calendar-check', callback: () => openReviewReport(getApp()) },
  { id: 'bz-review-start', name: '开始复习', icon: 'play', callback: () => reviewStart(getApp()) },
  { id: 'bz-review-add', name: '加入复习计划', icon: 'plus', callback: () => reviewAddCurrent(getApp()) },
  { id: 'bz-review-remove', name: '移出复习计划', icon: 'minus', callback: () => reviewRemoveCurrent(getApp()) },
  { id: 'bz-review-overdue', name: '复习（跳转逾期）', icon: 'alarm-clock', callback: () => reviewJumpOverdue(getApp()) },
  { id: 'bz-review-rate', name: '复习（选择难度）', icon: 'gauge', callback: () => reviewMarkDialog(getApp()) },
  // f3：评级四命令去英文后缀并统一「复习（X）」标点（id 不动）
  { id: 'bz-review-again', name: '复习（忘了）', icon: 'rotate-ccw', callback: () => reviewMarkRating(getApp(), 'again') },
  { id: 'bz-review-hard', name: '复习（困难）', icon: 'trending-up', callback: () => reviewMarkRating(getApp(), 'hard') },
  { id: 'bz-review-good', name: '复习（一般）', icon: 'check', callback: () => reviewMarkRating(getApp(), 'good') },
  { id: 'bz-review-easy', name: '复习（简单）', icon: 'sparkles', callback: () => reviewMarkRating(getApp(), 'easy') },
  // 第二大脑（ticket 103：原闪念正名接管，主面板为统一入口）
  { id: 'bz-secondbrain-panel', name: '第二大脑面板', icon: DOMAIN_ICONS.secondbrain, callback: () => openSecondBrainPanel(getApp()) },
  // f7：与「第二大脑面板」区分——本命令打开参考侧边栏（右侧窄窗/移动端抽屉参考 tab）
  { id: 'bz-secondbrain-open', name: '第二大脑参考', icon: 'zap', callback: () => openSecondBrainReference(getApp()) },
  { id: 'bz-secondbrain-chat', name: '第二大脑对话', icon: 'message-circle', callback: () => openSecondBrainChat(getApp()) },
  // 自动双链（ticket 111）：当前笔记重跑一次关联（正文大改后的手动兜底入口）
  { id: 'bz-secondbrain-rebuild-links', name: '重跑当前笔记关联', icon: 'link', callback: () => rebuildSecondBrainLinks(getApp()) },
  // 自动双链（ticket 115）：存量未连接笔记手动批量补链（启动自动补链的显式兜底）
  { id: 'bz-secondbrain-link-all', name: '为未关联笔记批量补链', icon: 'link-2', callback: () => runSecondBrainLinkAll(getApp()) },
  // 重建索引（2026-09-11 首页入口菜单）：全库重建向量索引（函数早已存在，此前无命令入口）
  { id: 'bz-secondbrain-rebuild-index', name: '重建索引', icon: 'refresh-cw', callback: () => rebuildSecondBrainIndex(getApp()) },
  // 番茄钟（ticket 26-32 新域）
  { id: 'bz-pomodoro-open', name: '番茄钟', icon: DOMAIN_ICONS.pomodoro, callback: () => openPomodoro(getApp()) },
  // 开始/停止专注（2026-09-10：首页入口菜单联动，一把切换，等价面板「开始 / 重置」两颗钮）
  { id: 'bz-pomodoro-focus-toggle', name: '开始/停止专注', icon: 'play', callback: () => void toggleFocus(getApp()) },
  // 跳过休息 / 暂停·继续（2026-09-11 首页入口菜单）：休息中直接进下一轮专注；有无计时决定暂停还是继续
  { id: 'bz-pomodoro-skip', name: '跳过休息', icon: 'skip-forward', callback: () => skipBreak(getApp()) },
  { id: 'bz-pomodoro-pause', name: '暂停/继续专注', icon: 'pause', callback: () => togglePause(getApp()) },
  // 知识盒（knowledge 域，ADR-0112 三部：部壹文献录入与提炼 · 部贰卡片 · 部叁主题展示）
  { id: 'bz-knowledge-open', name: '知识盒', icon: DOMAIN_ICONS.knowledge, callback: () => openKnowledgePanel(getApp()) },
  { id: 'bz-knowledge-note-term', name: '术语生成文献笔记', icon: 'book-type', callback: () => openTermNote(getApp()) },
  // 视频生成文献笔记（2026-09-10：首页入口菜单联动，打开视频录入面板——链接/标题由面板内填或预填）
  { id: 'bz-knowledge-note-video', name: '视频生成文献笔记', icon: 'list-video', callback: () => openKnowledgeAddTask(getApp()) },
  // 附件搬移（ticket 65 新域：移动当前笔记附件到指定文件夹，fileManager 自动更新内部链接）
  { id: ATTACH_COMMAND_ID, name: '移动附件', icon: DOMAIN_ICONS.attach, callback: () => openAttachMove(getApp()) },
  // 保险箱（encrypt 域：移出式清单容器加密；原名「加密保险箱」，ticket 68 更名仅文案）
  { id: 'bz-encrypt-open', name: '保险库', icon: DOMAIN_ICONS.encrypt, callback: () => openEncrypt(getApp()) },
  { id: 'bz-encrypt-lock', name: '加密当前笔记', icon: 'lock-keyhole', callback: () => encryptCurrentNote(getApp()) },
  // 快速取密（fuzzy 选择器直取密码 → 剪贴板 60s 自动清空，不打开主面板）
  { id: 'bz-encrypt-copy-password', name: '快速复制密码', icon: 'key-round', callback: () => copyVaultPassword(getApp()) },
  // 锁定保险库（2026-09-11 首页入口菜单）：一步上锁、不开面板（此前只能进面板点「立即上锁」）。
  // id 不能用 bz-encrypt-lock —— 那条早被「加密当前笔记」占用（历史遗留的语义错位），改用 lock-vault
  { id: 'bz-encrypt-lock-vault', name: '锁定保险库', icon: 'lock', callback: () => lockEncrypt(getApp()) },
  // 密码本（password-vault 域，ADR-0109 拆回独立域：ADR-0078 成型版 UI，与保险库共享锁与数据）
  { id: 'bz-password-vault-open', name: '密码本', icon: DOMAIN_ICONS['password-vault'], callback: () => openPasswordVault(getApp()) },
  // 快速生成密码（2026-09-10：首页入口菜单联动，按设置的长度/字符集生成即复制，60s 后清空剪贴板，不开面板）
  { id: 'bz-password-vault-gen', name: '快速生成密码', icon: 'key-round', callback: () => void copyGeneratedPassword(getApp()) },
  // 锁定密码本（2026-09-11 首页入口菜单）：与保险库同库同锁（一把主密码）
  { id: 'bz-password-vault-lock', name: '锁定密码本', icon: 'lock', callback: () => lockPasswordVault(getApp()) },
  // 小橘陪伴猫（smartcat 域）
  { id: 'bz-smartcat-open', name: '小橘', icon: DOMAIN_ICONS.smartcat, callback: () => openSmartCat(getApp()) },
  // f7：去 message-circle 重复（第二大脑对话保留）→ messages-square
  { id: 'bz-smartcat-chat', name: '小橘聊天', icon: 'messages-square', callback: () => openSmartCatChat(getApp()) },
  { id: 'bz-smartcat-hide', name: '隐藏小橘', icon: 'eye-off', callback: () => hideSmartCat() },
  { id: 'bz-smartcat-dashboard', name: '小橘数据面板', icon: 'activity', callback: () => openSmartcatDashboard(getApp()) },
  // 设置面板（ADR-0080：全域设置聚合入口）
  { id: 'bz-settings-panel-open', name: '设置面板', icon: DOMAIN_ICONS['settings-panel'], callback: () => openSettingsPanel(getApp()) },
  // 数据体检（checkup 域，D4：全插件数据可靠层只读巡检；icon 与保险库体检同为 stethoscope，语义一致）
  { id: 'bz-data-checkup-open', name: '数据体检', icon: 'stethoscope', callback: () => void openDataCheckup(getApp()) },
];

/** 应用日记本设置到运行时常量（目录唯一真理跨域化：影视/书库由 diary/config 内部跨域解析） */
export function applyDiarySettingsToRuntime(s: BzSettings) {
  applyDirectories(s);
}

export default class BzPlugin extends Plugin {
  settings: BzSettings = { ...DEFAULT_SETTINGS };
  private registeredCommandIds: string[] = [];
  /** 设置落盘串行队列（C15）：并发 saveSettings 排队写入 */
  private saveQueue: Promise<void> = Promise.resolve();
  /** 卸载旗标（C13）：onLayoutReady 回调 / 延迟初始化定时器不随插件卸载摘除，
   *  启动窗口期内禁用插件后布局就绪（或 setTimeout 到点）须短路，防幽灵初始化且无卸载路径 */
  private unloaded = false;

  async onload() {
    const loaded = await this.loadData();
    // issue 260 正名迁移：旧 todo* 面板设置键就地改名（读旧写新删旧）；
    // C16：发生迁移即调度落盘——原先只改内存，data.json 旧键长期残留、每次启动重复迁移
    const memoKeysMigrated = migrateMemoSettingKeys(loaded);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    if (memoKeysMigrated) {
      void this.saveSettings().catch((e) => console.error('[bz] 设置键迁移落盘失败:', e));
    }
    setApp(this.app);
    // AI 设置注入（Q3 的 _q3Settings 语义 → 插件设置）
    setAISettingsProvider(() => this.settings);
    resetAIProviderCache();
    // 通用设置访问器（各域经 getSettings 读取）
    setSettingsProvider(() => this.settings);
    // 设置保存通道（域设置弹窗写回后持久化）
    setSettingsSaver(() => this.saveSettings());
    // 日记本目录常量（diary/config 内部跨域解析影视/书库目录）
    applyDiarySettingsToRuntime(this.settings);
    // 域事件总线地基：全插件唯一 vault 订阅点挂载（registerEvent 保证插件卸载时 Obsidian 自动清理引用）
    attachObsidianAdapter(this.app, (ref) => this.registerEvent(ref as any));

    // 移动端可视视口高度（issue 266）：把 visualViewport.height 写进 --bz-vvh，
    // 让移动端真全屏面板（.bz-panel-mtop）随软键盘收缩，底部输入条不再被键盘压住。
    // 桌面端无害（媒体查询不命中）；卸载时 onunload 解绑。
    bindMobileViewport();

    // 命令裸注册（ADR-0004：app.commands.addCommand 原样 id 注册——plugin.addCommand 会被 Obsidian 自动加插件前缀，主页.js 等外部裸 id 调用会失效）
    for (const c of COMMANDS) {
      (this.app as any).commands.addCommand({ id: c.id, name: c.name, icon: c.icon, callback: c.callback });
      this.registeredCommandIds.push(c.id);
    }

    // 附件搬移：文件右键菜单入口（md 笔记 →「搬移此笔记附件」，与命令同链路）
    ensureAttachFileMenu(this);

    // ribbon 主入口：备忘录 + 日记本（diary = ADR-0115 回忆墙升格，命令直挂不启动即 init）
    this.addRibbonIcon('check-square', '备忘录', () => openMemoPanel(this.app));
    this.addRibbonIcon('notebook-pen', '日记本', () => openDiary(getApp()));

    // 番茄钟状态栏（ticket 29：常驻倒计时，点击打开弹窗）
    mountPomodoroStatusBar(this.addStatusBarItem(), this.app);

    // 保险库状态栏（补丁2：锁状态提示，点击打开面板；解锁态由 encrypt Controller 接管刷新）
    mountEncryptStatusBar(this.addStatusBarItem());

    // 设置页
    this.addSettingTab(new BzSettingTab(this.app, this));

    // 事件常驻域按设置开关注册（懒加载架构）
    this.app.workspace.onLayoutReady(() => {
      // C13：布局就绪回调不随插件卸载摘除——启动窗口期内禁用插件时此处必须短路，
      // 否则备忘录自动弹出/剪藏摘要/复习监听/小橘等全部幽灵初始化且无卸载路径
      if (this.unloaded) return;
      // 备忘录提醒后台：启动自动弹出 + 打开笔记提醒（落点=备忘录面板；设置键 autoPopupOnStart/openNoteReminder）
      ensureMemoReminders(this.app);
      if (this.settings.autoSummaryEnabled) ensureAutoSummary(this.app);
      // 引用同步无条件常驻（issue 187：原 aiAgentEnabled 开关随旧 AIAgent 退役——
      // 备忘录/收藏本笔记 rename/delete 引用同步是数据完整性功能，不设开关）
      ensureFileSync(this.app);
      // 第二大脑（2026-09-12 拍板）：启用开关退役 → 启动即无条件自动加载（原懒加载分支已删）
      ensureSecondBrainOnReady(this.app, () => this.unloaded);
      // 复习计划：到期提醒开启时常驻（ticket 100——监听/染色/轮询统一启动；否则懒加载）；enableAutoNotify 缺省视为开
      if (this.settings.enableAutoNotify !== false) void ensureReview(this.app);
      // 番茄钟：启动即恢复（load+recover，正在倒计时则后台继续/按设置自动弹窗）
      void ensurePomodoro(this.app);
      // 聚合讯自动抓取（issue 302 / ADR-0128）：启动延迟一拍后台抓一轮（间隔判定在 fetcher 内）
      setTimeout(() => { if (!this.unloaded) void maybeFetchNews(); }, 0);
      // 小橘：启动即挂载（smartcatEnabled 开关；桌面宠物常驻）
      if (this.settings.smartcatEnabled) void ensureSmartCat(this.app);
    });
  }

  async onunload() {
    // C13：先置卸载旗标，短路尚未触发的 onLayoutReady 回调 / 延迟初始化定时器
    this.unloaded = true;
    // 移动端视口监听解绑 + --bz-vvh 清理（issue 266；连带卸掉 document 级监听）
    unbindMobileViewport();
    // 统一右键菜单/长按抽屉浮层先收口（fix(main)：卸载接线补全）
    closeItemMenu();
    // toast 卸载清理（UX 整改 l2-toast）：清空通知容器 DOM + 存活/去重状态
    cleanupNotices();
    // 清理裸注册命令（统一 bz- 前缀，必须显式 removeCommand）
    for (const id of this.registeredCommandIds) {
      try {
        (this.app as any).commands.removeCommand(id);
      } catch (e) {
        /* 命令可能已被移除 */
      }
    }
    escManager.destroy();
    unmountPomodoroStatusBar();
    unmountEncryptStatusBar();
    unloadPomodoro();
    unloadMemo();
    unloadFileSync();
    unloadHome();
    unloadRecap();
    unloadEncrypt();
    unloadPasswordVault();
    unloadSmartCat();
    // 设置面板（ADR-0080：DOM 清理 + esc 注销）
    unloadSettingsPanel();
    // 数据体检（checkup 域，D4：作废在途体检 + 面板 DOM 清理 + esc 注销）
    unloadDataCheckup();
    // 第二大脑：窄窗/抽屉 DOM、5s 防抖定时器、DeepSeek 服务、模块单例复位（ticket 107 补接线——
    // 原先 unloadSecondBrain 导出但从未被调用，禁用插件后残留窗体且防抖 refresh 仍会触发）
    unloadSecondBrain();
    // 各域卸载清理补全（fix(main)：unload 函数均不内部触发 ensure，可无条件调用；
    // 未初始化域调用为幂等空清理，不引起无谓装载）
    // 日记本（diary 域，ADR-0115）：面板 DOM 清理 + 模块单例复位
    unloadDiary();
    unloadBelongings();
    unloadFavorites();
    unloadReview();
    unloadCinema();
    // 书架墙（bookshelf 域：面板 DOM + 模块单例复位）
    unloadBookshelf();
    unloadReadingReport();
    // 剪藏本融合域（ADR-0082）：卸载统一面板；旧 news/clipping 已无独立挂载
    unloadClipbook();
    unloadAutoSummary();
    // 文献盒（ADR-0072 迁出：面板 DOM + 模块单例复位）
    unloadKnowledge();
    // 域事件总线收口：摘除 vault 订阅点 + 清空全部域事件订阅（总线为进程内单例，随插件卸载全量清空）
    detachObsidianAdapter();
    clearDomainEvents();
    // C14：在途确认框（flow-dialog）先按取消语义结算再清 DOM——原先硬删遮罩不走 settle，
    // 未决 Promise 永久悬挂，等确认结果的后续操作静默终止
    cancelActiveFlowDialog();
    // 日记本写链路弹窗 DOM 清理（写日记/标签选择器/滚轮时间选择器挂 body 的浮层）
    const diaryIds = [
      'add-diary-mask',
      'add-diary-popup',
      'diary-tag-selector-mask',
      'diary-tag-selector-popup',
      'unified-datetime-picker-mask',
      '__shared_confirm_mask__',
    ];
    for (const id of diaryIds) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    // 卸载兜底（UX 整改 l2）：异步尾任务禁用前若 notify 重建过通知容器，此处再次清理
    cleanupNotices();
  }

  async saveSettings() {
    // C15：落盘串行化——并发调用（连拨开关/域设置弹窗连写）经 promise 链排队写入，
    // 防 saveData 并发写 data.json 交错（历史上有并发写损坏先例）；失败不断链
    const run = this.saveQueue
      .then(() => this.saveData(this.settings))
      .then(() => {
        // 设置变更后重置 AI provider 缓存：DeepSeek key/服务商改动立即生效（AI 消费方）
        resetAIProviderCache();
      });
    this.saveQueue = run.catch(() => undefined);
    await run;
  }
}

/** 第二大脑在布局就绪后初始化（按设置开关；ticket 103 原闪念懒加载换线） */
function ensureSecondBrainOnReady(app: any, isUnloaded: () => boolean) {
  // 延迟到 onLayoutReady 之后的事件循环，避免 onload 时序问题
  setTimeout(() => {
    // C13：插件已卸载（setTimeout 到点晚于 onunload）→ 不再幽灵初始化
    if (isUnloaded()) return;
    // 动态引入避免循环依赖；第二大脑自身懒加载
    import('./secondbrain').then((m) => m.ensureSecondBrain(app));
  }, 0);
}

// ===== 设置页（ADR-0009：单页平铺，只含「🤖 AI」「📂 数据存储路径」两区块）=====
// ticket 131：两区块 schema 化（ADR-0064 声明式渲染器），原私有 textSetting/toggleSetting/
// pathSetting helper 退役（text 防抖落盘/onCommit 一次性提示语义收口 core 渲染器）。

export class BzSettingTab extends PluginSettingTab {
  plugin: BzPlugin;

  constructor(app: any, plugin: BzPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    // AI 服务商切换 → 密钥行显隐走 visibleWhen；存储路径 onCommit warning 文案逐字保留
    // （schema 定义见 core/settings-main-schema.ts）；渲染器统一完成徽标/两行式标注/初始显隐
    renderSettingsInto(containerEl, mainSettingsSchema());
  }
}
