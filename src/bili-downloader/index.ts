/**
 * B站下载器启动命令（bz-bili-downloader-open，main.ts 裸注册）
 * 外部工具 @jwbz/bili-downloader（tools/bili-downloader，ADR-0011）：
 * 桌面端 spawn 全局命令 bili-dl → 起本地服务并自动开浏览器；
 * 解析 stdout 中的服务地址，经自绘 toast 提示用户。
 */
import { notice } from '../core/notice';

/** 桌面端专属能力（CONTEXT.md）：window.require('child_process') 为 null 即非桌面端 */
function getChildProcess(): any {
  const w = window as any;
  if (!w.require) return null;
  try { return w.require('child_process'); } catch { return null; }
}

const ADDR_RE = /地址:\s*(https?:\/\/\S+)/;
const INSTALL_HINT = '请先运行 npm install -g @jwbz/bili-downloader';

/** 打开 B站下载器（bz-bili-downloader-open 命令回调） */
export function openBiliDownloader(): void {
  const cp = getChildProcess();
  if (!cp) { notice('❌ 仅桌面端可用：B站下载器需要 Node.js 外部进程'); return; }
  let child: any;
  try {
    // Windows 全局 bin 是 bili-dl.cmd shim，需 shell:true 解析（参数为空，无注入风险）
    child = cp.spawn('bili-dl', [], { shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e: any) {
    notice(`❌ 启动失败：${e.message}。${INSTALL_HINT}`);
    return;
  }
  let settled = false;
  const done = (msg: string) => { if (settled) return; settled = true; notice(msg); };
  let buf = '';
  child.stdout?.on('data', (d: Buffer) => {
    buf += String(d);
    const m = buf.match(ADDR_RE);
    if (m) done(`✅ B站下载器已启动：${m[1]}`);
  });
  child.stderr?.on('data', (d: Buffer) => { buf += String(d); });
  child.on('error', (e: Error) => {
    done(/ENOENT/.test(e.message) ? `❌ 未找到 bili-dl。${INSTALL_HINT}` : `❌ 启动失败：${e.message}`);
  });
  child.on('close', (code: number) => {
    if (!settled) done(code === 0 ? 'B站下载器已退出' : `❌ B站下载器启动失败。${INSTALL_HINT}`);
  });
  // 兜底：6 秒未解析到地址也提示（服务可能在后台拉起）
  setTimeout(() => { if (!settled) done('B站下载器启动中…浏览器将自动打开'); }, 6000);
}
