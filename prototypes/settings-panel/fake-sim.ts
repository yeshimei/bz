/**
 * 设置面板行为单源 · sim 启动入口（issue 245/ADR-0106，范式随 belongings 试点）
 *
 * 评审壳侧启动器：把真行为层（ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（dir-picker 的 collectVaultFolders 经 getApp() 拿到 fake
 *     vault 的目录面：getFiles 文件聚合 + adapter.list 递归补齐，见 fake/fake-obsidian.ts；
 *     review/smartcat schema 加载链的 jsonFileStore 也跑在同一实例上）；
 *   - 种子：演示 vault 目录树（日记/书库/影视/剪藏/点前缀 .ENCRYPT + 空目录 信件）+
 *     演示设置（面板布局/主题、存储路径、AI 服务商等键与插件 data.json 同形）——
 *     schema 本体不需要种子：ui.ts 的 schemaLoaders 全部调各域真实 xxxSettingsSchema()；
 *   - 设置注入：setSettingsProvider/setSettingsSaver（真 settings-provider 实现可用，
 *     键直绑行的读写落内存单例、saveSettings 持久化 localStorage——评审壳内改动可久）；
 *   - 入口导出：bootSettingsPanelSim / openPanel / __simSettings（等价插件
 *     openSettingsPanel(app[, domainId]) 接线形态）+ __simSettings（自检读内存设置）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_settings_panel，iframe 壳只调 boot + openPanel。
 * 插件的 ui.ts / renderer.ts / dir-picker.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp, encodeSeedFile } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { openSettingsPanel as openPanelReal } from '../../src/settings-panel/index';

/** 设置持久化键（localStorage；壳重置 = 移除本键 + 种子标记后重载） */
const SIM_SETTINGS_KEY = 'bz-sim:bz-settings.json';
/** 种子标记（种子不可变：有标记即跳过，不覆盖） */
const SEED_MARKER = 'bz-sim:__sp_seed_v1';

/** 演示设置默认值（键与插件 data.json 同形；持久层只叠加差异）。
 *  外观键须与 src/settings.ts DEFAULT 三处同值（issue 246 铁律）：缺键 = 主题行 layoutKey
 *  过滤落空 → 面板主题整行空卡。 */
const SEED_SETTINGS: Record<string, unknown> = {
  storagePath: 'CONFIG/STORAGE',
  aiProvider: 'deepseek',
  diaryDirectory: '我的/日记',
  letterDirectory: '我的/信',
  movieDirectory: '我的/影视',
  settingsPanelLayout: 'jingwei',
  settingsPanelSkin: 'chenhun',
  memoSkin: 'paper',
  memoLayout: 'default',
  bookshelfSkin: 'nordic',
  bookshelfLayout: 'default',
  belSkin: 'poster',
  belSkinTheme: 'warmwhite',
  diarySkin: 'default',
  diarySkinTheme: 'ivory',
  diaryWallSkin: 'default',
  diaryWallSkinTheme: 'gallery',
  clipbookSkin: 'default',
  clipbookSkinTheme: 'newsprint',
  favoritesSkin: 'default',
  favoritesSkinTheme: 'linen',
  cinemaStyle: 'midnight',
  cinemaSkinTheme: 'nightfall',
  reviewSkin: 'default',
  reviewSkinTheme: 'sage',
  secondbrainSkin: 'default',
  secondbrainSkinTheme: 'graphite',
  knowledgeSkin: 'default',
  knowledgeSkinTheme: 'manila',
  pomodoroSkin: 'default',
  pomodoroSkinTheme: 'tomato',
  encryptSkin: 'default',
  encryptSkinTheme: 'steel',
  // 密码本（issue 250）：生成/安全三键与 src/settings.ts DEFAULT 同值
  passwordCharset: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
  passwordLength: '16',
  securityMode: false,
};

/**
 * 演示 vault 目录树（dir-picker 真聚合演示数据）：
 *   - 文件种子：vault.getFiles 聚合父目录（快速首渲染面）；
 *   - 点前缀目录（CONFIG/.ENCRYPT）：getFiles 不索引、只有 adapter.list 递归补齐才出现
 *     （与真宿主「Obsidian 不索引点前缀」同语义）；
 *   - 空目录（我的/信件）：同上，仅 adapter 面可见。
 */
const SEED_FILES: Array<[string, string]> = [
  ['我的/日记/2026-09-01.md', '# 日记\n\n演示日记。'],
  ['我的/日记/2026-09-07.md', '# 日记\n\n演示日记。'],
  ['书库/三体.md', '---\ntitle: 三体\n---\n\n演示藏书。'],
  ['我的/影视/流浪地球2.md', '---\ntitle: 流浪地球2\n---\n\n演示影视条目。'],
  ['归档/网页剪藏/示例文章.md', '# 示例文章\n\n演示剪藏。'],
  ['CONFIG/.ENCRYPT/保险箱.md', '---\nbz-encrypted: true\n---\n\n演示加密笔记。'],
];
const SEED_EMPTY_DIRS = ['我的/信件'];

/** 内存设置单例（provider 恒返同一对象——键直绑行的写 = 改本对象） */
let simSettings: Record<string, unknown> = { ...SEED_SETTINGS };
/** boot 注入的 app（openPanel/openDomain 闭包代传——与插件 openSettingsPanel(app) 同形） */
let simApp: FakeApp | null = null;

/** 种子 vault 文件（幂等：有标记即跳过） */
function seedVault(): void {
  if (localStorage.getItem(SEED_MARKER)) return;
  for (const [path, content] of SEED_FILES) {
    localStorage.setItem('bz-sim:' + path, encodeSeedFile(content));
  }
  // 空目录占位：'.keep' 键让「我的/信件」进入 adapter.list 目录树（空目录仅 adapter 面
  // 可见——与真宿主「空目录不进 getFiles 文件聚合」同语义；getFiles 过滤 .keep 键）
  for (const dir of SEED_EMPTY_DIRS) {
    localStorage.setItem('bz-sim:' + dir + '/.keep', encodeSeedFile(''));
  }
  localStorage.setItem(SEED_MARKER, '1');
}

/**
 * 空目录 '.keep' 占位与 getFiles 过滤的契约见 fake/fake-obsidian.ts（FakeVault.getFiles）。
 */
function injectApp(): void {
  const app = new FakeApp();
  // core/app 的 setApp 形参是 obsidian App 类型；评审壳 FakeApp 只实现 vault/目录面，
  // 运行期 core/path-picker、core/storage 以 (app.vault as any) 访问——类型断言收敛此处差异。
  setApp(app as never);
  simApp = app;
}

/** 设置注入：provider 返回内存单例；saver 持久化 localStorage（评审壳内改动可久） */
function injectSettings(): void {
  try {
    const raw = localStorage.getItem(SIM_SETTINGS_KEY);
    if (raw) simSettings = { ...SEED_SETTINGS, ...(JSON.parse(raw) as Record<string, unknown>) };
  } catch {
    simSettings = { ...SEED_SETTINGS };
  }
  setSettingsProvider(() => simSettings as never);
  setSettingsSaver(async () => {
    localStorage.setItem(SIM_SETTINGS_KEY, JSON.stringify(simSettings));
  });
}

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootSettingsPanelSim(): void {
  const g = window as unknown as { __bzSpSimBooted?: boolean };
  if (g.__bzSpSimBooted) return;
  g.__bzSpSimBooted = true;
  seedVault();
  injectApp();
  injectSettings();
}

function ensureBoot(): void {
  bootSettingsPanelSim();
}

/** 打开设置面板（真 openSettingsPanel；app 由 boot 注入 core/app，闭包代传） */
export function openPanel(): void {
  ensureBoot();
  openPanelReal(simApp as never);
}


/** 自检/演示钩子：读内存设置单例（键直绑断言用；勿在壳内直改——改请走面板真行为） */
export function __simSettings(): Record<string, unknown> {
  ensureBoot();
  return simSettings;
}

