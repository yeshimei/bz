/**
 * 原型热更新服务器（零依赖）：node scripts/preview-live.mjs [端口，默认 5177]
 * 服务仓库根目录；监听单源清单内各域的 styles.css / prototype.html / render 链 / ui 链，
 * render.ts/shared.ts 变化自动重出预览包+行为包，ui.ts/fake 链变化重出行为包，然后经 SSE 推浏览器 location.reload()。
 * 打开 http://localhost:5177/src/<域>/prototype.html 即得免刷新预览。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPreview, buildBehavior, PREVIEW_DOMAINS, BEHAVIOR_DOMAINS } from './build-preview.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 5177;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

// 监听 src/<单源域>/ 下全部源码变化（含 layouts/** 嵌套与 fake 层）；构建产物 .js 不在监听之列
const srcRoot = path.join(ROOT, 'src');

let reloadTimer = 0;
function scheduleReload(changedRel) {
  clearTimeout(reloadTimer);
  // 防抖：编辑器常连发多个事件
  reloadTimer = setTimeout(async () => {
    const domain = changedRel.split('/')[0];
    // .ts 是打包链源码（入口 render.ts/ui.ts 及其任意依赖）：两包都可能吃进，按域全部重出最稳；
    // css/html 由服务器直出，广播刷新即可。
    if (changedRel.endsWith('.ts')) {
      try {
        await buildPreview([domain]);
        if (BEHAVIOR_DOMAINS.includes(domain)) await buildBehavior(domain);
      } catch (e) { console.error('[preview-live] 产物重出失败：', e.message); return; }
    }
    for (const res of clients) res.write('data: reload\n\n');
    console.log(`[preview-live] ${changedRel} 变化 → 已推送刷新`);
  }, 120);
}

fs.watch(srcRoot, { recursive: true }, (_ev, filename) => {
  if (!filename) return;
  const rel = filename.split(path.sep).join('/');
  if (!rel.endsWith('.ts') && !rel.endsWith('.css') && !rel.endsWith('.html')) return;
  if (!PREVIEW_DOMAINS.includes(rel.split('/')[0])) return;
  scheduleReload(rel);
});

const clients = new Set();
http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (ext === '.html') {
    // 注入 SSE 热刷新客户端
    res.end(fs.readFileSync(file).toString().replace('</body>', '<script>new EventSource("/__reload").onmessage=()=>location.reload()</script></body>'));
  } else {
    fs.createReadStream(file).pipe(res);
  }
}).listen(PORT, () => {
  console.log(`[preview-live] http://localhost:${PORT}/src/${PREVIEW_DOMAINS[0]}/prototype.html`);
  console.log(`[preview-live] 监听：src/{${PREVIEW_DOMAINS.join(',')}}/** 的 .ts/.css/.html`);
});
