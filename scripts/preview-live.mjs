/**
 * 原型热更新服务器（零依赖）：node scripts/preview-live.mjs [端口，默认 5177]
 * 服务仓库根目录；监听两棵源树——src/<域>/（插件源码：styles.css/render.ts/ui.ts 链）与
 * prototypes/<域>/（评审工件：壳 html/fake-sim.ts/fake 层），render.ts/shared.ts 变化自动
 * 重出预览包+行为包，ui.ts/fake 链变化重出行为包，然后经 SSE 推浏览器 location.reload()。
 * 变化的 .ts 按**产物输入清单**（`#preview-inputs=`）反查依赖域重出：产物是跨域打包的
 * （settings-panel 的包内联 src/home/settings.ts；src/core/** 每包都有），
 * 只重出「变化文件所在域」会让内联它的壳静默停在旧版（2026-09-10 两次实例）。
 * 打开 http://localhost:5177/prototypes/<域>/prototype.html 即得免刷新预览。
 *
 * 另供 /__vault-media/<文件名>：按 basename 从【真实 vault】按需取流（支持 Range，
 * 视频可拖拽）。评审快照引用的媒体全量 1.8G（图 577M / 视频 1.07G / 音频 151M），
 * 不可能入库——入库只留小分子集，剩下的走本路由现场取，保真且仓库不膨胀。
 * vault 根从 esbuild.config.mjs 的 VAULT_PLUGIN_DIR 反推，可用 --vault <根> 覆盖。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPreview, buildBehavior, PREVIEW_DOMAINS, BEHAVIOR_DOMAINS } from './build-preview.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 5177;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.map': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
  '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

// ---------- 真实 vault 媒体索引（惰性建，只收媒体扩展名） ----------
const MEDIA_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg', '.mp4', '.m4v', '.webm', '.mov', '.ogv', '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.oga']);
let vaultRoot = '';
{
  const i = process.argv.indexOf('--vault');
  if (i >= 0 && process.argv[i + 1]) vaultRoot = path.resolve(process.argv[i + 1]);
  else {
    try {
      const cfg = fs.readFileSync(path.join(ROOT, 'esbuild.config.mjs'), 'utf8');
      const m = cfg.match(/VAULT_PLUGIN_DIR\s*=\s*"([^"]+)"/);
      if (m) vaultRoot = path.resolve(m[1], '..', '..', '..'); // <vault>/.obsidian/plugins/bz → <vault>
    } catch { /* 构建配置读不到：本路由退化为 404，其余功能不受影响 */ }
  }
}
let vaultIndexCache = null;
function vaultIndex() {
  if (vaultIndexCache) return vaultIndexCache;
  const map = new Map();
  if (!vaultRoot || !fs.existsSync(vaultRoot)) return (vaultIndexCache = map);
  const stack = [vaultRoot];
  while (stack.length) {
    const cur = stack.pop();
    let ents;
    try { ents = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      if (e.name === '.obsidian' || e.name === '.trash' || e.name.startsWith('.git')) continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (MEDIA_EXT.has(path.extname(e.name).toLowerCase()) && !map.has(e.name.toLowerCase())) map.set(e.name.toLowerCase(), p);
    }
  }
  console.log(`[preview-live] vault 媒体索引：${map.size} 个（${vaultRoot || '未定位 vault'}）`);
  return (vaultIndexCache = map);
}

/** vault 媒体流（Range 支持：视频拖拽/逐段加载必需） */
function serveVaultMedia(req, res, rawName) {
  const name = decodeURIComponent(rawName);
  const file = vaultIndex().get(name.toLowerCase());
  if (!file || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('vault media not found: ' + name);
    return;
  }
  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      let start = m[1] ? Number(m[1]) : 0;
      let end = m[2] ? Number(m[2]) : size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        res.end();
        return;
      }
      end = Math.min(end, size - 1);
      res.writeHead(206, {
        'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size, 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

// 监听两棵源树（相对仓库根的 rel 前缀区分）：src/ = 插件源码；prototypes/ = 评审工件
const srcRoot = path.join(ROOT, 'src');
const protoRoot = path.join(ROOT, 'prototypes');

/**
 * 产物 → 输入清单索引（rel 路径 → 含它的域名集合）。
 *
 * 为什么需要：产物是**跨域打包**的 —— 例：`src/home/settings.ts`（首页域）被内联进
 * `settings-panel` 的包（面板经 schemaLoaders 懒加载各域 schema），`src/core/**` 更是每包都有。
 * 只按「变化文件所在域」重出，就会漏掉所有把它内联进去的域 → **壳静默停在旧版**
 * （2026-09-10 两次实例：首页入口弹窗改了设置壳不更新、回忆墙退役首页不更新）。
 * 产物头部两行里就有 `#preview-inputs=[…]`（build-preview 写入），据此**反查真正的依赖域**。
 */
let inputIndex = null; // rel → Set<domain>；每次重出后置空重建（产物输入集可能变）
/** banner 里的输入清单（与 tests/preview-freshness.test.ts 同一正则口径） */
const INPUTS_RE = /\/\*#preview-inputs=(\[[^\n]*\])\*\//;
function buildInputIndex() {
  const idx = new Map();
  const domains = [...new Set([...BEHAVIOR_DOMAINS, ...PREVIEW_DOMAINS])];
  for (const d of domains) {
    for (const f of ['prototype-behavior.js', 'prototype-render.js']) {
      const abs = path.join(protoRoot, d, f);
      let head;
      try { head = fs.readFileSync(abs, 'utf8').slice(0, 400000); } catch { continue; } // 该域没有这包
      // 解析口径与新鲜度守卫一致（tests/preview-freshness.test.ts 的同名正则）：
      // banner 是一整行 `/*#preview-inputs=[…]*/`，不能靠「切到行尾」——会把 `*/` 带进去让 JSON.parse 抛错
      const m = head.match(INPUTS_RE);
      if (!m) continue;
      let list;
      try { list = JSON.parse(m[1]); } catch { continue; }
      for (const rel of list) {
        if (!idx.has(rel)) idx.set(rel, new Set());
        idx.get(rel).add(d);
      }
    }
  }
  return idx;
}
/** 某源码文件变化时，真正需要重出的域名（查产物输入清单；新文件查不到则回落路径域名） */
function dependentDomains(rel, pathDomain) {
  if (!inputIndex) inputIndex = buildInputIndex();
  const hit = inputIndex.get(rel);
  if (hit && hit.size) return hit;
  return PREVIEW_DOMAINS.includes(pathDomain) || BEHAVIOR_DOMAINS.includes(pathDomain) ? new Set([pathDomain]) : new Set();
}

let reloadTimer = 0;
const pendingEvents = new Map(); // rel → domain（防抖窗口内累积，防「.ts 与 css/html 同拍只认后者」漏重出）
function scheduleReload(changedRel, domain) {
  pendingEvents.set(changedRel, domain);
  clearTimeout(reloadTimer);
  // 防抖：编辑器常连发多个事件
  reloadTimer = setTimeout(async () => {
    // .ts 是打包链源码：**按产物输入清单反查依赖域**（跨域内联，见 dependentDomains 注释），
    // 而不是按「变化文件所在目录」——否则设置壳这种「内联了别域源码」的包永远不更新。
    // css/html/产物 .js 由服务器直出，广播刷新即可。
    const tsDomains = new Set();
    for (const [rel, dom] of pendingEvents) {
      if (!rel.endsWith('.ts')) continue;
      for (const d of dependentDomains(rel, dom)) tsDomains.add(d);
    }
    pendingEvents.clear();
    if (tsDomains.size) {
      try {
        for (const dom of tsDomains) {
          // 渲染产物仅渲染清单域重出（entry 在 src/<域>/render.ts）；行为域（如已摘渲染名单的 favorites）只重出行为包
          if (PREVIEW_DOMAINS.includes(dom)) await buildPreview([dom]);
          if (BEHAVIOR_DOMAINS.includes(dom)) await buildBehavior(dom);
        }
        inputIndex = null; // 输入集可能已变（新增/删除 import）→ 索引重建
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
      diary: ['日记本', '媒体墙 · 章节导航（ADR-0115）'],
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
  // 真实 vault 媒体按需取流（评审壳的 mediaSrc 未命中入库子集时回退到这里）
  if (url.pathname.startsWith('/__vault-media/')) {
    serveVaultMedia(req, res, url.pathname.slice('/__vault-media/'.length));
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
