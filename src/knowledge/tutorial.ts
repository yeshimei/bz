/**
 * 知识盒视频教程（B 站）——空态入口 + 首次打开弹一次（2026-11 用户拍板）
 *
 * 口径：
 * - 入口两处：① 主面板「文献目录」为空时的空态行；② 第一次打开知识盒弹一次。
 * - 弹窗穿本域皮：className = `kb bz-kb-tutorial`（`kb` 带纸墨变量、`bz-kb-tutorial`
 *   在 styles.css 里把共享壳改写成纸面材质）。
 * - 视频地址没到位时先留空：票根写「B 站 · 即将上线」，点击只给一句人话，不送 404。
 *   链接到了只改 `KNOWLEDGE_TUTORIAL_URL` 一处（与第二大脑同一条视频，那边另有自己的常量）。
 */
import { saveSettings, tryGetSettings } from '../core/settings-provider';
import { showTutorialModal, type TutorialModalHandle } from '../core/ui/tutorial-modal';

/** 知识盒视频教程地址（作者本人的操作演示，B 站）。2026-11 发布；空串 = 未发布（保留兜底，防换片期） */
export const KNOWLEDGE_TUTORIAL_URL = 'https://www.bilibili.com/video/BV1bR4s6dEjH';

/** 弹窗的域皮类：`kb` 拿变量、`bz-kb-tutorial` 走本域材质 */
const TUTORIAL_CLASS = 'kb bz-kb-tutorial';

/** 当前开着的教程弹窗（同一时刻只留一个；关闭时清空） */
let active: TutorialModalHandle | null = null;
/** 本次会话已经判过「首次打开」——设置写盘失败时的兜底，防同一次启动反复弹 */
let firstOpenJudged = false;

/** 打开教程弹窗（空态入口与首次打开共用；不查首次标记） */
export function openKnowledgeTutorial(): void {
  if (active) return;
  active = showTutorialModal({
    className: TUTORIAL_CLASS,
    title: '三分钟看懂知识盒',
    desc: '四种录入各管什么、文献目录怎么配、影像怎么变成文献——一集讲完。',
    url: KNOWLEDGE_TUTORIAL_URL,
    onClose: () => {
      active = null;
    },
  });
}

/**
 * 第一次打开知识盒时弹一次教程。**全插件只该有一个调用点**（openKnowledgePanel）。
 * 打开弹窗即记账（`knowledgeTutorialSeen`），任何路径都不会弹第二次。
 */
export function maybeShowKnowledgeTutorial(): void {
  if (firstOpenJudged || active) return;
  firstOpenJudged = true;
  const s = tryGetSettings();
  if (s.knowledgeTutorialSeen === true) return;
  s.knowledgeTutorialSeen = true;
  void saveSettings().catch((e) => console.warn('[knowledge] 教程已弹标记保存失败:', e));
  openKnowledgeTutorial();
}

/** 测试 / 开发流程用：收起现有弹窗并忘掉会话内状态（设置里的标记由调用方清） */
export function resetKnowledgeTutorialState(): void {
  active?.close();
  active = null;
  firstOpenJudged = false;
}
