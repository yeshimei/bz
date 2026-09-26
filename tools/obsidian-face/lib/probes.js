// ================================================================
// bz-face —— 真探测与子进程管道层（child_process / fs；Windows 优先口径）
//
// 约定（与 lib/doctor-core.js / lib/sync-core.js 的判定面对齐）：
//   1. 每个探测自带兜错，失败折成 { ok:false, error } —— 绝不抛栈给 CLI；
//   2. 只「读」不「装」：绝不调用 pip install 或任何安装动作，缺什么由判定层打命令；
//   3. 探测子进程一律 windowsHide + 超时，避免卡死交互；sync 长任务（runSyncProcess）
//      是唯一无超时的例外——分钟级导出不许被掐。
//
// 版本探测做到哪档（issue 463 口径，README 同步说明）：
//   ffmpeg/ffprobe —— 只查 PATH；接插件「外部工具」设置路径是后续票（ADR-0195 决策 6）。
//   微信版本 —— 进程在跑时经 PowerShell 取进程 exe 路径，读其文件版本
//   （FileVersionInfo.ProductVersion）；进程不在跑时读不到，安装目录探测同样留给后续票。
// ================================================================
'use strict';

const { execFile, spawn } = require('child_process');
const { StringDecoder } = require('string_decoder');
const fs = require('fs');
const path = require('path');

/** 探测子进程统一超时（毫秒）：PowerShell 冷启动可能到秒级，给足但不至于卡死 */
const PROBE_TIMEOUT_MS = 15000;

/**
 * 跑一条外部命令并兜错。成功 { ok:true, stdout, stderr }；
 * 失败 { ok:false, error }（含超时 / 非零退出 / 启动失败）。绝不抛。
 */
function runCmd(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    try {
      execFile(
        cmd,
        args,
        { windowsHide: true, timeout: timeoutMs || PROBE_TIMEOUT_MS, encoding: 'utf8' },
        (err, stdout, stderr) => {
          if (err) {
            const reason = err.killed
              ? `命令超时（>${timeoutMs || PROBE_TIMEOUT_MS}ms）`
              : err.code === 'ENOENT'
                ? `找不到命令：${cmd}`
                : (err.message || String(err)).split('\n')[0];
            resolve({ ok: false, error: reason, stdout: stdout || '', stderr: stderr || '' });
            return;
          }
          resolve({ ok: true, stdout: stdout || '', stderr: stderr || '' });
        },
      );
    } catch (e) {
      resolve({ ok: false, error: (e && e.message) || String(e) });
    }
  });
}

/**
 * 探测 Python：`python -c "print 版本三元组"`。
 * @param {string} pythonCmd python 命令（--python 参数可覆盖，缺省 'python'）
 * @returns {{ ok:boolean, version?:string, error?:string }}
 */
async function probePython(pythonCmd) {
  const cmd = pythonCmd || 'python';
  const r = await runCmd(cmd, ['-c', 'import sys; print("%d.%d.%d" % sys.version_info[:3])']);
  if (!r.ok) return { ok: false, error: r.error };
  const m = String(r.stdout || '').trim().match(/^(\d+\.\d+\.\d+)\b/);
  if (!m) return { ok: false, error: `无法解析版本输出：「${String(r.stdout || '').trim().slice(0, 40)}」` };
  return { ok: true, version: m[1] };
}

/**
 * 逐个探测一组 Python 模块可导入性：`python -c "import <mod>"`。
 * 组内并发跑（每个都是独立短进程，12 项并发出结果比串行快得多）。
 * @returns {Promise<{ ok:boolean, results:Record<string,{ok:boolean,error?:string}> }>}
 */
async function probeModules(pythonCmd, mods) {
  const cmd = pythonCmd || 'python';
  const names = (mods || []).map((m) => (typeof m === 'string' ? m : m.mod));
  const entries = await Promise.all(
    names.map(async (mod) => {
      const r = await runCmd(cmd, ['-c', `import ${mod}`]);
      return [mod, r.ok ? { ok: true } : { ok: false, error: r.error }];
    }),
  );
  return { ok: true, results: Object.fromEntries(entries) };
}

/**
 * 探测 PATH 上的命令行工具（ffmpeg / ffprobe）：跑一次版本参数。
 * 本票只查 PATH；「插件设置里的自定义路径」由后续票接（ADR-0195 决策 6）。
 * @returns {{ ok:boolean, found:boolean, version?:string, error?:string }}
 */
async function probePathTool(tool) {
  const r = await runCmd(tool, ['-version']);
  if (!r.ok) return { ok: true, found: false, error: r.error };
  const first = String(r.stdout || '').split('\n')[0].trim();
  const m = first.match(/version ([\w.\-+]+)/i);
  return { ok: true, found: true, version: m ? m[1] : undefined };
}

/**
 * 探测微信进程与版本（Windows）：
 *   在跑 —— tasklist 过滤进程名（Weixin.exe 4.x / WeChat.exe 3.x 各查一次）；
 *   版本 —— PowerShell 取进程 exe 路径，读文件版本 ProductVersion。
 * 契约：进程查询失败 → { ok:false, error }（running 不给值，判定层出「状态未知」）；
 *       查询成功但进程不在 → { ok:true, running:false, wx3Running }；
 *       在跑但版本读不出 → { ok:true, running:true, version 缺省, versionError }。
 * @returns {Promise<{ ok:boolean, running?:boolean, wx3Running?:boolean, version?:string, error?:string, versionError?:string }>}
 */
async function probeWeixin() {
  const list4x = await runCmd('tasklist', ['/FI', `IMAGENAME eq ${'Weixin.exe'}`, '/FO', 'CSV', '/NH']);
  if (!list4x.ok) {
    return { ok: false, error: `进程查询失败：${list4x.error}` };
  }
  const running4x = String(list4x.stdout || '').includes('Weixin.exe');
  if (!running4x) {
    // 3.x 在不在跑只影响提示文案（「检测到 3.x，本工具只支持 4.x」）
    const list3x = await runCmd('tasklist', ['/FI', 'IMAGENAME eq WeChat.exe', '/FO', 'CSV', '/NH']);
    const running3x = list3x.ok && String(list3x.stdout || '').includes('WeChat.exe');
    return { ok: true, running: false, wx3Running: running3x };
  }
  // 版本：进程 exe 的文件版本（需 PowerShell；拿不到不判死，判定层出「版本读不出」）
  const ps = await runCmd('powershell', [
    '-NoProfile',
    '-Command',
    "$p = (Get-Process Weixin -ErrorAction Stop | Select-Object -First 1).Path; " +
      'if ($p) { (Get-Item -LiteralPath $p).VersionInfo.ProductVersion }',
  ]);
  if (!ps.ok) {
    return { ok: true, running: true, versionError: ps.error };
  }
  const m = String(ps.stdout || '').trim().match(/\d+(?:\.\d+)+/);
  if (!m) {
    return { ok: true, running: true, versionError: '版本号解析失败' };
  }
  return { ok: true, running: true, version: m[0] };
}

/**
 * 探测数据根可写性：真实写入 + 删除一个探针文件（accessSync 的 W_OK 在 Windows 上
 * 只查只读属性，测不准「能不能写」，所以用实写验证）。
 * @param {string|undefined} dirPath --data-root 路径；未给 → { configured:false }
 * @returns {{ configured:boolean, path?:string, exists?:boolean, writable?:boolean, error?:string }}
 */
function probeDataRoot(dirPath) {
  if (!dirPath) return { configured: false };
  const probe = path.join(dirPath, `.bz-face-doctor-probe-${process.pid}.tmp`);
  try {
    const st = fs.statSync(dirPath);
    if (!st.isDirectory()) {
      return { configured: true, path: dirPath, exists: false, error: '路径存在但不是目录' };
    }
  } catch {
    return { configured: true, path: dirPath, exists: false };
  }
  try {
    fs.writeFileSync(probe, 'bz-face doctor 写入探针（可删）');
    fs.unlinkSync(probe);
    return { configured: true, path: dirPath, exists: true, writable: true };
  } catch (e) {
    return { configured: true, path: dirPath, exists: true, writable: false, error: (e && e.message) || String(e) };
  }
}

/**
 * 跑 bz_sync.py 长任务（issue 464）：stdout 逐行回调（UTF-8 行缓冲、跨 chunk 多字节安全），
 * stderr 留尾 2KB 滑窗，终结给 { code, stderr, error? }。**无超时**——分钟级导出不许被掐。
 * 强制子进程 UTF-8（Windows 管道缺省 locale 编码会烂中文）：-X utf8 + PYTHONIOENCODING。
 * 绝不抛：spawn 失败折成 { code:null, error }。协议解析不在这里——行原样交给 onLine，
 * 由 lib/sync-core.js 的中继透传（与 463「探测层不做判定」同款切分）。
 * @param {{ pythonCmd?: string, scriptPath: string, args?: string[],
 *            onLine?: (line: string) => void }} opts
 * @returns {Promise<{ code: number|null, stderr: string, error: Error|null }>}
 */
function runSyncProcess(opts) {
  const pythonCmd = (opts && opts.pythonCmd) || 'python';
  const onLine = (opts && opts.onLine) || null;
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    let child;
    try {
      child = spawn(
        pythonCmd,
        ['-X', 'utf8', opts.scriptPath].concat(opts.args || []),
        {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }),
        },
      );
    } catch (e) {
      done({ code: null, stderr: '', error: e });
      return;
    }
    // StringDecoder 兜多字节字符被 chunk 劈开的场景（BzLineSplitter 同问题域，包内零依赖实现）
    const decoder = new StringDecoder('utf8');
    let buffer = '';
    let stderrTail = '';
    const drain = (flush) => {
      for (;;) {
        const nl = buffer.indexOf('\n');
        if (nl === -1) break;
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (onLine) onLine(line);
      }
      if (flush && buffer) {
        if (onLine) onLine(buffer); // 无尾换行的最后一行
        buffer = '';
      }
    };
    child.stdout.on('data', (d) => {
      buffer += decoder.write(d);
      drain(false);
    });
    child.stderr.on('data', (d) => {
      stderrTail += decoder.write(d);
      if (stderrTail.length > 2048) stderrTail = stderrTail.slice(-2048);
    });
    child.on('error', (e) => {
      done({ code: null, stderr: stderrTail.trim(), error: e });
    });
    child.on('close', (code) => {
      buffer += decoder.end();
      drain(true);
      done({ code, stderr: stderrTail.trim(), error: null });
    });
  });
}

module.exports = {
  runCmd,
  probePython,
  probeModules,
  probePathTool,
  probeWeixin,
  probeDataRoot,
  runSyncProcess,
  PROBE_TIMEOUT_MS,
};
