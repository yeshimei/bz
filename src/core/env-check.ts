/* ============================================================
 * bz · 环境探测（core/env-check.ts）
 *
 * 只做「测 + 说」，不碰 UI、不写盘（唯一的写是一次性写探针文件验证可写性）。
 * 视图在 core/setup-wizard.ts（首次引导与「环境自检」共用同一套行渲染）。
 *
 * 每条结果带一个 `fix`：告诉界面「这一项缺了该拿什么补」——
 *   node   → 下便携 Node 运行时
 *   tools  → 下外部工具目录包（知识盒工具包 / 工具坞工具包 / 脸谱工具包）
 *   docs   → 下文档与大索引（手册/更新日志/分类表/RSS/豆瓣索引）
 *   ai     → 去设置里填密钥（不是下载）
 * 界面按 fix 决定按钮，不靠关键词猜。
 *
 * 三条口径（沿用前版）：
 *  - **可写**要真写一次再删掉：`exists()` 通过不代表能写（只读盘、iCloud 占位、权限位）。
 *  - **移动端**不报错，如实说「这一项在手机上不适用」。
 *  - **不把「没配」当「坏了」**：AI 密钥是可选项，只提示，不计红。
 * ============================================================ */
import { requestUrl } from 'obsidian';
import { REPO_BASES, REPO_SLUG } from './remote-base';
import { tryGetSettings } from './settings-provider';
import { pluginRelDirOf } from './plugin-path';
import { isMobileEnv } from './mobile';
import { probeNodeRuntime, runtimeDiagnostics, vaultBasePathOf } from './tool-runtime';
import { getApp } from './app';
import { DEFAULT_STORAGE_DIR, normalizeStorageDir } from './storage-path';

/** 缺项的可补方式（见文件头） */
export type EnvFix = 'node' | 'tools' | 'docs' | 'ai';

/** 一行检查结果 */
export interface EnvCheckRow {
  /** 稳定 id（重检后按 id 就地更新，不整表重建） */
  id: string;
  key: string;
  value: string;
  /** true = 正常；false = 需要处理；null = 不适用/仅提示（不计红） */
  ok: boolean | null;
  /** 缺了怎么补；null/undefined = 只展示 */
  fix?: EnvFix | null;
}

/** 网络探测结果（第一屏第一件事就是它：不通的话后面全是白忙） */
export interface NetworkProbe {
  /** GitHub 是否可达（主通道——Release 资产与其页面同域，文案只说 GitHub） */
  github: boolean;
  /** jsDelivr 是否可达（备用通道） */
  jsdelivr: boolean;
  /** 主通道耗时（ms；不可达 = -1） */
  githubMs: number;
  /** 备用通道耗时（ms；不可达 = -1） */
  jsdelivrMs: number;
  /** 不可达时的原因（可达 = 空串）——「不可达」三个字没法排查，原因才有用 */
  githubError: string;
  /** 备用通道不可达的原因（可达 = 空串） */
  jsdelivrError: string;
}

/** 单次探测的超时（requestUrl 没有 abort，用 race 兜住；超时按不可达算） */
const PROBE_TIMEOUT_MS = 6000;

/** GitHub 主通道的探测 URL：仓库页恒定存在，且与 Release 下载同域（见 probeNetwork 注释） */
const GITHUB_PROBE_URL = `https://github.com/${REPO_SLUG}`;

/** 一次探测的原始结果 */
interface NetAttempt {
  /** 耗时（ms）；拿不到响应 = -1 */
  ms: number;
  /** HTTP 状态码；0 = 连响应都没有（网络层就断了） */
  status: number;
  /** 失败原因（成功 = 空串） */
  error: string;
}

/**
 * 拉一个小文件试通道（`downloads/version.json`，46 字节，代价可忽略）。
 *
 * 两处刻意的写法，都是 2026-10-28 用户报障（网络正常却显示「两条都不可达」）改出来的：
 *
 * 1. **`requestUrl` 用静态 import**。此前写 `await import('obsidian')`，而 Obsidian 的
 *    渲染进程跑的是 CJS、没有 importmap，裸模块名的动态 import 解析不了 —— 那个 await
 *    永远进 catch，于是**无论网络多好，两条通道都判成不可达**。全仓只有这一处这么写，
 *    它的兄弟（remote-asset / self-update / douban-queue）都是静态 import。
 * 2. **`throw: false` + 看状态码**。探的是「通道通不通」，不是「这个文件在不在」：
 *    `throw: true` 会把 404 也算成不可达，把「文件没了」误报成「断网」。
 */
async function timedFetch(url: string): Promise<NetAttempt> {
  const t0 = Date.now();
  const attempt = (async (): Promise<NetAttempt> => {
    try {
      const r = await requestUrl({ url, method: 'GET', throw: false });
      const status = Number(r?.status) || 0;
      if (!status) return { ms: -1, status: 0, error: '响应没有状态码' };
      // 403 / 407 / 451 是「通道拒绝服务」，跟断网一样用不了；404 只是「这个文件不在」
      // （网络通着），不能混为一谈——jsDelivr 对本仓库的 403 正文是「仓库超过 50 MB」。
      if (status === 403 || status === 407 || status === 451) {
        return {
          ms: -1,
          status,
          error: /Package size exceeded/i.test(String(r?.text || ''))
            ? '通道拒绝分发（仓库超过 50 MB）'
            : `HTTP ${status}`,
        };
      }
      return { ms: Date.now() - t0, status, error: '' };
    } catch (e: unknown) {
      return { ms: -1, status: 0, error: String((e as Error)?.message || e || '未知错误') };
    }
  })();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<NetAttempt>((resolve) => {
    timer = setTimeout(
      () => resolve({ ms: -1, status: 0, error: `超时（${PROBE_TIMEOUT_MS} ms 内没有响应）` }),
      PROBE_TIMEOUT_MS,
    );
  });
  const out = await Promise.race([attempt, timeout]);
  if (timer) clearTimeout(timer);
  return out;
}

/**
 * 把错误原文折成一句人话。原文（`net::ERR_NAME_NOT_RESOLVED` 之类）留在括号里给排查用，
 * 但第一眼要能看懂是哪一类问题——「不可达」三个字对用户毫无用处。
 */
export function explainNetError(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '未知原因';
  if (/超时|timed? ?out|ETIMEDOUT/i.test(s)) return '超时';
  if (/仓库超过 50 MB|Package size exceeded/i.test(s)) return '通道拒绝分发（仓库超过 50 MB）';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION/i.test(s)) return '域名解析失败';
  if (/ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(s)) return '连接被拒绝（代理没开？）';
  if (/ECONNRESET|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_CONNECTION_ABORTED/i.test(s)) return '连接被重置（常见于被墙）';
  if (/CERT|SSL|TLS|ERR_CERT/i.test(s)) return '证书校验失败（代理做了解密？）';
  if (/407|proxy|PROXY/i.test(s)) return '代理要求认证';
  if (/ENETUNREACH|ERR_INTERNET_DISCONNECTED|EHOSTUNREACH/i.test(s)) return '本机没有网络';
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

/**
 * 探两条通道（并发）。**不抛错**：两条都不通也是一种正常结果，
 * 界面据此给出「检查代理/VPN」的说明而不是一个异常。
 */
export async function probeNetwork(): Promise<NetworkProbe> {
  // 全通道并发探。逐个串行探会让「两条都不通」的结论慢三倍，而这一步是首次引导的第一屏——等不起。
  //  - GitHub 主通道：探仓库页 `github.com/<REPO_SLUG>`——Release 资产下载就在这个域
  //    （302 到 objects.githubusercontent.com）。tag 未知时探真资产只能是 404，404 是
  //    「文件不在」不是「通道不通」，所以探恒定存在的仓库页。
  //  - jsDelivr：探 version.json，取**最快**的那个边缘（国内实测 cdn 不通、fastly/gcore/testingcf 通）
  const urls = [GITHUB_PROBE_URL, ...REPO_BASES.map((b) => `${b}/downloads/version.json`)];
  const results = await Promise.all(urls.map((u) => timedFetch(u)));
  const gh = results[0] ?? { ms: -1, status: 0, error: '未探测' };
  const cdn = results.slice(1).filter((r) => r.ms >= 0);
  // 判据是 ms >= 0（只有真拿到 2xx/3xx 才算），不是 status > 0 —— 403 也有状态码
  const fastest = cdn.length ? cdn.reduce((a, b) => (b.ms < a.ms ? b : a)) : null;
  return {
    github: gh.ms >= 0,
    jsdelivr: !!fastest,
    githubMs: gh.ms >= 0 ? gh.ms : -1,
    jsdelivrMs: fastest ? fastest.ms : -1,
    githubError: gh.ms >= 0 ? '' : explainNetError(gh.error),
    jsdelivrError: fastest ? '' : explainNetError((results.slice(1).find((r) => r.error) ?? gh).error),
  };
}

/**
 * 真写一次再删掉（`exists()` 不代表可写：只读盘、占位文件、权限位都能骗过它）。
 * 导出给首次引导的「存放位置」一屏用——用户改完路径当场验，不合格就不许往下走。
 */
export async function probeWritableDir(app: unknown, relPath: string): Promise<boolean> {
  const adapter = (app as {
    vault?: {
      adapter?: {
        write?: (p: string, d: string) => Promise<void>;
        remove?: (p: string) => Promise<void>;
        mkdir?: (p: string) => Promise<void>;
      };
    };
  }).vault?.adapter;
  if (!adapter?.write) return false;
  const dir = relPath.replace(/\/+$/, '');
  // 目录可能还不存在（首次运行，数据目录尚未建）——逐级建一遍再写探针，
  // 否则「还没建」会被误报成「不可写」，那是两件完全不同的事。
  let cur = '';
  for (const part of dir.split('/').filter(Boolean)) {
    cur = cur ? `${cur}/${part}` : part;
    try {
      await adapter.mkdir?.(cur);
    } catch {
      /* 已存在 */
    }
  }
  const probe = `${dir}/.bz-write-probe`;
  try {
    await adapter.write(probe, 'ok');
    await adapter.remove?.(probe);
    return true;
  } catch {
    return false;
  }
}

/** 读设置里的数据目录（不 import 域，只读 provider）。
 *  2026-10-29 起新库的初值是 <插件目录>/storage，且启动时会写进 data.json，
 *  所以这里读到的通常就是真落位；空值才回落到老缺省。 */
async function storageDirOf(): Promise<string> {
  try {
    return normalizeStorageDir(tryGetSettings()?.storagePath);
  } catch {
    return DEFAULT_STORAGE_DIR;
  }
}

/**
 * 找 Python（脸谱导入微信记录要用）。
 *
 * **只探测、不安装**：脸谱的依赖是 funasr/torch 这一档（pip 装下来 GB 级，还要 ffmpeg 与
 * 模型文件），自动装等于替用户下一个几 GB 的包再赌网络——这种事不能藏在「一键」后面。
 * 所以这一行永远不判红，只如实说「有没有」。
 *
 * 一个必须避开的坑：Windows 10/11 的 `%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe`
 * 是**应用商店别名占位符**，每台机器都有、跑起来什么都不做（要么弹商店，要么直接退出）。
 * 只看 `where python` 会把它当成「已装 Python」，等脸谱真跑起来才报一个看不懂的错。
 * 所以拿到路径后必须真跑一次 `-V`，认输出里的版本号。
 */
export function isRealPythonOutput(out: string): boolean {
  return /Python\s+3\.\d+/i.test(String(out || ''));
}

function pythonProbe(): { found: boolean; value: string } {
  const configured = String(tryGetSettings()?.pythonPath || '').trim();
  if (configured) return { found: true, value: `已配置：${configured}` };
  if (typeof window === 'undefined') return { found: false, value: '未知（非桌面端）' };
  let cp: any = null;
  try {
    cp = (window as any).require?.('child_process');
  } catch {
    cp = null;
  }
  if (!cp?.spawnSync) return { found: false, value: '未知' };

  const win = typeof process !== 'undefined' && process.platform === 'win32';
  const finder = win ? 'where' : 'which';
  for (const name of ['python', 'python3']) {
    let path = '';
    try {
      const r = cp.spawnSync(finder, [name], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
      path = String(r?.stdout || '')
        .split(String.fromCharCode(10))
        .map((x: string) => x.trim())
        .filter(Boolean)[0] || '';
    } catch {
      path = '';
    }
    if (!path) continue;
    // 真跑一次：占位符/坏装在 `where` 里也有，只有 `-V` 会说话
    try {
      const v = cp.spawnSync(path, ['-V'], { encoding: 'utf8', windowsHide: true, timeout: 8000 });
      const out = `${v?.stdout || ''}${v?.stderr || ''}`;
      if (isRealPythonOutput(out)) {
        return { found: true, value: `${out.trim().split(String.fromCharCode(10))[0]}（${path}）` };
      }
    } catch {
      /* 跑不起来 = 不是真 Python，继续找下一个 */
    }
  }
  return { found: false, value: '未找到可用的 Python 3（脸谱导入微信记录时需要，其余功能不受影响）' };
}

/** 读 AI 是否已配（按当前服务商判；ollama 本地无鉴权视为已配） */
async function aiConfigured(): Promise<{ ok: boolean; value: string }> {
  try {
    const s = await import('./settings-provider').then((m) => m.tryGetSettings());
    const provider = String(s?.aiProvider || 'deepseek');
    if (provider === 'ollama') return { ok: true, value: '本地 Ollama（无需密钥）' };
    const key = provider === 'zhipu-plan' ? s?.zhipuPlanApiKey : s?.deepseekApiKey;
    return key && String(key).trim()
      ? { ok: true, value: provider === 'zhipu-plan' ? '智谱 Coding 套餐' : 'DeepSeek' }
      : { ok: false, value: '未配置（摘要、小橘等 AI 功能不可用）' };
  } catch {
    return { ok: false, value: '未配置' };
  }
}

/** 跑一遍全部检查（纯读 + 一次写探针；不联网） */
export async function environmentCheck(app: unknown): Promise<EnvCheckRow[]> {
  const rows: EnvCheckRow[] = [];
  const mobile = isMobileEnv();
  const base = vaultBasePathOf(app);

  rows.push({
    id: 'runtime',
    key: '运行环境',
    value: mobile ? '移动端（部分功能需要桌面端 Obsidian）' : '桌面端',
    ok: mobile ? null : true,
  });

  rows.push({
    id: 'vault',
    key: 'vault 路径',
    value: base || '取不到（插件可能不在桌面端运行）',
    ok: base ? true : null,
  });

  if (!mobile) {
    // 插件目录名由用户决定（core/plugin-path）——展示真实那一条，别给一个「标准路径」
    const pluginRel = pluginRelDirOf(app);
    const pluginWritable = await probeWritableDir(app, pluginRel);
    rows.push({
      id: 'plugin-writable',
      key: '插件目录可写',
      value: pluginWritable ? pluginRel : `${pluginRel}（写不进去：自更新与资源下载都会失败）`,
      ok: pluginWritable,
    });
  }

  const storeDir = await storageDirOf();
  const storeOk = await probeWritableDir(app, storeDir);
  rows.push({
    id: 'storage',
    key: '数据目录可写',
    value: storeOk ? storeDir : `${storeDir}（写不进去：检查是否只读 / 被同步盘占用）`,
    ok: storeOk,
  });

  if (!mobile) {
    const node = probeNodeRuntime(app, { fresh: true });
    rows.push({
      id: 'node',
      key: 'Node 运行时',
      value:
        node.kind === 'none'
          ? '未找到（知识盒工具包、工具坞工具包、脸谱工具包都靠它跑）'
          : `${node.kind === 'bundled' ? '插件内' : '系统'}${node.version ? ` ${node.version}` : ''}`,
      ok: node.kind === 'none' ? false : true,
      fix: node.kind === 'none' ? 'node' : null,
    });
    // 三个工具的状态由 runtimeDiagnostics 统一给（与面板同一口径）；前两行不是工具，跳过
    for (const r of runtimeDiagnostics(app).slice(2)) {
      const notInstalled = r.value === '未安装';
      rows.push({
        id: `tool-${r.key}`,
        key: r.key,
        value: r.value,
        ok: notInstalled ? false : true,
        fix: notInstalled ? 'tools' : null,
      });
    }
  }

  // Windows 的 MAX_PATH 是 260：脸谱包解出来的最深路径大约再叠 100 字符，
  // vault 放得太深（比如一层层套在 OneDrive\文档\项目\… 下）就会解包到一半失败，
  // 报错是 ENOENT/mkdir 失败，看不出跟「路径太长」有关。这里提前量一下。
  if (!mobile && typeof process !== 'undefined' && process.platform === 'win32') {
    const deep = `${base}/${pluginRelDirOf(app)}/downloads/tools/obsidian-face/python/funasr/models/`.length;
    if (deep > 180) {
      rows.push({
        id: 'path-length',
        key: '路径长度',
        value: `vault 路径较长（约 ${deep} 字符），Windows 260 上限下可能解包失败；建议把 vault 放到更浅的目录`,
        ok: deep < 240 ? null : false,
      });
    }
  }

  const python = pythonProbe();
  rows.push({
    id: 'python',
    key: 'Python 环境',
    value: python.value,
    ok: null, // 可选项：没装不判红，但要让人看见（脸谱导入需要）
  });

  const ai = await aiConfigured();
  rows.push({
    id: 'ai',
    key: 'AI 服务',
    value: ai.value,
    ok: ai.ok ? true : null, // 没配不算坏：主体功能不依赖它
    fix: ai.ok ? null : 'ai',
  });

  return rows;
}
