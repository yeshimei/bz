/**
 * 各域「数据文件夹」的配置口径 + 未配置空态（core 单源）
 *
 * 背景：日记 / 剪藏 / 影院 / 书库 / 游戏库 / 知识盒 都要往用户自己的文件夹里写东西。
 * 这些目录**默认留空**（新库不猜位置），没配置时各域主界面进入「引导空态」：说明缺什么 +
 * 一个「打开设置」按钮，而不是让用户对着一句 `ENOENT` 发愣，也不弹窗拦路。
 *
 * 两种空态必须分开（用户点名）：
 *   - **未配置** → `folderSetupEmpty(domain)`：解释 + 「打开设置」（本文件）；
 *   - **已配置但没内容** → 各域自己的既有空态（「还没有日记」这类），**不带设置按钮**。
 *
 * 图片类目录（剪藏配图 / 影院海报 / 游戏封面 / 知识盒配图）不单独逼用户填：解析顺序是
 * 设置值 → Obsidian「默认新附件位置」→ 域内缺省（见 core/attachment-dir.ts）。用户在
 * Obsidian 里设过附件目录，这一项就算已就绪，空态里也不再提它。
 *
 * 决策与代价见 docs/adr/adr-0273-folder-defaults-and-guides.md。
 */
import { notice } from './notice';
import { requestSettingsPanel, tryGetSettings } from './settings-provider';
import { cleanDir, resolveAssetDir, domainAssetsDir, type AssetDir } from './attachment-dir';
// 从组件文件的深路径取，别走 './ui' 的桶文件：桶会把 settings-schema / path-picker 一并
// 拖进来，而那些壳的假 obsidian 层没有 Setting / MarkdownRenderer，行为包直接构建失败。
import { uiEmpty } from './ui/empty';
import { uiBtn, uiBtnRow } from './ui/button';

export type FolderDomainId = 'diary' | 'clipbook' | 'cinema' | 'bookshelf' | 'gameshelf' | 'knowledge';

interface FolderField {
  /** 设置键 */
  key: string;
  /** 设置页/空态里的名字（与设置项同名，别另造一套说法） */
  label: string;
  /** 推荐值（空态里直接告诉用户填什么；留空 = 图片类，由三跳决定） */
  reco: string;
  /** 图片类：走 resolveAssetDir（设置 → Obsidian 附件位置 → `<主目录>/assets`），不强制人填 */
  image?: boolean;
  /** 图片类的主目录键（缺省落 `<该键当前值>/assets`；剪藏=剪藏文件夹、知识盒=卡片文件夹、影院/游戏库=本域目录） */
  imageBaseKey?: string;
}

interface FolderPlan {
  name: string;
  icon: string;
  /** settings-panel 的域 id（剪藏本在那边叫 clipping） */
  settingsId: string;
  /** 空态标题（未配置时） */
  title: string;
  /** 空态说明（未配置时） */
  desc: string;
  /** 补充一句（比说明弱一档；例如游戏库还差 Steam 凭据） */
  hint?: string;
  fields: FolderField[];
}

export const FOLDER_PLANS: Record<FolderDomainId, FolderPlan> = {
  diary: {
    name: '日记本',
    icon: 'notebook-pen',
    settingsId: 'diary',
    title: '日记本还没定文件夹',
    desc: '写下的每一篇都会存进日记文件夹。定了之后才有地方落笔。',
    hint: '信件文件夹可选，用到时才问。',
    fields: [{ key: 'diaryDirectory', label: '日记文件夹', reco: '我的/日记' }],
  },
  clipbook: {
    name: '剪藏本',
    icon: 'scissors',
    settingsId: 'clipping',
    title: '剪藏本还没定文件夹',
    desc: '抓到的网页要存成笔记，正文得有个固定的落脚处。',
    fields: [
      { key: 'articleDirectory', label: '剪藏文件夹', reco: '归档/网页剪藏' },
      { key: 'clipbookImageFolder', label: '图片文件夹', reco: '', image: true, imageBaseKey: 'articleDirectory' },
    ],
  },
  cinema: {
    name: '影院',
    icon: 'clapperboard',
    settingsId: 'cinema',
    title: '影院还没定文件夹',
    desc: '影视条目一部一条，存在影视目录里。',
    fields: [
      { key: 'cinemaFolderPath', label: '影视目录', reco: '我的/影视' },
      { key: 'cinemaPosterFolder', label: '海报文件夹', reco: '', image: true, imageBaseKey: 'cinemaFolderPath' },
    ],
  },
  bookshelf: {
    name: '书库',
    icon: 'library',
    settingsId: 'bookshelf',
    title: '书库还没定文件夹',
    desc: '书库读的是这个文件夹里带书标签的笔记；已有书的笔记放进去就能认出来。',
    // 书库没有可写的图片目录：封面是**读**用户笔记里的 `cover` / `coverPath`（CONFIG/BOOK/<书名>/…），
    // 插件不往任何地方落封面图。以前这里挂着 bookshelfPosterFolder 这个没有设置行、没有消费点的
    // 幽灵键，等于空态替一个改不动的字段算 missing——2026-10-31 摘掉。
    fields: [{ key: 'bookshelfFolderPath', label: '书库目录', reco: '书库' }],
  },
  gameshelf: {
    name: '游戏库',
    icon: 'gamepad-2',
    settingsId: 'gameshelf',
    title: '游戏库还没定文件夹',
    desc: '一款一条，存在游戏目录里。',
    // 定完文件夹还不会自己长数据：同步要 Steam 凭据（用户点名要在空态里说清）
    hint: '同步还要在设置里填好 SteamID64 与 Web API 密钥。',
    fields: [
      { key: 'gameshelfFolderPath', label: '游戏目录', reco: '我的/游戏' },
      { key: 'gameshelfPosterFolder', label: '海报文件夹', reco: '', image: true, imageBaseKey: 'gameshelfFolderPath' },
    ],
  },
  knowledge: {
    name: '知识盒',
    icon: 'boxes',
    settingsId: 'knowledge',
    title: '知识盒还没定文件夹',
    desc: '四类各放一处：长文献、卡片、主题，外加配图。',
    fields: [
      { key: 'knowledgeDirectory', label: '文献文件夹', reco: '文献盒' },
      { key: 'knowledgeCardboxDirectory', label: '卡片文件夹', reco: '卡片盒' },
      { key: 'knowledgeTopicDirectory', label: '主题文件夹', reco: '主题盒' },
      { key: 'knowledgeImageFolder', label: '图片文件夹', reco: '', image: true, imageBaseKey: 'knowledgeCardboxDirectory' },
    ],
  },
};

export interface FolderFieldState {
  field: FolderField;
  /** 实际生效目录（图片类含 Obsidian 附件位置回落） */
  dir: string;
  source: AssetDir['source'];
  /** 未就绪：必填项空着，且图片类连附件位置都没得可用 */
  missing: boolean;
}

export interface FolderState {
  plan: FolderPlan;
  fields: FolderFieldState[];
  /** 未就绪的字段（空态按这个决定要不要出现） */
  missing: FolderFieldState[];
  ok: boolean;
}

/** 读设置当前值（未合并 DEFAULT 的键也算——tryGetSettings 拿的是合并后对象） */
function settingValue(key: string): string {
  const s = tryGetSettings() as Record<string, unknown> | null;
  return cleanDir(s ? s[key] : '');
}

/**
 * 某域的文件夹就绪情况（唯一判定入口，空态/设置页/域内写盘前都问它）。
 * 图片类不参与「必填」：它的空值是合法状态（三跳全空时写盘侧会拒绝，不会落库根）。
 */
export function folderState(domain: FolderDomainId): FolderState {
  const plan = FOLDER_PLANS[domain];
  const fields: FolderFieldState[] = plan.fields.map((field) => {
    if (field.image) {
      // 图片类**永不 gate**：主目录没配时它只能是空（不落库根），但挡人进域的是主目录，不是它
      const base = field.imageBaseKey ? settingValue(field.imageBaseKey) : '';
      const r = resolveAssetDir(settingValue(field.key), domainAssetsDir(base));
      return { field, dir: r.dir, source: r.source, missing: false };
    }
    const v = settingValue(field.key);
    return { field, dir: v, source: v ? 'setting' : 'fallback', missing: !v };
  });
  const missing = fields.filter((f) => f.missing);
  return { plan, fields, missing, ok: missing.length === 0 };
}

/** 该域是否还没配好（空态闸门） */
export function needsFolderSetup(domain: FolderDomainId): boolean {
  return !folderState(domain).ok;
}

/**
 * 单个必备目录是否还没配（2026-10-31 发版 review #1 的闸门判据）。
 *
 * 录入类命令只依赖**它自己那一处**：知识盒的「存为名词」写进文献文件夹，主题盒/卡片盒
 * 空着不该挡人。用整域的 `needsFolderSetup` 会要求三个盒子齐备才让存一条名词，属于误拦。
 */
export function needsFolderKey(domain: FolderDomainId, key: string): boolean {
  return !!folderState(domain).fields.find((f) => f.field.key === key)?.missing;
}

/** 打开设置面板并定位到该域第一个未配置的行。
 *  面板由 main.ts 经 settings-provider 注入（`setSettingsPanelOpener`）：core 里既不能
 *  字面量 import（会把整块面板打进各域行为包，评审壳的假 obsidian 缺 Setting/Component）、
 *  也不能用变量拼 import()（CJS 产物里退化成原生 import()，运行时解析不到 → 按钮点了只弹提示）。 */
export function openFolderSettings(domain: FolderDomainId, anchorKey?: string, closeBefore?: () => void): void {
  const plan = FOLDER_PLANS[domain];
  const key = anchorKey || folderState(domain).missing[0]?.field.key;
  // 配完再回来时，背后那个面板还是「未配置」的旧样子（各域没有「设置变更后重渲」的接口）。
  // 索性先收起来：用户保存完回到库，重新点开域就是新状态——比留一张过期的引导屏诚实。
  try {
    closeBefore?.();
  } catch (e) {
    /* 关不掉就留着，不影响打开设置 */
  }
  if (!requestSettingsPanel(plan.settingsId, key)) {
    // 没人接管（评审壳里没有设置面板）：至少说一句，别让按钮点了像坏掉
    notice('设置面板没能打开，可以从「设置 → 包仔」进入', 'warning');
  }
}

/**
 * 未配置空态（域主界面用）：图标 + 标题 + 说明 + 「打开设置」。
 * 与「已配置但没内容」的空态严格分开——后者不带任何设置按钮。
 */
export function folderSetupEmpty(domain: FolderDomainId, closeBefore?: () => void): HTMLElement {
  const st = folderState(domain);
  const { plan } = st;
  const desc = plan.desc;
  const acts = uiBtnRow(
    [
      uiBtn({
        label: '打开设置',
        icon: 'settings',
        tone: 'primary',
        onClick: () => openFolderSettings(domain, undefined, closeBefore),
      }),
    ],
    { center: true }
  );
  const el = uiEmpty({ icon: plan.icon, title: plan.title, desc, actions: acts });
  // 要填什么 + 推荐填什么（`reco` 以前只活在代码里，用户点开设置面对的是空框）
  const need = st.missing
    .filter((f) => !f.field.image)
    .map((f) => (f.field.reco ? `${f.field.label}（推荐 ${f.field.reco}）` : f.field.label))
    .join('、');
  if (need) {
    const n = document.createElement('div');
    n.className = 'bz-empty-note';
    n.textContent = `要填：${need}`;
    el.insertBefore(n, acts);
  }
  if (plan.hint) {
    const n = document.createElement('div');
    n.className = 'bz-empty-note';
    n.textContent = plan.hint;
    el.insertBefore(n, acts);
  }
  el.classList.add('bz-folder-setup-empty');
  return el;
}

/**
 * 把「未配置」空态挂进某个域的内容区（各域 render 入口一行调用）。
 * 返回 true = 已接管（调用方应当就地 return，别再把真内容画上来）；
 * false = 该域已配好，按原路渲染。
 *
 * 不套额外容器：空态本身就是 `.bz-empty`（各域自己的空态也是它），直接做容器的子元素，
 * 域里那些 `.xxx-body > .bz-empty { height:100% }` 一类的居中规则才会照常命中。
 */
export function mountFolderGate(
  container: HTMLElement | null | undefined,
  domain: FolderDomainId,
  closeBefore?: () => void
): boolean {
  if (!container) return false;
  if (!needsFolderSetup(domain)) return false;
  container.textContent = '';
  container.appendChild(folderSetupEmpty(domain, closeBefore));
  return true;
}
