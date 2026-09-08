// 一次性 CDP 自检驱动（issue 253）：Edge headless 打开 prototype.html?selftest=1，
// 轮询 document.title 到 SELFTEST 结果。跑完即删（临时脚本不入库）。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!edge) {
  console.error('Edge not found');
  process.exit(1);
}
const port = 9333 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bz-review-st-'));
// 目标页默认取本仓库内壳（跨 worktree 复用），可用 argv[2] 覆盖完整 URL
const shellUrl = new URL('../src/review/prototype.html', import.meta.url);
const url = process.argv[2] || shellUrl.href + '?selftest=1';

const proc = spawn(edge, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-extensions',
  '--disable-sync', '--allow-file-access-from-files', '--window-size=1200,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  const list = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
  return list.find((t) => t.type === 'page' && t.url.includes('prototype.html'));
}

// 用 /json/new 打开目标页（命令行 URL 会被首启页劫持）
async function openUrl() {
  for (let i = 0; i < 15; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/new?${url}`, { method: 'PUT' });
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await sleep(1000);
  }
  throw new Error('cannot open target url');
}

let ws = null;
let seq = 1;
async function evalTitle() {
  const list = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
  const target = list.find((t) => t.type === 'page' && t.url.includes('prototype.html'));
  if (!target) return null;
  if (!ws || ws.readyState > 1) {
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res2, rej2) => { ws.onopen = res2; ws.onerror = rej2; });
  }
  const id = seq++;
  const msg = { id, method: 'Runtime.evaluate', params: { expression: 'document.title', returnByValue: true } };
  const out = await new Promise((resolve) => {
    const onMsg = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.id === id) { ws.removeEventListener('message', onMsg); resolve(data); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify(msg));
  });
  return out?.result?.result?.value ?? null;
}

let title = null;
try {
  await openUrl();
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    try {
      title = await evalTitle();
    } catch { /* ws 重连重试 */ }
    if (title && (title.startsWith('SELFTEST OK') || title.startsWith('SELFTEST FAIL') || title.startsWith('SELFTEST ERR'))) break;
    if (i === 58) console.log('TIMEOUT last title:', title);
  }
  console.log('TITLE:', title);
} finally {
  proc.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
