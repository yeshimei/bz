/**
 * 第二大脑视频教程（B 站）——空库引导页入口 + 首次打开弹一次（2026-11 用户拍板）
 *
 * 口径：
 * - 入口两处：① 空库引导页（「开始向量化」那一页）；② 第一次打开第二大脑弹一次。
 * - 弹窗穿本域皮：className = `bz-sb-tutorial`（styles.css 的 token 组 + 材质段）。
 * - 视频地址没到位时先留空：票根写「B 站 · 即将上线」，点击只给一句人话，不送 404。
 *   链接到了只改 `SECONDBRAIN_TUTORIAL_URL` 一处（与知识盒同一条视频，那边另有自己的常量）。
 */
import { saveSettings, tryGetSettings } from '../core/settings-provider';
import { showTutorialModal, type TutorialModalHandle } from '../core/ui/tutorial-modal';

/** 第二大脑视频教程地址（作者本人的操作演示，B 站）。2026-11 发布；空串 = 未发布（保留兜底，防换片期） */
export const SECONDBRAIN_TUTORIAL_URL = 'https://www.bilibili.com/video/BV1bR4s6dEjH';

/** 弹窗的域皮类（styles.css 里把共享壳改写成米白 × 红棕材质） */
const TUTORIAL_CLASS = 'bz-sb-tutorial';

/** 当前开着的教程弹窗（同一时刻只留一个；关闭时清空） */
let active: TutorialModalHandle | null = null;
/** 本次会话已经判过「首次打开」——设置写盘失败时的兜底，防同一次启动反复弹 */
let firstOpenJudged = false;

/** 打开教程弹窗（引导页入口与首次打开共用；不查首次标记） */
export function openSecondBrainTutorial(): void {
  if (active) return;
  active = showTutorialModal({
    className: TUTORIAL_CLASS,
    title: '三分钟看懂第二大脑',
    desc: '索引怎么建、参考浮窗与问答怎么用、阅读器的书怎么并进来源分布——一集讲完。',
    url: SECONDBRAIN_TUTORIAL_URL,
    onClose: () => {
      active = null;
    },
  });
}

/**
 * 第一次打开第二大脑时弹一次教程。**全插件只该有一个调用点**（openSecondBrainPanel）。
 * 打开弹窗即记账（`secondbrainTutorialSeen`），任何路径都不会弹第二次。
 */
export function maybeShowSecondBrainTutorial(): void {
  if (firstOpenJudged || active) return;
  firstOpenJudged = true;
  const s = tryGetSettings();
  if (s.secondbrainTutorialSeen === true) return;
  s.secondbrainTutorialSeen = true;
  void saveSettings().catch((e) => console.warn('[secondbrain] 教程已弹标记保存失败:', e));
  openSecondBrainTutorial();
}

/** 测试 / 开发流程用：收起现有弹窗并忘掉会话内状态（设置里的标记由调用方清） */
export function resetSecondBrainTutorialState(): void {
  active?.close();
  active = null;
  firstOpenJudged = false;
}
