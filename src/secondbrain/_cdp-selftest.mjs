// 第二大脑评审壳 CDP 自检（issue 251；书架-10 先例：CDP 逐页打开 view 页，?selftest=1
// 断言结果写 document.title）。Node >= 22 原生 WebSocket；CDP 走 Target.createTarget +
// Page.navigate（/json/new 端点创建的 target 无 captureScreenshot）。
import { spawn, execSync } from 'node:child_process';
import * as fs from 'node:fs';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORT = 9245;

let EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
try { execSync(`"${EDGE}" --version`, { stdio: 'pipe' }); } catch { EDGE = 'msedge'; }

const profile = fs.mkdtempSync(process.env.TEMP + '/sb-shell-cdp-');
const proc = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  `--user-data-dir=${profile}`, '--window-size=1000,800', 'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { proc.kill(); } catch {} });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitCdp() {
  for (let i = 0; i < 40; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(250); }
  }
  throw new Error('CDP not reachable');
}

const results = [];
const exceptions = [];
let ws = null, msgId = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const id = ++msgId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

try {
  const version = await waitCdp();
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params?.exceptionDetails || {};
      exceptions.push((d.exception?.description || d.text || 'exception').slice(0, 160));
    }
  });

  for (const iface of ['panel', 'chat', 'ref']) {
    const { result: created } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: attached } = await send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
    const sessionId = attached.sessionId;
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    const url = 'file:///' + encodeURI(`${DIR}prototype-view.html?iface=${iface}&selftest=1`).replace(/^\/?/, '');
    await send('Page.navigate', { url }, sessionId);
    // 轮询 document.title 出 SB-SELFTEST 结果（最长 40s：chat 问答链路最慢）
    let title = '';
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      await sleep(500);
      const m = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }, sessionId);
      title = m.result?.result?.value || '';
      if (String(title).startsWith('SB-SELFTEST')) break;
    }
    const pass = title.startsWith('SB-SELFTEST PASS');
    results.push([iface, pass ? 'PASS' : 'FAIL', title]);
    if (iface === 'panel') {
      const cap = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
      if (cap.result?.data) {
        mkdirSync(DIR + '_shots', { recursive: true });
        writeFileSync(DIR + '_shots/' + iface + '.png', Buffer.from(cap.result.data, 'base64'));
      }
    }
    await send('Target.disposeTarget', { targetId: created.targetId }).catch(() => {});
  }
  // 参考界面截图（ref 在自检后补一张，浮窗+密度切换态已过）
  console.log('=== 第二大脑评审壳自检 ===');
  let fail = 0;
  for (const [iface, st, title] of results) {
    if (st !== 'PASS') fail++;
    console.log(`${st === 'PASS' ? '✓' : '✗'} [${iface}] ${title}`);
  }
  console.log(`exceptions: ${exceptions.length}${exceptions.length ? ' -> ' + exceptions.join(' | ').slice(0, 300) : ''}`);
  console.log(fail === 0 && exceptions.length === 0 ? 'ALL GREEN' : `HAS ${fail} ISSUE(S)`);
} finally {
  proc.kill();
}
