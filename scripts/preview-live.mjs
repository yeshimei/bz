/**
 * 原型热更新服务器（零依赖）：node scripts/preview-live.mjs [端口，默认 5177]
 * 服务仓库根目录；监听两棵源树——src/<域>/（插件源码：styles.css/render.ts/ui.ts 链）与
 * prototypes/<域>/（评审工件：壳 html/fake-sim.ts/fake 层），render.ts/shared.ts 变化自动
 * 重出预览包+行为包，ui.ts/fake 链变化重出行为包，然后经 SSE 推浏览器 location.reload()。
 * 打开 http://localhost:5177/prototypes/<域>/prototype.html 即得免刷新预览。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPreview, buildBehavior, PREVIEW_DOMAINS, BEHAVIOR_DOMAINS } from './build-preview.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 5177;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

// 监听两棵源树（相对仓库根的 rel 前缀区分）：src/ = 插件源码；prototypes/ = 评审工件
const srcRoot = path.join(ROOT, 'src');
const protoRoot = path.join(ROOT, 'prototypes');

let reloadTimer = 0;
const pendingEvents = new Map(); // rel → domain（防抖窗口内累积，防「.ts 与 css/html 同拍只认后者」漏重出）
function scheduleReload(changedRel, domain) {
  pendingEvents.set(changedRel, domain);
  clearTimeout(reloadTimer);
  // 防抖：编辑器常连发多个事件
  reloadTimer = setTimeout(async () => {
    // .ts 是打包链源码（入口 render.ts/fake-sim.ts 及其任意依赖）：两包都可能吃进；窗口内出现的 .ts 全部按域重出；
    // css/html/产物 .js 由服务器直出，广播刷新即可。
    const tsDomains = new Set();
    for (const [rel, dom] of pendingEvents) if (rel.endsWith('.ts')) tsDomains.add(dom);
    pendingEvents.clear();
    if (tsDomains.size) {
      try {
        for (const dom of tsDomains) {
          // 渲染产物仅渲染清单域重出（entry 在 src/<域>/render.ts）；行为域（如已摘渲染名单的 favorites）只重出行为包
          if (PREVIEW_DOMAINS.includes(dom)) await buildPreview([dom]);
          if (BEHAVIOR_DOMAINS.includes(dom)) await buildBehavior(dom);
        }
      } catch (e) { console.error('[preview-live] 产物重出失败：', e.message); return; }
    }
    for (const res of clients) res.write('data: reload\n\n');
    console.log(`[preview-live] ${tsDomains.size ? [...tsDomains].join('/') + ' 产物重出，' : ''}已推送刷新`);
  }, 120);
}

function watchRoot(rootName, rootPath) {
  fs.watch(rootPath, { recursive: true }, (_ev, filename) => {
    if (!filename) return;
    const rel = rootName + '/' + filename.split(path.sep).join('/');
    // src 树：.ts/.css/.html/原型三件套 .js；prototypes 树：任意 .ts/.css/.html/.js（含重出产物，自动广播刷新）
    const ext = rel.slice(rel.lastIndexOf('.'));
    const isRelevant = rootName === 'prototypes'
      ? /\.(ts|css|html|js)$/.test(ext)
      : rel.endsWith('.ts') || rel.endsWith('.css') || rel.endsWith('.html') || /\/prototype(\.app|\.data)?\.js$/.test(rel);
    if (!isRelevant) return;
    // 监听 = 渲染清单 ∪ 行为清单（favorites 等仅行为域：.ts 变化走行为包重出）
    const domain = rel.split('/')[1];
    if (!PREVIEW_DOMAINS.includes(domain) && !BEHAVIOR_DOMAINS.includes(domain)) return;
    scheduleReload(rel, domain);
  });
}
watchRoot('src', srcRoot);
watchRoot('prototypes', protoRoot);

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
  // 根路径 = 单源域导航首页（动态生成：PREVIEW_DOMAINS ∪ BEHAVIOR_DOMAINS）
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const domains = [...new Set([...BEHAVIOR_DOMAINS, ...PREVIEW_DOMAINS])];
    // 域 → 中文名/一句话说明（新域未登记时回退显示 id）
    const META = {
      belongings: ['归物本', '物品档案 · P20 大字报版式'],
      bookshelf: ['书架墙', '书库浏览 · 状态分架'],
      cinema: ['影院', '影视管理 · 豆瓣契约'],
      clipbook: ['剪藏本', '未读流 + 网页归档'],
      favorites: ['收藏本', '软木板 · 标签工作台'],
      home: ['首页', '内容首页 · 活动河'],
      knowledge: ['知识盒', '词典皮三部 · 文献 / 卡片 / 主题'],
      'password-vault': ['密码本', '密码条目 · 金印锁屏 · 演示库密码 demo'],
      review: ['复习计划', '三区队列 + 做题冲刺'],
      secondbrain: ['第二大脑', '卡片网络 · AI 对话'],
      'settings-panel': ['设置面板', '全域设置 · 行为单源'],
    };
    const items = domains
      .map((d) => {
        const has = fs.existsSync(path.join(ROOT, 'prototypes', d, 'prototype.html'));
        const [name, desc] = META[d] || [d, ''];
        return `<a class="card${has ? '' : ' off'}" href="/prototypes/${d}/prototype.html"><b>${name}</b><span class="id">${d}</span>${desc ? `<span class="desc">${desc}</span>` : ''}</a>`;
      })
      .join('\n');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>原型预览 · 单源域导航</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:#e9e7e1;font-family:system-ui,'Segoe UI','Microsoft YaHei',sans-serif;color:#211d16;padding:44px 24px}
.wrap{max-width:860px;margin:0 auto}
h1{font-size:21px}.sub{font-size:12.5px;color:#8b857a;margin:8px 0 24px;line-height:1.7}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(236px,1fr));gap:12px}
a.card{display:flex;flex-direction:column;gap:3px;background:#fbfaf7;border:1px solid #ddd6c8;border-radius:11px;padding:13px 15px;text-decoration:none;color:inherit;transition:.15s}
a.card:hover{transform:translateY(-2px);box-shadow:0 8px 20px #00000014;border-color:#a33d2a}
a.card b{font-size:15px}
a.card .id{font-size:10px;color:#b0a897;font-family:Consolas,monospace;letter-spacing:.02em}
a.card .desc{font-size:11.5px;color:#6d675c;margin-top:3px;line-height:1.5}
a.card.off{opacity:.45}
</style></head><body><div class="wrap"><h1>原型预览 · 行为单源域导航</h1>
<div class="sub">SSE 热刷新已注入各评审壳：改 ${'src/<域>/** 或 prototypes/<域>/**'} 的 .ts/.css/.html 自动重出产物并刷新。快捷键返回本页：浏览器后退。</div>
<div class="grid">\n${items}\n</div></div></body></html>`);
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
  const watched = [...new Set([...BEHAVIOR_DOMAINS, ...PREVIEW_DOMAINS])];
  console.log(`[preview-live] 导航首页 http://localhost:${PORT}/（单源域卡片）`);
  console.log(`[preview-live] 监听：src/ 与 prototypes/ 的 {${watched.join(',')}}/** 的 .ts/.css/.html`);
});
