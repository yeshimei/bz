/* ============================================================
 * bz · 首次引导 / 环境自检（core/setup-wizard.ts）
 *
 * 一次把「新机器缺什么、缺的怎么补」走完。六屏：
 *
 *   ① 检测   先探网络（raw + jsDelivr 四个边缘），再探本机八项
 *   ② 存放   数据存哪（默认 <插件目录>/storage，可改；点「下一步」写探针验证时才建目录）
 *   ③ 内容   下什么（运行时 / 工具 / 文档索引 / 皮肤，逐项可勾；**已就绪的自动跳过**）
 *   ④ AI     可选：服务商 + 密钥 + 当场测通（跳过不影响其他功能）
 *   ⑤ 安装   勾了就全自动，不再逐项确认；单项失败不牵连
 *   ⑥ 完成   就绪清单 + 值守启用询问（唯一改系统状态的一步）+ 仍需手工的项
 *
 * 三条设计约束：
 *  - **同意只有一次**（③ 底部的「开始下载」）。之后的下载不再问第二遍——它们只是往插件
 *    自己的目录写文件。唯一会改系统状态的是「值守注册登录自启」，那一步单独确认
 *    （⑤ 末尾调 core/tool-setup.ts 的 setupAfterInstall，它自己带确认框）。
 *  - **已就绪的不重下**。③ 的列表按磁盘事实打勾：老用户重跑一遍不必再拉几十 MB。
 *  - 与「设置 → 关于 → 环境自检」共用同一套行渲染与补齐队列；自检模式跳过 ②④ 两屏。
 * ============================================================ */
import { notice } from './notice';
import { openExternalUrl } from './utils';
import { uiModal } from './ui/modal';
import { environmentCheck, probeNetwork, probeWritableDir, type EnvCheckRow, type NetworkProbe } from './env-check';
import { docStatus, refreshManifest } from './download-manifest';
import type { DownloadManifest, ManifestDocEntry } from './download-manifest';
import { bundleStatus, installBundle } from './bundle-asset';
import { ensureAssetWithHash } from './remote-asset';
import { downloadSkinUpdates, skinStatus } from './skin-pack';
import { installPortableNode, PORTABLE_NODE_VERSION } from './node-runtime-install';
import { probeNodeRuntime, resetNodeRuntimeCache } from './tool-runtime';
import { setupAfterInstall } from './tool-setup';
import { pluginDirOf, pluginRelDirOf, vaultBasePathOf } from './plugin-path';
import { initialStorageDir } from './storage-path';
import { setupDoneStorageKey } from './setup-state';
import { openPathPicker } from './path-picker';
import { isMobileEnv } from './mobile';
import { getApp } from './app';
import { getSettings, saveSettings, tryGetSettings } from './settings-provider';
import { AI_PROVIDER_REGISTRY, DEFAULT_AI_PROVIDER, getProviderDescriptor, testAIConnectivity } from './ai';

/** Node 归档的估算体积（只在清单里显示，真实体积看服务端） */
const NODE_SIZE_HINT = 36.4 * 1024 * 1024;

/** 拉清单的超时（requestUrl 没有 abort，用 race 兜住——不让第一屏挂在网络上） */
const MANIFEST_TIMEOUT_MS = 12000;

/** 下载项的种类（决定 ③ 屏怎么分组、缺省勾不勾） */
export type SetupKind = 'node' | 'bundle' | 'doc' | 'skins';

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
  /** 按需项：只影响「装完再补」的提示，勾选口径与其他项一致（默认全勾） */
  optional?: boolean;
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
export function buildSetupTasks(app: unknown, manifest: DownloadManifest | null, opts: { nodeMissing: boolean }): SetupItem[] {
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
  if (!manifest) return items;

  // 目录包（工具）先于文档：工具决定「能不能用」，文档决定「查不查得到」
  for (const e of manifest.docs.filter((d) => d.kind === 'bundle')) items.push(mk(bundleItem(app, e)));
  for (const e of manifest.docs.filter((d) => d.kind !== 'bundle')) items.push(mk(docItem(app, e)));
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
  // 大索引（豆瓣影视索引 7.2MB）不占首装：它只服务影院域的输入联想，用到的域进页面时自己拉。
  // 首装跟着下一遍，是纯占地方——而且走镜像要 30 秒，正好卡在「最后一项」让人以为卡死。
  const lazy = LAZY_DOC_IDS.has(e.id);
  return {
    id: e.id,
    kind: 'doc',
    label: e.name,
    desc: lazy ? '按需下载' : '',
    size: e.size ?? null,
    ...(lazy ? { optional: true } : {}),
    run: async () => {
      await ensureAssetWithHash(app, e.file, e.sha256, e.name, e.size);
    },
  };
}

/** 按需下载的资源 id（首装默认不勾；对应功能首次用到时自己拉） */
export const LAZY_DOC_IDS = new Set(['cinema-douban-index']);

/** 磁盘上这一项是不是已经就绪（重跑引导时用来跳过，避免白拉几十 MB） */
async function isReady(app: unknown, manifest: DownloadManifest | null, id: string, kind: SetupKind): Promise<boolean> {
  if (kind === 'node') return probeNodeRuntime(app, { fresh: true }).kind !== 'none';
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
  opts: { nodeMissing: boolean },
): Promise<SetupItem[]> {
  const items = buildSetupTasks(app, manifest, opts);
  const out: SetupItem[] = [];
  for (const it of items) out.push({ ...it, ready: await isReady(app, manifest, it.id, it.kind) });
  return out;
}

/**
 * 缺省勾选：**全部勾上**（2026-10-28 用户拍板「默认全部都下载」）。
 * 早前把皮肤和按需项留空，理由是「提前下纯占地方」——实际用起来是「装了不等于能用」：
 * 皮肤要单点、索引要等首次进影院才拉，用户以为坏了。已经就绪的项照旧不列进勾选
 * （selectedTasks 会再滤一遍，勾中也只补真缺的）。
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
  /** 自检模式：跳过「存放 / AI」两屏，直奔清单 */
  checkOnly: boolean;
  /** 首次引导**结束**后的回调：main.ts 用它打开首页。三条结束路径都触发——
   *  「开始使用」「以后再说」「稍后再说」。只有「收起来，后台继续」不触发：
   *  那是把弹窗收走让下载在后台跑，不是结束。 */
  onFinish?: () => void;
}

interface WizardState {
  net: NetworkProbe | null;
  /** 清单（检测屏拉一次，下载屏复用——不让用户在两屏之间等两次网络） */
  manifest?: DownloadManifest | null;
  /** 清单没拉到时的**具体原因**（引导页原样给人看；空 = 拉到了或还没拉） */
  manifestError?: string;
  rows: EnvCheckRow[];
  storagePath: string;
  items: SetupItem[];
  selected: Set<string>;
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

/** 「在线资源」段只列文档与皮肤（目录包已经归「外部工具」，不在这里重复） */
export function resourceDocsOf<T extends { kind?: string }>(manifest: { docs: T[] }): T[] {
  return manifest.docs.filter((d) => d.kind !== 'bundle');
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
  const netRow = addRow('资源站', net.card);
  const cdnRow = addRow('备用通道', net.card);
  const probe = st.net ?? (await probeNetwork().catch(() => null));
  st.net = probe;
  // 不可达时把**原因**带上（2026-10-28：只说「不可达」时，网页能开 GitHub 的人根本无从判断
  // 是墙、是代理还是 DNS——raw.githubusercontent.com 与 github.com 是两回事）
  paint(netRow, probe?.github === true, probe?.github ? `可达 · ${probe.githubMs} ms` : `不可达 · ${probe?.githubError || '未知原因'}`);
  paint(cdnRow, probe?.jsdelivr ? true : null, probe?.jsdelivr ? `可达 · ${probe.jsdelivrMs} ms` : `不可达 · ${probe?.jsdelivrError || '未知原因'}`);

  // 分组而不是一段平铺（2026-10-28 用户截图报障）：
  //  ① 本机环境，② **外部工具**（三个目录包，此前在「在线资源」里又重复列过一遍），
  //  ③ **在线资源**（只列文档与皮肤）
  const rows = st.rows.length ? st.rows : await environmentCheck(ctx.app);
  st.rows = rows;
  const { env: envRows, tools: toolRows } = splitProbeRows(rows);

  const env = setupGroup('本机');
  ui.body.appendChild(env.group);
  for (const r of envRows) paint(addRow(r.key, env.card), r.ok, r.value);

  if (toolRows.length) {
    const tools = setupGroup('外部工具');
    ui.body.appendChild(tools.group);
    for (const r of toolRows) paint(addRow(r.key, tools.card), r.ok, r.value);
  }

  // 在线资源的下载状态：自检不能只说「这台机器缺什么」，还要说「哪些已经下好了」。
  // 清单只拉一次，③ 屏直接复用（st.manifest）。
  if (st.manifest === undefined) {
    const fetched = await fetchManifestWithTimeout(ctx.app);
    st.manifest = fetched.manifest;
    st.manifestError = fetched.error;
  }
  const manifest = st.manifest;
  if (manifest) {
    const onlineRes = setupGroup('在线资源');
    ui.body.appendChild(onlineRes.group);
    for (const e of resourceDocsOf(manifest)) {
      // 深校验只对目录包有意义（逐文件 stat）；文档是单文件 sha256，docStatus 立刻能判
      const state = await docStatus(ctx.app, e);
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

  const online = !!(probe?.github || probe?.jsdelivr);
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
    const help = button('bz-setup-link', '连不上？看这个视频 →');
    help.onclick = () => openExternalUrl(ctx.app, NET_HELP_VIDEO);
    const retry = button('bz-setup-btn bz-setup-btn--cta', '重新检测');
    retry.onclick = rescan;
    ui.foot.append(later, help, retry);
    return;
  }

  const again = button('bz-setup-btn bz-setup-btn--back', '重新检测');
  again.onclick = rescan;
  const next = button('bz-setup-btn bz-setup-btn--cta', '下一步');
  next.onclick = () => (ctx.checkOnly ? void stageResources(ctx, st, ui) : void stageStorage(ctx, st, ui));
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

/* ---------- ③ 下载内容 ---------- */
async function stageResources(ctx: WizardCtx, st: WizardState, ui: Ui): Promise<void> {
  setSub(ui, '正在核对磁盘…');
  ui.body.innerHTML = '';
  ui.foot.innerHTML = '';

  if (st.manifest === undefined) {
    // 检测屏已经拉过就直接复用；直接进到这一屏（重跑引导）才现拉
    const fetched = await fetchManifestWithTimeout(ctx.app);
    st.manifest = fetched.manifest;
    st.manifestError = fetched.error;
  }
  const manifest = st.manifest ?? null;
  const nodeMissing = probeNodeRuntime(ctx.app, { fresh: true }).kind === 'none';
  st.items = await planSetupItems(ctx.app, manifest, { nodeMissing });
  st.selected = defaultSelection(st.items);

  const pending = (): SetupItem[] => selectedTasks(st.items, st.selected);
  const total = pending().reduce((n, t) => n + (t.size || 0), 0);
  // 一句话说清「下多少」；「点开始后自动完成，中途不用再确认」那种交代属于多余说明
  setSub(
    ui,
    pending().length
      ? `${pending().length} 项 · ${sizeText(total) || '体积未知'}`
      : // 清单没拉到时**不能**说「什么都不缺」：那是「不知道缺什么」，两件事
        manifest
        ? '都齐了。'
        : '清单没拉到。',
  );
  ui.body.innerHTML = '';
  ui.foot.innerHTML = '';

  // 只在真需要交代的时候给一行注释（清单缺 / 走备用通道）
  const hintText = !manifest
    ? `这次只能补 Node 运行时，其余资源等清单能拉到再说${reasonSuffix(st.manifestError)}`
    : st.net && !st.net.github
      ? 'GitHub 不通，自动走备用通道。'
      : '';
  if (hintText) {
    const hint = document.createElement('div');
    hint.className = 'bz-setup-note';
    hint.textContent = hintText;
    ui.body.appendChild(hint);
  }

  const next = button('bz-setup-btn bz-setup-btn--cta', '');

  const GROUPS: Array<{ kind: SetupKind; title: string }> = [
    { kind: 'node', title: '运行环境' },
    { kind: 'bundle', title: '外部工具' },
    { kind: 'doc', title: '文档' },
    { kind: 'skins', title: '皮肤' },
  ];
  for (const g of GROUPS) {
    const group = st.items.filter((i) => i.kind === g.kind);
    if (!group.length) continue;
    const wrap = setupGroup(g.title);
    for (const it of group) {
      const row = rowEl('bz-setup-row bz-setup-row--pick');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'bz-setup-check';
      box.checked = st.selected.has(it.id);
      box.disabled = it.ready;
      box.onchange = () => {
        if (box.checked) st.selected.add(it.id);
        else st.selected.delete(it.id);
        refreshFoot();
      };
      row.append(box, keyEl(it.label, it.desc), valEl(it.ready ? '已就绪' : sizeText(it.size) || '待下载'));
      if (it.ready) row.classList.add('is-ok');
      if (it.optional && !it.ready) row.dataset.optional = '1';
      wrap.card.appendChild(row);
    }
    ui.body.appendChild(wrap.group);
  }

  const refreshFoot = (): void => {
    const t = pending();
    const bytes = t.reduce((s, x) => s + (x.size || 0), 0);
    next.textContent = t.length ? `开始下载（${sizeText(bytes) || `${t.length} 项`}）` : '完成';
  };

  const skip = button('bz-setup-btn bz-setup-btn--back', ctx.firstRun ? '以后再说' : '关闭');
  skip.onclick = () => {
    void markDone(ctx.app);
    closeModal(ui);
    ctx.onFinish?.();
  };
  next.onclick = () => {
    const tasks = pending();
    if (!tasks.length) {
      void markDone(ctx.app);
      void stageDone(ctx, st, ui);
      return;
    }
    void stageInstall(ctx, st, ui, tasks);
  };

  if (ctx.checkOnly && !st.items.some((i) => !i.ready)) {
    const ok = button('bz-setup-btn bz-setup-btn--cta', '知道了');
    ok.onclick = () => closeModal(ui);
    ui.foot.append(ok);
    return;
  }
  ui.foot.append(skip, next);
  refreshFoot();
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

/** 拉清单带超时（失败 → null，不阻断流程） */
/**
 * 清单拉不到时的原因后缀（空 → 空串）。
 *
 * 以前这条链上每个 catch 都 `() => null`，用户只能看到「清单没拉到」六个字，我们隔着一块屏幕
 * 猜了两轮（先怀疑网络、再怀疑 jsDelivr）。原文摆出来：哪条通道、什么错，一眼能分清是墙、
 * 是代理、还是本地磁盘写不进去。
 */
function reasonSuffix(error?: string): string {
  const s = String(error || '').trim();
  if (!s) return '';
  return `（原因：${s.length > 160 ? `${s.slice(0, 160)}…` : s}）`;
}

/** 清单拉取结果：`error` 是给人看的原因（引导页原样显示——无声吞掉过一次，排查盲了两轮） */
interface ManifestFetch {
  manifest: DownloadManifest | null;
  error: string;
}

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

/* ---------- ④ AI 密钥（可选） ---------- */
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
  back.onclick = () => void stageResources(ctx, st, ui);
  const skip = button('bz-setup-btn', '跳过');
  skip.onclick = () => void stageResources(ctx, st, ui);
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
    void stageResources(ctx, st, ui);
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

/* ---------- ⑤ 安装 ---------- */
async function stageInstall(ctx: WizardCtx, st: WizardState, ui: Ui, tasks: SetupItem[]): Promise<void> {
  setSub(ui, '自动完成，可以收起来先去忙别的。');
  ui.body.innerHTML = '';
  ui.foot.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'bz-setup-bar';
  bar.innerHTML = '<i></i>';
  const box = setupGroup();
  ui.body.append(bar, box.group);

  const collapse = button('bz-setup-btn', '收起来，后台继续');
  collapse.onclick = () => closeModal(ui);
  ui.foot.appendChild(collapse);

  const total = tasks.reduce((n, t) => n + (t.size || 0), 0);
  // 余量预检：解压瞬时占用按 1.5 倍估，再留 64MB 给插件自己写
  const free = freeSpaceBytes(ctx.app);
  if (free !== null && free < total * 1.5 + 64 * 1024 * 1024) {
    setSub(ui, `磁盘余量不足：需要约 ${sizeText(total * 1.5 + 64 * 1024 * 1024)}，当前只剩 ${sizeText(free)}。`);
    const again = button('bz-setup-btn bz-setup-btn--cta', '返回清单');
    again.onclick = () => void stageResources(ctx, st, ui);
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
  await markDone(ctx.app);

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

/* ---------- ⑥ 完成 ---------- */
async function stageDone(ctx: WizardCtx, st: WizardState, ui: Ui): Promise<void> {
  const rows = await environmentCheck(ctx.app);
  st.rows = rows;
  setSub(ui, '都就位了。');
  ui.body.innerHTML = '';
  ui.foot.innerHTML = '';

  const box = setupGroup();
  ui.body.appendChild(box.group);
  for (const r of rows) {
    const row = lineRow(markEl(r.ok === true ? 'ok' : r.ok === false ? 'bad' : 'idle'), r.key, undefined, r.value);
    if (r.ok === false) row.classList.add('is-bad');
    box.card.appendChild(row);
  }
  if (rows.some((r) => r.id === 'python' && r.value.includes('未找到'))) {
    const hint = document.createElement('div');
    hint.className = 'bz-setup-note';
    hint.textContent = '脸谱导入微信记录要先装 Python 3，不影响其他功能。';
    ui.body.appendChild(hint);
  }
  const enter = button('bz-setup-btn bz-setup-btn--cta', '开始使用');
  enter.onclick = () => {
    closeModal(ui);
    ctx.onFinish?.();
  };
  ui.foot.appendChild(enter);
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
 * 首次引导**不可点遮罩 / ESC 关**（closable: false）：它是这次启动唯一的界面，
 * 点空白就关掉等于静默中断，用户看到的是「插件打不开」。要走开只有按钮：
 * 「稍后再说」「以后再说」或「收起来，后台继续」。
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
    // 首次引导只能由按钮结束（点遮罩/ESC 关掉 = 流程静默中断）；环境自检照旧可关
    closable: !firstRun,
  });
  activeClose = modal.close;
  const ctx: WizardCtx = { app, firstRun, checkOnly: !firstRun, onFinish: opts.onFinish };
  const st: WizardState = {
    net: null,
    rows: [],
    storagePath: '',
    items: [],
    selected: new Set(),
    provider: DEFAULT_AI_PROVIDER,
    apiKey: '',
    aiTest: { state: 'idle', text: '' },
    failed: [],
  };
  void stageProbe(ctx, st, skeleton(content));
  return true;
}

/** 设置面板「环境自检」按钮的入口（同一视图；自检模式跳过存放与 AI 两屏） */
export function openEnvironmentCheck(app: unknown = getApp()): void {
  openSetupWizard(app, { firstRun: false });
}
