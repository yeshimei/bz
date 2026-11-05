/**
 * 日记本视频教程（B 站）——首次打开 + 空态入口
 *
 * 口径（2026-11-05 用户拍板，两次收窄）：
 * 1. **只弹一次**：第一次打开日记本时判一次，判过即写 `settings.diaryFirstOpened`，
 *    之后永不重弹（本次会话还没弹成——比如加载中途被关掉——也算判过，不跨次补弹）。
 * 2. **只在非空态弹**：册子里有日记才弹窗；空册（或还没配文件夹）不弹，教程入口
 *    直接写在册子的空态页/引导纸上（和影院同款：常驻、随时能点）。
 * 3. 弹窗打开即写 `settings.diaryTutorialSeen`，与第 1 条双保险，防任何路径重复弹。
 *
 * 链接暂时占位：视频还没发。发布后只改 `DIARY_TUTORIAL_URL` 一处——
 * 空串 = 未发布：票根写「即将上线」，点击只给一句人话，不把人送去 404。
 *
 * 皮：uiModal 壳 + `.bz-diary-tutorial-popup`（纸 / 墨 / 铜材料与写日记弹窗同款，见 styles.css）。
 * 弹窗挂 document.body，取不到场景根上的 --bz-diary-* 变量，故域样式里自带一份材料色。
 */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { saveSettings, tryGetSettings } from '../core/settings-provider';
import { uiBtn } from '../core/ui/button';
import { uiModal } from '../core/ui/modal';
import { openExternalUrl } from '../core/utils';

/**
 * 日记本视频教程地址（作者本人的操作演示，B 站）。
 * TODO（2026-11-05）：视频发布后把地址填进来。空串 = 还没发，入口走「即将上线」形态。
 */
export const DIARY_TUTORIAL_URL = '';

/** 弹窗的域皮类（styles.css 里 `.bz-overlay-popup.bz-diary-tutorial-popup` 起手） */
const TUTORIAL_CLASS = 'bz-diary-tutorial-popup';

/** 当前开着的教程弹窗（同一时刻只留一个；关闭时由 onClose 清空） */
let active: { close: () => void } | null = null;
/** 本次会话已经判过「首次打开」——设置写盘失败时的兜底，防同一次启动反复判 */
let firstOpenJudged = false;

/** 是否已经弹过教程（打开弹窗即记账） */
export function isDiaryTutorialSeen(): boolean {
  return tryGetSettings().diaryTutorialSeen === true;
}

/**
 * 判「是不是第一次打开日记本」并就地记账。**全插件只该有一个调用点**（openDiary）。
 * 返回 true 才允许本次打开进入「非空态弹教程」的分支；返回 false 表示这次不是第一次。
 * 设置通道未注入时（测试/极早期）不判，避免误弹。
 */
export function consumeFirstDiaryOpen(): boolean {
  if (firstOpenJudged) return false;
  firstOpenJudged = true;
  const s = tryGetSettings();
  if (s.diaryFirstOpened === true) return false;
  s.diaryFirstOpened = true;
  void saveSettings().catch((e) => console.warn('[diary] 首次打开标记保存失败:', e));
  return true;
}

/** 弹窗出现过就记账：与首次打开标记双保险，任何路径都不会弹第二次 */
function markTutorialSeen(): void {
  tryGetSettings().diaryTutorialSeen = true;
  void saveSettings().catch((e) => console.warn('[diary] 教程已弹标记保存失败:', e));
}

/** 首次打开且册子非空时调用（空册不弹，入口在册子空态页上） */
export function maybeShowDiaryTutorial(): void {
  if (active || isDiaryTutorialSeen()) return;
  showDiaryTutorial();
}

/**
 * 首次教程的唯一判据（controller 读盘落地后调用；纯函数，便于单测）：
 * **第一次打开** + 读盘没坏 + 册子里有东西 + 还没弹过。
 * 空册 / 读坏 / 非首次 / 弹过，四条任一不满足都不弹——宁可少弹，不重弹。
 */
export function shouldShowFirstOpenTutorial(opts: {
  firstOpen: boolean;
  loadError: string | null;
  entries: number;
  seen?: boolean;
}): boolean {
  if (!opts.firstOpen) return false;
  if (opts.loadError) return false;
  if (opts.entries <= 0) return false;
  return opts.seen !== true;
}

/** 打开教程视频：有地址走 core 外链单源；占位期只给一句人话（空态入口 / 弹窗按钮共用） */
export function openTutorialVideo(): void {
  if (!DIARY_TUTORIAL_URL) {
    notice('教程视频还没发');
    return;
  }
  openExternalUrl(getApp(), DIARY_TUTORIAL_URL);
}

/**
 * 打开教程弹窗（不查首次标记，供测试与将来的「再看一遍」入口）。
 * 已开着时返回现有句柄，不叠第二个；返回值用于关闭（测试 / 卸载兜底）。
 * opts.url 仅供测试注入——正式路径一律读 DIARY_TUTORIAL_URL。
 */
export function showDiaryTutorial(opts: { url?: string } = {}): { close: () => void } | null {
  if (active) return active;
  const url = (opts.url ?? DIARY_TUTORIAL_URL).trim();
  markTutorialSeen();

  const content = document.createElement('div');
  content.className = 'bz-diary-tut';

  /** 弹窗内的「看视频教程」：有地址开外链；占位期一句人话；两种都收壳 */
  const watch = (): void => {
    if (!url) notice('教程视频还没发');
    else openExternalUrl(getApp(), url);
    active?.close();
  };

  // 票根：一张压在纸上的浅色票根，整张可点（回车默认落在它上面）
  const cover = document.createElement('button');
  cover.type = 'button';
  cover.className = 'bz-diary-tut-cover';
  cover.setAttribute('aria-label', url ? '去 B 站看日记本视频教程' : '日记本视频教程还没发布');
  cover.addEventListener('click', watch);

  const play = document.createElement('span');
  play.className = 'bz-diary-tut-play';
  play.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'bz-diary-tut-cover-text';
  const kicker = document.createElement('span');
  kicker.className = 'bz-diary-tut-kicker';
  kicker.textContent = url ? 'B 站 · 视频教程' : 'B 站 · 即将上线';
  const name = document.createElement('span');
  name.className = 'bz-diary-tut-name';
  name.textContent = '三分钟上手';
  text.append(kicker, name);
  cover.append(play, text);

  const foot = document.createElement('div');
  foot.className = 'bz-diary-tut-foot';
  const dismiss = uiBtn({
    label: '先翻翻',
    className: 'bz-diary-tut-dismiss',
    onClick: () => active?.close(),
  });
  const go = uiBtn({
    label: '看视频教程',
    tone: 'primary',
    className: 'bz-diary-tut-go',
    onClick: watch,
  });
  foot.append(dismiss, go);

  content.append(cover, foot);

  const ui = uiModal({
    content,
    maxWidth: 400,
    // 无标题头（字少）：title 只落成 aria-label，读屏仍知道这个框是什么
    title: '视频教程',
    className: TUTORIAL_CLASS,
    onClose: () => {
      active = null;
    },
  });
  active = { close: () => ui.close() };
  return active;
}

/** 测试 / 开发流程用：收起现有弹窗并忘掉会话内状态（设置里的标记由调用方清） */
export function resetDiaryTutorialState(): void {
  active?.close();
  active = null;
  firstOpenJudged = false;
}
