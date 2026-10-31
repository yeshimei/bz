/**
 * bz 插件入口：装配、命令注册（ADR-0004 裸注册）、设置页、懒加载（ADR-0003）。
 *
 * 命令 id 统一 `bz-` 前缀（ADR-0004 修订：2025 用户决策统一品牌前缀），不设置默认快捷键，
 * 卸载时 removeCommand 清理——取代原脚本的 window.__*CommandRegistered 防重标志。
 */
import { Plugin, PluginSettingTab, Setting, Platform } from 'obsidian';
import { notice, cleanupNotices } from './core/notice';
import { escManager } from './core/esc-manager';
import { closeItemMenu } from './core/item-actions';
import { cancelActiveFlowDialog } from './core/flow-dialog';
import { closeSettingsModal } from './core/settings-modal';
import { closeModelPicker } from './core/settings-model-picker';
import { closePathPicker } from './core/path-picker';
import { closeLightbox } from './core/ui/lightbox';
import { closeAllModals } from './core/ui/modal';
import { closeAllOverlays } from './core/dom';
import { setApp, getApp } from './core/app';
import { setPluginRelDir, vaultBasePathOf } from './core/plugin-path';
import { scheduleSelfUpdateCheck } from './core/self-update';
import { applySkinManifest, loadLocalSkinPack } from './core/skin-pack';
import { refreshManifest } from './core/download-manifest';
import { autoUpdateAssets } from './core/auto-assets';
import { setAISettingsProvider, resetAIProviderCache } from './core/ai';
import { setSettingsProvider, setSettingsSaver, setSettingsPanelOpener } from './core/settings-provider';
import { bindMobileViewport, unbindMobileViewport } from './core/viewport';
import { DOMAIN_ICONS } from './core/domain-icons';
import { clearDomainEvents } from './core/domain-bus';
import { attachObsidianAdapter, detachObsidianAdapter } from './core/obsidian-adapter';

import { bootstrapStorageDir, storageDir } from './core/storage';
import { devAutoOpen } from './core/dev-auto-open';
import { setupAlreadyDone } from './core/setup-state';
import { isMobileEnv } from './core/mobile';
import BzSettings, { DEFAULT_SETTINGS, migrateAutoUpdateDefault, migrateMemoSettingKeys, migrateAutoLinkSettings, migrateRetiredAIKeys, migrateRetiredFavoritesSortKey, migrateLinkMinScoreScale, migrateRetiredSecondBrainKeys, migrateRetiredJevKeys, migrateAsrKeys, migrateExternalToolKeys } from './settings';

// 备忘录（memo 域，ADR-0092 旧备忘录域退役后 memo.json 唯一属主，ADR-0117 正名：UI/交互/写盘/引用同步归本域；
// 被动捕获入口——启动自动弹出/file-open 提醒/侧栏图标——落点=备忘录面板）
import { openMemoPanel, addMemoItem, addMemoForActiveNote, unloadMemo, ensureMemoReminders, ensureFileSync, unloadFileSync } from './memo';
// 15 域（懒加载：首次命令/事件触发时 ensureXxx 幂等初始化）
import { addBelongingsItem, openBelongings, openBelongingsReport, unloadBelongings } from './belongings';
// 剪藏本融合域（clipbook，ADR-0082/issue 177）：聚合讯+剪藏本合一
import { openClipbook, markAllUnreadRead, openReadingPress, unloadClipbook, ensureClipbookFileSync, unloadClipbookFileSync } from './clipbook';
import { maybeFetchNews, fetchNowNews, notifyManualFetchResult } from './clipbook/news-fetcher';
// 统一保险库（encrypt 域，ADR-0085）：密码管理已并入 encrypt，旧 password-vault 域已删除
// 日记本（diary 域，ADR-0115：原回忆墙升格正名，旧编辑域退役；媒体墙 + 写链路单一 UI）
import { openDiary, openDiaryWrite, prewarmDiary, unloadDiary } from './diary';
import { applyDirectories } from './diary/config';
import { openFavoritesPanel, addFavoriteItem, unloadFavorites } from './favorites';
// 脸谱（people 域，issue 435/ADR-0191：留痕导出的微信聊天 → AI 提炼脸谱；原文不落盘）
import { openPeople, importWechat, unloadPeople } from './people';
// 阅读数据分析报告（读书报告内嵌化：独立弹窗退役，unloadReadingReport 只作废在途渲染/toast）
import { unloadReadingReport } from './reading-report';
// 影院（cinema 域，ADR-0087 起接管影视；旧 movie 域已退役。ADR-0090：openCinemaAnalysis
// 直达影院面板分析页，独立报告窗退役）
import { openCinema, addCinemaItem, openCinemaAnalysis, pickRandomCinema, unloadCinema } from './cinema';
// 游戏库（gameshelf 域，issue 368：Steam 直连自动拉库，我的/游戏/*.md 一作一笔记）
import { openGameshelf, openGameshelfStats, syncGameshelf, unloadGameshelf } from './gameshelf';
// 书架墙（bookshelf 域，新域与书库并存；不修改旧书库代码；读书报告内嵌为面板内视图）
import { openBookshelf, openBookshelfReport, continueReading, unloadBookshelf } from './bookshelf';
// 影视分析报告独立域已退役（ADR-0090：报告窗并入影院内嵌分析页，命令直达 bz-cinema-analysis）
import { openReviewPanel, openReviewReport, openReviewAnalysis, openQuizPractice, reviewAddCurrent, reviewRemoveCurrent, reviewJumpOverdue, reviewMarkDialog, reviewMarkRating, reviewStart, ensureReview, unloadReview } from './review';
import {
  openSecondBrainPanel,
  openSecondBrainReference,
  openSecondBrainChat,
  openSecondBrainWeekly,
  rebuildSecondBrainIndex,
  unloadSecondBrain,
  ensureSecondBrain,
  ensureRemoteOllamaUrl,
} from './secondbrain';
import { openPomodoro, unloadPomodoro, ensurePomodoro, toggleFocus, skipBreak, togglePause } from './pomodoro';
import { mountPomodoroStatusBar, unmountPomodoroStatusBar } from './pomodoro/statusbar';
// 知识盒（knowledge 域，ADR-0072 自 bili-downloader 迁出、ADR-0112 三部重构；网页版已移除，见 tools/bili-downloader）
import { openKnowledgePanel, openTermNote, openPassageNote, openImageNote, openKnowledgeAddTask, unloadKnowledge, relinkActiveNote, linkAllInBoxes, ensureKnowledgeFileSync, unloadKnowledgeFileSync } from './knowledge';
// 挂载树白板（knowledge 域，issues 317/319）：两个命令直达 + 卸载清理（自绘遮罩挂 body，卸载必须摘）
import { destroyMountTree, openMountTree, refreshMountTree } from './knowledge/mount-canvas';
// 附件搬移（ticket 65 新域：移动当前笔记附件，fileManager 自动更新内部链接 + 右键菜单）
import { openAttachMove, ensureAttachFileMenu, ATTACH_COMMAND_ID } from './attach';
// 统一保险库（encrypt 域，ADR-0085：密码/加密笔记/加密日记三资产单一面板）
import { openEncrypt, encryptCurrentNote, lockEncrypt, changeSafePassword, unloadEncrypt, mountEncryptStatusBar, unmountEncryptStatusBar } from './encrypt';
// 密码本（password-vault 域，ADR-0109 自统一保险库拆回独立域；ADR-0078 成型版，共享保险箱锁与数据）
import { openPasswordVault, unloadPasswordVault, copyGeneratedPassword, lockPasswordVault, quickGeneratePassword } from './password-vault';
// 内容首页（home 域，ticket 177；旧入口页 launcher 已退役删除，ADR-0093）
import { openHome, unloadHome } from './home';
// recap 域面板已退役（ADR-0157）：总结链路一度迁 home 时间线卡动作行，
// 该入口 2026-09-17 也已去掉（用户点名：首页不留「生成今日总结」）。
// 纯函数库留 src/recap：collectRecap 仍供 home/river 摘要数字，summarize（AI 总结写日记）
// 有全套单测、暂无 UI 出口，main 不再接线
import { ensureAutoSummary, unloadAutoSummary, redoSummaryForActiveFile } from './auto-summary';
// ai-agent 域解散：引用同步拆入 memo/favorites 域无条件常驻（原 ensureAIAgent/unloadAIAgent 换线）
// 小橘陪伴猫（smartcat 域：桌面宠物 + AI 陪伴；AI 走 bz core/ai，数据单 json smartcat.json）
import { ensureSmartCat, unloadSmartCat, openSmartCat, openSmartCatChat, hideSmartCat, openSmartcatDashboard } from './smartcat';
// 设置面板（settings-panel 域，ADR-0080：全域设置聚合入口，桌面侧栏工作台 / 移动命令面板）
import { openSettingsPanel, unloadSettingsPanel } from './settings-panel';
// 数据体检（checkup 域，D4：全插件数据可靠层只读巡检面板）
import { openDataCheckup, unloadDataCheckup } from './checkup';
// 工具坞（dock 域，ADR-0235 + ADR-0236：外部工具的标准接口 + 集中观测台 + **bz 调度**；
// 不关心工具是什么。调度只在桌面端、且在 Obsidian 开着的期间生效）
import {
  openDock,
  unloadDock,
  startDockScheduler,
  stopDockScheduler,
  runToolDirect,
  dockToolLabel,
  readToolEntries,
  initDock,
  mountDockStatusBar,
  unmountDockStatusBar,
  installVaultFs,
  primeVaultFs,
  markDockExit,
} from './dock';

/** 命令表：id/name 统一命名（spec「命令 id 全清单」第 9 轮：bz-<域>-<动作>）。
 *  域入口命令 icon 一律从 core/domain-icons（DOMAIN_ICONS）取——与设置面板导航单一事实源（enh-sweep-a）；
 *  动作类命令（加/评级/补链等）保持字面量图标。 */
const COMMANDS: { id: string; name: string; icon: string; callback: () => void }[] = [
  // 内容首页（home 域，ticket 177）
  { id: 'bz-home-open', name: '内容首页', icon: DOMAIN_ICONS.home, callback: () => openHome(getApp()) },
  // 备忘录（memo 域，ADR-0092 起为 memo.json 唯一属主）
  { id: 'bz-memo-open', name: '备忘录', icon: DOMAIN_ICONS.memo, callback: () => openMemoPanel(getApp()) },
  { id: 'bz-memo-add', name: '加备忘录', icon: 'clipboard-list', callback: () => addMemoItem(getApp()) },
  // 给当前笔记记一笔（2026-09-11 首页入口菜单）：同一个创建弹窗 + 预置「定位」字段到当前笔记
  { id: 'bz-memo-note-binding', name: '给当前笔记记一笔', icon: 'notebook-pen', callback: () => addMemoForActiveNote(getApp()) },
  // 归物本
  { id: 'bz-belongings-add', name: '加物品', icon: 'archive', callback: () => addBelongingsItem(getApp()) },
  { id: 'bz-belongings-open', name: '归物本', icon: DOMAIN_ICONS.belongings, callback: () => openBelongings(getApp()) },
  // 年度资产报告（issue 356：报告页直开，面板未开也从盘载库；icon 与三份既有分析报告错开）
  { id: 'bz-belongings-report', name: '归物本年度报告', icon: 'trending-up', callback: () => openBelongingsReport(getApp()) },
  // 剪藏本（clipbook 融合域，ADR-0082：聚合讯未读流 + 剪藏笔记一体化工作台）
  { id: 'bz-clipbook-open', name: '剪藏本', icon: DOMAIN_ICONS.clipping, callback: () => openClipbook(getApp()) },
  // 自动摘要（enh-autosum 包 1）：当前剪藏笔记手动重跑 AI 摘要（只重建摘要/标签，不动用户标题）
  { id: 'bz-auto-summary-redo', name: '重新生成当前剪藏摘要', icon: DOMAIN_ICONS['auto-summary'], callback: () => void redoSummaryForActiveFile(getApp()) },
  // 未读全部标为已读（2026-09-11 首页入口菜单）：跨全库批量已读，确认框写明篇数
  { id: 'bz-clipbook-mark-all-read', name: '未读全部标为已读', icon: 'check-check', callback: () => markAllUnreadRead() },
  // 立即抓取（issue 302 / ADR-0128）：插件内抓取的手动入口，忽略间隔
  { id: 'bz-clipbook-fetch-now', name: '剪藏本抓取新文章', icon: 'rss', callback: () => {
    // 命令触发无就地可见结果（面板可能没开）：完成态给反馈；面板开着由 reloadIfOpen 同步
    void fetchNowNews().then(notifyManualFetchResult);
  } },
  // 剪藏阅读报告（issue 358「我读了什么」）：剪藏本自有阅读流水报告弹层（数据 = clipbook.json
  // 侧写 readLog），与书库「阅读分析报告」并列；图标弃 bar-chart-3（阅读分析报告独占）改
  // newspaper（剪藏本语义），与 pie-chart/calendar-check 继续错开
  { id: 'bz-clipbook-report', name: '剪藏阅读报告', icon: 'newspaper', callback: () => openReadingPress(getApp()) },

  // 日记本（diary 域，ADR-0115：原回忆墙升格正名；媒体墙即日记本唯一 UI）
  { id: 'bz-diary-open', name: '日记本', icon: DOMAIN_ICONS.diary, callback: () => openDiary(getApp()) },
  { id: 'bz-diary-write', name: '写日记', icon: DOMAIN_ICONS.diary, callback: () => openDiaryWrite(getApp()) },
  // 收藏本
  { id: 'bz-favorites-open', name: '收藏本', icon: DOMAIN_ICONS.favorites, callback: () => openFavoritesPanel(getApp()) },
  { id: 'bz-favorites-add', name: '加收藏', icon: 'bookmark', callback: () => addFavoriteItem(getApp()) },
  // 脸谱（people 域，issue 435/ADR-0191；issue 449 D 命名收敛：去「本」字、导入动作以数据源立题）
  { id: 'bz-people-open', name: '脸谱', icon: DOMAIN_ICONS.people, callback: () => openPeople(getApp()) },
  { id: 'bz-people-import', name: '脸谱数据源', icon: DOMAIN_ICONS.people, callback: () => importWechat(getApp()) },
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
  // 游戏库（gameshelf 域，issue 368）
  { id: 'bz-gameshelf-open', name: '游戏库', icon: DOMAIN_ICONS.gameshelf, callback: () => openGameshelf(getApp()) },
  // 立即同步（2026-09-17 首页入口菜单）：不开面板直接拉库（即时类，首页菜单里 keepHome）
  { id: 'bz-gameshelf-sync', name: '同步游戏库', icon: 'refresh-cw', callback: () => void syncGameshelf(getApp()) },
  // 数据统计（2026-09-17 首页入口菜单）：直开游戏库面板并落统计页（影院分析报告同范式；
  // chart-bar 与「阅读分析报告」的 bar-chart-3 错开）
  { id: 'bz-gameshelf-stats', name: '游戏库数据统计', icon: 'chart-bar', callback: () => openGameshelfStats(getApp()) },
  // 书架墙（bookshelf 新域）
  { id: 'bz-bookshelf-open', name: '书库', icon: DOMAIN_ICONS.bookshelf, callback: () => openBookshelf(getApp()) },
  // 继续在读（2026-09-11 首页入口菜单）：开书架墙并落到「在读」分栏
  { id: 'bz-bookshelf-continue', name: '继续在读', icon: 'book-open', callback: () => void continueReading(getApp()) },
  // 复习计划（10 命令；评级四命令原拟裁撤，issue 362 做题家面板起依赖评级动作——保留）

  { id: 'bz-review-open', name: '复习计划', icon: DOMAIN_ICONS.review, callback: () => openReviewPanel(getApp()) },
  // ticket 174：独立「复习计划分析报告」命令（直开统计弹窗）；图标弃 bar-chart-3（阅读分析报告独占，
  // enh-sweep-a 错开）改 calendar-check（呼应复习日程语义）
  { id: 'bz-review-report', name: '复习计划分析报告', icon: 'calendar-check', callback: () => openReviewReport(getApp()) },
  // 记忆分析特刊（analysis/）：全屏逐幕分析层——滚轮/方向键一滚一幕；空库回落经典统计弹层
  { id: 'bz-review-analysis', name: '记忆分析', icon: 'flame', callback: () => openReviewAnalysis(getApp()) },
  { id: 'bz-review-start', name: '开始复习', icon: 'play', callback: () => reviewStart(getApp()) },
  // 做题练习（issue 362）：做题家独立面板——不排期复习，选题范围 + 本轮题量直接开刷；
  // icon 与复习域设置分组「做题家」同款 graduation-cap（域语言一致，命令表内无重复）
  { id: 'bz-review-quiz-open', name: '做题练习', icon: 'graduation-cap', callback: () => openQuizPractice(getApp()) },
  { id: 'bz-review-add', name: '加入复习计划', icon: 'plus', callback: () => reviewAddCurrent(getApp()) },
  { id: 'bz-review-remove', name: '移出复习计划', icon: 'minus', callback: () => reviewRemoveCurrent(getApp()) },
  // 呈报#56（R12）：六条复习命令 name 括号式 → 动宾式（命令面板顺读；id 一律不动）
  { id: 'bz-review-overdue', name: '跳转逾期复习', icon: 'alarm-clock', callback: () => reviewJumpOverdue(getApp()) },
  { id: 'bz-review-rate', name: '选择复习难度', icon: 'gauge', callback: () => reviewMarkDialog(getApp()) },
  // f3：评级四命令去英文后缀（issue 362 起做题家面板依赖评级动作——保留）；R12 动宾式更名
  { id: 'bz-review-again', name: '复习评级：忘了', icon: 'rotate-ccw', callback: () => reviewMarkRating(getApp(), 'again') },
  { id: 'bz-review-hard', name: '复习评级：困难', icon: 'trending-up', callback: () => reviewMarkRating(getApp(), 'hard') },
  { id: 'bz-review-good', name: '复习评级：一般', icon: 'check', callback: () => reviewMarkRating(getApp(), 'good') },
  { id: 'bz-review-easy', name: '复习评级：简单', icon: 'sparkles', callback: () => reviewMarkRating(getApp(), 'easy') },
  // 第二大脑（ticket 103：原闪念正名接管，主面板为统一入口）
  { id: 'bz-secondbrain-panel', name: '第二大脑面板', icon: DOMAIN_ICONS.secondbrain, callback: () => openSecondBrainPanel(getApp()) },
  // f7：与「第二大脑面板」区分——本命令打开参考侧边栏（右侧窄窗/移动端抽屉参考 tab）
  { id: 'bz-secondbrain-open', name: '第二大脑参考', icon: 'zap', callback: () => openSecondBrainReference(getApp()) },
  { id: 'bz-secondbrain-chat', name: '第二大脑对话', icon: 'message-circle', callback: () => openSecondBrainChat(getApp()) },
  // 重建索引（2026-09-11 首页入口菜单）：全库重建向量索引（函数早已存在，此前无命令入口）
  // 留第二大脑——它是检索本体，不是关联（ADR-0141 §1）
  { id: 'bz-secondbrain-rebuild-index', name: '重建索引', icon: 'refresh-cw', callback: () => rebuildSecondBrainIndex(getApp()) },
  // 本周知识动态（issue 360）：每周知识摘要手动入口——打开详情弹层并强制重聚一轮；
  // 自动路径为启动后延迟静默聚合（无新内容零打扰）。calendar-days 与 review 的 calendar-check 错开
  { id: 'bz-secondbrain-weekly', name: '本周知识动态', icon: 'calendar-days', callback: () => openSecondBrainWeekly(getApp()) },
  // 番茄钟（ticket 26-32 新域）
  { id: 'bz-pomodoro-open', name: '番茄钟', icon: DOMAIN_ICONS.pomodoro, callback: () => openPomodoro(getApp()) },
  // 开始/重置专注（2026-09-10 首页入口菜单联动，一把切换；呈报#63-PM2 命令侧文案改「重置」：
  // 本命令的「停」是重置回空闲、会话作废，与首页菜单「停止专注」= 暂停（可继续）是两件事，
  // 一词两义就此拆开。等价面板「开始 / 重置」两颗钮）
  { id: 'bz-pomodoro-focus-toggle', name: '开始/重置专注', icon: 'play', callback: () => void toggleFocus(getApp()) },
  // 跳过休息 / 暂停·继续（2026-09-11 首页入口菜单）：休息中直接进下一轮专注；有无计时决定暂停还是继续
  { id: 'bz-pomodoro-skip', name: '跳过休息', icon: 'skip-forward', callback: () => skipBreak(getApp()) },
  { id: 'bz-pomodoro-pause', name: '暂停/继续专注', icon: 'pause', callback: () => togglePause(getApp()) },
  // 知识盒（knowledge 域，ADR-0112 三部：部壹文献录入与提炼 · 部贰卡片 · 部叁主题展示）
  { id: 'bz-knowledge-open', name: '知识盒', icon: DOMAIN_ICONS.knowledge, callback: () => openKnowledgePanel(getApp()) },
  { id: 'bz-knowledge-note-term', name: '名词生成文献笔记', icon: 'book-type', callback: () => openTermNote(getApp()) },
  // 影像生成文献笔记（2026-09-10 首页入口菜单联动；issue 310 起直达影像录入界面——链接由面板内填或预填）
  { id: 'bz-knowledge-note-video', name: '影像生成文献笔记', icon: 'list-video', callback: () => openKnowledgeAddTask(getApp()) },
  // 段落/图版生成文献笔记（issue 326）：与名词命令同款快捷入口——段落选区自动进输入框、当前笔记自动作来源（ADR-0116）
  { id: 'bz-knowledge-note-passage', name: '段落生成文献笔记', icon: 'align-left', callback: () => openPassageNote(getApp()) },
  { id: 'bz-knowledge-note-image', name: '图版生成文献笔记', icon: 'image', callback: () => openImageNote(getApp()) },
  // 自动关联（ADR-0141 §1：功能归属迁入知识盒，引擎留第二大脑；命令身份改 bz-knowledge-*）
  // 重跑当前笔记关联：正文大改后的手动兜底；范围恒为三个盒子，盒外笔记直接拒绝
  { id: 'bz-knowledge-relink', name: '重跑当前笔记关联', icon: 'link', callback: () => {
    ensureSecondBrain(getApp()); // 通道由第二大脑域注入（幂等）；未就绪时命令内会明确提示
    void relinkActiveNote(getApp());
  } },
  // 为未关联笔记批量补链：启动自动补链的显式兜底入口（三个盒子内缺关联的笔记）
  { id: 'bz-knowledge-link-all', name: '为未关联笔记批量补链', icon: 'link-2', callback: () => {
    ensureSecondBrain(getApp());
    // 命令回调里的 promise 没人 await：补链失败已经由 linkAllInBoxes 自己 notice 过，
    // 这里只兜底吞掉 rejection，别让它在没有 DOM 的宿主/卸载后变成 unhandled
    void linkAllInBoxes().catch(() => undefined);
  } },
  // 看挂载树（issue 319）：主卡 = 当前打开的笔记；没有打开的笔记就只提示（不猜主卡）
  { id: 'bz-knowledge-mount-tree', name: '看挂载树', icon: 'network', callback: () => {
    const file: any = getApp()?.workspace?.getActiveFile?.();
    if (!file || file.extension !== 'md') {
      notice('看挂载树：先打开一张笔记，它会作为主卡', 'info');
      return;
    }
    void openMountTree(String(file.path));
  } },
  // 重跑挂载建议（issue 319）：当前白板主卡的建议重跑；没开白板就提示
  { id: 'bz-knowledge-mount-refresh', name: '重跑挂载建议', icon: 'refresh-cw', callback: () => void refreshMountTree() },
  // 附件搬移（ticket 65 新域：搬移当前笔记附件到指定文件夹，fileManager 自动更新内部链接；
  // 呈报#64/AT1：命令/弹窗「移动附件」与右键「搬移此笔记附件」双动词统一为「搬移」）
  { id: ATTACH_COMMAND_ID, name: '搬移附件', icon: DOMAIN_ICONS.attach, callback: () => openAttachMove(getApp()) },
  // 保险箱（encrypt 域：移出式清单容器加密；原名「加密保险箱」，ticket 68 更名仅文案）
  { id: 'bz-encrypt-open', name: '保险库', icon: DOMAIN_ICONS.encrypt, callback: () => openEncrypt(getApp()) },
  { id: 'bz-encrypt-lock', name: '加密当前笔记', icon: 'lock-keyhole', callback: () => encryptCurrentNote(getApp()) },
  // 锁定保险库（2026-09-11 首页入口菜单）：一步上锁、不开面板（此前只能进面板点「立即上锁」）。
  // id 不能用 bz-encrypt-lock —— 那条早被「加密当前笔记」占用（历史遗留的语义错位），改用 lock-vault
  { id: 'bz-encrypt-lock-vault', name: '锁定保险库', icon: 'lock', callback: () => lockEncrypt(getApp()) },
  // 修改主密码（ADR-0211 / issue 508）：信封结构下只重加密清单，数据文件零接触，亚秒级完成
  { id: 'bz-encrypt-change-password', name: '修改保险库密码', icon: 'key-round', callback: () => void changeSafePassword(getApp()) },
  // 密码本（password-vault 域，ADR-0109 拆回独立域：ADR-0078 成型版 UI，与保险库共享锁与数据）
  { id: 'bz-password-vault-open', name: '密码本', icon: DOMAIN_ICONS['password-vault'], callback: () => openPasswordVault(getApp()) },
  // 快速取密（ADR-0158 统一流：fuzzy 列现有密码 + 顶部「生成新」，搜到即复制、无命中生成；
  // 60s 后清空剪贴板、不弹明文、不开面板。原 bz-encrypt-copy-password 退役，同语义由本条承接）
  { id: 'bz-password-vault-gen', name: '快速取密', icon: 'key-round', callback: () => void copyGeneratedPassword(getApp()) },
  // 快速生成密码（2026-09-24 首页右键菜单）：不解锁不开面板，生成即复制剪贴板 + 记待存
  // 状态；下次解锁密码本自动弹录入窗预填该密码（与「快速取密」差异：跳过选择器直接出新密码）
  { id: 'bz-password-vault-quick-gen', name: '快速生成密码', icon: 'wand-sparkles', callback: () => void quickGeneratePassword(getApp()) },
  // 锁定密码本（2026-09-11 首页入口菜单）：与保险库同库同锁（一把主密码）
  { id: 'bz-password-vault-lock', name: '锁定密码本', icon: 'lock', callback: () => lockPasswordVault(getApp()) },
  // 小橘陪伴猫（smartcat 域）。ADR-0254：整组受域开关 smartcatEnabled 管——关掉时这四条
  // 从命令面板撤下（注册处过滤 + 运行中拨开关即时增删，见 applySmartcatDomain）
  { id: 'bz-smartcat-open', name: '小橘', icon: DOMAIN_ICONS.smartcat, callback: () => openSmartCat(getApp()) },
  // f7：去 message-circle 重复（第二大脑对话保留）→ messages-square
  { id: 'bz-smartcat-chat', name: '小橘聊天', icon: 'messages-square', callback: () => openSmartCatChat(getApp()) },
  { id: 'bz-smartcat-hide', name: '隐藏小橘', icon: 'eye-off', callback: () => hideSmartCat() },
  { id: 'bz-smartcat-dashboard', name: '小橘数据面板', icon: 'activity', callback: () => openSmartcatDashboard(getApp()) },
  // 设置面板（ADR-0080：全域设置聚合入口）
  { id: 'bz-settings-panel-open', name: '设置面板', icon: DOMAIN_ICONS['settings-panel'], callback: () => openSettingsPanel(getApp()) },
  // 数据体检（checkup 域，D4：全插件数据可靠层只读巡检；icon 与保险库体检同为 stethoscope，语义一致）
  { id: 'bz-data-checkup-open', name: '数据体检', icon: 'stethoscope', callback: () => void openDataCheckup(getApp()) },
  // 工具坞（dock 域，ADR-0235 + ADR-0236：外部工具的登记 / 启动 / 回显 / 留痕 / **调度**；
  // 面板是唯一入口，自动化工具由调度器在启动就绪后按节奏触发）
  { id: 'bz-dock-open', name: '工具坞', icon: DOMAIN_ICONS.dock, callback: () => openDock(getApp()) },
];

/** 小橘域命令判定（ADR-0254）：域开关关掉时整组撤下——id 前缀就是域标识，不另立登记表，
 *  免得命令表加一条忘了同步第二处。 */
const isSmartcatCommand = (id: string): boolean => id.startsWith('bz-smartcat-');

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
  /** 知识盒对外最小门面（ADR-0215，fork-weave 阅读器经 app.plugins.getPlugin('bz') 跨插件调用）：
   *  只挂 openTermNote / openPassageNote 两个既有导出——签名与 KnowledgeEntryPrefill 契约不变，
   *  不发明新入口。同步函数引用（非 getter / 非 Promise，外部 typeof 探测
   *  `plugin.knowledge?.openTermNote === 'function'` 语义成立）；懒初始化仍在函数内部
   *  ensureKnowledge（与命令入口同款），挂载本身零初始化成本。 */
  knowledge: { openTermNote: typeof openTermNote; openPassageNote: typeof openPassageNote } | null = null;
  /** 小橘域开关上次落到运行时的值（ADR-0254）：saveSettings 里比对，拨动即挂/卸，
   *  不靠面板 onChange 钩子——命令面板外部调用 saveSettings 的路径也一样生效 */
  private smartcatDomainOn = true;

  async onload() {
    const loaded = await this.loadData();
    // data.json 是否存在：存在 = 设置写得进去，引导判据只信设置（里面写没写 setupDone 都一样）；
    // 不存在 = 只读库/从未写过设置，才轮到 localStorage 兜底（判据细节见 core/setup-wizard）
    const setupDoneSaved = !!loaded && typeof loaded === 'object';
    // issue 260 正名迁移：旧 todo* 面板设置键就地改名（读旧写新删旧）；
    // C16：发生迁移即调度落盘——原先只改内存，data.json 旧键长期残留、每次启动重复迁移
    const memoKeysMigrated = migrateMemoSettingKeys(loaded);
    // 2026-10-30 用户拍板：「自动更新」缺省改开；老库 data.json 里躺着的显式 false 一次性翻过来
    const autoUpdateMigrated = migrateAutoUpdateDefault(loaded);
    // ADR-0141 迁移：自动关联范围键退役（恒为三盒）+ 索引白名单里的三盒条目剔除
    const autoLinkMigrated = migrateAutoLinkSettings(loaded);
    // issue 342 后续：「上下文窗口」设置行删除（模型固有属性、零消费点），aiContextOverrides 键退役
    const retiredAIKeysMigrated = migrateRetiredAIKeys(loaded);
    // issue 364：收藏本排序循环钮键退役（ADR-0083 后零消费点，残留清除）
    const retiredSortKeyMigrated = migrateRetiredFavoritesSortKey(loaded);
    // issue 425：候选相似度下限从「score^0.35 锐化尺」换算到「原始余弦尺」（分数不再锐化）
    const minScoreScaleMigrated = migrateLinkMinScoreScale(loaded);
    // issue 424/ADR-0184 + 433：第二大脑四参数键退役 + Jev 旧键退役迁移、旧缺省模型名改写
    const retiredSecondBrainKeysMigrated = migrateRetiredSecondBrainKeys(loaded);
    const retiredJevKeysMigrated = migrateRetiredJevKeys(loaded);
    // issue 444：knowledgeWhisperModel → asrWhisperModel（语音转写组升格到 AI 面板）
    const asrKeysMigrated = migrateAsrKeys(loaded);
    // issue 462/ADR-0195：knowledge 三路径键 → 外部工具组（pythonPath/ffmpegPath/ffprobePath）
    const externalToolKeysMigrated = migrateExternalToolKeys(loaded);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    // 插件安装目录的唯一来源（core/plugin-path）：目录名由用户决定（`bz` / `包仔` / `bz-test`
    // 都可能），写死 `plugins/bz` 会让下载落位与读取位置双双错到不存在的目录。
    // manifest.dir 是 Obsidian 记录的、当前真正加载的那份插件的相对路径。
    setPluginRelDir(this.manifest?.dir || null);
    // 小橘域开关的运行时基线（ADR-0254）：启动这一刻以盘上值为准，之后每次 saveSettings 比对
    this.smartcatDomainOn = this.settings.smartcatEnabled !== false;
    setApp(this.app);
    // 移动端没有 Node：工具坞默认那条 `window.require('fs')` 读链整条是断的，
    // 声明 / 参数值 / 运行记录 / 展示板一个都读不到（面板只剩登记项的 id 与路径）。
    // 工具目录就在 vault 里，挂上 adapter 读桥（只读、预取到内存）就能看 —— 不能跑，
    // 但「看」是移动端的全部用途（2026-10-20 用户点名：手机上无法查看静态数据）。
    if (Platform.isMobile) installVaultFs(this.app);
    // AI 设置注入（Q3 的 _q3Settings 语义 → 插件设置）
    setAISettingsProvider(() => this.settings);
    resetAIProviderCache();
    // 通用设置访问器（各域经 getSettings 读取）
    setSettingsProvider(() => this.settings);
    // 设置面板打开通道：各域「打开设置」按钮（core/folder-setup 等）经此进来，
    // core 不必 import 面板本体——保持 onload 轻量。
    setSettingsPanelOpener((domainId, anchorKey) => openSettingsPanel(this.app, domainId, anchorKey));
    // 数据目录初值（2026-10-29：缺省从 vault 根的 CONFIG/STORAGE 搬到 <插件目录>/storage）：
    // 只在 data.json 里还没有 storagePath 时写一次（新库）；已有值的库一律不动，不复制不搬运。
    // 必须排在 initDock 之前 —— 登记表路径就是从数据目录推出来的。
    const storageDirBootstrapped = await bootstrapStorageDir(this.app, this.settings);
    // 设置保存通道（域设置弹窗写回后持久化）
    setSettingsSaver(() => this.saveSettings());
    // 工具坞（契约 v2）：登记表住数据目录的 `dock.json`，一切都是现读，没有缓存要预热。
    await initDock();
    // 迁移落盘（读旧写新删旧的「删旧」一步）刻意排在 loadDockStore 之后：种子先落进
    // dock.json、再删旧键落盘设置 —— 反过来的话（saveSettings 与种子写入并发竞速），
    // 「设置已存下去（旧键没了）但种子没写成」之间崩溃一次，登记表与台账就静默丢失
    if (
      memoKeysMigrated ||
      autoLinkMigrated ||
      retiredAIKeysMigrated ||
      retiredSortKeyMigrated ||
      minScoreScaleMigrated ||
      retiredSecondBrainKeysMigrated ||
      retiredJevKeysMigrated ||
      asrKeysMigrated ||
      externalToolKeysMigrated ||
      autoUpdateMigrated ||
      storageDirBootstrapped
    ) {
      void this.saveSettings().catch((e) => console.error('[bz] 设置键迁移落盘失败:', e));
    }
    // 移动端远程地址自动跟随本机 IP（issue 424/ADR-0184；原 issue 423 只补空值）：桌面端启动时
    // 探测本机局域网 IP，插件自己写下的旧值随 IP 漂移刷新（手机端读同步值，自身探测不到电脑 IP）；
    // 人填值（指向他机的地址）与探测不到两种情况一律不动，静默无提示。
    ensureRemoteOllamaUrl();
    // 日记本目录常量（diary/config 内部跨域解析影视/书库目录）
    applyDiarySettingsToRuntime(this.settings);
    // 域事件总线地基：全插件唯一 vault 订阅点挂载（registerEvent 保证插件卸载时 Obsidian 自动清理引用）
    attachObsidianAdapter(this.app, (ref) => this.registerEvent(ref as any));

    // 知识盒对外最小门面（ADR-0215）：外部插件（fork-weave 阅读器）经 getPlugin('bz') 取实例后
    // 调名词/段落录入；不挂 window 全局、不新增命令与设置。同步赋值既有导出的函数引用即可
    // （knowledge 域懒初始化在两函数内部 ensureKnowledge，与命令入口完全同款）。
    this.knowledge = { openTermNote, openPassageNote };

    // ESC 全局管理器重挂入口（N1）：escManager 是模块 IIFE 单例，禁用→再启用不重新求值，
    // destroy 只软关不清层——onload 每次恢复 ESC 处理（首次调用复位缺省旗标，幂等）
    escManager.arm();

    // 移动端可视视口高度（issue 266）：把 visualViewport.height 写进 --bz-vvh，
    // 让移动端真全屏面板（.bz-panel-mtop）随软键盘收缩，底部输入条不再被键盘压住。
    // 桌面端无害（媒体查询不命中）；卸载时 onunload 解绑。
    bindMobileViewport();

    // 移动端：先把登记表与工具那几份文件预取进内存 —— 面板与设置页的读链都是同步的，
    // 没有这一遍它们只能看到「读不到」。
    // 注意它**自己**去读登记表：手机上那一刻内存里还什么都没有，指望调用方先 readToolEntries()
    // 是个死循环（要读登记表才知道预取谁，而登记表本身还没预取）。
    if (Platform.isMobile) await primeVaultFs(this.app);

    // 命令裸注册（ADR-0004：app.commands.addCommand 原样 id 注册——plugin.addCommand 会被 Obsidian 自动加插件前缀，主页.js 等外部裸 id 调用会失效）
    for (const c of COMMANDS) {
      // 域开关（ADR-0254）：小橘关着时整组不注册——命令面板里连名字都不出现
      if (!this.smartcatDomainOn && isSmartcatCommand(c.id)) continue;
      (this.app as any).commands.addCommand({ id: c.id, name: c.name, icon: c.icon, callback: c.callback });
      this.registeredCommandIds.push(c.id);
    }

    // 已登记工具的直达运行命令（bz-dock-run-<工具id>；ADR-0235 原列「缓做」，后拍板补上）：
    // 每个启用的工具注册一条、可挂快捷键，不打开面板直接跑（门槛与面板同口径，见 dock 域
    // runToolDirect；未信任时命令里弹既有信任确认，D7 语义不变）。登记在这里读的是启动
    // 快照 —— 之后导入 / 移除 / 停用的工具**重启后生效**：Obsidian 命令表没有安全的运行时
    // 增删口子，为「改完立刻生效」开动态注册的复杂度不值得。
    for (const entry of readToolEntries()) {
      if (entry.enabled === false) continue; // 停用的不注册（命令面板里也不出现）
      const cmdId = `bz-dock-run-${entry.id}`;
      (this.app as any).commands.addCommand({
        id: cmdId,
        name: `运行工具：${dockToolLabel(entry)}`,
        icon: DOMAIN_ICONS.dock,
        callback: () => void runToolDirect(getApp(), entry.id),
      });
      this.registeredCommandIds.push(cmdId); // 卸载随 registeredCommandIds 一并摘除
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

    // 工具坞状态栏：面板没开也看得见「有工具在跑」，点击打开面板
    mountDockStatusBar(this.addStatusBarItem(), () => openDock(getApp()));

    // 设置页
    this.addSettingTab(new BzSettingTab(this.app, this));

    // 测试合集（开发工作流，ADR-0276）：仅测试库构建（__BZ_DEV__ define）注册；
    // false 时动态 import 分支被摇树，发布版零残留。typeof 守卫兼容无 define 的测试环境。
    if (typeof __BZ_DEV__ !== 'undefined' && __BZ_DEV__) {
      void import('./core/dev-flows').then((m) => m.registerDevFlows(this));
    }

    // 事件常驻域按设置开关注册（懒加载架构）
    this.app.workspace.onLayoutReady(() => {
      // C13：布局就绪回调不随插件卸载摘除——启动窗口期内禁用插件时此处必须短路，
      // 否则备忘录自动弹出/剪藏摘要/复习监听/小橘等全部幽灵初始化且无卸载路径
      if (this.unloaded) return;
      // 首次引导是这次启动的第一个界面（2026-10-29 用户要求：先引导，不先开别的页面）。
      // 判据同步算（core/setup-state，零依赖），所以下面每个「启动就自动开面板」的动作
      // 这一拍都能被压住；引导走完点「开始使用」再由 onFinish 打开首页。
      // 移动端不弹引导（openSetupWizard 直接劝退）→ 也就不存在「先弹它」这回事，别误压备忘录。
      const needSetup =
        !isMobileEnv() && !setupAlreadyDone(this.settings, vaultBasePathOf(this.app), setupDoneSaved);
      // 新版本启动即弹更新日志（用户拍板 2026-10-31）：manifest 版本 ≠ 上次记录 = 升级了。
      // 新装（这轮要弹引导）只记录不弹；移动端无引导概念，照常走弹窗检测。
      this.checkChangelogOnStart(needSetup);
      // 备忘录提醒后台：启动自动弹出 + 打开笔记提醒（落点=备忘录面板；设置键 autoPopupOnStart/openNoteReminder）。
      // 要弹引导时只跳过「启动自动弹出」——事件监听照挂，引导背后不该先蹦出一个备忘录面板。
      ensureMemoReminders(this.app, { skipStartPopup: needSetup });
      // 开发辅助（ADR-0276）：测试库数据目录放了 debug-open.json 就开机直达该命令；
      // 首次引导在场时先让它说话，不抢（正常库没有这个文件，零行为差）。
      if (!needSetup) devAutoOpen(getApp(), storageDir());
      if (this.settings.autoSummaryEnabled) ensureAutoSummary(this.app);
      // 引用同步无条件常驻（issue 187：原 aiAgentEnabled 开关随旧 AIAgent 退役——
      // 备忘录/收藏本笔记 rename/delete 引用同步是数据完整性功能，不设开关）
      ensureFileSync(this.app);
      // 皮肤包本地缓存（ADR-0199）：**不等**下面那 15 秒——先用已下载的皮肤起效，
      // 否则用户上次选的远端皮肤会在每次重启的头十几秒里回落首套（像「皮肤被重置」）
      void loadLocalSkinPack(getApp());
      // 新版本自更新巡检（24h 节流、启动 15s 后静默跑；有新版才弹通知，失败不吵）。
      // after = 在线资源清单对比（ADR-0203）：必须**串在自更新之后**——皮肤版本区间校验
      // 吃 manifest 版本号。只对比 + 下架清理 + 就绪注入，**绝不下载**（半自动铁则：
      // 下载只听用户的，在设置面板「在线资源」组或手册/日志入口触发）；失败静默等下次启动，
      // 组内失败态由 UI 自行呈现。
      scheduleSelfUpdateCheck(getApp, () => this.unloaded, async () => {
        let manifest: Parameters<typeof applySkinManifest>[1] | null = null;
        try {
          const fetched = await refreshManifest(getApp());
          manifest = fetched.manifest;
          await applySkinManifest(getApp(), manifest, fetched.previous);
        } catch (e) {
          console.warn('[bz] 下载清单拉取失败（已静默，等下次启动/手动重试）:', (e as Error)?.message || e);
        }
        // 自动更新开着时，插件本体之外的东西也一起跟上：皮肤、索引、数据表、三个外部工具包
        //（2026-10-30 用户拍板：开了自动更新就不该只换插件本体）。清单复用上一段已拉的那份——
        // 上一段没拉到时（离线）本轮就不做：同一趟启动再撞一次同样的墙只是白等。
        if (manifest) {
          try {
            await autoUpdateAssets(getApp(), manifest);
          } catch (e) {
            console.warn('[bz] 自动更新在线资源失败（已静默）:', (e as Error)?.message || e);
          }
        }
      });
      // 知识盒/剪藏本引用同步无条件常驻（issue 336 / ADR-0149：knowledge.json、clipbook.json
      // 路径 file-sync + 卡片 source 断链摘除——同属数据完整性功能，不设开关）
      ensureKnowledgeFileSync(this.app);
      ensureClipbookFileSync(this.app);
      // 第二大脑（2026-09-12 拍板）：启用开关退役 → 启动即无条件自动加载（原懒加载分支已删）
      ensureSecondBrainOnReady(this.app, () => this.unloaded);
      // 复习计划：到期提醒开启时常驻（ticket 100——监听/染色/轮询统一启动；否则懒加载）；enableAutoNotify 缺省视为开
      if (this.settings.enableAutoNotify !== false) void ensureReview(this.app);
      // 番茄钟：启动即恢复（load+recover，正在倒计时则后台继续/按设置自动弹窗）
      void ensurePomodoro(this.app);
      // 聚合讯自动抓取（issue 302 / ADR-0128）：启动延迟一拍后台抓一轮（间隔判定在 fetcher 内）
      setTimeout(() => { if (!this.unloaded) void maybeFetchNews(); }, 0);
      // 小橘：启动即挂载（ADR-0254 域总闸；桌面宠物常驻）
      if (this.smartcatDomainOn) void ensureSmartCat(this.app);
      // 日记本后台预热（②）：延迟一拍到空闲只读数据填缓存、不建 DOM（ADR-0003 兼容），
      // 首开日记本命中缓存秒开；四目录任一 md 变更经 domain-bus 事件自动失效。禁用插件时不预热（C13）。
      prewarmDiary(this.app, () => this.unloaded);
      // 工具坞调度（ADR-0236）：就绪后延迟首跑、之后轮询兜到点触发；只在桌面端起。
      // 传卸载旗标进去 —— 插件禁用后到点的定时器必须短路，不能幽灵运行（同 C13）。
      startDockScheduler(this.app, () => this.unloaded);
      // 首次引导（core/setup-wizard）：干净机器上「插件能打开」和「插件能用」是两件事——
      // 缺 Node、缺工具包时功能会静默失效，与其让人自己去报错里猜，不如开局一次补齐。
      // **不延迟、就是这次启动的第一个界面**（2026-10-29 用户要求）：原先那 3 秒是怕抢焦点，
      // 代价是用户先看到别的页面再被引导盖住——顺序反了。判据已在上面同步算好（needSetup），
      // 走完（点「开始使用」或「以后再说」）就打开首页，不留空窗。
      if (needSetup) {
        void import('./core/setup-wizard').then((m) => {
          if (this.unloaded) return;
          m.openSetupWizard(getApp(), {
            firstRun: true,
            onFinish: () => {
              if (this.unloaded) return;
              openHome(getApp());
            },
          });
        });
      }
    });
  }

  async onunload() {
    // C13：先置卸载旗标，短路尚未触发的 onLayoutReady 回调 / 延迟初始化定时器
    this.unloaded = true;
    // 工具坞「关闭 Obsidian 时」这条触发的前半截：只留一枚脉冲（同步写），
    // 真正跑由下一拍（Obsidian 关着时是值守进程）兑现 —— 这里起进程活不过宿主退出。
    markDockExit();
    // 移动端视口监听解绑 + --bz-vvh 清理（issue 266；连带卸掉 document 级监听）
    unbindMobileViewport();
    // 统一右键菜单/长按抽屉浮层先收口（fix(main)：卸载接线补全）
    closeItemMenu();
    // 全局浮层收口（N2）：设置弹窗/模型选择器/路径选择器/灯箱均导出幂等 close——
    // 禁用时若开着，遮罩残留且灯箱滚动锁留在 body（未打开时调用为安全 no-op）
    closeSettingsModal();
    closeModelPicker();
    closePathPicker();
    closeLightbox();
    // uiModal 存活收口（M13/A1）：编辑器/添加场景等组件库弹窗的登记表统一关——
    // 禁用插件后遮罩残留且 ESC 已被下方 escManager.destroy 短路（未打开时 no-op）
    closeAllModals();
    // 自建 overlay 存活收口（CB10/A1）：UP/RSS 管理等 createOverlay 弹窗的登记表统一关——
    // closeAllModals 只管 uiModal 面，自建遮罩在此兜底（未打开时 no-op）
    closeAllOverlays();
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
    unmountDockStatusBar();
    unloadPomodoro();
    unloadMemo();
    unloadFileSync();
    // 知识盒/剪藏本引用同步收口（issue 336：退订域事件 + 清去抖定时器）
    unloadKnowledgeFileSync();
    unloadClipbookFileSync();
    unloadHome();
    unloadEncrypt();
    unloadPasswordVault();
    unloadSmartCat();
    // 设置面板（ADR-0080：DOM 清理 + esc 注销）
    unloadSettingsPanel();
    // 数据体检（checkup 域，D4：作废在途体检 + 面板 DOM 清理 + esc 注销）
    unloadDataCheckup();
    // 工具坞（dock 域，ADR-0235 + ADR-0236：调度器先停机（清定时器 + 复位会话态）——
    // 先于 unloadDock，免得停表前又 tick 一轮去碰已拆的面板；再清面板 DOM + esc 注销 + 会话态复位）
    stopDockScheduler();
    unloadDock();
    // 第二大脑：窄窗/抽屉 DOM、5s 防抖定时器、DeepSeek 服务、模块单例复位（ticket 107 补接线——
    // 原先 unloadSecondBrain 导出但从未被调用，禁用插件后残留窗体且防抖 refresh 仍会触发）
    unloadSecondBrain();
    // 各域卸载清理补全（fix(main)：unload 函数均不内部触发 ensure，可无条件调用；
    // 未初始化域调用为幂等空清理，不引起无谓装载）
    // 日记本（diary 域，ADR-0115）：面板 DOM 清理 + 模块单例复位
    unloadDiary();
    unloadBelongings();
    unloadFavorites();
    // 脸谱本（people 域，issue 435）：面板 overlay 摘除 + ESC 层注销
    unloadPeople();
    unloadReview();
    unloadCinema();
    // 游戏库（gameshelf 域：面板 DOM + 模块单例复位）
    unloadGameshelf();
    // 书架墙（bookshelf 域：面板 DOM + 模块单例复位）
    unloadBookshelf();
    unloadReadingReport();
    // 剪藏本融合域（ADR-0082）：卸载统一面板；旧 news/clipping 已无独立挂载
    unloadClipbook();
    unloadAutoSummary();
    // 文献盒（ADR-0072 迁出：面板 DOM + 模块单例复位）
    unloadKnowledge();
    // 对外门面摘除（ADR-0215）：实例属性置空，外部 typeof 守卫随即探测失败
    this.knowledge = null;
    // 挂载树白板（issues 317/319）：自绘遮罩/大窗直接挂 body，禁用插件时必须摘干净
    destroyMountTree();
    // 域事件总线收口：摘除 vault 订阅点 + 清空全部域事件订阅（总线为进程内单例，随插件卸载全量清空）
    detachObsidianAdapter();
    clearDomainEvents();
    // C14：在途确认框（flow-dialog）先按取消语义结算再清 DOM——原先硬删遮罩不走 settle，
    // 未决 Promise 永久悬挂，等确认结果的后续操作静默终止
    cancelActiveFlowDialog();
    // 日记本写链路弹窗 DOM 清理（写日记弹窗 / 滚轮时间选择器挂 body 的浮层）
    const diaryIds = [
      'add-diary-mask',
      'add-diary-popup',
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
    // 小橘域开关（ADR-0254）：拨动即落运行时——关就卸实例撤命令、开就补命令并立刻挂载，
    // 不用重载插件。比对放在落盘之前：saveData 失败也照样把运行时拨到位（内存值已是用户的意图）。
    const smartcatOn = this.settings.smartcatEnabled !== false;
    if (smartcatOn !== this.smartcatDomainOn) {
      this.smartcatDomainOn = smartcatOn;
      this.applySmartcatDomain(smartcatOn);
    }
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

  /** 小橘域开关落到运行时（ADR-0254）。命令表增删用的是卸载路径早就在用的同一对 API
   *  （addCommand / removeCommand）；同 id 重新注册会恢复命令本身，但用户给它绑的快捷键
   *  在命令被撤期间一并失效——这是「关掉整个域」必须付的代价，域开着时不发生。 */
  private applySmartcatDomain(on: boolean): void {
    const commands = (this.app as any).commands;
    for (const c of COMMANDS) {
      if (!isSmartcatCommand(c.id)) continue;
      if (on) {
        commands.addCommand({ id: c.id, name: c.name, icon: c.icon, callback: c.callback });
        if (!this.registeredCommandIds.includes(c.id)) this.registeredCommandIds.push(c.id);
      } else {
        try {
          commands.removeCommand(c.id);
        } catch (e) {
          /* 命令可能已被移除 */
        }
        this.registeredCommandIds = this.registeredCommandIds.filter((id) => id !== c.id);
      }
    }
    if (on) void ensureSmartCat(this.app);
    else unloadSmartCat();
  }

  /** 新版本启动自动弹更新日志（用户拍板 2026-10-31）：onLayoutReady 调用。
   *  口径：settings.changelogSeenVersion ≠ manifest.version = 升级了 → 弹。
   *  - 新装（needSetup）：首次引导是这轮启动的第一个界面，只记录当前版不弹——
   *    新装用户还没用过插件，没有「更新了什么」可看。
   *  - seen 为空且不需要引导 = 本功能上线前老库的升级 → 也弹（这次升级就是新版本）。
   *  - 弹窗内容走 core/changelog 的强制口径：先向远端拿与新版配套的日志（自更新装新版时
   *    已同步拉过一次，这里再核对兜底），离线回落本地已存版；打开成功才落盘 seen，
   *    失败（离线且本地从没下载过）不记录、下次启动再试。自动弹失败**不出通知**——
   *    没人主动要求看日志，弹个错误脸比不弹更吵。 */
  private checkChangelogOnStart(needSetup: boolean): void {
    const current = String(this.manifest?.version || '');
    const seen = this.settings.changelogSeenVersion;
    if (!current || seen === current) return;
    if (needSetup) {
      this.settings.changelogSeenVersion = current;
      void this.saveSettings().catch((e) => console.error('[bz] 更新日志版本记录落盘失败:', e));
      return;
    }
    // 延到事件循环：onLayoutReady 回调里不抢引导/备忘录那批同步动作的时序
    setTimeout(() => {
      if (this.unloaded) return;
      void (async () => {
        try {
          const [core, modal] = await Promise.all([
            import('./core/changelog'),
            import('./settings-panel/changelog'),
          ]);
          const html = await core.fetchChangelogForStartup(getApp());
          modal.openChangelogModal(html, current);
          this.settings.changelogSeenVersion = current;
          await this.saveSettings();
        } catch {
          /* 静默：离线且无本地日志 → 不落记录，下次启动再试 */
        }
      })();
    }, 0);
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

// ===== 设置页（issue 345：原生设置页不再平铺设置项，只留一个「打开设置面板」按钮——
// 全部设置已聚合 settings-panel 面板；原 ADR-0009 单页平铺与本页退役，mainSettingsSchema
// 聚合器仍留在 core/settings-main-schema 供测试与文案 lint 全量断言）=====

export class BzSettingTab extends PluginSettingTab {
  plugin: BzPlugin;

  constructor(app: any, plugin: BzPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName('打开设置面板')
      .setDesc('全部设置（AI、数据存储路径、通知、各域）都在 bz 设置面板中集中管理')
      .addButton((btn) =>
        btn.setButtonText('打开设置面板').setCta().onClick(() => openSettingsPanel(this.plugin.app))
      );
  }
}
