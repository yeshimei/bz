/* ============================================================
 * bz · 新版本自更新（core/self-update.ts，单源）
 *
 * 通道：仓库根三件套 manifest.json / main.js / styles.css（全部随 git
 * 入库），raw.githubusercontent 主 → cdn.jsdelivr 备。启动后 15 秒
 * 静默巡检，24 小时节流（localStorage 时间戳）；远端 manifest 的
 * version 大于本地（插件目录 manifest.json）才动作：
 * 拉三件套 → 覆盖写进插件安装目录 → 成功通知，重载插件生效。
 *
 * 设计口径：
 * - 巡检失败一律静默（console.warn）——启动期的网络失败不该弹脸；
 *   只有「真的更新了」才发通知。
 * - 不做灰度/回滚：仓库 main.js 即发布物，版本号是唯一闸门。
 * - manifest.json 本体也从远端覆盖（版本号随发布走）。
 * ============================================================ */
import { requestUrl } from 'obsidian';
import { notice } from './notice';

/** 巡检节流：24 小时 */
const CHECK_INTERVAL_MS = 24 * 3600 * 1000;
/** 启动后延迟巡检（躲开 Obsidian 启动高峰） */
const CHECK_DELAY_MS = 15 * 1000;
const LAST_CHECK_KEY = 'bz-selfupdate:last-check';

/** 远端清单：主 GitHub raw → 备 jsDelivr（同仓库同路径） */
const REMOTE_BASES = [
  'https://raw.githubusercontent.com/yeshimei/bz/master',
  'https://cdn.jsdelivr.net/gh/yeshimei/bz@master',
];

function pluginFile(app: unknown, name: string): string {
  const configDir = String((app as { vault?: { configDir?: string } }).vault?.configDir || '.obsidian');
  return `${configDir}/plugins/bz/${name}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await requestUrl({ url, method: 'GET', throw: true });
  return String(res.text || '');
}

/** 依序试两条通道，全失败抛最后一次错误 */
async function fetchViaBases(path: string): Promise<string> {
  let lastErr: unknown = null;
  for (const base of REMOTE_BASES) {
    try {
      return await fetchText(`${base}/${path}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** 语义化版本比较：返回 >0 表示 a 更新；非数字段按 0 处理（1.0.0-beta 与 1.0.0 视作相等偏低） */
export function versionGt(a: string, b: string): boolean {
  const pa = String(a || '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** main.js 宽校验：非空且不是 HTML 错误页（CDN 被墙时可能回错误页） */
function looksLikeBundle(text: string): boolean {
  const t = String(text || '');
  return t.length > 1000 && !/^\s*<(!DOCTYPE|html)/i.test(t);
}

async function readLocalManifestVersion(app: unknown): Promise<string> {
  const text = await (app as { vault?: { adapter?: { read?: (p: string) => Promise<string> } } })
    .vault!.adapter!.read!(pluginFile(app, 'manifest.json'));
  return String(JSON.parse(text)?.version || '');
}

/**
 * 检查并自更新（可抛错——调用方决定要不要静默）。
 * 有新版本：三件套覆盖写进插件安装目录，成功通知；同版本/更低 → 无事发生。
 */
export async function checkSelfUpdate(app: unknown): Promise<void> {
  // 24h 节流
  const now = Date.now();
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    if (now - last < CHECK_INTERVAL_MS) return;
    localStorage.setItem(LAST_CHECK_KEY, String(now));
  } catch (e) { /* localStorage 不可用（极端环境）→ 不节流也继续 */ }

  const adapter = (app as { vault?: { adapter?: { read?: (p: string, d?: string) => Promise<string>; write?: (p: string, d: string) => Promise<void> } } }).vault?.adapter;
  if (!adapter?.read || !adapter?.write) return;

  const localVer = await readLocalManifestVersion(app);
  if (!localVer) return;

  const remoteManifestText = await fetchViaBases('manifest.json');
  const remoteVer = String(JSON.parse(remoteManifestText)?.version || '');
  if (!remoteVer || !versionGt(remoteVer, localVer)) return;

  // 有新版本才拉大文件（省流量）
  const js = await fetchViaBases('main.js');
  const css = await fetchViaBases('styles.css');
  if (!looksLikeBundle(js)) throw new Error('远端 main.js 内容异常，放弃覆盖');

  await adapter.write(pluginFile(app, 'main.js'), js);
  await adapter.write(pluginFile(app, 'styles.css'), css);
  await adapter.write(pluginFile(app, 'manifest.json'), remoteManifestText);
  notice(`包仔已自动更新到 v${remoteVer}：重载插件（或重启 Obsidian）后生效`, 'success');
}

/** 启动巡检入口：延迟触发、静默失败（自动更新不弹错误脸）。app 未初始化时静默跳过。 */
export function scheduleSelfUpdateCheck(getAppFn: () => unknown, isUnloaded: () => boolean): void {
  window.setTimeout(() => {
    if (isUnloaded()) return;
    void checkSelfUpdate(getAppFn()).catch((e) => {
      console.warn('[bz] 自更新巡检失败（已静默）:', (e as Error)?.message || e);
    });
  }, CHECK_DELAY_MS);
}
