/* ============================================================
 * bz · 更新日志数据（core/changelog-data.ts，内置）
 *
 * 2026-11-02 用户拍板：**更新提示不再下载远端日志**，直接内置进 main.js——
 * 省掉一次网络往返、省掉「远端日志没跟上就弹上一版内容」这一整类问题，
 * 也让提示在离线时照常能弹。
 *
 * 2026-11-02 二次拍板：小窗里**把能拿到的历史版本全列出来**（保留最近 50 版），
 * 用户自己滚、自己点，不再按「上次看到哪版」掐区间，也就不必猜用户的升级路径。
 *
 * 数据来源，以及一次必须记住的翻车（2026-11-02 用户当场纠正）：
 *  - 1.35.0 起取自 downloads/bz-changelog.html（按 git tag 切块，与 Releases 一一对应）；
 *  - 曾按旧手册回填过 1.0.0 → 1.25.0 那 26 条——日期是「每周一一条、09-08 起每天一条」
 *    的**部署周记**，版本号是我照顺序硬套上去的，等于编了 26 个从未发布的版本。
 *    已整段删除。**宁可少，不许假**：内置日志是小窗唯一的真相源，混进假版本就是骗人。
 *  - 1.26.0 → 1.34.1 本来就没有日志块（当年版本号手写，不生成），不必补。
 *
 * 发版时的手工约定：每版发布前在这里**插到最前面**一条，version 必须与 manifest.json
 * 完全一致（`pickReleaseFor` 是全等匹配，不是就近匹配）。忘了加 = 这版不弹提示，
 * 不会弹错版本——这是刻意选的失败方向。条数超过 50 版时从末尾裁掉最旧的。
 * ============================================================ */
import { normalizeVersion } from './version';

/** 一条日志条目（domain 是域名小标签，sub 是弱化副行） */
export interface ChangelogEntry {
  domain: string;
  text: string;
  sub?: string;
}

/** 一个版本的日志块 */
export interface ChangelogRelease {
  version: string;
  date?: string;
  added?: ChangelogEntry[];
  improved?: ChangelogEntry[];
  fixed?: ChangelogEntry[];
}

/** 取与 version 完全相等的那个日志块；找不到 → null（调用方据此「不弹、不记账」） */
export function pickReleaseFor(releases: readonly ChangelogRelease[], version: string): ChangelogRelease | null {
  const target = normalizeVersion(version);
  if (!target) return null;
  return releases.find((r) => normalizeVersion(r?.version || '') === target) || null;
}

/** 这一版有多少条改动（三段求和） */
export function releaseEntryCount(release: ChangelogRelease): number {
  return (release.added?.length || 0) + (release.improved?.length || 0) + (release.fixed?.length || 0);
}

/**
 * 内置日志（**最新在前**，最多 50 版）。
 * 文案口径与 docs/note-v<版本>.md（以及由此产出的 docs/changelog.html）一致——
 * 同名同句，不要在这里另写一版。
 */
export const CHANGELOG_RELEASES: readonly ChangelogRelease[] = [
  {
    version: '1.39.4',
    date: '2026-11-05',
    // 条目与 docs/note-v1.39.4.md 同稿（scripts/_gen-changelog.mjs 自动生成，勿手改）
    improved: [
      { domain: '书库', text: '接上 bz reader，书、进度、划线和阅读时长都跟着显示。' },
      { domain: '阅读报告', text: 'bz reader 的书也一并算进统计。' },
      { domain: '影视', text: '没配目录或一部片都没有时，空态给一个视频教程入口。' },
    ],
  },
  {
    version: '1.39.3',
    date: '2026-11-02',
    // 条目与 docs/note-v1.39.3.md 同稿（scripts/_gen-changelog.mjs 自动生成，勿手改）
    fixed: [
      { domain: '更新提示', text: '手机上顶栏和关闭钮不再被状态栏压住。' },
    ],
    improved: [
      { domain: '下载通道', text: '备用线路换成码云。' },
    ],
  },
  {
    version: '1.39.2',
    date: '2026-11-02',
    // 条目与 docs/note-v1.39.2.md 同稿（scripts/_gen-changelog.mjs 自动生成，勿手改）
    improved: [
      { domain: 'QQ 交流群', text: '在关于页加了入口。' },
      { domain: '更新日志', text: '内置进插件。' },
    ],
  },
  {
    version: '1.39.1',
    date: '2026-11-02',
    // 条目与 docs/note-v1.39.1.md 同稿（scripts/_gen-changelog.mjs 自动生成，勿手改）
    fixed: [
      { domain: '游戏库', text: '后台拉封面、中文名、成就时主界面不再一遍遍闪，只改变化的那几处' },
    ],
    improved: [
      { domain: '游戏库', text: '打开 Obsidian 就静默同步一次，首页时间线的「玩了 X」不必先开游戏库' },
      { domain: '游戏库', text: 'Steam 上没封面的游戏，改用同款封面图、商店截图或库内主视觉补上' },
      { domain: '游戏库', text: '排序默认改成「最近玩」，并排在最前' },
      { domain: '插件更新', text: '每次启动都查一遍新版本，不再被节流跳过' },
      { domain: '在线资源', text: '手册、更新日志、皮肤、工具包跟着版本一起自动补齐' },
    ],
  },
  {
    version: '1.39.0',
    date: '2026-11-01',
    // 条目与 docs/note-v1.39.0.md 同稿（scripts/_gen-changelog.mjs 自动生成，勿手改）
    added: [
      { domain: '外部工具', text: '新增「bz 依赖什么」清单——勾选要装的东西（Node、Python、Ollama、向量模型、ffmpeg、转写引擎、脸谱的 Python 包），当场生成一段安装提示词，复制给任意 AI 就能从头装到尾，连 bz 里的设置一起回填' },
    ],
  },
  {
    version: '1.38.0',
    date: '2026-11-01',
    // 条目与 docs/note-v1.38.0.md 同稿（scripts/_gen-changelog.mjs 自动生成，勿手改）
    added: [
      { domain: '影院', text: '可以从豆瓣导入影片至影院中' },
      { domain: '影院', text: '片单可以整单收录进影院' },
    ],
    fixed: [
      { domain: '影院', text: '中文输入法在搜索框打字不再被打断' },
    ],
    improved: [
      { domain: '影院', text: '评分、导演、主演、海报都改从豆瓣详情接口取' },
    ],
  },
  {
    version: '1.37.0',
    date: '2026-10-31',
    // 条目与 docs/note-v1.37.0.md 同稿（scripts/_gen-changelog.mjs 自动生成，勿手改）
    improved: [
      { domain: '下载通道', text: '插件更新与在线资源全面改走 GitHub 主通道、jsDelivr 备用，国内直连下载更快更稳' },
      { domain: '更新日志', text: '插件更新重启后会自动弹出本次的更新说明' },
    ],
  },
  {
    version: '1.36.0',
    date: '2026-10-31',
    // 条目与 docs/note-v1.36.0.md 同稿（scripts/_gen-changelog.mjs 自动生成，勿手改）
    added: [
      { domain: '域目录', text: '日记、剪藏、影视等六个板块的存放位置默认不再替您猜，第一次用时会有引导卡带您指一次就好' },
      { domain: '保险库', text: '四个板块第一次设置主密码时，共用同一块设置面板' },
    ],
    fixed: [
      { domain: '保险库', text: '全新的库第一次设置主密码不再失败' },
      { domain: '番茄钟', text: '重新打开番茄钟不再丢失正在进行的倒计时' },
    ],
    improved: [
      { domain: '界面', text: '在弹窗里选字、滑动时不会再误点外面把弹窗关掉' },
      { domain: '自动更新', text: '默认打开' },
      { domain: '自动更新', text: '更新时只下载插件本身和外部工具包，皮肤等在线资源不再跟着动' },
      { domain: '保险库', text: '第一次设密码时输入框改为明文显示，两个输入框上下排列' },
      { domain: '域目录', text: '图片附件统一存进对应目录下的 assets 子文件夹' },
      { domain: '域目录', text: '图片没单独配目录时，界面直接显示图片实际存到了哪，并跟着 Obsidian 的附件设置走' },
      { domain: '自检', text: '手机上断网页面的三个按钮放不下会自动换行，并加了「连不上？看视频」教程入口' },
      { domain: '其他', text: '断网时打开插件不再重复请求更新，启动更快' },
    ],
  },
  {
    version: '1.35.0',
    date: '2026-10-30',
    // 条目与 docs/note-v1.35.0.md 同稿（scripts/_gen-changelog.mjs 自动生成，勿手改）
    added: [
      { domain: '首页', text: '时间线改为直接汇总各板块的数据来展示，内容筛选也整个重做，更快更准' },
      { domain: '剪藏本', text: '知乎日报与果壳科学人两个订阅源默认关闭，想看再打开' },
      { domain: '关于组', text: '加了 GitHub 主页与使用教程两个入口' },
      { domain: '关于组', text: '反馈、GitHub、教程、赞赏四行加了彩色图标' },
      { domain: '更新日志', text: '改为按版本划分展示' },
      { domain: '其他', text: '状态日期、书影游进度与物品流转的时间精确显示到秒' },
    ],
    fixed: [
      { domain: '其他', text: '修复两处只在自动化测试环境出现的误报，不影响日常使用' },
    ],
  },
];
