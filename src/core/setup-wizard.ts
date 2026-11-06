/* ============================================================
 * bz · 首次引导 / 环境自检（core/setup-wizard.ts）
 *
 * 一次把「新机器缺什么、缺的怎么补」走完。五屏：
 *
 *   ① 检测   先探网络（GitHub 主通道 + 码云备用），再探本机九项；**缺什么在这一屏全列出来**
 *   ② 存放   数据存哪（默认 <插件目录>/storage，可改；点「下一步」写探针验证时才建目录）
 *   ③ AI     可选：服务商 + 密钥 + 当场测通（跳过不影响其他功能）
 *   ④ 安装   检测屏列出的缺口一次补齐（**不列清单、不给勾选**；单项失败不牵连）
 *   ⑤ 完成   就绪清单 + 值守启用询问（唯一改系统状态的一步）+ 仍需手工的项
 *
 * 设计约束：
 *  - **同意只有一次**（② 的「下一步」/③ 的「保存并继续」之后就全自动）。之后的下载不再问
 *    第二遍——它们只是往插件自己的目录写文件。唯一会改系统状态的是「值守注册登录自启」，
 *    那一步单独确认（④ 末尾调 core/tool-setup.ts 的 setupAfterInstall，它自己带确认框）。
 *  - **不重复展示清单**（2026-11-05 用户拍板）：① 已经把「缺什么」摊开，③ 之后直接下，
 *    中间不再摆一屏「要下载什么」让用户看第二遍、勾一遍。
 *  - **已就绪的不重下**：安装屏按磁盘事实跳过，老用户重跑一遍不必再拉几十 MB。
 *  - 与「设置 → 关于 → 环境自检」共用同一套行渲染与补齐队列；自检模式跳过 ②③ 两屏，
 *    检测完直接到 ⑤（2026-11-01：自检不需要清单屏，「缺什么」在完成屏一眼看完）。
 * ============================================================ */
import { notice } from './notice';
import { openExternalUrl } from './utils';
import { uiModal } from './ui/modal';
import { openFlowDialog } from './flow-dialog';
import { environmentCheck, probeNetwork, probeWritableDir, type EnvCheckRow, type NetworkProbe } from './env-check';
import { docStatus, refreshManifest } from './download-manifest';
import type { DownloadManifest, ManifestDocEntry } from './download-manifest';
import { bundleStatus, installBundle } from './bundle-asset';
import { ensureAssetWithHash } from './remote-asset';
import { downloadSkinUpdates, skinStatus } from './skin-pack';
import { installPortableNode, PORTABLE_NODE_VERSION } from './node-runtime-install';
import { probeNodeRuntime, resetNodeRuntimeCache } from './tool-runtime';
import { openDepsGuide } from './deps-guide';
import { setupAfterInstall } from './tool-setup';
import { pluginDirOf, pluginRelDirOf, vaultBasePathOf } from './plugin-path';
import { initialStorageDir } from './storage-path';
import { setupDoneStorageKey } from './setup-state';
import { openPathPicker } from './path-picker';
import { isMobileEnv } from './mobile';
import { getApp } from './app';
import { docListedInResources } from './doc-visibility';
import { getSettings, saveSettings, tryGetSettings } from './settings-provider';
import { AI_PROVIDER_REGISTRY, DEFAULT_AI_PROVIDER, getProviderDescriptor, testAIConnectivity } from './ai';
import {
  fetchLatestReaderRelease,
  installReaderPlugin,
  isReaderHealthy,
  readReaderInstall,
  readerActionOf,
  readerStateText,
  type ReaderInstallState,
} from './reader-install';

/** 视频教程 · **第 4P（最新一集）**。三处教程入口各指一集（关于＝第 1P／本屏＝第 4P／
 *  依赖清单＝第 3P），用户明确不要共享常量：指向不同的集，共享反而多一层解释。
 *  分享参数 `vd_source` / `spm_id_from` 是追踪用的，别带。 */
const TUTORIAL_URL = 'https://www.bilibili.com/video/BV1vNsZ6pE7i/?p=4';

/** Node 归档的估算体积（只在清单里显示，真实体积看服务端） */
const NODE_SIZE_HINT = 36.4 * 1024 * 1024;

/** 拉清单的超时（requestUrl 没有 abort，用 race 兜住——不让第一屏挂在网络上） */
const MANIFEST_TIMEOUT_MS = 12000;

/** 下载项的种类（决定 ③ 屏怎么分组、排序） */
export type SetupKind = 'node' | 'reader' | 'bundle' | 'doc' | 'skins';

/** 一个可下载项 */
export interface SetupItem {
  id: string;
  kind: SetupKind;
  label: string;
  desc: string;
  /** 估算字节数（未知 = null，界面只显状态不显体积） */
  size: number | null;
  /** 磁盘上已经就绪（已下载 / 已有可用运行时）——重跑时不重下 */
  ready: boolean;
  /** 干活；`report` 用于中途改这一行的状态文字（进度、阶段） */
  run: (report?: (text: string) => void) => Promise<void>;
}

/** 体积人话 */
export function sizeText(bytes: number | null): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '';
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * 「要下什么」的**纯**队列（不看磁盘状态）。
 * 顺序刻意如此：Node 最久，放第一个——先让它跑起来，后面小包在它之后秒完，
 * 用户看到的进度是连续的，而不是「卡在 87% 一动不动」。
 */
export function buildSetupTasks(
  app: unknown,
  manifest: DownloadManifest | null,
  opts: { nodeMissing: boolean; readerMissing?: boolean },
): SetupItem[] {
  const mk = (i: Omit<SetupItem, 'ready'>): SetupItem => ({ ...i, ready: false });
  const items: SetupItem[] = [];
  if (opts.nodeMissing) {
    items.push(
      mk({
        id: 'node',
        kind: 'node',
        label: 'Node 运行时',
        desc: `便携版 ${PORTABLE_NODE_VERSION}`,
        size: NODE_SIZE_HINT,
        run: async (report) => {
          // 36MB 是这一轮最久的一项：没有进度的话用户会以为卡死，然后去点第二次
          await installPortableNode(app, {
            onStage: (stage) => report?.(stage),
            onProgress: (got, total) => {
              if (total > 0) report?.(`${Math.min(99, Math.round((got / total) * 100))}% · ${sizeText(got)} / ${sizeText(total)}`);
              else report?.(sizeText(got));
            },
          });
          // 刚装好的运行时必须让探测缓存失效：否则同一会话里 toolReadyState 还是旧结论
          resetNodeRuntimeCache();
        },
      }),
    );
  }

  // bz reader（同作者阅读器）：不在在线资源清单里，装法也不同于目录包——它是一整个
  // Obsidian 插件（三件套 + 启用），由 core/reader-install 从 Release 拉。
  // 已装就当就绪（「有没有新版」交给检测屏那一行，不在下载队列里重复问）。
  if (opts.readerMissing) {
    items.push(
      mk({
        id: 'reader',
        kind: 'reader',
        label: 'bz reader',
        desc: '书库 · EPUB',
        size: 820 * 1024,
        run: async (report) => {
          const r = await installReaderPlugin(app, { onStage: (stage) => report?.(stage) });
          if (!r.enabled) throw new Error('已装好，但没能自动启用：到「设置 → 第三方插件」里启用');
        },
      }),
    );
  }

  // Python / ffmpeg 不在这里装（2026-11-01 改）：它们是**系统级运行时**，而这条队列只会
  // 往插件目录搬东西——装出来的便携副本换个仓库、重装插件就没了，还会把那个会消失的路径
  // 写进设置。装法统一交给完成屏的「安装外部工具」（core/deps-guide 出清单与提示词）。
  // 这里留一行位置说明，免得以后有人看着「本地运行时」这四个字又塞回来。

  if (!manifest) return items;

  // 目录包（工具）先于文档：工具决定「能不能用」，文档决定「查不查得到」
  for (const e of manifest.docs.filter((d) => d.kind === 'bundle')) items.push(mk(bundleItem(app, e)));
  // 文档段与「在线资源」组同口径：已隐藏的条目（更新日志 / 使用手册，见 core/doc-visibility）
  // 不进这一屏的勾选队列——下下来也没有入口能打开它。
  for (const e of manifest.docs.filter((d) => d.kind !== 'bundle' && docListedInResources(String(d.id || ''))))
    items.push(mk(docItem(app, e)));
  const skinBytes = manifest.skins.reduce((n, s) => n + (s.size || 0), 0);
  if (manifest.skins.length) {
    items.push(
      mk({
        id: 'skins',
        kind: 'skins',
        label: '主题皮肤',
        desc: `${manifest.skins.length} 套`,
        size: skinBytes || null,
        run: async () => {
          const r = await downloadSkinUpdates(app, manifest);
          if (r.failed > 0) throw new Error(`${r.failed} 套皮肤下载失败`);
        },
      }),
    );
  }
  return items;
}

function bundleItem(app: unknown, e: ManifestDocEntry): Omit<SetupItem, 'ready'> {
  return {
    id: e.id,
    kind: 'bundle',
    label: e.name,
    // 名称即说明（三个工具名都自带用途），不再补「解包即可用」这种谁都知道的话
    desc: '',
    size: e.size ?? null,
    run: async () => {
      await installBundle(app, e);
    },
  };
}

function docItem(app: unknown, e: ManifestDocEntry): Omit<SetupItem, 'ready'> {
  return {
    id: e.id,
    kind: 'doc',
    label: e.name,
    // 名称 + 体积就是全部信息：这一屏与启动链的自动更新（ADR-0281）口径一致，
    // 全都是「列出来、勾上、这一次就下完」，没有「可先跳过 / 用到再拉」这种例外
    desc: '',
    size: e.size ?? null,
    run: async () => {
      await ensureAssetWithHash(app, e.file, e.sha256, e.name, e.size);
    },
  };
}

/** 磁盘上这一项是不是已经就绪（重跑引导时用来跳过，避免白拉几十 MB） */
async function isReady(
  app: unknown,
  manifest: DownloadManifest | null,
  id: string,
  kind: SetupKind,
): Promise<boolean> {
  if (kind === 'node') return probeNodeRuntime(app, { fresh: true }).kind !== 'none';
  if (kind === 'reader') {
    const state = await readReaderInstall(app);
    return isReaderHealthy(state);
  }
  if (!manifest) return false;
  if (kind === 'skins') {
    const st = await skinStatus(app, manifest);
    return st.missing === 0 && st.updated === 0 && st.ready > 0;
  }
  const entry = manifest.docs.find((d) => d.id === id);
  if (!entry) return false;
  const state = entry.kind === 'bundle' ? await bundleStatus(app, entry) : await docStatus(app, entry);
  return state === 'ready';
}

/** 带磁盘状态的队列（③ 屏用）：ready 的显示「已就绪」并默认不勾 */
export async function planSetupItems(
  app: unknown,
  manifest: DownloadManifest | null,
  opts: { nodeMissing: boolean; readerMissing?: boolean },
): Promise<SetupItem[]> {
  const items = buildSetupTasks(app, manifest, opts);
  const out: SetupItem[] = [];
  for (const it of items) out.push({ ...it, ready: await isReady(app, manifest, it.id, it.kind) });
  return out;
}

/**
 * 缺省选择：**全部未就绪项**（2026-10-28 用户拍板「默认全部都下载」；2026-11-05 起
 * ③ 屏连勾选框都不再显示，这里保留函数只服务队列筛选与测试）。
 * 已经就绪的项照旧不列进选择（selectedTasks 会再滤一遍）。
 */
export function defaultSelection(items: SetupItem[]): Set<string> {
  const sel = new Set<string>();
  for (const it of items) if (!it.ready) sel.add(it.id);
  return sel;
}

/** 按勾选挑出真正要跑的任务（已就绪的即使被勾中也不重下） */
export function selectedTasks(items: SetupItem[], selected: Set<string>): SetupItem[] {
  return items.filter((it) => selected.has(it.id) && !it.ready);
}

/* ==================== 视图 ==================== */

interface WizardCtx {
  app: unknown;
  firstRun: boolean;
  /** 自检模式：跳过「存放 / 清单 / AI」三屏，检测完直奔完成屏 */
  checkOnly: boolean;
  /** 首次引导**结束**后的回调：main.ts 用它打开首页。结束路径都触发——
   *  「开始使用」「以后再说」「稍后再说」，以及下载屏点遮罩确认关掉那条。 */
  onFinish?: () => void;
}

interface WizardState {
  net: NetworkProbe | null;
  /** 清单（检测屏拉一次，安装屏复用——不让用户在两屏之间等两次网络） */
  manifest?: DownloadManifest | null;
  rows: EnvCheckRow[];
  storagePath: string;
  provider: string;
  apiKey: string;
  aiTest: { state: 'idle' | 'busy' | 'ok' | 'fail'; text: string };
  failed: string[];
}

interface Ui {
  sub: HTMLElement;
  body: HTMLElement;
  foot: HTMLElement;
}

function skeleton(root: HTMLElement): Ui {
  root.classList.add('bz-setup');
  root.innerHTML = '<div class="bz-setup-sub"></div><div class="bz-setup-body"></div><div class="bz-setup-foot"></div>';
  return {
    sub: root.querySelector('.bz-setup-sub') as HTMLElement,
    body: root.querySelector('.bz-setup-body') as HTMLElement,
    foot: root.querySelector('.bz-setup-foot') as HTMLElement,
  };
}

/** 副标题：空串 = 这屏不交代（连那行占位一起去掉，卡片上方不留空档） */
function setSub(ui: Ui, text: string): void {
  ui.sub.textContent = text;
  ui.sub.classList.toggle('is-hidden', !text);
}

/**
 * 网络全断时的视频指引（B 站，第 2P 专讲连不上资源站怎么处理）。
 * 放在「重新检测」左边：自检能说的是「不通」，说不清「怎么办」——而这一步靠文字讲不明白。
 */
const NET_HELP_VIDEO = 'https://www.bilibili.com/video/BV1vNsZ6pE7i/?p=2';

function button(cls: string, text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = text;
  return b;
}

function rowEl(cls = 'bz-setup-row'): HTMLElement {
  const row = document.createElement('div');
  row.className = cls;
  return row;
}

function markEl(state: 'ok' | 'bad' | 'idle' | 'busy'): HTMLElement {
  const span = document.createElement('span');
  span.className = `bz-setup-mark bz-setup-mark--${state}`;
  return span;
}

function keyEl(text: string, sub?: string): HTMLElement {
  const k = document.createElement('span');
  k.className = 'bz-setup-key';
  if (sub) k.innerHTML = `${escapeText(text)}<em>${escapeText(sub)}</em>`;
  else k.textContent = text;
  return k;
}

function valEl(text: string): HTMLElement {
  const v = document.createElement('span');
  v.className = 'bz-setup-val';
  v.textContent = text;
  return v;
}

/**
 * 把「值」写进行里。
 *
 * 一律左右两列：名称在左、值在右，**长值（路径）也在右列自己的宽度里换行**。
 * 早前把长值整行折到第二行、还染成灰字——读起来像两条不同的信息，
 * 截图里「已配置：E:/…” 单独漂在下面就是那样（2026-10-28 用户否掉）。
 * 折行的老写法本来是为了绕开「右列被压成一字一列」的 bug；那个 bug 的真因是
 * 列宽 auto + overflow-wrap:anywhere，现在用两列 fr + min-width 解决，不必再折行。
 */
function setValue(_row: HTMLElement, val: HTMLElement, text: string): void {
  val.textContent = text;
}

/** 装一行：状态点 + 名称（可带一句用途）+ 值 */
function lineRow(mark: HTMLElement, label: string, sub: string | undefined, value: string): HTMLElement {
  const row = rowEl();
  row.append(mark, keyEl(label, sub), valEl(''));
  setValue(row, row.querySelector('.bz-setup-val') as HTMLElement, value);
  return row;
}

/**
 * 分组：小标题 + 卡片（1px 边框 + 低一档底色）。
 * 早前是「一条分隔线一条信息」的平铺清单，九行下来没有段落感，读起来像日志；
 * 收进卡片后每组自成一块，视线有落点。返回 `group` 挂进页面、`card` 收行。
 */
function setupGroup(title?: string): { group: HTMLElement; card: HTMLElement } {
  const group = document.createElement('div');
  group.className = 'bz-setup-group';
  if (title) {
    const head = document.createElement('div');
    head.className = 'bz-setup-group-h';
    head.textContent = title;
    group.appendChild(head);
  }
  const card = document.createElement('div');
  card.className = 'bz-setup-card';
  group.appendChild(card);
  return { group, card };
}

/** 只转义三件事：文案来自本地常量，但 `& < >` 会被当标签解析，够了 */
function escapeText(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 检测屏的分段（纯函数，便于钉住「工具只出现一次」）：
 * 环境行里 `tool-*` 前缀的就是三个外部工具（core/env-check 用 runtimeDiagnostics 生成），
 * 其余是本机环境。两段互斥——重复列同一件事是用户 2026-10-28 截图里最刺眼的一条。
 */
export function splitProbeRows<T extends { id?: string }>(rows: T[]): { env: T[]; tools: T[] } {
  const isTool = (id: string | undefined): boolean => String(id || '').startsWith('tool-');
  return { env: rows.filter((r) => !isTool(r.id)), tools: rows.filter((r) => isTool(r.id)) };
}

/** 「在线资源」段只列文档与皮肤（目录包已经归「外部工具」，不在这里重复）。
 *  已隐藏的条目（更新日志 / 使用手册，见 core/doc-visibility）也不列：引导页是
 *  一次性的「要下什么」清单，留一行下完没法用的东西只会让人多勾一次。 */
export function resourceDocsOf<T extends { kind?: string; id?: string }>(manifest: { docs: T[] }): T[] {
  return manifest.docs.filter((d) => d.kind !== 'bundle' && docListedInResources(String(d.id || '')));
}

/** bz reader 行的句柄：外部查到最新版后 setLatest 重算按钮，装完后 refresh 重读磁盘 */
interface ReaderRowHandle {
  refresh: () => Promise<void>;
  setLatest: (version: string | null) => void;
}

/**
 * bz reader 一行：状态 + 安装/更新按钮（引导检测屏与自检完成屏共用）。
 *
 * 状态来自磁盘（core/reader-install.readReaderInstall），最新版由调用方异步查——
 * 不在这里发请求，检测屏可以让它跟清单拉取并发，完成屏则干脆不查（只补缺口）。
 */
function mountReaderRow(ctx: WizardCtx, card: HTMLElement, initialLatest: string | null = null): ReaderRowHandle {
  const row = rowEl('bz-setup-row bz-setup-row--reader');
  const mark = markEl('idle');
  const val = valEl('检查中…');
  const btn = button('bz-setup-link', '安装');
  btn.classList.add('is-hidden');
  row.append(mark, keyEl('bz reader'), val, btn);
  card.appendChild(row);

  let latest = initialLatest;
  let busy = false;

  const render = (state: ReaderInstallState): void => {
    val.textContent = readerStateText(state, latest);
    const healthy = isReaderHealthy(state);
    mark.className =
      'bz-setup-mark ' + (state.broken ? 'bz-setup-mark--bad' : healthy ? 'bz-setup-mark--ok' : 'bz-setup-mark--idle');
    row.classList.toggle('is-bad', state.broken);
    // 动作与设置面板、向导完成屏同一处判定（readerActionOf）：三处不再各写一套
    const action = readerActionOf(state, latest);
    btn.classList.toggle('is-hidden', busy || action === 'none');
    btn.disabled = busy;
    btn.textContent = action === 'install' ? '安装' : '更新';
  };

  const refresh = async (): Promise<void> => {
    render(await readReaderInstall(ctx.app));
  };

  btn.onclick = async () => {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    btn.textContent = '安装中…';
    try {
      const r = await installReaderPlugin(ctx.app, {
        onStage: (text) => {
          val.textContent = text;
        },
      });
      latest = r.version;
      busy = false;
      await refresh();
      notice(
        r.enabled
          ? `bz reader 已安装并启用（${r.version}）`
          : `bz reader 已安装（${r.version}），到「设置 → 第三方插件」里启用`,
        r.enabled ? 'success' : 'warning',
      );
    } catch (e) {
      busy = false;
      const msg = String((e as Error)?.message || e);
      val.textContent = `安装失败：${msg}`;
      mark.className = 'bz-setup-mark bz-setup-mark--bad';
      row.classList.add('is-bad');
      btn.classList.remove('is-hidden');
      btn.disabled = false;
      btn.textContent = '重试';
      notice(`bz reader 安装失败：${msg}`, 'error');
    }
  };

  void refresh();
  return {
    refresh,
    setLatest: (version) => {
      latest = version;
      void refresh();
    },
  };
}

/** 当前引导实例的关闭句柄（uiModal.close 幂等）：走它而不是直接 remove 遮罩，
 *  存活登记表与 ESC 注册才跟着注销。 */
let activeClose: (() => void) | null = null;

function closeModal(ui: Ui): void {
  if (activeClose) {
    const close = activeClose;
    activeClose = null;
    close();
    return;
  }
  (ui.body.closest('.bz-overlay-mask') as HTMLElement | null)?.remove();
}

/**
 * 首次引导没走完就被点遮罩 / 按 ESC 时，先拦一道再关。
 *
 * 早前这里是「整段不挂」——点遮罩毫无反应，用户以为插件卡了；而直接关掉更糟：
 * 引导是这次启动唯一的界面，屏幕上什么都没有，他既不知道刚才关掉了什么，也不知道去哪找回来。
 * 所以改成「问一句」：说清关掉后不会再自动弹、去哪重开（设置 → 关于 → 环境自检），
 * 默认聚焦「继续准备」（关掉是危险动作，Enter 不该替他做这个决定）。
 */
function confirmLeaveWizard(onLeave: () => void): void {
  void openFlowDialog({
    // 皮肤类：默认流程框是 400px 窄卡 + 居中正文 + 灰底胶囊按钮，放在 720px 宽的引导页里
    // 像另一个插件弹出的框。挂上 bz-setup-flow 让它在 components.css 里对齐引导页那套形制。
    className: 'bz-setup-flow',
    title: '引导还没走完，先关掉？',
    message:
      '下载和环境设置都还没完成。关掉后这次启动不会再自动弹出——\n要接着弄，去「设置 → 关于 → 环境自检」重新打开。',
    actions: [
      { label: '继续准备', value: 'stay' },
      { label: '关掉', value: 'leave', danger: true },
    ],
  }).then((v) => {
    if (v === 'leave') onLeave();
  });
}

/* ---------- ① 检测 ---------- */
/**
 * 检测屏。
 *
 * 结果按组收进卡片（网络 / 本机 / 外部工具 / 在线资源），失败行的值直接染红——
 * 「哪条不对」一眼能扫到，不必逐行读。
 *
 * 走完**不再自动跳下一步**（2026-10-28）：早前跑完就自动进「存放」，从「存放」按
 * 「上一步」回来会再探一遍网（好几秒），探完又被自动推回去——那个「上一步」等于刷新。
 * 现在每次进来先吃缓存（st.net / st.rows / st.manifest），要重探得点「重新检测」。
 */
async function stageProbe(ctx: WizardCtx, st: WizardState, ui: Ui): Promise<void> {
  setSub(ui, ctx.firstRun ? '先看看这台机器缺什么。不会改动笔记。' : '检查运行环境。');
  ui.body.innerHTML = '';
  ui.foot.innerHTML = '';

  const addRow = (key: string, into: HTMLElement): { row: HTMLElement; val: HTMLElement; mark: HTMLElement } => {
    const row = rowEl();
    const mark = markEl('busy');
    const val = valEl('检查中');
    row.append(mark, keyEl(key), val);
    into.appendChild(row);
    return { row, val, mark };
  };
  const paint = (t: { row: HTMLElement; val: HTMLElement; mark: HTMLElement }, ok: boolean | null, text: string): void => {
    t.mark.className =
      'bz-setup-mark ' + (ok === true ? 'bz-setup-mark--ok' : ok === false ? 'bz-setup-mark--bad' : 'bz-setup-mark--idle');
    t.row.classList.toggle('is-bad', ok === false);
    setValue(t.row, t.val, text);
  };

  const net = setupGroup('网络');
  ui.body.appendChild(net.group);
  const netRow = addRow('GitHub 主通道', net.card);
  const cdnRow = addRow('备用通道 · 码云', net.card);
  const probe = st.net ?? (await probeNetwork().catch(() => null));
  st.net = probe;
  // 不可达时把**原因**带上（2026-10-28：只说「不可达」时，网页能开 GitHub 的人根本无从判断
  // 是墙、是代理还是 DNS——GitHub 与码云是两回事）
  paint(netRow, probe?.github === true, probe?.github ? `可达 · ${probe.githubMs} ms` : `不可达 · ${probe?.githubError || '未知原因'}`);
  paint(cdnRow, probe?.gitee ? true : null, probe?.gitee ? `可达 · ${probe.giteeMs} ms` : `不可达 · ${probe?.giteeError || '未知原因'}`);

  // 分组而不是一段平铺（2026-10-28 用户截图报障）：
  //  ① 本机环境，② **外部工具**（三个目录包，此前在「在线资源」里又重复列过一遍），
  //  ③ **在线资源**（只列文档与皮肤）
  const rows = st.rows.length ? st.rows : await environmentCheck(ctx.app);
  st.rows = rows;
  // bz reader 那一行要带「安装」按钮，单独一组渲染（environmentCheck 给的是纯文本行，
  // 留给完成屏；这里按 id 摘掉，免得同一件事在一屏里出现两次）。
  const { env: envRows, tools: toolRows } = splitProbeRows(rows.filter((r) => r.id !== 'bz-reader'));

  const env = setupGroup('本机');
  ui.body.appendChild(env.group);
  for (const r of envRows) paint(addRow(r.key, env.card), r.ok, r.value);

  // bz reader：本机状态立刻显示，最新版异步查（GitHub 主 → 码云备），不阻塞这一屏。
  // 两条通道都不通时静默——按钮照常可点，点安装时再把具体原因给人看。
  const readerGroup = setupGroup('Obsidian 插件');
  ui.body.appendChild(readerGroup.group);
  const readerHandle = mountReaderRow(ctx, readerGroup.card);
  if (probe?.github || probe?.gitee) {
    void fetchLatestReaderRelease()
      .then((r) => readerHandle.setLatest(r.version))
      .catch(() => {
        /* 静默：安装按钮仍可用 */
      });
  }

  if (toolRows.length) {
    const tools = setupGroup('外部工具');
    ui.body.appendChild(tools.group);
    for (const r of toolRows) paint(addRow(r.key, tools.card), r.ok, r.value);
  }

  // 在线资源的下载状态：自检不能只说「这台机器缺什么」，还要说「哪些已经下好了」。
  // 清单只拉一次，安装屏直接复用（st.manifest）。
  if (st.manifest === undefined) {
    const fetched = await fetchManifestWithTimeout(ctx.app);
    st.manifest = fetched.manifest;
  }
  const manifest = st.manifest;
  if (manifest) {
    const onlineRes = setupGroup('在线资源');
    ui.body.appendChild(onlineRes.group);
    for (const e of resourceDocsOf(manifest)) {
      // 判据必须与 ③ 屏的 isReady 完全一致——按 kind 分派。
      // 这里此前一律用 docStatus，而它判的是**归档文件的 sha256**：对目录包来说那是
      // 下载前的 .tar.gz，跟解包后的目录是两回事。结果就是同一项在 ① 说「已下载」、
      // 在 ③ 又说要下（2026-11-01 用户报障）。目录包该问 bundleStatus（看解包标记）。
      const state = e.kind === 'bundle' ? await bundleStatus(ctx.app, e) : await docStatus(ctx.app, e);
      const text = state === 'ready' ? '已下载' : state === 'updated' ? '有更新' : '未下载';
      paint(addRow(e.name, onlineRes.card), state === 'ready' ? true : state === 'updated' ? null : false, text);
    }
    const skin = await skinStatus(ctx.app, manifest);
    const text = `${skin.ready}/${manifest.skins.length} 已下载`;
    paint(addRow('主题皮肤', onlineRes.card), skin.missing === 0 && skin.updated === 0 ? true : null, text);
  }

  const rescan = (): void => {
    st.net = null;
    st.rows = [];
    st.manifest = undefined;
    void stageProbe(ctx, st, ui);
  };

  const online = !!(probe?.github || probe?.gitee);
  if (!online) {
    // 只说事实，不给操作指令（2026-10-28 用户拍板）：原先那两句「填镜像源」「把 downloads/ 拷到
    // bz-offline/」都不该出现在这里——镜像源行已经下线，而让人手动摆文件路径本身就是错的指引
    // （摆错位置不会报错，只会表现为「下载一直失败」）。真无外网的人自己知道该怎么办。
    // 具体原因不在这里复述：上面两行的值已经写着「不可达 · <原因>」。
    setSub(ui, '连不上资源站。下载类功能等网络恢复后再用，其余功能不受影响。');
    const later = button('bz-setup-btn bz-setup-btn--back', '稍后再说');
    later.onclick = () => {
      void markDone(ctx.app);
      closeModal(ui);
      ctx.onFinish?.();
    };
    // 重试钮前面挂一条视频出口：连不上时再点几次也是同样的结果，得先告诉人该去改什么
    const help = button('bz-setup-link', '连不上？看视频 →');
    help.onclick = () => openExternalUrl(ctx.app, NET_HELP_VIDEO);
    const retry = button('bz-setup-btn bz-setup-btn--cta', '重新检测');
    retry.onclick = rescan;
    ui.foot.append(later, help, retry);
    return;
  }

  const again = button('bz-setup-btn bz-setup-btn--back', '重新检测');
  again.onclick = rescan;
  // 自检模式也走安装（2026-11-05 用户拍板）：检测屏已经把「缺什么」列全了，
  // 点「安装缺失项」直接补齐，装完再看结果——不再点下一步就退到完成屏。
  const next = button('bz-setup-btn bz-setup-btn--cta', ctx.checkOnly ? '安装缺失项' : '下一步');
  next.onclick = () => (ctx.checkOnly ? void beginInstall(ctx, st, ui) : void stageStorage(ctx, st, ui));
  ui.foot.append(again, next);
}

/* ---------- ② 存放位置 ---------- */
/**
 * 一页只问一件事：存在哪。
 * 卡片里只有一行：键「数据目录」+ 灰字路径 + 「更改」——说明文字一个不放（2026-10-29 用户要求，
 * 连「会被同步盘带走」那种也去掉），只有「写不进去」时 note 才出来说话。
 */
async function stageStorage(ctx: WizardCtx, st: WizardState, ui: Ui): Promise<void> {
  // 初值 = 缺省数据目录（<插件目录>/storage）。引导只在这里给新库一个起点，
  // 用户点「更改」选别的就按他选的；已有值的库读到的本来就是自己的值。
  const current = String(tryGetSettings()?.storagePath || initialStorageDir(pluginRelDirOf(ctx.app)));
  st.storagePath = current;
  // 这屏只问一件事：存哪。副标题与「会被同步盘带走」那几句删掉 —— 路径本身就是答案。
  setSub(ui, '');
  ui.body.innerHTML = '';
  ui.foot.innerHTML = '';

  const box = setupGroup();
  ui.body.appendChild(box.group);
  const row = rowEl('bz-setup-row bz-setup-row--path');
  const val = valEl(current);
  val.classList.add('bz-setup-val--mono');
  const pick = button('bz-setup-link', '更改');
  row.append(keyEl('数据目录'), val, pick);
  box.card.appendChild(row);

  // 平时不占位：只有「写不进去」才在这里说话
  const note = document.createElement('div');
  note.className = 'bz-setup-note is-hidden';
  ui.body.appendChild(note);

  const setNote = (text: string, bad = false): void => {
    note.textContent = text;
    note.classList.remove('is-hidden');
    note.classList.toggle('bz-setup-note--bad', bad);
  };
  const clearNote = (): void => {
    note.textContent = '';
    note.classList.add('is-hidden');
    note.classList.remove('bz-setup-note--bad');
  };

  pick.onclick = () =>
    openPathPicker({
      title: '数据存放在哪',
      mode: 'single',
      selected: [st.storagePath],
      okText: '用这个',
      onConfirm: (picked) => {
        const chosen = String(picked[0] || '').replace(/\/+$/, '');
        if (!chosen) return;
        st.storagePath = chosen;
        val.textContent = chosen;
        clearNote();
      },
    });

  const back = button('bz-setup-btn bz-setup-btn--back', '上一步');
  back.onclick = () => void stageProbe(ctx, st, ui);
  const next = button('bz-setup-btn bz-setup-btn--cta', '下一步');
  next.onclick = async () => {
    if (!(await probeWritableDir(ctx.app, st.storagePath))) {
      setNote('这个目录写不进去，换一个，或检查是否只读 / 被同步盘占用。', true);
      return;
    }
    try {
      const s = getSettings();
      s.storagePath = st.storagePath;
      await saveSettings();
    } catch {
      /* 设置未注入：不影响本次流程 */
    }
    // 存哪定了 → 再问「要不要顺手配 AI」，最后才谈下什么
    void stageAi(ctx, st, ui);
  };
  ui.foot.append(back, next);
}

/* ---------- 进安装（不列清单） ---------- */
/**
 * 「下一步」之后直接下。
 *
 * 2026-11-05 用户拍板：检测屏已经把「缺什么」列全了，中间再摆一屏下载清单等于让用户
 * 重复看一遍、再勾一遍——引导页不该有选择题。这里按检测结果直接算队列，全下。
 */
async function beginInstall(ctx: WizardCtx, st: WizardState, ui: Ui): Promise<void> {
  setSub(ui, '正在核对磁盘…');
  ui.foot.innerHTML = '';
  if (st.manifest === undefined) {
    // 直接重跑引导（没经过检测屏）时才现拉；正常路径在检测屏已经拉过
    const fetched = await fetchManifestWithTimeout(ctx.app);
    st.manifest = fetched.manifest;
  }
  const nodeMissing = probeNodeRuntime(ctx.app, { fresh: true }).kind === 'none';
  // bz reader 不进在线资源清单（它是另一个插件），单独问一次磁盘
  const readerState = await readReaderInstall(ctx.app);
  const readerMissing = !isReaderHealthy(readerState);
  const items = await planSetupItems(ctx.app, st.manifest ?? null, { nodeMissing, readerMissing });
  const tasks = selectedTasks(items, defaultSelection(items));
  if (!tasks.length) {
    if (!ctx.checkOnly) await markDone(ctx.app);
    void stageDone(ctx, st, ui);
    return;
  }
  void stageInstall(ctx, st, ui, tasks);
}

/**
 * 磁盘余量（字节；拿不到 → null）。
 * 写在前面：便携 Node 解出来 87MB、main.js 2.7MB、皮肤/文档 10MB——再加上解压瞬时占用，
 * 一次首装大约要 150MB 余量。磁盘满时 Obsidian 的 write 报的是底层错误，
 * 用户看到的是「下载失败」，根本猜不到是磁盘。
 */
export function freeSpaceBytes(app: unknown = getApp()): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const fs = (window as any).require?.('fs');
    const statfs = fs?.statfsSync;
    if (!statfs) return null;
    // 目标盘 = vault 所在盘（插件目录与数据目录都在 vault 内）
    const dir = pluginDirOf(app) || (window as any).require?.('os')?.homedir?.() || '.';
    const st = statfs(dir);
    const bsize = Number(st?.bsize) || Number(st?.frsize) || 0;
    const bavail = Number(st?.bavail ?? st?.bfree) || 0;
    return bsize && bavail ? bsize * bavail : null;
  } catch {
    return null;
  }
}

/** 清单拉取结果：`error` 是给人看的原因（引导页原样显示——无声吞掉过一次，排查盲了两轮） */
interface ManifestFetch {
  manifest: DownloadManifest | null;
  error: string;
}

/** 拉清单带超时（失败 → null，不阻断流程） */
async function fetchManifestWithTimeout(app: unknown): Promise<ManifestFetch> {
  const work = refreshManifest(app)
    .then((r) => ({ manifest: r?.manifest ?? null, error: '' }))
    .catch((e: unknown) => ({ manifest: null, error: String((e as Error)?.message || e || '未知错误') }));
  return Promise.race([
    work,
    new Promise<ManifestFetch>((resolve) =>
      setTimeout(
        () => resolve({ manifest: null, error: `超过 ${Math.round(MANIFEST_TIMEOUT_MS / 1000)} 秒没有响应` }),
        MANIFEST_TIMEOUT_MS,
      ),
    ),
  ]);
}

/* ---------- ③ AI 密钥（可选） ---------- */
async function stageAi(ctx: WizardCtx, st: WizardState, ui: Ui): Promise<void> {
  st.provider = String(tryGetSettings()?.aiProvider || DEFAULT_AI_PROVIDER);
  st.apiKey = '';
  st.aiTest = { state: 'idle', text: '' };

  // 这屏只剩操作：选服务、贴 key、测一下。说明文字删掉（chips 与占位符已经说清了）。
  setSub(ui, '');
  ui.body.innerHTML = '';
  ui.foot.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'password';
  input.className = 'bz-setup-input';
  input.oninput = () => {
    st.apiKey = input.value.trim();
    st.aiTest = { state: 'idle', text: '' };
    paint();
  };

  const seg = document.createElement('div');
  seg.className = 'bz-setup-seg';
  const keyRow = rowEl('bz-setup-row bz-setup-row--input');
  const keyLabel = keyEl('API Key');
  const test = button('bz-setup-link', '测一下');
  keyRow.append(keyLabel, input, test);
  const testLine = document.createElement('div');
  testLine.className = 'bz-setup-note';

  function paint(): void {
    const d = getProviderDescriptor(st.provider);
    const local = d.id === 'ollama';
    // 只藏输入框：「测一下」对本地服务同样有用（此前跟着整行一起藏掉了）
    keyLabel.textContent = local ? '本机服务' : 'API Key';
    input.classList.toggle('is-hidden', local);
    input.placeholder = d.apiKeyLabel || '粘贴 API Key';
    testLine.textContent = st.aiTest.state === 'idle' ? '' : st.aiTest.state === 'busy' ? '正在测…' : st.aiTest.text;
    testLine.classList.toggle('bz-setup-note--bad', st.aiTest.state === 'fail');
    testLine.classList.toggle('is-hidden', st.aiTest.state === 'idle');
    for (const b of Array.from(seg.querySelectorAll('button'))) {
      b.classList.toggle('is-on', b.dataset.id === st.provider);
    }
  }

  for (const p of AI_PROVIDER_REGISTRY) {
    const b = button('bz-setup-chip', p.label);
    b.dataset.id = p.id;
    b.onclick = () => {
      st.provider = p.id;
      st.aiTest = { state: 'idle', text: '' };
      paint();
    };
    seg.appendChild(b);
  }
  const box = setupGroup();
  box.card.append(keyRow);
  ui.body.append(seg, box.group, testLine);
  paint();

  const back = button('bz-setup-btn bz-setup-btn--back', '上一步');
  back.onclick = () => void stageStorage(ctx, st, ui);
  const skip = button('bz-setup-btn', '跳过');
  skip.onclick = () => void beginInstall(ctx, st, ui);
  test.onclick = async () => {
    await saveAi(st);
    st.aiTest = { state: 'busy', text: '' };
    paint();
    try {
      const r = await testAIConnectivity(st.provider);
      st.aiTest = { state: 'ok', text: `通了 · ${r.ms} ms · 回复「${r.reply.slice(0, 12)}」` };
    } catch (e) {
      st.aiTest = { state: 'fail', text: `没通：${(e as Error)?.message || String(e)}` };
    }
    paint();
  };
  const save = button('bz-setup-btn bz-setup-btn--cta', '保存并继续');
  save.onclick = async () => {
    await saveAi(st);
    void beginInstall(ctx, st, ui);
  };
  ui.foot.append(back, skip, save);
}

async function saveAi(st: WizardState): Promise<void> {
  try {
    const s = getSettings();
    s.aiProvider = st.provider;
    const key = st.apiKey.trim();
    if (st.provider === 'zhipu-plan') s.zhipuPlanApiKey = key;
    else if (st.provider === 'ollama') s.ollamaApiKey = key;
    else s.deepseekApiKey = key;
    await saveSettings();
  } catch {
    /* 设置未注入：忽略 */
  }
}

/* ---------- ④ 安装 ---------- */
async function stageInstall(ctx: WizardCtx, st: WizardState, ui: Ui, tasks: SetupItem[]): Promise<void> {
  // 下载屏不给「收起来，后台继续」（2026-10-31 用户拍板）：点了之后弹窗消失、下载在后台跑，
  // 用户看不到进度也等不到「完成」那一屏，回来只发现东西装上了 —— 首次引导等于半途而废。
  // 这里就是让它跑完：跑完自动进 ⑤，还没装齐的会在完成屏列出来，去「在线资源」重试。
  setSub(ui, '正在下载，跑完自动进入下一步。');
  ui.body.innerHTML = '';
  ui.foot.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'bz-setup-bar';
  bar.innerHTML = '<i></i>';
  const box = setupGroup();
  ui.body.append(bar, box.group);

  const total = tasks.reduce((n, t) => n + (t.size || 0), 0);
  // 余量预检：解压瞬时占用按 1.5 倍估，再留 64MB 给插件自己写
  const free = freeSpaceBytes(ctx.app);
  if (free !== null && free < total * 1.5 + 64 * 1024 * 1024) {
    setSub(ui, `磁盘余量不足：需要约 ${sizeText(total * 1.5 + 64 * 1024 * 1024)}，当前只剩 ${sizeText(free)}。`);
    // 余量不足：回去改数据目录（换到别的盘），不是回「清单」——清单屏已经没有了
    const again = button('bz-setup-btn bz-setup-btn--cta', '返回修改位置');
    again.onclick = () => void stageStorage(ctx, st, ui);
    ui.foot.appendChild(again);
    return;
  }
  let doneBytes = 0;
  for (const t of tasks) {
    const row = rowEl();
    const mark = markEl('busy');
    const val = valEl('进行中');
    row.append(mark, keyEl(t.label, t.desc), val);
    box.card.appendChild(row);
    try {
      await t.run((text) => {
        // 单项的进度直接写在这一行（Node 那一项会走到 42% · 15 MB / 36 MB）
        val.textContent = text;
      });
      doneBytes += t.size || 0;
      mark.className = 'bz-setup-mark bz-setup-mark--ok';
      val.textContent = '已就绪';
      row.classList.add('is-ok');
    } catch (e) {
      st.failed.push(t.label);
      mark.className = 'bz-setup-mark bz-setup-mark--bad';
      val.textContent = '失败';
      row.classList.add('is-bad');
      console.warn(`[bz] 首次准备：${t.label} 失败`, e);
    }
    const pct = total > 0 ? Math.min(99, Math.round((doneBytes / total) * 100)) : 0;
    (bar.querySelector('i') as HTMLElement).style.width = `${pct}%`;
  }
  (bar.querySelector('i') as HTMLElement).style.width = '100%';
  // 自检模式不是「首次准备」：不该把 setupDone 置 true（那笔账只属于首次引导）
  if (!ctx.checkOnly) await markDone(ctx.app);

  // 值守是唯一「改系统状态」的一步：bundle 装完就在这里问一次（setupAfterInstall 自带确认框）
  if (tasks.some((t) => t.id === 'tool-dock-watch')) {
    setSub(ui, '工具就位。还有一件事要你点头：值守要不要开机自启。');
    try {
      await setupAfterInstall(ctx.app, 'dock-watch');
    } catch (e) {
      console.warn('[bz] 值守初始化失败', e);
    }
  }
  await stageDone(ctx, st, ui);
  if (st.failed.length) {
    notice(`首次准备完成，但有 ${st.failed.length} 项失败：${st.failed.join('、')}。可在「设置 → 通用 → 在线资源」里重试`, 'warning');
  } else {
    notice('首次准备完成，环境与工具已就绪', 'success');
  }
}

/* ---------- ⑤ 完成 ---------- */

async function stageDone(ctx: WizardCtx, st: WizardState, ui: Ui): Promise<void> {
  const rows = await environmentCheck(ctx.app);
  st.rows = rows;
  // 这一屏既是「装完了」也是「自检完了」的落点，所以别说一口「都就位了」：
  // 红着的那几行摆在下头，标题却报平安，只会让用户怀疑整张表。
  const bad = rows.filter((r) => r.ok === false);
  setSub(ui, bad.length ? `还有 ${bad.length} 项没就位，其余已经能用。` : '都就位了。');
  ui.body.innerHTML = '';
  ui.foot.innerHTML = '';

  const box = setupGroup();
  ui.body.appendChild(box.group);
  for (const r of rows) {
    const row = lineRow(markEl(r.ok === true ? 'ok' : r.ok === false ? 'bad' : 'idle'), r.key, undefined, r.value);
    if (r.ok === false) row.classList.add('is-bad');
    box.card.appendChild(row);
  }
  // Python / ffmpeg 的收尾交代随那两行一起撤了（2026-11-01）：它们不在检查表里了，
  // 还留一句「还没装上」只会指向一个这一屏已经不负责的东西。要装就是下面那颗按钮。
  // 自检模式（设置 → 关于 → 环境自检）没有「开始使用」这回事：用户是来看一眼的，
  // 不是来开始用的。上一版这里是「知道了」，随「在线资源清单」那一屏一起被删掉了；
  // 少了这个分支，自检到最后会拿到一颗「开始使用」，点下去还会走 onFinish 打开首页。
  const enter = ctx.checkOnly
    ? button('bz-setup-btn bz-setup-btn--cta', '知道了')
    : button('bz-setup-btn bz-setup-btn--cta', '开始使用');
  enter.onclick = () => {
    closeModal(ui);
    if (!ctx.checkOnly) ctx.onFinish?.();
  };
  // 「安装外部工具」：下载队列覆盖不到的那几层（Node / Python / Ollama / 模型 / ffmpeg / pip 依赖）
  // ——队列只搬得进插件目录的东西，这些全是系统级运行时。
  // 形制是**次级按钮**，紧贴「开始使用」左边（2026-11-01 用户拍板）：两者是并列的两条下一步，
  // 它不该缩成一条备注式的文字链贴在角落。
  const depsGuide = button('bz-setup-btn', '安装外部工具');
  depsGuide.onclick = () => openDepsGuide(ctx.app);
  // 东西齐了，下一步是「怎么用」：把教程摆在这一屏，用户不必先摸到设置面板再找回来。
  // 左边贴一条文字链（与「开始使用」同一行，不抢主行动），点了开浏览器、引导不关。
  // 文案保留「看使用教程 →」（2026-11-01 用户拍板：这一处不改叫「看视频教程」）。
  // 也不再问「去 B 站看？」那一道（同日用户要求）：点教程链接的意图已经明确，
  // 再弹一层确认纯属多一步；引导页本身不会关，用户随时能回来。
  const tutorial = button('bz-setup-link bz-setup-link--foot', '看使用教程 →');
  tutorial.onclick = () => openExternalUrl(ctx.app, TUTORIAL_URL);
  ui.foot.append(tutorial, depsGuide, enter);
}

/* ---------- 杂项 ---------- */

/* 判据与兜底键在 core/setup-state.ts（main.ts 要同步问「这次弹不弹」）；这里转出给既有调用方。 */
export { SETUP_DONE_FALLBACK_KEY, setupDoneStorageKey, setupAlreadyDone } from './setup-state';

async function markDone(app: unknown): Promise<void> {
  try {
    const s = getSettings();
    s.setupDone = true;
    await saveSettings();
    return; // 设置写得进去就不留兜底键：那把键只该服务「设置写不进去」的库
  } catch {
    /* 设置未注入 / 只读库：落到下面的兜底 */
  }
  // 只读 vault / 落盘失败时 data.json 写不进去，光靠设置项会导致**每次启动都弹一次**——
  // 那比不弹更糟。localStorage 不依赖 data.json，作为兜底足够（键按库分，见 setupDoneStorageKey）。
  try {
    localStorage.setItem(setupDoneStorageKey(vaultBasePathOf(app)), JSON.stringify({ at: Date.now() }));
  } catch {
    /* 无 localStorage（测试环境） */
  }
}

/**
 * 打开首次引导（或环境自检）。
 *
 * @returns 弹窗是否真的打开了。移动端直接劝退、返回 false —— main.ts 据此决定
 *   要不要把「启动自动弹面板」压回去（没弹引导就不该压）。
 *
 * 首次引导点遮罩 / 按 ESC **不直接关**，先弹确认（confirmLeaveWizard）：它是这次启动
 * 唯一的界面，点空白就消失等于静默中断，用户看到的是「插件打不开」；而直接关掉也可以，
 * 只是他得知道去哪重开。确认里那句「设置 → 关于 → 环境自检」就是这个去处。
 */
export function openSetupWizard(
  app: unknown = getApp(),
  opts: { firstRun?: boolean; onFinish?: () => void } = {},
): boolean {
  if (isMobileEnv()) {
    notice('bz 的完整功能需要桌面端 Obsidian', 'warning');
    return false;
  }
  const firstRun = opts.firstRun === true;
  const content = document.createElement('div');
  // 先建骨架再开弹窗：requestClose 里要用 closeModal(ui) 走同一条关闭路径
  // （存活登记表与 ESC 注册跟着注销，直接 remove 遮罩会留下悬挂的登记项）
  const ui = skeleton(content);
  const modal = uiModal({
    head: true,
    title: firstRun ? 'bz · 首次准备' : '环境自检',
    content,
    // 760 而不是 600（2026-10-28 用户：太窄，布局不好看）：清单是「名称——值」两列，
    // 窄窗里右侧那列只能挤成豆腐块；宽一点才读得出一条是一条。
    maxWidth: 760,
    // 但 `max-width` 只是**上限**，弹窗宽度本来是内容撑的（实测只有 514px）——
    // 要的宽度得由 .bz-setup-modal 给死（见 components.css）。这里的类还负责把
    // 高度预算提到整屏、让长清单只滚内容区而不齐切一行。
    className: 'bz-setup-modal',
    autofocus: false,
    // 关闭意图：首次引导拦一道确认（关掉 = 这次不再自动弹，得告诉他去哪重开）；
    // 环境自检照旧点遮罩 / ESC 直接关。
    ...(firstRun
      ? {
          requestClose: () =>
            confirmLeaveWizard(() => {
              void markDone(app);
              closeModal(ui);
              opts.onFinish?.();
            }),
        }
      : {}),
  });
  activeClose = modal.close;
  const ctx: WizardCtx = { app, firstRun, checkOnly: !firstRun, onFinish: opts.onFinish };
  const st: WizardState = {
    net: null,
    rows: [],
    storagePath: '',
    provider: DEFAULT_AI_PROVIDER,
    apiKey: '',
    aiTest: { state: 'idle', text: '' },
    failed: [],
  };
  void stageProbe(ctx, st, ui);
  return true;
}

/** 设置面板「环境自检」按钮的入口（同一视图；自检模式跳过存放 / AI 两屏） */
export function openEnvironmentCheck(app: unknown = getApp()): void {
  openSetupWizard(app, { firstRun: false });
}
